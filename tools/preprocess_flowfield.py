# -*- coding: utf-8 -*-
"""风暴潮流场数据预处理:Tecplot ASCII + shapefile -> mesh.bin / frames.bin / meta.json

用法:
    python tools/preprocess_flowfield.py            # 生成
    python tools/preprocess_flowfield.py --verify   # 生成 + 抽样比对原始数据
"""
import glob
import json
import os
import re
import struct
import sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHP_PATH = os.path.join(ROOT, "风暴潮流场网格", "grid-wgs84.shp")
DAT_GLOB = os.path.join(ROOT, "AREA_RST_WUV_*", "*.DAT")
OUT_DIR = os.path.join(ROOT, "tdesign", "public", "data", "flowfield")

MESH_MAGIC = 0x46464D31   # '1MFF'
FRAME_MAGIC = 0x46464631  # '1FFF'
DRY = -32768
DRY_DEPTH = 0.05          # m,水深小于此判干
LEVEL_SCALE = 0.01        # int16 -> m
UV_SCALE = 0.001          # int16 -> m/s

ZONE_RE = re.compile(r'ZONE\s+T="(\d{4})-\s*(\d+)-\s*(\d+)\s+(\d+):(\d+):(\d+)"')


# ---------------------------------------------------------------- shapefile
def read_shp_rings(path):
    """读 Polygon shapefile,返回 list[np.ndarray (k,2)],k=3/4,去闭合点。"""
    rings = []
    with open(path, "rb") as f:
        header = f.read(100)
        assert struct.unpack("<i", header[32:36])[0] == 5, "非 Polygon shapefile"
        while True:
            rec_header = f.read(8)
            if len(rec_header) < 8:
                break
            (content_len,) = struct.unpack(">i", rec_header[4:8])
            content = f.read(content_len * 2)
            shape_type = struct.unpack("<i", content[0:4])[0]
            assert shape_type == 5, f"记录 shapeType={shape_type}"
            num_parts, num_points = struct.unpack("<2i", content[36:44])
            assert num_parts == 1, f"多部件多边形不支持: parts={num_parts}"
            pts_off = 44 + 4 * num_parts
            pts = np.frombuffer(content, dtype="<f8", count=num_points * 2,
                                offset=pts_off).reshape(-1, 2)
            assert np.allclose(pts[0], pts[-1]), "环未闭合"
            rings.append(pts[:-1].copy())  # 去闭合点 -> 3 或 4 点
    return rings


# ---------------------------------------------------------------- tecplot
def parse_block(chunks):
    return np.array(" ".join(chunks).split(), dtype=np.float64)


def iter_zones(path):
    """逐 ZONE 生成 (time_tuple, numeric_tokens ndarray)。
    zone1 含 X,Y,Z,Z1,U,V + 连接表;后续仅 Z1,U,V。"""
    with open(path, "r") as f:
        cur_time, chunks = None, []
        for line in f:
            c = line.lstrip()[:1]
            if c and (c.isalpha() or c == '"'):
                m = ZONE_RE.search(line)
                if m:
                    if cur_time is not None:
                        yield cur_time, parse_block(chunks)
                    cur_time = tuple(int(g) for g in m.groups())
                    chunks = []
                continue
            if cur_time is not None and line.strip():
                chunks.append(line)
        if cur_time is not None:
            yield cur_time, parse_block(chunks)


# ---------------------------------------------------------------- 节点重建
def cell_perm(k, n, r, flip):
    """conn 第 k 节点对应环点序号(n 边形,旋转 r,flip 反向)。"""
    return (r + k) % n if not flip else (r - k) % n


def try_hypothesis(rings, conn, uniq_counts, r, flip, sample):
    """在抽样单元上应用统一假设,返回冲突数。"""
    coord = {}
    conflicts = 0
    for i in sample:
        n = uniq_counts[i]
        ring = rings[i]
        for k in range(n):
            node = conn[i, k]
            p = ring[cell_perm(k, n, r % n, flip)]
            if node in coord:
                if abs(coord[node][0] - p[0]) > 1e-7 or abs(coord[node][1] - p[1]) > 1e-7:
                    conflicts += 1
            else:
                coord[node] = p
    return conflicts


def rebuild_nodes(rings, conn, n_nodes):
    """由 shp 环点 + 连接表重建节点经纬度,全量校验。"""
    n_cells = len(rings)
    uniq_counts = np.where(conn[:, 3] == conn[:, 0], 3, 4)
    ring_counts = np.array([len(r) for r in rings])
    assert (ring_counts == uniq_counts).all(), "shp 环点数与连接表唯一节点数不一致"

    rng = np.random.default_rng(42)
    sample = rng.choice(n_cells, size=min(1000, n_cells), replace=False)
    best = None
    for flip in (False, True):
        for r in range(4):
            c = try_hypothesis(rings, conn, uniq_counts, r, flip, sample)
            print(f"  假设 rot={r} flip={flip}: 抽样冲突 {c}")
            if c == 0:
                best = (r, flip)
                break
        if best:
            break
    assert best, "8 种统一假设均失败,需实现约束传播(未预期)"
    r, flip = best

    lon = np.full(n_nodes, np.nan)
    lat = np.full(n_nodes, np.nan)
    max_dev = 0.0
    for i in range(n_cells):
        n = uniq_counts[i]
        ring = rings[i]
        for k in range(n):
            node = conn[i, k]
            p = ring[cell_perm(k, n, r % n, flip)]
            if np.isnan(lon[node]):
                lon[node], lat[node] = p
            else:
                max_dev = max(max_dev, abs(lon[node] - p[0]), abs(lat[node] - p[1]))
    assert max_dev < 1e-6, f"全量校验失败 max_dev={max_dev}"
    assert not np.isnan(lon).any(), "存在未赋值节点"
    print(f"  节点重建 OK: rot={r} flip={flip}, 全量最大偏差 {max_dev:.2e}°")
    return lon, lat


# ---------------------------------------------------------------- 主流程
def main(verify=False):
    print("== 读取 shapefile ==")
    rings = read_shp_rings(SHP_PATH)
    n_cells = len(rings)
    print(f"  {n_cells} cells")

    dat_files = sorted(glob.glob(DAT_GLOB))
    assert dat_files, f"未找到 DAT: {DAT_GLOB}"
    print("== DAT 文件 ==\n  " + "\n  ".join(os.path.basename(p) for p in dat_files))

    print("== 解析首 ZONE ==")
    z_iter = iter_zones(dat_files[0])
    _t0, tokens0 = next(z_iter)
    with open(dat_files[0]) as f:
        head = f.read(400)
    m = re.search(r"N=\s*(\d+),\s*E=\s*(\d+)", head)
    n_nodes, n_cells_dat = int(m.group(1)), int(m.group(2))
    assert n_cells_dat == n_cells, f"单元数不一致 {n_cells_dat} vs {n_cells}"
    need = 3 * n_nodes + 3 * n_cells + 4 * n_cells
    assert len(tokens0) == need, f"zone1 token 数 {len(tokens0)} != {need}"
    o = 3 * n_nodes  # 跳过 X,Y — 用 shapefile 坐标
    zb = tokens0[2 * n_nodes:3 * n_nodes].astype(np.float32)
    zone1_vals = tokens0[o:o + 3 * n_cells]
    conn = tokens0[o + 3 * n_cells:].astype(np.int64).reshape(n_cells, 4) - 1
    assert conn.min() >= 0 and conn.max() == n_nodes - 1
    del tokens0, z_iter

    print("== 重建节点坐标 ==")
    lon, lat = rebuild_nodes(rings, conn, n_nodes)

    uniq_counts = np.where(conn[:, 3] == conn[:, 0], 3, 4)
    cell_lon = np.empty(n_cells, np.float32)
    cell_lat = np.empty(n_cells, np.float32)
    zb_cell = np.empty(n_cells, np.float64)
    for i in range(n_cells):
        ids = conn[i, :uniq_counts[i]]
        cell_lon[i] = lon[ids].mean()
        cell_lat[i] = lat[ids].mean()
        zb_cell[i] = zb[ids].mean()

    print("== 逐帧读取 DAT ==")
    frames = []   # (time_tuple, z1_i16, u_i16, v_i16)
    stats_wet = []
    lvl_min, lvl_max, spd_max = 1e9, -1e9, 0.0
    for path in dat_files:
        for ti, (t, tokens) in enumerate(iter_zones(path)):
            if ti == 0:
                assert len(tokens) == need
                vals = tokens[3 * n_nodes:3 * n_nodes + 3 * n_cells]
            else:
                assert len(tokens) == 3 * n_cells, f"zone token {len(tokens)}"
                vals = tokens
            z1 = vals[0:n_cells]
            u = vals[n_cells:2 * n_cells]
            v = vals[2 * n_cells:3 * n_cells]
            depth = z1 - zb_cell
            wet = depth >= DRY_DEPTH
            z1_i = np.where(wet, np.clip(np.round(z1 / LEVEL_SCALE), -32767, 32767), DRY).astype(np.int16)
            u_i = np.where(wet, np.clip(np.round(u / UV_SCALE), -32767, 32767), 0).astype(np.int16)
            v_i = np.where(wet, np.clip(np.round(v / UV_SCALE), -32767, 32767), 0).astype(np.int16)
            frames.append((t, z1_i, u_i, v_i))
            stats_wet.append(int(wet.sum()))
            if wet.any():
                lvl_min = min(lvl_min, float(z1[wet].min()))
                lvl_max = max(lvl_max, float(z1[wet].max()))
                spd_max = max(spd_max, float(np.hypot(u[wet], v[wet]).max()))
        print(f"  {os.path.basename(path)} -> 累计 {len(frames)} 帧")

    import datetime
    times = [datetime.datetime(*f[0]) for f in frames]
    for a, b in zip(times, times[1:]):
        assert (b - a) == datetime.timedelta(hours=1), f"时间不连续 {a} -> {b}"
    times_iso = [t.strftime("%Y-%m-%dT%H:%M:%S+08:00") for t in times]

    print("== 三角化 ==")
    tris = []
    for i in range(n_cells):
        a, b, c, d = conn[i]
        tris.append((a, b, c))
        if uniq_counts[i] == 4:
            tris.append((a, c, d))
    tri = np.array(tris, dtype=np.uint16)
    print(f"  {len(tri)} triangles")

    os.makedirs(OUT_DIR, exist_ok=True)
    print("== 写 mesh.bin ==")
    with open(os.path.join(OUT_DIR, "mesh.bin"), "wb") as f:
        f.write(struct.pack("<4I", MESH_MAGIC, n_nodes, n_cells, len(tri)))
        f.write(lon.astype(np.float32).tobytes())
        f.write(lat.astype(np.float32).tobytes())
        f.write(zb.tobytes())
        f.write(tri.tobytes())
        f.write(conn.astype(np.uint16).tobytes())
        f.write(cell_lon.tobytes())
        f.write(cell_lat.tobytes())

    print("== 写 frames.bin ==")
    with open(os.path.join(OUT_DIR, "frames.bin"), "wb") as f:
        f.write(struct.pack("<3I", FRAME_MAGIC, len(frames), n_cells))
        for _, z1_i, u_i, v_i in frames:
            f.write(z1_i.tobytes()); f.write(u_i.tobytes()); f.write(v_i.tobytes())

    meta = {
        "nNodes": n_nodes, "nCells": n_cells, "nFrames": len(frames),
        "times": times_iso,
        "bbox": [float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())],
        "scales": {"level": LEVEL_SCALE, "uv": UV_SCALE},
        "drySentinel": DRY,
        "stats": {"speedMax": round(spd_max, 3), "levelMin": round(lvl_min, 3),
                  "levelMax": round(lvl_max, 3), "wetCellsPerFrame": stats_wet},
    }
    with open(os.path.join(OUT_DIR, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    for name in ("mesh.bin", "frames.bin", "meta.json"):
        print(f"  {name}: {os.path.getsize(os.path.join(OUT_DIR, name)):,} bytes")
    print(f"湿单元范围: {min(stats_wet)}~{max(stats_wet)} / {n_cells}")
    print(f"水位 {lvl_min:.3f}~{lvl_max:.3f} m, 最大流速 {spd_max:.3f} m/s")

    if verify:
        run_verify(dat_files, n_nodes, n_cells)


def run_verify(dat_files, n_nodes, n_cells, n_samples=10):
    print("== VERIFY: 抽样比对 ==")
    with open(os.path.join(OUT_DIR, "frames.bin"), "rb") as f:
        magic, n_frames, nc = struct.unpack("<3I", f.read(12))
        assert magic == FRAME_MAGIC and nc == n_cells
        data = np.frombuffer(f.read(), dtype=np.int16).reshape(n_frames, 3, n_cells)

    rng = np.random.default_rng(7)
    picks = [(int(rng.integers(n_frames)), int(rng.integers(n_cells))) for _ in range(n_samples)]
    ok = True
    for fi, ci in picks:
        path = dat_files[fi // 24]
        zone_idx = fi % 24
        for ti, (t, tokens) in enumerate(iter_zones(path)):
            if ti != zone_idx:
                continue
            off = 3 * n_nodes if ti == 0 else 0
            z1 = tokens[off + ci]
            u = tokens[off + n_cells + ci]
            v = tokens[off + 2 * n_cells + ci]
            got = data[fi, :, ci]
            if got[0] == DRY:
                print(f"  frame{fi} cell{ci}: DRY (原始 z1={z1:.3f})")
                break
            dz = abs(got[0] * LEVEL_SCALE - z1)
            du = abs(got[1] * UV_SCALE - u)
            dv = abs(got[2] * UV_SCALE - v)
            good = dz <= LEVEL_SCALE and du <= UV_SCALE and dv <= UV_SCALE
            ok &= good
            print(f"  frame{fi} cell{ci}: z1 {z1:.4f}/{got[0]*LEVEL_SCALE:.4f}"
                  f" u {u:.4f}/{got[1]*UV_SCALE:.4f} v {v:.4f}/{got[2]*UV_SCALE:.4f}"
                  f" {'PASS' if good else 'FAIL'}")
            break
    print("VERIFY:", "PASS" if ok else "FAIL")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main(verify="--verify" in sys.argv)

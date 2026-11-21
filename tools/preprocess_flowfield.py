# -*- coding: utf-8 -*-
"""风暴潮流场数据转换、校验和发布工具。

河口院运行本工具，把 Tecplot ASCII DAT 和 WGS84 网格转换为前端可直接
解码的独立 gzip 帧，并通过流场微服务发布。服务端不保存原始 DAT。

示例:
    python tools/preprocess_flowfield.py convert \
        --dat-dir AREA_RST_WUV_2026_07_11_08_00 \
        --grid-shp 风暴潮流场网格/grid-wgs84.shp \
        --output .tmp/flowfield-package \
        --model-version qiantang-v1

    python tools/preprocess_flowfield.py validate \
        --package .tmp/flowfield-package

    set FLOW_PUBLISH_TOKEN=replace-me
    python tools/preprocess_flowfield.py publish \
        --package .tmp/flowfield-package \
        --server http://127.0.0.1:8793/flow-field

    python tools/preprocess_flowfield.py run ...转换参数... --server ...
"""
from __future__ import print_function

import argparse
import concurrent.futures
import datetime
import glob
import gzip
import hashlib
import io
import json
import os
import random
import re
import shutil
import struct
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

import numpy as np


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SHP_PATH = os.path.join(ROOT, "风暴潮流场网格", "grid-wgs84.shp")
DEFAULT_OUTPUT = os.path.join(ROOT, ".tmp", "flowfield-package")
DEFAULT_DAT_GLOB = os.path.join(ROOT, "AREA_RST_WUV_*", "*.DAT")

MESH_MAGIC = 0x46464D31  # '1MFF'
DRY = -32768
DRY_DEPTH = 0.05
LEVEL_SCALE = 0.01
UV_SCALE = 0.001
FORMAT_VERSION = 2
GZIP_LEVEL = 6
UPLOAD_TOKEN_ENV = "FLOW_PUBLISH_TOKEN"
ZONE_RE = re.compile(
    r'ZONE\s+T="(\d{4})-\s*(\d+)-\s*(\d+)\s+(\d+):(\d+):(\d+)"'
)


def read_shp_rings(path):
    """读取 Polygon shapefile，返回去除闭合点的单部件外环。"""
    rings = []
    with open(path, "rb") as stream:
        header = stream.read(100)
        if len(header) != 100 or struct.unpack("<i", header[32:36])[0] != 5:
            raise ValueError("网格文件不是 Polygon shapefile: {}".format(path))
        while True:
            record_header = stream.read(8)
            if len(record_header) == 0:
                break
            if len(record_header) < 8:
                raise ValueError("shapefile 记录头不完整")
            content_len = struct.unpack(">i", record_header[4:8])[0]
            content = stream.read(content_len * 2)
            if len(content) != content_len * 2:
                raise ValueError("shapefile 记录内容不完整")
            shape_type = struct.unpack("<i", content[0:4])[0]
            if shape_type != 5:
                raise ValueError("不支持的 shapeType={}".format(shape_type))
            num_parts, num_points = struct.unpack("<2i", content[36:44])
            if num_parts != 1:
                raise ValueError("暂不支持多部件网格，parts={}".format(num_parts))
            points_offset = 44 + 4 * num_parts
            points = np.frombuffer(
                content,
                dtype="<f8",
                count=num_points * 2,
                offset=points_offset,
            ).reshape(-1, 2)
            if not np.allclose(points[0], points[-1]):
                raise ValueError("shapefile 多边形环未闭合")
            rings.append(points[:-1].copy())
    if not rings:
        raise ValueError("shapefile 中没有网格单元")
    return rings


def parse_block(chunks):
    return np.array(" ".join(chunks).split(), dtype=np.float64)


def iter_zones(path):
    """逐 ZONE 生成 (time_tuple, numeric_tokens)。"""
    with open(path, "r") as stream:
        current_time = None
        chunks = []
        for line in stream:
            first = line.lstrip()[:1]
            if first and (first.isalpha() or first == '"'):
                match = ZONE_RE.search(line)
                if match:
                    if current_time is not None:
                        yield current_time, parse_block(chunks)
                    current_time = tuple(int(group) for group in match.groups())
                    chunks = []
                continue
            if current_time is not None and line.strip():
                chunks.append(line)
        if current_time is not None:
            yield current_time, parse_block(chunks)


def cell_perm(k, n, rotation, flip):
    return (
        (rotation + k) % n
        if not flip
        else (rotation - k) % n
    )


def try_hypothesis(rings, conn, uniq_counts, rotation, flip, sample):
    coordinates = {}
    conflicts = 0
    for index in sample:
        count = uniq_counts[index]
        ring = rings[index]
        for k in range(count):
            node = int(conn[index, k])
            point = ring[cell_perm(k, count, rotation % count, flip)]
            if node in coordinates:
                old = coordinates[node]
                if abs(old[0] - point[0]) > 1e-7 or abs(old[1] - point[1]) > 1e-7:
                    conflicts += 1
            else:
                coordinates[node] = point
    return conflicts


def rebuild_nodes(rings, conn, n_nodes):
    """使用 shp 环点与 DAT 连接表重建节点经纬度。"""
    n_cells = len(rings)
    uniq_counts = np.where(conn[:, 3] == conn[:, 0], 3, 4)
    ring_counts = np.array([len(ring) for ring in rings])
    if not np.array_equal(ring_counts, uniq_counts):
        raise ValueError("shp 环点数与 DAT 单元唯一节点数不一致")

    rng = np.random.default_rng(42)
    sample = rng.choice(n_cells, size=min(1000, n_cells), replace=False)
    best = None
    for flip in (False, True):
        for rotation in range(4):
            conflicts = try_hypothesis(
                rings, conn, uniq_counts, rotation, flip, sample
            )
            print(
                "  假设 rot={} flip={}: 抽样冲突 {}".format(
                    rotation, flip, conflicts
                )
            )
            if conflicts == 0:
                best = (rotation, flip)
                break
        if best:
            break
    if best is None:
        raise ValueError("8 种统一网格节点对应假设均失败")

    rotation, flip = best
    lon = np.full(n_nodes, np.nan)
    lat = np.full(n_nodes, np.nan)
    max_deviation = 0.0
    for cell_index in range(n_cells):
        count = uniq_counts[cell_index]
        ring = rings[cell_index]
        for k in range(count):
            node = int(conn[cell_index, k])
            point = ring[cell_perm(k, count, rotation % count, flip)]
            if np.isnan(lon[node]):
                lon[node], lat[node] = point
            else:
                max_deviation = max(
                    max_deviation,
                    abs(lon[node] - point[0]),
                    abs(lat[node] - point[1]),
                )
    if max_deviation >= 1e-6:
        raise ValueError("节点重建全量偏差过大: {}".format(max_deviation))
    if np.isnan(lon).any() or np.isnan(lat).any():
        raise ValueError("节点重建后仍存在未赋值节点")
    print(
        "  节点重建 OK: rot={} flip={}, max_dev={:.2e}°".format(
            rotation, flip, max_deviation
        )
    )
    return lon, lat


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def gzip_deterministic(data):
    return gzip.compress(data, compresslevel=GZIP_LEVEL, mtime=0)


def write_bytes(path, data):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "wb") as stream:
        stream.write(data)


def write_json_atomic(path, value):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    os.replace(temp_path, path)


def compressed_artifact(file_name, raw_data, compressed_data):
    return {
        "file": file_name.replace("\\", "/"),
        "rawLength": len(raw_data),
        "compressedLength": len(compressed_data),
        "rawSha256": sha256_bytes(raw_data),
        "compressedSha256": sha256_bytes(compressed_data),
    }


def list_dat_files(dat_dir):
    if dat_dir:
        patterns = [
            os.path.join(os.path.abspath(dat_dir), "*.DAT"),
            os.path.join(os.path.abspath(dat_dir), "*.dat"),
        ]
    else:
        patterns = [DEFAULT_DAT_GLOB]
    files = []
    for pattern in patterns:
        files.extend(glob.glob(pattern))
    files = sorted(set(os.path.abspath(path) for path in files))
    if not files:
        raise ValueError("未找到 DAT 文件: {}".format(dat_dir or DEFAULT_DAT_GLOB))
    return files


def read_dat_dimensions(path):
    with open(path, "r") as stream:
        header = stream.read(1024)
    match = re.search(r"N=\s*(\d+),\s*E=\s*(\d+)", header)
    if not match:
        raise ValueError("DAT 头缺少 N/E: {}".format(path))
    return int(match.group(1)), int(match.group(2))


def ensure_finite(name, values, frame_index):
    if not np.isfinite(values).all():
        bad = int(np.size(values) - np.isfinite(values).sum())
        raise ValueError(
            "frame {} {} 存在 {} 个 NaN/Inf".format(frame_index, name, bad)
        )


def quantize_frame(z1, u, v, zb_cell, frame_index):
    ensure_finite("Z1", z1, frame_index)
    ensure_finite("U", u, frame_index)
    ensure_finite("V", v, frame_index)
    depth = z1 - zb_cell
    wet = depth >= DRY_DEPTH
    if wet.any():
        level_quantized = np.round(z1[wet] / LEVEL_SCALE)
        u_quantized = np.round(u[wet] / UV_SCALE)
        v_quantized = np.round(v[wet] / UV_SCALE)
        if (
            np.abs(level_quantized).max() > 32767
            or np.abs(u_quantized).max() > 32767
            or np.abs(v_quantized).max() > 32767
        ):
            raise ValueError("frame {} 数值超出 int16 量化范围".format(frame_index))
    z1_i = np.where(wet, np.round(z1 / LEVEL_SCALE), DRY).astype("<i2")
    u_i = np.where(wet, np.round(u / UV_SCALE), 0).astype("<i2")
    v_i = np.where(wet, np.round(v / UV_SCALE), 0).astype("<i2")
    payload = z1_i.tobytes() + u_i.tobytes() + v_i.tobytes()
    return payload, wet


def convert_package(args):
    dat_files = list_dat_files(args.dat_dir)
    shp_path = os.path.abspath(args.grid_shp)
    output_dir = os.path.abspath(args.output)
    if os.path.exists(output_dir):
        if not args.force:
            raise ValueError(
                "输出目录已存在，请指定 --force 或更换目录: {}".format(output_dir)
            )
        shutil.rmtree(output_dir)
    parent = os.path.dirname(output_dir)
    os.makedirs(parent, exist_ok=True)
    temp_dir = tempfile.mkdtemp(
        prefix=os.path.basename(output_dir) + ".building-", dir=parent
    )

    try:
        print("== 读取网格 ==")
        rings = read_shp_rings(shp_path)
        n_cells = len(rings)
        print("  {} cells".format(n_cells))
        print("== DAT 文件 ==")
        for path in dat_files:
            print("  {}".format(os.path.basename(path)))

        n_nodes, dat_cells = read_dat_dimensions(dat_files[0])
        if dat_cells != n_cells:
            raise ValueError(
                "DAT 单元数 {} 与 shp 单元数 {} 不一致".format(
                    dat_cells, n_cells
                )
            )
        if n_nodes > 65535:
            raise ValueError("节点数超过 uint16 索引上限: {}".format(n_nodes))

        first_iterator = iter_zones(dat_files[0])
        first_time, first_tokens = next(first_iterator)
        del first_time, first_iterator
        expected_first = 3 * n_nodes + 3 * n_cells + 4 * n_cells
        if len(first_tokens) != expected_first:
            raise ValueError(
                "首 ZONE token 数 {} != {}".format(
                    len(first_tokens), expected_first
                )
            )
        zb = first_tokens[2 * n_nodes:3 * n_nodes].astype("<f4")
        data_offset = 3 * n_nodes
        conn = (
            first_tokens[
                data_offset + 3 * n_cells:
                data_offset + 3 * n_cells + 4 * n_cells
            ]
            .astype(np.int64)
            .reshape(n_cells, 4)
            - 1
        )
        if conn.min() < 0 or conn.max() != n_nodes - 1:
            raise ValueError("DAT 连接表节点索引范围异常")

        print("== 重建节点坐标 ==")
        lon, lat = rebuild_nodes(rings, conn, n_nodes)
        uniq_counts = np.where(conn[:, 3] == conn[:, 0], 3, 4)
        cell_lon = np.empty(n_cells, dtype="<f4")
        cell_lat = np.empty(n_cells, dtype="<f4")
        zb_cell = np.empty(n_cells, dtype=np.float64)
        for index in range(n_cells):
            node_ids = conn[index, :uniq_counts[index]]
            cell_lon[index] = lon[node_ids].mean()
            cell_lat[index] = lat[node_ids].mean()
            zb_cell[index] = zb[node_ids].mean()

        triangles = []
        for index in range(n_cells):
            a, b, c, d = conn[index]
            triangles.append((a, b, c))
            if uniq_counts[index] == 4:
                triangles.append((a, c, d))
        tri = np.asarray(triangles, dtype="<u2")

        mesh_stream = io.BytesIO()
        mesh_stream.write(
            struct.pack("<4I", MESH_MAGIC, n_nodes, n_cells, len(triangles))
        )
        mesh_stream.write(lon.astype("<f4").tobytes())
        mesh_stream.write(lat.astype("<f4").tobytes())
        mesh_stream.write(zb.astype("<f4").tobytes())
        mesh_stream.write(tri.tobytes())
        mesh_stream.write(conn.astype("<u2").tobytes())
        mesh_stream.write(cell_lon.tobytes())
        mesh_stream.write(cell_lat.tobytes())
        mesh_raw = mesh_stream.getvalue()
        mesh_gzip = gzip_deterministic(mesh_raw)
        mesh_rel = "mesh.bin.gz"
        write_bytes(os.path.join(temp_dir, mesh_rel), mesh_gzip)
        mesh_meta = compressed_artifact(mesh_rel, mesh_raw, mesh_gzip)
        mesh_meta.update(
            {
                "meshId": mesh_meta["rawSha256"],
                "magic": "FFM1",
            }
        )

        if not np.isfinite(args.time_step_minutes) or args.time_step_minutes <= 0:
            raise ValueError("--time-step-minutes 必须为正数")
        print("== 转换时序帧（期望间隔 {} 分钟） ==".format(args.time_step_minutes))
        frame_records = []
        times = []
        wet_counts = []
        level_min = float("inf")
        level_max = float("-inf")
        speed_max = 0.0
        for source_path in dat_files:
            for zone_index, (time_tuple, tokens) in enumerate(
                iter_zones(source_path)
            ):
                frame_index = len(frame_records)
                if zone_index == 0:
                    if len(tokens) != expected_first:
                        raise ValueError(
                            "{} 首 ZONE token 数异常".format(source_path)
                        )
                    # 每个文件都带网格；不能只凭节点数量相同就按首文件网格解释。
                    current_conn = tokens[3 * n_nodes + 3 * n_cells:].astype(np.int64).reshape(n_cells, 4) - 1
                    if not np.array_equal(current_conn, conn) or not np.array_equal(
                        tokens[:3 * n_nodes], first_tokens[:3 * n_nodes]
                    ):
                        raise ValueError("{} 的节点坐标/底高程/连接表与首文件不一致".format(source_path))
                    values = tokens[
                        3 * n_nodes:3 * n_nodes + 3 * n_cells
                    ]
                else:
                    if len(tokens) != 3 * n_cells:
                        raise ValueError(
                            "{} zone {} token 数 {} != {}".format(
                                source_path,
                                zone_index,
                                len(tokens),
                                3 * n_cells,
                            )
                        )
                    values = tokens
                z1 = values[0:n_cells]
                u = values[n_cells:2 * n_cells]
                v = values[2 * n_cells:3 * n_cells]
                payload, wet = quantize_frame(
                    z1, u, v, zb_cell, frame_index
                )
                compressed = gzip_deterministic(payload)
                frame_rel = "frames/{:05d}.bin.gz".format(frame_index)
                write_bytes(os.path.join(temp_dir, frame_rel), compressed)
                timestamp = datetime.datetime(
                    *time_tuple,
                    tzinfo=datetime.timezone(datetime.timedelta(hours=8))
                )
                record = compressed_artifact(
                    frame_rel, payload, compressed
                )
                record.update(
                    {
                        "index": frame_index,
                        "validTime": timestamp.isoformat(),
                        "sourceFile": os.path.basename(source_path),
                        "sourceZone": zone_index,
                    }
                )
                frame_records.append(record)
                times.append(timestamp)
                wet_count = int(wet.sum())
                wet_counts.append(wet_count)
                if wet_count:
                    level_min = min(level_min, float(z1[wet].min()))
                    level_max = max(level_max, float(z1[wet].max()))
                    speed_max = max(
                        speed_max, float(np.hypot(u[wet], v[wet]).max())
                    )
            print(
                "  {} -> 累计 {} 帧".format(
                    os.path.basename(source_path), len(frame_records)
                )
            )

        if not frame_records:
            raise ValueError("DAT 中未解析到任何 ZONE")
        for left, right in zip(times, times[1:]):
            if right <= left:
                raise ValueError(
                    "时次未递增: {} -> {}".format(left, right)
                )
            if not args.allow_irregular_time and (
                right - left != datetime.timedelta(minutes=args.time_step_minutes)
            ):
                raise ValueError(
                    "时次不是按 {} 分钟连续: {} -> {}".format(args.time_step_minutes, left, right)
                )

        source_run_id = args.source_run_id or times[0].strftime(
            "%Y%m%dT%H%M%S%z"
        )
        scenario_name = args.scenario_name or "风暴潮 {}".format(
            times[0].strftime("%Y-%m-%d %H:%M")
        )
        generated_at = datetime.datetime.now(
            datetime.timezone(datetime.timedelta(hours=8))
        ).isoformat()
        manifest = {
            "formatVersion": FORMAT_VERSION,
            "sourceRunId": source_run_id,
            "scenarioName": scenario_name,
            "modelVersion": args.model_version,
            "generatedAt": generated_at,
            "startTime": times[0].isoformat(),
            "endTime": times[-1].isoformat(),
            "nNodes": n_nodes,
            "nCells": n_cells,
            "nTris": len(triangles),
            "nFrames": len(frame_records),
            "timeStepSeconds": int((times[1] - times[0]).total_seconds())
                if len(times) > 1 and len(set((b - a).total_seconds() for a, b in zip(times, times[1:]))) == 1 else None,
            "bbox": [
                float(lon.min()),
                float(lat.min()),
                float(lon.max()),
                float(lat.max()),
            ],
            "scales": {"level": LEVEL_SCALE, "uv": UV_SCALE},
            "drySentinel": DRY,
            "mesh": mesh_meta,
            "frames": frame_records,
            "stats": {
                "speedMax": round(speed_max, 3),
                "levelMin": round(level_min, 3),
                "levelMax": round(level_max, 3),
                "wetCellsPerFrame": wet_counts,
            },
        }
        write_json_atomic(os.path.join(temp_dir, "package.json"), manifest)
        validate_package(temp_dir)
        if args.verify_source:
            verify_source_samples(
                temp_dir, dat_files, n_nodes, n_cells, args.verify_samples
            )
        os.replace(temp_dir, output_dir)
        temp_dir = None
        total_compressed = sum(
            frame["compressedLength"] for frame in frame_records
        )
        print("== 转换完成 ==")
        print("  package: {}".format(output_dir))
        print("  mesh: {:.2f} MiB".format(len(mesh_gzip) / 1048576.0))
        print(
            "  frames: {} / {:.2f} MiB".format(
                len(frame_records), total_compressed / 1048576.0
            )
        )
        return output_dir
    finally:
        if temp_dir and os.path.isdir(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


def load_manifest(package_dir):
    path = os.path.join(os.path.abspath(package_dir), "package.json")
    with open(path, "r", encoding="utf-8") as stream:
        manifest = json.load(stream)
    if manifest.get("formatVersion") != FORMAT_VERSION:
        raise ValueError(
            "不支持的 package formatVersion={}".format(
                manifest.get("formatVersion")
            )
        )
    return manifest


def validate_artifact(package_dir, artifact):
    path = os.path.join(package_dir, artifact["file"])
    if not os.path.isfile(path):
        raise ValueError("缺少文件: {}".format(path))
    compressed_length = os.path.getsize(path)
    if compressed_length != artifact["compressedLength"]:
        raise ValueError(
            "{} 压缩长度不符 {} != {}".format(
                artifact["file"],
                compressed_length,
                artifact["compressedLength"],
            )
        )
    compressed_sha = sha256_file(path)
    if compressed_sha != artifact["compressedSha256"]:
        raise ValueError("{} 压缩 SHA-256 不符".format(artifact["file"]))
    raw_digest = hashlib.sha256()
    raw_length = 0
    with gzip.open(path, "rb") as stream:
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                break
            raw_digest.update(block)
            raw_length += len(block)
    if raw_length != artifact["rawLength"]:
        raise ValueError(
            "{} 解压长度不符 {} != {}".format(
                artifact["file"], raw_length, artifact["rawLength"]
            )
        )
    if raw_digest.hexdigest() != artifact["rawSha256"]:
        raise ValueError("{} 原始 SHA-256 不符".format(artifact["file"]))


def validate_package(package_dir):
    package_dir = os.path.abspath(package_dir)
    manifest = load_manifest(package_dir)
    if manifest["nFrames"] != len(manifest["frames"]):
        raise ValueError("nFrames 与 frames 数组长度不一致")
    expected_frame_length = manifest["nCells"] * 3 * 2
    for expected_index, frame in enumerate(manifest["frames"]):
        if frame["index"] != expected_index:
            raise ValueError("帧索引必须从 0 连续递增")
        if frame["rawLength"] != expected_frame_length:
            raise ValueError(
                "frame {} 原始长度 {} != {}".format(
                    expected_index,
                    frame["rawLength"],
                    expected_frame_length,
                )
            )
        validate_artifact(package_dir, frame)
    validate_artifact(package_dir, manifest["mesh"])
    with gzip.open(
        os.path.join(package_dir, manifest["mesh"]["file"]), "rb"
    ) as stream:
        header = stream.read(16)
    if len(header) != 16:
        raise ValueError("mesh.bin 头不完整")
    magic, n_nodes, n_cells, n_tris = struct.unpack("<4I", header)
    if magic != MESH_MAGIC:
        raise ValueError("mesh.bin 魔数错误")
    if (
        n_nodes != manifest["nNodes"]
        or n_cells != manifest["nCells"]
        or n_tris != manifest["nTris"]
    ):
        raise ValueError("mesh.bin 计数与 package.json 不一致")
    print(
        "VALIDATE PASS: {} frames, {:.2f} MiB".format(
            manifest["nFrames"],
            sum(
                frame["compressedLength"] for frame in manifest["frames"]
            )
            / 1048576.0,
        )
    )
    return manifest


def verify_source_samples(
    package_dir, dat_files, n_nodes, n_cells, sample_count
):
    print("== 抽样对比原始 DAT ==")
    manifest = load_manifest(package_dir)
    file_by_name = {
        os.path.basename(path): path for path in dat_files
    }
    rng = random.Random(7)
    picks = [
        (
            rng.randrange(manifest["nFrames"]),
            rng.randrange(n_cells),
        )
        for _ in range(sample_count)
    ]
    for frame_index, cell_index in picks:
        record = manifest["frames"][frame_index]
        source_path = file_by_name.get(record["sourceFile"])
        if not source_path:
            raise ValueError(
                "找不到抽样源文件: {}".format(record["sourceFile"])
            )
        target_tokens = None
        for zone_index, (_, tokens) in enumerate(iter_zones(source_path)):
            if zone_index == record["sourceZone"]:
                target_tokens = tokens
                break
        if target_tokens is None:
            raise ValueError(
                "{} 缺少 zone {}".format(
                    record["sourceFile"], record["sourceZone"]
                )
            )
        offset = 3 * n_nodes if record["sourceZone"] == 0 else 0
        z1 = target_tokens[offset + cell_index]
        u = target_tokens[offset + n_cells + cell_index]
        v = target_tokens[offset + 2 * n_cells + cell_index]
        frame_path = os.path.join(package_dir, record["file"])
        with gzip.open(frame_path, "rb") as stream:
            payload = stream.read()
        values = np.frombuffer(payload, dtype="<i2")
        got_z = int(values[cell_index])
        if got_z == DRY:
            print(
                "  frame{} cell{}: DRY".format(frame_index, cell_index)
            )
            continue
        got_u = int(values[n_cells + cell_index])
        got_v = int(values[2 * n_cells + cell_index])
        if (
            abs(got_z * LEVEL_SCALE - z1) > LEVEL_SCALE
            or abs(got_u * UV_SCALE - u) > UV_SCALE
            or abs(got_v * UV_SCALE - v) > UV_SCALE
        ):
            raise ValueError(
                "抽样不一致 frame{} cell{}".format(
                    frame_index, cell_index
                )
            )
        print(
            "  frame{} cell{}: z1={:.3f} u={:.3f} v={:.3f} PASS".format(
                frame_index, cell_index, z1, u, v
            )
        )
    print("SOURCE VERIFY PASS")


class Publisher(object):
    def __init__(self, server, token, retries, workers, timeout):
        self.server = server.rstrip("/")
        self.internal_base = self.server + "/internal/v1"
        self.token = token
        self.retries = retries
        self.workers = workers
        self.timeout = timeout
        self.state_lock = threading.Lock()

    def _request(self, method, url, body=None, headers=None):
        request_headers = {
            "Accept": "application/json",
            "Authorization": "Bearer {}".format(self.token),
        }
        if headers:
            request_headers.update(headers)
        request = urllib.request.Request(
            url=url,
            data=body,
            headers=request_headers,
            method=method,
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            payload = response.read()
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type or payload.startswith(b"{"):
                data = json.loads(payload.decode("utf-8"))
                if data.get("code") not in (0, "0", None):
                    raise RuntimeError(
                        data.get("message") or "服务端返回失败"
                    )
                return data.get("data", data)
            return payload

    def _retry(self, description, operation):
        last_error = None
        for attempt in range(self.retries + 1):
            try:
                return operation()
            except (
                urllib.error.URLError,
                urllib.error.HTTPError,
                OSError,
                RuntimeError,
            ) as error:
                last_error = error
                if attempt >= self.retries:
                    break
                delay = min(8, 2 ** attempt)
                print(
                    "  {} 失败({}), {}s 后重试 {}/{}".format(
                        description,
                        error,
                        delay,
                        attempt + 1,
                        self.retries,
                    )
                )
                time.sleep(delay)
        raise RuntimeError("{} 失败: {}".format(description, last_error))

    def create_upload(self, manifest):
        body = json.dumps(
            manifest, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        return self._retry(
            "创建上传会话",
            lambda: self._request(
                "POST",
                self.internal_base + "/uploads",
                body,
                {"Content-Type": "application/json; charset=utf-8"},
            ),
        )

    def get_status(self, upload_id):
        return self._retry(
            "查询上传状态",
            lambda: self._request(
                "GET",
                self.internal_base + "/uploads/" + upload_id,
            ),
        )

    def upload_artifact(self, upload_id, artifact, package_dir, url):
        path = os.path.join(package_dir, artifact["file"])
        with open(path, "rb") as stream:
            body = stream.read()
        headers = {
            "Content-Type": "application/gzip",
            "Content-Length": str(len(body)),
            "X-Raw-Length": str(artifact["rawLength"]),
            "X-Raw-SHA256": artifact["rawSha256"],
            "X-Compressed-SHA256": artifact["compressedSha256"],
        }
        self._retry(
            "上传 {}".format(artifact["file"]),
            lambda: self._request("PUT", url, body, headers),
        )

    def complete(self, upload_id):
        return self._retry(
            "提交发布",
            lambda: self._request(
                "POST",
                self.internal_base
                + "/uploads/"
                + upload_id
                + "/complete",
                b"{}",
                {"Content-Type": "application/json"},
            ),
        )


def publish_package(args):
    package_dir = os.path.abspath(args.package)
    manifest = validate_package(package_dir)
    token = os.environ.get(UPLOAD_TOKEN_ENV, "").strip()
    if not token:
        raise ValueError(
            "环境变量 {} 未设置".format(UPLOAD_TOKEN_ENV)
        )
    publisher = Publisher(
        args.server, token, args.retries, args.workers, args.timeout
    )
    created = publisher.create_upload(manifest)
    if created.get("ready"):
        print(
            "场次已发布: {}".format(
                created.get("scenarioId", manifest["sourceRunId"])
            )
        )
        return created
    upload_id = created["uploadId"]
    status = publisher.get_status(upload_id)
    missing_frames = set(
        status.get(
            "missingFrames",
            created.get(
                "missingFrames",
                list(range(manifest["nFrames"])),
            ),
        )
    )
    if status.get("meshRequired", created.get("meshRequired", True)):
        print("== 上传网格 ==")
        publisher.upload_artifact(
            upload_id,
            manifest["mesh"],
            package_dir,
            publisher.internal_base
            + "/uploads/"
            + upload_id
            + "/mesh",
        )

    print("== 上传帧: 缺失 {} / {} ==".format(
        len(missing_frames), manifest["nFrames"]
    ))
    frame_by_index = {
        frame["index"]: frame for frame in manifest["frames"]
    }
    completed = set(
        frame["index"] for frame in manifest["frames"]
        if frame["index"] not in missing_frames
    )
    state_path = os.path.join(package_dir, ".publish-state.json")

    def upload_one(frame_index):
        frame = frame_by_index[frame_index]
        publisher.upload_artifact(
            upload_id,
            frame,
            package_dir,
            publisher.internal_base
            + "/uploads/"
            + upload_id
            + "/frames/"
            + str(frame_index),
        )
        with publisher.state_lock:
            completed.add(frame_index)
            write_json_atomic(
                state_path,
                {
                    "server": args.server,
                    "uploadId": upload_id,
                    "scenarioId": created.get("scenarioId"),
                    "completedFrames": sorted(completed),
                    "updatedAt": datetime.datetime.now(
                        datetime.timezone.utc
                    ).isoformat(),
                },
            )
            print(
                "  frame {:05d} OK ({}/{})".format(
                    frame_index, len(completed), manifest["nFrames"]
                )
            )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=args.workers
    ) as executor:
        futures = [
            executor.submit(upload_one, frame_index)
            for frame_index in sorted(missing_frames)
        ]
        for future in concurrent.futures.as_completed(futures):
            future.result()

    result = publisher.complete(upload_id)
    if os.path.exists(state_path):
        os.remove(state_path)
    print(
        "PUBLISH PASS: scenarioId={}".format(
            result.get("scenarioId", created.get("scenarioId"))
        )
    )
    return result


def add_convert_arguments(parser):
    parser.add_argument(
        "--dat-dir",
        help="包含 DAT 文件的目录；省略时匹配 AREA_RST_WUV_*/*.DAT",
    )
    parser.add_argument(
        "--grid-shp",
        default=DEFAULT_SHP_PATH,
        help="WGS84 Polygon 网格 shp",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help="转换包输出目录",
    )
    parser.add_argument(
        "--source-run-id",
        help="河口院模型运行唯一标识；默认使用首时次",
    )
    parser.add_argument(
        "--scenario-name",
        help="前端显示的场次名称",
    )
    parser.add_argument(
        "--model-version",
        default="unknown",
        help="模型版本",
    )
    parser.add_argument(
        "--time-step-minutes",
        type=float,
        default=60,
        help="期望连续输出间隔（分钟），默认 60；5 分钟数据填写 5",
    )
    parser.add_argument(
        "--allow-irregular-time",
        action="store_true",
        help="允许非等间隔时次，但仍要求严格递增",
    )
    parser.add_argument(
        "--verify-source",
        action="store_true",
        help="转换后随机回读原始 DAT 对比",
    )
    parser.add_argument(
        "--verify-samples",
        type=int,
        default=10,
        help="源数据抽样数量",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="覆盖已有输出目录",
    )


def add_publish_arguments(parser, include_package=True):
    if include_package:
        parser.add_argument("--package", help="转换包目录")
    parser.add_argument(
        "--server",
        required=True,
        help="例如 http://127.0.0.1:8793/flow-field",
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--retries", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=60)


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    convert_parser = subparsers.add_parser(
        "convert", help="DAT -> 独立 gzip 网格和帧"
    )
    add_convert_arguments(convert_parser)

    validate_parser = subparsers.add_parser(
        "validate", help="校验转换包"
    )
    validate_parser.add_argument(
        "--package", default=DEFAULT_OUTPUT
    )

    publish_parser = subparsers.add_parser(
        "publish", help="断点续传并发布"
    )
    add_publish_arguments(publish_parser)

    run_parser = subparsers.add_parser(
        "run", help="转换、校验并发布"
    )
    add_convert_arguments(run_parser)
    add_publish_arguments(run_parser, include_package=False)
    return parser


def main():
    args = build_parser().parse_args()
    if args.command == "convert":
        convert_package(args)
    elif args.command == "validate":
        validate_package(args.package)
    elif args.command == "publish":
        if not args.package:
            args.package = DEFAULT_OUTPUT
        publish_package(args)
    elif args.command == "run":
        package_dir = convert_package(args)
        args.package = package_dir
        publish_package(args)
    else:
        raise ValueError("未知命令: {}".format(args.command))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("操作已取消", file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)

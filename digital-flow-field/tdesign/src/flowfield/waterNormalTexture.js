/**
 * 程序生成可平铺水面纹理:RGB=切线空间法线,A=fbm 噪声(泡沫用)。
 */
export function generateWaterNormalCanvas(size = 256) {
    const h = new Float32Array(size * size)
    // 多方向正弦叠加(波数取整数保证平铺)
    const waves = [
        [3, 1, 1.0, 0.0], [1, 4, 0.8, 1.7], [5, 2, 0.55, 3.1], [2, 6, 0.45, 0.9],
        [7, 3, 0.32, 2.2], [4, 7, 0.28, 4.0], [9, 5, 0.2, 1.2], [6, 9, 0.16, 5.1]
    ]
    const TWO_PI = Math.PI * 2
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let v = 0
            for (const [kx, ky, amp, ph] of waves) v += amp * Math.sin(TWO_PI * ((kx * x + ky * y) / size) + ph)
            h[y * size + x] = v
        }
    }
    // 值噪声 fbm(平铺:栅格取模)
    const rndGrid = 32
    const rnd = new Float32Array(rndGrid * rndGrid)
    let seed = 12345
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < rnd.length; i++) rnd[i] = rand()
    const vnoise = (fx, fy) => {
        const x0 = Math.floor(fx) % rndGrid, y0 = Math.floor(fy) % rndGrid
        const x1 = (x0 + 1) % rndGrid, y1 = (y0 + 1) % rndGrid
        const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy)
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
        const a = rnd[y0 * rndGrid + x0], b = rnd[y0 * rndGrid + x1]
        const c = rnd[y1 * rndGrid + x0], d = rnd[y1 * rndGrid + x1]
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(size, size)
    const scale = 2.2
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const xm = (x - 1 + size) % size, xp = (x + 1) % size
            const ym = (y - 1 + size) % size, yp = (y + 1) % size
            const dx = (h[y * size + xp] - h[y * size + xm]) * scale
            const dy = (h[yp * size + x] - h[ym * size + x]) * scale
            const inv = 1 / Math.hypot(dx, dy, 1)
            const o = (y * size + x) * 4
            img.data[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
            img.data[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
            img.data[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
            let n = 0, amp = 0.5, f = 4 / size
            for (let oct = 0; oct < 4; oct++) {
                n += amp * vnoise(x * f * rndGrid / 4, y * f * rndGrid / 4)
                amp *= 0.5
                f *= 2
            }
            img.data[o + 3] = Math.round(Math.min(1, n) * 255)
        }
    }
    ctx.putImageData(img, 0, 0)
    return canvas
}

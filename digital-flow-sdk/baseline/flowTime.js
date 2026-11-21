/** 时间来自模型输出；framePosition 是可插值帧序号，不代表小时。 */
export function timeAtFrame(times, framePosition = 0) {
    if (!times?.length) return NaN
    const position = Math.max(0, Math.min(times.length - 1, Number(framePosition) || 0))
    const first = Math.floor(position)
    const a = Date.parse(times[first])
    const b = Date.parse(times[Math.min(first + 1, times.length - 1)])
    return a + (b - a) * (position - first)
}

export function formatFlowTime(value, { compact = false, seconds = false } = {}) {
    const timestamp = typeof value === 'number' ? value : Date.parse(value)
    if (!Number.isFinite(timestamp)) return '--'
    // 模型交付使用北京时间，避免浏览器所在时区改变模型时刻。
    const date = new Date(timestamp + 8 * 3600000)
    const pad = number => String(number).padStart(2, '0')
    const day = `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}${seconds ? `:${pad(date.getUTCSeconds())}` : ''}`
    return `${compact ? '' : `${date.getUTCFullYear()}-`}${day} ${time}`
}

export function frameIntervalLabel(times) {
    if (!times || times.length < 2) return '单时次'
    const intervals = times.slice(1).map((time, index) => Date.parse(time) - Date.parse(times[index]))
    const step = intervals[0]
    if (!(step > 0) || intervals.some(value => value !== step)) return '非等间隔'
    const minutes = step / 60000
    return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} 小时` : `${Number(minutes.toFixed(2))} 分钟`
}

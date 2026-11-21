import { tidalGeometry } from './tidalEvolution.js'

/**
 * Profile 声明了已验证帧间隔时，场次相邻帧间隔必须全部命中（容差 1e-6 秒），
 * 否则本场次停用潮头但不影响普通流场播放。
 */
function verifyTidalIntervals(data) {
    const allowed = data.options.profile?.validatedIntervalsSeconds
    if (!Array.isArray(allowed) || !allowed.length) return true
    const times = data.meta.times
    const intervals = new Set()
    for (let index = 1; index < times.length; index++) {
        intervals.add((Date.parse(times[index]) - Date.parse(times[index - 1])) / 1000)
    }
    const actual = [...intervals]
    const unverified = actual.some(interval => !Number.isFinite(interval)
        || !allowed.some(value => Math.abs(interval - value) <= 1e-6))
    if (!unverified) return true
    data.tidalAvailable = false
    data.tidalDisabledReason = 'interval-unverified'
    data.options.onWarning?.({
        code: 'TIDAL_INTERVAL_UNVERIFIED',
        message: '场次帧间隔不在潮头 Profile 已验证的间隔列表中，本场次已停用潮头计算',
        detail: { intervalsSeconds: actual.sort((a, b) => a - b), allowedIntervalsSeconds: [...allowed] }
    })
    return false
}

/**
 * 加载完成后判定本场次潮头是否可用：先校验帧间隔，再按历史内存预算估算，
 * 任一不满足即置 tidalAvailable=false 并记录 tidalDisabledReason。
 */
export function evaluateTidalBudget(data) {
    if (!data.tidalEnabled) return
    if (!verifyTidalIntervals(data)) return
    const mb = Number.isFinite(data.options.tidalHistoryBudgetMB) ? data.options.tidalHistoryBudgetMB : 256
    const budget = mb * 1024 * 1024
    try {
        const cells = tidalGeometry(data).activeCells.length
        const estimated = data.nFrames * cells * 4
        if (estimated > budget) {
            data.tidalAvailable = false
            data.tidalDisabledReason = 'memory-budget'
            data.options.onWarning?.({
                code: 'TIDAL_DISABLED_BUDGET',
                message: '潮头历史预计占用内存超出预算，本场次已停用潮头计算',
                detail: { estimatedBytes: estimated, budgetBytes: budget }
            })
            return
        }
        data.tidalAvailable = true
    } catch {
        data.tidalAvailable = false
        data.tidalDisabledReason = 'unavailable'
    }
}

export function getTidalAvailability(data) {
    if (!data.tidalEnabled) return { available: false }
    return data.tidalAvailable ? { available: true } : { available: false, reason: data.tidalDisabledReason ?? 'unavailable' }
}

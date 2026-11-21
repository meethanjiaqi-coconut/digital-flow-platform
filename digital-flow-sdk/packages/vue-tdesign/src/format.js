const DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

export function formatFlowTime(value, { timeZone = 'Asia/Shanghai', compact = false, seconds = false } = {}) {
  const ts = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(ts)) return '--'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: seconds ? '2-digit' : undefined,
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(new Date(ts))
    const get = type => parts.find(p => p.type === type)?.value ?? ''
    const hour = get('hour') === '24' ? '00' : get('hour')
    const md = `${get('month')}-${get('day')}`
    const hm = `${hour}:${get('minute')}${seconds ? `:${get('second')}` : ''}`
    return compact ? `${md} ${hm}` : `${get('year')}-${md} ${hm}`
  } catch {
    return new Date(ts).toISOString()
  }
}

export function formatIntervalLabel(frameIntervalSeconds, frameCount = 0) {
  if (!frameCount || frameCount < 2) return '单时次'
  if (!Number.isFinite(frameIntervalSeconds) || frameIntervalSeconds <= 0) return '非等间隔'
  if (frameIntervalSeconds < 60) return `${Number(frameIntervalSeconds.toFixed(1))} 秒`
  const minutes = frameIntervalSeconds / 60
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} 小时`
    : `${Number(minutes.toFixed(2))} 分钟`
}

export function formatCellCount(cellCount) {
  const count = Number(cellCount)
  if (!Number.isFinite(count) || count <= 0) return '--'
  return count >= 10000 ? `${(count / 10000).toFixed(1)} 万` : String(count)
}

export function formatProgressPhase(phase) {
  return ({
    manifest: '读取场次清单',
    mesh: '加载计算网格',
    frames: '加载流场数据',
    renderer: '初始化三维渲染',
    history: '构建潮头历史'
  })[phase] || '连接流场服务'
}

export function formatDisplayError(error) {
  const msg = typeof error === 'string' ? error : error?.message
  if (!msg) return '请检查流场服务配置后重试'
  if (/failed to fetch|network|load failed/i.test(msg)) return '流场服务连接失败，请检查服务地址或网络状态'
  return msg
}

export function compassDirection(dirDeg) {
  if (!Number.isFinite(dirDeg)) return '静流'
  const normalized = ((dirDeg % 360) + 360) % 360
  return DIRECTIONS[Math.round(normalized / 45) % 8]
}

export function frameTargetTime(state, targetFrame) {
  const maxFrame = Math.max(0, (state?.frameCount || 1) - 1)
  const clamped = Math.max(0, Math.min(maxFrame, Number(targetFrame) || 0))
  const exact = state?.frameTimes?.[Math.round(clamped)]
  if (Number.isInteger(clamped) && exact) {
    const ms = Date.parse(exact)
    if (Number.isFinite(ms)) return new Date(ms)
  }
  const startMs = Date.parse(state?.startTime)
  const endMs = Date.parse(state?.endTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  if (maxFrame === 0) return new Date(startMs)
  if (Number.isFinite(state?.frameIntervalSeconds) && state.frameIntervalSeconds > 0) {
    return new Date(Math.min(endMs, startMs + clamped * state.frameIntervalSeconds * 1000))
  }
  return new Date(startMs + (endMs - startMs) * (clamped / maxFrame))
}

export function formatTidalFrontStatus(state) {
  const status = state?.tidal?.status
  const available = state?.capabilities?.tidal?.available
  const reason = state?.capabilities?.tidal?.reason || state?.tidal?.reason
  if (!available) {
    if (reason === 'interval-unverified') return '当前时间步长未校核潮头参数，已仅保留基础流场'
    if (reason === 'budget') return '潮头历史超出内存预算，本场次已停用'
    return '未启用河口潮头扩展'
  }
  if (status === 'uncertain') return '潮头短时待确认'
  if (status === 'tracked') return '河口潮头 · 连续跟踪潮头'
  return '当前未确认可靠潮头'
}

export function formatTidalMixStatus(state) {
  const status = state?.tidal?.status
  return ({
    tracked: '清浊示意 · 连续跟踪潮头',
    uncertain: '潮头短时待确认 · 保留弱提示',
    reacquiring: '潮头候选待确认 · 保留浑水变化',
    residual: '未确认潮头 · 潮后浑水扩散消退',
    unavailable: '未确认潮头，显示原水色'
  })[status] || '未确认潮头，显示原水色'
}

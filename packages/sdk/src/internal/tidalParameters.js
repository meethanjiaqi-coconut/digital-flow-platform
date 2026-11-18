/**
 * 潮头判识/几何/演化算法参数集中表。
 *
 * 默认值与原数字流场工程逐字一致；河口 Profile 可通过 parameters 覆盖
 * 其中任意键（只允许本表已有键、值必须是有限数），其余键保持默认。
 * 纯数学常数、数组下标、EMPTY 哨兵与米/度换算常数不属于可调参数，
 * 仍保留在算法文件中。
 */
export const TIDAL_SEAWARD_DIRECTIONS = Object.freeze(['east', 'west', 'north', 'south'])

export const DEFAULT_TIDAL_PARAMETERS = Object.freeze({
    // —— 单帧判识 detectTidalFront（原 tidal-front-analysis.js 顶部常量）——
    minLevelRiseMeters: 0.015,             // 判识最小水位涨幅（米）
    minUpstreamSpeed: 0.035,               // 上溯流速判据下限（m/s）
    strongUpstreamSpeed: 0.15,             // 上溯流速判据上限（m/s）
    minTidalFlowStrength: 0.12,            // 连通上溯潮流团的最小单元强度
    minTidalComponentCells: 24,            // 上溯潮流团最少单元数
    minTidalComponentScore: 18,            // 上溯潮流团最小累积评分
    minTidalComponentSpanMeters: 5000,     // 上溯潮流团最小里程跨度（米）
    minFrontBoundaryStrength: 0.08,        // 锋面边界最小强度
    frontBandMeters: 2200,                 // 锋面保留的最上游带宽（米）

    // —— 河道几何 buildRiverMetrics / tidalGeometry ——
    seawardSeedFraction: 0.08,             // 入海种子带占 AOI 跨度的比例
    seawardSeedMinDegrees: 0.05,           // 入海种子带最小宽度（度）
    upstreamGradientEpsilon: 0.00001,      // 上游方向梯度归一化下限
    polygonMaskRampMeters: 6000,           // AOI 多边形内里程权重 ramp（米）

    // —— 候选断面 tidalCandidates ——
    referenceIntervalSeconds: 300,         // 水位涨幅归一化参考帧间隔（秒）
    candidateSpeedRampLow: 0.035,          // 候选上溯流速 ramp 下限（m/s）
    candidateSpeedRampHigh: 0.18,          // 候选上溯流速 ramp 上限（m/s）
    candidateSpeedEvidence: 0.55,          // 流速证据权重基值
    candidateRiseEvidence: 0.45,           // 水位涨幅证据权重
    candidateRiseRampLow: -0.03,           // 涨幅 ramp 下限（米）
    candidateRiseRampHigh: 0.04,           // 涨幅 ramp 上限（米）
    minComponentStrength: 0.12,            // 候选连通分量最小强度
    minComponentCells: 18,                 // 候选连通分量最少单元数
    minComponentSpanMeters: 4000,          // 候选连通分量最小里程跨度（米）
    opposingFlowRampLow: -0.06,            // 邻格流速反向 ramp 下限（m/s）
    opposingFlowRampHigh: 0.08,            // 邻格流速反向 ramp 上限（m/s）
    flowJumpRampLow: 0.04,                 // 流速跳变 ramp 下限（m/s）
    flowJumpRampHigh: 0.4,                 // 流速跳变 ramp 上限（m/s）
    minBoundaryStrength: 0.015,            // 候选断面边界最小强度
    candidateBinMeters: 1000,              // 候选断面里程分箱宽度（米）
    minCandidateDepthMeters: 0.1,          // 候选水深下限（米）
    minCandidateWeight: 0.04,              // 候选断面最小加权强度
    anchorSpatialWeight: 0.25,             // 锚点选择里程/空间误差权重
    candidateWidthMinMeters: 350,          // 候选断面宽度下限（米）
    candidateWidthMaxMeters: 6000,         // 候选断面宽度上限（米）
    candidateConfidenceBase: 0.4,          // 候选置信度基值
    candidateConfidencePerWeight: 0.18,    // 候选置信度随权重增量
    candidateConfidenceMax: 0.94,          // 候选置信度上限
    minCandidateDistanceMeters: 4000,      // 候选断面最小上游距离（米）
    candidateDedupMeters: 2200,            // 候选断面去重距离（米）

    // —— 跟踪 TidalTracker ——
    trackerMaxMissingSeconds: 900,         // 断面跟踪最大缺失时长（秒）
    trackerMinCelerity: 12,                // 关联闸门最小波速（m/s）
    trackerMaxCelerity: 22,                // 关联闸门最大波速（m/s）
    trackerForwardSlack: 1.5,              // 前向关联距离松弛系数
    trackerAllowanceMeters: 1000,          // 粗网格空间容差（米）
    trackerBackwardToleranceMeters: 900,   // 断面回退容忍距离（米）
    trackerConfirmCountWithTrack: 3,       // 有历史时确认所需观测数
    trackerConfirmCountFresh: 2,           // 无历史时确认所需观测数
    trackerMinAdvanceMeters: 350,          // 重新捕获最小推进距离（米）
    trackerMaxVelocity: 18,                // 断面速度上限（m/s）
    trackerVelocitySmoothing: 0.5,         // 断面速度平滑权重
    trackerUncertainWindowFactor: 1.1,     // 不确定窗口相对帧间隔倍数
    trackerUncertainConfidenceDecay: 0.25, // 不确定帧置信度衰减系数

    // —— 插值与沉积 interpolateTidalTrack / TidalEvolution.step ——
    fallbackTrackWidthMeters: 850,         // 无有效断面时的缺省宽度（米）
    sedimentSubstepSeconds: 45,            // 沉积子步长（秒）
    sedimentDiffusionCoefficient: 20,      // 沉积扩散系数
    sedimentDecaySeconds: 2700,            // 沉积衰减时间常数（秒）
    sedimentSourceOffsetMeters: 550,       // 沉积源相对潮头偏移（米）
    sedimentSourceWidthMeters: 1300,       // 沉积源高斯宽度（米）
    sedimentSourceRiseSeconds: 110         // 沉积源建立时间常数（秒）
})

/** 合并 Profile 覆盖：只接受 DEFAULT_TIDAL_PARAMETERS 已有键与有限数值。 */
export function mergeTidalParameters(overrides) {
    const parameters = { ...DEFAULT_TIDAL_PARAMETERS }
    if (overrides && typeof overrides === 'object') {
        for (const key of Object.keys(parameters)) {
            const value = overrides[key]
            if (Number.isFinite(value)) parameters[key] = value
        }
    }
    return parameters
}

/** 解析入海方向：缺省与非法值回退 east（与原实现一致）。 */
export function resolveSeaward(seaward) {
    return TIDAL_SEAWARD_DIRECTIONS.includes(seaward) ? seaward : 'east'
}

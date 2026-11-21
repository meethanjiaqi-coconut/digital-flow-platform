import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPTIONS, COLOR_RAMPS, WATER_QUALITY_OPTIONS, isFlowError } from '../packages/sdk/src/index.js'
import { mergeOptions } from '../packages/sdk/src/validation.js'
import { LEVEL_COLOR_STOPS, SPEED_COLOR_STOPS } from '../packages/sdk/src/internal/flowColorRamps.js'
import { WATER_QUALITY_OPTIONS as PRESET_OPTIONS } from '../packages/sdk/src/internal/waterQualityPresets.js'

const isInvalidArgument = error => isFlowError(error) && error.code === 'INVALID_ARGUMENT'
const assertInvalid = patch => assert.throws(() => mergeOptions(DEFAULT_OPTIONS, patch), isInvalidArgument)

test('默认配置包含 quality/arrowScale/palette/qualityPreset', () => {
  assert.equal(DEFAULT_OPTIONS.quality, 'standard')
  assert.equal(DEFAULT_OPTIONS.water.arrowScale, 24)
  assert.equal(DEFAULT_OPTIONS.water.palette, 'natural')
  assert.equal(DEFAULT_OPTIONS.water.qualityPreset, 'off')
  const merged = mergeOptions(DEFAULT_OPTIONS, {})
  assert.equal(merged.quality, 'standard')
  assert.equal(merged.water.arrowScale, 24)
  assert.equal(merged.water.palette, 'natural')
  assert.equal(merged.water.qualityPreset, 'off')
})

test('quality 仅允许 low/standard', () => {
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { quality: 'low' }).quality, 'low')
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { quality: 'standard' }).quality, 'standard')
  for (const bad of ['high', 'LOW', '', 1, null, true]) assertInvalid({ quality: bad })
})

test('water.arrowScale 限制在 1..80', () => {
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { water: { arrowScale: 1 } }).water.arrowScale, 1)
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { water: { arrowScale: 80 } }).water.arrowScale, 80)
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { water: { arrowScale: 24.5 } }).water.arrowScale, 24.5)
  for (const bad of [0, 81, -1, NaN, Infinity, '24', null, true]) {
    assertInvalid({ water: { arrowScale: bad } })
  }
})

test('water.palette 仅允许 natural/tech', () => {
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { water: { palette: 'tech' } }).water.palette, 'tech')
  assert.equal(mergeOptions(DEFAULT_OPTIONS, { water: { palette: 'natural' } }).water.palette, 'natural')
  for (const bad of ['neon', 'Natural', '', 0, null, true]) assertInvalid({ water: { palette: bad } })
})

test('water.qualityPreset 接受 off/I/II/III/IV/V/BAD_V 并拒绝其它值', () => {
  for (const value of ['off', 'I', 'II', 'III', 'IV', 'V', 'BAD_V']) {
    const merged = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: value } })
    assert.equal(merged.water.qualityPreset, value)
  }
  for (const bad of ['VI', 'bad_v', 'OFF', '', 3, null, true]) {
    assertInvalid({ water: { qualityPreset: bad } })
  }
})

test('互斥：patch 设 qualityPreset 非 off 时 colorMode 强制为 river', () => {
  const speed = mergeOptions(DEFAULT_OPTIONS, { water: { colorMode: 'speed' } })
  assert.equal(speed.water.colorMode, 'speed')
  const merged = mergeOptions(speed, { water: { qualityPreset: 'III' } })
  assert.equal(merged.water.qualityPreset, 'III')
  assert.equal(merged.water.colorMode, 'river')
  const level = mergeOptions(DEFAULT_OPTIONS, { water: { colorMode: 'level' } })
  const mergedLevel = mergeOptions(level, { water: { qualityPreset: 'BAD_V' } })
  assert.equal(mergedLevel.water.colorMode, 'river')
  assert.equal(mergedLevel.water.qualityPreset, 'BAD_V')
})

test('互斥：patch 设 colorMode 为 speed/level 时 qualityPreset 强制为 off', () => {
  const preset = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'IV' } })
  assert.equal(preset.water.qualityPreset, 'IV')
  for (const mode of ['speed', 'level']) {
    const merged = mergeOptions(preset, { water: { colorMode: mode } })
    assert.equal(merged.water.colorMode, mode)
    assert.equal(merged.water.qualityPreset, 'off')
  }
})

test('互斥：同一 patch 内 qualityPreset 非 off 且 colorMode 非 river 抛 INVALID_ARGUMENT', () => {
  for (const mode of ['speed', 'level']) {
    assertInvalid({ water: { qualityPreset: 'III', colorMode: mode } })
    assertInvalid({ water: { qualityPreset: 'BAD_V', colorMode: mode } })
  }
  const okPreset = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'III', colorMode: 'river' } })
  assert.equal(okPreset.water.qualityPreset, 'III')
  assert.equal(okPreset.water.colorMode, 'river')
  const okMode = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'off', colorMode: 'speed' } })
  assert.equal(okMode.water.colorMode, 'speed')
  assert.equal(okMode.water.qualityPreset, 'off')
})

test('联动：patch 关闭水面时箭头与潮头标记被强制关闭，再开水面仍保持关闭', () => {
  const styled = mergeOptions(DEFAULT_OPTIONS, { water: { arrows: true }, tidal: { marker: true } })
  assert.equal(styled.water.arrows, true)
  assert.equal(styled.tidal.marker, true)
  const hidden = mergeOptions(styled, { water: { visible: false } })
  assert.equal(hidden.water.visible, false)
  assert.equal(hidden.water.arrows, false)
  assert.equal(hidden.tidal.marker, false)
  const reshown = mergeOptions(hidden, { water: { visible: true } })
  assert.equal(reshown.water.visible, true)
  assert.equal(reshown.water.arrows, false)
  assert.equal(reshown.tidal.marker, false)
})

test('联动：水面已关闭时 patch 开启箭头/潮头标记被静默保持关闭', () => {
  const hidden = mergeOptions(DEFAULT_OPTIONS, { water: { visible: false } })
  const merged = mergeOptions(hidden, { water: { arrows: true }, tidal: { marker: true } })
  assert.equal(merged.water.visible, false)
  assert.equal(merged.water.arrows, false)
  assert.equal(merged.tidal.marker, false)
})

test('联动：同一 patch 关闭水面又显式开启箭头/潮头标记抛 INVALID_ARGUMENT', () => {
  assertInvalid({ water: { visible: false, arrows: true } })
  assertInvalid({ water: { visible: false }, tidal: { marker: true } })
  const consistent = mergeOptions(DEFAULT_OPTIONS, { water: { visible: false, arrows: false }, tidal: { marker: false } })
  assert.equal(consistent.water.visible, false)
  assert.equal(consistent.water.arrows, false)
  assert.equal(consistent.tidal.marker, false)
})

test('联动：开启潮头清浊分界时水质预设/色板/着色模式复位为 off/natural/river', () => {
  const styled = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'III', palette: 'tech' } })
  const merged = mergeOptions(styled, { tidal: { turbidity: true } })
  assert.equal(merged.tidal.turbidity, true)
  assert.equal(merged.water.qualityPreset, 'off')
  assert.equal(merged.water.palette, 'natural')
  assert.equal(merged.water.colorMode, 'river')
  const speed = mergeOptions(DEFAULT_OPTIONS, { water: { colorMode: 'speed' } })
  const mergedSpeed = mergeOptions(speed, { tidal: { turbidity: true } })
  assert.equal(mergedSpeed.water.colorMode, 'river')
  assert.equal(mergedSpeed.water.qualityPreset, 'off')
  const keepTech = mergeOptions(DEFAULT_OPTIONS, { water: { palette: 'tech' }, tidal: { turbidity: false } })
  assert.equal(keepTech.water.palette, 'tech')
})

test('联动：潮头清浊与同 patch 冲突的显式水面配置抛 INVALID_ARGUMENT', () => {
  assertInvalid({ tidal: { turbidity: true }, water: { qualityPreset: 'III' } })
  assertInvalid({ tidal: { turbidity: true }, water: { palette: 'tech' } })
  assertInvalid({ tidal: { turbidity: true }, water: { colorMode: 'speed' } })
  assertInvalid({ tidal: { turbidity: true }, water: { colorMode: 'level' } })
  const consistent = mergeOptions(DEFAULT_OPTIONS, { tidal: { turbidity: true }, water: { qualityPreset: 'off', palette: 'natural', colorMode: 'river' } })
  assert.equal(consistent.tidal.turbidity, true)
  assert.equal(consistent.water.qualityPreset, 'off')
  assert.equal(consistent.water.palette, 'natural')
  assert.equal(consistent.water.colorMode, 'river')
})

test('联动：水质预设非 off 时潮头清浊被关闭', () => {
  const turbid = mergeOptions(DEFAULT_OPTIONS, { tidal: { turbidity: true } })
  assert.equal(turbid.tidal.turbidity, true)
  const merged = mergeOptions(turbid, { water: { qualityPreset: 'II' } })
  assert.equal(merged.water.qualityPreset, 'II')
  assert.equal(merged.water.colorMode, 'river')
  assert.equal(merged.tidal.turbidity, false)
  assertInvalid({ water: { qualityPreset: 'II' }, tidal: { turbidity: true } })
  const consistent = mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'II' }, tidal: { turbidity: false } })
  assert.equal(consistent.tidal.turbidity, false)
  assert.equal(consistent.water.qualityPreset, 'II')
})

test('互斥规则不影响不相关 patch', () => {
  const merged = mergeOptions(DEFAULT_OPTIONS, { water: { arrows: true, waveAmplitude: 0.2 } })
  assert.equal(merged.water.arrows, true)
  assert.equal(merged.water.waveAmplitude, 0.2)
  assert.equal(merged.water.qualityPreset, 'off')
  assert.equal(merged.water.colorMode, 'river')
})

test('导出 WATER_QUALITY_OPTIONS 与冻结的 COLOR_RAMPS', () => {
  assert.equal(WATER_QUALITY_OPTIONS, PRESET_OPTIONS)
  assert.ok(Object.isFrozen(WATER_QUALITY_OPTIONS))
  assert.deepEqual(WATER_QUALITY_OPTIONS.map(option => option.value), ['off', 'I', 'II', 'III', 'IV', 'V', 'BAD_V'])
  assert.ok(WATER_QUALITY_OPTIONS.every(option => typeof option.label === 'string' && typeof option.value === 'string'))
  assert.equal(COLOR_RAMPS.level, LEVEL_COLOR_STOPS)
  assert.equal(COLOR_RAMPS.speed, SPEED_COLOR_STOPS)
  assert.ok(Object.isFrozen(COLOR_RAMPS))
  assert.deepEqual(COLOR_RAMPS.level, ['#1035aa', '#00c7ff', '#7dffb0', '#ffe85c', '#ff5c3d'])
  assert.deepEqual(COLOR_RAMPS.speed, ['#12345f', '#1e6fd9', '#00c8ff', '#7df3ff', '#ffffff'])
})

test('mergeOptions 不修改 DEFAULT_OPTIONS', () => {
  mergeOptions(DEFAULT_OPTIONS, { water: { qualityPreset: 'III' } })
  mergeOptions(DEFAULT_OPTIONS, { water: { colorMode: 'speed' } })
  assert.equal(DEFAULT_OPTIONS.water.qualityPreset, 'off')
  assert.equal(DEFAULT_OPTIONS.water.colorMode, 'river')
  assert.equal(DEFAULT_OPTIONS.quality, 'standard')
})

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

import assert from 'node:assert/strict'
import { FlowFieldController } from '../tdesign/src/flowfield/FlowFieldController.js'

const viewer = {
    scene: {
        preUpdate: { addEventListener() {}, removeEventListener() {} },
        requestRender() {}
    }
}
const data = {
    nFrames: 72,
    activateWindow() {},
    hasFrame: () => true,
    nodeFrame: async () => new Float32Array(4),
    destroy() {}
}
const controller = new FlowFieldController(viewer, data)
await new Promise(resolve => setImmediate(resolve))
const layers = ['water', 'particles', 'tidalFront'].map(name => ({
    name,
    show: true,
    setAnimationTime(value, frame) { this.time = value; this.animationFrame = frame },
    setT(value) { this.ratio = value }
}))
layers.forEach(layer => controller.addLayer(layer))

controller._lastNow = performance.now() - 50
controller._onTick()
assert.ok(controller.simHour > 0)
assert.ok(layers[0].time > 0)
assert.ok(layers.every(layer => layer.time === layers[0].time))

controller.setPlaying(false)
const hour = controller.simHour
const animationTime = layers[0].time
const animationFrame = layers[0].animationFrame
for (let index = 0; index < 5; index++) {
    controller._lastNow = performance.now() - 10000
    controller._onTick()
    assert.equal(controller.simHour, hour)
    assert.ok(layers.every(layer => layer.time === animationTime))
    assert.ok(layers.every(layer => layer.animationFrame === animationFrame))
}

// 暂停时仍允许用户跳转到指定时次，但不能自行推进特效时钟。
controller.setHour(8.5)
await new Promise(resolve => setImmediate(resolve))
controller._onTick()
assert.equal(controller.simHour, 8.5)
assert.ok(layers.every(layer => layer.ratio === 0.5 && layer.time === animationTime))

// 恢复播放的第一帧不补算暂停期间的时间。
controller.setPlaying(true)
controller._onTick()
assert.equal(controller.simHour, 8.5)
assert.equal(layers[0].time, animationTime)
controller._lastNow = performance.now() - 50
controller._onTick()
assert.ok(controller.simHour > 8.5)
assert.ok(layers.every(layer => layer.time > animationTime))

// 倍速仅影响模型时次，不改变原有粒子速度；缓冲时特效也保持原来的运动方式。
controller.speed = 8
controller.buffering = true
const previousTime = layers[0].time
const previousFrame = layers[0].animationFrame
controller._lastNow = performance.now() - 1000
controller._onTick()
assert.ok(Math.abs(layers[0].time - previousTime - 0.1) < 1e-9)
assert.equal(layers[0].animationFrame, previousFrame + 1)
controller.destroy()
console.log('PASS: pause, paused seek, resume without catch-up, original effect cadence')

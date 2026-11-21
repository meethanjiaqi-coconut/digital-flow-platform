import assert from 'node:assert/strict'
import { ParticleFlowLayer, particleTrailFade, particleSpeedScale, DEFAULT_PARTICLE_SETTINGS } from '../tdesign/src/flowfield/ParticleFlowLayer.js'
import { FlowFieldController } from '../tdesign/src/flowfield/FlowFieldController.js'

const viewer = { scene: { requestRender() {} } }
const particles = new ParticleFlowLayer({}, viewer)
const controller = Object.create(FlowFieldController.prototype)
controller.particles = particles
assert.equal(particles._dim, 128)
assert.equal(particles._width, 1)
assert.equal(particles._opacity, 0.65)
assert.equal(particles.trailDuration, 1.5)
assert.equal(particleTrailFade(1.5, 1 / 60), 0.95, 'Default must match backup retention at 60 FPS')

// For the same model U/V, zooming must preserve motion as a fraction of the
// view. A fixed metres-to-degrees gain made estuary-wide convergence disappear.
const velocity = [1.2, -0.4]
for (const span of [0.16, 0.5, 2.7]) {
    const scale = particleSpeedScale(span)
    assert.ok(Math.abs(scale / span - 0.045) < 1e-12)
    const displacement = velocity.map(value => value * scale)
    assert.ok(Math.abs(displacement[0] / displacement[1] - velocity[0] / velocity[1]) < 1e-12)
    assert.equal(particleSpeedScale(span, 1), scale / 2)
}
assert.deepEqual(velocity, [1.2, -0.4], 'Presentation scaling must not mutate model velocities')
assert.equal(particleSpeedScale(NaN), 0)
assert.equal(particleSpeedScale(0), 0)

// Auxiliary camera rendering must not consume particle time, clear history or
// initialize resources. In SuperMap it also reports passes.render=true.
particles.setAnimationTime(12)
particles._clearTrails = false
for (const frameState of [
    { passes: { render: true }, fboEnable: true, fboName: 'water' },
    { passes: { render: true, offscreen: true } }
]) particles.update(frameState)
assert.equal(particles._renderedAnimationTime, 0)
assert.equal(particles._clearTrails, false)
assert.equal(particles._ready, false)
assert.equal(controller.setParticleTrailDuration(0), 0)
assert.equal(particles.trailDuration, 0, 'No-trail must not be replaced with a default')
assert.equal(controller.setParticleTrailDuration(3), 3)
assert.equal(controller.setParticleTrailDuration(100), 3)
assert.equal(controller.setParticleTrailDuration(-1), 0)
assert.equal(controller.setParticleTrailDuration(NaN), 1.5)

// The same real elapsed time must leave the same history at different FPS.
for (const seconds of [0.4, 1.5, 3]) {
    const residuals = [30, 60, 144].map(fps => {
        let opacity = 1
        for (let frame = 0; frame < fps; frame++) opacity *= particleTrailFade(seconds, 1 / fps)
        return opacity
    })
    assert.ok(Math.max(...residuals) - Math.min(...residuals) < 1e-12)
    assert.ok(Math.abs(particleTrailFade(seconds, seconds) - 0.01) < 0.0002, 'Rounded duration fades to about 1%')
}
assert.equal(particleTrailFade(0, 1 / 60), 0)
assert.equal(particleTrailFade(1.5, 0), 1)
assert.ok(particleTrailFade(3, 1 / 60) > particleTrailFade(0.4, 1 / 60))
particles.setCount(256)
particles.setWidth(1.4)
particles.setTrailDuration(0.4)
controller.resetParticleStyle()
assert.equal(particles._dim, DEFAULT_PARTICLE_SETTINGS.dimension)
assert.equal(particles._width, DEFAULT_PARTICLE_SETTINGS.width)
assert.equal(particles.trailDuration, DEFAULT_PARTICLE_SETTINGS.trailSeconds)
assert.equal(particles._clearTrails, true)
assert.equal(particles._rebuildParticles, true)
console.log('PASS: original viewport advection, backup defaults, reset, auxiliary-pass isolation and trail controls')

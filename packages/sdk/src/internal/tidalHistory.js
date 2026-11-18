import { FlowError } from '../errors.js'
import { TidalEvolution, tidalGeometry } from './tidalEvolution.js'

const CACHE_LIMIT = 4
const aborted = () => new DOMException('Operation superseded or destroyed', 'AbortError')

/**
 * 潮头历史构建器：同一帧的并发调用共享同一个 promise 并做引用计数，
 * 全部调用方取消后才真正取消底层构建（Worker 收到 tidalCancel，
 * 主线程回退在循环中检查 signal）。已建立的历史保留在 evolution.history，
 * 下次从 history.length 继续，构建结果确定性不变。
 */
export class TidalHistory {
    constructor(data, { onProgress } = {}) {
        this.data = data
        this.onProgress = onProgress
        this.cache = new Map()
        this.pending = new Map()
        this.evolution = null
        this.previousRaw = null
        this.queue = Promise.resolve()
        this.servedMax = 0
    }

    async frame(frame, { signal } = {}) {
        const data = this.data
        if (data._destroyed) throw new FlowError('DISPOSED', '流场数据已销毁')
        signal?.throwIfAborted()
        const safeFrame = Math.max(0, Math.min(data.nFrames - 1, Math.floor(frame)))
        const cached = this._touch(safeFrame)
        if (cached) return cached

        let entry = this.pending.get(safeFrame)
        if (entry?.controller.signal.aborted) {
            this.pending.delete(safeFrame)
            entry = undefined
        }
        if (!entry) {
            const controller = new AbortController()
            const promise = this._produce(safeFrame, controller.signal)
                .then(result => {
                    this._store(safeFrame, result)
                    this.servedMax = Math.max(this.servedMax, safeFrame + 1)
                    return result
                })
            const settle = () => {
                entry.settled = true
                if (this.pending.get(safeFrame) === entry) this.pending.delete(safeFrame)
            }
            promise.then(settle, settle)
            entry = { promise, controller, refs: 0, settled: false }
            this.pending.set(safeFrame, entry)
        }

        entry.refs++
        let onAbort
        const raced = signal ? new Promise((resolve, reject) => {
            onAbort = () => reject(aborted())
            if (signal.aborted) onAbort()
            else signal.addEventListener('abort', onAbort, { once: true })
        }) : null
        try {
            return await (raced ? Promise.race([entry.promise, raced]) : entry.promise)
        } finally {
            entry.refs--
            if (onAbort) signal.removeEventListener('abort', onAbort)
            if (entry.refs <= 0 && !entry.settled) entry.controller.abort()
        }
    }

    async _produce(frame, signal) {
        const data = this.data
        if (this.evolution?.history.length > frame) return this.evolution.output(frame)
        if (data._worker) {
            try {
                return await data._requestWorkerCancelable({ type: 'tidalState', frame }, signal)
            } catch (error) {
                if (error?.name === 'AbortError' || data._destroyed || data._worker) throw error
            }
        }
        return this._fallback(frame, signal)
    }

    _fallback(frame, signal) {
        const data = this.data
        const run = async () => {
            if (!this.evolution) this.evolution = new TidalEvolution(data)
            const timeline = this.evolution, times = data.meta.times
            while (timeline.history.length <= frame) {
                if (data._destroyed) throw new FlowError('DISPOSED', '流场数据已销毁')
                signal?.throwIfAborted()
                const index = timeline.history.length
                const current = await data.frame(index, { history: true })
                signal?.throwIfAborted()
                const seconds = (Date.parse(times[index]) - Date.parse(times[0])) / 1000
                const dt = index ? (Date.parse(times[index]) - Date.parse(times[index - 1])) / 1000 : 0
                timeline.step(index, this.previousRaw || current, current, seconds, dt)
                this.previousRaw = current
                this._report(timeline.history.length, frame + 1)
            }
            return timeline.output(frame)
        }
        const result = this.queue.then(run)
        this.queue = result.catch(() => {})
        return result
    }

    _report(loaded, total) {
        this.onProgress?.({ phase: 'history', loaded, total })
    }

    _store(frame, result) {
        this.cache.set(frame, result)
        for (const key of this.cache.keys()) {
            if (this.cache.size <= CACHE_LIMIT) break
            this.cache.delete(key)
        }
    }

    _touch(frame) {
        const value = this.cache.get(frame)
        if (!value) return value
        this.cache.delete(frame)
        this.cache.set(frame, value)
        return value
    }

    get stats() {
        let cells = this.evolution?.g?.activeCells?.length ?? 0
        if (!cells) {
            try { cells = tidalGeometry(this.data).activeCells.length } catch { cells = 0 }
        }
        const frames = Math.max(this.evolution?.history.length ?? 0, this.servedMax)
        return { frames, bytes: frames * cells * 4 }
    }

    destroy() {
        for (const entry of this.pending.values()) entry.controller.abort()
        this.pending.clear()
        this.evolution = null
        this.previousRaw = null
    }
}

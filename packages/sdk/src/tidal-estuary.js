import { DEFAULT_QIANTANG_ESTUARY_POLYGON } from './internal/tidal-front-analysis.js'
export const qiantangProfile = Object.freeze({id:'qiantang-v1', polygon:Object.freeze(DEFAULT_QIANTANG_ESTUARY_POLYGON.map(p => Object.freeze([...p]))), visualOnly:true})
export function createTidalEstuary({profile} = {}) {
  if (!profile?.id || !Array.isArray(profile.polygon) || profile.polygon.length < 3 || profile.polygon.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new TypeError('An explicit estuary profile with id and polygon is required')
  return Object.freeze({kind:'tidal-estuary',profile:structuredClone(profile)})
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {createFlowField,createStaticProvider,createHttpProvider} from '../packages/sdk/src/index.js'
import {createTidalEstuary} from '../packages/sdk/src/tidal-estuary.js'
import {FlowFieldData} from '../packages/sdk/src/internal/FlowFieldData.js'
import {Worker} from 'node:worker_threads'
import {gzipSync} from 'node:zlib'

function fixture() {
  const m={scenarioId:'fixture',nNodes:4,nCells:2,nTris:2,nFrames:3,bbox:[100,0,140,40],scales:{level:.01,uv:.001},drySentinel:-32768,mesh:{meshId:'test',file:'mesh.bin.gz'},frames:[0,5,15].map((minute,index)=>({index,validTime:`2026-10-25T00:${String(minute).padStart(2,'0')}:00+08:00`,file:`frames/${index}.bin.gz`}))}
  const mesh=new ArrayBuffer(108), head=new DataView(mesh)
  ;[0x46464d31,4,2,2].forEach((v,i)=>head.setUint32(i*4,v,true))
  new Float32Array(mesh,16,12).set([120,120.1,120.1,120,30,30,30.1,30.1,-5,-5,-5,-5])
  new Uint16Array(mesh,64,6).set([0,1,2,0,2,3])
  new Uint16Array(mesh,76,8).set([0,1,2,0,0,2,3,0])
  new Float32Array(mesh,92,4).set([120.066,120.033,30.033,30.066])
  const frames=[0,1,2].map(i=>new Int16Array([100+i*100,200+i*100,1000+i*1000,500+i*500,0,0]).buffer)
  const calls=[]
  const provider={
    async loadManifest(selection={}, {signal}={}){signal?.throwIfAborted();return {...m,scenarioId:selection.sourceRunId||m.scenarioId}},
    async getMesh(_,{signal}={}){signal?.throwIfAborted();return mesh.slice(0)},
    async getFrame(_,i,{signal}={}){signal?.throwIfAborted();calls.push(i);return frames[i].slice(0)}
  }
  return {m,mesh,frames,provider,calls}
}
function harness(config={}) {
  const f=fixture(), live={mounts:0,destroys:0,frames:[],times:[]}
  const renderer={attach({onTick,options}){live.mounts++;live.tick=onTick;live.options=options;return {
    setFrames(...args){live.frames.push(args)},setTime(...args){live.times.push(args)},setOptions(o){live.options=o},requestRender(){},
    destroy(){live.destroys++},pick(){return {lon:120.07,lat:30.02}}
  }}}
  return {...f,live,flow:createFlowField({provider:f.provider,renderer,worker:false,...config})}
}
test('default is paused; ISO seek uses actual irregular timestamps; query preserves physical units',async()=>{
  const {flow,live}=harness()
  await flow.loadScenario()
  assert.equal(flow.getState().playing,false)
  assert.equal(flow.getState().options.particles.trailSeconds,1.5)
  await flow.seek('2026-10-25T00:10:00+08:00')
  assert.equal(flow.getState().displayedFrame,1.5)
  assert.equal(flow.getState().displayedTime,'2026-10-24T16:10:00.000Z')
  const q=await flow.queryAt({lon:120.07,lat:30.02})
  assert.equal(q.level,2.5);assert.equal(q.u,2.5);assert.equal(q.speed,2.5)
  assert.equal(await flow.queryAt({lon:0,lat:0}),null)
  flow.setOptions({particles:{trailSeconds:3,lineWidth:2}})
  assert.equal(live.options.particles.trailSeconds,3)
  assert.throws(()=>flow.setOptions({particles:{trailSeconds:99}}))
  assert.throws(()=>flow.setOptions({water:{waveAmplitude:.4}}))
  assert.equal(flow.getState().options.particles.trailSeconds,3)
  const snapshot=flow.getState();snapshot.options.particles.trailSeconds=0
  assert.equal(flow.getState().options.particles.trailSeconds,3)
  flow.destroy();flow.destroy();assert.equal(live.destroys,1)
})
test('latest seek wins, cancelled load cannot remount, and errors are observable',async()=>{
  const {flow,live}=harness()
  await flow.loadScenario()
  const results=await Promise.allSettled([flow.seek('2026-10-25T00:15:00+08:00'),flow.seek('2026-10-25T00:00:00+08:00')])
  assert.equal(results[0].reason.name,'AbortError');assert.equal(results[1].status,'fulfilled')
  assert.equal(flow.getState().displayedFrame,0)
  let count=0;const off=flow.on('statechange',()=>count++);off();flow.pause();assert.equal(count,0)
  flow.destroy()
  let release
  const h=harness({provider:{...fixture().provider,loadManifest:()=>new Promise(r=>release=r)}})
  const pending=h.flow.loadScenario();h.flow.destroy();release(fixture().m)
  await assert.rejects(pending,{name:'AbortError'});assert.equal(h.live.mounts,0)
  const broken=harness({provider:{...fixture().provider,getMesh:async()=>new ArrayBuffer(4)}})
  let failure;broken.flow.on('error',e=>failure=e)
  await assert.rejects(broken.flow.loadScenario(),/Invalid mesh/)
  assert.ok(failure);assert.equal(broken.flow.getState().status,'error');broken.flow.destroy()
})
test('play/pause, loop=false, and 20 scenario lifecycles release each session',async()=>{
  const {flow,live}=harness({playback:{loop:false,secondsPerFrame:.1}})
  for(let i=0;i<20;i++)await flow.loadScenario({sourceRunId:`run-${i}`})
  assert.equal(live.mounts,20);assert.equal(live.destroys,19)
  flow.play();live.tick(0);live.tick(100);await new Promise(r=>setTimeout(r,0));live.tick(200);live.tick(300)
  await new Promise(r=>setTimeout(r,0))
  assert.equal(flow.getState().playing,false);assert.equal(flow.getState().requestedFrame,2)
  flow.pause();const before=live.times.at(-1);live.tick(400);assert.equal(live.times.at(-1)[1],before[1])
  flow.destroy();assert.equal(live.destroys,20)
})
test('static gzip and HTTP providers route every request through injected authentication',async()=>{
  const f=fixture(),urls=[]
  const request=async(url,{signal}={})=>{
    signal?.throwIfAborted();urls.push(String(url));const u=String(url)
    if(u.endsWith('manifest')||u.endsWith('package.json'))return Response.json({...f.m,sourceRunId:'fixture'})
    if(u.includes('/meshes/')||u.endsWith('mesh.bin.gz'))return new Response(gzipSync(new Uint8Array(f.mesh)))
    const i=Number(u.match(/(?:frames\/)(\d+)/)?.[1]||0)
    return new Response(gzipSync(new Uint8Array(f.frames[i])))
  }
  for(const provider of [createStaticProvider({manifestUrl:'https://example.invalid/nested/package.json',request}),createHttpProvider({baseUrl:'https://example.invalid/secure',request})]){
    const m=await provider.loadManifest();const data=await FlowFieldData.load(provider,m,{worker:false})
    assert.equal(data.cellValue(0,0).u,1);assert.equal((await data.nodeFrame(0)).length,16);data.destroy()
  }
  assert.ok(urls.some(u=>u.includes('/secure/api/v1/')));assert.ok(urls.some(u=>u.includes('/nested/frames/')))
  const signal=AbortSignal.abort();await assert.rejects(request('any',{signal}),{name:'AbortError'})
})
test('worker history uses provider bridge and matches main-thread deterministic history',async()=>{
  const f=fixture(), profile=createTidalEstuary({profile:{id:'fixture',polygon:[[119,29],[121,29],[121,31],[119,31]]}}).profile
  const workerFactory=()=>{
    const url=new URL('../packages/sdk/src/internal/flowFieldWorker.js',import.meta.url).href
    const worker=new Worker(`const {parentPort}=require('node:worker_threads'); globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)}; import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true})
    const wrapper={postMessage:(...args)=>worker.postMessage(...args),terminate:()=>worker.terminate(),onmessage:null,onerror:null}
    worker.on('message',data=>wrapper.onmessage?.({data}));worker.on('error',error=>wrapper.onerror?.(error));return wrapper
  }
  const a=await FlowFieldData.load(f.provider,f.m,{workerFactory,profile})
  const b=await FlowFieldData.load(f.provider,f.m,{worker:false,profile})
  try{
    const x=await a.tidalFrontFrame(2),y=await b.tidalFrontFrame(2)
    assert.deepEqual(x,y);assert.deepEqual(await a.nodeFrame(1),await b.nodeFrame(1))
    assert.ok(f.calls.includes(2))
  }finally{a.destroy();b.destroy()}
})
test('single-frame odd-triangle meshes support unaligned centroid arrays',async()=>{
  const m={...fixture().m,nNodes:3,nCells:1,nTris:1,nFrames:1,frames:fixture().m.frames.slice(0,1)}
  const mesh=new ArrayBuffer(74),v=new DataView(mesh)
  ;[0x46464d31,3,1,1].forEach((value,i)=>v.setUint32(i*4,value,true))
  new Float32Array(mesh,16,9).set([120,120.1,120,30,30,30.1,-5,-5,-5])
  new Uint16Array(mesh,52,3).set([0,1,2]);new Uint16Array(mesh,58,4).set([0,1,2,0])
  v.setFloat32(66,120.033,true);v.setFloat32(70,30.033,true)
  const provider={loadManifest:async()=>m,getMesh:async()=>mesh,getFrame:async()=>new Int16Array([100,1000,0]).buffer}
  const {flow}=harness({provider})
  await flow.loadScenario();assert.equal(flow.getState().frameCount,1)
  assert.equal((await flow.queryAt({lon:120.02,lat:30.02})).u,1)
  flow.destroy()
})

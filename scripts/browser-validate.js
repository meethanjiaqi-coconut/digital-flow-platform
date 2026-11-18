async (page) => {
  await page.waitForFunction(()=>window.demoFlow?.getState().status==='ready')
  const report=await page.evaluate(async()=>{
    const flow=window.demoFlow,v=window.sdkDemo.viewer,S=SuperMap3D
    flow.pause()
    const errors=[]
    const removeError=v.scene.renderError.addEventListener((s,e)=>errors.push(String(e)))
    await flow.seek('2026-10-25T02:20:00+08:00')
    const first=flow.getState()
    let query
    for(let lon=120.3;lon<120.95&&!query;lon+=.025)for(let lat=30.15;lat<30.5&&!query;lat+=.025){
      const point=await flow.queryAt({lon,lat})
      if(point?.wet)query=point
    }
    if(!query)throw new Error('No wet river sample found')
    const seeks=await Promise.allSettled([flow.seek('2026-10-25T04:00:00+08:00'),flow.seek('2026-10-25T01:20:00+08:00')])
    const latest=flow.getState()
    const result={first,query,latest,seeks:seeks.map(r=>({status:r.status,error:r.reason?.name})),errors,cycles:[]}
    window.validation=result
    const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))
    function metrics(){return {primitives:v.scene.primitives.length,entities:v.entities.values.length,preUpdate:v.scene.preUpdate.numberOfListeners,postUpdate:v.scene.postUpdate.numberOfListeners,clockTick:v.clock.onTick.numberOfListeners,clockStop:v.clock.onStop.numberOfListeners,currentTime:S.JulianDate.toIso8601(v.clock.currentTime),shouldAnimate:v.clock.shouldAnimate}}
    flow.destroy();await settle()
    result.baseline=window.sdkDemo.baseline
    result.afterInitialDestroy=metrics()
    for(let i=0;i<20;i++){
      const f=sdkDemo.create()
      await f.loadScenario()
      f.setOptions({particles:{trailSeconds:i%2?3:.4}})
      await settle()
      f.destroy();f.destroy();await settle()
      result.cycles.push({cycle:i+1,...metrics(),gl:v.scene.context._gl.getError()})
    }
    result.hostAlive=!v.isDestroyed()
    const keys=Object.keys(result.baseline)
    result.lifecyclePassed=result.cycles.every(c=>keys.every(k=>c[k]===result.baseline[k])&&c.gl===0)&&errors.length===0
    removeError()
    await fetch('/__test-evidence',{method:'POST',body:JSON.stringify(result)})
    if(!result.lifecyclePassed)throw new Error('Lifecycle baseline mismatch; see browser-validation.json')
    return {query,latest:latest.displayedTime,cycles:result.cycles.length,lifecyclePassed:result.lifecyclePassed,errors}
  })
  return report
}

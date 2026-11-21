async (page) => {
  await page.waitForFunction(()=>window.demoFlow?.getState().status==='ready',{timeout:30000})
  const result=await page.evaluate(async()=>{
    const flow=window.demoFlow, v=window.sdkDemo.viewer
    window.sdkErrors=[]
    v.scene.renderError.addEventListener((scene,error)=>window.sdkErrors.push(String(error)))
    const initial=flow.getState()
    await flow.seek('2026-10-25T02:20:00+08:00')
    const query=await flow.queryAt({lon:120.55,lat:30.3})
    flow.play()
    return {initial,seek:flow.getState(),query,hostAlive:!v.isDestroyed()}
  })
  await page.waitForTimeout(2500)
  await page.screenshot({path:'output/playwright/vanilla-alpha.png'})
  console.log(JSON.stringify({...result,after:await page.evaluate(()=>({state:demoFlow.getState(),errors:sdkErrors,gl:sdkDemo.viewer.scene.context._gl.getError()}))}))
}

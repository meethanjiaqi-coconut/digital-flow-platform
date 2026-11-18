async(page)=>{
  const results=[]
  for(const path of ['/sdk-demo/examples/vanilla/','/examples/vue/']){
    const errors=[],failed=[]
    const errorHandler=error=>errors.push(String(error))
    const responseHandler=response=>{if(response.status()>=400&&response.url().includes('127.0.0.1'))failed.push({url:response.url(),status:response.status()})}
    page.on('pageerror',errorHandler);page.on('response',responseHandler)
    await page.goto('http://127.0.0.1:5185'+path)
    await page.waitForFunction(()=>window.demoFlow?.getState().status==='ready')
    const initial=await page.evaluate(()=>demoFlow.getState())
    await page.getByRole('button',{name:'播放',exact:true}).click()
    await page.waitForTimeout(1200)
    await page.getByRole('button',{name:'暂停',exact:true}).click()
    const after=await page.evaluate(()=>demoFlow.getState())
    if(initial.playing||after.displayedFrame<=initial.displayedFrame)throw new Error('Playback control failed')
    if(path.includes('vanilla')){
      const trail=page.getByRole('slider',{name:/粒子拖尾/})
      await trail.focus();await trail.press('End')
      if((await page.evaluate(()=>demoFlow.getState().options.particles.trailSeconds))!==3)throw new Error('Trail control failed')
    }else{
      const checkbox=page.getByRole('switch').first()
      await checkbox.click()
      if((await page.evaluate(()=>demoFlow.getState().options.water.visible))!==false)throw new Error('Vue water toggle failed')
      await checkbox.click()
    }
    await page.evaluate(async()=>{await demoFlow.seek('2026-10-25T02:20:00+08:00');demoFlow.setOptions({tidal:{marker:true}})})
    await page.waitForTimeout(500)
    await page.screenshot({path:`output/playwright/${path.includes('vanilla')?'subdirectory':'vue'}-alpha.png`})
    const state=await page.evaluate(()=>({state:demoFlow.getState(),gl:sdkDemo.viewer.scene.context._gl.getError(),warnings:demoFlow.getDiagnostics().warnings}))
    results.push({path,errors,failed,initial:initial.status,playingAdvanced:after.displayedFrame>initial.displayedFrame,...state})
    page.off('pageerror',errorHandler);page.off('response',responseHandler)
    if(errors.length||failed.length||state.gl!==0)throw new Error('Example browser errors')
  }
  await page.evaluate(async results=>{window.exampleValidation=results;await fetch('/__test-evidence',{method:'POST',body:JSON.stringify({examples:results})})},results)
  return results.map(r=>({path:r.path,passed:!r.errors.length&&!r.failed.length,gl:r.gl,frame:r.state.displayedFrame}))
}

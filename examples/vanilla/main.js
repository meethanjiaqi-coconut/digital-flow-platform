import {createDemo} from '../demo.js'
const $=id=>document.getElementById(id)
async function action(fn){try{$('error').textContent='';await fn()}catch(e){if(e.name!=='AbortError')$('error').textContent=e.message}}
try{
  const flow=await createDemo()
  const render=s=>{
    $('status').textContent=s.buffering?'正在加载相邻时次…':`${s.frameCount} 个时次 · 5 分钟间隔 · Alpha 0.1`
    $('time').textContent=s.displayedTime?new Date(s.displayedTime).toLocaleString('zh-CN',{hour12:false}):'—'
    $('play').disabled=s.status!=='ready';$('play').textContent=s.playing?'暂停':'播放'
    $('timeline').disabled=s.status!=='ready'
    $('timeline').max=Date.parse(s.endTime)-Date.parse(s.startTime)
    $('timeline').value=Date.parse(s.displayedTime)-Date.parse(s.startTime)
    $('widthValue').textContent=s.options.particles.lineWidth
    $('trailValue').textContent=s.options.particles.trailSeconds
    if(s.error)$('error').textContent=`${s.error.code}: ${s.error.message}`
  }
  render(flow.getState());flow.on('statechange',render)
  $('play').onclick=()=>action(()=>flow.getState().playing?flow.pause():flow.play())
  $('rate').onchange=e=>action(()=>flow.setPlaybackRate(Number(e.target.value)))
  $('timeline').onchange=e=>action(()=>flow.seek(new Date(Date.parse(flow.getState().startTime)+Number(e.target.value))))
  for(const [id,key] of [['count','count'],['width','lineWidth'],['trail','trailSeconds']]) $(id).oninput=e=>action(()=>flow.setOptions({particles:{[key]:Number(e.target.value)}}))
  for(const [id,group,key] of [['water','water','visible'],['particles','particles','visible'],['turbidity','tidal','turbidity'],['marker','tidal','marker'],['reflection','water','reflection']]) $(id).onchange=e=>action(()=>flow.setOptions({[group]:{[key]:e.target.checked}}))
}catch(e){$('status').textContent='加载失败';$('error').textContent=e.message;console.error(e)}

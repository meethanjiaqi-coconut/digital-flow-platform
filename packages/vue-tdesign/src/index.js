import { defineComponent, h, shallowRef, onUnmounted, watch } from 'vue'
import { Button, Slider, Switch, Select } from 'tdesign-vue-next'

/** UI depends only on the public FlowField contract. It never owns or destroys the flow. */
export const FlowControls = defineComponent({
  name:'FlowControls', props:{flow:{type:Object,required:true}}, emits:['error'],
  setup(props,{emit}) {
    const state = shallowRef(props.flow.getState()), message = shallowRef('')
    let unsubscribe
    watch(() => props.flow, flow => {unsubscribe?.(); state.value=flow.getState(); unsubscribe=flow.on('statechange',s=>state.value=s)}, {immediate:true})
    onUnmounted(()=>unsubscribe?.())
    async function action(fn) {try {message.value='';await fn()} catch(e) {if(e.name!=='AbortError'){message.value=e.message;emit('error',e)}}}
    const row=(label,control)=>h('div',{class:'df-row'},[h('span',label),control])
    const patch=p=>action(()=>props.flow.setOptions(p))
    const toggle=(label,value,change)=>h(Switch,{value,role:'switch','aria-label':label,'aria-checked':value,tabindex:0,onChange:change,onKeydown:event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();change(!value)}}})
    return ()=>{
      const s=state.value, ready=s.status==='ready', p=s.options.particles
      const range=Date.parse(s.endTime)-Date.parse(s.startTime)
      const elapsed=Date.parse(s.displayedTime)-Date.parse(s.startTime)
      return h('section',{class:'df-controls','aria-label':'数字流场控制面板'},[
        h('div',{class:'df-heading'},[h('strong','数字流场'),h('span',s.buffering?'正在加载':s.status==='ready'?'已就绪':s.status)]),
        h('p',{class:'df-time'},s.displayedTime ? new Date(s.displayedTime).toLocaleString('zh-CN',{hour12:false}) : '等待场次'),
        h('div',{class:'df-actions'},[
          h(Button,{theme:'primary',disabled:!ready,onClick:()=>action(()=>s.playing?props.flow.pause():props.flow.play())},()=>s.playing?'暂停':'播放'),
          h(Select,{value:s.rate,options:[1,2,4,8].map(value=>({value,label:`${value} 倍`})),onChange:v=>action(()=>props.flow.setPlaybackRate(v))})
        ]),
        h(Slider,{value:Number.isFinite(elapsed)?elapsed:0,min:0,max:range||1,step:1000,disabled:!ready,label:false,onChangeEnd:v=>action(()=>props.flow.seek(new Date(Date.parse(s.startTime)+v)))}),
        h('h4','图层显示'),
        row('动态水面',toggle('动态水面',s.options.water.visible,v=>patch({water:{visible:v}}))),
        row('流向粒子',toggle('流向粒子',p.visible,v=>patch({particles:{visible:v}}))),
        row('粒子数量',h(Select,{value:p.count,options:[16384,65536,262144].map(value=>({value,label:value.toLocaleString()})),onChange:v=>patch({particles:{count:v}})})),
        row(`粒子宽度 · ${p.lineWidth} px`,null),
        h(Slider,{value:p.lineWidth,min:.5,max:5,step:.1,onChange:v=>patch({particles:{lineWidth:v}})}),
        row(`粒子拖尾 · ${p.trailSeconds} 秒`,null),
        h(Slider,{value:p.trailSeconds,min:0,max:3,step:.1,onChange:v=>patch({particles:{trailSeconds:v}})}),
        h('h4','水面表达'),
        row('沿流运动强度',h(Select,{value:s.options.flowStrength,options:[1,2,3].map(value=>({value,label:`${value} 倍`})),onChange:v=>patch({flowStrength:v})})),
        row('水色',h(Select,{value:s.options.water.colorMode,options:[{value:'river',label:'河口水面'},{value:'speed',label:'流速着色'},{value:'level',label:'水位着色'}],onChange:v=>patch({water:{colorMode:v}})})),
        row('岸边倒影',toggle('岸边倒影',s.options.water.reflection,v=>patch({water:{reflection:v}}))),
        ...(s.tidal.status==='disabled'?[]:[row('潮头清浊分界',toggle('潮头清浊分界',s.options.tidal.turbidity,v=>patch({tidal:{turbidity:v}}))),row('潮头标记',toggle('潮头标记',s.options.tidal.marker,v=>patch({tidal:{marker:v}}))),h('p',{class:'df-note'},'清浊分界由流场推断，用于视觉示意。')]),
        message.value||s.error?h('p',{class:'df-error',role:'alert'},message.value||s.error):null
      ])
    }
  }
})

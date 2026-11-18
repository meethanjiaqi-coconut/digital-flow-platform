import {build} from 'esbuild'
import {mkdir,copyFile,cp} from 'node:fs/promises'
const common={bundle:true,format:'esm',platform:'browser',target:'es2022',sourcemap:true,logLevel:'info'}
await mkdir('packages/sdk/dist',{recursive:true})
await build({...common,entryPoints:{index:'packages/sdk/src/index.js',supermap3d:'packages/sdk/src/supermap3d.js','tidal-estuary':'packages/sdk/src/tidal-estuary.js',flowFieldWorker:'packages/sdk/src/internal/flowFieldWorker.js'},outdir:'packages/sdk/dist'})
await cp('packages/sdk/types','packages/sdk/dist',{recursive:true})
await mkdir('packages/vue-tdesign/dist',{recursive:true})
await build({...common,entryPoints:['packages/vue-tdesign/src/index.js'],outfile:'packages/vue-tdesign/dist/index.js',external:['vue','tdesign-vue-next','@digital-flow/sdk']})
await copyFile('packages/vue-tdesign/src/style.css','packages/vue-tdesign/dist/style.css')
await copyFile('packages/vue-tdesign/src/index.d.ts','packages/vue-tdesign/dist/index.d.ts')
await mkdir('examples/vue/dist',{recursive:true})
await build({...common,entryPoints:['examples/vue/main.js'],outfile:'examples/vue/dist/main.js',external:['@digital-flow/sdk','@digital-flow/sdk/*'],define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})
await copyFile('node_modules/tdesign-vue-next/dist/tdesign.css','examples/vue/dist/tdesign.css')
console.log('Built both packages, worker, types and Vue example')

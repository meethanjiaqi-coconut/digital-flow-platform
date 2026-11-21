import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
const directory=resolve('.tmp',`consumer-${Date.now()}`)
await mkdir(directory,{recursive:true})
const packages=JSON.parse(await readFile('artifacts/package-manifest.json','utf8'))
const {devDependencies}=JSON.parse(await readFile('package.json','utf8'))
const dependencies={vue:devDependencies.vue,'tdesign-vue-next':devDependencies['tdesign-vue-next']}
for(const pkg of packages)dependencies[pkg.name]=`file:${resolve('artifacts',pkg.filename).replaceAll('\\','/')}`
await writeFile(join(directory,'package.json'),JSON.stringify({name:'sdk-clean-consumer',private:true,type:'module',dependencies},null,2))
execFileSync(process.execPath,[process.env.npm_execpath,'install','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:directory,stdio:'inherit'})
const probe=`import assert from 'node:assert/strict'; import {createFlowField,createStaticProvider,VERSION} from '@digital-flow/sdk'; import {createSuperMap3DRenderer} from '@digital-flow/sdk/supermap3d'; import {qiantangProfile} from '@digital-flow/sdk/tidal-estuary'; assert.equal(typeof createFlowField,'function'); assert.equal(typeof createSuperMap3DRenderer,'function'); assert.equal(qiantangProfile.id,'qiantang-v1'); assert.equal(globalThis.window,undefined); console.log('SSR-safe package imports:',VERSION);`
execFileSync(process.execPath,['--input-type=module','-e',probe],{cwd:directory,stdio:'inherit'})
await copyFile('tests/types.ts',join(directory,'types.ts'))
await writeFile(join(directory,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,skipLibCheck:true,lib:['ES2022','DOM']},include:['types.ts']}))
execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--project',join(directory,'tsconfig.json')],{stdio:'inherit'})
for(const file of ['node_modules/@digital-flow/sdk/dist/flowFieldWorker.js','node_modules/@digital-flow/sdk/assets/estuary/Water_1_M_Normal.jpg','node_modules/@digital-flow/vue-tdesign/dist/style.css'])await readFile(join(directory,file))
await writeFile('artifacts/clean-install-validation.json',JSON.stringify({passed:true,directory,packages:packages.map(p=>({name:p.name,sha256:p.sha256})),checks:['offline npm install of both tgz files','SSR-safe SDK/renderer/plugin imports','public TypeScript API including optional Vue controls','worker, texture and CSS present']},null,2))
console.log('Clean consumer package and type checks passed')

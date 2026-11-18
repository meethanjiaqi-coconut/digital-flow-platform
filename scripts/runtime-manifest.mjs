import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const names=['SuperMap3D/SuperMap3D.js','w3d/w3d.umd.js']
const files=[]
for(const path of names){const bytes=await readFile(`local-assets/runtime/${path}`);files.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}
await mkdir('runtime-manifests',{recursive:true})
await writeFile('runtime-manifests/supermap3d-w3d-tested.json',JSON.stringify({sdkVersion:'0.1.0-alpha.1',policy:'Host supplies licensed runtime. Not distributed in npm packages.',files},null,2))
console.log('Recorded tested runtime fingerprints')

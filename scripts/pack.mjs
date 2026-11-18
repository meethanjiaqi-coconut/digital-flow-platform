import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const destination=resolve('artifacts')
await mkdir(destination,{recursive:true})
const npm=process.env.npm_execpath
if(!npm)throw new Error('Run npm run pack:local')
const reports=[]
for(const name of ['sdk','vue-tdesign']){
  const output=execFileSync(process.execPath,[npm,'pack','--json','--pack-destination',destination],{cwd:resolve('packages',name),encoding:'utf8'})
  const [report]=JSON.parse(output)
  if(report.files.some(f=>/local-assets|node_modules|SuperMap3D\.js|w3d\.umd|\/frames\//.test(f.path)))throw new Error('Private runtime/data leaked into package')
  const buffer=await readFile(resolve(destination,report.filename))
  reports.push({...report,sha256:createHash('sha256').update(buffer).digest('hex')})
}
await writeFile(resolve(destination,'package-manifest.json'),JSON.stringify(reports,null,2))
console.log(reports.map(r=>`${r.filename} (${r.size} bytes), SHA-256 ${r.sha256}`).join('\n'))

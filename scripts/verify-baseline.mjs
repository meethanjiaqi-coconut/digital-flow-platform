import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
const m=JSON.parse(await readFile('baseline/source-manifest.json','utf8'))
for(const f of m.files){
  const current=createHash('sha256').update(await readFile(join(m.source,f.path))).digest('hex')
  if(current!==f.sha256)throw new Error(`Original source changed: ${f.path}`)
}
console.log(`Original baseline unchanged: ${m.files.length}/${m.files.length} SHA-256 matched`)

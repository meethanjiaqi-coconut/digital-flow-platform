import {createServer} from 'node:http'
import {createReadStream} from 'node:fs'
import {stat,readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
const root=resolve('.'), port=Number(process.env.PORT||5185)
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.gz':'application/gzip'}
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'), pathname=decodeURIComponent(url.pathname)
    if(pathname==='/__test-evidence'&&req.method==='POST'){
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>2e6)throw new Error('Evidence too large');chunks.push(chunk)}
      const data=JSON.parse(Buffer.concat(chunks).toString())
      await mkdir('output/playwright',{recursive:true})
      await writeFile('output/playwright/browser-validation.json',JSON.stringify(data,null,2))
      res.end('saved');return
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
    if(pathname==='/'){res.writeHead(302,{Location:'/examples/vanilla/'});res.end();return}
    // A second mount validates package-relative workers/textures under a subdirectory.
    const relative=pathname.replace(/^\/sdk-demo\//,'/').replace(/^\/+/, '')
    if(!['examples/','packages/sdk/dist/','packages/sdk/assets/','packages/vue-tdesign/dist/','local-assets/'].some(p=>relative.startsWith(p))){res.writeHead(404);res.end();return}
    let file=resolve(root,relative)
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
    let info=await stat(file)
    if(info.isDirectory()){
      if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'});res.end();return}
      file=resolve(file,'index.html');info=await stat(file)
    }
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'})
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res)
  }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end(e.message)}
}).listen(port,'127.0.0.1',()=>console.log(`SDK examples: http://127.0.0.1:${port}/examples/vanilla/`))

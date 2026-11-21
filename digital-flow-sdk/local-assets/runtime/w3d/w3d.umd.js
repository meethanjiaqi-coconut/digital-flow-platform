(function(M,le){typeof exports=="object"&&typeof module!="undefined"?le(exports):typeof define=="function"&&define.amd?define(["exports"],le):(M=typeof globalThis!="undefined"?globalThis:M||self,le(M.w3d={}))})(this,(function(M){"use strict";var lt=(M,le,ve)=>new Promise((ht,we)=>{var ut=j=>{try{re(ve.next(j))}catch(Pe){we(Pe)}},T=j=>{try{re(ve.throw(j))}catch(Pe){we(Pe)}},re=j=>j.done?ht(j.value):Promise.resolve(j.value).then(ut,T);re((ve=ve.apply(M,le)).next())});SuperMap3D&&(()=>{const c=52.35987755982988,e=3.141592653589793,t=6378245,r=.006693421622965943;class n{static BD09ToGCJ02(i,s){let l=+i-.0065,h=+s-.006,u=Math.sqrt(l*l+h*h)-2e-5*Math.sin(h*c),p=Math.atan2(h,l)-3e-6*Math.cos(l*c),d=u*Math.cos(p),f=u*Math.sin(p);return[d,f]}static GCJ02ToBD09(i,s){s=+s,i=+i;let l=Math.sqrt(i*i+s*s)+2e-5*Math.sin(s*c),h=Math.atan2(s,i)+3e-6*Math.cos(i*c),u=l*Math.cos(h)+.0065,p=l*Math.sin(h)+.006;return[u,p]}static WGS84ToGCJ02(i,s){if(s=+s,i=+i,this.out_of_china(i,s))return[i,s];{let l=this.delta(i,s);return[i+l[0],s+l[1]]}}static GCJ02ToWGS84(i,s){if(s=+s,i=+i,this.out_of_china(i,s))return[i,s];{let l=this.delta(i,s),h=i+l[0],u=s+l[1];return[i*2-h,s*2-u]}}static delta(i,s){let l=this.transformLng(i-105,s-35),h=this.transformLat(i-105,s-35);const u=s/180*e;let p=Math.sin(u);p=1-r*p*p;const d=Math.sqrt(p);return l=l*180/(t/d*Math.cos(u)*e),h=h*180/(t*(1-r)/(p*d)*e),[l,h]}static transformLng(i,s){s=+s,i=+i;let l=300+i+2*s+.1*i*i+.1*i*s+.1*Math.sqrt(Math.abs(i));return l+=(20*Math.sin(6*i*e)+20*Math.sin(2*i*e))*2/3,l+=(20*Math.sin(i*e)+40*Math.sin(i/3*e))*2/3,l+=(150*Math.sin(i/12*e)+300*Math.sin(i/30*e))*2/3,l}static transformLat(i,s){s=+s,i=+i;let l=-100+2*i+3*s+.2*s*s+.1*i*s+.2*Math.sqrt(Math.abs(i));return l+=(20*Math.sin(6*i*e)+20*Math.sin(2*i*e))*2/3,l+=(20*Math.sin(s*e)+40*Math.sin(s/3*e))*2/3,l+=(160*Math.sin(s/12*e)+320*Math.sin(s*e/30))*2/3,l}static out_of_china(i,s){return s=+s,i=+i,!(i>73.66&&i<135.05&&s>3.86&&s<53.55)}}SuperMap3D.CoordTransform=n;class o extends SuperMap3D.WebMercatorTilingScheme{constructor(i){super(i);let s=new SuperMap3D.WebMercatorProjection;this._projection.project=function(l,h){return h=n.WGS84ToGCJ02(SuperMap3D.Math.toDegrees(l.longitude),SuperMap3D.Math.toDegrees(l.latitude)),h=s.project(new SuperMap3D.Cartographic(SuperMap3D.Math.toRadians(h[0]),SuperMap3D.Math.toRadians(h[1]))),new SuperMap3D.Cartesian2(h.x,h.y)},this._projection.unproject=function(l,h){let u=s.unproject(l);return h=n.GCJ02ToWGS84(SuperMap3D.Math.toDegrees(u.longitude),SuperMap3D.Math.toDegrees(u.latitude)),new SuperMap3D.Cartographic(SuperMap3D.Math.toRadians(h[0]),SuperMap3D.Math.toRadians(h[1]))}}}{const a="https://webst{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",i="https://webrd{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",s="https://webst{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";class l extends SuperMap3D.UrlTemplateImageryProvider{constructor(u={}){u.url=u.style==="img"?a:u.style==="cva"?s:i,u.crs=u.crs||"WGS84",(!u.subdomains||!u.subdomains.length)&&(u.subdomains=["01","02","03","04"]),u.crs==="WGS84"&&(u.tilingScheme=new o(u)),super(u)}}SuperMap3D.Amap84ImageryProvider=l}{const a="https://p{s}.map.gtimg.com/sateTiles/{z}/{sx}/{sy}/{x}_{reverseY}.jpg?version=400&&key=d84d6d83e0e51e481e50454ccbe8986b",i="https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={reverseY}&styleid={style}&scene=0&version=347&&key=d84d6d83e0e51e481e50454ccbe8986b";class s extends SuperMap3D.UrlTemplateImageryProvider{constructor(h={}){let u=h.style==="img"?a:i;h.url=u.replace("{style}",h.style||1),(!h.subdomains||!h.subdomains.length)&&(h.subdomains=["0","1","2"]),h.style==="img"&&(h.customTags={sx:(p,d,f,_)=>d>>4,sy:(p,d,f,_)=>(1<<_)-f>>4}),h.crs=h.crs||"WGS84",h.crs==="WGS84"&&(h.tilingScheme=new o(h)),super(h)}}SuperMap3D.Tencent84ImageryProvider=s}})();const{Cartesian3:le,DeveloperError:ve,ScreenSpaceEventHandler:ht,ScreenSpaceEventType:we,defaultValue:ut}=SuperMap3D,T={looking:!1,moveForward:!1,moveBackward:!1,moveUp:!1,moveDown:!1,moveLeft:!1,moveRight:!1,rotateUp:!1,rotateDown:!1,rotateLeft:!1,rotateRight:!1,twistLeft:!1,twistRight:!1};function re(c){switch(c){case"W":return"moveForward";case"S":return"moveBackward";case"Q":return"moveUp";case"E":return"moveDown";case"D":return"moveRight";case"A":return"moveLeft";case"Z":return"twistLeft";case"X":return"twistRight"}}class j{constructor(e){if(!e)throw new ve("viewer 没有被定义 ");this._viewer=e,this._moveState=!1}destroy(){this.moveTockEvent&&this.moveTockEvent()}stop(){this._moveState=!1}start(e){this._moveState=!0;const t=this._viewer.scene,r=this._viewer.canvas;r.setAttribute("tabindex","0"),r.onclick=function(){r.focus()};const n=t.globe.ellipsoid,o=new ht(r);o.setInputAction(function(a){T.looking=!0,le.clone(a.position)},we.LEFT_DOWN),o.setInputAction(function(a){a.endPosition},we.MOUSE_MOVE),o.setInputAction(function(a){T.looking=!1},we.LEFT_UP),document.addEventListener("keydown",function(a){const i=re(a.key.toUpperCase());typeof i!="undefined"&&(T[i]=!0)},!1),document.addEventListener("keyup",function(a){const i=re(a.key.toUpperCase());typeof i!="undefined"&&(T[i]=!1)},!1),window.keydown=function(a){const i=re(a.keyCode);typeof i!="undefined"&&(T[i]=!0)},window.keyup=function(a){const i=re(a.keyCode);typeof i!="undefined"&&(T[i]=!1)},this.moveTockEvent=this._viewer.clock.onTick.addEventListener(a=>{if(!this._moveState)return!1;const i=this._viewer.camera;if(T.looking)return;const s=n.cartesianToCartographic(i.position).height,l=ut(e,s/100);T.moveForward&&i.moveForward(l),T.moveBackward&&i.moveBackward(l),T.moveUp&&i.moveUp(l),T.moveDown&&i.moveDown(l),T.moveLeft&&i.moveLeft(l),T.moveRight&&i.moveRight(l),T.rotateUp&&i.rotateUp(1/10/Math.PI),T.rotateDown&&i.rotateDown(1/10/Math.PI),T.rotateLeft&&i.rotateLeft(1/10/Math.PI),T.rotateRight&&i.rotateRight(1/10/Math.PI),T.twistLeft&&i.twistLeft(1/10/Math.PI),T.twistRight&&i.twistRight(1/10/Math.PI)})}}const{createGuid:Pe,defaultValue:Y,defined:Qr,destroyObject:Jr,DeveloperError:Ft,Framebuffer:pt}=SuperMap3D;function Z(c){if(!Qr(c.context))throw new Ft("options.context is required.");this.context=c.context,this.x=Y(c.x,0),this.y=Y(c.y,0),this.width=Y(c.width,512),this.height=Y(c.height,256),this.left=Y(c.left,5),this.bottom=Y(c.bottom,5),this.texture=Y(c.texture,null),this.depthStencilTexture=Y(c.depthStencilTexture,null),this.frameBuffer=Y(c.frameBuffer,null),this.init()}Z.prototype.init=function(){this.createCanvas()},Z.prototype.createCanvas=function(){const c=document.createElement("canvas");c.id=`debugTexture_${Pe()}`,this.ctx=c.getContext("2d"),document.body.appendChild(c),c.style.position="absolute",c.style.left=this.left+"px",c.style.bottom=this.bottom+"px",c.style.backgroundColor="rgba(256,256,256,1.0)",c.style.zIndex="9999",c.width=this.width,c.height=this.height,this.canvas=c},Z.prototype.setBuffer=function(c){const e=this.canvas,t=this.ctx.createImageData(e.width,e.height);t.data.set(c),this.ctx.putImageData(t,0,0)},Z.prototype.makeBuffer=function(){if(!this.texture&&!this.depthStencilTexture)throw new Ft("options.texture or options.frameBuffer or options.depthStencilTexture Need at least one of the two is required.");this.texture&&!this.depthStencilTexture?this.frameBuffer=new pt({context:this.context,colorTextures:[this.texture],destroyAttachments:!1}):this.texture&&this.depthStencilTexture?this.frameBuffer=new pt({context:this.context,colorTextures:[this.texture],depthStencilTexture:this.depthStencilTexture,destroyAttachments:!1}):!this.texture&&this.depthStencilTexture&&(this.frameBuffer=new pt({context:this.context,depthStencilTexture:this.depthStencilTexture,destroyAttachments:!1}))},Z.prototype.getBuffer=function(){this.frameBuffer||this.makeBuffer();const c=parseInt(this.width),e=parseInt(this.height);return this.context.readPixels({x:this.x,y:this.y,width:c,height:e,framebuffer:this.frameBuffer})},Z.prototype.show=function(){const c=this.getBuffer();c!==null&&this.setBuffer(c)},Z.prototype.destroy=function(c){return Jr(this)},Object.defineProperties(Z.prototype,{});const{DeveloperError:en,PolygonHierarchy:Ot,ScreenSpaceEventHandler:he,ScreenSpaceEventType:z,CallbackProperty:N,Color:O,Entity:Me,Rectangle:Fe,Ellipsoid:ge,Cartesian3:Gt,CustomDataSource:tn,Cartographic:ft,EllipsoidGeodesic:rn,Cesium3DTileFeature:nn,Cesium3DTileset:an,Model:on,EllipsoidTerrainProvider:sn,defaultValue:cn}=SuperMap3D;class dt{constructor(e){if(!e)throw new en("viewer 没有被定义 ");this._viewer=e,this._drawLayer=new tn("m3dDrawLayer"),this._viewer.dataSources.add(this._drawLayer)}get drawLayer(){return this._drawLayer}removeDrawObject(e){this._drawLayer.entities.remove(e)}static drawPolyLine(e,t={}){return new Promise((r,n)=>{const o=t.style||{},a=new Me,i=[];a.polyline={width:o.width||2,material:o.material||O.CHARTREUSE.withAlpha(.3),clampToGround:o.clampToGround||!0},a.polyline.positions=new N(function(){return i},!1);const s=e.entities.add(a),l=new he(e.scene.canvas);l.setInputAction(h=>{let u=G(h.position,e);if(t.height){const p=be(u);u=xe(p,t.height)}u&&i.length===0&&i.push(u.clone()),i.push(u)},z.LEFT_CLICK),l.setInputAction(h=>{let u=G(h.endPosition,e);if(t.height){const p=be(u);u=xe(p,t.height)}u&&i.length>=2&&(i.pop(),i.push(u))},z.MOUSE_MOVE),l.setInputAction(h=>{l.destroy(),i.pop(),r({positions:i,polyline:s})},z.RIGHT_CLICK)})}static drawPolygon(e,t={}){const r=t.style||{width:2,material:O.CHARTREUSE.withAlpha(.3),clampToGround:!0};return new Promise((n,o)=>{const a=[],i=new Ot,s={},l=new he(e.scene.canvas);let h=null;const u=()=>{s.polyline=r,s.polyline.positions=new N(function(){return a},!1),s.polygon={hierarchy:new N(function(){return i},!1),material:O.WHITE.withAlpha(.1),clampToGround:r.clampToGround},h=e.entities.add(s)};try{l.setInputAction(p=>{let d=G(p.position,e);if(t.height){const f=be(d);d=xe(f,t.height)}d&&d.x&&(a.length===0&&(i.positions.push(d.clone()),a.push(d.clone())),a.push(d.clone()),i.positions.push(d.clone()),h||u())},z.LEFT_CLICK),l.setInputAction(p=>{let d=G(p.endPosition,e);if(t.height){const f=be(d);d=xe(f,t.height)}a.length>=2&&d&&d.x&&(a.pop(),a.push(d),i.positions.pop(),i.positions.push(d))},z.MOUSE_MOVE),l.setInputAction(p=>{l.destroy(),n({positions:a,polygonHierarchy:i,polygon:h})},z.RIGHT_CLICK)}catch(p){console.warn(p)}})}static drawRectangle(e,t){return t=t||{},t.style=t.style||{width:3,material:O.BLUE.withAlpha(.5),clampToGround:!0},new Promise((r,n)=>{const o=[],a=new Me,i=new he(e.scene.canvas);let s;i.setInputAction(function(h){const u=G(h.position,e);u&&u.x&&(o.length===0?o.push(u.clone()):(i.destroy(),o.push(u.clone()),s=Fe.fromCartesianArray([...o,u],ge.WGS84),r({positions:o,coordinates:s,rectangle:l})))},z.LEFT_CLICK),i.setInputAction(function(h){const u=G(h.endPosition,e);u&&(s=Fe.fromCartesianArray([...o,u],ge.WGS84))},z.MOUSE_MOVE),a.rectangle=t.style,t.height&&(a.rectangle.extrudedHeight=t.height),a.rectangle.coordinates=new N(function(){return s},!1);const l=e.entities.add(a)})}drawPolyLine(e={}){return new Promise((t,r)=>{const n=e.style||{},o=new Me,a=[];o.polyline={width:n.width||2,material:n.material||O.CHARTREUSE.withAlpha(.8),clampToGround:n.clampToGround||!0},o.polyline.positions=new N(function(){return a},!1);const i=this._drawLayer.entities.add(o),s=new he(this._viewer.scene.canvas);s.setInputAction(l=>{const h=G(l.position,this._viewer);h&&a.length===0&&a.push(h.clone()),a.push(h)},z.LEFT_CLICK),s.setInputAction(l=>{const h=G(l.endPosition,this._viewer);h&&a.length>=2&&(a.pop(),a.push(h))},z.MOUSE_MOVE),s.setInputAction(l=>{s.destroy(),t({positions:a,polyline:i})},z.RIGHT_CLICK)})}drawPolygon(e={}){const t=e.style||{width:2,material:O.CHARTREUSE.withAlpha(.3),clampToGround:!0};return new Promise((r,n)=>{const o=[],a=new Ot,i={},s=new he(this._viewer.scene.canvas);let l=null;const h=()=>{i.polyline=t,i.polyline.positions=new N(function(){return o},!1),i.polygon={hierarchy:new N(function(){return a},!1),material:O.WHITE.withAlpha(.1),clampToGround:t.clampToGround},l=this._drawLayer.entities.add(i)};try{s.setInputAction(u=>{const p=G(u.position,this._viewer);p&&p.x&&(o.length===0&&(a.positions.push(p.clone()),o.push(p.clone())),o.push(p.clone()),a.positions.push(p.clone()),l||h())},z.LEFT_CLICK),s.setInputAction(u=>{const p=G(u.endPosition,this._viewer);o.length>=2&&p&&p.x&&(o.pop(),o.push(p),a.positions.pop(),a.positions.push(p))},z.MOUSE_MOVE),s.setInputAction(u=>{s.destroy(),r({positions:o,polygonHierarchy:a,polygon:l})},z.RIGHT_CLICK)}catch(u){console.warn(u)}})}drawRectangleGraphics(e){return e=e||{},e.style=e.style||{width:3,material:O.BLUE.withAlpha(.5),clampToGround:!0},new Promise((t,r)=>{const n=[],o=new Me,a=this,i=new he(this._viewer.scene.canvas);let s;i.setInputAction(function(h){const u=a.getCatesian3FromPX(h.position);u&&u.x&&(n.length===0?n.push(u.clone()):(i.destroy(),n.push(u.clone()),s=Fe.fromCartesianArray([...n,u],ge.WGS84),t(a.transformCartesianArrayToWGS84Array(n),l)))},z.LEFT_CLICK),i.setInputAction(function(h){const u=this._viewer.scene.pickPosition(h.endPosition);u&&(s=Fe.fromCartesianArray([...n,u],ge.WGS84))},z.MOUSE_MOVE),o.rectangle=e.style,e.height&&(o.rectangle.extrudedHeight=e.height),o.rectangle.coordinates=new N(function(){return s},!1);const l=this._drawLayer.entities.add(o)})}drawCircleGraphics(e){return e=e||{},e.style=e.style||{width:3,material:O.BLUE.withAlpha(.5),clampToGround:!0},new Promise((t,r)=>{const n=new Me,o=this,a=new he(this._viewer.scene.canvas);let i,s,l;function h(p,d){const f=ft.fromCartesian(p),_=ft.fromCartesian(d),g=new rn;g.setEndPoints(f,_);const C=g.surfaceDistance;l=Math.sqrt(Math.pow(C,2)+Math.pow(_.height-f.height,2))}function u(){n.ellipse=e.style,n.ellipse.semiMajorAxis=new N(function(){return l},!1),n.ellipse.semiMinorAxis=new N(function(){return l},!1),n.position=new N(function(){return s},!1),n.point={pixelSize:5,outlineColor:O.RED,outlineWidth:3},e.height&&(n.ellipse.extrudedHeight=e.height),i=o._drawLayer.entities.add(n)}a.setInputAction(function(p){const d=this._viewer.scene.pickPosition(p.position);d&&d.x&&(s?(h(s,d),a.destroy(),t({center:s,radius:l},i)):(s=d,u()))},z.LEFT_CLICK),a.setInputAction(function(p){const d=o._viewer.scene.camera.pickEllipsoid(p.endPosition,o._viewer.scene.globe.ellipsoid);s&&d&&d.x&&h(s,d)},z.MOUSE_MOVE)})}}function xe(c,e){return c?Gt.fromDegrees(c.lng||c.lon,c.lat,e||c.alt,ge.WGS84):Gt.ZERO}function be(c,e){const t=ge.WGS84.cartesianToCartographic(c);return{lng:SuperMap3D.Math.toDegrees(t.longitude),lat:SuperMap3D.Math.toDegrees(t.latitude),alt:cn(e,t.height)}}function G(c,e){if(!e||!c)return!1;const t=e.scene.drillPick(c);let r=null,n=!1,o=!1;for(let i=0,s=t.length;i<s;i++){const l=t[i];if((l&&l.primitive instanceof nn||l&&l.primitive instanceof an||l&&l.primitive instanceof on)&&(n=!0),n&&(e.scene.pick(c),r=e.scene.pickPosition(c),r)){const h=ft.fromCartesian(r);h.height<0&&(h.height=0);const u=SuperMap3D.Math.toDegrees(h.longitude),p=SuperMap3D.Math.toDegrees(h.latitude),d=h.height;r=xe({lng:u,lat:p,alt:d})}}const a=e.terrainProvider instanceof sn;if(!n&&!a){const i=e.scene.camera.getPickRay(c);if(!i)return!1;r=e.scene.globe.pick(i,e.scene),o=!0}if(!n&&!o&&a&&(r=e.scene.camera.pickEllipsoid(c,e.scene.globe.ellipsoid)),r){const i=be(r);return i.alt<0&&(r=xe(i,.1)),r}return!1}const{defaultValue:mt,Cartesian3:K,Resource:ne,TextureWrap:Oe,TextureMagnificationFilter:kt,TextureMinificationFilter:Bt,PixelDatatype:_t,PixelFormat:$t,Texture:Xt,Sampler:jt,CubeMap:ln,Event:Yt,Matrix3:Te,Matrix4:vt,DeveloperError:wt}=SuperMap3D,hn=new vt,un=new Te,Zt=[134,22,135,150,246,214,150,54];class pn{constructor(e,t,r,n){this.scene=e,this.ldrUrl=mt(t,void 0),this.brdfUrl=mt(r,"./data/brdf.png"),this.level=mt(n,0),this.envMap=void 0,this.brdfMap=void 0,this.spherical=void 0,this.referenceFrameMatrix=Te.clone(Te.IDENTITY),this.isReady=!1,this.loadEvent=new Yt,this.updateEvent=new Yt,this.init()}init(){if(this.ldrUrl)ne.createIfNeeded(this.ldrUrl).fetchArrayBuffer().then(e=>{const t=new Uint8Array(e),r=this.GetEnvInfo(t),n=this.CreateImageDataArrayBufferViews(t,r);this.spherical={x:new K(...r.irradiance.x),y:new K(...r.irradiance.y),z:new K(...r.irradiance.z),xx:new K(...r.irradiance.xx),yy:new K(...r.irradiance.yy),zz:new K(...r.irradiance.zz),yz:new K(...r.irradiance.yz),zx:new K(...r.irradiance.zx),xy:new K(...r.irradiance.xy)};const o=this.level,a=this.generateImage(n[o][0]),i=this.generateImage(n[o][1]),s=this.generateImage(n[o][2]),l=this.generateImage(n[o][3]),h=this.generateImage(n[o][4]),u=this.generateImage(n[o][5]),p={flipY:!1,skipColorSpaceConversion:!1,preferImageBitmap:!1},d=[ne.createIfNeeded(a).fetchImage(p),ne.createIfNeeded(i).fetchImage(p),ne.createIfNeeded(s).fetchImage(p),ne.createIfNeeded(l).fetchImage(p),ne.createIfNeeded(h).fetchImage(p),ne.createIfNeeded(u).fetchImage(p)];Promise.all(d).then(f=>lt(this,null,function*(){const _=yield this.getRotateImage(f[1].width,f[1].height,3,[f[1],-f[1].width,0,f[1].width,f[1].height]),g=yield this.getRotateImage(f[0].width,f[0].height,1,[f[0],0,-f[0].height,f[0].width,f[0].height]),C=yield this.getRotateImage(f[5].width,f[5].height,2,[f[5],0,0,-f[5].width,-f[5].height]),b=yield this.getRotateImage(f[3].width,f[3].height,2,[f[3],0,0,-f[3].width,-f[3].height]);this.envMap=new ln({context:this.scene.context,flipY:!0,pixelDatatype:_t.HALF_FLOAT,source:{positiveX:g,negativeX:_,positiveY:C,negativeY:f[4],positiveZ:f[2],negativeZ:b}});const D=new Image;D.onload=()=>{this.brdfMap=new Xt({context:this.scene.context,source:D,pixelFormat:$t.RGBA,pixelDatatype:_t.UNSIGNED_BYTE,flipY:!1,sampler:new jt({wrapS:Oe.CLAMP_TO_EDGE,wrapT:Oe.CLAMP_TO_EDGE,minificationFilter:Bt.LINEAR,magnificationFilter:kt.LINEAR})}),this.isReady=!0,this.loadEvent.raiseEvent(this)},D.src=this.brdfUrl}))});else{const e=new Image;e.onload=()=>{this.brdfMap=new Xt({context:this.scene.context,source:e,pixelFormat:$t.RGBA,pixelDatatype:_t.UNSIGNED_BYTE,flipY:!1,sampler:new jt({wrapS:Oe.CLAMP_TO_EDGE,wrapT:Oe.CLAMP_TO_EDGE,minificationFilter:Bt.LINEAR,magnificationFilter:kt.LINEAR})}),this.isReady=!0,this.loadEvent.raiseEvent(this)},e.src=this.brdfUrl}}generateImage(e){return URL.createObjectURL(new Blob([e],{type:"image/png"}))}getRotateImage(e,t,r,n){return lt(this,null,function*(){const o=document.createElement("canvas"),a=o.getContext("2d");return o.width=e,o.height=t,a.rotate(r*90*Math.PI/180),a.drawImage(...n),yield ne.fetchImage(o.toDataURL("image/png"))})}setModelMatrix(e){this.modelMatrix=e}update(e){this.modelMatrix&&(this.updateReferenceFrameMatrix(e),this.updateEvent.raiseEvent(this))}updateReferenceFrameMatrix(e){let t=un,r=hn;r=vt.multiply(e.context.uniformState.view3D,this.modelMatrix,r),t=vt.getMatrix3(r,t),t=Te.getRotation(t,t),this.referenceFrameMatrix=Te.transpose(t,this.referenceFrameMatrix)}GetEnvInfo(e){const t=new DataView(e.buffer,e.byteOffset,e.byteLength);let r=0;for(let i=0;i<Zt.length;i++)if(t.getUint8(r++)!==Zt[i])throw new wt("Not a environment map");let n="",o=0;for(;o=t.getUint8(r++);)n+=String.fromCharCode(o);const a=JSON.parse(n);return a.specular&&(a.specular.specularDataPosition=r,a.specular.lodGenerationScale=a.specular.lodGenerationScale||.8),a}CreateImageDataArrayBufferViews(e,t){if(t.version!==1)throw new wt(`Unsupported environment map version "${t.version}"`);const r=t.specular;let n=Math.log(t.width)*Math.LOG2E;if(n=Math.round(n)+1,r.mipmaps.length!==6*n)throw new wt(`Unsupported specular mipmaps number "${r.mipmaps.length}"`);const o=new Array(n);for(let a=0;a<n;a++){o[a]=new Array(6);for(let i=0;i<6;i++){const s=r.mipmaps[a*6+i];o[a][i]=new Uint8Array(e.buffer,e.byteOffset+r.specularDataPosition+s.position,s.length)}}return o}isDestroyed(){return!1}}const{buildModuleUrl:gt,Cartesian3:V,Cartographic:fn,createGuid:dn,defaultValue:S,destroyObject:mn,Ellipsoid:ie,Event:_n,HeadingPitchRange:Kt,HeadingPitchRoll:vn,Matrix4:Ee,ScreenSpaceEventHandler:wn,ScreenSpaceEventType:Ge,Transforms:Ae,Model:gn,ModelAnimationLoop:qt}=SuperMap3D;class xn{constructor(e,t={}){if(!e)return console.warn("viewer 没有被定义 "),!1;this.id=dn(),this._viewer=e,this.mode=S(t.mode,1),this.show=S(t.show,!1),this.lockView=S(t.lockView,!1),this.animation=S(t.animation,!0),this.viewPitch=S(t.viewPitch,Cesium.Math.toRadians(-14)),this.viewDistance=S(t.viewDistance,400),this.offsetHeight=S(t.offsetHeight,0),this.customHeight=S(t.customHeight,void 0),this.viewHeading=S(t.viewHeading,Cesium.Math.toRadians(90)),this.reflectivity=S(t.reflectivity,.5),this.modelShow=S(t.modelShow,!0),this.mode===1?(this.position=S(t.position,V.fromDegrees(116.3915,39.9062,50)),this.npcMinSpeed=S(t.npcMinSpeed,3),this.npcMaxSpeed=S(t.npcMaxSpeed,6),this.npcHeadingRadian=S(t.npcHeadingRadian,Cesium.Math.toRadians(.8)),this.modelUrl=S(t.modelUrl,gt("Assets/Data/model/npc.glb")),this.scale=S(t.scale,.1)):this.mode===2?(this.position=S(t.position,V.fromDegrees(116.3915,39.9062,8e3)),this.npcMinSpeed=S(t.npcMinSpeed,10),this.npcMaxSpeed=S(t.npcMaxSpeed,50),this.npcHeadingRadian=S(t.npcHeadingRadian,Cesium.Math.toRadians(.1)),this.modelUrl=S(t.modelUrl,gt("Assets/Data/model/plane.glb")),this.scale=S(t.scale,.2)):this.mode===3&&(this.position=S(t.position,V.fromDegrees(118.2607,38.4817,10)),this.npcMinSpeed=S(t.npcMinSpeed,10),this.npcMaxSpeed=S(t.npcMaxSpeed,20),this.npcHeadingRadian=S(t.npcHeadingRadian,Cesium.Math.toRadians(.3)),this.modelUrl=S(t.modelUrl,gt("Assets/Data/model/ship.glb")),this.scale=S(t.scale,60),this.viewPitch=S(t.viewPitch,Cesium.Math.toRadians(-15)),this.viewDistance=S(t.viewDistance,1e3),this._viewer.scene.globe.m3d_windVector=new V(0,0,.5)),this.lastPosition=V.ZERO,this.npcPitchRadian=S(t.npcPitchRadian,Cesium.Math.toRadians(15)),this.npcRollRadian=S(t.npcRollRadian,Cesium.Math.toRadians(25)),this.npcHeightStep=S(t.npcHeightStep,5),this.npcModelMatrix=Ae.eastNorthUpToFixedFrame(this.position),this.npcSpeed=S(t.npcSpeed,this.npcMinSpeed),this.npcHpr=new vn,this.npcSpeedVector=new V,this.npcFlag={moveUp:!1,moveDown:!1,moveLeft:!1,moveRight:!1,jump:!1},this.npcHitState=!1,this.npcHitEnable=!1,this.npcHitHeight=5,this.npcHitStep=15,this._npcFleetEnable=!1,this.transform=new Ee,this.jobCameraHeading=S(t.viewHeading,Cesium.Math.toRadians(90)),this.jobCameraPitch=S(t.viewPitch,Cesium.Math.toRadians(-14)),this.jobCamerad=this._viewer.scene.camera.pitch,this.jobCameraDistance=100;let r=!1,n=null;const o=new wn(this._viewer.scene.canvas);o.setInputAction(a=>{r=!0,n=a.position.clone()},Ge.LEFT_DOWN),o.setInputAction(a=>{if(!r||this.lockView)return;const i=a.endPosition.x-n.x,s=a.endPosition.y-n.y;i===0&&s===0||(this.jobCameraHeading+=i*.005,this.jobCameraPitch-=s*.005,this.jobCameraPitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,this.jobCameraPitch)),this.m3dNPC&&(this.npcHpr.heading=this.jobCameraHeading-Cesium.Math.toRadians(90),this.m3dNPC.modelMatrix=Ae.headingPitchRollToFixedFrame(this.position,this.npcHpr,ie.WGS84)),n=a.endPosition.clone())},Ge.MOUSE_MOVE),o.setInputAction(()=>{r=!1},Ge.LEFT_UP),o.setInputAction(a=>{const i=a;this.jobCameraDistance-=i*.1,this.jobCameraDistance=Math.max(5,Math.min(2e4,this.jobCameraDistance))},Ge.WHEEL),this._updatePositon=new _n,this.init()}get npcFleetEnable(){return this._npcFleetEnable}set npcFleetEnable(e){this._npcFleetEnable=e}init(){return lt(this,null,function*(){this._viewer.clock.shouldAnimate=!0,this.m3dNPC=yield gn.fromGltfAsync({show:this.modelShow,url:this.modelUrl,modelMatrix:this.npcModelMatrix,scale:this.scale,minimumPixelSize:60,maximumScale:128,reflectivity:this.reflectivity}),this.mode===1?this.setNpcAnimation(8):this.mode===2?this.setNpcAnimation(0):this.mode===3&&this.setNpcAnimation(0);let e=null,t=!1;this.onKeydown=r=>{this.show&&((r.keyCode===87||r.keyCode===83)&&(new Date().getTime()-e<100?(this.mode===1?this.setNpcAnimation(3):this.mode===2?this.setNpcAnimation(0,2):this.mode===3&&this.setNpcAnimation(0,3),this.npcSpeed=this.npcMaxSpeed,t=!0):!t&&this.currentAnimationIndex!==2&&(this.mode===1?this.setNpcAnimation(2):this.mode===2?this.setNpcAnimation(0):this.mode===3&&this.setNpcAnimation(0,2),this.npcSpeed=this.npcMinSpeed)),this.setNpcStatus(r,!0))},this.onKeyup=r=>{this.show&&((r.keyCode===87||r.keyCode===83)&&(e=new Date().getTime(),t&&(t=!1),this.mode===1?this.setNpcAnimation(8):this.mode===2?this.setNpcAnimation(0):this.mode===3&&this.setNpcAnimation(0)),this.setNpcStatus(r,!1))},document.addEventListener("keydown",this.onKeydown),document.addEventListener("keyup",this.onKeyup),this._viewer.scene.preUpdate.addEventListener(()=>{if(this.npcHitEnable&&this.currentCartographic&&(this.npcFlag.moveUp||this.npcFlag.moveDown)){const r=this._viewer.scene.sampleHeight(this.currentCartographic,[this.m3dNPC]);Math.abs(r-this.globeHeight)>this.npcHitHeight?(this.npcSpeed=this.npcFlag.moveUp?-this.npcMinSpeed:this.npcMinSpeed,this.npcSpeedVector=V.multiplyByScalar(V.UNIT_X,this.npcSpeed*this.npcHitStep,this.npcSpeedVector),this.position=Ee.multiplyByPoint(this.m3dNPC.modelMatrix,this.npcSpeedVector,this.position),this.currentCartographic=ie.WGS84.cartesianToCartographic(this.position),this.globeHeight=this._viewer.scene.globe.getHeight(this.currentCartographic),this.position=V.fromRadians(this.currentCartographic.longitude,this.currentCartographic.latitude,this.globeHeight+4),this.m3dNPC.modelMatrix=Ae.headingPitchRollToFixedFrame(this.position,this.npcHpr,ie.WGS84),this.npcHitState=!0):this.npcHitState=!1}})})}setNpcAnimation(e,t=1){if(!this.animation||!this.m3dNPC)return!1;if(this.currentAnimationIndex=e,this.m3dNPC.activeAnimations._runtimeAnimations.length>0){this.m3dNPC.activeAnimations.add({multiplier:t,index:this.currentAnimationIndex,loop:qt.REPEAT});return}this.m3dNPC.readyEvent.addEventListener(()=>{this.m3dNPC.activeAnimations.add({multiplier:t,index:this.currentAnimationIndex,loop:qt.REPEAT})})}setNpcStatus(e,t){if(this.show)switch(e.keyCode){case 8:this.npcFlag.jump=t;break;case 87:this.npcFlag.moveUp=t;break;case 65:this.npcFlag.moveLeft=t;break;case 68:this.npcFlag.moveRight=t;break;case 83:this.npcFlag.moveDown=t;break}}updateModelMatrix(e,t){this.npcHitEnable&&this.npcHitState||(e>0?this.npcSpeedVector=V.multiplyByScalar(V.UNIT_X,this.npcSpeed,this.npcSpeedVector):this.npcSpeedVector=V.multiplyByScalar(V.UNIT_X,-this.npcSpeed,this.npcSpeedVector),this.position=Ee.multiplyByPoint(this.m3dNPC.modelMatrix,this.npcSpeedVector,this.position),this.currentCartographic=ie.WGS84.cartesianToCartographic(this.position),this.globeHeight=this.customHeight,this.customHeight||(this.globeHeight=t.globe.getHeight(this.currentCartographic)),this.position=V.fromRadians(this.currentCartographic.longitude,this.currentCartographic.latitude,this.globeHeight+4),this.m3dNPC.modelMatrix=Ae.headingPitchRollToFixedFrame(this.position,this.npcHpr,ie.WGS84))}updateModeView1(e){this.npcFlag.moveUp?(this.npcFlag.moveLeft&&(this.npcHpr.heading-=this.npcHeadingRadian,this.jobCameraHeading-=this.npcHeadingRadian),this.npcFlag.moveRight&&(this.npcHpr.heading+=this.npcHeadingRadian,this.jobCameraHeading+=this.npcHeadingRadian),this.updateModelMatrix(!0,e)):this.npcFlag.moveDown&&(this.npcFlag.moveLeft&&(this.npcHpr.heading-=this.npcHeadingRadian,this.jobCameraHeading-=this.npcHeadingRadian),this.npcFlag.moveRight&&(this.npcHpr.heading+=this.npcHeadingRadian,this.jobCameraHeading+=this.npcHeadingRadian),this.updateModelMatrix(!1,e))}updateModeView2(e){this.npcSpeedVector=V.multiplyByScalar(V.UNIT_X,this.npcSpeed,this.npcSpeedVector),this.position=Ee.multiplyByPoint(this.m3dNPC.modelMatrix,this.npcSpeedVector,this.position);const t=ie.WGS84.cartesianToCartographic(this.position);this.npcHpr.roll=0,this.npcHpr.pitch=0,this.npcFlag.moveLeft&&(this.npcHpr.heading-=this.npcHeadingRadian,this.npcHpr.roll=-this.npcRollRadian),this.npcFlag.moveRight&&(this.npcHpr.heading+=this.npcHeadingRadian,this.npcHpr.roll=this.npcRollRadian),this.npcFlag.moveUp&&(t.height+=this.npcHeightStep,this.npcHpr.pitch=this.npcPitchRadian),this.npcFlag.moveDown&&(t.height-=this.npcHeightStep,this.npcHpr.pitch=-this.npcPitchRadian),this._updatePositon.raiseEvent(t),this.m3dNPC.modelMatrix=Ae.headingPitchRollToFixedFrame(fn.toCartesian(t),this.npcHpr,ie.WGS84)}onZoomCamera(){this._viewer.camera&&(this.jobCameraDistance=V.distance(this.position,this._viewer.camera.positionWC))}updateCamera(){this._viewer.camera&&(this.jobCameraHeading=this._viewer.camera.heading,this.jobCameraPitch=this._viewer.camera.pitch,this.jobCameraDistance=V.distance(this.position,this._viewer.camera.positionWC))}update(e){if(!this.show||!this.m3dNPC)return!1;this._viewer.clock.shouldAnimate=!0;const t=e.camera,r=t._scene;if(this.mode===1?this.updateModeView1(r):this.mode===2?this.updateModeView2(r):this.mode===3&&this.updateModeView1(r),this.position){const n=ie.WGS84.cartesianToCartographic(this.position),o=V.fromRadians(n.longitude,n.latitude,n.height+this.offsetHeight);this.lockView?t.lookAt(o,new Kt(this.npcHpr.heading+this.viewHeading,this.viewPitch,this.viewDistance)):t.lookAt(o,new Kt(this.jobCameraHeading,this.jobCameraPitch,this.jobCameraDistance)),t.lookAtTransform(Ee.IDENTITY),this.lastPosition=this.position.clone(),this._updatePositon.raiseEvent(n)}this.m3dNPC.update(e)}isDestroyed(){return!1}destroy(){return this.show=!1,this.npcHitEnable=!1,document.removeEventListener("keydown",this.onKeydown),document.removeEventListener("keyup",this.onKeyup),this.m3dNPC=this.m3dNPC&&this.m3dNPC.destroy(),this._viewer.clock.shouldAnimate=!1,mn(this)}}var yn=`in vec3 position;\r
out vec3 v_texCoord;\r
uniform mat3 u_rotateMatrix;\r
void main()\r
{\r
    vec3 p = czm_viewRotation * u_rotateMatrix * (czm_temeToPseudoFixed * (czm_entireFrustum.y * position));\r
    gl_Position = czm_projection * vec4(p, 1.0);\r
    v_texCoord = position.xyz;\r
}`,Sn=`uniform samplerCube u_cubeMap;\r
in vec3 v_texCoord;

void main()\r
{\r
    vec4 color = texture(u_cubeMap, normalize(v_texCoord));\r
    out_FragColor = vec4(czm_gammaCorrect(color).rgb, czm_morphTime);\r
}`;const{BoxGeometry:Qt,Cartesian3:Cn,defaultValue:Jt,defined:k,destroyObject:Dn,DeveloperError:er,GeometryPipeline:Pn,Matrix3:tr,Matrix4:ae,Transforms:Mn,VertexFormat:bn,BufferUsage:Tn,CubeMap:En,DrawCommand:An,loadCubeMap:In,RenderState:Vn,VertexArray:zn,BlendingState:Ln,SceneMode:rr,ShaderProgram:Rn,ShaderSource:Wn}=SuperMap3D;k(ae.getRotation)||(ae.getRotation=ae.getMatrix3);const Hn=new tr;let Nn=class{constructor(e){this.sources=e.sources,this._sources=void 0,this.show=Jt(e.show,!0),this.speed=Jt(e.speed,0),this._command=new An({modelMatrix:ae.clone(ae.IDENTITY),owner:this}),this._cubeMap=void 0,this._attributeLocations=void 0,this._useHdr=void 0}update(e,t){var r=this;if(!this.show||e.mode!==rr.SCENE3D&&e.mode!==rr.MORPHING||!e.passes.render)return;const n=e.context;if(this._sources!==this.sources){this._sources=this.sources;const a=this.sources;if(!k(a.positiveX)||!k(a.negativeX)||!k(a.positiveY)||!k(a.negativeY)||!k(a.positiveZ)||!k(a.negativeZ))throw new er("this.sources is required and must have positiveX, negativeX, positiveY, negativeY, positiveZ, and negativeZ properties.");if(typeof a.positiveX!=typeof a.negativeX||typeof a.positiveX!=typeof a.positiveY||typeof a.positiveX!=typeof a.negativeY||typeof a.positiveX!=typeof a.positiveZ||typeof a.positiveX!=typeof a.negativeZ)throw new er("this.sources properties must all be the same type.");typeof a.positiveX=="string"?In(n,this._sources).then(function(i){r._cubeMap=r._cubeMap&&r._cubeMap.destroy(),r._cubeMap=i}):(this._cubeMap=this._cubeMap&&this._cubeMap.destroy(),this._cubeMap=new En({context:n,source:a}))}const o=this._command;if(o.modelMatrix=Mn.eastNorthUpToFixedFrame(e.camera._positionWC),!k(o.vertexArray)){let a=0;o.uniformMap={u_cubeMap:function(){return r._cubeMap},u_rotateMatrix:function(){a+=r.speed;const l=tr.fromRotationZ(SuperMap3D.Math.toRadians(a)),h=ae.fromRotationTranslation(l);return ae.multiply(o.modelMatrix,h,o.modelMatrix),ae.getMatrix3(o.modelMatrix,Hn)}};const i=Qt.createGeometry(Qt.fromDimensions({dimensions:new Cn(2,2,2),vertexFormat:bn.POSITION_ONLY})),s=this._attributeLocations=Pn.createAttributeLocations(i);o.vertexArray=zn.fromGeometry({context:n,geometry:i,attributeLocations:s,bufferUsage:Tn._DRAW}),o.renderState=Vn.fromCache({blending:Ln.ALPHA_BLEND})}if(!k(o.shaderProgram)||this._useHdr!==t){const a=new Wn({defines:[t?"HDR":""],sources:[Sn]});o.shaderProgram=Rn.fromCache({context:n,vertexShaderSource:yn,fragmentShaderSource:a,attributeLocations:this._attributeLocations}),this._useHdr=t}if(k(this._cubeMap))return o}isDestroyed(){return!1}destroy(){const e=this._command;return e.vertexArray=e.vertexArray&&e.vertexArray.destroy(),e.shaderProgram=e.shaderProgram&&e.shaderProgram.destroy(),this._cubeMap=this._cubeMap&&this._cubeMap.destroy(),Dn(this)}};const{BoxGeometry:nr,Cartesian3:Un,defaultValue:ir,defined:B,destroyObject:Fn,DeveloperError:ar,GeometryPipeline:On,Matrix3:or,Matrix4:oe,Transforms:Gn,VertexFormat:kn,BufferUsage:Bn,CubeMap:$n,DrawCommand:Xn,loadCubeMap:jn,RenderState:Yn,VertexArray:Zn,BlendingState:Kn,SceneMode:sr,ShaderProgram:qn,ShaderSource:Qn}=SuperMap3D;let Jn=`uniform samplerCube u_cubeMap;
            varying vec3 v_texCoord;
            void main()
            {
            vec4 color = textureCube(u_cubeMap, normalize(v_texCoord));
            gl_FragColor = vec4(czm_gammaCorrect(color).rgb, czm_morphTime);
            }
            `,ei=`attribute vec3 position;
            varying vec3 v_texCoord;
            uniform mat3 u_rotateMatrix;
            void main()
            {
            vec3 p = czm_viewRotation * u_rotateMatrix * (czm_temeToPseudoFixed * (czm_entireFrustum.y * position));
            gl_Position = czm_projection * vec4(p, 1.0);
            v_texCoord = position.xyz;
            }
            `;B(oe.getRotation)||(oe.getRotation=oe.getMatrix3);class ti{constructor(e){this.sources=e.sources,this._sources=void 0,this.show=ir(e.show,!0),this.speed=ir(e.speed,0),this._command=new Xn({modelMatrix:oe.clone(oe.IDENTITY),owner:this}),this._cubeMap=void 0,this._attributeLocations=void 0,this._useHdr=void 0}update(e,t){var r=this;if(this.show&&!(e.mode!==sr.SCENE3D&&e.mode!==sr.MORPHING)&&e.passes.render){var n=e.context;if(this._sources!==this.sources){this._sources=this.sources;var o=this.sources;if(!B(o.positiveX)||!B(o.negativeX)||!B(o.positiveY)||!B(o.negativeY)||!B(o.positiveZ)||!B(o.negativeZ))throw new ar("this.sources is required and must have positiveX, negativeX, positiveY, negativeY, positiveZ, and negativeZ properties.");if(typeof o.positiveX!=typeof o.negativeX||typeof o.positiveX!=typeof o.positiveY||typeof o.positiveX!=typeof o.negativeY||typeof o.positiveX!=typeof o.positiveZ||typeof o.positiveX!=typeof o.negativeZ)throw new ar("this.sources properties must all be the same type.");typeof o.positiveX=="string"?jn(n,this._sources).then(function(h){r._cubeMap=r._cubeMap&&r._cubeMap.destroy(),r._cubeMap=h}):(this._cubeMap=this._cubeMap&&this._cubeMap.destroy(),this._cubeMap=new $n({context:n,source:o}))}var a=this._command;if(a.modelMatrix=Gn.eastNorthUpToFixedFrame(e.camera._positionWC),!B(a.vertexArray)){let h=0;a.uniformMap={u_cubeMap:function(){return r._cubeMap},u_rotateMatrix:function(){h+=r.speed;const u=or.fromRotationZ(SuperMap3D.Math.toRadians(h)),p=oe.fromRotationTranslation(u);return oe.multiply(a.modelMatrix,p,a.modelMatrix),oe.getMatrix3(a.modelMatrix,ri)}};var i=nr.createGeometry(nr.fromDimensions({dimensions:new Un(2,2,2),vertexFormat:kn.POSITION_ONLY})),s=this._attributeLocations=On.createAttributeLocations(i);a.vertexArray=Zn.fromGeometry({context:n,geometry:i,attributeLocations:s,bufferUsage:Bn._DRAW}),a.renderState=Yn.fromCache({blending:Kn.ALPHA_BLEND})}if(!B(a.shaderProgram)||this._useHdr!==t){var l=new Qn({defines:[t?"HDR":""],sources:[Jn]});a.shaderProgram=qn.fromCache({context:n,vertexShaderSource:ei,fragmentShaderSource:l,attributeLocations:this._attributeLocations}),this._useHdr=t}if(B(this._cubeMap))return a}}isDestroyed(){return!1}destroy(){var e=this._command;return e.vertexArray=e.vertexArray&&e.vertexArray.destroy(),e.shaderProgram=e.shaderProgram&&e.shaderProgram.destroy(),this._cubeMap=this._cubeMap&&this._cubeMap.destroy(),Fn(this)}}var ri=new or;const ni=`
        precision highp float;
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform vec4 customParam;
        varying  vec2 v_textureCoordinates;
        const float PI = 3.14159265359;
        const float TWO_PI = PI * 2.0;
        const float FOUR_PI = PI * 4.0;
        const vec3 betaR = vec3(5.5e-6, 13.0e-6, 22.4e-6); // Rayleigh 
        const vec3 betaM = vec3(21e-6); // Mie
        const float hR = 10e3;
        const float hM = 3.8e3;
        const float earth_radius = 6360e3; // (m)
        const float atmosphere_radius = 6420e3; // (m)
        const int num_samples = 16;
        const int num_samples_light = 4;
        vec3 sun_dir = vec3(0, 0, 0);
        #ifdef GL_ES
            #define _in(T) const in T
            #define _inout(T) inout T
            #define _out(T) out T
            #define _begin(type) type (
            #define _end )
            #define mul(a, b) (a) * (b)
        #endif
        struct ray_t {
            vec3 origin;
            vec3 direction;
        };
        struct sphere_t {
            vec3 origin;
            float radius;
            int material;
        };
        struct plane_t {
            vec3 direction;
            float distance;
            int material;
        };
        plane_t plane;
        mat3 rotate_around_x(_in(float) angle_degrees) {
            float angle = radians(angle_degrees);
            float _sin = sin(angle);
            float _cos = cos(angle);
            return mat3(1, 0, 0, 0, _cos, -_sin, 0, _sin, _cos);
        }
        bool isect_sphere(_in(ray_t) ray, _in(sphere_t) sphere, _inout(float) t0, _inout(float) t1) {
            vec3 rc = sphere.origin - ray.origin;
            float radius2 = sphere.radius * sphere.radius;
            float tca = dot(rc, ray.direction);
            float d2 = dot(rc, rc) - tca * tca;
            if (d2 > radius2) return false;
            float thc = sqrt(radius2 - d2);
            t0 = tca - thc;
            t1 = tca + thc;
            return true;
        }
        float rayleigh_phase_func(float mu) {
            return
            3. * (1. + mu*mu)
            / 
            (16. * PI);
        }
        const float g = 0.76;
        float henyey_greenstein_phase_func(float mu) {
            return
            (1. - g*g)
            / 
            ((4. * PI) * pow(1. + g*g - 2.*g*mu, 1.5));
        }
        const float k = 1.55*g - 0.55 * (g*g*g);
        float schlick_phase_func(float mu) {
            return
            (1. - k*k)
            / 
            (4. * PI * (1. + k*mu) * (1. + k*mu));
        }
        const sphere_t atmosphere = _begin(sphere_t)
        vec3(0, 0, 0), atmosphere_radius, 0
        _end;
        bool get_sun_light(
        _in(ray_t) ray, _inout(float) optical_depthR, _inout(float) optical_depthM
        ) {
            float t0, t1;
            isect_sphere(ray, atmosphere, t0, t1);
            float march_pos = 0.;
            float march_step = t1 / float(num_samples_light);
            for (int i = 0; i < num_samples_light; i++) {
                vec3 s = ray.origin +
                ray.direction * (march_pos + 0.5 * march_step);
                float height = length(s) - earth_radius;
                if (height < 0.)
                return false;
                optical_depthR += exp(-height / hR) * march_step;
                optical_depthM += exp(-height / hM) * march_step;
                march_pos += march_step;
            }
            return true;
        }
        vec4 get_incident_light(_in(ray_t) ray) {
            vec3 dir = ray.direction;
            vec3 start = ray.origin;
            float a = dot( dir, dir);
            float b = 2.0 * dot(dir, start);
            float radius2 = atmosphere.radius * atmosphere.radius;
            float c = dot(start, start) - radius2;
            float d = (b * b) - 4.0 * a * c;
            if (d < 0.0) return vec4(0.0);
            float squaredD = sqrt(d);
            vec2 ray_length = vec2(
            max((-b - squaredD) / (2.0 * a), 0.0), min((-b + squaredD) / (2.0 * a), plane.distance)
            );
            if (ray_length.x > ray_length.y) return vec4(0.0);
            float march_step = (ray_length.y - ray_length.x) / float(num_samples);
            float mu = dot(ray.direction, sun_dir);
            float phaseR = rayleigh_phase_func(mu);
            float phaseM = 
            #if 1
                henyey_greenstein_phase_func(mu);
            #else
                schlick_phase_func(mu);
            #endif
            
            float optical_depthR = 0.;
            float optical_depthM = 0.;
            vec3 sumR = vec3(0);
            vec3 sumM = vec3(0);
            float march_pos = 0.;
            for (int i = 0; i < num_samples; i++) {
                vec3 s = ray.origin +
                ray.direction * (march_pos + 0.5 * march_step);
                float height = length(s) - earth_radius;
                float hr = exp(-height / hR) * march_step;
                float hm = exp(-height / hM) * march_step;
                optical_depthR += hr;
                optical_depthM += hm;
                ray_t light_ray = _begin(ray_t)
                s, sun_dir
                _end;
                float optical_depth_lightR = 0.;
                float optical_depth_lightM = 0.;
                bool overground = get_sun_light(
                    light_ray,
                    optical_depth_lightR,
                    optical_depth_lightM);
    
                if (overground) {
                    vec3 tau =
                        betaR * (optical_depthR + optical_depth_lightR) +
                        betaM * 1.1 * (optical_depthM + optical_depth_lightM);
                    vec3 attenuation = exp(-tau);
    
                    sumR += hr * attenuation;
                    sumM += hm * attenuation;
                }
    
                march_pos += march_step;
            }
            float opacity = length(exp(-((betaM * optical_depthM)
            + (betaR * optical_depthR)) * customParam.y));
            return vec4(
            customParam.z *
            (sumR * phaseR * betaR +
            sumM * phaseM * betaM), 1.0-opacity);
        }
         
        void main() {

            vec4 color = texture(colorTexture, v_textureCoordinates);
            vec4 rawDepthColor = texture(depthTexture, v_textureCoordinates);
            float depth = czm_unpackDepth(rawDepthColor);
            vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
            vec4 worldCoordinate = czm_inverseView * positionEC;
            vec3 vWorldPosition = worldCoordinate.xyz / worldCoordinate.w;

            vec3 posToEye = vWorldPosition - czm_viewerPositionWC;
            vec3 direction = normalize(posToEye);
            vec3 lightDirection = normalize(czm_sunPositionWC);
            float distance = length(posToEye);

            // atmosphere scattering
            sun_dir = lightDirection;
            ray_t ray;
            ray.origin = czm_viewerPositionWC;
            ray.direction = direction;
            plane.distance = distance;
            vec4 atmosphereColor = get_incident_light(ray);
            color = atmosphereColor + color * (1.0 - atmosphereColor.a);

            float exposure = customParam.w;
            color = vec4(1.0 - exp(-exposure * color));

            out_FragColor = color;
        }      
    `;function ii(){return new SuperMap3D.PostProcessStage({fragmentShader:ni,uniforms:{customParam:new SuperMap3D.Cartesian4(25e4,10,80,2.5)}})}const ai=`
        precision highp float;
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform vec4 customParam;
        varying vec2 v_textureCoordinates;
        const float PI = 3.14159265359;
        const float TWO_PI = PI * 2.0;
        const float FOUR_PI = PI * 4.0;
        const vec3 betaR = vec3(5.5e-6, 13.0e-6, 22.4e-6); // Rayleigh 
        const vec3 betaM = vec3(21e-6); // Mie
        const float hR = 10e3;
        const float hM = 3.8e3;
        const float earth_radius = 6360e3; // (m)
        const float atmosphere_radius = 6420e3; // (m)
        const int num_samples = 16;
        const int num_samples_light = 4;
        vec3 sun_dir = vec3(0, 0, 0);

        #define _in(T) const in T
        #define _inout(T) inout T
        #define _out(T) out T
        #define _begin(type) type (
        #define _end )
        #define mul(a, b) (a) * (b)

        struct ray_t {
            vec3 origin;
            vec3 direction;
        };
        struct sphere_t {
            vec3 origin;
            float radius;
            int material;
        };
        struct plane_t {
            vec3 direction;
            float distance;
            int material;
        };
        plane_t plane;
        bool isect_sphere(_in(ray_t) ray, _in(sphere_t) sphere, _inout(float) t0, _inout(float) t1) {
            vec3 rc = sphere.origin - ray.origin;
            float radius2 = sphere.radius * sphere.radius;
            float tca = dot(rc, ray.direction);
            float d2 = dot(rc, rc) - tca * tca;
            if (d2 > radius2) return false;
            float thc = sqrt(radius2 - d2);
            t0 = tca - thc;
            t1 = tca + thc;
            return true;
        }
        float rayleigh_phase_func(float mu) {
            return
            3. * (1. + mu*mu)
            / 
            (16. * PI);
        }
        const float g = 0.76;
        float henyey_greenstein_phase_func(float mu) {
            return
            (1. - g*g)
            / 
            ((4. * PI) * pow(1. + g*g - 2.*g*mu, 1.5));
        }
        const float k = 1.55*g - 0.55 * (g*g*g);
        float schlick_phase_func(float mu) {
            return
            (1. - k*k)
            / 
            (4. * PI * (1. + k*mu) * (1. + k*mu));
        }
        const sphere_t atmosphere = _begin(sphere_t)
        vec3(0, 0, 0), atmosphere_radius, 0
        _end;
        bool get_sun_light(
        _in(ray_t) ray, _inout(float) optical_depthR, _inout(float) optical_depthM
        ) {
            float t0, t1;
            isect_sphere(ray, atmosphere, t0, t1);
            float march_pos = 0.;
            float march_step = t1 / float(num_samples_light);
            for (int i = 0; i < num_samples_light; i++) {
                vec3 s = ray.origin +
                ray.direction * (march_pos + 0.5 * march_step);
                float height = length(s) - earth_radius;
                if (height < 0.)
                return false;
                optical_depthR += exp(-height / hR) * march_step;
                optical_depthM += exp(-height / hM) * march_step;
                march_pos += march_step;
            }
            return true;
        }
        vec4 get_incident_light(_in(ray_t) ray) {
            vec3 dir = ray.direction;
            vec3 start = ray.origin;
            float a = dot( dir, dir);
            float b = 2.0 * dot(dir, start);
            float radius2 = atmosphere.radius * atmosphere.radius;
            float c = dot(start, start) - radius2;
            float d = (b * b) - 4.0 * a * c;
            if (d < 0.0) return vec4(0.0);
            float squaredD = sqrt(d);
            vec2 ray_length = vec2(
            max((-b - squaredD) / (2.0 * a), 0.0), min((-b + squaredD) / (2.0 * a), plane.distance)
            );
            if (ray_length.x > ray_length.y) return vec4(0.0);
            float march_step = (ray_length.y - ray_length.x) / float(num_samples);
            float mu = dot(ray.direction, sun_dir);
            float phaseR = rayleigh_phase_func(mu);
            float phaseM = 
            #if 1
                henyey_greenstein_phase_func(mu);
            #else
                schlick_phase_func(mu);
            #endif
            
            float optical_depthR = 0.;
            float optical_depthM = 0.;
            vec3 sumR = vec3(0);
            vec3 sumM = vec3(0);
            float march_pos = 0.;
            for (int i = 0; i < num_samples; i++) {
                vec3 s = ray.origin +
                ray.direction * (march_pos + 0.5 * march_step);
                float height = length(s) - earth_radius;
                float hr = exp(-height / hR) * march_step;
                float hm = exp(-height / hM) * march_step;
                optical_depthR += hr;
                optical_depthM += hm;
                ray_t light_ray = _begin(ray_t)
                s, sun_dir
                _end;
                float optical_depth_lightR = 0.;
                float optical_depth_lightM = 0.;
                bool overground = get_sun_light(
                    light_ray,
                    optical_depth_lightR,
                    optical_depth_lightM);
    
                if (overground) {
                    vec3 tau =
                        betaR * (optical_depthR + optical_depth_lightR) +
                        betaM * 1.1 * (optical_depthM + optical_depth_lightM);
                    vec3 attenuation = exp(-tau);
    
                    sumR += hr * attenuation;
                    sumM += hm * attenuation;
                }
    
                march_pos += march_step;
            }
            float opacity = length(exp(-((betaM * optical_depthM)
            + (betaR * optical_depthR)) * customParam.y));
            return vec4(
            customParam.z *
            (sumR * phaseR * betaR +
            sumM * phaseM * betaM), 1.0-opacity);
        }
         
        void main() {

            vec4 color = texture2D(colorTexture, v_textureCoordinates);
            vec4 rawDepthColor = texture2D(depthTexture, v_textureCoordinates);
            float depth = czm_unpackDepth(rawDepthColor);
            vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
            vec4 worldCoordinate = czm_inverseView * positionEC;
            vec3 vWorldPosition = worldCoordinate.xyz / worldCoordinate.w;

            vec3 posToEye = vWorldPosition - czm_viewerPositionWC;
            vec3 direction = normalize(posToEye);
            vec3 lightDirection = normalize(czm_sunPositionWC);
            float distance = length(posToEye);

            // atmosphere scattering
            sun_dir = lightDirection;
            ray_t ray;
            ray.origin = czm_viewerPositionWC;
            ray.direction = direction;
            plane.distance = distance;
            vec4 atmosphereColor = get_incident_light(ray);
            color = atmosphereColor + color * (1.0 - atmosphereColor.a);

            float exposure = customParam.w;
            color = vec4(1.0 - exp(-exposure * color));

            gl_FragColor = color;
        }      
    `;function oi(){return new SuperMap3D.PostProcessStage({fragmentShader:ai,uniforms:{customParam:new SuperMap3D.Cartesian4(25e4,4,23,2.2)}})}var si=`precision highp float;\r
precision highp sampler2D;\r
#define M3D_GBUFFER_WATER\r
varying vec3 v_positionWC;\r
varying vec3 v_eye;\r
varying vec4 v_position;\r
uniform vec4 baseColor;\r
uniform sampler2D normalTexture;\r
uniform sampler2D globeDepthTexture;\r
uniform sampler2D refractTexture;\r
uniform sampler2D reflectTexture;\r
uniform float u_WaterDepth;\r
uniform vec4 u_WaterShallowColor;\r
uniform float u_WaterShallowColorAlpha;\r
uniform vec4 u_WaterDeepColor;\r
uniform float u_WaterDeepColorAlpha;\r
uniform vec4 u_HorizonColor;\r
uniform float u_HorizonDistance;\r
uniform vec4 u_causticColor;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
uniform mat3 inverseViewRotation;\r
#ifdef IS_MASKMAP\r
uniform sampler2D maskTexture;\r
#endif\r
#ifdef IS_RIVERMASKMAP\r
varying vec2 v_st2;\r
uniform sampler2D riverMaskTexture;\r
#endif\r
#define saturate(x)    clamp(x, 0.0, 1.0)\r
#define frac(v)    v - floor(v)\r
uniform float shiny;\r
uniform float spec;\r
const float diffuse = 0.5;

vec3 lighting_sss(int type, vec3 n, vec3 l, vec3 rd, vec3 kl, vec3 kd, vec3 ks, vec3 ksr, float km, float kn) {\r
    float ndl = dot(n, l); 

    float pndl = clamp( ndl, 0., 1.), 
    nndl = clamp(-ndl, 0., 1.); 

    
    vec3 sss;\r
    

    
    
    
    sss = .2 * exp(-3.*abs(ndl)/(ksr+.001));\r
    vec3 h = normalize(l - rd); 

    float ndh = dot(n, h); 

    
    float g = ndh*ndh * (km*km - 1.) + 1.;\r
    float ggx = km*km / (3.141592*g*g);

    

    float fre = 1.+dot(rd, n); 

    
    float f0 = (kn-1.)/(kn+1.);\r
    f0 = f0*f0;\r
    float kr = f0 + (1.-f0)*(1.-km)*(1.-km) * pow(fre, 5.); 
    return kl*(pndl*(kd + kr*ggx) + kd*ks*ksr*sss); 
}

void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, inout vec3 diffuseColor, inout vec3 specularColor ) {\r
    vec3 reflection = normalize( reflect( -czm_sunDirectionEC, surfaceNormal ) );\r
    float direction = max( 0.0, dot( eyeDirection, reflection ) );\r
    vec3 viewDir = normalize(viewerPositionWC);\r
    vec3 sunDir = normalize(czm_sunPositionWC);\r
    float cosTheta = dot(viewDir, sunDir);\r
    cosTheta = cosTheta < 0. ? 0. : 1.;\r
    specularColor += pow( direction, shiny ) * czm_lightColor * spec * cosTheta;\r
    diffuseColor += max( dot( czm_sunDirectionEC, surfaceNormal ), 0.0 ) * czm_lightColor * diffuse;\r
}\r
float waveFade(float edge0, float edge1, float x)\r
{\r
    float y = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
    return pow(1.0 - y, 5.0);\r
}\r
float linearFade(float edge0, float edge1, float x)\r
{\r
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
}\r
vec3 RGBToHSV(vec3 rgb) {\r
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\r
    vec4 P = mix(vec4(rgb.bg, K.wz), vec4(rgb.gb, K.xy), step(rgb.b, rgb.g));\r
    vec4 Q = mix(vec4(P.xyw, rgb.r), vec4(rgb.r, P.yzx), step(P.x, rgb.r));\r
    float D = Q.x - min(Q.w, Q.y);\r
    float E = 1.0e-10;\r
    return vec3(abs(Q.z + (Q.w - Q.y)/(6.0 * D + E)), D / (Q.x + E), Q.x);\r
}

vec3 HSVToRGB(vec3 hsv) {\r
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\r
    vec3 P = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);\r
    return hsv.z * mix(K.xxx, saturate(P - K.xxx), hsv.y);\r
}

vec4 HSVLerp(vec4 A, vec4 B, float T) {\r
    A.xyz = RGBToHSV(A.xyz);\r
    B.xyz = RGBToHSV(B.xyz);

    float t = T; 

    float hue;\r
    float d = B.x - A.x; 

    if(A.x > B.x) {\r
        float temp = B.x;\r
        B.x = A.x;\r
        A.x = temp;

        d = -d;\r
        T = 1.0 - t;\r
    }

    if(d > 0.5) {\r
        A.x = A.x + 1.0;\r
        hue = mod((A.x + t * (B.x - A.x)), 1.0);\r
    }

    if(d <= 0.5) hue = A.x + t * d;

    float sat = A.y + t * (B.y - A.y);\r
    float val = A.z + t * (B.z - A.z);\r
    float alpha = A.w + t * (B.w - A.w);

    vec3 rgb = HSVToRGB(vec3(hue,sat,val));

    return vec4(rgb, alpha);\r
}\r
vec3 getWorldSpaceScenePosition(vec2 uv) {\r
    vec3 viewVector = -(v_eye - v_positionWC);\r
    float screenPositionZ = gl_FragCoord.z/gl_FragCoord.w;\r
    screenPositionZ = log2(screenPositionZ) * czm_oneOverLog2FarDepthFromNearPlusOne;\r
    float sceneDepthZ = czm_unpackDepth(texture(globeDepthTexture, uv)); 
    viewVector = viewVector / screenPositionZ;\r
    viewVector = viewVector * sceneDepthZ;\r
    viewVector = viewVector + v_eye;\r
    return viewVector;\r
}\r
float Fresnel(vec3 vNormal , float power) {\r
    vec3 normal = vNormal;\r
    vec3 viewDir = normalize(v_eye - v_positionWC);

    return pow((1.0 - saturate(dot(normalize(normal), normalize(viewDir)))), power);\r
}\r
vec4 Overwrite(vec4 Base, vec4 Blend, float Opacity) {\r
    return mix(Base, Blend, Opacity);\r
}\r
vec4 LinearDodge(vec4 Base, vec4 Blend, float Opacity) {\r
    vec4 Out = Base + Blend;\r
    Out = mix(Base, Out, Opacity);\r
    return Out;\r
}\r
vec4 overlay(vec4 base, vec4 over, float blend) {\r
    float overAlpha = saturate(over.a);

    vec4 overwriteResult = Overwrite(base, over, overAlpha);\r
    vec4 linearDodgedResult = LinearDodge(base, over, overAlpha);

    return mix(overwriteResult, linearDodgedResult, blend);\r
}

#define MOD2 vec2(4.438975,3.972973)\r
const int k_fbmWaterSteps = 4;\r
float Hash( float p )\r
{\r
    
    vec2 p2 = fract(vec2(p) * MOD2);\r
    p2 += dot(p2.yx, p2.xy+19.19);\r
    return fract(p2.x * p2.y);\r
    
}\r
vec2 Hash2( float p )\r
{\r
    
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));\r
    p3 += dot(p3, p3.yzx + 19.19);\r
    return fract((p3.xx+p3.yz)*p3.zy);\r
}\r
vec3 SmoothNoise_DXY(vec2 o)\r
{\r
    vec2 p = floor(o);\r
    vec2 f = fract(o);

    float n = p.x + p.y*57.0;

    float a = Hash(n+  0.0);\r
    float b = Hash(n+  1.0);\r
    float c = Hash(n+ 57.0);\r
    float d = Hash(n+ 58.0);

    vec2 f2 = f * f;\r
    vec2 f3 = f2 * f;

    vec2 t = 3.0 * f2 - 2.0 * f3;\r
    vec2 dt = 6.0 * f - 6.0 * f2;

    float u = t.x;\r
    float v = t.y;\r
    float du = dt.x;\r
    float dv = dt.y;

    float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;

    float dx = (b-a)*du + (a-b+d-c)*du*v;\r
    float dy = (c-a)*dv + (a-b+d-c)*u*dv;

    return vec3(dx, dy, res);\r
}\r
vec3 FBM_DXY( vec2 p, vec2 flow, float ps, float df ) {\r
    vec3 f = vec3(0.0);\r
    float tot = 0.0;\r
    float a = 1.0;\r
    
    for( int i=0; i<k_fbmWaterSteps; i++)\r
    {\r
        p += flow;\r
        flow *= -0.75; 
        vec3 v = SmoothNoise_DXY( p );\r
        f += v * a;\r
        p += v.xy * df;\r
        p *= 2.0;\r
        tot += a;\r
        a *= ps;\r
    }\r
    return f / tot;\r
}\r
float SampleWaterFoam( vec2 vUV, vec2 vFlowOffset, float fFoam )\r
{\r
    float f =  FBM_DXY(vUV * 30.0, vFlowOffset * 50.0, 0.8, -0.5 ).z;\r
    float fAmount = 0.2;\r
    f = max( 0.0, (f - fAmount) / fAmount );\r
    return pow( 0.5, f );\r
}\r
vec2 processUV(vec2 uv) {\r
    if(u_waterAngle < -999.){\r
        return uv;\r
    }\r
    float angle = radians(u_waterAngle);\r
    mat2 rotationMatrix = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\r
    vec2 newUV = rotationMatrix * uv;\r
    newUV += (czm_frameNumber / u_waterSpeed);\r
    return newUV;\r
}

//////////////////// 3D OpenSimplex2S noise with derivatives  ////////////////////\r
//////////////////// Output: vec4(dF/dx, dF/dy, dF/dz, value) ////////////////////

vec4 permute(vec4 t) {\r
    return t * (t * 34.0 + 133.0);\r
}

vec3 grad(float hash) {

    
    vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;

    
    
    
    vec3 cuboct = cube;\r
    cuboct[int(hash / 16.0)] = 0.0;

    
    float type = mod(floor(hash / 8.0), 2.0);\r
    vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));

    
    
    vec3 grad = cuboct * 1.22474487139 + rhomb;

    
    
    
    grad *= (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;

    return grad;\r
}

vec4 os2NoiseWithDerivativesPart(vec3 X) {\r
    vec3 b = floor(X);\r
    vec4 i4 = vec4(X - b, 2.5);

    
    vec3 v1 = b + floor(dot(i4, vec4(.25)));\r
    vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35)));\r
    vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35)));\r
    vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35)));

    
    vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0));\r
    hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0));\r
    hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0);

    
    vec3 d1 = X - v1; vec3 d2 = X - v2; vec3 d3 = X - v3; vec3 d4 = X - v4;\r
    vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0);\r
    vec4 aa = a * a; vec4 aaaa = aa * aa;\r
    vec3 g1 = grad(hashes.x); vec3 g2 = grad(hashes.y);\r
    vec3 g3 = grad(hashes.z); vec3 g4 = grad(hashes.w);\r
    vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4));

    
    vec3 derivative = -8.0 * mat4x3(d1, d2, d3, d4) * (aa * a * extrapolations)\r
    + mat4x3(g1, g2, g3, g4) * aaaa;

    
    return vec4(derivative, dot(aaaa, extrapolations));\r
}

vec4 os2NoiseWithDerivatives_Fallback(vec3 X) {\r
    X = dot(X, vec3(2.0/3.0)) - X;

    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(dot(result.xyz, vec3(2.0/3.0)) - result.xyz, result.w);\r
}

vec4 os2NoiseWithDerivatives_ImproveXY(vec3 X) {

    
    mat3 orthonormalMap = mat3(\r
    0.788675134594813, -0.211324865405187, -0.577350269189626,\r
    -0.211324865405187, 0.788675134594813, -0.577350269189626,\r
    0.577350269189626, 0.577350269189626, 0.577350269189626);

    X = orthonormalMap * X;\r
    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(result.xyz * orthonormalMap, result.w);\r
}\r
//////////////////////////////// End noise code ////////////////////////////////

float normpdf(float x, float sigma) {\r
    return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;\r
}

vec4 gaussianBlur(sampler2D blurTexture, vec2 distortedUv) {\r
    const int mSize = 11;\r
    const int kSize = (mSize - 1) / 2;\r
    float kernel[mSize];\r
    vec3 final_colour = vec3(0.0);\r
    float sigma = 7.;\r
    float Z = 0.0;\r
    
    for(int j = 0; j <= kSize; ++j) {\r
        kernel[kSize + j] = kernel[kSize - j] = normpdf(float(j), sigma);\r
    }\r
    
    for(int j = 0; j < mSize; ++j) {\r
        Z += kernel[j];\r
    }\r
    
    for(int i = -kSize; i <= kSize; ++i) {\r
        for(int j = -kSize; j <= kSize; ++j) {\r
            vec2 uvDxDy = distortedUv + vec2(float(i), float(j)) / czm_viewport.zw;\r
            final_colour += kernel[kSize + j] * kernel[kSize + i] * texture(blurTexture, uvDxDy).rgb;\r
        }\r
    }\r
    return vec4(vec3(final_colour / (Z * Z)),1.);\r
}\r
czm_material czm_getMaterial(czm_materialInput materialInput){

    czm_material material = czm_getDefaultMaterial(materialInput);\r
    
    vec2 rawUV = materialInput.st;

    
    #ifdef IS_MASKMAP\r
    float specularMapValue = texture(maskTexture, rawUV).r;\r
    if(specularMapValue == 0.){\r
        discard;\r
    }\r
    #endif\r
    
    #ifdef IS_RIVERMASKMAP\r
    float riverMaskValue = texture(riverMaskTexture, v_st2).r;\r
    if(riverMaskValue == 0.)discard;\r
    #endif

    
    materialInput.st = processUV(materialInput.st);

    vec2 screenUV = gl_FragCoord.xy / czm_viewport.zw;\r
    vec3 worldPosition = v_positionWC;

    
    float positionToEyeECLength = length(materialInput.positionToEyeEC);\r
    float waveIntensity = waveFade(oceanParam.z, oceanParam.w, positionToEyeECLength);\r
    
    float time = czm_frameNumber * oceanAnimationSpeedHighAltitude;\r
    vec4 noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyHighAltitude, time, 0.0);\r
    vec3 normalTangentSpaceHighAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeHighAltitude);

    
    time = czm_frameNumber * oceanAnimationSpeedLowAltitude;\r
    noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyLowAltitude, time, 0.0);\r
    vec3 normalTangentSpaceLowAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeLowAltitude);

    
    
    float highAltitudeFade = linearFade(0., oceanParam.x, positionToEyeECLength);\r
    
    float lowAltitudeFade = 1.0 - linearFade(oceanParam.y, 60000., positionToEyeECLength);\r
    vec3 normalTangentSpace =\r
    (highAltitudeFade * normalTangentSpaceHighAltitude) +\r
    (lowAltitudeFade * normalTangentSpaceLowAltitude);

    normalTangentSpace.xy *= waveIntensity;

    
    normalTangentSpace = normalize(normalTangentSpace);

    
    vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

    
    vec2 distortedScreenUV = screenUV + vec2(noise.x * u_noiseIntensity, 0.0);\r
    
    vec3 worldSpaceScenePosition = getWorldSpaceScenePosition(distortedScreenUV);

    float cmpWaterDepth = (worldPosition - worldSpaceScenePosition).z;\r
    if(cmpWaterDepth <= 0.0) {\r
        worldSpaceScenePosition = getWorldSpaceScenePosition(screenUV);\r
    }\r
    float shoreDepth = (worldPosition - worldSpaceScenePosition).z;\r
    
    if(length(viewerPositionWC.xyz - u_center.xyz) > u_center.w){\r
        shoreDepth = 15.;\r
    }\r
    float shore = saturate(exp(-shoreDepth / u_WaterDepth));

    
    vec4 color = HSVLerp(\r
    vec4(u_WaterDeepColor.rgb, u_WaterDeepColorAlpha),\r
    vec4(u_WaterShallowColor.rgb, u_WaterShallowColorAlpha),\r
    shore\r
    );

    
    float fresnel = Fresnel(normalTangentSpace,u_HorizonDistance);\r
    color = HSVLerp(color, vec4(u_HorizonColor.rgb, 1.0), fresnel);

    
    
    
    vec4 refractColor = gaussianBlur(refractTexture, distortedScreenUV);\r
    
    vec3 X = vec3( rawUV / u_causticScale, mod(czm_frameNumber/u_causticSpeed, 578.0) * 0.8660254037844386);\r
    vec4 noiseResult = os2NoiseWithDerivatives_ImproveXY(X);\r
    noiseResult = os2NoiseWithDerivatives_ImproveXY(X - noiseResult.xyz / 16.0);\r
    float value = noiseResult.w;\r
    vec3 col = u_causticColor.rgb * (0.5 + 0.5 * value);\r
    vec4 sceneColor = refractColor;\r
    sceneColor.rgb += col * saturate(exp(-shoreDepth / u_causticIntersectionFade));\r
    
    
    float underwaterFactor = 1.0 - color.a;\r
    color.rgb += sceneColor.rgb * underwaterFactor;

    
    float colorIndex = (shoreDepth / u_colorDepth.x - (u_colorDepth.y)) / (u_colorDepth.z - (u_colorDepth.y));\r
    color.rgb += texture(colorTable_0, vec2(colorIndex, 0.5)).rgb * u_colorDepth.w;

    
    if(showReflect){\r
        vec2 reflectUV = vec2(screenUV.x, screenUV.y);\r
        reflectUV += vec2(noise.x * u_noiseIntensity, 0.0);\r
        
        
        vec4 reflectionSample = gaussianBlur(reflectTexture, reflectUV);\r
        float reflectionFresnel = Fresnel(normalTangentSpace,u_ReflectionFresnelPower);\r
        reflectionFresnel *= u_ReflectionStrength;\r
        vec4 finalReflectionColor = mix(vec4(0.0), reflectionSample, reflectionFresnel);\r
        color = overlay(color, finalReflectionColor, u_ReflectionMix);\r
    }

    
    if(showFoam){\r
        float time2 = czm_frameNumber / u_FoamSpeed;\r
        vec2 vUV = materialInput.st;\r
        float t0 = fract( time2 );\r
        float t1 = fract( time2 + 0.5 );\r
        float o0 = t0 - 0.5;\r
        float o1 = t1 - 0.5;\r
        float i0 = floor( time2 );\r
        float i1 = floor( time2 + 0.5 );\r
        vec2 vUV0 = vUV + Hash2(i0);\r
        vec2 vUV1 = vUV + Hash2(i1);\r
        float weight = abs( t0 - 0.5 ) * 1.0;\r
        float foam0 = SampleWaterFoam( vUV0 * u_FoamScale,normalTangentSpace.xz * o0 * 0.25, 1. );\r
        float foam1 = SampleWaterFoam( vUV1 * u_FoamScale, normalTangentSpace.xz * o1 * 0.25, 1. );\r
        float fOutFoamTex = mix( foam0, foam1, weight );\r
        float intersectionFoamDepth = saturate(exp(-shoreDepth / u_FoamIntersectionFade));\r
        color = overlay(color, vec4(vec3(1.0-fOutFoamTex),intersectionFoamDepth), u_FoamBlend);\r
    }\r
    vec3 diffuseLight = vec3(0.0);\r
    vec3 specularLight = vec3(0.0);

    vec3 worldToEye = materialInput.positionToEyeEC;\r
    vec3 eyeDirection = normalize( worldToEye );

    if (czm_backFacing()) {\r
        color.rgb = texture(refractTexture, distortedScreenUV).rgb;\r
        specularLight *= 100.;\r
    }\r
    #ifdef IS_SSS\r
    material.diffuse = (baseColor.rgb + color.rgb) * luminance;\r
    const float pdf = 1.0 / 3.14159265359;\r
    vec3 sssCol = vec3(0.6);\r
    vec3 sssRad = 3. * material.diffuse;\r
    int type = 0;\r
    vec3 n = normalize(inverseViewRotation * normalTangentSpace.xzy);\r
    vec3 n2 = normalize(inverseViewRotation * normalTangentSpace.xyz);\r
    vec3 rd = normalize(v_position.xyz - viewerPositionWC);\r
    vec3 sunDir = normalize(czm_sunPositionWC);\r
    vec3 col2 =\r
    lighting_sss(type, n, sunDir, rd, vec3(1), material.diffuse, sssCol, sssRad, .04, 10.) + 
    lighting_sss(type, n2, normalize(.1 * viewerPositionWC), rd, vec3(.25), material.diffuse, sssCol, sssRad, .04, 3.5);  
    material.diffuse += pdf * col2;\r
    #else\r
    sunLight( surfaceNormal, eyeDirection, diffuseLight, specularLight );\r
    vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * baseColor.rgb;\r
    material.diffuse = (specularLight + baseColor.rgb + color.rgb\r
    + u_sunScatter * diffuseLight * 0.5 * czm_lightColor\r
    + u_sunScatter * scatter\r
    ) * luminance;

    #endif\r
    material.normal = normalize(materialInput.tangentToEyeMatrix * normalTangentSpace);\r
    material.alpha = 1.0;\r
    material.shininess = 20.0;

    #ifdef HDR\r
    material.diffuse = czm_gammaCorrect(material.diffuse);\r
    #endif\r
    return material;\r
}`,ci=`precision highp float;\r
precision highp sampler2D;\r
attribute vec3 position3DHigh;\r
attribute vec3 position3DLow;\r
attribute float batchId;\r
attribute vec3 normal;\r
attribute vec2 st;\r
varying vec3 v_positionWC;\r
varying vec3 v_positionMC;\r
varying vec3 v_eye;\r
varying vec3 v_positionEC;\r
varying vec3 v_normalEC;\r
varying vec2 v_st;\r
varying vec4 v_position;\r
uniform mat4 cameraEastNorthUp;\r
uniform mat4 worldEastNorthUp;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
#ifdef IS_RIVERMASKMAP\r
attribute vec2 st2;\r
varying vec2 v_st2;\r
#endif\r
#ifdef IS_WAVE\r
float iTime;\r
uniform sampler2D noiseTexture;\r
uniform vec4 waveParam;\r
uniform vec4 waveParam2;\r
const float PI = 3.141592653589793;\r
const float earthRadius = 6378137.0; 
const float angularVelocity = 180.0 / PI;\r
const float RADII_X = 6378137.0;\r
const float RADII_Y = 6378137.0;\r
const float RADII_Z = 6356752.314245;\r
struct EncodedCartesian3 {\r
    vec3 high;\r
    vec3 low;\r
};\r
vec2 encode(float value) {\r
    vec2 result;\r
    float doubleHigh;\r
    if (value >= 0.0) {\r
        doubleHigh = floor(value / 65536.0) * 65536.0;\r
        result.x = doubleHigh;\r
        result.y = value - doubleHigh;\r
    } else {\r
        doubleHigh = floor(-value / 65536.0) * 65536.0;\r
        result.x = -doubleHigh;\r
        result.y = value + doubleHigh;\r
    }\r
    return result;\r
}\r
EncodedCartesian3 fromCartesian(vec3 cartesian) {\r
    EncodedCartesian3 result;\r
    vec2 highLow = encode(cartesian.x);\r
    result.high.x = highLow.x;\r
    result.low.x = highLow.y;

    highLow = encode(cartesian.y);\r
    result.high.y = highLow.x;\r
    result.low.y = highLow.y;

    highLow = encode(cartesian.z);\r
    result.high.z = highLow.x;\r
    result.low.z = highLow.y;

    return result;\r
}\r
vec3 worldToGeographic(vec3 worldPosition) {\r
    
    vec3 ecef = worldPosition;  

    
    float l = length(ecef.xy);\r
    float e2 = 1.0 - (RADII_Z * RADII_Z) / (RADII_X * RADII_X);\r
    float u = atan(ecef.z * RADII_X / (l * RADII_Z));\r
    float lat = atan((ecef.z + e2 * RADII_Z * pow(sin(u), 3.0)) /\r
    (l - e2 * RADII_X * pow(cos(u), 3.0)));\r
    float lon = atan(ecef.y, ecef.x);\r
    float N = RADII_X / sqrt(1.0 - e2 * sin(lat) * sin(lat));\r
    float alt = l / cos(lat) - N;

    
    lat = degrees(lat);\r
    lon = degrees(lon);

    return vec3(lon, lat, alt);\r
}

vec3 geo2cartesian(vec3 geo){\r
    float cosLat=cos(geo.y);\r
    float snX=cosLat*cos(geo.x);\r
    float snY=cosLat*sin(geo.x);\r
    float snZ=sin(geo.y);\r
    vec3 sn=normalize(vec3(snX,snY,snZ));\r
    vec3 radiiSquared=vec3(40680631.59076899*1000000.,40680631.59076899*1000000.,40408299.98466144*1000000.);\r
    vec3 sk=radiiSquared*sn;\r
    float gamma=sqrt(dot(sn,sk));\r
    sk=sk/gamma;\r
    sn=sn*geo.z;\r
    return sk+sn;\r
}

vec3 deg2cartesian(vec3 deg) {\r
    vec2 radGeo=radians(deg.xy);\r
    vec3 geo=vec3(radGeo.xy,deg.z);\r
    return geo2cartesian(geo);\r
}

float hash(float n) {\r
    return fract(sin(n) * 43758.5453123);\r
}

float noise1(attribute vec2 x) {\r
    vec2 p = floor(x);\r
    vec2 f = smoothstep(0.0, 1.0, fract(x));\r
    float n = p.x + p.y * 57.0;\r
    return mix(mix(hash(n + 0.0), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);\r
}\r
float noise(vec2 p) {\r
    return textureLod(noiseTexture, p * vec2(1. / 256.), 0.0).x;\r
}\r
const mat2 m = mat2(0.72, -1.60, 1.60, 0.72);\r
float water_map(vec2 p, float height) {\r
    vec2 p2 = p * waveParam2.z;\r
    vec2 shift1 = 0.001 * vec2(iTime * 160.0 * 2.0, iTime * 120.0 * 2.0);\r
    vec2 shift2 = 0.001 * vec2(iTime * 190.0 * 2.0, -iTime * 130.0 * 2.0);

    
    float f = 0.6000 * noise(p);\r
    f += 0.2500 * noise(p * m);\r
    f += 0.1666 * noise(p * m * m);\r
    float wave = sin(p2.x * 0.622 + p2.y * 0.622 + shift2.x * 4.269) * waveParam2.y * f * height * height;

    p *= waveParam.z;\r
    f = 0.;\r
    float amp = 1.0, s = .5;\r
    for(int i = 0; i < 9; i++) {\r
        p = m * p * .947;\r
        f -= amp * abs(sin((noise(p + shift1 * s) - .5) * 2.));\r
        amp = amp * .59;\r
        s *= -1.329;\r
    }

    return wave + f * waveParam2.w;\r
}\r
#endif\r
void main()\r
{\r
    #ifdef IS_WAVE\r
    iTime = czm_frameNumber / 60.;\r
    vec3 highPos = position3DHigh;\r
    vec3 lowPos = position3DLow;\r
    vec3 worldPosition = highPos + lowPos;\r
    vec3 positionMC = (cameraEastNorthUp * vec4(worldPosition,1.)).xyz;\r
    float deepwater_fadedepth = 0.5 + waveParam2.x;\r
    float waveheight = clamp(waveParam.w * 3. - 1.5, 0., 1.);\r
    float level = waveParam.w + .2 * water_map(st * 15. + vec2(iTime * .1), waveheight);\r
    float heightOffset = (waveParam.y - waveParam.x) * level;\r
    vec3 llh = worldToGeographic(worldPosition.xyz);\r
    
    vec4 adjustedCartesian = worldEastNorthUp * vec4(positionMC.xy,waveParam.x+heightOffset,1.0);\r
    EncodedCartesian3 encodedCartesian = fromCartesian(adjustedCartesian.xyz);\r
    vec3 highDifference = encodedCartesian.high - czm_encodedCameraPositionMCHigh;\r
    vec3 lowDifference = encodedCartesian.low - czm_encodedCameraPositionMCLow;\r
    vec4 p = vec4(highDifference + lowDifference, 1.0);\r
    #else\r
    vec4 p = czm_translateRelativeToEye(position3DHigh, position3DLow);\r
    #endif\r
    v_positionMC = p.xyz;\r
    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;\r
    v_normalEC = czm_normal * normal;\r
    v_position = inverseView * vec4(v_positionEC , 1.0);\r
    v_positionWC = (cameraEastNorthUp * v_position).xyz;\r
    v_eye = (cameraEastNorthUp * vec4(viewerPositionWC,1.0)).xyz;\r
    v_st = st;\r
    #ifdef IS_RIVERMASKMAP\r
    v_st2 = st2;\r
    #endif\r
    gl_Position = czm_modelViewProjectionRelativeToEye * p;\r
}`;const{buildModuleUrl:li,Cartesian4:xt,Color:Ie,RenderState:hi,DepthFunction:ui,Material:pi}=SuperMap3D;class cr{constructor(e){let t=`
`;return e._maskMapUrl&&(t+=`#define IS_MASKMAP
`),e._riverMaskMapUrl&&(t+=`#define IS_RIVERMASKMAP
`),e._minWaveHeight&&e._maxWaveHeight&&(t+=`#define IS_WAVE
`),e._sss&&(t+=`#define IS_SSS
`),new SuperMap3D.EllipsoidSurfaceAppearance({renderState:hi.fromCache({depthTest:{enabled:!0,func:ui.LESS},cull:{enabled:!1},depthRange:{near:0,far:1},colorMask:{red:!0,green:!0,blue:!0,alpha:!0},depthMask:!0}),material:new pi({fabric:{type:"AdvancedWater",uniforms:{colorTable:li("Assets/Data/colorTable.png"),u_colorDepth:new xt(30,0,.8,0),baseColor:Ie.fromCssColorString("#003361"),luminance:1,showReflect:!1,showFoam:!0,u_sunScatter:0,u_waterHeight:-9999,u_waterSpeed:1,u_waterAngle:-9999,u_noiseIntensity:.05,u_WaterDepth:3.5,u_WaterShallowColor:Ie.fromCssColorString("#525252"),u_WaterShallowColorAlpha:.3,u_WaterDeepColor:Ie.fromCssColorString("#000000"),u_WaterDeepColorAlpha:.9,u_HorizonColor:Ie.fromCssColorString("#f7f7f7"),u_HorizonDistance:15,u_ReflectionFresnelPower:4,u_ReflectionStrength:.6,u_ReflectionMix:.5,u_FoamBlend:.63,u_FoamSpeed:120,u_FoamScale:200,u_FoamIntersectionFade:.75,shiny:800,spec:10,oceanFrequencyLowAltitude:61505.084,oceanAnimationSpeedLowAltitude:.12,oceanOneOverAmplitudeLowAltitude:2,oceanFrequencyHighAltitude:12500/5,oceanAnimationSpeedHighAltitude:.08,oceanOneOverAmplitudeHighAltitude:1/2,oceanParam:new xt(6e4,2e4,7e4,1e6),u_causticScale:.001,u_causticSpeed:60,u_causticIntersectionFade:8,u_causticColor:new Ie(.431,.8,1),u_center:new xt(e._centerPos.x,e._centerPos.y,e._centerPos.z,1e8)},source:t+`
`+si},translucent:!1}),vertexShaderSource:t+`
`+ci})}}const{PassState:fi,BoundingRectangle:di,PixelDatatype:lr,Framebuffer:mi,Texture:hr,PixelFormat:ur,ClearCommand:_i,Color:vi,defined:wi,Sampler:gi,TextureMinificationFilter:xi,TextureMagnificationFilter:yi,destroyObject:Si,defaultValue:ke}=SuperMap3D;function Ve(c,e,t,r){const n=new fi(c);n.viewport=new di,n.blendingEnabled=!0,this._context=c,this._pixelFormat=ke(t,ur.RGBA),this._pixelDatatype=ke(r,lr.UNSIGNED_BYTE),this._sampler=ke(e,new gi({minificationFilter:xi.NEAREST,magnificationFilter:yi.NEAREST})),this._framebuffer=void 0,this._passState=n,this._height=1,this._width=1,this._clearCommand=new _i({color:new vi(0,0,0,0),stencil:0,depth:1}),this._clearCommand.framebuffer=this._framebuffer}Ve.prototype.update=function(c,e){if(c===0||e===0)return!1;let t=!1;const r=this._context,n=c,o=e;return this._passState.viewport.width=n,this._passState.viewport.height=o,(!wi(this._framebuffer)||!(this._width===n&&this._height===o))&&(this._width=n,this._height=o,this._framebuffer=this._framebuffer&&this._framebuffer.destroy(),this._framebuffer=new mi({context:r,colorTextures:[new hr({context:r,width:n,height:o,pixelFormat:this._pixelFormat,pixelDatatype:this._pixelDatatype,sampler:this._sampler})],depthStencilTexture:new hr({context:r,width:n,height:o,pixelFormat:ur.DEPTH_STENCIL,pixelDatatype:lr.UNSIGNED_INT_24_8}),destroyAttachments:!1}),t=!0),this._clearCommand.framebuffer=this._framebuffer,this._passState.framebuffer=this._framebuffer,this._clearCommand.execute(r,this._passState),t},Ve.prototype.destroy=function(){return this._framebuffer=this._framebuffer&&this._framebuffer.destroy(),Si(this)},Object.defineProperties(Ve.prototype,{colorTexture:{get:function(){var c;return ke((c=this._framebuffer)==null?void 0:c.getColorTexture(0),this._context.defaultTexture)}}});const{Cartesian3:y,Cartesian4:Ci,Color:pr,defaultValue:ue,defined:Di,destroyObject:Pi,DeveloperError:Mi,Matrix3:Ka,Matrix4:ye,Plane:fr,ClearCommand:qa,Pass:dr,Camera:mr,Cartesian2:bi,Cartographic:Ti,Cesium3DTilePass:Ei,Cesium3DTilePassState:Ai,SceneMode:Ii}=SuperMap3D,Vi=new ye(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);class yt{constructor(e){if(!Di(e.scene))return new Mi("options.scene 没有定义");this._scene=e.scene,this._planeCenterPos=ue(e.planeCenterPos,new y),this._planeHeight=ue(e.planeHeight,1),this._planeNormal=ue(e.planeNormal,new y(0,0,1)),this._renderMode=ue(e.renderMode,1),this._renderPass=ue(e.renderPass,[dr.CESIUM_3D_TILE]),this._renderState=ue(e.renderState,!0),this._isClipPlane=ue(e.isClipPlane,!0),this._renderTilesetPassState=new Ai({pass:Ei.RENDER}),this._rtTexture=new Ve(this._scene.frameState.context),this._textureMatrix=ye.clone(ye.IDENTITY),this._reflectCamera=void 0}set renderState(e){this._renderState=e}set renderMode(e){this._renderMode=e}set renderPass(e){this._renderPass=e}get colorTexture(){return this._rtTexture.colorTexture}renderReflectTexture(){if(this._reflectCamera||(this._reflectCamera=new mr(this._scene)),this._scene.mode!==Ii.SCENE3D)return;const e=this._scene.context,t=this._scene._view.passState,r=this._scene.camera,n=mr.clone(this._scene.camera,this._reflectCamera),o=n.position,a=this._scene.globe.ellipsoid.geodeticSurfaceNormal(this._scene.camera.positionWC),i=this._scene.context.drawingBufferWidth*.5,s=this._scene.context.drawingBufferHeight*.5,l=this._scene.camera.pickEllipsoid(new bi(s,i));if(!l)return;const h=Ti.fromCartesian(l);this._planeCenterPos=y.fromRadians(h.longitude,h.latitude,this._planeHeight);const u=y.subtract(this._planeCenterPos,o,new y),p=this.getReflect(u,a);let d=y.negate(p,new y);d=y.add(this._planeCenterPos,d,new y);const f=this.getCenter(this._scene.camera),_=y.subtract(this._planeCenterPos,f,new y),g=this.getReflect(_,a);let C=y.negate(g,new y);C=y.add(this._planeCenterPos,C,new y);let b=y.clone(n.up,new y);b=this.getReflect(b,a);let D=y.subtract(C,d,new y);D=y.normalize(D,new y);let w=y.cross(D,b,new y);w=y.normalize(w,new y),n.position=d,n.direction=D,n.up=b,n.right=w,n.update(this._scene.mode),this._scene.camera=n;const x=t.viewport;t.viewport.x=0,t.viewport.y=0,t.viewport.width=i,t.viewport.height=s,this._rtTexture.update(i,s),t.framebuffer=this._rtTexture._framebuffer;const E=this._scene._clearColorCommand;pr.multiplyByScalar(pr.DEEPSKYBLUE,.1,E.color),E.color.alpha=1,E.execute(e,t);const I=e.uniformState;if(this._isClipPlane){const L=fr.fromPointNormal(this._planeCenterPos,a),F=fr.transform(L,n.viewMatrix),H=new Ci(F.normal.x,F.normal.y,F.normal.z,F.distance);n.frustum._offCenterFrustum.clipPlane=H}I.updateCamera(n,this._scene.context),this._scene.updateFrameState();const R=this._scene.globe.show,P=this._scene._frameState,ee=P.useLogDepth;if(P.invertClassification=!1,P.passes.render=!0,P.tilesetPassState=this._renderTilesetPassState,P.camera=n,P.useLogDepth=!1,this._scene.globe.show=!1,I.update(P),ye.clone(Vi,this._textureMatrix),ye.multiply(this._textureMatrix,n.frustum.projectionMatrix,this._textureMatrix),ye.multiply(this._textureMatrix,n.viewMatrix,this._textureMatrix),this._renderMode===1){I.updatePass(dr.ENVIRONMENT),this._scene.skyBox&&this._scene.skyBox._cubeMap&&this._scene.skyBox._command.execute(e,t);const L=this._scene._view.frustumCommandsList,F=L.length;let H,ct,te;for(let Ue=0;Ue<F;++Ue){const Ht=F-Ue-1,qr=L[Ht];for(let Nt=0,Za=this._renderPass.length;Nt<Za;Nt++){const Ut=this._renderPass[Nt];for(I.updatePass(Ut),te=qr.commands[Ut],ct=qr.indices[Ut],H=0;H<ct;++H)te[H].notReflect||te[H].isWater||te[H].vertexArray&&te[H].vertexArray.isDestroyed()||te[H].shaderProgram&&te[H].execute(e,t)}}}else this._scene.updateEnvironment(),this._scene.updateAndExecuteCommands(t,this._scratchColorZero),this._scene.resolveFramebuffers(t),P.commandList.length=0,e.endFrame(),zi(this._scene);t.framebuffer=void 0,t.viewport=x,I.updateCamera(r,this._scene.context),this._scene.updateFrameState(),P.camera=r,P.useLogDepth=ee,this._scene.camera=r,this._scene.globe.show=R}getReflect(e,t){const r=y.dot(t,e),n=y.multiplyByScalar(t,2*r,new y);return y.subtract(e,n,new y)}getCenter(e){const t=y.clone(e.position),r=y.clone(e.direction),n=e.pitch+Math.PI/2,o=y.magnitude(t);if(n===0)return y.multiplyByScalar(t,6378137/o,new y);const a=new y(-r.x,-r.y,-r.z),i=Math.PI-n,s=y.angleBetween(t,a),l=Math.PI-i-s,h=Math.sqrt(o*o+6378137*6378137-2*o*6378137*Math.cos(l)),u=y.multiplyByScalar(r,h,new y);return y.add(t,u,new y)}destroy(){return this._disposeListener&&(this._disposeListener(),this._disposeListener=void 0),this._rtTexture&&(this._rtTexture.destroy(),this._rtTexture=void 0),Pi(this)}}function zi(c){const e=c._frameState.afterRender;for(let t=0,r=e.length;t<r;++t)e[t](),c.requestRender();e.length=0}var Li=`uniform highp sampler2D u_texture;\r
varying vec2 v_textureCoordinates;\r
void main() {\r
    gl_FragColor = texture2D(u_texture, v_textureCoordinates);\r
}`;const{defined:Ri,destroyObject:Wi}=SuperMap3D;function pe(){this._rtt=void 0,this._drawCommand=void 0}Object.defineProperties(pe.prototype,{colorTexture:{get:function(){var c;return(c=this._rtt)==null?void 0:c.colorTexture}}});function Hi(c,e){const t=e.context.createViewportQuadCommand(Li,{uniformMap:{u_texture:function(){return e.camera._scene.view.globeDepth._colorTexture}}});c._drawCommand=t}pe.prototype.update=function(c){const e=c.context,t=e.drawingBufferWidth*.5,r=e.drawingBufferHeight*.5;Ri(this._rtt)||(this._rtt=new Ve(e),Hi(this,c)),this._rtt.update(t,r),this._drawCommand.framebuffer=this._rtt._framebuffer,this._drawCommand.execute(e,this._rtt._passState)},pe.prototype.isDestroyed=function(){return!1},pe.prototype.destroy=function(){return this._rtt.destroy(),this._drawCommand.shaderProgram=this._drawCommand.shaderProgram&&this._drawCommand.shaderProgram.destroy(),Wi(this)};const{BoundingSphere:_r,Cartesian3:v,Ray:Se,Resource:St,PrimitiveState:vr,buildModuleUrl:wr,ComponentDatatype:Ce,DeveloperError:Ni,EncodedCartesian3:Be,Geometry:gr,GeometryAttribute:De,GeometryAttributes:xr,GeometryInstance:$e,PrimitiveType:yr,defaultValue:A,destroyObject:Ui,Pass:Sr,Primitive:Cr,PolygonGeometry:Dr,clone:Pr,Texture:Ct,Sampler:Dt,TextureMinificationFilter:Pt,PolygonHierarchy:Mr,ShadowMode:br,Cartographic:Fi,Matrix4:Oi,Matrix3:Gi}=SuperMap3D,Tr=SuperMap3D.Math;function Mt(c,e){if(c instanceof v&&e&&e!==0){const t=v.normalize(c,new v),r=new Se(c,t);return Se.getPoint(r,e)}}function Er(c,e,t){const r=v.subtract(e,c,new v),n=v.normalize(r,new v),o=v.normalize(c,new v),a=v.cross(o,n,new v),i=v.cross(n,o,new v),s=new Se(c,a),l=new Se(c,i);return{left:Se.getPoint(s,t),right:Se.getPoint(l,t)}}function Xe(c,e){let t=Fi.fromCartesian(c),r=Tr.toDegrees(t.longitude),n=Tr.toDegrees(t.latitude);const o=Math.min(1,Math.max(0,(r-e._minLng)/(e._maxLng-e._minLng))),a=Math.min(1,Math.max(0,(e._maxLat-n)/(e._maxLat-e._minLat)));return{x:o,y:a}}function Ar(c,e=1,t=0,r){if(!c||c.length<=1||!e)return console.warn("positions or width error.",c),!1;const n=c.length,o=[],a=[],i=e/2;for(let h=0;h<n;h++){let u,p,d,f,_;if(h===0?(u=c[h],p=c[h],d=c[h+1]):n-1===h?(u=c[h-1],p=c[h],d=c[h-1]):(u=c[h-1],p=c[h],d=c[h+1]),t!==0&&(u=Mt(u,t),p=Mt(p,t),d=Mt(d,t)),u&&p&&d){let g=Er(p,d,i);if(f=g.left,_=g.right,h===0){o.push(f),a.push(_),o.push(f),a.push(_);continue}if(h===n-1){o.push(_),a.push(f),o.push(_),a.push(f);continue}o.push(f),a.push(_),g=Er(p,u,i),f=g.left,_=g.right,o.push(_),a.push(f)}}const s=[],l=[];if(o.length===2*n){for(let w=0;w<n;w++){const x=c[w],E=o[2*w+0],I=o[2*w+1],R=v.subtract(E,x,new v),P=v.subtract(I,x,new v),ee=v.add(R,P,new v),L=v.add(x,ee,new v);s.push(Pr(L));const F=a[2*w+0],H=a[2*w+1],ct=v.subtract(F,x,new v),te=v.subtract(H,x,new v),Ue=v.add(ct,te,new v),Ht=v.add(x,Ue,new v);l.push(Pr(Ht))}const h=[],u=[],p=[],d=[],f=[],_=[];for(let w=0;w<n;w++){const x=Be.fromCartesian(l[w]);if(u.push(l[w].x),u.push(l[w].y),u.push(l[w].z),p.push(x.high.x),p.push(x.high.y),p.push(x.high.z),d.push(x.low.x),d.push(x.low.y),d.push(x.low.z),h.push(0,0),w<n-1&&(f.push(w+2*n),f.push(w+1),f.push(w+1+n),f.push(w+2*n),f.push(w+1+n),f.push(n+w+2*n)),r._maxLat&&r._minLat){const{x:E,y:I}=Xe(l[w],r);_.push(E,1-I)}}for(let w=0;w<n;w++){const x=Be.fromCartesian(s[w]);if(u.push(s[w].x),u.push(s[w].y),u.push(s[w].z),p.push(x.high.x),p.push(x.high.y),p.push(x.high.z),d.push(x.low.x),d.push(x.low.y),d.push(x.low.z),h.push(0,1),r._maxLat&&r._minLat){const{x:E,y:I}=Xe(s[w],r);_.push(E,1-I)}}for(let w=0;w<n;w++){const x=Be.fromCartesian(l[w]);if(u.push(l[w].x),u.push(l[w].y),u.push(l[w].z),p.push(x.high.x),p.push(x.high.y),p.push(x.high.z),d.push(x.low.x),d.push(x.low.y),d.push(x.low.z),h.push(1,0),r._maxLat&&r._minLat){const{x:E,y:I}=Xe(l[w],r);_.push(E,1-I)}}for(let w=0;w<n;w++){const x=Be.fromCartesian(s[w]);if(u.push(s[w].x),u.push(s[w].y),u.push(s[w].z),p.push(x.high.x),p.push(x.high.y),p.push(x.high.z),d.push(x.low.x),d.push(x.low.y),d.push(x.low.z),h.push(1,1),r._maxLat&&r._minLat){const{x:E,y:I}=Xe(s[w],r);_.push(E,1-I)}}let g=new v;const C=[109.62476077284576,25.930013595011918],b=[118.73108774335694,25.521251874539647],D=[112.62169675645261,18.608134326108136];return v.fromDegrees(...C,-9999,void 0,g),u.push(g.x,g.y,g.z),_.push(0,0),h.push(0,0),v.fromDegrees(...b,-9999,void 0,g),u.push(g.x,g.y,g.z),h.push(0,0),_.push(0,0),v.fromDegrees(...D,-9999,void 0,g),u.push(g.x,g.y,g.z),h.push(0,0),_.push(0,0),f.push(u.length,u.length+1,u.length+2),{leftPositions:s,rightPositions:l,positions:c,vertexs:new Float32Array(u),vertexsH:new Float32Array(p),vertexsL:new Float32Array(d),indices:new Uint16Array(f),uvs:new Float32Array(h),uvs2:new Float32Array(_)}}console.warn("Calculate left and right position error!")}class ki{constructor(e,t={}){if(!e)throw new Ni(" viewer 没有被定义 ");this._viewer=e,this._show=!0,this._width=A(t.width,1),this._offsetHeight=A(t.offsetHeight,1),this._showReflect=A(t.showReflect,!1),this._showRefract=A(t.showRefract,!0),this._renderMode=A(t.renderMode,1),this._renderPass=A(t.renderPass,[Sr.GLOBE]),this._renderMode2=A(t.renderMode2,1),this._renderPass2=A(t.renderPass2,[Sr.CESIUM_3D_TILE]),this._underwater=A(t.underwater,!1),this._waterHeight=A(t.waterHeight,!1),this._sss=A(t.sss,!0),this._centerPos=A(t.centerPos,new v),this._riverAppearance=void 0,this._planeNormal=void 0,this._reflectPlaneCenter=void 0,this._riverMaskMapUrl=A(t.riverMaskMapUrl,void 0),this._maxLng=A(t.maxLng,void 0),this._maxLat=A(t.maxLat,void 0),this._minLng=A(t.minLng,void 0),this._minLat=A(t.minLat,void 0),this._riverMaskTexture=void 0,this._riverPrimitives=[]}get appearance(){return this._riverAppearance}get primitives(){return this._riverPrimitives}get show(){return this._show}set show(e){this._show=e,this._riverPrimitives.forEach(t=>{t.show=e})}set waterNormalMap(e){e&&St.fetchImage({url:e}).then(t=>{this._normalMap=new Ct({context:this._viewer.scene.frameState.context,source:t,sampler:new Dt({minificationFilter:Pt.LINEAR_MIPMAP_LINEAR})}),this._normalMap.generateMipmap()})}loadPolylineRive(e,t){if(e.positions.length<=0)return!1;this._riverInfo=Ar(e.positions,this._width,this._offsetHeight,this);const r=new v;let n=0;for(let _=0;_<e.positions.length;_++){const g=e.positions[_];v.add(r,g,r),n+=1}this._planeCenterPos=v.multiplyByScalar(r,1/n,r);const o=v.subtract(e.positions[0],this._planeCenterPos,new v),a=v.subtract(e.positions[1],this._planeCenterPos,new v),i=v.cross(o,a,new v);this._planeNormal=v.normalize(i,new v),this.getWaterAppearance(),this._riverAppearance.material.uniforms.u_waterAngle=-45;const s=new Float64Array(this._riverInfo.vertexs),l=new xr;l.position=new De({componentDatatype:Ce.DOUBLE,componentsPerAttribute:3,values:s}),l.st=new De({componentDatatype:Ce.FLOAT,componentsPerAttribute:2,values:this._riverInfo.uvs}),this._maxLng&&this._minLat&&(l.st2=new De({componentDatatype:Ce.FLOAT,componentsPerAttribute:2,values:this._riverInfo.uvs2}));const h=new gr({attributes:l,indices:this._riverInfo.indices,primitiveType:yr.TRIANGLES,boundingSphere:_r.fromVertices(s)}),u=[],p=new $e({geometry:h});t&&u.push(t),u.push(p);const d=new Cr({geometryInstances:u,appearance:this._riverAppearance,asynchronous:!1,shadows:br.RECEIVE_ONLY,isWater:!0});this._updateHeight=_=>{this._riverInfo=Ar(e.positions,this._width,_,this);const g=new v;let C=0;for(let ee=0;ee<e.positions.length;ee++){const L=e.positions[ee];v.add(g,L,g),C+=1}this._planeCenterPos=v.multiplyByScalar(g,1/C,g);const b=v.subtract(e.positions[0],this._planeCenterPos,new v),D=v.subtract(e.positions[1],this._planeCenterPos,new v),w=v.cross(b,D,new v);this._planeNormal=v.normalize(w,new v),this._riverAppearance.material.uniforms.u_waterAngle=-45;const x=new Float64Array(this._riverInfo.vertexs),E=new xr;E.position=new De({componentDatatype:Ce.DOUBLE,componentsPerAttribute:3,values:x}),E.st=new De({componentDatatype:Ce.FLOAT,componentsPerAttribute:2,values:this._riverInfo.uvs}),this._maxLng&&this._minLat&&(E.st2=new De({componentDatatype:Ce.FLOAT,componentsPerAttribute:2,values:this._riverInfo.uvs2}));const I=new gr({attributes:E,indices:this._riverInfo.indices,primitiveType:yr.TRIANGLES,boundingSphere:_r.fromVertices(x)}),R=[],P=new $e({geometry:I});t&&R.push(t),R.push(P),d.geometryInstances=R,d._state=vr.READY,d._updateVertex=!0},this._viewer.scene.primitives.add(d),this._riverPrimitives.push(d);const f=this._viewer;if(!f.scene._waterPassEvent){let _=!1;f.scene._worldENU=new SuperMap3D.Matrix4,f.scene._cameraENU=new SuperMap3D.Matrix4,f.scene._lastCameraPosition=new SuperMap3D.Cartesian3,f.scene._waterPassEvent=f.scene.postUpdate.addEventListener(()=>{const g=f.camera.positionWC;if(SuperMap3D.Cartesian3.distance(g,f.scene._lastCameraPosition)>5e3){const C=SuperMap3D.Cartographic.fromCartesian(g),b=SuperMap3D.Cartesian3.fromRadians(C.longitude,C.latitude,0);SuperMap3D.Transforms.eastNorthUpToFixedFrame(b,SuperMap3D.Ellipsoid.WGS84,f.scene._worldENU),SuperMap3D.Matrix4.inverse(f.scene._worldENU,f.scene._cameraENU),SuperMap3D.Cartesian3.clone(g,f.scene._lastCameraPosition)}if(!_&&d._colorCommands&&d._colorCommands.length>0){let C=d._colorCommands[0].derivedCommands.logDepth.command;C.derivedCommands.hdr&&(C=C.derivedCommands.hdr.command);const b=C.execute;C.execute=function(D,w){SuperMap3D.defined(f.scene.view.globeDepth)&&f.scene.view.globeDepth.executeCopyDepth(D,w),SuperMap3D.defined(f.scene._colorCopyCommand)&&f.scene._colorCopyCommand.update(f.scene.frameState),b.bind(this)(D,w)},_=!0}})}}getWaterAppearance(){if(!this._riverAppearance){this._normalMap=this._viewer.scene.frameState.context.defaultTexture,St.fetchImage({url:this._sss?wr("Assets/Data/normal004.jpg"):wr("Assets/Data/waternormals.jpg")}).then(r=>{this._normalMap=new Ct({context:this._viewer.scene.frameState.context,source:r,sampler:new Dt({minificationFilter:Pt.LINEAR_MIPMAP_LINEAR})}),this._normalMap.generateMipmap()}),this._viewer.scene._reflectTexture||(this._viewer.scene._reflectTexture=new yt({scene:this._viewer.scene,planeCenterPos:this._planeCenterPos,planeHeight:this._planeHeight,isClipPlane:!0,renderState:!1,renderMode:this._renderMode2,renderPass:this._renderPass2})),this._riverAppearance=new cr(this),this._riverAppearance.material._uniforms.normalTexture=()=>this._normalMap,this._riverAppearance.material._uniforms.refractTexture=()=>{var n;const r=(n=this._viewer.scene._colorCopyCommand)==null?void 0:n.colorTexture;return r||this._viewer.scene.context.defaultTexture},this._riverAppearance.material._uniforms.reflectTexture=()=>{var r;return A((r=this._viewer.scene._reflectTexture)==null?void 0:r.colorTexture,this._viewer.scene.context.defaultTexture)},this._riverAppearance.material._uniforms.globeDepthTexture=()=>A(this._viewer.scene.context.uniformState.globeDepthTexture,this._viewer.scene.context.defaultTexture);let e=this._viewer.scene.frameState.context.defaultTexture;this._riverMaskMapUrl&&St.fetchImage({url:this._riverMaskMapUrl}).then(r=>{e=new Ct({context:this._viewer.scene.frameState.context,source:r,sampler:new Dt({minificationFilter:Pt.LINEAR_MIPMAP_LINEAR})}),e.generateMipmap()}),this._riverAppearance.material._uniforms.riverMaskTexture=()=>A(e,this._viewer.scene.context.defaultTexture),this._riverAppearance.material._uniforms.cameraEastNorthUp=()=>this._viewer.scene._cameraENU,this._riverAppearance.material._uniforms.worldEastNorthUp=()=>this._viewer.scene._worldENU,this._riverAppearance.material._uniforms.viewerPositionWC=()=>this._viewer.camera.positionWC,this._riverAppearance.material._uniforms.inverseView=()=>this._viewer.camera.inverseViewMatrix;let t=new Gi;this._riverAppearance.material._uniforms.inverseViewRotation=()=>(Oi.getMatrix3(this._viewer.camera.inverseViewMatrix,t),t),this._viewer.scene._colorCopyCommand||(this._viewer.scene._colorCopyCommand=new pe),this._riverAppearance.material.uniforms.u_underwater=this._underwater,this._riverAppearance.material.uniforms.u_waterSpeed=120,this._riverAppearance.material.uniforms.u_waterHeight=this._waterHeight}}set waterHeight(e){this._updateHeight(Number(e))}set reflectHeight(e){this._viewer.scene._reflectTexture._planeHeight=e}set showReflect(e){this._viewer.scene._reflectTexture._renderState=e,this._riverAppearance.material.uniforms.showReflect=e}get showReflect(){return this._viewer.scene._reflectTexture._renderState}loadPolygonRive(e,t){if(e.positions.length<=0)return!1;const r=new v;let n=0;for(let d=0;d<e.positions.length;d++){const f=e.positions[d];v.add(r,f,r),n+=1}this._planeCenterPos=v.multiplyByScalar(r,1/n,r);const o=v.subtract(e.positions[0],this._planeCenterPos,new v),a=v.subtract(e.positions[1],this._planeCenterPos,new v),i=v.cross(o,a,new v);this._planeNormal=v.normalize(i,new v),this.getWaterAppearance();const s=new Dr({polygonHierarchy:new Mr(e.positions),perPositionHeight:!1,height:this._offsetHeight}),l=[],h=new $e({geometry:s});t&&l.push(t),l.push(h);const u=new Cr({geometryInstances:l,appearance:this._riverAppearance,asynchronous:!1,shadows:br.RECEIVE_ONLY,isWater:!0});this._updateHeight=d=>{const f=new Dr({polygonHierarchy:new Mr(e.positions),perPositionHeight:!1,height:d}),_=[],g=new $e({geometry:f});t&&_.push(t),_.push(g),u.geometryInstances=_,u._state=vr.READY,u._updateVertex=!0},this._viewer.scene.primitives.add(u),this._riverPrimitives.push(u);const p=this._viewer;if(!p.scene._waterPassEvent){let d=!1;p.scene._worldENU=new SuperMap3D.Matrix4,p.scene._cameraENU=new SuperMap3D.Matrix4,p.scene._lastCameraPosition=new SuperMap3D.Cartesian3,p.scene._waterPassEvent=p.scene.postUpdate.addEventListener(()=>{const f=p.camera.positionWC;if(SuperMap3D.Cartesian3.distance(f,p.scene._lastCameraPosition)>5e3){const _=SuperMap3D.Cartographic.fromCartesian(f),g=SuperMap3D.Cartesian3.fromRadians(_.longitude,_.latitude,0);SuperMap3D.Transforms.eastNorthUpToFixedFrame(g,SuperMap3D.Ellipsoid.WGS84,p.scene._worldENU),SuperMap3D.Matrix4.inverse(p.scene._worldENU,p.scene._cameraENU),SuperMap3D.Cartesian3.clone(f,p.scene._lastCameraPosition)}if(!d&&u._colorCommands&&u._colorCommands.length>0){let _=u._colorCommands[0].derivedCommands.logDepth.command;_.derivedCommands.hdr&&(_=_.derivedCommands.hdr.command);const g=_.execute;_.execute=function(C,b){SuperMap3D.defined(p.scene.view.globeDepth)&&p.scene.view.globeDepth.executeCopyDepth(C,b),SuperMap3D.defined(p.scene._colorCopyCommand)&&p.scene._colorCopyCommand.update(p.scene.frameState),g.bind(this)(C,b)},d=!0}})}}draw(e="polyline",t={}){t.height&&(this._planeHeight=t.height),e==="polyline"?dt.drawPolyLine(this._viewer,t).then(r=>{this.loadPolylineRive(r),this._viewer.entities.remove(r.polyline)}):dt.drawPolygon(this._viewer,t).then(r=>{this.loadPolygonRive(r),this._viewer.entities.remove(r.polygon)})}destroy(){return this._riverPrimitives.length>0&&(this._riverPrimitives.forEach(e=>{this._viewer.scene.primitives.remove(e)}),this._reflectTexture&&this._reflectTexture.destroy(),this._riverAppearance.showReflect=!1,this._riverAppearance.showRefract=!1),Ui(this)}}var Bi=`precision highp float;\r
precision highp sampler2D;\r
varying vec3 v_positionWC;\r
varying vec3 v_eye;\r
varying float v_dataId;\r
varying vec4 v_findColor;\r
varying vec4 v_color2;\r
varying vec2 v_UV;\r
varying vec4 v_position;\r
varying vec4 v_dataValue;\r
#define M3D_GBUFFER_WATER\r
#define M3D_GBUFFER_WATERSIM\r
uniform sampler2D normalTexture;\r
uniform sampler2D u_refractTexture;\r
uniform sampler2D u_reflectTexture;\r
uniform sampler2D globeDepthTexture;\r
uniform vec4 baseColor;\r
uniform float u_WaterDepth;\r
uniform vec4 u_WaterShallowColor;\r
uniform float u_WaterShallowColorAlpha;\r
uniform vec4 u_WaterDeepColor;\r
uniform float u_WaterDeepColorAlpha;\r
uniform vec4 u_HorizonColor;\r
uniform float u_HorizonDistance;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
uniform mat3 inverseViewRotation;\r
uniform vec4 u_config;\r
#define saturate(x)    clamp(x, 0.0, 1.0)\r
#define frac(v)    v - floor(v)

const float oceanFrequencyHighAltitude = 12500.0 / 5.;\r
const float oceanAnimationSpeedHighAltitude = 0.08;\r
const float oceanOneOverAmplitudeHighAltitude = 1.0 / 2.0;\r
uniform float oceanFrequencyLowAltitude;\r
uniform float oceanAnimationSpeedLowAltitude;\r
uniform float oceanOneOverAmplitudeLowAltitude;\r
uniform float shiny;\r
uniform float spec;\r
const float diffuse = 0.5;

vec3 lighting_sss(int type, vec3 n, vec3 l, vec3 rd, vec3 kl, vec3 kd, vec3 ks, vec3 ksr, float km, float kn) {\r
    float ndl = dot(n, l); 

    float pndl = clamp( ndl, 0., 1.), 
    nndl = clamp(-ndl, 0., 1.); 

    
    vec3 sss;\r
    

    
    
    
    sss = .2 * exp(-3.*abs(ndl)/(ksr+.001));\r
    vec3 h = normalize(l - rd); 

    float ndh = dot(n, h); 

    
    float g = ndh*ndh * (km*km - 1.) + 1.;\r
    float ggx = km*km / (3.141592*g*g);

    

    float fre = 1.+dot(rd, n); 

    
    float f0 = (kn-1.)/(kn+1.);\r
    f0 = f0*f0;\r
    float kr = f0 + (1.-f0)*(1.-km)*(1.-km) * pow(fre, 5.); 
    return kl*(pndl*(kd + kr*ggx) + kd*ks*ksr*sss); 
}

void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, inout vec3 diffuseColor, inout vec3 specularColor ) {\r
    vec3 reflection = normalize( reflect( -czm_sunDirectionEC, surfaceNormal ) );\r
    float direction = max( 0.0, dot( eyeDirection, reflection ) );\r
    vec3 viewDir = normalize(viewerPositionWC);\r
    vec3 sunDir = normalize(czm_sunPositionWC);\r
    float cosTheta = dot(viewDir, sunDir);\r
    cosTheta = cosTheta < 0. ? 0. : 1.;\r
    specularColor += pow( direction, shiny ) * czm_lightColor * spec * cosTheta;\r
    diffuseColor += max( dot( czm_sunDirectionEC, surfaceNormal ), 0.0 ) * czm_lightColor * diffuse;\r
}\r
float waveFade(float edge0, float edge1, float x)\r
{\r
    float y = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
    return pow(1.0 - y, 5.0);\r
}\r
float linearFade(float edge0, float edge1, float x)\r
{\r
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
}\r
vec3 RGBToHSV(vec3 rgb) {\r
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\r
    vec4 P = mix(vec4(rgb.bg, K.wz), vec4(rgb.gb, K.xy), step(rgb.b, rgb.g));\r
    vec4 Q = mix(vec4(P.xyw, rgb.r), vec4(rgb.r, P.yzx), step(P.x, rgb.r));\r
    float D = Q.x - min(Q.w, Q.y);\r
    float E = 1.0e-10;\r
    return vec3(abs(Q.z + (Q.w - Q.y)/(6.0 * D + E)), D / (Q.x + E), Q.x);\r
}

vec3 HSVToRGB(vec3 hsv) {\r
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\r
    vec3 P = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);\r
    return hsv.z * mix(K.xxx, saturate(P - K.xxx), hsv.y);\r
}

vec4 HSVLerp(vec4 A, vec4 B, float T) {\r
    A.xyz = RGBToHSV(A.xyz);\r
    B.xyz = RGBToHSV(B.xyz);

    float t = T; 

    float hue;\r
    float d = B.x - A.x; 

    if(A.x > B.x) {\r
        float temp = B.x;\r
        B.x = A.x;\r
        A.x = temp;

        d = -d;\r
        T = 1.0 - t;\r
    }

    if(d > 0.5) {\r
        A.x = A.x + 1.0;\r
        hue = mod((A.x + t * (B.x - A.x)), 1.0);\r
    }

    if(d <= 0.5) hue = A.x + t * d;

    float sat = A.y + t * (B.y - A.y);\r
    float val = A.z + t * (B.z - A.z);\r
    float alpha = A.w + t * (B.w - A.w);

    vec3 rgb = HSVToRGB(vec3(hue,sat,val));

    return vec4(rgb, alpha);\r
}\r
vec3 getWorldSpaceScenePosition(vec2 uv) {\r
    vec3 viewVector = -(v_eye - v_positionWC);\r
    float screenPositionZ = gl_FragCoord.z/gl_FragCoord.w;\r
    screenPositionZ = log2(screenPositionZ) * czm_oneOverLog2FarDepthFromNearPlusOne;\r
    float sceneDepthZ = czm_unpackDepth(texture(globeDepthTexture, uv)); 
    viewVector = viewVector / screenPositionZ;\r
    viewVector = viewVector * sceneDepthZ;\r
    viewVector = viewVector + v_eye;\r
    return viewVector;\r
}\r
float Fresnel(vec3 vNormal , float power) {\r
    vec3 normal = vNormal;\r
    vec3 viewDir = normalize(v_eye - v_positionWC);

    return pow((1.0 - saturate(dot(normalize(normal), normalize(viewDir)))), power);\r
}\r
vec4 Overwrite(vec4 Base, vec4 Blend, float Opacity) {\r
    return mix(Base, Blend, Opacity);\r
}\r
vec4 LinearDodge(vec4 Base, vec4 Blend, float Opacity) {\r
    vec4 Out = Base + Blend;\r
    Out = mix(Base, Out, Opacity);\r
    return Out;\r
}\r
vec4 overlay(vec4 base, vec4 over, float blend) {\r
float overAlpha = saturate(over.a);

vec4 overwriteResult = Overwrite(base, over, overAlpha);\r
vec4 linearDodgedResult = LinearDodge(base, over, overAlpha);

return mix(overwriteResult, linearDodgedResult, blend);\r
}

#define MOD2 vec2(4.438975,3.972973)\r
const int k_fbmWaterSteps = 4;\r
float Hash( float p )\r
{\r
    
    vec2 p2 = fract(vec2(p) * MOD2);\r
    p2 += dot(p2.yx, p2.xy+19.19);\r
    return fract(p2.x * p2.y);\r
    
}\r
vec2 Hash2( float p )\r
{\r
    
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));\r
    p3 += dot(p3, p3.yzx + 19.19);\r
    return fract((p3.xx+p3.yz)*p3.zy);\r
}\r
vec3 SmoothNoise_DXY(in vec2 o)\r
{\r
    vec2 p = floor(o);\r
    vec2 f = fract(o);

    float n = p.x + p.y*57.0;

    float a = Hash(n+  0.0);\r
    float b = Hash(n+  1.0);\r
    float c = Hash(n+ 57.0);\r
    float d = Hash(n+ 58.0);

    vec2 f2 = f * f;\r
    vec2 f3 = f2 * f;

    vec2 t = 3.0 * f2 - 2.0 * f3;\r
    vec2 dt = 6.0 * f - 6.0 * f2;

    float u = t.x;\r
    float v = t.y;\r
    float du = dt.x;\r
    float dv = dt.y;

    float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;

    float dx = (b-a)*du + (a-b+d-c)*du*v;\r
    float dy = (c-a)*dv + (a-b+d-c)*u*dv;

    return vec3(dx, dy, res);\r
}\r
vec3 FBM_DXY( vec2 p, vec2 flow, float ps, float df ) {\r
    vec3 f = vec3(0.0);\r
    float tot = 0.0;\r
    float a = 1.0;\r
    
    for( int i=0; i<k_fbmWaterSteps; i++)\r
    {\r
        p += flow;\r
        flow *= -0.75; 
        vec3 v = SmoothNoise_DXY( p );\r
        f += v * a;\r
        p += v.xy * df;\r
        p *= 2.0;\r
        tot += a;\r
        a *= ps;\r
    }\r
    return f / tot;\r
}\r
float SampleWaterFoam( vec2 vUV, vec2 vFlowOffset, float fFoam )\r
{\r
    float f =  FBM_DXY(vUV * 30.0, vFlowOffset * 50.0, 0.8, fFoam ).z;\r
    float fAmount = 0.2;\r
    f = max( 0.0, (f - fAmount) / fAmount );\r
    return pow( 0.5, f );\r
}\r
vec4 SampleWaterNormal( vec2 vUV, vec2 vFlowOffset, float fMag, float fFoam ) {\r
    vec2 vFilterWidth = max(abs(dFdx(vUV)), abs(dFdy(vUV)));\r
    float fFilterWidth = max(vFilterWidth.x, vFilterWidth.y);\r
    float fScale = (1.0 / (1.0 + fFilterWidth * fFilterWidth * 2000.0));\r
    float fGradientAscent = 0.5 + (fFoam * -1.5);\r
    vec3 dxy = FBM_DXY(vUV * 300.0, vFlowOffset * 20.0, 0.75 + fFoam * 0.25, fGradientAscent);\r
    fScale *= max(0.25, 1.0 - fFoam * 5.0);\r
    vec3 vBlended = mix( vec3(0.0, 1.0, 0.0), normalize( vec3(dxy.x, fMag, dxy.y) ), fScale );\r
    return vec4( normalize( vBlended ), dxy.z * fScale );\r
}\r
const float PI = 3.1415927;\r
const int   ARROW_V_STYLE = 1;\r
const int   ARROW_LINE_STYLE = 2;

const int   ARROW_STYLE = ARROW_LINE_STYLE;\r
const float ARROW_TILE_SIZE = 32.0;

const float ARROW_HEAD_ANGLE = 45.0 * PI / 180.0;

const float ARROW_HEAD_LENGTH = ARROW_TILE_SIZE / 6.0;\r
const float ARROW_SHAFT_THICKNESS = 3.0;

vec2 arrowTileCenterCoord(vec2 pos) {\r
    return (floor(pos / ARROW_TILE_SIZE) + 0.5) * ARROW_TILE_SIZE;\r
}\r
float arrow(vec2 p, vec2 v) {\r
    
    p -= arrowTileCenterCoord(p);\r
    float mag_v = length(v), mag_p = length(p);\r
    if (mag_v > 0.0) {\r
        vec2 dir_p = p / mag_p, dir_v = v / mag_v;\r
        mag_v = clamp(mag_v, 5.0, ARROW_TILE_SIZE / 2.0);\r
        v = dir_v * mag_v;\r
        float dist;\r
        if (ARROW_STYLE == ARROW_LINE_STYLE) {\r
            
            

            
            dist =\r
                max(\r
                    
                    ARROW_SHAFT_THICKNESS / 4.0 -\r
                        max(abs(dot(p, vec2(dir_v.y, -dir_v.x))), 
                            abs(dot(p, dir_v)) - mag_v + ARROW_HEAD_LENGTH / 2.0), 

                    
                    min(0.0, dot(v - p, dir_v) - cos(ARROW_HEAD_ANGLE / 2.0) * length(v - p)) * 2.0 + 
                    min(0.0, dot(p, dir_v) + ARROW_HEAD_LENGTH - mag_v)); 
        } else {\r
            
            dist = min(0.0, mag_v - mag_p) * 2.0 + 
                min(0.0, dot(normalize(v - p), dir_v) - cos(ARROW_HEAD_ANGLE / 2.0)) * 2.0 * length(v - p) + 
                min(0.0, dot(p, dir_v) + 1.0) + 
                min(0.0, cos(ARROW_HEAD_ANGLE / 2.0) - dot(normalize(v * 0.33 - p), dir_v)) * mag_v * 0.8; 
        }

        return clamp(1.0 + dist, 0.0, 1.0);\r
    } else {\r
        
        return max(0.0, 1.2 - mag_p);\r
    }\r
}

//////////////////// 3D OpenSimplex2S noise with derivatives  ////////////////////\r
//////////////////// Output: vec4(dF/dx, dF/dy, dF/dz, value) ////////////////////

vec4 permute(vec4 t) {\r
    return t * (t * 34.0 + 133.0);\r
}

vec3 grad(float hash) {

    
    vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;

    
    
    
    vec3 cuboct = cube;\r
    cuboct[int(hash / 16.0)] = 0.0;

    
    float type = mod(floor(hash / 8.0), 2.0);\r
    vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));

    
    
    vec3 grad = cuboct * 1.22474487139 + rhomb;

    
    
    
    grad *= (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;

    return grad;\r
}

vec4 os2NoiseWithDerivativesPart(vec3 X) {\r
    vec3 b = floor(X);\r
    vec4 i4 = vec4(X - b, 2.5);

    
    vec3 v1 = b + floor(dot(i4, vec4(.25)));\r
    vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35)));\r
    vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35)));\r
    vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35)));

    
    vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0));\r
    hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0));\r
    hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0);

    
    vec3 d1 = X - v1; vec3 d2 = X - v2; vec3 d3 = X - v3; vec3 d4 = X - v4;\r
    vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0);\r
    vec4 aa = a * a; vec4 aaaa = aa * aa;\r
    vec3 g1 = grad(hashes.x); vec3 g2 = grad(hashes.y);\r
    vec3 g3 = grad(hashes.z); vec3 g4 = grad(hashes.w);\r
    vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4));

    
    vec3 derivative = -8.0 * mat4x3(d1, d2, d3, d4) * (aa * a * extrapolations)\r
        + mat4x3(g1, g2, g3, g4) * aaaa;

    
    return vec4(derivative, dot(aaaa, extrapolations));\r
}

vec4 os2NoiseWithDerivatives_Fallback(vec3 X) {\r
    X = dot(X, vec3(2.0/3.0)) - X;

    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(dot(result.xyz, vec3(2.0/3.0)) - result.xyz, result.w);\r
}

vec4 os2NoiseWithDerivatives_ImproveXY(vec3 X) {

    
    mat3 orthonormalMap = mat3(\r
        0.788675134594813, -0.211324865405187, -0.577350269189626,\r
        -0.211324865405187, 0.788675134594813, -0.577350269189626,\r
        0.577350269189626, 0.577350269189626, 0.577350269189626);

    X = orthonormalMap * X;\r
    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(result.xyz * orthonormalMap, result.w);\r
}\r
//////////////////////////////// End noise code ////////////////////////////////

float normpdf(in float x, in float sigma) {\r
    return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;\r
}

vec4 gaussianBlur(sampler2D blurTexture, vec2 distortedUv) {\r
    const int mSize = 11;\r
    const int kSize = (mSize - 1) / 2;\r
    float kernel[mSize];\r
    vec3 final_colour = vec3(0.0);\r
    float sigma = 7.;\r
    float Z = 0.0;\r
    
    for(int j = 0; j <= kSize; ++j) {\r
        kernel[kSize + j] = kernel[kSize - j] = normpdf(float(j), sigma);\r
    }\r
    
    for(int j = 0; j < mSize; ++j) {\r
        Z += kernel[j];\r
    }\r
    
    for(int i = -kSize; i <= kSize; ++i) {\r
        for(int j = -kSize; j <= kSize; ++j) {\r
            vec2 uvDxDy = distortedUv + vec2(float(i), float(j)) / czm_viewport.zw;\r
            final_colour += kernel[kSize + j] * kernel[kSize + i] * texture(blurTexture, uvDxDy).rgb;\r
        }\r
    }\r
    return vec4(vec3(final_colour / (Z * Z)),1.);\r
}\r
czm_material czm_getMaterial(czm_materialInput materialInput) {\r
    czm_material material = czm_getDefaultMaterial(materialInput);\r
    vec2 st = materialInput.st;\r
    float alpha = v_findColor.a;\r
    if(alpha == 0.){\r
        material.alpha = 0.;\r
        return material;\r
    }\r
    vec4 findColor = v_findColor;

    
    if(u_showArrow){\r
        vec4 color = (arrow(v_positionWC.xy * u_arrowSize, arrowTileCenterCoord(vec2(0.5)) * v_UV)) * v_color2;\r
        findColor = mix(findColor , color , u_lerpNum2);\r
    }

    
    material.diffuse = findColor.rgb;\r
    
    if(u_baseColorType != 0.){\r
        
        
        vec2 screenUV = gl_FragCoord.xy / czm_viewport.zw;\r
        vec3 worldPosition = v_positionWC;\r
        
        vec4 noise;\r
        float fresnel;\r
        vec3 surfaceNormal;\r
        vec3 normalTangentSpace;\r
        #ifdef FBM_NORMAL\r
            float fscale = u_config.w;\r
            float flowMapOffset0 =  u_config.x;\r
            float flowMapOffset1 = u_config.y;\r
            float halfCycle = u_config.z;\r
            float fMag = 1.0, fFoam = 0.0;\r
            float flowScale = 2.01;\r
            vec2 u_waveScale = vec2(1.,1.);\r
            float u_waveIntensity = 1.;\r
            float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;\r
            vec4 normalColor0 = SampleWaterNormal(   materialInput.st  * fscale * u_waveScale,  -v_UV * flowScale* flowMapOffset0, fMag, fFoam );\r
            vec4 normalColor1 = SampleWaterNormal(  materialInput.st * fscale * u_waveScale,  -v_UV * flowScale* flowMapOffset1, fMag, fFoam );\r
            vec4 clr1 = mix( normalColor0, normalColor1, flowLerp );\r
            vec3 normal = normalize( vec3(clr1.r, clr1.g, clr1.b) );\r
            normalTangentSpace = czm_normal *  normal;\r
            noise = vec4(normal,1.);\r
            surfaceNormal = normalize( normalTangentSpace.xzy * vec3( 1.5, 1.0, 1.5 ) );\r
            fresnel = 0.;\r
        #else\r
            
            float positionToEyeECLength = length(materialInput.positionToEyeEC);\r
            float waveIntensity = waveFade(70000.0, 1000000.0, positionToEyeECLength);\r
            
            float time = czm_frameNumber * oceanAnimationSpeedHighAltitude;\r
            noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyHighAltitude, time, 0.0);\r
            vec3 normalTangentSpaceHighAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeHighAltitude);

            
            time = czm_frameNumber * oceanAnimationSpeedLowAltitude;\r
            noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyLowAltitude, time, 0.0);\r
            vec3 normalTangentSpaceLowAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeLowAltitude);

            
            float highAltitudeFade = linearFade(0.0, 60000.0, positionToEyeECLength);\r
            float lowAltitudeFade = 1.0 - linearFade(20000.0, 60000.0, positionToEyeECLength);\r
            normalTangentSpace =\r
                (highAltitudeFade * normalTangentSpaceHighAltitude) +\r
                (lowAltitudeFade * normalTangentSpaceLowAltitude);

            normalTangentSpace.xy *= waveIntensity;

            
            normalTangentSpace = normalize(normalTangentSpace);

            
            surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );\r
            fresnel = Fresnel(normalTangentSpace,u_HorizonDistance);\r
        #endif

        
        vec2 distortedScreenUV = screenUV + vec2(noise.x * u_noiseIntensity, 0.0);\r
        
        vec3 worldSpaceScenePosition = getWorldSpaceScenePosition(distortedScreenUV);

        float cmpWaterDepth = (worldPosition - worldSpaceScenePosition).b;\r
        if(cmpWaterDepth <= 0.0) {\r
            distortedScreenUV = screenUV;\r
            worldSpaceScenePosition = getWorldSpaceScenePosition(distortedScreenUV);\r
        }\r
        float shoreDepth = (worldPosition - worldSpaceScenePosition).b;\r
        float shore = saturate(exp(-shoreDepth / u_WaterDepth));

        
        vec4 color = HSVLerp(\r
            vec4(u_WaterDeepColor.rgb, u_WaterDeepColorAlpha),\r
            vec4(u_WaterShallowColor.rgb, u_WaterShallowColorAlpha),\r
            shore\r
        );

        
        
        color = HSVLerp(color, vec4(u_HorizonColor.rgb, 1.0), fresnel);

        
        vec4 sceneColor = vec4(0.);\r
        sceneColor.rgba = gaussianBlur(u_refractTexture, distortedScreenUV);\r
        
        vec3 X = vec3( materialInput.st / u_causticScale, mod(czm_frameNumber/u_causticSpeed, 578.0) * 0.8660254037844386);\r
        vec4 noiseResult = os2NoiseWithDerivatives_ImproveXY(X);\r
        noiseResult = os2NoiseWithDerivatives_ImproveXY(X - noiseResult.xyz / 16.0);\r
        float value = noiseResult.w;\r
        vec3 col = u_causticColor.rgb * (0.5 + 0.5 * value);\r
        sceneColor.rgb += col * saturate(exp(-shoreDepth / u_causticIntersectionFade));\r
        
        
        float underwaterFactor = 1.0 - color.a;\r
        color.rgb += sceneColor.rgb * underwaterFactor;

        
        if(u_showReflect){\r
            vec2 reflectUV = vec2(screenUV.x, screenUV.y);\r
            reflectUV += vec2(noise.x * u_noiseIntensity, 0.0);\r
            vec4 reflected = gaussianBlur(u_reflectTexture, reflectUV);\r
            float reflectionFresnel = Fresnel(normalTangentSpace,u_ReflectionFresnelPower);\r
            reflectionFresnel *= u_ReflectionStrength;\r
            vec4 finalReflectionColor = mix(vec4(0.0), reflected, reflectionFresnel);\r
            color = overlay(color, finalReflectionColor, u_ReflectionMix);\r
        }

        
        float time2 = czm_frameNumber / u_FoamSpeed;\r
        vec2 vUV = materialInput.st;\r
        float t0 = fract( time2 );\r
        float t1 = fract( time2 + 0.5 );\r
        float o0 = t0 - 0.5;\r
        float o1 = t1 - 0.5;\r
        float i0 = floor( time2 );\r
        float i1 = floor( time2 + 0.5 );\r
        vec2 vUV0 = vUV + Hash2(i0);\r
        vec2 vUV1 = vUV + Hash2(i1);\r
        float weight = abs( t0 - 0.5 ) * 1.0;\r
        if(!u_FoamFlow){\r
            float foam0 = SampleWaterFoam( vUV0 * u_FoamScale, -v_UV * o0 * 0.25, -0.5 );\r
            float foam1 = SampleWaterFoam( vUV1 * u_FoamScale, -v_UV * o1 * 0.25,  -0.5);\r
            float fOutFoamTex = mix( foam0, foam1, weight );\r
            float intersectionFoamDepth = saturate(exp(-shoreDepth / u_FoamIntersectionFade));\r
            color = overlay(color, vec4(vec3(1.0-fOutFoamTex),intersectionFoamDepth), u_FoamBlend);\r
        }else{\r
            float foam0 = SampleWaterFoam( vUV0 * u_FoamScale, -v_UV * o0 * 0.25, 1.5 );\r
            float foam1 = SampleWaterFoam( vUV1 * u_FoamScale, -v_UV * o1 * 0.25,  1.5 );\r
            float fOutFoamTex = mix( foam0, foam1, weight );\r
            float intersectionFoamDepth = 1.0 - saturate(exp(-shoreDepth / u_FoamIntersectionFade));\r
            color = overlay(color, vec4(vec3(fOutFoamTex),intersectionFoamDepth), u_FoamBlend);\r
        }\r
        vec3 diffuseLight = vec3(0.0);\r
        vec3 specularLight = vec3(0.0);

        vec3 worldToEye = materialInput.positionToEyeEC;\r
        vec3 eyeDirection = normalize( worldToEye );\r
        #ifdef IS_SSS\r
            material.diffuse = (mix(findColor.rgb,baseColor.rgb,u_baseColorType) + color.rgb) * luminance;\r
            const float pdf = 1.0 / 3.14159265359;\r
            vec3 sssCol = vec3(0.6);\r
            vec3 sssRad = 3. * material.diffuse;\r
            int type = 0;\r
            vec3 n = normalize(inverseViewRotation * normalTangentSpace.xzy);\r
            vec3 n2 = normalize(inverseViewRotation * normalTangentSpace.xyz);\r
            vec3 rd = normalize(v_position.xyz - viewerPositionWC);\r
            vec3 sunDir = normalize(czm_sunPositionWC);\r
            vec3 col2 =\r
            lighting_sss(type, n, sunDir, rd, vec3(1), material.diffuse, sssCol, sssRad, .04, 10.) + 
            lighting_sss(type, n2, normalize(.1 * viewerPositionWC), rd, vec3(.25), material.diffuse, sssCol, sssRad, .04, 3.5);  
            material.diffuse += pdf * col2;\r
        #else

            sunLight( surfaceNormal, eyeDirection, diffuseLight, specularLight );\r
            material.diffuse = (specularLight + mix(findColor.rgb,baseColor.rgb,u_baseColorType) * u_mut + color.rgb) * luminance;\r
        #endif\r
        material.normal = normalize(materialInput.tangentToEyeMatrix * normalTangentSpace);\r
        material.shininess = 20.0;\r
    }

    
    
    
    material.alpha = alpha;\r
    return material;\r
}`,$i=`precision highp float;\r
precision highp sampler2D;\r
uniform sampler2D u_colorTable;\r
uniform sampler2D u_colorTable2;\r
uniform sampler2D normalTexture;\r
uniform sampler2D u_refractTexture;\r
uniform sampler2D u_reflectTexture;\r
uniform sampler2D u_waterDepthTexture;\r
uniform sampler2D u_waterDepthNextTexture;\r
uniform sampler2D u_waterUV_UTexture;\r
uniform sampler2D u_waterUV_VTexture;\r
uniform sampler2D globeDepthTexture;\r
uniform float u_texWidth;\r
uniform float u_texHeight;\r
uniform float u_minHeight;\r
uniform float u_maxHeight;\r
uniform float u_lerpNum;\r
uniform bool u_alphaLerp;\r
uniform float u_isAlpha;\r
varying vec3 v_positionWC;\r
varying vec3 v_eye;\r
varying float v_dataId;\r
uniform vec4 baseColor;\r
uniform float u_alpha;\r
uniform float u_WaterDepth;\r
uniform vec4 u_WaterShallowColor;\r
uniform float u_WaterShallowColorAlpha;\r
uniform vec4 u_WaterDeepColor;\r
uniform float u_WaterDeepColorAlpha;\r
uniform vec4 u_HorizonColor;\r
uniform float u_HorizonDistance;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
uniform mat3 inverseViewRotation;\r
#define saturate(x)    clamp(x, 0.0, 1.0)\r
#define frac(v)    v - floor(v)

const float oceanFrequencyHighAltitude = 12500.0 / 5.;\r
const float oceanAnimationSpeedHighAltitude = 0.08;\r
const float oceanOneOverAmplitudeHighAltitude = 1.0 / 2.0;\r
uniform float oceanFrequencyLowAltitude;\r
uniform float oceanAnimationSpeedLowAltitude;\r
uniform float oceanOneOverAmplitudeLowAltitude;\r
uniform float shiny;\r
uniform float spec;\r
const float diffuse = 0.5;

void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, inout vec3 diffuseColor, inout vec3 specularColor ) {\r
    vec3 reflection = normalize( reflect( -czm_sunDirectionEC, surfaceNormal ) );\r
    float direction = max( 0.0, dot( eyeDirection, reflection ) );\r
    vec3 viewDir = normalize(viewerPositionWC);\r
    vec3 sunDir = normalize(czm_sunPositionWC);\r
    float cosTheta = dot(viewDir, sunDir);\r
    cosTheta = cosTheta < 0. ? 0. : 1.;\r
    specularColor += pow( direction, shiny ) * czm_lightColor * spec * cosTheta;\r
    diffuseColor += max( dot( czm_sunDirectionEC, surfaceNormal ), 0.0 ) * czm_lightColor * diffuse;\r
}\r
float waveFade(float edge0, float edge1, float x)\r
{\r
    float y = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
    return pow(1.0 - y, 5.0);\r
}\r
float linearFade(float edge0, float edge1, float x)\r
{\r
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);\r
}\r
vec3 RGBToHSV(vec3 rgb) {\r
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\r
    vec4 P = mix(vec4(rgb.bg, K.wz), vec4(rgb.gb, K.xy), step(rgb.b, rgb.g));\r
    vec4 Q = mix(vec4(P.xyw, rgb.r), vec4(rgb.r, P.yzx), step(P.x, rgb.r));\r
    float D = Q.x - min(Q.w, Q.y);\r
    float E = 1.0e-10;\r
    return vec3(abs(Q.z + (Q.w - Q.y)/(6.0 * D + E)), D / (Q.x + E), Q.x);\r
}

vec3 HSVToRGB(vec3 hsv) {\r
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\r
    vec3 P = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);\r
    return hsv.z * mix(K.xxx, saturate(P - K.xxx), hsv.y);\r
}

vec4 HSVLerp(vec4 A, vec4 B, float T) {\r
    A.xyz = RGBToHSV(A.xyz);\r
    B.xyz = RGBToHSV(B.xyz);

    float t = T; 

    float hue;\r
    float d = B.x - A.x; 

    if(A.x > B.x) {\r
        float temp = B.x;\r
        B.x = A.x;\r
        A.x = temp;

        d = -d;\r
        T = 1.0 - t;\r
    }

    if(d > 0.5) {\r
        A.x = A.x + 1.0;\r
        hue = mod((A.x + t * (B.x - A.x)), 1.0);\r
    }

    if(d <= 0.5) hue = A.x + t * d;

    float sat = A.y + t * (B.y - A.y);\r
    float val = A.z + t * (B.z - A.z);\r
    float alpha = A.w + t * (B.w - A.w);

    vec3 rgb = HSVToRGB(vec3(hue,sat,val));

    return vec4(rgb, alpha);\r
}\r
vec3 getWorldSpaceScenePosition(vec2 uv) {\r
    vec3 viewVector = -(v_eye - v_positionWC);\r
    float screenPositionZ = gl_FragCoord.z/gl_FragCoord.w;\r
    screenPositionZ = log2(screenPositionZ) * czm_oneOverLog2FarDepthFromNearPlusOne;\r
    float sceneDepthZ = czm_unpackDepth(texture(globeDepthTexture, uv)); 
    viewVector = viewVector / screenPositionZ;\r
    viewVector = viewVector * sceneDepthZ;\r
    viewVector = viewVector + v_eye;\r
    return viewVector;\r
}\r
float Fresnel(vec3 vNormal , float power) {\r
    vec3 normal = vNormal;\r
    vec3 viewDir = normalize(v_eye - v_positionWC);

    return pow((1.0 - saturate(dot(normalize(normal), normalize(viewDir)))), power);\r
}\r
vec4 Overwrite(vec4 Base, vec4 Blend, float Opacity) {\r
    return mix(Base, Blend, Opacity);\r
}\r
vec4 LinearDodge(vec4 Base, vec4 Blend, float Opacity) {\r
    vec4 Out = Base + Blend;\r
    Out = mix(Base, Out, Opacity);\r
    return Out;\r
}\r
vec4 overlay(vec4 base, vec4 over, float blend) {\r
float overAlpha = saturate(over.a);

vec4 overwriteResult = Overwrite(base, over, overAlpha);\r
vec4 linearDodgedResult = LinearDodge(base, over, overAlpha);

return mix(overwriteResult, linearDodgedResult, blend);\r
}

#define MOD2 vec2(4.438975,3.972973)\r
const int k_fbmWaterSteps = 4;\r
float Hash( float p )\r
{\r
    
    vec2 p2 = fract(vec2(p) * MOD2);\r
    p2 += dot(p2.yx, p2.xy+19.19);\r
    return fract(p2.x * p2.y);\r
    
}\r
vec2 Hash2( float p )\r
{\r
    
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));\r
    p3 += dot(p3, p3.yzx + 19.19);\r
    return fract((p3.xx+p3.yz)*p3.zy);\r
}\r
vec3 SmoothNoise_DXY(in vec2 o)\r
{\r
    vec2 p = floor(o);\r
    vec2 f = fract(o);

    float n = p.x + p.y*57.0;

    float a = Hash(n+  0.0);\r
    float b = Hash(n+  1.0);\r
    float c = Hash(n+ 57.0);\r
    float d = Hash(n+ 58.0);

    vec2 f2 = f * f;\r
    vec2 f3 = f2 * f;

    vec2 t = 3.0 * f2 - 2.0 * f3;\r
    vec2 dt = 6.0 * f - 6.0 * f2;

    float u = t.x;\r
    float v = t.y;\r
    float du = dt.x;\r
    float dv = dt.y;

    float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;

    float dx = (b-a)*du + (a-b+d-c)*du*v;\r
    float dy = (c-a)*dv + (a-b+d-c)*u*dv;

    return vec3(dx, dy, res);\r
}\r
vec3 FBM_DXY( vec2 p, vec2 flow, float ps, float df ) {\r
    vec3 f = vec3(0.0);\r
    float tot = 0.0;\r
    float a = 1.0;\r
    
    for( int i=0; i<k_fbmWaterSteps; i++)\r
    {\r
        p += flow;\r
        flow *= -0.75; 
        vec3 v = SmoothNoise_DXY( p );\r
        f += v * a;\r
        p += v.xy * df;\r
        p *= 2.0;\r
        tot += a;\r
        a *= ps;\r
    }\r
    return f / tot;\r
}\r
float SampleWaterFoam( vec2 vUV, vec2 vFlowOffset, float fFoam )\r
{\r
    float f =  FBM_DXY(vUV * 30.0, vFlowOffset * 50.0, 0.8, fFoam ).z;\r
    float fAmount = 0.2;\r
    f = max( 0.0, (f - fAmount) / fAmount );\r
    return pow( 0.5, f );\r
}\r
float getL(float dataId) {\r
    return floor(mod(dataId, u_texWidth)) / u_texWidth;\r
}\r
float getH(float dataId) {\r
    return floor(dataId / u_texHeight) / u_texHeight;\r
}\r
const float PI = 3.1415927;\r
const int   ARROW_V_STYLE = 1;\r
const int   ARROW_LINE_STYLE = 2;

const int   ARROW_STYLE = ARROW_LINE_STYLE;\r
const float ARROW_TILE_SIZE = 32.0;

const float ARROW_HEAD_ANGLE = 45.0 * PI / 180.0;

const float ARROW_HEAD_LENGTH = ARROW_TILE_SIZE / 6.0;\r
const float ARROW_SHAFT_THICKNESS = 3.0;

vec2 arrowTileCenterCoord(vec2 pos) {\r
    return (floor(pos / ARROW_TILE_SIZE) + 0.5) * ARROW_TILE_SIZE;\r
}\r
float arrow(vec2 p, vec2 v) {\r
    
    p -= arrowTileCenterCoord(p);\r
    float mag_v = length(v), mag_p = length(p);\r
    if (mag_v > 0.0) {\r
        vec2 dir_p = p / mag_p, dir_v = v / mag_v;\r
        mag_v = clamp(mag_v, 5.0, ARROW_TILE_SIZE / 2.0);\r
        v = dir_v * mag_v;\r
        float dist;\r
        if (ARROW_STYLE == ARROW_LINE_STYLE) {\r
            
            

            
            dist =\r
                max(\r
                    
                    ARROW_SHAFT_THICKNESS / 4.0 -\r
                        max(abs(dot(p, vec2(dir_v.y, -dir_v.x))), 
                            abs(dot(p, dir_v)) - mag_v + ARROW_HEAD_LENGTH / 2.0), 

                    
                    min(0.0, dot(v - p, dir_v) - cos(ARROW_HEAD_ANGLE / 2.0) * length(v - p)) * 2.0 + 
                    min(0.0, dot(p, dir_v) + ARROW_HEAD_LENGTH - mag_v)); 
        } else {\r
            
            dist = min(0.0, mag_v - mag_p) * 2.0 + 
                min(0.0, dot(normalize(v - p), dir_v) - cos(ARROW_HEAD_ANGLE / 2.0)) * 2.0 * length(v - p) + 
                min(0.0, dot(p, dir_v) + 1.0) + 
                min(0.0, cos(ARROW_HEAD_ANGLE / 2.0) - dot(normalize(v * 0.33 - p), dir_v)) * mag_v * 0.8; 
        }

        return clamp(1.0 + dist, 0.0, 1.0);\r
    } else {\r
        
        return max(0.0, 1.2 - mag_p);\r
    }\r
}

//////////////////// 3D OpenSimplex2S noise with derivatives  ////////////////////\r
//////////////////// Output: vec4(dF/dx, dF/dy, dF/dz, value) ////////////////////

vec4 permute(vec4 t) {\r
    return t * (t * 34.0 + 133.0);\r
}

vec3 grad(float hash) {

    
    vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;

    
    
    
    vec3 cuboct = cube;\r
    cuboct[int(hash / 16.0)] = 0.0;

    
    float type = mod(floor(hash / 8.0), 2.0);\r
    vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));

    
    
    vec3 grad = cuboct * 1.22474487139 + rhomb;

    
    
    
    grad *= (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;

    return grad;\r
}

vec4 os2NoiseWithDerivativesPart(vec3 X) {\r
    vec3 b = floor(X);\r
    vec4 i4 = vec4(X - b, 2.5);

    
    vec3 v1 = b + floor(dot(i4, vec4(.25)));\r
    vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35)));\r
    vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35)));\r
    vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35)));

    
    vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0));\r
    hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0));\r
    hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0);

    
    vec3 d1 = X - v1; vec3 d2 = X - v2; vec3 d3 = X - v3; vec3 d4 = X - v4;\r
    vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0);\r
    vec4 aa = a * a; vec4 aaaa = aa * aa;\r
    vec3 g1 = grad(hashes.x); vec3 g2 = grad(hashes.y);\r
    vec3 g3 = grad(hashes.z); vec3 g4 = grad(hashes.w);\r
    vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4));

    
    vec3 derivative = -8.0 * mat4x3(d1, d2, d3, d4) * (aa * a * extrapolations)\r
        + mat4x3(g1, g2, g3, g4) * aaaa;

    
    return vec4(derivative, dot(aaaa, extrapolations));\r
}

vec4 os2NoiseWithDerivatives_Fallback(vec3 X) {\r
    X = dot(X, vec3(2.0/3.0)) - X;

    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(dot(result.xyz, vec3(2.0/3.0)) - result.xyz, result.w);\r
}

vec4 os2NoiseWithDerivatives_ImproveXY(vec3 X) {

    
    mat3 orthonormalMap = mat3(\r
        0.788675134594813, -0.211324865405187, -0.577350269189626,\r
        -0.211324865405187, 0.788675134594813, -0.577350269189626,\r
        0.577350269189626, 0.577350269189626, 0.577350269189626);

    X = orthonormalMap * X;\r
    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);

    return vec4(result.xyz * orthonormalMap, result.w);\r
}\r
//////////////////////////////// End noise code ////////////////////////////////

float normpdf( float x,  float sigma) {\r
    return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;\r
}

vec4 gaussianBlur(sampler2D blurTexture, vec2 distortedUv) {\r
    const int mSize = 11;\r
    const int kSize = (mSize - 1) / 2;\r
    float kernel[mSize];\r
    vec3 final_colour = vec3(0.0);\r
    float sigma = 7.;\r
    float Z = 0.0;\r
    
    for(int j = 0; j <= kSize; ++j) {\r
        kernel[kSize + j] = kernel[kSize - j] = normpdf(float(j), sigma);\r
    }\r
    
    for(int j = 0; j < mSize; ++j) {\r
        Z += kernel[j];\r
    }\r
    
    for(int i = -kSize; i <= kSize; ++i) {\r
        for(int j = -kSize; j <= kSize; ++j) {\r
            vec2 uvDxDy = distortedUv + vec2(float(i), float(j)) / czm_viewport.zw;\r
            final_colour += kernel[kSize + j] * kernel[kSize + i] * texture(blurTexture, uvDxDy).rgb;\r
        }\r
    }\r
    return vec4(vec3(final_colour / (Z * Z)),1.);\r
}\r
czm_material czm_getMaterial(czm_materialInput materialInput) {\r
    czm_material material = czm_getDefaultMaterial(materialInput);\r
    vec2 st = materialInput.st;\r
    float idIndex = floor(v_dataId + 0.5);\r
    float l = getL(idIndex);\r
    float h = getH(idIndex);\r
    float alpha = u_alpha;\r
    float colorIndex = texture(u_waterDepthTexture, vec2(l, h)).r;\r
    float colorNextIndex = texture(u_waterDepthNextTexture, vec2(l, h)).r;\r
    if(colorIndex <= u_isAlpha && colorNextIndex <= u_isAlpha\r
        
        ){\r
        material.alpha = 0.0;\r
        return material;\r
    }\r
    if(u_alphaLerp && colorIndex <= u_isAlpha){\r
        alpha = u_lerpNum;\r
    }

    float U = texture(u_waterUV_UTexture, vec2(l, h)).r;\r
    float V = texture(u_waterUV_VTexture, vec2(l, h)).r;\r
    vec4 findColor = vec4(vec3(0.),1.0);\r
    
    colorIndex = (colorIndex - (u_minHeight)) / (u_maxHeight - (u_minHeight));\r
    colorNextIndex = (colorNextIndex - (u_minHeight)) / (u_maxHeight - (u_minHeight));\r
    findColor += texture(u_colorTable, vec2(colorIndex, 0.0 ));\r
    vec4 colorNext = texture(u_colorTable, vec2(colorNextIndex, 0.0 ));\r
    findColor = mix(findColor , colorNext , u_lerpNum); 

    
    vec4 color2 = texture(u_colorTable2, vec2(colorIndex, 0.0 ));\r
    if(u_showArrow){\r
        
        vec4 color = (arrow(v_positionWC.xy * u_arrowSize, arrowTileCenterCoord(vec2(0.5)) * vec2(U, V))) * color2;\r
        findColor = mix(findColor , color , u_lerpNum2);\r
    }

    
    material.diffuse = findColor.rgb;

    
    if(u_baseColorType != 0.){

        
        materialInput.st += -vec2(U,V) * (czm_frameNumber / u_waterSpeed);\r
        vec2 screenUV = gl_FragCoord.xy / czm_viewport.zw;\r
        vec3 worldPosition = v_positionWC;\r
        
        float positionToEyeECLength = length(materialInput.positionToEyeEC);\r
        float waveIntensity = waveFade(70000.0, 1000000.0, positionToEyeECLength);\r
        
        float time = czm_frameNumber * oceanAnimationSpeedHighAltitude;\r
        vec4 noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyHighAltitude, time, 0.0);\r
        vec3 normalTangentSpaceHighAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeHighAltitude);

        
        time = czm_frameNumber * oceanAnimationSpeedLowAltitude;\r
        noise = czm_getWaterNoise(normalTexture, materialInput.st * oceanFrequencyLowAltitude, time, 0.0);\r
        vec3 normalTangentSpaceLowAltitude = vec3(noise.xy, noise.z * oceanOneOverAmplitudeLowAltitude);

        
        float highAltitudeFade = linearFade(0.0, 60000.0, positionToEyeECLength);\r
        float lowAltitudeFade = 1.0 - linearFade(20000.0, 60000.0, positionToEyeECLength);\r
        vec3 normalTangentSpace =\r
            (highAltitudeFade * normalTangentSpaceHighAltitude) +\r
            (lowAltitudeFade * normalTangentSpaceLowAltitude);

        normalTangentSpace.xy *= waveIntensity;

        
        normalTangentSpace = normalize(normalTangentSpace);

        
        vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

        
        vec2 distortedScreenUV = screenUV + vec2(noise.x * u_noiseIntensity, 0.0);\r
        
        vec3 worldSpaceScenePosition = getWorldSpaceScenePosition(distortedScreenUV);

        float cmpWaterDepth = (worldPosition - worldSpaceScenePosition).b;\r
        if(cmpWaterDepth <= 0.0) {\r
            distortedScreenUV = screenUV;\r
            worldSpaceScenePosition = getWorldSpaceScenePosition(distortedScreenUV);\r
        }\r
        float shoreDepth = (worldPosition - worldSpaceScenePosition).b;\r
        float shore = saturate(exp(-shoreDepth / u_WaterDepth));

        
        vec4 color = HSVLerp(\r
            vec4(u_WaterDeepColor.rgb, u_WaterDeepColorAlpha),\r
            vec4(u_WaterShallowColor.rgb, u_WaterShallowColorAlpha),\r
            shore\r
        );

        
        float fresnel = Fresnel(normalTangentSpace,u_HorizonDistance);\r
        color = HSVLerp(color, vec4(u_HorizonColor.rgb, 1.0), fresnel);

        
        vec4 sceneColor = vec4(0.);\r
        sceneColor.rgba = gaussianBlur(u_refractTexture, distortedScreenUV);\r
        
        vec3 X = vec3( materialInput.st / u_causticScale, mod(czm_frameNumber/u_causticSpeed, 578.0) * 0.8660254037844386);\r
        vec4 noiseResult = os2NoiseWithDerivatives_ImproveXY(X);\r
        noiseResult = os2NoiseWithDerivatives_ImproveXY(X - noiseResult.xyz / 16.0);\r
        float value = noiseResult.w;\r
        vec3 col = u_causticColor.rgb * (0.5 + 0.5 * value);\r
        sceneColor.rgb += col * saturate(exp(-shoreDepth / u_causticIntersectionFade));\r
        
        
        float underwaterFactor = 1.0 - color.a;\r
        color.rgb += sceneColor.rgb * underwaterFactor;

        
        if(u_showReflect){\r
            vec2 reflectUV = vec2(screenUV.x, screenUV.y);\r
            reflectUV += vec2(noise.x * u_noiseIntensity, 0.0);\r
            vec4 reflected = gaussianBlur(u_reflectTexture, reflectUV);\r
            float reflectionFresnel = Fresnel(normalTangentSpace,u_ReflectionFresnelPower);\r
            reflectionFresnel *= u_ReflectionStrength;\r
            vec4 finalReflectionColor = mix(vec4(0.0), reflected, reflectionFresnel);\r
            color = overlay(color, finalReflectionColor, u_ReflectionMix);\r
        }

        
        float time2 = czm_frameNumber / u_FoamSpeed;\r
        vec2 vUV = materialInput.st;\r
        float t0 = fract( time2 );\r
        float t1 = fract( time2 + 0.5 );\r
        float o0 = t0 - 0.5;\r
        float o1 = t1 - 0.5;\r
        float i0 = floor( time2 );\r
        float i1 = floor( time2 + 0.5 );\r
        vec2 vUV0 = vUV + Hash2(i0);\r
        vec2 vUV1 = vUV + Hash2(i1);\r
        float weight = abs( t0 - 0.5 ) * 1.0;\r
        if(!u_FoamFlow){\r
            float foam0 = SampleWaterFoam( vUV0 * u_FoamScale,normalTangentSpace.xz * o0 * 0.25, -0.5 );\r
            float foam1 = SampleWaterFoam( vUV1 * u_FoamScale, normalTangentSpace.xz * o1 * 0.25,  -0.5);\r
            float fOutFoamTex = mix( foam0, foam1, weight );\r
            float intersectionFoamDepth = saturate(exp(-shoreDepth / u_FoamIntersectionFade));\r
            color = overlay(color, vec4(vec3(1.0-fOutFoamTex),intersectionFoamDepth), u_FoamBlend);\r
        }else{\r
            float foam0 = SampleWaterFoam( vUV0 * u_FoamScale,normalTangentSpace.xz * o0 * 0.25, 1.5 );\r
            float foam1 = SampleWaterFoam( vUV1 * u_FoamScale, normalTangentSpace.xz * o1 * 0.25,  1.5 );\r
            float fOutFoamTex = mix( foam0, foam1, weight );\r
            float intersectionFoamDepth = 1.0 - saturate(exp(-shoreDepth / u_FoamIntersectionFade));\r
            color = overlay(color, vec4(vec3(fOutFoamTex),intersectionFoamDepth), u_FoamBlend);\r
        }\r
        vec3 diffuseLight = vec3(0.0);\r
        vec3 specularLight = vec3(0.0);

        vec3 worldToEye = materialInput.positionToEyeEC;\r
        vec3 eyeDirection = normalize( worldToEye );

        sunLight( surfaceNormal, eyeDirection, diffuseLight, specularLight );

        material.diffuse = (specularLight + mix(findColor.rgb,baseColor.rgb,u_baseColorType) * u_mut + color.rgb) * luminance;\r
        material.normal = normalize(materialInput.tangentToEyeMatrix * normalTangentSpace);\r
        material.shininess = 20.0;\r
    }

    material.alpha = alpha;\r
    return material;\r
}`,Xi=`precision highp float;\r
precision highp sampler2D;\r
attribute vec3 position3DHigh;\r
attribute vec3 position3DLow;\r
attribute float batchId;\r
attribute vec2 st;\r
attribute float dataId;\r
varying vec3 v_positionEC;\r
varying vec3 v_positionWC;\r
varying vec3 v_normalEC;\r
varying vec3 v_eye;\r
varying vec2 v_st;\r
varying float v_dataId;\r
varying vec4 v_findColor;\r
varying vec4 v_color2;\r
varying vec2 v_UV;\r
varying vec4 v_position;\r
varying vec4 v_dataValue;\r
uniform sampler2D u_waterDepthTexture;\r
uniform sampler2D u_waterDepthNextTexture;\r
uniform sampler2D u_waterUV_UTexture;\r
uniform sampler2D u_waterUV_VTexture;\r
uniform sampler2D u_waterStageTexture;\r
uniform sampler2D u_colorTable;\r
uniform sampler2D u_colorTable2;\r
uniform float u_texWidth;\r
uniform float u_texHeight;\r
uniform float u_minHeight;\r
uniform float u_maxHeight;\r
uniform vec2 u_renderHeight;\r
uniform float u_lerpNum;\r
uniform float u_alpha;\r
uniform bool u_alphaLerp;\r
uniform float u_isAlpha;\r
uniform mat4 cameraEastNorthUp;\r
uniform mat4 worldEastNorthUp;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
uniform mat3 inverseViewRotation;\r
float getL(float dataId) {\r
    return floor(mod(dataId, u_texWidth)) / u_texWidth;\r
}\r
float getH(float dataId) {\r
    return floor(dataId / u_texHeight) / u_texHeight;\r
}\r
struct EncodedCartesian3 {\r
    vec3 high;\r
    vec3 low;\r
};\r
vec2 encode(float value) {\r
    vec2 result;\r
    float doubleHigh;\r
    if (value >= 0.0) {\r
        doubleHigh = floor(value / 65536.0) * 65536.0;\r
        result.x = doubleHigh;\r
        result.y = value - doubleHigh;\r
    } else {\r
        doubleHigh = floor(-value / 65536.0) * 65536.0;\r
        result.x = -doubleHigh;\r
        result.y = value + doubleHigh;\r
    }\r
    return result;\r
}\r
EncodedCartesian3 fromCartesian(vec3 cartesian) {\r
    EncodedCartesian3 result;\r
    vec2 highLow = encode(cartesian.x);\r
    result.high.x = highLow.x;\r
    result.low.x = highLow.y;

    highLow = encode(cartesian.y);\r
    result.high.y = highLow.x;\r
    result.low.y = highLow.y;

    highLow = encode(cartesian.z);\r
    result.high.z = highLow.x;\r
    result.low.z = highLow.y;

    return result;\r
}\r
const float PI = 3.141592653589793;\r
const float earthRadius = 6378137.0; 
const float angularVelocity = 180.0 / PI;\r
const float RADII_X = 6378137.0;\r
const float RADII_Y = 6378137.0;\r
const float RADII_Z = 6356752.314245;\r
vec3 worldToGeographic(vec3 worldPosition) {\r
    vec3 ecef = worldPosition;\r
    float l = length(ecef.xy);\r
    float e2 = 1.0 - (RADII_Z * RADII_Z) / (RADII_X * RADII_X);\r
    float u = atan(ecef.z * RADII_X / (l * RADII_Z));\r
    float lat = atan((ecef.z + e2 * RADII_Z * pow(sin(u), 3.0)) /\r
                    (l - e2 * RADII_X * pow(cos(u), 3.0)));\r
    float lon = atan(ecef.y, ecef.x);\r
    float N = RADII_X / sqrt(1.0 - e2 * sin(lat) * sin(lat));\r
    float alt = l / cos(lat) - N;

    
    lat = degrees(lat);\r
    lon = degrees(lon);

    return vec3(lon, lat, alt);\r
}\r
vec3 geo2cartesian(vec3 geo){\r
    float cosLat=cos(geo.y);\r
    float snX=cosLat*cos(geo.x);\r
    float snY=cosLat*sin(geo.x);\r
    float snZ=sin(geo.y);\r
    vec3 sn=normalize(vec3(snX,snY,snZ));\r
    vec3 radiiSquared=vec3(40680631.59076899*1000000.,40680631.59076899*1000000.,40408299.98466144*1000000.);\r
    vec3 sk=radiiSquared*sn;\r
    float gamma=sqrt(dot(sn,sk));\r
    sk=sk/gamma;\r
    sn=sn*geo.z;\r
    return sk+sn;\r
}\r
vec3 deg2cartesian(vec3 deg) {\r
    vec2 radGeo=radians(deg.xy);\r
    vec3 geo=vec3(radGeo.xy,deg.z);\r
    return geo2cartesian(geo);\r
}\r
void main()\r
{\r
    
    v_dataId = dataId;\r
    float idIndex = floor(v_dataId + 0.5);\r
    float l = getL(idIndex);\r
    float h = getH(idIndex);\r
    float alpha = u_alpha;\r
    float colorIndex = texture(u_waterDepthTexture, vec2(l, h)).r;\r
    float waterStage = texture(u_waterStageTexture, vec2(l, h)).r;\r
    float U = texture(u_waterUV_UTexture, vec2(l, h)).r;\r
    float V = texture(u_waterUV_VTexture, vec2(l, h)).r;\r
    
    v_dataValue = vec4(\r
    (((colorIndex - (0.)) / (50. - (0.)))),\r
    (((U - (-10.)) / (10. - (-10.)))),\r
    (((V - (-10.)) / (10. - (-10.)))),\r
    (((idIndex - (0.)) / (9999999. - (0.))) ));\r
    float colorNextIndex = texture(u_waterDepthNextTexture, vec2(l, h)).r;\r
    
    vec3 highPos = position3DHigh;\r
    vec3 lowPos = position3DLow;\r
    
    if(u_renderHeight.x > 0.){\r
        
        
        float waterDepth = colorIndex * u_renderHeight.x;\r
        float waterNextDepth = colorNextIndex * u_renderHeight.x;\r
        
        waterDepth = texture(u_waterStageTexture, vec2(l, h)).r * u_renderHeight.x;\r
        bool mode = true;\r
        vec4 newModelPos;\r
        vec4 newWorldPos;\r
        vec3 dHigh = position3DHigh - czm_encodedCameraPositionMCHigh;\r
        vec3 dLow  = position3DLow  - czm_encodedCameraPositionMCLow;\r
        vec3 d = dHigh + dLow;\r
        float dist2 = dot(d, d);\r
        if(dist2 < 50000.0 * 50000.0){\r
            
            newModelPos = cameraEastNorthUp * vec4(position3DHigh + position3DLow,1.0);\r
            newModelPos.z = waterDepth;\r
            newModelPos.z += u_renderHeight.y;\r
            
            
            newWorldPos = worldEastNorthUp * newModelPos;\r
        }else{\r
            newModelPos = vec4(worldToGeographic(position3DHigh + position3DLow),1.);\r
            newModelPos.z = waterDepth;\r
            newModelPos.z += u_renderHeight.y;\r
            
            newWorldPos = vec4(deg2cartesian(newModelPos.xyz),1.);\r
        }\r
        EncodedCartesian3 encodedCartesian = fromCartesian(newWorldPos.xyz);\r
        highPos = encodedCartesian.high;\r
        lowPos = encodedCartesian.low;\r
    }

    vec3 highDifference = highPos - czm_encodedCameraPositionMCHigh;\r
    if (length(highDifference) == 0.0) {\r
        highDifference = vec3(0);\r
    }\r
    vec3 lowDifference = lowPos - czm_encodedCameraPositionMCLow;\r
    vec4 p = vec4(highDifference + lowDifference, 1.0);

    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;\r
    v_normalEC = vec3(0.,1.,0.);\r
    v_position = inverseView * vec4(v_positionEC , 1.0);\r
    v_positionWC = (cameraEastNorthUp * v_position).xyz;\r
    v_eye = (cameraEastNorthUp * vec4(viewerPositionWC,1.0)).xyz;\r
    v_st = st;

    gl_Position = czm_modelViewProjectionRelativeToEye * p;

    
    if(u_alphaLerp && colorIndex <= u_isAlpha){\r
        alpha = u_lerpNum;\r
    }\r
    if(colorIndex <= u_isAlpha && colorNextIndex <= u_isAlpha){\r
        alpha = 0.0;\r
        v_dataValue = vec4(0.);\r
    }\r
    vec4 findColor = vec4(vec3(0.),1.0);\r
    
    colorIndex = (colorIndex - (u_minHeight)) / (u_maxHeight - (u_minHeight));\r
    colorNextIndex = (colorNextIndex - (u_minHeight)) / (u_maxHeight - (u_minHeight));\r
    findColor += texture(u_colorTable, vec2(colorIndex, 0.0 ));\r
    vec4 colorNext = texture(u_colorTable, vec2(colorNextIndex, 0.0 ));\r
    findColor = mix(findColor , colorNext , u_lerpNum); 
    v_findColor = vec4(findColor.rgb,alpha);\r
    vec4 color2 = texture(u_colorTable2, vec2(colorIndex, 0.0 ));\r
    v_color2 = color2;\r
    v_UV = vec2(U,V);\r
}`,ji=`precision highp float;\r
precision highp sampler2D;\r
attribute vec3 position3DHigh;\r
attribute vec3 position3DLow;\r
attribute float batchId;\r
attribute vec3 normal;\r
attribute float dataId;\r
attribute vec2 st;\r
varying vec3 v_positionEC;\r
varying vec3 v_positionWC;\r
varying vec3 v_normalEC;\r
varying vec3 v_eye;\r
varying vec2 v_st;\r
varying float v_dataId;\r
uniform sampler2D u_waterDepthTexture;

uniform float u_texWidth;\r
uniform float u_texHeight;\r
uniform vec2 u_renderHeight;\r
uniform mat4 cameraEastNorthUp;\r
uniform mat4 worldEastNorthUp;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
uniform mat3 inverseViewRotation;\r
float getL(float dataId) {\r
    return floor(mod(dataId, u_texWidth)) / u_texWidth;\r
}\r
float getH(float dataId) {\r
    return floor(dataId / u_texHeight) / u_texHeight;\r
}\r
struct EncodedCartesian3 {\r
    vec3 high;\r
    vec3 low;\r
};\r
vec2 encode(float value) {\r
    vec2 result;\r
    float doubleHigh;\r
    if (value >= 0.0) {\r
        doubleHigh = floor(value / 65536.0) * 65536.0;\r
        result.x = doubleHigh;\r
        result.y = value - doubleHigh;\r
    } else {\r
        doubleHigh = floor(-value / 65536.0) * 65536.0;\r
        result.x = -doubleHigh;\r
        result.y = value + doubleHigh;\r
    }\r
    return result;\r
}\r
EncodedCartesian3 fromCartesian(vec3 cartesian) {\r
    EncodedCartesian3 result;\r
    vec2 highLow = encode(cartesian.x);\r
    result.high.x = highLow.x;\r
    result.low.x = highLow.y;

    highLow = encode(cartesian.y);\r
    result.high.y = highLow.x;\r
    result.low.y = highLow.y;

    highLow = encode(cartesian.z);\r
    result.high.z = highLow.x;\r
    result.low.z = highLow.y;

    return result;\r
}\r
void main()\r
{\r
    v_dataId = czm_batchTable_dataId(batchId);\r
    vec3 highPos = position3DHigh;\r
    vec3 lowPos = position3DLow;\r
    
    if(u_renderHeight.x > 0.){\r
        
        float idIndex = floor(v_dataId + 0.5);\r
        float l = getL(idIndex);\r
        float h = getH(idIndex);\r
        float waterDepth = texture(u_waterDepthTexture, vec2(l, h)).r * u_renderHeight.x;\r
        
        
        vec4 newModelPos = cameraEastNorthUp * vec4(position3DHigh + position3DLow,1.0);\r
        if(newModelPos.z > waterDepth){\r
            newModelPos.z = waterDepth;\r
        }\r
        newModelPos.z += u_renderHeight.y;\r
        
        vec4 newWorldPos = worldEastNorthUp * newModelPos;\r
        EncodedCartesian3 encodedCartesian = fromCartesian(newWorldPos.xyz);\r
        highPos = encodedCartesian.high;\r
        lowPos = encodedCartesian.low;\r
    }

    vec3 highDifference = highPos - czm_encodedCameraPositionMCHigh;\r
    if (length(highDifference) == 0.0) {\r
        highDifference = vec3(0);\r
    }\r
    vec3 lowDifference = lowPos - czm_encodedCameraPositionMCLow;\r
    vec4 p = vec4(highDifference + lowDifference, 1.0);

    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;\r
    v_normalEC = czm_normal * normal;\r
    v_positionWC = (cameraEastNorthUp * inverseView * vec4(v_positionEC , 1.0)).xyz;\r
    v_eye = (cameraEastNorthUp * vec4(viewerPositionWC,1.0)).xyz;\r
    v_st = st;\r
    gl_Position = czm_modelViewProjectionRelativeToEye * p;\r
}`,Yi=`varying vec3 v_positionEC;\r
varying vec3 v_normalEC;\r
varying vec2 v_st;\r
void main()\r
{\r
    vec3 positionToEyeEC = -v_positionEC;\r
    vec3 normalEC = normalize(v_normalEC);\r
    #ifdef FACE_FORWARD\r
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);\r
    #endif\r
    czm_materialInput materialInput;\r
    materialInput.normalEC = normalEC;\r
    materialInput.positionToEyeEC = positionToEyeEC;\r
    materialInput.st = v_st;\r
    czm_material material = czm_getMaterial(materialInput);\r
    #ifdef FLAT\r
    out_FragColor = vec4(material.diffuse + material.emission, material.alpha);\r
    #else\r
    out_FragColor = czm_phong(normalize(positionToEyeEC), material, czm_lightDirectionEC);\r
    #endif\r
}`;class Zi{constructor(e){return e._drawVerticeShader?this.createVerticeShaderAppearance(e):this.createGridAppearance(e)}createVerticeShaderAppearance(e){let t=`
`;return e._sss&&(t+=`#define IS_SSS
`),e._fbm&&(t+=`#define FBM_NORMAL
`),new SuperMap3D.MaterialAppearance({flat:!0,translucent:!0,material:new SuperMap3D.Material({fabric:{type:"AdvancedWater",uniforms:{u_mut:1,u_lerpNum2:.5,u_showArrow:e._showArrow,u_arrowSize:1,baseColor:SuperMap3D.Color.fromCssColorString("#003361"),luminance:1,u_waterSpeed:1,u_waterAngle:-45,u_noiseIntensity:.05,u_WaterDepth:3.5,u_WaterShallowColor:SuperMap3D.Color.fromCssColorString("#525252"),u_WaterShallowColorAlpha:.3,u_WaterDeepColor:SuperMap3D.Color.fromCssColorString("#000000"),u_WaterDeepColorAlpha:.9,u_HorizonColor:SuperMap3D.Color.fromCssColorString("#f7f7f7"),u_HorizonDistance:15,u_showReflect:e._showReflect,u_ReflectionFresnelPower:4,u_ReflectionStrength:.6,u_ReflectionMix:.5,u_FoamFlow:!1,u_FoamBlend:.63,u_FoamSpeed:120,u_FoamScale:200,u_FoamIntersectionFade:.75,u_causticScale:.002,u_causticSpeed:60,u_causticIntersectionFade:1,u_causticColor:new SuperMap3D.Color(.431,.8,1),u_baseColorType:e._baseColorType,shiny:800,spec:10,oceanFrequencyLowAltitude:61505.084,oceanAnimationSpeedLowAltitude:.12,oceanOneOverAmplitudeLowAltitude:1.355},source:t+Bi}}),vertexShaderSource:Xi})}createGridAppearance(e){return new SuperMap3D.MaterialAppearance({flat:!1,material:new SuperMap3D.Material({fabric:{type:"AdvancedWater",uniforms:{u_mut:1,u_lerpNum2:.5,u_showArrow:e._showArrow,u_arrowSize:1,baseColor:SuperMap3D.Color.fromCssColorString("#003361"),luminance:1,u_waterSpeed:1,u_waterAngle:-45,u_noiseIntensity:.05,u_WaterDepth:3.5,u_WaterShallowColor:SuperMap3D.Color.fromCssColorString("#525252"),u_WaterShallowColorAlpha:.3,u_WaterDeepColor:SuperMap3D.Color.fromCssColorString("#000000"),u_WaterDeepColorAlpha:.9,u_HorizonColor:SuperMap3D.Color.fromCssColorString("#f7f7f7"),u_HorizonDistance:15,u_showReflect:e._showReflect,u_ReflectionFresnelPower:4,u_ReflectionStrength:.6,u_ReflectionMix:.5,u_FoamFlow:!1,u_FoamBlend:.63,u_FoamSpeed:120,u_FoamScale:200,u_FoamIntersectionFade:.75,u_causticScale:.01,u_causticSpeed:60,u_causticIntersectionFade:8,u_causticColor:new SuperMap3D.Color(.431,.8,1),u_baseColorType:e._baseColorType,shiny:800,spec:10,oceanFrequencyLowAltitude:61505.084,oceanAnimationSpeedLowAltitude:.12,oceanOneOverAmplitudeLowAltitude:1.355},source:$i},translucent:function(t){return t.uniforms.u_alpha<1}}),vertexShaderSource:ji,fragmentShaderSource:Yi})}}const Ir=(c,e,t)=>new Promise((r,n)=>{const o={download:!0,header:!1,dynamicTyping:!0};typeof e=="function"&&(o.step=e.bind(context||void 0)),o.complete=function(a){a.data.shift(),a.data.pop(),r({name:t,data:a.data})},window.Papa.parse(c,o)}),Vr=(c,e=0)=>c?new Promise((t,r)=>{fetch(c).then(function(n){return n.json()}).then(function(n){n||console.warn("请求接口异常!"),t({resData:n,time:e})})}):!1;var Ki=`varying float v_speed;\r
uniform sampler2D u_colorTable;\r
#ifdef GL_OES_standard_derivatives\r
#extension GL_OES_standard_derivatives : enable\r
#endif\r
float getPointOnLine(vec2 p0, vec2 p1, float x)\r
{\r
    float slope = (p0.y - p1.y) / (p0.x - p1.x);\r
    return slope * (x - p0.x) + p0.y;\r
}

czm_material czm_getMaterial(czm_materialInput materialInput)\r
{\r
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;

    float time = fract(czm_frameNumber * (v_speed * u_flowLineSpeed));\r
    vec4 colorTable = texture(u_colorTable, vec2(clamp(v_speed, 0.0, 1.0), 0.0 ));\r
    vec4 color = mix(u_color , colorTable , u_flowLineColorMix);

#if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))\r
    float base = 1.0 - abs(fwidth(st.s)) * 10.0 * czm_pixelRatio;\r
#else\r
    
    float base = 0.975;\r
#endif

    vec2 center = vec2(1.0, 0.5);\r
    float ptOnUpperLine = getPointOnLine(vec2(base, 1.0), center, st.s);\r
    float ptOnLowerLine = getPointOnLine(vec2(base, 0.0), center, st.s);

    float halfWidth = 0.15;\r
    float s = step(0.5 - halfWidth, st.t);\r
    s *= 1.0 - step(0.5 + halfWidth, st.t);\r
    s *= 1.0 - step(base, st.s);

    float t = step(base, materialInput.st.s);\r
    t *= 1.0 - step(ptOnUpperLine, st.t);\r
    t *= step(ptOnLowerLine, st.t);

    
    float dist;\r
    if (st.s < base)\r
    {\r
        float d1 = abs(st.t - (0.5 - halfWidth));\r
        float d2 = abs(st.t - (0.5 + halfWidth));\r
        dist = min(d1, d2);\r
    }\r
    else\r
    {\r
        float d1 = czm_infinity;\r
        if (st.t < 0.5 - halfWidth && st.t > 0.5 + halfWidth)\r
        {\r
            d1 = abs(st.s - base);\r
        }\r
        float d2 = abs(st.t - ptOnUpperLine);\r
        float d3 = abs(st.t - ptOnLowerLine);\r
        dist = min(min(d1, d2), d3);\r
    }

    vec4 outsideColor = vec4(0.0);\r
    vec4 currentColor = mix(outsideColor, color, clamp(s + t, 0.0, 1.0));\r
    vec4 outColor = czm_antialias(outsideColor, color, currentColor, dist);

    outColor = czm_gammaCorrect(outColor);\r
    material.diffuse = outColor.rgb;\r
    material.alpha = outColor.a;\r
    return material;\r
}`,qi=`varying float v_speed;\r
#ifdef GL_OES_standard_derivatives\r
#extension GL_OES_standard_derivatives : enable\r
#endif\r
float getPointOnLine(vec2 p0, vec2 p1, float x)\r
{\r
    float slope = (p0.y - p1.y) / (p0.x - p1.x);\r
    return slope * (x - p0.x) + p0.y;\r
}

czm_material czm_getMaterial(czm_materialInput materialInput)\r
{\r
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 st = materialInput.st;

    float time = fract(czm_frameNumber * (v_speed * u_flowLineSpeed));\r
    vec4 colorTable = texture(u_colorTable, vec2(clamp(v_speed , 0.0, 1.0), 0.0 ));\r
    vec4 color = mix(u_color , colorTable , u_flowLineColorMix);

#if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))\r
    float base = 1.0 - abs(fwidth(st.s)) * 10.0 * czm_pixelRatio;\r
#else\r
    
    float base = 0.975;\r
#endif

    vec2 center = vec2(1.0, 0.5);\r
    float ptOnUpperLine = getPointOnLine(vec2(base, 1.0), center, st.s);\r
    float ptOnLowerLine = getPointOnLine(vec2(base, 0.0), center, st.s);

    float halfWidth = 0.15;\r
    float s = step(0.5 - halfWidth, st.t);\r
    s *= 1.0 - step(0.5 + halfWidth, st.t);\r
    s *= 1.0 - step(base, st.s);

    float t = step(base, materialInput.st.s);\r
    t *= 1.0 - step(ptOnUpperLine, st.t);\r
    t *= step(ptOnLowerLine, st.t);

    
    float dist;\r
    if (st.s < base)\r
    {\r
        float d1 = abs(st.t - (0.5 - halfWidth));\r
        float d2 = abs(st.t - (0.5 + halfWidth));\r
        dist = min(d1, d2);\r
    }\r
    else\r
    {\r
        float d1 = czm_infinity;\r
        if (st.t < 0.5 - halfWidth && st.t > 0.5 + halfWidth)\r
        {\r
            d1 = abs(st.s - base);\r
        }\r
        float d2 = abs(st.t - ptOnUpperLine);\r
        float d3 = abs(st.t - ptOnLowerLine);\r
        dist = min(min(d1, d2), d3);\r
    }

    vec4 outsideColor = vec4(0.0);\r
    vec4 currentColor = mix(outsideColor, color, clamp(s + t, 0.0, 1.0));\r
    vec4 outColor = czm_antialias(outsideColor, color, currentColor, dist);

    outColor = czm_gammaCorrect(outColor);\r
    material.diffuse = outColor.rgb;\r
    material.alpha = outColor.a;\r
    return material;\r
}`,je=`attribute vec3 position3DHigh;\r
attribute vec3 position3DLow;\r
attribute vec3 prevPosition3DHigh;\r
attribute vec3 prevPosition3DLow;\r
attribute vec3 nextPosition3DHigh;\r
attribute vec3 nextPosition3DLow;\r
attribute vec2 expandAndWidth;\r
attribute vec2 st;\r
attribute float batchId;\r
attribute float speed;

varying float v_width;\r
varying vec2 v_st;\r
varying float v_polylineAngle;\r
varying float v_speed;\r
void clipLineSegmentToNearPlane(\r
    vec3 p0,\r
    vec3 p1,\r
    out vec4 positionWC,\r
    out bool clipped,\r
    out bool culledByNearPlane,\r
    out vec4 clippedPositionEC){\r
    culledByNearPlane = false;\r
    clipped = false;

    vec3 p0ToP1 = p1 - p0;\r
    float magnitude = length(p0ToP1);\r
    vec3 direction = normalize(p0ToP1);\r
    float endPoint0Distance =  czm_currentFrustum.x + p0.z;\r
    float denominator = -direction.z;

    if (endPoint0Distance > 0.0 && abs(denominator) < czm_epsilon7)\r
    {\r
        culledByNearPlane = true;\r
    }\r
    else if (endPoint0Distance > 0.0)\r
    {\r
        float t = endPoint0Distance / denominator;\r
        if (t < 0.0 || t > magnitude)\r
        {\r
            culledByNearPlane = true;\r
        }\r
        else\r
        {\r
            p0 = p0 + t * direction;\r
            p0.z = min(p0.z, -czm_currentFrustum.x);

            clipped = true;\r
        }\r
    }

    clippedPositionEC = vec4(p0, 1.0);\r
    positionWC = czm_eyeToWindowCoordinates(clippedPositionEC);\r
}

vec4 getPolylineWindowCoordinatesEC(vec4 positionEC, vec4 prevEC, vec4 nextEC, float expandDirection, float width, bool usePrevious, out float angle)\r
{\r
    
    #ifdef POLYLINE_DASH\r
        
        vec4 positionWindow = czm_eyeToWindowCoordinates(positionEC);\r
        vec4 previousWindow = czm_eyeToWindowCoordinates(prevEC);\r
        vec4 nextWindow = czm_eyeToWindowCoordinates(nextEC);

        
        vec2 lineDir;\r
        if (usePrevious) {\r
            lineDir = normalize(positionWindow.xy - previousWindow.xy);\r
        }\r
        else {\r
            lineDir = normalize(nextWindow.xy - positionWindow.xy);\r
        }\r
        angle = atan(lineDir.x, lineDir.y) - 1.570796327; 

        
        angle = floor(angle / czm_piOverFour + 0.5) * czm_piOverFour;\r
    #endif

        vec4 clippedPrevWC, clippedPrevEC;\r
        bool prevSegmentClipped, prevSegmentCulled;\r
        clipLineSegmentToNearPlane(prevEC.xyz, positionEC.xyz, clippedPrevWC, prevSegmentClipped, prevSegmentCulled, clippedPrevEC);

        vec4 clippedNextWC, clippedNextEC;\r
        bool nextSegmentClipped, nextSegmentCulled;\r
        clipLineSegmentToNearPlane(nextEC.xyz, positionEC.xyz, clippedNextWC, nextSegmentClipped, nextSegmentCulled, clippedNextEC);

        bool segmentClipped, segmentCulled;\r
        vec4 clippedPositionWC, clippedPositionEC;\r
        clipLineSegmentToNearPlane(positionEC.xyz, usePrevious ? prevEC.xyz : nextEC.xyz, clippedPositionWC, segmentClipped, segmentCulled, clippedPositionEC);

        if (segmentCulled)\r
        {\r
            return vec4(0.0, 0.0, 0.0, 1.0);\r
        }

        vec2 directionToPrevWC = normalize(clippedPrevWC.xy - clippedPositionWC.xy);\r
        vec2 directionToNextWC = normalize(clippedNextWC.xy - clippedPositionWC.xy);\r
        if (prevSegmentCulled)\r
        {\r
            directionToPrevWC = -directionToNextWC;\r
        }\r
        else if (nextSegmentCulled)\r
        {\r
            directionToNextWC = -directionToPrevWC;\r
        }\r
        vec2 thisSegmentForwardWC, otherSegmentForwardWC;\r
        if (usePrevious)\r
        {\r
            thisSegmentForwardWC = -directionToPrevWC;\r
            otherSegmentForwardWC = directionToNextWC;\r
        }\r
        else\r
        {\r
            thisSegmentForwardWC = directionToNextWC;\r
            otherSegmentForwardWC =  -directionToPrevWC;\r
        }

        vec2 thisSegmentLeftWC = vec2(-thisSegmentForwardWC.y, thisSegmentForwardWC.x);

        vec2 leftWC = thisSegmentLeftWC;\r
        float expandWidth = width * 0.5;\r
        if (!czm_equalsEpsilon(prevEC.xyz - positionEC.xyz, vec3(0.0), czm_epsilon1) && !czm_equalsEpsilon(nextEC.xyz - positionEC.xyz, vec3(0.0), czm_epsilon1))\r
        {\r
            vec2 otherSegmentLeftWC = vec2(-otherSegmentForwardWC.y, otherSegmentForwardWC.x);

            vec2 leftSumWC = thisSegmentLeftWC + otherSegmentLeftWC;\r
            float leftSumLength = length(leftSumWC);\r
            leftWC = leftSumLength < czm_epsilon6 ? thisSegmentLeftWC : (leftSumWC / leftSumLength);\r
            vec2 u = -thisSegmentForwardWC;\r
            vec2 v = leftWC;\r
            float sinAngle = abs(u.x * v.y - u.y * v.x);\r
            expandWidth = clamp(expandWidth / sinAngle, 0.0, width * 2.0);\r
        }

        vec2 offset = leftWC * expandDirection * expandWidth * czm_pixelRatio;\r
        return vec4(clippedPositionWC.xy + offset, -clippedPositionWC.z, 1.0) * (czm_projection * clippedPositionEC).w;\r
}

vec4 getPolylineWindowCoordinates(vec4 position, vec4 previous, vec4 next, float expandDirection, float width, bool usePrevious, out float angle)\r
{\r
    vec4 positionEC = czm_modelViewRelativeToEye * position;\r
    vec4 prevEC = czm_modelViewRelativeToEye * previous;\r
    vec4 nextEC = czm_modelViewRelativeToEye * next;\r
    return getPolylineWindowCoordinatesEC(positionEC, prevEC, nextEC, expandDirection, width, usePrevious, angle);\r
}\r
void main()\r
{\r
    float expandDir = expandAndWidth.x;\r
    float width = abs(expandAndWidth.y) + 0.5;\r
    bool usePrev = expandAndWidth.y < 0.0;

    vec4 p = czm_computePosition();\r
    vec4 prev = czm_computePrevPosition();\r
    vec4 next = czm_computeNextPosition();

    float angle;\r
    vec4 positionWC = getPolylineWindowCoordinates(p, prev, next, expandDir, width, usePrev, angle);\r
    gl_Position = czm_viewportOrthographic * positionWC;

    v_speed = czm_batchTable_speed(batchId);\r
    v_width = width;\r
    v_st.s = st.s;\r
    v_st.t = czm_writeNonPerspective(st.t, gl_Position.w);\r
    v_polylineAngle = angle;\r
}`;class Qi{constructor(e,t={}){this._viewer=e,this._datas=void 0,this._flowItem=[],this._flowInstances=[],this._width=SuperMap3D.defaultValue(t.width,12),this._height=SuperMap3D.defaultValue(t.height,20),this._length=SuperMap3D.defaultValue(t.length,100),this._color=SuperMap3D.defaultValue(t.color,SuperMap3D.Color.WHITE),this._flowLineSpeed=SuperMap3D.defaultValue(t.flowLineSpeed,.1),this._flowLineColorMix=SuperMap3D.defaultValue(t.flowLineColorMix,1),this._colorTable=SuperMap3D.defaultValue(t.colorTable,"./data/colorTable2.png")}static _InitFlowArrow(e){if(e._flowArrowPrimitive&&e._viewer.scene.primitives.remove(e._flowArrowPrimitive),!e._showArrowField)return!1;e._processFlowLine();const t=[];e._flowLines.forEach(r=>{if(r.positions.length>=2){const n=new SuperMap3D.PolylineGeometry({positions:r.positions,width:r.style.width}),o=SuperMap3D.PolylineGeometry.createGeometry(n);t.push(new SuperMap3D.GeometryInstance({geometry:o,attributes:{speed:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(r.data.speed)]})}}))}}),e._flowArrowAppearance||(e._flowArrowAppearance=new SuperMap3D.PolylineMaterialAppearance({material:new SuperMap3D.Material({fabric:{uniforms:{u_color:SuperMap3D.Color.WHITE,u_flowLineSpeed:e._flowLineSpeed,u_flowLineColorMix:e._flowLineColorMix,u_flowLineImage:e._flowLineImage},source:Ki}}),vertexShaderSource:je,renderState:SuperMap3D.RenderState.fromCache(SuperMap3D.Appearance.getDefaultRenderState(!0,!1))}),e._flowArrowAppearance.material._uniforms.u_colorTable=()=>SuperMap3D.defaultValue(e._colorTable2,e._viewer.scene.context.defaultTexture)),e._flowArrowPrimitive=new SuperMap3D.Primitive({geometryInstances:t,appearance:e._flowArrowAppearance,asynchronous:!1}),e._flowArrowPrimitive.drawIndex=e._drawIndex,e._viewer.scene.primitives.add(e._flowArrowPrimitive)}set show(e){this._flowPrimitive.show=e}load(e){if(e.length===0)return!1;this._datas=e,this.processData(),this.init()}init(){this.initGeometry(),this.initAppearance(),this.initPrimitive(),this._flowItem=[],this._flowInstances=[]}getDirPosition(e,t,r){const n=SuperMap3D.Transforms.eastNorthUpToFixedFrame(e),o=SuperMap3D.Math.toRadians(360-(t||0)),a=SuperMap3D.Matrix3.fromRotationZ(o),i=SuperMap3D.Matrix4.fromRotationTranslation(a);SuperMap3D.Matrix4.multiply(n,i,n);const s=SuperMap3D.Matrix4.multiplyByPoint(n,new SuperMap3D.Cartesian3(r/2,0,0),new SuperMap3D.Cartesian3);return[SuperMap3D.Matrix4.multiplyByPoint(n,new SuperMap3D.Cartesian3(-(r/2),0,0),new SuperMap3D.Cartesian3),s]}add(e){const t=e.id,r=SuperMap3D.Cartesian3.fromDegrees(Number(e.lon),Number(e.lat),this._height),n=Number(e.speed),o=Number(e.angle),a=this.getDirPosition(r,o,this._length);this._flowItem.push({positions:a,style:{width:20},data:{id:t,dir:o,speed:n}})}processData(){this._datas.forEach((e,t)=>{const r=e.id,n=SuperMap3D.Cartesian3.fromDegrees(Number(e.lon),Number(e.lat),this._height),o=Number(e.speed),a=Number(e.angle),i=this.getDirPosition(n,a,this._length);this._flowItem.push({positions:[n,i],style:{width:this._width},data:{id:r,dir:a,speed:o}})})}initGeometry(){this._flowItem.forEach(e=>{if(e.positions.length>=2){const t=new SuperMap3D.PolylineGeometry({positions:e.positions,width:e.style.width,vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST}),r=SuperMap3D.PolylineGeometry.createGeometry(t),n=new SuperMap3D.GeometryInstance({geometry:r,attributes:{speed:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!0,value:[Number(e.data.speed)]})}});this._flowInstances.push(n)}})}initAppearance(){if(this._appearance)return this._appearance;this._appearance=new SuperMap3D.PolylineMaterialAppearance({flat:!0,material:new SuperMap3D.Material({fabric:{uniforms:{u_color:this._color,u_flowLineSpeed:this._flowLineSpeed,u_flowLineColorMix:this._flowLineColorMix,u_colorTable:this._colorTable},source:qi}}),vertexShaderSource:je,renderState:SuperMap3D.RenderState.fromCache(SuperMap3D.Appearance.getDefaultRenderState(!0,!1))})}initPrimitive(){if(this._flowPrimitive)return this._flowPrimitive.geometryInstances=this._flowItem,this._flowPrimitive._state=SuperMap3D.PrimitiveState.READY,this._flowPrimitive._updateVertex=!0,!1;this._flowPrimitive=new SuperMap3D.Primitive({geometryInstances:this._flowInstances,appearance:this._appearance,asynchronous:!1}),this._viewer.scene.primitives.add(this._flowPrimitive),this._flowInstances=void 0,this._flowItem=void 0}destroy(){return this._flowPrimitive&&this._viewer.scene.primitives.remove(this._flowPrimitive),this._flowInstances=void 0,this._flowItem=void 0,SuperMap3D.destroyObject(this)}}const{Cartesian3:Ji,PolygonGeometry:Qa,VertexFormat:Ja,PolygonHierarchy:eo,GeometryInstance:ea,GeometryInstanceAttribute:ta,ComponentDatatype:ra,createGuid:Ye}=SuperMap3D;class Ze{constructor(){}static load(e){const t=new SuperMap3D.PlaneGeometry({vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST});t._workerName="createPlaneGeometry";const r=(o,a)=>{const i=a[e._gridId]-e._gridIdIndex,s=o.coordinates,l=s[0],h=s[1],u=Ji.fromDegrees(l,h,e._flowLineHeight);e._particles.set(`${l}_${h}`,{position:u,id:i});const p=e._waterHeight!==-1?e._waterHeight:e._waterStageViews[e._waterStageViews.length-2][i]+e._offsetHeight,d=e._gridPointSize,f=new SuperMap3D.GeometryInstance({geometry:t,attributes:{dataId:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!1,value:[Number(i)]})},id:`plane_${i}_${Ye()}`,modelMatrix:Ke([Number(s[0]),Number(s[1]),p],[0,0,0],[d,d,1])}),_=new SuperMap3D.BoxGeometry({vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST,maximum:new SuperMap3D.Cartesian3(d,d,p),minimum:new SuperMap3D.Cartesian3(-0,-0,-0)});_._workerName="createBoxGeometry";const g=new ea({id:`volumeBox_${i}_${Ye()}`,geometry:_,attributes:{dataId:new ta({componentDatatype:ra.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(i)]})},modelMatrix:Ke([Number(s[0]),Number(s[1]),0],[0,0,0],[1,1,1])});return{planeInstance:f,volumeInstance:g}};let n=e._waterData.length;e._waterData.length>e._maxWaterPointGridNumber&&(console.error("河道网格超过最大网格限制"),n=e._maxWaterPointGridNumber);for(let o=0;o<n;o++){const a=e._waterData[o],{geometry:i,properties:s}=a,{planeInstance:l,volumeInstance:h}=r(i,s);e._waterInstances.push(l),e._volumeInstances.push(h)}}static create(e){e._waterPrimitive=new SuperMap3D.Primitive({show:!0,geometryInstances:e._waterInstances,appearance:e._appearance,classificationType:SuperMap3D.ClassificationType.BOTH,shadows:!0,isWater:!0}),e._waterPrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterPrimitive),e._waterVolumePrimitive=new SuperMap3D.Primitive({show:!1,geometryInstances:e._volumeInstances,appearance:e._appearance,shadows:!0,isWater:!0}),e._waterVolumePrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterVolumePrimitive)}static updateVolume(e){if(!e._waterVolumePrimitive)return!1;e._volumeInstances=[];const t=e._drawIndex===0?e._waterDepthViews.length-1:e._drawIndex;for(let r=0;r<e._waterData.length;r++){const n=e._waterData[r],{geometry:o,properties:a}=n,i=a[e._gridId]-e._gridIdIndex,s=o.coordinates,l=e._gridPointSize,h=new SuperMap3D.BoxGeometry({vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST,maximum:new SuperMap3D.Cartesian3(l,l,e._waterHeight!==-1?e._waterHeight:e._waterDepthViews[t][i]+e._offsetHeight),minimum:new SuperMap3D.Cartesian3(-0,-0,-0)}),u=new SuperMap3D.GeometryInstance({id:`volumeBox_${i}_${Ye()}`,geometry:h,attributes:{dataId:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(i)]})},modelMatrix:Ke([Number(s[0]),Number(s[1]),0],[0,0,0],[1,1,1])});e._volumeInstances.push(u)}e._waterPrimitive.show=!1,e._viewer.scene.primitives.remove(e._waterVolumePrimitive),e._waterVolumePrimitive=null,e._waterVolumePrimitive=new SuperMap3D.Primitive({geometryInstances:e._volumeInstances,appearance:e._appearance,asynchronous:!1,shadows:!0,isWater:!0}),e._waterVolumePrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterVolumePrimitive)}static updateHeight(e){if(!(e._waterPrimitive instanceof Primitive))return!1;const t=SuperMap3D.PlaneGeometry.createGeometry(new SuperMap3D.PlaneGeometry({vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST}));e._waterInstances=[];const r=e._drawIndex===0?e._waterDepthViews.length-1:e._drawIndex;for(let n=0;n<e._waterData.length;n++){const o=e._waterData[n],{geometry:a,properties:i}=o,s=i[e._gridId]-e._gridIdIndex,l=a.coordinates[0],h=e._gridPointSize,u=new SuperMap3D.GeometryInstance({geometry:t,attributes:{dataId:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!1,value:[Number(s)]})},id:`plane_${s}_${Ye()}`,modelMatrix:Ke([Number(l[0]),Number(l[1]),e._waterHeight!==-1?e._waterHeight:e._waterDepthViews[r][s]+e._offsetHeight],[0,0,0],[h,h,1])});e._waterInstances.push(u)}e._appearance.material.uniforms.u_showFlow=!1,e._waterVolumePrimitive.show=!1,e._viewer.scene.primitives.remove(e._waterPrimitive),e._waterPrimitive=null,e._waterPrimitive=new Primitive({geometryInstances:e._waterInstances,appearance:e._appearance,asynchronous:!1,shadows:!0,isWater:!0}),e._waterPrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterPrimitive)}}const Ke=(c=[0,0,0],e=[0,0,0],t=[1,1,1])=>{const r=SuperMap3D.Matrix4.fromRotationTranslation(SuperMap3D.Matrix3.fromRotationX(SuperMap3D.Math.toRadians(e[0]))),n=SuperMap3D.Matrix4.fromRotationTranslation(SuperMap3D.Matrix3.fromRotationY(SuperMap3D.Math.toRadians(e[1]))),o=SuperMap3D.Matrix4.fromRotationTranslation(SuperMap3D.Matrix3.fromRotationZ(SuperMap3D.Math.toRadians(e[2])));c instanceof SuperMap3D.Cartesian3||(c=SuperMap3D.Cartesian3.fromDegrees(...c));const a=SuperMap3D.Transforms.eastNorthUpToFixedFrame(c);SuperMap3D.Matrix4.multiply(a,r,a),SuperMap3D.Matrix4.multiply(a,n,a),SuperMap3D.Matrix4.multiply(a,o,a);const i=SuperMap3D.Matrix4.fromScale(new SuperMap3D.Cartesian3(...t));return SuperMap3D.Matrix4.multiply(a,i,new SuperMap3D.Matrix4)},{Cartesian3:ze,PolygonGeometry:qe,VertexFormat:Qe,PolygonHierarchy:Je,GeometryInstance:et,GeometryInstanceAttribute:tt,ComponentDatatype:rt,createGuid:nt,Primitive:bt}=SuperMap3D;class it{constructor(){}static load(e){const t=(n,o)=>{const a=[],i=o[e._gridId]-e._gridIdIndex,s=n.coordinates[0];for(let d=0;d<s.length;d++){const f=s[d],_=f[0],g=f[1];a.push(_,g);const C=ze.fromDegrees(_,g,e._flowLineHeight);e._particles.set(`${_}_${g}`,{position:C,id:i})}const l=new qe({vertexFormat:Qe.POSITION_AND_ST,polygonHierarchy:new Je(ze.fromDegreesArray(a)),height:e._waterHeight!==-1?e._waterHeight:e._waterStageViews[e._waterStageViews.length-2][i]+e._offsetHeight});l._workerName="createPolygonGeometry";const h=new et({id:`polygon_${i}_${nt()}`,geometry:l,attributes:{dataId:new tt({componentDatatype:rt.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(i)]})}}),u=new qe({vertexFormat:Qe.POSITION_AND_ST,polygonHierarchy:new Je(ze.fromDegreesArray(a)),extrudedHeight:e._waterHeight!==-1?e._waterHeight:e._waterStageViews[e._drawIndex][i]+e._offsetHeight});u._workerName="createPolygonGeometry";const p=new et({id:`volumePolygon_${i}_${nt()}`,geometry:u,attributes:{dataId:new tt({componentDatatype:rt.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(i)]})}});return{polygonInstance:h,volumePolygonInstance:p}};let r=e._waterData.length;e._waterData.length>e._maxWaterPolygonGridNumber&&(console.error("河道网格超过最大网格限制"),r=e._maxWaterPolygonGridNumber);for(let n=0;n<r;n++){const o=e._waterData[n],{geometry:a,properties:i}=o,{polygonInstance:s,volumePolygonInstance:l}=t(a,i);e._waterInstances.push(s),e._volumeInstances.push(l)}}static create(e){e._waterPrimitive=new SuperMap3D.Primitive({show:!0,geometryInstances:e._waterInstances,appearance:e._appearance,shadows:!0,isWater:!0}),e._waterPrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterPrimitive),e._waterVolumePrimitive=new SuperMap3D.Primitive({show:!1,geometryInstances:e._volumeInstances,appearance:e._appearance,shadows:!0,isWater:!0}),e._waterVolumePrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterVolumePrimitive)}static updateVolume(e){if(!e._waterVolumePrimitive)return!1;e._volumeInstances=[];const t=e._drawIndex===0?e._waterDepthViews.length-1:e._drawIndex;for(let r=0;r<e._waterData.length;r++){const n=e._waterData[r],{geometry:o,properties:a}=n,i=[],s=a[e._gridId]-e._gridIdIndex;o.coordinates[0].forEach(p=>{const d=p[0],f=p[1];i.push(d,f)});const h=new qe({vertexFormat:Qe.POSITION_AND_ST,polygonHierarchy:new Je(ze.fromDegreesArray(i)),extrudedHeight:e._waterHeight!==-1?e._waterHeight:e._waterDepthViews[t][s]+e._offsetHeight}),u=new et({id:`volumePolygon_${s}_${nt()}`,geometry:h,attributes:{dataId:new tt({componentDatatype:rt.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(s)]})}});e._volumeInstances.push(u)}e._waterPrimitive.show=!1,e._viewer.scene.primitives.remove(e._waterVolumePrimitive),e._waterVolumePrimitive=null,e._waterVolumePrimitive=new bt({geometryInstances:e._volumeInstances,appearance:e._appearance,asynchronous:!1,shadows:!0,isWater:!0}),e._waterVolumePrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterVolumePrimitive)}static updateHeight(e){if(!(e._waterPrimitive instanceof bt))return!1;e._waterInstances=[];const t=e._drawIndex===0?e._waterDepthViews.length-1:e._drawIndex;for(let r=0;r<e._waterData.length;r++){const n=e._waterData[r],{geometry:o,properties:a}=n,i=[],s=a[e._gridId]-e._gridIdIndex;o.coordinates[0].forEach(p=>{const d=p[0],f=p[1];i.push(d,f)});const h=new qe({vertexFormat:Qe.POSITION_AND_ST,polygonHierarchy:new Je(ze.fromDegreesArray(i)),height:e._waterHeight!==-1?e._waterHeight:e._waterDepthViews[t][s]+e._offsetHeight}),u=new et({id:`polygon_${s}_${nt()}`,geometry:h,attributes:{dataId:new tt({componentDatatype:rt.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(s)]})}});e._waterInstances.push(u)}e._appearance.material.uniforms.u_showFlow=!1,e._waterVolumePrimitive.show=!1,e._viewer.scene.primitives.remove(e._waterPrimitive),e._waterPrimitive=null,e._waterPrimitive=new bt({geometryInstances:e._waterInstances,appearance:e._appearance,asynchronous:!1,shadows:!0,isWater:!0}),e._waterPrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterPrimitive)}}const{buildModuleUrl:zr,defaultValue:se,destroyObject:na,Color:ia,RenderState:Lr}=SuperMap3D;class aa{constructor(e,t={}){this._viewer=e,this._datas=void 0,this._flowItem=[],this._flowInstances=[],this._width=se(t.width,12),this._height=se(t.height,20),this._length=se(t.length,100),this._color=se(t.color,ia.WHITE),this._flowLineSpeed=se(t.flowLineSpeed,.1),this._flowLineColorMix=se(t.flowLineColorMix,1),this._flowLineImage=se(t.flowLineImage,zr("Assets/Data/line.png")),this._colorTable=se(t.colorTable,zr("Assets/Data/colorTable2.png"))}static _InitFlowField(e){if(e._flowLinePrimitive&&e._viewer.scene.primitives.remove(e._flowLinePrimitive),!e._showFlowField)return!1;e._processFlowLine();const t=[];e._flowLines.forEach(r=>{if(r.positions.length>=2){const n=new SuperMap3D.PolylineGeometry({positions:r.positions,width:r.style.width}),o=SuperMap3D.PolylineGeometry.createGeometry(n);t.push(new SuperMap3D.GeometryInstance({geometry:o,attributes:{speed:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(r.data.speed)]})}}))}}),e._flowLineAppearance||(e._flowLineAppearance=new SuperMap3D.PolylineMaterialAppearance({material:new SuperMap3D.Material({fabric:{uniforms:{u_color:SuperMap3D.Color.WHITE,u_flowLineSpeed:e._flowLineSpeed,u_flowLineColorMix:e._flowLineColorMix,u_flowLineImage:e._flowLineImage},source:`
                            varying float v_speed;
                            uniform sampler2D u_colorTable;
                            czm_material czm_getMaterial(czm_materialInput materialInput)
                            {
                                czm_material material = czm_getDefaultMaterial(materialInput);
                                vec2 st = materialInput.st;
                                float time = fract(czm_frameNumber * (v_speed * u_flowLineSpeed));
                                vec4 colorTable = texture(u_colorTable, vec2(clamp(v_speed, 0.0, 1.0), 0.0 ));
                                vec4 color = mix(u_color , colorTable , u_flowLineColorMix);
                                if(texture(u_flowLineImage, vec2(0.0, 0.0)).a == 1.0){
                                    discard;
                                }else{
                                    material.alpha = texture(u_flowLineImage, vec2(1.0 - fract(time - st.s), st.t)).a * color.a;
                                }
                                material.diffuse = max(color.rgb * material.alpha * 3.0, color.rgb);

                                return material;
                            }
                       `}}),vertexShaderSource:je,renderState:Lr.fromCache(SuperMap3D.Appearance.getDefaultRenderState(!0,!1))}),e._flowLineAppearance.material._uniforms.u_colorTable=()=>SuperMap3D.defaultValue(e._colorTable2,e._viewer.scene.context.defaultTexture)),e._flowLinePrimitive=new SuperMap3D.Primitive({geometryInstances:t,appearance:e._flowLineAppearance,asynchronous:!1}),e._flowLinePrimitive.drawIndex=e._drawIndex,e._viewer.scene.primitives.add(e._flowLinePrimitive)}set show(e){this._flowPrimitive.show=e}set flowLineSpeed(e){this._appearance.material.uniforms.u_flowLineSpeed=e}load(e){if(e.length===0)return!1;this._datas=e,this.processData(),this.init()}init(){this.initGeometry(),this.initAppearance(),this.initPrimitive(),this._flowItem=[],this._flowInstances=[]}getDirPosition(e,t,r){const n=SuperMap3D.Transforms.eastNorthUpToFixedFrame(e),o=SuperMap3D.Math.toRadians(360-(t||0)),a=SuperMap3D.Matrix3.fromRotationZ(o),i=SuperMap3D.Matrix4.fromRotationTranslation(a);return SuperMap3D.Matrix4.multiply(n,i,n),SuperMap3D.Matrix4.multiplyByPoint(n,new SuperMap3D.Cartesian3(r,0,0),new SuperMap3D.Cartesian3)}add(e){const t=e.id,r=SuperMap3D.Cartesian3.fromDegrees(Number(e.long),Number(e.lat),this._height),n=Number(e.SPEED2D),o=Number(e.ANGLE2D),a=this.getDirPosition(r,o,this._length);this._flowItem.push({positions:[r,a],style:{width:20},data:{id:t,dir:o,speed:n}})}processData(){this._datas.forEach((e,t)=>{const r=e.id,n=SuperMap3D.Cartesian3.fromDegrees(Number(e.long),Number(e.lat),this._height),o=Number(e.SPEED2D),a=Number(e.ANGLE2D),i=this.getDirPosition(n,a,this._length);this._flowItem.push({positions:[n,i],style:{width:this._width},data:{id:r,dir:a,speed:o}})})}initGeometry(){this._flowItem.forEach(e=>{if(e.positions.length>=2){const t=new SuperMap3D.PolylineGeometry({positions:e.positions,width:e.style.width,vertexFormat:SuperMap3D.VertexFormat.POSITION_AND_ST}),r=SuperMap3D.PolylineGeometry.createGeometry(t),n=new SuperMap3D.GeometryInstance({geometry:r,attributes:{speed:new SuperMap3D.GeometryInstanceAttribute({componentDatatype:SuperMap3D.ComponentDatatype.FLOAT,componentsPerAttribute:1,normalize:!0,value:[Number(e.data.speed)]})}});this._flowInstances.push(n)}})}initAppearance(){if(this._appearance)return this._appearance;this._appearance=new SuperMap3D.PolylineMaterialAppearance({flat:!0,material:new SuperMap3D.Material({fabric:{uniforms:{u_color:this._color,u_flowLineSpeed:this._flowLineSpeed,u_flowLineColorMix:this._flowLineColorMix,u_flowLineImage:this._flowLineImage,u_colorTable:this._colorTable},source:`
                        varying float v_speed;
                        czm_material czm_getMaterial(czm_materialInput materialInput)
                        {
                            czm_material material = czm_getDefaultMaterial(materialInput);
                            vec2 st = materialInput.st;
                            float time = fract(czm_frameNumber * (v_speed * u_flowLineSpeed));
                            vec4 colorTable = texture(u_colorTable, vec2(clamp(v_speed, 0.0, 1.0), 0.0 ));
                            vec4 color = mix(u_color , colorTable , u_flowLineColorMix);
                            if(texture(u_flowLineImage, vec2(0.0, 0.0)).a == 1.0){
                                discard;
                            }else{
                                material.alpha = texture(u_flowLineImage, vec2(1.0 - fract(time - st.s), st.t)).a * color.a;
                            }
                            material.diffuse = max(color.rgb * material.alpha * 3.0, color.rgb);

                            return material;
                        }
                       `}}),vertexShaderSource:je,renderState:Lr.fromCache(SuperMap3D.Appearance.getDefaultRenderState(!0,!1))})}initPrimitive(){if(this._flowPrimitive)return!1;this._flowPrimitive=new SuperMap3D.Primitive({geometryInstances:this._flowInstances,appearance:this._appearance,asynchronous:!1}),this._viewer.scene.primitives.add(this._flowPrimitive),this._flowInstances=void 0,this._flowItem=void 0}destroy(){return this._flowPrimitive&&this._viewer.scene.primitives.remove(this._flowPrimitive),this._flowInstances=void 0,this._flowItem=void 0,na(this)}}const W={};W.GridPolygon=1,W.GridPoint=2,W.IndexBuffer=3;const{BoundingSphere:oa,Cartesian3:ce,ComponentDatatype:Tt,EncodedCartesian3:to,Geometry:sa,GeometryAttribute:Et,GeometryInstance:ca,Primitive:la}=SuperMap3D;class At{constructor(){}static load(e){var x,E,I;if(!e._waterBufferData)throw"使用顶点buffer结构需要传入结构数据!";if(!window.proj4)throw"需要引入proj4.js转换投影计算uv!";let{indices:t,vertices:r,maskData:n}=e._waterBufferData;const o=[],a=[],i=[];let s=1/0,l=-1/0,h=1/0,u=-1/0,p=new ce;for(let R=0;R<r.length;R++){const P=r[R],ee=e._waterHeight!==-1?e._waterHeight:P[2];if(ce.fromDegrees(P[0],P[1],ee,void 0,p),a.push(p.x,p.y,p.z),i.push(R),R%e._bufferDataParticleLerp===0){const F=ce.fromDegrees(P[0],P[1],e._flowLineHeight);e._particles.set(`${P[0]}_${P[1]}`,{position:F,id:R})}const L=pa(P);s=L[0]<s?L[0]:s,l=L[0]>l?L[0]:l,h=L[1]<h?L[1]:h,u=L[1]>u?L[1]:u,o.push(L)}const f=o.map(([R,P])=>[(R-s)/(l-s),(P-h)/(u-h)]).flat(),_=(x=n==null?void 0:n.vertices1)!=null?x:[109.62476077284576,25.930013595011918],g=(E=n==null?void 0:n.vertices2)!=null?E:[118.73108774335694,25.521251874539647],C=(I=n==null?void 0:n.vertices3)!=null?I:[112.62169675645261,18.608134326108136];ce.fromDegrees(..._,-9999,void 0,p),a.push(p.x,p.y,p.z),f.push(0,0),i.push(99999999),ce.fromDegrees(...g,-9999,void 0,p),a.push(p.x,p.y,p.z),i.push(99999999),f.push(0,0),ce.fromDegrees(...C,-9999,void 0,p),a.push(p.x,p.y,p.z),i.push(99999999),f.push(0,0),t.push(r.length,r.length+1,r.length+2);const b=oa.fromVertices(a),D=new sa({attributes:{position:new Et({componentDatatype:Tt.DOUBLE,componentsPerAttribute:3,values:new Float32Array(a)}),st:new Et({componentDatatype:Tt.FLOAT,componentsPerAttribute:2,values:new Float32Array(f)}),dataId:new Et({componentDatatype:Tt.FLOAT,componentsPerAttribute:1,values:new Float32Array(i)})},indices:new Uint32Array(t),primitiveType:SuperMap3D.PrimitiveType.TRIANGLES,boundingSphere:b}),w=new ca({geometry:D});e._waterInstances=[w]}static create(e){e._waterPrimitive=new la({geometryInstances:e._waterInstances,appearance:e._appearance,asynchronous:!1,shadows:!0,isWater:!0}),e._waterPrimitive.isWater=!0,e._viewer.scene.primitives.add(e._waterPrimitive)}static _InitLabel(e,t){const{vertices:r}=e._waterBufferData;for(let n=0;n<r.length;n+=t){const o=r[n],a=e._waterStageViews[e._drawIndex][n],i=ce.fromDegrees(o[0],o[1],a+e._offsetHeight+e._labelHeight);e._lables.push({id:n,position:i}),e._lablesPrimitive.add({position:i,text:"水位:"+Number(a).toFixed(2)+" /m",font:"20px sans-serif",fillColor:SuperMap3D.Color.WHITE,eyeOffset:ce.ZERO,horizontalOrigin:SuperMap3D.HorizontalOrigin.CENTER,scale:.5})}}static updateHeight(e){}}const ha="EPSG:4326",ua="EPSG:3857";function pa(c){return window.proj4(ha,ua,[c[0],c[1]])}function fa(c,e,t={}){const r={type:"Feature"};return(t.id===0||t.id)&&(r.id=t.id),t.bbox&&(r.bbox=t.bbox),r.properties=e||{},r.geometry=c,r}function da(c,e,t={}){if(!c)throw new Error("coordinates is required");if(!Array.isArray(c))throw new Error("coordinates must be an Array");if(c.length<2)throw new Error("coordinates must be at least 2 numbers long");if(!Rr(c[0])||!Rr(c[1]))throw new Error("coordinates must contain numbers");return fa({type:"Point",coordinates:c},e,t)}function Rr(c){return!isNaN(c)&&c!==null&&!Array.isArray(c)}function Wr(c,e,t){if(c!==null)for(var r,n,o,a,i,s,l,h=0,u=0,p,d=c.type,f=d==="FeatureCollection",_=d==="Feature",g=f?c.features.length:1,C=0;C<g;C++){l=f?c.features[C].geometry:_?c.geometry:c,p=l?l.type==="GeometryCollection":!1,i=p?l.geometries.length:1;for(var b=0;b<i;b++){var D=0,w=0;if(a=p?l.geometries[b]:l,a!==null){s=a.coordinates;var x=a.type;switch(h=0,x){case null:break;case"Point":if(e(s,u,C,D,w)===!1)return!1;u++,D++;break;case"LineString":case"MultiPoint":for(r=0;r<s.length;r++){if(e(s[r],u,C,D,w)===!1)return!1;u++,x==="MultiPoint"&&D++}x==="LineString"&&D++;break;case"Polygon":case"MultiLineString":for(r=0;r<s.length;r++){for(n=0;n<s[r].length-h;n++){if(e(s[r][n],u,C,D,w)===!1)return!1;u++}x==="MultiLineString"&&D++,x==="Polygon"&&w++}x==="Polygon"&&D++;break;case"MultiPolygon":for(r=0;r<s.length;r++){for(w=0,n=0;n<s[r].length;n++){for(o=0;o<s[r][n].length-h;o++){if(e(s[r][n][o],u,C,D,w)===!1)return!1;u++}w++}D++}break;case"GeometryCollection":for(r=0;r<a.geometries.length;r++)if(Wr(a.geometries[r],e)===!1)return!1;break;default:throw new Error("Unknown Geometry Type")}}}}}function ma(c,e={}){if(c.bbox!=null&&e.recompute!==!0)return c.bbox;const t=[1/0,1/0,-1/0,-1/0];return Wr(c,r=>{t[0]>r[0]&&(t[0]=r[0]),t[1]>r[1]&&(t[1]=r[1]),t[2]<r[0]&&(t[2]=r[0]),t[3]<r[1]&&(t[3]=r[1])}),t}function _a(c,e={}){const t=ma(c),r=(t[0]+t[2])/2,n=(t[1]+t[3])/2;return da([r,n],e.properties,e)}var va=_a,wa=`precision highp float;\r
precision highp sampler2D;\r
in vec3 v_positionWC;\r
in vec3 v_eye;\r
in float v_dataId;\r
uniform float u_alpha;\r
uniform sampler2D u_colorTable;\r
uniform sampler2D u_waterDepthTexture;

float getL(float dataId) {\r
    return floor(mod(dataId, u_texWidth)) / u_texWidth;\r
}\r
float getH(float dataId) {\r
    return floor(dataId / u_texHeight) / u_texHeight;\r
}\r
czm_material czm_getMaterial(czm_materialInput materialInput) {\r
    czm_material material = czm_getDefaultMaterial(materialInput);\r
    vec2 st = materialInput.st;\r
    float idIndex = floor(v_dataId + 0.5);\r
    float l = getL(idIndex);\r
    float h = getH(idIndex);\r
    float alpha = u_alpha;\r
    float colorIndex = texture(u_waterDepthTexture, vec2(l, h)).r;\r
    
    if(colorIndex <= u_isAlpha || colorIndex * 50. <= v_positionWC.z){\r
        material.alpha = 0.0;\r
        return material;\r
    }\r
    colorIndex = (colorIndex - (u_minHeight)) / (u_maxHeight - (u_minHeight));\r
    material.diffuse = texture(u_colorTable, vec2(colorIndex, 0.0 )).rgb;\r
    material.alpha = alpha;\r
    return material;\r
}`,ga=`precision highp float;\r
precision highp sampler2D;\r
in vec3 position3DHigh;\r
in vec3 position3DLow;\r
in float batchId;\r
in vec3 normal;\r
in float dataId;\r
in vec2 st;\r
out vec3 v_positionEC;\r
out vec3 v_positionWC;\r
out vec3 v_normalEC;\r
out vec3 v_eye;\r
out vec2 v_st;\r
out float v_dataId;\r
void main()\r
{\r
    vec4 p = czm_computePosition();\r
    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;\r
    v_normalEC = czm_normal * normal;\r
    v_dataId = czm_batchTable_dataId(batchId);\r
    v_positionWC = (czm_cameraEastNorthUp * czm_inverseView * vec4(v_positionEC , 1.0)).xyz;\r
    v_eye = (czm_cameraEastNorthUp * vec4(czm_viewerPositionWC,1.0)).xyz;\r
    v_st = st;\r
    gl_Position = czm_modelViewProjectionRelativeToEye * p;\r
}`,xa=`in vec3 v_positionEC;\r
in vec3 v_normalEC;\r
in vec2 v_st;\r
void main()\r
{\r
    vec3 positionToEyeEC = -v_positionEC;\r
    vec3 normalEC = normalize(v_normalEC);\r
    #ifdef FACE_FORWARD\r
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);\r
    #endif\r
    czm_materialInput materialInput;\r
    materialInput.normalEC = normalEC;\r
    materialInput.positionToEyeEC = positionToEyeEC;\r
    materialInput.st = v_st;\r
    czm_material material = czm_getMaterial(materialInput);\r
    #ifdef FLAT\r
    out_FragColor = vec4(material.diffuse + material.emission, material.alpha);\r
    #else\r
    out_FragColor = czm_phong(normalize(positionToEyeEC), material, czm_lightDirectionEC);\r
    #endif\r
}`;const{DeveloperError:q,Color:at,defaultValue:m,Texture:Q,PixelDatatype:Le,PixelFormat:Re,Sampler:fe,Cartesian3:de,Cartesian2:ya,Primitive:Hr,TextureMinificationFilter:me,TextureMagnificationFilter:We,TextureWrap:$,MaterialAppearance:Sa,GeometryInstance:Ca,GeometryInstanceAttribute:Da,ComponentDatatype:Pa,HorizontalOrigin:Nr,destroyObject:Ma,JulianDate:He,Material:ba,ClockRange:Ta,defined:U,Event:It,Pass:Ur,buildModuleUrl:Ne,LabelCollection:Ea,Resource:ot,Transforms:Aa,Matrix3:Fr,Matrix4:st}=SuperMap3D;class Ia{constructor(e,t={}){if(!U(e))throw new q(" optison.viewer 没有被定义 ");this._viewer=e,this.palyStopEvent=new It,this.palyEvent=new It,this.loadEndEvent=new It,this._dataSets=[],this._waterDepthViews=[],this._waterStageViews=[],this._waterUV_UViews=[],this._waterUV_VViews=[],this._currentWaterDepthView=void 0,this._currentWaterStageView=void 0,this._currentWaterVelocityXView=void 0,this._currentWaterVelocityYView=void 0,this._waterDepthTexture=void 0,this._waterDepthNextTexture=void 0,this._waterStageTexture=void 0,this._waterUV_UTexture=void 0,this._waterUV_VTexture=void 0,this._waterPrimitive=void 0,this._waterVolumePrimitive=void 0,this._flowArrowPrimitive=void 0,this._flowLinePrimitive=void 0,this._waterInstances=[],this._volumeInstances=[],this._lerpNum=0,this._oldMinutes=0,this._palyState=!1,this._loadDataViewState=!1,this._particles=new Map,this._flowLines=[],this._flowLineImage=Ne("Assets/Data/line.png"),this._flowLinePrimitive=void 0,this._drawColors=Ne("Assets/Data/colorTable.png"),this._drawColors2=Ne("Assets/Data/colorTable2.png"),this._waterSlices=[],this._lables=[],this._lablesPrimitive=this._viewer.scene.primitives.add(new Ea)}loadFile(e,t={}){if(!U(e.Grid))throw new q(" optison.Grid 没有被定义 ");if(!U(e.Info))throw new q(" optison.Info 没有被定义 ");let r=0,n=!1;this._fileCount=Object.keys(e.Info).length,this._waterDepthEnable=!0,this._waterStageEnable=!0,this._waterUEnable=!0,this._waterVEnable=!0;for(let o in e.Info){const a=e.Info[o];Ir(a,null,o).then(i=>{r+=1,this._dataSets[i.name]=i.data,r===this._fileCount&&n&&this.initWater(t)})}Vr(e.Grid).then(o=>{n=!0,this._dataSets.Grid=o.resData.features,r===this._fileCount&&this.initWater(t)})}loadData(e,t={}){if(!U(e.Grid))throw new q(" optison.Grid 没有被定义 ");if(!U(e.Info))throw new q(" optison.Info 没有被定义 ");this._dataSets.Grid=e.Grid,e.BufferData&&(this._waterBufferData=e.BufferData,this._drawVerticeShader=!0);for(let r in e.Info){const n=e.Info[r];this._dataSets[r]=n}this._waterDepthEnable=!!this._dataSets.Depth,this._waterStageEnable=!!this._dataSets.Stage,this._waterUEnable=!!this._dataSets.U,this._waterVEnable=!!this._dataSets.V,this.initWater(t)}loadGridData(e,t={}){if(!U(e))throw new q(" optison.Grid 没有被定义 ");this._dataSets.Grid=e;const r=e.length,n=[];for(let o=0;o<t.drawCount;o++){const a=[];for(let i=1;i<=r;i++)a.push(0);n.push(a)}this._dataSets.Depth=n,this._dataSets.Stage=n,this._dataSets.U=n,this._dataSets.V=n,this._waterDepthEnable=!!this._dataSets.Depth,this._waterStageEnable=!!this._dataSets.Stage,this._waterUEnable=!!this._dataSets.U,this._waterVEnable=!!this._dataSets.V,this.initWater(t)}loadIndexBufferData(e,t={}){const{bufferData:r,infoData:n}=e;if(!U(r.vertices)||!U(r.indices))throw new q(" indices 和 vertices 为必须传入项! ");this._drawVerticeShader=!0,this._waterBufferData=r,this._dataSets.Depth=n.Depth,this._dataSets.Stage=n.Stage,this._dataSets.U=n.U,this._dataSets.V=n.V,this._waterDepthEnable=!!this._dataSets.Depth,this._waterStageEnable=!!this._dataSets.Stage,this._waterUEnable=!!this._dataSets.U,this._waterVEnable=!!this._dataSets.V,this.initWater(t)}initWater(e){if(this._waterData=this._dataSets.Grid,this._waterDepth=this._dataSets.Depth,!U(this._waterBufferData)&&!U(this._waterData))throw new q(" waterData 为必须传入项! ");if(!U(this._waterDepth))throw new q(" waterDepth 为必须传入项! ");this._waterStageData=this._dataSets.Stage,this._waterUV_U=this._dataSets.U,this._waterUV_V=this._dataSets.V,this._gridType=m(e.gridType,W.GridPolygon),this._gridId=m(e.gridId,"HydroID"),this._gridIdIndex=m(e.gridIdIndex,1),this._gridPointSize=m(e.gridPointSize,5),this._drawType=m(e.drawType,1),this._drawGroundGrid=m(e.drawGroundGrid,!1),this._startTime=m(e.startTime,new He),this._stopTime=m(e.stopTime,new He),this._drawInterval=m(e.drawInterval,5),this._drawIndex=m(e.drawIndex,0),this._drawCount=m(e.drawCount,this._waterDepth.length-1),this._multiplier=m(e.multiplier,1),this._alpha=m(e.alpha,1),this._isAlpha=m(e.isAlpha,0),this._renderHeight=m(e.renderHeight,new ya(0,0)),this._texWidth=m(e.texWidth,512),this._texHeight=m(e.texHeight,512),this._textureSize=m(e.texHeight,256),this._maxHeight=m(e.maxHeight,4),this._minHeight=m(e.minHeight,0),this._waterHeight=m(e.waterHeight,-1),this._offsetHeight=m(e.offsetHeight,0),this._alphaLerp=m(e.alphaLerp,!0),this._waterColor=m(e.waterColor,at.fromCssColorString("#101e3c")),this._waterBackColor=m(e.waterBackColor,at.fromCssColorString("#6e4600")),this._flowSpeed=m(e.flowSpeed,12),this._flowUvSize=m(e.flowUvSize,.08),this._flowLineHeight=m(e.flowLineHeight,220),this._flowLineSpeed=m(e.flowLineSpeed,.01),this._flowLineColorMix=m(e.flowLineColorMix,1),this._flowLineLength=m(e.flowLineLength,50),this._flowUpdate=m(e.flowUpdate,!1),this._flowUpdateLerp=m(e.flowUpdateLerp,3),this._reflectPlaneHeight=m(e.reflectPlaneHeight,1),this._reflectPlaneCenter=m(e.reflectPlaneCenter,void 0),this._renderMode=m(e.renderMode,1),this._renderPass=m(e.renderPass,[Ur.CESIUM_3D_TILE]),this._renderMode2=m(e.renderMode2,1),this._renderPass2=m(e.renderPass2,[Ur.GLOBE]),this._mixWater=m(e.mixWater,0),this._showArrow=m(e.showArrow,!1),this._showDepth=m(e.showDepth,!0),this._showFlow=m(e.showFlow,!1),this._showFlowField=m(e.showFlowField,!1),this._showReflect=m(e.showReflect,!1),this._showRefract=m(e.showRefract,!1),this._showWaterEffect=this._showReflect||this._showRefract,this._mixWaterEffect=m(e.mixWaterEffect,.5),this._waterSpeed=m(e.waterSpeed,120),this._reflectionStrength=m(e.reflectionStrength,1),this._refractionStrength=m(e.refractionStrength,1),this._baseColorType=m(e.baseColorType,0),this._drawColors=m(e.drawColors,this._drawColors),this._drawColors2=m(e.drawColors2,this._drawColors2),this._labelShow=m(e.labelShow,!1),this._labelHeight=m(e.labelHeight,60),this._bufferDataParticleLerp=m(e.bufferDataParticleLerp,5),this._maxWaterPointGridNumber=m(e.maxWaterPointGridNumber,1e6),this._maxWaterPolygonGridNumber=m(e.maxWaterPolygonGridNumber,3e5),this._timeCount=this._drawCount*this._drawInterval,this._sss=m(e.sss,!0),this._fbm=m(e.fbm,!1),this._waterDepthMode=m(e.waterDepthMode,!1),this.drawWater(),this.loadEndEvent.raiseEvent()}drawWater(){this._ProcessGrid(),this._InitTexture(),this._InitWaterAppearance(),this._InitWaterPrimitve(),this._InitFlowField(),this._InitLabel(),this._InitTime(),this.drawType=this._drawType}_ProcessGrid(){for(let e=0;e<this._drawCount;e++)if(e<this._waterDepth.length){if(this._waterDepthEnable){const t=this._waterDepth[e],r=new Float32Array(this._texWidth*this._texHeight);r.set(t,0),this._waterDepthViews.push(r)}if(this._waterStageEnable){const t=this._waterStageData[e],r=new Float32Array(this._texWidth*this._texHeight);r.set(t,0),this._waterStageViews.push(r)}if(this._waterUEnable){const t=this._waterUV_U[e],r=new Float32Array(this._texWidth*this._texHeight);r.set(t,0),this._waterUV_UViews.push(r)}if(this._waterVEnable){const t=this._waterUV_V[e],r=new Float32Array(this._texWidth*this._texHeight);r.set(t,0),this._waterUV_VViews.push(r)}}else this._waterDepthEnable&&this._waterDepthViews.push([]),this._waterStageEnable&&this._waterStageViews.push([]),this._waterUEnable&&this._waterUV_UViews.push([]),this._waterVEnable&&this._waterUV_VViews.push([]);this._waterDepthEnable&&(this._currentWaterDepthView=this._waterDepthViews[this._drawIndex]),this._waterStageEnable&&(this._currentWaterStageView=this._waterStageViews[this._drawIndex]),this._waterUEnable&&(this._currentWaterVelocityXView=this._waterUV_UViews[this._drawIndex]),this._waterVEnable&&(this._currentWaterVelocityYView=this._waterUV_VViews[this._drawIndex]),this._gridType===W.GridPolygon?it.load(this):this._gridType===W.GridPoint?Ze.load(this):this._gridType===W.IndexBuffer&&At.load(this),this._viewer.scene._reflectTexture||(this._viewer.scene._reflectTexture=new yt({scene:this._viewer.scene,planeCenterPos:this._planeCenterPos,planeNormal:this._planeNormal,renderState:this._showReflect,renderMode:this._renderMode,renderPass:this._renderPass,isClipPlane:!0})),this._waterDepth=void 0,this._waterStageData=void 0,this._waterUV_U=void 0,this._waterUV_V=void 0,this._dataSets=void 0}_InitTexture(){this._waterDepthTexture=new Q({context:this._viewer.scene.context,width:this._texWidth,height:this._texHeight,pixelFormat:Re.RED,pixelDatatype:Le.FLOAT,sampler:new fe({wrapS:$.CLAMP_TO_EDGE,wrapT:$.CLAMP_TO_EDGE,minificationFilter:me.NEAREST,magnificationFilter:We.NEAREST}),flipY:!1}),this._waterDepthNextTexture=new Q({context:this._viewer.scene.context,width:this._texWidth,height:this._texHeight,pixelFormat:Re.RED,pixelDatatype:Le.FLOAT,sampler:new fe({wrapS:$.CLAMP_TO_EDGE,wrapT:$.CLAMP_TO_EDGE,minificationFilter:me.NEAREST,magnificationFilter:We.NEAREST}),flipY:!1}),this._waterStageTexture=new Q({context:this._viewer.scene.context,width:this._texWidth,height:this._texHeight,pixelFormat:Re.RED,pixelDatatype:Le.FLOAT,sampler:new fe({wrapS:$.CLAMP_TO_EDGE,wrapT:$.CLAMP_TO_EDGE,minificationFilter:me.NEAREST,magnificationFilter:We.NEAREST}),flipY:!1}),this._waterUV_UTexture=new Q({context:this._viewer.scene.context,width:this._texWidth,height:this._texHeight,pixelFormat:Re.RED,pixelDatatype:Le.FLOAT,sampler:new fe({wrapS:$.CLAMP_TO_EDGE,wrapT:$.CLAMP_TO_EDGE,minificationFilter:me.NEAREST,magnificationFilter:We.NEAREST}),flipY:!1}),this._waterUV_VTexture=new Q({context:this._viewer.scene.context,width:this._texWidth,height:this._texHeight,pixelFormat:Re.RED,pixelDatatype:Le.FLOAT,sampler:new fe({wrapS:$.CLAMP_TO_EDGE,wrapT:$.CLAMP_TO_EDGE,minificationFilter:me.NEAREST,magnificationFilter:We.NEAREST}),flipY:!1}),this._waterDepthTexture.copyFrom({width:this._waterDepthTexture.width,height:this._waterDepthTexture.height,arrayBufferView:this._currentWaterDepthView}),this._waterDepthNextTexture.copyFrom({width:this._waterDepthNextTexture.width,height:this._waterDepthNextTexture.height,arrayBufferView:this._waterDepthViews[this._drawIndex+1]||this._currentWaterDepthView}),this._waterStageTexture.copyFrom({width:this._waterStageTexture.width,height:this._waterStageTexture.height,arrayBufferView:this._currentWaterStageView}),this._waterUV_UTexture.copyFrom({width:this._waterUV_UTexture.width,height:this._waterUV_UTexture.height,arrayBufferView:this._currentWaterVelocityXView}),this._waterUV_VTexture.copyFrom({width:this._waterUV_VTexture.width,height:this._waterUV_VTexture.height,arrayBufferView:this._currentWaterVelocityYView})}set waterNormalMap(e){e&&ot.fetchImage({url:e}).then(t=>{this._waterNormalMap=new Q({context:this._viewer.scene.frameState.context,source:t,sampler:new fe({minificationFilter:me.LINEAR_MIPMAP_LINEAR})}),this._waterNormalMap.generateMipmap()})}_InitWaterAppearance(){this._appearance=new Zi(this),this._waterNormalMap=this._viewer.scene.frameState.context.defaultTexture,ot.fetchImage({url:this._sss?Ne("Assets/Data/normal004.jpg"):Ne("Assets/Data/waternormals.jpg")}).then(r=>{this._waterNormalMap=new Q({context:this._viewer.scene.frameState.context,source:r,sampler:new fe({minificationFilter:me.LINEAR_MIPMAP_LINEAR})}),this._waterNormalMap.generateMipmap()}),ot.fetchImage({url:this._drawColors}).then(r=>{this._colorTable=new Q({context:this._viewer.scene.frameState.context,source:r})}),ot.fetchImage({url:this._drawColors2}).then(r=>{this._colorTable2=new Q({context:this._viewer.scene.frameState.context,source:r})}),this._appearance.material._uniforms.u_colorTable=()=>m(this._colorTable,this._viewer.scene.context.defaultTexture),this._appearance.material._uniforms.u_colorTable2=()=>m(this._colorTable2,this._viewer.scene.context.defaultTexture),this._appearance.material._uniforms.u_texHeight=()=>this._texHeight,this._appearance.material._uniforms.u_texWidth=()=>this._texWidth,this._appearance.material._uniforms.u_minHeight=()=>this._minHeight,this._appearance.material._uniforms.u_maxHeight=()=>this._maxHeight,this._appearance.material._uniforms.u_alpha=()=>this._alpha,this._appearance.material._uniforms.u_isAlpha=()=>this._isAlpha,this._appearance.material._uniforms.u_alphaLerp=()=>this._alphaLerp,this._appearance.material._uniforms.u_lerpNum=()=>this._lerpNum,this._appearance.material._uniforms.u_renderHeight=()=>this._renderHeight,this._appearance.material._uniforms.normalTexture=()=>this._waterNormalMap,this._appearance.material._uniforms.u_waterDepthTexture=()=>this._waterDepthTexture,this._appearance.material._uniforms.u_waterStageTexture=()=>this._waterStageTexture,this._appearance.material._uniforms.u_waterDepthNextTexture=()=>this._waterDepthNextTexture,this._appearance.material._uniforms.u_waterUV_UTexture=()=>this._waterUV_UTexture,this._appearance.material._uniforms.u_waterUV_VTexture=()=>this._waterUV_VTexture,this._appearance.material._uniforms.u_reflectTexture=()=>{const r=this._viewer.scene.frameState.getGlobalFramebuffer(1);return r?r.renderTexture._fb.getColorTexture(0):this._viewer.scene.context.defaultTexture},this._appearance.material._uniforms.u_refractTexture=()=>{var n;const r=(n=this._viewer.scene._colorCopyCommand)==null?void 0:n.colorTexture;return r||this._viewer.scene.context.defaultTexture},this._appearance.material._uniforms.globeDepthTexture=()=>m(this._viewer.scene.context.uniformState.globeDepthTexture,this._viewer.scene.context.defaultTexture),this._viewer.scene._colorCopyCommand||(this._viewer.scene._colorCopyCommand=new pe),this._appearance.material._uniforms.cameraEastNorthUp=()=>this._viewer.scene._cameraENU,this._appearance.material._uniforms.worldEastNorthUp=()=>this._viewer.scene._worldENU,this._appearance.material._uniforms.viewerPositionWC=()=>this._viewer.camera.positionWC,this._appearance.material._uniforms.inverseView=()=>this._viewer.camera.inverseViewMatrix;let e=new Fr;this._appearance.material._uniforms.inverseViewRotation=()=>(st.getMatrix3(this._viewer.camera.inverseViewMatrix,e),e),this._cycle=.128,this._halfCycle=this._cycle*.5,this._config=new SuperMap3D.Cartesian4(0,this._halfCycle,this._halfCycle,3),this._flowSpeed=.12;let t=this;this.disposeListener=this._viewer.scene.preRender.addEventListener(()=>{t._config.x+=t._flowSpeed*.0015,t._config.y=t._config.x+t._halfCycle,t._config.x>=t._cycle?(this._config.x-=this._cycle,this._config.y=this._config.x+this._halfCycle):t._config.y>=t._cycle&&(t._config.y=t._config.y-t._cycle)}),this._appearance.material._uniforms.u_config=()=>this._config,this._drawGroundGrid&&(this._appearance.customBatchTable=!0)}_InitWaterPrimitve(){this._gridType===W.GridPolygon?it.create(this):this._gridType===W.GridPoint?Ze.create(this):this._gridType===W.IndexBuffer&&At.create(this);const e=this._viewer;if(!e.scene._waterPassEvent){let t=!1;e.scene._worldENU=new SuperMap3D.Matrix4,e.scene._cameraENU=new SuperMap3D.Matrix4,e.scene._lastCameraPosition=new SuperMap3D.Cartesian3,e.scene._waterPassEvent=e.scene.postUpdate.addEventListener(()=>{const r=e.camera.positionWC;if(SuperMap3D.Cartesian3.distance(r,e.scene._lastCameraPosition)>5e3){const n=SuperMap3D.Cartographic.fromCartesian(r),o=SuperMap3D.Cartesian3.fromRadians(n.longitude,n.latitude,0);SuperMap3D.Transforms.eastNorthUpToFixedFrame(o,SuperMap3D.Ellipsoid.WGS84,e.scene._worldENU),SuperMap3D.Matrix4.inverse(e.scene._worldENU,e.scene._cameraENU),SuperMap3D.Cartesian3.clone(r,e.scene._lastCameraPosition)}if(!t&&this.primitive._colorCommands&&this.primitive._colorCommands.length>0){let n=this.primitive._colorCommands[0].derivedCommands.logDepth.command;n.derivedCommands.hdr&&(n=n.derivedCommands.hdr.command);const o=n.execute;n.execute=function(a,i){SuperMap3D.defined(e.scene.view.globeDepth)&&e.scene.view.globeDepth.executeCopyDepth(a,i),SuperMap3D.defined(e.scene._colorCopyCommand)&&e.scene._colorCopyCommand.update(e.scene.frameState),o.bind(this)(a,i)},t=!0}})}}_InitFlowField(){aa._InitFlowField(this)}_InitFlowArrow(){Qi._InitFlowArrow(this)}_processFlowLine(e){this._flowLines=[];let t=1;this._flowUpdate&&(t=this._flowUpdateLerp),this._particlesArray||(this._particlesArray=Array.from(this._particles.entries()));for(let r=0;r<this._particlesArray.length;r+=t){const[n,o]=this._particlesArray[r],a=o,i=a.id,s=a.position;if(this._currentWaterDepthView[i]>0){let l=Math.atan2(this._currentWaterVelocityYView[i],this._currentWaterVelocityXView[i]);const h=Math.sqrt(Math.pow(this._currentWaterVelocityXView[i],2)+Math.pow(this._currentWaterVelocityYView[i],2)),u=SuperMap3D.Math.toDegrees(l),p=Va(s,u,this._flowLineLength),d={positions:[s,p],style:{width:7},data:{id:i,dir:u,speed:h}};this._flowLines.push(d),typeof e=="function"&&e(d)}}}_InitLabel(e=10){if(this._lablesPrimitive.show=this._labelShow,!this._labelShow)return!1;if(this._lables=[],this._lablesPrimitive.removeAll(),this._drawVerticeShader){At._InitLabel(this,e);return}for(let t=0;t<this._waterData.length;t+=e){const r=this._waterData[t];if(window.turf&&r.geometry){const n=va(r),o=r.properties[this._gridId]-this._gridIdIndex,a=this._waterStageViews[this._drawIndex][o],i=de.fromDegrees(...n.geometry.coordinates,a+this._offsetHeight+this._labelHeight);this._lables.push({id:o,position:i}),this._lablesPrimitive.add({position:i,text:"水位:"+Number(a).toFixed(2)+" /m",font:"20px sans-serif",fillColor:at.WHITE,eyeOffset:de.ZERO,horizontalOrigin:Nr.CENTER,scale:.5})}}}_updateLabel(){if(!this._labelShow)return!1;this._lablesPrimitive.removeAll();for(let e=0;e<this._lables.length;e++){const t=this._lables[e].id,r=this._lables[e].position,n=this._waterStageViews[this._drawIndex][t];this._waterDepthViews[this._drawIndex][t]<=0||this._lablesPrimitive.add({position:r,text:"水位:"+Number(n).toFixed(2)+" /m",font:"20px sans-serif",fillColor:at.WHITE,eyeOffset:de.ZERO,horizontalOrigin:Nr.CENTER,scale:.5})}}_updateFlow(){this._showFlowField&&(this.showFlowField=!0),this._showArrowField&&(this.showArrowField=!0)}_InitTime(){this._viewer.clock.startTime=this._startTime,this._viewer.clock.stopTime=this._stopTime,this._viewer.clock.currentTime=this._viewer.clock.startTime.clone(),this._viewer.clock.multiplier=60*this._multiplier,this._viewer.clock.clockRange=Ta.CLAMPED,this._viewer.timeline&&this._viewer.timeline.zoomTo(this._viewer.clock.startTime,this._viewer.clock.stopTime),this._viewer.clock.onTick.addEventListener(()=>{if(!this._palyState|!this._viewer.clock.shouldAnimate)return!1;const e=Math.floor(He.secondsDifference(this._viewer.clock.currentTime,this._viewer.clock.startTime)),t=Math.floor(e/(60*this._drawInterval));t<=this._drawCount&&this._updateTime(t,Math.floor(e/60))}),this._viewer.clock.onStop.addEventListener(()=>{this._palyState=!1,this.palyStopEvent.raiseEvent()})}_updateTime(e,t){if(t===0&&(t=1),t===this._oldMinutes||this._waterDepthViews.length===0||(this.palyEvent.raiseEvent(e,t),this._loadDataViewState))return!1;if(this._drawIndex!==e&&this._waterDepthTexture){if(this._currentWaterDepthView=this._waterDepthViews[e],!this._currentWaterDepthView)return console.warn(`数据视图中没有当前批次:${e}`),!1;if(this._currentWaterDepthView.length===0)return console.warn(`当前批次:${e}数据视图中没有数据`),!1;this._waterStageEnable&&(this._currentWaterStageView=this._waterStageViews[e]),this._waterUEnable&&(this._currentWaterVelocityXView=this._waterUV_UViews[e]),this._waterVEnable&&(this._currentWaterVelocityYView=this._waterUV_VViews[e]),this._drawIndex=e,this._waterDepthTexture.copyFrom({width:this._waterDepthTexture.width,height:this._waterDepthTexture.height,arrayBufferView:this._currentWaterDepthView}),this._waterDepthNextTexture.copyFrom({width:this._waterDepthNextTexture.width,height:this._waterDepthNextTexture.height,arrayBufferView:e>=this._drawCount?this._currentWaterDepthView:this._waterDepthViews[e+1]||this._currentWaterDepthView}),this._waterStageEnable&&this._waterStageTexture.copyFrom({width:this._waterStageTexture.width,height:this._waterStageTexture.height,arrayBufferView:this._currentWaterStageView}),this._waterUEnable&&this._waterUV_UTexture.copyFrom({width:this._waterUV_UTexture.width,height:this._waterUV_UTexture.height,arrayBufferView:this._waterUV_UViews[this._drawIndex]}),this._waterVEnable&&this._waterUV_VTexture.copyFrom({width:this._waterUV_VTexture.width,height:this._waterUV_VTexture.height,arrayBufferView:this._waterUV_VViews[this._drawIndex]}),this._lerpNum=this._appearance.material.uniforms.u_lerpNum=0,this._labelShow&&this._updateLabel(),this._flowUpdate&&this._updateFlow()}else this._lerpNum=this._appearance.material.uniforms.u_lerpNum=t%this._drawInterval*(1/this._drawInterval);this._oldMinutes=t}_initWaterSliceAppearance(){return this._waterWallAppearance||(this._waterWallAppearance=new Sa({flat:!1,translucent:!0,material:new ba({fabric:{uniforms:{u_alpha:this._alpha,u_isAlpha:this._isAlpha,u_maxHeight:this._maxHeight,u_minHeight:this._minHeight,u_texHeight:this._texHeight,u_texWidth:this._texWidth},source:wa},translucent:function(e){return!0}}),vertexShaderSource:ga,fragmentShaderSource:xa}),this._waterWallAppearance.material._uniforms.u_waterDepthTexture=()=>this._waterDepthTexture,this._waterWallAppearance.material._uniforms.u_waterStageTexture=()=>this._waterStageTexture,this._waterWallAppearance.material._uniforms.u_colorTable=()=>m(this._colorTable,this._viewer.scene.context.defaultTexture)),this._waterWallAppearance}loadWaterSlice(e={}){let{positions:t,height:r,step:n}=e;if(!t)throw"positions 没有被传入!";r=m(r,300),n=m(n,500),this._waterWallAppearance=this._initWaterSliceAppearance();let o=new Map,a=1/n;for(let h=0;h<n;h++){let u=h*a,p=de.lerp(t[0],t[1],u,new de);const d=SceneTransforms.worldToDrawingBufferCoordinates(this._viewer.scene,p);let f=this._viewer.scene.pick(d);if(f&&f.primitive instanceof Hr){if(!f.id)continue;let _=parseInt(f.id.split("_")[1]);if(f=this.selectGridInfo(_),!o.get(_))f.id=_,f.position=p,o.set(_,f);else{const g=o.get(_);g.position2=p}}}const i=[];let s;o.forEach(h=>{h.position2&&(s||(s=h.position),i.push(new Ca({geometry:new WallGeometry({positions:[s,h.position2],minimumHeights:[r,r]}),attributes:{dataId:new Da({componentDatatype:Pa.FLOAT,componentsPerAttribute:1,normalize:!1,value:[parseFloat(h.id)]})}})),s=h.position2)});const l=this._viewer.scene.primitives.add(new Hr({geometryInstances:i,appearance:this._waterWallAppearance,asynchronous:!1}));return this._waterSlices.push(l),l}removeWaterSlice(e){this._viewer.scene.primitives.remove(e)}setTime(e=5,t=!1){if(this._viewer.clock.shouldAnimate=!1,this._viewer.clock.currentTime=He.addMinutes(this._viewer.clock.startTime,e,new He),e>this._drawCount*this._drawInterval)return console.warn("设置的时间超过最大淹没时间!"),!1;const r=parseInt(Math.floor(e)/this._drawInterval);this._updateTime(r,Math.floor(e)),this._drawType===2&&t&&this._updateExtrudedPrimitive(),this._drawType===1&&t&&this._updateHeightPrimitive()}fillDataView(e,t=!1){const{startIndex:r,endIndex:n,waterInfoData:o}=e;t&&(this._waterDepthViews=[],this._waterStageViews=[],this._waterUV_UViews=[],this._waterUV_VViews=[]);for(let a=r;a<=n;a++){if(!o.Depth[a])continue;const i=new Float32Array(this._texWidth*this._texHeight);if(i.set(o.Depth[a],0),this._waterDepthViews[a]=i,this._waterStageEnable){const s=new Float32Array(this._texWidth*this._texHeight);s.set(o.Stage[a],0),this._waterStageViews[a]=s}if(this._waterUEnable){const s=new Float32Array(this._texWidth*this._texHeight);s.set(o.U[a],0),this._waterUV_UViews[a]=s}if(this._waterVEnable){const s=new Float32Array(this._texWidth*this._texHeight);s.set(o.V[a],0),this._waterUV_VViews[a]=s}}return n}fillDataView2(e,t=!1){const{startIndex:r,endIndex:n,waterInfoData:o}=e;t&&(this._waterDepthViews=[],this._waterStageViews=[],this._waterUV_UViews=[],this._waterUV_VViews=[]);let a=0;for(let i=r;i<=n;i++){if(!o.Depth[a])continue;const s=new Float32Array(this._texWidth*this._texHeight);if(s.set(o.Depth[a],0),this._waterDepthViews[i]=s,this._waterStageEnable){const l=new Float32Array(this._texWidth*this._texHeight);l.set(o.Stage[a],0),this._waterStageViews[i]=l}if(this._waterUEnable){const l=new Float32Array(this._texWidth*this._texHeight);l.set(o.U[a],0),this._waterUV_UViews[i]=l}if(this._waterVEnable){const l=new Float32Array(this._texWidth*this._texHeight);l.set(o.V[a],0),this._waterUV_VViews[i]=l}a++}return n}fillDataViewByBatchId(e,t,r=!1){if(!e&&!t)throw"需要传入批次ID或者数据实体.";r&&(this._waterDepthViews=[],this._waterStageViews=[],this._waterUV_UViews=[],this._waterUV_VViews=[]);const n=new Float32Array(this._texWidth*this._texHeight);if(n.set(t.Depth,0),this._waterDepthViews[e]=n,this._waterStageEnable){const o=new Float32Array(this._texWidth*this._texHeight);o.set(t.Stage,0),this._waterStageViews[e]=o}if(this._waterUEnable){const o=new Float32Array(this._texWidth*this._texHeight);o.set(t.U,0),this._waterUV_UViews[e]=o}if(this._waterVEnable){const o=new Float32Array(this._texWidth*this._texHeight);o.set(t.V,0),this._waterUV_VViews[e]=o}return e}fillDataIdViewByBatchId(e,t,r=!1){if(!e&&!t)throw"需要传入批次ID或者数据实体.";r&&(this._waterDepthViews=[],this._waterStageViews=[],this._waterUV_UViews=[],this._waterUV_VViews=[]);const n=t.Stage,o=t.Depth,a=t.U,i=t.V;for(let s=0;s<o.length;s++)this._waterDepthViews[e][o[s].key]=o[s].value,this._waterStageEnable&&(this._waterStageViews[e][n[s].key]=n[s].value),this._waterUEnable&&(this._waterUV_UViews[e][a[s].key]=a[s].value),this._waterVEnable&&(this._waterUV_VViews[e][i[s].key]=i[s].value);return e}_updateExtrudedPrimitive(){this._gridType===W.GridPolygon?it.updateVolume(this):this._gridType===W.GridPoint&&Ze.updateVolume(this)}_updateHeightPrimitive(){this._gridType===W.GridPolygon?it.updateHeight(this):this._gridType===W.GridPoint&&Ze.updateHeight(this)}play(e={}){const{multiplier:t,minHeight:r,maxHeight:n,alpha:o,offsetHeight:a,waterHeight:i,alphaLerp:s,colorMix:l,waterColor:h,waterBackColor:u,drawType:p,flowAlpha:d,flowSpeed:f,flowUvSize:_,flowRotUv:g}=e;this._appearance.material.uniforms.u_waterColor=m(h,this._waterColor),this._appearance.material.uniforms.u_waterBackColor=m(u,this._waterBackColor),this._appearance.material.uniforms.u_alpha=m(o,this._alpha),this._appearance.material.uniforms.u_maxHeight=m(n,this._maxHeight),this._appearance.material.uniforms.u_minHeight=m(r,this._minHeight),this._appearance.material.uniforms.u_alphaLerp=m(s,this._alphaLerp),this._appearance.material.uniforms.u_mix=m(l,this._colorMix),this._appearance.material.uniforms.u_flowAlpha=m(d,this._flowAlpha),this._appearance.material.uniforms.u_flowSpeed=m(f,this._flowSpeed),this._appearance.material.uniforms.u_flowUvSize=m(_,this._flowUvSize),this._appearance.material.uniforms.u_flowRotUv=m(g,this._flowRotUv),this._offsetHeight=m(a,this._offsetHeight),this._waterHeight=m(i,this._waterHeight),this._viewer.clock.multiplier=m(60*t,60*this._multiplier),this._viewer.clock.currentTime=this._viewer.clock.startTime.clone(),this._drawIndex=0,this._currentWaterDepthView=this._waterDepthViews[0],this._currentWaterStageView=this._waterStageViews[0],this._currentWaterVelocityXView=this._waterUV_UViews[0],this._currentWaterVelocityYView=this._waterUV_VViews[0],this._waterDepthTexture.copyFrom({width:this._waterDepthTexture.width,height:this._waterDepthTexture.height,arrayBufferView:this._currentWaterDepthView}),this._waterDepthNextTexture.copyFrom({width:this._waterDepthNextTexture.width,height:this._waterDepthNextTexture.height,arrayBufferView:this._waterDepthViews[1]||this._currentWaterDepthView}),this._waterStageEnable&&this._waterStageTexture.copyFrom({width:this._waterStageTexture.width,height:this._waterStageTexture.height,arrayBufferView:this._currentWaterStageView}),this._waterUEnable&&this._waterUV_UTexture.copyFrom({width:this._waterUV_UTexture.width,height:this._waterUV_UTexture.height,arrayBufferView:this._waterUV_UViews[0]}),this._waterVEnable&&this._waterUV_VTexture.copyFrom({width:this._waterUV_VTexture.width,height:this._waterUV_VTexture.height,arrayBufferView:this._waterUV_VViews[0]}),typeof p=="number"&&(this.drawType=p),this._viewer.clock.shouldAnimate=!0,this._palyState=!0}pause(e){this._viewer.clock.shouldAnimate=!1,this._palyState=!1,e&&(this._loadDataViewState=!0)}cancelPause(e){this._viewer.clock.shouldAnimate=!0,this._palyState=!0,e&&(this._loadDataViewState=!1)}forward(e=1,t=!0){this._viewer.clock.shouldAnimate=!1,t?this.play({multiplier:e}):(this._viewer.clock.multiplier=m(60*e,60*this._multiplier),this._viewer.clock.shouldAnimate=!0)}destroy(){return this.pause(),this._lablesPrimitive&&this._viewer.scene.primitives.remove(this._lablesPrimitive),this._waterPrimitive&&this._viewer.scene.primitives.remove(this._waterPrimitive),this._waterVolumePrimitive&&this._viewer.scene.primitives.remove(this._waterVolumePrimitive),this._flowLinePrimitive&&this._viewer.scene.primitives.remove(this._flowLinePrimitive),this._flowArrowPrimitive&&this._viewer.scene.primitives.remove(this._flowArrowPrimitive),this._waterDepthTexture&&this._waterDepthTexture.destroy(),this._waterDepthTexture=null,this._waterDepthNextTexture&&this._waterDepthNextTexture.destroy(),this._waterDepthNextTexture=null,this._waterStageTexture&&this._waterStageTexture.destroy(),this._waterStageTexture=null,this._waterUV_UTexture&&this._waterUV_UTexture.destroy(),this._waterUV_UTexture=null,this._waterUV_VTexture&&this._waterUV_VTexture.destroy(),this._waterUV_VTexture=null,this._waterSlices.forEach(e=>{this._viewer.scene.primitives.remove(e)}),Ma(this)}selectGridInfo(e){const t=Math.atan2(this._currentWaterVelocityYView[e],this._currentWaterVelocityXView[e]),r=Math.sqrt(Math.pow(this._currentWaterVelocityXView[e],2)+Math.pow(this._currentWaterVelocityYView[e],2)),n=SuperMap3D.Math.toDegrees(t);return{水深:this._currentWaterDepthView[e],水位:this._currentWaterStageView[e],水速:r,水向:n}}selectGridsInfo(e,t=0,r=!0){if(!(e instanceof Array))throw"ids 需要为一组数值.";const n=[];let o=!1;for(let a=0;a<e.length;a++){const i=this.selectGridInfo(e[a]);if(n.push({id:e[a],info:i}),i.水深>t&&(o=!0,r))break}return{isFlood:o,countObject:n}}updateHeightPrimitive(e=-1){this._waterHeight=e,this._updateHeightPrimitive()}updateExtrudedPrimitive(e=-1){this._waterHeight=e,this._updateExtrudedPrimitive()}get appearance(){return this._appearance}get primitive(){return this._waterPrimitive}set showArrow(e){this._showArrow=e,this._appearance.material.uniforms.u_showArrow=e}set showDepth(e){this._showDepth=e,this._appearance.material.uniforms.u_showDepth=e}set showFlow(e){this._showFlow=e,this._appearance.material.uniforms.u_showFlow=e}set showFlowField(e){this._showFlowField=e,this._flowLinePrimitive&&this._flowLinePrimitive.drawIndex===this._drawIndex?this._flowLinePrimitive.show=e:this._InitFlowField()}set showArrowField(e){this._showArrowField=e,this._flowArrowPrimitive&&this._flowArrowPrimitive.drawIndex===this._drawIndex?this._flowArrowPrimitive.show=e:this._InitFlowArrow()}set showReflect(e){this._showReflect=e,this._viewer.scene._reflectTexture.renderState=e,this._appearance.material.uniforms.u_showReflect=e}set showRefract(e){this._showRefract=e,this._czmRefractTexture.renderState=e,this._appearance.material.uniforms.u_mixWaterEffect=e?0:1,this._showRefract||this._showReflect?(this._showWaterEffect=!0,this._appearance.material.uniforms.u_showWaterEffect=!0):(this._showWaterEffect=!1,this._appearance.material.uniforms.u_showWaterEffect=!1)}set reflectHeight(e){this._viewer.scene._reflectTexture._planeHeight=e}set waterSpeed(e){this._waterSpeed=e,this._appearance.material.uniforms.u_waterSpeed=e}set mixWaterEffect(e){this._showReflect=!0,this._showRefract=!0,this._czmRefractTexture.renderState=!0,this._viewer.scene._reflectTexture.renderState=!0,e===1&&(this._showRefract=!1,this._czmRefractTexture.renderState=!1),e===0&&(this._showReflect=!1,this._viewer.scene._reflectTexture.renderState=!1),this._appearance.material.uniforms.u_mixWaterEffect=e}set reflectionStrength(e){this._reflectionStrength=e,this._appearance.material.uniforms.u_reflectionStrength=e}set refractionStrength(e){this._refractionStrength=e,this._appearance.material.uniforms.u_refractionStrength=e}set mixWater(e){this._mixWater=parseFloat(e),this._appearance.material.uniforms.u_mixWater=parseFloat(e)}set flowLineSpeed(e){this._flowLineSpeed=e,this._flowLinePrimitive.appearance.material.uniforms.u_flowLineSpeed=parseFloat(e)}set flowLineColorMix(e){this._flowLineColorMix=e,this._flowLinePrimitive.appearance.material.uniforms.u_flowLineColorMix=parseFloat(e)}set maxHeight(e){this._maxHeight=parseFloat(e),this._appearance.material.uniforms.u_maxHeight=parseFloat(e)}set minHeight(e){this._minHeight=parseFloat(e),this._appearance.material.uniforms.u_minHeight=parseFloat(e)}set isAlpha(e){this._isAlpha=e,this._appearance.material.uniforms.u_isAlpha=e}set alpha(e){this._alpha=parseFloat(e),this._appearance.material.uniforms.u_alpha=parseFloat(e)}set alphaLerp(e){this._alphaLerp=!!e,this._appearance.material.uniforms.u_alphaLerp=!!e}set colorMix(e){this._colorMix=!!e,this._appearance.material.uniforms.u_mix=!!e}set waterColor(e){this._waterColor=e,this._appearance.material.uniforms.u_waterColor=e}set reflectNum(e){this._appearance.material.uniforms.u_reflectNum=e}set distortionScale(e){this._appearance.material.uniforms.u_distortionScale=e}set arrowSize(e){this._appearance.material.uniforms.u_arrowSize=e}set waterBackColor(e){this._waterBackColor=e,this._appearance.material.uniforms.u_waterBackColor=e}set flowSpeed(e){this._flowSpeed=e,this._appearance.material.uniforms.u_flowSpeed=e}set flowUvSize(e){this._flowUvSize=e,this._appearance.material.uniforms.u_flowUvSize=e}set flowAlpha(e){this._flowAlpha=e,this._appearance.material.uniforms.u_flowAlpha=e}set flowRotUv(e){this._flowRotUv=e,this._appearance.material.uniforms.u_flowRotUv=e}set offsetHeight(e){this._offsetHeight=parseFloat(e),this._updateExtrudedPrimitive()}set renderHeight(e){this._renderHeight.x=e}set renderBaseHeight(e){this._renderHeight.y=e}set drawType(e){if(this._drawVerticeShader){this._waterPrimitive.show=!0;return}switch(this._drawType=e,parseInt(e)){case 1:this._waterVolumePrimitive.show=!1,this._waterPrimitive.show=!0,this._appearance.material.uniforms.u_showFlow=!1;break;case 2:this._updateExtrudedPrimitive();break;default:throw"没有此推演模式!"}}}function Va(c,e,t){const r=Aa.eastNorthUpToFixedFrame(c),n=Fr.fromRotationZ(SuperMap3D.Math.toRadians(e)),o=st.fromRotationTranslation(n);return st.multiply(r,o,r),st.multiplyByPoint(r,new de(t,0,0),new de)}const{Primitive:za,Resource:Vt,TextureMinificationFilter:zt,Sampler:Lt,Texture:Rt,DeveloperError:La,Cartesian3:Ra,defaultValue:X,destroyObject:Wa,ShadowMode:Ha,GeometryInstance:Na,buildModuleUrl:Wt,Cartesian4:Or,defined:Ua,Matrix4:Fa,Matrix3:Oa}=SuperMap3D;class Gr{constructor(e,t={}){if(!e)throw new La("viewer 没有被定义 ");this._viewer=e,this._polygon=t.polygon,this._instances=t.instances,this._show=X(t.show,!0),this._planeHeight=X(t.planeHeight,700),this._centerPos=X(t.centerPos,new Ra),this._renderMode=X(t.renderMode,1),this._renderPass=X(t.renderPass,[2]),this._minWaveHeight=X(t.minWaveHeight,void 0),this._maxWaveHeight=X(t.maxWaveHeight,void 0),this._maskMapUrl=X(t.maskMapUrl,void 0),this._waveParam=new Or(this._minWaveHeight,this._maxWaveHeight,.12,1),this._waveParam2=new Or(1,.5,4,.9),this._sss=X(t.sss,!0),this._waterEffect=void 0,this._waterDepthEffect=void 0,this.init()}get show(){return this._show}set show(e){this._waterEffect.show=e}get primitive(){return this._waterEffect}get appearance(){return this._waterDepthEffect}set showReflect(e){this._viewer.scene._reflectTexture._renderState=e,this.appearance.material.uniforms.showReflect=e}get showReflect(){return this._viewer.scene._reflectTexture._renderState}init(){this._instances||(this._instances=new Na({geometry:this._polygon})),this._normalMap=this._viewer.scene.frameState.context.defaultTexture,Vt.fetchImage({url:this._sss?Wt("Assets/Data/normal004.jpg"):Wt("Assets/Data/waternormals.jpg")}).then(n=>{this._normalMap=new Rt({context:this._viewer.scene.frameState.context,source:n,sampler:new Lt({minificationFilter:zt.LINEAR_MIPMAP_LINEAR})}),this._normalMap.generateMipmap()}),this._noiseTexture=this._viewer.scene.frameState.context.defaultTexture,Vt.fetchImage({url:Wt("Assets/Data/texture4.png")}).then(n=>{this._noiseTexture=new Rt({context:this._viewer.scene.frameState.context,source:n,sampler:new Lt({minificationFilter:zt.LINEAR_MIPMAP_LINEAR})}),this._noiseTexture.generateMipmap()});let e=this._viewer.scene.frameState.context.defaultTexture;this._maskMapUrl&&Vt.fetchImage({url:this._maskMapUrl}).then(n=>{e=new Rt({context:this._viewer.scene.frameState.context,source:n,sampler:new Lt({minificationFilter:zt.LINEAR_MIPMAP_LINEAR})}),e.generateMipmap()}),this._viewer.scene._reflectTexture||(this._viewer.scene._reflectTexture=new yt({scene:this._viewer.scene,planeHeight:this._planeHeight,isClipPlane:!0,renderState:!1,renderMode:1,renderPass:this._renderPass})),this._waterDepthEffect=new cr(this),this._waterDepthEffect.material._uniforms.normalTexture=()=>this._normalMap,this._waterDepthEffect.material._uniforms.maskTexture=()=>e,this._waterDepthEffect.material._uniforms.noiseTexture=()=>this._noiseTexture,this._waterDepthEffect.material._uniforms.waveParam=()=>this._waveParam,this._waterDepthEffect.material._uniforms.waveParam2=()=>this._waveParam2,this._waterDepthEffect.material._uniforms.globeDepthTexture=()=>X(this._viewer.scene.context.uniformState.globeDepthTexture,this._viewer.scene.context.defaultTexture),this._waterDepthEffect.material._uniforms.refractTexture=()=>{var o;const n=(o=this._viewer.scene._colorCopyCommand)==null?void 0:o.colorTexture;return n||this._viewer.scene.context.defaultTexture},this._waterDepthEffect.material._uniforms.reflectTexture=()=>{const n=this._viewer.scene.frameState.getGlobalFramebuffer(1);return n?n.renderTexture._fb.getColorTexture(0):this._viewer.scene.context.defaultTexture},Ua(this._viewer.scene._colorCopyCommand)||(this._viewer.scene._colorCopyCommand=new pe),this._waterDepthEffect.material._uniforms.cameraEastNorthUp=()=>this._viewer.scene._cameraENU,this._waterDepthEffect.material._uniforms.worldEastNorthUp=()=>this._viewer.scene._worldENU,this._waterDepthEffect.material._uniforms.viewerPositionWC=()=>this._viewer.camera.positionWC,this._waterDepthEffect.material._uniforms.inverseView=()=>this._viewer.camera.inverseViewMatrix;let t=new Oa;this._waterDepthEffect.material._uniforms.inverseViewRotation=()=>(Fa.getMatrix3(this._viewer.camera.inverseViewMatrix,t),t),this._waterEffect=new za({geometryInstances:this._instances,asynchronous:!1,shadows:Ha.RECEIVE_ONLY,appearance:this._waterDepthEffect,releaseGeometryInstances:!1}),this._waterEffect.show=this._show,this._waterEffect.isWater=!0,this._viewer.scene.primitives.add(this._waterEffect);const r=this._viewer;if(!r.scene._waterPassEvent){let n=!1;r.scene._worldENU=new SuperMap3D.Matrix4,r.scene._cameraENU=new SuperMap3D.Matrix4,r.scene._lastCameraPosition=new SuperMap3D.Cartesian3,r.scene._waterPassEvent=r.scene.postUpdate.addEventListener(()=>{const o=r.camera.positionWC;if(SuperMap3D.Cartesian3.distance(o,r.scene._lastCameraPosition)>5e3){const a=SuperMap3D.Cartographic.fromCartesian(o),i=SuperMap3D.Cartesian3.fromRadians(a.longitude,a.latitude,0);SuperMap3D.Transforms.eastNorthUpToFixedFrame(i,SuperMap3D.Ellipsoid.WGS84,r.scene._worldENU),SuperMap3D.Matrix4.inverse(r.scene._worldENU,r.scene._cameraENU),SuperMap3D.Cartesian3.clone(o,r.scene._lastCameraPosition)}if(!n&&this._waterEffect._colorCommands&&this._waterEffect._colorCommands.length>0){let a=this._waterEffect._colorCommands[0].derivedCommands.logDepth.command;a.derivedCommands.hdr&&(a=a.derivedCommands.hdr.command);const i=a.execute;a.execute=function(s,l){SuperMap3D.defined(r.scene.view.globeDepth)&&r.scene.view.globeDepth.executeCopyDepth(s,l),SuperMap3D.defined(r.scene._colorCopyCommand)&&r.scene._colorCopyCommand.update(r.scene.frameState),i.bind(this)(s,l)},n=!0}})}}set reflectHeight(e){this._viewer.scene._reflectTexture._planeHeight=e}isDestroyed(){return!1}destroy(){return this._waterEffect&&(this._viewer.scene.primitives.remove(this._waterEffect),this._waterEffect=void 0),this._reflectTexture&&this._reflectTexture.destroy(),Wa(this)}}const{Resource:kr,Sampler:Br,Texture:$r,TextureMinificationFilter:Xr,buildModuleUrl:jr}=SuperMap3D;class Ga{constructor(e,t){this._viewer=e,this.init()}init(){this._normalMap=this._viewer.scene.frameState.context.defaultTexture,kr.fetchImage({url:jr("Assets/Data/waternormals.jpg")}).then(e=>{this._normalMap=new $r({context:this._viewer.scene.frameState.context,source:e,sampler:new Br({minificationFilter:Xr.LINEAR_MIPMAP_LINEAR})}),this._normalMap.generateMipmap()}),this._noiseTexture=this._viewer.scene.frameState.context.defaultTexture,kr.fetchImage({url:jr("Assets/Data/texture4.png")}).then(e=>{this._noiseTexture=new $r({context:this._viewer.scene.frameState.context,source:e,sampler:new Br({minificationFilter:Xr.LINEAR_MIPMAP_LINEAR})}),this._noiseTexture.generateMipmap()})}createWaterPrimitve(e={}){return new Gr(this,e)}}var ka=`precision highp float;\r
uniform sampler2D colorTexture;\r
uniform sampler2D depthTexture;\r
uniform vec4 u_waterColor;\r
uniform vec4 u_waterColor2;\r
uniform vec4 u_waterParam;\r
uniform vec4 u_waterParam2;\r
uniform bool u_effect;\r
uniform mat4 cameraEastNorthUp;\r
uniform vec3 viewerPositionWC;\r
uniform mat4 inverseView;\r
varying vec2 v_textureCoordinates;\r
float time;\r
#define xSineCycles 6.28\r
#define ySineCycles 6.28\r
vec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\r
    float distance = dot( planeNormal, point - pointOnPlane );\r
    return - distance * planeNormal + point;\r
}\r
float sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\r
    return sign( dot( point - pointOnPlane, planeNormal ) );\r
}\r
vec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {\r
    return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;\r
}\r
vec3 depthColor = vec3(0.0117, 0.0117, 0.325);\r
#define LOG2 1.442695\r
#define TAU 6.28318530718\r
#define MAX_ITER 5\r
vec3 caustic(vec2 uv) {\r
    vec2 p = mod(uv*TAU, TAU)-250.0;\r
    vec2 i = vec2(p);\r
    float c = 1.0;\r
    float inten = .005;\r
    for (int n = 0; n < MAX_ITER; n++) {\r
        float t = time * (1.0 - (3.5 / float(n+1)));\r
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));\r
        c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten), p.y / (cos(i.y+t)/inten)));\r
    }\r
    c /= float(MAX_ITER);\r
    c = 1.17-pow(c, 1.4);\r
    vec3 color = vec3(pow(abs(c), 8.0));\r
    color = mix(color, vec3(1.0, 1.0, 1.0), 0.5);\r
    return color;\r
}\r
float causticX(float x, float power, float gtime) {\r
    float p = mod(x*TAU, TAU)-250.0;\r
    float i = p;;\r
    float c = 1.0;\r
    float inten = .005;\r
    for (int n = 0; n < MAX_ITER/2; n++) {\r
        float t = gtime * (1.0 - (3.5 / float(n+1)));\r
        i = p + cos(t - i) + sin(t + i);\r
        c += 1.0/length(p / (sin(i+t)/inten));\r
    }\r
    c /= float(MAX_ITER);\r
    c = 1.17-pow(c, power);\r
    return c;\r
}\r
float GodRays(vec2 uv) {\r
    float light = 0.0;\r
    vec4 sunPos = czm_morphTime == 1.0 ? vec4(czm_sunPositionWC, 1.0) : vec4(czm_sunPositionColumbusView.zxy, 1.0);\r
    vec4 sunPositionEC = czm_view * sunPos;\r
    vec4 sunPositionWC = czm_eyeToWindowCoordinates(sunPositionEC);\r
    sunPos = czm_viewportOrthographic * vec4(sunPositionWC.xy, -sunPositionWC.z, 1.0);\r
    vec3 startPos = czm_viewerPositionWC;\r
    vec3 viewDir = normalize(startPos);\r
    vec3 sunDir = normalize(czm_sunPositionWC);\r
    float cosTheta = dot(viewDir, sunDir);\r
    if(0.0 > cosTheta || !((sunPos.x >= -1.1 && sunPos.x <= 1.1)\r
    && (sunPositionEC.z <= 0.) && (sunPos.y >= -1.1 && sunPos.y <= 1.1)))\r
    {\r
        return 0.;\r
    }\r
    vec2 uvSun = sunPos.xy / 2. + 0.5;\r
    vec2 uv2 = vec2(\r
    dot(normalize(uv - uvSun.xy), vec2(1., 0.)), length(uv - uvSun.xy)\r
    );\r
    light += pow(causticX((uv2.x + 0.08 * uv2.y) / 1.7 + 0.5, 1.8, time * 0.65), 10.0) * 0.05;\r
    light += pow(causticX(sin(uv2.x), 0.3, time * 0.7), 9.0) * 0.4;\r
    light += pow(causticX(cos(uv2.x * 2.3), 0.3, time * 1.3), 4.0) * 0.1;\r
    light *= smoothstep(0., .3, uv2.y) * smoothstep(0., .3, uv2.y);\r
    light = clamp(light, 0.0, 1.0);\r
    return light;\r
}\r
#define HASHSCALE1 .1031\r
#define HASHSCALE3 vec3(.1031, .1030, .0973)\r
float hash11(float p) {\r
    vec3 p3 = fract(vec3(p) * HASHSCALE1);\r
    p3 += dot(p3, p3.yzx + 19.19);\r
    return fract((p3.x + p3.y) * p3.z);\r
}\r
vec3 hash33(vec3 p3) {\r
    p3 = fract(p3 * HASHSCALE3);\r
    p3 += dot(p3, p3.yxz+19.19);\r
    return fract((p3.xxy + p3.yxx)*p3.zyx);\r
}\r
const int   STAR_VOXEL_STEPS = 8;\r
const float STAR_VOXEL_STEP_SIZE = 3.;\r
float distanceRayPoint(vec3 ro, vec3 rd, vec3 p, out float h) {\r
    h = dot(p - ro, rd);\r
    return length(p - ro - rd * h);\r
}\r
vec3 getDotColour(float t) {\r
    return vec3(t*.57, t*.3, t*.05);\r
    return vec3(t*.9, t*.9, t*.9);\r
    return vec3(t*.3, t*.6, t*.5);\r
}\r
vec4 detritus(in vec3 ro, in vec3 rd, in float tmax) {\r
    float d = 0.;\r
    vec3 ros = ro + rd*d;\r
    ros /= STAR_VOXEL_STEP_SIZE;\r
    vec3 pos = floor(ros), mm, ri = 1./rd, rs = sign(rd), dis = (pos - ros + 0.5 + rs * 0.5) * ri;\r
    float dint;\r
    vec3 offset, id;\r
    vec4 col = vec4(0);\r
    vec4 sum = vec4(0);\r
    for(int i = 0; i < STAR_VOXEL_STEPS; i++) {\r
        id = hash33(pos);\r
        float size = hash11(float(i))*.02 + .005;\r
        offset = clamp(id + .2 * cos(id + id.x * time), size, 1. - size);\r
        d = distanceRayPoint(ros, rd, pos + offset, dint);\r
        if (dint > 0. && dint * STAR_VOXEL_STEP_SIZE < tmax) {\r
            col = vec4(getDotColour(id.x), .8) * smoothstep(size, 0.0, d);\r
            col.a *= smoothstep(float(STAR_VOXEL_STEPS), 0., dint);\r
            col.rgb *= col.a / dint;\r
            sum += (1. - sum.a) * col;\r
            if (sum.a>.99) break;\r
        }\r
        mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);\r
        dis += mm * rs * ri;\r
        pos += mm * rs;\r
    }\r
    return sum * .75;\r
}\r
float interpolateByDistance(vec4 nearFarScalar, float distance) {\r
    float startDistance = nearFarScalar.x;\r
    float startValue = nearFarScalar.y;\r
    float endDistance = nearFarScalar.z;\r
    float endValue = nearFarScalar.w;\r
    float t = clamp((distance - startDistance) / (endDistance - startDistance), 0.0, 1.0);\r
    return mix(startValue, endValue, t);\r
}\r
vec4 alphaBlend(vec4 sourceColor, vec4 destinationColor) {\r
    return sourceColor * vec4(sourceColor.aaa, 1.0) + destinationColor * (1.0 - sourceColor.a);\r
}\r
void main(void) {\r
    time = czm_frameNumber / 60.0;\r
    vec4 rawColor = texture(colorTexture, v_textureCoordinates);\r
    if (!u_effect) {\r
        out_FragColor = rawColor;\r
        return;\r
    }\r
    float rawDepth = texture(depthTexture, v_textureCoordinates).r;\r
    vec4 posEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, rawDepth);\r
    vec4 posWC = inverseView * posEC;\r
    posWC /= posWC.w;\r
    vec4 world = cameraEastNorthUp * posWC;\r
    vec3 cameraPosition = vec3(cameraEastNorthUp * vec4(viewerPositionWC, 1.));\r
    float waterLevel = u_waterParam.x;\r
    float worldDistance = length(world.xyz - cameraPosition);\r
    vec3 dir = normalize(world.xyz - cameraPosition);\r
    vec3 hitPoint = linePlaneIntersect(cameraPosition, dir, vec3(0., 0., waterLevel), vec3(0., 0., 1.));\r
    float hitDirection = dot(hitPoint - cameraPosition, dir);\r
    float hitDistance = hitDirection > 0. ? length(hitPoint - cameraPosition) : 1e7;\r
    float dist = min(hitDistance, worldDistance);\r
    vec3 nearestPoint = dist == hitDistance ? hitPoint : world.xyz;\r
    float distance = distance(world.xyz, cameraPosition);\r
    float blendAmount = interpolateByDistance(vec4(1.,0.,u_waterParam.y,1.), distance);\r
    vec4 blendFogColor = vec4(u_waterColor2.rgb,  (1.0 - u_waterColor2.a)* blendAmount);\r
    out_FragColor = rawColor;\r
    
    
    
    
    
    
    
    
    
    
    
    
    out_FragColor.rgb *= u_waterColor.rgb * caustic(nearestPoint.xy / u_waterParam.z);\r
    out_FragColor = alphaBlend(blendFogColor, out_FragColor);\r
    out_FragColor.rgb += GodRays(v_textureCoordinates) * u_waterParam.w;

}`;const{Cartesian4:Yr,Color:Zr,createGuid:Ba,defaultValue:_e,defined:$a,PostProcessStage:Xa,PostProcessStageSampleMode:ja,destroyObject:Ya}=SuperMap3D;let J;class Kr{constructor(e,t={}){if(!e)return console.warn("viewer 没有被定义"),!1;this.id=Ba(),this._viewer=e,this._show=_e(t.show,!0),this._effect=_e(t.effect,!1),this._waterLevel=_e(t.waterLevel,650),this._waterColor=_e(t.waterColor,new Zr(.431,.8,1)),this._waterColor2=_e(t.waterColor2,new Zr(.1,.2,1,.1)),this._waterParam=_e(t.waterParam,new Yr(this._waterLevel,2500,500,1)),this._waterParam2=_e(t.waterParam2,new Yr(.01,.01,0,0))}update(){if($a(J))return!1;J=new Xa({fragmentShader:ka,uniforms:{u_waterColor:()=>this._waterColor,u_waterColor2:()=>this._waterColor2,u_waterParam:()=>this._waterParam,u_waterParam2:()=>this._waterParam2,u_effect:()=>this._effect,cameraEastNorthUp:()=>this._viewer.scene._cameraENU,viewerPositionWC:()=>this._viewer.camera.positionWC,inverseView:()=>this._viewer.camera.inverseViewMatrix},sampleMode:ja.LINEAR}),J.enabled=this._show,this._viewer.scene.postProcessStages.add(J)}isDestroyed(){return!1}destroy(){return this._viewer&&J&&(this._viewer.scene.postProcessStages.remove(J),J=void 0),Ya(this)}}Object.defineProperties(Kr.prototype,{show:{get:function(){return this._show},set:function(c){this._show=c,J&&(J.enabled=this._show)}}}),M.CameraMoveClass=j,M.DebugTexture=Z,M.DrawManager=dt,M.EnvMapLoader=pn,M.NpcViewClass=xn,M.SkyBox=Nn,M.SkyBoxLow=ti,M.WaterDrawRiver=ki,M.WaterEffectPrimitive=Gr,M.WaterFloodSimulation=Ia,M.WaterPipeline=Ga,M.WaterUnderPass=Kr,M.createSkyEffect=ii,M.createSkyEffectLow=oi,M.getHttpData=Vr,M.parseData=Ir,Object.defineProperty(M,Symbol.toStringTag,{value:"Module"})}));
//# sourceMappingURL=w3d.umd.js.map

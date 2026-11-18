import type {FlowRenderer} from './index.js';
export type Proj4Function = (source:string,target:string,coordinate:number[])=>number[];
export interface SuperMap3DRuntime {
  SuperMap3D:any;
  w3d:any;
  proj4?:Proj4Function;
}
export interface SuperMap3DRendererOptions {
  viewer:any;runtime:SuperMap3DRuntime;
  assets:{colorTable:string;colorTable2:string;normals?:[string,string]};
}
export declare function createSuperMap3DRenderer(options:SuperMap3DRendererOptions):FlowRenderer;
export declare const webMercatorProj4:Proj4Function;

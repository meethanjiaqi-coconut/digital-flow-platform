import type {FlowRenderer} from './index.js';
export interface SuperMap3DRendererOptions {
  viewer:any;runtime:{SuperMap3D:any;w3d:any};
  assets:{colorTable:string;colorTable2:string;normals?:[string,string]};
}
export declare function createSuperMap3DRenderer(options:SuperMap3DRendererOptions):FlowRenderer;

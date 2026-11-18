import type {TidalProfile,TidalExtension,TidalParameters,TidalSeaward} from './index.js';
export type {TidalParameters,TidalSeaward};
export declare const DEFAULT_TIDAL_PARAMETERS:Readonly<TidalParameters>;
export declare function normalizeTidalProfile(profile:TidalProfile):TidalProfile;
export declare const qiantangProfile:Readonly<TidalProfile>;
export declare function createTidalEstuary(options:{profile:TidalProfile}):TidalExtension;

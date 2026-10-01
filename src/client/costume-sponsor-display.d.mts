import type {CostumeDisplayContext} from './sponsor-sdk-verification.mjs';
import type {loadSignedSponsorSdk} from './sponsor-sdk-loader.mjs';
export declare function createCostumeSponsorDisplay(currentDisplayOptions:{
  container:HTMLElement;
  request:(currentRequestPath:string,currentRequestBody?:Record<string,never>)=>Promise<unknown>;
  readServerTime:()=>number;
  readContext:()=>CostumeDisplayContext|null;
  trustedPublicKey:string; locale:'ko'|'en'; scriptNonce?:string;
  loadSdk?:typeof loadSignedSponsorSdk;
}):Readonly<{ready:Promise<void>;destroy():void}>;

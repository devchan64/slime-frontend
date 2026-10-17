export type MapResourceRecord={key:string;url:string};
export type MapResourceLoadOptions={signal?:AbortSignal;onProgress?:(currentLoadProgress:{completed:number;total:number})=>void;loadImage?:(currentResourceUrl:string,currentAbortSignal:AbortSignal)=>Promise<HTMLImageElement>};
export function loadMapResourceImages(currentResourceRecords:MapResourceRecord[],currentLoadOptions?:MapResourceLoadOptions):Promise<Record<string,HTMLImageElement>>;

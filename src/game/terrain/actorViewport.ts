import type {ViewBounds} from './viewport';

export type ActorEntry<T> = {id:string;x:number;y:number;create:()=>T;signature?:string};
// 초대형 몸체·이름표·그림자와 인접 타일 이동 보간을 함께 포함한다.
const ACTOR_MARGIN = 256;
const BUCKET_SIZE = 256;

/** 상태 갱신 때 공간 색인을 만들고 카메라 주변 개체의 표시 자원만 유지한다. */
export class ActorWindowCache<T> {
  private buckets = new Map<string,ActorEntry<T>[]>();
  private visible = new Map<string,T>();
  private previous = '';
  private currentActorEntries = new Map<string,ActorEntry<T>>();
  constructor(entries:ActorEntry<T>[], private dispose:(value:T)=>void) {
    this.updateEntries(entries);
  }
  /** 내용이 같은 개체는 유지하고 변경·삭제된 개체만 폐기한다. */
  updateEntries(currentNextEntries:ActorEntry<T>[]) {
    const currentNextLookup=new Map(currentNextEntries.map(currentActorEntry=>[currentActorEntry.id,currentActorEntry]));
    for(const [currentActorIdentifier,currentActorValue] of this.visible){
      const currentPreviousEntry=this.currentActorEntries.get(currentActorIdentifier);
      const currentNextEntry=currentNextLookup.get(currentActorIdentifier);
      if(!currentNextEntry || currentNextEntry.signature===undefined || currentNextEntry.signature!==currentPreviousEntry?.signature){
        this.dispose(currentActorValue);this.visible.delete(currentActorIdentifier);
      }
    }
    this.currentActorEntries=currentNextLookup;
    this.buckets.clear();this.previous='';
    for (const entry of currentNextEntries) {
      const key = `${Math.floor(entry.x/BUCKET_SIZE)},${Math.floor(entry.y/BUCKET_SIZE)}`;
      const bucket = this.buckets.get(key) ?? [];
      bucket.push(entry);
      this.buckets.set(key,bucket);
    }
  }
  sync(bounds:ViewBounds) {
    const firstX=Math.floor((bounds.left-ACTOR_MARGIN)/BUCKET_SIZE);
    const lastX=Math.floor((bounds.right+ACTOR_MARGIN)/BUCKET_SIZE);
    const firstY=Math.floor((bounds.top-ACTOR_MARGIN)/BUCKET_SIZE);
    const lastY=Math.floor((bounds.bottom+ACTOR_MARGIN)/BUCKET_SIZE);
    const signature=`${firstX}:${lastX}:${firstY}:${lastY}`;
    if(signature===this.previous)return;
    const wanted=new Set<string>();
    for(let y=firstY;y<=lastY;y++)for(let x=firstX;x<=lastX;x++) {
      for(const entry of this.buckets.get(`${x},${y}`) ?? []) {
        wanted.add(entry.id);
        if(!this.visible.has(entry.id))this.visible.set(entry.id,entry.create());
      }
    }
    for(const [id,value] of this.visible)if(!wanted.has(id)) {
      this.dispose(value);this.visible.delete(id);
    }
    this.previous=signature;
  }
  clear() {
    for(const value of this.visible.values())this.dispose(value);
    this.visible.clear();this.buckets.clear();this.currentActorEntries.clear();this.previous='';
  }
}

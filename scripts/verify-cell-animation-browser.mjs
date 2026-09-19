/** 격리된 합성 데이터로 실제 Phaser/WebGL 프레임·기준점·정리를 검사한다. */
import {build} from 'esbuild';
import {mkdtemp,writeFile,readFile,rm,mkdir,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const logPath=join(root,'.local/logs/cell-animation-browser.log');
await mkdir(resolve(logPath,'..'),{recursive:true});
async function log(stage,message){const line=`${new Date().toISOString()}/cell-animation-browser/${stage} ${message}\n`;process.stdout.write(line);await appendFile(logPath,line);}
const directory=await mkdtemp(join(tmpdir(),'slime-cell-browser-'));
const heartbeat=setInterval(()=>void log('heartbeat','격리 Chrome의 Phaser/WebGL 검증 완료 대기'),5000);
try{
 await log('start','합성 manifest·Canvas 시트 번들 생성');
 await build({stdin:{resolveDir:root,contents:`
 import Phaser from 'phaser';
 import manifest from './tests/fixtures/cell-animation-v2.json';
 import {readCellAsset} from './src/game/animation/cellAsset';
 import {CellActor} from './src/game/animation/cellActor';
 const report=(value)=>{document.body.dataset.result=JSON.stringify(value);};
 window.addEventListener('error',event=>report({status:'FAIL',error:event.message}));
 const check=(value,message)=>{if(!value)throw new Error(message);};
 new Phaser.Game({type:Phaser.WEBGL,width:80,height:80,audio:{noAudio:true},banner:false,
  scene:{create(){try{
   const canvas=document.createElement('canvas');canvas.width=4;canvas.height=2;
   const context=canvas.getContext('2d');
   ['red','green','blue','yellow'].forEach((color,x)=>{context.fillStyle=color;context.fillRect(x,0,1,2);});
   this.textures.addCanvas('synthetic',canvas);
   const baseline=this.events.listenerCount('update'),animation=readCellAsset(manifest).animation;
   const actor=new CellActor(this,'synthetic',animation,{x:40,y:40,scale:10,action:'idle',direction:'down_left'});
   const second=new CellActor(this,'synthetic',animation,{x:60,y:40,scale:10,action:'idle',direction:'up_right'});
   check(this.events.listenerCount('update')===baseline+2,'update 등록');
   actor.update(this.time.now+100);
   check(actor.image.frame.cutX===1 && actor.image.frame.cutY===0,'실제 Phaser 프레임 영역');
   check(actor.image.originX===.5 && actor.image.originY===1,'발 기준점');
   check(actor.image.x===40 && actor.image.y===40 && actor.image.scaleX===10,'월드 위치·배율');
   check(second.image.frame.cutX===3,'두 번째 개체 방향');
   this.game.events.once('postrender',()=>{
    actor.image.destroy();second.destroy();
    check(this.events.listenerCount('update')===baseline,'개체 정리 후 update 해제');
    report({status:'PASS',renderer:this.game.renderer.type,frames:4,actors:2});
    this.game.destroy(true);
   });
  }catch(error){report({status:'FAIL',error:String(error)});}}}});
 `},bundle:true,platform:'browser',format:'iife',outfile:join(directory,'test.js')});
 const html=join(directory,'index.html');
 await writeFile(html,'<!doctype html><html><body><script src="test.js"></script></body></html>');
 await log('browser','SwiftShader WebGL·합성 개체 2개 실행');
 const {stdout,stderr}=await promisify(execFile)(process.argv[2]||'/usr/bin/google-chrome',[
  '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  `--user-data-dir=${join(directory,'profile')}`,'--dump-dom','--virtual-time-budget=5000',pathToFileURL(html).href
 ],{timeout:30000,maxBuffer:4*1024*1024});
 await appendFile(logPath,stdout+'\n'+stderr+'\n');
 if(!stdout.includes('&quot;status&quot;:&quot;PASS&quot;'))throw new Error('실제 Phaser 검증에 실패했습니다. DOM과 Chrome 로그를 확인하세요.');
 await log('complete','실제 WebGL 프레임·발 기준점·공유 텍스처·개체 정리 통과');
}catch(error){await log('failure',error.stack||String(error));process.stderr.write((await readFile(logPath,'utf8')).slice(-5000));process.exitCode=1;}
finally{clearInterval(heartbeat);await rm(directory,{recursive:true,force:true});}

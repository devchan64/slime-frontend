import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/ui/FieldFirstAid.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{
 name:'first-aid-locale',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'locale',namespace:'first-aid-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'first-aid-test'},()=>({contents:'export const useTranslation=()=>({t:key=>key});',loader:'js'}));
 }
}]});
const {FieldFirstAid}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
test('응급처치는 올림된 HP 표시가 아닌 실제 완충 상태를 사용한다',()=>{
 const currentGameState={me:{mode:'FIELD',hp:10,maxHp:10,healthFull:false,fp:1,position:{column:5,row:5},
  firstAid:{consumableId:'clean-bandage',consumedOnSuccess:1,minimumUseLevel:1,literacyRequired:1,restorationHp:1},
  bag:{items:[{id:'clean-bandage',kind:'consumable',quantity:1}]},skills:{first_aid:1,literacy:1}},
  map:{startPoint:{column:0,row:0},safeRadius:1}};
 const currentRenderButton=()=>FieldFirstAid({currentGameState,actionsAreDisabled:false,submitFirstAidCommand:()=>{}});
 assert.equal(currentRenderButton().props.disabled,false);
 currentGameState.me.healthFull=true;
 assert.equal(currentRenderButton().props.disabled,true);
});

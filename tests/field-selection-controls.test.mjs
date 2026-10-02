import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parsePack } from '../src/i18n/catalog.mjs';

const fieldMessageCatalog = parsePack(await readFile('src/i18n/locales/ko/field.yaml', 'utf8'), 'field.yaml');
const cityMessageCatalog = parsePack(await readFile('src/i18n/locales/ko/city.yaml', 'utf8'), 'city.yaml');
const { outputFiles: fieldBundleOutputs } = await build({
  loader: {'.css':'empty'},
  entryPoints: ['src/ui/FieldPanel.tsx'], bundle: true, write: false, platform: 'node', format: 'esm',
  jsx: 'automatic', jsxImportSource: 'preact', external: [pathToFileURL(resolve('src/i18n/catalog.mjs')).href],
  plugins: [{
    name: 'strict-field-translations',
    setup(pluginBuildContext) {
      pluginBuildContext.onResolve({ filter: /^\.\.\/i18n$/ }, () => ({ path: 'translations', namespace: 'field-test' }));
      pluginBuildContext.onLoad({ filter: /.*/, namespace: 'field-test' }, () => ({
        contents: `import {formatMessage} from ${JSON.stringify(pathToFileURL(resolve('src/i18n/catalog.mjs')).href)};
          const fieldMessageCatalog = ${JSON.stringify(fieldMessageCatalog)};
          const cityMessageCatalog = ${JSON.stringify(cityMessageCatalog)};
          export const t = (messageKey, messageValues) => formatMessage(messageKey.startsWith('city.')?cityMessageCatalog[messageKey.slice(5)]:fieldMessageCatalog[messageKey.replace('field.', '')], messageValues);
          export const getLocale = () => 'ko';
          export const useTranslation = () => ({t, locale:getLocale()});`,
        loader: 'js', resolveDir: process.cwd(),
      }));
    },
  }],
});
const { FieldSelection } = await import(`data:text/javascript;base64,${Buffer.from(fieldBundleOutputs[0].text).toString('base64')}`);

function collectActionButtons(currentRenderedNode) {
  if (!currentRenderedNode || typeof currentRenderedNode !== 'object') return [];
  if (Array.isArray(currentRenderedNode)) return currentRenderedNode.flatMap(collectActionButtons);
  return [
    ...(currentRenderedNode.type === 'button' ? [currentRenderedNode] : []),
    ...collectActionButtons(currentRenderedNode.props?.children),
  ];
}
function createSelectionFixture(currentMonsterEntries = []) {
  return {
    me: { mode: 'FIELD', hp: 25, fp: 100, position: { column: 0, row: 0 } },
    map: {
      name: '초원', columns: 4, rows: 4, blocked: [], connections: [],
      startPoint: { column: 0, row: 0 }, safeRadius: 0,
      terrainRows: ['gggg', 'gggg', 'gggg', 'gggg'], terrainCodes: { g: 'grass' },
      movementCosts: { version: 1, rows: [{ tileId: 'grass', fp: { baseCost: 1, extraChanceBasisPoints: 1000, extraCost: 1 } }] },
    },
    monsters: currentMonsterEntries,
  };
}
test('실제 번역 검증과 지형 비용을 사용해 이동 버튼을 렌더링하고 실행한다', () => {
  let movementCommandCount = 0;
  const renderedSelectionTree = FieldSelection({
    state: createSelectionFixture(), selected: { column: 2, row: 0 }, disabled: false, now: 0,
    select() {}, command() {}, walking: null, walk: () => movementCommandCount++, stop() {},
  });
  const movementActionButton = collectActionButtons(renderedSelectionTree).find(currentActionButton => !currentActionButton.props['aria-label']);
  assert.ok(movementActionButton);
  assert.equal(movementActionButton.props.disabled, false);
  movementActionButton.props.onClick();
  assert.equal(movementCommandCount, 1);
});
test('실제 번역 검증과 지형 비용을 사용해 원거리 몬스터 접근 버튼을 실행한다', () => {
  const requestedMonsterIds = [];
  const renderedSelectionTree = FieldSelection({
    state: createSelectionFixture([{ id: 'slime-test', name: '슬라임', state: 'AVAILABLE', disposition: 'PASSIVE', position: { column: 2, row: 0 } }]),
    selected: { column: 2, row: 0 }, disabled: false, now: 0,
    select() {}, command() {}, walking: null, walk() {}, stop() {},
    encounter: currentMonsterId => requestedMonsterIds.push(currentMonsterId),
  });
  const encounterActionButton = collectActionButtons(renderedSelectionTree).find(currentActionButton => !currentActionButton.props['aria-label']);
  assert.equal(encounterActionButton.props.disabled, false);
  encounterActionButton.props.onClick();
  assert.deepEqual(requestedMonsterIds, ['slime-test']);
});

function collectFacilityPanels(currentRenderedNode){
  if(!currentRenderedNode||typeof currentRenderedNode!=='object')return [];
  if(Array.isArray(currentRenderedNode))return currentRenderedNode.flatMap(collectFacilityPanels);
  return [...(currentRenderedNode.type?.name==='TravelerPermitPanel'?[currentRenderedNode]:[]),...collectFacilityPanels(currentRenderedNode.props?.children)];
}
test('경비센터는 조우 중 닫히고 종료 후 재생성되며 epoch 변경에 다른 창구 키를 쓴다',()=>{
  const currentGameState=createSelectionFixture();
  Object.assign(currentGameState,{generation:1,epoch:1,location:{id:'channel'}});
  Object.assign(currentGameState.me,{id:'owner',version:1});
  Object.assign(currentGameState.map,{id:'field',safeTown:false,
    connections:[{id:'city-gate',column:0,row:0,target:'city',targetName:'도시',targetSafeTown:true}],
    guardCenters:[{id:'guard',cityId:'city',mapId:'field',connectionId:'city-gate',name:'경비센터',position:{column:0,row:0}}]});
  function renderCurrentFacility(){return collectFacilityPanels(FieldSelection({state:currentGameState,selected:{column:0,row:0},disabled:false,now:0,
    select(){},command(){},walking:null,walk(){},stop(){},gameSessionClient:{state:currentGameState}}));}
  const currentInitialPanels=renderCurrentFacility();assert.equal(currentInitialPanels.length,1);
  currentGameState.reservation={id:'reservation'};assert.equal(renderCurrentFacility().length,0);
  currentGameState.reservation=null;assert.equal(renderCurrentFacility().length,1);
  currentGameState.epoch++;assert.notEqual(renderCurrentFacility()[0].key,currentInitialPanels[0].key);
  currentGameState.battle={id:'battle'};assert.equal(renderCurrentFacility().length,0);
});

function collectParcelPanels(currentRenderedNode){
  if(!currentRenderedNode||typeof currentRenderedNode!=='object')return [];
  if(Array.isArray(currentRenderedNode))return currentRenderedNode.flatMap(collectParcelPanels);
  return [...(currentRenderedNode.type?.name==='ParcelPanel'?[currentRenderedNode]:[]),...collectParcelPanels(currentRenderedNode.props?.children)];
}
test('길드 소포 창구는 조우 중 닫히고 epoch·맵 변경 시 새 인스턴스로 열린다',()=>{
  const currentGameState=createSelectionFixture();
  Object.assign(currentGameState,{generation:1,epoch:1,location:{id:'city-channel'}});
  Object.assign(currentGameState.me,{id:'hero'});
  Object.assign(currentGameState.map,{id:'city',safeTown:true,buildings:[{facilityId:'city-guild',facilityKind:'guild',
    origin:{column:0,row:1},width:1,height:1,entrance:{column:0,row:0}}]});
  function renderCurrentParcels(){return collectParcelPanels(FieldSelection({state:currentGameState,selected:{column:0,row:0},disabled:false,now:0,
    select(){},command(){},walking:null,walk(){},stop(){},gameSessionClient:{state:currentGameState}}));}
  const currentInitialPanels=renderCurrentParcels();assert.equal(currentInitialPanels.length,1);
  currentGameState.reservation={id:'reservation'};assert.equal(renderCurrentParcels().length,0);
  currentGameState.reservation=null;assert.equal(renderCurrentParcels().length,1);
  currentGameState.epoch++;assert.notEqual(renderCurrentParcels()[0].key,currentInitialPanels[0].key);
  const currentEpochKey=renderCurrentParcels()[0].key;
  currentGameState.map.id='other-city';assert.notEqual(renderCurrentParcels()[0].key,currentEpochKey);
  currentGameState.battle={id:'battle'};assert.equal(renderCurrentParcels().length,0);
});


test('관문은 온라인 파티 이동만 막고 대여 편성의 이동은 유지한다',()=>{
  const currentGameState=createSelectionFixture();
  currentGameState.map.connections=[{id:'exit',column:0,row:0,target:'forest',targetName:'숲'}];
  for(const currentPartyIdentifier of ['online-party',null]){
    Object.assign(currentGameState.me,{partyId:currentPartyIdentifier,borrowedPartyLoanIds:['loan']});
    const currentSelectionTree=FieldSelection({state:currentGameState,selected:{column:0,row:0},disabled:false,now:0,
      select(){},command(){},walking:null,walk(){},stop(){}});
    const currentTravelButton=collectActionButtons(currentSelectionTree).find(currentButtonNode=>String(currentButtonNode.props.children).includes('↗'));
    assert.ok(currentTravelButton);
    assert.equal(currentTravelButton.props.disabled,Boolean(currentPartyIdentifier));
    assert.equal(currentTravelButton.props.title,currentPartyIdentifier?fieldMessageCatalog.partyTravelBlocked:undefined);
  }
});

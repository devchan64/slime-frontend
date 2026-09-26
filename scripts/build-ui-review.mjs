import {build as buildReviewBundle} from 'vite';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve as resolveReviewPath, relative as relativeReviewPath} from 'node:path';
import {createHash as createReviewHash} from 'node:crypto';
import {parseDocument as parseYamlDocument} from 'yaml';

const reviewProjectRoot=process.cwd();
const reviewStartedTime=new Date().toISOString();
const reviewTimeParts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const reviewOutputRoot=resolveReviewPath('.tmp',reviewTimeParts,'ui-review');
const reviewCatalogDocument=parseYamlDocument(readFileSync('review/catalog.yaml','utf8'),{uniqueKeys:true});
if(reviewCatalogDocument.errors.length)throw new Error(reviewCatalogDocument.errors.map(currentYamlError=>currentYamlError.message).join('\n'));
const reviewCatalogValue=reviewCatalogDocument.toJS();
const reviewPageFields=['id','label','path'];
if(!reviewCatalogValue||Object.keys(reviewCatalogValue).sort().join()!=='pages,schemaVersion'||reviewCatalogValue.schemaVersion!==1||!Array.isArray(reviewCatalogValue.pages)||!reviewCatalogValue.pages.length)throw new Error('검수 카탈로그 형식 오류');
const reviewUniqueIdentifiers=new Set();
for(const currentReviewPage of reviewCatalogValue.pages){
 if(Object.keys(currentReviewPage).sort().join()!==reviewPageFields.sort().join()||reviewPageFields.some(currentFieldName=>typeof currentReviewPage[currentFieldName]!=='string'||!currentReviewPage[currentFieldName].trim())||!/^[a-z][a-z0-9-]+$/.test(currentReviewPage.id)||reviewUniqueIdentifiers.has(currentReviewPage.id)||!/^review\/[a-z-]+\.html(?:\?[a-zA-Z0-9_=&%-]+)?$/.test(currentReviewPage.path))throw new Error('검수 항목 형식 또는 ID 오류');
 reviewUniqueIdentifiers.add(currentReviewPage.id);
}
mkdirSync(reviewOutputRoot,{recursive:true});
console.log(`${reviewStartedTime}/ui-review/build ${reviewOutputRoot}`);
await buildReviewBundle({configFile:false,base:'./',publicDir:false,esbuild:{jsx:'automatic',jsxImportSource:'preact'},build:{outDir:reviewOutputRoot,emptyOutDir:false,rollupOptions:{input:['review/design-system.html','review/terrain-preview.html','review/battlefield-preview.html'].map(currentEntryPath=>resolveReviewPath(currentEntryPath))}}});
function collectReviewFiles(currentDirectoryPath){
 return readdirSync(currentDirectoryPath,{withFileTypes:true}).flatMap(currentDirectoryEntry=>{
 const currentAbsolutePath=resolveReviewPath(currentDirectoryPath,currentDirectoryEntry.name);
 return currentDirectoryEntry.isDirectory()?collectReviewFiles(currentAbsolutePath):[{path:relativeReviewPath(reviewOutputRoot,currentAbsolutePath),sha256:createReviewHash('sha256').update(readFileSync(currentAbsolutePath)).digest('hex')}];
 });
}
const reviewSourceCommit=process.env.UI_REVIEW_SOURCE_COMMIT;
if(!/^[a-f0-9]{40}$/.test(reviewSourceCommit??''))throw new Error('검수 빌드 Git 커밋을 확인할 수 없습니다.');
const reviewManifestValue={schemaVersion:1,kind:'slime-ui-review',sourceCommit:reviewSourceCommit,sourceDirty:process.env.UI_REVIEW_SOURCE_DIRTY==='true',createdAt:reviewStartedTime,pages:reviewCatalogValue.pages,files:collectReviewFiles(reviewOutputRoot)};
writeFileSync(resolveReviewPath(reviewOutputRoot,'manifest.json'),JSON.stringify(reviewManifestValue,null,2)+'\n');
console.log(`${new Date().toISOString()}/ui-review/complete ${reviewOutputRoot}`);

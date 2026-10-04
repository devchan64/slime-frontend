import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const currentProjectRoot=fileURLToPath(new URL('../',import.meta.url));
const currentPackageRecord=JSON.parse(await readFile(new URL('../packages/field-renderer/package.json',import.meta.url),'utf8'));
const currentOutputDirectory=path.join(currentProjectRoot,'.tmp/field-renderer',currentPackageRecord.version);
const currentSourceEntries={'field-renderer.mjs':'packages/field-renderer/field-renderer.mjs','phaser.mjs':'node_modules/phaser/dist/phaser.esm.js'};
try{
 console.log(`${new Date().toISOString()}/field-renderer/build/시작 ${currentOutputDirectory}`);
 await mkdir(currentOutputDirectory,{recursive:true});
 const currentFileHashes={};
 for(const [currentOutputName,currentSourcePath] of Object.entries(currentSourceEntries)){
  const currentOutputPath=path.join(currentOutputDirectory,currentOutputName);
  await build({entryPoints:[path.join(currentProjectRoot,currentSourcePath)],outfile:currentOutputPath,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:currentOutputName==='phaser.mjs',legalComments:'eof'});
  currentFileHashes[currentOutputName]=createHash('sha256').update(await readFile(currentOutputPath)).digest('hex');
 }
 const currentEngineLicense=await readFile(path.join(currentProjectRoot,'node_modules/phaser/LICENSE.md'));
 await writeFile(path.join(currentOutputDirectory,'LICENSE.phaser.md'),currentEngineLicense);
 currentFileHashes['LICENSE.phaser.md']=createHash('sha256').update(currentEngineLicense).digest('hex');
 const currentManifestRecord=`package: '@slime/field-renderer'\nversion: '${currentPackageRecord.version}'\nengine: 'Phaser 3.90.0'\nsource_repository: slime-frontend\nsource_path: packages/field-renderer\nfiles:\n${Object.entries(currentFileHashes).map(([currentFileName,currentFileHash])=>`  ${currentFileName}: ${currentFileHash}`).join('\n')}\n`;
 await writeFile(path.join(currentOutputDirectory,'manifest.yaml'),currentManifestRecord);
 console.log(`${new Date().toISOString()}/field-renderer/build/완료 ${currentOutputDirectory}`);
}catch(currentBuildError){console.error(`${new Date().toISOString()}/field-renderer/failure ${currentBuildError.stack}`);process.exitCode=1;}

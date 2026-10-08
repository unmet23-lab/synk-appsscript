import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../..'),qa=path.join(here,'qa/workbook');
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const sha=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const trial=await read(path.join(here,'report.json'));
assert.ok(trial.checks.length===23&&trial.checks.every(x=>x.passed));
for(const entry of trial.manifest)assert.equal(await sha(path.join(here,entry.file)),entry.sha256);
const protocol=await read(path.join(here,'protocol.json'));
for(const entry of protocol.source)assert.equal(await sha(entry.path),entry.sha256,'The source changed after the recorded review.');
const book=await read(path.join(qa,'manifest.json')),checks=await read(path.join(qa,'checks.json')),native=await read(path.join(qa,'native-excel.json'));
assert.equal(book.nativeExcelPending,false);assert.equal(book.visualReviewPending,false);
const preserved=await read(path.join(qa,'saved-preservation.json'));
assert.equal(preserved.passed,preserved.checks);assert.ok(preserved.checks>=8239);
assert.equal(preserved.outputSha256,book.outputSha256);assert.equal(preserved.templateSha256,book.templateSha256);
assert.ok(checks.length>=28&&checks.every(x=>x.passed));
assert.ok(native.checks.length>=44&&native.checks.every(x=>x.passed));
assert.equal(native.readOnly,true);assert.equal(native.saved,false);
assert.equal(native.humanTrialRun,false);assert.equal(native.realCustomerTrialRun,false);
assert.deepEqual(native.formulaErrors,[]);assert.deepEqual(native.clippedRows,[]);
assert.equal(await sha(book.output),book.outputSha256);assert.equal(native.sourceSha256,book.outputSha256);
assert.equal(await sha(book.template),book.templateSha256);assert.equal(await sha(book.input),book.inputSha256);
assert.ok(book.preservation.every(x=>x.formulaMismatches===0&&x.unexpectedValueChanges===0));
const images=[];
for(const view of book.views){assert.equal(await sha(path.join(qa,view.file)),view.sha256);images.push({...view,visualReview:'reviewed-by-workbook-agent; summary-and-judgment-also-reviewed-by-root'});}
const desktop=path.join('C:/Users/q1212/OneDrive/Desktop/bm 설계표/20261007_SHIFT_내부시범',path.basename(book.output));
await fs.mkdir(path.dirname(desktop),{recursive:true});
if(await fs.access(desktop).then(()=>true,()=>false))assert.equal(await sha(desktop),book.outputSha256,'Existing desktop file differs; do not overwrite.');
else await fs.copyFile(book.output,desktop,constants.COPYFILE_EXCL);
assert.equal(await sha(desktop),book.outputSha256);
const evidence=[];
for(const file of ['manifest.json','checks.json','native-excel.json','preservation.json','saved-preservation.json','changes.json','verify-native.ps1','verify-preservation.py','report.json'])evidence.push({file:'qa/workbook/'+file,sha256:await sha(path.join(qa,file))});
for(const file of ['README.md','workbook-build.mjs','finalize.mjs','report.json'])evidence.push({file,sha256:await sha(path.join(here,file))});
const report={status:'ai-internal-pilot-and-workbook-delivered-human-customer-validation-pending',finalizedAt:new Date().toISOString(),
 trial:{file:'report.json',checks:trial.checks.length,sections:5,arms:2,completion:[true,true],substantiveErrors:[0,0],requiredCopyPatches:0,additionalQualityBenefitObserved:false,elapsedSeconds:[99,77],humanProductivity:null,customerOutcomes:null,profitability:null},
 workbook:{path:path.relative(repo,book.output).replaceAll('\\','/'),sha256:book.outputSha256,bytes:(await fs.stat(book.output)).size,modelChecks:checks.length,nativeExcelChecks:native.checks.length,preservationChecks:preserved.checks,preservedSheets:book.preservation.length,unmeasuredInputCells:native.unmeasuredInputCells,formulaErrors:0,clippedRows:0,views:images},
 delivery:{desktop,sha256:await sha(desktop),existingBlankTemplatePreserved:true,existingBMArtifactsOverwritten:false},
 boundaries:trial.boundaries,evidence};
await fs.writeFile(path.join(here,'delivery-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,trialChecks:report.trial.checks,workbookChecks:checks.length,excelChecks:native.checks.length,views:images.length,sha256:book.outputSha256,desktop}));

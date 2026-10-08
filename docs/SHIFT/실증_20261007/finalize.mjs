import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),qa=path.join(here,'qa');
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const manifest=await read(path.join(qa,'manifest.json')),tests=await read(path.join(qa,'tests.json')),native=await read(path.join(qa,'native-excel.json'));
const hash=async p=>crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
const sha=await hash(manifest.output);
if(sha!==manifest.outputSha256||sha!==native.sourceSha256)throw Error('Output/source hashes disagree');
if(tests.some(t=>!t.passed)||native.checks.some(t=>!t.passed)||native.formulaErrors.length||native.clippedRows.length||native.saved!==false||native.readOnly!==true)throw Error('Verification failed');
manifest.nativeExcelPending=false;manifest.nativeExcelVerified=true;manifest.nativeExcelChecks=native.checks.length;manifest.realInputCellsVerifiedBlank=native.blankInputCells;manifest.qaLabelLanguage='ko';
await fs.writeFile(path.join(qa,'manifest.json'),JSON.stringify(manifest,null,2));
const images=[];for(const entry of manifest.views){const file=path.join(qa,entry.file);images.push({...entry,sha256:await hash(file),visualReview:'readable-inputs-and-headings-no-clipped-required-content'});}
const sources=[];for(const file of ['build.mjs','verify-native.ps1','README.md','finalize.mjs'])sources.push({path:`docs/SHIFT/실증_20261007/${file}`,sha256:await hash(path.join(here,file))});
const qaHashes=[];for(const file of ['manifest.json','tests.json','native-excel.json','errors.ndjson','summary-inspect.ndjson'])qaHashes.push({path:`qa/${file}`,sha256:await hash(path.join(qa,file))});
const report={
 status:'local-measurement-workbook-verified-real-trials-not-run',verifiedAt:new Date().toISOString(),
 output:{path:path.relative(root,manifest.output).replaceAll('\\','/'),bytes:(await fs.stat(manifest.output)).size,sha256:sha},
 businessScope:{canonical:'docs/마케팅/SHIFT.md#shift-bm',sourceDate:'2026-10-06',actualCustomer1:null,actualWorkflow1:null,actualCustomer2:null,actualWorkflow2:null,actualMeasurements:null,contractPricingPeriodAcceptanceThresholds:'not-assumed'},
 checks:{model:{passed:tests.length,total:tests.length,report:'qa/tests.json'},nativeExcel:{passed:native.checks.length,total:native.checks.length,blankRealInputCells:native.blankInputCells,formulaErrors:0,clippedRows:0,readOnly:true,saved:false,sourcePreservedByteForByte:true,report:'qa/native-excel.json'},visual:{sheets:manifest.sheets.length,ranges:images.length,scale:1,review:'complete',images}},
 semantics:{failureAndAbortInCompletionDenominator:true,unmeasuredExcludedAndInvalidSeparate:true,metricSpecificMissingnessDenominators:true,explicitZeroDistinctFromMissing:true,comparisonPeriodAndVersionMatched:true,observationalDifferenceNotCausalEffect:true,missingFounderHourlyValueDoesNotBecomeZero:true,costCompletenessRequiredForBalances:true,economicAndCashLaborNotDoubleCounted:true,reuseCostReferenceCustomerAndResponsibilityScoped:true,reuseItemRatioNotCostOrComplexitySaving:true},
 boundaries:{atlasCommonCodeChanged:false,existingBMArtifactsOverwritten:false,realCustomerTrialsRun:false,realEffectOrProfitabilityProven:false,productionOperationsRun:false,deployed:false,paidAIUsed:false,externalContact:false},
 qaLabelLanguage:'ko',deliveryPreservedAfterLabelCorrection:true,qaFiles:qaHashes,sources
};
await fs.writeFile(path.join(qa,'report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(qa,'visual-review.json'),JSON.stringify({reviewedAt:report.verifiedAt,allSheets:manifest.sheets,views:images,scope:'Every worksheet, including input explanations and formulas. No real performance was measured.'},null,2));
console.log(JSON.stringify({status:report.status,model:tests.length,nativeExcel:native.checks.length,blankInputs:native.blankInputCells,visualRanges:images.length,outputSha256:sha}));

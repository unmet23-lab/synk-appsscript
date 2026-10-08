// Final evidence aggregation and a new desktop copy of the empty pilot workbook.
import {readFile,writeFile,mkdir,copyFile,stat,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const pilotRoot=join(root,'docs/SHIFT/실증_20261007');
const paths={environment:join(here,'environment-report.json'),tests:join(here,'tests-report.json'),key:join(here,'key-safety-report.json'),recovery:join(here,'recovery-report.json'),pilot:join(pilotRoot,'qa/report.json')};
const data=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>[name,JSON.parse(await readFile(path,'utf8'))])));
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const local=path=>relative(root,path).replaceAll('\\','/');
const checks=[];
async function match(path,expected,kind){const actual=await sha(path);checks.push({path:local(path),kind,passed:actual===expected,expected,actual});}
for(const [path,expected] of Object.entries(data.tests.sources))await match(join(root,path),expected,'current-host-source');
for(const type of ['key','recovery','pilot'])for(const {path,sha256} of data[type].sources)await match(join(root,path),sha256,type+'-source');
for(const {path,sha256} of data.pilot.qaFiles)await match(join(pilotRoot,path),sha256,'pilot-evidence');
for(const {file,sha256} of data.pilot.checks.visual.images)await match(join(pilotRoot,'qa',file),sha256,'pilot-render');
await match(join(here,data.tests.tests.output),data.tests.tests.sha256,'host-test-output');
const source=join(root,data.pilot.output.path);await match(source,data.pilot.output.sha256,'workbook');
const evidenceOk=data.tests.status==='local-host-recovery-and-packaging-verified'&&data.tests.tests.total===153&&data.tests.tests.failed===0&&data.tests.sourceChangesDuringRun.length===0&&data.tests.stagedNodeHost.passed===71&&data.key.tests.failed===0&&data.recovery.tests.fail===0&&data.recovery.sourceChangesDuringRun.length===0&&data.pilot.checks.model.passed===73&&data.pilot.checks.nativeExcel.passed===52&&data.pilot.checks.nativeExcel.blankRealInputCells===1797&&data.pilot.checks.nativeExcel.formulaErrors===0;
if(!evidenceOk||checks.some(row=>!row.passed))throw new Error('Current evidence or source hashes do not match; delivery was not prepared.');
const desktop='C:/Users/q1212/OneDrive/Desktop/bm 설계표/20261007_SHIFT_실증';
await mkdir(desktop,{recursive:true});
const delivered=join(desktop,'SHIFT_한업무_실증과_반복공급_20261007.xlsx');
try{await copyFile(source,delivered,constants.COPYFILE_EXCL);}
catch(error){if(error.code!=='EEXIST'||await sha(delivered)!==data.pilot.output.sha256)throw error;}
await match(delivered,data.pilot.output.sha256,'desktop-delivery');
for(const path of ['README.md','environment-README.md','recovery-README.md','key-safety-README.md'])await access(join(here,path));
await access(join(pilotRoot,'README.md'));
const report={
  version:1,createdAt:new Date().toISOString(),status:'local-operational-safeguards-and-pilot-measurement-prepared',
  request:{threeStagesAuthorized:true,operatingTarget:'unselected',firstCustomer:'unselected',secondCustomer:'unselected',basis:'User explicitly answered all are unselected.'},
  completed:{environmentInspection:true,missingOriginalKeyStartupProtection:true,offlineRestoreCandidateComparison:true,emptyFirstAndSecondCustomerMeasurementWorkbook:true,commonAtlasSourceChangedByThisFollowUp:false},
  evidence:Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>[name,{path:local(path),sha256:await sha(path)}]))),
  verification:{hostTests:data.tests.tests,stagedNodeHostChecks:71,keyProtectionTests:{new:5,includedInHost153:true},restoreCandidateTests:{total:14,includedInHost153:true},workbook:{model:data.pilot.checks.model,nativeExcel:data.pilot.checks.nativeExcel,visual:{sheets:6,ranges:15,scale:1}},sourceAndArtifactHashes:{checked:checks.length,passed:checks.filter(row=>row.passed).length,failed:checks.filter(row=>!row.passed)}},
  delivery:{source:data.pilot.output.path,path:delivered,bytes:(await stat(delivered)).size,sha256:data.pilot.output.sha256,actualInputBlank:true,previousDeliverablesOverwritten:false},
  existingLocalHost:{latestCandidateRuntimeVerified:false,publicSyncScriptStatus:404,operatingTargetSelected:false},
  recoveryBoundary:{baselineLatestnessIndependentlyVerified:false,productionTrafficAllowed:false,automaticHistoricalDeletionReplay:false,preparationMarkerIsNetworkOrBootGate:false},
  remaining:{dockerBuildAndRun:'environment-unselected-and-runtime-unavailable',requiredPublicReview:'not-executed',operatingBackupAndRecovery:'not-executed',serverDeployment:'not-executed',realAccountAndPhysicalDevices:'not-executed',firstCustomerComparison:'customer-and-workflow-unselected',secondCustomerSupply:'customer-and-workflow-unselected',effectAndProfitability:'not-measured'},
  boundaries:{operatingDatabaseWrites:0,operatingServerRestarts:0,realCustomerTrials:0,physicalDevicesTested:0,publicDeployments:0,paidAiCalls:0,externalMessages:0,installations:0,commits:0,pushes:0},
  sourceAndArtifactChecks:checks
};
await writeFile(join(here,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,hashChecks:checks.length,mismatches:0,hostTests:153,workbookChecks:{model:73,native:52,realInputBlank:1797},delivery:report.delivery}));

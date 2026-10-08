// Aggregate existing local evidence and verify its current sources and delivery copies.
// This does not run a server, rebuild an artifact, or touch operating data.
import {readFile,writeFile,stat,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const v2=join(root,'docs/유지비_BM/바탕화면_정리_20261005/v2');
const excelRoot=join(root,'docs/유지비_BM/통합계산_20261007');
const reportPaths={
  container:join(here,'container-report.json'),
  backup:join(here,'backup-report.json'),
  documents:join(v2,'output-20261007/verification.json'),
  workbook:join(excelRoot,'qa/report.json')
};
const data=Object.fromEntries(await Promise.all(Object.entries(reportPaths).map(async([name,path])=>[name,JSON.parse(await readFile(path,'utf8'))])));
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const normalized=path=>relative(root,path).replaceAll('\\','/');
const checks=[];
async function checkHash(path,expected,kind){
  const actual=await sha(path);checks.push({kind,path:normalized(path),expected,actual,passed:actual===expected});
}
const candidate=JSON.parse(await readFile(join(here,'candidate-sources.json'),'utf8'));
for(const [path,expected] of Object.entries(candidate.files))await checkHash(join(root,path),expected,'deployment-source');
for(const [path,expected] of Object.entries(data.backup.sourceHashes))await checkHash(join(root,path),expected,'backup-source');
for(const [path,record] of Object.entries(data.documents.sources))await checkHash(join(v2,path),record.sha256,'document-source');
for(const [path,expected] of Object.entries(data.workbook.sources))await checkHash(join(excelRoot,path),expected,'workbook-source');
await checkHash(join(here,data.container.tests.output),data.container.tests.sha256,'test-output');
await checkHash(data.workbook.validation.original.path,data.workbook.validation.original.sha256,'preserved-workbook');
const desktop='C:/Users/q1212/OneDrive/Desktop/bm 설계표/20261007_SHIFT_개정';
const deliveries=[];
for(const [source,name,expected] of [
  [join(v2,'output-20261007/SYNK_BM_20261007.pdf'),'00_BM_사업모델.pdf',data.documents.files['SYNK_BM_20261007.pdf'].sha256],
  [join(v2,'output-20261007/SYNK_BM_수정용.docx'),'01_BM_수정용.docx',data.documents.files['SYNK_BM_수정용.docx'].sha256],
  [data.workbook.output.path,'02_BM_통합계산.xlsx',data.workbook.output.sha256]
]){
  const delivered=join(desktop,name);
  await checkHash(source,expected,'artifact');await checkHash(delivered,expected,'delivery-copy');
  deliveries.push({source:normalized(source),delivered,sha256:expected,bytes:(await stat(source)).size});
}
const links=[
  'docs/_ops/qa/shift-release-preparation-20261007/README.md',
  'docs/유지비_BM/README.md',
  'docs/유지비_BM/바탕화면_정리_20261005/v2/output-20261007/README.md',
  'docs/유지비_BM/통합계산_20261007/qa/report.json',
  'experiences/shift-workbench/README.md',
  'outputs/01a10c3d-cfe1-7c40-a1db-eea42c604fd6/shift-bm-20261007/02_BM_통합계산_20261007.xlsx'
];
for(const path of links)await access(join(root,path));
const failed=checks.filter(check=>!check.passed);
const evidenceOk=data.container.tests.failed===0&&data.container.tests.passed===129&&data.container.packaging.checks===71&&data.backup.tests.passed===13&&data.documents.passed===114&&data.workbook.ok;
const report={
  version:1,createdAt:new Date().toISOString(),
  status:evidenceOk&&failed.length===0?'local-release-preparation-and-bm-verified':'failed',
  architecture:'Company host delivery, backup consistency and SHIFT business artifacts; Atlas common engine source unchanged by this follow-up.',
  evidence:Object.fromEntries(await Promise.all(Object.entries(reportPaths).map(async([name,path])=>[name,{path:normalized(path),sha256:await sha(path)}]))),
  validation:{
    serverRegression:data.container.tests,
    stagedNodeHost:{checks:71,passed:71,actualDockerBuildOrRun:false},
    syntheticBackupRestore:{...data.backup.tests,includedInServerRegression:true},
    documents:{checks:114,passed:114,pdfPages:data.documents.pdf_pages,wordPages:data.documents.word_pages,renderedPages:data.documents.rendered_pages,editableWord:data.documents.editable_word},
    workbook:data.workbook.validation,
    currentSourceAndDeliveryHashes:{checked:checks.length,passed:checks.length-failed.length,failed},
    addedLinkTargetsExist:links
  },
  deliveries,
  preserved:{previousDesktopFiles:data.documents.preserved_desktop_files,previousDocumentOriginals:data.documents.preserved_original_files,otherBrandSourcesChanged:false,legacyShiftUnitsIncludedInCurrentTotals:false},
  boundaries:{publicDeployment:false,productionDatabaseWrites:0,operatingServerRestarts:0,actualDockerBuildOrRun:false,realCompanyAccountChecks:0,physicalDeviceChecks:0,paidAiCalls:0,newPricesConfirmed:false,customerEffectsOrProfitabilityMeasured:false,commits:0,pushes:0},
  remaining:[
    'Actual Docker image build/run and persistent-volume verification in the operating environment.',
    'Operating DB/key/attachment backup and separate-folder recovery before release.',
    'Required final review and explicitly requested server/homepage publication.',
    'Real company account and physical PC/phone handoff acceptance.',
    'First customer workflow, scope, prices and effect/profitability evidence.',
    'Historical DB recovery requires reconciliation of later deletion/revision changes; automatic replay is not implemented.'
  ],
  sourceAndDeliveryChecks:checks
};
await writeFile(join(here,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,sourceHashesChecked:checks.length,hashMismatches:failed.length,deliveries:deliveries.map(({delivered,sha256})=>({delivered,sha256})),evidenceOk}));
if(report.status==='failed')process.exitCode=1;

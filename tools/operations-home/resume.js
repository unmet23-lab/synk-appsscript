'use strict';
// A scoped, read-only view of existing work. No task execution or new source of truth.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {머리읽기, 대상나누기} = require('../참고카드_목록');

const targets = [
  {id:'world',label:'WORLD 앱',match:'WORLD|월드|공통계정|공통 계정|성향|우리 동네|우리 방',paths:['experiences/synk-world-app','experiences/brand-opening'],sources:['experiences/synk-world-app/README.md','docs/디자인/월드_시그널/README.md','docs/SYNK_플랫폼_계정과_연결_설계.md']},
  {id:'town',label:'싱크타운',match:'싱크.?타운|synk-town',paths:['experiences/synk-town'],sources:['experiences/synk-town/README.md','docs/마을_설계.md']},
  {id:'games',label:'LAB 게임',match:'게임|한글|바람길|TOPIK',paths:['experiences/hangul-stage','experiences/korean-runner','experiences/order-rush','experiences/story-classroom'],sources:['docs/미니게임_TOPIK_I_학습기준.md','experiences/hangul-stage/README.md']},
  {id:'desktop',label:'데스크톱 앱',match:'플랫폼|Platform|데스크톱|설치|Desktop',paths:['desktop'],sources:['desktop/README.md','docs/SYNK_플랫폼_계정과_연결_설계.md']},
  {id:'content',label:'SNS·영상',match:'콘텐츠|SNS|영상|synkbrief|yuhobuilds|게시|제작',paths:['docs/마케팅','tools/완성본등록.mjs','tools/영상사전검사.mjs'],sources:['docs/마케팅/콘텐츠_제작방식_v2_20261002.md','docs/마케팅/제작양식/만족사례_장부.md','docs/마케팅/채널과_발행.md']},
  {id:'brand',label:'브랜드·디자인',match:'브랜드|디자인|로고|마스코트|자산',paths:['DESIGN.md','docs/디자인','tools/lib/마스코트자산.js'],sources:['DESIGN.md','docs/캐릭터/가이드_정본.md']},
  {id:'engines',label:'엔진·Atlas',match:'엔진|Atlas|아틀라스|Core|Loom|Vellum|Trail|Prism|Temper|Reed|Strata',paths:['atlas','tools/sync-atlas.js','tools/lib/atlas-copies.js'],sources:['docs/엔진8종_상향설계_v3.md','docs/아틀라스_설계.md']},
  {id:'workflow',label:'AI 작업 방식',match:'AI|자동화|백업|원본|문서|작업|운영 홈',paths:['tools','tests','docs/현장노트'],sources:['docs/AI_운영원칙.md','docs/현장노트/README.md','docs/참고카드/README.md']},
];
const docId = file => 'resume-'+crypto.createHash('sha256').update(file).digest('hex').slice(0,16);
const sourceTitles={'experiences/synk-world-app/README.md':'WORLD 앱 현재 구현','docs/디자인/월드_시그널/README.md':'WORLD 화면과 디자인','experiences/synk-town/README.md':'싱크타운 현재 구현','experiences/hangul-stage/README.md':'한글 단계 현재 구현','desktop/README.md':'데스크톱 앱 현재 구현','docs/현장노트/README.md':'도구별 현장 노트','docs/참고카드/README.md':'참고카드 사용법'};
const documentSources = [...new Set(targets.flatMap(t=>t.sources))].map(file=>({id:docId(file),title:sourceTitles[file]||path.basename(file,'.md').replace(/_/g,' '),file}));
function within(root,file){
  const base=fs.realpathSync(root),absolute=fs.realpathSync(path.resolve(root,file)),rel=path.relative(base,absolute);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('허용한 작업 폴더 밖입니다');
  return absolute;
}
function readCards(root){
  const folder='docs/참고카드/카드';let names;
  try{names=fs.readdirSync(within(root,folder)).filter(n=>n.endsWith('.md')).sort();}catch{return [];}
  return names.flatMap(name=>{
    try{
      const file=folder+'/'+name,absolute=within(root,file),stat=fs.statSync(absolute);
      if(!stat.isFile()||stat.size>1_000_000)return [];
      const raw=fs.readFileSync(absolute,'utf8'),meta=머리읽기(raw);if(!meta)return [];
      const request=/^## 적용 요청문[ \t]*\r?\n([^]*?)(?=^## |(?![^]))/m.exec(raw);
      return [{id:docId(file),file,title:meta.제목||name,targets:대상나누기(meta.대상),status:meta.상태||'새로',when:meta.언제||'미정',summary:meta.한줄||'',sharedAt:meta.공유일||'',request:request?request[1].trim():'',revision:crypto.createHash('sha256').update(raw).digest('hex').slice(0,16)}];
    }catch{return [];}
  }).sort((a,b)=>b.sharedAt.localeCompare(a.sharedAt)||a.file.localeCompare(b.file));
}
function gitSnapshot(root,scopes){
  const run=args=>execFileSync('git',['-c','core.quotepath=false',...args],{cwd:root,encoding:'utf8',timeout:10_000,maxBuffer:4*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']}).trimEnd();
  try{
    const head=run(['rev-parse','HEAD']),branch=run(['branch','--show-current']);
    const pieces=run(['status','--porcelain=v1','-z','--untracked-files=normal','--',...scopes]).split('\0'),changes=[];
    for(let i=0;i<pieces.length;i++){const row=pieces[i];if(row.length<4)continue;const status=row.slice(0,2),file=row.slice(3);if(/[RC]/.test(status))i++;changes.push({status,file});}
    const stats=run(['diff','--no-renames','--numstat','HEAD','--',...scopes]).split('\n').filter(Boolean).map(row=>{const [added,removed,...file]=row.split('\t');return {file:file.join('\t'),added:added==='-'?null:Number(added),removed:removed==='-'?null:Number(removed)};});
    const counts=new Map(stats.map(row=>[row.file,row]));
    const commits=run(['log','-3','--format=%h%x09%aI%x09%s','--',...scopes]).split('\n').filter(Boolean).map(row=>{const [id,at,...title]=row.split('\t');return {id,at,title:title.join('\t')};});
    let upstream=null;try{const ref=run(['rev-parse','--abbrev-ref','@{upstream}']),[behind,ahead]=run(['rev-list','--left-right','--count','@{upstream}...HEAD']).split(/\s+/).map(Number);upstream={ref,ahead,behind,liveFetched:false};}catch{}
    return {available:true,checkedAt:new Date().toISOString(),head,branch:branch||'detached HEAD',upstream,changeCount:changes.length,changes:changes.slice(0,100).map(row=>({...row,...(counts.get(row.file)||{})})),commits,scope:'현재 작업본 · 선택한 제품 경로만 · 원격 갱신 안 함'};
  }catch{return {available:false,changes:[],commits:[],changeCount:0,scope:'Git 상태를 읽지 못했습니다'};}
}
function readQa(root,target){
  const directory=path.join(root,'.tmp','qa-runs');let helper,names;
  try{helper=require('../lib/qa-evidence.cjs');names=fs.readdirSync(within(root,directory),{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(e=>e.name);}catch{return [];}
  const rows=[];
  for(const name of names){
    try{
      const manifestPath=within(root,path.join(directory,name,'qa-evidence.json')),e=helper.readEvidence({root,manifestPath});
      const products={world:['synk-world-app'],town:['synk-town'],games:['hangul-stage','korean-runner','order-rush','story-classroom'],desktop:['desktop','synk-platform']};
      if(!e||!e.source?.files?.some(f=>target.paths.some(p=>f.path===p||f.path.startsWith(p+'/')))||products[target.id]&&!products[target.id].includes(e.target?.product))continue;
      rows.push({manifest:path.relative(root,manifestPath).replace(/\\/g,'/'),label:e.label,status:e.status,finishedAt:e.finishedAt,startedAt:e.startedAt,syntheticAccount:e.syntheticAccount,liveProviderCalls:e.liveProviderCalls,target:e.target});
    }catch{}
  }
  return rows.sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).slice(0,4).map(row=>({...row,freshness:helper.freshness({root,manifestPath:row.manifest})}));
}
function buildResume(root,requested,{pending,readDocument}){
  const target=targets.find(t=>t.id===requested||t.label===requested);if(!target)throw new Error('목록에서 작업 대상을 골라 주세요');
  const match=new RegExp(target.match,'i'),cards=readCards(root).filter(c=>c.targets.includes(target.label)&&!c.status.startsWith('적용함'));
  const items=pending.filter(p=>match.test(p.title||p.text.slice(0,180))||match.test(p.heading));
  const docs=target.sources.map(file=>readDocument(root,documentSources.find(d=>d.file===file))).map(({content,...d})=>d);
  const git=gitSnapshot(root,[...new Set([...target.paths,...target.sources])]);
  return {target:{id:target.id,label:target.label},checkedAt:new Date().toISOString(),documents:docs,cards,pending:items,git,qa:readQa(root,target),coverage:'현재 원문과 로컬 Git·검증 기록. 미완료 항목은 원문 순서이며 실행·승인을 뜻하지 않습니다.'};
}
module.exports={targets,documentSources,readCards,gitSnapshot,buildResume};

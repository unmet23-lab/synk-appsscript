#!/usr/bin/env node
'use strict';
// 읽기 전용. 계정 원장과 실제 서버 수집 범위를 한 표로 대조한다.
// node tools/계정성과점검.js [--출력 <폴더>]
// 접속·로그아웃 외에는 GET만 사용하며 게시·예약·계정 연결을 바꾸지 않는다.
// 접속은 로컬 자동화 자격으로 이 점검이 새로 만든 자기 세션만 쓰고(SYNK_WORKSPACE_SESSION을 빌리지 않음), 끝의 로그아웃도 그 세션만 닫는다.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {connect}=require('./작업실예약.js');
const {공용작업본}=require('./lib/공용작업본.js');
const repo=path.resolve(__dirname,'..'),base='docs/마케팅/온라인마케팅지도/engagement/';
const managed=new Set(['operating','operating-contact','confirmed-expansion']);
const keys=['views','likes','comments','shares','saves','reach','followers'];
const known=n=>typeof n==='number'&&Number.isFinite(n);
const clean=s=>String(s??'').replace(/[|\r\n]/g,' ');

async function audit({state,reports,checkedAt=new Date().toISOString()}){
 const {accountCatalog,matchAccount,platformKey}=await import(pathToFileURL(path.join(repo,base,'company/account-catalog.mjs')));
 const byAccount=new Map(),orphans=[];
 for(const c of state.channels||[]){const a=c.catalogAccountId?accountCatalog.accounts.find(a=>a.id===c.catalogAccountId&&managed.has(a.accountStatus)&&platformKey(a.platform)===platformKey(c.platform)):matchAccount(c);if(a)byAccount.set(a.id,c);else orphans.push({platform:c.platform,handle:c.handle,url:c.canonicalUrl});}
 const accounts=accountCatalog.accounts.filter(a=>managed.has(a.accountStatus)).map(a=>{
  const c=byAccount.get(a.id),cap=(state.capabilities||[]).find(p=>platformKey(p.id)===platformKey(a.platform));
  const periods=Object.fromEntries(reports.map(r=>{const groups=Array.isArray(r.report.groups)?r.report.groups:r.report.groups?.channel||[];const group=groups.find(g=>g.id===c?.id);return [r.days,{start:r.report.start,end:r.report.end,metrics:Object.fromEntries(keys.map(key=>{const m=group?.metrics?.[key];return [key,m?{latest:m.latest??null,known:m.latestCount??0,eligible:m.eligible??0,increase:m.period?.delta??null,comparison:m.periodComparison||null}:{latest:null,known:0,eligible:0,increase:null,comparison:null}];}))}];}));
  const measured=keys.filter(key=>known(periods[7]?.metrics[key]?.latest));
  const externalCollection=c?.externalCollection||null;
  const externalPeriods=Object.fromEntries(reports.map(r=>[r.days,{truncated:r.report.externalObservations?.truncated===true,observations:(r.report.externalObservations?.channels||[]).find(g=>g.channelId===c?.id)?.observations||[]}]));
  const externalRows=reports.some(r=>r.report.externalObservations)?Object.values(externalPeriods).flatMap(p=>p.observations):Object.values(externalCollection?.byKind||{});
  const externallyMeasured=[...new Set(externalRows.flatMap(r=>Object.entries(r.metrics||{}).filter(([,n])=>known(n)).map(([key])=>key)))];
  const route=c?.connected?(externalCollection?'공식 API와 플랫폼 통계 기록':'공식 API'):externalCollection?'플랫폼 화면·공식 내보내기·공개 화면 기록':cap&&cap.mode!=='manual'?'공식 API 연결 필요':'관리자 통계 화면·공식 내보내기 확인';
  return {id:a.id,business:a.business,contentTrack:a.contentTrack,platform:a.platform,handle:a.handle,url:a.publicUrl,
   registered:!!c,connected:c?.connected===true,lastCollectedAt:c?.lastCollectedAt||null,status:c?.status||'not-registered',
   measured,externallyMeasured,externalCollection,externalPeriods,route,requirements:cap?.requirements||'현재 자동 수집기 없음. 해당 플랫폼 관리자 통계의 제공 지표를 확인하고 받은 값만 기록합니다.',
   limitations:c?.coverage?.limitations||[],unavailableMetrics:c?.coverage?.unavailableMetrics||[],ownerAuthorized:c?.coverage?.ownerAuthorized===true,periods};
 });
 return {checkedAt,source:'계정 속성 원장 + 인증된 Workspace /api/state + /api/analytics',schedule:state.schedule,
  summary:{managed:accounts.length,registered:accounts.filter(a=>a.registered).length,connected:accounts.filter(a=>a.connected).length,collected:accounts.filter(a=>a.lastCollectedAt).length,externallyObserved:accounts.filter(a=>a.externalCollection).length,unregistered:accounts.filter(a=>!a.registered).length},accounts,unmatchedServerChannels:orphans};
}
function markdown(result){
 const s=result.summary,lines=['# 등록 계정 성과 수집 점검','',`확인: ${result.checkedAt}`,`관리 ${s.managed}개 · 서버 등록 ${s.registered}개 · API 연결 ${s.connected}개 · 수집 기록 ${s.collected}개 · 서버 미등록 ${s.unregistered}개`,'',
  '수치는 종료일까지 관측한 게시물 누적 합입니다. 기간 조회수와 다릅니다. —는 0이 아니라 미수집·미제공입니다. 도달은 게시물별 값의 합이며 중복 제거한 사람 수가 아닙니다. 브라우저 로그인은 API 연결과 별도입니다.','',
  '| 사업 | 계정 | 플랫폼 | 수집 상태 | 조회 | 좋아요 | 공유 | 방법 |','|---|---|---|---|---:|---:|---:|---|'];
 for(const a of result.accounts){const m=a.periods[7].metrics;lines.push(`| ${a.business} | ${clean(a.handle||a.id)} | ${a.platform} | ${a.connected?'API 연결':a.externalCollection?'플랫폼 통계 확인됨':a.registered?'통계 연결 미확인':'미등록'}${a.lastCollectedAt?' · 수집 기록 있음':''} | ${known(m.views.latest)?m.views.latest.toLocaleString('ko-KR'):'—'} | ${known(m.likes.latest)?m.likes.latest.toLocaleString('ko-KR'):'—'} | ${known(m.shares.latest)?m.shares.latest.toLocaleString('ko-KR'):'—'} | ${a.route} |`);}
 const external=result.accounts.filter(a=>a.externalCollection);
 if(external.length){
  lines.push('',`플랫폼 통계가 확인된 계정은 ${external.length}개입니다. 아래 값은 종류별 마지막 관측 한 건이며, 계정 전체의 합계가 아닐 수 있습니다. 위 게시물 누적값에 더하지 않습니다.`,'','| 계정 | 관측 종류 | 실제 기간 | 조회 | 좋아요 | 공유 | 확인 시각 |','|---|---|---|---:|---:|---:|---|');
  const kindNames={'account-period':'계정 기간 통계','account-lifetime':'계정 누적 통계','post-lifetime':'개별 게시물 누적'};
  for(const a of external)for(const [kind,r]of Object.entries(a.externalCollection.byKind||{})){
   const span=r.period?`${r.period.start} ~ ${r.period.end}`:kind==='post-lifetime'?r.post?.externalId||'개별 게시물':'누적';
   const nums=['views','likes','shares'].map(k=>known(r.metrics?.[k])?r.metrics[k].toLocaleString('ko-KR'):'—');
   lines.push(`| ${clean(a.handle||a.id)} | ${kindNames[kind]||clean(kind)} | ${clean(span)} | ${nums.join(' | ')} | ${clean(r.observedAt)} |`);
  }
 }
 lines.push('','7/30/60/90일의 증가량·비교 가능 범위와 계정별 제한은 같은 이름의 JSON에 있습니다. 과거 기준일 관측이 없는 기간은 역산하지 않습니다.');
 return lines.join('\n')+'\n';
}
// session:null — 환경의 빌린 세션 대신 늘 자격으로 새로 로그인한다. 자격이 없으면 빌린 세션으로 대신하지 않고 멈춘다.
// 시험은 connect·log만 바꿔 끼운다(실제 네트워크·자격 없음).
async function main(argv=process.argv.slice(2),{connect:open=connect,log=line=>console.log(line)}={}){
 const at=argv.indexOf('--출력'),output=path.resolve(at>=0?argv[at+1]:path.join(공용작업본(repo),'.tmp','계정성과점검',new Date().toISOString().replace(/[:.]/g,'-')));
 const {shiftDate}=await import(pathToFileURL(path.join(repo,base,'analytics.mjs')));
 const end=shiftDate(new Date(Date.now()+9*3600000).toISOString().slice(0,10),-1),ws=await open({origin:'https://workspace.synk.im',session:null});
 try{
  const state=await ws.get('/api/state'),reports=[];
  for(const days of [7,30,60,90])reports.push({days,report:await ws.get('/api/analytics?'+new URLSearchParams({start:shiftDate(end,1-days),end}))});
  const result=await audit({state,reports});fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'계정성과점검.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(output,'계정성과점검.md'),markdown(result));
  log(JSON.stringify({checkedAt:result.checkedAt,...result.summary,unmatched:result.unmatchedServerChannels.length,output}));
 }finally{await ws.post('/api/logout',{}).catch(()=>{});}
}
module.exports={audit,markdown,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});

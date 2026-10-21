// 트렌드·레퍼런스·제작 데스크 확인용 합성 서버. node fixture.mjs <회사 폴더>
// verify-workspace-fixture.mjs처럼 임시 DB·가상 계정만 쓰고, 일일 트렌드 원본·조사 문서 읽기는 가짜 응답으로 바꾼다(밖으로 나가는 요청 없음).
// 띄울 때 TEMP·TMP를 내 폴더로 주면 임시 DB가 그 아래 생긴다. 표준 출력 첫 JSON 줄에 주소·계정이 나온다.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const company=resolve(process.argv[2]);
const {createCompanyApp}=await import(pathToFileURL(join(company,'server.mjs')).href);
const directory=await mkdtemp(join(tmpdir(),'synk-workroom-copy-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const now=Date.now(),iso=offsetHours=>new Date(now+offsetHours*3600000).toISOString(),rfc=offsetHours=>new Date(now+offsetHours*3600000).toUTCString();

// 일일 트렌드 원본: Google 급상승(한국·미국), YouTube 문화 블로그, 바이두는 가짜 응답, YouTube 차트는 키가 없어 연결 필요로 남는다.
const googleRss=region=>`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel><title>Daily Search Trends</title>${(region==='KR'?[['가을 단풍 명소','20,000+'],['수능 D-30 공부법','10,000+'],['아이폰 새 기능','5,000+'],['회의록 정리 앱','2,000+']]:[['fall foliage map','50,000+'],['study timer app','20,000+'],['halloween costume ideas','100,000+']]).map(([title,traffic],index)=>`<item><title>${title}</title><ht:approx_traffic>${traffic}</ht:approx_traffic><pubDate>${rfc(-2-index)}</pubDate><ht:news_item><ht:news_item_title>${title} 관련 소식 ${index+1}</ht:news_item_title><ht:news_item_url>https://news.example.com/${region.toLowerCase()}/${index+1}</ht:news_item_url><ht:news_item_source>예시 뉴스</ht:news_item_source></ht:news_item></item>`).join('')}</channel></rss>`;
const cultureRss=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>YouTube Blog</title><item><title>Culture &amp; Trends Report: Fall 2026</title><link>https://blog.youtube/culture-and-trends/fall-2026-report/</link><pubDate>${rfc(-72)}</pubDate></item><item><title>What audiences watched this month</title><link>https://blog.youtube/culture-and-trends/monthly-recap/</link><pubDate>${rfc(-200)}</pubDate></item></channel></rss>`;
const baiduHtml=`<html><body><!--s-data:${JSON.stringify({data:{cards:[{component:'hotList',content:[{word:'国庆假期出游',rawUrl:'https://www.baidu.com/s?wd=a',hotScore:'4920000',index:0},{word:'秋季新品发布',rawUrl:'https://www.baidu.com/s?wd=b',hotScore:'3810000',index:1},{word:'考试复习方法',rawUrl:'https://www.baidu.com/s?wd=c',hotScore:'2750000',index:2}]}]}})}--></body></html>`;
async function dailyTrendsFetch(url){
  const target=new URL(url);
  if(target.hostname==='trends.google.com')return new Response(googleRss(target.searchParams.get('geo')),{status:200,headers:{'content-type':'application/rss+xml'}});
  if(target.hostname==='blog.youtube')return new Response(cultureRss,{status:200,headers:{'content-type':'application/rss+xml'}});
  if(target.hostname==='top.baidu.com')return new Response(baiduHtml,{status:200,headers:{'content-type':'text/html'}});
  return new Response('',{status:503});
}

// 조사 문서: 첫 문서는 완료 보고서를 돌려주고, 둘째 문서는 읽기에 실패한다.
const DOC_OK='synkReviewResearchDocument0001',DOC_FAIL='synkReviewResearchDocument0002';
const guideResearch=(brand,format,appeal)=>({summary:`${brand}에 맞는 짧은 실연 형식의 공개 사례입니다.`,whyNow:'이번 주 같은 주제의 검색과 공유가 늘었습니다.',viewerReason:'보고 바로 따라 할 수 있는 한 가지 방법을 줍니다.',brands:[brand],priority:'high',observedFacts:[{text:'첫 3초에 결과 화면을 먼저 보여 줍니다.'},{text:'자막으로 단계 번호를 붙여 따라가기 쉽게 만듭니다.'}],evidenceLevel:'video-watched',limitations:'공개 반응 수치만 확인했고 광고 집행 여부는 모릅니다.',applications:[{brand,idea:`${brand} 실제 화면으로 같은 순서를 보여 줍니다.`,zeroSecondHook:'결과 화면부터 보여 주고 질문을 던집니다.',action:'댓글로 자기 상황을 한 줄 남깁니다.',reward:'상황에 맞는 다음 단계를 받습니다.',personalizationTool:'선택한 상황에 맞춘 연습 화면으로 이어집니다.',validation72h:'72시간 동안 저장·댓글 수를 지난 편과 견줍니다.'}],productionGuide:{formatName:format,productionSteps:[{order:1,title:'결과 화면 준비',instruction:'완성된 결과 화면을 먼저 녹화합니다.'},{order:2,title:'단계 나누기',instruction:'과정을 세 단계로 나누고 번호 자막을 붙입니다.'},{order:3,title:'질문으로 끝내기',instruction:'시청자 상황을 묻는 질문으로 마무리합니다.'}],requiredAssets:['실제 작업 화면 녹화','단계별 자막 원고','브랜드 서체'],brandAdaptation:`${brand}의 색과 마스코트 장면을 첫 화면에 둡니다.`,appeal,estimatedMinutes:90}});
const referenceResearch=(brand,evidenceLevel='page-read')=>({summary:'같은 주제를 다룬 공개 사례로, 도입 방식을 참고할 만합니다.',whyNow:'다음 주 기획 회의 전에 살펴볼 자료입니다.',viewerReason:'익숙한 문제를 새 방법으로 푸는 장면이 있습니다.',brands:[brand],priority:'medium',observedFacts:[{text:'도입에서 문제 상황을 한 문장으로 보여 줍니다.'}],evidenceLevel,limitations:'게시자의 다른 영상은 확인하지 않았습니다.',applications:[{brand,idea:'우리 사례로 같은 문제를 다시 풀어 봅니다.',zeroSecondHook:'문제 장면을 먼저 보여 줍니다.',action:'자기 방법을 댓글로 남깁니다.',reward:'다른 사람의 방법을 모아 봅니다.',personalizationTool:'상황별 추천 목록으로 이어집니다.',validation72h:'72시간 동안 댓글 수를 확인합니다.'}]});
// 보고서 날짜는 조사를 마친 시각(iso(-4))의 한국 날짜여야 한다(UTC 날짜를 쓰면 한국 0~9시에 막힌다).
const report=(reportId,entries)=>({schemaVersion:1,reportId,date:new Date(now+5*3600000).toISOString().slice(0,10),provider:'gemini-spark',visibility:'company',shareConfirmed:true,asOfAt:iso(-6),researchStartedAt:iso(-6),researchCompletedAt:iso(-4),entries});
const documentReport=report('review-doc-report',[{source:'instagram',kind:'reel',title:'회의 메모를 1분 만에 할 일로',sourceUrl:'https://www.instagram.com/reel/ReviewDoc01/',region:'KR',checkedAt:iso(-5),research:guideResearch('synkbrief','결과부터 보여 주는 1분 실연','보고 나서 바로 자기 회의에 써 볼 수 있습니다.')}]);
async function creativeResearchReader({documentId}){
  if(documentId===DOC_FAIL)throw new Error('fixture read failure');
  return {text:JSON.stringify(documentReport)+'\nSYNK_CREATIVE_RESEARCH_COMPLETE',modifiedTime:iso(-4)};
}

const app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port,origin:`http://localhost:${port}`,schedule:false,dailyTrendsFetch,creativeResearchReader});
const password='local-review-fixture-only';
const people=[{key:'admin',name:'검증 관리자',role:'admin'},{key:'member',name:'검증 동료',role:'member'},{key:'manager',name:'마케팅 팀장',role:'manager'},{key:'viewer',name:'검증 열람자',role:'viewer'}];
const users=Object.fromEntries(people.map(person=>[person.key,app.store.createUser({email:`${person.key}@example.test`,name:person.name,role:person.role,password})]));
const base=`http://localhost:${port}`;
let stopping;async function stop(){if(stopping)return stopping;stopping=(async()=>{await app.stop();const target=resolve(directory),prefix=resolve(tmpdir())+sep;if(!target.startsWith(prefix)||!target.split(sep).at(-1).startsWith('synk-workroom-copy-'))throw Error('Unexpected fixture path');await rm(target,{recursive:true,force:true});})();return stopping;}
process.on('SIGINT',()=>void stop().then(()=>{process.exitCode=0;}));process.on('SIGTERM',()=>void stop().then(()=>{process.exitCode=0;}));
async function client(email){
  const response=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const session=await response.json();assert.equal(response.status,200,`Synthetic login failed: ${email}`);
  const cookie=response.headers.getSetCookie().find(value=>value.startsWith('synk_company_session='))?.split(';')[0];assert.ok(cookie,'Fixture company session missing');
  return async(path,data)=>{
    const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:base,Cookie:cookie,'X-CSRF-Token':session.csrfToken,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const result=await res.json();if(!res.ok)throw new Error(`${path}: ${res.status} ${result.error}`);return result;
  };
}
const waitFor=async(check,label)=>{for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw new Error('timeout: '+label);};
try{
  await app.start();
  const admin=await client(users.admin.email);
  const team=(await admin('/api/teams',{name:'마케팅팀'})).team;
  for(const person of people)await admin(`/api/members/${users[person.key].id}/assignment`,{...(person.key==='admin'?{}:{role:person.role}),teamId:team.id});
  const member=await client(users.member.email);
  const channel=(await admin('/api/channels',{urls:'https://www.youtube.com/@synk-review-desk',ownerId:users.admin.id,teamId:team.id})).added[0];
  await admin(`/api/channels/${channel.id}/details`,{displayName:'SYNK 브리프 · 검증용'});
  await admin('/api/channels',{urls:'https://www.instagram.com/synk.review.desk/',ownerId:users.admin.id,teamId:team.id});

  // 트렌드·레퍼런스: 가이드 셋·참고 자료 둘을 보고서로, 나머지는 직접 기록으로.
  await admin('/api/creative-research/import-report',report('review-report-1',[
    {source:'facebook',kind:'reel',title:'회의록을 할 일 목록으로 바꾸는 장면',sourceUrl:'https://www.facebook.com/reel/700000000000001/',region:'KR',checkedAt:iso(-5),research:guideResearch('synkbrief','회의 메모 정리 실연','회의가 끝나자마자 할 일이 정리되는 장면을 봅니다.')},
    {source:'instagram',kind:'reel',title:'한국어 표현 하나를 상황극으로 익히기',sourceUrl:'https://www.instagram.com/reel/ReviewGuide2/',region:'US',checkedAt:iso(-5),research:guideResearch('LAB','상황극으로 표현 하나 익히기','30초 안에 실제로 쓸 수 있는 표현을 하나 얻습니다.')},
    {source:'facebook',kind:'reel',title:'작업 전후를 나란히 보여 주는 편집',sourceUrl:'https://www.facebook.com/reel/700000000000003/',region:'KR',checkedAt:iso(-5),research:guideResearch('yuhobuilds','전후 비교 한 화면','같은 작업이 얼마나 빨라졌는지 바로 봅니다.')},
    {source:'facebook',kind:'reel',title:'질문 댓글에 영상으로 답하기',sourceUrl:'https://www.facebook.com/reel/700000000000004/',region:'KR',checkedAt:iso(-5),research:referenceResearch('synkbrief')},
    {source:'instagram',kind:'reel',title:'첫 화면 자막만 바꾼 두 버전',sourceUrl:'https://www.instagram.com/reel/ReviewRef05/',region:'KR',checkedAt:iso(-5),research:referenceResearch('LAB','metadata-only')},
  ]));
  await admin('/api/creative-research',{source:'tiktok-top-ads',kind:'ad',title:'앱 설치 전후를 보여 주는 광고',sourceUrl:'https://ads.tiktok.com/business/creativecenter/topads/7522423151142551568/pc/en',region:'US',checkedAt:iso(-30).slice(0,10)+'T00:00:00+09:00',creator:'Example Study App',periodDays:30,metrics:{likes:12840,comments:310,shares:920},ctrTopPercent:12,budgetLabel:'Medium',durationSeconds:21,hook:'첫 장면에 시험 점수를 보여 줍니다.',structure:'문제 → 앱 사용 → 점수 변화 순서입니다.',adaptation:'우리 학습 화면의 변화를 같은 순서로 보여 줍니다.',visibility:'company',shareConfirmed:true});
  await admin('/api/creative-research',{source:'youtube-trends',kind:'recent-video',title:'회의 메모 자동 정리 후기',sourceUrl:'https://www.youtube.com/watch?v=reviewVid01',region:'KR',checkedAt:iso(-48).slice(0,10)+'T00:00:00+09:00',creator:'업무 자동화 채널',metrics:{views:48200,likes:1310,comments:88},hook:'회의 녹음을 켜는 장면으로 시작합니다.',visibility:'company',shareConfirmed:true});
  await admin('/api/creative-research',{source:'instagram',kind:'best-practice',title:'릴스 첫 3초 만들기 안내',sourceUrl:'https://creators.instagram.com/grow/reels-first-seconds',region:'GLOBAL',checkedAt:iso(-72).slice(0,10)+'T00:00:00+09:00',adaptation:'첫 장면에 결과를 두는 규칙을 우리 양식에 넣습니다.',visibility:'private',shareConfirmed:false});
  const research=await admin('/api/creative-research?includeArchived=1');
  const claimable=research.entries.find(row=>row.productionReady&&row.usage?.canClaim);if(claimable)await admin(`/api/creative-research/${claimable.id}/claim`,{});
  const archivable=research.entries.find(row=>row.source==='youtube-trends');if(archivable)await admin(`/api/creative-research/${archivable.id}/archive`,{});

  // 조사 문서 자동 반영: 문서 둘(하나는 읽기 실패)을 연결하고 한 번 확인한다.
  app.creativeResearchSync.configure(users.admin,{enabled:true,sources:[{id:'yt-tt',documentId:DOC_OK},{id:'meta-brand',documentId:DOC_FAIL}]});
  await admin('/api/creative-research/sync-check',{});
  await waitFor(async()=>{const state=(await admin('/api/creative-research/sync-status'));return state.status!=='checking'&&state.lastCheckedAt;},'sync');

  // 일일 트렌드: 가짜 원본으로 한 번 모은다.
  await admin('/api/daily-trends/collect',{force:true});
  await waitFor(async()=>!(await admin('/api/daily-trends')).running,'daily trends');

  // 기획: 관리자 기획 둘, 동료 기획 하나, 개인 참고 자료 하나.
  const draft=(await admin('/api/content-generate',{seriesId:'synkbrief-use',topic:'회의 메모를 팀의 할 일로 바꾸는 방법',audience:'콘텐츠를 함께 만드는 크루',takeaway:'메시지에서 담당자와 기한을 정해 실행하는 방법',experience:'회의가 끝나고 담당자를 빠뜨린 일이 두 번 있었다.',proof:'실제 회의 메모와 정리 결과 화면',entertainment:'정리 전후가 한 화면에서 바뀌는 순간',channelId:channel.id,authenticity:{basis:'직접 겪은 일',ownPerspective:'',limits:'',disclosure:''}})).draft;
  await admin('/api/content-generate',{seriesId:'synkbrief-use',topic:'처음 쓰는 사람을 위한 자동 요약 설정'});
  await member('/api/content-generate',{seriesId:'synkbrief-use',topic:'동료가 만든 개인 기획'});
  await admin('/api/content-references',{url:'https://www.instagram.com/reel/ReviewRef09/',title:'회의 요약을 한 장으로 보여 주는 릴스',creator:'example.creator',publishedAt:iso(-96).slice(0,10),formatNotes:'첫 장면에 결과 한 장 → 만드는 순서 → 저장 안내.',channelId:'',metrics:{views:3200,likes:140,comments:12,shares:9}});

  // 제작 스튜디오: 작업 넷·소재 셋·예시 둘.
  const make=async input=>(await admin('/api/studio-productions',input)).production;
  const today=new Date(now+9*3600000).toISOString().slice(0,10),day=offset=>new Date(now+9*3600000+offset*86400000).toISOString().slice(0,10);
  await make({title:'자동 요약 설정 따라 하기',stage:'idea',nextAction:'',dueDate:day(5),teamId:team.id});
  await make({title:'회의 메모 정리 실연',stage:'making',nextAction:'자막 원고 다듬기',blocker:'결과 화면 녹화본이 아직 없어요',dueDate:day(-1),reviewerId:users.manager.id,teamId:team.id,draftId:draft.id});
  const reviewing=await make({title:'전후 비교 한 화면',stage:'review',nextAction:'검토 의견 반영',reviewerId:users.manager.id,dueDate:today,teamId:team.id});
  const ready=await make({title:'표현 하나 상황극',stage:'ready',nextAction:'게시 예약',reviewerId:users.manager.id,dueDate:day(2),teamId:team.id});
  for(const row of [reviewing,ready]){
    const v1=(await admin(`/api/studio-productions/${row.id}/versions`,{label:'1차 원고',kind:'text',text:'첫 장면: 회의가 끝난 화면.\n둘째 장면: 메모에서 담당자와 기한을 뽑는다.\n마지막: 할 일 목록이 완성된다.'})).production.versions.at(-1);
    await admin(`/api/studio-productions/${row.id}/versions`,{label:'2차 · 도입 보완',kind:'link',url:'https://www.youtube.com/watch?v=reviewVideo2'});
    const noted=(await admin(`/api/studio-productions/${row.id}/notes`,{versionId:v1.id,text:'도입에서 결과 화면을 먼저 보여 주면 더 좋겠어요.',axis:'fun',atSeconds:null})).production;
    await admin(`/api/studio-productions/${row.id}/notes`,{versionId:v1.id,text:'마지막 질문이 조금 길어요.',axis:'usefulness',atSeconds:null});
    await admin(`/api/studio-productions/${row.id}/notes/${noted.notes[0].id}`,{resolved:true});
    if(row.id===ready.id)await admin('/api/studio-examples',{productionId:row.id,versionId:v1.id,title:'표현 하나 상황극',whyGood:'상황 하나로 표현의 쓰임을 바로 보여 줍니다.',lesson:'다음 편도 상황부터 보여 주고 표현을 꺼냅니다.',axis:'fun',shareConfirmed:true});
  }
  await admin('/api/studio-examples/direct',{title:'질문 댓글에 영상으로 답한 사례',kind:'link',url:'https://www.instagram.com/reel/ReviewEx01/',whyGood:'댓글 질문을 첫 화면에 그대로 보여 줘서 왜 보는지 바로 알 수 있어요.',lesson:'받은 질문을 첫 장면에 그대로 씁니다.',axis:'usefulness',shareConfirmed:true});
  await admin('/api/studio-materials',{title:'회의 메모에서 담당자를 빠뜨렸던 순간',kind:'experience',body:'월요일 회의 뒤 메모에는 할 일이 다섯 개였는데 담당자가 적힌 건 두 개뿐이었다. 다음 주에 같은 일이 두 번 밀렸다.',tags:['회의','첫 시도'],visibility:'private'});
  await admin('/api/studio-materials',{title:'자동 요약은 어디까지 믿어도 되나요?',kind:'question',body:'고객 상담에서 세 번 받은 질문. 요약이 틀렸을 때 어떻게 알아채는지 궁금해한다.',tags:['AI 활용'],visibility:'team',teamId:team.id});
  await admin('/api/studio-materials',{title:'회의 녹음 앱 공식 안내',kind:'reference',body:'녹음 파일에서 화자를 나누는 기능이 새로 생겼다.',sourceUrl:'https://www.example.com/meeting-notes-guide',tags:['참고'],visibility:'company',shareConfirmed:true});

  console.log(JSON.stringify({url:base,email:users.admin.email,password,synthetic:true,channelId:channel.id,draftId:draft.id,reviewProductionId:reviewing.id,readyProductionId:ready.id}));
}catch(error){console.error(error);await stop();process.exitCode=1;}

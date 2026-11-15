// PULSE 고객 방 큰 미리 보기 우선순위 회귀 시험(2026-11-15, 후속 F3, 재현 기록 preview-priority-reproduction-r1.json).
// 최종본이 도착한 의뢰 흐름 고객 방에서 큰 미리 보기 칸이 최종 영상 · 사진보다 지난 시안이나 사용 안내 링크를 먼저 고르던 문제를 본다.
// 실제 화면 함수 projectView의 출력(video · img · a 태그, 접근성 이름, 주소, data-room-go)만 검사한다. 화면 내부 함수는 꺼내 쓰지 않는다.
// 자료는 모두 합성이다. 네트워크 · DB · 실제 고객 · 파일 업로드를 쓰지 않고, 주소를 실제로 열지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location=new URL('http://localhost/pulse-app/');
const {projectView}=await import('./public/pulse-app/views.mjs');
const {roomState,roomTab}=await import('./public/pulse-app/room-view.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');

// 화면을 그리는 동안 주소를 열거나 요청하면 여기에 남는다. 어느 시험에서도 비어 있어야 한다.
const opened=[];
globalThis.fetch=(...args)=>{opened.push(['fetch',String(args[0])]);throw new Error('이 시험은 네트워크를 쓰지 않아요');};
globalThis.open=(...args)=>{opened.push(['open',String(args[0])]);return null;};

const T=hour=>new Date(Date.UTC(2026,10,10,hour)).toISOString();
const media=(id,mimeType,fileName)=>({url:'/pulse/api/studio/media/'+id,mimeType,fileName,byteSize:2048});
const here=path=>new URL(path,location.origin).href;

const PREVIEW={id:'ver-preview-1',kind:'preview',label:'이전 시안',createdAt:T(1),media:media('preview-1','video/mp4','preview.mp4')};
const FINAL_FILM={id:'ver-final-1',kind:'final',label:'최종본 15초',createdAt:T(2),media:media('final-1','video/mp4','final.mp4')};
const FILM_OLD={id:'ver-final-a',kind:'final',label:'최종본 첫 납품',createdAt:T(2),media:media('final-a','video/mp4','final-a.mp4')};
const FILM_NEW={id:'ver-final-b',kind:'final',label:'최종본 고친 납품',createdAt:T(3),media:media('final-b','video/webm','final-b.webm')};
const PHOTO_OLD={id:'ver-photo-a',kind:'final',label:'최종 사진 첫 판',createdAt:T(2),media:media('photo-a','image/jpeg','photo-a.jpg')};
const PHOTO_NEW={id:'ver-photo-b',kind:'final',label:'최종 사진 고친 판',createdAt:T(3),media:media('photo-b','image/png','photo-b.png')};
const FILE={id:'ver-final-pack',kind:'final',label:'최종 파일 묶음',createdAt:T(2),media:media('final-pack','application/zip','final-pack.zip')};
const GUIDE={id:'ver-final-guide',kind:'final',label:'게시 안내 링크',createdAt:T(5),url:'https://guide.example.test/pulse/usage',guide:'올릴 곳마다 이 안내를 먼저 읽어 주세요.'};
// 안전하지 않은 최종본: 스크립트 주소, 다른 출처의 미디어, 스크립트 · 데이터 링크.
const UNSAFE=[
  {id:'ver-final-script',kind:'final',label:'깨진 최종 영상',createdAt:T(2),media:{url:'javascript:alert(1)',mimeType:'video/mp4',fileName:'broken.mp4'}},
  {id:'ver-final-cross',kind:'final',label:'다른 출처 최종 사진',createdAt:T(3),media:{url:'https://cdn.untrusted.example/final.png',mimeType:'image/png',fileName:'final.png'}},
  {id:'ver-final-script-link',kind:'final',label:'깨진 안내 링크',createdAt:T(4),url:'javascript:alert(2)'},
  {id:'ver-final-data-link',kind:'final',label:'데이터 주소 안내',createdAt:T(5),url:'data:text/html;base64,PHA+eDwvcD4='},
];
const PLANTED=['javascript:alert','cdn.untrusted.example','data:text/html'];

// 영상 상품(s15)의 의뢰 흐름 고객 방. 사진 상품은 완성 사진을 여러 장 거는 다른 칸을 쓰므로 이 시험에서 보지 않는다.
const project=(stage,versions)=>({id:'p-preview-priority',title:'합성 미리 보기 시험',ownerName:'합성 담당자',stage,revision:4,versions:structuredClone(versions),messages:[],requestFlow:true,
  studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[],
    feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:false,maxItems:20,nextNumber:1},
    request:{status:'confirmed',number:'P-2026-PRVW',submittedAt:T(0),confirmedAt:T(0),approvedAt:T(0),answers:{...emptyAnswers(),name:'합성 제품',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[]}}});

// 출력 읽기: 태그의 속성과 단추의 이름(안쪽 글)만 본다.
const decode=text=>text.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrsOf=raw=>Object.fromEntries([...raw.matchAll(/([^\s"'=<>\/]+)(?:\s*=\s*"([^"]*)")?/g)].map(m=>[m[1].toLowerCase(),m[2]===undefined?'':decode(m[2])]));
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b([^>]*)>','gi'))].map(m=>attrsOf(m[1]));
const buttons=html=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map(m=>({attrs:attrsOf(m[1]),name:decode(m[2].replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim()}));
const urlAttrs=html=>[...html.matchAll(/\s(?:href|src|poster|srcset|action|formaction)="([^"]*)"/gi)].map(m=>decode(m[1]));
const roomGoes=html=>[...html.matchAll(/data-room-go="([^"]*)"/g)].map(m=>decode(m[1]));

// 고객 방(탭 overview)을 실제 projectView로 그리고 큰 미리 보기 칸을 떼어 본다.
function room(stage,versions){
  const p=project(stage,versions),html=projectView({mode:'customer',tab:'overview',project:p});
  assert.equal(typeof html,'string');
  assert.deepEqual(opened,[],'화면을 그리는 동안 주소를 열거나 요청하지 않는다');
  const at=html.indexOf('class="sx-room-screen"'),end=html.indexOf('</section>',at);
  assert.ok(at>=0&&end>at,'고객 방에 큰 미리 보기 칸이 있어야 한다');
  const screen=html.slice(html.lastIndexOf('<',at),end);
  return {p,html,screen,videos:tags(screen,'video'),images:tags(screen,'img'),links:tags(screen,'a'),goes:buttons(screen).filter(b=>Object.hasOwn(b.attrs,'data-room-go'))};
}
function assertGoesToReview(view,label){
  assert.ok(view.goes.length>0,'큰 미리 보기에 영상 확인으로 가는 단추가 있어야 한다');
  for(const b of view.goes){
    assert.equal(b.attrs['data-room-go'],'review','큰 미리 보기의 이동은 영상 확인(review)');
    assert.equal(roomTab(b.attrs['data-room-go']),b.attrs['data-room-go'],'roomTab이 그대로 받는 이동이어야 한다');
  }
  assert.ok(view.goes.some(b=>b.name.includes(label)),'이동 단추의 이름에 보이는 자료 「'+label+'」이 들어가야 한다');
  assert.ok(!roomGoes(view.html).includes('deliver'),'없는 화면 deliver로 가는 이동이 없어야 한다');
}
function assertBigFilm(view,version){
  assert.deepEqual(view.videos.map(v=>v.src),[here(version.media.url)],'큰 미리 보기는 「'+version.label+'」 영상 하나');
  assert.equal(view.videos[0]['aria-label'],version.label,'영상의 접근성 이름');
  assert.deepEqual(view.images,[],'영상 자리에 사진이 끼지 않는다');
  assert.ok(!view.links.some(a=>a.href===here(GUIDE.url)),'사용 안내 링크가 큰 미리 보기를 차지하지 않는다');
  assertGoesToReview(view,version.label);
}
const STAGES=['producing','delivered'];

test('1. 제작 중(producing)이어도 최종 영상이 있으면 큰 미리 보기는 지난 시안이 아니라 최종 영상이다',()=>{
  const view=room('producing',[PREVIEW,FINAL_FILM,GUIDE]);
  assert.equal(roomState(view.p),'deliver');
  assertBigFilm(view,FINAL_FILM);
});

test('2. 최종 전달(delivered)에서도 같은 자료면 큰 미리 보기는 사용 안내 링크가 아니라 최종 영상이다',()=>{
  const view=room('delivered',[PREVIEW,FINAL_FILM,GUIDE]);
  assert.equal(roomState(view.p),'deliver');
  assertBigFilm(view,FINAL_FILM);
});

test('3. 같은 종류 안에서는 최신 판: 최종 영상 두 개 뒤에 온 최종 링크가 영상 선택을 덮지 않는다',()=>{
  for(const stage of STAGES){
    const view=room(stage,[FILM_OLD,FILM_NEW,GUIDE]);
    assert.equal(roomState(view.p),'deliver');
    assertBigFilm(view,FILM_NEW);
  }
});

test('4. 최종 사진과 최종 안내 링크가 함께 있으면 최종 사진이 먼저 보이고, 사진끼리는 최신 판이다',()=>{
  for(const stage of STAGES){
    const view=room(stage,[PHOTO_OLD,PHOTO_NEW,GUIDE]);
    assert.ok(view.images.length>0,'큰 미리 보기에 최종 사진이 있어야 한다');
    assert.equal(view.images[0].src,here(PHOTO_NEW.media.url),'맨 앞은 최신 최종 사진');
    assert.equal(view.images[0].alt,PHOTO_NEW.label,'사진의 대체 글');
    assert.ok(!view.images.some(img=>img.src===here(PHOTO_OLD.media.url)),'지난 최종 사진은 큰 미리 보기에 없다');
    assert.deepEqual(view.videos,[]);
    assert.ok(!view.links.some(a=>a.href===here(GUIDE.url)),'안내 링크가 사진 자리를 차지하지 않는다');
    assertGoesToReview(view,PHOTO_NEW.label);
  }
});

test('5. 기타 파일 · 링크뿐인 최종본은 안전한 내려받기와 새 탭 링크로 남고, 실제로 열지 않는다',()=>{
  for(const stage of STAGES){
    const file=room(stage,[FILE]);
    assert.deepEqual(file.videos,[]);assert.deepEqual(file.images,[]);
    const down=file.links.filter(a=>a.href===here(FILE.media.url));
    assert.equal(down.length,1,'같은 출처의 파일 받기 링크 하나');
    assert.ok(Object.hasOwn(down[0],'download'),'파일 받기는 download로 받는다');
    assertGoesToReview(file,FILE.label);
    const link=room(stage,[GUIDE]);
    assert.deepEqual(link.videos,[]);assert.deepEqual(link.images,[]);
    const out=link.links.filter(a=>a.href===here(GUIDE.url));
    assert.equal(out.length,1,'외부 안내 링크 하나');
    assert.equal(out[0].target,'_blank','새 탭으로 연다');
    const rel=new Set(String(out[0].rel||'').split(/\s+/));
    assert.ok(rel.has('noopener')&&rel.has('noreferrer'),'rel에 noopener와 noreferrer가 함께 있어야 한다');
    assertGoesToReview(link,GUIDE.label);
  }
  assert.deepEqual(opened,[],'링크를 그리기만 하고 열지 않는다');
});

test('6. 최종본에 안전한 주소가 하나도 없으면 쓸 수 있는 시안으로 돌아가고, javascript: 같은 주소는 href · src에 들어가지 않는다',()=>{
  for(const stage of STAGES){
    const view=room(stage,[PREVIEW,...UNSAFE]);
    assert.equal(roomState(view.p),'deliver');
    assert.deepEqual(view.videos.map(v=>v.src),[here(PREVIEW.media.url)],'쓸 수 있는 시안 영상으로 돌아간다');
    assert.equal(view.videos[0]['aria-label'],PREVIEW.label);
    assert.deepEqual(view.images,[]);
    assertGoesToReview(view,PREVIEW.label);
    for(const url of urlAttrs(view.html)){
      assert.doesNotMatch(url,/^\s*(?:javascript|vbscript):/i,'위험한 주소가 href · src에 들어갔다: '+url);
      for(const bad of PLANTED)assert.ok(!url.includes(bad),'안전하지 않은 자료 주소가 화면에 들어갔다: '+url);
    }
  }
});

test('7. 큰 미리 보기의 이동은 roomTab이 받는 review이고, 없는 deliver 이동은 없다',()=>{
  const sets=[[[PREVIEW,FINAL_FILM,GUIDE],FINAL_FILM],[[FILM_OLD,FILM_NEW,GUIDE],FILM_NEW],[[FINAL_FILM],FINAL_FILM]];
  for(const stage of STAGES)for(const [versions,shown] of sets){
    const view=room(stage,versions);
    assert.deepEqual(view.videos.map(v=>v.src),[here(shown.media.url)]);
    assertGoesToReview(view,shown.label);
  }
});

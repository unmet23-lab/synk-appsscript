import { emptyAlbum,newId,validateAlbum,parseAlbum,serializeAlbum,upsertPage,nextQuestion as nextDetailQuestion,QUESTIONS,RECIPE_QUESTIONS,emptyRecipe,recipeStatus,addRecipeAttempt,selectAlbumPages,LIMITS,EXPORT_NAME,STORYTELLER_RELATIONS,setStoryteller,skipQuestion,unskipQuestion } from './model.mjs';
import { TOPICS,nextQuestion as nextBankQuestion,questionById,topicById,topicQuestions,topicMap,fillQuestion,voiceOnlyStory } from './questions.mjs';
import { timeline,peopleIndex } from './timeline.mjs';
import { createStorage } from './storage.mjs';
import { createFormDrafts } from './form-drafts.mjs';
import { buildAlbumArchive,renderAlbumBookContent } from './takehome.mjs';
import { createMediaOperations,createImportOperations,cancelImportIfIdle } from './operations.mjs';
import { readMedia,decodeMedia,mediaBlob } from './media.mjs';
import { createAccountNotebook } from '/synk-account/src/account-notebook.mjs';
import { FAMILY_MANIFEST_FORMAT } from '/synk-account/src/personal-data.mjs';
import { createFamilyAccountMedia } from './account-media.mjs';
import { initTheme,cycleTheme,THEME_LABEL,esc,keepDots,poster,secHead,icon,createSheet,dayLabel } from '/member-signal/signal.mjs';
const dateText=d=>d?dayLabel(d,{weekday:false,today:''}):'날짜 미정';

// 가족 이야기 앨범(2026-10-14 시그널 판). 저장·가져오기·녹음·계정 수첩의 보호 규칙은 이전 판과 같다.
const mediaOperations=createMediaOperations(),importOperations=createImportOperations(),formDrafts=createFormDrafts();
let draftDirty=false,importSaving=false,renderedHash=location.hash,renderVersion=0;
const $=s=>document.querySelector(s);
const storage=createStorage();
let album=emptyAlbum(),persistent=false,draft=null,selected=null,imported=null,undo=null,busy=false,mediaBusy=0,recorder=null,recordStream=null,recordTimer=null,recordCancelled=false,noticeTimer=null;
let galleryQuery='',gallerySort='recent',homeView='stories',questionExclude=[],tellerEditing=false;
const native=Boolean(window.synkProduct);
let notebook,guestPersistent=false,accountVersion=0,recordingVersion=0;const accountMedia=createFamilyAccountMedia();
const audioURLs=new Set();
function audioURL(media){const url=URL.createObjectURL(mediaBlob(media));audioURLs.add(url);return url;}
function releaseAudio(){for(const url of audioURLs)URL.revokeObjectURL(url);audioURLs.clear();}
const stamp=()=>new Date().toISOString();
const factQuestions=[...QUESTIONS,...RECIPE_QUESTIONS];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const engine=()=>({ask:globalThis.SynkAsk,domain:globalThis.SynkAtlasDomain});
const teller=()=>album.storyteller||null;
const callName=()=>{const t=teller();if(!t)return '가족';if(t.callName)return t.callName;if(t.relation==='self')return '나';const known=STORYTELLER_RELATIONS.find(r=>r.id===t.relation);return known?.callName||t.name;};
const canRecord=()=>!native&&!!navigator.mediaDevices?.getUserMedia&&!!globalThis.MediaRecorder;
initTheme();
const sheet=createSheet($('#account-sheet'));
const LARGE_KEY='synk.album.large';
function applyLarge(on){document.body.classList.toggle('large',on);$('[data-ui="large"]')?.setAttribute('aria-pressed',String(on));}
try{applyLarge(localStorage.getItem(LARGE_KEY)==='1');}catch{applyLarge(false);}

function message(text,{error=false,undoable=false}={}){clearTimeout(noticeTimer);$('#notice').setAttribute('role',error?'alert':'status');$('#notice').classList.toggle('error',error);$('#notice').innerHTML=`${esc(text)}${undoable?' <button class="linkbtn" id="undo-action" type="button">되돌리기</button>':''}`;if(!undoable&&!error)noticeTimer=setTimeout(()=>{$('#notice').textContent='';},7000);}
function cancelImport(){importOperations.invalidate();imported=null;$('#import-dialog').close();}
function requestImportCancel(event){if(!cancelImportIfIdle({saving:importSaving,event,cancel:cancelImport}))message('앨범을 저장하고 있어요. 완료될 때까지 잠시 기다려 주세요.');}
function setImportSaving(value){importSaving=value;$('#cancel-import').disabled=value;$('#import-dialog').setAttribute('aria-busy',String(value));$('#import-progress').textContent=value?'앨범을 저장하고 있어요. 완료될 때까지 잠시 기다려 주세요.':'';}
const detailFormIds=['question-form','attempt-form','contribution-form'];
function hasUnsaved(){return draftDirty||formDrafts.has(renderedHash);}
function confirmDiscard({preserve=false}={}){if(hasUnsaved()&&!window.confirm('작성 중인 내용을 닫고 이동할까요? 저장하지 않은 내용은 사라져요.'))return false;if(!preserve){draftDirty=false;formDrafts.clear(renderedHash);}return true;}
function captureFormDraft(form){const fields=[...form.querySelectorAll('input,textarea,select')],values={},defaults={};for(const field of fields){const key=field.id||field.name;if(!key)continue;values[key]=field.value;defaults[key]=field.defaultValue??'';}formDrafts.capture(renderedHash,form.id,values,defaults);}
function restoreFormDrafts(){for(const id of detailFormIds){const form=document.getElementById(id),values=formDrafts.read(renderedHash,id);if(!form||!values)continue;for(const field of form.querySelectorAll('input,textarea,select')){const key=field.id||field.name;if(Object.hasOwn(values,key))field.value=values[key];}}}
function go(hash,{saved=false}={}){if(!saved&&!confirmDiscard())return false;if(saved){draftDirty=false;formDrafts.clear(renderedHash);}cancelImport();if(location.hash===hash)render();else location.hash=hash;return true;}
async function commit(next){
  const valid=validateAlbum(next),owner=accountVersion;
  if(notebook?.active){if(!notebook.canEdit)throw new Error('계정 연결을 확인한 뒤 앨범을 다시 불러와 주세요.');album=valid;void notebook.change(valid);return;}
  let completed=false;
  try{if(persistent)await storage.save(valid);completed=true;}catch(error){if(owner===accountVersion)throw error;}
  if(owner!==accountVersion){
    // A successful guest write still owns the device album. Keep it out of the
    // current account, but restore it instead of the older login-time snapshot.
    if(completed){
      if(notebook?.active)notebook.updateGuestState(valid);
      else{album=valid;if(!draft&&!hasUnsaved()&&!imported&&!mediaBusy)render();}
    }
    throw Object.assign(new Error('계정이 바뀌어 이전 기기 저장 작업의 화면 이동을 멈췄어요.'),{code:'ACCOUNT_CHANGED'});
  }
  album=valid;
}
function stopRecording(discard=false){if(discard)recordingVersion++;recordCancelled=discard;clearInterval(recordTimer);recordTimer=null;if(recorder?.state==='recording')recorder.stop();recordStream?.getTracks().forEach(track=>track.stop());recordStream=null;}
function storageSummary(){return notebook?.active?'사진·원음·이야기는 로그인한 계정에 보관해요. 위 계정 단추에서 저장 상태를 확인할 수 있어요.':persistent?'이 브라우저의 기기에 보관돼요. 계정으로 옮기기는 계정 단추에서 직접 고를 수 있어요.':'지금은 이 탭에서만 보관해요. 새로고침하거나 닫으면 사라져요.';}
function editorNote(){return notebook?.active?'남기면 계정 저장을 시작해요. 위 계정 단추에서 저장 완료 여부를 확인할 수 있어요.':persistent?'이 기기에 보관해요.':'남긴 한 장은 이번 탭에 남아요. 기기에 계속 보관하려면 앨범의 보관 설정을 켜 주세요.';}
function refreshDeviceStorageSetting(){const input=$('#persist'),summary=$('.storage > div > p'),note=$('#story-form > .helper');if(input)input.setAttribute('aria-checked',String(persistent));if(summary)summary.textContent=storageSummary();if(note)note.textContent=editorNote();}
function storageView(){return `<section class="sec storage" aria-label="내 앨범 보관"><div>${notebook?.active?'':`<button id="persist" class="switch" type="button" role="switch" aria-checked="${persistent}"><span class="track"></span><span>이 기기에 보관</span></button>`}<p class="small muted">${storageSummary()}</p></div><div class="actions"><button class="btn small soft" data-action="takehome" ${album.pages.length?'':'disabled'}>${icon('book')} 소장본 만들기</button><button class="btn small soft" data-action="export" ${album.pages.length?'':'disabled'}>${icon('download')} 파일로 내보내기</button><label class="btn small soft file" for="import-file">${icon('upload')} 앨범 불러오기<input class="sr" id="import-file" type="file" accept=".json,application/json"></label></div></section>`;}

// ── 처음 화면 ─────────────────────────────────────────
const RELATION_LABEL=Object.fromEntries(STORYTELLER_RELATIONS.map(r=>[r.id,r.label]));
function tellerForm(){
  const t=teller()||{name:'',relation:'mother',callName:'',birthYear:null,hometown:''};
  return `<form id="teller-form" class="card teller"><div class="card-top"><span class="eyebrow">누구의 이야기를 남길까요?</span>${teller()?'<button class="linkbtn" type="button" data-action="teller-cancel">닫기</button>':''}</div>
    <fieldset><legend>그분은 나에게</legend><div class="chips">${STORYTELLER_RELATIONS.map(r=>`<label class="chip"><input class="sr" type="radio" name="relation" value="${r.id}" ${t.relation===r.id?'checked':''}>${esc(r.label)}</label>`).join('')}</div></fieldset>
    <div class="field-row"><div class="field"><label for="teller-name">이름 <span class="opt-note">가족이 부르는 이름도 좋아요</span></label><input id="teller-name" name="name" maxlength="30" required value="${esc(t.name)}" placeholder="예: 김순자, 우리 엄마"></div>
    <div class="field"><label for="teller-call">질문에서 부를 호칭 <span class="opt-note">선택</span></label><input id="teller-call" name="callName" maxlength="20" value="${esc(t.callName)}" placeholder="예: 어머니, 엄마"></div></div>
    <div class="field-row"><div class="field"><label for="teller-year">태어난 해 <span class="opt-note">선택 · 시대에 맞는 질문을 골라요</span></label><input id="teller-year" name="birthYear" inputmode="numeric" maxlength="4" pattern="\\d{4}" value="${esc(t.birthYear??'')}" placeholder="예: 1952"></div>
    <div class="field"><label for="teller-home">고향 <span class="opt-note">선택</span></label><input id="teller-home" name="hometown" maxlength="40" value="${esc(t.hometown)}" placeholder="예: 전남 순천"></div></div>
    <div class="actions"><button class="btn primary" type="submit">${teller()?'이대로 바꾸기':'이 분의 이야기로 시작'}</button></div><p id="form-error" class="error-text" role="alert"></p></form>`;
}
function questionCard(){
  const q=nextBankQuestion({album,exclude:questionExclude});
  if(!q)return `<div class="card ask-card done"><span class="eyebrow">오늘의 질문</span><h2 class="ask-q">준비한 질문에 모두 답했거나 넘겼어요.</h2><p class="muted">질문 탭에서 넘긴 질문을 다시 열거나, 자유롭게 이야기를 남길 수 있어요.</p><div class="actions"><button class="btn soft" data-action="new">자유롭게 남기기</button>${questionExclude.length?'<button class="btn ghost" data-action="question-reset">다른 질문 다시 보기</button>':''}</div></div>`;
  return `<article class="card ask-card" aria-labelledby="ask-title"><div class="card-top"><span class="eyebrow">오늘의 질문 · ${esc(q.topicLabel)}</span>${q.sensitive?`<span class="led-chip plain check">${esc(q.skipHint)}</span>`:''}</div>
    <h2 id="ask-title" class="ask-q">${keepDots(q.text)}</h2>
    ${q.followups.length?`<p class="small muted">이어서 물어볼 만한 것: ${q.followups.slice(0,2).map(esc).join(' · ')}</p>`:''}
    <div class="actions"><button class="btn primary" data-action="ask" data-question="${q.id}">${icon('mic')} ${canRecord()?'말로 답하기':'답 남기기'}</button><button class="btn soft" data-action="other-question" data-question="${q.id}">다른 질문</button><button class="btn ghost" data-action="skip-bank" data-question="${q.id}">이 질문 넘기기</button></div>
    <p class="small muted">${esc(callName())}의 목소리를 그대로 남기고, 글은 나중에 다듬어도 돼요.</p></article>`;
}
function topicGrid(map){
  return `<div class="topics">${map.topics.filter(t=>t.available).map(t=>`<button class="topic" type="button" data-topic="${t.id}"><span class="t">${esc(t.label)}</span>${t.covered?`<span class="bar" aria-hidden="true"><i data-progress="${t.total?Math.round(t.covered/t.total*100):0}"></i></span>`:''}<span class="s num">${t.answered} / ${t.total}${t.complete?' · 다 채웠어요':''}</span></button>`).join('')}</div>`;
}
function galleryPages(pages){
  if(!pages.length)return '<div class="empty"><strong>검색어와 맞는 이야기가 없어요.</strong><p>다른 단어를 넣거나 검색·정렬을 초기화해 보세요.</p><button class="btn soft" type="button" data-action="gallery-reset">검색·정렬 초기화</button></div>';
  return `<div class="gallery" aria-label="앨범 페이지">${pages.map(p=>{const q=p.questionId?questionById(p.questionId):null;return `<button class="page-card" data-action="open" data-id="${p.id}" aria-label="${esc(p.title)} 열기">${p.photo?`<img class="cover" src="${p.photo.data}" alt="">`:`<span class="cover none" aria-hidden="true">${p.audio?icon('mic'):icon('book')}</span>`}<span class="card-body"><span class="meta">${p.recipe?'우리 집 손맛 · ':q?`${esc(topicById(q.topic)?.label||'')} · `:''}${esc(dateText(p.date))}</span><strong>${esc(p.title)}</strong><span class="excerpt">${esc(p.story)}</span><span class="meta">${p.audio?'목소리 · ':''}덧붙인 기억 ${p.contributions.length}</span></span></button>`;}).join('')}</div>`;
}
function galleryStatus(pages){return `전체 ${album.pages.length}장 중 ${pages.length}장${galleryQuery.trim()?' · 검색 결과':''}`;}
function refreshGallery(){
  const list=$('#gallery-results');if(!list)return;
  const pages=selectAlbumPages(album,{query:galleryQuery,sort:gallerySort});
  list.innerHTML=galleryPages(pages);$('#gallery-status').textContent=galleryStatus(pages);
  $('#gallery-reset').disabled=!galleryQuery&&gallerySort==='recent';
}
function storiesBlock(){
  const pages=selectAlbumPages(album,{query:galleryQuery,sort:gallerySort});
  return `<div class="gallery-tools" aria-label="이야기 찾기"><div class="field"><label for="gallery-search">이야기 찾기</label><input id="gallery-search" type="search" maxlength="200" value="${esc(galleryQuery)}" placeholder="제목, 사람, 기억나는 단어" aria-describedby="gallery-status" autocomplete="off"></div><div class="field"><label for="gallery-sort">보는 순서</label><select id="gallery-sort"><option value="recent" ${gallerySort==='recent'?'selected':''}>최근 기록·수정순</option><option value="date-desc" ${gallerySort==='date-desc'?'selected':''}>그날 날짜 · 최근부터</option><option value="date-asc" ${gallerySort==='date-asc'?'selected':''}>그날 날짜 · 오래된 순</option></select></div><button class="btn small ghost" type="button" id="gallery-reset" data-action="gallery-reset" ${!galleryQuery&&gallerySort==='recent'?'disabled':''}>초기화</button></div><p id="gallery-status" class="small muted" role="status" aria-live="polite">${galleryStatus(pages)}</p><div id="gallery-results">${galleryPages(pages)}</div>`;
}
function timelineBlock(){
  const t=timeline(album,undefined,{by:teller()?.birthYear?'age':'decade'});
  const row=e=>`<button class="tl-item" type="button" data-action="open" data-id="${e.id}"><span class="when num">${esc(e.date.slice(0,4))}${e.age!==null?` · ${e.age}살`:''}</span><span class="what">${esc(e.title)}</span><span class="icons">${e.hasPhoto?icon('image'):''}${e.hasAudio?icon('mic'):''}</span></button>`;
  return `${t.groups.length?`<ol class="tl">${t.groups.map(g=>`<li><div class="tl-head"><strong>${esc(g.label)}</strong>${g.ageLabel&&t.by==='decade'?`<span class="small muted">${esc(g.ageLabel)}</span>`:''}</div>${g.pages.map(row).join('')}</li>`).join('')}</ol>`:'<p class="muted">날짜를 적은 이야기가 아직 없어요. 이야기를 다듬을 때 그날의 날짜를 넣으면 시간 순서로 모여요.</p>'}${t.undated.length?`<div class="tl-undated"><span class="eyebrow">날짜 없는 이야기 ${t.undated.length}</span>${t.undated.map(e=>`<button class="linkbtn" type="button" data-action="open" data-id="${e.id}">${esc(e.title)}</button>`).join('')}</div>`:''}${!teller()?.birthYear?'<p class="hint">이야기 주인의 태어난 해를 넣으면 나이대로도 볼 수 있어요.</p>':''}`;
}
function peopleBlock(){
  const idx=peopleIndex(album);
  return idx.people.length?`<div class="people">${idx.people.map(p=>`<div class="card person"><div class="card-top"><strong>${esc(p.name)}</strong><span class="num muted small">${p.count}</span></div>${p.pages.map(e=>`<button class="linkbtn wrap" type="button" data-action="open" data-id="${e.id}">${esc(e.title)}${e.date?` <span class="muted small">${esc(e.date.slice(0,4))}</span>`:''}</button>`).join('')}</div>`).join('')}</div>`:'<p class="muted">「함께한 사람」을 적은 이야기가 아직 없어요.</p>';
}
function gallery(){
  const map=topicMap(album),voices=album.pages.filter(p=>p.audio).length,photos=album.pages.filter(p=>p.photo).length,t=teller();
  return `<section class="intro">
    <div class="copy"><p class="kicker">SYNK FOR YOU · FAMILY STORIES</p><h1 tabindex="-1">${t?`${esc(callName())}의 이야기를,`:'사진 밖의 이야기도,'}<br><span class="hl">${t?'목소리 그대로.':'우리의 앨범에.'}</span></h1>
      <p class="lead">하루에 질문 하나. 말로 답하면 목소리가 그대로 남고, 사진과 글을 더하면 한 권의 책이 돼요.</p>
      <ul class="meta"><li><small class="ko">남긴 이야기</small><span class="big">${album.pages.length}</span></li><li><small class="ko">목소리</small><span class="big">${voices}</span></li><li><small class="ko">사진</small><span class="big">${photos}</span></li><li><small class="ko">답한 질문</small><span class="big">${map.answered}<span class="small muted"> / ${map.total}</span></span></li></ul>
      ${t?`<p class="teller-line"><span class="dot"></span>${esc(t.name)} · ${esc(RELATION_LABEL[t.relation]||'')}${t.birthYear?` · ${t.birthYear}년생`:''}${t.hometown?` · ${esc(t.hometown)}`:''} <button class="linkbtn" type="button" data-action="teller-edit">바꾸기</button></p>`:''}</div>
    <div class="art">${poster({word:'앨범',label:'01 / FAMILY',chip:album.pages.length?`${album.pages.length}장`:'첫 장 전',art:'assets/art/camera.webp',alt:'코럴색 끈이 달린 검정 펠트 카메라'})}</div>
  </section>
  <section class="sec">${!t||tellerEditing?tellerForm():questionCard()}</section>
  ${t?`<section class="sec">${secHead(1,'주제 지도',`<button type="button" data-nav="#topics">질문 고르기</button>`)}${topicGrid(map)}</section>`:''}
  <section class="sec">${secHead(t?2:1,'우리의 이야기',album.pages.length?`<button type="button" data-action="new">자유롭게 남기기</button>`:'')}
    ${album.pages.length?`<div class="seg view-seg" role="group" aria-label="보는 방법">${[['stories','이야기'],['timeline','시간 순서'],['people','사람별']].map(([id,label])=>`<button type="button" data-home-view="${id}" aria-pressed="${homeView===id}">${label}</button>`).join('')}</div>${homeView==='timeline'?timelineBlock():homeView==='people'?peopleBlock():storiesBlock()}`:`<div class="empty"><img src="assets/art/frame.webp" alt="" width="120" height="96"><strong>짧은 기억 하나로 시작해도 좋아요.</strong><p>사진이나 목소리가 없어도 글부터 남길 수 있어요. 처음부터 완벽한 한 장일 필요는 없어요.</p><div class="actions center"><button class="btn soft" data-action="new">자유롭게 남기기</button><button class="btn ghost" data-action="sample">예시로 둘러보기</button></div></div>`}
  </section>
  <section class="sec recipe-entry card"><div><span class="eyebrow">우리 집 손맛</span><h3>엄마의 「대충」을 실제 양으로.</h3><p>가족에게 배운 음식과 내가 만들어 본 기록을 다음에 꺼내 쓸 레시피로 남겨요.</p></div><button class="btn soft" data-action="new-recipe">손맛 기록 시작</button></section>
  ${storageView()}`;
}

// ── 질문 고르기 ───────────────────────────────────────
function topicsPage(topicId){
  const map=topicMap(album),current=topicId&&topicById(topicId)?topicId:(map.topics.find(t=>t.available&&!t.complete)?.id||TOPICS[0].id);
  const list=topicQuestions({album,topic:current});
  const STATUS={answered:'답했어요',skipped:'넘겼어요',covered:'다른 질문에서 답했어요',open:''};
  return `<div class="split"><div class="main"><button class="linkbtn back" data-action="home">${icon('back')} 우리 앨범</button><p class="kicker">QUESTIONS · ${map.answered} / ${map.total}</p><h1 class="page-title" tabindex="-1">어떤 이야기를<br><span class="hl">들어 볼까요?</span></h1><p class="lead">주제를 고르고 마음이 가는 질문을 골라요. 같은 뜻의 질문은 한 번만 물어요.</p>
    <div class="chips topic-chips" role="group" aria-label="주제">${map.topics.filter(t=>t.available).map(t=>`<button class="chip" type="button" data-topic="${t.id}" aria-pressed="${t.id===current}">${esc(t.label)} <span class="num small">${t.answered}/${t.total}</span></button>`).join('')}</div>
    <ul class="rows qlist">${list.map(q=>`<li><div><span class="t">${keepDots(q.text)}</span>${STATUS[q.status]?`<span class="s">${STATUS[q.status]}</span>`:q.sensitive?`<span class="s">${esc(q.skipHint)}</span>`:''}</div><div class="row-actions">${q.status==='open'?`<button class="btn small soft" data-action="ask" data-question="${q.id}">답하기</button>`:q.status==='skipped'?`<button class="btn small ghost" data-action="unskip" data-question="${q.id}">다시 열기</button>`:q.status==='answered'?`<button class="btn small ghost" data-action="open-question" data-question="${q.id}">보기</button>`:''}</div></li>`).join('')}</ul></div>
    <aside class="side sticky-side">${poster({word:'질문',size:'low',label:`${esc(topicById(current)?.label||'')}`,art:'assets/art/question.webp',alt:'코럴색 펠트 물음표'})}<div class="card tip"><span class="eyebrow">이렇게 물어보세요</span><p>질문을 소리 내어 읽어 드리고, 끊지 말고 끝까지 들어 주세요. 대답이 짧아도 목소리가 남으면 충분해요.</p></div></aside></div>`;
}

// ── 쓰기 ─────────────────────────────────────────────
function mediaPreview(kind){const m=draft?.[kind];return m?`${kind==='photo'?`<img class="preview" src="${m.data}" alt="고른 사진 미리보기">`:`<audio controls preload="metadata" src="${audioURL(m)}" aria-label="담은 목소리 듣기"></audio>`}<p class="small muted media-name">${esc(m.name)}</p><button class="linkbtn danger" type="button" data-action="remove-media" data-kind="${kind}">${kind==='photo'?'사진':'목소리'} 빼기</button>`:`<p class="small muted">${kind==='photo'?'아직 고른 사진이 없어요.':'아직 담은 목소리가 없어요.'}</p>`;}
function recordBlock(big=false){return canRecord()?`<div class="record${big?' big':''}"><button class="mic" id="record-button" type="button" data-action="record">${icon('mic')}<span>${big?'눌러서 녹음 시작':'직접 녹음하기'}</span></button><p id="record-status" class="small" role="status"></p></div>`:native?'<p class="small muted">PC 앱에서는 녹음한 파일을 골라 주세요. 직접 녹음은 브라우저에서 할 수 있어요.</p>':'<p class="small muted">이 환경에서는 직접 녹음을 지원하지 않아요. 음성 파일을 골라 주세요.</p>';}
function editor(page,{recipe=false,question=null}={}){
  const t=teller();
  draft=page?structuredClone(page):{id:newId(),title:question?question.title:'',date:'',person:'',author:question&&t?t.name:'',story:'',photo:null,audio:null,details:{},skipped:[],contributions:[],createdAt:stamp(),updatedAt:stamp(),...(question?{questionId:question.id}:{}),...(recipe?{recipe:emptyRecipe()}:{})};
  const askText=question?fillQuestion(questionById(question.id)?.text||question.text,t):'';
  const heading=draft.recipe?(page?'우리 집 손맛 다듬기':'어떤 손맛을 남길까요?'):question?'':page?'이야기 다듬기':'어떤 순간을 남길까요?';
  return `<div class="editor"><button class="linkbtn back" data-action="cancel">${icon('back')} ${page?'이야기로':'앨범으로'}</button>
    ${question?`${poster({word:'목소리',size:'band',label:'YOUR VOICE',art:'./assets/art/mic.webp',alt:'크림색 펠트 마이크'})}<div class="ask-head"><p class="kicker"><b class="ko">${esc(question.topicLabel||topicById(question.topic)?.label||'질문')}</b></p><h1 class="ask-q big" tabindex="-1">${keepDots(askText)}</h1>${question.followups?.length?`<ul class="followups">${question.followups.slice(0,3).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}<p class="small muted">질문을 소리 내어 읽어 드리고, 대답을 그대로 녹음해요. 글은 나중에 받아 적어도 돼요.</p></div>`:`<div class="editor-head"><p class="kicker">ONE MOMENT, MANY MEMORIES</p><h1 class="page-title" tabindex="-1">${heading}</h1><p class="lead">${draft.recipe?'배운 재료와 순서를 그대로 적고, 직접 만들어 보며 다듬어요.':'제목과 기억, 기록하는 이름만 적으면 첫 장이 완성돼요.'}</p></div>`}
    <form id="story-form">
      ${question?`<section class="card voice-first"><span class="eyebrow">${esc(callName())}의 목소리</span>${recordBlock(true)}<div id="audio-preview">${mediaPreview('audio')}</div><details class="file-alt"><summary>녹음 파일 고르기</summary><input id="audio-file" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,.mp3,.wav,.m4a,.ogg,.webm"><p class="small muted">MP3 · WAV · M4A · OGG · WebM, 8 MB까지</p></details></section>`:''}
      <div class="field-row"><div class="field"><label for="title">${draft.recipe?'음식 이름':'이야기 제목'}</label><input id="title" name="title" type="text" maxlength="100" required value="${esc(draft.title)}" placeholder="예: 할머니와 함께 빚은 첫 송편"></div><div class="field"><label for="date">그날의 날짜 <span class="opt-note">선택</span></label><input id="date" name="date" type="date" value="${esc(draft.date)}"></div></div>
      <div class="field"><label for="story">${draft.recipe?'이 음식에 얽힌 이야기':question?'들은 이야기 <span class="opt-note">목소리만 남겨도 돼요</span>':'남기고 싶은 이야기'}</label><textarea id="story" name="story" rows="6" maxlength="10000" ${question?'':'required'} placeholder="${question?'기억나는 말 그대로 받아 적어 주세요. 다듬지 않아도 괜찮아요.':'사진에는 보이지 않지만 기억나는 일이 있나요?'}">${esc(draft.story===voiceOnlyStory(question?.id||'',t)?'':draft.story)}</textarea></div>
      <div class="field-row"><div class="field"><label for="person">함께한 사람 <span class="opt-note">선택 · 쉼표로 나눠요</span></label><input id="person" name="person" type="text" maxlength="100" value="${esc(draft.person)}" placeholder="예: 할머니, 나, 동생"></div><div class="field"><label for="author">${question?'이야기한 분':'기록하는 이름'}</label><input id="author" name="author" type="text" maxlength="60" required value="${esc(draft.author)}" placeholder="가족이 부르는 이름도 좋아요"></div></div>
      ${draft.recipe?recipeFields(draft.recipe):''}
      <div class="grid two media-editor"><section class="card media-box"><span class="eyebrow">그날의 사진 <span class="opt-note">선택</span></span><p class="small muted">JPG · PNG · WebP, 한 장 6 MB까지</p><label class="btn small soft file" for="photo-file">${icon('image')} 사진 고르기<input class="sr" id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"></label><div id="photo-preview">${mediaPreview('photo')}</div></section>
      ${question?'':`<section class="card media-box"><span class="eyebrow">그 사람의 목소리 <span class="opt-note">선택</span></span><p class="small muted">원래 목소리 그대로. MP3 · WAV · M4A · OGG · WebM, 8 MB까지</p><label class="btn small soft file" for="audio-file">${icon('upload')} 음성 파일 고르기<input class="sr" id="audio-file" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,.mp3,.wav,.m4a,.ogg,.webm"></label>${recordBlock()}<div id="audio-preview">${mediaPreview('audio')}</div></section>`}</div>
      ${Object.keys(draft.details).length?`<details class="more"><summary>질문에 남긴 답도 고치기</summary>${factQuestions.filter(q=>draft.details[q.id]).map(q=>`<div class="field"><label for="detail-${q.id}">${q.label}</label><textarea id="detail-${q.id}" name="detail-${q.id}" rows="2" maxlength="1000">${esc(draft.details[q.id])}</textarea></div>`).join('')}</details>`:''}
      <p id="form-error" class="error-text" role="alert"></p>
      <div class="actions"><button class="btn primary" type="submit">${draft.recipe?(page?'고친 레시피 저장':'손맛 한 장 남기기'):question?'이 답을 앨범에 남기기':(page?'고친 이야기 저장':'앨범에 한 장 남기기')}</button><button class="btn soft" type="button" data-action="cancel">취소</button></div>
      <p class="helper small muted">${editorNote()}</p>
    </form></div>`;
}
function recipeFields(recipe){return `<fieldset class="card recipe-fields"><legend class="eyebrow">우리 집에서 배운 그대로</legend><p class="small muted">양이 정확하지 않아도 들은 표현 그대로 남겨 주세요. 직접 확인한 뒤 고칠 수 있어요.</p><div class="field-row"><div class="field"><label for="recipe-source">누구에게, 어디서 배웠나요?</label><input id="recipe-source" name="recipe-source" type="text" maxlength="120" required value="${esc(recipe.learnedFrom)}" placeholder="예: 엄마에게 들은 설명 · 할머니 수첩"></div><div class="field"><label for="recipe-servings">몇 사람 몫인가요? <span class="opt-note">선택</span></label><input id="recipe-servings" name="recipe-servings" type="text" maxlength="120" value="${esc(recipe.servings)}" placeholder="예: 두 사람이 먹을 만큼"></div></div><div class="field"><label for="recipe-ingredients">재료와 양</label><textarea id="recipe-ingredients" name="recipe-ingredients" rows="5" maxlength="6000" required placeholder="한 줄에 하나씩 적으면 꺼내 보기 좋아요.">${esc(recipe.ingredients)}</textarea></div><div class="field"><label for="recipe-steps">만드는 순서</label><textarea id="recipe-steps" name="recipe-steps" rows="7" maxlength="10000" required placeholder="배운 순서, 불 세기, 시간을 기억나는 만큼 적어 주세요.">${esc(recipe.steps)}</textarea></div><p class="small muted">적지 않은 양과 조리 시간은 저절로 채우지 않아요.</p></fieldset>`;}
function recipeDetail(p){const r=p.recipe,status=recipeStatus(p);return `<section class="sec recipe-sheet" aria-label="우리 집 레시피">${secHead(1,'다음에도 꺼내 쓸 레시피',`<span class="small">${esc(status.label)}${status.revised?' · 마지막 기록 뒤 고쳤어요':''}</span>`)}<p class="small muted">배운 곳: ${esc(r.learnedFrom)}${r.servings?` · ${esc(r.servings)}`:''}</p><div class="grid two"><div class="card"><span class="eyebrow">재료와 양</span><p class="prose">${esc(r.ingredients)}</p></div><div class="card"><span class="eyebrow">만드는 순서</span><p class="prose">${esc(r.steps)}</p></div></div><button class="linkbtn" data-action="edit" data-id="${p.id}">직접 확인한 내용으로 고치기</button></section><section class="sec recipe-attempts">${secHead(2,'내가 만들어 본 날',`<span class="num">${r.attempts.length}번</span>`)}${r.attempts.map(a=>`<article class="memory-item"><div class="memory-head"><span class="small muted">${a.date}</span><button class="linkbtn danger" data-action="delete-attempt" data-id="${a.id}" aria-label="${a.date} 만들어 본 기록 삭제">삭제</button></div><p class="prose">${esc(a.note)}</p></article>`).join('')}${r.attempts.length<LIMITS.attempts?`<form id="attempt-form" class="memory-form card"><div class="field-row"><div class="field"><label for="attempt-date">만들어 본 날짜</label><input id="attempt-date" name="date" type="date" required value="${today()}"></div></div><div class="field"><label for="attempt-note">해 보니 어땠나요?</label><textarea id="attempt-note" name="note" rows="3" maxlength="2000" required placeholder="예: 우리 냄비에서는 5분 더 걸렸다. 다음엔 간장을 반 숟가락 줄여 보기."></textarea></div><button class="btn soft" type="submit">만들어 본 기록 남기기</button></form>`:'<p class="small muted">만들어 본 기록은 한 레시피에 20번까지 남길 수 있어요.</p>'}</section>`;}

// ── 소장본 ───────────────────────────────────────────
function takehome(){
  if(!album.pages.length)return `<div class="split"><div class="main"><button class="linkbtn back" data-action="home">${icon('back')} 우리 앨범</button><p class="kicker">YOURS TO KEEP</p><h1 class="page-title" tabindex="-1">첫 장부터<br><span class="hl">남겨 주세요.</span></h1><p class="lead">이야기나 손맛 기록을 남기면 우리 가족 소장본을 만들 수 있어요.</p><button class="btn primary" data-action="home">오늘의 질문 보기</button></div><aside class="side">${poster({word:'한 권',size:'low',art:'assets/art/book.webp',alt:'펼친 코럴색 펠트 책'})}</aside></div>`;
  const photos=album.pages.filter(p=>p.photo).length,voices=album.pages.filter(p=>p.audio).length;
  return `<div class="takehome-shell"><div class="takehome-toolbar"><button class="linkbtn back" data-action="home">${icon('back')} 우리 앨범</button><div class="month-head"><div><p class="kicker">YOURS TO KEEP</p><h1 class="page-title" tabindex="-1">우리 가족의 한 권을,<br><span class="hl">내 손에.</span></h1><ul class="meta" data-cols="3"><li><small class="ko">이야기</small><span class="big">${album.pages.length}</span></li><li><small class="ko">사진</small><span class="big">${photos}</span></li><li><small class="ko">목소리</small><span class="big">${voices}</span></li></ul><div class="actions"><button class="btn primary" data-action="archive">${icon('download')} 소장용 묶음 내려받기</button><button class="btn soft" data-action="print-book">${icon('print')} 인쇄 · PDF</button></div><p class="small muted">ZIP을 풀고 index.html을 열면 인터넷 없이 읽고 들을 수 있어요. 종이에는 목소리가 나오지 않으니 원음 파일도 함께 보관해 주세요.</p></div>${poster({word:'한 권',size:'low',label:'TAKE HOME',art:'assets/art/book.webp',alt:'펼친 코럴색 펠트 책'})}</div></div><div id="takehome-content" class="paper">${renderAlbumBookContent(album,{mediaMode:'embedded',mediaUrl:(media,kind)=>kind==='audio'?audioURL(media):media.data})}</div><div class="takehome-toolbar">${storageView()}</div></div>`;
}

// ── 한 장 ────────────────────────────────────────────
function detail(p){
  const q=nextDetailQuestion(p,engine()),bank=p.questionId?questionById(p.questionId):null,t=teller();
  const voiceOnly=bank&&p.story===voiceOnlyStory(bank.id,t);
  return `<div class="detail"><button class="linkbtn back" data-action="home">${icon('back')} 우리 앨범</button>
  <article class="page-spread">
    <div class="spread-photo">${p.photo?`<img class="print-photo" src="${p.photo.data}" alt="${esc(p.title)}">`:`<div class="print-photo none">${poster({word:p.recipe?'손맛':'기억',size:'low',art:p.audio?'assets/art/mic.webp':'assets/art/frame.webp',alt:''})}</div>`}
      ${p.audio?`<section class="card voice"><span class="eyebrow">원래 목소리</span><audio controls preload="metadata" src="${audioURL(p.audio)}" aria-label="${esc(p.title)} 원음 듣기"></audio><p class="small muted">${esc(p.audio.name)} · 원음 그대로 보관해요</p></section>`:`<p class="small muted voice-hint">기억나는 목소리도 남기고 싶다면 이야기 고치기에서 더할 수 있어요.</p>`}</div>
    <div class="spread-copy"><p class="kicker">${p.recipe?'OUR FAMILY RECIPE':bank&&topicById(bank.topic)?.label?`<b class="ko">${esc(topicById(bank.topic).label)}</b>`:'OUR FAMILY STORY'}</p>
      ${bank?`<p class="asked">「${keepDots(fillQuestion(bank.text,t))}」</p>`:''}
      <h1 class="page-title" tabindex="-1">${esc(p.title)}</h1>
      <p class="small muted">${esc(dateText(p.date))} · ${esc(p.person||'우리 가족')} · 기록 ${esc(p.author)}</p>
      ${voiceOnly?`<div class="notice-box"><span class="lbl">목소리로 남긴 이야기</span><strong>들은 말을 글로 받아 적어 두면 책에도 실려요.</strong><button class="btn small soft" data-action="edit" data-id="${p.id}">받아 적기</button></div>`:`<p class="prose">${esc(p.story)}</p>`}
      ${Object.keys(p.details).length?`<dl class="facts">${factQuestions.filter(f=>p.details[f.id]).map(f=>`<div><dt>${f.label}</dt><dd>${esc(p.details[f.id])}</dd></div>`).join('')}</dl>`:''}
      <div class="actions"><button class="btn small soft" data-action="edit" data-id="${p.id}">${icon('edit')} 고치기</button><button class="btn small ghost danger" data-action="delete" data-id="${p.id}">이 장 삭제</button></div></div>
  </article>
  ${p.recipe?recipeDetail(p):''}
  <section class="sec">${secHead(p.recipe?3:1,p.recipe?'하나 더 남길 것':'하나 더 물어볼까요')}${q?`<div class="card ask-card small-ask"><p class="ask-q">${esc(q.text)}</p><p class="small muted">${q.basis?`${esc(q.basis)} · `:''}${p.recipe?'다음에 만들 때 도움이 되는, 아직 비어 있는 항목이에요.':'이 장에 아직 남기지 않은 기억을 물어요.'}</p><form id="question-form" data-question="${q.id}"><label class="sr" for="question-answer">질문에 대한 기억</label><textarea id="question-answer" class="input" rows="3" maxlength="1000" required placeholder="기억나는 만큼만 적어 주세요."></textarea><div class="actions"><button class="btn soft" type="submit">이 기억도 남기기</button><button class="btn ghost" type="button" data-action="skip-question" data-question="${q.id}">넘기기</button></div></form></div>`:'<p class="muted">이 장의 이야기가 한층 깊어졌어요. 남긴 답과 넘긴 질문은 다시 묻지 않아요.</p>'}<p class="hint">적어 주신 사람·제목과 아직 비어 있는 항목만 써요. 사진이나 목소리 내용을 저절로 해석하지 않아요.</p></section>
  <section class="sec">${secHead(p.recipe?4:2,'같은 날, 다른 기억',`<span class="num">${p.contributions.length}</span>`)}<p class="small muted">가족이 곁에서 직접 적거나, 전해 준 말을 출처와 함께 이 앨범에 남겨요.</p>${p.contributions.map(c=>`<article class="memory-item"><div class="memory-head"><span class="small muted">${esc(c.name)}의 기억 · ${c.createdAt.slice(0,10)}</span><button class="linkbtn danger" data-action="delete-contribution" data-id="${c.id}" aria-label="${esc(c.name)}의 기억 삭제">삭제</button></div><p class="prose">${esc(c.text)}</p></article>`).join('')}<form id="contribution-form" class="memory-form card"><div class="field"><label for="contribution-name">누구의 기억인가요?</label><input id="contribution-name" name="name" type="text" maxlength="60" required placeholder="예: 엄마 · 엄마에게 들은 이야기"></div><div class="field"><label for="contribution-text">덧붙일 기억</label><textarea id="contribution-text" name="text" rows="3" maxlength="2000" required placeholder="나는 그날을 이렇게 기억해요."></textarea></div><button class="btn soft" type="submit">기억 덧붙이기</button></form></section>
  ${storageView()}</div>`;
}

const NAV_OF=route=>route==='topics'?'#topics':route==='takehome'?'#takehome':'';
function render(){
  renderVersion++;renderedHash=location.hash;cancelImport();stopRecording(true);releaseAudio();mediaOperations.reset();draftDirty=false;draft=null;
  const hash=location.hash.slice(1),[route,id]=hash.split('/');selected=album.pages.find(p=>p.id===id)||null;
  try{
    const ask=route==='ask'?questionById(id):null;
    $('#main').innerHTML=route==='takehome'?takehome():route==='topics'?topicsPage(id):route==='ask'&&ask?editor(null,{question:{...ask,topicLabel:topicById(ask.topic)?.label}}):route==='new-recipe'?editor(null,{recipe:true}):route==='new'?editor(null):route==='edit'&&selected?editor(selected,{question:selected.questionId&&questionById(selected.questionId)?{...questionById(selected.questionId),topicLabel:topicById(questionById(selected.questionId).topic)?.label}:null}):route==='page'&&selected?detail(selected):gallery();
    if(route&&['page','edit'].includes(route)&&!selected)message('이 페이지가 없어요. 앨범에서 다시 골라 주세요.');
  }catch(e){$('#main').innerHTML=gallery();message(e.message,{error:true});}
  for(const bar of document.querySelectorAll('[data-progress]'))bar.style.setProperty('--p',`${bar.dataset.progress}%`);
  for(const meta of document.querySelectorAll('.meta[data-cols]'))meta.style.setProperty('--cols',meta.dataset.cols);
  const active=NAV_OF(route);for(const b of document.querySelectorAll('[data-nav]')){if(b.dataset.nav===active&&!['page','edit','ask','new','new-recipe'].includes(route))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  restoreFormDrafts();window.scrollTo(0,0);
  if(route)$('#main').querySelector('h1[tabindex]')?.focus({preventScroll:true});
}
async function saveForm(form){
  if(mediaBusy)throw new Error('파일을 읽고 있어요. 잠시 후 저장해 주세요.');if(recorder?.state==='recording')throw new Error('녹음을 마친 뒤 저장해 주세요.');
  const targetDraft=draft,view=renderVersion,data=new FormData(form);
  let story=String(data.get('story')||'').trim();
  if(!story&&draft.questionId){if(!draft.audio)throw new Error('목소리를 녹음하거나 들은 이야기를 적어 주세요.');story=voiceOnlyStory(draft.questionId,teller());}
  const page={...draft,title:data.get('title'),date:data.get('date'),person:data.get('person'),author:data.get('author'),story,updatedAt:stamp()};
  if(page.recipe){const fields={servings:data.get('recipe-servings'),learnedFrom:data.get('recipe-source'),ingredients:data.get('recipe-ingredients'),steps:data.get('recipe-steps')};const changed=Object.keys(fields).some(k=>String(fields[k]).trim()!==page.recipe[k]);page.recipe={...page.recipe,...fields,revisedAt:changed?page.updatedAt:page.recipe.revisedAt};}
  for(const q of factQuestions)if(data.has(`detail-${q.id}`)){const v=data.get(`detail-${q.id}`).trim();if(v)page.details[q.id]=v;else delete page.details[q.id];}
  await commit(upsertPage(album,page));
  if(draft!==targetDraft||renderVersion!==view){message('이야기를 저장했어요. 지금 열어 둔 화면은 그대로 두었어요.');return;}
  questionExclude=[];go(`#page/${page.id}`,{saved:true});
  message(notebook?.active?'앨범에 한 장 남겼어요. 계정 단추에서 저장 상태를 확인할 수 있어요.':persistent?'이야기를 이 기기에 보관했어요.':'앨범에 한 장 남겼어요. 지금은 이 탭에서만 보관해요.');
}
async function saveSelected(change,{formId}={}){if(!selected)throw new Error('페이지를 다시 열어 주세요.');const screen=location.hash,view=renderVersion,p=structuredClone(selected);change(p);p.updatedAt=stamp();await commit(upsertPage(album,p));if(renderVersion===view&&location.hash===screen){if(formId)formDrafts.clear(screen,formId);render();}}
async function sample(){const view=renderVersion,p={id:newId(),title:'할머니와 빚은 첫 송편',date:'2025-10-06',person:'할머니, 손주',author:'예시 가족',story:'처음 만든 송편이 자꾸 벌어졌다. 할머니는 손끝에 물을 살짝 묻혀 보라고 하셨다. 모양은 제각각이었지만, 쟁반이 가득 찼을 때 함께 웃었던 건 선명하다.\n\n이 이야기는 기능을 둘러보기 위한 가상의 예시예요.',photo:null,audio:null,details:{},skipped:[],contributions:[],createdAt:stamp(),updatedAt:stamp()};await commit(upsertPage(album,p));if(renderVersion===view)go(`#page/${p.id}`);message('가상의 예시 한 장을 추가했어요. 실제 가족의 기록은 아니에요.');}
function paintRecord(on,label){const button=$('#record-button');if(!button)return;button.classList.toggle('live',on);button.setAttribute('aria-pressed',String(on));button.querySelector('span').textContent=label;}
async function startRecording(){
  if(recorder?.state==='recording'){stopRecording();return;}
  if(native)throw new Error('PC 앱에서는 녹음 파일을 골라 주세요.');
  const targetDraft=draft,version=++recordingVersion,current=()=>version===recordingVersion&&draft===targetDraft;
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(error){if(current())throw error;return;}
  if(!current()||!$('#record-button')||!targetDraft){stream.getTracks().forEach(track=>track.stop());return;}
  recordStream=stream;recordCancelled=false;
  const candidates=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'],type=candidates.find(value=>MediaRecorder.isTypeSupported(value));
  if(!type){stopRecording(true);throw new Error('직접 녹음 형식을 지원하지 않아요. 음성 파일을 골라 주세요.');}
  const instance=new MediaRecorder(stream,{mimeType:type}),chunks=[];recorder=instance;let bytes=0,seconds=0,timer;
  instance.ondataavailable=event=>{if(!current())return;if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>LIMITS.audio){stopRecording(true);paintRecord(false,'다시 녹음하기');message('녹음이 8 MB를 넘어서 멈췄어요. 더 짧게 녹음해 주세요.',{error:true});}}};
  instance.onerror=()=>{if(!current())return;stopRecording(true);paintRecord(false,'다시 녹음하기');message('녹음을 마치지 못했어요. 음성 파일로 더할 수 있어요.',{error:true});};
  instance.onstop=async()=>{
    clearInterval(timer);stream.getTracks().forEach(track=>track.stop());
    if(recorder===instance){recordStream=null;recordTimer=null;}
    if(!current()||recordCancelled)return;
    paintRecord(false,'다시 녹음하기');if($('#record-status'))$('#record-status').textContent='';
    mediaBusy++;const operation=mediaOperations.begin('audio');
    try{
      const base=type.split(';')[0],file=new File(chunks,`가족의-목소리.${base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm'}`,{type:base}),media=await readMedia(file,'audio');
      if(!current()||!mediaOperations.current('audio',operation))return;
      draftDirty=true;draft.audio=media;if($('#audio-preview'))$('#audio-preview').innerHTML=mediaPreview('audio');message('목소리를 담았어요. 앨범에 남기면 함께 보관해요.');
    }catch(error){if(current()&&mediaOperations.current('audio',operation))message(error.message,{error:true});}finally{mediaBusy--;}
  };
  instance.start(1000);paintRecord(true,'녹음 마치기');$('#record-status').textContent='녹음 중 · 0초';
  timer=recordTimer=setInterval(()=>{if(!current())return;seconds++;if($('#record-status'))$('#record-status').textContent=`녹음 중 · ${seconds}초 / 최대 5분`;if(seconds>=300)stopRecording();},1000);
}

// ── 입력 ─────────────────────────────────────────────
document.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;const form=event.target;busy=true;form.inert=true;const button=form.querySelector('[type=submit]');if(button)button.disabled=true;try{
  if(form.id==='story-form')await saveForm(form);
  else if(form.id==='teller-form'){const data=new FormData(form),view=renderVersion;await commit(setStoryteller(album,{name:data.get('name'),relation:data.get('relation')||'other',callName:data.get('callName'),birthYear:data.get('birthYear'),hometown:data.get('hometown')}));tellerEditing=false;questionExclude=[];if(renderVersion===view)render();message('이야기 주인을 정했어요. 그분께 맞는 질문부터 골라 드릴게요.');}
  else if(form.id==='question-form'){const answer=$('#question-answer').value.trim();await saveSelected(p=>{p.details[form.dataset.question]=answer;},{formId:form.id});message('기억을 더했어요. 다음 질문도 이어서 볼 수 있어요.');}
  else if(form.id==='attempt-form'){const data=new FormData(form);await saveSelected(p=>{p.recipe=addRecipeAttempt(p,{id:newId(),date:data.get('date'),note:data.get('note'),createdAt:stamp()}).recipe;},{formId:form.id});message('직접 만들어 본 경험을 남겼어요. 재료나 순서도 확인한 내용으로 다듬을 수 있어요.');}
  else if(form.id==='contribution-form'){const data=new FormData(form);await saveSelected(p=>p.contributions.push({id:newId(),name:data.get('name'),text:data.get('text'),createdAt:stamp()}),{formId:form.id});message('가족의 기억을 함께 남겼어요.');}
}catch(e){if(e.code==='ACCOUNT_CHANGED')return;if($('#form-error'))$('#form-error').textContent=e.message;message(e.message,{error:true});}finally{busy=false;form.inert=false;if(button)button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.id==='gallery-search'){galleryQuery=event.target.value;refreshGallery();return;}const form=event.target.closest('form');if(form?.id==='story-form')draftDirty=true;else if(detailFormIds.includes(form?.id))captureFormDraft(form);});
document.addEventListener('click',async event=>{
  const bookLink=event.target.closest('.album-book a[href^="#story-"]');if(bookLink&&location.hash==='#takehome'){event.preventDefault();const section=document.getElementById(bookLink.getAttribute('href').slice(1));if(section){section.scrollIntoView({block:'start'});section.setAttribute('tabindex','-1');section.focus({preventScroll:true});}return;}
  if(event.target.closest('.skip')){event.preventDefault();$('#main').focus();$('#main').scrollIntoView();return;}
  const btn=event.target.closest('button');if(!btn)return;
  if(btn.dataset.nav!==undefined){event.preventDefault();go(btn.dataset.nav);return;}
  if(btn.dataset.ui==='theme'){const next=cycleTheme();paintTheme();message(`${THEME_LABEL[next]}으로 바꿨어요.`);return;}
  if(btn.dataset.ui==='large'){const on=!document.body.classList.contains('large');applyLarge(on);try{localStorage.setItem(LARGE_KEY,on?'1':'0');}catch{}return;}
  if(btn.dataset.ui==='account'){sheet.open(btn);return;}
  if(btn.dataset.homeView){homeView=btn.dataset.homeView;render();return;}
  if(btn.dataset.topic){go(`#topics/${btn.dataset.topic}`);return;}
  if(btn.id==='persist'){await togglePersist(btn);return;}
  if(btn.dataset.action==='gallery-reset'){if(!$('#gallery-search'))return;galleryQuery='';gallerySort='recent';$('#gallery-search').value='';$('#gallery-sort').value='recent';refreshGallery();$('#gallery-search').focus();return;}
  if(btn.id==='cancel-import'){requestImportCancel(event);return;}
  if(btn.id==='undo-action'&&undo){if(busy||!confirmDiscard())return;busy=true;const view=renderVersion;try{await commit(undo);undo=null;if(renderVersion===view)render();message('바로 전 상태로 되돌렸어요.');}catch(e){if(e.code!=='ACCOUNT_CHANGED')message(e.message,{error:true});}finally{busy=false;}return;}
  if(btn.id==='confirm-import'){if(busy||!imported||!importOperations.current(imported.operation,location.hash))return;if(hasUnsaved()&&!window.confirm('작성 중인 내용을 닫고 앨범을 불러올까요? 저장하지 않은 내용은 사라져요.'))return;const pending=imported;busy=true;btn.disabled=true;setImportSaving(true);try{if(!importOperations.current(pending.operation,location.hash))return;const before=album;await commit(pending.album);undo=before;if(!importOperations.current(pending.operation,location.hash)){message('앨범을 불러왔어요. 지금 작성 중인 내용은 그대로 두었어요.');return;}formDrafts.clearAll();go('',{saved:true});message('앨범을 불러왔어요.',{undoable:true});}catch(e){if(e.code!=='ACCOUNT_CHANGED')message(e.message,{error:true});}finally{setImportSaving(false);busy=false;btn.disabled=false;}return;}
  const action=btn.dataset.action;if(!action||busy)return;
  try{
    if(action==='new')go('#new');else if(action==='new-recipe')go('#new-recipe');else if(action==='takehome')go('#takehome');
    else if(action==='ask')go(`#ask/${btn.dataset.question}`);
    else if(action==='other-question'){questionExclude=[...questionExclude,btn.dataset.question];render();$('#ask-title')?.focus();}
    else if(action==='question-reset'){questionExclude=[];render();}
    else if(action==='skip-bank'){busy=true;const view=renderVersion;await commit(skipQuestion(album,btn.dataset.question));if(renderVersion===view)render();message('이 질문은 넘겼어요. 질문 탭에서 다시 열 수 있어요.');}
    else if(action==='unskip'){busy=true;const view=renderVersion;await commit(unskipQuestion(album,btn.dataset.question));if(renderVersion===view)render();}
    else if(action==='open-question'){const p=album.pages.find(page=>page.questionId===btn.dataset.question);if(p)go(`#page/${p.id}`);}
    else if(action==='teller-edit'){tellerEditing=true;render();$('#teller-name')?.focus();}
    else if(action==='teller-cancel'){tellerEditing=false;render();}
    else if(action==='archive'){if(location.hash!=='#takehome'||!album.pages.length)return;busy=true;btn.disabled=true;message('사진과 원음을 소장용 파일에 담고 있어요.');const snapshot=validateAlbum(album),result=await buildAlbumArchive(snapshot),blob=new Blob([result.bytes],{type:result.mime}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=result.filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);btn.disabled=false;message('소장용 묶음 내려받기를 시작했어요. ZIP을 풀고 index.html을 열어 주세요.');}
    else if(action==='print-book'){if(location.hash!=='#takehome'||!album.pages.length)return;await document.fonts.ready;if(location.hash!=='#takehome')return;window.print();}
    else if(action==='home')go('');else if(action==='cancel')go(selected?`#page/${selected.id}`:'');else if(action==='open')go(`#page/${btn.dataset.id}`);else if(action==='edit')go(`#edit/${btn.dataset.id}`);
    else if(action==='sample'){busy=true;await sample();}
    else if(action==='remove-media'){mediaOperations.invalidate(btn.dataset.kind);draftDirty=true;draft[btn.dataset.kind]=null;$(`#${btn.dataset.kind}-preview`).innerHTML=mediaPreview(btn.dataset.kind);const input=$(`#${btn.dataset.kind}-file`);if(input)input.value='';}
    else if(action==='record'){busy=true;await startRecording();}
    else if(action==='skip-question'){if(formDrafts.read(renderedHash,'question-form')&&!window.confirm('적고 있던 답을 지우고 이 질문을 넘길까요?'))return;busy=true;await saveSelected(p=>p.skipped.push(btn.dataset.question),{formId:'question-form'});message('이 장에서는 이 질문을 다시 묻지 않아요.');}
    else if(action==='delete'){if(!confirmDiscard())return;busy=true;const view=renderVersion,before=album;await commit({...album,pages:album.pages.filter(p=>p.id!==btn.dataset.id)});undo=before;if(renderVersion===view)go('');message('이 장을 삭제했어요.',{undoable:true});}
    else if(action==='delete-attempt'){busy=true;const before=album;await saveSelected(p=>{p.recipe.attempts=p.recipe.attempts.filter(a=>a.id!==btn.dataset.id);});undo=before;message('만들어 본 기록을 삭제했어요.',{undoable:true});}
    else if(action==='delete-contribution'){busy=true;const before=album;await saveSelected(p=>{p.contributions=p.contributions.filter(c=>c.id!==btn.dataset.id);});undo=before;message('덧붙인 기억을 삭제했어요.',{undoable:true});}
    else if(action==='export'){const blob=new Blob([serializeAlbum(album)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=EXPORT_NAME;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('사진과 원음을 포함한 앨범 파일 내려받기를 요청했어요.');}
  }catch(e){if(e.code==='ACCOUNT_CHANGED')return;message(e.name==='NotAllowedError'?'마이크 사용이 허용되지 않았어요. 음성 파일을 골라 더할 수 있어요.':e.message,{error:true});}finally{busy=false;if(btn?.dataset.action==='archive')btn.disabled=false;}
});
async function togglePersist(input){
  if(notebook?.active)return;if(busy)return;busy=true;input.disabled=true;const view=renderVersion,owner=accountVersion,next=!persistent;
  try{if(next)await storage.save(album);else await storage.remove();guestPersistent=next;if(!notebook?.active){persistent=next;if(renderVersion===view)render();else refreshDeviceStorageSetting();}if(owner===accountVersion)message(next?'이 기기 보관을 켰어요. 다음에 와도 앨범을 열 수 있어요.':'기기에 보관된 사본을 지웠어요. 열린 탭의 앨범은 그대로예요.');}
  catch(e){if(owner===accountVersion)message(e.message,{error:true});}finally{busy=false;input.disabled=false;}
}
document.addEventListener('change',async event=>{const input=event.target;
  if(input.id==='gallery-sort'){gallerySort=input.value;refreshGallery();return;}
  if(['photo-file','audio-file'].includes(input.id)){const file=input.files[0];if(!file)return;const kind=input.id.split('-')[0],targetDraft=draft,operation=mediaOperations.begin(kind);mediaBusy++;input.disabled=true;try{const media=await readMedia(file,kind);if(draft===targetDraft&&mediaOperations.current(kind,operation)){draftDirty=true;draft[kind]=media;$(`#${kind}-preview`).innerHTML=mediaPreview(kind);message(`${kind==='photo'?'사진을':'목소리를'} 담았어요. 앨범에 남기면 함께 보관해요.`);}}catch(e){if(draft===targetDraft&&mediaOperations.current(kind,operation))message(e.message,{error:true});}finally{mediaBusy--;input.disabled=false;input.value='';}return;}
  if(input.id==='import-file'){const file=input.files[0];if(!file)return;cancelImport();const operation=importOperations.begin(location.hash),current=()=>importOperations.current(operation,location.hash);try{if(file.size>LIMITS.export)throw new Error('불러올 파일은 32 MB 이하여야 해요.');const source=await file.text();if(!current())return;const next=parseAlbum(source);for(const p of next.pages){await decodeMedia(p.photo,'photo');if(!current())return;await decodeMedia(p.audio,'audio');if(!current())return;}if(!current())return;imported={album:next,operation};$('#import-description').textContent=`이야기 ${next.pages.length}장과 원래의 사진·목소리를 불러와요.`;$('#import-dialog').showModal();}catch(e){if(current())message(e.message,{error:true});}finally{input.value='';}}
});
$('#import-dialog').addEventListener('cancel',requestImportCancel);
window.addEventListener('hashchange',()=>{if(location.hash!==renderedHash&&!confirmDiscard()){history.replaceState(null,'',`${location.pathname}${location.search}${renderedHash}`);return;}render();});
window.addEventListener('beforeunload',event=>{if(hasUnsaved()){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',event=>{stopRecording(true);for(const audio of document.querySelectorAll('audio'))audio.pause();if(!event.persisted)releaseAudio();});

function paintTheme(){const button=$('[data-ui="theme"]'),theme=document.documentElement.dataset.theme||'night';button.innerHTML=icon(theme==='day'?'sun':theme==='system'?'monitor':'moon');button.setAttribute('aria-label',`화면 밝기: ${THEME_LABEL[theme]} (눌러서 바꾸기)`);}
function paintAccount(){const chip=$('[data-ui="account"]'),mount=$('#account-panel');if(!chip||!mount)return;const status=mount.querySelector('[data-notebook-status]')?.textContent?.trim()||'계정';const signedOut=!mount.querySelector('[data-notebook="signin"]')?.hidden;const state=/필요|확인해 주세요|골라 주세요|다시 불러와|실패/.test(status)?'alert':/중|불러오는|기다리고/.test(status)?'busy':notebook?.active?'ok':'';chip.dataset.state=state;chip.querySelector('span').textContent=notebook?.active?(state==='ok'?'계정에 저장 중':status):signedOut?'로그인':status;chip.setAttribute('aria-label',`SYNK ID: ${status}`);}
for(const slot of document.querySelectorAll('.tabbar [data-icon]'))slot.outerHTML=icon(slot.dataset.icon);
$('[data-sheet-close]').innerHTML=icon('close');
paintTheme();
try{const saved=await storage.load();if(saved){album=saved;persistent=true;}}catch(e){message(e.message,{error:true});}
render();document.documentElement.dataset.ready='true';
notebook=createAccountNotebook({resource:'family-album',mount:$('#account-panel'),content:$('#main'),description:'이야기·가족의 기억·사진·원래 목소리를 내 계정에 보관해요. 다른 사람에게 공개하거나 가족을 자동 초대하지 않아요.',getState:()=>album,emptyDocument:()=>({format:FAMILY_MANIFEST_FORMAT,version:1,pages:[]}),
  deleteLabel:'계정의 앨범 전체 삭제',
  pendingDescription:'앨범에 한 번도 저장되지 않은 업로드 원본만 7일 뒤 정리될 수 있어요. 정상 저장된 앨범 원본은 이 기한으로 삭제되지 않아요. 저장을 마치거나 파일로 내보내 따로 보관해 주세요.',
  prepareRetry:accountMedia.prepareRetry,
  onDocumentSaved:accountMedia.didSave,
  onDocumentRemoved:accountMedia.clear,
  onStatusChange:()=>paintAccount(),
  onMode:(active,{wasActive}={})=>{accountVersion++;stopRecording(true);mediaOperations.reset();importOperations.invalidate();accountMedia.clear();if(active){if(!wasActive)guestPersistent=persistent;persistent=false;}else persistent=guestPersistent;paintAccount();},
  beforeNavigate:()=>confirmDiscard({preserve:true}),
  toDocument:accountMedia.toDocument,
  fromDocument:accountMedia.fromDocument,
  applyState:value=>{album=validateAlbum(value);undo=null;galleryQuery='';gallerySort='recent';questionExclude=[];tellerEditing=false;formDrafts.clearAll();history.replaceState(null,'',location.pathname+location.search);render();},
});
void notebook.start();
paintAccount();
window.addEventListener('pagehide',event=>{if(event.persisted)notebook.suspend();else notebook.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)void notebook.resume();});

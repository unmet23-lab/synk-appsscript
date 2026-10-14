import {WARDROBE_ITEMS,wardrobeItem,outfitLabel,slotsForOutfit} from './wardrobe-catalog.mjs';
import {DraftHistory,normalizeEditState,normalizeWorkbenchState,createWorkbenchStorage,filterItems,randomSlots,FILTER_OPTIONS,thumbnailKey,wardrobeThumbnailCache} from './wardrobe-workbench.mjs';
import {createWardrobeAlbum} from './wardrobe-album.mjs';
import {createWardrobeThumbnailQueue} from './wardrobe-thumbnail-queue.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>JSON.stringify(normalizeEditState(a))===JSON.stringify(normalizeEditState(b));
const equalLooks=(a,b)=>JSON.stringify((a||[]).map(look=>({id:look.id,name:look.name,edit:normalizeEditState(look)})))===JSON.stringify((b||[]).map(look=>({id:look.id,name:look.name,edit:normalizeEditState(look)})));
// 24 격자 · 1.8 선(굵기는 wardrobe-studio.css). 홈 탭 막대와 같은 옷걸이·책 모양.
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${{hanger:'M12 7.6V7a2.2 2.2 0 1 1 2.2-2.2M12 7.6 3.6 13.4a1.6 1.6 0 0 0 .9 2.9h15a1.6 1.6 0 0 0 .9-2.9z',camera:'M4 8.7A1.7 1.7 0 0 1 5.7 7h2.1l1.5-2.2h5.4L16.2 7h2.1A1.7 1.7 0 0 1 20 8.7v8.8a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 17.5zM8.6 12.9a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0',book:'M12 6.5C10.2 5 7.6 4.6 4 5v13c3.6-.4 6.2 0 8 1.5 1.8-1.5 4.4-1.9 8-1.5V5c-3.6-.4-6.2 0-8 1.5zM12 6.5v13',turn:'M4.4 12.6c.9 3.1 3.9 5.4 7.6 5.4 3.4 0 6.2-1.9 7.3-4.6M19.6 11.4C18.7 8.3 15.7 6 12 6 8.6 6 5.8 7.9 4.7 10.6M2.9 9.2l1.8 1.6 1.6-1.9M21.1 14.8l-1.8-1.6-1.6 1.9',check:'m5 12.6 4.4 4.4L19 7.4',close:'m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4'}[name]||''}"/></svg>`;
const button=(action,label,extra='')=>`<button type="button" class="atelier-soft" data-studio="${action}" ${extra}>${label}</button>`;
const slotLabel=slot=>slot==='body'?'옷':'목도리';
const shortDate=value=>new Date(value).toLocaleDateString('ko-KR',{month:'long',day:'numeric',timeZone:'Asia/Seoul'});
const GRAPHICS_REVISION='costume-workbench-v7';
const catalogThumbnail=id=>new URL(`./assets/wardrobe-thumbnails-v8/${id}.png`,import.meta.url).href;
// 사진 배경 = 「배운 장소」. 무대의 빛(light)과 장소(background) 한 쌍을 견본 하나로 고른다(저장 값은 그대로).
const SCENES=[['fitting','피팅룸','daylight','room'],['hangang','한강 노을','sunset','room'],['cafe','카페','daylight','warm'],['town','우리 동네','daylight','garden'],['studio','사진관','studio','room']];
const POSES=[['neutral','편안하게'],['wave','손 인사'],['tilt','갸웃']];
// 효과음(리드 모듈): 옷을 입히면 select, 셔터는 tick. 단독 페이지처럼 모듈이 없으면 조용히 넘어간다.
let soundModule=null;
import(new URL('../brand-opening/world-sound.mjs',import.meta.url).href).then(module=>{soundModule=module;}).catch(()=>{});
const sound=name=>{try{soundModule?.play?.(name);}catch{}};
const giftLabel=item=>item?.gift&&item.gift!=='옷장 첫 선물'?item.gift:'레슨 보상';
let nextStudioId=0;
function installStyle(){if(document.getElementById('wardrobe-studio-style'))return;const link=document.createElement('link');link.id='wardrobe-studio-style';link.rel='stylesheet';link.href=new URL('./wardrobe-studio.css',import.meta.url).href;document.head.append(link);}

/** The renderer shows a local editing draft. Only explicit wear/save commands change the server. */
export function createWardrobeStudio({snapshot,onEquip=async()=>{},onSaveLooks=async()=>{},onRefresh=async()=>{},onRetry=async()=>{},onDiscard=async()=>{},onPlay=()=>{},preview=false,reducedMotion=false}={}){
  installStyle();
  const accountId=snapshot?.accountId||'preview',store=createWorkbenchStorage({accountId}),album=createWardrobeAlbum({accountId});
  let snap=snapshot,confirmed=normalizeEditState({slots:snapshot?.avatar?.slots,dyes:snapshot?.avatar?.dyes});
  const inventoryDates=value=>Object.fromEntries((value?.inventory||[]).map(item=>[item.itemId,item.acquiredAt??null]));
  let ws=store.reconcileInventory((snapshot?.inventory||[]).map(i=>i.itemId),{acquiredAt:inventoryDates(snapshot)});
  let draft=normalizeEditState(ws.draft||confirmed),history=new DraftHistory(draft),selected=wardrobeItem(draft.slots.body)||wardrobeItem(draft.slots.neck)||WARDROBE_ITEMS[0];
  let engine=null,stageAbort=null,disposed=false,generation=0,localBusy=false,serverBusy=false,pending=null,serverStatus='ready',comparing=false,editingLook='',message=ws.draft&&!equal(draft,confirmed)?'이 기기에 남은, 고르던 차림을 다시 불러왔어요. 「이 차림 입기」로 저장해요.':'',fault='',photo=null,lastPhotoSlots=null,albumRows=[],albumToken=0,undoLooks=null,undoPhoto=null,candidates=[],batchIds=new Set(),albumPage=12,saveTimer=0,gamepadFrame=0,gamepadLast=0;
  const thumbnails=new Map(),lookThumbs=new Map(),urls=new Map();
  let serverCompletion=null,lookFormVersion=0,missingEditingLook=false;
  const root=document.createElement('section');root.className='atelier';root.setAttribute('aria-label','몽글 옷장');const uid=`atelier-${++nextStudioId}`;
  root.innerHTML=`
    <div class="atelier-intro"><p>옷을 누르면 바로 입어 보고, 「이 차림 입기」로 저장해요.</p><span class="atelier-counter"></span></div>
    <div class="atelier-tabs" role="tablist" aria-label="옷장 화면">${[['fitting','옷 고르기','hanger'],['looks','저장한 차림','book'],['photo','사진','camera']].map(([id,label,glyph])=>`<button type="button" role="tab" id="${uid}-tab-${id}" aria-controls="${uid}-pane-${id}" aria-selected="false" tabindex="-1" data-studio-tab="${id}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div>
    <div class="atelier-layout"><div class="atelier-fitting">
      <div class="atelier-scene-wrap"><div class="atelier-scene" aria-busy="true"><div class="atelier-loading"><span>옷감과 빛을 준비하고 있어요</span></div></div><span class="atelier-scene-label">MONGLE / FITTING ROOM</span><span class="atelier-comparing" hidden>지금 입고 있는 차림</span>
        <div class="atelier-workbar" role="group" aria-label="차림 편집">${[['undo','되돌리기'],['redo','다시 하기'],['restore','입은 차림으로'],['random','아무거나 입기'],['add-candidate','비교 후보에 담기']].map(([action,label])=>button(action,`<span class="atelier-sr">${label}</span>`,`title="${label}" aria-label="${label}"`)).join('')}</div>
        <button type="button" class="atelier-compare" data-studio="compare" aria-pressed="false">입은 차림 보기</button></div>
      <div class="atelier-view-controls" role="group" aria-label="3D 시점"><button type="button" data-angle="0">정면</button><button type="button" data-angle="1.5707963267948966">옆</button><button type="button" data-angle="3.141592653589793">뒤</button><button type="button" data-studio="detail">옷감 가까이</button></div>
      <div class="atelier-camera-bar"><label>확대 <input type="range" min="0" max="1" step=".05" data-field="zoom" aria-label="캐릭터 확대"></label>${button('reset-view','기본 보기로')}</div>
      <p class="atelier-drag-hint">${icon('turn')}끌어서 돌리고, 휠이나 두 손가락으로 확대해요</p>
      <div class="atelier-selected"><p class="atelier-material"></p><h3></h3><p class="atelier-story"></p><p class="atelier-craft"></p></div><div class="atelier-slots" aria-label="입어 보는 옷"></div>
      <details class="atelier-advanced"><summary>색 바꾸기</summary><p class="atelier-hint">원단과 마감 색을 따로 바꿔요. 「이 차림 입기」를 눌러야 저장돼요.</p><div class="atelier-dyes"></div>${button('reset-dyes','기본색으로 되돌리기')}</details>
      <div class="atelier-acquisition"></div>
      <div class="atelier-candidates" aria-label="차림 후보 비교"></div>
    </div><div class="atelier-browse">
      <section class="atelier-pane" role="tabpanel" id="${uid}-pane-fitting" aria-labelledby="${uid}-tab-fitting">
        <div class="atelier-pane-heading"><div><p>MY CLOSET</p><h3>내 옷</h3></div><span class="atelier-result-count"></span></div>
        <div class="atelier-quick-looks" aria-label="저장한 차림 바로 입기"></div>
        <div class="atelier-filters" role="group" aria-label="옷 종류"><button type="button" data-category="all">모두</button><button type="button" data-category="body">옷</button><button type="button" data-category="neck">목도리·스카프</button><button type="button" class="atelier-search-toggle" data-studio="search" aria-controls="${uid}-search" aria-label="옷 찾기"><span class="atelier-sr">찾기</span></button></div>
        <div class="atelier-search" id="${uid}-search"><input type="search" maxlength="100" placeholder="이름·옷감·색으로 찾기" aria-label="옷 찾기"><button type="button" data-studio="owned">내 옷만</button></div>
        <details class="atelier-advanced"><summary>보기·색·옷감 고르기</summary><div class="atelier-modes" role="group" aria-label="목록 보기">${[['owned','내 옷'],['favorites','즐겨찾기'],['recent','최근 입은 옷'],['new','새 옷'],['all','전체']].map(([id,label])=>`<button type="button" data-mode="${id}">${label}</button>`).join('')}</div>${Object.entries(FILTER_OPTIONS).map(([kind,options])=>`<fieldset><legend>${{colors:'색',materials:'옷감',styles:'분위기'}[kind]}</legend><div class="atelier-tag-options">${options.map(({id,label})=>`<button type="button" data-filter-kind="${kind}" data-filter-id="${id}">${label}</button>`).join('')}</div></fieldset>`).join('')}<label>정렬 <select data-field="sort" aria-label="옷 정렬">${[['equipped','입은 옷 먼저'],['name','이름'],['recent','최근 입은 옷'],['new','최근 받은 옷'],['favorite','즐겨찾기'],['catalog','컬렉션 순서']].map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label><input type="checkbox" data-field="show-hidden"> 숨긴 옷도 보기</label>${button('clear-filters','고른 조건 모두 지우기')}</details>
        <div class="atelier-group-select"></div><div class="atelier-items" aria-label="옷 목록"></div>
        <section class="atelier-locked" aria-label="레슨을 마치면 받는 옷" hidden><div class="atelier-locked-head"><p>LESSON REWARDS</p><h4>레슨을 마치면 받는 옷</h4><span>흐린 옷도 눌러서 미리 입어 볼 수 있어요.</span></div><div class="atelier-locked-items"></div></section>
        <p class="atelier-collection-note">옷을 누르면 바로 입어 보고, 별을 누르면 즐겨찾기에 담아요.</p>
        <details class="atelier-advanced"><summary>옷 모음 만들기</summary><label>모음 이름 <input data-field="group-name" maxlength="24" placeholder="예: 겨울 산책"></label><label>표시 <select data-field="group-icon"><option>★</option><option>☀</option><option>✿</option><option>☁</option></select></label>${button('create-group','모음 만들기')}<div class="atelier-group-manager"></div></details>
      </section>
      <section class="atelier-pane" role="tabpanel" id="${uid}-pane-looks" aria-labelledby="${uid}-tab-looks" hidden>
        <div class="atelier-pane-heading"><div><p>SAVED LOOKS</p><h3>저장한 차림</h3></div><span class="atelier-look-count"></span></div>
        <p class="atelier-pane-copy">사진을 누르면 입어 보고, 「입기」를 누르면 바로 갈아입어요. 바꾼 색도 함께 저장해요.</p><label class="atelier-name-label" for="${uid}-name">차림 이름</label><input class="atelier-name" id="${uid}-name" maxlength="40" placeholder="예: 비 오는 날 산책">
        <div class="atelier-look-actions">${button('save-look','지금 차림 저장하기')}${button('new-look','새 차림으로 저장하기')}</div>
        <div class="atelier-replace" hidden><p>12개가 가득 찼어요. 바꿀 차림을 골라 주세요.</p><select data-field="replace-look" aria-label="바꿀 저장 차림"></select>${button('replace-look','고른 차림에 덮어 저장하기')}</div>
        <div class="atelier-looks"></div>
        <details class="atelier-advanced"><summary>여러 차림에 같은 옷 넣기</summary><p class="atelier-hint">목록에서 차림을 고른 뒤, 지금 입어 보는 옷 한 가지만 넣어요.</p><label>넣을 옷 <select data-field="batch-slot"><option value="neck">목도리</option><option value="body">옷</option></select></label>${button('prepare-batch','바뀔 내용 보기')}<div class="atelier-batch-confirm" hidden></div></details>
      </section>
      <section class="atelier-pane" role="tabpanel" id="${uid}-pane-photo" aria-labelledby="${uid}-tab-photo" hidden>
        <div class="atelier-pane-heading"><div><p>PHOTO</p><h3>사진 찍기</h3></div>${icon('camera')}</div>
        <p class="atelier-field-label">배경</p><div class="atelier-scenes" role="group" aria-label="사진 배경">${SCENES.map(([id,label])=>`<button type="button" data-scene="${id}" aria-pressed="false"><i aria-hidden="true"></i><span>${label}</span></button>`).join('')}</div>
        <p class="atelier-field-label">포즈</p><div class="atelier-poses" role="group" aria-label="포즈">${POSES.map(([id,label])=>`<button type="button" data-pose="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
        <div class="atelier-photo-fine" hidden><div class="atelier-light-options" role="group" aria-label="촬영 조명">${[['daylight','낮'],['sunset','노을빛'],['studio','사진관']].map(([id,label])=>`<button type="button" data-light="${id}">${label}</button>`).join('')}</div>
        <div class="atelier-photo-selects"><label>장소 <select data-field="background"><option value="room">피팅룸</option><option value="warm">카페</option><option value="garden">우리 동네</option></select></label><label>포즈 <select data-field="pose"><option value="neutral">편안하게</option><option value="wave">손 인사</option><option value="tilt">갸웃</option></select></label></div></div>
        <details class="atelier-advanced atelier-photo-more"><summary>찍을 차림·사진 크기</summary><label>찍을 차림 <select data-field="photo-look" aria-label="찍을 차림"><option value="">지금 입어 보는 차림</option></select></label>
        <p class="atelier-field-label">사진 크기</p><div class="atelier-filters" role="group" aria-label="사진 비율"><button type="button" data-format="portrait">세로 4:5</button><button type="button" data-format="square">정사각형</button></div></details>
        <p class="atelier-hint">배경과 포즈는 사진에만 쓰여요. 우리 방은 그대로예요.</p>
        <div class="atelier-photo-result" hidden></div><p class="atelier-photo-note">사진은 이 기기의 앨범에 계정별로 저장돼요.</p>
        <div class="atelier-album-heading"><h4>앨범</h4><span class="atelier-album-count"></span></div><p class="atelier-album-status"></p><div class="atelier-album"></div>${button('more-photos','사진 더 보기')}
      </section>
    </div></div>
    <details class="atelier-advanced atelier-settings"><summary>옷장 설정</summary><label>글자 크기 <select data-field="fontScale"><option value="1">기본</option><option value="1.15">크게</option><option value="1.3">더 크게</option></select></label><label><input type="checkbox" data-field="reducedMotion"> 움직임 줄이기</label><label><input type="checkbox" data-field="highContrast"> 대비 높이기</label><label><input type="checkbox" data-field="shortcutsEnabled"> 단축키 쓰기</label><label><input type="checkbox" data-field="gamepad"> 게임패드 쓰기</label><div class="atelier-shortcuts">${[['undo','되돌리기 Ctrl'],['redo','다시 하기 Ctrl'],['capture','사진'],['reset','기본 보기']].map(([id,label])=>`<label>${label} + <input data-shortcut="${id}" maxlength="1" aria-label="${label} 단축키"></label>`).join('')}</div><p class="atelier-hint">글을 쓰는 동안에는 단축키가 꺼져 있어요. 게임패드는 방향키로 고르고 A 고르기, B 되돌리기, X 다시 하기, Y 사진이에요.</p></details>
    <footer class="atelier-footer"><div class="atelier-footer-state"><strong class="atelier-outfit-state"></strong><p class="atelier-sync-note"></p></div><div class="atelier-notices"><div class="atelier-feedback" role="status" aria-live="polite"></div><div class="atelier-undo-save" hidden>${button('undo-save','마지막 차림 변경 되돌리기')}</div><div class="atelier-undo-photo" hidden>${button('undo-photo','지운 사진 되돌리기')}</div><div class="atelier-pending" hidden></div></div><div class="atelier-footer-actions">${button('to-looks','차림 저장')}<button type="button" class="atelier-primary" data-studio="earn" hidden>첫 문장 놀이로 받기</button><button type="button" class="atelier-primary" data-studio="apply">이 차림 입기 ${icon('check')}</button>${button('capture','사진 찍기',`aria-label="사진 찍어 앨범에 저장하기"`)}${button('capture-save','찍고 PNG로 받기')}</div></footer>`;
  const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)],owns=id=>preview||!id||(snap?.inventory||[]).some(i=>i.itemId===id),ownsEdit=edit=>Object.values(edit.slots).every(owns),busy=()=>localBusy||serverBusy||!!pending,looks=()=>snap?.looks||[];
  const orderedLooks=()=>[...looks()];
  const thumbnailTargets=new Map();
  const thumbQueue=createWardrobeThumbnailQueue({canRun:()=>!disposed&&!document.hidden&&root.isConnected&&!!engine&&!fault});
  const thumbnailObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){const target=thumbnailTargets.get(entry.target);if(!target)continue;target.visible=entry.isIntersecting;if(target.visible)queueThumbnail(target);else if(![...thumbnailTargets.values()].some(t=>t.key===target.key&&t.visible))thumbQueue.delete(target.key);}
  });
  const lookEditor=document.createElement('details');lookEditor.className='atelier-advanced atelier-look-editor';lookEditor.open=looks().length===0;
  const editorSummary=document.createElement('summary');editorSummary.textContent='시착 차림 저장·이름 수정';lookEditor.append(editorSummary);
  const editorNodes=[$('.atelier-pane-copy'),$('.atelier-name-label'),$('.atelier-name'),$('.atelier-look-actions'),$('.atelier-replace')];editorNodes[0].before(lookEditor);editorNodes.forEach(node=>lookEditor.append(node));
  const lookEdit=look=>normalizeEditState({slots:look.slots,dyes:look.dyes});
  const shownItem=()=>Object.values(draft.slots).includes(selected.id)?selected:wardrobeItem(draft.slots.body)||wardrobeItem(draft.slots.neck)||{name:'몽글 기본 차림',material:'펠트',collection:'기본',story:'아무것도 입지 않은 몽글이에요.',detail:'짧은 펠트 섬유 · 도톰한 가장자리'};
  function remember(){
    if(disposed)return;clearTimeout(saveTimer);
    const panel=root.closest('.panel-dialog'),items=$('.atelier-items'),list=$('.atelier-looks');
    ws.draft=clone(draft);ws.view=engine?.getView?.()||ws.view;ws.scroll={itemsLeft:items.scrollLeft,itemsTop:items.scrollTop,looksTop:list.scrollTop,panelTop:panel?.scrollTop||0};
    store.save(ws);
  }
  function soonRemember(){clearTimeout(saveTimer);saveTimer=setTimeout(remember,100);}
  function cacheKey(edit,thumbnail=true){return thumbnailKey({accountId,revision:GRAPHICS_REVISION,slots:edit.slots,dyes:edit.dyes,view:thumbnail?{}:engine?.getView?.()||ws.view})+(thumbnail?'':JSON.stringify([ws.light,ws.pose,ws.background]));}
  function thumb(edit){return wardrobeThumbnailCache.get(cacheKey(edit))||'assets/mongle.webp';}
  function setDefaults(){root.style.setProperty('--atelier-font-scale',ws.preferences.fontScale);root.dataset.contrast=String(ws.preferences.highContrast);root.dataset.reduced=String(reducedMotion||ws.preferences.reducedMotion);engine?.setReducedMotion?.(reducedMotion||ws.preferences.reducedMotion);}
  function syncStage(){engine?.setSlots(comparing?confirmed.slots:draft.slots);engine?.setDyes?.(comparing?confirmed.dyes:draft.dyes);$('.atelier-comparing').hidden=!comparing;$('.atelier-compare').setAttribute('aria-pressed',String(comparing));markPhoto();}
  function markPhoto(){if(!photo)return;photo.stale=!equal(lastPhotoSlots,draft);const note=$('.atelier-photo-result .atelier-photo-caption');if(note)note.textContent=photo.stale?'이 사진은 전에 고른 차림이에요.':photo.caption;}
  function renderDetails(){
    const item=shownItem();$('.atelier-material').textContent=`${item.collection} / ${item.material}`;$('.atelier-selected h3').textContent=item.name;$('.atelier-story').textContent=item.story;$('.atelier-craft').textContent=item.detail;
    $('.atelier-slots').innerHTML=['body','neck'].map(slot=>{const worn=wardrobeItem(draft.slots[slot]);return `<div class="atelier-slot"><span>${slotLabel(slot)}</span><strong>${esc(worn?.name||'입지 않음')}</strong><button type="button" data-lock="${slot}" aria-pressed="${ws.locks[slot]}" aria-label="${slotLabel(slot)} 고정(아무거나 입기에서 안 바꿈)">${ws.locks[slot]?'고정됨':'고정'}</button>${worn?`<button type="button" data-clear-slot="${slot}" aria-label="${esc(worn.name)} 벗기">${icon('close')}</button>`:''}</div>`;}).join('');
    $('.atelier-counter').textContent=`옷 ${(snap?.inventory||[]).filter(i=>wardrobeItem(i.itemId)).length} / ${WARDROBE_ITEMS.length}`;
    const defaults=engine?.getDyeDefaults?.(draft.slots)||{},active=document.activeElement?.dataset?.dyeSlot;
    if(!active)$('.atelier-dyes').innerHTML=['body','neck'].map(slot=>{const i=wardrobeItem(draft.slots[slot]);if(!i)return '';const colors=draft.dyes[slot]||defaults[slot]||[i.color,'#ece4d7'];return `<fieldset><legend>${esc(i.name)}</legend>${[0,1].map(index=>`<label>${index?'마감':'원단'} <input type="color" value="${colors[index]}" data-dye-slot="${slot}" data-dye-index="${index}" aria-label="${esc(i.name)} ${index?'마감':'원단'} 색"></label>`).join('')}</fieldset>`;}).join('')||'<p class="atelier-hint">옷이나 목도리를 고르면 색을 바꿀 수 있어요.</p>';
    const unavailable=Object.values(draft.slots).map(wardrobeItem).filter(i=>i&&!owns(i.id));
    $$('[data-dye-slot]').forEach(input=>input.disabled=!engine||!!fault);
    let dyeStatus=$('.atelier-dye-status');if(!dyeStatus){dyeStatus=document.createElement('p');dyeStatus.className='atelier-hint atelier-dye-status';$('.atelier-dyes').before(dyeStatus);}dyeStatus.hidden=!!engine&&!fault;dyeStatus.textContent=fault?'3D 화면을 다시 열면 색을 고를 수 있어요.':'옷감 준비가 끝나면 정확한 원단색과 마감색을 고를 수 있어요.';
    $('.atelier-acquisition').innerHTML=unavailable.map(i=>`<div class="atelier-acquisition-card"><strong>${esc(i.name)} · 아직 없어요</strong><p>${esc(giftLabel(i))}</p>${button('earn','받으러 가기')}</div>`).join('');
  }
  function renderChrome(){
    if(disposed)return;const same=equal(draft,confirmed),available=ownsEdit(draft);
    root.dataset.tab=ws.tab;root.dataset.busy=String(busy());root.dataset.detail=String(engine?.getView?.().detail||false);
    $$('[data-studio-tab]').forEach(b=>{const active=b.dataset.studioTab===ws.tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$$('.atelier-pane').forEach(p=>p.hidden=p.id!==`${uid}-pane-${ws.tab}`);
    $('[data-studio="apply"]').disabled=busy()||!available||same||comparing;
    const earn=$('[data-studio="earn"]');earn.hidden=available||preview;earn.disabled=busy();
    root.dataset.outfit=comparing?'compare':same?'worn':available?'draft':'locked';
    $('.atelier-outfit-state').textContent=comparing?'입은 차림을 보는 중':same?'지금 입고 있는 차림':available?'미리 입어 보는 차림':'아직 없는 옷을 입어 보는 중';
    $('.atelier-sync-note').textContent=(preview?'브라우저 미리보기 · ':serverStatus==='offline'?'연결을 기다려요 · ':pending?'저장 요청이 남아 있어요 · ':serverBusy?'저장 상태를 확인하는 중 · ':'')+(store.status.mode==='device'?'고르던 차림은 이 기기에 남아요':'고르던 차림은 이번 실행에만 남아요');
    $('.atelier-feedback').textContent=missingEditingLook?'고치던 차림이 다른 화면에서 지워졌어요. 입어 보던 옷과 이름은 남아 있어요. 「새 차림으로 저장하기」로 새로 저장할 수 있어요.':message;$('.atelier-look-count').textContent=`${looks().length} / 12`;$('.atelier-undo-save').hidden=!undoLooks;$('.atelier-undo-photo').hidden=!undoPhoto;
    $('[data-studio="undo"]').disabled=!history.canUndo; $('[data-studio="redo"]').disabled=!history.canRedo;
    $('[data-studio="save-look"]').disabled=busy()||!available||missingEditingLook;$('[data-studio="save-look"]').textContent=editingLook?'이름·차림 고치기':'지금 차림 저장하기';editorSummary.textContent=editingLook?`${looks().find(look=>look.id===editingLook)?.name||'고른 차림'} · 이름·차림 고치기`:'지금 차림 저장하기';
    $('[data-studio="capture"]').disabled=!engine||!!fault||localBusy;$('[data-studio="capture-save"]').disabled=!engine||!!fault||localBusy;
    $('[data-studio="detail"]').setAttribute('aria-pressed',String(engine?.getView?.().detail||false));
    $$('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===ws.light)));$$('[data-scene]').forEach(b=>{const scene=SCENES.find(x=>x[0]===b.dataset.scene);b.setAttribute('aria-pressed',String(!!scene&&scene[2]===ws.light&&scene[3]===ws.background));});$$('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===ws.pose)));$$('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.format===ws.format)));
    $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===ws.viewFilter)));$$('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===ws.category)));
    $('[data-studio="owned"]').setAttribute('aria-pressed',String(ws.ownedOnly));
    $$('[data-filter-kind]').forEach(b=>b.setAttribute('aria-pressed',String(ws.filter[b.dataset.filterKind].includes(b.dataset.filterId))));
    const holder=$('.atelier-pending');holder.hidden=!pending;if(pending){holder.innerHTML=`<p>${serverStatus==='conflict'?'다른 화면에서 저장한 차림이 바뀌었어요. 최신 기록을 확인한 뒤 다시 입어 주세요.':'아직 저장하지 못했어요. 고른 차림은 그대로예요.'}</p><div>${serverStatus==='conflict'?'':button('retry','같은 요청 다시 저장하기')}${button('discard','계정의 최신 기록 보기')}</div>`;holder.querySelectorAll('button').forEach(b=>b.disabled=localBusy||serverBusy);}
    renderDetails();setDefaults();
  }
  function itemCard(item){
    const state=!owns(item.id)?'locked':confirmed.slots[item.slot]===item.id?'worn':draft.slots[item.slot]===item.id?'trying':'owned',chosen=draft.slots[item.slot]===item.id,fav=ws.favorites.includes(item.id);
    return `<article class="atelier-item-card" data-state="${state}"><button type="button" class="atelier-item ${chosen?'is-chosen':''}" data-pick="${item.id}" aria-pressed="${chosen}" aria-label="${esc(item.name)} · ${owns(item.id)?'입어 보기':esc(giftLabel(item))}"><span class="atelier-item-art"><img data-thumb-item="${item.id}" src="${thumb({slots:{[item.slot]:item.id},dyes:{}})}" alt="" width="256" height="256">${chosen?`<span class="atelier-item-check">${icon('check')}</span>`:''}</span><strong>${esc(item.name)}</strong><span class="atelier-item-material">${state==='locked'?esc(giftLabel(item)):state==='worn'?'입는 중':state==='trying'?'입어 보는 중':esc(item.material)}${ws.unseen.includes(item.id)?' · 새 옷':''}</span></button><div class="atelier-item-tools"><button type="button" data-favorite="${item.id}" aria-pressed="${fav}" aria-label="${esc(item.name)} 즐겨찾기"></button><details><summary aria-label="${esc(item.name)} 관리"><span class="atelier-sr">관리</span></summary><button type="button" data-hide="${item.id}">${ws.hidden.includes(item.id)?'다시 보이기':'숨기기'}</button>${ws.groups.map(g=>`<button type="button" data-group-item="${item.id}" data-group-target="${esc(g.id)}" aria-pressed="${g.itemIds.includes(item.id)}">${esc(g.icon)} ${esc(g.name)} ${g.itemIds.includes(item.id)?'에서 빼기':'에 담기'}</button>`).join('')}</details></div></article>`;
  }
  function renderItems(){
    const focused=document.activeElement?.dataset?.pick||document.activeElement?.dataset?.favorite,focusedType=document.activeElement?.dataset?.favorite?'favorite':'pick',scroll=$('.atelier-items'),left=scroll.scrollLeft,top=scroll.scrollTop;
    const ownedIds=preview?WARDROBE_ITEMS.map(i=>i.id):(snap?.inventory||[]).map(i=>i.itemId);
    const rows=filterItems(WARDROBE_ITEMS,ws,{owned:ownedIds,equipped:confirmed.slots});
    $('.atelier-result-count').textContent=`${rows.length}벌`;
    scroll.innerHTML=rows.length?rows.map(itemCard).join(''):`<div class="atelier-empty"><p>조건에 맞는 옷이 없어요.</p>${button('clear-filters','조건 지우기')}${button('show-all','모든 옷 보기')}</div>`;
    // 「내 옷」만 볼 때도 아직 없는 옷을 흐리게 아래에 둔다(레슨 보상). 눌러서 미리 입어 볼 수 있다.
    const lockedRows=!preview&&['owned'].includes(ws.viewFilter)?filterItems(WARDROBE_ITEMS,{...ws,viewFilter:'all',ownedOnly:false},{owned:ownedIds,equipped:confirmed.slots}).filter(item=>!owns(item.id)):[];
    $('.atelier-locked').hidden=!lockedRows.length;$('.atelier-locked-items').innerHTML=lockedRows.map(itemCard).join('');
    scroll.scrollLeft=left;scroll.scrollTop=top;
    if(focused)$$('[data-pick],[data-favorite]').find(b=>b.dataset[focusedType]===focused)?.focus({preventScroll:true});
    queueItemThumbnails();
  }
  function lookCard(look,quick=false){
    const edit=lookEdit(look),image=thumb(edit),favorite=ws.lookFavorites.includes(look.id);
    return quick?`<article class="atelier-hanger"><button type="button" data-look="${esc(look.id)}" aria-label="${esc(look.name)} 입어 보기"><img data-thumb-look="${esc(look.id)}" src="${image}" alt="" width="256" height="256"><strong>${esc(look.name)}</strong></button><button type="button" data-wear-look="${esc(look.id)}" ${busy()?'disabled':''}>입기</button></article>`:
      `<article class="atelier-look" data-look-row="${esc(look.id)}"><button type="button" data-look="${esc(look.id)}" aria-label="${esc(look.name)} 입어보기"><span class="atelier-look-art"><img data-thumb-look="${esc(look.id)}" src="${image}" alt="" width="256" height="256"></span><span><strong>${esc(look.name)}</strong><small>${esc(outfitLabel(look.slots))}</small><span>눌러서 입어 보기${Object.keys(edit.dyes).length?' · 색 바꿈':''}</span></span></button><div class="atelier-look-tools"><button type="button" data-wear-look="${esc(look.id)}" ${busy()?'disabled':''}>입기</button><button type="button" data-look-favorite="${esc(look.id)}" aria-label="${esc(look.name)} 즐겨찾기" aria-pressed="${favorite}"></button><label><input type="checkbox" data-batch-look="${esc(look.id)}" ${batchIds.has(look.id)?'checked':''}> 고르기</label><details><summary aria-label="${esc(look.name)} 관리"><span class="atelier-sr">관리</span></summary><button type="button" data-duplicate-look="${esc(look.id)}">복사하기</button><button type="button" data-rename-look="${esc(look.id)}">이름·차림 고치기</button><button type="button" data-move-look="${esc(look.id)}" data-direction="-1" aria-label="${esc(look.name)} 위로 옮기기">위로</button><button type="button" data-move-look="${esc(look.id)}" data-direction="1" aria-label="${esc(look.name)} 아래로 옮기기">아래로</button><button type="button" data-delete-look="${esc(look.id)}">지우기</button></details></div></article>`;
  }
  function renderLooks(){
    const top=$('.atelier-looks').scrollTop,ordered=orderedLooks();$('.atelier-looks').innerHTML=ordered.length?ordered.map(l=>lookCard(l)).join(''):'<div class="atelier-empty-look">'+icon('book')+'<h4>저장한 차림이 아직 없어요</h4><p>입어 본 차림에 이름을 붙여 저장하면 여기서 바로 갈아입어요.</p></div>';$('.atelier-looks').scrollTop=top;
    const quick=[...ordered.filter(l=>ws.lookFavorites.includes(l.id)),...ordered.filter(l=>!ws.lookFavorites.includes(l.id))].slice(0,3);
    $('.atelier-quick-looks').innerHTML=quick.length?'<p class="atelier-field-label">저장한 차림 · 바로 입기</p><div>'+quick.map(l=>lookCard(l,true)).join('')+'</div>':'';
    const options=ordered.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
    $('[data-field="photo-look"]').innerHTML='<option value="">지금 입어 보는 차림</option>'+options;$('[data-field="replace-look"]').innerHTML=options;
    queueLooksThumbnails();
  }
  function renderGroups(){
    $('.atelier-group-select').innerHTML=ws.groups.length?`<label>옷 모음 <select data-field="group-id"><option value="">모든 옷</option>${ws.groups.map(g=>`<option value="${esc(g.id)}" ${ws.groupId===g.id?'selected':''}>${esc(g.icon)} ${esc(g.name)} · ${g.itemIds.length}개</option>`).join('')}</select></label>`:'';
    $('.atelier-group-manager').innerHTML=ws.groups.map(g=>`<div class="atelier-group-row"><label>이름 <input data-group-name="${esc(g.id)}" value="${esc(g.name)}" maxlength="24" aria-label="${esc(g.name)} 모음 이름"></label><label>표시 <select data-group-icon="${esc(g.id)}">${['★','☀','✿','☁'].map(i=>`<option ${g.icon===i?'selected':''}>${i}</option>`).join('')}</select></label><button type="button" data-move-group="${esc(g.id)}" data-direction="-1" aria-label="${esc(g.name)} 모음 위로">↑</button><button type="button" data-move-group="${esc(g.id)}" data-direction="1" aria-label="${esc(g.name)} 모음 아래로">↓</button><button type="button" data-delete-group="${esc(g.id)}" aria-label="${esc(g.name)} 모음 지우기">지우기</button></div>`).join('');
  }
  function renderCandidates(){
    $('.atelier-candidates').innerHTML=candidates.length?'<h4>비교 후보</h4><div>'+candidates.map((edit,index)=>{const image=wardrobeThumbnailCache.get(cacheKey(edit,false));return `<article><img data-thumb-candidate="${index}" src="${image||'assets/mongle.webp'}" alt="${esc(outfitLabel(edit.slots))} 비교 후보 ${index+1}" width="320" height="400"><p>${esc(outfitLabel(edit.slots))}</p><button type="button" data-candidate="${index}">입어 보기</button><button type="button" data-remove-candidate="${index}" aria-label="후보 ${index+1} 빼기">빼기</button></article>`;}).join('')+'</div>':'';
    observeThumbnails();
  }
  function render(){renderChrome();renderItems();renderLooks();renderGroups();syncStage();renderCandidates();}
  function showTab(value){remember();ws.tab=value;renderChrome();if(innerWidth<800){const panel=root.closest('.panel-dialog');if(panel)panel.scrollTop=0;}if(value==='looks')renderLooks();if(value==='photo')void refreshAlbum();remember();}
  function selectEdit(edit,item,{record=true,keepEditing=true}={}){
    draft=record?history.record(edit):normalizeEditState(edit);selected=item||wardrobeItem(draft.slots.body)||wardrobeItem(draft.slots.neck)||selected;comparing=false;if(!keepEditing){editingLook='';missingEditingLook=false;lookFormVersion++;}message='';
    if(item)ws.unseen=ws.unseen.filter(id=>id!==item.id);render();remember();
  }
  async function run(action,{recovery=false,onSuccess}={}){
    if(disposed||localBusy||serverBusy||(pending&&!recovery))return;localBusy=true;message='';renderChrome();
    const completion=onSuccess||(recovery?serverCompletion:null);if(onSuccess)serverCompletion=onSuccess;
    try{const result=await action();if(disposed)return;if(result?.accountId)adopt(result);if(!disposed&&result&&completion&&serverCompletion===completion){serverCompletion=null;completion(result);}return result;}
    catch(error){if(!pending)serverCompletion=null;if(!disposed)message={NETWORK_UNAVAILABLE:'연결이 끊겼어요. 초안과 같은 저장 요청이 남아 있어요.',REVISION_CONFLICT:'다른 화면의 최신 차림을 먼저 확인해 주세요.',ITEM_NOT_OWNED:'아직 없는 옷은 입거나 저장할 수 없어요.',INVALID_DYES:'색을 다시 골라 주세요.',INVALID_LOOKS:'이름과 저장한 차림을 확인해 주세요.',AUTH_REQUIRED:'계정 연결이 끝났어요. 다시 연결해 주세요.'}[error.code]||error.message||'완료하지 못했어요. 다시 시도해 주세요.';}
    finally{localBusy=false;if(!disposed){render();remember();}}
  }
  function adopt(next,{busy:isBusy=false,pending:nextPending=null,status='ready'}={}){
    if(disposed||!next)return;if(next.accountId!==accountId&&!preview){dispose();return;}
    const clean=equal(draft,confirmed),inventoryChanged=JSON.stringify(snap?.inventory)!==JSON.stringify(next.inventory);
    snap=next;confirmed=normalizeEditState({slots:next.avatar?.slots,dyes:next.avatar?.dyes});if(clean&&!equal(draft,confirmed)){draft=clone(confirmed);history.reset(draft);}missingEditingLook=!!editingLook&&!looks().some(look=>look.id===editingLook);
    if(inventoryChanged){remember();ws=store.reconcileInventory((next.inventory||[]).map(i=>i.itemId),{acquiredAt:inventoryDates(next)});}
    serverBusy=isBusy;pending=nextPending;serverStatus=status;render();
  }
  async function wear(edit){
    if(busy()||!ownsEdit(edit))return;
    selectEdit(edit,null,{keepEditing:false});
    await run(()=>onEquip(clone(edit.slots),clone(edit.dyes)),{onSuccess:()=>{for(const id of Object.values(edit.slots).filter(Boolean))ws.recent[id]=Date.now();message='새 차림을 입었어요. 홈과 동네에도 같은 색으로 이어져요.';}});
  }
  async function saveLooks(next,label,{keepUndo=true,onSaved}={}){
    if(busy())return;const previous=clone(looks()),revision=snap?.revision,formVersion=lookFormVersion,formTarget=editingLook,formName=$('.atelier-name').value,formDraft=clone(draft);
    return run(()=>onSaveLooks(next),{onSuccess:result=>{const requestConfirmed=equalLooks(result.looks,next);undoLooks=keepUndo&&requestConfirmed?{looks:previous,revision:result?.revision??revision}:null;message=requestConfirmed?label:'저장은 됐지만 다른 화면에서 차림 목록이 다시 바뀌었어요. 최신 목록을 확인해 주세요.';if(requestConfirmed&&lookFormVersion===formVersion&&editingLook===formTarget&&$('.atelier-name').value===formName&&equal(draft,formDraft)){editingLook='';missingEditingLook=false;}if(requestConfirmed)onSaved?.(result);}});
  }
  async function saveLook({replace=false}={}){
    if(busy()||!ownsEdit(draft)||missingEditingLook)return;
    if(!editingLook&&looks().length>=12&&!replace){lookEditor.open=true;$('.atelier-replace').hidden=false;message='12개가 가득 찼어요. 바꿀 차림을 골라 주세요.';renderChrome();return;}
    const name=$('.atelier-name').value.trim()||`${shownItem().collection}의 나`,id=replace?$('[data-field="replace-look"]').value:editingLook||crypto.randomUUID();
    const record={id,name,slots:clone(draft.slots),dyes:clone(draft.dyes)},next=looks().some(l=>l.id===id)?looks().map(l=>l.id===id?record:l):[...looks(),record];
    const formVersion=lookFormVersion,formName=$('.atelier-name').value,formDraft=clone(draft);
    await saveLooks(next,'차림과 색을 저장했어요.',{onSaved:()=>{if(lookFormVersion===formVersion&&$('.atelier-name').value===formName&&equal(draft,formDraft)){$('.atelier-name').value='';$('.atelier-replace').hidden=true;lookEditor.open=false;}}});
  }
  async function duplicateLook(id){
    const look=looks().find(l=>l.id===id);if(!look||busy())return;editingLook='';missingEditingLook=false;lookFormVersion++;if(looks().length>=12){selectEdit(lookEdit(look),null,{keepEditing:false});$('.atelier-name').value=(look.name+' 복사').slice(0,40).trimEnd();showTab('looks');lookEditor.open=true;$('.atelier-replace').hidden=false;return;}
    await saveLooks([...looks(),{id:crypto.randomUUID(),name:(look.name+' 복사').slice(0,40).trimEnd(),slots:clone(look.slots),dyes:clone(look.dyes||{})}],'원래 차림은 두고 복사했어요.');
  }
  function moveEntry(array,id,direction){const index=array.findIndex(i=>(typeof i==='string'?i:i.id)===id),next=index+Number(direction);if(index<0||next<0||next>=array.length)return;[array[index],array[next]]=[array[next],array[index]];}
  function prepareBatch(){
    const selectedLooks=looks().filter(l=>batchIds.has(l.id)),slot=$('[data-field="batch-slot"]').value;
    if(!selectedLooks.length){message='목록에서 바꿀 차림을 먼저 골라 주세요.';renderChrome();return;}
    $('.atelier-batch-confirm').innerHTML=`<p>차림 ${selectedLooks.length}개의 ${slotLabel(slot)}만 바꿔요.</p><p>${selectedLooks.map(l=>esc(l.name)).join(', ')}<br>${esc(wardrobeItem(draft.slots[slot])?.name||'입지 않음')}(으)로 바꿔요 · 다른 옷과 이름은 그대로</p>${button('apply-batch','이대로 바꾸기')}${button('cancel-batch','그만두기')}`;$('.atelier-batch-confirm').hidden=false;
    $('.atelier-batch-confirm').dataset.slot=slot;$('.atelier-batch-confirm').dataset.edit=JSON.stringify(draft);$('.atelier-batch-confirm').dataset.ids=JSON.stringify(selectedLooks.map(l=>l.id));$('.atelier-batch-confirm').dataset.revision=String(snap?.revision);
  }
  async function applyBatch(){
    const edit=normalizeEditState(JSON.parse($('.atelier-batch-confirm').dataset.edit)),slot=$('.atelier-batch-confirm').dataset.slot;
    if(!owns(edit.slots[slot])){message='아직 없는 옷은 저장한 차림에 넣을 수 없어요.';renderChrome();return;}if(String(snap?.revision)!==$('.atelier-batch-confirm').dataset.revision){message='저장한 차림이 바뀌었어요. 바뀔 내용을 다시 확인해 주세요.';renderChrome();return;}const ids=new Set(JSON.parse($('.atelier-batch-confirm').dataset.ids));const next=looks().map(l=>{if(!ids.has(l.id))return l;const dyes=clone(l.dyes||{});if(edit.dyes[slot])dyes[slot]=clone(edit.dyes[slot]);else delete dyes[slot];return {...l,slots:{...l.slots,[slot]:edit.slots[slot]},dyes};});
    await saveLooks(next,'고른 차림에 같은 옷을 넣었어요. 되돌릴 수 있어요.',{onSaved:()=>{$('.atelier-batch-confirm').hidden=true;}});
  }
  function photoUrl(record){if(!urls.has(record.id))urls.set(record.id,URL.createObjectURL(record.blob));return urls.get(record.id);}
  function download(record){const link=document.createElement('a');link.href=photoUrl(record);link.download=record.filename||'SYNK-WORLD.png';document.body.append(link);link.click();link.remove();}
  function showPhoto(record){
    photo={...record,stale:false};lastPhotoSlots=normalizeEditState({slots:record.slots,dyes:record.dyes});const box=$('.atelier-photo-result');box.innerHTML=`<img src="${photoUrl(record)}" alt="${esc(outfitLabel(record.slots))} · ${esc(record.caption)}"><p class="atelier-photo-caption">${esc(record.caption)}</p><a class="atelier-soft atelier-download" href="${photoUrl(record)}" download="${esc(record.filename)}">PNG로 받기</a>`;const retry=document.createElement('button');retry.type='button';retry.className='atelier-soft';retry.dataset.studio='retry-photo';retry.textContent='앨범에 다시 저장하기';retry.hidden=record.localStatus==='device';box.append(retry);box.hidden=false;markPhoto();
  }
  async function capture(saveFile=false){
    if(!engine||fault||localBusy)return;localBusy=true;renderChrome();sound('tick');
    try{
      const edit=clone(comparing?confirmed:draft),format=ws.format,width=1200,height=format==='square'?1200:1500,raw=engine.capture({width,height,slots:edit.slots,dyes:edit.dyes});
      const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=raw;});if(disposed)return;
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(0,height-114,width,114);await document.fonts?.ready;if(disposed)return;
      const caption=!preview&&equal(edit,confirmed)?'저장한 차림':'입어 본 차림',createdAt=new Date().toISOString(),filename=`SYNK-WORLD-${createdAt.replace(/[:.]/g,'-')}-${format}.png`;
      ctx.fillStyle='#262b36';ctx.font='700 28px SUIT, sans-serif';ctx.fillText(outfitLabel(edit.slots),56,height-66,1088);ctx.font='500 21px SUIT, sans-serif';ctx.fillStyle='#656d78';ctx.fillText(`${caption} · ${shortDate(createdAt)}`,56,height-29);ctx.textAlign='right';ctx.fillText('SYNK WORLD',width-56,height-29);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG를 준비하지 못했어요.')),'image/png'));if(disposed)return;
      const result=await album.add(blob,{slots:edit.slots,dyes:edit.dyes,preview:caption!=='저장한 차림',caption,createdAt,filename,width,height,format,view:engine.getView?.(),light:ws.light,pose:ws.pose,background:ws.background});
      if(disposed)return;let record;if(result.photo)record=await album.get(result.photo.id);
      if(!record){record={id:crypto.randomUUID(),blob,slots:edit.slots,dyes:edit.dyes,caption,createdAt,filename,width,height};message=result.message||'앨범에 저장하지 못했어요. PNG 파일로 먼저 받아 주세요.';}else message=result.mode==='session'?'기기 앨범을 쓸 수 없어 이번 실행에만 저장했어요. PNG로도 받아 두세요.':'사진을 앨범에 저장했어요.';
      showPhoto(record);if(saveFile){download(record);message+=' PNG 파일도 받았어요.';}await refreshAlbum();
    }catch(error){if(!disposed)message=error.message||'사진을 저장하지 못했어요. 다시 찍어 주세요.';}
    finally{localBusy=false;if(!disposed){renderChrome();remember();}}
  }
  async function refreshAlbum(){
    const token=++albumToken;try{const rows=await album.list();if(disposed||token!==albumToken)return;albumRows=rows;$('.atelier-album-count').textContent=`${rows.length}장`;$('.atelier-album-status').textContent=album.status.message||'이 기기에 저장돼요. 직접 지우기 전까지 남아요.';$('.atelier-album').innerHTML=rows.slice(0,albumPage).map(row=>`<article class="atelier-album-photo"><button type="button" data-photo="${esc(row.id)}" aria-label="${esc(shortDate(row.createdAt))} 사진 보기"><img data-album-image="${esc(row.id)}" alt="${esc(outfitLabel(row.slots))}" width="1200" height="1500"><strong>${esc(shortDate(row.createdAt))}</strong><span>${esc(row.caption||'입어 본 차림')}</span></button><button type="button" data-photo-download="${esc(row.id)}">PNG 받기</button><button type="button" data-photo-delete="${esc(row.id)}" aria-label="${esc(shortDate(row.createdAt))} 사진 지우기">지우기</button></article>`).join('')||'<p class="atelier-empty">첫 사진을 찍으면 여기서 다시 볼 수 있어요.</p>';
      $('[data-studio="more-photos"]').hidden=rows.length<=albumPage;
      const active=new Set(rows.slice(0,albumPage).map(r=>r.id));if(photo)active.add(photo.id);for(const [id,url]of urls)if(!active.has(id)){URL.revokeObjectURL(url);urls.delete(id);}
      for(const row of rows.slice(0,albumPage)){const record=await album.get(row.id);if(disposed||token!==albumToken)return;const image=$$('[data-album-image]').find(i=>i.dataset.albumImage===row.id);if(record&&image)image.src=photoUrl(record);}
    }catch(error){if(!disposed)$('.atelier-album-status').textContent='앨범을 읽지 못했어요. 촬영 결과의 PNG는 따로 받을 수 있어요.';}
  }
  function queueThumbnail(target){
    if(!engine||fault||wardrobeThumbnailCache.get(target.key))return;
    const token=generation;
    thumbQueue.set(target.key,()=>{
      if(disposed||token!==generation||!engine||fault||![...thumbnailTargets.values()].some(t=>t.key===target.key&&t.visible&&t.node.isConnected))return;
      // A deferred candidate capture uses the live view, which may have changed
      // since observation (for example through keyboard rotation or wheel zoom).
      if(!target.thumbnail&&target.key!==cacheKey(target.edit,false)){renderCandidates();return;}
      let image=wardrobeThumbnailCache.get(target.key);
      if(!image){try{image=engine.capture({width:target.thumbnail?256:320,height:target.thumbnail?256:400,slots:target.edit.slots,dyes:target.edit.dyes,thumbnail:target.thumbnail,restoreImmediately:false});wardrobeThumbnailCache.set(target.key,image);}catch{return;}}
      for(const current of thumbnailTargets.values())if(current.key===target.key){current.node.src=image;if(current.node.dataset.thumbItem)thumbnails.set(current.node.dataset.thumbItem,image);if(current.node.dataset.thumbLook)lookThumbs.set(current.node.dataset.thumbLook,{image,...current.edit});}
    });
  }
  function observeThumbnails(){
    for(const [node,target]of thumbnailTargets)if(!root.contains(node)){thumbnailObserver.unobserve(node);thumbnailTargets.delete(node);if(![...thumbnailTargets.values()].some(t=>t.key===target.key&&t.visible))thumbQueue.delete(target.key);}
    for(const node of $$('[data-thumb-item],[data-thumb-look],[data-thumb-candidate]')){
      if(thumbnailTargets.has(node))continue;
      const item=wardrobeItem(node.dataset.thumbItem),look=looks().find(l=>l.id===node.dataset.thumbLook),candidate=node.dataset.thumbCandidate;
      const thumbnail=candidate===undefined,edit=item?normalizeEditState({slots:{[item.slot]:item.id}}):look?lookEdit(look):candidates[Number(candidate)];if(!edit)continue;
      node.loading='lazy';node.decoding='async';
      const target={node,edit,key:cacheKey(edit,thumbnail),thumbnail,visible:false};thumbnailTargets.set(node,target);thumbnailObserver.observe(node);
    }
    thumbQueue.resume();
  }
  function queueItemThumbnails(){observeThumbnails();}
  function queueLooksThumbnails(){observeThumbnails();}
  async function mountStage(){
    const token=++generation;thumbQueue.clear();stageAbort?.abort();stageAbort=new AbortController();engine?.dispose();engine=null;fault='';root.dataset.stage='loading';$('.atelier-scene').setAttribute('aria-busy','true');
    const fail=text=>{if(disposed||token!==generation)return;fault=text;$('.atelier-scene').setAttribute('aria-busy','false');let box=$('.atelier-stage-error');if(!box){box=document.createElement('div');box.className='atelier-stage-error';$('.atelier-scene-wrap').append(box);}box.innerHTML=`<p>${esc(text)}</p>${button('retry-stage','3D 다시 열기')}`;renderChrome();};
    try{const {mountWardrobeStage}=await import('./wardrobe-stage.mjs');if(disposed||token!==generation)return;const stage=await mountWardrobeStage($('.atelier-scene'),{slots:draft.slots,reducedMotion:reducedMotion||ws.preferences.reducedMotion,signal:stageAbort.signal,onError:fail,onView:view=>{if(disposed||token!==generation)return;ws.view=view;$('[data-field="zoom"]').value=view.zoom;soonRemember();},onAngle:a=>{if(disposed||token!==generation)return;$$('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.angle)-a)<.02)));}});if(disposed||token!==generation){stage.dispose();return;}engine=stage;engine.setLight(ws.light);engine.setView?.(ws.view);engine.setPose?.(ws.pose);engine.setBackground?.(ws.background);engine.setDyes?.(draft.dyes);$('.atelier-stage-error')?.remove();$('.atelier-scene').setAttribute('aria-busy','false');root.dataset.stage='ready';render();remember();}
    catch{fail('3D 화면을 불러오지 못했어요. 초안은 남아 있어요. 다시 열어 주세요.');}
  }
  function toggle(array,id){return array.includes(id)?array.filter(v=>v!==id):[...array,id];}
  async function clicked(event){
    const b=event.target.closest('button');if(!b||!root.contains(b)||b.disabled)return;
    if(b.dataset.studioTab){showTab(b.dataset.studioTab);return;}
    if(b.dataset.category){ws.category=b.dataset.category;renderItems();renderChrome();remember();return;}
    if(b.dataset.mode){ws.viewFilter=b.dataset.mode;ws.ownedOnly=b.dataset.mode!=='all';renderItems();renderChrome();remember();return;}
    if(b.dataset.pick){const item=wardrobeItem(b.dataset.pick);if(item){const dyes=clone(draft.dyes);if(draft.slots[item.slot]!==item.id)delete dyes[item.slot];sound('select');selectEdit({slots:{...draft.slots,[item.slot]:item.id},dyes},item);}return;}
    if(b.dataset.favorite){ws.favorites=toggle(ws.favorites,b.dataset.favorite);renderItems();remember();return;}
    if(b.dataset.hide){ws.hidden=toggle(ws.hidden,b.dataset.hide);renderItems();remember();return;}
    if(b.dataset.lock){ws.locks[b.dataset.lock]=!ws.locks[b.dataset.lock];renderDetails();remember();return;}
    if(b.dataset.clearSlot){const slot=b.dataset.clearSlot,dyes=clone(draft.dyes);delete dyes[slot];selectEdit({slots:{...draft.slots,[slot]:''},dyes});return;}
    if(b.dataset.angle){engine?.setAngle(Number(b.dataset.angle));renderCandidates();soonRemember();return;}
    if(b.dataset.light){ws.light=b.dataset.light;engine?.setLight(ws.light);renderChrome();renderCandidates();remember();return;}
    if(b.dataset.scene){const scene=SCENES.find(x=>x[0]===b.dataset.scene);if(scene){ws.light=scene[2];ws.background=scene[3];engine?.setLight(ws.light);engine?.setBackground?.(ws.background);$('[data-field="background"]').value=ws.background;renderChrome();renderCandidates();remember();}return;}
    if(b.dataset.pose){ws.pose=POSES.some(x=>x[0]===b.dataset.pose)?b.dataset.pose:'neutral';engine?.setPose?.(ws.pose);$('[data-field="pose"]').value=ws.pose;renderChrome();renderCandidates();remember();return;}
    if(b.dataset.format){ws.format=b.dataset.format;renderChrome();remember();return;}
    if(b.dataset.groupItem){const group=ws.groups.find(g=>g.id===b.dataset.groupTarget);if(group){group.itemIds=toggle(group.itemIds,b.dataset.groupItem);renderItems();renderGroups();remember();}return;}
    if(b.dataset.moveGroup){moveEntry(ws.groups,b.dataset.moveGroup,b.dataset.direction);renderGroups();remember();return;}
    if(b.dataset.deleteGroup){ws.groups=ws.groups.filter(g=>g.id!==b.dataset.deleteGroup);if(ws.groupId===b.dataset.deleteGroup)ws.groupId='';renderGroups();renderItems();remember();return;}
    if(b.dataset.filterKind){ws.filter[b.dataset.filterKind]=toggle(ws.filter[b.dataset.filterKind],b.dataset.filterId);renderItems();renderChrome();remember();return;}
    if(b.dataset.look){const look=looks().find(l=>l.id===b.dataset.look);if(look){selectEdit(lookEdit(look),null,{keepEditing:false});$('.atelier-name').value=look.name;message='저장한 차림을 입어 봐요. 「이 차림 입기」로 저장해요.';if(innerWidth<800)showTab('fitting');renderChrome();}return;}
    if(b.dataset.wearLook){const look=looks().find(l=>l.id===b.dataset.wearLook);if(look)await wear(lookEdit(look));return;}
    if(b.dataset.lookFavorite){ws.lookFavorites=toggle(ws.lookFavorites,b.dataset.lookFavorite);renderLooks();remember();return;}
    if(b.dataset.duplicateLook){await duplicateLook(b.dataset.duplicateLook);return;}
    if(b.dataset.renameLook){const look=looks().find(l=>l.id===b.dataset.renameLook);if(look){selectEdit(lookEdit(look),null,{keepEditing:false});editingLook=look.id;lookEditor.open=true;$('.atelier-name').value=look.name;renderChrome();$('.atelier-name').focus();$('.atelier-name').select();}return;}
    if(b.dataset.moveLook){const ids=orderedLooks().map(l=>l.id);moveEntry(ids,b.dataset.moveLook,b.dataset.direction);ws.lookOrder=ids;await saveLooks(ids.map(id=>looks().find(l=>l.id===id)),'차림 순서를 바꿨어요.');remember();return;}
    if(b.dataset.deleteLook){await saveLooks(looks().filter(l=>l.id!==b.dataset.deleteLook),'차림을 지웠어요. 되돌릴 수 있어요.');return;}
    if(b.dataset.candidate!==undefined){selectEdit(candidates[Number(b.dataset.candidate)],null,{keepEditing:false});return;}
    if(b.dataset.removeCandidate!==undefined){candidates.splice(Number(b.dataset.removeCandidate),1);renderCandidates();return;}
    if(b.dataset.photo||b.dataset.photoDownload){const record=await album.get(b.dataset.photo||b.dataset.photoDownload);if(!disposed&&record){if(b.dataset.photoDownload)download(record);else showPhoto(record);}return;}
    if(b.dataset.photoDelete){const record=await album.get(b.dataset.photoDelete);if(!record||disposed)return;const result=await album.remove(record.id);if(disposed)return;if(result.ok){undoPhoto=record;message='사진을 지웠어요. 되돌릴 수 있어요.';if(photo?.id===record.id){photo=null;$('.atelier-photo-result').hidden=true;}}else message=result.message;await refreshAlbum();renderChrome();return;}
    const action=b.dataset.studio;
    if(action==='undo'||action==='redo'){selectEdit(action==='undo'?history.undo():history.redo(),null,{record:false});}
    else if(action==='restore')selectEdit(confirmed);
    else if(action==='random'){const edit=randomSlots({slots:draft.slots,dyes:draft.dyes,owned:preview?WARDROBE_ITEMS.map(i=>i.id):(snap?.inventory||[]).map(i=>i.itemId),locks:ws.locks});selectEdit(edit);}
    else if(action==='add-candidate'){if(candidates.length>=3){message='후보는 세 개까지 담아요. 먼저 하나를 빼 주세요.';renderChrome();}else{candidates.push(clone(draft));renderCandidates();}}
    else if(action==='owned'){ws.ownedOnly=!ws.ownedOnly;if(['owned','all'].includes(ws.viewFilter))ws.viewFilter=ws.ownedOnly?'owned':'all';renderItems();renderChrome();remember();}
    else if(action==='show-all'){ws.viewFilter='all';ws.ownedOnly=false;ws.category='all';ws.query='';ws.filter={colors:[],materials:[],styles:[]};ws.groupId='';$('.atelier-search input').value='';render();remember();}
    else if(action==='clear-filters'){ws.query='';ws.category='all';ws.groupId='';ws.filter={colors:[],materials:[],styles:[]};$('.atelier-search input').value='';render();remember();}
    else if(action==='search'){root.dataset.searchOpen=String(root.dataset.searchOpen!=='true');b.setAttribute('aria-expanded',root.dataset.searchOpen);if(root.dataset.searchOpen==='true')$('.atelier-search input').focus();}
    else if(action==='compare'){comparing=!comparing;syncStage();renderChrome();}
    else if(action==='detail'){engine?.setDetail(!engine?.getView?.().detail);renderChrome();renderCandidates();remember();}
    else if(action==='reset-view'){engine?.resetView?.();renderChrome();renderCandidates();remember();}
    else if(action==='reset-dyes')selectEdit({slots:draft.slots,dyes:{}});
    else if(action==='to-looks'){showTab('looks');lookEditor.open=true;$('.atelier-name').focus();}
    else if(action==='new-look'){const keepName=missingEditingLook;editingLook='';missingEditingLook=false;lookFormVersion++;if(!keepName)$('.atelier-name').value='';renderChrome();}
    else if(action==='save-look')await saveLook();
    else if(action==='replace-look')await saveLook({replace:true});
    else if(action==='apply')await wear(clone(draft));
    else if(action==='earn'){remember();if(!busy())onPlay();}
    else if(action==='capture'||action==='capture-save')await capture(action==='capture-save');
    else if(action==='more-photos'){albumPage+=12;await refreshAlbum();}
    else if(action==='retry-photo'){if(photo?.blob&&!localBusy){localBusy=true;renderChrome();try{const record=photo;await album.retry();let result=await album.persist(record.id);if(result.error==='PHOTO_NOT_FOUND')result=await album.add(record.blob,record);if(!disposed){message=result.message;if(result.ok&&result.photo){const saved=await album.get(result.photo.id);if(saved&&!disposed)showPhoto(saved);}await refreshAlbum();}}catch{if(!disposed)message='앨범 저장을 다시 시도하지 못했어요. PNG로 보관해 주세요.';}finally{localBusy=false;if(!disposed)renderChrome();}}}
    else if(action==='retry')await run(onRetry,{recovery:true});
    else if(action==='discard'){serverCompletion=null;await run(async()=>{const result=await onDiscard();if(!disposed)message='최신 차림을 불러왔어요. 입어 보던 차림은 남아 있어요.';return result;},{recovery:true});}
    else if(action==='retry-stage')await mountStage();
    else if(action==='undo-save'){if(undoLooks&&snap?.revision!==undoLooks.revision){message='다른 변경이 있어 바로 되돌릴 수 없어요. 최신 차림을 먼저 확인해 주세요.';renderChrome();}else if(undoLooks){const previous=undoLooks;const result=await saveLooks(previous.looks,'마지막 차림 변경을 되돌렸어요.',{keepUndo:false});if(result)undoLooks=null;renderChrome();}}
    else if(action==='undo-photo'){if(undoPhoto){const record=undoPhoto,result=await album.add(record.blob,record);if(result.ok)undoPhoto=null;message=result.ok?'지운 사진을 되돌렸어요.':result.message;await refreshAlbum();renderChrome();}}
    else if(action==='create-group'){const name=$('[data-field="group-name"]').value.trim();if(name&&ws.groups.length<16){ws.groups.push({id:crypto.randomUUID(),name,icon:$('[data-field="group-icon"]').value,itemIds:[]});$('[data-field="group-name"]').value='';renderGroups();renderItems();remember();}}
    else if(action==='prepare-batch')prepareBatch();
    else if(action==='apply-batch')await applyBatch();
    else if(action==='cancel-batch')$('.atelier-batch-confirm').hidden=true;
  }
  function input(event){
    const target=event.target;
    if(target.matches('.atelier-search input')){ws.query=target.value.trim();renderItems();remember();}
    if(target.dataset.dyeSlot){if(!engine||fault)return;const slot=target.dataset.dyeSlot,index=Number(target.dataset.dyeIndex),defaults=engine?.getDyeDefaults?.(draft.slots)||{},dyes=clone(draft.dyes),colors=[...(dyes[slot]||defaults[slot]||[wardrobeItem(draft.slots[slot])?.color||'#ffffff','#ece4d7'])];colors[index]=target.value;selectEdit({slots:draft.slots,dyes:{...dyes,[slot]:colors}});}
    if(target.dataset.field==='zoom'){engine?.setZoom?.(Number(target.value));renderCandidates();soonRemember();}
  }
  function changed(event){
    const target=event.target,field=target.dataset.field;
    if(target.dataset.batchLook){if(target.checked)batchIds.add(target.dataset.batchLook);else batchIds.delete(target.dataset.batchLook);return;}
    if(target.dataset.groupName){const g=ws.groups.find(g=>g.id===target.dataset.groupName);if(g)g.name=target.value.trim()||'내 모음';renderGroups();renderItems();remember();return;}
    if(target.dataset.groupIcon){const g=ws.groups.find(g=>g.id===target.dataset.groupIcon);if(g)g.icon=target.value;renderGroups();renderItems();remember();return;}
    if(target.dataset.shortcut){const value=target.value.toLowerCase();if(/^[a-z0-9]$/.test(value))ws.preferences.shortcuts[target.dataset.shortcut]=value;remember();return;}
    if(field==='photo-look'){const look=looks().find(l=>l.id===target.value);if(look){selectEdit(lookEdit(look),null,{keepEditing:false});message='구도는 그대로 두고 찍을 차림을 바꿨어요.';renderChrome();}return;}
    if(field==='sort')ws.sort=target.value;else if(field==='show-hidden')ws.showHidden=target.checked;else if(field==='group-id')ws.groupId=target.value;
    else if(field==='background'){ws.background=target.value;engine?.setBackground?.(ws.background);renderCandidates();}
    else if(field==='pose'){ws.pose=target.value;engine?.setPose?.(ws.pose);renderCandidates();}
    else if(field==='fontScale')ws.preferences.fontScale=Number(target.value);
    else if(['reducedMotion','highContrast','shortcutsEnabled','gamepad'].includes(field)){ws.preferences[field]=target.checked;if(field==='gamepad')pollGamepad();}
    else return;
    renderChrome();if(['sort','show-hidden','group-id'].includes(field))renderItems();remember();
  }
  function keydown(event){
    const tab=event.target.closest('[role="tab"]');
    if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=$$('[role="tab"]'),i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showTab(tabs[next].dataset.studioTab);tabs[next].focus();return;}
    if(!ws.preferences.shortcutsEnabled||event.target.closest('input,textarea,select,[contenteditable=true]')||event.altKey)return;
    const key=event.key.toLowerCase(),keys=ws.preferences.shortcuts;let action='';
    if(event.ctrlKey||event.metaKey){if(key===keys.undo)action=event.shiftKey?'redo':'undo';else if(key===keys.redo)action='redo';}else if(key===keys.capture)action='capture';else if(key===keys.reset)action='reset-view';
    if(action){event.preventDefault();const b=$(`[data-studio="${action}"]`);if(b&&!b.disabled)b.click();}
  }
  function pollGamepad(){
    cancelAnimationFrame(gamepadFrame);gamepadFrame=0;if(disposed||!ws.preferences.gamepad||!navigator.getGamepads?.().some(Boolean))return;
    const loop=now=>{if(disposed||!ws.preferences.gamepad)return;const pad=navigator.getGamepads?.().find(Boolean);if(!pad)return;if(now-gamepadLast>220){const b=pad.buttons||[];let used=false;if(b[0]?.pressed){document.activeElement?.click();used=true;}else if(b[1]?.pressed){$('[data-studio="undo"]').click();used=true;}else if(b[2]?.pressed){$('[data-studio="redo"]').click();used=true;}else if(b[3]?.pressed){$('[data-studio="capture"]').click();used=true;}else{const direction=b[12]?.pressed?-1:b[13]?.pressed?1:b[14]?.pressed?-1:b[15]?.pressed?1:Math.abs(pad.axes?.[1]||0)>.6?Math.sign(pad.axes[1]):0;if(direction){const list=$$('button:not(:disabled),input,select,summary,a[href]').filter(el=>el.getClientRects().length),index=list.indexOf(document.activeElement);list[(index+direction+list.length)%list.length]?.focus();used=true;}}if(used)gamepadLast=now;}gamepadFrame=requestAnimationFrame(loop);};gamepadFrame=requestAnimationFrame(loop);
  }
  function viewChanged(event){if(!event.target.closest('.atelier-canvas'))return;soonRemember();if(candidates.length)renderCandidates();}
  const pauseThumbnails=()=>thumbQueue.postpone(),resumeThumbnails=()=>{if(!document.hidden)thumbQueue.resume();};
  const thumbnailError=event=>{const target=thumbnailTargets.get(event.target);if(!target||!event.target.src.includes('/wardrobe-thumbnails-v8/'))return;wardrobeThumbnailCache.delete(target.key);event.target.src='assets/mongle.webp';if(target.visible)queueThumbnail(target);};
  root.addEventListener('error',thumbnailError,true);
  for(const type of ['pointerdown','pointermove','wheel','keydown','input'])root.addEventListener(type,pauseThumbnails,{passive:true});
  document.addEventListener('visibilitychange',resumeThumbnails);
  root.addEventListener('click',clicked);root.addEventListener('input',input);root.addEventListener('change',changed);root.addEventListener('keydown',keydown);root.addEventListener('scroll',soonRemember,true);root.addEventListener('pointerup',viewChanged);window.addEventListener('gamepadconnected',pollGamepad);
  $('.atelier-search input').value=ws.query;root.dataset.searchOpen=String(!!ws.query);
  for(const field of ['sort','pose','background','fontScale'])$(`[data-field="${field}"]`).value=field==='fontScale'?ws.preferences.fontScale:ws[field];
  for(const field of ['show-hidden','reducedMotion','highContrast','shortcutsEnabled','gamepad'])$(`[data-field="${field}"]`).checked=field==='show-hidden'?ws.showHidden:ws.preferences[field];
  for(const input of $$('[data-shortcut]'))input.value=ws.preferences.shortcuts[input.dataset.shortcut];
  function dispose(){
    if(disposed)return;remember();disposed=true;serverCompletion=null;generation++;albumToken++;clearTimeout(saveTimer);cancelAnimationFrame(gamepadFrame);thumbQueue.dispose();thumbnailObserver.disconnect();thumbnailTargets.clear();root.removeEventListener('error',thumbnailError,true);for(const type of ['pointerdown','pointermove','wheel','keydown','input'])root.removeEventListener(type,pauseThumbnails);document.removeEventListener('visibilitychange',resumeThumbnails);stageAbort?.abort();engine?.dispose();engine=null;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();
    root.removeEventListener('click',clicked);root.removeEventListener('input',input);root.removeEventListener('change',changed);root.removeEventListener('keydown',keydown);root.removeEventListener('scroll',soonRemember,true);root.removeEventListener('pointerup',viewChanged);window.removeEventListener('gamepadconnected',pollGamepad);album.close?.();root.remove();
  }
  // Single, undyed catalog items have the exact same authored view for every
  // learner. Ship those pixels once; only personal combinations need GPU work.
  for(const item of WARDROBE_ITEMS)wardrobeThumbnailCache.set(cacheKey({slots:{[item.slot]:item.id},dyes:{}}),catalogThumbnail(item.id));
  render();queueMicrotask(()=>{if(!disposed){$('.atelier-items').scrollLeft=ws.scroll.itemsLeft;$('.atelier-items').scrollTop=ws.scroll.itemsTop;$('.atelier-looks').scrollTop=ws.scroll.looksTop;const panel=root.closest('.panel-dialog');if(panel)panel.scrollTop=ws.scroll.panelTop;void mountStage();if(ws.tab==='photo')void refreshAlbum();pollGamepad();}});
  return {element:root,update:adopt,dispose,metrics:()=>({tab:ws.tab,draft:{...draft.slots},dyes:clone(draft.dyes),confirmed:{...confirmed.slots},confirmedDyes:clone(confirmed.dyes),owned:ownsEdit(draft),pending:!!pending,disposed,stage:engine?.metrics(),thumbnailCount:thumbnails.size,thumbnailQueue:thumbQueue.metrics(),lookCount:looks().length,photoReady:!!photo,photoStale:photo?.stale||false,history:{undo:history.canUndo,redo:history.canRedo},workbench:clone(ws),candidates:candidates.length,albumCount:albumRows.length,albumStatus:album.status,storage:store.status})};
}

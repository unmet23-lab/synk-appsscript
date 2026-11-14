// 문의 사진(운영 조각 8-B) 화면: 묻기 칸의 「사진 붙이기」 · 미리 보기 칩, 보낸 문의 줄의 사진 띠, 직원 화면의 문의 사진.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {journalModel,messagePictures} from './public/pulse-app/room-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {journalView,sayPhotoChips} from './public/pulse-app/film-views.mjs';
import {setLocale} from './public/pulse-app/i18n.mjs';
import en from './public/pulse-app/i18n/en.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const T=hour=>new Date(Date.UTC(2026,10,15,hour)).toISOString();
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
const asset=(id,extra={})=>({id,fileName:id.slice(0,4)+'.png',mimeType:'image/png',byteSize:10,url:'/pulse/api/studio/media/'+id,...extra});
const project=({messages=[],assets=ids.map(id=>asset(id)),flag=true}={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',revision:4,versions:[],requestFlow:true,messages,
  studio:{assets,scenes:[],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
    request:{status:'submitted',number:'P-2026-ABCD',submittedAt:T(1),answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...(flag?{messagePhotos:true}:{})}}});
const ask=(id,extra={})=>({id,author:'customer',authorName:'합성',action:'support',visibility:'customer',text:'',at:T(3),resolved:false,...extra});

test('the ask box offers photos only in a real customer room whose server takes them',()=>{
  const room=s=>projectView({mode:'customer',tab:'overview',live:{},versionId:'',...s});
  const on=room({project:project()});
  assert.equal(on.split('data-say-photos').length-1,1,'one photo picker');
  assert.match(on,/<input type="file" class="sr" accept="image\/png,image\/jpeg" multiple data-say-photos data-mutate>/,'the picker locks while a question is sending (setBusy locks [data-mutate])');
  assert.match(on,/<ul class="sx-j-chips" data-say-chips aria-label="붙인 사진" hidden><\/ul>/);
  assert.match(on,/data-say-note role="status">JPG · PNG 4장까지</,'the count is read out when it changes');
  const box=on.slice(on.indexOf('data-form="support"'),on.indexOf('</form>',on.indexOf('data-form="support"')));
  assert.doesNotMatch(box,/ required/,'a photo alone can be sent, so the words are not required');
  assert.doesNotMatch(box,/name="photos"/,'the picker has no name: drafts never store or restore it');
  const old=room({project:project({flag:false})});
  assert.doesNotMatch(old,/data-say-photos|data-say-chips/,'an older server: no picker');
  assert.match(old,/maxlength="3000" required placeholder=/,'an older server: words stay required');
  assert.match(read('./public/pulse-app/views.mjs'),/attach:s\.mode==='customer'&&!s\.demo&&!!s\.project\?\.studio\?\.request\?\.messagePhotos,/,'only the customer themselves picks photos — never the demo or a staff preview of the room');
  assert.doesNotMatch(journalView({pinned:{asks:[],next:''},items:[],latestAt:0}),/data-say-photos/,'the example journal (demo-film) draws no picker');
});

test('chips: one per photo, escaped, each with a numbered remove button that locks while sending',()=>{
  const html=sayPhotoChips([{src:'blob:http://localhost/a'},{src:'blob:"x"<y>'}]);
  assert.equal(html.split('<li>').length-1,2);
  assert.match(html,/<img src="blob:http:\/\/localhost\/a" alt="" decoding="async">/);
  assert.match(html,/src="blob:&quot;x&quot;&lt;y&gt;"/,'the address is escaped');
  assert.match(html,/data-say-photo-remove="0" data-mutate aria-label="사진 1 빼기"/);
  assert.match(html,/data-say-photo-remove="1" data-mutate aria-label="사진 2 빼기"/);
  assert.match(html,/<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">/,'the cross is drawn, not a font glyph');
  assert.equal(sayPhotoChips([]),'');
});

test('a sent question shows its photos in the journal line; missing or non-image assets are left out, four at most',()=>{
  const p=project({messages:[ask('m1',{text:'이 색 괜찮나요?',photos:ids.slice(0,2)}),ask('m2',{at:T(4),photos:[ids[2]]}),ask('m3',{at:T(5),text:'글만'})]});
  const j=journalModel(p),by=id=>j.items.find(item=>item.id===id);
  assert.deepEqual(by('m:m1').pictures,ids.slice(0,2).map(id=>'/pulse/api/studio/media/'+id));
  assert.deepEqual(by('m:m2').pictures,['/pulse/api/studio/media/'+ids[2]]);
  assert.deepEqual(by('m:m3').pictures,[]);
  const odd={...p,studio:{...p.studio,assets:[asset(ids[0]),asset(ids[1],{mimeType:'video/mp4'}),asset(ids[2],{url:''}),asset(ids[3]),asset(ids[4])]}};
  assert.deepEqual(messagePictures(odd,{photos:[ids[0],'missing',ids[1],ids[2],ids[3],ids[4],ids[0],ids[3]]}),[ids[0],ids[3],ids[4],ids[0]].map(id=>'/pulse/api/studio/media/'+id),'five usable pictures draw as four');
  assert.deepEqual(messagePictures(odd,{photos:'bad'}),[]);assert.deepEqual(messagePictures(odd,null),[]);
  const html=journalView(j,{all:true});
  const row=id=>{const at=html.indexOf(`data-journal-id="${id}"`);return html.slice(at,html.indexOf('</li>',at));};
  assert.match(row('m:m1'),/<p class="sx-body sx-j-text">이 색 괜찮나요\?<\/p><figure class="sx-j-shots" data-count="2" aria-label="사진 2장"><div><img src="\/pulse\/api\/studio\/media\/11111111/);
  assert.match(row('m:m2'),/<figure class="sx-j-shots" data-count="1" aria-label="사진 1장">/,'a photo-only question still draws its photo');
  assert.doesNotMatch(row('m:m1'),/sx-j-wip|작업 중인 화면/,'only work-in-progress pictures carry that caption');
  assert.equal(row('m:m1').split('data-keep-pic').length-1,2,'question photos are kept across redraws (media is no-store)');
  assert.doesNotMatch(row('m:m3'),/sx-j-shots/);
});

test('progress pictures keep their caption and no group name',()=>{
  const p=project();p.studio.request.progressFeed=true;p.studio.request.progress=[{id:'n1',state:'posted',stage:'make',text:'톤을 맞추는 중',at:T(2),postedAt:T(2),assets:[ids[0]]}];
  const html=journalView(journalModel(p),{all:true});
  assert.match(html,/<figure class="sx-j-shots" data-count="1"><div><img[^>]+><\/div><figcaption class="sx-small sx-j-wip">작업 중인 화면이에요 · 완성본이 아니에요<\/figcaption><\/figure>/);
});

test('staff screens: the question photos open from the staff media route and never become the card picture',()=>{
  const views=read('./public/pulse-app/views.mjs');
  assert.match(views,/const commentPhotos=\(s,m\)=>/);
  assert.match(views,/<\/div><p>\$\{esc\(m\.text\)\}<\/p>\$\{commentPhotos\(s,m\)\}<div class="button-row">/);
  assert.match(views,/s\.mode==='staff'\?`\/api\/client-projects\/\$\{encodeURIComponent\(s\.project\.id\)\}\/studio\/media\//);
  assert.match(views,/asset\.purpose!=='message'&&asset\.mimeType\?\.startsWith\(kind\+'\/'\)/,'the direction picker leaves question photos out');
  const room=read('./public/pulse-app/room-view.mjs');
  assert.match(room,/asset\?\.id&&asset\.purpose!=='message'&&String\(asset\.mimeType/,'question photos are not the staff card picture');
  assert.match(views,/alt="문의 사진 \$\{i\+1\}" loading="lazy" decoding="async" data-keep-pic>/);
  const desk=read('./public/client-projects.js');
  assert.match(desk,/alt="고객 문의 사진 \$\{i\+1\}" loading="lazy" decoding="async" data-cd-keep>/);
  assert.match(desk,/function clientDeskPanel\(\)\{cdKeepPhotos\(\);/,'the desk keeps already loaded question photos when it redraws');
  assert.match(desk,/<p>\$\{escape\(m\.text\)\}<\/p>\$\{cdMessagePhotos\(p,m\)\}/);
  assert.match(desk,/function cdMessagePhotos\(p,m\)\{const ids=Array\.isArray\(m\.photos\)\?m\.photos\.filter\(id=>typeof id==='string'&&\/\^\[a-f0-9-\]\{36\}\$\/i\.test\(id\)\):\[\];/);
});

test('every new customer sentence has English, with plural forms where a count is shown',async()=>{
  for(const key of ['사진 붙이기','JPG · PNG 4장까지','사진 {count}장 · 4장까지','붙인 사진','사진 {n} 빼기','사진 {count}장','사진은 한 번에 4장까지 보낼 수 있어요.','묻고 싶은 것을 적거나 사진을 붙여 주세요.','사진 {count}장과 함께 문의를 보냈어요. 답이 오면 알려 드려요.','문의에는 사진(JPG · PNG)만 붙일 수 있어요.','사진은 한 장에 15MB까지 붙일 수 있어요.'])assert.ok(Object.hasOwn(en,key),key);
  assert.deepEqual(Object.keys(en['사진 {count}장']).sort(),['one','other']);
  assert.deepEqual(Object.keys(en['사진 {count}장 · 4장까지']).sort(),['one','other']);
  assert.deepEqual(Object.keys(en['사진 {count}장과 함께 문의를 보냈어요. 답이 오면 알려 드려요.']).sort(),['one','other'],'one photo reads “Question and photo sent.”');
  await setLocale('en');
  try{
    const p=project({messages:[ask('m1',{photos:[ids[0]]})]});
    const html=journalView(journalModel(p),{all:true,attach:true});
    assert.match(html,/aria-label="1 photo"/);assert.match(html,/>Attach photos</);assert.match(html,/aria-label="Attached photos"/);
    assert.match(sayPhotoChips([{src:'blob:a'}]),/aria-label="Remove photo 1"/);
  }finally{await setLocale('ko');}
});

test('the app keeps picked photos in memory, uploads each once, then sends their ids with the words',()=>{
  const app=read('./public/pulse-app/app.mjs');
  assert.match(app,/const messagePhotoUpload=file=>request\('\/pulse\/api\/studio\/message-photo',\{\.\.\.options\(\),file,headers:\{'Content-Type':file\.type,'X-File-Name':encodeURIComponent\(photoName\(file\)\)\}\}\);/);
  assert.match(app,/for\(const item of items\)\{if\(item\.id\)continue;const uploaded=await messagePhotoUpload\(item\.file\);accept\(uploaded\);item\.id=uploaded\.photo\.id;\}/,'a retry does not upload twice');
  assert.match(app,/if\(error\.status===409\)for\(const item of items\)item\.id='';throw error;/,'a refused photo is uploaded fresh next time');
  assert.match(app,/restore\(main\);drawSay\(sayPick,sayNote\);mountScreens\(\);/,'every redraw refills the chips and keeps the picker node (a pick made while the dialog was open still lands)');
  // 옮겨 쓴 칸은 보내는 동안의 잠금 표시를 버린다 — 넷을 보낸 뒤 칸이 풀린다(브라우저 확인 4). 장수 안내는 옛 노드를 옮기고 글이 바뀔 때만 고친다.
  assert.match(app,/if\(kept&&fresh&&kept!==fresh&&!kept\.isConnected\)\{delete kept\.dataset\.wasDisabled;fresh\.replaceWith\(kept\);\}/);
  assert.match(app,/if\(keptNote&&freshNote&&keptNote!==freshNote&&!keptNote\.isConnected\)freshNote\.replaceWith\(keptNote\);/);
  assert.match(app,/if\(note&&note\.textContent!==noteText\)note\.textContent=noteText;/);
  assert.match(app,/if\(keepPics\.size\)for\(const fresh of main\.querySelectorAll\('img\[data-keep-pic\]'\)\)\{const old=keepPics\.get\(fresh\.getAttribute\('src'\)\);if\(old\)\{keepPics\.delete\(fresh\.getAttribute\('src'\)\);fresh\.replaceWith\(old\);\}\}/,'question photos already shown are moved, not fetched again (media is no-store)');
  assert.match(app,/\|\|'',say:previousFocus\.dataset\.sayPhotoRemove\?\?'',look:previousFocus\.dataset\.roomLookPick\?/);
  assert.match(app,/if\(focusKey\.say!==''\)\{const chips=main\.querySelectorAll\('\[data-say-photo-remove\]'\);\(chips\[Math\.min\(Number\(focusKey\.say\),chips\.length-1\)\]\|\|main\.querySelector\('\[data-say-photos\]'\)\)\?\.focus/,'a live redraw keeps the remove-button focus');
  assert.match(app,/function sayItems\(\)\{if\(say\.key!==identity\(\)\)sayClear\(\);return say\.items;\}/,'another project or person never inherits the photos');
  assert.match(app,/URL\.revokeObjectURL/);
  // 이름 끝 맞추기: 서버는 끝이 형식과 맞아야 받는다.
  const photoName=new Function(`return ${app.match(/const photoName=(.*?);\r?\n/)[1]}`)();
  assert.equal(photoName({name:'IMG_0001.JPEG',type:'image/jpeg'}),'IMG_0001.JPEG');
  assert.equal(photoName({name:'image',type:'image/png'}),'image.png');
  assert.equal(photoName({name:'png',type:'image/png'}),'png.png','a bare word is a name, not an ending');
  assert.equal(photoName({name:'',type:'image/jpeg'}),'photo.jpg');
  assert.equal(photoName({name:'a.HEIC',type:'image/jpeg'}),'a.HEIC.jpg');
  assert.equal(photoName({name:'shot.jpg',type:'image/png'}),'shot.jpg.png');
});

// 「제2의 나」 내 사진으로 만들기(2026-11-04 시범 화면) — 설계 docs/제2의나_사진아바타_일괄처리_설계_20261103.md 1 · 2 · 6절, 동의 글 me2-photo-consent.json.
// · 초대한 성인만 본다(서버 status가 ok일 때). 앱 껍데기는 이 모듈을 그때 동적으로 불러 내 정보 시트에 줄 하나를 더한다.
// · 사진 고르기는 자유다(11-03 유호님 「사진을 고르는건 자유 … 엄격하게해놓으면 스트레스」) — 작아도 흐려도 받아서 손본다. 얼굴이 여럿이면 「누가 나예요?」를 한 번 묻고, 못 찾으면 「그래도 이 사진으로」.
// · 얼굴 찾기는 이 기기에서만 한다(vendor/face-api — 그림이 서버로 가기 전). 고른 사진은 긴 변 1200 JPEG로 줄여 서버가 준 주소로 올린다. EXIF는 캔버스에서 사라진다.
// · 화면에 점수 · 탈락 · 등급은 나오지 않는다. 학생은 만든 판 가운데 언제든 고르고, 「다른 사진으로」를 누를 수 있다.
// · 움직임은 「현상 중」 인화지 하나뿐이고, 움직임 줄이기에서는 멈춘다. 마스코트는 쓰지 않는다.
import {currentLang,onLang} from '../brand-opening/world-lang.mjs';

if(globalThis.document&&!document.querySelector('[data-me2-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./me2-photo.css',import.meta.url).href;style.dataset.me2Style='';document.head.append(style);}

const CONSENT_URL=new URL('./me2-photo-consent.json',import.meta.url);
const LONG_EDGE=1200,JPEG_Q=.9,MAX_BYTES=3*1024*1024,POLL_MS=45000,SMALL_FACE=.2,CROP_FACTOR=3.2;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

// 화면 글 — 한 자리 한 언어. 빠진 언어는 한국어로 보인다.
const TEXT={
 ko:{title:'내 모습',row:'내 사진으로 「제2의 나」 만들기',rowNote:'초대받은 시범이에요',
  noteTitle:'알려 주고 싶은 것',noteHint:'안 골라도 돼요. 고르면 사진이 더 잘 나와요.',glasses:'안경을 써요',head_cover:'머리를 가려요',facial_hair:'수염을 그대로 둘래요',wheelchair:'휠체어를 타요',long_hair:'머리가 길어요',buildSmall:'작은 체격',buildLarge:'큰 체격',
  more:'자세히 보기',agreeGo:'사진 고르러 가기',prepared:'준비된 얼굴에서 고르기',preparedDone:'준비된 얼굴로 시작할게요. 사진은 언제든 다시 올 수 있어요.',
  pickTitle:'사진 한 장을 골라요',pickHint:'혼자 · 정면 · 밝게 찍으면 더 잘 나와요.',camera:'지금 찍기',album:'앨범에서 고르기',
  redo:'사진이 잘 안 나왔대요. 한 장만 다시 골라 줄래요?',refused:'이 사진으로는 만들 수 없어요. 다른 사진으로 해 볼까요?',busy:'지금은 사진관이 붐벼요. {date}부터 찍을 수 있어요.',limit:'이번 주에는 사진을 충분히 만들었어요. 다음 주에 다시 올 수 있어요.',
  whoTitle:'누가 나예요?',whoHint:'사진에서 나를 눌러 주세요.',noFace:'얼굴이 잘 안 보여요.',anyway:'그래도 이 사진으로',otherPick:'다른 사진 고르기',useThis:'이 사진으로',reading:'사진을 살펴보는 중이에요',loading:'불러오는 중이에요',cantOpen:'이 사진을 열지 못했어요. 다른 사진을 골라 주세요.',
  sending:'사진을 보내는 중이에요',sendFail:'사진을 보내지 못했어요. 다시 해 볼까요?',retry:'다시 보내기',
  developing:'사진 현상 중',developingNote:'보통 몇 시간, 늦어도 내일이면 나와요. 창을 닫아도 돼요.',
  isThisMe:'이게 나?',arrived:'사진 나왔어요!',strong:'기본',natural:'더 자연스럽게',younger:'더 어리게',lowNote:'사진에 따라 덜 닮게 나올 때가 있어요. 마음에 안 들면 다른 사진으로 해 봐요.',thisOne:'이걸로 할게요',other:'다른 사진으로',lookReset:'새 모습을 고르면 옷장의 옷과 머리는 사라져요. 새 모습으로 다시 입어 볼 수 있어요.',
  card:'학생증',cardName:'제2의 나',cardRole:'대학교 1학년',changeFace:'세 판 다시 보기',back:'돌아가기',newerDeveloping:'새 사진을 현상 중이에요. 나오면 고를 수 있어요.',
  wardrobe:'옷장',album2:'추억 사진',order:'입어 보기',orderHair:'미용실 예약',orderScene:'현상 맡기기',shipping:'배송 중',salon:'미용실 예약 중',developingShort:'현상 중',delayed:'배송 지연 — {date} 도착 예정',failedItem:'이번에는 잘 안 됐어요',again:'다시 해 볼게요',
  wear:'이걸로 입기',wearing:'입는 중',takeOff:'벗기',redoItem:'이 사진 이상해요',redoLook:'다시 입어 보기',newChip:'도착',fullAlbum:'앨범이 다 찼어요.',
  eraseOpen:'사진으로 만든 모습 지우기',eraseAsk:'만든 모습과 그 사진들을 모두 지우고 준비된 얼굴로 돌아가요. 되돌릴 수 없어요.',eraseYes:'모두 지우기',eraseNo:'그대로 두기',erased:'지웠어요. 준비된 얼굴로 돌아갔어요.',
  off:'지금은 사진관이 잠시 쉬고 있어요.',error:'잠시 연결이 안 됐어요. 조금 뒤에 다시 해 주세요.',close:'닫기'},
 en:{title:'My look',row:'Make your “second me” from your own photo',rowNote:'Invite-only pilot',
  noteTitle:'Anything you want us to know',noteHint:'Optional. It helps the photos come out better.',glasses:'I wear glasses',head_cover:'I cover my hair',facial_hair:'Keep my facial hair',wheelchair:'I use a wheelchair',long_hair:'I have long hair',buildSmall:'Smaller build',buildLarge:'Larger build',
  more:'Read more',agreeGo:'Choose a photo',prepared:'Pick a ready-made face',preparedDone:'You can start with a ready-made face and come back any time.',
  pickTitle:'Choose one photo',pickHint:'Alone, facing the camera, in good light works best.',camera:'Take one now',album:'Choose from album',
  redo:'That photo did not come out well. Could you choose one more?',refused:'We can’t make it from this photo. Want to try another one?',busy:'The photo studio is busy right now. You can take photos again from {date}.',limit:'You have made plenty of photos this week. Come back next week.',
  whoTitle:'Which one is you?',whoHint:'Tap yourself in the photo.',noFace:'We can’t see a face clearly.',anyway:'Use this photo anyway',otherPick:'Choose another photo',useThis:'Use this photo',reading:'Looking at your photo',loading:'Loading',cantOpen:'We couldn’t open this photo. Please choose another one.',
  sending:'Sending your photo',sendFail:'We couldn’t send your photo. Try again?',retry:'Send again',
  developing:'Developing your photo',developingNote:'It usually takes a few hours, tomorrow at the latest. You can close this window.',
  isThisMe:'Is this me?',arrived:'Your photo is ready!',strong:'Default',natural:'More natural',younger:'Younger',lowNote:'Some photos come out less like you. If you don’t like it, try another photo.',thisOne:'This is the one',other:'Try another photo',lookReset:'If you choose a new look, the clothes and hairstyles in your wardrobe will go away. You can try them on again with your new look.',
  card:'Student ID',cardName:'Second me',cardRole:'First-year university student',changeFace:'See all three again',back:'Back',newerDeveloping:'Your new photo is developing. You can choose when it’s ready.',
  wardrobe:'Wardrobe',album2:'Memory photos',order:'Try it on',orderHair:'Book the salon',orderScene:'Send to develop',shipping:'On its way',salon:'Salon booked',developingShort:'Developing',delayed:'Delayed — arriving {date}',failedItem:'This one didn’t work out',again:'Try again',
  wear:'Wear this',wearing:'Wearing',takeOff:'Take off',redoItem:'This photo looks wrong',redoLook:'Try it on again',newChip:'New',fullAlbum:'Your album is full.',
  eraseOpen:'Erase the look made from my photo',eraseAsk:'This erases your look and all its photos and returns you to a ready-made face. It can’t be undone.',eraseYes:'Erase everything',eraseNo:'Keep it',erased:'Erased. You’re back to a ready-made face.',
  off:'The photo studio is closed for now.',error:'Connection problem. Please try again in a moment.',close:'Close'},
 mn:{title:'Миний дүр',row:'Өөрийн зургаар «хоёр дахь би» дүрээ бүтээх',rowNote:'Урилгаар оролцох туршилт',
  noteTitle:'Бидэнд хэлэх зүйл',noteHint:'Заавал биш. Сонговол зураг илүү сайн гарна.',glasses:'Нүдний шил зүүдэг',head_cover:'Толгойн алчуур зүүдэг',facial_hair:'Сахлаа хэвээр үлдээнэ',wheelchair:'Тэргэнцэр ашигладаг',long_hair:'Урт үстэй',buildSmall:'Жижиг биетэй',buildLarge:'Том биетэй',
  more:'Дэлгэрэнгүй',agreeGo:'Зураг сонгох',prepared:'Бэлэн царайнаас сонгох',preparedDone:'Бэлэн царайгаар эхэлье. Зургаа хүссэн үедээ дахин оруулж болно.',
  pickTitle:'Нэг зураг сонгоорой',pickHint:'Ганцаараа, урагшаа харж, гэрэл сайтай авсан зураг хамгийн сайн гардаг.',camera:'Одоо зураг авах',album:'Цомгоос сонгох',
  redo:'Зураг сайн гарсангүй. Дахин нэг зураг сонгох уу?',refused:'Энэ зургаар бүтээх боломжгүй. Өөр зураг сонгох уу?',busy:'Одоо зургийн газар завгүй байна. Дахин зураг авхуулах өдөр: {date}.',limit:'Энэ долоо хоногт хангалттай олон зураг бүтээлээ. Ирэх долоо хоногт дахин ирээрэй.',
  whoTitle:'Аль нь та вэ?',whoHint:'Зураг дээрээс өөрийгөө сонгоно уу.',noFace:'Царай тод харагдахгүй байна.',anyway:'Гэсэн ч энэ зургийг ашиглах',otherPick:'Өөр зураг сонгох',useThis:'Энэ зургийг ашиглах',reading:'Зургийг шалгаж байна',loading:'Ачаалж байна',cantOpen:'Энэ зургийг нээж чадсангүй. Өөр зураг сонгоно уу.',
  sending:'Зургийг илгээж байна',sendFail:'Зургийг илгээж чадсангүй. Дахин оролдох уу?',retry:'Дахин илгээх',
  developing:'Зураг угааж байна',developingNote:'Ихэвчлэн хэдэн цагийн дотор, хамгийн удаандаа маргааш гарна. Цонхоо хааж болно.',
  isThisMe:'Энэ би мөн үү?',arrived:'Зураг гарлаа!',strong:'Үндсэн',natural:'Илүү байгалийн төрх',younger:'Илүү залуу',lowNote:'Зургаас хамаарч төдийлөн адилгүй гарах үе бий. Таалагдахгүй бол өөр зураг сонгоорой.',thisOne:'Үүнийг сонгоё',other:'Өөр зураг сонгох',lookReset:'Шинэ дүр сонговол шүүгээн дэх хувцас, үс алга болно. Шинэ дүрээрээ дахин өмсөж үзэж болно.',
  card:'Оюутны үнэмлэх',cardName:'Хоёр дахь би',cardRole:'Их сургуулийн 1-р курс',changeFace:'Гурван зургийг дахин харах',back:'Буцах',newerDeveloping:'Шинэ зургийг угааж байна. Гарахаар нь сонгож болно.',
  wardrobe:'Хувцасны шүүгээ',album2:'Дурсамжийн зураг',order:'Өмсөж үзэх',orderHair:'Үсчинд цаг авах',orderScene:'Угаалгах',shipping:'Хүргэлтэд гарсан',salon:'Үсчинд цаг авсан',developingShort:'Угааж байна',delayed:'Хүргэлт хоцорч байна — ирэх өдөр: {date}',failedItem:'Энэ удаад бүтсэнгүй',again:'Дахин оролдох',
  wear:'Үүнийг өмсөх',wearing:'Өмссөн',takeOff:'Тайлах',redoItem:'Энэ зураг хачин байна',redoLook:'Дахин өмсөж үзэх',newChip:'Ирлээ',fullAlbum:'Цомог дүүрсэн байна.',
  eraseOpen:'Зургаар бүтээсэн дүрийг устгах',eraseAsk:'Бүтээсэн дүр болон бүх зургийг устгаж, бэлэн царай руу буцна. Буцаах боломжгүй.',eraseYes:'Бүгдийг устгах',eraseNo:'Хэвээр үлдээх',erased:'Устгалаа. Бэлэн царай руу буцлаа.',
  off:'Одоогоор зургийн газар түр амарч байна.',error:'Холболт түр тасарлаа. Хэсэг хугацааны дараа дахин оролдоорой.',close:'Хаах'},
};
const ITEMS={
 en:{'hair-comma':'Comma hair','hair-layered':'Layered cut','hair-ash':'Ash-brown dye','outfit-denim':'Denim jacket','outfit-vest':'Shirt and knit vest','outfit-bomber':'Bomber jacket','acc-glasses':'Silver-rim glasses','acc-cap':'Baseball cap','s1e01-kimchi':'Episode 1, the restaurant — Kimchi!','s1e01-fight':'Episode 1, the restaurant — Fighting!'},
 mn:{'hair-comma':'Таслал хэлбэрийн үс','hair-layered':'Шатласан засалт','hair-ash':'Үнсэн хүрэн будаг','outfit-denim':'Жинсэн хүрэм','outfit-vest':'Цамц, сүлжмэл хантааз','outfit-bomber':'Бомбер хүрэм','acc-glasses':'Мөнгөн хүрээтэй нүдний шил','acc-cap':'Бейсболын малгай','s1e01-kimchi':'1-р анги, хоолны газар — Кимчи!','s1e01-fight':'1-р анги, хоолны газар — Файтинг!'},
};
const VARIANTS=['strong','natural','younger'];
const GROUP_MARK={hair:'Hair',outfit:'Outfit',acc:'Accessory'};
const dateText=(value,lang)=>{try{return new Intl.DateTimeFormat(lang==='en'?'en-US':lang==='mn'?'mn-MN':'ko-KR',{month:'long',day:'numeric',timeZone:'Asia/Seoul'}).format(new Date(value));}catch{return '';}};

async function sha256Hex(bytes){const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}

/** 얼굴 찾기 — 이 기기에서만. 도구를 못 읽거나 실패하면 null(그러면 묻지 않고 받는다 — 막지 않는다). */
let facesReady=null;
function loadFaces(){
 facesReady||=(async()=>{
  const api=await import('./vendor/face-api/face-api.esm.js');
  await api.nets.tinyFaceDetector.loadFromUri(new URL('./vendor/face-api/',import.meta.url).href.replace(/\/$/,''));
  // 첫 추론은 셰이더를 만드느라 얼굴을 놓칠 때가 있다(대역 실측 11-04) — 빈 그림으로 한 번 먼저 돌린다.
  const warm=globalThis.document.createElement('canvas');warm.width=warm.height=128;warm.getContext('2d').fillRect(0,0,128,128);
  await api.detectAllFaces(warm,new api.TinyFaceDetectorOptions({inputSize:128,scoreThreshold:.9}));
  return api;
 })().catch(()=>{facesReady=null;return null;});
 return facesReady;
}
/** 두 칸이 겹치는 정도(겹친 넓이 / 작은 칸 넓이) */
function overlap(a,b){const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return w<=0||h<=0?0:w*h/Math.min(a.w*a.h,b.w*b.h);}
/**
 * 크게 찍힌 얼굴은 입력 크기에 따라 점수가 크게 흔들린다(대역 여섯 실측 .30~.99) — 세 크기로 찾아 합친다.
 * 가장 큰 얼굴의 0.4배보다 작은 얼굴은 뒤에 지나간 사람으로 보고 묻지 않는다.
 */
async function findFaces(canvas){
 const api=await loadFaces();
 if(!api)return null;
 try{
  const rows=[];
  for(const inputSize of [320,512,608]){
   const found=await api.detectAllFaces(canvas,new api.TinyFaceDetectorOptions({inputSize,scoreThreshold:.45}));
   for(const row of found){
    const box={x:row.box.x,y:row.box.y,w:row.box.width,h:row.box.height,score:row.score},twin=rows.findIndex(other=>overlap(other,box)>.4);
    if(twin<0)rows.push(box);else if(box.score>rows[twin].score)rows[twin]=box;
   }
  }
  rows.sort((a,b)=>b.w-a.w);
  return rows.filter(face=>face.w>=rows[0].w*.4);
 }catch{return null;}
}
async function decodePhoto(file,doc){
 try{return await createImageBitmap(file,{imageOrientation:'from-image'});}
 catch{
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();const canvas=doc.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);return canvas;}
  finally{URL.revokeObjectURL(url);}
 }
}
function drawScaled(source,box,edge,doc){
 const scale=Math.min(edge/Math.max(box.w,box.h),2),canvas=doc.createElement('canvas');
 canvas.width=Math.max(1,Math.round(box.w*scale));canvas.height=Math.max(1,Math.round(box.h*scale));
 const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(source,box.x,box.y,box.w,box.h,0,0,canvas.width,canvas.height);
 return {canvas,scale};
}
/** 고른 얼굴 둘레 — 3:4로 얼굴 너비의 3.2배쯤, 위쪽을 조금 더 남긴다(머리). 사진 밖으로 나가지 않게 줄인다. */
function cropAround(face,width,height){
 let w=face.w*CROP_FACTOR,h=w*4/3;
 if(w>width){w=width;h=Math.min(height,w*4/3);}
 if(h>height){h=height;w=Math.min(width,h*3/4);}
 const x=Math.min(Math.max(0,face.x+face.w/2-w/2),width-w),y=Math.min(Math.max(0,face.y+face.h*.42-h*.42),height-h);
 return {x,y,w,h};
}
async function encodeJpeg(canvas,quality=JPEG_Q){return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}

export function createMe2Photo({show,home,close,request,doc=globalThis.document,win=globalThis,lang=currentLang,fetcher=(...args)=>globalThis.fetch(...args),toast=message=>home?.toast?.(message),finder=findFaces}){
 let view=null,root=null,consent=null,disposed=false,pollTimer=null,offLang=null,stage={name:'home'},photo=null,epoch=0,lastScreen='';
 const text=(key,vars)=>{const pack=TEXT[lang()]||TEXT.ko;let out=pack[key]??TEXT.ko[key]??key;for(const [name,value] of Object.entries(vars||{}))out=out.replace(`{${name}}`,value);return out;};
 const consentPack=()=>consent?.[lang()]||consent?.ko||null;
 function clearPoll(){if(pollTimer)win.clearTimeout(pollTimer);pollTimer=null;}
 function dispose(){disposed=true;clearPoll();offLang?.();offLang=null;photo?.bitmap?.close?.();photo=null;root=null;}
 const inFlight=()=>view&&(view.me?.state==='developing'||view.me?.newer==='developing'||[...(view.looks||[]),...(view.album||[])].some(item=>item.state==='shipping'));
 function schedule(){clearPoll();if(!root||!inFlight()||stage.name!=='home')return;pollTimer=win.setTimeout(async()=>{if(!root)return;await refresh().catch(()=>{});schedule();},POLL_MS);}
 async function refresh(){const seq=++epoch;const next=await request({action:'status'});if(seq!==epoch||disposed)return;view=next;paint();}

 // ── 그리기 ──
 const note=(message,tone='info')=>`<p class="me2-note" data-tone="${tone}">${esc(message)}</p>`;
 function notesHtml(){
  const notes=stage.notes||view?.notes||{};
  const chip=key=>`<button type="button" class="me2-chip" data-me2="note" data-key="${key}" aria-pressed="${notes[key]===true}">${esc(text(key))}</button>`;
  return `<section class="me2-notes"><h4>${esc(text('noteTitle'))}</h4><p class="me2-small">${esc(text('noteHint'))}</p><div class="me2-chips">${['glasses','head_cover','facial_hair','wheelchair','long_hair'].map(chip).join('')}<button type="button" class="me2-chip" data-me2="build" data-build="small" aria-pressed="${notes.build==='small'}">${esc(text('buildSmall'))}</button><button type="button" class="me2-chip" data-me2="build" data-build="large" aria-pressed="${notes.build==='large'}">${esc(text('buildLarge'))}</button></div></section>`;
 }
 function consentHtml(){
  const pack=consentPack();
  if(!pack)return note(text('error'));
  const ok=stage.agree&&stage.adult;
  return `<p class="me2-lead">${esc(pack.top)}</p><ul class="me2-keys">${pack.key.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>
   <details class="me2-more"><summary>${esc(text('more'))}</summary><dl>${pack.details.map(([term,body])=>`<dt>${esc(term)}</dt><dd>${esc(body)}</dd>`).join('')}</dl></details>
   <label class="me2-check"><input type="checkbox" data-me2-check="agree" ${stage.agree?'checked':''}><span>${esc(pack.agree)}</span></label>
   <label class="me2-check"><input type="checkbox" data-me2-check="adult" ${stage.adult?'checked':''}><span>${esc(pack.adult)}</span></label>
   ${notesHtml()}
   <div class="me2-actions"><button type="button" class="felt-button" data-me2="agree" ${ok?'':'disabled'}>${esc(text('agreeGo'))}</button><button type="button" class="quiet-button" data-me2="prepared">${esc(text('prepared'))}</button></div>`;
 }
 function pickHtml(message){
  return `${message||''}<h3 class="me2-h">${esc(text('pickTitle'))}</h3><p class="me2-small">${esc(text('pickHint'))}</p>
   <div class="me2-actions"><label class="felt-button me2-file">${esc(text('camera'))}<input type="file" accept="image/*" capture="user" data-me2-file></label><label class="plain-button me2-file">${esc(text('album'))}<input type="file" accept="image/*" data-me2-file></label><button type="button" class="quiet-button" data-me2="prepared">${esc(text('prepared'))}</button></div>`;
 }
 function photoHtml(){
  if(stage.name==='reading')return `<div class="me2-print is-developing"><div class="me2-print-face"></div></div><p class="me2-status" role="status">${esc(text('reading'))}</p>`;
  if(stage.name==='sending')return `<p class="me2-status" role="status">${esc(text('sending'))}</p>`;
  if(stage.name==='send-failed')return `${note(text('sendFail'),'alert')}<div class="me2-actions"><button type="button" class="felt-button" data-me2="send">${esc(text('retry'))}</button><button type="button" class="quiet-button" data-me2="repick">${esc(text('otherPick'))}</button></div>`;
  const {preview,faces}=photo;
  const scale=100/preview.width,marks=(faces||[]).map((face,index)=>`<button type="button" class="me2-face" data-me2="who" data-index="${index}" aria-label="${esc(text('whoTitle'))} ${index+1}" style="left:${(face.x*scale).toFixed(2)}%;top:${(face.y*100/preview.height).toFixed(2)}%;width:${(face.w*scale).toFixed(2)}%;height:${(face.h*100/preview.height).toFixed(2)}%"></button>`).join('');
  if(faces&&faces.length>1)return `<h3 class="me2-h">${esc(text('whoTitle'))}</h3><p class="me2-small">${esc(text('whoHint'))}</p><div class="me2-who">${`<img src="${preview.url}" alt="">`}${marks}</div><div class="me2-actions"><button type="button" class="quiet-button" data-me2="repick">${esc(text('otherPick'))}</button></div>`;
  if(faces&&!faces.length)return `<div class="me2-preview"><img src="${preview.url}" alt=""></div>${note(text('noFace'))}<div class="me2-actions"><button type="button" class="felt-button" data-me2="use">${esc(text('anyway'))}</button><button type="button" class="plain-button" data-me2="repick">${esc(text('otherPick'))}</button></div>`;
  return `<div class="me2-preview"><img src="${preview.url}" alt=""></div><div class="me2-actions"><button type="button" class="felt-button" data-me2="use">${esc(text('useThis'))}</button><button type="button" class="plain-button" data-me2="repick">${esc(text('otherPick'))}</button></div>`;
 }
 function developingHtml(){
  return `<div class="me2-print is-developing"><div class="me2-print-face"></div></div><h3 class="me2-h me2-center">${esc(text('developing'))}</h3><p class="me2-small me2-center" role="status">${esc(text('developingNote'))}</p>`;
 }
 function chooseHtml(){
  const me=view.me,options=me.options||[],picked=stage.variant&&options.some(o=>o.variant===stage.variant)?stage.variant:(me.chosen_variant&&stage.review?me.chosen_variant:me.default_variant||options[0]?.variant);
  const main=options.find(o=>o.variant===picked)||options[0];
  const ordered=VARIANTS.map(v=>options.find(o=>o.variant===v)).filter(Boolean);
  const pair=me.compare&&!stage.variant?ordered.filter(o=>o.variant==='strong'||o.variant==='natural'):null;
  const big=pair&&pair.length===2?`<div class="me2-pair">${pair.map(o=>`<button type="button" class="me2-print" data-me2="variant" data-variant="${o.variant}"><img src="${esc(o.url)}" alt="${esc(text(o.variant))}"><span class="me2-print-cap">${esc(text(o.variant))}</span></button>`).join('')}</div>`:`<figure class="me2-print me2-big"><img src="${esc(main?.url)}" alt="${esc(text(main?.variant))}"></figure>`;
  return `<p class="me2-arrived" role="status">${esc(text('arrived'))}</p><h3 class="me2-h">${esc(text('isThisMe'))}</h3>${big}
   <div class="me2-variants" role="group">${ordered.map(o=>`<button type="button" class="me2-variant" data-me2="variant" data-variant="${o.variant}" aria-pressed="${o.variant===picked}"><img src="${esc(o.url)}" alt=""><span>${esc(text(o.variant))}</span></button>`).join('')}</div>
   ${me.low?note(text('lowNote')):''}${me.chosen_job&&me.chosen_job!==me.job_id&&(view.looks||[]).length?note(text('lookReset')):''}
   <div class="me2-actions"><button type="button" class="felt-button" data-me2="choose" data-variant="${esc(picked)}">${esc(text('thisOne'))}</button><button type="button" class="plain-button" data-me2="again">${esc(text('other'))}</button>${stage.review?`<button type="button" class="quiet-button" data-me2="back">${esc(text('back'))}</button>`:''}</div>`;
 }
 /** 추억 사진 · 받은 룩은 인화지 한 장, 아직 안 맡긴 룩은 옷 태그, 아직 안 맡긴 장면은 빈 인화지다. 설정 목록처럼 보이지 않게 한 칸에 모은다. */
 function printHtml(image,caption,wait){
  return `<div class="me2-card-art">${image?`<img src="${esc(image)}" alt="" loading="lazy">`:`<span class="me2-card-wait" data-wait="${wait}"></span>`}<span class="me2-card-cap">${esc(caption)}</span></div>`;
 }
 function itemCard(item,labelOf,kind){
  const hair=item.item.startsWith('hair');
  const state=item.state==='arrived'?(item.new?`<span class="me2-tag" data-tone="new">${esc(text('newChip'))}</span>`:'')
   :item.state==='delayed'?`<span class="me2-tag">${esc(text('delayed',{date:dateText(item.arrives_after,lang())}))}</span>`
   :item.state==='failed'?`<span class="me2-tag">${esc(text('failedItem'))}</span>`
   :`<span class="me2-tag" data-tone="wait">${esc(text(kind==='scene'?'developingShort':hair?'salon':'shipping'))}</span>`;
  const wearing=view.me.equipped_look===item.job_id;
  const actions=item.state==='arrived'?`<div class="me2-card-actions">${kind==='look'?`<button type="button" class="quiet-button" data-me2="${wearing?'unwear':'wear'}" data-job="${item.job_id}">${esc(text(wearing?'takeOff':'wear'))}</button>`:''}<button type="button" class="quiet-button" data-me2="redo" data-job="${item.job_id}">${esc(text(kind==='look'?'redoLook':'redoItem'))}</button></div>`
   :item.state==='failed'?`<div class="me2-card-actions"><button type="button" class="quiet-button" data-me2="${kind==='look'?'order-look':'order-scene'}" data-item="${esc(item.item)}">${esc(text('again'))}</button></div>`:'';
  return `<article class="me2-card" data-state="${item.state}" data-seen="${item.new?'no':'yes'}" ${item.new?`data-new-job="${item.job_id}"`:''}>${printHtml(item.url,labelOf(item.item),item.state==='failed'?'blank':'develop')}<div class="me2-card-body">${state}${wearing?`<span class="me2-tag" data-tone="on">${esc(text('wearing'))}</span>`:''}${actions}</div></article>`;
 }
 function openScene(entry,label){
  return `<article class="me2-card" data-state="open">${printHtml(null,label,'blank')}<div class="me2-card-body"><button type="button" class="plain-button me2-card-go" data-me2="order-scene" data-item="${esc(entry.id)}">${esc(text('orderScene'))}</button></div></article>`;
 }
 function openLook(entry,label){
  return `<article class="me2-hangtag" data-group="${esc(entry.group)}"><span class="me2-hangtag-kind">${esc(GROUP_MARK[entry.group]||'')}</span><strong>${esc(label)}</strong><button type="button" class="me2-hangtag-go" data-me2="order-look" data-item="${esc(entry.id)}">${esc(text(entry.group==='hair'?'orderHair':'order'))}</button></article>`;
 }
 function readyHtml(){
  const me=view.me,looks=view.looks||[],album=view.album||[],menu=view.menu||{looks:[],scenes:[]};
  const named=id=>ITEMS[lang()]?.[id];
  const lookLabel=id=>named(id)||menu.looks.find(x=>x.id===id)?.label||id,sceneLabel=id=>named(id)||menu.scenes.find(x=>x.id===id)?.label||id;
  // 사진관이 쉬면(스위치를 끄면) 새로 맡기지 않는다. 받은 것을 보고 지우는 일은 늘 된다.
  const closed=view.status==='off';
  const newer=closed?note(text('off')):me.newer==='developing'?note(text('newerDeveloping')):me.newer==='redo'?note(text('redo')):me.newer==='refused'?note(text('refused')):'';
  const sceneTiles=[...menu.scenes.map(entry=>{const item=album.find(x=>x.item===entry.id);return item?itemCard(item,sceneLabel,'scene'):closed?'':openScene(entry,sceneLabel(entry.id));}),...album.filter(item=>!menu.scenes.some(entry=>entry.id===item.item)).map(item=>itemCard(item,sceneLabel,'scene'))].join('');
  const lookTiles=[...looks.map(item=>itemCard(item,lookLabel,'look')),...(closed?[]:menu.looks.filter(entry=>!looks.some(item=>item.item===entry.id)).map(entry=>openLook(entry,lookLabel(entry.id))))].join('');
  return `${newer}<article class="me2-id" aria-label="${esc(text('card'))}"><div class="me2-id-band"><span>Student ID</span><span>SYNK World</span></div><div class="me2-id-body"><figure class="me2-id-photo"><img src="${esc(me.chosen_url)}" alt=""></figure><div class="me2-id-copy"><strong>${esc(text('cardName'))}</strong><span>${esc(text('cardRole'))}</span>${me.options?.length?`<button type="button" class="quiet-button" data-me2="review">${esc(text('changeFace'))}</button>`:''}</div></div></article>
   <section class="me2-section"><h3 class="me2-h">${esc(text('album2'))}</h3><div class="me2-grid">${sceneTiles}</div></section>
   <section class="me2-section"><h3 class="me2-h">${esc(text('wardrobe'))}</h3><div class="me2-grid">${lookTiles}</div></section>
   <section class="me2-section me2-foot">${closed?'':`<button type="button" class="quiet-button" data-me2="again">${esc(text('other'))}</button>`}${stage.erase?`<div class="me2-erase" role="alertdialog"><p>${esc(text('eraseAsk'))}</p><div class="me2-actions"><button type="button" class="plain-button" data-me2="erase-yes">${esc(text('eraseYes'))}</button><button type="button" class="quiet-button" data-me2="erase-no">${esc(text('eraseNo'))}</button></div></div>`:`<button type="button" class="quiet-button" data-me2="erase">${esc(text('eraseOpen'))}</button>`}</section>`;
 }
 function bodyHtml(){
  if(!view)return `<p class="me2-status" role="status">${esc(text('loading'))}</p>`;
  if(view.status==='not_invited'||(view.status==='off'&&!view.consent))return note(text('off'));
  if(stage.name==='consent')return consentHtml();
  if(['photo','reading','sending','send-failed'].includes(stage.name))return photoHtml();
  if(stage.name==='pick')return pickHtml(stage.message?note(stage.message):'');
  if(!view.consent?.given)return consentHtml();
  const me=view.me;
  if(me.state==='developing')return developingHtml();
  if(me.state==='choose'||stage.review)return chooseHtml();
  if(me.state==='ready')return readyHtml();
  // none · uploading(올리다 멈춤) · redo · refused
  if(view.status==='off')return note(text('off'));
  if(view.capacity&&!view.capacity.open)return `${note(text('busy',{date:dateText(view.capacity.reopens_at,lang())}))}<div class="me2-actions"><button type="button" class="quiet-button" data-me2="prepared">${esc(text('prepared'))}</button></div>`;
  return pickHtml(me.state==='redo'?note(text('redo')):me.state==='refused'?note(text('refused')):'');
 }
 function paint(){
  if(disposed)return;
  const html=bodyHtml(),screenKey=`${view?.status}|${stage.name}|${view?.me?.state}|${Boolean(stage.review)}`,changed=screenKey!==lastScreen;
  lastScreen=screenKey;
  if(root?.isConnected){root.innerHTML=html;if(changed){root.closest('#world-panel')?.scrollTo?.(0,0);root.focus?.({preventScroll:true});}markSeen();schedule();return;}
  show(text('title'),`<div class="me2" data-me2-root tabindex="-1">${html}</div>`);
  root=doc.querySelector('[data-me2-root]');
  if(!root)return;
  root.addEventListener('click',onClick);root.addEventListener('change',onChange);
  home?.attachPanelResource?.({dispose});
  markSeen();schedule();
 }
 function markSeen(){for(const node of root?.querySelectorAll('[data-new-job]')||[]){const job=node.dataset.newJob;node.removeAttribute('data-new-job');request({action:'seen',job_id:job}).catch(()=>{});}}

 // ── 사진 고르기 → 손보기 → 올리기 ──
 function clearPhoto(){photo?.bitmap?.close?.();if(photo?.preview?.url)try{URL.revokeObjectURL(photo.preview.url);}catch{}photo=null;}
 async function takeFile(file){
  clearPhoto();stage={name:'reading'};paint();
  let bitmap;
  try{bitmap=await decodePhoto(file,doc);}catch{stage={name:'pick',message:text('cantOpen')};paint();return;}
  const width=bitmap.width,height=bitmap.height;
  const {canvas,scale}=drawScaled(bitmap,{x:0,y:0,w:width,h:height},LONG_EDGE,doc);
  const faces=await finder(canvas);
  const blob=await encodeJpeg(canvas,.8);
  photo={bitmap,width,height,canvas,scale,faces,preview:{url:URL.createObjectURL(blob),width:canvas.width,height:canvas.height},chosen:faces?.length===1?faces[0]:null};
  // 도구를 못 읽었으면(null) 묻지 않고 받는다 — 막지 않는다.
  stage={name:'photo'};paint();
 }
 /** 고른 얼굴로 올릴 그림을 만든다 — 얼굴이 작거나 여럿이면 둘레를 잘라 키운다. */
 async function finalImage(){
  const {bitmap,width,height,canvas,scale,chosen,faces}=photo;
  const toOriginal=face=>({x:face.x/scale,y:face.y/scale,w:face.w/scale,h:face.h/scale});
  let out=canvas,box=null;
  if(chosen){
   const small=chosen.w/canvas.width<SMALL_FACE;
   if(small||(faces&&faces.length>1)){
    const face=toOriginal(chosen),area=cropAround(face,width,height),drawn=drawScaled(bitmap,area,LONG_EDGE,doc);
    out=drawn.canvas;box=[(face.x-area.x)*drawn.scale,(face.y-area.y)*drawn.scale,face.w*drawn.scale,face.h*drawn.scale];
   }else box=[chosen.x,chosen.y,chosen.w,chosen.h];
  }
  let blob=await encodeJpeg(out,JPEG_Q);
  if(blob.size>MAX_BYTES)blob=await encodeJpeg(out,.75);
  return {blob,box:box?box.map(Math.round):null};
 }
 async function send(){
  stage={name:'sending'};paint();
  try{
   const {blob,box}=await finalImage();
   const bytes=new Uint8Array(await blob.arrayBuffer());
   const intake=await request({action:'intake',sha256:await sha256Hex(bytes),bytes:bytes.length,...(box?{face_box:box}:{})});
   if(intake.status==='full'){view={...view,capacity:{open:false,reopens_at:intake.reopens_at}};stage={name:'home'};clearPhoto();if(view.me?.state==='ready')toast(text('busy',{date:dateText(intake.reopens_at,lang())}));paint();return;}
   if(intake.status==='limit'){stage={name:'pick',message:text('limit')};clearPhoto();paint();return;}
   if(intake.status==='off'){stage={name:'home'};await refresh();return;}
   if(intake.status==='busy_same'){stage={name:'home'};clearPhoto();await refresh();return;}
   if(intake.status!=='upload')throw Error('intake');
   const put=await fetcher(intake.upload_url,{method:'PUT',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:blob,credentials:'omit',redirect:'error'});
   if(!put.ok)throw Error('upload');
   const done=await request({action:'intake-done',job_id:intake.job_id});
   if(done.status==='bad_upload')throw Error('bad_upload');
   clearPhoto();stage={name:'home'};await refresh();
  }catch{stage={name:'send-failed'};paint();}
 }

 // ── 눌렀을 때 ──
 async function act(action,fn){
  if(stage.busy)return;
  stage.busy=true;
  root?.querySelectorAll('button').forEach(node=>{node.disabled=true;});
  try{await fn();}
  catch{toast(text('error'));}
  stage.busy=false;
  if(root)await refresh().catch(()=>paint());
 }
 function onChange(event){
  const check=event.target.closest?.('[data-me2-check]');
  // 동의 칸 · 칩은 다시 그리지 않는다 — 「자세히 보기」 펼침과 키보드 위치가 그대로 남는다.
  if(check){stage={...stage,name:'consent',[check.dataset.me2Check]:check.checked};const go=root?.querySelector('[data-me2="agree"]');if(go)go.disabled=!(stage.agree&&stage.adult);return;}
  const input=event.target.closest?.('[data-me2-file]');
  if(input&&input.files?.[0])void takeFile(input.files[0]);
 }
 function onClick(event){
  const button=event.target.closest?.('[data-me2]');
  if(!button||button.disabled)return;
  const kind=button.dataset.me2;
  if(kind==='note'){const notes={...(stage.notes||view?.notes||{})},key=button.dataset.key;if(notes[key])delete notes[key];else notes[key]=true;stage={...stage,name:'consent',notes};button.setAttribute('aria-pressed',String(notes[key]===true));return;}
  if(kind==='build'){const notes={...(stage.notes||view?.notes||{})},value=button.dataset.build;if(notes.build===value)delete notes.build;else notes.build=value;stage={...stage,name:'consent',notes};root.querySelectorAll('[data-me2="build"]').forEach(node=>node.setAttribute('aria-pressed',String(notes.build===node.dataset.build)));return;}
  if(kind==='agree'){void act(kind,async()=>{await request({action:'consent',version:consent.version,doc_hash:view.consent.doc_hash,adult:true,notes:stage.notes||view.notes||{}});stage={name:'home'};});return;}
  if(kind==='prepared'){toast(text('preparedDone'));(close||home?.closePanel)?.();return;}
  if(kind==='repick'){clearPhoto();stage={name:'pick'};paint();return;}
  if(kind==='again'){clearPhoto();stage={name:'pick'};paint();return;}
  if(kind==='who'){photo.chosen=photo.faces[Number(button.dataset.index)]||null;void send();return;}
  if(kind==='use'||kind==='send'){void send();return;}
  if(kind==='variant'){stage={...stage,variant:button.dataset.variant};paint();return;}
  if(kind==='review'){stage={...stage,review:true,variant:view.me.chosen_variant};paint();return;}
  if(kind==='back'){stage={name:'home'};paint();return;}
  if(kind==='choose'){void act(kind,async()=>{await request({action:'choose',job_id:view.me.job_id,variant:button.dataset.variant});stage={name:'home'};});return;}
  if(kind==='order-look'||kind==='order-scene'){void act(kind,async()=>{const out=await request({action:kind,item:button.dataset.item});if(out.status==='full_album')toast(text('fullAlbum'));});return;}
  if(kind==='redo'){void act(kind,async()=>{const out=await request({action:'redo',job_id:button.dataset.job});if(out.status==='limit')toast(text('limit'));});return;}
  if(kind==='wear'||kind==='unwear'){void act(kind,()=>request({action:'equip',job_id:kind==='wear'?button.dataset.job:null}));return;}
  if(kind==='erase'){stage={...stage,erase:true};paint();return;}
  if(kind==='erase-no'){stage={...stage,erase:false};paint();return;}
  if(kind==='erase-yes'){void act(kind,async()=>{await request({action:'erase'});stage={name:'home'};toast(text('erased'));close?.();});return;}
 }

 return {
  /** 내 정보 시트의 줄을 그릴지 — 초대받은 계정만. 실패하면 조용히 없음. */
  async available(){try{const out=await request({action:'status'});return out.status==='ok'||(out.status==='off'&&Boolean(out.consent));}catch{return false;}},
  rowHtml(){return `<button type="button" class="me2-row" data-world="me2"><strong>${esc(text('row'))}</strong><span>${esc(text('rowNote'))}</span></button>`;},
  async open(){
   disposed=false;root=null;stage={name:'home'};view=null;
   paint();
   offLang=onLang?.(()=>{if(root)paint();})||null;
   try{
    if(!consent){const response=await fetcher(CONSENT_URL.href);consent=await response.json();}
    await refresh();
   }catch{view={status:'error'};if(root)root.innerHTML=note(text('error'),'alert');}
  },
  dispose,
 };
}

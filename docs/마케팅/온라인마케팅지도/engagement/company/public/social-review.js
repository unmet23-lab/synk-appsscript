// 고객 SNS 게시물 검토(/social-review) — 워크스페이스 시그널 판(2026-10-23, GPT 10-14 판을 다시 그림).
// 서버 계약은 그대로다: 주소 끝(#token=)의 열쇠는 Authorization 머리글로만 보내고(쿠키·브라우저 저장소 없음), 파일은 누를 때만 받아 blob으로 보이고
// 떠날 때 놓으며, 결과를 모르는 답은 같은 요청 ID·같은 내용으로만 다시 보낸다. 이 화면의 CSP는 style 속성과 글꼴을 막는다 —
// 그래서 스타일은 클래스로만 고르고, 글은 모두 textContent로 넣는다.
(() => {
  'use strict';
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1)),token=params.get('token');
  const heading=$('review-heading'),notice=$('review-notice'),lede=$('review-lede'),facts=$('review-facts'),errorBox=$('review-error');
  const content=$('review-content'),feedback=$('review-feedback'),form=$('review-form'),formError=$('review-form-error'),retry=$('review-retry'),result=$('review-result'),fine=$('review-fine');
  const dock=$('review-dock'),dockWrite=$('review-dock-write'),dockApprove=$('review-dock-approve');
  const STATUS={pending:'검토 전',approved:'승인됨',rejected:'수정 요청됨'},DECISION={comment:'의견',approve:'승인',reject:'수정 요청'};
  const SAVED={comment:'의견을 저장했어요.',approve:'승인을 저장했어요.',reject:'수정 요청을 저장했어요.'};
  const PLATFORM={instagram:'인스타그램',youtube:'유튜브',facebook:'페이스북',threads:'스레드',x:'X',twitter:'X',linkedin:'링크드인',bluesky:'블루스카이',pinterest:'핀터레스트',vk:'VK',tiktok:'틱톡'};
  const FORMAT={post:'게시물',feed:'게시물',text:'글',image:'사진',carousel:'사진 여러 장',video:'영상',reel:'릴스','instagram-reels':'릴스',shorts:'쇼츠','youtube-shorts':'쇼츠','youtube-video':'영상',story:'스토리'};
  // 제목 칸을 실제로 올리는 곳은 유튜브(영상 제목)와 핀터레스트(핀 제목)뿐이다(social-provider·social-direct-youtube). 다른 곳은 게시물 이름이 기본값으로 들어 있을 뿐이라 보이지 않는다.
  const TITLED=new Set(['youtube','pinterest']);
  const optionNames={firstComment:'첫 댓글',hashtags:'해시태그',altText:'대체 텍스트',privacy:'공개 범위',utm:'UTM 태그',board:'핀터레스트 보드',whoCanReply:'답글 허용',coverUrl:'표지 그림 주소',link:'링크',notifyOnly:'SNS 앱에서 직접 올림',madeForKids:'아동용 콘텐츠',madeWithAi:'AI 제작 표시',paidPartnership:'유료 파트너십',thumbnailTimestamp:'표지로 쓸 장면',notifySubscribers:'구독자에게 알림',shareToFeed:'피드에도 공유',language:'제목·설명 언어',audioLanguage:'영상 언어',categoryId:'유튜브 카테고리'};
  const valueNames={privacy:{public:'전체 공개',unlisted:'링크가 있는 사람만',private:'비공개'},whoCanReply:{everyone:'누구나',following:'내가 팔로우하는 계정',mentionedUsers:'언급한 계정만',subscribers:'구독자만',verified:'인증된 계정만'},categoryId:{1:'영화/애니메이션',2:'자동차/교통',10:'음악',15:'애완동물/동물',17:'스포츠',19:'여행/이벤트',20:'게임',22:'인물/블로그',23:'코미디',24:'엔터테인먼트',25:'뉴스/정치',26:'노하우/스타일',27:'교육',28:'과학기술',29:'비영리/사회운동'}};
  // 지난 판과 바뀐 곳(10-24): 서버가 링크를 만들 때 직전에 답을 받은 판과 견줘 얼려 둔 것을 그린다(social-review-changes.mjs).
  const FIELD={title:'게시물 이름',body:'공통 문구',account:'계정 이름',format:'형식',variantTitle:'제목',text:'문구',media:'사진·영상',options:'함께 보내는 설정',copyVariants:'반복 게시 문구',schedule:'올라가는 때',recurrence:'반복',expiresAt:'올리는 마감'};
  const KIND={image:'사진',video:'영상',audio:'소리'},MOVE={replaced:'바뀜',added:'새로 더함',removed:'뺌',moved:'자리 바뀜'};
  const ZONE='Asia/Seoul',urls=new Set(),targets=new Map();
  let state=null,busy=false,pending=null,closed=false,shown='',formInView=false;
  const has=(names,key)=>!!names&&Object.prototype.hasOwnProperty.call(names,key);
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node;};
  const languageNames=(()=>{try{return new Intl.DisplayNames(['ko'],{type:'language',fallback:'none'});}catch{return null;}})();
  // 날짜는 그 일정의 시간대로 읽는다(「10월 25일 (일) 오후 9:00」). 서울이 아니면 시간대 이름을 붙이고, 올해가 아니면 해를 넣는다.
  // 조각으로 받아 잇는다 — ko-KR 서식은 해를 넣으면 요일의 괄호를 뺀다.
  function when(value,zone){
    if(!value)return '';
    const date=new Date(value),z=zone||ZONE;
    if(Number.isNaN(date.getTime()))return String(value);
    try{
      const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:z,year:'numeric',month:'numeric',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d).map(p=>[p.type,p.value]));
      const p=parts(date),text=(p.year!==parts(new Date()).year?p.year+'년 ':'')+p.month+'월 '+p.day+'일 ('+p.weekday+') '+p.dayPeriod+' '+p.hour+':'+p.minute;
      return z===ZONE?text:text+' ('+z+')';
    }catch{return String(value);}
  }
  // 일정이면 그 일정의 시간대로 읽어 본문 「전/후」 줄(when)과 같은 날짜가 되게 한다(Fable 10-24 F4). 모르는 시간대면 서울로.
  function day(value,zone){
    const date=new Date(value);if(!value||Number.isNaN(date.getTime()))return '';
    for(const z of [zone||ZONE,ZONE]){try{const p=Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:z,month:'numeric',day:'numeric'}).formatToParts(date).map(x=>[x.type,x.value]));return p.month+'월 '+p.day+'일';}catch{}}
    return '';
  }
  const clock=seconds=>{const s=Math.max(0,Math.round(Number(seconds)||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  function setBusy(value){busy=value;for(const button of [...form.querySelectorAll('button'),dockApprove])button.disabled=value;for(const input of form.querySelectorAll('input,textarea'))input.disabled=value||!!pending;}
  // 아래 떠 있는 결정 막대(좁은 화면만 — CSS가 넓은 화면에서 숨긴다): 답하기 전일 때만, 답하기 칸이 보이거나 결과를 모르는 답이 있으면 비켜 준다.
  function updateDock(){dock.hidden=closed||!state||state.status!=='pending'||!!pending||formInView;}
  function showFormError(message){formError.textContent=message;formError.hidden=false;}
  function release(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
  function close(message){
    closed=true;form.hidden=true;content.hidden=true;feedback.hidden=true;dock.hidden=true;release();
    heading.textContent='검토 링크를 열 수 없어요';notice.hidden=true;lede.hidden=true;facts.hidden=true;
    errorBox.textContent=message;errorBox.hidden=false;
  }
  async function api(path,input={},binary=false){
    const response=await fetch('/api/social-review/'+path,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)});
    if(!response.ok){
      const fallback='검토 요청을 처리하지 못했어요. 잠시 뒤 다시 해 주세요.';let message=fallback;
      try{message=(await response.json()).error||fallback;}catch{}
      throw Object.assign(new Error(typeof message==='string'?message:fallback),{status:response.status});
    }
    return binary?response.blob():response.json();
  }
  function optionValue(key,value){
    if(typeof value==='boolean')return value?'예':'아니요';
    if(value&&typeof value==='object')return JSON.stringify(value);
    if(key==='thumbnailTimestamp'&&typeof value==='number'&&Number.isFinite(value)&&value>=0)return Math.round(value/100)/10+'초';
    if((key==='language'||key==='audioLanguage')&&languageNames){try{return languageNames.of(value)||value;}catch{return value;}}
    return has(valueNames,key)&&has(valueNames[key],value)?valueNames[key][value]:value;
  }
  // 해시태그·@계정·주소는 SNS 화면처럼 색만 바꾼다. 누를 수 있는 링크로 만들지는 않는다.
  function richText(value,className){
    const box=el('p',className),text=String(value??'');let last=0;
    for(const match of text.matchAll(/#[^\s#]+|@[A-Za-z0-9_.]+|https?:\/\/\S+/g)){
      if(match.index>last)box.append(el('span',null,text.slice(last,match.index)));
      box.append(el('span','mark',match[0]));last=match.index+match[0].length;
    }
    if(last<text.length||!text)box.append(el('span',null,text.slice(last)));
    return box;
  }
  const tag=(text,className='tag')=>el('span',className,text);
  function settings(raw,changed=new Set()){
    const entries=Object.entries(raw||{}).filter(([,value])=>value!==''&&value!=null);
    if(!entries.length)return null;
    const box=el('section','settings'),list=el('dl');
    // 「바뀜」 표 앞에 빈칸을 두어 「첫 댓글 바뀜」으로 읽히게 한다(Fable 10-24 F3)
    for(const [key,value] of entries){const row=el('div'),term=el('dt',null,has(optionNames,key)?optionNames[key]:key);if(changed.has(key)){term.textContent+=' ';term.append(tag('바뀜'));}row.append(term,el('dd',null,optionValue(key,value)));list.append(row);}
    box.append(el('h3',null,'함께 보내는 설정'),list);
    return box;
  }
  // 사진·영상 칸의 모양은 원본 가로세로 비율에 가장 가까운 판으로 고른다(9:16 · 4:5 · 1:1 · 16:9).
  function ratio(media){
    const w=Number(media.width),h=Number(media.height);
    if(!(w>0&&h>0))return media.type==='video'?'r-169':'r-45';
    const r=h/w;return r>=1.6?'r-916':r>=1.15?'r-45':r>=.85?'r-11':'r-169';
  }
  function frame(media,index,total,alt,badge){
    const video=media.type==='video',word=video?'영상 보기':'사진 보기';
    const figure=el('figure','frame '+ratio(media)),load=el('button','load'),label=el('span','load-word',word),problem=el('p','frame-error');
    load.type='button';problem.hidden=true;
    load.append(label,el('span','load-meta',[video&&media.duration?clock(media.duration):'',media.width&&media.height?media.width+'×'+media.height:''].filter(Boolean).join(' · ')));
    figure.append(load,problem);
    if(total>1)figure.append(el('span','count',(index+1)+'/'+total));
    // 받기 실패 안내와 바뀐 사진 표가 칸 왼쪽 아래에서 겹치지 않게, 안내가 보이는 동안 표를 숨긴다(Fable 10-24 F2)
    const flag=badge?el('span','frame-tag',badge):null;
    if(flag)figure.append(flag);
    load.addEventListener('click',async()=>{
      load.disabled=true;label.textContent='불러오는 중';problem.hidden=true;if(flag)flag.hidden=false;
      try{
        const blob=await api('media',{mediaKey:media.key},true);
        if(closed)return;
        const url=URL.createObjectURL(blob);urls.add(url);
        const element=el(video?'video':'img');
        if(video){element.controls=true;element.preload='metadata';element.playsInline=true;}else element.alt=alt||'올라갈 사진 '+(index+1);
        element.src=url;load.replaceWith(element);
      }catch(error){
        load.disabled=false;label.textContent=word;
        if([403,410].includes(error.status))close(error.message);else{problem.textContent=error.message;problem.hidden=false;if(flag)flag.hidden=true;}
      }
    });
    return figure;
  }
  function copies(list,platform,marks=new Map()){
    const box=el('section','copies');
    box.append(el('h3',null,'반복 게시 문구'),el('p','note','반복해서 올릴 때 두 번째부터 차례로 써요.'));
    list.forEach((copy,index)=>{
      const item=el('div','copy'),top=el('p','copy-top');top.append(el('span','copy-n','문구 '+(index+2)));if(marks.has(index+1))top.append(tag(marks.get(index+1)));item.append(top);
      if(TITLED.has(platform)&&copy.title)item.append(el('p','post-title',copy.title));
      item.append(copy.text?richText(copy.text,'post-text'):el('p','post-text is-empty','문구 없음'));
      if(copy.hashtags){const tags=el('p','copy-tags');tags.append(el('span',null,'해시태그'),el('span','mark',copy.hashtags));item.append(tags);}
      box.append(item);
    });
    return box;
  }
  // mark: 지난 판과 견준 이 카드의 바뀐 곳(marksOf). 미리 보기 모양은 그대로 두고 바뀐 덩어리에만 작은 표를 단다.
  function postCard(variant,mark=null){
    const account=variant.account||{},platform=String(account.platform||''),name=account.name||account.profile||'게시 계정';
    const card=el('article','post'),head=el('header','post-head'),who=el('span','who');
    card.tabIndex=-1;
    if(mark?.added)card.append(el('p','post-flag','이번 판에 새로 더한 게시물'));
    else if(mark&&(mark.fields.has('account')||mark.fields.has('format')))card.append(el('p','post-flag',(mark.fields.has('account')&&mark.fields.has('format')?'계정 이름과 형식이':mark.fields.has('account')?'계정 이름이':'형식이')+' 바뀌었어요'));
    who.append(el('strong',null,name));if(account.profile&&account.profile!==name)who.append(el('span',null,account.profile));
    head.append(el('span','avatar',Array.from(name)[0]||'·'),who,el('span','where',[has(PLATFORM,platform)?PLATFORM[platform]:platform,has(FORMAT,variant.format)?FORMAT[variant.format]:variant.format].filter(Boolean).join(' · ')));
    card.append(head);
    const media=Array.isArray(variant.media)?variant.media:[],alt=typeof variant.options?.altText==='string'?variant.options.altText:'';
    if(media.length){const box=el('div',media.length>1?'media is-strip':'media');media.forEach((item,index)=>box.append(frame(item,index,media.length,alt,mark?.media.get(item.key))));card.append(box);}
    const caption=el('div','caption');
    if(mark&&(mark.fields.has('text')||mark.fields.has('variantTitle')&&TITLED.has(platform)))caption.append(tag('문구 바뀜'));
    if(TITLED.has(platform)&&variant.title)caption.append(el('p','post-title',variant.title));
    caption.append(variant.text?richText(variant.text,'post-text'):el('p','post-text is-empty','문구 없음'));
    card.append(caption);
    if(Array.isArray(variant.copyVariants)&&variant.copyVariants.length)card.append(copies(variant.copyVariants,platform,mark?.copies));
    const options=settings(variant.options,mark?.options);if(options)card.append(options);
    return card;
  }
  // 같은 시각에 올라가는 계정은 한 줄로 묶는다. 같은 이름의 계정이 둘이면 「이름 2곳」.
  function slotGroups(rows){
    const groups=new Map();
    for(const entry of rows){const key=[entry.scheduledAt,entry.timezone,entry.cancelled?1:0].join('|');if(!groups.has(key))groups.set(key,{entry,names:new Map()});const names=groups.get(key).names,who=entry.account||'게시 계정';names.set(who,(names.get(who)||0)+1);}
    return [...groups.values()].sort((a,b)=>String(a.entry.scheduledAt).localeCompare(String(b.entry.scheduledAt)));
  }
  const whoText=names=>[...names].map(([who,count])=>count>1?who+' '+count+'곳':who).join(' · ');
  // maxOccurrences는 첫 회를 포함한 총 횟수다(social-publishing nextRepeatJob) — 「다시 3번」으로 읽히지 않게 쓴다.
  const repeatText=repeat=>repeat&&Number(repeat.intervalDays)>0?repeat.intervalDays+'일마다 올려요'+(Number(repeat.maxOccurrences)>0?' · 처음을 포함해 모두 '+repeat.maxOccurrences+'번':'')+(repeat.until?' · '+when(repeat.until)+'까지':''):'';
  function schedule(snapshot,changed=false){
    const box=el('section','sheet when'),rows=Array.isArray(snapshot.schedule)?snapshot.schedule:[],title=el('h2',null,'올라가는 때');
    if(changed)title.append(tag('바뀜'));
    box.tabIndex=-1;box.append(title);
    if(!rows.length)box.append(el('p','note','아직 정한 일정이 없어요. 일정이 정해지면 새 링크로 다시 검토해요.'));
    else{
      const list=el('ol','slots');
      for(const {entry,names} of slotGroups(rows)){
        const item=el('li',entry.cancelled?'slot is-off':'slot');
        item.append(el('span','slot-time',when(entry.scheduledAt,entry.timezone)||'시각 미정'),el('span','slot-who',whoText(names)));
        if(entry.cancelled)item.append(el('span','slot-off','취소됨'));
        list.append(item);
      }
      box.append(list);
    }
    const repeat=repeatText(snapshot.recurrence);if(repeat)box.append(el('p','note',repeat));
    if(snapshot.expiresAt)box.append(el('p','note',when(snapshot.expiresAt)+' 뒤로는 올리지 않아요.'));
    return box;
  }
  function message(entry){
    const kind=has(DECISION,entry.decision)?entry.decision:'comment',item=el('li','msg is-'+kind),top=el('p','msg-head'),at=el('time',null,when(entry.createdAt));
    at.dateTime=String(entry.createdAt||'');
    top.append(el('span','msg-tag',DECISION[kind]),el('strong',null,entry.name||'이름 없음'),at);
    item.append(top,el('p','msg-text',entry.comment||'승인했어요.'));
    return item;
  }
  function thread(review){
    const items=Array.isArray(review.feedback)?review.feedback:[],title=el('h2');
    title.append(el('span',null,'주고받은 의견'),el('span','count',String(items.length)));title.setAttribute('aria-label','주고받은 의견 '+items.length+'개');
    feedback.replaceChildren(title);
    if(!items.length){feedback.append(el('p','note','아직 남긴 의견이 없어요.'));return;}
    const list=el('ol','msgs');
    for(const entry of items)list.append(message(entry));
    feedback.append(list);
  }
  // ── 지난 판과 바뀐 곳(10-24) ──
  // 화면에 실제로 보이는 바뀜만 센다 — 제목을 올리지 않는 플랫폼의 제목 바뀜은 카드처럼 뺀다.
  function visible(previous){
    if(!previous||previous.state!=='compared'||!Array.isArray(previous.changes))return [];
    const titled=change=>TITLED.has(String(change.account?.platform||''));
    return previous.changes.map(change=>{
      if(!change||typeof change!=='object')return null;
      if(change.field==='variantTitle')return titled(change)?change:null;
      if(change.kind==='copies'&&!titled(change)){const items=(change.items||[]).filter(item=>!(item.change==='changed'&&item.title&&!item.text&&!item.hashtags));return items.length?{...change,items}:null;}
      return change;
    }).filter(Boolean);
  }
  // 서버가 크기 상한 때문에 뺀 바뀐 곳의 수(뒤 계정 것부터) — 칩·제목의 수에 더하고 판 끝에 한 줄로 알린다.
  const dropped=previous=>previous&&previous.state==='compared'&&Number.isInteger(previous.dropped)&&previous.dropped>0?previous.dropped:0;
  const noun=type=>has(KIND,type)?KIND[type]:'파일';
  const booked=()=>(state.snapshot.schedule||[]).some(entry=>!entry.cancelled&&entry.scheduledAt);
  function marksOf(changes){
    const post=new Set(),variants=new Map();
    const of=key=>{if(!variants.has(key))variants.set(key,{fields:new Set(),media:new Map(),options:new Set(),copies:new Map(),added:false});return variants.get(key);};
    for(const change of changes){
      if(!change.variant){post.add(change.field);continue;}
      const mark=of(change.variant);
      if(change.kind==='presence'){mark.added=true;continue;}
      mark.fields.add(change.field);
      for(const item of Array.isArray(change.items)?change.items:[]){
        if(change.kind==='media'&&item.key)mark.media.set(item.key,item.change==='moved'?'자리 바뀜':item.change==='added'?'새 '+noun(item.type):'바뀐 '+noun(item.type));
        if(change.kind==='options')mark.options.add(item.key);
        if(change.kind==='copies'&&item.change!=='removed')mark.copies.set(item.index,item.change==='added'?'새 문구':item.change==='moved'?'자리 바뀜':'바뀜');
      }
    }
    return {post,variants};
  }
  const accountName=account=>{const a=account||{},p=String(a.platform||'');return [a.name||a.profile||'게시 계정',has(PLATFORM,p)?PLATFORM[p]:p].filter(Boolean).join(' · ');};
  const lineCount=s=>[s?.changed?'고친 줄 '+s.changed:'',s?.removed?'뺀 줄 '+s.removed:'',s?.added?'더한 줄 '+s.added:''].filter(Boolean).join(' · ');
  const COPY={added:'새로 더함',removed:'뺌',changed:'고침',moved:'자리 바뀜'};
  // 뺀 문구·사진의 번호는 지난 판 자리다 — 지금 판의 같은 번호와 헷갈리지 않게 「지난 판의」를 붙인다(Fable 10-24 F1)
  const past=item=>item.change==='removed'?'지난 판의 ':'';
  function valueText(field,value){
    if(value==null||value==='')return '없음';
    if(field==='format')return has(FORMAT,value)?FORMAT[value]:String(value);
    if(field==='account')return [value.name,value.profile&&value.profile!==value.name?value.profile:''].filter(Boolean).join(' ')||'게시 계정';
    if(field==='recurrence')return repeatText(value)||'반복하지 않아요';
    if(field==='expiresAt')return when(value)+' 뒤로는 올리지 않아요';
    return typeof value==='object'?JSON.stringify(value):String(value);
  }
  const optionText=(key,value)=>value==null||value===''?'없음':String(optionValue(key,value));
  function fileLine(item){
    const where=item.change==='moved'?noun(item.type)+' '+item.from+' → '+item.index:past(item)+noun(item.type)+' '+item.index;
    const meta=[item.type==='video'&&item.duration?clock(item.duration):'',item.width&&item.height?item.width+'×'+item.height:''].filter(Boolean).join(' · ');
    const was=item.change==='replaced'&&item.before?' (전: '+[noun(item.before.type),item.before.width&&item.before.height?item.before.width+'×'+item.before.height:''].filter(Boolean).join(' ')+')':'';
    return where+' '+(has(MOVE,item.change)?MOVE[item.change]:'')+(meta?' · '+meta:'')+was;
  }
  function brief(change){
    const items=Array.isArray(change.items)?change.items:[];
    if(change.kind==='text')return lineCount(change.stats);
    if(change.kind==='media')return items.map(item=>item.change==='moved'?noun(item.type)+' '+item.from+' → '+item.index+' 자리 바뀜':past(item)+noun(item.type)+' '+item.index+' '+(MOVE[item.change]||'')).join(' · ');
    if(change.kind==='options')return items.map(item=>has(optionNames,item.key)?optionNames[item.key]:item.key).join(' · ');
    if(change.kind==='copies')return items.map(item=>past(item)+'문구 '+(item.index+1)+' '+(COPY[item.change]||'')).join(' · ');
    // 더한 때가 없어도 지금 판에 남은 예약이 있으면 뺀 것만 말한다(아르곤 A1) — 「아직 다시 정하지 않았어요」는 지금 판에 예약이 하나도 없을 때만.
    if(change.kind==='schedule'){const before=slotGroups(change.removed||[]),after=slotGroups(change.added||[]);if(!after.length)return booked()?'뺀 때 '+before.length:'아직 다시 정하지 않았어요';if(before.length===1&&after.length===1){const was=day(before[0].entry.scheduledAt,before[0].entry.timezone),now=day(after[0].entry.scheduledAt,after[0].entry.timezone);if(was!==now)return was+' → '+now;}return [before.length?'뺀 때 '+before.length:'',after.length?'더한 때 '+after.length:''].filter(Boolean).join(' · ');}
    if(change.kind==='value'){const a=valueText(change.field,change.before),b=valueText(change.field,change.after);return a.length+b.length<=40?a+' → '+b:'바뀜';}
    return '';
  }
  // 「전/후」 줄: 바뀐 낱말만 del·ins로 칠하고, 색만으로 가르지 않게 줄 앞에 「전」「후」를 쓴다.
  function diff(rows,truncated){
    const box=el('div','diff'),list=Array.isArray(rows)?rows:[];
    for(const row of list){
      if(row.type==='skip'){box.append(el('p','diff-row is-skip','같은 줄 '+row.count+'개'));continue;}
      const kind=row.type==='removed'?'removed':row.type==='added'?'added':'same',line=el('p','diff-row is-'+kind),text=el('span','diff-text'),mark=kind==='removed'?'del':'ins';
      // 그대로인 빈 줄은 문단 사이 틈으로만 둔다(뺀·더한 빈 줄만 「빈 줄」이라고 쓴다).
      if(kind==='same'&&!row.text){box.append(el('p','diff-row is-gap'));continue;}
      if(Array.isArray(row.parts))for(const part of row.parts)text.append(part.changed?el(mark,null,part.text):el('span',null,part.text));
      else if(!row.text)text.append(el('span','is-blank','빈 줄'));
      else text.append(kind==='same'?el('span',null,row.text):el(mark,'is-whole',row.text));
      line.append(el('span','diff-side',kind==='removed'?'전':kind==='added'?'후':''),text);box.append(line);
    }
    if(truncated)box.append(el('p','note',list.length?'글이 길어 일부만 보여요.':'글이 길어 바뀐 줄은 여기 보이지 않아요. 게시물에서 확인해 주세요.'));
    return box;
  }
  function pair(before,after){
    const box=el('div','diff');
    for(const [side,kind,text] of [['전','removed',before],['후','added',after]]){const line=el('p','diff-row is-'+kind),body=el('span','diff-text');body.append(el(kind==='removed'?'del':'ins','is-whole',text));line.append(el('span','diff-side',side),body);box.append(line);}
    return box;
  }
  function detail(change){
    const box=el('div','change-body'),items=Array.isArray(change.items)?change.items:[],platform=String(change.account?.platform||'');let size=0;
    const lines=(rows,truncated)=>{size+=Array.isArray(rows)?rows.length:1;return diff(rows,truncated);};
    const either=(part,format)=>part.rows?lines(part.rows,part.truncated):(size+=2,pair(format(part.before),format(part.after)));
    if(change.kind==='presence')box.append(el('p','note',change.change==='added'?'이번 판에 이 계정 게시물을 새로 더했어요.':'이 계정에는 이번 판에서 올리지 않아요.'));
    else if(change.kind==='text')box.append(lines(change.rows,change.truncated));
    else if(change.kind==='value'){size+=2;box.append(pair(valueText(change.field,change.before),valueText(change.field,change.after)));}
    else if(change.kind==='media'){const list=el('ul','change-files');for(const item of items){list.append(el('li',null,fileLine(item)));size++;}box.append(list);}
    else if(change.kind==='options')for(const item of items){box.append(el('h4',null,has(optionNames,item.key)?optionNames[item.key]:item.key),either(item,value=>optionText(item.key,value)));size++;}
    else if(change.kind==='copies')for(const item of items){
      box.append(el('h4',null,past(item)+'문구 '+(item.index+1)+' — '+(item.change==='moved'?'문구 '+(item.from+1)+'에서 자리를 옮겼어요':COPY[item.change]||'')));size++;
      if(item.change!=='changed')continue;
      if(item.title&&TITLED.has(platform))box.append(el('p','diff-label','제목'),either(item.title,value=>value||'없음'));
      if(item.text)box.append(lines(item.text.rows,item.text.truncated));
      if(item.hashtags)box.append(el('p','diff-label','해시태그'),either(item.hashtags,value=>value||'없음'));
    }
    else if(change.kind==='schedule'){
      const rows=el('div','diff');
      for(const [side,kind,list] of [['전','removed',change.removed],['후','added',change.added]])for(const {entry,names} of slotGroups(Array.isArray(list)?list:[])){
        const line=el('p','diff-row is-'+kind),text=el('span','diff-text');
        text.append(el(kind==='removed'?'del':'ins','is-whole',(when(entry.scheduledAt,entry.timezone)||'시각 미정')+' · '+whoText(names)+(entry.cancelled?' · 취소됨':'')));
        line.append(el('span','diff-side',side),text);rows.append(line);size++;
      }
      box.append(rows);
      if(!booked())box.append(el('p','note','일정은 아직 다시 정하지 않았어요. 정해지면 새 링크로 다시 검토해요.'));
    }
    // 단추는 이번 판에 그 자리가 있을 때만 — 공통 문구를 다 지운 판에는 공통 문구 칸이 없다(아르곤 A2).
    const target=change.variant?change.variant:change.field==='body'?(state.snapshot.body?'body':null):['schedule','recurrence','expiresAt'].includes(change.field)?'when':null;
    if(target&&!(change.kind==='presence'&&change.change==='removed')){const go=el('button','view-post',change.variant?'게시물에서 보기':target==='body'?'공통 문구에서 보기':'올라가는 때에서 보기');go.type='button';go.addEventListener('click',()=>goTo(targets.get(target)));box.append(go);}
    return {node:box,size};
  }
  // 좁은 화면에서는 판이 게시물을 밀어내지 않게 의견은 마지막 둘, 바뀐 곳은 모두 접고 셋까지만 먼저 보인다.
  function compared(previous,changes){
    const box=el('section','sheet changes'),title=el('h2'),more=dropped(previous),total=changes.length+more,same=previous.state==='same'||previous.state==='compared'&&!total,narrow=typeof matchMedia==='function'&&matchMedia('(max-width:640px)').matches;
    const version=Number(previous.contentVersion)>0&&previous.contentVersion!==state.contentVersion?'(버전 '+previous.contentVersion+')':'';
    box.tabIndex=-1;
    if(previous.state==='unavailable'){box.append(el('h2',null,'지난 판과 바뀐 곳'),el('p','note','지난 판'+version+'과는 이 링크에서 견줘 볼 수 없어요. 바뀐 곳은 담당자에게 물어봐 주세요.'));return box;}
    if(same)title.textContent='지난 판과 같아요';
    else{title.append(el('span',null,'지난 판과 바뀐 곳'),el('span','count',String(total)));title.setAttribute('aria-label','지난 판과 바뀐 곳 '+total+'곳');}
    const date=day(previous.decidedAt||previous.answeredAt),what=previous.decision==='approve'?'승인한':previous.decision==='reject'?'수정을 요청한':previous.answeredAt?'의견을 남긴':'';
    const base=(date&&what?date+'에 '+what+' 판':'지난 판')+version;
    box.append(title,el('p','note',same?base+'과 보이는 내용은 같아요. 이 화면에 나오지 않는 정보만 바뀌었어요.':base+'과 견줬어요.'+(previous.decision==='approve'?' 바뀐 곳을 보고 다시 답해 주세요.':'')));
    const asked=Array.isArray(previous.requests)?previous.requests:[];
    if(asked.length){
      const part=el('div','asked'),list=el('ol','msgs is-small'),folded=asked.length-2,older=Number(previous.requestTotal)-asked.length;
      asked.forEach((entry,index)=>{const item=message(entry);if(index<folded)item.hidden=true;list.append(item);});
      part.append(el('h3',null,'그때 남긴 의견'),list);
      if(folded>0){const unfold=el('button','more','앞의 의견 '+folded+'개 더 보기');unfold.type='button';unfold.addEventListener('click',()=>{for(const item of list.children)item.hidden=false;unfold.hidden=true;});part.append(unfold);}
      if(older>0)part.append(el('p','note','그보다 앞의 의견 '+older+'개는 줄였어요.'));
      box.append(part);
    }
    if(!same){
      // 게시물 전체(이름·공통 문구·일정)를 먼저, 그다음 계정마다 소제목 아래로 묶어 「모루 커피 · 인스타그램 —」를 되풀이하지 않는다.
      const list=el('ol','change-list'),group=change=>change.variant||(change.kind==='presence'?'removed:'+accountName(change.account):''),ordered=[...changes.filter(change=>!group(change)),...changes.filter(change=>group(change))];
      let last='',count=0;
      for(const change of ordered){
        const key=group(change),fold=narrow&&count>=3;
        if(key&&key!==last){const head=el('li','change-group',accountName(change.account));head.hidden=fold;list.append(head);}
        last=key;
        const item=el('li','change'),details=el('details'),summary=el('summary'),body=detail(change);
        summary.append(el('span','change-label',change.kind==='presence'?(change.change==='added'?'새로 더한 게시물':'이번 판에서 뺀 게시물'):FIELD[change.field]||change.field),el('span','change-meta',brief(change)));
        details.append(summary,body.node);details.open=!narrow&&changes.length<=3&&body.size<=10;
        item.hidden=fold;count++;
        item.append(details);list.append(item);
      }
      box.append(list);
      if(more)box.append(el('p','note','그 밖에 바뀐 곳 '+more+'곳은 길어서 여기 보이지 않아요. 게시물에서 확인해 주세요.'));
      if(narrow&&changes.length>3){const all=el('button','more','바뀐 곳 '+changes.length+'개 모두 보기');all.type='button';all.addEventListener('click',()=>{for(const item of list.children)item.hidden=false;all.hidden=true;});box.append(all);}
    }
    return box;
  }
  function head(review,snapshot,previous,changes){
    heading.textContent=snapshot.title||'게시물';notice.hidden=true;
    // 승인한 뒤 「그래서 언제 올라가나」가 헷갈린다는 불만이 많다(벤치마킹 10-23) — 승인 뒤에는 일정이 어떻게 되는지 한 줄로 말한다.
    // 예약은 사내 승인 뒤에만 잡히고 일정이 바뀌면 링크가 닫히므로, 예약이 보이면 「남은 확인이 없으면 그 때 그대로」가 맞다.
    const booked=(snapshot.schedule||[]).some(entry=>!entry.cancelled&&entry.scheduledAt);
    lede.textContent=!review.required?'의견을 듣는 검토예요. 올리는 일정은 이 답을 기다리지 않아요.'
      :review.status==='approved'?(booked?'승인됐어요. 남은 확인이 없으면 예약한 때에 그대로 올라가요.':'승인됐어요. 일정이 정해지면 새 링크로 다시 검토해요.')
      :review.status==='rejected'?'수정 요청이 들어갔어요. 고치면 새 링크로 다시 검토해요.':'필수 검토예요. 승인하기 전에는 올라가지 않아요.';
    lede.hidden=false;
    const status=has(STATUS,review.status)?review.status:'pending',chips=[el('li','fact-state is-'+status,STATUS[status])];
    // 바뀐 곳 칩은 판으로 가는 단추다(좁은 화면에서는 판이 접혀 있다).
    const count=changes.length+dropped(previous);
    if(previous&&previous.state!=='unavailable'){const chip=el('li','fact-diff'),go=el('button',null,previous.state==='compared'&&count?'바뀐 곳 '+count:'지난 판과 같음');go.type='button';go.addEventListener('click',()=>goTo(targets.get('changes')));chip.append(go);chips.push(chip);}
    const platforms=[...new Set(snapshot.variants.map(v=>{const p=String(v.account?.platform||'');return has(PLATFORM,p)?PLATFORM[p]:p;}).filter(Boolean))];
    if(platforms.length)chips.push(el('li',null,platforms.join(' · ')));
    const times=[...new Set((snapshot.schedule||[]).filter(entry=>!entry.cancelled&&entry.scheduledAt).map(entry=>entry.scheduledAt+'|'+(entry.timezone||'')))].sort();
    if(times.length){const [at,zone]=times[0].split('|');chips.push(el('li',null,'게시 '+when(at,zone)+(times.length>1?' 외 '+(times.length-1)+'번':'')));}
    else chips.push(el('li',null,'게시 일정 미정'));
    chips.push(el('li',null,'링크 '+when(review.expiresAt)+'까지'),el('li',null,'버전 '+review.contentVersion));
    facts.replaceChildren(...chips);facts.hidden=false;
  }
  function render(data){
    state=data.review;errorBox.hidden=true;formError.hidden=true;
    // 모르는 상태값은 견줄 수 없는 것으로 읽는다(칩도 판도 「견줘 볼 수 없어요」 하나로).
    const raw=state.previous&&typeof state.previous==='object'?state.previous:null,previous=raw&&!['compared','same','unavailable'].includes(raw.state)?{state:'unavailable',contentVersion:raw.contentVersion}:raw;
    const snapshot=state.snapshot,changes=visible(previous),key=JSON.stringify([snapshot,previous]);
    head(state,snapshot,previous,changes);
    // 링크의 게시물과 지난 판 비교는 바뀌지 않는다(게시물이 바뀌면 서버가 링크를 닫고, 비교는 링크를 만들 때 얼린다) —
    // 같은 내용이면 다시 그리지 않아 펼쳐 둔 사진·영상과 펼친 바뀐 곳을 그대로 둔다.
    if(key!==shown){
      release();content.replaceChildren();targets.clear();shown=key;
      const marks=marksOf(changes);
      if(previous){const sheet=compared(previous,changes);targets.set('changes',sheet);content.append(sheet);}
      if(snapshot.body){const brief=el('section','sheet brief'),title=el('h2',null,'공통 문구');if(marks.post.has('body'))title.append(tag('바뀜'));brief.tabIndex=-1;brief.append(title,richText(snapshot.body,'post-text'));targets.set('body',brief);content.append(brief);}
      const posts=el('section','posts-block'),title=el('h2','block-title'),grid=el('div','posts');
      // 개수는 칸 사이로만 떨어져 있어 화면 읽기가 「올라갈 게시물2」로 붙여 읽는다 — 제목 이름을 따로 준다.
      title.append(el('span',null,'올라갈 게시물'),el('span','count',String(snapshot.variants.length)));title.setAttribute('aria-label','올라갈 게시물 '+snapshot.variants.length+'개');
      snapshot.variants.forEach((variant,index)=>{const key=typeof variant.key==='string'?variant.key:'v'+index,card=postCard(variant,marks.variants.get(key)||null);targets.set(key,card);grid.append(card);});
      const slots=schedule(snapshot,['schedule','recurrence','expiresAt'].some(field=>marks.post.has(field)));targets.set('when',slots);
      posts.append(title,grid);content.append(posts,slots);
    }
    thread(state);fine.textContent=data.notice||'';
    content.hidden=false;feedback.hidden=false;form.hidden=false;updateDock();
  }
  async function send(){
    if(busy||!pending)return;
    const decision=pending.decision;setBusy(true);formError.hidden=true;result.textContent='';
    try{const data=await api('respond',pending);pending=null;retry.hidden=true;render(data);$('review-comment').value='';result.textContent=SAVED[decision];}
    catch(error){
      if([403,410].includes(error.status)){pending=null;close(error.message);}
      else if(error.status===409){pending=null;retry.hidden=true;try{render(await api('open'));}catch(refreshError){if([403,410].includes(refreshError.status))close(refreshError.message);}if(!closed)showFormError(error.message);}
      else if(error.status&&error.status<500&&error.status!==429){pending=null;retry.hidden=true;showFormError(error.message);}
      else{retry.hidden=false;showFormError('저장됐는지 확인하지 못했어요. 다시 보내도 두 번 저장되지 않아요.');}
    }finally{setBusy(false);if(!closed)updateDock();}
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(busy||closed||pending||!state)return;
    const decision=event.submitter?.value;if(!['comment','approve','reject'].includes(decision))return;
    const comment=$('review-comment').value.trim();
    if(decision!=='approve'&&!comment){showFormError(decision==='reject'?'무엇을 고칠지 의견에 적어 주세요.':'남길 의견을 적어 주세요.');$('review-comment').focus();return;}
    // 막대에서 승인하면 저장 결과·오류가 보이는 답하기 칸으로 내려간다.
    if(event.submitter===dockApprove)reveal();
    pending={revision:state.revision,requestId:crypto.randomUUID(),decision,name:$('review-name').value.trim(),comment};void send();
  });
  function reveal(target=form){const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(typeof target.scrollIntoView==='function')target.scrollIntoView({behavior:still?'auto':'smooth',block:'start'});}
  // 바뀐 곳에서 게시물로, 칩에서 바뀐 곳으로: 그 자리로 옮기고 초점도 옮긴다(주소 해시는 열쇠라 # 닻을 쓰지 않는다).
  function goTo(target){if(!target)return;reveal(target);if(typeof target.focus==='function')target.focus({preventScroll:true});}
  retry.addEventListener('click',()=>void send());window.addEventListener('pagehide',()=>{closed=true;release();});
  // 뒤로·앞으로 가기 캐시로 되살아나면 떠날 때 닫고 놓은 상태(단추가 안 먹고 펼친 파일이 깨짐)라 처음부터 다시 연다.
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  dockWrite.addEventListener('click',()=>{reveal();$('review-comment').focus({preventScroll:true});});
  if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{formInView=entries.some(entry=>entry.isIntersecting);updateDock();},{threshold:.2}).observe(form);
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){close('링크 주소가 잘렸거나 달라졌어요. 받은 검토 링크 전체를 그대로 다시 열어 주세요.');return;}
  api('open').then(render).catch(error=>close(error.message));
})();

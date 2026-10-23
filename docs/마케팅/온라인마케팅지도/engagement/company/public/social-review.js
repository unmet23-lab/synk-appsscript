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
  const ZONE='Asia/Seoul',urls=new Set();
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
  function settings(raw){
    const entries=Object.entries(raw||{}).filter(([,value])=>value!==''&&value!=null);
    if(!entries.length)return null;
    const box=el('section','settings'),list=el('dl');
    for(const [key,value] of entries){const row=el('div');row.append(el('dt',null,has(optionNames,key)?optionNames[key]:key),el('dd',null,optionValue(key,value)));list.append(row);}
    box.append(el('h3',null,'함께 보내는 설정'),list);
    return box;
  }
  // 사진·영상 칸의 모양은 원본 가로세로 비율에 가장 가까운 판으로 고른다(9:16 · 4:5 · 1:1 · 16:9).
  function ratio(media){
    const w=Number(media.width),h=Number(media.height);
    if(!(w>0&&h>0))return media.type==='video'?'r-169':'r-45';
    const r=h/w;return r>=1.6?'r-916':r>=1.15?'r-45':r>=.85?'r-11':'r-169';
  }
  function frame(media,index,total,alt){
    const video=media.type==='video',word=video?'영상 보기':'사진 보기';
    const figure=el('figure','frame '+ratio(media)),load=el('button','load'),label=el('span','load-word',word),problem=el('p','frame-error');
    load.type='button';problem.hidden=true;
    load.append(label,el('span','load-meta',[video&&media.duration?clock(media.duration):'',media.width&&media.height?media.width+'×'+media.height:''].filter(Boolean).join(' · ')));
    figure.append(load,problem);
    if(total>1)figure.append(el('span','count',(index+1)+'/'+total));
    load.addEventListener('click',async()=>{
      load.disabled=true;label.textContent='불러오는 중';problem.hidden=true;
      try{
        const blob=await api('media',{mediaKey:media.key},true);
        if(closed)return;
        const url=URL.createObjectURL(blob);urls.add(url);
        const element=el(video?'video':'img');
        if(video){element.controls=true;element.preload='metadata';element.playsInline=true;}else element.alt=alt||'올라갈 사진 '+(index+1);
        element.src=url;load.replaceWith(element);
      }catch(error){
        load.disabled=false;label.textContent=word;
        if([403,410].includes(error.status))close(error.message);else{problem.textContent=error.message;problem.hidden=false;}
      }
    });
    return figure;
  }
  function copies(list,platform){
    const box=el('section','copies');
    box.append(el('h3',null,'반복 게시 문구'),el('p','note','반복해서 올릴 때 두 번째부터 차례로 써요.'));
    list.forEach((copy,index)=>{
      const item=el('div','copy');item.append(el('span','copy-n','문구 '+(index+2)));
      if(TITLED.has(platform)&&copy.title)item.append(el('p','post-title',copy.title));
      item.append(copy.text?richText(copy.text,'post-text'):el('p','post-text is-empty','문구 없음'));
      if(copy.hashtags){const tags=el('p','copy-tags');tags.append(el('span',null,'해시태그'),el('span','mark',copy.hashtags));item.append(tags);}
      box.append(item);
    });
    return box;
  }
  function postCard(variant){
    const account=variant.account||{},platform=String(account.platform||''),name=account.name||account.profile||'게시 계정';
    const card=el('article','post'),head=el('header','post-head'),who=el('span','who');
    who.append(el('strong',null,name));if(account.profile&&account.profile!==name)who.append(el('span',null,account.profile));
    head.append(el('span','avatar',Array.from(name)[0]||'·'),who,el('span','where',[has(PLATFORM,platform)?PLATFORM[platform]:platform,has(FORMAT,variant.format)?FORMAT[variant.format]:variant.format].filter(Boolean).join(' · ')));
    card.append(head);
    const media=Array.isArray(variant.media)?variant.media:[],alt=typeof variant.options?.altText==='string'?variant.options.altText:'';
    if(media.length){const box=el('div',media.length>1?'media is-strip':'media');media.forEach((item,index)=>box.append(frame(item,index,media.length,alt)));card.append(box);}
    const caption=el('div','caption');
    if(TITLED.has(platform)&&variant.title)caption.append(el('p','post-title',variant.title));
    caption.append(variant.text?richText(variant.text,'post-text'):el('p','post-text is-empty','문구 없음'));
    card.append(caption);
    if(Array.isArray(variant.copyVariants)&&variant.copyVariants.length)card.append(copies(variant.copyVariants,platform));
    const options=settings(variant.options);if(options)card.append(options);
    return card;
  }
  function schedule(snapshot){
    const box=el('section','sheet when'),rows=Array.isArray(snapshot.schedule)?snapshot.schedule:[];
    box.append(el('h2',null,'올라가는 때'));
    if(!rows.length)box.append(el('p','note','아직 정한 일정이 없어요. 일정이 정해지면 새 링크로 다시 검토해요.'));
    else{
      // 같은 시각에 올라가는 계정은 한 줄로 묶는다. 같은 이름의 계정이 둘이면 「이름 2곳」.
      const groups=new Map();
      for(const entry of rows){const key=[entry.scheduledAt,entry.timezone,entry.cancelled?1:0].join('|');if(!groups.has(key))groups.set(key,{entry,names:new Map()});const names=groups.get(key).names,who=entry.account||'게시 계정';names.set(who,(names.get(who)||0)+1);}
      const list=el('ol','slots');
      for(const {entry,names} of [...groups.values()].sort((a,b)=>String(a.entry.scheduledAt).localeCompare(String(b.entry.scheduledAt)))){
        const item=el('li',entry.cancelled?'slot is-off':'slot');
        item.append(el('span','slot-time',when(entry.scheduledAt,entry.timezone)||'시각 미정'),el('span','slot-who',[...names].map(([who,count])=>count>1?who+' '+count+'곳':who).join(' · ')));
        if(entry.cancelled)item.append(el('span','slot-off','취소됨'));
        list.append(item);
      }
      box.append(list);
    }
    // maxOccurrences는 첫 회를 포함한 총 횟수다(social-publishing nextRepeatJob) — 「다시 3번」으로 읽히지 않게 쓴다.
    const repeat=snapshot.recurrence;
    if(repeat&&Number(repeat.intervalDays)>0)box.append(el('p','note',repeat.intervalDays+'일마다 올려요'+(Number(repeat.maxOccurrences)>0?' · 처음을 포함해 모두 '+repeat.maxOccurrences+'번':'')+(repeat.until?' · '+when(repeat.until)+'까지':'')));
    if(snapshot.expiresAt)box.append(el('p','note',when(snapshot.expiresAt)+' 뒤로는 올리지 않아요.'));
    return box;
  }
  function thread(review){
    const items=Array.isArray(review.feedback)?review.feedback:[],title=el('h2');
    title.append(el('span',null,'주고받은 의견'),el('span','count',String(items.length)));title.setAttribute('aria-label','주고받은 의견 '+items.length+'개');
    feedback.replaceChildren(title);
    if(!items.length){feedback.append(el('p','note','아직 남긴 의견이 없어요.'));return;}
    const list=el('ol','msgs');
    for(const entry of items){
      const kind=has(DECISION,entry.decision)?entry.decision:'comment',item=el('li','msg is-'+kind),top=el('p','msg-head'),at=el('time',null,when(entry.createdAt));
      at.dateTime=String(entry.createdAt||'');
      top.append(el('span','msg-tag',DECISION[kind]),el('strong',null,entry.name||'이름 없음'),at);
      item.append(top,el('p','msg-text',entry.comment||'승인했어요.'));list.append(item);
    }
    feedback.append(list);
  }
  function head(review,snapshot){
    heading.textContent=snapshot.title||'게시물';notice.hidden=true;
    // 승인한 뒤 「그래서 언제 올라가나」가 헷갈린다는 불만이 많다(벤치마킹 10-23) — 승인 뒤에는 일정이 어떻게 되는지 한 줄로 말한다.
    // 예약은 사내 승인 뒤에만 잡히고 일정이 바뀌면 링크가 닫히므로, 예약이 보이면 「남은 확인이 없으면 그 때 그대로」가 맞다.
    const booked=(snapshot.schedule||[]).some(entry=>!entry.cancelled&&entry.scheduledAt);
    lede.textContent=!review.required?'의견을 듣는 검토예요. 올리는 일정은 이 답을 기다리지 않아요.'
      :review.status==='approved'?(booked?'승인됐어요. 남은 확인이 없으면 예약한 때에 그대로 올라가요.':'승인됐어요. 일정이 정해지면 새 링크로 다시 검토해요.')
      :review.status==='rejected'?'수정 요청이 들어갔어요. 고치면 새 링크로 다시 검토해요.':'필수 검토예요. 승인하기 전에는 올라가지 않아요.';
    lede.hidden=false;
    const status=has(STATUS,review.status)?review.status:'pending',chips=[el('li','fact-state is-'+status,STATUS[status])];
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
    const snapshot=state.snapshot,key=JSON.stringify(snapshot);
    head(state,snapshot);
    // 링크의 게시물은 바뀌지 않는다(바뀌면 서버가 링크를 닫는다) — 같은 내용이면 다시 그리지 않아 펼쳐 둔 사진·영상을 그대로 둔다.
    if(key!==shown){
      release();content.replaceChildren();shown=key;
      if(snapshot.body){const brief=el('section','sheet brief');brief.append(el('h2',null,'공통 문구'),richText(snapshot.body,'post-text'));content.append(brief);}
      const posts=el('section','posts-block'),title=el('h2','block-title'),grid=el('div','posts');
      // 개수는 칸 사이로만 떨어져 있어 화면 읽기가 「올라갈 게시물2」로 붙여 읽는다 — 제목 이름을 따로 준다.
      title.append(el('span',null,'올라갈 게시물'),el('span','count',String(snapshot.variants.length)));title.setAttribute('aria-label','올라갈 게시물 '+snapshot.variants.length+'개');
      for(const variant of snapshot.variants)grid.append(postCard(variant));
      posts.append(title,grid);content.append(posts,schedule(snapshot));
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
  function reveal(){const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(typeof form.scrollIntoView==='function')form.scrollIntoView({behavior:still?'auto':'smooth',block:'start'});}
  retry.addEventListener('click',()=>void send());window.addEventListener('pagehide',()=>{closed=true;release();});
  // 뒤로·앞으로 가기 캐시로 되살아나면 떠날 때 닫고 놓은 상태(단추가 안 먹고 펼친 파일이 깨짐)라 처음부터 다시 연다.
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  dockWrite.addEventListener('click',()=>{reveal();$('review-comment').focus({preventScroll:true});});
  if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{formInView=entries.some(entry=>entry.isIntersecting);updateDock();},{threshold:.2}).observe(form);
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){close('링크 주소가 잘렸거나 달라졌어요. 받은 검토 링크 전체를 그대로 다시 열어 주세요.');return;}
  api('open').then(render).catch(error=>close(error.message));
})();

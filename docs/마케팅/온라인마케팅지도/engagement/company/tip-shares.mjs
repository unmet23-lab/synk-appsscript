// 공유한 게시물(2026-11-16) — 유호님이 텔레그램으로 공유한 게시물의 판단 결과를 관리자에게 보이고, 시안 줄의 「적용해」·「버림」 요청을 받는다.
// 계약은 TIP-SHARES.md. 회사 서버는 팁 장부(구글 시트)에 직접 닿지 않는다. PC 도구(tools/팁장부동기.js)가 줄 묶음을 올리고(snapshot),
// 단추 요청을 가져가(sync) 장부에 쓴 뒤 결과를 돌려준다. 저장은 documents 표의 두 종류뿐이라 스키마가 바뀌지 않는다.
import {createHash,randomUUID} from 'node:crypto';

export const TIP_SHARE_KINDS=Object.freeze({snapshot:'tipShares',request:'tipShareRequests',decision:'tipShareDecisions'});
// rows · bytes: 300줄 × 줄 상한이면 넘을 수 있어 PC 도구가 오래된 줄부터 덜어 900KB 안에 맞춘다(TIP-SHARES.md). claimAfterMs: 누른 뒤 되돌릴 틈.
export const TIP_SHARE_LIMITS=Object.freeze({rows:300,results:300,bytes:1000000,summary:400,note:800,target:120,stageNote:200,draftText:300,url:1000,postId:80,futureSkewMs:5*60000,claimAfterMs:90000,pushers:500,pusherSessionMs:8*24*3600000});
export const TIP_VERDICTS=Object.freeze(['시안','기록','기각','']);
export const TIP_STATUSES=Object.freeze(['새로','적용 중','적용함','버림']);
export const TIP_DECISIONS=Object.freeze(['적용 중','버림']);
export const TIP_KINDS=Object.freeze(['디자인 참고','AI 작업 팁','도구·서비스','기타','']);
// 화면에 보이는 진행. PC 도구가 장부 상태와 카드 상태로 정한다(카드가 이긴다, TIP-SHARES.md 「줄 하나를 만드는 규칙」).
export const TIP_STAGES=Object.freeze(['판단 전','기록','기각','시안 차례','시안 만드는 중','시안 나옴','적용 중','적용함','보류','버림']);
const ROW_KEYS=['row','postId','sharedAt','url','summary','kind','target','verdict','note','status','stage','stageNote','draft'];
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SNAPSHOT_ID='snapshot';
// 장부를 올리거나 요청을 가져간 계정 목록. 스냅숏과 따로 두고 한 번 오른 계정은 빼지 않는다(다른 관리자가 sync를 불러도 밀려나지 않게).
const PUSHERS_ID='pushers';

export const tipShareError=(message,status,code)=>Object.assign(new Error(message),{status,code});
const invalid=field=>{throw tipShareError(`공유한 게시물 자료의 ${field} 값을 확인해 주세요.`,400,'SYNK_TIP_INVALID');};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactKeys(value,keys,required,field){
  if(!plain(value)||Object.keys(value).some(key=>!keys.includes(key))||required.some(key=>!Object.hasOwn(value,key)))invalid(field);
  return value;
}
function text(value,max,field,{lines=true}={}){
  if(typeof value!=='string'||value.length>max||CONTROL.test(value)||!lines&&/[\r\n]/.test(value))invalid(field);
  return value;
}
// 링크는 http · https만 받는다. 서버는 이 주소를 열지 않는다(화면이 새 탭으로만 연다).
export function tipLink(value,field='url'){
  text(value,TIP_SHARE_LIMITS.url,field,{lines:false});
  if(value==='')return '';
  let parsed;try{parsed=new URL(value);}catch{invalid(field);}
  if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)invalid(field);
  return parsed.href;
}
function rowNumber(value,field='row'){if(!Number.isSafeInteger(value)||value<2||value>1000000)invalid(field);return value;}
function postIdValue(value,field='postId'){text(value,TIP_SHARE_LIMITS.postId,field,{lines:false});if(!/^[A-Za-z0-9_-]*$/.test(value))invalid(field);return value;}
function draftValue(value,field){
  if(value===null)return null;
  if(!plain(value)||Object.keys(value).length!==1)invalid(field);
  if(Object.hasOwn(value,'url')){const url=tipLink(value.url,field+'.url');if(!url)invalid(field+'.url');return {url};}
  if(Object.hasOwn(value,'text')){const label=text(value.text,TIP_SHARE_LIMITS.draftText,field+'.text',{lines:false}).trim();if(!label)invalid(field+'.text');return {text:label};}
  invalid(field);
}
export function tipRow(raw,index=0){
  const field=`rows[${index}]`;
  exactKeys(raw,ROW_KEYS,ROW_KEYS,field);
  const sharedAt=text(raw.sharedAt,16,field+'.sharedAt',{lines:false});
  if(sharedAt&&!/^\d{4}-\d{2}-\d{2}(?: \d{1,2}:\d{2})?$/.test(sharedAt))invalid(field+'.sharedAt');
  if(!TIP_KINDS.includes(raw.kind))invalid(field+'.kind');
  if(!TIP_VERDICTS.includes(raw.verdict))invalid(field+'.verdict');
  if(!TIP_STATUSES.includes(raw.status))invalid(field+'.status');
  if(!TIP_STAGES.includes(raw.stage))invalid(field+'.stage');
  const draft=draftValue(raw.draft,field+'.draft');
  if(raw.verdict!=='시안'&&draft)invalid(field+'.draft');
  if(raw.stage==='시안 나옴'&&(!draft||raw.verdict!=='시안'))invalid(field+'.stage');
  if(['시안 차례','시안 만드는 중'].includes(raw.stage)&&raw.verdict!=='시안')invalid(field+'.stage');
  return {row:rowNumber(raw.row,field+'.row'),postId:postIdValue(raw.postId,field+'.postId'),sharedAt,url:tipLink(raw.url,field+'.url'),
    summary:text(raw.summary,TIP_SHARE_LIMITS.summary,field+'.summary'),kind:raw.kind,target:text(raw.target,TIP_SHARE_LIMITS.target,field+'.target',{lines:false}),
    verdict:raw.verdict,note:text(raw.note,TIP_SHARE_LIMITS.note,field+'.note'),status:raw.status,stage:raw.stage,
    stageNote:text(raw.stageNote,TIP_SHARE_LIMITS.stageNote,field+'.stageNote',{lines:false}),draft};
}
function isoTime(value,field){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))invalid(field);
  return Date.parse(value);
}
const canonical=value=>JSON.stringify(value,(_,entry)=>plain(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
const hashRows=rows=>createHash('sha256').update(canonical(rows)).digest('hex');
// 단추를 둘 줄: 시안이 나왔고(진행 「시안 나옴」) 장부 상태가 새로인 줄.
// 게시물ID가 빈 줄은 고르지 못한다. 장부 웹앱이 줄 번호와 게시물ID를 함께 맞춰 쓰는데, 빈 ID끼리는 줄이 밀려도 같아 보이기 때문이다.
export const tipDecidable=row=>row.stage==='시안 나옴'&&row.verdict==='시안'&&Boolean(row.draft)&&row.status==='새로'&&row.postId!=='';


// 세션이 아직 살아 있는지(서버 토큰 표에 그 해시의 로그인 세션이 남았는지). 읽지 못하면 살아 있다고 본다(막는 쪽으로).
function storeSessionAlive(store){
  return (hash,at)=>{try{return Boolean(store.db.prepare("SELECT 1 FROM tokens WHERE hash=? AND purpose='session' AND expiresAt>?").get(hash,at));}catch{return true;}};
}

export function createTipSharesService({store,clock=()=>Date.now(),sessionAlive=storeSessionAlive(store)}){
  // 회사 서버의 clock은 ISO 글을, 시험은 숫자를 줄 수 있다.
  const nowMs=()=>{const value=clock();const ms=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(ms))throw tipShareError('서버 시각을 읽지 못했어요.',500,'SYNK_TIP_CLOCK');return ms;};
  const iso=ms=>new Date(ms).toISOString();
  function admin(user){
    if(!user)throw tipShareError('먼저 로그인해 주세요.',401,'SYNK_TIP_LOGIN');
    if(user.role!=='admin')throw tipShareError('관리자만 볼 수 있어요.',403,'SYNK_TIP_ADMIN');
  }
  const snapshot=()=>store.get(TIP_SHARE_KINDS.snapshot,SNAPSHOT_ID);
  const requests=()=>store.all(TIP_SHARE_KINDS.request);
  const requestFor=(row,postId)=>requests().find(item=>item.row===row&&item.postId===postId)||null;
  const pendingView=item=>item?{to:item.to,requestedAt:item.requestedAt,claimed:Boolean(item.claimedAt)}:null;
  // 자료를 올리고 요청을 가져가는 쪽(PC 도구)의 로그인 세션은 시안을 고를 수 없다 — 도구가 스스로 적용을 승인하지 못하게.
  // 계정이 아니라 세션으로 가른다(11-17). PC 도구는 유호님이 Workspace에 로그인하시는 계정(작업실 예약 도구의 자격)으로 들어가므로,
  // 계정으로 막으면 유호님이 브라우저에서도 고를 수 없게 된다. 같은 계정이라도 도구가 올린 세션만 막고, 브라우저 세션은 고를 수 있다.
  // 앞 판이 계정으로 적은 목록(ids, 스냅숏 안 pushers)은 읽지 않는다. 각 세션은 그 세션이 끝나는 때와 올린 때부터 8일 가운데
  // 이른 때까지 막는다. 살아 있는 세션은 밀어내지 않는다 — 밀려난 도구 세션의 쿠키로 고를 수 있게 되므로(GPT GA1).
  // 도구는 회차 끝에 로그아웃하므로, 등록할 때 끝난 세션(만료 · 로그아웃)을 지워 목록을 작게 둔다. 그래도 살아 있는 세션이
  // pushers개에 이르면 새 세션의 sync · snapshot을 거절한다(막는 쪽으로 멈춘다).
  const sessionOf=ctx=>{const value=ctx?.session;if(typeof value!=='string'||!value)throw tipShareError('로그인 상태를 다시 확인해 주세요.',401,'SYNK_TIP_LOGIN');return value;};
  const pusherEntries=now=>(store.get(TIP_SHARE_KINDS.snapshot,PUSHERS_ID)?.sessions||[]).filter(item=>typeof item?.hash==='string'&&Date.parse(item.until)>now);
  const isPusher=hash=>Boolean(hash)&&pusherEntries(nowMs()).some(item=>item.hash===hash);
  function enroll(ctx){
    const hash=sessionOf(ctx),now=nowMs(),expires=Date.parse(ctx.expiresAt);
    const until=iso(Math.min(Number.isFinite(expires)?expires:Infinity,now+TIP_SHARE_LIMITS.pusherSessionMs));
    const kept=pusherEntries(now).filter(item=>item.hash!==hash&&sessionAlive(item.hash,iso(now)));
    if(kept.length>=TIP_SHARE_LIMITS.pushers)throw tipShareError('장부를 올리는 연결이 너무 많이 남아 있어요. 서버 담당에게 알려 주세요.',403,'SYNK_TIP_PUSHERS_FULL');
    kept.push({hash,until,at:iso(now)});
    store.put(TIP_SHARE_KINDS.snapshot,PUSHERS_ID,{sessions:kept});
    return new Set(kept.map(item=>item.hash));
  }
  // 정리된 요청의 마지막 결과를 줄마다 하나 남긴다(누가 언제 무엇을 골랐는지, 장부에 옮겼는지).
  function settle(item,outcome,at){
    store.remove(TIP_SHARE_KINDS.request,item.id);
    store.put(TIP_SHARE_KINDS.decision,String(item.row),{row:item.row,postId:item.postId,to:item.to,requestedAt:item.requestedAt,requestedBy:item.requestedBy,settledAt:at,outcome});
  }

  function workspace(user,ctx){
    admin(user);
    const current=snapshot(),open=requests(),decisions=new Map(store.all(TIP_SHARE_KINDS.decision).map(item=>[item.row,item]));
    const rows=(current?.rows||[]).slice().sort((a,b)=>b.row-a.row).map(row=>{
      const pending=open.find(item=>item.row===row.row&&item.postId===row.postId)||null;
      const decided=decisions.get(row.row);
      return {...row,decidable:tipDecidable(row),pending:pendingView(pending),
        decision:decided&&decided.postId===row.postId?{to:decided.to,requestedAt:decided.requestedAt,outcome:decided.outcome}:null};
    });
    return {ready:Boolean(current),generatedAt:current?.generatedAt||null,receivedAt:current?.receivedAt||null,
      canDecide:Boolean(current)&&typeof ctx?.session==='string'&&Boolean(ctx.session)&&!isPusher(ctx.session),waiting:rows.filter(row=>row.decidable&&!row.pending).length,rows};
  }

  function rowRef(input){
    exactKeys(input,['row','postId','to'],['row','postId'],'body');
    return {row:rowNumber(input.row),postId:postIdValue(input.postId)};
  }

  function decide(user,input,ctx){
    admin(user);
    const hash=sessionOf(ctx);
    const {row,postId}=rowRef(input);
    if(!TIP_DECISIONS.includes(input.to))invalid('to');
    store.transaction(()=>{
      if(isPusher(hash))throw tipShareError('장부를 올리는 자동화 연결로는 고를 수 없어요.',403,'SYNK_TIP_PUSHER');
      const current=snapshot()?.rows||[];
      const found=current.find(item=>item.row===row&&item.postId===postId);
      if(!found)throw tipShareError('장부가 바뀌었어요. 새로 고침한 뒤 다시 골라 주세요.',409,'SYNK_TIP_ROW_CHANGED');
      if(!tipDecidable(found))throw tipShareError('이 줄은 지금 고를 수 있는 시안이 아니에요. 새로 고침해 주세요.',409,'SYNK_TIP_NOT_DECIDABLE');
      if(requests().some(item=>item.row===row&&item.postId===postId))throw tipShareError('이 시안은 이미 골랐어요.',409,'SYNK_TIP_ALREADY_DECIDED');
      const id=randomUUID();
      store.put(TIP_SHARE_KINDS.request,id,{id,row,postId,to:input.to,from:'새로',requestedAt:iso(nowMs()),requestedBy:user.id,requestedSession:hash,claimedAt:null,claimedBy:null});
    });
    return workspace(user,ctx);
  }

  function cancel(user,input,ctx){
    admin(user);
    const hash=sessionOf(ctx);
    const {row,postId}=rowRef(input);
    if(Object.hasOwn(input,'to'))invalid('to');
    store.transaction(()=>{
      if(isPusher(hash))throw tipShareError('장부를 올리는 자동화 연결로는 되돌릴 수 없어요.',403,'SYNK_TIP_PUSHER');
      const found=requestFor(row,postId);
      if(!found)throw tipShareError('되돌릴 선택이 없어요. 새로 고침해 주세요.',404,'SYNK_TIP_NO_REQUEST');
      if(found.claimedAt)throw tipShareError('벌써 장부로 옮기는 중이라 여기서는 되돌릴 수 없어요. 장부의 상태 칸에서 바꿔 주세요.',409,'SYNK_TIP_CLAIMED');
      store.remove(TIP_SHARE_KINDS.request,found.id);
    });
    return workspace(user,ctx);
  }

  // PC 도구가 부른다. 누른 지 claimAfterMs가 지난 요청만 가져감으로 표시하고(그 전에는 화면에서 되돌릴 수 있다),
  // 결과를 아직 못 받은 요청을 모두 돌려준다(앞 회차에 가져간 것도 다시).
  function sync(user,input,ctx){
    admin(user);
    sessionOf(ctx);
    exactKeys(input,['version'],['version'],'body');if(input.version!==1)invalid('version');
    const now=nowMs(),at=iso(now);
    const claimed=store.transaction(()=>{
      // 줄을 올리는 세션이 그 전에 고른 것은 가져가지 않고 지운다(올리기 전에 고르고 스스로 가져가는 길을 막는다).
      const blocked=enroll(ctx);
      return requests().flatMap(item=>{
        if(!item.claimedAt&&blocked.has(item.requestedSession)){store.remove(TIP_SHARE_KINDS.request,item.id);return [];}
        if(item.claimedAt)return [item];
        if(now-Date.parse(item.requestedAt)<TIP_SHARE_LIMITS.claimAfterMs)return [];
        const next={...item,claimedAt:at,claimedBy:user.id};store.put(TIP_SHARE_KINDS.request,item.id,next);return [next];
      });
    });
    return {requests:claimed.sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt)).map(item=>({id:item.id,row:item.row,postId:item.postId,from:item.from,to:item.to,requestedAt:item.requestedAt})),
      generatedAt:snapshot()?.generatedAt||null};
  }

  function snapshotInput(user,input,ctx){
    admin(user);
    sessionOf(ctx);
    exactKeys(input,['version','generatedAt','rows','results'],['version','generatedAt','rows','results'],'body');
    if(input.version!==1)invalid('version');
    const generated=isoTime(input.generatedAt,'generatedAt'),now=nowMs();
    if(generated>now+TIP_SHARE_LIMITS.futureSkewMs)invalid('generatedAt');
    if(!Array.isArray(input.rows)||input.rows.length>TIP_SHARE_LIMITS.rows)invalid('rows');
    if(!Array.isArray(input.results)||input.results.length>TIP_SHARE_LIMITS.results)invalid('results');
    const rows=input.rows.map(tipRow),seen=new Set();
    for(const row of rows){if(seen.has(row.row))invalid('rows.row');seen.add(row.row);}
    rows.sort((a,b)=>b.row-a.row);
    const results=input.results.map((raw,index)=>{
      exactKeys(raw,['id','outcome','current'],['id','outcome'],`results[${index}]`);
      if(typeof raw.id!=='string'||!/^[0-9a-f-]{36}$/.test(raw.id))invalid(`results[${index}].id`);
      if(!['applied','conflict'].includes(raw.outcome))invalid(`results[${index}].outcome`);
      if(Object.hasOwn(raw,'current')&&!TIP_STATUSES.includes(raw.current))invalid(`results[${index}].current`);
      return raw;
    });
    return store.transaction(()=>{
      enroll(ctx);
      const at=iso(now);let settled=0;
      for(const result of results){const found=store.get(TIP_SHARE_KINDS.request,result.id);if(found?.claimedAt){settle(found,result.outcome,at);settled++;}}
      const current=snapshot();
      // 겹친 두 실행(5분 회차와 바로 부르는 고리)에서 늦게 읽은 쪽이 먼저 온 판을 덮지 않게, 더 오래된 판은 줄을 바꾸지 않는다(결과는 위에서 이미 받았다).
      const stale=Boolean(current&&Date.parse(current.generatedAt)>generated);
      let changed=false;
      if(!stale){
        const contentHash=hashRows(rows);changed=contentHash!==current?.contentHash;
        store.put(TIP_SHARE_KINDS.snapshot,SNAPSHOT_ID,{version:1,generatedAt:iso(generated),receivedAt:at,receivedBy:user.id,contentHash,rows:changed?rows:current.rows});
        // 장부에서 이미 새로가 아닌 줄(옮겨졌거나 사람이 바꾼 줄)의 요청은 정리한다. 판에 없는 줄의 요청은 그대로 둔다 —
        // PC가 보내는 판은 새것부터 300줄 · 900KB까지라 줄이 판 밖으로 밀렸을 수 있다. 그런 요청은 PC가 가져가 장부에 쓸 때
        // 장부 웹앱이 줄 번호와 게시물ID로 가려 옮김이나 어긋남으로 정리한다.
        for(const item of requests()){
          const row=rows.find(entry=>entry.row===item.row&&entry.postId===item.postId);
          if(row&&row.status!=='새로'){settle(item,row.status===item.to?'applied':'conflict',at);settled++;}
        }
      }
      return {stored:!stale,changed,settled,open:requests().length};
    });
  }

  return {workspace,decide,cancel,sync,snapshot:snapshotInput};
}

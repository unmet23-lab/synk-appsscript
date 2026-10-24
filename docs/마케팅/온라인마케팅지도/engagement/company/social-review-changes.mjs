// 고객 SNS 검토 링크의 「지난 판과 바뀐 곳」(2026-10-24). 두 공개 스냅샷(social-review.mjs publicSnapshot)을 견준다.
// 계정과 파일이 같은지는 밖으로 내보내지 않는 식별(채널 ID·sha256)로만 맞추고, 결과에는 공개 스냅샷에 이미 있는 값과
// 이번 판의 열쇠(v{i}·v{i}m{j})만 담는다. 계산은 링크를 만들 때 한 번 하므로 칸 수·줄 수·글자 수에 상한을 둔다.
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a,b)=>stable(a??null)===stable(b??null);
const PAIR_CELLS=250000,TOTAL_CELLS=4000000,PAIR_WORK=2000000,MAX_ROWS=200,LONG_LINE=1500,CONTEXT_LINE=300,MAX_BYTES=32768,SHORT_VALUE=120;
const TOKEN=/\s+|[.,!?;:·…"'“”‘’()[\]{}<>~/–—-]|[^\s.,!?;:·…"'“”‘’()[\]{}<>~/–—-]+/gu;
const chars=s=>Array.from(String(s));
const head=(s,n)=>{const c=chars(s);return c.length>n?c.slice(0,n).join('')+'…':String(s);};
const tail=(s,n)=>{const c=chars(s);return c.length>n?'…'+c.slice(-n).join(''):String(s);};
const middle=(s,n)=>{const c=chars(s);return c.length>n*2+20?c.slice(0,n).join('')+' … '+c.slice(-n).join(''):String(s);};
const lines=v=>{const s=String(v??'').replace(/\r\n?/g,'\n');return s?s.split('\n'):[];};
const long=v=>typeof v==='string'&&(chars(v).length>SHORT_VALUE||v.includes('\n'));

// cells: LCS 칸 예산, work: 짝 비교에서 훑는 글자 수 예산(같은 긴 줄을 뺀 줄마다 다시 쪼개면 칸은 적게 쓰고도 몇 초씩 막힌다 — GPT 7차).
export const budget=()=>({cells:TOTAL_CELLS,work:PAIR_WORK});

// 가장 긴 공통 부분열의 짝 [i,j]. 칸이 상한을 넘거나 예산이 모자라면 null(부르는 쪽이 거친 비교로 내려간다).
function lcs(a,b,eq,room){
  const n=a.length,m=b.length;if(!n||!m)return [];
  const cells=(n+1)*(m+1);if(cells>PAIR_CELLS||cells>room.cells)return null;room.cells-=cells;
  const w=m+1,t=new Uint16Array(cells);
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)t[i*w+j]=eq(a[i],b[j])?t[(i+1)*w+j+1]+1:Math.max(t[(i+1)*w+j],t[i*w+j+1]);
  const pairs=[];let i=0,j=0;
  while(i<n&&j<m){if(eq(a[i],b[j])){pairs.push([i,j]);i++;j++;}else if(t[(i+1)*w+j]>=t[i*w+j+1])i++;else j++;}
  return pairs;
}

// 짝지은 두 줄의 낱말 조각. 같은 앞·뒤 글자를 먼저 떼고(낱말 경계까지 넓히되 40자 안에서만 — 아주 긴 낱말은 글자 자리 그대로) 바뀐 가운데만 낱말로 견준다.
// 그래서 바뀐 조각은 늘 실제로 다른 글자에서 시작하고, 줄이 길어도 바뀐 곳이 잘려 사라지지 않는다(GPT 4·5차). 가운데가 너무 커서 낱말로 못 견주면 가운데 통째로 바뀐 것으로.
// 같은 글자가 30%가 안 되면 짝이 아니라 서로 다른 줄로 본다(null).
const BOUNDARY=/[\s.,!?;:·…"'“”‘’()[\]{}<>~/–—-]/u,NEAR=40;
function words(a,b,room){
  // 일 예산이 모자라면 undefined — 부르는 쪽이 가벼운 비교(rough)로 내려간다.
  const cost=a.length+b.length;if(!(room.work>=cost))return undefined;room.work-=cost;
  const x=chars(a),y=chars(b);let p=0;while(p<x.length&&p<y.length&&x[p]===y[p])p++;
  let s=0;while(s<x.length-p&&s<y.length-p&&x[x.length-1-s]===y[y.length-1-s])s++;
  for(let q=p;q>=0&&p-q<=NEAR;q--)if(q===0||BOUNDARY.test(x[q-1])){p=q;break;}
  for(let q=x.length-s;q<=x.length&&q-(x.length-s)<=NEAR;q++)if(q===x.length||BOUNDARY.test(x[q])){s=x.length-q;break;}
  const prefix=x.slice(0,p).join(''),suffix=x.slice(x.length-s).join(''),tx=x.slice(p,x.length-s).join('').match(TOKEN)||[],ty=y.slice(p,y.length-s).join('').match(TOKEN)||[];
  const pairs=lcs(tx,ty,(m,n)=>m===n,room)||[],dense=t=>chars(t.replace(/\s/g,'')).length;
  const kept=dense(prefix)+dense(suffix)+pairs.reduce((sum,[i])=>sum+dense(tx[i]),0),widest=Math.max(dense(a),dense(b));
  // 긴 줄(1,500자 넘음)은 비슷하지 않아도 앞·뒤가 조금이라도 같으면 짝으로 둔다 — 짝 없이 앞 1,500자만 남기면 같은 앞부분만 보이고 바뀐 곳이 숨는다(GPT 6차).
  if(!widest||kept/widest<.3){if(Math.max(x.length,y.length)<=LONG_LINE||!p&&!s)return null;}
  const side=(tokens,keep)=>pieces([...(prefix?[{text:prefix,changed:false}]:[]),...tokens.map((text,i)=>({text,changed:!keep.has(i)})),...(suffix?[{text:suffix,changed:false}]:[])]);
  return [side(tx,new Set(pairs.map(m=>m[0]))),side(ty,new Set(pairs.map(m=>m[1])))];
}
// 가벼운 비교: 같은 앞·뒤 글자만 떼고 가운데를 바뀐 것으로(낱말로 쪼개지 않는다). 짝 기준은 words()와 같다 — 같은 글자가 긴 쪽의 30% 이상이거나,
// 긴 줄(1,500자 넘음)이면 앞·뒤가 한 글자라도 같을 때. 아니면 짝이 아니다(짝 없이 남은 줄은 첫 글자부터 달라 앞부분에 바뀐 곳이 보인다).
function rough(x,y){
  let p=0;while(p<x.length&&p<y.length&&x[p]===y[p])p++;
  let s=0;while(s<x.length-p&&s<y.length-p&&x[x.length-1-s]===y[y.length-1-s])s++;
  const widest=Math.max(x.length,y.length);if(!p&&!s||(p+s)*10<widest*3&&widest<=LONG_LINE)return null;
  const side=z=>pieces([...(p?[{text:z.slice(0,p).join(''),changed:false}]:[]),...(z.length-s>p?[{text:z.slice(p,z.length-s).join(''),changed:true}]:[]),...(s?[{text:z.slice(z.length-s).join(''),changed:false}]:[])]);
  return [side(x),side(y)];
}
function pieces(list){
  const out=[];
  for(const {text,changed} of list){const last=out.at(-1);if(last&&last.changed===changed)last.text+=text;else out.push({text,changed});}
  // 바뀐 두 조각 사이에 남은 띄어쓰기는 한 덩어리로 읽힌다.
  for(let i=1;i<out.length-1;i++)if(!out[i].changed&&!/\S/.test(out[i].text)&&out[i-1].changed&&out[i+1].changed){out[i-1].text+=out[i].text+out[i+1].text;out.splice(i,2);i--;}
  // 한 문단이 한 줄인 긴 캡션은 바뀐 조각 앞뒤만 남긴다.
  return out.map((p,i)=>p.changed?{text:head(p.text,LONG_LINE),changed:true}:{text:i===0&&out.length>1?tail(p.text,80):i===out.length-1&&out.length>1?head(p.text,80):out.length>1?middle(p.text,60):head(p.text,LONG_LINE),changed:false});
}

// 줄 단위 차이. 같은 앞·뒤 줄을 떼고 가운데만 견주며, 비슷한 뺀 줄·더한 줄은 「전/후」 짝으로 번갈아 놓는다.
export function textChange(before,after,room=budget()){
  const a=lines(before),b=lines(after);if(same(a,b))return null;
  let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;
  let end=0;while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
  const midA=a.slice(start,a.length-end),midB=b.slice(start,b.length-end),pairs=lcs(midA,midB,(x,y)=>x===y,room)||[];
  const ops=a.slice(0,start).map(text=>({type:'same',text})),stats={changed:0,removed:0,added:0};
  let i=0,j=0;
  const mark={rough:false};
  for(const [pi,pj] of [...pairs,[midA.length,midB.length]]){hunk(ops,midA.slice(i,pi),midB.slice(j,pj),stats,room,mark);if(pi<midA.length)ops.push({type:'same',text:midA[pi]});i=pi+1;j=pj+1;}
  ops.push(...a.slice(a.length-end).map(text=>({type:'same',text})));
  // 가벼운 비교로 짝지은 줄이 있으면 「일부만 보여요」로 알린다(바뀐 곳은 보이지만 낱말 단위가 아니다).
  const out=fold(ops,a.length+b.length<=16,stats);return mark.rough?{...out,truncated:true}:out;
}
function hunk(ops,removed,added,stats,room,mark){
  let lone={removed:[],added:[]};
  const flush=()=>{for(const text of lone.removed)ops.push({type:'removed',text:head(text,LONG_LINE)});for(const text of lone.added)ops.push({type:'added',text:head(text,LONG_LINE)});stats.removed+=lone.removed.length;stats.added+=lone.added.length;lone={removed:[],added:[]};};
  // 뺀 줄마다 아직 짝 없는 더한 줄을 차례로 (20줄 안에서) 찾아 처음 짝이 되는 줄과 잇는다 — 자리끼리만 짝지으면 앞에 새 줄이 끼었을 때
  // 고친 줄이 짝을 못 찾고 짝 없는 긴 줄은 앞부분만 남아 바뀐 곳이 숨는다. 사이에 건너뛴 더한 줄은 그 짝 앞에 새 줄로 둔다.
  // 글자 수 예산이 바닥나면(room.rough) 그 뒤로는 자리끼리 한 번씩만, 글자 앞·뒤만 견준다 — 줄 길이에 비례해 끝나고 바뀐 가운데는 계속 보인다(GPT 8차).
  let j=0;const split=new Map(),arr=t=>{if(!split.has(t))split.set(t,chars(added[t]));return split.get(t);};
  for(const line of removed){
    let found=-1,pair=null;
    if(!room.rough)for(let t=j;t<added.length&&t<j+20;t++){pair=words(line,added[t],room);if(pair===undefined){room.rough=true;pair=null;break;}if(pair){found=t;break;}}
    if(room.rough&&found<0){const x=chars(line);for(let t=j;t<added.length&&t<j+20;t++){pair=rough(x,arr(t));if(pair){found=t;mark.rough=true;break;}}}
    if(found<0){lone.removed.push(line);continue;}
    lone.added.push(...added.slice(j,found));j=found+1;
    flush();ops.push({type:'removed',parts:pair[0]},{type:'added',parts:pair[1]});stats.changed++;
  }
  lone.added.push(...added.slice(j));flush();
}
// 바뀐 덩어리 앞뒤 한 줄만 두고 같은 줄은 접는다(짧은 글은 다 보인다).
function fold(ops,all,stats){
  const rows=[],plain=op=>({type:'same',text:head(op.text,CONTEXT_LINE)});
  for(let i=0;i<ops.length;){
    if(ops[i].type!=='same'){rows.push(ops[i]);i++;continue;}
    let e=i;while(e+1<ops.length&&ops[e+1].type==='same')e++;
    const run=ops.slice(i,e+1),keepHead=i>0?1:0,keepTail=e<ops.length-1?1:0;
    if(all||run.length<=keepHead+keepTail+1)rows.push(...run.map(plain));
    else rows.push(...run.slice(0,keepHead).map(plain),{type:'skip',count:run.length-keepHead-keepTail},...run.slice(run.length-keepTail).map(plain));
    i=e+1;
  }
  return rows.length>MAX_ROWS?{rows:rows.slice(0,MAX_ROWS),stats,truncated:true}:{rows,stats};
}

const meta=m=>({type:m.type,width:m.width??null,height:m.height??null,duration:m.duration??null});
// 파일은 sha256이 같으면 같은 파일이다. 순서를 맞춘 뒤 같은 파일이 자리만 옮기면 moved, 같은 틈의 뺀·더한 파일은 replaced.
export function mediaChange(before,after){
  if(same(before.map(m=>m.id),after.map(m=>m.id)))return null;
  const pairs=lcs(before,after,(x,y)=>x.id===y.id,{cells:Infinity})||[],gaps=[];let i=0,j=0;
  for(const [pi,pj] of [...pairs,[before.length,after.length]]){gaps.push({removed:Array.from({length:pi-i},(_,k)=>i+k),added:Array.from({length:pj-j},(_,k)=>j+k)});i=pi+1;j=pj+1;}
  const items=[],moved=new Set(),taken=new Set(),open=gaps.flatMap(g=>g.added);
  for(const r of gaps.flatMap(g=>g.removed)){const a=open.find(k=>!taken.has(k)&&after[k].id===before[r].id);if(a==null)continue;taken.add(a);moved.add(r);items.push({change:'moved',from:r+1,index:a+1,key:after[a].key,...meta(after[a])});}
  for(const gap of gaps){
    const removed=gap.removed.filter(r=>!moved.has(r)),added=gap.added.filter(a=>!taken.has(a)),n=Math.min(removed.length,added.length);
    for(let k=0;k<n;k++)items.push({change:'replaced',index:added[k]+1,key:after[added[k]].key,...meta(after[added[k]]),before:meta(before[removed[k]])});
    for(const r of removed.slice(n))items.push({change:'removed',index:r+1,...meta(before[r])});
    for(const a of added.slice(n))items.push({change:'added',index:a+1,key:after[a].key,...meta(after[a])});
  }
  const rank=item=>item.change==='removed'?0:1;
  return items.sort((x,y)=>x.index-y.index||rank(x)-rank(y));
}

function valueOrText(field,before,after,room,scope={}){
  if(same(before,after))return null;
  if((before==null||typeof before==='string')&&(after==null||typeof after==='string')&&(long(before)||long(after))){const text=textChange(before||'',after||'',room);return text&&{kind:'text',field,...scope,...text};}
  return {kind:'value',field,...scope,before:before??null,after:after??null};
}
function textField(field,before,after,room,scope={}){const text=textChange(before,after,room);return text&&{kind:'text',field,...scope,...text};}
function optionChanges(before={},after={},room){
  const items=[];
  for(const key of [...new Set([...Object.keys(after),...Object.keys(before)])]){
    const change=valueOrText(key,before[key],after[key],room);if(!change)continue;
    const {kind,field,...rest}=change;items.push({key:field,...rest});
  }
  return items;
}
// 반복 게시 문구는 문구 ID(비공개)로 짝짓고, 밖으로는 화면 번호(이번 판 자리, 뺀 것은 지난 판 자리)만 낸다.
function copyChanges(before=[],after=[],beforeIds=[],afterIds=[],room){
  const items=[],old=new Map(before.map((copy,i)=>[beforeIds[i]||'#'+i,{copy,i}])),part=change=>{const {kind,field,...rest}=change;return rest;};
  after.forEach((a,i)=>{
    const id=afterIds[i]||'#'+i,was=old.get(id),index=i+1;
    if(!was){items.push({index,change:'added'});return;}
    old.delete(id);const b=was.copy;
    const title=valueOrText('title',b.title,a.title,room),text=textChange(b.text,a.text,room),hashtags=valueOrText('hashtags',b.hashtags,a.hashtags,room);
    if(title||text||hashtags)items.push({index,change:'changed',...(title?{title:part(title)}:{}),...(text?{text}:{}),...(hashtags?{hashtags:part(hashtags)}:{})});
    else if(was.i!==i)items.push({index,from:was.i+1,change:'moved'});
  });
  for(const {i} of old.values())items.push({index:i+1,change:'removed'});
  const rank=item=>item.change==='removed'?0:1;
  return items.sort((x,y)=>x.index-y.index||rank(x)-rank(y));
}
function scheduleChange(before=[],after=[]){
  const key=s=>stable([s.account,s.scheduledAt,s.timezone,!!s.cancelled]),slot=s=>({account:s.account,scheduledAt:s.scheduledAt,timezone:s.timezone,cancelled:!!s.cancelled}),left=new Map();
  for(const s of before)left.set(key(s),(left.get(key(s))||0)+1);
  const added=[];for(const s of after){const k=key(s),n=left.get(k)||0;if(n)left.set(k,n-1);else added.push(slot(s));}
  const removed=[];for(const s of before){const k=key(s),n=left.get(k)||0;if(n){left.set(k,n-1);removed.push(slot(s));}}
  return removed.length||added.length?{removed,added}:null;
}

const rowCount=node=>Array.isArray(node)?node.reduce((n,x)=>n+rowCount(x),0):node&&typeof node==='object'?(Array.isArray(node.rows)?node.rows.length:0)+Object.entries(node).reduce((n,[k,v])=>k==='rows'?n:n+rowCount(v),0):0;
function strip(node){if(Array.isArray(node))node.forEach(strip);else if(node&&typeof node==='object'){if(Array.isArray(node.rows)&&node.rows.length){node.rows=[];node.truncated=true;}for(const [k,v] of Object.entries(node))if(k!=='rows')strip(v);}}

// before·after는 publicSnapshot 꼴, ids는 판마다 [{channelId, media:[sha256…], copies:[문구 ID…]}](계정 순서) — 결과로는 나가지 않는다.
// 바뀐 곳이 0개면 보이는 내용이 같은 것이다(부르는 쪽의 state 'same').
export function compareReviews(before,after,ids,room=budget()){
  const changes=[],push=change=>{if(change)changes.push(change);};
  push(valueOrText('title',before.title,after.title,room));
  push(textField('body',before.body,after.body,room));
  const old=new Map(before.variants.map((v,i)=>[ids.before[i].channelId,{v,i}]));
  after.variants.forEach((v,i)=>{
    const channelId=ids.after[i].channelId,was=old.get(channelId),scope={variant:v.key,account:v.account};
    if(!was){changes.push({kind:'presence',field:'variant',change:'added',...scope});return;}
    old.delete(channelId);const b=was.v;
    if(!same(b.account,v.account))changes.push({kind:'value',field:'account',...scope,before:b.account,after:v.account});
    if(!same(b.format,v.format))changes.push({kind:'value',field:'format',...scope,before:b.format??null,after:v.format??null});
    push(valueOrText('variantTitle',b.title,v.title,room,scope));
    push(textField('text',b.text,v.text,room,scope));
    const media=mediaChange(b.media.map((m,k)=>({...m,id:ids.before[was.i].media[k]})),v.media.map((m,k)=>({...m,id:ids.after[i].media[k]})));
    if(media)changes.push({kind:'media',field:'media',...scope,items:media});
    const options=optionChanges(b.options,v.options,room);if(options.length)changes.push({kind:'options',field:'options',...scope,items:options});
    const copies=copyChanges(b.copyVariants,v.copyVariants,ids.before[was.i].copies,ids.after[i].copies,room);if(copies.length)changes.push({kind:'copies',field:'copyVariants',...scope,items:copies});
  });
  for(const {v} of old.values())changes.push({kind:'presence',field:'variant',change:'removed',account:v.account});
  const slots=scheduleChange(before.schedule,after.schedule);if(slots)changes.push({kind:'schedule',field:'schedule',...slots});
  if(!same(before.recurrence,after.recurrence))changes.push({kind:'value',field:'recurrence',before:before.recurrence??null,after:after.recurrence??null});
  if(!same(before.expiresAt,after.expiresAt))changes.push({kind:'value',field:'expiresAt',before:before.expiresAt??null,after:after.expiresAt??null});
  // 큰 글 칸부터 줄을 빼고 요약 수만 남긴다 — 공개 응답은 압축 없이 열 때·답할 때마다 나가므로 바이트로 잰다.
  // 항목 크기는 한 번만 재고 줄을 뺀 항목만 다시 잰다(항목이 많고 클 때 매번 전부 직렬화하지 않게). 배열 쉼표·괄호까지 더해 합은 정확하다.
  let truncated=false;const size=c=>Buffer.byteLength(JSON.stringify(c)),sizes=changes.map(size),rowsLeft=changes.map(c=>rowCount(c)>0);
  let total=sizes.reduce((n,x)=>n+x,0)+Math.max(changes.length-1,0)+2;
  while(total>MAX_BYTES){let k=-1;for(let i=0;i<changes.length;i++)if(rowsLeft[i]&&(k<0||sizes[i]>sizes[k]))k=i;if(k<0)break;strip(changes[k]);rowsLeft[k]=false;const now=size(changes[k]);total-=sizes[k]-now;sizes[k]=now;truncated=true;}
  // 줄을 다 빼도 넘치면(계정이 아주 많고 짧은 값만 바뀐 경우 — GPT GA1) 뒤 계정의 바뀐 곳부터 빼고 그 수만 남긴다. 게시물 전체 항목은 끝까지 남긴다.
  let dropped=0;
  while(changes.length&&total>MAX_BYTES){const at=changes.findLastIndex(c=>c.variant||c.kind==='presence'),k=at>=0?at:changes.length-1;total-=sizes[k]+(changes.length>1?1:0);changes.splice(k,1);sizes.splice(k,1);dropped++;truncated=true;}
  const cut=node=>Array.isArray(node)?node.some(cut):!!node&&typeof node==='object'&&(node.truncated===true||Object.values(node).some(cut));
  return {changes,truncated:truncated||cut(changes),dropped};
}

// 작업실 파일의 늦춘 지우기(2026-11-27, PULSE 채널 명단 그림 둘째 판의 후속). 설계는 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ③」의 「다른 지우기 길」이다.
// 본보기는 채널 명단 그림(pulse-people.mjs sweep)이다. 문서에서 파일 이름을 떼는 바로 그 트랜잭션에서 지울 이름을 여기(studioMediaTrash, 이름 하나에 문서 하나)에 적는다.
// 이 문서는 백업 목록(workspace-media.mjs workspaceMediaNames)이 세지 않으므로, 그 커밋 뒤에 잡힌 백업은 이 파일을 찾지 않는다.
// 파일은 이 서버 프로세스의 단조 시계로 하루가 쌓인 뒤 지운다. 이름을 떼기 전에 잡힌 백업은 시작한 지 6시간 안에 끝나야 하므로(workspace-media.mjs MEDIA_READ_WINDOW_MS),
// 그 백업이 아직 읽을 파일을 지우지 않는다. 서버가 꺼져 있거나 잠든 시간은 세지 않아 지우기가 늦어질 뿐이다.
// 나이는 적힌 뒤 처음 도는 정리부터 센다. 적힌 때부터 그 정리까지의 시간은 버린다(앞 정리 뒤 흐른 시간을 방금 적힌 이름에 더하지 않게 — 늦게 지울 뿐이다).
// 같은 이름을 다시 적으면(같은 파일을 가리키던 다른 문서가 나중에 떨어짐) 주인을 합치고 나이를 처음부터 센다(GPT pulse-media-trash GB2 · GB4).
// 지우는 중인 파일은 되살리지 않는다(되살리면 파일 지우기와 다시 겹친다 — Fable 설계 검토 ④). 지울 때 다른 문서가 같은 이름을 가리키면 파일과 이 문서를 두고 나이를 처음부터 센다(주인 기록을 지키려고 — GPT pulse-media-trash-20261127-a2 GA2).
// 주인(owners — 'project:<id>' · 'persona:<id>'): 「지웠다」고 알리는 길(인물 지우기 pulse-workspaces.mjs beginDeletion · 의뢰 기록 90일 정리 client-projects.mjs retireRequestWithin)은
// 같은 트랜잭션에서 자기 몫을 takeTrash로 가져가 바로 지운다(GPT pulse-media-trash GB1 · -b GA2 · GA3, Fable 설계 검토 2026-11-27 ②).
// 두 판으로 연다(Fable 설계 검토 2026-11-27 ①, GPT pulse-media-trash-20261127 GA1): 이 판은 지울 목록을 읽고(정리 · 종료 때 쌓기 · 주인 몫 가져가기) 쓰지는 않는다(MEDIA_TRASH_WRITES).
// 지우는 길은 서버가 넣어 주는 defer를 부른다 — 꺼져 있으면 이름을 그대로 돌려줘 바탕처럼 커밋 뒤 바로 지운다. 다음 판에서 켜면, 그 판을 되돌려도 이 판이 지울 목록을 읽고 지운다.
// 같은 데이터 폴더를 쓰는 서버 프로세스는 하나라고 본다(pulse-people.mjs와 같은 한계 — Fable 설계 검토 P2-1).
import {unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {workspaceMediaNames} from './workspace-media.mjs';

export const MEDIA_TRASH_KIND='studioMediaTrash';
// 쓰기 스위치. 이 판은 끈다. 이 판이 운영에 나간 뒤 다음 판에서 켠다(서버 시험은 options.mediaTrashWrites로 켠다).
export const MEDIA_TRASH_WRITES=false;
// 작업실 파일 이름 규칙. studio-media-cloud.mjs MEDIA_NAME과 같다(버킷 연결을 든 그 모듈을 가져오지 않으려고 베껴 둔다 — 같은지는 시험이 본다).
export const TRASH_NAME=/^[a-f0-9-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$/;
const MEDIA_NAME=TRASH_NAME;
const OWNER=/^(project|persona):[A-Za-z0-9_-]{1,80}$/;
// ageMs: 이름을 뗀 뒤 파일을 지우기까지 서버가 떠 있던 실제 시간 — 백업 읽기 한도(6시간)와 뒤 단계(곁 객체 올리기, 백업 유닛 시한 45분 · 재난 백업 덧붙임이 있으면 90분)보다 길게.
export const MEDIA_TRASH_LIMITS=Object.freeze({ageMs:24*3600000});
const ownersOf=item=>Array.isArray(item?.owners)?item.owners.filter(owner=>typeof owner==='string'&&OWNER.test(owner)):[];
const listed=item=>!!item&&typeof item.diskName==='string'&&item.id===item.diskName&&MEDIA_NAME.test(item.diskName);
const due=item=>listed(item)&&item.counting===true&&Number.isFinite(item.agedMs)&&item.agedMs>=MEDIA_TRASH_LIMITS.ageMs;

// 지울 이름을 적는다. 이름을 떼는 쪽의 트랜잭션 안에서 부른다(그 트랜잭션이 되돌려지면 이 기록도 함께 빠진다).
// owner는 그 파일을 가졌던 프로젝트나 인물이다. from은 어느 길에서 뗐는지 적는 기록용 글자다(판단에 쓰지 않는다).
// 작업실 파일 이름 규칙이 아니면 그 폴더의 파일이 아니라 적지 않는다.
export function trashMedia(store,names,{from,at,owner}){
  if(typeof owner!=='string'||!OWNER.test(owner))throw new Error('지울 파일의 주인(프로젝트 · 인물)을 확인해 주세요.');
  for(const name of new Set(names||[])){
    if(typeof name!=='string'||!MEDIA_NAME.test(name))continue;
    const before=store.get(MEDIA_TRASH_KIND,name);
    store.put(MEDIA_TRASH_KIND,name,{id:name,diskName:name,from:String(from||''),at,owners:[...new Set([...ownersOf(before),owner])],agedMs:0,counting:false});
  }
}
// 「지웠다」고 알리는 길의 트랜잭션 안에서 부른다: 그 주인이 든 이름을 돌려주고 그 주인을 지울 목록에서 뺀다. 부른 쪽이 그 이름을 자기 지울 목록에 넣어 바로 지운다.
// 다른 주인이 남은 이름은 문서를 두고 그 주인만 뺀다 — 다른 문서가 아직 가리켜 부른 쪽이 파일을 두면, 남은 주인의 몫이 그대로 남는다(GPT pulse-media-trash-20261127-a GA2).
// 부른 쪽이 파일을 지우면 남은 문서는 다음 정리가 「이미 없음」으로 뗀다. 주인이 하나뿐이던 이름은 문서를 떼므로, 정리가 그 파일을 지우는 중이었으면 정리는 문서가 사라진 것을 보고 그 파일에 손대지 않는다(아래 sweep).
export function takeTrash(store,owner){
  const names=[];
  for(const item of store.all(MEDIA_TRASH_KIND)){
    const owners=ownersOf(item);if(!listed(item)||!owners.includes(owner))continue;
    names.push(item.diskName);const left=owners.filter(value=>value!==owner);
    if(left.length)store.put(MEDIA_TRASH_KIND,item.id,{...item,owners:left});else store.remove(MEDIA_TRASH_KIND,item.id);
  }
  return names;
}

// steady: 나이를 재는 단조 시계(밀리초). 시험이 가짜를 준다. owned: 지금 문서가 가리키는 이름(지우기 직전에 한 번 읽는다).
// writes: 지우는 길이 지울 목록에 쓰는지(MEDIA_TRASH_WRITES). defer가 이것을 본다.
export function createMediaTrash({store,directory=store?.directory,steady=()=>performance.now(),owned=()=>new Set(workspaceMediaNames(store.db)),writes=MEDIA_TRASH_WRITES}){
  if(!store||typeof directory!=='string')throw new TypeError('작업실 파일 지우기 설정이 이상해요.');
  const root=resolve(directory,'studio-media');
  let accountedAt=steady(),pending=null;
  // 나이를 쌓은 시각(accountedAt)은 거래가 커밋된 뒤에만 옮긴다(pulse-people.mjs tx와 같다 — 되돌려진 나이를 센 것으로 치지 않게).
  const tx=fn=>{pending=null;let done=false;try{const result=store.transaction(fn);done=true;return result;}finally{if(done&&pending!==null&&pending>accountedAt)accountedAt=pending;pending=null;}};
  const docs=()=>store.all(MEDIA_TRASH_KIND).filter(listed);
  // 앞 정리 뒤로 흐른 단조 시간을 세는 중인 문서에 더하고, 하루가 찬 이름을 돌려준다. 처음 만난 문서는 세기 시작만 표시한다(나이 0).
  function age(){
    const tick=steady(),step=tick>accountedAt?tick-accountedAt:0,ready=[];if(step>0)pending=tick;
    for(const item of docs()){
      if(item.counting!==true){store.put(MEDIA_TRASH_KIND,item.id,{...item,agedMs:0,counting:true});continue;}
      const aged=(Number.isFinite(item.agedMs)&&item.agedMs>0?item.agedMs:0)+step;
      if(step>0)store.put(MEDIA_TRASH_KIND,item.id,{...item,agedMs:aged});
      if(aged>=MEDIA_TRASH_LIMITS.ageMs)ready.push(item.diskName);
    }
    return ready;
  }
  // 정리: 나이를 쌓고, 하루가 찬 파일을 지운 뒤 그 문서를 뗀다. 지우지 못한 파일(없는 파일 말고)은 문서가 남아 다음 정리가 다시 지운다.
  // 문서가 가리키는 이름을 읽지 못하면(꼴이 틀린 문서) 아무것도 지우지 않는다.
  // 지우기 직전과 문서를 떼기 직전에 그 문서를 다시 읽는다. 그사이 다시 적혔거나(나이 0) 주인이 가져갔으면(문서 없음) 건너뛴다(GPT GB3 · Fable 설계 검토 ④).
  // 결과: 실제로 지운 파일 수(removed) · 이미 없던 수(missing) · 다른 문서가 다시 가리켜 둔 수(kept) · 지우지 못한 수(failed) · 건너뛴 수(skipped).
  async function sweep(){
    const ready=tx(age),result={removed:0,missing:0,kept:0,failed:0,skipped:0};if(!ready.length)return result;
    let used;try{used=owned();}catch{result.failed=ready.length;return result;}
    const done=[],kept=[];
    for(const name of ready){
      if(!due(store.get(MEDIA_TRASH_KIND,name))){result.skipped++;continue;}
      if(used.has(name)){kept.push(name);result.kept++;continue;}
      const path=resolve(root,name);if(dirname(path)!==root){result.failed++;continue;}
      try{await unlink(path);done.push(name);result.removed++;}
      catch(error){if(error?.code==='ENOENT'){done.push(name);result.missing++;}else result.failed++;}
    }
    // 다른 문서가 아직 가리키는 이름은 문서를 두고 나이를 처음부터 센다. 문서를 떼면 그 파일을 가졌던 주인의 기록이 사라져, 마지막 참조가 떨어진 뒤 그 주인이 「지웠다」고 알릴 때 파일을 받아 가지 못한다(GPT pulse-media-trash-20261127-a2 GA2).
    if(done.length||kept.length)tx(()=>{for(const name of done)if(due(store.get(MEDIA_TRASH_KIND,name)))store.remove(MEDIA_TRASH_KIND,name);
      for(const name of kept){const item=store.get(MEDIA_TRASH_KIND,name);if(due(item))store.put(MEDIA_TRASH_KIND,name,{...item,agedMs:0,counting:false});}});
    return result;
  }
  // 정상 종료 직전: 마지막 정리 뒤 흐른 가동 시간을 남긴다(지우지는 않는다 — 다음 프로세스의 정리가 지운다).
  function account(){tx(age);}
  // 지우는 길이 부른다(그 길의 트랜잭션 안에서). 쓰기가 켜졌으면 지울 목록에 적고 빈 목록을, 꺼졌으면 이름을 그대로 돌려준다(부른 쪽이 커밋 뒤 바로 지운다 — 바탕 길).
  function defer(names,{from,at,owner}){
    const list=[...(names||[])];if(!writes)return list;
    trashMedia(store,list,{from,at,owner});return list.filter(name=>typeof name==='string'&&!MEDIA_NAME.test(name));
  }
  return {sweep,account,defer,writes:writes===true,pending:()=>docs().length};
}

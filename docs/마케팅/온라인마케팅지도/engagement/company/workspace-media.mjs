// Enumerate every persisted owner of studio-media files from the same DB snapshot.
// Customer project files share storage, but never share studio access grants.
// 고객 전용 인물(2026-11-09 판 1, 기획 12-2 「파일과 백업」): 인물 파일도 studio-media에 같은 이름 규칙으로 두고 인물 문서가 갖는다.
// 프로젝트에는 참조만 두므로 90일 정리 · 보관이 지우지 않는다. 지운 인물 자료는 묘비(deletedAt)로 남고 파일 이름이 없다.
//   pulsePersonaSources   — 고객이 보낸 사진 하나에 문서 하나(diskName)
//   pulsePersonaRevisions — 제작팀이 만든 판 하나에 문서 하나(assets[].diskName)
// 이 목록은 인물 문서를 처음 쓰는 판보다 먼저 운영에 오른다(한 판 되돌려도 백업 · 복원 대조가 인물 파일을 센다).
import {peopleMediaName} from './pulse-people-media.mjs';
// 백업의 읽기 한도(PULSE 채널 명단 그림 조각 ③ 둘째 판, 2026-11-23). DB 스냅샷을 잡은 뒤 그 목록의 파일을 운영 폴더에서 읽는 백업
// (workspace-backup.mjs · backup.mjs)은 시작한 지 이 시간 안에 끝나야 한다. 넘으면 마칠 표시를 쓰지 않고 실패한다(직접 실행에도 시한이 생긴다).
// 문서에서 뗀 파일을 늦게 지우는 길(명단 그림은 지우는 중 표시 뒤 하루 — pulse-people-media.mjs)은 이 시간과 뒤 단계(곁 객체 올리기 — 백업 유닛 시한 45분, 재난 백업 덧붙임이 있으면 90분)보다 길어야 한다.
// 그러면 표시 전에 잡힌 스냅샷도 그 파일을 다 읽은 뒤에야 파일이 지워진다.
// 걸린 시간은 벽시계(지우는 쪽과 같은 시계 — 잠든 동안도 센다)와 단조 시계(시계를 뒤로 돌려도 센다) 가운데 큰 쪽이다(둘째 판 GPT GA1).
export const MEDIA_READ_WINDOW_MS=6*3600000;
export function mediaReadWindow(now=Date.now,steady=()=>performance.now()){
  const started=now(),steadyStart=steady();
  return ()=>{if(!(Math.max(now()-started,steady()-steadyStart)<MEDIA_READ_WINDOW_MS))throw Object.assign(new Error('백업이 시작한 지 6시간이 지나 멈췄습니다. 새로 다시 실행해 주세요.'),{code:'MEDIA_READ_WINDOW'});};
}
export const PERSONA_MEDIA_KINDS=Object.freeze(['pulsePersonaSources','pulsePersonaRevisions']);
export function personaMediaOf(kind,doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc))throw new Error('전용 인물 파일 기록을 확인해 주세요.');
  if(kind==='pulsePersonaSources'){
    if(doc.diskName==null&&doc.deletedAt)return [];
    if(typeof doc.diskName!=='string'||!doc.diskName)throw new Error('전용 인물 사진 기록을 확인해 주세요.');
    return [doc.diskName];
  }
  if(kind==='pulsePersonaRevisions'){
    if(!Array.isArray(doc.assets))throw new Error('전용 인물 판의 파일 기록을 확인해 주세요.');
    return doc.assets.map(asset=>{if(typeof asset?.diskName!=='string'||!asset.diskName)throw new Error('전용 인물 판의 파일 기록을 확인해 주세요.');return asset.diskName;});
  }
  throw new Error('전용 인물 파일 기록을 확인해 주세요.');
}
// 금고 제외(2026-11-11 결정 표 ①, 판 4 설계 11-2): 인물 문서가 가진 이름. 백업은 이 이름들의 본문(sha256)을 「금고에 넣지 않음」으로 적는다.
// 지운(지우는 중인) 인물은 이름을 떼는 트랜잭션에서 본문 sha256을 묘비 기록 deletion.noVault에 남긴다 — 백업은 그 해시와 같은 본문도 늘 뺀다
// (인물을 지운 뒤 같은 바이트로 남은 다른 파일이 금고로 가지 않게, 판 4 설계 11-2 · 11-11 GPT GA1).
// 인물은 두고 판 파일 하나만 뺄 때도(remove_asset) 그 본문 sha256을 인물 문서 removedNoVault에 남긴다 — 같은 까닭으로 함께 뺀다.
export function personaMediaNameSet(database){
  const names=new Set();
  for(const kind of PERSONA_MEDIA_KINDS)for(const row of database.prepare('SELECT body FROM documents WHERE kind=?').all(kind))for(const name of personaMediaOf(kind,JSON.parse(row.body)))names.add(name);
  return names;
}
// legacy: 해시 기록 없이 지운(지우는 중인) 인물 수 — 이 판 전에 지운 인물이다. 하나라도 있으면 그 바이트를 가릴 수 없어 서버 직접 백업이 분류를 미완으로 내보낸다.
export function personaRetainedSha(database){
  const sha=new Set();let legacy=0;
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='pulsePersonas'").all()){
    const doc=JSON.parse(row.body),kept=doc?.deletion?.noVault,removed=doc?.removedNoVault;
    if((doc?.deletedAt||doc?.status==='deleting')&&!Array.isArray(kept))legacy++;
    for(const hash of [...(Array.isArray(kept)?kept:[]),...(Array.isArray(removed)?removed:[])])if(typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash))sha.add(hash);
  }
  return {sha,legacy};
}
export function workspaceMediaNames(database){
  const names=database.prepare("SELECT body FROM documents WHERE kind IN ('studioMedia','socialMedia')").all().map(row=>JSON.parse(row.body).diskName);
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='studioPublicationPackages'").all()){
    const bundle=JSON.parse(row.body);
    if(!Array.isArray(bundle.outputs))throw new Error('게시 묶음의 출력 파일 기록을 확인해 주세요.');
    for(const output of bundle.outputs)if(output.diskName)names.push(output.diskName);
  }
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='clientProjects'").all()){
    const project=JSON.parse(row.body);
    if(!Array.isArray(project.versions))throw new Error('고객 프로젝트의 파일 버전 기록을 확인해 주세요.');
    for(const version of project.versions)if(version.media)names.push(version.media.diskName);
    if(project.studio?.assets){if(!Array.isArray(project.studio.assets))throw new Error('PULSE 기획 자료 기록을 확인해 주세요.');for(const asset of project.studio.assets)names.push(asset.diskName);}
    // 올려 두고 아직 글에 안 붙은 문의 사진(운영 조각 8-B — 자산이 아니라 따로 둔다).
    if(project.studio?.messageUploads){if(!Array.isArray(project.studio.messageUploads))throw new Error('PULSE 문의 사진 기록을 확인해 주세요.');for(const upload of project.studio.messageUploads)names.push(upload.diskName);}
    if(project.intake?.files){if(!Array.isArray(project.intake.files))throw new Error('고객 접수 자료 기록을 확인해 주세요.');for(const file of project.intake.files)names.push(file.diskName);}
  }
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='clientDeliveryDrafts'").all()){
    const draft=JSON.parse(row.body);
    if(!Array.isArray(draft.items))throw new Error('납품 준비 파일 기록을 확인해 주세요.');
    for(const item of draft.items)if(item.media)names.push(item.media.diskName);
  }
  for(const kind of PERSONA_MEDIA_KINDS)for(const row of database.prepare('SELECT body FROM documents WHERE kind=?').all(kind))names.push(...personaMediaOf(kind,JSON.parse(row.body)));
  // PULSE 채널 명단 그림(조각 ③ · pulse-people-media.mjs): 그림 하나에 문서 하나. 명단이 가리키지 않아도 문서가 있는 동안은 센다(올린 뒤 저장 전 한 시간 유예).
  // 지우는 중(gone)인 그림은 세지 않는다. 그 파일은 표시 뒤 하루가 지나야 지워지므로, 표시 전에 잡힌 백업은 읽기 한도 안에 다 읽는다.
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='pulsePeopleMedia'").all()){const name=peopleMediaName(JSON.parse(row.body));if(name)names.push(name);}
  return [...new Set(names)];
}

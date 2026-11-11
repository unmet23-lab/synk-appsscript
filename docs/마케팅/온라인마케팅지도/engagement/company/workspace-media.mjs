// Enumerate every persisted owner of studio-media files from the same DB snapshot.
// Customer project files share storage, but never share studio access grants.
// 고객 전용 인물(2026-11-09 판 1, 기획 12-2 「파일과 백업」): 인물 파일도 studio-media에 같은 이름 규칙으로 두고 인물 문서가 갖는다.
// 프로젝트에는 참조만 두므로 90일 정리 · 보관이 지우지 않는다. 지운 인물 자료는 묘비(deletedAt)로 남고 파일 이름이 없다.
//   pulsePersonaSources   — 고객이 보낸 사진 하나에 문서 하나(diskName)
//   pulsePersonaRevisions — 제작팀이 만든 판 하나에 문서 하나(assets[].diskName)
// 이 목록은 인물 문서를 처음 쓰는 판보다 먼저 운영에 오른다(한 판 되돌려도 백업 · 복원 대조가 인물 파일을 센다).
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
export function personaMediaNameSet(database){
  const names=new Set();
  for(const kind of PERSONA_MEDIA_KINDS)for(const row of database.prepare('SELECT body FROM documents WHERE kind=?').all(kind))for(const name of personaMediaOf(kind,JSON.parse(row.body)))names.add(name);
  return names;
}
// legacy: 해시 기록 없이 지운(지우는 중인) 인물 수 — 이 판 전에 지운 인물이다. 하나라도 있으면 그 바이트를 가릴 수 없어 서버 직접 백업이 분류를 미완으로 내보낸다.
export function personaRetainedSha(database){
  const sha=new Set();let legacy=0;
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='pulsePersonas'").all()){
    const doc=JSON.parse(row.body),kept=doc?.deletion?.noVault;
    if((doc?.deletedAt||doc?.status==='deleting')&&!Array.isArray(kept))legacy++;
    for(const hash of Array.isArray(kept)?kept:[])if(typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash))sha.add(hash);
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
    if(project.intake?.files){if(!Array.isArray(project.intake.files))throw new Error('고객 접수 자료 기록을 확인해 주세요.');for(const file of project.intake.files)names.push(file.diskName);}
  }
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='clientDeliveryDrafts'").all()){
    const draft=JSON.parse(row.body);
    if(!Array.isArray(draft.items))throw new Error('납품 준비 파일 기록을 확인해 주세요.');
    for(const item of draft.items)if(item.media)names.push(item.media.diskName);
  }
  for(const kind of PERSONA_MEDIA_KINDS)for(const row of database.prepare('SELECT body FROM documents WHERE kind=?').all(kind))names.push(...personaMediaOf(kind,JSON.parse(row.body)));
  return [...new Set(names)];
}

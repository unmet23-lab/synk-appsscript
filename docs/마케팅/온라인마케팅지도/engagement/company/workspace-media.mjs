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

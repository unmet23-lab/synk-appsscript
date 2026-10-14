// Enumerate every persisted owner of studio-media files from the same DB snapshot.
// Customer project files share storage, but never share studio access grants.
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
  return [...new Set(names)];
}

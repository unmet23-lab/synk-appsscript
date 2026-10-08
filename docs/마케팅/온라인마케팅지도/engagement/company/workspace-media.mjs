// Enumerate every persisted owner of studio-media files from the same DB snapshot.
// Customer project files share storage, but never share studio access grants.
export function workspaceMediaNames(database){
  const names=database.prepare("SELECT body FROM documents WHERE kind='studioMedia'").all().map(row=>JSON.parse(row.body).diskName);
  for(const row of database.prepare("SELECT body FROM documents WHERE kind='clientProjects'").all()){
    const project=JSON.parse(row.body);
    if(!Array.isArray(project.versions))throw new Error('고객 프로젝트의 파일 버전 기록을 확인해 주세요.');
    for(const version of project.versions)if(version.media)names.push(version.media.diskName);
    if(project.intake?.files){if(!Array.isArray(project.intake.files))throw new Error('고객 접수 자료 기록을 확인해 주세요.');for(const file of project.intake.files)names.push(file.diskName);}
  }
  return [...new Set(names)];
}

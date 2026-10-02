import fs from 'node:fs';

const scenes = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const titles = {
  open: 'ChatGPT의<br>긴 입력창을 누르세요.',
  'project-menu': '왼쪽 메뉴에서<br>‘프로젝트’를 찾으세요.',
  create: '새 프로젝트를 만들고<br>이름은 ‘회의 정리’.',
  save: '정리 규칙을 붙여넣고<br>저장하세요.',
  'repeat-project': '전에 만든<br>‘회의 정리’를 누르세요.',
  'repeat-new': '그 안에서<br>‘새 채팅’을 누르세요.',
  'repeat-memo': '새 채팅에<br>이번 회의 기록을 넣으세요.',
};
const steps = new Map([
  ['① 전체 위치', '① 전체 화면'],
  ['① 프로젝트 화면', '① 전체 화면'],
  ['② 확대해서 찾기', '② 위치 확대'],
  ['② 왼쪽 메뉴 확대', '② 위치 확대'],
  ['③ 클릭·입력', '③ 누르기·입력'],
  ['③ 클릭', '③ 누르기'],
  ['③ 새 채팅 클릭', '③ 새 채팅'],
  ['③ 위치 확인', '③ 찾기'],
]);
for (const scene of scenes) {
  if (titles[scene.id]) scene.title = titles[scene.id];
  if (!scene.camera) continue;
  scene.body = scene.body.replace(/<div class="cam-target-(?:next|confirm)"[^>]*><\/div>/g, '');
  const target = scene.body.match(/<div class="cam-target"[^>]*><\/div>/)?.[0];
  if (target) {
    const highlight = (kind, rect) => rect ? `<div class="cam-target-${kind}" style="left:${rect[0]}px;top:${rect[1]}px;width:${rect[2]}px;height:${rect[3]}px"></div>` : '';
    scene.body = scene.body.replace(target, target + highlight('next', scene.camera.nextRect) + highlight('confirm', scene.camera.confirmRect));
  }
  if (scene.id === 'create') {
    scene.body = scene.body.replace(/<span class="confirm">[^<]*<\/span>/g, '');
    scene.body = scene.body.replace('<span class="next">프로젝트 이름 입력란</span>', '<span class="next">프로젝트 이름 입력란</span><span class="confirm">오른쪽 아래 · 프로젝트 만들기</span>');
    scene.body = scene.body.replace('<span class="next">이름 입력 → 프로젝트 만들기</span>', '<span class="next">이름 입력</span><span class="confirm">프로젝트 만들기 클릭</span>');
    if (!scene.body.includes('<span class="confirm">프로젝트 만들기 클릭</span>')) scene.body = scene.body.replace('<span class="next">이름 입력</span>', '<span class="next">이름 입력</span><span class="confirm">프로젝트 만들기 클릭</span>');
  }
  for (const [before, after] of steps) scene.body = scene.body.replaceAll(before, after);
  scene.body = scene.body.replace(/<div class="cam-note">[^<]*<\/div>/g, '');
  if (scene.id === 'repeat-project') scene.body += '<div class="cam-note">프로젝트 목록은 예시 화면</div>';
  if (scene.id === 'repeat-new') scene.body += '<div class="cam-note">지난 대화 목록은 예시 화면</div>';
}
fs.writeFileSync('content.json', JSON.stringify(scenes, null, 2) + '\n');

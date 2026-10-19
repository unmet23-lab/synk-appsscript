// talk 배포판 작업 폴더에 후보 묶음과 고정값 세 곳을 넣는다(정확히 한 번 나오는 원문만 바꾼다).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const wt = 'C:/Users/q1212/Documents/talk-wt-path-20261019', here = __dirname;
const OLD = 'bc9f719ea9a541b54cbaf22e3b6c9edf6b4b60a5842d45323b3980d7d8daa7b7';
const candidate = fs.readFileSync(path.join(here, 'synk-personal-runtime.candidate.js'), 'utf8');
const NEW = crypto.createHash('sha256').update(candidate.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const once = (file, from, to) => {
  const p = path.join(wt, file), text = fs.readFileSync(p, 'utf8'), n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${file}: 바꿀 글이 ${n}번`);
  fs.writeFileSync(p, text.split(from).join(to));
};
fs.writeFileSync(path.join(wt, 'supabase/functions/_shared/synk-personal-runtime.js'), candidate);
// 빌드 도구: 고정 지문·이름표·내력 주석
once('tools/synk-personal-build.js', `sha256:'${OLD}'`, `sha256:'${NEW}'`);
once('tools/synk-personal-build.js', "label:'production v45 Auth transport fix + WORLD member-understanding read (2026-10-19)'", "label:'production v45 Auth transport fix + WORLD member-understanding read + PATH one-place day (2026-10-19)'");
once('tools/synk-personal-build.js', ' * 나머지 바이트는 v45 그대로다(tools/backend-runtime-manifest.json 의 worldReadPatch). */',
  ' * 나머지 바이트는 v45 그대로다(tools/backend-runtime-manifest.json 의 worldReadPatch).\n'
  + ' * 2026-10-19: 그 위에 PATH 저장 검사 두 줄만 SYNK-appsscript d951cd544 의 뜻으로 바꿨다 — 희망 방문 수 1~5곳,\n'
  + ' * 하루 일정의 최소 장소 수 min(2, 희망 수). 나머지 바이트는 v48 그대로다(같은 목록의 pathOneStopPatch). */');
// 시험의 고정 지문
once('tests/synk-personal-media.test.js', `'${OLD}'`, `'${NEW}'`);
// 런타임 목록: 지문과 내력(JSON 모양을 그대로 지킨다)
const manifestPath = path.join(wt, 'tools/backend-runtime-manifest.json'), raw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);
if (JSON.stringify(manifest, null, 2) + '\n' !== raw) throw new Error('목록 파일이 2칸 들여쓰기 JSON이 아니다 — 손으로 고쳐야 한다');
const entry = manifest.bundles[1];
if (entry.sha256 !== OLD) throw new Error('목록의 묶음 지문이 v48이 아니다');
entry.sha256 = NEW;
entry.pathOneStopPatch = {
  previousCommit: 'e13f6fe', previousSha256: OLD, appsscriptCommit: 'd951cd544', nonTargetBytesExact: true, swaps: 2,
  change: 'PATH travel accepts a one-place day: normalizePlannerInput takes stopCount 1-5 and a day plan needs min(2, stopCount) stops; reverting the two swaps gives the v48 bundle',
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ NEW, bytes: Buffer.byteLength(candidate) }));

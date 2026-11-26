'use strict';
/**
 * 알림 고침(무인)의 올리기 — 검수와 격리 시험을 통과한 고침을, 검사 · 시험 · push가 한 커밋을 보게 해서 빨리감기로만 올린다.
 * 설계 v4(11-26, Fable 5.2 설계 검토 「고치고 만들기」)와 그 덧붙임 v4.1(GPT 검수 alert-fix-20261126-r3, Fable 5.2 다시 검토)을 따른다.
 *
 * 1. origin을 받아 바탕을 판정한다. 고친 원천의 origin 판이 검수 바탕과 다르거나 새 시험 이름이 이미 있으면 올리지 않는다.
 * 2. 미디어만 뺀 새 작업본(HEAD = origin)에 검수한 blob을 git이 꺼내는 꼴 그대로(줄끝 변환까지) 쓴다.
 * 3. 바로올리기 미리 보기(`--json`, `-F 커밋 글`, `--실행` 없음)로 공개 · 용량 · 크기 · 낡은 곳 · 짝 검사를 받고, 그 머리를 올릴 커밋 C로 쓴다.
 *    미리 보기가 조용히 넘기는 자리(공개 검사 꺼짐 · 짝 검사 못 고름 · 낡은 곳 못 봄 · 주의 · 크기 알림)는 멈춤으로 본다.
 *    C의 부모가 받은 origin 하나이고, 바뀐 경로가 우리 것뿐이고, blob이 검수 blob인지 잰다. 줄끝도 이 blob 대조가 본다.
 * 4. C를 꺼내 관련 시험(지도로 고름 + 종류 시험, 모델이 쓴 새 시험은 뺀다)을 자격 · 운영 값 · SSH 대리를 뺀 환경으로, 새 시험은 집까지 비운
 *    환경으로 끝까지 돌린다. 시험 파일이 하나라도 없거나 파일이 아니거나, 실패 · 건너뜀 · 취소 · 시간 넘김이거나, 새 시험이 격리 사본에서 돈
 *    자리(파일 · 줄 · 칸)와 다른 자리를 돌았거나, 시험이 올릴 파일을 바꿨으면 올리지 않는다.
 * 5. 꺼둠 · 멈춤 · 작업 마감을 다시 보고, 부른 쪽이 기록에 C를 적은 뒤(밀기전) `git push origin C:refs/heads/master`(강제 없음).
 *    push가 C를 받았다고 답했거나(종료 0) 받은 origin/master가 C를 품으면 올림이다. 앞질러 거절되면 같은 blob으로 새 바탕에서 2부터 다시
 *    한다(합치지 않는다). 원천이 바뀌었으면 「바탕 바뀜」.
 * 고침 내용이 원인인 실패(공개 · 용량 · 짝 · 크기 검사, blob 불일치, 시험 실패)만 그대로 끝낸다. 나머지(받기 · 미리 보기 무응답 · 시험 자리 ·
 * 시간 · push 연결 · 도중의 꺼둠)는 「다시」로 돌려줘 다음 날 같은 사건을 다시 고를 수 있게 한다. 다시 고르는 횟수는 부르는 쪽이 사건 차례로 막는다.
 * 바로올리기의 push · 다시 쌓기 · 관련 시험 · 올림 장부는 쓰지 않는다(무인 고침은 검수 사슬 밖이다). 운영 사본은 5분 예약이 따라간다.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const 관문 = require('./알림고침관문.js');

// 올릴 작업본은 미디어(그림 · 소리 · 영상 · 글꼴 · 큰 묶음)만 빼고 뜬다. 관련 시험이 읽는 글 파일은 저장소 어디에 있든 들어온다.
// 11-26 실측: 미디어 2만 3천 개 9.8GB를 빼면 4만 1천 개 820MB(83초). 폴더를 골라 뜨면 docs/마케팅의 목록을 보는 시험이 깨졌다.
const 미디어 = ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'tif', 'tiff', 'bmp', 'ico',
  'psd', 'exr', 'hdr', 'pdf', 'zip', '7z', 'rar', 'tar', 'gz', 'glb', 'gltf', 'blend', 'fbx', 'obj', 'ttf', 'otf', 'woff', 'woff2', 'bin', 'npz', 'onnx', 'safetensors', 'pt', 'ckpt'];
const 작업본꼴 = Object.freeze(['/*', ...미디어.flatMap((e) => [`!*.${e}`, `!*.${e.toUpperCase()}`])]);
// push --porcelain 출력: 받은 ref는 「 」 · 「+」 · 「*」 · 「=」, 앞질러 거절은 「!」에 [rejected] (fetch first | non-fast-forward | stale info).
// 서버가 거절한 [remote rejected]는 원격이 움직인 것이 아니다(Fable v4.1 P3-3).
const 앞질림꼴 = /^!\t[^\t]*:refs\/heads\/master\t\[rejected\] \((?:fetch first|non-fast-forward|stale info)\)/m;

const 글 = (b) => String(b == null ? '' : b).trim();
function 있나(cwd, rev) {
  return spawnSync('git', ['cat-file', '-e', rev], { cwd, windowsHide: true }).status === 0;
}
const 판blob = (cwd, rev, p) => 글(관문.git(cwd, ['rev-parse', `${rev}:${p}`]));
function 품나(cwd, 커밋, ref) {
  return spawnSync('git', ['merge-base', '--is-ancestor', 커밋, ref], { cwd, windowsHide: true }).status === 0;
}

/**
 * 바로올리기 미리 보기 JSON을 무인 길의 기준으로 본다. 걸리면 { 까닭, 고침탓 }, 아니면 ''.
 * 고침탓: 고침 내용이 원인이다(공개 걸림 · 검사 문제 · 용량 · 짝 막음 · 계획 표 · 크기). 아니면 도구 · 환경 탓이라 다음 날 다시 해도 된다.
 * 줄끝: 이 저장소는 core.autocrlf=true라 git이 꺼낸 CRLF 파일을 미리 보기가 늘 「변환됨」으로 적는다(r3 GA1) — 바이트는 부르는 쪽의 blob 대조가 본다.
 */
function 미리판정(판, O) {
  const 걸림 = (까닭, 고침탓 = false) => ({ 까닭, 고침탓 });
  if (!판) return 걸림('미리 보기가 답하지 않았다');
  if (판.결과 !== '미리 보기') {
    const 검사걸림 = (Array.isArray(판.문제) && 판.문제.length > 0) || (판.짝검사?.결과?.막음 || []).length > 0 || (판.계획표?.막음 || []).length > 0;
    return 걸림(`미리 보기가 아니다(${글(판.결과 || '결과 없음')}${판.이유 ? ` — ${String(판.이유).slice(0, 160)}` : ''})`, 검사걸림);
  }
  if (판.바탕 !== O || 판.원격머리 !== O) return 걸림('미리 보기의 바탕이 받은 origin이 아니다');
  if (!/^[0-9a-f]{40}$/.test(String(판.머리 || ''))) return 걸림('미리 보기에 올릴 커밋이 없다');
  if (!판.공개 || 판.공개.켜짐 !== true) return 걸림('공개 검사가 돌지 않았다');
  if ((판.공개.걸림 || []).length) return 걸림('공개 검사에 걸렸다', true);
  if (판.용량?.통과 !== true) return 걸림('용량 검사를 통과하지 못했다', true);
  if (판.짝검사 && (판.짝검사.결과?.막음 || []).length) return 걸림('짝 검사에 걸렸다', true);
  if (판.짝검사 && (판.짝검사.못고름 || 판.짝검사.결과?.오류)) return 걸림('짝 검사를 끝내지 못했다');
  if ((판.낡은곳 || []).some((x) => /보지 못했다/.test(String(x)))) return 걸림('낡은 곳 검사를 보지 못했다');
  if (판.계획표?.막음?.length) return 걸림('계획 표 검사에 걸렸다', true);
  if (판.주의) return 걸림(`미리 보기 주의: ${String(판.주의).slice(0, 160)}`);
  if (판.크기알림) return 걸림('크기 알림이 있다', true);
  return '';
}

/**
 * 원천: 고친 원천 경로들, 새시험: 새 시험 경로들, 새시험자리: 격리 사본의 고친 판에서 새 시험이 돈 자리들(파일:줄:칸). 바탕blob · 후blob: 경로 → blob sha.
 * 사본: 그 blob이 든 저장소(공용과 objects를 나눈다). 종류: 종류 표의 항목(시험 · 작업본꼴). 자리잡기: 공용 시험 자리(→ { 번호, 놓기 }).
 * 멈출까: 꺼둠 · 멈춤이면 그 글. 밀기전(C): 밀기 바로 앞에 부른 쪽이 기록에 C를 적는다 — 던지거나 false면 밀지 않는다.
 * 전체한도ms: 이 시간이 지나면 새 차례를 시작하지 않는다. 마감: 이 때(시계 기준 ms)가 지나면 시험도 push도 하지 않는다(잠금 끝에서 거꾸로 센 때).
 * → { 결과: '올림' | '바탕 바뀜' | '못 올림', 커밋?, 이유?, 바이트같음?, 앞시험?, 차례?, 다시? }  다시: 고침 탓이 아니라 다음 날 같은 사건을 다시 골라도 된다.
 */
function 올리기({ 공용, 루트, 사본, 시도폴더, 종류 = {}, 원천, 새시험, 새시험자리 = null, 바탕blob, 후blob, 메시지, 실행 = spawnSync, 자리잡기 = null, 받기 = true,
  고르기 = null, 멈출까 = () => '', 밀기 = null, 밀기전 = () => true, 시험한도ms = 40 * 60000, 새시험한도ms = 15 * 60000, 미리한도ms = 20 * 60000, 차례한도 = 8,
  전체한도ms = 75 * 60000, 마감 = Infinity, 시계 = () => Date.now() }) {
  const 받아보기 = () => {
    if (받기) 관문.git(공용, ['fetch', '-q', 'origin', 'master'], { 한도ms: 300000 });
    return 글(관문.git(공용, ['rev-parse', '--verify', 'refs/remotes/origin/master^{commit}']));
  };
  const 바탕판정 = (O) => {
    for (const p of 원천) if (!있나(공용, `${O}:${p}`) || 판blob(공용, O, p) !== 바탕blob[p]) return `고친 뒤 origin에서 바뀌었다: ${p}`;
    for (const p of 새시험) if (있나(공용, `${O}:${p}`)) return `같은 이름의 시험이 origin에 생겼다: ${p}`;
    return '';
  };
  const 밀기기본 = (cwd, C) => {
    const r = spawnSync('git', ['push', '--porcelain', 'origin', `${C}:refs/heads/master`], { cwd, encoding: 'utf8', windowsHide: true, timeout: 300000 });
    return { status: r.status, 글: `${r.stdout || ''}\n${r.stderr || ''}` };
  };
  const 경로들 = [...원천, ...새시험];
  const 못 = (이유, 더 = {}) => ({ 결과: '못 올림', 이유: String(이유).slice(0, 300), ...더 });
  const 시작 = 시계();
  // 원격이 움직였을 때 다음 바탕. 차례 · 75분 · 마감을 넘었거나, 받지 못했거나, 원천이 바뀌었으면 끝(다음 날 같은 사건을 다시 골라도 된다).
  // 75분은 새 차례를 시작할지만 본다 — 이미 시작한 차례는 마감까지 간다(Fable v4.1 P2-2).
  const 다음바탕 = (차례) => {
    if (차례 >= 차례한도 || 시계() - 시작 > 전체한도ms || 시계() >= 마감) return { 끝: 못(`원격이 계속 움직여 ${차례}번 모두 올리지 못했다`, { 차례, 다시: true }) };
    let 새O;
    try { 새O = 받아보기(); } catch (e) { return { 끝: 못(`origin을 받지 못했다: ${String(e.message).slice(0, 200)}`, { 차례, 다시: true }) }; }
    const 또 = 바탕판정(새O);
    return 또 ? { 끝: { 결과: '바탕 바뀜', 이유: 또, 차례, 다시: true } } : { O: 새O };
  };
  let O;
  try { O = 받아보기(); } catch (e) { return 못(`origin을 받지 못했다: ${String(e.message).slice(0, 200)}`, { 다시: true }); }
  const 처음 = 바탕판정(O);
  if (처음) return { 결과: '바탕 바뀜', 이유: 처음, 다시: true };
  if (!Array.isArray(새시험자리) || !새시험자리.length) return 못('새 시험 자리 목록이 없다');
  const 작업본 = path.join(시도폴더, '올리기');
  const 글파일 = path.join(시도폴더, '커밋글.txt');
  let 앞 = null, 차례 = 0;
  try {
    fs.writeFileSync(글파일, 메시지);
    관문.git(공용, ['worktree', 'add', '--no-checkout', '--detach', 작업본, O], { 한도ms: 300000 });
    관문.git(작업본, ['sparse-checkout', 'set', '--no-cone', '--stdin'], { input: [...(종류.작업본꼴 || 작업본꼴)].join('\n') + '\n', 한도ms: 300000 });
    관문.git(작업본, ['read-tree', '-mu', 'HEAD'], { 한도ms: 1800000 });
    // 사본에서 지은 새 blob은 사본에만 있다 — 바이트 그대로 공용 저장소에 넣고 sha를 대조한다
    for (const p of 경로들) {
      const sha = 글(관문.git(작업본, ['hash-object', '-w', '--no-filters', '--stdin'], { input: 관문.blob읽기(사본, 후blob[p]) }));
      if (sha !== 후blob[p]) return 못(`검수한 blob을 옮기지 못했다: ${p}`, { 다시: true });
    }
    for (차례 = 1; ; 차례++) {
      // 앞시험은 이 차례에서 돈 시험만 적는다 — 앞 차례의 셈이 이 차례의 실패에 섞이지 않게(r5 GA3)
      if (차례 > 1) 앞 = null;
      const 더 = (x = {}) => ({ 앞시험: 앞, 차례, ...x });
      // 2. 받은 origin 위에 검수한 blob을 git이 꺼내는 꼴로 쓴다(인덱스에 올려 꺼낸 뒤 인덱스만 되돌린다 — 평소의 고친 파일과 같은 상태)
      관문.git(작업본, ['reset', '-q', '--hard', O], { 한도ms: 900000 });
      for (const p of 경로들) 관문.git(작업본, ['update-index', '--add', '--cacheinfo', `100644,${후blob[p]},${p}`]);
      관문.git(작업본, ['checkout', '--', ...경로들]);
      관문.git(작업본, ['reset', '-q', '--', ...경로들]);
      // 3. 바로올리기 미리 보기 — 커밋 글까지 공개 검사를 받는다
      const r = 실행(process.execPath, [path.join(루트, 'tools', '바로올리기.js'), ...경로들, '--저장소', 작업본, '-F', 글파일, '--json'],
        { cwd: 루트, env: 관문.올리기환경(), encoding: 'utf8', windowsHide: true, timeout: 미리한도ms, maxBuffer: 64 << 20 });
      let 판 = null;
      try { 판 = JSON.parse(String(r.stdout || '').trim()); } catch { /* 아래에서 걸린다 */ }
      // 미리 보기가 받은 origin이 그새 움직였다 — 어떤 답이든(그 바뀜과 겹쳐 멈춘 답까지) 같은 blob으로 새 바탕에서 다시(r3 GA2)
      if (/^[0-9a-f]{40}$/.test(String(판?.원격머리 || '')) && 판.원격머리 !== O) {
        const 다음 = 다음바탕(차례);
        if (다음.끝) return { ...다음.끝, 앞시험: 앞 };
        O = 다음.O;
        continue;
      }
      const 걸림 = 미리판정(판, O);
      if (걸림) return 못(`올리기 검사: ${걸림.까닭}${판 ? '' : `(종료 ${r.status ?? r.error?.code ?? '?'})`}`, 더(걸림.고침탓 ? {} : { 다시: true }));
      const C = 판.머리;
      const 부모 = 글(관문.git(작업본, ['rev-list', '--parents', '-n', '1', C])).split(/\s+/);
      if (부모.length !== 2 || 부모[1] !== O) return 못('올릴 커밋의 부모가 받은 origin 하나가 아니다', 더({ 다시: true }));
      const 바뀐 = 글(관문.git(작업본, ['diff', '--name-only', '--no-renames', '-z', O, C])).split('\0').filter(Boolean).sort();
      if (JSON.stringify(바뀐) !== JSON.stringify([...경로들].sort())) return 못(`올릴 커밋에 다른 경로가 있다: ${바뀐.join(', ').slice(0, 200)}`, 더({ 다시: true }));
      if (!경로들.every((p) => 판blob(작업본, C, p) === 후blob[p])) return 못('올릴 커밋의 내용이 검수한 blob이 아니다', 더());
      // 4. C를 꺼내 관련 시험을 엄격하게
      관문.git(작업본, ['reset', '-q', '--hard', C], { 한도ms: 900000 });
      let 고름;
      try { 고름 = (고르기 || require(path.join(루트, 'tools', '관련시험.js')).고르기)({ root: 작업본, 바뀐: 경로들, 받기: true }); }
      catch (e) { return 못(`관련 시험을 고르지 못했다: ${String(e.message).slice(0, 200)}`, 더({ 다시: true })); }
      if (!고름 || 고름.지도 == null) return 못('관련 시험 지도를 받지 못했다', 더({ 다시: true }));
      const 시험들 = [...new Set([...(Array.isArray(고름.시험) ? 고름.시험 : []), ...(종류.시험 || [])])].filter((t) => !새시험.includes(t));
      if (!시험들.length) return 못('관련 시험이 하나도 골라지지 않았다', 더({ 다시: true }));
      // 종류 시험까지 모두 그 판에 파일로 있어야 한다 — 새 바탕에서 지워지거나 이름이 바뀌거나 디렉터리가 된 시험을 통과로 치지 않는다(r3 GA3 · GA7, r4 GA5 · GA7)
      const 없음 = [...시험들, ...새시험].filter((t) => !관문.파일인가(작업본, t));
      if (없음.length) return 못(`올릴 판에 시험 파일이 없다: ${없음.slice(0, 3).join(', ')}`, 더({ 다시: true }));
      if (!(마감 - 시계() > 60000)) return 못('작업 마감이 가까워 시험을 시작하지 않았다', 더({ 다시: true }));
      const 자리 = 자리잡기 ? 자리잡기() : null;
      if (자리 && 자리.번호 === null) return 못('시험 자리가 비지 않았다', 더({ 다시: true }));
      let 기존, 새것;
      try {
        // 남은 시간은 자리를 받은 뒤, 시험마다 바로 앞에서 한 번만 읽어 그 값으로 확인하고 한도를 준다(r4 GA3 · r5 GA4) — 0 이하의 한도는 한도 없음이 된다
        const 남1 = 마감 - 시계();
        if (!(남1 > 60000)) return 못('작업 마감이 가까워 시험을 시작하지 않았다', 더({ 다시: true }));
        // 기존 시험은 바로올리기가 돌릴 때와 같은 환경(집 폴더 그대로 · 자격 · 운영 값 · SSH 대리만 뺌) — 집의 파이썬을 쓰는 감시 시험이 있다
        기존 = 관문.시험돌리기({ 사본: 작업본, 파일들: 시험들, env: 관문.올리기환경(), 한도ms: Math.min(시험한도ms, 남1) });
        앞 = { 시험: 기존.시험, 통과: 기존.통과, 파일: 시험들.length, 초: 기존.초, 새시험: null, 새통과: null };
        // 앞 시험이 시간을 넘겼거나 남은 시간이 모자라면 새 시험을 돌리지 않는다(Fable v4.2 P2-3)
        if (기존.시간넘김) return 못(`올릴 판의 관련 시험이 시간을 넘겼다(${기존.통과 ?? '?'}/${기존.시험 ?? '?'})`, 더({ 다시: true }));
        // 모델이 쓴 새 시험은 집까지 비운 환경으로만 — 올릴 판에서도 한 번 더 돌고, 정의한 자리까지 받는다
        const 새환경 = 관문.환경(path.join(시도폴더, '올리기새시험'));
        const 남2 = 마감 - 시계();
        if (!(남2 > 60000)) return 못('작업 마감이 가까워 새 시험을 시작하지 않았다', 더({ 다시: true }));
        새것 = 관문.시험돌리기({ 사본: 작업본, 파일들: 새시험, env: 새환경, 한도ms: Math.min(새시험한도ms, 남2), 자리: true });
      } finally { 자리?.놓기?.(); }
      앞 = { ...앞, 새시험: 새것.시험, 새통과: 새것.통과 };
      const 셈 = (x) => `${x.통과 ?? '?'}/${x.시험 ?? '?'}${x.시간넘김 ? ' · 시간 넘김' : ''}${x.건너뜀 ? ` · 건너뜀 ${x.건너뜀}` : ''}${x.실패이름.length ? ` · ${x.실패이름.slice(0, 3).join(' / ')}` : ''}`;
      if (기존.시간넘김 || 새것.시간넘김) return 못(`올릴 판의 시험이 시간을 넘겼다(관련 ${셈(기존)} · 새 ${셈(새것)})`, 더({ 다시: true }));
      if (!기존.통과함) return 못(`올릴 판의 관련 시험 ${셈(기존)}`, 더());
      if (!새것.통과함) return 못(`올릴 판의 새 시험 ${셈(새것)}`, 더());
      // 격리 사본의 고친 판에서 돈 그 자리들이 올릴 판에서도 꼭 한 번씩 돌아야 한다(r4 GA8)
      const 앞자리 = { 자리들: 새시험자리.map((자리) => ({ 자리 })), 자리셈맞음: true, 자리겹침: new Set(새시험자리).size !== 새시험자리.length };
      if (!관문.자리같나(새것, 앞자리)) return 못('올릴 판에서 돈 새 시험의 자리가 격리 사본에서 돈 자리와 다르다', 더());
      if (글(관문.git(작업본, ['status', '--porcelain', '--', ...경로들]))) return 못('시험이 올릴 파일을 바꿨다', 더());
      // 5. 마지막으로 꺼둠 · 멈춤 · 작업 마감을 보고, 기록에 C를 적은 뒤 빨리감기로만 민다
      const 멈춤 = 멈출까();
      if (멈춤) return 못(`도중에 ${멈춤}`, 더({ 다시: true }));
      if (시계() > 마감) return 못('작업 마감을 넘겨 밀지 않았다', 더({ 다시: true }));
      let 적음 = false;
      try { 적음 = 밀기전(C) !== false; } catch { 적음 = false; }
      if (!적음) return 못('올릴 커밋을 기록에 적지 못해 밀지 않았다', 더({ 다시: true }));
      // 기록을 쓰는 사이에 마감이 지났으면 밀지 않는다(r4 GA2) — 적은 C는 다음 회차의 맞추기가 「안 올라감」으로 닫는다
      if (시계() > 마감) return 못('작업 마감을 넘겨 밀지 않았다', 더({ 다시: true }));
      const 민 = (밀기 || 밀기기본)(작업본, C);
      const 민글 = String(민?.글 || '');
      // 올랐는지: push가 C를 받았다고 답했거나(종료 0과 그 ref 줄), 받은 origin/master가 C를 품는다. 확인 받기만 실패해도 올림이다(r3 GA4 · GA10).
      const 받음 = 민?.status === 0 && new RegExp(`^[ +*=]\\t${C}:refs/heads/master\\t`, 'm').test(민글);
      let 품음 = false;
      try { 받아보기(); 품음 = 품나(공용, C, 'refs/remotes/origin/master'); } catch { 품음 = false; }
      // C는 위에서 blob을 대조한 그 커밋 그대로다 — 올라간 판은 검수한 바이트다
      if (받음 || 품음) return { 결과: '올림', 커밋: C, 바이트같음: true, 앞시험: 앞, 차례 };
      if (!앞질림꼴.test(민글)) return 못(`push가 실패했다(종료 ${민?.status ?? '?'}) ${글(민글).split('\n').slice(-2).join(' / ').slice(0, 200)}`, 더({ 다시: true }));
      // 원격이 움직였다 — 합치지 않고, 같은 blob으로 새 바탕에서 다시
      const 다음 = 다음바탕(차례);
      if (다음.끝) return { ...다음.끝, 앞시험: 앞 };
      O = 다음.O;
    }
  } catch (e) {
    return 못(`올리기 도중 오류: ${String(e.message).slice(0, 200)}`, { 앞시험: 앞, ...(차례 ? { 차례 } : {}), 다시: true });
  } finally {
    try { 관문.git(공용, ['worktree', 'remove', '--force', 작업본], { 한도ms: 300000 }); } catch { /* 다음 회차가 치운다 */ }
    try { fs.rmSync(작업본, { recursive: true, force: true, maxRetries: 3 }); } catch { /* 다음 회차가 치운다 */ }
  }
}

module.exports = { 올리기, 미리판정, 작업본꼴 };

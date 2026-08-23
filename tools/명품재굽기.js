/*
 * 명품 재굽기 — 요소 세트 156장 + 화면 14장을 «한 줄»로 다시 굽는다 (유호 지시 2026-08-24).
 *
 * ■ 왜 이 도구가 서나
 *   전량 재굽기는 여태 «명령 세 줄을 손으로 이어 치는 일»이었고, 그래서 08-23 에 실제로 사고가 났다:
 *   트랙이 가리킨 `요소전량굽기.js` 가 master 에 없었고(브랜치에 갇혀 있었다), 화면 14장은 통로가
 *   인계문 안 예시 한 줄로만 살아 있었다. **이어 치는 일은 다음 사람이 못 잇는다.** 여기 못 박는다.
 *
 * ■ 무엇이 달라졌나 (08-24 채택값 · 근거는 tools/요소굽기.py 색 관리 절의 실측)
 *   · 색관리 = Khronos PBR Neutral (채도 +55~73% · 대비 오른 유일한 변주)
 *   · 노출   = +0.25 (중립이 내린 밝기를 되민다)
 *   · 샘플   = 256 (또렷함 +25.8% · 512 는 2배 값에 +6.9% 뿐이라 무릎에서 멈춘다)
 *   앞 둘은 요소굽기.py 의 «기본값»이라 이 도구가 안 넘겨도 걸린다 — 세트가 갈리지 않게 한 곳에서 나온다.
 *
 * ■ 규율
 *   · 블렌더는 **한 줄로만** 돈다(iGPU 하나 · 3.4GB). 이 도구도 순차다. 이미 돌면 걸지 말고 물러난다.
 *   · 완주 판정은 **파일**로 한다(수·해상도·시각) — 끊긴 굽기는 exit 0 에 로그 끝줄이 ✅ 라 구별이 안 된다.
 *   · 화면 출력은 **절대 경로**로 준다 — 블렌더는 상대 경로를 «드라이브 루트»로 읽는다(C:\docs\ 사고).
 *
 * 쓰기:
 *   node tools/명품재굽기.js                 (요소 → 화면 → 덧씌움 · 전부)
 *   node tools/명품재굽기.js --화면만
 *   node tools/명품재굽기.js --요소만
 *   node tools/명품재굽기.js --덧씌움만       (이미 구운 그릇에 본문만 다시 붓는다)
 *   node tools/명품재굽기.js --너비 1000 --샘플 64      (시험용 빠른 판)
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 블렌더 = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';

const 인자 = {};
const 깃발 = new Set();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const 이름 = a.slice(2);
    if (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) { 인자[이름] = process.argv[i + 1]; i += 1; }
    else 깃발.add(이름);
  }
}
const 너비 = 인자['너비'] || '1800';
const 견본 = 인자['샘플'] || '256';
const 장치 = 인자['장치'] || 'GPU';

/* ── 화면 열넷 — «어느 공방의 어느 그릇인가»의 정본 ────────────────────────────
 * 여태 이 표가 어디에도 없었다(공방 인계문 열넷에 예시 한 줄씩 흩어져 있었다).
 * 화면이 늘면 여기 한 줄을 더한다. */
const 화면들 = [
  { 형태: '조합판', 공방: '조합공방_0821', 그릇: '조합판_v1_그릇만', 덧: '조합덧씌움3.py' },
  { 형태: '성장판', 공방: '성장공방_0821', 그릇: '성장판_v1_그릇만', 덧: '성장덧씌움.py' },
  { 형태: '오늘판', 공방: '오늘공방_0822', 그릇: '오늘판_v1_그릇만', 덧: '오늘덧씌움.py' },
  { 형태: '소식판', 공방: '소식공방_0823', 그릇: '소식판_v1_그릇만', 덧: '소식덧씌움.py' },
  { 형태: '우리아이판', 공방: '학부모공방_0823', 그릇: '우리아이판_v1_그릇만', 덧: '우리아이덧씌움.py' },
  { 형태: '리포트판', 공방: '학부모공방_0823', 그릇: '리포트판_v1_그릇만', 덧: '리포트덧씌움.py' },
  { 형태: '부모소식판', 공방: '학부모공방_0823', 그릇: '부모소식판_v1_그릇만', 덧: '부모소식덧씌움.py' },
  { 형태: '오늘수업판', 공방: '강사공방_0823', 그릇: '오늘수업판_v1_그릇만', 덧: '오늘수업덧씌움.py' },
  { 형태: '강사학생판', 공방: '강사공방_0823', 그릇: '강사학생판_v1_그릇만', 덧: '강사학생덧씌움.py' },
  { 형태: '검수판', 공방: '강사공방_0823', 그릇: '검수판_v1_그릇만', 덧: '검수덧씌움.py' },
  { 형태: '기록판', 공방: '강사공방_0823', 그릇: '기록판_v1_그릇만', 덧: '기록덧씌움.py' },
  { 형태: '원장오늘판', 공방: '원장공방_0823', 그릇: '원장오늘판_v1_그릇만', 덧: '원장오늘덧씌움.py' },
  { 형태: '원장학생판', 공방: '원장공방_0823', 그릇: '원장학생판_v1_그릇만', 덧: '원장학생덧씌움.py' },
  { 형태: '경영판', 공방: '원장공방_0823', 그릇: '경영판_v1_그릇만', 덧: '경영덧씌움.py' },
];

const 시각 = () => new Date().toTimeString().slice(0, 8);
const 분 = (ms) => (ms / 60000).toFixed(1);

function 해상도(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const b = Buffer.alloc(33);
    fs.readSync(fd, b, 0, 33, 0);
    fs.closeSync(fd);
    if (b.toString('ascii', 1, 4) !== 'PNG') return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch (_) { return null; }
}

function 요소굽기() {
  console.log(`\n■ ① 요소 세트 — ${너비}px · 샘플 ${견본} · ${시각()}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath,
    [path.join(루트, 'tools', '세트굽기.js'), '--세트', '전부',
      '--샘플', 견본, '--너비', 너비, '--장치', 장치, '--다시'],
    { cwd: 루트, stdio: 'inherit' });
  console.log(`  → 요소 끝 · ${분(Date.now() - t0)}분 · 종료코드 ${r.status}`);
  return r.status === 0;
}

function 화면굽기() {
  console.log(`\n■ ② 화면 열넷 — ${너비}px · 비율 1.9 · 샘플 ${견본} · ${시각()}`);
  const 실패 = [];
  화면들.forEach((s, i) => {
    const 방 = path.join(루트, 'docs', '캐릭터', s.공방);
    const 파일 = path.join(방, `${s.그릇}.png`);          // ⚠절대 경로 — 상대는 드라이브 루트로 떨어진다
    process.stdout.write(`  [${String(i + 1).padStart(2)}/14] ${s.형태}`.padEnd(24));
    const t0 = Date.now();
    spawnSync(블렌더, ['-b', '-P', path.join(루트, 'tools', '요소굽기.py'), '--',
      `형태=${s.형태}`, '비율=1.9', `샘플=${견본}`, `너비=${너비}`, `장치=${장치}`, `출력=${파일}`],
    { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const 크기 = 해상도(파일);
    const 맞나 = 크기 && 크기[0] === Number(너비);
    console.log(`${맞나 ? '✅' : '🔴'} ${크기 ? `${크기[0]}x${크기[1]}` : '없음'} · ${분(Date.now() - t0)}분`);
    if (!맞나) 실패.push(s.형태);
  });
  if (실패.length) console.log(`  🔴 화면 실패: ${실패.join(' · ')}`);
  return 실패;
}

function 덧씌우기() {
  console.log(`\n■ ③ 본문 덧씌움 열넷 — ${시각()}`);
  const 실패 = [];
  화면들.forEach((s, i) => {
    const 방 = path.join(루트, 'docs', '캐릭터', s.공방);
    process.stdout.write(`  [${String(i + 1).padStart(2)}/14] ${s.형태}`.padEnd(24));
    const r = spawnSync('python', [path.join(방, s.덧), s.그릇],
      { cwd: 방, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const 난것 = path.join(방, `${s.그릇.replace('_그릇만', '')}.png`);
    const 크기 = 해상도(난것);
    const 됐나 = r.status === 0 && 크기;
    console.log(`${됐나 ? '✅' : '🔴'} ${크기 ? `${크기[0]}x${크기[1]}` : '없음'}`);
    if (!됐나) {
      실패.push(s.형태);
      console.log('       ', String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
    }
  });
  if (실패.length) console.log(`  🔴 덧씌움 실패: ${실패.join(' · ')}`);
  return 실패;
}

const 시작 = Date.now();
console.log(`■ 명품 재굽기 — 색관리 PBR중립 · 노출 +0.25 · 샘플 ${견본} · ${너비}px · 시작 ${시각()}`);
const 요소만 = 깃발.has('요소만');
const 화면만 = 깃발.has('화면만');
const 덧만 = 깃발.has('덧씌움만');
const 전부 = !요소만 && !화면만 && !덧만;

if (전부 || 요소만) 요소굽기();
if (전부 || 화면만) 화면굽기();
if (전부 || 화면만 || 덧만) 덧씌우기();
console.log(`\n■ 전체 끝 — ${분(Date.now() - 시작)}분 · ${시각()}`);

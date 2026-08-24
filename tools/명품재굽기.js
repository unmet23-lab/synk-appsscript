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
 * ■ 08-24 저녁 증보 — «세트가 색으로 갈려 있었다»
 *   요소 156 + 화면 14 를 새 자로 다 굽고 나서 폴더를 기계로 세니, 3D 로 굽는 자산 중 **52장이
 *   옛 자(AgX)에 남아 있었다**: 오브 26 · 퍼프로브 23 · 글자 3. 이 도구가 그 셋을 안 불렀기 때문이다
 *   (통로는 `오브굽기.js`·`요소전량굽기.js` 로 따로 있었고, 08-23 에 1800px 로 맞춘 뒤 손이 떠났다).
 *   해상도로 갈리는 것을 막자고 세운 도구가 **색으로 갈리는 것은 못 막고 있었다.**
 *   ⇒ 여기 ③으로 못 박는다. 「명품 재굽기」가 부르지 않는 3D 자산은 이제 없다.
 *   ⚠안 굽는 것은 둘뿐이고 일부러다 — `펠트코랄_0815`(마스코트)·`펠트패치_0815`는 **사진**이라
 *     다시 구울 통로 자체가 없다(`요소전량굽기.js` 머리말의 그 줄).
 *
 * 쓰기:
 *   node tools/명품재굽기.js                 (요소 → 화면 → 덧씌움 → 라이브러리 · 전부)
 *   node tools/명품재굽기.js --화면만
 *   node tools/명품재굽기.js --요소만
 *   node tools/명품재굽기.js --덧씌움만       (이미 구운 그릇에 본문만 다시 붓는다)
 *   node tools/명품재굽기.js --라이브러리만    (오브 26 + 퍼프로브 23 + 글자 3 = 52장)
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

/* ── ③ 요소 라이브러리 52장 — 오브 26 + 퍼프로브 23 + 글자 3 ───────────────────────
 * 통로는 이미 둘이 있다. 여기서 «부르기»만 한 벌로 묶는다 — 배치 로직을 베끼면 인자가 두 곳에서
 * 갈리고, 그게 08-23 에 「1152px 24장 + 900px 1장」을 만든 병이다.
 * 🔑 `--다시` 를 «언제나» 준다: 저쪽 이어굽기 판정은 «가로폭»이라 색이 갈린 것을 못 본다
 *   (옛 판도 이미 1800px 이다 — 안 주면 52장 전부 「이미 됐음」으로 건너뛴다). */
function 라이브러리굽기() {
  console.log(`\n■ ③ 요소 라이브러리 — 오브 26 + 퍼프로브 23 + 글자 3 · ${너비}px · 샘플 ${견본} · ${시각()}`);
  const 실패 = [];
  for (const [이름, 도구, 더] of [
    ['퍼프로브+글자 26', '요소전량굽기.js', ['--다시']],
    ['오브 26색', '오브굽기.js', []],
  ]) {
    console.log(`  ── ${이름}`);
    const t0 = Date.now();
    const r = spawnSync(process.execPath,
      [path.join(루트, 'tools', 도구), '--샘플', 견본, '--너비', 너비, ...더],
      { cwd: 루트, stdio: 'inherit' });
    console.log(`  → ${이름} 끝 · ${분(Date.now() - t0)}분 · 종료코드 ${r.status}`);
    if (r.status !== 0) 실패.push(이름);
  }
  if (실패.length) console.log(`  🔴 라이브러리 실패: ${실패.join(' · ')}`);
  return 실패;
}

function 덧씌우기() {
  console.log(`\n■ ③ 본문 덧씌움 열넷 — ${시각()}`);
  const 실패 = [];
  화면들.forEach((s, i) => {
    const 방 = path.join(루트, 'docs', '캐릭터', s.공방);
    process.stdout.write(`  [${String(i + 1).padStart(2)}/14] ${s.형태}`.padEnd(24));
    /* ⚠08-24 실사고: 성장덧씌움.py 만 둘째 인자 기본값이 «없음»(다른 열셋은 «층별»)이라
     * `성장판_v1_없음.png` 라는 다른 이름으로 저장됐다 — 어제 판 `성장판_v1.png` 가 그 자리에
     * 그대로 남아 이 검증(존재만 확인)을 «✅ 1080x2052»로 통과시켰다. 근본 수정(스크립트 기본값)은
     * 했지만, 이 검증 자체도 같은 병에 걸리는 구조라 여기도 고친다 — 시각과 해상도를 같이 본다. */
    const t0 = Date.now();
    const r = spawnSync('python', [path.join(방, s.덧), s.그릇],
      { cwd: 방, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const 난것 = path.join(방, `${s.그릇.replace('_그릇만', '')}.png`);
    const 크기 = 해상도(난것);
    let 새로 = false;
    try { 새로 = fs.statSync(난것).mtimeMs >= t0 - 1000; } catch (_) { 새로 = false; }
    const 됐나 = r.status === 0 && 크기 && 새로;
    console.log(`${됐나 ? '✅' : '🔴'} ${크기 ? `${크기[0]}x${크기[1]}` : '없음'}`);
    if (!됐나) {
      실패.push(s.형태);
      console.log('       ', String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
    }
  });
  if (실패.length) console.log(`  🔴 덧씌움 실패: ${실패.join(' · ')}`);
  return 실패;
}

/* ── 빠진 것 잡기 — 「✅ 라고 적혔는데 실물은 옛 판」을 잡는 유일한 방법 ──────────────
 * 🔴 08-24 실사고: 재굽기 중 `숫자/2` 가 68초 만에 죽었는데 어제 판이 그 자리에 남아 있어
 *    로그에 「✅ 68초 · 3547KB」로 찍혔다. 세트굽기의 판정이 «있나»였기 때문이다(그 줄도 같이 고쳤다).
 *    ⇒ 배치가 끝나면 **언제나 이것을 돌린다.** 판정 기준은 파일 수도 크기도 아니고 **시각**이다.
 *    「전부 끝」이라는 한글 표지로는 판정할 수 없다(로그가 CP949 라 grep 이 원리상 안 된다 · 트랙 §0).
 * 쓰기: node tools/명품재굽기.js --검사 "2026-08-24 07:12"
 *       node tools/명품재굽기.js --빠진것 "2026-08-24 07:12"      ← 낡은 것만 다시 굽는다
 */
function 낡은것(기준) {
  const { 항목들 } = require('./세트굽기.js');
  const 뿌리 = path.join(루트, 'docs', '캐릭터', '요소공방_0822');
  const 낡 = [];
  for (const it of 항목들('전부')) {
    const p = path.join(뿌리, it.세트, `${it.이름}.png`);
    let t = 0;
    try { t = fs.statSync(p).mtimeMs; } catch (_) { t = 0; }
    if (t < 기준) 낡.push({ 갈래: '요소', 이름: `${it.세트}/${it.이름}`, 항목: it, 파일: p, 때: t });
  }
  for (const s of 화면들) {
    const p = path.join(루트, 'docs', '캐릭터', s.공방, `${s.그릇}.png`);
    let t = 0;
    try { t = fs.statSync(p).mtimeMs; } catch (_) { t = 0; }
    if (t < 기준) 낡.push({ 갈래: '화면', 이름: s.형태, 화면: s, 파일: p, 때: t });
  }
  /* 라이브러리 52장 — 이 갈래를 안 세면 「전량이 새 자로 났다」가 **156/208 을 두고 참**이 된다.
   * 08-24 저녁에 실제로 그랬다. 다시 굽기는 저쪽 배치 통로가 하니 여기서는 «세기»만 한다. */
  const { 부품표 } = require('./요소전량굽기.js');
  for (const k of 부품표) {
    const p = path.join(루트, k.밖, k.파일);
    let t = 0;
    try { t = fs.statSync(p).mtimeMs; } catch (_) { t = 0; }
    if (t < 기준) 낡.push({ 갈래: '라이브러리', 이름: k.이름, 파일: p, 때: t, 배치: true });
  }
  const { 구울색들 } = require('./오브굽기.js');
  for (const c of 구울색들()) {
    const p = path.join(루트, 'docs', '캐릭터', '오브공방_0821', `${c.replace(/\s+/g, '_')}.png`);
    let t = 0;
    try { t = fs.statSync(p).mtimeMs; } catch (_) { t = 0; }
    if (t < 기준) 낡.push({ 갈래: '오브', 이름: c, 파일: p, 때: t, 배치: true });
  }
  return 낡;
}

function 때글(t) { return t ? new Date(t).toLocaleString('ko-KR') : '없음'; }

function 검사(기준) {
  const 낡 = 낡은것(기준);
  console.log(`\n■ 검사 — 기준 ${new Date(기준).toLocaleString('ko-KR')} 보다 «옛» 파일`);
  if (!낡.length) { console.log('  ✅ 빠진 것 없다 — 전량이 이 기준 뒤에 새로 났다.'); return 낡; }
  console.log(`  🔴 ${낡.length}장이 안 구워졌다(로그가 ✅ 라 적었어도 실물은 옛 판이다):`);
  for (const x of 낡) console.log(`     ${x.갈래} ${x.이름}  — ${때글(x.때)}`);
  return 낡;
}

function 빠진것다시(기준) {
  const 전부낡 = 검사(기준);
  /* 배치 갈래(라이브러리·오브)는 자기 통로가 인자를 쥔다 — 여기서 한 장씩 부르면 인자가 두 곳에서
   * 갈린다(08-23 「1152px 24장 + 900px 1장」의 병). 세어서 «어느 명령이 고치는지»만 말한다. */
  const 낡 = 전부낡.filter((x) => !x.배치);
  const 배치낡 = 전부낡.filter((x) => x.배치);
  if (배치낡.length) {
    console.log(`  ↪ 배치 갈래 ${배치낡.length}장은 자기 통로가 굽는다 — node tools/명품재굽기.js --라이브러리만`);
  }
  if (!낡.length) return;
  console.log(`\n■ 빠진 것 다시 굽기 — ${낡.length}장 · ${시각()}`);
  const 열쇠 = ['형태', '본문', '기호', '초밥', '진행', '비율', '조명', '조명배', '등힘', '색',
    '글자크기', '수량', '빛배', '상태', '실감', '조리개'];
  낡.forEach((x, i) => {
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${낡.length}] ${x.이름}`.padEnd(30));
    const 하나 = Date.now();
    const 옵션 = x.갈래 === '요소'
      ? 열쇠.filter((k) => x.항목[k] !== undefined).map((k) => `${k}=${x.항목[k]}`)
      : [`형태=${x.화면.형태}`, '비율=1.9'];
    spawnSync(블렌더, ['-b', '-P', path.join(루트, 'tools', '요소굽기.py'), '--',
      ...옵션, `샘플=${견본}`, `너비=${너비}`, `장치=${장치}`, `출력=${x.파일}`],
    { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let 됐나 = false;
    try { 됐나 = fs.statSync(x.파일).mtimeMs >= 하나 - 1000; } catch (_) { 됐나 = false; }
    console.log(`${됐나 ? '✅' : '🔴'} ${분(Date.now() - 하나)}분`);
  });
}

/* ── 판정 지면 다시 그리기 ────────────────────────────────────────────────────
 * 🔴 안 그리면 «옛 그림으로 새 판을 판정»하게 된다. 08-24 실측: 요소_시안.html 이 08-23 23:11 생성인데
 *    그 뒤 03:44 까지 156장이 다시 구워져, 지면과 실물이 네 시간 반 어긋난 채였다.
 *    굽기와 지면은 **한 벌**이다 — 굽고 안 그리면 아무도 그 굽기를 못 본다. */
function 지면그리기() {
  console.log(`\n■ ④ 판정 지면 — ${시각()}`);
  for (const [이름, 도구, 난것] of [
    ['요소 시안', '요소시안.js', 'docs/요소_시안.html'],
    ['화면 시안', '화면시안.js', 'docs/화면_시안.html'],
    ['오브 시안', '오브시안.js', 'docs/오브_시안.html'],   // 라이브러리를 다시 구우면 이 지면도 옛 그림이 된다
  ]) {
    process.stdout.write(`  ${이름}`.padEnd(24));
    const 전 = (() => { try { return fs.statSync(path.join(루트, 난것)).mtimeMs; } catch (_) { return 0; } })();
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(루트, 'tools', 도구)],
      { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let 새로 = false; let KB = 0;
    try { const s = fs.statSync(path.join(루트, 난것)); 새로 = s.mtimeMs > 전; KB = Math.round(s.size / 1024); } catch (_) { /* 없음 */ }
    console.log(`${새로 ? '✅' : '🔴'} ${KB}KB · ${분(Date.now() - t0)}분`);
    if (!새로) console.log('       ', String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  }
}

const 시작 = Date.now();
if (깃발.has('지면만')) { 지면그리기(); process.exit(0); }
if (인자['검사']) { 검사(new Date(인자['검사']).getTime()); process.exit(0); }
if (인자['빠진것']) { 빠진것다시(new Date(인자['빠진것']).getTime()); process.exit(0); }
console.log(`■ 명품 재굽기 — 색관리 PBR중립 · 노출 +0.25 · 샘플 ${견본} · ${너비}px · 시작 ${시각()}`);
const 요소만 = 깃발.has('요소만');
const 화면만 = 깃발.has('화면만');
const 덧만 = 깃발.has('덧씌움만');
const 라이브만 = 깃발.has('라이브러리만');
const 전부 = !요소만 && !화면만 && !덧만 && !라이브만;

if (전부 || 요소만) 요소굽기();
if (전부 || 화면만) 화면굽기();
if (전부 || 라이브만) 라이브러리굽기();
/* 검사를 덧씌움 «앞»에 둔다 — 옛 그릇 위에 새 본문을 부으면 두 판이 섞인 그림이 나오고,
 * 그건 나중에 「왜 이 화면만 다른가」로 나타난다(가장 비싼 형태의 사고). */
if (전부 || 요소만 || 화면만) 빠진것다시(시작);
if (전부 || 화면만 || 덧만) 덧씌우기();
if (!덧만) 지면그리기();    // 굽기와 지면은 한 벌 — 안 그리면 아무도 그 굽기를 못 본다
if (!덧만) 검사(시작);      // 다시 구운 뒤에도 남았나 — 마지막 말은 파일이 한다
console.log(`\n■ 전체 끝 — ${분(Date.now() - 시작)}분 · ${시각()}`);

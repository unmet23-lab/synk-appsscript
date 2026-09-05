#!/usr/bin/env node
/**
 * 마린각도굽기 — 들여온 서전트를 «각도 × 색 갈래»로 한 벌 굽고, 판정 지면까지 다시 그린다.
 *
 * 왜 도구가 됐나: 08-27 의 손 배치가 임시 폴더에 살다 사라졌고, 다음 세션이 «어떤 인자로 구웠나»를
 *   처음부터 다시 더듬었다. 이 저장소가 여러 번 밟은 무늬라 레시피를 코드로 못 박는다.
 *   여기 든 함정 셋도 같이 못 박혔다 —
 *     ① 원본 zip 은 **중첩**이다(zip 안에 zip). 안쪽까지 풀어야 STL 이 나온다.
 *     ② 파일 이름에 **역따옴표**가 들어 있다(`stg O`Primey.stl`) — 셸에서 그냥 넘기면 명령이 갈린다.
 *     ③ 서포트 붙은 판과 안 붙은 판이 같이 들었다. 우리가 쓸 것은 **without sp**(서포트 없는 쪽)다.
 *
 * 🔴 굽기와 판정 지면은 **한 벌**이다 — 컷 하나만 다시 구우면 유호님이 보시는 격자에 옛 컷과
 *   새 컷이 섞인다. 그래서 이 도구는 굽고 나서 반드시 `마린시안.js` 를 부른다.
 *
 * 사용법:
 *   node tools/마린각도굽기.js               → 전량 굽고 지면까지
 *   node tools/마린각도굽기.js --지면만       → 이미 구운 것으로 지면만 다시
 *   node tools/마린각도굽기.js --각=0,45      → 각 목록을 좁혀서
 */
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
/* ⚠ 09-05 밤 — 이 도구가 읽던 `docs/캐릭터/마린공방_0827`(블렌더 렌더 42장)을 걷었다.
 *   마린이 제미나이 4K 정본으로 서서(`docs/캐릭터/정본_4K/마린_*.png` 16컷) 그 렌더는
 *   «대체된 옛 판»이 됐다. 유호 확정 09-05 「대체된 최신화된것들이 있으면 예전꺼 다 버려야지」.
 *   ⇒ 지금 이 도구는 «돌지 않는다». 되살리려면 렌더를 다시 뽑거나 정본_4K 를 읽게 고친다.
 *   그림은 git 이력이 쥔다(42장 다 추적돼 있었다). */
const 렌더방 = path.join(루트, 'docs', '캐릭터', '마린공방_0827');
const 곳간 = path.join(os.tmpdir(), 'synk-마린에셋');       // 큰 STL 은 저장소에 안 넣는다(180MB)
const 내려받이 = path.join(os.homedir(), 'Downloads');

const 인자 = Object.fromEntries(process.argv.slice(2)
  .map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v === undefined ? '1' : v]));

/** 후보 모델 — 원본 zip 은 유호님 Cults3D 계정으로 받은 것이고 저장소 밖에 산다. */
const 모델들 = [
  { 이름: 'primey', zip: /^space-sergeant-o-primey.*\.zip$/i, 고르기: /without\s*sp/i },
  { 이름: 'hell', zip: /^space-sergeant-o-hell.*\.zip$/i, 고르기: null },
];

const 파워셸 = (명령) => execFileSync('powershell',
  ['-NoProfile', '-NonInteractive', '-Command', 명령], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/** zip 하나를 폴더로 푼다. PowerShell 을 쓴다 — 노드에는 zip 리더가 없고, 여기 이름엔 역따옴표가 있다. */
function 풀기(zip, 곳) {
  fs.mkdirSync(곳, { recursive: true });
  파워셸(`Expand-Archive -LiteralPath '${zip}' -DestinationPath '${곳}' -Force`);
}

/** 폴더를 훑어 확장자가 맞는 파일 전부. */
function 훑기(뿌리, 끝) {
  const 모음 = [];
  const 걷기 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) 걷기(p);
      else if (e.name.toLowerCase().endsWith(끝)) 모음.push(p);
    }
  };
  if (fs.existsSync(뿌리)) 걷기(뿌리);
  return 모음;
}

/** 모델 하나의 STL 경로 — 곳간에 없으면 원본 zip(중첩)에서 푼다. */
function 에셋길(모델) {
  const 방 = path.join(곳간, 모델.이름);
  let stl들 = 훑기(방, '.stl');
  if (!stl들.length) {
    const zip = fs.readdirSync(내려받이).find((f) => 모델.zip.test(f));
    if (!zip) {
      console.error(`🔴 ${모델.이름}: 원본 zip 을 못 찾았다(${내려받이}) — Cults3D 에서 다시 받는다.`);
      return null;
    }
    console.log(`  ${모델.이름}: 곳간이 비어 원본에서 푼다 — ${zip}`);
    풀기(path.join(내려받이, zip), 방);
    for (const 속 of 훑기(방, '.zip')) 풀기(속, path.dirname(속));   // ① 중첩 zip
    stl들 = 훑기(방, '.stl');
  }
  if (!stl들.length) { console.error(`🔴 ${모델.이름}: STL 이 안 나왔다`); return null; }
  // ③ 서포트 없는 판을 고른다. 없으면 가장 큰 것(조각 쪼갠 판이 아니라 통짜일 확률이 높다).
  const 고른 = (모델.고르기 && stl들.find((p) => 모델.고르기.test(path.basename(p))))
    || stl들.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  return 고른;
}

function 블렌더() {
  if (process.env.BLENDER_EXE) return process.env.BLENDER_EXE;
  for (const b of ['C:/Program Files/Blender Foundation', 'C:/Program Files (x86)/Blender Foundation']) {
    if (!fs.existsSync(b)) continue;
    const 방 = fs.readdirSync(b).sort().reverse().map((d) => path.join(b, d, 'blender.exe'));
    const 있 = 방.find((p) => fs.existsSync(p));
    if (있) return 있;
  }
  console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.');
  process.exit(1);
}

// 색 갈래 — 08-27 실측. 광택 금속은 장난감이 되고, 금속기를 죽인 회색이 「진짜 피규어」로 읽힌다.
const 색갈래 = {
  우리색: ['갑옷=Lapis Deep', '갑옷배율=0.62', '쇠금속=0.18', '쇠거칠=0.52'],
  프라이머: ['갑옷=Stone', '갑옷배율=0.92', '쇠금속=0', '쇠거칠=0.76'],
};

// 거리·눈높이를 못 박는다 — 자동틀에 맡기면 각마다 거리가 미세하게 달라져 격자에서 배율이 흔들린다.
const 틀 = ['거리=8.7', '눈높이=0.32'];

// 「미니어처 비례」 세기 — 유호 08-27 「둘 다 미니어처 버전으로」. 0.70 은 내 픽이고 판정은 지면에서.
const 세기 = 인자['세기'] || '0.70';
const 미니 = ['비례=미니어처', `앙증=${세기}`, '머리배=2.35'];   // 머리 풍선 — 유호 08-27 「얼굴 크게 · 귀엽게」

function 굽기(BL, 파일, 이름, 각, 색, 더 = []) {
  const 낼곳 = path.join(렌더방, `${이름}.png`);
  const 전 = fs.existsSync(낼곳) ? fs.statSync(낼곳).mtimeMs : 0;
  const t0 = Date.now();
  const r = spawnSync(BL, ['--background', '--python', path.join(루트, 'tools', '마린에셋들이기.py'), '--',
    `파일=${파일}`, `출력=${낼곳}`, '형태=오브', '샘플=96', '너비=900',
    ...틀, ...(각 ? [`돌리기=z${각}`] : []), ...색갈래[색], ...더],
  { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // 🔴 판정은 «파일 시각»으로 한다 — 종료코드도 로그 끝줄도 죽은 굽기를 성공으로 읽는다(이 저장소 실측).
  const 났나 = fs.existsSync(낼곳) && fs.statSync(낼곳).mtimeMs > 전;
  console.log(`  ${이름.padEnd(26)} ${났나 ? '✅' : '🔴'} ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  if (!났나) console.log('     ', String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
  return 났나;
}

function main() {
  fs.mkdirSync(렌더방, { recursive: true });
  let 난것 = 0; let 죽은것 = 0;

  if (!인자['지면만']) {
    const BL = 블렌더();
    const 각들 = (인자['각'] || '0,45,90,135,180,225,270,315').split(',').map((s) => s.trim()).filter(Boolean);
    const 길 = Object.fromEntries(모델들.map((m) => [m.이름, 에셋길(m)]));
    if (!길.primey) process.exit(1);
    console.log(`■ 마린 각도 굽기 — 각 ${각들.length}개 · ${new Date().toLocaleTimeString('ko-KR')}`);

    for (const z of 각들) {
      (굽기(BL, 길.primey, `primey_우리색_z${String(z).padStart(3, '0')}`, z, '우리색') ? 난것++ : 죽은것++);
    }
    for (const z of 각들.filter((z) => ['0', '45', '90', '315'].includes(z))) {
      (굽기(BL, 길.primey, `primey_프라이머_z${String(z).padStart(3, '0')}`, z, '프라이머') ? 난것++ : 죽은것++);
    }
    (굽기(BL, 길.primey, 'primey_우리색_얼굴', '25', '우리색',
      ['구도=얼굴', '거리=자동', '눈높이=자동']) ? 난것++ : 죽은것++);
    if (길.hell) (굽기(BL, 길.hell, 'hell_우리색_z045', '45', '우리색') ? 난것++ : 죽은것++);

    // ── 미니어처 비례 — 둘 다 (유호 08-27 「둘 다 미니어처 버전으로 만들어줄수있어?」) ──
    console.log(`■ 미니어처 비례 — 세기 ${세기}`);
    for (const [태그, 길이] of [['primey', 길.primey], ['hell', 길.hell]]) {
      if (!길이) continue;
      for (const z of 각들) {
        (굽기(BL, 길이, `${태그}_미니_우리색_z${String(z).padStart(3, '0')}`, z, '우리색', 미니)
          ? 난것++ : 죽은것++);
      }
      (굽기(BL, 길이, `${태그}_미니_프라이머_z000`, '0', '프라이머', 미니) ? 난것++ : 죽은것++);
    }
    // ── 정면판 (유호 08-27 「아예 정면을 보고있는 버전으로」) ──
    //   자세가 몸에 구워져 있어 «정면 각»은 몸마다 다르다 — 잘게 돌린 스윕을 눈으로 갈라 확정했다:
    //   오프라이미 z30(가리키는 자세가 몸을 틀고 있다) · 오헬 z0(총을 가로로 들고 가슴이 정면).
    //   x-8 = 몸을 8° 뒤로 젖힌다 — 고개 숙인 포즈의 얼굴을 카메라로 들어 올리는 손잡이.
    //   (카메라를 낮추는 것으로는 안 됐다: 거리 8.7 에서 원근이 약해 시선이 안 바뀐다 · 08-27 실측.
    //    14° 이상은 뒤로 넘어지는 사람이 된다.)
    (굽기(BL, 길.primey, 'primey_미니_정면', '', '우리색', [...미니, '돌리기=z30,x-8']) ? 난것++ : 죽은것++);
    if (길.hell) (굽기(BL, 길.hell, 'hell_미니_정면', '', '우리색', [...미니, '돌리기=x-8']) ? 난것++ : 죽은것++);

    // ── 해석판 — 몽글·까몽 «재질»로 다시 읽은 판 (유호 08-27 · 조잡·싸구려 금지가 판정 1축) ──
    //   펠트 = 결(약하게)+속살(얕게)+시인. 눈 = 바이저를 기하로 갈라 따로 — 얼굴·위엄의 자리.
    //   실측 확정값들이라 손대면 1~7차 실패를 다시 밟는다(마린에셋들이기.py 주석이 그 장부다).
    (굽기(BL, 길.primey, 'primey_해석_몽글', '', '우리색', [...미니, '돌리기=z30,x-8', '재질=펠트',
      '갑옷=Coral', '갑옷배율=0.92', '눈색=Butter', '눈발광=1.6', '눈띠=0.828,0.868', '눈폭=0.62',
      '장식=받침,배지,가슴땀,연필가방,허리책,총연필', '받침대색=Oat', '가방=1',
      '부속삭제=-0.50,-0.10,-0.60,-0.33,0.70,1.03;0.02,0.20,-0.55,-0.28,0.55,0.95', '허리책상자=-0.45,-0.10,0.80,1.06'])
      ? 난것++ : 죽은것++);
    // 까몽 얼굴의 코랄 발광은 유호 반려(08-27 「별로같아」) — 눈 분할을 끈다(조형 그늘만 남는다).
    (굽기(BL, 길.primey, 'primey_해석_까몽', '', '우리색', [...미니, '돌리기=z30,x-8', '재질=펠트',
      '갑옷=Ink', '갑옷배율=1.0', '눈=0',
      '빛배=1.35', '받침=Oat', '장식=받침,배지,가슴땀,연필가방,허리책,총연필', '받침대색=Ink Deep', '가방=1',
      '부속삭제=-0.50,-0.10,-0.60,-0.33,0.70,1.03;0.02,0.20,-0.55,-0.28,0.55,0.95', '허리책상자=-0.45,-0.10,0.80,1.06'])
      ? 난것++ : 죽은것++);
    // 뒷태 컷은 유호 폐지(08-28 「뒷모습 쓸 일 없다」) — 가방은 앞에서 읽힌다(끈·연필 깃발).

    // ── 우주복판 — «갑옷을 전부 벗기고 우주복» (유호 08-27) ──
    //   갑옷은 녹이지도 베지도 않는다(12판 실측: 녹이면 마시멜로 · 베면 파편) — 헬멧 «통짜 조각»만
    //   남기고 몸은 베개몸·펠트·실땀으로 짓는다. 눈은 칠 대신 «속빛»(헬멧 속 발광 구 · 번짐 0).
    //   돌리기 z18 = 고개만 살짝 돌린 생기 · 몸은 조립이라 늘 정면 · 뒷태는 몸돌리기가 돈다.
    //   z50 = 정면 실측각(z 스윕 눈 판정 08-28 — 30·32·36·38 전부 곁눈이었다) · 볏·방패 =
    //   스파르타 선생님(가로 볏 = 켄투리온 지휘관 표식) · 버터 목 링·네모 이마 코인은 유호 반려
    //   (→ 슈트색 깃 · 버터 털 방울) · 가방은 «앞»에서 읽힌다(어깨끈 + 헬멧 옆 연필 깃발 둘).
    //   볏(그래프 무늬)·솜털 방울은 유호 반려 08-28 「짜치는 느낌」 — 투구 홀더 조각까지 걷는다.
    const 우주복공통 = [...미니, '돌리기=z50,x-8', '재질=펠트', '우주복=1', '머리들기=-8', '눈=0',
      '방패=1', '이마=1', '장식=받침,배지', '가방=0'];
    (굽기(BL, 길.primey, 'primey_해석_우주복몽글', '', '우리색', [...우주복공통,
      '갑옷=Coral', '갑옷배율=0.92', '속빛=4', '받침대색=Oat']) ? 난것++ : 죽은것++);
    // 까몽 = 명품화판(유호 08-28 「흰 배경 하나만 · 감각적·트렌디」) — 모노 팔레트(검은 연필·방패 ·
    //   색은 코랄 점만) + 퀼팅(무릎 패치·솔기). 눈빛·볼터치·받침 배지는 유호 반려 2패스에서 걷었다
    //   (「노란 부분·빨간 네모 없애줘 · 신발 옆 스위치 없애줘」) — 얼굴의 단호함은 «민얼굴의 어둠»이 진다.
    //   색 배치 = «실 배점판»(유호 위임 픽 08-28 「니가 잘 골라줘 · 까몽은 검정느낌, 몽글과 달라야」):
    //   검정 정체는 지키고 킷 실만 짜 넣는다 — 무릎 Lapis · 방패 Lapis Deep · 단추 = 앱 의미 색
    //   (신호 Coral·보상 Butter·정답 Meadow). 코랄 슈트판은 몽글의 영역이라 기각.
    //   눈알 = 유호 레퍼런스 픽 08-29 「내가 원한 건 이런 느낌 · 이렇게 교체」 — 칠(눈판)이 아니라
    //   «기하»: 라피스 렌즈 홍채 + 잉크딥 동공 + 종이 하이라이트 구슬 둘(봉제 인형 눈 문법 · STL 동행).
    //   값 다섯은 렌더 5회전 실측(구는 브라우 앞으로 튄다 → 납작 0.5 렌즈).
    (굽기(BL, 길.primey, 'primey_해석_우주복까몽', '', '우리색', [...우주복공통,
      '갑옷=Ink', '갑옷배율=1.0', '장갑색=Ink', '속빛=0', '퀼팅=1', '무릎색=Lapis',
      '눈알=1', '눈알반=0.19', '눈알묻기=0.10', '눈알높이=0.47', '눈알간격=0.19', '눈알동공=0.38', '눈알납작=0.5',
      '연필몸색=Ink Deep', '방패색=Lapis Deep', '단추색들=Coral,Butter,Meadow', '결규모=260', '결세기=0.30',
      '빛배=1.35', '받침=Oat', '장식=받침', '받침대색=Ink Deep']) ? 난것++ : 죽은것++);


    // 세기는 눈으로만 갈린다 — 같은 각·같은 색으로 세 갈래를 나란히 세운다.
    for (const s of ['0.45', '0.70', '1.00']) {
      (굽기(BL, 길.primey, `primey_미니_세기_${s.replace('.', '')}`, '0', '프라이머',
        ['비례=미니어처', `앙증=${s}`]) ? 난것++ : 죽은것++);
    }
    console.log(`  ── 난 것 ${난것} · 죽은 것 ${죽은것}`);
  }

  console.log('■ 판정 지면 다시 그리기');
  const r = spawnSync(process.execPath, [path.join(루트, 'tools', '마린시안.js')],
    { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: 'inherit' });
  if (r.status !== 0) { console.error('🔴 지면이 안 그려졌다 — 굽기만 되고 아무도 못 본다'); process.exit(1); }
  if (죽은것) process.exit(1);
}

if (require.main === module) main();

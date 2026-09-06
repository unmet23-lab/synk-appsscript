#!/usr/bin/env node
/* Loom 굽는 층의 **통로** — 유리·레진 부품을 Blender Cycles 로 «찍는다».
 *
 * 왜 통로가 하나여야 하나:
 *   헌법 ①은 「결은 사진 픽셀에서만」인데 v1.0 은 **펠트만 지켰다** — 유리·레진은
 *   `linear-gradient`+`backdrop-filter`, 즉 5~6년 전 글래스모피즘이었다(F498 · 유호 「너무 싸구려 AI처럼」).
 *   처방이 「Blender 로 굽는다」였는데 그 스크립트가 스크래치패드에 있으면 **repo 밖**이라,
 *   다음 세션은 다시 CSS 로 짓는다. 그래서 전파보다 승격이 먼저다.
 *
 * 사용:
 *   node tools/룸굽기.js --분모                       무엇이 구워졌고 무엇이 안 구워졌나
 *   node tools/룸굽기.js --자산                       HDRI 환경맵 받기(CC0 · 유호 승인 08-16)
 *   node tools/룸굽기.js --굽기 레진구                 한 부품
 *   node tools/룸굽기.js --전량                       분모 전량(안 구워진 것만)
 *   node tools/룸굽기.js --전량 --다시                 이미 있어도 다시
 *   node tools/룸굽기.js --대조 hdri                  A/B 대조판(조건 **하나만** 바뀐다 · F045)
 *
 * 낱말: 「부품」 = 지면에 놓이는 물건 하나. 「판」 = 그 부품을 한 번 구운 결과 PNG.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const https = require('https');

const 루트 = path.resolve(__dirname, '..');
const 자산 = path.join(루트, 'docs', 'Loom_자산');
const HDRI폴더 = path.join(자산, 'hdri');
const 구움 = path.join(자산, '구움');
const 장면 = path.join(__dirname, '룸장면.py');

/* Blender 는 PATH 에 없다(설치 폴더 그대로 쓴다). 후보를 열거해 **있는 것**을 쓴다 —
 * 「없으면 조용히 CSS 로 돌아간다」가 F498 을 만든 통로라, 없으면 여기서 멈춘다. */
function 블렌더() {
  if (process.env.BLENDER_EXE && fs.existsSync(process.env.BLENDER_EXE)) return process.env.BLENDER_EXE;
  const 뿌리 = ['C:/Program Files/Blender Foundation', 'C:/Program Files (x86)/Blender Foundation'];
  const 후보 = [];
  for (const b of 뿌리) {
    if (!fs.existsSync(b)) continue;
    for (const d of fs.readdirSync(b)) {
      const p = path.join(b, d, 'blender.exe');
      if (fs.existsSync(p)) 후보.push(p);
    }
  }
  후보.sort().reverse();                       // 최신 판을 먼저
  if (!후보.length) {
    console.error('🔴 blender.exe 를 못 찾았다. 설치했으면 BLENDER_EXE 로 경로를 준다.');
    console.error('   🚫 대신 CSS 로 흉내내지 않는다 — 그 우회가 F498 이다.');
    process.exit(3);
  }
  return 후보[0];
}

/* ── 분모 ──────────────────────────────────────────────────────────────
 * 🔑 **분모를 이름째 센다**(loom.js `--분모` 와 같은 원리). 「몇 개 구웠다」만 세면
 *    안 구운 것이 이름 없이 사라져서, 다음 세션이 그 자리를 또 CSS 로 채운다. */
/* 🔑 **쓰는 크기가 굽는 값을 정한다.** 35px 로 놓일 원판을 1400px·420샘플로 굽는 것은
 *    낭비가 아니라 «오진»이다 — 그 시간을 히어로에 줘야 한다. 두 층(몸+접지)도 마찬가지로
 *    접지가 실제로 보이는 부품에만 건다(7px 불릿의 접지 그림자는 아무도 못 본다). */
const 부품표 = [
  { 이름: '레진구',   부품: '레진구', 봉입: '파편', 두층: true, 해상도: 1000, 샘플: 380,
    쓰임: '히어로 숫자·핵심 표식 (지면당 1점)' },
  { 이름: '레진구_글자', 부품: '레진구', 봉입: '글자', 글자: 'ㅅ', 두층: true, 해상도: 1100, 샘플: 420,
    쓰임: '브랜드 히어로 — 갇힌 자모 (표지 전용)' },
  { 이름: '레진구_무채', 부품: '레진구', 봉입: '없음', 갇힌빛: '무채', 해상도: 620, 샘플: 260,
    쓰임: '불릿·체크 (헌법: 반복 부품의 갇힌 빛은 무채)' },
  { 이름: '유리구',   부품: '유리구', 봉입: '없음', 해상도: 620, 샘플: 260, 쓰임: '표식 구슬·링크점' },
  { 이름: '원판',     부품: '원판',   봉입: '없음', 해상도: 760, 샘플: 300, 쓰임: '번호 원판(절번호·순번·차례)' },
  { 이름: '판',       부품: '판',     봉입: '없음', 해상도: 760, 샘플: 300, 쓰임: '유리 카드 테두리(9분할 border-image)' },
  { 이름: '칩',       부품: '칩',     봉입: '없음', 해상도: 760, 샘플: 300, 쓰임: '태그·칩·라벨' },
  /* 🪦 **「합주」(표지·히어로 장면)는 2026-09-07 에 이 표에서 걷혔다.** 유리·레진·펠트 세 구를
     한 무대에 세우던 줄인데, 09-03 확정 「유리·레진 구슬은 나간다」가 부품에는 닿고 이 장면에는
     안 닿아 표지에만 구슬이 남아 있었다. 09-07 에 펠트 구슬 셋으로 다시 굽고 굽는 통로도
     제미나이로 고정했다 — 세우는 함수(`룸장면.py` 합주세우기)도 같이 걷었다. */
  /* hdri세기 0.32 — 명품 렌더 4계 ②③(가장 밝은 것은 스침 키 하나 · 어둠을 두려워 않기). */
  { 이름: '로고꺾쇠', 부품: '로고꺾쇠', 봉입: '없음', 펠트색: 'Coral', 두층: true, 해상도: 1100, 샘플: 420,
    hdri세기: 0.32, 쓰임: '로고 확정 08-21 — B2 워드마크의 신호 꺾쇠(펠트 실물·잔털)' },
  { 이름: '로고배지', 부품: '로고배지', 봉입: '없음', 두층: true, 해상도: 1200, 샘플: 440,
    hdri세기: 0.32, 쓰임: '로고 확정 08-21 — 앱 아이콘 몽글 배지(꺾쇠=입 옆모습·잔털)' },
  /* ⚠실험 행 — 확정 아님(유호 지시 08-21 «>< 찡긋»). 변주 = --변주 버터·라피스·팝. */
  { 이름: '로고쌍꺾쇠', 부품: '로고쌍꺾쇠', 봉입: '없음', 변주: '버터', 두층: true, 해상도: 1200, 샘플: 440,
    hdri세기: 0.32, 쓰임: '실험 08-21 — «>< 찡긋» 배지(얼굴 0 · 꺾쇠 둘이 감은 눈)' },
  { 이름: '로고고리', 부품: '로고고리', 봉입: '없음', 두층: true, 해상도: 1100, 샘플: 420,
    hdri세기: 0.32, 쓰임: '로고 확정 08-21 — 심볼·도장·워터마크 고리(양모 실 두 가닥이 꿴다)' },
  /* 플레이팅 판 — «완성 사진»이라 한 장으로 굽는다(두층은 지면에 얹을 부품의 문법이다). */
  { 이름: '로고찡긋플레이팅', 부품: '로고찡긋플레이팅', 봉입: '없음', 해상도: 1400, 샘플: 480,
    /* hdri세기 0.20 — 5판: 0.28 은 환경광이 접촉 그림자를 씻어 «닿음»이 약했다.
       어둠을 두려워하지 않는다(4계 ③) — 그림자가 깊어야 물건이 접시에 앉는다. */
    hdri세기: 0.20, 쓰임: '실험 08-21 — «>< 찡긋» 요리 사진(접시 위 세 알)' },
];

/* HDRI — Poly Haven CC0(저작자표시 불필요·상업 이용 가능). 출처·판·해시를 장부에 남긴다:
 * 나중에 「이 반사는 어디서 왔나」를 물으면 답할 수 있어야 한다. */
const HDRI표 = [
  {
    이름: 'monochrome_studio_02',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/monochrome_studio_02_1k.hdr',
    쓰임: '기본값 — 무채(monochrome) 스튜디오·어두운 천장. 킷 철칙 ④(신호 1점)를 안 건드린다',
  },
  {
    이름: 'ferndale_studio_02',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/ferndale_studio_02_1k.hdr',
    쓰임: '고대비 대조군 — ②감광(검은 띠)이 더 센 판. 대조에만 쓴다',
  },
];
const 기본HDRI = () => path.join(HDRI폴더, HDRI표[0].이름 + '_1k.hdr');

function 받기(url, 저장) {
  return new Promise((resolve, reject) => {
    const 가자 = (u, 남은) => {
      if (남은 < 0) return reject(new Error('리다이렉트 과다'));
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return 가자(res.headers.location, 남은 - 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const 임시 = 저장 + '.받는중';
        const w = fs.createWriteStream(임시);
        res.pipe(w);
        w.on('finish', () => { w.close(() => { fs.renameSync(임시, 저장); resolve(); }); });
        w.on('error', reject);
      }).on('error', reject);
    };
    가자(url, 5);
  });
}

async function 자산받기() {
  fs.mkdirSync(HDRI폴더, { recursive: true });
  for (const h of HDRI표) {
    const 저장 = path.join(HDRI폴더, h.이름 + '_1k.hdr');
    if (fs.existsSync(저장)) { console.log('· 이미 있다 —', path.basename(저장)); continue; }
    process.stdout.write('· 받는 중 ' + h.이름 + ' … ');
    await 받기(h.url, 저장);
    console.log((fs.statSync(저장).size / 1048576).toFixed(2) + 'MB');
  }
  const 장부 = HDRI표.map((h) => {
    const p = path.join(HDRI폴더, h.이름 + '_1k.hdr');
    return {
      이름: h.이름, 판: '1k hdr', 출처: 'Poly Haven', 저작권: 'CC0',
      url: h.url, 쓰임: h.쓰임,
      바이트: fs.existsSync(p) ? fs.statSync(p).size : 0,
    };
  });
  fs.writeFileSync(path.join(HDRI폴더, '출처.json'),
    JSON.stringify({ 받은날: '2026-08-16', 승인: '유호 08-16 「전부다 승인할게」', 자산: 장부 }, null, 2) + '\n');
  console.log('\n✅ HDRI ' + 장부.length + '벌 · 출처·저작권 장부 = docs/Loom_자산/hdri/출처.json');
}

/* ── 굽기 ─────────────────────────────────────────────────────────── */
function 굽기(칸, 옵션 = {}) {
  const 출력 = 옵션.출력 || 구움;
  const 이름 = 옵션.이름 || 칸.이름;
  fs.mkdirSync(출력, { recursive: true });
  const args = [
    '-b', '-P', 장면, '--',
    '--부품', 칸.부품, '--출력', 출력, '--이름', 이름,
    '--해상도', String(옵션.해상도 || 칸.해상도 || 900),
    '--샘플', String(옵션.샘플 || 칸.샘플 || 320),
    '--봉입', 칸.봉입 || '없음',
    '--단계', 옵션.단계 || '결',
  ];
  if (칸.글자) args.push('--글자', 칸.글자, '--폰트',
    path.join(루트, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Heavy.otf'));
  if (칸.갇힌빛) args.push('--갇힌빛', 칸.갇힌빛);
  if (칸.펠트색) args.push('--펠트색', 칸.펠트색);
  const 변주 = 옵션.변주 || 칸.변주;
  if (변주) args.push('--변주', 변주);
  const 당김 = 옵션.당김 || 칸.당김;
  if (당김) args.push('--당김', String(당김));
  const 눈높이 = 옵션.눈높이 || 칸.눈높이;
  if (눈높이) args.push('--눈높이', String(눈높이));
  if (옵션.진행 !== undefined) args.push('--진행', String(옵션.진행));
  if (옵션.시퀀스) args.push('--시퀀스', String(옵션.시퀀스));
  // HDRI 는 «켬/끔»이 대조 눈금이라 옵션으로 뺀다(기본 = 켬). 이름만 줘도 받는다.
  let hdri = 옵션.hdri === false ? null : (옵션.hdri || 기본HDRI());
  if (hdri && !path.isAbsolute(hdri)) hdri = path.join(HDRI폴더, hdri + '_1k.hdr');
  /* 🔑 **세기 0.55 는 실측이 정한 값이다**(대조판 `docs/Loom_자산/대조/hdri`).
   *    0.9 는 접지 그림자를 씻어 알파가 58.7%→37.0% 로 무너졌고(그림자가 지면에서 사라진다),
   *    0.35 는 하이라이트 구조를 거의 안 늘렸다. 0.55 가 «채우되 안 씻는» 자리다. */
  if (hdri && fs.existsSync(hdri)) args.push('--hdri', hdri, '--hdri세기', String(옵션.hdri세기 || 칸.hdri세기 || 0.55));
  if (옵션.안개) args.push('--안개');
  if (옵션.그림자층 && 칸.두층) args.push('--그림자층');

  const 잰다 = Date.now();
  const 출 = execFileSync(블렌더(), args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const 초 = ((Date.now() - 잰다) / 1000).toFixed(1);
  for (const 줄 of 출.split(/\r?\n/)) if (/^\[loom\]/.test(줄)) console.log('   ' + 줄);
  console.log('   ⏱ ' + 초 + '초');

  /* 🔴 **회귀 장치 — 실사고 08-16.** `blender -b -P` 는 스크립트가 예외로 죽어도 **exit 0** 이다.
   *    각진 부품 셋(원판·판·칩)이 `AttributeError` 로 통째로 안 구워졌는데 이 통로는
   *    「▶ 원판 … ⏱ 1.8초」를 찍고 다음으로 넘어갔다 — «맞는 얼굴로 틀린 값»의 교과서다.
   *    시간으로 재지 않는다(빠른 판이 정상일 수도 있다). **판이 디스크에 있는지**로 잰다.
   *    ⚠exit code 도 stderr 도 근거가 못 된다 — Blender 는 둘 다 정상으로 낸다. */
  if (옵션.시퀀스) {                       // 시퀀스는 판이 여럿이라 아래 «한 판» 회귀검사가 안 맞는다
    const 첫판 = path.join(출력, 이름 + '_000.png');
    if (!fs.existsSync(첫판)) { console.error('🔴 시퀀스 첫 판이 없다:', 첫판); process.exit(4); }
    return;
  }
  const 나올것 = (옵션.그림자층 && 칸.두층) ? [이름 + '_몸', 이름 + '_접지'] : [이름];
  const 없는판 = 나올것.filter((n) => !fs.existsSync(path.join(출력, n + '.png')));
  if (없는판.length) {
    const 예외 = 출.split(/\r?\n/).filter((l) => /Error|Traceback|^\s+File "/.test(l)).slice(-4);
    console.error('   🔴 **안 구워졌다** — 없는 판: ' + 없는판.join(', '));
    if (예외.length) console.error('      ' + 예외.join('\n      '));
    throw new Error('굽기 실패: ' + 이름 + ' (Blender 는 exit 0 으로 나왔다)');
  }
  return 출;
}

/** 이 부품이 내야 할 판 중 **없는 것**. 두 층 부품은 둘 다 있어야 «있다»다. */
function 없는판(칸, 출력 = 구움) {
  const 나올것 = 칸.두층 ? [칸.이름 + '_몸', 칸.이름 + '_접지'] : [칸.이름];
  return 나올것.filter((n) => !fs.existsSync(path.join(출력, n + '.png')));
}

function 분모() {
  const 있나 = (k) => !없는판(k).length;
  const 구운것 = 부품표.filter((k) => 있나(k));
  console.log('■ Loom 굽는 층 분모 — ' + 구운것.length + '/' + 부품표.length + ' 부품');
  console.log('  (합계 = 구움 ' + 구운것.length + ' + 안 구움 ' + (부품표.length - 구운것.length) + ')\n');
  for (const k of 부품표) console.log('  ' + (있나(k) ? '✅' : '⬜') + ' ' + k.이름.padEnd(12) + ' ' + k.쓰임
    + (있나(k) ? '' : '   (없는 판: ' + 없는판(k).join(', ') + ')'));
  const h = fs.existsSync(기본HDRI());
  console.log('\n  ' + (h ? '✅' : '⬜') + ' HDRI 환경맵' + (h ? '' : '  → node tools/룸굽기.js --자산'));
  if (구운것.length < 부품표.length) console.log('\n▶ 안 구운 것 굽기: node tools/룸굽기.js --전량');
  return 구운것.length;
}

/* ── 대조 ─────────────────────────────────────────────────────────────
 * ⚠**조건을 하나만 바꾼다**(F045·F503). 3차에서 조명과 감광판을 «동시에» 갈아엎어
 *   원인을 잃은 적이 있다. 이 표의 각 항목은 정확히 한 눈금만 다르다. */
const 대조표 = {
  /* 🔴 대상을 **레진으로 잡았던 것이 첫 오진**이다(F183: 한 갈래만 재면 전체를 오단정한다).
   *    레진은 빛을 «가두는» 재질이라 환경이 속까지 못 들어간다 — 실측 국소대비 -2.3%.
   *    환경이 사는 자리는 빛을 «통과시키는» 유리다. 자를 옮기기 전에 **대상**을 옮겨야 했다. */
  hdri:  { 칸: '유리구', 판: [['무HDRI', { hdri: false }], ['mono0.9', { hdri세기: 0.9 }],
                            ['ferndale0.9', { hdri: 'ferndale_studio_02', hdri세기: 0.9 }]] },
  hdri레진: { 칸: '레진구', 판: [['무HDRI', { hdri: false }], ['mono0.35', {}],
                            ['mono0.9', { hdri세기: 0.9 }],
                            ['ferndale0.9', { hdri: 'ferndale_studio_02', hdri세기: 0.9 }]] },
  안개:  { 칸: '레진구', 판: [['무안개', {}], ['안개', { 안개: true }]] },
  봉입:  { 칸: '레진구', 판: [['파편', {}], ['글자', { 칸이름: '레진구_글자' }]] },
  모따기: { 칸: '원판',   판: [['모따기', {}]] },
};

function 대조(축) {
  const 표 = 대조표[축];
  if (!표) { console.error('🔴 모르는 대조 축:', 축, '· 있는 것 =', Object.keys(대조표).join(', ')); process.exit(2); }
  const 출력 = path.join(자산, '대조', 축);
  fs.mkdirSync(출력, { recursive: true });
  for (const [라벨, opt] of 표.판) {
    const 칸 = 부품표.find((k) => k.이름 === (opt.칸이름 || 표.칸));
    console.log('▶ ' + 축 + ' / ' + 라벨);
    굽기(칸, Object.assign({ 출력, 이름: 라벨, 해상도: 900, 샘플: 300 }, opt));
  }
  console.log('\n✅ 대조판 = ' + path.relative(루트, 출력) + ' — **한 눈금만** 다르다');
}

/* ── 진입 ─────────────────────────────────────────────────────────── */
async function main() {
  const a = process.argv.slice(2);
  const 집 = (f) => { const i = a.indexOf(f); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : null; };

  if (a.includes('--자산')) return 자산받기();
  if (a.includes('--분모') || !a.length) { 분모(); return; }
  if (a.includes('--대조')) return 대조(집('--대조') || 'hdri');

  const 옵션 = {
    해상도: Number(집('--해상도') || 1100),
    샘플: Number(집('--샘플') || 380),
    안개: a.includes('--안개'),
    그림자층: !a.includes('--한장'),   // 기본이 두 장이다 — 지면 배경마다 다시 굽지 않기 위해
    변주: 집('--변주') || undefined,   // 실험 부품의 색 갈래(행 기본값을 덮는다)
    당김: 집('--당김') || undefined,   // 플레이팅 카메라 당김(1.0 전체 · 0.6 클로즈업)
    눈높이: 집('--눈높이') || undefined, // 카메라 고도(1.0 = 32.4° · 0.82 = 눕힌 27.5°)
    진행: 집('--진행') || undefined,   // 모션 한 컷의 시각(0.0~1.0 · 1.0 = 확정 정지 화면)
    시퀀스: 집('--시퀀스') || undefined, // n 장을 한 실행으로 (프레임마다 블렌더를 새로 띄우지 않는다)
    이름: 집('--이름') || undefined,   // 변주 판을 딴 이름으로 굽는다(기본 = 행 이름)
  };
  if (!fs.existsSync(기본HDRI())) {
    console.log('⚠ HDRI 가 없다 — 그라디언트 무대로 굽는다(반사에 «세상»이 안 맺힌다).');
    console.log('  받기: node tools/룸굽기.js --자산\n');
  }

  let 대상 = [];
  if (옵션.이름 && a.includes('--전량')) { console.error('🔴 --이름 은 --전량 과 못 쓴다 — 전 부품이 같은 파일명 하나에 덮어써진다. 부품을 하나만 짚거나 --이름 을 뺀다.'); process.exit(2); }
  if (a.includes('--전량')) {
    const 다시 = a.includes('--다시');
    /* ⚠**판을 전부** 확인한다. `_몸` 하나만 보던 판에서 `_접지` 가 빠진 부품이 «있다»로 세어져
     *   건너뛰었다(실측 08-16 · 레진구_글자). 두 층 부품의 절반만 있는 상태는 «있음»이 아니다. */
    대상 = 부품표.filter((k) => 다시 || 없는판(k).length);
  } else if (a.includes('--굽기')) {
    const n = 집('--굽기');
    const k = 부품표.find((x) => x.이름 === n);
    if (!k) { console.error('🔴 모르는 부품:', n, '· 있는 것 =', 부품표.map((x) => x.이름).join(', ')); process.exit(2); }
    대상 = [k];
  } else { 분모(); return; }

  if (!대상.length) { console.log('· 구울 것이 없다(전부 있다). 다시 구우려면 --다시'); return; }
  for (const k of 대상) { console.log('▶ ' + k.이름 + ' — ' + k.쓰임); 굽기(k, 옵션); }
  console.log('');
  분모();
}

if (require.main === module) main().catch((e) => { console.error('🔴', e.message); process.exit(1); });
module.exports = { 부품표, HDRI표, 분모 };

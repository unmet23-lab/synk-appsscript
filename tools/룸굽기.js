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
const 부품표 = [
  { 이름: '레진구',   부품: '레진구', 봉입: '파편', 쓰임: '히어로 숫자·핵심 표식 (지면당 1점)' },
  { 이름: '레진구_글자', 부품: '레진구', 봉입: '글자', 글자: 'ㅅ', 쓰임: '브랜드 히어로 — 갇힌 자모' },
  { 이름: '유리구',   부품: '유리구', 봉입: '없음', 쓰임: '불릿·표식 구슬' },
  { 이름: '원판',     부품: '원판',   봉입: '없음', 쓰임: '번호 원판(절번호·순번·차례)' },
  { 이름: '판',       부품: '판',     봉입: '없음', 쓰임: '유리 카드 테두리(9분할 border-image)' },
  { 이름: '칩',       부품: '칩',     봉입: '없음', 쓰임: '태그·칩·라벨' },
  { 이름: '합주',     부품: '합주',   봉입: '파편', 쓰임: '표지·히어로 장면(재질 셋이 서로를 안다)' },
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
    '--해상도', String(옵션.해상도 || 1100),
    '--샘플', String(옵션.샘플 || 380),
    '--봉입', 칸.봉입 || '없음',
    '--단계', 옵션.단계 || '결',
  ];
  if (칸.글자) args.push('--글자', 칸.글자, '--폰트',
    path.join(루트, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Heavy.otf'));
  // HDRI 는 «켬/끔»이 대조 눈금이라 옵션으로 뺀다(기본 = 켬). 이름만 줘도 받는다.
  let hdri = 옵션.hdri === false ? null : (옵션.hdri || 기본HDRI());
  if (hdri && !path.isAbsolute(hdri)) hdri = path.join(HDRI폴더, hdri + '_1k.hdr');
  if (hdri && fs.existsSync(hdri)) args.push('--hdri', hdri, '--hdri세기', String(옵션.hdri세기 || 0.35));
  if (옵션.안개) args.push('--안개');
  if (옵션.그림자층) args.push('--그림자층');

  const 잰다 = Date.now();
  const 출 = execFileSync(블렌더(), args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const 초 = ((Date.now() - 잰다) / 1000).toFixed(1);
  for (const 줄 of 출.split(/\r?\n/)) if (/^\[loom\]/.test(줄)) console.log('   ' + 줄);
  console.log('   ⏱ ' + 초 + '초');
  return 출;
}

function 분모() {
  const 있나 = (n) => fs.existsSync(path.join(구움, n + '.png')) ||
                      fs.existsSync(path.join(구움, n + '_몸.png'));
  const 구운것 = 부품표.filter((k) => 있나(k.이름));
  console.log('■ Loom 굽는 층 분모 — ' + 구운것.length + '/' + 부품표.length + ' 부품');
  console.log('  (합계 = 구움 ' + 구운것.length + ' + 안 구움 ' + (부품표.length - 구운것.length) + ')\n');
  for (const k of 부품표) console.log('  ' + (있나(k.이름) ? '✅' : '⬜') + ' ' + k.이름.padEnd(12) + ' ' + k.쓰임);
  const h = fs.existsSync(기본HDRI());
  console.log('\n  ' + (h ? '✅' : '⬜') + ' HDRI 환경맵' + (h ? '' : '  → node tools/룸굽기.js --자산'));
  if (구운것.length < 부품표.length) console.log('\n▶ 안 구운 것 굽기: node tools/룸굽기.js --전량');
  return 구운것.length;
}

/* ── 대조 ─────────────────────────────────────────────────────────────
 * ⚠**조건을 하나만 바꾼다**(F045·F503). 3차에서 조명과 감광판을 «동시에» 갈아엎어
 *   원인을 잃은 적이 있다. 이 표의 각 항목은 정확히 한 눈금만 다르다. */
const 대조표 = {
  hdri:  { 칸: '레진구', 판: [['무HDRI', { hdri: false }], ['mono0.35', {}],
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
  };
  if (!fs.existsSync(기본HDRI())) {
    console.log('⚠ HDRI 가 없다 — 그라디언트 무대로 굽는다(반사에 «세상»이 안 맺힌다).');
    console.log('  받기: node tools/룸굽기.js --자산\n');
  }

  let 대상 = [];
  if (a.includes('--전량')) {
    const 다시 = a.includes('--다시');
    대상 = 부품표.filter((k) => 다시 || !fs.existsSync(path.join(구움, k.이름 + '_몸.png')));
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

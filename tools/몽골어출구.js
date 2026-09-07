#!/usr/bin/env node
'use strict';
/**
 * 몽골어가 «나가는» 자리를 세고, 검문을 안 지난 것을 집는다 (2026-09-07 · 유호 확정
 * 「몽골어가 들어가는 모든 번역은 노출 전에 1차 검수를 지난다 · 어거지로 많이 넣지 말고 깔끔하게」).
 *
 * ■ 왜 있나 — 겹이 아니라 «자리»가 비어 있었다
 *   검문(`tools/몽골어대조.js`)은 다섯 겹이 잘 돈다. 그런데 그 겹을 지나는 글이 극히 적었다.
 *   09-07 실측: **학생·학부모가 보는 앱·엔진 코드의 몽골어 771줄 중 검문 장부에 지문이 있는 것은 3개.**
 *   즉 「검수 후 노출」이 사람 기억에만 있었고, 기억은 771줄을 못 지킨다.
 *   ⇒ 겹을 더 붙이는 대신 **나가는 자리마다 문이 서 있나**를 이 자가 센다.
 *
 * ■ 무엇을 «학생 접점»으로 보나
 *   배포집합에 실려 학생·학부모 화면에 뜨는 코드(`Code.js`·`엔진_*.js`·`contents_*.js`)다.
 *   문서·설계·장부는 대상이 아니다 — 사람만 읽는다.
 *
 * ■ 쓰기
 *   node tools/몽골어출구.js               안 지난 조각을 센다(호출 0 · 파일만 읽는다)
 *   node tools/몽골어출구.js --목록         조각을 전부 편다
 *   node tools/몽골어출구.js --기준선쓰기   지금 안 지난 것을 기준선에 못 박는다(한 번만)
 *   node tools/몽골어출구.js --일감         밤 일감이 태울 꼴로 낸다(JSON)
 *
 * 🔑 **기준선은 줄어들기만 한다.** 늘면 `tests/몽골어출구.test.js` 가 빨개진다 —
 *   그 자가 없으면 「기준선에 넣으면 되지」로 이 문이 조용히 헐거워진다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const 루트 = path.join(__dirname, '..');
const 장부경로 = path.join(루트, 'docs', '_ops', '몽골어검문.jsonl');
const 기준선경로 = path.join(루트, 'docs', '_ops', '몽골어_미검문_기준선.json');

/* 학생·학부모 화면에 뜨는 코드만. 문서·장부는 사람만 읽으므로 뺀다. */
const 학생접점 = (이름) => /^(Code\.js|엔진_.*\.js|contents_.*\.js)$/.test(이름);

const 지문 = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex').slice(0, 12);
const 키릴수 = (s) => (String(s).match(/[Ѐ-ӿ]/g) || []).length;

/** 몽골어 «문안»인가 — 글자 여덟 이상에 키릴이 절반을 넘는다.
 *  🔴 **마크업이 섞인 조각은 문안이 아니다** (09-07 에 밟았다). 이 저장소는 화면을 HTML 문자열로
 *    짓는 자리가 많아서, 거르지 않으면 `</b> өдөр<br/>⚡ Оноо: <b>+` 같은 «조각의 조각»이
 *    문안으로 잡히고 그것을 검문에 태우면 답이 통째로 헛것이 된다. */
function 몽골어인가(s) {
  const t = String(s);
  if (/<\/?[a-z][^>]*>|&[a-z]{2,6};|style\s*=|;\s*[a-z-]+\s*:/i.test(t)) return false;
  const 글자 = t.replace(/[^\p{L}]/gu, '');
  if (글자.length < 8) return false;
  return 키릴수(t) / 글자.length >= 0.5;
}

/** 한 줄에서 따옴표 안의 몽골어 조각을 뽑는다. */
function 조각뽑기(줄) {
  const 나온것 = [];
  /* 세 가지 따옴표를 다 본다 — 이 저장소는 홑·겹·백틱을 섞어 쓴다. */
  for (const m of 줄.match(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g) || []) {
    const t = m.slice(1, -1).replace(/\\n/g, ' ').trim();
    if (몽골어인가(t)) 나온것.push(t);
  }
  return 나온것;
}

/** 장부에 지문이 있는 몽골어 모음. */
function 잰것들() {
  const 셋 = new Set();
  if (!fs.existsSync(장부경로)) return 셋;
  for (const l of fs.readFileSync(장부경로, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    try { const j = JSON.parse(l); if (j.번역지문) 셋.add(j.번역지문); } catch { /* 깨진 줄은 넘긴다 */ }
  }
  return 셋;
}

const 기준선읽기 = () => {
  try { return new Set(JSON.parse(fs.readFileSync(기준선경로, 'utf8')).지문 || []); }
  catch { return new Set(); }
};

/** 학생 접점 코드에서 몽골어 조각을 전부 모은다. */
function 모으기() {
  const 조각 = new Map();   // 지문 → {글, 자리[]}
  for (const 이름 of fs.readdirSync(루트)) {
    if (!학생접점(이름)) continue;
    const 줄들 = fs.readFileSync(path.join(루트, 이름), 'utf8').split(/\r?\n/);
    줄들.forEach((l, i) => {
      // 주석 줄은 학생에게 안 간다
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      for (const t of 조각뽑기(l)) {
        const f = 지문(t);
        if (!조각.has(f)) 조각.set(f, { 글: t, 자리: [] });
        조각.get(f).자리.push(`${이름}:${i + 1}`);
      }
    });
  }
  return 조각;
}

function 세기({ 목록 = false } = {}) {
  const 조각 = 모으기();
  const 잰 = 잰것들();
  const 기준선 = 기준선읽기();
  const 지남 = [];
  const 기준선안 = [];
  const 새것 = [];
  for (const [f, v] of 조각) {
    if (잰.has(f)) 지남.push({ ...v, 지문: f });
    else if (기준선.has(f)) 기준선안.push({ ...v, 지문: f });
    else 새것.push({ ...v, 지문: f });
  }
  console.log('■ 학생·학부모 화면에 뜨는 몽골어 조각');
  console.log(`  합계 ${조각.size} = 검문 지남 ${지남.length} + 기준선(밤 일감 대기) ${기준선안.length} + 🔴새로 들어온 것 ${새것.length}`);
  if (새것.length) {
    console.log('\n🔴 **검문을 안 지났고 기준선에도 없다** — 노출 전에 태워야 한다:');
    for (const x of 새것.slice(0, 20)) console.log(`   · ${x.자리[0]}  ${x.글.slice(0, 56)}`);
    if (새것.length > 20) console.log(`   … 외 ${새것.length - 20}`);
  }
  if (목록 && 기준선안.length) {
    console.log(`\n기준선 안(밤 일감이 태울 것) ${기준선안.length}:`);
    for (const x of 기준선안) console.log(`   · ${x.자리[0]}  ${x.글.slice(0, 56)}`);
  }
  return { 지남, 기준선안, 새것, 전체: 조각.size };
}

function 기준선쓰기() {
  const 조각 = 모으기();
  const 잰 = 잰것들();
  const 안지난것 = [...조각].filter(([f]) => !잰.has(f));
  const 옛 = 기준선읽기();
  /* 🔴 기준선은 «줄어들기만» 한다 — 늘리는 쓰기는 거절한다.
   *   안 그러면 「기준선에 넣으면 되지」로 이 문이 조용히 헐거워진다. */
  if (옛.size && 안지난것.length > 옛.size) {
    console.error(`🔴 기준선이 늘어난다(${옛.size} → ${안지난것.length}) — 거절한다.`);
    console.error('   새로 들어온 몽골어는 기준선에 넣는 게 아니라 «검문에 태운다».');
    return 2;
  }
  fs.writeFileSync(기준선경로, JSON.stringify({
    왜: '검문을 아직 안 지난 학생 접점 몽골어. 밤 일감이 태우면 줄어든다. 늘리는 쓰기는 거절된다.',
    잰날: new Date().toISOString().slice(0, 10),
    개수: 안지난것.length,
    지문: 안지난것.map(([f]) => f),
  }, null, 1) + '\n', 'utf8');
  console.log(`✅ 기준선을 못 박았다 — ${안지난것.length}개 → ${path.relative(루트, 기준선경로)}`);
  return 0;
}

/* 🔑 **짝 없는 몽골어는 검문에 못 태운다** — 검문은 「한국어 원문 ↔ 몽골어」 둘을 받는다.
 *   다행히 이 저장소는 둘을 «같은 줄»에 두는 버릇이 있다. 두 꼴이 실측으로 확인됐다(09-07):
 *     ⓐ 괄호 짝  `'«몽골어» (한국어)'`            — Code.js 의 상담 말풍선
 *     ⓑ 배열 짝  `['키', '제목', '한국어', '몽골어']` — 엔진_콘텐츠AI.js 의 온보딩
 *   ⇒ 같은 줄에서 «가장 가까운 한국어 조각»을 짝으로 삼는다. 못 찾으면 **지어내지 않고** 따로 센다. */
function 짝뽑기(줄, 몽골어) {
  /* 🔴 **괄호 짝만 신뢰한다** (09-07 실측으로 좁혔다).
   *   처음에는 「같은 줄의 몽골어 «앞»에 있는 마지막 한국어」도 짝으로 봤는데, 한 줄에 여러 짝이
   *   있는 배열에서 **한국어 하나가 몽골어 여럿에 붙었다** — 「친구도움」에 `Найздаа тусалсан`(친구를
   *   도왔다)과 `Төвлөрөл`(집중)이 나란히 붙는 식이다. 그 짝을 검문에 태우면 뜻 대조가 통째로 헛것이 된다.
   *   ⇒ 못 찾으면 **지어내지 않고 null**. 짝 없는 것은 두 겹(문법·맞춤법)으로 간다. */
  const 뒤 = 줄.slice(줄.indexOf(몽골어) + 몽골어.length);
  const 괄호 = /^[»"'`\s]{0,4}\(([^)]{4,})\)/.exec(뒤);
  if (괄호 && /[가-힣]/.test(괄호[1]) && !몽골어인가(괄호[1])) return 괄호[1].trim();
  return null;
}

/** 밤 일감이 태울 꼴 — 짝을 찾은 것만 낸다(짝 없는 것은 태울 수 없다). */
function 일감내기({ 조용히 = false } = {}) {
  const 조각 = 모으기();
  const 잰 = 잰것들();
  const 대상 = [];
  const 짝없음 = [];
  for (const 이름 of fs.readdirSync(루트)) {
    if (!학생접점(이름)) continue;
    const 줄들 = fs.readFileSync(path.join(루트, 이름), 'utf8').split(/\r?\n/);
    줄들.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      for (const mn of 조각뽑기(l)) {
        const f = 지문(mn);
        if (잰.has(f)) continue;
        if (대상.some((x) => x.지문 === f) || 짝없음.some((x) => x.지문 === f)) continue;
        const ko = 짝뽑기(l, mn);
        (ko ? 대상 : 짝없음).push({ 지문: f, 한국어: ko, 몽골어: mn, 자리: `${이름}:${i + 1}` });
      }
    });
  }
  if (조용히) return { 대상, 짝없음, 전체: 조각.size };
  console.log(JSON.stringify({ 태울것: 대상.length, 짝없음: 짝없음.length, 목록: 대상 }, null, 1));
  return 0;
}

/* ── 태우기 — 밤 일감이 부르는 자리 ──────────────────────────────────────
 * 🔑 **짝이 있으면 다섯 겹, 없으면 두 겹.** 짝을 억지로 지어내지 않는다.
 *   09-07 실측: 880개 중 한국어 짝을 «확실히» 뽑을 수 있는 것은 열셋뿐이었다(괄호 짝 꼴).
 *   나머지를 「못 잰다」로 두면 864개가 영영 아무 겹도 안 지난다. 두 겹이라도 재는 쪽이
 *   안 재는 쪽보다 낫고, «두 겹만 쟀다»는 사실은 검문이 스스로 종합에 적는다. */
async function 태우기(인자) {
  const os = require('os');
  const { spawnSync } = require('child_process');
  const 사이ms = Math.max(0, Number((인자[인자.indexOf('--사이') + 1]) || 5) * 1000);
  const 한도 = Number(인자[인자.indexOf('--한도') + 1]) || 0;
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

  const { 대상: 짝있음 } = 일감내기({ 조용히: true });
  const 조각 = 모으기();
  const 잰 = 잰것들();
  const 짝지문 = new Set(짝있음.map((x) => x.지문));
  const 짝없음 = [...조각].filter(([f]) => !잰.has(f) && !짝지문.has(f)).map(([f, v]) => ({ 지문: f, 몽골어: v.글, 자리: v.자리[0] }));

  let 목록 = [...짝있음.map((x) => ({ ...x, 겹: 5 })), ...짝없음.map((x) => ({ ...x, 겹: 2 }))];
  if (한도) 목록 = 목록.slice(0, 한도);
  console.log(`■ 몽골어 대청소 — ${목록.length}개 (다섯 겹 ${짝있음.length} · 두 겹 ${짝없음.length}) · 사이 ${사이ms / 1000}초`);

  const 임시 = path.join(os.tmpdir(), `출구태우기_${process.pid}.txt`);
  let 통과 = 0; let 검수 = 0; let 불가 = 0; let 연속실패 = 0;
  for (let i = 0; i < 목록.length; i++) {
    const x = 목록[i];
    if (i > 0 && 사이ms) await 잠깐(사이ms);
    let r;
    if (x.겹 === 5) {
      fs.writeFileSync(임시, `${x.한국어}\n---\n${x.몽골어}\n`, 'utf8');
      r = spawnSync(process.execPath, [path.join(__dirname, '몽골어대조.js'), '--파일', 임시], { cwd: 루트, encoding: 'utf8', windowsHide: true, timeout: 300000 });
    } else {
      r = spawnSync(process.execPath, [path.join(__dirname, '몽골어대조.js'), '--원문없음', x.몽골어], { cwd: 루트, encoding: 'utf8', windowsHide: true, timeout: 300000 });
    }
    const 글 = `${r.stdout || ''}${r.stderr || ''}`;
    const 반쪽 = /🟡 반쪽/.test(글);
    if (r.status === 0 || 반쪽) 통과 += 1; else if (r.status === 2) 검수 += 1; else 불가 += 1;
    연속실패 = (r.status === 0 || r.status === 2 || 반쪽) ? 0 : 연속실패 + 1;
    if ((i + 1) % 25 === 0 || i === 목록.length - 1) console.log(`  … ${i + 1}/${목록.length} (깨끗 ${통과} · 검수 ${검수} · 불가 ${불가})`);
    if (연속실패 >= 3) { console.error(`\n🔴 셋이 잇달아 막혔다 — 남은 ${목록.length - i - 1}개는 안 던진다.`); break; }
  }
  try { fs.unlinkSync(임시); } catch { /* 지워지면 좋고 */ }
  console.log(`\n■ 셈 — 깨끗 ${통과} + 사람 눈 ${검수} + 확인 불가 ${불가}`);
  console.log('  🔑 다음에 기준선을 다시 쓴다: node tools/몽골어출구.js --기준선쓰기');
  return 불가 ? 2 : 0;
}

if (require.main === module) {
  const 인자 = process.argv.slice(2);
  (async () => {
    try {
      if (인자.includes('--기준선쓰기')) process.exit(기준선쓰기());
      else if (인자.includes('--태우기')) process.exit(await 태우기(인자));
      else if (인자.includes('--일감')) process.exit(일감내기());
      else { 세기({ 목록: 인자.includes('--목록') }); process.exit(0); }
    } catch (e) {
      console.error('🔴 ' + (e && e.message));
      process.exit(1);
    }
  })();
}

module.exports = { 모으기, 잰것들, 기준선읽기, 몽골어인가, 조각뽑기, 지문, 기준선경로 };

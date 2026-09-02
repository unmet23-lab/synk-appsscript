#!/usr/bin/env node
'use strict';
/**
 * 글검사 — 한국어 글이 «읽히는가»를 기계로 잰다.
 *
 * ■ 왜 있나 (유호 지시 2026-09-03)
 *   「지금 니가 구사하는게 이해가 안가거나 애매하게 말하는게 너무 많단말이지」
 *   그래서 hanlint(한국어 산문 검사기 · MIT · 딸린 것 0)를 들이고, 세 자리에 댄다:
 *     ① 내가 유호님께 내는 답            → .claude/hanlint/내답.toml
 *     ② 학부모·학생·강사가 «읽는» 산문    → .claude/hanlint/대외문안.toml
 *     ③ 학부모·학생이 «보는» 홍보물       → .claude/hanlint/홍보물.toml
 *   ②③ 을 가른 까닭(09-03 실측): 산문 자를 인쇄물·슬라이드에 대니 「짧은 문단」과 「문장형 제목」이
 *   100건 넘게 걸렸는데 표본이 전부 «의도»였다. 자가 틀린 채 빨간 수를 내면 아무도 안 본다.
 *   고르는 곳은 tools/lib/대외문안.js 의 `홍보물인가()` 하나다.
 *
 * ■ 이 도구가 «안» 하는 것 — 브랜드 말투 규칙과 겹치지 않는다
 *   금칙어·결핍 프레임·재촉·「주어는 사람인가」는 .claude/hooks/voice-guard.js 가 본다.
 *   여기는 «일반 한국어»만 본다(번역투·긴 줄표·이중 피동·가리킬 것 없는 지시어·어려운 한자어).
 *   두 자를 한 곳에 합치지 않는다 — 한 판정에 자 하나(one-ruler-per-judgment).
 *
 * ■ 🔴 기준선(baseline)을 왜 쓰나
 *   09-03 첫 실측에서 대외 문안 18벌에 지적 1,336건이 나왔고 그 중 802건이 긴 줄표였다.
 *   전부를 매번 외치면 아무도 안 본다 — voice-guard 주석이 경고한 그 BYPASS 습관이 그대로 난다.
 *   그래서 «이미 있던 것»은 잠그고 «새로 쓰는 글»만 잰다. 잠근 것을 고치는 건 따로 판정할 일이다.
 *
 * ■ 도구가 없으면 «조용히 통과»하지 않는다
 *   node_modules/hanlint 가 없으면 「못 쟀다」고 말한다. 0건과 「안 재봤다」는 다르다
 *   (zero-is-a-success-face-taxonomy). 훅에서 부를 때만 조용해진다 — 매 턴 떠들면 안 되므로.
 *
 * 쓰는 법
 *   node tools/글검사.js                 대외 문안 전량 · 기준선 밖의 «새» 지적만
 *   node tools/글검사.js --전량           기준선을 무시하고 전부
 *   node tools/글검사.js 파일 [파일…]     그 파일만(HTML 도 된다)
 *   node tools/글검사.js --기준선          지금 상태로 기준선을 다시 뜬다
 *   echo "글" | node tools/글검사.js --답  내 답을 재는 자로 stdin 을 검사
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const 뿌리 = path.resolve(__dirname, '..');
const 검사기 = path.join(뿌리, 'node_modules', 'hanlint', 'bin', 'hanlint.js');
const 자 = {
  대외문안: path.join(뿌리, '.claude', 'hanlint', '대외문안.toml'),
  홍보물: path.join(뿌리, '.claude', 'hanlint', '홍보물.toml'),
  내답: path.join(뿌리, '.claude', 'hanlint', '내답.toml'),
};
const 기준선파일 = path.join(뿌리, '.claude', 'hanlint', '대외문안.기준선.json');

/* 대외 문안 목록은 tools/lib/대외문안.js 하나가 안다 — voice-guard 훅도 같은 것을 읽는다.
 * 🔴 여기에 목록을 베끼지 않는다(한 값을 두 곳이 알면 갈린다). */
const { 파일들: 대외문안, 홍보물인가 } = require('./lib/대외문안.js');

/* 파일마다 «맞는 자»를 고른다 — 홍보물과 산문은 다른 판정이다(까닭은 .claude/hanlint/홍보물.toml 머리말).
 * 🔴 고르는 규칙은 tools/lib/대외문안.js 하나가 안다. 여기에 목록을 베끼지 않는다. */
const 자고르기 = (파일) => (홍보물인가(파일) ? 자.홍보물 : 자.대외문안);

function 있나() { return fs.existsSync(검사기); }

/** HTML 에서 사람이 읽는 글자만 뽑는다 — 검사기는 마크다운만 알아서 태그를 그대로 주면 헛 지적이 난다. */
function html을글로(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* 마크다운 주석(<!-- … -->)을 «지운다» — 독자가 못 보는 글이라 대외 문안의 자를 댈 자리가 아니다.
 *
 * 🔴 09-03 실측: 대외 문안에 남은 긴 줄표 725개 가운데 197개(27%)가 주석 안에 있었다.
 *   HTML 은 html을글로() 가 이미 주석을 걷어내는데 마크다운만 그대로 넘어가 «한쪽만 재는» 꼴이었다.
 * 🔑 줄바꿈은 남긴다 — 줄 수가 달라지면 지적의 행 번호가 밀려 사람이 그 자리를 못 찾는다. */
const md주석지우기 = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\r\n]/g, ' '));

/* 몽골어 줄을 «지운다» — 한국어 자를 몽골어에 대면 뜻 없는 수가 나온다.
 *
 * 🔴 09-03 실측: docs/홍보_트리오_정본_v1.md 는 한 파일에 한국어 문안과 그 몽골어 짝이 나란히 산다.
 *   그 몽골어 줄의 줄표·어미가 한국어 규칙에 걸려 지적으로 세어지고 있었다.
 *   `몽골어인가()` 는 «파일» 단위라 이런 섞인 파일을 못 가른다 ⇒ 줄 단위로 한 번 더 거른다.
 * 자 = 키릴 글자가 그 줄 «글자의 30% 이상». 낱말 한둘이 섞인 한국어 줄은 그대로 잰다.
 * 🔑 줄바꿈은 남긴다 — 행 번호가 밀리면 사람이 그 자리를 못 찾는다. */
const 몽골어줄지우기 = (s) => s.split(/(\r?\n)/).map((줄) => {
  if (/^\r?\n$/.test(줄) || !줄.trim()) return 줄;
  const 글자 = 줄.replace(/\s/g, '');
  if (글자.length < 12) return 줄;
  const 키릴 = (글자.match(/[Ѐ-ӿ᠀-᢯]/g) || []).length;
  return 키릴 / 글자.length >= 0.3 ? 줄.replace(/[^\r\n]/g, ' ') : 줄;
}).join('');

/** 검사기를 한 번 돌린다. 파일이 HTML 이면 글자만 뽑아 stdin 으로 넣는다. */
function 재기(파일, 설정, 형식 = 'json') {
  const 절대 = path.isAbsolute(파일) ? 파일 : path.join(뿌리, 파일);
  if (!fs.existsSync(절대)) return { 파일, 없음: true, 지적: [] };
  const html = /\.html?$/i.test(절대);
  const 인자 = ['--config', 설정, '--format', 형식];
  let 결과;
  try {
    const 글 = html
      ? html을글로(fs.readFileSync(절대, 'utf8'))
      : 몽골어줄지우기(md주석지우기(fs.readFileSync(절대, 'utf8')));
    결과 = cp.execFileSync(process.execPath, [검사기, '-', ...인자, '--path', 파일],
      { input: 글, encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (e) {
    // 지적이 있으면 종료 코드 1 로 나온다 — 그건 실패가 아니다.
    결과 = (e.stdout || '') + '';
    if (!결과.trim()) return { 파일, 오류: String(e.message).slice(0, 200), 지적: [] };
  }
  if (형식 !== 'json') return { 파일, 평문: 결과, 지적: [] };
  try {
    const j = JSON.parse(결과);
    // 형태 = { files: [ { path, findings: [ { rule, line, severity, quote, why } ] } ] }
    const 목록 = (j.files || []).flatMap(f => f.findings || []);
    return { 파일, 지적: 목록.map(f => ({
      줄: f.line ?? 0,
      규칙: f.rule ?? '?',
      급: f.severity ?? '',
      말: f.why ?? '',
      글: String(f.quote ?? '').slice(0, 90),
    })) };
  } catch { return { 파일, 지적: [], 파싱실패: 결과.slice(0, 200) }; }
}

/** 지적 하나의 «신원» — 줄 번호는 글이 밀리면 바뀌니 «파일+규칙+글자»로 잡는다. */
const 지문 = (파일, d) => `${파일} ¦ ${d.규칙} ¦ ${(d.글 || '').trim()}`;

function 기준선읽기() {
  try { return new Set(JSON.parse(fs.readFileSync(기준선파일, 'utf8')).지문들); }
  catch { return null; }
}

function 기준선뜨기() {
  const 지문들 = [];
  for (const f of 대외문안) for (const d of 재기(f, 자고르기(f)).지적) 지문들.push(지문(f, d));
  fs.mkdirSync(path.dirname(기준선파일), { recursive: true });
  fs.writeFileSync(기준선파일, JSON.stringify({
    뜬날: new Date().toISOString().slice(0, 10),
    왜: '이미 있던 지적을 잠근다. 이 뒤로 «새로 쓰는 글»만 잰다. 잠근 것을 고치는 건 따로 판정할 일이다.',
    지문들,
  }, null, 1), 'utf8');
  console.log(`✔ 기준선을 떴다 — 지적 ${지문들.length}건을 잠갔다.\n   ${path.relative(뿌리, 기준선파일)}`);
  console.log('   이 뒤로 `node tools/글검사.js` 는 «새로 생긴 것»만 낸다. 전부 보려면 --전량.');
}

function 대외문안검사({ 전량 = false } = {}) {
  const 잠금 = 전량 ? null : 기준선읽기();
  let 합 = 0, 잠긴수 = 0;
  const 규칙별 = new Map();
  for (const f of 대외문안) {
    const r = 재기(f, 자고르기(f));
    if (r.없음) { console.log(`   (없다) ${f}`); continue; }
    const 새것 = r.지적.filter(d => { if (잠금 && 잠금.has(지문(f, d))) { 잠긴수++; return false; } return true; });
    if (!새것.length) continue;
    console.log(`\n── ${f}  ${새것.length}건`);
    /* 🔴 세는 것과 보여주는 것을 갈라 둔다 — 09-03 실측에서 이 둘이 붙어 있어
     *    «화면에 보인 12건»만 규칙별로 세고 있었다. 합계는 맞는데 갈래별 수가 틀린,
     *    가장 알아채기 어려운 꼴이다(measurement-needs-its-instrument). */
    for (const d of 새것) 규칙별.set(d.규칙, (규칙별.get(d.규칙) || 0) + 1);
    for (const d of 새것.slice(0, 12)) {
      console.log(`   ${String(d.줄).padStart(4)}  [${d.규칙}] ${d.말}`);
      if (d.글) console.log(`         ${d.글}`);
    }
    if (새것.length > 12) console.log(`   … 그 밖 ${새것.length - 12}건`);
    합 += 새것.length;
  }
  console.log(`\n${'─'.repeat(52)}`);
  if (합 === 0) {
    console.log(`✅ 새 지적 0건${잠금 ? ` (기준선이 ${잠긴수}건을 잠그고 있다)` : ''}`);
  } else {
    console.log(`🟡 새 지적 ${합}건${잠금 ? ` · 기준선이 잠근 것 ${잠긴수}건` : ''}`);
    const 줄 = [...규칙별].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(' · ');
    if (줄) console.log(`   많은 것부터: ${줄}`);
    console.log(`   규칙 하나가 무엇인지: node node_modules/hanlint/bin/hanlint.js explain <규칙>`);
  }
  return 합;
}

function 답검사(글) {
  const 임시 = path.join(require('node:os').tmpdir(), `synk-답-${process.pid}.md`);
  fs.writeFileSync(임시, 글, 'utf8');
  const r = 재기(임시, 자.내답);
  try { fs.unlinkSync(임시); } catch {}
  return r.지적;
}

// ── 들머리
const 인자 = process.argv.slice(2);
if (!있나()) {
  console.log('🔴 글 검사기가 없어 «못 쟀다»(0건이 아니다).');
  console.log('   들이는 법:  npm install');
  console.log(`   찾은 자리:  ${path.relative(뿌리, 검사기)}`);
  process.exit(2);
}
if (인자.includes('--기준선')) { 기준선뜨기(); process.exit(0); }
if (인자.includes('--답')) {
  let 글 = '';
  try { 글 = fs.readFileSync(0, 'utf8'); } catch {}
  if (!글.trim()) { console.log('넣을 글이 없다. 예)  echo "글" | node tools/글검사.js --답'); process.exit(2); }
  const 지적 = 답검사(글);
  if (!지적.length) { console.log('✅ 지적 0건'); process.exit(0); }
  console.log(`🟡 지적 ${지적.length}건`);
  for (const d of 지적) {
    console.log(`   ${String(d.줄).padStart(3)}  [${d.규칙}] ${d.말}`);
    if (d.글) console.log(`        ${d.글}`);
  }
  process.exit(1);
}
const 파일들 = 인자.filter(a => !a.startsWith('--'));
if (파일들.length) {
  let 합 = 0;
  for (const f of 파일들) {
    const r = 재기(f, 자고르기(f));
    if (r.없음) { console.log(`(없다) ${f}`); continue; }
    console.log(`\n── ${f}  ${r.지적.length}건`);
    for (const d of r.지적) {
      console.log(`   ${String(d.줄).padStart(4)}  [${d.규칙}] ${d.말}`);
      if (d.글) console.log(`         ${d.글}`);
    }
    합 += r.지적.length;
  }
  process.exit(합 ? 1 : 0);
}
process.exit(대외문안검사({ 전량: 인자.includes('--전량') }) ? 1 : 0);

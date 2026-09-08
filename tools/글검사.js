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

/* ══════════ 우리 이음말을 검사기에 채워 넣는다 (2026-09-08) ══════════
 *
 * ■ 왜 여기서 하나
 *   hanlint 의 인과 표지 목록은 `data/causalMarkers.txt` 파일이 쥐고 있고, **설정으로 더하는 길이 없다**
 *   (`--config` 도 `--preset` 도 이 목록엔 안 닿는다 · 09-08 실측). 그런데 그 파일은 node_modules 안이라
 *   `npm install` 한 번이면 날아간다. 그래서 «도구가 돌 때마다» 없으면 채운다 — 사람이 기억할 일을 없앤다.
 *
 * ■ 무엇을 채우나 (판정 지면 `docs/말투_두규칙_판정_0904.html` §02)
 *   「~라서」와 「~이라」는 까닭을 잇는 말인데 목록에 없었다(「따라서」 안에 「라서」가 들어 있을 뿐이다).
 *   그래서 까닭이 멀쩡히 있는 글이 「사실만 나열」로 걸렸다.
 *
 * ■ 🔴 「이라」에 경계를 주는 까닭 — 안 주면 자를 무디게 만든다
 *   경계 없이 넣으면 「~이라고」·「~이라는」 같은 «인용»까지 인과로 읽어, 진짜 나열 넷을 놓쳤다
 *   (09-08 실측: 경계 없이 −12 · 경계 주고 −8 · 그 차이 4곳이 전부 거짓 통과였다).
 *   목록이 이미 쓰는 표기법(`지만(?=\s|,|$)`)을 그대로 따른다.
 */
const 우리이음말 = ['라서', '이라(?=\\s|,|$)'];

/* 🔴 채우기가 «실패»하면 조용히 지나가지 않는다 (심문 09-08 P0).
 *   첫 판은 목록 파일이 없으면 `{함:false}` 만 돌려주고 검사를 그대로 이어 갔다.
 *   hanlint 가 판을 올려 그 파일 자리가 바뀌면 채우기는 영영 실패하는데 도구는 멀쩡한 얼굴로
 *   「깨끗하다」를 낸다 — 자가 무뎌진 채 나는 거짓 초록이다(zero-is-a-success-face-taxonomy).
 *   ⇒ 실패는 `탈` 로 돌려주고 부르는 쪽이 «못 쟀다»(종료 2)로 멈춘다. */
function 이음말채우기() {
  const p = path.join(뿌리, 'node_modules', 'hanlint', 'data', 'causalMarkers.txt');
  if (!fs.existsSync(p)) return { 함: false, 탈: `이음말 목록 파일이 없다: ${path.relative(뿌리, p)}` };
  let 원;
  try { 원 = fs.readFileSync(p, 'utf8'); } catch (e) { return { 함: false, 탈: `이음말 목록을 못 읽었다: ${e.message}` }; }
  const 있는줄 = new Set(원.split(/\r?\n/).map((s) => s.trim()));
  const 넣을것 = 우리이음말.filter((v) => !있는줄.has(v));
  if (!넣을것.length) return { 함: false, 까닭: '이미 다 있다' };
  const 줄끝 = 원.includes('\r\n') ? '\r\n' : '\n';
  try {
    fs.writeFileSync(p, 원.replace(/\s*$/, '') + 줄끝
      + `# ── SYNK 가 채운 것 (tools/글검사.js · 왜는 그 파일 주석)${줄끝}`
      + 넣을것.join(줄끝) + 줄끝, 'utf8');
  } catch (e) { return { 함: false, 탈: `이음말을 못 채웠다: ${e.message}` }; }
  // 되읽어 센다 — 「썼다」는 「들어갔다」가 아니다(blanket-replace-needs-a-zero-count)
  const 되읽음 = new Set(fs.readFileSync(p, 'utf8').split(/\r?\n/).map((s) => s.trim()));
  const 안들어간것 = 우리이음말.filter((v) => !되읽음.has(v));
  if (안들어간것.length) return { 함: false, 탈: `채웠는데 되읽으니 없다: ${안들어간것.join(' · ')}` };
  return { 함: true, 넣은것: 넣을것 };
}

/** HTML 에서 사람이 읽는 글자만 뽑는다 — 검사기는 마크다운만 알아서 태그를 그대로 주면 헛 지적이 난다. */
function html을글로(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    /* 🔴 인라인 태그는 «공백»으로 지운다 — 빈 문자열로 지우면 앞뒤 글자가 붙는다(09-03 실물).
     *   `<span>서울 어학당</span><span>대학 부설…` 이 「어학당대학 부설」이 되어
     *   nounPile(명사 다섯이 조사 없이 이어진다)로 헛되이 세어졌다. 사람이 보는 화면에는 그런 낱말이 없다. */
    .replace(/<[^>]+>/g, ' ')
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
const md주석지우기 = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) =>
  /hanlint-(disable|enable)/.test(m) ? m : m.replace(/[^\r\n]/g, ' '));

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
  /* 🔴 «잰 글»을 밖으로 같이 돌려준다 — 지적의 줄 번호는 **전처리된 글** 기준이다.
   *   그걸 원본 HTML 에 대고 읽으면 style 블록 한복판이 나온다(09-04 에 내가 그렇게 읽고
   *   「26건이 CSS 다」로 잘못 셌다). 문맥을 뽑는 쪽은 반드시 이 글을 봐야 한다. */
  let 잰글 = '';
  try {
    const 글 = html
      ? html을글로(fs.readFileSync(절대, 'utf8'))
      : 몽골어줄지우기(md주석지우기(fs.readFileSync(절대, 'utf8')));
    잰글 = 글;
    결과 = cp.execFileSync(process.execPath, [검사기, '-', ...인자, '--path', 파일],
      { input: 글, encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (e) {
    // 지적이 있으면 종료 코드 1 로 나온다 — 그건 실패가 아니다.
    결과 = (e.stdout || '') + '';
    /* 🔴 «못 쟀다»를 «0건»으로 돌려주지 않는다 (심문 09-08 P1).
     *   첫 판은 `{오류, 지적:[]}` 를 돌려줬는데 부르는 쪽 넷이 전부 `오류` 를 안 읽어서,
     *   검사기가 죽은 파일이 «깨끗한 파일»과 화면에서 구별되지 않았다. */
    if (!결과.trim()) return { 파일, 못쟀다: String(e.message).split('\n')[0].slice(0, 160), 지적: [] };
  }
  if (형식 !== 'json') return { 파일, 평문: 결과, 지적: [] };
  try {
    const j = JSON.parse(결과);
    // 형태 = { files: [ { path, findings: [ { rule, line, severity, quote, why } ] } ] }
    // 🔴 `files` 칸 자체가 없으면 «지적이 0건»이 아니라 «검사기가 다른 것을 냈다»다
    if (!Array.isArray(j.files)) {
      return { 파일, 지적: [], 못쟀다: `검사기 출력에 files 칸이 없다: ${결과.trim().slice(0, 120)}`, 잰글 };
    }
    const 목록 = j.files.flatMap(f => f.findings || []);
    return { 파일, 지적: 목록.map(f => ({
      줄: f.line ?? 0,
      규칙: f.rule ?? '?',
      급: f.severity ?? '',
      말: f.why ?? '',
      글: String(f.quote ?? '').slice(0, 90),
    })), 잰글 };
    // 잘린 JSON·필수 칸 없는 `{}` 도 «못 쟀다»다 — 지적 0건과 같은 얼굴로 두지 않는다
  } catch { return { 파일, 지적: [], 못쟀다: `검사기 출력이 JSON 이 아니다: ${결과.trim().slice(0, 120)}`, 잰글 }; }
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
  const 못잰것 = [];
  for (const f of 대외문안) {
    const r = 재기(f, 자고르기(f));
    if (r.없음) { console.log(`   (없다) ${f}`); continue; }
    if (r.못쟀다) { 못잰것.push({ 파일: f, 까닭: r.못쟀다 }); continue; }
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
  /* 🔴 «못 쟌 파일»을 먼저 낸다 — 초록보다 위에 둔다.
   *   아래 「✅ 0건」이 이 줄 위에 있으면 사람은 초록만 보고 닫는다. */
  if (못잰것.length) {
    console.log(`🔴 못 쟌 파일 ${못잰것.length}건 — «0건이 아니다». 이 파일들은 이번 수에 안 들었다:`);
    for (const v of 못잰것) console.log(`   · ${v.파일}\n     ${v.까닭}`);
    console.log('');
  }
  if (합 === 0) {
    console.log(`${못잰것.length ? '🟡' : '✅'} 새 지적 0건${잠금 ? ` (기준선이 ${잠긴수}건을 잠그고 있다)` : ''}`
      + `${못잰것.length ? ` · 다만 ${못잰것.length}건은 «못 쟀다»` : ''}`);
  } else {
    console.log(`🟡 새 지적 ${합}건${잠금 ? ` · 기준선이 잠근 것 ${잠긴수}건` : ''}`);
    const 줄 = [...규칙별].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(' · ');
    if (줄) console.log(`   많은 것부터: ${줄}`);
    console.log(`   규칙 하나가 무엇인지: node node_modules/hanlint/bin/hanlint.js explain <규칙>`);
  }
  return { 합, 못잰수: 못잰것.length };
}

function 답검사(글) {
  const 임시 = path.join(require('node:os').tmpdir(), `synk-답-${process.pid}.md`);
  fs.writeFileSync(임시, 글, 'utf8');
  const r = 재기(임시, 자.내답);
  try { fs.unlinkSync(임시); } catch {}
  return r;                       // 🔴 지적만 꺼내면 «못 쟀다»가 0건으로 둔갑한다
}

// ── 들머리
const 인자 = process.argv.slice(2);
if (!있나()) {
  console.log('🔴 글 검사기가 없어 «못 쟀다»(0건이 아니다).');
  console.log('   들이는 법:  npm install');
  console.log(`   찾은 자리:  ${path.relative(뿌리, 검사기)}`);
  process.exit(2);
}
/* 🔴 재기 «전»에 우리 이음말이 검사기에 있는지 본다 — npm install 이 지웠으면 다시 채운다.
 *    조용히 지나가면 자가 무뎌진 채로 「깨끗하다」를 낸다(거짓 초록). */
{
  const r = 이음말채우기();
  /* 🔴 안내는 «표준 오류»로 낸다 (심문 09-08 P1).
   *    표준 출력에 쓰면 `--json` 실행에서 안내문이 JSON 앞에 붙어 파싱이 깨진다 —
   *    하필 «복구가 필요한 바로 그 실행»에서만 깨져서, 판정 지면이 재료를 못 읽는다. */
  if (r.함) console.error(`ℹ 검사기에 우리 이음말을 다시 채웠다: ${r.넣은것.join(' · ')}`);
  if (r.탈) {
    console.error(`🔴 자가 무뎌진 채로는 안 잰다 — «못 쟀다»(0건이 아니다).\n   ${r.탈}`);
    console.error('   들이는 법:  npm install   (그래도 안 되면 hanlint 판이 올라 자리가 바뀐 것이다)');
    process.exit(2);
  }
}
if (인자.includes('--기준선')) { 기준선뜨기(); process.exit(0); }
/* --json — 화면은 파일마다 12건에서 접는데(진짜 적색이 밀려나지 않게), «판정 지면»을 지으려면
 * 전량이 필요하다. 09-04 실측: 선언 99건 중 화면에 나온 것은 77건이고 22건은 「그 밖 N건」으로
 * 접혀 있었다 — 자는 정직했고 모자란 것은 «전량을 꺼내는 통로»였다.
 * 🔑 이 갈래는 화면과 «같은 것»을 센다(기준선 잠금·자 고르기 그대로) — 다른 수가 나오면 그게 병이다. */
if (인자.includes('--json')) {
  const 전량 = 인자.includes('--전량');
  const 잠금 = 전량 ? null : 기준선읽기();
  const 밖 = [];
  const 못잰것 = [];
  let 잠긴수 = 0;
  for (const f of 대외문안) {
    const r = 재기(f, 자고르기(f));
    if (r.없음) continue;
    // 🔴 못 쟌 파일을 재료에 실어 보낸다 — 판정 지면이 «깨끗한 파일»로 세지 않게
    if (r.못쟀다) { 못잰것.push({ 파일: f, 까닭: r.못쟀다 }); continue; }
    const 줄들 = String(r.잰글 || '').split('\n');
    for (const d of r.지적) {
      if (잠금 && 잠금.has(지문(f, d))) { 잠긴수++; continue; }
      /* 앞뒤를 «잰 글»에서 뜬다 — 판정에는 문단이 필요하고, 원본 파일에서 뜨면 줄이 밀려
       * 엉뚱한 자리가 나온다(위 재기() 머리말). 앞 3줄·뒤 3줄이면 문단 하나가 들어온다. */
      const i = (d.줄 || 1) - 1;
      const 앞뒤 = 줄들.slice(Math.max(0, i - 3), i + 4)
        .map((s, k) => ({ 줄: Math.max(0, i - 3) + k + 1, 여기: Math.max(0, i - 3) + k === i, 글: s.trim() }))
        .filter((x) => x.글);
      밖.push({ 파일: f, ...d, 앞뒤 });
    }
  }
  console.log(JSON.stringify({
    뜬때: new Date().toISOString(), 전량, 잠긴수, 건수: 밖.length, 못잰수: 못잰것.length, 못잰것, 지적: 밖,
  }, null, 1));
  process.exit(못잰것.length ? 2 : 0);
}
if (인자.includes('--답')) {
  let 글 = '';
  try { 글 = fs.readFileSync(0, 'utf8'); } catch {}
  if (!글.trim()) { console.log('넣을 글이 없다. 예)  echo "글" | node tools/글검사.js --답'); process.exit(2); }
  const r = 답검사(글);
  if (r.못쟀다) { console.log(`🔴 «못 쟀다»(0건이 아니다)\n   ${r.못쟀다}`); process.exit(2); }
  const 지적 = r.지적;
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
  let 합 = 0, 못잰수 = 0;
  for (const f of 파일들) {
    const r = 재기(f, 자고르기(f));
    if (r.없음) { console.log(`(없다) ${f}`); continue; }
    if (r.못쟀다) { console.log(`\n🔴 ${f} — «못 쟀다»(0건이 아니다)\n   ${r.못쟀다}`); 못잰수++; continue; }
    console.log(`\n── ${f}  ${r.지적.length}건`);
    for (const d of r.지적) {
      console.log(`   ${String(d.줄).padStart(4)}  [${d.규칙}] ${d.말}`);
      if (d.글) console.log(`         ${d.글}`);
    }
    합 += r.지적.length;
  }
  process.exit(못잰수 ? 2 : (합 ? 1 : 0));
}
/* 종료 코드 셋을 가른다 — 0=깨끗 · 1=지적 있다 · 2=못 쟀다.
 * 🔴 「못 쟀다」를 0 으로 내면 이 도구를 부르는 훅·CI 가 «검사가 통과했다»로 읽는다. */
{
  const r = 대외문안검사({ 전량: 인자.includes('--전량') });
  process.exit(r.못잰수 ? 2 : (r.합 ? 1 : 0));
}

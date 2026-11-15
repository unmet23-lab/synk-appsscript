#!/usr/bin/env node
'use strict';
/* 기록 찾기 재기 — 세션이 남은 일이나 유호님 차례를 말하기 전에 지금 기록을 봤는지를 Claude 세션 기록에서 센다(2026-11-15).
 *
 * 왜: 11-15 업무 백업 세션이 이미 끝난 일(손님용 B2 가입 · 화면 시안 고르기)을 유호님께 다시 부탁드렸다. 설계 문서의 옛 일정표를 읽고 말했고,
 *   AGENTS의 「남은 일을 적거나 여쭙기 전에 기록찾기를 돌린다」는 글로만 있어 건너뛰어졌다. 유호님 「…근본적인 원인을 고치고싶어」 → 「응, 만들어」.
 *   그래서 지금 상태를 세션에 넣는 훅(tools/지금상태.js, SessionStart · UserPromptSubmit)을 만들었다. 그 효과를 말이 아니라 이 숫자로 본다(영상은 tools/영상세션재기.js).
 *   11-15 기준선(11-08~15): 말 1,967번 가운데 같은 문맥에서 먼저 기록찾기 105번(5%, 기록찾기가 생긴 11-15 하루는 66%) · 결정 표나 트랙을 직접 찾은 것까지 78%.
 *
 *   node tools/기록찾기재기.js [--부터 2026-11-08] [--까지 2026-11-16] [--json] [--세션 <앞 8자>]
 *     --부터 · --까지: 그 사이에 한 말만 센다(한국 시각 날짜, 기본 부터 = 7일 전).
 *
 * 읽는 것: %USERPROFILE%/.claude/projects/<이 저장소 · 그 워크트리>/*.jsonl — 읽기만 한다. 말의 내용은 찍지 않고 수만 센다(--세션일 때만 시각과 앞 60자).
 * 세는 것:
 *   말     — 어시스턴트가 남은 일이나 유호님 차례를 말한 자리(글 조각 · 다음 단계 상자 · 질문 창). 「남은 일 · 유호님 차례 · 여쭙 · 골라 주 · 해 주셔야」 같은 말이 든 것.
 *   찾음   — 그 말보다 앞, 같은 문맥(마지막 압축 뒤) 안에서 `기록찾기.js`를 돌렸다.
 *   넓게   — 위에 더해 결정 표 · 트랙을 직접 읽거나 grep · rg로 찾은 것도 센다(기록찾기가 생기기 전 11-15 00:12의 방법).
 *   훅     — 같은 문맥 안에 지금 상태 훅(〔지금 상태〕)이 넣은 글이 있었다.
 *   차례   — 같은 「차례」(마지막 사람 말 뒤) 안에서 찾은 것만 센 엄격한 값.
 *   바로잡음 — 유호님이 옛 내용을 바로잡은 말(「이미 … 않았어」 · 「예전 내용」 · 「벌써 했」 따위)의 수. 훅이 효과가 있으면 이 수가 줄어야 한다(Fable 5.2 설계 검토 D15).
 * 한계: 말의 꼴로만 고르므로 남은 일을 말하지 않은 자리도 섞인다(「남은 일: 없음」 따위). 찾은 낱말이 그 말의 일과 맞는지는 보지 않는다.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const 인자 = process.argv.slice(2);
const 값 = (k, d) => (인자.includes(k) ? 인자[인자.indexOf(k) + 1] : d);
const 날 = (s) => new Date(`${s}T00:00:00+09:00`);
const 부터 = 인자.includes('--부터') ? 날(값('--부터')) : new Date(Date.now() - 7 * 864e5);
const 까지 = 인자.includes('--까지') ? 날(값('--까지')) : new Date(Date.now() + 864e5);
const JSON출력 = 인자.includes('--json');
const 한세션만 = 값('--세션', null);

const 뿌리 = process.env.SYNK_세션기록뿌리 || path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
const 큰줄 = 300 * 1024;
const 말꼴 = /남은 일|남은 것|유호님 차례|유호님 손|유호님께 여쭐|여쭙|여쭤|여쭐|고르실|골라 주|정해 주|확인해 주시|해 주셔야|부탁드/;
const 찾기꼴 = /기록찾기[.]js/;
const 넓게꼴 = /(?:rg|grep|Select-String|sed|cat|head|tail)\b[^\n]*(?:_ops[\\/](?:결정|트랙)|결정[.]md|트랙[.]md)/;
const 압축식 = /^This session is being continued from a previous conversation/;
const 훅표 = '〔지금 상태〕';
const 바로잡음꼴 = /이미 .{0,24}(?:했|않았|끝났|정했|골랐)|예전 내용|옛날 (?:내용|정보)|예전 정보|벌써 (?:했|끝)|아직도 .{0,12}(?:옛|예전)|너무 예전/;
const 한국 = (ts) => new Date(new Date(ts).getTime() + 9 * 36e5).toISOString().slice(5, 16).replace('T', ' ');

function 사람말인가(o) {
  if (o.type !== 'user' || o.isSidechain || !o.message) return false;
  const c = o.message.content;
  if (typeof c === 'string') return !c.startsWith('<') && !압축식.test(c.trim());
  if (!Array.isArray(c)) return false;
  if (c.some((b) => b && b.type === 'tool_result')) return false;
  const 글 = c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
  return !!글 && !글.startsWith('<') && !압축식.test(글);
}

/** 세션 하나 — 말마다 { ts, 찾음, 넓게, 훅, 차례 }. */
async function 한세션(파일) {
  const 줄들 = readline.createInterface({ input: fs.createReadStream(파일, { encoding: 'utf8' }), crlfDelay: Infinity });
  const 말 = [], 바로잡음 = [];
  let 문맥 = { 찾음: false, 넓게: false, 훅: false }, 차례 = { 찾음: false, 넓게: false };
  let 시작 = null;
  for await (const 줄 of 줄들) {
    if (!줄 || 줄[0] !== '{' || 줄.length > 큰줄) continue;
    let o;
    try { o = JSON.parse(줄); } catch { continue; }
    const ts = o.timestamp;
    if (ts && !시작) 시작 = ts;
    if (o.isSidechain) continue;
    if (o.type === 'system' && o.subtype === 'compact_boundary') { 문맥 = { 찾음: false, 넓게: false, 훅: false }; 차례 = { 찾음: false, 넓게: false }; continue; }
    if (o.type === 'attachment' && o.attachment && o.attachment.type === 'hook_additional_context') { if (줄.includes(훅표)) 문맥.훅 = true; continue; }
    if (o.type === 'user') {
      const c = o.message && o.message.content;
      const 글 = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '';
      if (압축식.test(글.trim())) { 문맥 = { 찾음: false, 넓게: false, 훅: false }; 차례 = { 찾음: false, 넓게: false }; continue; }
      if (글.includes(훅표)) 문맥.훅 = true;
      if (사람말인가(o)) { 차례 = { 찾음: false, 넓게: false }; if (바로잡음꼴.test(글)) 바로잡음.push(ts); }
      continue;
    }
    if (o.type !== 'assistant' || !o.message || !Array.isArray(o.message.content)) continue;
    for (const b of o.message.content) {
      if (!b) continue;
      if (b.type === 'tool_use' && b.input) {
        const i = b.input;
        const 명령 = String(i.command || '');
        if (찾기꼴.test(명령)) { 문맥.찾음 = 문맥.넓게 = 차례.찾음 = 차례.넓게 = true; }
        else if (넓게꼴.test(명령) || (b.name === 'Read' && /(?:결정|트랙)[.]md$/.test(String(i.file_path || ''))) || (b.name === 'Grep' && /_ops|결정[.]md|트랙[.]md/.test(String(i.path || '')))) { 문맥.넓게 = 차례.넓게 = true; }
        let 말글 = '';
        if (/wrap_up$/.test(b.name)) 말글 = [i.recap, i.ask].filter(Boolean).join('\n');
        else if (b.name === 'AskUserQuestion' && Array.isArray(i.questions)) 말글 = i.questions.map((q) => q && q.question).filter(Boolean).join('\n');
        if (말글 && 말꼴.test(말글)) 말.push({ ts, 글: 말글, 찾음: 문맥.찾음, 넓게: 문맥.넓게, 훅: 문맥.훅, 차례: 차례.찾음, 차례넓게: 차례.넓게 });
      } else if (b.type === 'text' && 말꼴.test(b.text || '')) {
        말.push({ ts, 글: b.text, 찾음: 문맥.찾음, 넓게: 문맥.넓게, 훅: 문맥.훅, 차례: 차례.찾음, 차례넓게: 차례.넓게 });
      }
    }
  }
  return { 세션: path.basename(파일, '.jsonl'), 시작, 말, 바로잡음 };
}

(async () => {
  if (!fs.existsSync(뿌리)) { console.error(`세션 기록 폴더가 없다: ${뿌리}`); process.exit(2); }
  const 파일들 = [];
  for (const d of fs.readdirSync(뿌리, { withFileTypes: true })) {
    if (!d.isDirectory() || !/SYNK-appsscript/i.test(d.name)) continue;
    const 폴더 = path.join(뿌리, d.name);
    for (const n of fs.readdirSync(폴더)) {
      if (!n.endsWith('.jsonl') || (한세션만 && !n.startsWith(한세션만))) continue;
      const f = path.join(폴더, n);
      if (fs.statSync(f).mtime >= 부터) 파일들.push(f);
    }
  }
  const 합 = { 세션: 0, 말한세션: 0, 말: 0, 찾음: 0, 넓게: 0, 훅: 0, 찾음또는훅: 0, 차례: 0, 차례넓게: 0, 바로잡음: 0 };
  const 날별 = {};
  const 세션줄 = [];
  for (const f of 파일들) {
    let r;
    try { r = await 한세션(f); } catch (e) { console.error(`못 읽음 ${path.basename(f)}: ${e.message}`); continue; }
    const 안 = r.말.filter((m) => m.ts && new Date(m.ts) >= 부터 && new Date(m.ts) < 까지);
    합.세션++;
    for (const ts of r.바로잡음) {
      if (!ts || new Date(ts) < 부터 || new Date(ts) >= 까지) continue;
      합.바로잡음++;
      const 하루 = 한국(ts).slice(0, 5);
      (날별[하루] || (날별[하루] = { 말: 0, 찾음: 0, 넓게: 0, 훅: 0, 바로잡음: 0 })).바로잡음 = ((날별[하루] || {}).바로잡음 || 0) + 1;
    }
    if (!안.length) continue;
    합.말한세션++;
    for (const m of 안) {
      합.말++; if (m.찾음) 합.찾음++; if (m.넓게) 합.넓게++; if (m.훅) 합.훅++; if (m.찾음 || m.훅) 합.찾음또는훅++; if (m.차례) 합.차례++; if (m.차례넓게) 합.차례넓게++;
      const 하루 = 한국(m.ts).slice(0, 5);
      const d = 날별[하루] || (날별[하루] = { 말: 0, 찾음: 0, 넓게: 0, 훅: 0, 바로잡음: 0 });
      d.말++; if (m.찾음) d.찾음++; if (m.넓게) d.넓게++; if (m.훅) d.훅++;
    }
    세션줄.push({ 세션: r.세션.slice(0, 8), 말: 안.length, 찾음: 안.filter((m) => m.찾음).length, 넓게: 안.filter((m) => m.넓게).length, 훅: 안.filter((m) => m.훅).length });
    if (한세션만) for (const m of 안) console.log(`${한국(m.ts)} 찾음 ${m.찾음 ? 'o' : 'x'} 넓게 ${m.넓게 ? 'o' : 'x'} 훅 ${m.훅 ? 'o' : 'x'} · ${String(m.글).replace(/\s+/g, ' ').slice(0, 60)}`);
  }
  if (JSON출력) { console.log(JSON.stringify({ 부터: 부터.toISOString(), 까지: 까지.toISOString(), 합, 날별, 세션: 세션줄 }, null, 1)); return; }
  const 몫 = (a, b) => (b ? `${a}/${b}(${Math.round((a / b) * 100)}%)` : '0/0');
  console.log(`세션 ${합.세션}개 가운데 남은 일이나 유호님 차례를 말한 세션 ${합.말한세션}개(${한국(부터)} ~ ${한국(까지)})`);
  console.log(`그 말 ${합.말}번 — 같은 문맥에서 먼저 기록찾기를 돌림 ${몫(합.찾음, 합.말)} · 결정 표나 트랙을 직접 찾은 것까지 ${몫(합.넓게, 합.말)} · 지금 상태 훅이 넣은 글이 있음 ${몫(합.훅, 합.말)} · 기록찾기나 훅 ${몫(합.찾음또는훅, 합.말)}`);
  console.log(`  같은 차례(마지막 사람 말 뒤)만 보면 기록찾기 ${몫(합.차례, 합.말)} · 넓게 ${몫(합.차례넓게, 합.말)}`);
  console.log(`  유호님이 옛 내용을 바로잡은 말 ${합.바로잡음}번`);
  for (const [하루, d] of Object.entries(날별).sort()) console.log(`  ${하루} 말 ${d.말} · 기록찾기 ${몫(d.찾음, d.말)} · 넓게 ${몫(d.넓게, d.말)} · 훅 ${몫(d.훅, d.말)} · 바로잡음 ${d.바로잡음 || 0}`);
})();

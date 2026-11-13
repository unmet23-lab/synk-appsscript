#!/usr/bin/env node
'use strict';
/* 편 실측 — 한 편에 든 것(시간 · 유호님 말씀 · 굽기 · 심사 · 토큰)을 Claude 세션 기록에서 세어 한 줄로 남긴다(2026-11-13).
 *
 * 왜: 「하루 10편」의 잣대는 편당 유호님 손과 첫 판 통과율인데 재는 것이 없었다(11-11 검토 「지금은 이 숫자를 재지 않습니다」).
 *   11-13에는 취향을 한 번 여쭙는 빛 견본에 이틀 · 굽기 수십 차례 · 눈가림 심사 열네 번이 들도록 멈춘 숫자가 없었고, 유호님이
 *   「이걸 지금 왜 하고있는거야? 의미가 있어 ?」라고 물으셨다. 든 것을 편마다 같은 자로 재고, 선을 넘으면 계속하기 전에 먼저 알린다.
 *
 *   node tools/편실측.js 지금 --세션 <세션 id | 기록.jsonl>[,…] [--부터 <때>] [--편 "<편>"] [--json]
 *        일하는 중에 지금까지 든 것을 본다. 선을 넘었으면 끝 코드 2 — 다시 굽기 · 다시 심사 전에
 *        「무엇을 위해 · 지금까지 든 것 · 여기서 끊으면 잃는 것」을 유호님께 먼저 알린다.
 *   node tools/편실측.js 재기 --편 "<편>" --세션 <…> [--부터 <때>] [--까지 <때>] [--폴더 <작업 폴더>]
 *        [--단계 <단계>] [--장르 "<장르>"] [--결과 "<한 줄>"] [--적기] [--json]
 *        편을 닫을 때 든 것을 센다. --적기면 장부에 한 줄 덧붙인다(같은 편을 다시 적으면 표는 마지막 줄을 쓴다).
 *   node tools/편실측.js 표 [--json]            장부의 편들을 한 표로.
 *
 * 세션 id는 그 세션 스크래치패드 경로에서 scratchpad 바로 위 폴더 이름이다. <때>는 2026-11-11T19:43(한국 시각) 또는 …Z(UTC).
 *   한 세션에서 여러 편을 했으면 --부터 · --까지로 그 편의 구간만 잰다. 한 편이 여러 세션에 걸쳤으면 쉼표로 잇는다.
 *
 * 세는 것(곁가지 기록은 빼고, 구간 안에서):
 *   시간      벽시계(첫 줄 ~ 끝 줄)와 일한 시간 — Claude 답 줄 사이 틈이 5분 이하인 것만 더한다(굽기 · 심사를 기다린 시간, 멈춰 있던 시간은 빠진다).
 *   유호님    사람이 친 말씀 수 · 그 가운데 재개 말씀(「이어서 해」 · 「다시 시도해 주세요」) · 말씀 없이 가장 길게 일한 구간.
 *             유호님 손을 「분」으로 잴 길은 없어 횟수로 센다.
 *   굽기      Gemini 그림 차례(차례.py … 기다리기) · 영상 내기(크레딧내기 · 드리미나내기 --실행) 명령 수.
 *   심사      하위 에이전트(Agent) 호출을 설명 글로 갈라 맹검 · 검수 · 그 밖, 미학맹검.js 명령 수. 하위 에이전트의 토큰 · 걸린 시간은 끝 알림에서 읽는다.
 *   토큰      Claude 답의 출력 · 캐시 읽기 · 캐시 쓰기 — 메시지 id마다 한 번만(기록은 같은 사용량을 블록마다 되풀이해 적는다).
 *   압축      문맥이 압축돼 다시 시작한 횟수.
 *   받은 것   --폴더 아래 그림(png · jpg · webp) · 영상(mp4 · mov · webm) 파일 수 — 「받음」 폴더가 있으면 그 안만.
 * 선(가설 — 세 편의 값이 쌓이면 맞춘다): 굽기 10차례 · 심사 3번 · 유호님 말씀 없이 일한 4시간 · 출력 100만 토큰.
 * 한계: 웹에서 손으로 낸 판(Flow · 힉스필드 웹) · GPT가 낸 판 · GPT 그림 굽기는 세지 못한다. 굽기 수는 명령 글에 그 낱말이 든 횟수라 「많아야」로 읽는다.
 *   기록의 꼴(origin · attachment)은 Claude Code 판에 따라 바뀔 수 있다 — 값이 0으로만 나오면 꼴부터 본다.
 * 장부: docs/_ops/편실측.jsonl — 한 줄에 편 하나, 덧붙이기만. 말씀의 내용 · 도구 결과는 적지 않고 수만 적는다. 세션 id는 앞 여덟 자만.
 * 끝 코드: 0 됨 · 1 받지 않음(빠진 칸 · 못 찾은 기록) · 2 선을 넘음(「지금」만).
 * 시험: node --test tests/편실측.test.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const 뿌리 = path.resolve(__dirname, '..');
const 기본장부 = path.join(뿌리, 'docs', '_ops', '편실측.jsonl');
const 장부경로 = 'docs/_ops/편실측.jsonl';
const 기록뿌리 = () => path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
const 큰줄 = 400 * 1024;          // 그림이 든 줄 — 세는 것은 여기에 없다
const 쉬는틈 = 5 * 60 * 1000;     // 답 줄 사이가 이보다 길면 기다렸거나 멈춰 있던 시간으로 본다
const 선 = { 굽기: 10, 심사: 3, 말씀없이_일한_시간: 4, 출력_토큰: 1000000 };   // 가설 — 세 편 뒤에 맞춘다

// 새 굽기 길이 생기면 여기에 한 줄 — 이름 · 명령 글에서 찾을 무늬. 확인한 「실행하는 꼴」만 넣는다:
//   그 파일을 읽기만 한 명령(sed · grep)까지 세면 값이 부푼다(11-13 빛 견본 세션 — 미학맹검.js가 든 명령 9개 가운데 실행은 2개).
const 굽기무늬 = [
  ['Gemini 그림 차례', /python[^\n|;&]*차례[.]py[^\n]*기다리기/],
  ['영상 내기', /(드리미나내기|크레딧내기)[.]py[^\n]*--실행/],
];
const 미학맹검식 = /node\s+[^\n|;&]*미학맹검[.]js/;
const 압축식 = /^This session is being continued from a previous conversation/;
const 기계글식 = /^\s*(<system-reminder>|\[SYSTEM NOTIFICATION|<task-notification>|Another Claude session sent a message|<local-command|<command-name>)/;
const 재개식 = /^(이어서(\s*(해|해줘|하자|해 줘))?|계속(\s*(해|해줘|해 줘|하자))?|다시 시도해\s*주세요|continue|go on)[\s.!?~]*$/i;
const 알림식 = /<task-id>([^<]+)<\/task-id>[\s\S]*?<subagent_tokens>(\d+)<\/subagent_tokens>\s*<tool_uses>(\d+)<\/tool_uses>\s*<duration_ms>(\d+)<\/duration_ms>/g;
const 그림식 = /[.](png|jpe?g|webp)$/i;
const 영상식 = /[.](mp4|mov|webm)$/i;

class 받지않음 extends Error {}

function 인자(argv) {
  const o = { 명령: argv[0] || '', 적기: false, json: false };
  const 값있는 = ['세션', '부터', '까지', '편', '폴더', '단계', '장르', '결과', '장부', '때'];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--적기') { o.적기 = true; continue; }
    if (a === '--json') { o.json = true; continue; }
    const 이름 = a.startsWith('--') ? a.slice(2) : null;
    if (!값있는.includes(이름)) throw new 받지않음(`모르는 선택: ${a}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) throw new 받지않음(`${a} 뒤에 값이 없다`);
    o[이름] = v;
  }
  return o;
}

/** 「2026-11-11T19:43」(한국 시각) · 「…Z」 · 「…+09:00」 → ms */
function 때풀기(글, 무엇) {
  const s = String(글).trim();
  const ms = Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(s) ? s : `${s.length <= 10 ? `${s}T00:00` : s}+09:00`);
  if (!Number.isFinite(ms)) throw new 받지않음(`--${무엇}을 못 읽었다: ${글} — 2026-11-11T19:43(한국 시각)이나 …Z 꼴로`);
  return ms;
}

/** 세션 id나 경로 → 기록 파일. id면 ~/.claude/projects/<프로젝트>/<id>.jsonl을 찾는다 */
function 기록찾기(이름) {
  if (/[.]jsonl$/i.test(이름) || 이름.includes('/') || 이름.includes('\\')) {
    const f = path.resolve(이름);
    if (!fs.existsSync(f)) throw new 받지않음(`세션 기록이 없다: ${f}`);
    return f;
  }
  const 뿌리폴더 = 기록뿌리();
  const 폴더들 = fs.existsSync(뿌리폴더) ? fs.readdirSync(뿌리폴더, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  for (const d of 폴더들) {
    const f = path.join(뿌리폴더, d, `${이름}.jsonl`);
    if (fs.existsSync(f)) return f;
  }
  throw new 받지않음(`세션 「${이름}」의 기록을 ${뿌리폴더} 아래에서 못 찾았다 — 세션 id(스크래치패드 경로에서 scratchpad 바로 위 폴더 이름)나 .jsonl 경로를 준다`);
}

const 글뽑기 = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n') : '');

function 사용자종류(o, c, 글) {
  if (Array.isArray(c) && c.some((b) => b && b.type === 'tool_result')) return '도구결과';
  if (압축식.test(글.trim())) return '압축';
  const 꼴 = o.origin && typeof o.origin === 'object' ? o.origin.kind : null;
  if (꼴) return 꼴 === 'human' ? '사람' : '기계';
  if (o.isMeta || 기계글식.test(글)) return '기계';   // origin 칸이 없는 판 — 글 머리로 가른다
  return 글.trim() ? '사람' : '기계';
}

function 하위갈래(설명) {
  if (/맹검|눈가림|심사/.test(설명)) return '맹검';
  if (/검수|훑기|리뷰|review/i.test(설명)) return '검수';
  return '그밖';
}

function 새모음() {
  return { 첫: Infinity, 끝: -Infinity, 답시각: [], 말씀: [], 사용량: new Map(), 알림: new Map(), 압축: 0, 도구: 0,
    굽기: Object.fromEntries(굽기무늬.map(([이름]) => [이름, 0])), 하위: { 맹검: 0, 검수: 0, 그밖: 0 }, 미학맹검: 0 };
}

function 알림읽기(글, 모음) {
  if (!글 || !글.includes('subagent_tokens')) return;
  for (const m of 글.matchAll(알림식)) 모음.알림.set(m[1].trim(), { 토큰: Number(m[2]), ms: Number(m[4]) });   // 같은 일이 여러 번 알리면 마지막 값
}

async function 한기록(파일, 구간, 모음) {
  const 줄들 = readline.createInterface({ input: fs.createReadStream(파일, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const 줄 of 줄들) {
    if (!줄 || 줄[0] !== '{' || 줄.length > 큰줄) continue;
    let o;
    try { o = JSON.parse(줄); } catch { continue; }
    if (o.isSidechain) continue;
    const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (!Number.isFinite(ts) || ts < 구간.부터 || ts > 구간.까지) continue;
    const m = o.message || {};
    if (o.type === 'assistant') {
      모음.첫 = Math.min(모음.첫, ts); 모음.끝 = Math.max(모음.끝, ts);
      모음.답시각.push(ts);
      if (m.id && m.usage) 모음.사용량.set(m.id, m.usage);
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (!b || b.type !== 'tool_use') continue;
        모음.도구++;
        const i = b.input || {};
        if (b.name === 'Agent' || b.name === 'Task') 모음.하위[하위갈래(String(i.description || ''))]++;
        if (b.name === 'Bash' || b.name === 'PowerShell') {
          const 명령 = String(i.command || '');
          for (const [이름, 식] of 굽기무늬) if (식.test(명령)) 모음.굽기[이름]++;
          if (미학맹검식.test(명령)) 모음.미학맹검++;
        }
      }
    } else if (o.type === 'user') {
      const 글 = 글뽑기(m.content);
      const 종류 = 사용자종류(o, m.content, 글);
      if (종류 === '사람') { 모음.첫 = Math.min(모음.첫, ts); 모음.끝 = Math.max(모음.끝, ts); 모음.말씀.push({ ts, 재개: 재개식.test(글.trim()) }); }
      else if (종류 === '압축') 모음.압축++;
      else if (종류 === '기계') 알림읽기(글, 모음);
    } else if (o.type === 'attachment') {
      알림읽기(String((o.attachment && o.attachment.prompt) || ''), 모음);
    }
  }
}

/** 시각들(오름차순) 가운데 [부터, 까지] 안에서 이웃 틈이 쉬는틈 이하인 것만 더한 ms */
function 일한ms(시각들, 부터 = -Infinity, 까지 = Infinity) {
  let 합 = 0, 앞 = null;
  for (const t of 시각들) {
    if (t < 부터 || t > 까지) continue;
    if (앞 !== null && t - 앞 <= 쉬는틈) 합 += t - 앞;
    앞 = t;
  }
  return 합;
}

function 받은것(폴더) {
  const 시작 = fs.existsSync(path.join(폴더, '받음')) ? path.join(폴더, '받음') : 폴더;
  if (!fs.existsSync(시작)) throw new 받지않음(`--폴더가 없다: ${폴더}`);
  let 그림 = 0, 영상 = 0;
  const 훑기 = (d, 깊이) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (깊이 < 3) 훑기(path.join(d, e.name), 깊이 + 1); continue; }
      if (그림식.test(e.name)) 그림++; else if (영상식.test(e.name)) 영상++;
    }
  };
  훑기(시작, 0);
  return { 그림, 영상, 어디: path.basename(시작) === '받음' ? '받음 폴더' : '폴더 전체' };
}

const 시간 = (ms) => Math.round((ms / 3600000) * 10) / 10;

/** 세션 기록들 → 든 것. 구간 = {부터, 까지}(ms) */
async function 세기(파일들, 구간 = {}) {
  const 구 = { 부터: 구간.부터 ?? -Infinity, 까지: 구간.까지 ?? Infinity };
  const 모음 = 새모음();
  for (const f of 파일들) await 한기록(f, 구, 모음);
  if (!모음.답시각.length && !모음.말씀.length) throw new 받지않음('그 구간에 기록이 없다 — 세션과 --부터 · --까지를 본다');
  모음.답시각.sort((a, b) => a - b); 모음.말씀.sort((a, b) => a.ts - b.ts);
  const 경계 = [모음.첫, ...모음.말씀.map((x) => x.ts), 모음.끝];
  let 가장긴 = 0;
  for (let i = 0; i + 1 < 경계.length; i++) 가장긴 = Math.max(가장긴, 일한ms(모음.답시각, 경계[i], 경계[i + 1]));
  const 마지막말씀 = 모음.말씀.length ? 모음.말씀[모음.말씀.length - 1].ts : 모음.첫;
  const 토큰 = { 출력: 0, 캐시읽기: 0, 캐시쓰기: 0, 입력: 0 };
  for (const u of 모음.사용량.values()) {
    토큰.출력 += Number(u.output_tokens) || 0; 토큰.캐시읽기 += Number(u.cache_read_input_tokens) || 0;
    토큰.캐시쓰기 += Number(u.cache_creation_input_tokens) || 0; 토큰.입력 += Number(u.input_tokens) || 0;
  }
  const 알림들 = [...모음.알림.values()];
  const 굽기합 = Object.values(모음.굽기).reduce((a, b) => a + b, 0);
  const 심사합 = 모음.하위.맹검 + 모음.하위.검수 + 모음.미학맹검;
  const r = {
    부터: new Date(모음.첫).toISOString(), 까지: new Date(모음.끝).toISOString(),
    벽시계_시간: 시간(모음.끝 - 모음.첫), 일한_시간: 시간(일한ms(모음.답시각)),
    유호님_말씀: 모음.말씀.length, 재개_말씀: 모음.말씀.filter((x) => x.재개).length,
    말씀없이_가장_길게_일한_시간: 시간(가장긴), 마지막_말씀_뒤_일한_시간: 시간(일한ms(모음.답시각, 마지막말씀)),
    굽기: { ...모음.굽기, 합: 굽기합 },
    심사: { 하위_맹검: 모음.하위.맹검, 하위_검수: 모음.하위.검수, 미학맹검: 모음.미학맹검, 합: 심사합 },
    하위_에이전트: { 부름: 모음.하위.맹검 + 모음.하위.검수 + 모음.하위.그밖, 끝알림: 알림들.length, 토큰: 알림들.reduce((a, x) => a + x.토큰, 0), 시간: 시간(알림들.reduce((a, x) => a + x.ms, 0)) },
    토큰, 압축: 모음.압축, 도구_호출: 모음.도구,
  };
  r.선 = 선넘음(r);
  return r;
}

function 선넘음(r) {
  const 줄 = [];
  if (r.굽기.합 >= 선.굽기) 줄.push(`굽기 ${r.굽기.합}차례(선 ${선.굽기})`);
  if (r.심사.합 >= 선.심사) 줄.push(`심사 ${r.심사.합}번(선 ${선.심사})`);
  if (r.말씀없이_가장_길게_일한_시간 >= 선.말씀없이_일한_시간) 줄.push(`유호님 말씀 없이 ${r.말씀없이_가장_길게_일한_시간}시간 일함(선 ${선.말씀없이_일한_시간}시간)`);
  if (r.토큰.출력 >= 선.출력_토큰) 줄.push(`출력 ${수(r.토큰.출력)} 토큰(선 ${수(선.출력_토큰)})`);
  return 줄;
}

function 수(n) {
  if (n >= 1e8) return `${Math.round(n / 1e7) / 10}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4)}만`;
  return String(n);
}
const 한국 = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ');

function 글(r) {
  const 굽기줄 = 굽기무늬.map(([이름]) => `${이름} ${r.굽기[이름]}`).join(' · ');
  const 줄 = [
    `${r.편 ? `편 「${r.편}」 · ` : ''}${한국(r.부터)} ~ ${한국(r.까지)}(한국 시각)${r.세션 ? ` · 세션 ${r.세션.join(', ')}` : ''}`,
    `  시간      벽시계 ${r.벽시계_시간}시간 · 일한 시간 ${r.일한_시간}시간`,
    `  유호님    말씀 ${r.유호님_말씀}번(재개 ${r.재개_말씀}번) · 말씀 없이 가장 길게 일한 구간 ${r.말씀없이_가장_길게_일한_시간}시간 · 마지막 말씀 뒤 ${r.마지막_말씀_뒤_일한_시간}시간`,
    `  굽기      ${굽기줄}`,
    `  심사      하위 에이전트 맹검 ${r.심사.하위_맹검} · 검수 ${r.심사.하위_검수} · 미학맹검 ${r.심사.미학맹검} | 하위 에이전트 끝 알림 ${r.하위_에이전트.끝알림}건 · ${수(r.하위_에이전트.토큰)} 토큰 · ${r.하위_에이전트.시간}시간`,
    `  토큰      출력 ${수(r.토큰.출력)} · 캐시 읽기 ${수(r.토큰.캐시읽기)} · 캐시 쓰기 ${수(r.토큰.캐시쓰기)}`,
    `  그 밖     압축 ${r.압축}번 · 도구 호출 ${r.도구_호출}번${r.받은것 ? ` · 받은 그림 ${r.받은것.그림} · 영상 ${r.받은것.영상}(${r.받은것.어디})` : ''}`,
  ];
  if (r.결과) 줄.push(`  결과      ${r.결과}`);
  줄.push(r.선.length ? `  ⚠ 선을 넘었다 — ${r.선.join(' · ')}\n     다시 굽기 · 다시 심사 전에 「무엇을 위해 · 지금까지 든 것 · 여기서 끊으면 잃는 것」을 유호님께 먼저 알린다.` : '  선 안이다.');
  return 줄.join('\n');
}

function 읽기(장부) {
  if (!fs.existsSync(장부)) return [];
  return fs.readFileSync(장부, 'utf8').split(/\r?\n/).map((줄, i) => {
    if (!줄.trim()) return null;
    try { return JSON.parse(줄); } catch (e) { throw new Error(`${path.basename(장부)} ${i + 1}번째 줄이 JSON이 아니다: ${e.message}`); }
  }).filter(Boolean);
}

function 덧붙이기(장부, 사건) {
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  const 앞 = fs.existsSync(장부) ? fs.readFileSync(장부, 'utf8') : '';
  fs.appendFileSync(장부, `${앞 && !앞.endsWith('\n') ? '\n' : ''}${JSON.stringify(사건)}\n`, 'utf8');
}

/** 장부의 편마다 마지막 줄 — 적힌 차례 그대로 */
function 편들(사건들) {
  const 모음 = new Map();
  for (const e of 사건들) if (e && typeof e.편 === 'string') { 모음.delete(e.편); 모음.set(e.편, e); }
  return [...모음.values()];
}

function 표글(줄들) {
  if (!줄들.length) return '적힌 편이 없다 — 편을 닫을 때 「재기 … --적기」로 적는다.';
  const 머리 = '편 · 단계 | 벽시계 · 일한(시간) | 유호님 말씀(재개) | 굽기 | 심사 | 출력 토큰 | 결과';
  return [머리, ...줄들.map((e) => `${e.편}${e.단계 ? ` · ${e.단계}` : ''} | ${e.벽시계_시간} · ${e.일한_시간} | ${e.유호님_말씀}(${e.재개_말씀}) | ${e.굽기 ? e.굽기.합 : '—'} | ${e.심사 ? e.심사.합 : '—'} | ${e.토큰 ? 수(e.토큰.출력) : '—'} | ${e.결과 || '—'}`)].join('\n');
}

async function main(argv) {
  let o;
  try {
    o = 인자(argv);
    const 장부 = o.장부 ? path.resolve(o.장부) : 기본장부;
    if (o.명령 === '표') { const 줄들 = 편들(읽기(장부)); console.log(o.json ? JSON.stringify(줄들, null, 1) : 표글(줄들)); return 0; }
    if (o.명령 !== '지금' && o.명령 !== '재기') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(2).join('\n')); return o.명령 ? 1 : 0; }
    if (!o.세션) throw new 받지않음('--세션이 없다 — 세션 id(스크래치패드 경로에서 scratchpad 바로 위 폴더 이름)나 기록 .jsonl 경로');
    if (o.명령 === '재기' && !o.편) throw new 받지않음('--편이 없다');
    const 이름들 = o.세션.split(',').map((x) => x.trim()).filter(Boolean);
    const 파일들 = 이름들.map(기록찾기);
    const r = await 세기(파일들, { 부터: o.부터 ? 때풀기(o.부터, '부터') : undefined, 까지: o.까지 ? 때풀기(o.까지, '까지') : undefined });
    const 사건 = { 때: o.때 || new Date().toISOString(), 편: o.편 || '', ...(o.단계 ? { 단계: o.단계 } : {}), ...(o.장르 ? { 장르: o.장르 } : {}),
      세션: 파일들.map((f) => path.basename(f, '.jsonl').slice(0, 8)), ...r, ...(o.폴더 ? { 받은것: 받은것(path.resolve(o.폴더)) } : {}), ...(o.결과 ? { 결과: o.결과 } : {}) };
    console.log(o.json ? JSON.stringify(사건, null, 1) : 글(사건));
    if (o.명령 === '지금') return r.선.length ? 2 : 0;
    if (o.적기) {
      덧붙이기(장부, 사건);
      console.log(`장부에 적음 — ${path.relative(뿌리, 장부).split(path.sep).join('/')}`);
      if (!o.장부) {   // 정본 장부에 썼을 때만 — 공용 작업본이면 그 파일만 바로 올린다(워크트리는 그 세션의 커밋에 같이 올린다)
        const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
        const 올림 = 장부올리기글(await 장부올리기([장부경로], `chore(장부): 편 실측 — ${o.편}`), '편 실측 장부');
        if (올림) console.log(올림);
      }
    }
    return 0;
  } catch (e) {
    if (e instanceof 받지않음) { console.error(`받지 않음: ${e.message}`); return 1; }
    throw e;
  }
}

module.exports = { 세기, 선넘음, 편들, 읽기, 때풀기, 선 };
if (require.main === module) main(process.argv.slice(2)).then((코드) => { process.exitCode = 코드; }, (e) => { console.error(e); process.exitCode = 1; });

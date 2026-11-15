#!/usr/bin/env node
'use strict';
/**
 * 낡은 곳 — 바뀐 사실이 옛 모습으로 남은 줄과, 지금 상태처럼 읽히는 계획 표를 찾는다(2026-11-15).
 *
 * 왜: 11-15 업무 백업 세션이 설계 문서의 11-12 일정표 · 「여쭐 것」 표 · 4.12 계획 문장을 읽고, 이미 끝난 일(손님용 B2 가입, 화면 시안 고르기)을
 *   유호님께 다시 부탁드렸다. 그 일이 끝났다는 것은 결정 표와 트랙에만 적혔고, 그 사실을 옛 모습으로 적은 설계 문서는 그대로 남았다.
 *   유호님 「…매일 최신화하는게 많아 … 대부분의 세션이 그 전의 정보들을 읽고있더라고」 → 「응, 만들어」.
 *   그래서 결정이 바뀌는 push에서 옛 모습의 줄을 보이고(알림), 계획 표에는 「이 표는 ○월 ○일의 계획이다」 머리를 강제한다(막음).
 *
 * 넷(모두 tools/lib/git-publish-core.cjs가 바로올리기의 미리 보기와 --실행에서 올릴 판으로 한 번 돌린다):
 *   (가) 새 결정 행 → 옛 모습일 수 있는 줄 — 이 push가 결정 표에 더한 행의 [ ] 태그 「주제」 마디 낱말을 찾는다(넷 넘으면 절반 넘게, 셋 · 둘이면 모두).
 *        찾는 곳은 그 행이 가리키는 곳(경로가 없으면 그 태그 이름의 곳) · 이 push가 바꾼 곳의 md, 그리고 늘 읽히는 핵심 문서(낱말 모두).
 *        행의 「」 속 새 이름이나 「끝」이 든 줄, 이 push가 더한 줄은 뺀다. 알림만.
 *   (나) 물러난 낱말 — tools/lib/물러난말.json(더는 쓰지 않는 이름 · 방식)이 지금 읽히는 문서의 산문(백틱 · 링크 주소 밖)이나
 *        도구가 내보내는 글(문자열 속 띄어쓴 글)에 이 push로 더해지면 보인다. 표에 새 줄이 들어온 push에서는 그 꼴로 전체를 훑는다. 알림만.
 *        공개 관문이 믿는 tools/lib/거둔말.json과 떼어 둔다(Fable 5.2 설계 검토 D11 — 그 파일이 origin과 다르면 synk.im 공개가 멈춘다).
 *   (다) 사라진 길 — 이 push가 지우거나 옮긴 파일을 지금 읽히는 문서가 아직 가리키면, 또 더한 줄이 없는 저장소 경로를 가리키면 보인다. 알림만.
 *   (라) 계획 표 머리 — 이 push가 닿은 설계 문서(이름에 설계 · DESIGN · ROADMAP · 로드맵 · 계획 · PLAN)의 절 가운데 일정표와 「여쭐 것 · 유호님 차례」
 *        표 · 목록에 「이 표는 <날짜>의 계획이다 … 트랙」 줄이 없으면 막는다. 더한 줄이 닿은 절만 본다(손대지 않은 옛 절로 남의 push를 막지 않는다 — D5).
 *        검사 도구가 던지면 막지 않는다. 이 push와 무관하면 바로올리기 --계획표건너뜀 "<까닭>".
 *   「지금 읽히는 문서」 = AGENTS · CLAUDE · 운영 원칙 · 문서 지도 · AI 계정과 크레딧 · DESIGN · 스킬 · 에이전트 · 문서 지도가 가리키는 담당 원문
 *   (전체 점검은 Claude 메모까지, push 때는 저장소 안만). 기록류(docs/_ops · 현장 노트 · qa · QA · RESULTS · 보관 · 검토 · fable · 트렌드스캔 · 게시)는 빼고 본다.
 *
 *   node tools/낡은곳.js 점검 [--모두] [--json]           작업본 전체 — (나) · (다) · (라)를 한 번에(정리할 때, --모두면 담당 원문의 없는 경로까지)
 *   node tools/낡은곳.js 결정 <결정.md 줄번호…> [--판 <커밋>] [--곳 <폴더>]  그 행들을 새 행으로 보고 (가)를 그 판에서 돌린다(--곳 = push가 바꾼 곳)
 *   node tools/낡은곳.js 계획표 <md…>                      그 파일들의 (라) — 파일 전체를 본다
 *   node tools/낡은곳.js 재기 [--부터 <날짜>]               실제로 올린 push의 알림 줄(%LOCALAPPDATA%/synk/낡은곳/알림.jsonl) 가운데
 *                                                          지금 origin에서 고쳐진 몫 — 낮으면 알림이 소음이라는 뜻이라 끌지 정하는 근거다
 * 시험: node --test tests/낡은곳.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 칸나누기 } = require('./lib/표.js');
const 지금 = require('./지금상태.js');

const { 곳으로 } = 지금;
const 뿌리 = path.resolve(process.env.SYNK_낡은곳뿌리 || path.join(__dirname, '..'));
const 표길 = 'tools/lib/물러난말.json';

// ── 범위 ─────────────────────────────────────────────────────────────────

const 기록류 = [/^docs\/_ops\//, /^docs\/현장노트\//, /(^|\/)qa\//, /(^|\/)(QA|RESULTS|CHANGELOG)[^/]*\.md$/i, /(^|\/)보관\//,
  /(^|\/)(검토|fable|검수)\//, /^docs\/마케팅\/트렌드스캔\//, /(^|\/)node_modules\//, /^\.tmp\//, /(^|\/)게시\//];
const 기록인가 = (rel) => 기록류.some((re) => re.test(rel));
const 늘읽는 = ['AGENTS.md', 'CLAUDE.md', 'DESIGN.md', 'docs/AI_운영원칙.md', 'docs/문서_지도.md', 'docs/AI_계정과_크레딧.md'];
// 바깥에서 받아 그대로 두는 스킬(.claude/skills/외부반입_출처.md · 힉스필드 명령 도구) — 그 안의 경로는 그 스킬 저장소 기준이라 보지 않는다
const 바깥스킬 = /^\.claude\/skills\/(?:last30days|remotion-[^/]+|higgsfield-[^/]+)\//;
const 스킬인가 = (rel) => /^\.claude\/(skills|agents)\/.+\.md$/.test(rel) && !바깥스킬.test(rel);
/** 늘 읽히는 핵심(AGENTS · 운영 원칙 · 스킬 …) — 문서 지도가 가리키는 담당 원문 전체가 아니다. */
const 핵심문서 = (rel) => 늘읽는.includes(rel) || 스킬인가(rel);

/** md 글의 링크 → 저장소 상대 경로들(그 문서 자리에서 푼다). 앵커 · 바깥 주소는 버린다. */
function 링크들(글, 문서경로) {
  return 지금.줄길들(String(글).replace(/`[^`]*`/g, ' '), 문서경로);
}

/** 지금 읽히는 문서 — 파일 목록(저장소 상대)과 문서 지도 글로 정한다. */
function 읽히는문서들(파일목록, 지도글) {
  const 있음 = new Set(파일목록);
  const out = new Set(늘읽는.filter((p) => 있음.has(p)));
  for (const p of 파일목록) if (스킬인가(p)) out.add(p);
  for (const p of 지금.줄길들(지도글 || '', 'docs/문서_지도.md')) if (/\.md$/i.test(p) && 있음.has(p) && !기록인가(p)) out.add(p);
  return [...out].sort();
}

// ── 글 다루기 ────────────────────────────────────────────────────────────

/** 산문만 — 백틱 속, 링크 주소, 앵커, 주소, 주석을 지운다. */
function 산문(줄) {
  return String(줄).replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/<a [^>]*>/g, ' ').replace(/<!--.*?-->/g, ' ').replace(/https?:\/\/\S+/g, ' ');
}

/** 코드 한 줄에서 사람이 읽는 글(띄어쓴 문자열)만 — 주석과 키 · 이름 문자열은 뺀다. */
function 코드글(줄) {
  const 앞 = String(줄).replace(/^\s*(\/\/|#|\*).*$/, '').replace(/\s\/\/\s.*$/, '');
  const out = [];
  for (const m of 앞.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    if (/\S\s+\S/.test(s)) out.push(s);
  }
  return out.join(' ');
}

const 코드파일 = (rel) => /\.(?:js|mjs|cjs|py)$/.test(rel) && /^tools\//.test(rel);

// ── (가) 새 결정 행 → 옛 모습일 수 있는 줄 ────────────────────────────────

const 붙임 = /Claude|GPT|카본|그록|Fable|Opus|유호님|판단|말씀|승인|결정|요청|확정|반영|검수|후속|로컬|구현|실측|첫 측정/;
const 버릴낱말 = new Set(['준비', '정리', '하나', '둘', '셋', '넷', '것', '일', '판', '새', '옛', '뒤', '앞', '때', '곳', '방식', '기준', '방법', '쪽', '안']);
const 토씨 = /(?:와의|과의|에서|으로|에게|와|과|의|을|를|은|는|이|가|에|로|도|만)$/;

function 낱말로(마디) {
  const out = new Set();
  for (let w of String(마디).replace(/[()「」『』"'`[\]:,]/g, ' ').split(/\s+/)) {
    for (let k = 0; k < 2 && w.length > 2 && 토씨.test(w); k++) w = w.replace(토씨, '');
    if ([...w].length >= 2 && !버릴낱말.has(w)) out.add(w);
  }
  return [...out];
}

/** 낱말 수 → 한 줄에 들어야 할 수. 넷 넘으면 절반 넘게, 셋 · 둘이면 모두(D10 — 「둘 넘게」로 읽으면 무관한 문서가 145줄 걸렸다). */
const 필요수 = (n) => (n >= 4 ? Math.floor(n / 2) + 1 : n);

/** 결정 행 한 줄 → { 날, 태그, 이름, 주제, 낱말, 필요, 새이름, 곳들 } (태그가 없거나 낱말이 둘 아래면 null). */
function 행풀기(줄) {
  if (!/^\|\s*20\d\d-\d\d-\d\d\s*\|/.test(줄)) return null;
  const 칸 = 칸나누기(줄);
  const 결정 = 칸[2] || '';
  const 태그 = (/^\[([^\]]+)\]/.exec(결정) || [])[1];
  if (!태그) return null;
  const 마디 = 태그.split(/\s+·\s+/).map((s) => s.trim()).filter(Boolean);
  const 주제마디 = (마디.length > 1 ? 마디.slice(1) : 마디).filter((s) => !붙임.test(s));
  const 낱말 = 낱말로(주제마디.join(' '));
  if (낱말.length < 2) return null;
  const 새이름 = [...결정.matchAll(/「([^」]{2,30})」/g)].map((m) => m[1].replace(/[.。]$/, ''));
  const 곳들 = new Set();
  for (const p of 지금.줄길들(결정, 'docs/_ops/결정.md')) { const g = 곳으로(p); if (g) 곳들.add(g); }
  return { 날: 칸[0], 태그, 이름: 지금.첫마디(태그), 주제: 주제마디.join(' · '), 낱말, 필요: 필요수(낱말.length), 새이름, 곳들: [...곳들] };
}

/** 이름 → 곳들 — 지금 결정 표 · 트랙에서 그 이름으로 시작하고 경로를 품은 행 · 줄의 곳(D10 — 경로 없는 행). */
function 이름의곳들(이름, 결정글, 트랙글) {
  if (!이름) return [];
  const out = new Set();
  for (const r of [...지금.결정들(결정글), ...지금.트랙들(트랙글)]) {
    if (!r.이름 || !지금.이름맞음(r.이름, new Set([이름]))) continue;
    for (const p of r.길) { const g = 곳으로(p); if (g) out.add(g); }
  }
  return [...out];
}

const 끝표 = /(^|[\s|(「·*])끝($|[\s|).,·」*])|끝났|마쳤|확정|정했다|골랐|폐기|대신한다/;
// 앞으로 할 일로 적힌 줄(계획 · 여쭐 것)의 표시 — 같은 수의 낱말이면 이런 줄을 먼저 보인다
const 계획말 = /→|고른다|고르기|고르실|여쭐|여쭙|유호님 손|유호님이 |할 일|예정|주차|\d{1,2}-\d{1,2} ?~/;

/**
 * (가) — 새 행들에 대해 옛 모습일 수 있는 줄. 찾기(낱말들, 경로들) → [{ 경로, 줄, 글 }]는 git grep(판) 또는 시험용.
 *   찾는 곳: 그 행이 가리키는 곳(없으면 이름의 곳) + 이 push가 바꾼 곳(낱말 문턱) · 늘 읽히는 핵심 문서(낱말 모두).
 *   다른 제품의 담당 원문까지 넓히면 「화면 · 시안」 같은 낱말이 백 줄 넘게 걸렸다(11-15 b997a64e6에서 잼 — 120줄 가운데 업무 백업 폴더 밖이 107줄).
 *   더한줄: Map<경로, Set<줄 글>> — 이 push가 더한 줄(이미 고친 줄)은 뺀다.
 */
function 결정낡은줄({ 새행들, 찾기, 바뀐곳들 = [], 핵심 = [], 더한줄 = new Map(), 이름곳 = () => [], 한도 = 15 }) {
  const 결과 = [];
  for (const 줄 of 새행들) {
    const r = 행풀기(줄);
    if (!r) continue;
    const 행곳 = r.곳들.length ? r.곳들 : 이름곳(r.이름);
    const 곳들 = [...new Set([...행곳, ...바뀐곳들])].filter((g) => !/^docs\/_ops/.test(g));
    const 범위 = [...곳들, ...핵심];
    if (!범위.length) continue;
    const 걸림 = [];
    for (const x of 찾기(r.낱말, 범위)) {
      if (!/\.md$/i.test(x.경로) || 기록인가(x.경로)) continue;
      const 곳안 = 곳들.some((g) => x.경로 === g || x.경로.startsWith(`${g}/`));
      if (!곳안 && !핵심.includes(x.경로)) continue;
      const 글 = 산문(x.글);
      const 든 = r.낱말.filter((w) => 글.includes(w)).length;
      if (든 < (곳안 ? r.필요 : r.낱말.length)) continue;
      if (r.새이름.some((n) => x.글.includes(n)) || 끝표.test(x.글)) continue;
      if ((더한줄.get(x.경로) || new Set()).has(x.글)) continue;
      const 행의곳 = 행곳.some((g) => x.경로.startsWith(`${g}/`));
      걸림.push({ ...x, 점: 든 * 2 + (계획말.test(글) ? 1 : 0) + (행의곳 ? 1 : 0) + (행의곳 && /설계|DESIGN|ROADMAP|로드맵/i.test(x.경로) ? 1 : 0) });
    }
    // 경로 순서는 'ko'로 못 박는다 — 기본 로캘에 맡기면 이 PC(ko-KR)와 리눅스 CI(en-US)의 순서가 갈린다(지금상태.js 2536d28fa와 같은 함정, 11-16)
    걸림.sort((a, b) => b.점 - a.점 || a.경로.localeCompare(b.경로, 'ko') || a.줄 - b.줄);
    if (걸림.length) 결과.push({ 날: r.날, 태그: r.태그, 주제: r.주제, 수: 걸림.length, 넓음: 걸림.length > 한도, 걸림: 걸림.slice(0, 3), 모두: 걸림 });
  }
  return 결과;
}

// ── (나) 물러난 낱말 ──────────────────────────────────────────────────────

// 물러났다는 사실을 적은 줄 — 그 낱말 바로 곁(앞 12자 · 뒤 24자)에 이런 말이 있을 때만. 「않는다 · 대신」은 흔해서 넣지 않는다(검수 도구의 「아르곤이 … 보내지 않는다」가 빠졌다)
const 물러났다고 = /쓰지 않|안 쓴|옛 ?이름|옛 |바꾸지 않|거둔|물러난|이었다|였다|바꿨|바뀌었|부르던|남은 옛/;

function 물러난표(글) {
  try {
    const 표 = JSON.parse(글).말 || [];
    return 표.map((x) => ({ ...x, 틀: new RegExp(x.꼴) }));
  } catch { return []; }
}

/** 줄에 적힌 날짜 가운데 그 결정 날짜이거나 그보다 앞선 것이 있나 — 있으면 그 줄은 그때의 기록이다(11-11 이름을 바꾸기 전의 「아르곤 검수」 따위). */
function 앞선날짜(글, 결정날) {
  if (!결정날) return false;
  const 기준 = String(결정날).slice(5);   // MM-DD
  for (const m of String(글).matchAll(/(?:20\d\d-)?(\d{1,2})-(\d{1,2})(?![\d])|(\d{1,2})월 ?(\d{1,2})일/g)) {
    const 월 = Number(m[1] || m[3]), 일 = Number(m[2] || m[4]);
    if (월 < 1 || 월 > 12 || 일 < 1 || 일 > 31) continue;
    if (`${String(월).padStart(2, '0')}-${String(일).padStart(2, '0')}` <= 기준) return true;   // 바꾼 그날의 줄도 기록으로 본다
  }
  return false;
}

/** (나) — 줄들([{ 경로, 줄, 글 }]) 가운데 물러난 낱말이 든 것. md는 산문, 도구 코드는 문자열 속 띄어쓴 글만 본다. 그 결정 앞 날짜가 적힌 줄은 기록으로 본다. */
function 물러난말({ 표, 줄들 }) {
  const 걸림 = [];
  for (const x of 줄들) {
    const 코드 = 코드파일(x.경로);
    // 「」 속은 남의 말 · 이름을 옮긴 인용이라 보지 않는다(「예약작업 … 아르곤이라고 뜨네」)
    const 볼글 = 코드 ? 코드글(x.글) : 산문(x.글).replace(/「[^」]*」/g, ' ');
    if (!볼글.trim()) continue;
    for (const e of 표) {
      if (코드 && !e.코드) continue;
      const m = e.틀.exec(볼글);
      if (!m || 물러났다고.test(볼글.slice(Math.max(0, m.index - 12), m.index + m[0].length + 24)) || (!코드 && 앞선날짜(x.글, e.결정))) continue;
      걸림.push({ ...x, 낱말: m[0], 까닭: e.까닭 });
      break;
    }
  }
  return 걸림;
}

// ── (다) 사라진 길 ───────────────────────────────────────────────────────

const 길머리 = /(?:^|[\s(「'"])((?:tools|docs|tests|experiences|desktop|packages|\.claude)\/[^\s'"<>*…{}$,)(·|`]+)/g;

/** 한 줄이 가리키는 저장소 경로들 — 백틱 속 경로와 md 링크. 자리 표시(꺾쇠 · 별표 · 말줄임)와 「없다 · 지웠다」고 적은 경로는 뺀다. */
function 줄의길들(글, 문서경로) {
  const out = new Set();
  for (const m of String(글).matchAll(/`([^`\n]+)`/g)) {
    if (/없다|지웠다|없앴|옮겼/.test(String(글).slice(m.index + m[0].length, m.index + m[0].length + 24))) continue;
    for (const k of m[1].matchAll(길머리)) {
      const p = k[1].replace(/#.*$/, '').replace(/:\d+(?:[-~]\d+)?$/, '').replace(/[.:;]+$/, '');
      if (p && /\.[A-Za-z0-9]{1,5}$/.test(p)) out.add(p);
    }
  }
  if (/\.md$/i.test(문서경로)) for (const p of 링크들(글, 문서경로)) if (/\.[A-Za-z0-9]{1,5}$/.test(p) && !/[<>*…{}$]/.test(p)) out.add(p);
  return [...out];
}

// ── (라) 계획 표 머리 ─────────────────────────────────────────────────────

const 설계문서 = (rel) => /\.md$/i.test(rel) && /설계|DESIGN|ROADMAP|로드맵|계획|PLAN/i.test(path.posix.basename(rel)) && !기록인가(rel);
const 일정머리 = /일정/;
const 여쭐머리 = /여쭐|유호님 ?(?:차례|손|께)/;
const 시간칸 = /^(?:주|주차|때|날짜|날|기한|언제|시기|기간|마감|일정|목표일|목표)$/;
const 날꼴 = /^(?:\d{1,2}-\d{1,2}|\d{1,2}월|\d+주차|\d{4}-\d\d|\d{1,2}\/\d{1,2})/;
const 계획머리줄 = /이 (?:표|목록)[는은] .{0,40}?(?:\d{1,2}월 ?\d{1,2}일|\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2})[의 ]*계획이다/;

/**
 * (라) — 그 문서의 계획 표 · 목록 가운데 머리 줄이 없는 것 [{ 줄, 머리 }]. 설계 문서가 아니면 [].
 *   닿은줄: Set<줄 번호>(1부터) — 주면 그 줄이 든 절만 본다(없으면 파일 전체).
 */
function 계획표검사(경로, 글, { 닿은줄 = null } = {}) {
  if (!설계문서(경로)) return [];
  const 줄 = String(글 || '').split(/\r?\n/);
  const 걸림 = [];
  // 표 · 목록 덩어리마다 그것이 든 절을 바깥으로 따라 올라간다(GPT 검수 GA2 · GA3, 다시 검수 GA1 · GA3 · GA4).
  //   위의 절 가운데 「여쭐 것 · 유호님 차례」가 있으면 모든 표와 목록, 「일정」이 있으면 시간 칸이 있는 표가 계획 표다.
  //   머리 줄은 그 덩어리 앞, 그 덩어리를 품은 절들(가장 바깥의 맞는 절까지)의 제 글에 있어야 한다 — 옆 하위 절의 머리 줄은 치지 않는다.
  let 울 = false;
  const 머리들 = [];   // { 자리, 수준, 제목, 위: 품은 머리 번호(-1 = 없음) }
  const 울안 = [], 속절 = [];   // 줄마다: 코드 울타리 안인가 · 그 줄이 든 가장 안쪽 머리 번호
  줄.forEach((l, i) => {
    const 울타리 = /^\s*```/.test(l);
    if (울타리) 울 = !울;
    울안[i] = 울 || 울타리;
    const m = !울안[i] && /^(#{2,4}) (.*)$/.exec(l);
    if (m) {
      const 수준 = m[1].length;
      let 위 = 머리들.length - 1;
      while (위 >= 0 && 머리들[위].수준 >= 수준) 위 = 머리들[위].위;
      머리들.push({ 자리: i, 수준, 제목: m[2].trim(), 위 });
    }
    속절[i] = 머리들.length - 1;
  });
  const 끝 = (k) => { for (let j = k + 1; j < 머리들.length; j++) if (머리들[j].수준 <= 머리들[k].수준) return 머리들[j].자리; return 줄.length; };
  const 조상들 = (k) => { const r = []; for (let j = k; j >= 0; j = 머리들[j].위) r.push(j); return r; };   // 자기부터 바깥으로
  const 표줄 = (i) => i >= 0 && i < 줄.length && /^\s*\|/.test(줄[i]);
  const 목록줄 = (i) => i >= 0 && i < 줄.length && /^\s*(?:[-*]|\d+\.)\s+\S/.test(줄[i]);
  const 시간표 = (i) => {
    const 머리칸 = (칸나누기(줄[i])[0] || '').replace(/\*/g, '').trim();
    const 첫칸들 = [];
    for (let j = i + 2; 표줄(j) && 첫칸들.length < 4; j++) 첫칸들.push((칸나누기(줄[j])[0] || '').replace(/\*/g, '').trim());
    return 시간칸.test(머리칸) || (첫칸들.length > 0 && 첫칸들.every((c) => 날꼴.test(c)));
  };
  const 닿음 = 닿은줄 ? [...닿은줄].map((n) => n - 1) : null;
  const 걸린머리 = new Set();
  for (let i = 0; i < 줄.length; i++) {
    if (울안[i] || 속절[i] < 0) continue;
    const 표 = 표줄(i) && !표줄(i - 1) && i + 1 < 줄.length && /^\s*\|[\s:|-]+\|\s*$/.test(줄[i + 1]);
    const 목록 = !표 && 목록줄(i) && !목록줄(i - 1);
    if (!표 && !목록) continue;
    const 위들 = 조상들(속절[i]);
    const 여쭐위 = 위들.filter((j) => 여쭐머리.test(머리들[j].제목));
    const 일정위 = 위들.filter((j) => 일정머리.test(머리들[j].제목));
    if (!(여쭐위.length || (표 && 일정위.length && 시간표(i)))) continue;
    const 바깥 = 위들.filter((j) => 여쭐위.includes(j) || 일정위.includes(j)).pop();
    if (닿음 && !닿음.some((n) => n >= 머리들[바깥].자리 && n < 끝(바깥))) continue;
    let 머리있음 = false;
    for (let L = 머리들[바깥].자리 + 1; L < i && !머리있음; L++) {
      if (!울안[L] && 위들.includes(속절[L]) && 계획머리줄.test(줄[L]) && /트랙/.test(줄[L])) 머리있음 = true;
    }
    if (머리있음 || 걸린머리.has(속절[i])) continue;
    걸린머리.add(속절[i]);
    걸림.push({ 줄: 머리들[속절[i]].자리 + 1, 머리: 머리들[속절[i]].제목 });
  }
  return 걸림;
}

const 계획머리안내 = '그 절의 표 · 목록 앞에 「이 표는 11월 12일의 계획이다. 지금 상태는 [트랙](…/docs/_ops/트랙.md)에 있다.」 한 줄을 넣는다(날짜는 그 계획을 세운 날). 끝난 줄은 칸에 「끝」으로 적는다';

// ── push 때 ──────────────────────────────────────────────────────────────

/** diff -U0 글 → Map<경로, { 글: Set<더한 줄>, 번호: Set<새 줄 번호> }> */
function 더한줄읽기(글) {
  const out = new Map();
  let 경로 = null, 번호 = 0;
  for (const l of String(글).split('\n')) {
    if (l.startsWith('diff --git ')) { 경로 = null; continue; }
    if (l.startsWith('+++ ')) { 경로 = l.slice(4).replace(/^"|"$/g, '').replace(/^b\//, ''); if (경로 === '/dev/null') 경로 = null; continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (h) {
      번호 = Number(h[1]);
      // 지우기만 한 덩어리(+c,0)도 그 자리를 닿은 줄로 센다 — 머리 줄만 지운 push가 계획표 검사를 지나가지 않게(GPT 검수 GA1)
      if (경로 && h[2] === '0') {
        if (!out.has(경로)) out.set(경로, { 글: new Set(), 번호: new Set() });
        out.get(경로).번호.add(번호); out.get(경로).번호.add(번호 + 1);
      }
      continue;
    }
    if (경로 && l.startsWith('+')) {
      if (!out.has(경로)) out.set(경로, { 글: new Set(), 번호: new Set() });
      out.get(경로).글.add(l.slice(1).replace(/\r$/, ''));
      out.get(경로).번호.add(번호++);
    }
  }
  return out;
}

const 그렙줄 = (글) => String(글).split('\n').map((l) => /^[^:]+:(.+?):(\d+):(.*)$/.exec(l)).filter(Boolean).map((m) => ({ 경로: m[1], 줄: Number(m[2]), 글: m[3].replace(/\r$/, '') }));

/** git grep(판)으로 찾기 — 낱말 가운데 하나라도 든 줄. */
function git찾기(git, 판) {
  return (낱말, 범위) => {
    if (!낱말.length || !범위.length) return [];
    try { return 그렙줄(git(['-c', 'core.quotePath=false', 'grep', '-n', '-I', '--no-color', '-F', ...낱말.flatMap((w) => ['-e', w]), 판, '--', ...범위])); } catch { return []; }
  };
}

const 줄임 = (s, n = 60) => { const g = [...String(s).replace(/\s+/g, ' ').trim()]; return g.length > n ? `${g.slice(0, n - 1).join('')}…` : g.join(''); };

/**
 * push 한 번의 검사 — { 알림: [글…], 막음: [{ 경로, 줄, 머리 }] }. git(args) → 문자열. 어디서 실패해도 던지지 않는다(알림이 빠질 뿐, 막지 않는다).
 *   O: origin 판, 머리: 올릴 판.
 */
function push검사({ git, O, 머리 }) {
  const 알림 = [], 막음 = [];
  const 항목 = [];   // 세션에 보인 줄 하나하나 — 알림남기기가 적고 알림재기가 「그 줄이 나중에 고쳐졌나」를 본다
  const 항목더하기 = (종류, 경로, 글) => { if (경로 && 글 && 항목.length < 40) 항목.push({ 종류, 경로, 글: String(글).replace(/\r$/, '') }); };
  const 해 = (이름, f) => { try { f(); } catch (e) { 알림.push(`(${이름}을 보지 못했다: ${줄임(e.message, 80)})`); } };
  const 보기 = (p) => { try { return git(['show', `${머리}:${p}`]); } catch { return ''; } };
  let 상태줄 = [];
  해('바뀐 파일', () => { 상태줄 = git(['-c', 'core.quotePath=false', 'diff', '--name-status', '-M', '--no-color', O, 머리]).split('\n').filter(Boolean).map((l) => l.split('\t')); });
  if (!상태줄.length) return { 알림, 막음 };
  const 바뀐 = [], 지운 = [], 새파일 = new Set();
  for (const [s, a, b] of 상태줄) {
    if (s.startsWith('D')) 지운.push(a);
    else if (s.startsWith('R')) { 지운.push(a); 바뀐.push(b); }
    else { 바뀐.push(a); if (s.startsWith('A')) 새파일.add(a); }
  }
  let 더한 = new Map();
  해('더한 줄', () => { 더한 = 더한줄읽기(git(['-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', O, 머리, '--', ...바뀐])); });
  const 더한글 = new Map([...더한].map(([p, v]) => [p, v.글]));
  let 목록 = [];
  해('파일 목록', () => { 목록 = git(['-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', 머리]).split('\n').filter(Boolean); });
  const 있음 = new Set(목록);
  const 읽히는 = 읽히는문서들(목록, 보기('docs/문서_지도.md'));
  const 읽힘 = new Set(읽히는);
  const 찾기 = git찾기(git, 머리);

  // (라) 계획 표 머리 — 이 push가 닿은 절만, 막는 검사
  for (const p of 바뀐) {
    if (!설계문서(p)) continue;
    해('계획 표', () => { for (const x of 계획표검사(p, 보기(p), { 닿은줄: 새파일.has(p) ? null : (더한.get(p) || {}).번호 || new Set() })) 막음.push({ 경로: p, ...x }); });
  }

  // (가) 새 결정 행
  해('새 결정 행', () => {
    const 앞 = new Set(String((() => { try { return git(['show', `${O}:docs/_ops/결정.md`]); } catch { return ''; } })()).split(/\r?\n/));
    const 새행들 = [...(더한글.get('docs/_ops/결정.md') || [])].filter((l) => /^\|\s*20\d\d-/.test(l) && !앞.has(l));
    if (!새행들.length) return;
    const 결정글 = 보기('docs/_ops/결정.md'), 트랙글 = 보기('docs/_ops/트랙.md');
    const 바뀐곳들 = [...new Set(바뀐.map((p) => 곳으로(p)).filter(Boolean))];
    for (const x of 결정낡은줄({ 새행들, 찾기, 바뀐곳들, 핵심: 읽히는.filter(핵심문서), 더한줄: 더한글, 이름곳: (이름) => 이름의곳들(이름, 결정글, 트랙글) })) {
      if (!x.넓음) for (const y of x.걸림) 항목더하기('결정', y.경로, y.글);
      알림.push(`결정 「${줄임(x.주제, 40)}」(${x.날.slice(5)})와 낱말이 겹치는데 이번 push에서 그대로인 줄 ${x.수}개${x.넓음 ? ' — 낱말이 넓어 줄은 보이지 않는다' : ` — ${x.걸림.map((y) => `${y.경로}:${y.줄} 「${줄임(산문(y.글).replace(/^[\s|>*#-]+/, ''), 40)}」`).join(' · ')}`}. 옛 모습이면 그 줄을 고치거나 표 머리에 날짜를 단다(전체: node tools/낡은곳.js 결정 <줄번호>)`);
    }
  });

  // (나) 물러난 낱말
  해('물러난 낱말', () => {
    const 표 = 물러난표(보기(표길));
    if (!표.length) return;
    const 줄들 = [];
    for (const [p, 글들] of 더한글) {
      if (!(읽힘.has(p) || 코드파일(p))) continue;
      for (const 글 of 글들) 줄들.push({ 경로: p, 줄: null, 글 });
    }
    const 걸림 = 물러난말({ 표, 줄들 });
    for (const x of 걸림.slice(0, 3)) 항목더하기('낱말', x.경로, x.글);
    if (걸림.length) 알림.push(`물러난 낱말이 든 줄을 더했다 ${걸림.length}개 — ${걸림.slice(0, 3).map((x) => `${x.경로} 「${x.낱말}」(${줄임(x.까닭, 40)})`).join(' · ')}`);
    // 표에 새 줄이 들어왔으면 그 꼴로 전체를 한 번 훑는다
    if (바뀐.includes(표길)) {
      let 앞표글 = '';
      try { 앞표글 = git(['show', `${O}:${표길}`]); } catch { 앞표글 = ''; }
      const 앞꼴 = new Set(물러난표(앞표글).map((x) => x.꼴));
      for (const e of 표.filter((x) => !앞꼴.has(x.꼴))) {
        let 글 = '';
        try { 글 = git(['-c', 'core.quotePath=false', 'grep', '-n', '-I', '--no-color', '-P', '-e', e.꼴, 머리, '--', ...읽히는, ...(e.코드 ? ['tools'] : [])]); } catch { 글 = ''; }
        const 걸 = 물러난말({ 표: [e], 줄들: 그렙줄(글).filter((x) => 읽힘.has(x.경로) || 코드파일(x.경로)) });
        for (const x of 걸.slice(0, 4)) 항목더하기('낱말', x.경로, x.글);
        if (걸.length) 알림.push(`물러난 낱말 표에 더한 「${e.꼴}」이 지금 ${걸.length}줄에 있다 — ${걸.slice(0, 4).map((x) => `${x.경로}:${x.줄}`).join(' · ')}${걸.length > 4 ? ' …' : ''} (전체: node tools/낡은곳.js 점검)`);
      }
    }
  });

  // (다) 사라진 길
  해('사라진 길', () => {
    for (const p of 지운) {
      if (있음.has(p)) continue;
      let 글 = '';
      try { 글 = git(['-c', 'core.quotePath=false', 'grep', '-n', '-I', '--no-color', '-F', '-e', p, 머리, '--', ...읽히는]); } catch { 글 = ''; }
      const 줄들 = 그렙줄(글);
      for (const x of 줄들.slice(0, 3)) 항목더하기('길', x.경로, x.글);
      if (줄들.length) 알림.push(`이 push가 지우거나 옮긴 ${p}를 지금 읽히는 문서 ${줄들.length}줄이 아직 가리킨다 — ${줄들.slice(0, 3).map((x) => `${x.경로}:${x.줄}`).join(' · ')}`);
    }
    const 폴더 = new Set();
    for (const f of 목록) { let d = path.posix.dirname(f); while (d && d !== '.' && !폴더.has(d)) { 폴더.add(d); d = path.posix.dirname(d); } }
    const 없는 = [];
    for (const [p, 글들] of 더한글) {
      if (!읽힘.has(p)) continue;
      for (const 글 of 글들) for (const 길 of 줄의길들(글, p)) if (!있음.has(길) && !폴더.has(길)) { if (없는.length < 3) 항목더하기('길', p, 글); 없는.push(`${p} → ${길}`); }
    }
    if (없는.length) 알림.push(`더한 줄이 없는 파일을 가리킨다 ${없는.length}곳 — ${없는.slice(0, 3).join(' · ')}`);
  });
  return { 알림: 알림.slice(0, 12), 막음, 항목 };
}

// ── 알림이 고침으로 이어졌나 ─────────────────────────────────────────────
// 알림이 소음이면 끈다 — 그 판단을 숫자로 하려고, 실제로 올린 push의 알림 줄을 남기고 나중에 그 줄이 그대로인지 본다(업무 백업 세션 11-15 부탁).

const 알림폴더 = () => process.env.SYNK_낡은곳폴더 || path.join(process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), '.local'), 'synk', '낡은곳');
const 알림파일 = () => path.join(알림폴더(), '알림.jsonl');

/** 실제로 올린 push의 알림 줄을 남긴다. 던지지 않는다. */
function 알림남기기(항목, { 머리 = null, 때 = Date.now() } = {}) {
  if (!Array.isArray(항목) || !항목.length) return false;
  try {
    fs.mkdirSync(알림폴더(), { recursive: true });
    const 줄들 = 항목.map((x) => JSON.stringify({ 때: new Date(때).toISOString(), 머리: 머리 ? String(머리).slice(0, 12) : null, ...x }));
    fs.appendFileSync(알림파일(), `${줄들.join('\n')}\n`);
    return true;
  } catch { return false; }
}

/**
 * 남긴 알림 줄마다 지금 판(origin)에서 그 줄이 그대로인지 본다 — { 전체, 고쳐짐, 그대로, 파일없음, 종류별 }.
 *   같은 경로 · 같은 글은 하나로 센다(같은 알림이 여러 push에 나온다). 그 줄의 글이 그 파일에 더는 없으면 고쳐진 것으로 센다.
 */
function 알림재기({ git, 판, 부터 = 0, 까지 = Infinity, 글 = null }) {
  let 원 = 글;
  if (원 == null) { try { 원 = fs.readFileSync(알림파일(), 'utf8'); } catch { 원 = ''; } }
  const 고유 = new Map();
  for (const l of String(원).split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    const t = Date.parse(o.때 || '');
    if (!(t >= 부터 && t < 까지) || !o.경로 || !o.글) continue;
    const k = `${o.경로}\n${o.글}`;
    if (!고유.has(k)) 고유.set(k, o);
  }
  const 파일글 = new Map();
  const 읽기 = (p) => {
    if (!파일글.has(p)) { let s = null; try { s = git(['show', `${판}:${p}`]); } catch { s = null; } 파일글.set(p, s == null ? null : new Set(String(s).split(/\r?\n/))); }
    return 파일글.get(p);
  };
  const 합 = { 전체: 0, 고쳐짐: 0, 그대로: 0, 파일없음: 0, 종류별: {} };
  for (const o of 고유.values()) {
    const 줄들 = 읽기(o.경로);
    const 값 = 줄들 == null ? '파일없음' : 줄들.has(o.글) ? '그대로' : '고쳐짐';
    합.전체++; 합[값]++;
    const d = 합.종류별[o.종류] || (합.종류별[o.종류] = { 전체: 0, 고쳐짐: 0, 그대로: 0, 파일없음: 0 });
    d.전체++; d[값]++;
  }
  return 합;
}

// ── 작업본 전체 점검 ─────────────────────────────────────────────────────

function 메모폴더() {
  try { return require('./기록찾기.js').메모점검().폴더; } catch { return null; }
}

/**
 * 작업본 전체 — (나)는 지금 읽히는 문서 · 메모 · 도구 출력 글, (다)는 늘 읽히는 핵심 · 우리 스킬 · 메모(모두면 담당 원문까지), (라)는 설계 문서 전부.
 *   담당 원문의 없는 경로는 다른 저장소(SYNK-talk) 파일을 앞머리 없이 적은 것이 많아(11-15 잼 — 272개 문서에 452곳, 한 문서에 199곳) 기본에서 뺀다.
 */
function 전체점검(저장소 = 뿌리, { 모두 = false } = {}) {
  const git = (args) => execFileSync('git', ['-C', 저장소, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const 목록 = git(['-c', 'core.quotePath=false', 'ls-files']).split('\n').filter(Boolean);
  const 있음 = new Set(목록);
  const 폴더 = new Set();
  for (const f of 목록) { let d = path.posix.dirname(f); while (d && d !== '.' && !폴더.has(d)) { 폴더.add(d); d = path.posix.dirname(d); } }
  const 읽기 = (p) => { try { return fs.readFileSync(path.join(저장소, p), 'utf8'); } catch { return ''; } };
  const 읽히는 = 읽히는문서들(목록, 읽기('docs/문서_지도.md'));
  const 표 = 물러난표(읽기(표길));
  const 메모 = 메모폴더();
  const 메모파일들 = 메모 && fs.existsSync(메모) ? fs.readdirSync(메모).filter((f) => f.endsWith('.md')).map((f) => path.join(메모, f)) : [];
  const 줄로 = (경로, 글) => String(글).split(/\r?\n/).map((l, i) => ({ 경로, 줄: i + 1, 글: l }));
  const 문서줄 = [...읽히는.flatMap((p) => 줄로(p, 읽기(p))), ...메모파일들.flatMap((f) => 줄로(`메모/${path.basename(f)}`, fs.readFileSync(f, 'utf8')))];
  const 코드줄 = 표.some((e) => e.코드) ? 목록.filter(코드파일).flatMap((p) => 줄로(p, 읽기(p))) : [];
  const 물러남 = 물러난말({ 표, 줄들: [...문서줄, ...코드줄] });
  const 사라짐 = [];
  for (const x of 문서줄) {
    const 메모줄 = x.경로.startsWith('메모/');
    if (!모두 && !메모줄 && !핵심문서(x.경로)) continue;
    for (const 길 of 줄의길들(x.글, 메모줄 ? 'x.txt' : x.경로)) {
      if (!있음.has(길) && !폴더.has(길) && !fs.existsSync(path.join(저장소, 길))) 사라짐.push({ ...x, 길 });
    }
  }
  const 계획표 = 목록.filter(설계문서).flatMap((p) => 계획표검사(p, 읽기(p)).map((x) => ({ 경로: p, ...x })));
  return { 읽히는: 읽히는.length, 메모: 메모파일들.length, 물러남, 사라짐, 계획표 };
}

function main() {
  const args = process.argv.slice(2);
  const 명령 = args[0];
  const json = args.includes('--json');
  if (명령 === '점검') {
    const r = 전체점검(뿌리, { 모두: args.includes('--모두') });
    if (json) { console.log(JSON.stringify(r, null, 1)); return 0; }
    console.log(`지금 읽히는 문서 ${r.읽히는}개 · 메모 ${r.메모}개를 봤다.`);
    console.log(`\n■ 물러난 낱말 ${r.물러남.length}줄`);
    for (const x of r.물러남) console.log(`  ${x.경로}:${x.줄} 「${x.낱말}」 — ${줄임(x.까닭, 50)}`);
    console.log(`\n■ 없는 파일을 가리키는 줄 ${r.사라짐.length}곳`);
    for (const x of r.사라짐) console.log(`  ${x.경로}:${x.줄} → ${x.길}`);
    console.log(`\n■ 머리 줄이 없는 계획 표 ${r.계획표.length}곳 (그 절을 고치는 push가 막힌다)`);
    for (const x of r.계획표) console.log(`  ${x.경로}:${x.줄} ${줄임(x.머리, 60)}`);
    return 0;
  }
  if (명령 === '결정') {
    const k = args.indexOf('--판');
    const 판 = k >= 0 ? args[k + 1] : 'HEAD';
    const 곳들 = args.flatMap((a, i) => (args[i - 1] === '--곳' ? [a] : []));
    const 번호들 = args.slice(1).filter((a, i) => /^\d+$/.test(a) && !['--판', '--곳'].includes(args[i])).map(Number);
    const git = (a) => execFileSync('git', ['-C', 뿌리, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const 결정글 = git(['show', `${판}:docs/_ops/결정.md`]);
    let 트랙글 = ''; try { 트랙글 = git(['show', `${판}:docs/_ops/트랙.md`]); } catch { /* 없음 */ }
    const 목록 = git(['-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', 판]).split('\n').filter(Boolean);
    let 지도 = ''; try { 지도 = git(['show', `${판}:docs/문서_지도.md`]); } catch { /* 없음 */ }
    const 결정줄 = 결정글.split(/\r?\n/);
    const r = 결정낡은줄({ 새행들: 번호들.map((n) => 결정줄[n - 1] || ''), 찾기: git찾기(git, 판), 바뀐곳들: 곳들, 핵심: 읽히는문서들(목록, 지도).filter(핵심문서), 이름곳: (이름) => 이름의곳들(이름, 결정글, 트랙글), 한도: 1e9 });
    if (json) { console.log(JSON.stringify(r, null, 1)); return 0; }
    if (!r.length) console.log('걸린 줄이 없다.');
    for (const x of r) {
      console.log(`결정 「${x.주제}」(${x.날}) — ${x.수}줄 (push 알림에는 앞 셋)`);
      for (const y of x.모두) console.log(`  ${y.경로}:${y.줄} ${줄임(산문(y.글), 110)}`);
    }
    return 0;
  }
  if (명령 === '계획표') {
    let 걸림 = 0;
    for (const p of args.slice(1).filter((a) => !a.startsWith('--'))) {
      const rel = path.relative(뿌리, path.resolve(p)).split(path.sep).join('/');
      for (const x of 계획표검사(rel, fs.readFileSync(p, 'utf8'))) { 걸림++; console.log(`${rel}:${x.줄} ${x.머리} — 머리 줄이 없다`); }
    }
    if (!걸림) console.log('걸린 계획 표가 없다.');
    else console.log(계획머리안내);
    return 걸림 ? 1 : 0;
  }
  if (명령 === '재기') {
    const 값 = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
    const 부터 = 값('--부터') ? Date.parse(`${값('--부터')}T00:00:00+09:00`) : 0;
    const 까지 = 값('--까지') ? Date.parse(`${값('--까지')}T00:00:00+09:00`) : Infinity;
    const git = (a) => execFileSync('git', ['-C', 뿌리, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const r = 알림재기({ git, 판: 값('--판') || 'origin/master', 부터, 까지 });
    if (json) { console.log(JSON.stringify(r, null, 1)); return 0; }
    console.log(알림재기글(r));
    return 0;
  }
  console.error('사용법: node tools/낡은곳.js 점검 [--json] | 결정 <결정.md 줄번호…> [--판 <커밋>] [--곳 <폴더>] | 계획표 <md…> | 재기 [--부터 <날짜>] [--까지 <날짜>] [--판 <커밋>]');
  return 2;
}

/** 알림재기 결과 한두 줄. */
function 알림재기글(r) {
  if (!r.전체) return `낡은 곳 알림: 남긴 줄이 아직 없다(${알림파일()})`;
  const 몫 = (a, b) => `${a}/${b}(${Math.round((a / b) * 100)}%)`;
  const 종류 = Object.entries(r.종류별).map(([k, d]) => `${k} ${몫(d.고쳐짐 + d.파일없음, d.전체)}`).join(' · ');
  return `낡은 곳 알림 줄 ${r.전체}개 가운데 지금 판에서 고쳐진 것 ${몫(r.고쳐짐, r.전체)} · 파일째 없어진 것 ${r.파일없음} · 그대로 ${r.그대로} — 종류별 고쳐짐(파일 없음 포함) ${종류}`;
}

if (require.main === module) process.exitCode = main();
module.exports = { push검사, 결정낡은줄, 행풀기, 낱말로, 필요수, 이름의곳들, 물러난말, 물러난표, 계획표검사, 계획머리안내, 설계문서, 읽히는문서들, 산문, 코드글, 줄의길들, 더한줄읽기, 전체점검, 기록인가, 핵심문서, 표길, 알림남기기, 알림재기, 알림재기글 };

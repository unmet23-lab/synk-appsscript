// 화면 그리기 — 화면 모델(screen-model.js)과 예시 값(fake-screens.js)을 HTML 조각으로 바꾼다. DOM을 만지지 않는 순수 함수라 시험이 그대로 부른다.
// 말씨는 검정 클라이언트(결정 11-16): 상태 한 줄 · 큰 문장과 회색 둘째 줄 · 1px 줄 증거 · 채운 알약 하나 + 선 알약 + 밑줄 글자.
// 문구와 흐름은 시안 A(ui-mockups/_src/a.mjs)의 26화면 그대로이고, 종이 · 도장 · 책상만 걷었다.
// 동적인 값(경로 · 파일 이름 · 기기 이름)은 모두 h()로 막는다. 인라인 style은 쓰지 않는다(CSP) — 너비는 data-pct를 app.js가 넣는다.

import { count, dayKo, josa, placesKo, size, timeKo, whenKo } from './ko-format.js';
import { folderName, undoWindow } from './screen-model.js';
import { EX, FAKE } from './fake-screens.js';

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pp = (w, pair) => josa(w, pair).slice(String(w).length);

const I = {
  rarr: '<svg class="la" viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8h41M35 1l7 7-7 7"/></svg>',
  ext: '<svg class="ex" viewBox="0 0 12 12" aria-hidden="true"><path d="M5 2H2v8h8V7M7 2h3v3M10 2 5.5 6.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  google: '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="currentColor" d="M17.1 9.2c0-.6-.05-1.1-.17-1.64H9v3.18h4.65a4 4 0 0 1-1.88 2.78l2.86 2.21c1.71-1.58 2.47-3.9 2.47-6.53ZM9 17.4c2.28 0 4.2-.75 5.6-2.04l-2.86-2.21c-.76.53-1.78.9-2.74.9-2.1 0-3.88-1.41-4.52-3.36l-2.94 2.27A8.4 8.4 0 0 0 9 17.4ZM4.48 10.69a5.04 5.04 0 0 1 0-3.38L1.54 5.04a8.4 8.4 0 0 0 0 7.92l2.94-2.27ZM9 3.95c1.38 0 2.33.6 2.86 1.1l2.09-2.04A8.07 8.07 0 0 0 9 1.1a8.4 8.4 0 0 0-7.46 4.44l2.94 2.27C5.12 5.36 6.9 3.95 9 3.95Z"/></svg>',
};

/** 할 일 하나 — main(채운 알약) · line(선 알약) · link(밑줄 글자) */
export function act(a) {
  const dis = a.disabled ? ' aria-disabled="true"' : '';
  if (a.kind === 'link') return `<button class="lnk" type="button" data-act="${h(a.id)}"${dis}>${h(a.label)}${a.ext ? ` ${I.ext}` : ` ${I.rarr}`}</button>`;
  return `<button class="pill${a.kind === 'main' ? ' main' : ''}" type="button" data-act="${h(a.id)}"${dis}>${a.icon ? I[a.icon] : ''}${h(a.label)}</button>`;
}
const row = (k, v, w = '', cls = '') => `<div class="row ${cls}"><span class="k">${k}</span><span class="v">${v}</span><span class="w">${w}</span></div>`;
const gauge = (pct) => `<span class="gauge" aria-hidden="true"><i data-pct="${Number(pct) || 0}"></i></span>`;
const notes = (list) => (list && list.length ? `<div class="notes rise i3">${list.map((t) => `<p class="note">${t}</p>`).join('')}</div>` : '');
const box = (b) => (b ? `<div class="box rise i3"><b>${h(b.title)}</b>${h(b.text)}</div>` : '');
const say = (main, soft = '') => `<h1 class="say rise i1">${main}${soft ? `<br><span class="soft">${soft}</span>` : ''}</h1>`;
const kick = (t) => `<p class="kick rise"><i class="dot" aria-hidden="true"></i>${t}</p>`;
const then = (t) => (t ? `<p class="then rise i2">${t}</p>` : '');
const acts = (list, extra = '') => `<div class="act rise i5">${list.map(act).join('')}${extra}</div>`;
const panel = (title, meta, body, aria = title) => `<section class="panel rise i4" aria-label="${h(aria)}"><div class="panel-h"><h2>${h(title)}</h2>${meta ? `<p>${meta}</p>` : ''}</div>${body}</section>`;
const flow = (l, r) => `<div class="flow"><div class="l">${l}</div><div class="r">${r}</div></div>`;
const steps = (list) => `<div class="steps">${list.map((s, i) => `<div class="step ${s.st || ''}"><span class="n">${s.n ?? i + 1}</span><div><h4>${s.h}</h4>${s.p ? `<p>${s.p}</p>` : ''}${s.lk ? `<div class="lk">${s.lk}</div>` : ''}</div></div>`).join('')}</div>`;

const RESTORE = { id: 'restore', label: '파일 되살리기', kind: 'main' };

/* ── 기본 화면 ─────────────────────────────── */
function homeRows(m) {
  const ev = m.evidence;
  const out = [];
  if (m.progress) out.push(row(h(m.progress.label), `${gauge(m.progress.percent ?? 0)}<span class="pc">${m.progress.percent === null ? '' : `${m.progress.percent}%`}</span>`, h(m.progress.stage), 'g'));
  if (!ev) return out.length ? `<div class="rows rise i4">${out.join('')}</div>` : '';
  const next = ev.head.find((x) => x.k === '다음 확인');
  out.push(row('마지막 확인', h(ev.head[0].v), next ? `다음은 ${h(next.v)}` : ''));
  const [files, bytes] = String(ev.total.v || '').split(' · ');
  const present = ev.folders.rows.filter((r) => !r.x || r.v !== '찾을 수 없음').length;
  out.push(row('지키는 폴더', `${h(placesKo(present))}${files ? ` · ${h(files)}` : ''}`, h(bytes || '')));
  for (const r of ev.folders.rows.filter((x) => x.x)) out.push(r.gone ? row(h(r.k), h(r.path || ''), '<span class="x">찾을 수 없음</span>', 'sub') : row(h(r.k), h(r.v.replace(/ · −.*/, '')), `<span class="x">${h(r.v.replace(/.* · /, ''))}</span>`, 'sub'));
  for (const e of ev.extra) out.push(row(h(e.k), h(e.v)));
  if (m.id !== 'home-run') out.push(row(h(ev.proof.k), h(ev.proof.day), ev.proof.bad ? `<span class="x">${h(ev.proof.short)}</span>` : h(ev.proof.short || '')));
  return `<div class="rows rise i4">${out.join('')}</div>`;
}

export function homeScreen(m) {
  const link = m.link ? `<div class="act rise i3"><button class="lnk" type="button" data-act="${h(m.link.to)}">${h(m.link.label)} ${I.rarr}</button></div>` : '';
  const r = m.restored;
  const done = r ? `<p class="done${r.bad ? ' bad' : ''} rise i3"><i class="dot" aria-hidden="true"></i><span>${h(r.text)}</span>${r.act ? `<button class="lnk sm" type="button" data-act="${h(r.act.id)}">${h(r.act.label)}</button>` : ''}</p>` : '';
  const html = `<div class="in">${kick(h(m.kick))}${say(h(m.title))}${then(h(m.sub))}${box(m.box)}${notes((m.notes || []).map(h))}${link}${done}${homeRows(m)}${acts(m.actions.map((a) => ({ ...a })), m.hint ? `<span class="hint">${h(m.hint)}</span>` : '')}</div>`;
  const map = {}; for (const a of m.actions) map[a.id] = a; if (m.link) map[m.link.to] = { id: m.link.to, to: m.link.to }; if (r?.act) map[r.act.id] = r.act;
  return { kind: 'home', tone: m.tone, here: '백업·복구', top: [{ id: 'drawer', label: '설정' }], html, acts: map };
}

/* ── 첫 시작 ───────────────────────────────── */
function start1() {
  const html = `<div class="in">${kick('설정할 것이 없습니다')}${say('업무 자료를', '매시간 저절로 지킵니다.')}
    ${then('Google 계정으로 시작하면 이 PC의 문서, 바탕화면, 사진과 찾아낸 작업 폴더를 암호화해 클라우드에 올립니다.')}
    ${notes(['<b>SYNK도 백업 내용을 열 수 없습니다.</b> 여는 열쇠는 내 Google 계정에만 맡깁니다.', '그래서 Google 계정에 들어갈 수 있는 사람은 백업도 열 수 있습니다. <b>Google 2단계 인증을 켜 두세요.</b>'])}
    ${acts([{ id: 'google', label: 'Google로 시작', kind: 'main', icon: 'google' }], `<span class="hint">브라우저가 열리면 계정을 고르고 「계속」을 누르세요.</span><p class="alt"><span>Google 계정에 들어갈 수 없나요?</span><button class="lnk sm" type="button" data-act="code-in">복구 코드로 되살리기</button></p>`)}
    <p class="foot rise i6">${h(EX.telemetry)}</p></div>`;
  return { kind: 'home', tone: 'setup', here: '백업·복구', top: [], html, acts: { google: { id: 'google', pending: '개통' }, 'code-in': { id: 'code-in', pending: '복구 코드' } } };
}

function start2() {
  const list = EX.folders.map((f) => `<div class="row share"><span class="k">${h(f.name)}<span class="sr"> · </span><br><span class="meta">${f.found ? '찾아낸 작업 폴더 · ' : ''}${h(f.path)}</span></span><span class="v">${gauge(f.pct)}</span><span class="w">${h(f.size)} · ${h(f.files)}개</span></div>`).join('');
  const r = panel('보호 범위', `예상 ${EX.total.files}개 · ${EX.total.size}`, `<div class="rows">${list}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="add">다른 폴더 더하기 ${I.rarr}</button></div>
    <p class="foot">OneDrive에만 있는 파일 <b class="num">${EX.onedriveOnly}</b>개는 OneDrive가 지킵니다. 이 백업에는 담지 않습니다.</p>
    <div class="rows">${row('지키는 양', gauge(EX.capPct), `${EX.total.size} / ${EX.cap}까지`, 'share')}</div>`);
  const l = `${kick(`${h(EX.device)} · 보호 범위`)}${say('이 폴더를 지킵니다.')}${then('앱이 골라 둔 그대로 두면 됩니다. 「보호 시작」을 누르면 목록의 폴더를 암호화해 올리기 시작합니다.')}${acts([{ id: 'protect', label: '보호 시작', kind: 'main' }])}<p class="foot rise i6">${h(EX.telemetry)}</p>`;
  return { kind: 'flow', tone: 'setup', here: '보호 범위', top: [], html: flow(l, r), acts: { protect: { id: 'protect', pending: '개통' }, add: { id: 'add', call: 'addSources' } } };
}

function start3(s, fake) {
  const p = s?.job?.kind === 'protect' && Number.isFinite(Number(s.job.percent)) ? Math.max(0, Math.min(100, Math.round(Number(s.job.percent)))) : fake ? 31 : 0;
  const l = `${kick(`${h(s?.device || (fake ? EX.device : '이 PC'))} · 첫 백업`)}${say('첫 백업 중입니다.')}${then('창을 닫아도 됩니다. 끝나면 알려 드립니다.')}
    <div class="bar rise i3" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="첫 백업"><i data-pct="${p}"></i></div>
    ${notes(['전원이 연결돼 있는 동안은 절전 모드로 들어가지 않습니다.', '첫 백업 뒤로는 매시간 바뀐 것만 올립니다. 꺼져 있어 놓친 시간은 로그인하거나 깨어난 뒤에 채웁니다.'])}
    ${acts([{ id: 'close', label: '창 닫기', kind: 'line' }])}`;
  const r = panel('첫 백업 순서', '넷째 걸음이 끝나면 매시간 저절로 지킵니다', steps([
    { st: 'done', n: '✓', h: '내 클라우드 자리 만들기' },
    { st: 'done', n: '✓', h: '복구 정보를 내 Google 계정에 맡기기', p: '맡긴 뒤 다시 받아 열리는지까지 봤습니다.' },
    { st: 'done', n: '✓', h: '매시간 저절로 돌게 등록하기', p: '창을 닫아도 매시간 뒤에서 조용히 돕니다.' },
    { st: 'now', n: '4', h: `첫 백업 · 올리는 중 <span class="num">${p}%</span>` },
  ]));
  return { kind: 'flow', tone: 'run', here: '첫 백업', top: [], html: flow(l, r), acts: { close: { id: 'close', call: 'closeWindow' } } };
}

/* ── 파일 되살리기(실제 목록) ─────────────── */
/** 지키는 폴더 아래의 하위 폴더(파일 이름은 빼고 끝의 둘까지) */
function sub(p) {
  const parts = String(p || '').split(/[\\/]/).slice(0, -1).filter(Boolean).slice(-2);
  return parts.length ? ` › ${h(parts.join(' › '))}` : '';
}
function restore(s, now, cat) {
  const last = s?.lastBackup?.at;
  const total = cat?.fileCount ?? s?.lastBackup?.files;
  const sel = cat?.selection?.count || 0;
  const held = (s?.missingSources?.length || s?.massHold) ? notes(['찾을 수 없는 폴더나 한꺼번에 지워지기 전의 판은 지우지 않고 붙들어 두었습니다. 그 판에서 꺼내는 길은 아직 준비 중이라, 이 목록은 가장 최근 판입니다.']) : '';
  const l = `${kick(last ? `가장 최근 판 · ${h(whenKo(last, now).replace(/^(오전|오후)/, '오늘 $1'))}` : '아직 백업이 없습니다')}${say('무엇을 되살릴까요?')}
    ${then('고른 파일은 지키는 폴더 밖의 새 폴더에 되살립니다. 원래 파일은 그대로 두고, 되살린 뒤 백업과 같은지 하나하나 확인합니다.')}${held}
    ${acts([{ id: 'restore-sel', label: sel ? `고른 ${count(sel)}개 되살리기` : '고른 파일 되살리기', kind: 'main', disabled: !sel }, { id: 'restore-all', label: total ? `전체 ${count(total)}개 되살리기` : '전체 되살리기', kind: 'line' }],
      '<span class="hint">누르면 놓을 폴더를 고르는 창이 한 번 뜹니다.</span>')}`;
  let list;
  if (cat?.error) list = `<p class="empty">${h(cat.error)}</p><div class="act"><button class="lnk sm" type="button" data-act="reopen">목록 다시 열기 ${I.rarr}</button></div>`;
  else if (!cat || cat.loading) list = '<p class="empty">목록을 여는 중입니다.</p>';
  else if (!cat.rows?.length) list = `<p class="empty">${cat.query ? `「${h(cat.query)}」${pp(cat.query, '이/가')} 든 파일이 없습니다.` : '되살릴 파일이 없습니다.'}</p>`;
  else list = cat.rows.map((f) => `<button class="fl" type="button" role="checkbox" aria-checked="${!!f.selected}" data-file="${h(f.id)}"><span class="cb" aria-hidden="true"></span><span class="nm">${h(f.name)}</span><span class="vl">${h(size(f.size))}${f.mtime ? ` · ${h(dayKo(f.mtime).replace(/ [일월화수목금토]$/, ''))}` : ''}</span><span class="ds">${h(folderName(String(f.source || '').replace(/^\d+-/, '')))}${sub(f.path)}</span></button>`).join('');
  const more = cat && cat.total > (cat.offset || 0) + (cat.rows?.length || 0) ? `<div class="act"><button class="lnk sm" type="button" data-act="more">더 보기 · ${count(cat.total - (cat.offset || 0) - cat.rows.length)}개 ${I.rarr}</button></div>` : '';
  const r = panel('찾기', `${total ? `${count(total)}개 가운데 · ` : ''}${last ? `${h(whenKo(last, now))} 판` : ''}`,
    `<div class="find">${I.search}<input id="find" type="search" aria-label="파일 이름으로 찾기" placeholder="파일 이름으로 찾기" autocomplete="off" spellcheck="false" maxlength="200" value="${h(cat?.query || '')}"><em aria-live="polite">${cat?.total !== undefined ? `${count(cat.total)}개 찾음` : ''}</em></div>
    <div class="files" role="group" aria-label="찾은 파일">${list}</div>${more}
    <div class="selbar"><span><b class="num">${count(sel)}개</b> 고름${sel ? ` · <span class="num">${h(size(cat.selection.bytes))}</span>` : ''}</span>${sel ? '<button class="lnk sm" type="button" data-act="clear">고른 것 비우기</button>' : ''}</div>`);
  return { kind: 'flow', tone: 'ok', here: '파일 되살리기', back: 'home', top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { 'restore-sel': { id: 'restore-sel', call: 'restoreSelected' }, 'restore-all': { id: 'restore-all', call: 'restoreLatest' }, more: { id: 'more' }, clear: { id: 'clear' } } };
}

/* ── 쓰는 중인 파일 ────────────────────────── */
function partial(s, now, mode) {
  const lp = s?.lastPartial, real = !!lp;
  const std = mode === 'std', admin = mode === 'admin';
  const n = real ? count(lp.unreadable) : '2';
  const program = real ? (lp.program || '다른 프로그램') : 'Outlook';
  // 앞선 온전한 판이 없으면(첫 백업이 부분 판) 그 파일은 어느 판에도 없다
  const firstOnly = real && (!s.lastBackup || s.lastBackup.id === lp.id);
  const kept = real ? (firstOnly ? '' : whenKo(s.lastBackup.at, now)) : (std ? '오늘 오전 8:02' : '오늘 오후 1:02');
  const lastKo = real ? whenKo(lp.at, now) : '오후 2:02';
  const rest = real && Number.isFinite(Number(lp.files)) ? count(lp.files) : '12,478';
  const who = std ? '표준 사용자 계정' : admin ? '관리자 계정' : '쓰는 중인 파일';
  const head = firstOnly ? say(`파일 ${h(n)}개는`, '아직 담지 못했습니다.') : say(`파일 ${h(n)}개는`, `${h(kept)} 판으로 지킵니다.`);
  const tail = firstOnly ? `되살릴 때 이 ${h(n)}개는 아직 없습니다.` : `되살릴 때 이 ${h(n)}개는 ${h(kept)} 판에서 가져옵니다.`;
  const close = `${h(josa(program, '을/를'))} 닫으면 다음 확인 때 새로 담깁니다.`;
  const l = `${kick(`${h(s?.device || (real ? '이 PC' : EX.device))} · ${who}`)}${head}
    ${then(`${h(josa(program, '이/가'))} 열어 두고 고치는 중이라 ${std ? '그 뒤 확인 때' : `${h(lastKo)} 확인 때`} 읽지 못했습니다. 나머지 <b class="num">${h(rest)}개</b>는 ${h(lastKo)} 판입니다.`)}
    ${notes(std ? ['이 계정은 표준 사용자라, 켜진 프로그램이 쥔 파일은 그 프로그램을 닫았을 때 새로 담깁니다.', `퇴근할 때 ${close}`, tail]
      : admin ? [`관리자 계정이라 4시간마다 이 파일만 따로 읽어 새로 담습니다.${real ? '' : ' 다음은 오후 5:02 무렵입니다.'}`, close, tail]
      : [close, tail])}
    ${acts([{ id: 'home', label: '돌아가기', kind: 'line' }])}`;
  const files = (real && Array.isArray(lp.items) ? lp.items : real ? [] : EX.partialFiles);
  const when = std ? row('새로 담기는 때', `${h(josa(program, '을/를'))} 닫은 뒤 첫 확인`) : admin ? row('다음 따로 읽기', real ? '4시간에 한 번' : '오후 5:02 무렵') : row('새로 담기는 때', `${h(josa(program, '을/를'))} 닫은 뒤 첫 확인`);
  const body = `<div class="rows">${files.map((f) => row(`${h(f.name)}<br><span class="meta">${h(f.where || '')}${f.where ? ' · ' : ''}${h(program)}</span>`, '', h(f.size || ''))).join('')}${row('지키는 판', firstOnly ? '아직 없음' : h(kept))}${when}</div>`;
  return { kind: 'flow', tone: firstOnly ? 'warn' : 'ok', here: '쓰는 중인 파일', top: [{ id: 'home', label: '닫기' }], html: flow(l, panel('쓰는 중인 파일', real && !files.length ? `${h(n)}개` : '', body)), acts: { home: { id: 'home', to: 'home' } } };
}

/* ── 옮겨 오기 ─────────────────────────────── */
function move0(s, now, fake) {
  const files = s?.lastBackup ? `${count(s.lastBackup.files)}개 · ${size(s.lastBackup.bytes)}` : fake ? `${EX.total.files}개 · ${EX.total.size}` : '아직 없음';
  const n = s?.sources?.length ? placesKo(s.sources.length) : fake ? '네 곳' : '폴더';
  const l = `${kick(`${h(s?.device || (fake ? EX.device : '이 PC'))} · 새 PC로 옮기기 전에`)}${say('새 PC에서', '세 걸음이면 됩니다.')}
    ${then('새 PC에 업무 백업을 깔고 같은 Google 계정으로 시작하면, 이 PC의 마지막 판을 찾아 옮겨 옵니다.')}
    ${notes([...(fake ? [] : ['<b>새 PC 쪽의 「이 PC로 옮겨 오기」는 다음 업데이트에서 열립니다.</b> 그때까지 이 PC는 정리하지 말고 그대로 두세요.']), '옮기기 직전에 열어 둔 프로그램(Outlook 등)을 모두 닫고 「지금 한 번 더 백업」을 누르면, 방금 고친 파일까지 갑니다.', `지키는 ${h(n)} 밖의 자료와 공동인증서는 백업에 없습니다. 옛 PC를 정리하기 전에 직접 옮기세요.`, '새 PC가 이어 받기 전까지 이 PC는 지금처럼 매시간 지킵니다.'])}
    ${acts([{ id: 'backup', label: '지금 한 번 더 백업', kind: 'main' }], '<p class="alt"><span>Google 계정에 들어갈 수 없나요?</span><button class="lnk sm" type="button" data-act="code">복구 코드 만들기</button></p><span class="hint">복구 코드로는 새 PC에 파일만 옮겨 옵니다. 이어서 백업하려면 Google 로그인이 필요합니다.</span>')}`;
  const r = panel('새 PC에서 할 일', '이 PC는 그대로 두고, 새 PC에서 합니다', `${steps([
    { h: '업무 백업 깔기', p: '처음 받은 곳에서 설치 파일을 다시 받아 새 PC에서 엽니다.' },
    { h: '같은 Google 계정으로 시작', p: h(s?.recovery?.email || (fake ? EX.account : '이 PC에서 백업을 시작한 그 계정입니다.')) },
    { h: '「이 PC로 옮겨 오기」 누르기', p: '놓을 자리, 원본과의 대조, 다시 깔 프로그램까지 앱이 차례로 안내합니다.' },
  ])}<div class="rows">${row('옮겨 올 것', h(files))}${fake ? row('다시 깔 프로그램', `${EX.programs.length}개 찾아 둠`) : ''}</div>`);
  return { kind: 'flow', tone: 'ok', here: '새 PC로 옮겨 오기', top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { backup: { id: 'backup', call: 'backupNow', then: 'home' }, code: { id: 'code', to: 'code' } } };
}

// 고르는 칸은 제목 · 설명 · 옮겨 놓이는 도식을 담아 button 대신 role=radio인 div다(button 속에는 제목 · 문단을 둘 수 없다). 자판은 app.js가 받는다
const pick = (on, title, text, map, id) => `<div class="pick" role="radio" tabindex="${on ? 0 : -1}" aria-checked="${on}" data-pick="${id}"><div class="ph"><h4>${title}</h4><span class="o" aria-hidden="true"></span></div><p>${text}</p><div class="map">${map.map(([a, b]) => `<span>${h(a)}</span><i aria-hidden="true">→</i><span>${h(b)}</span>`).join('')}</div></div>`;

function move1(ui) {
  const where = ui?.pick || 'same';
  const l = `${kick(`${h(EX.newDevice)} · 같은 Google 계정`)}${say('어디에 놓을까요?')}
    ${then(`「${h(EX.move.from)}」의 백업을 찾았습니다. 마지막 확인은 ${h(EX.move.fromLast)}, <span class="num keep">${EX.total.files}개 · ${EX.total.size}</span>입니다.`)}
    ${notes(['이미 있는 파일은 덮어쓰지 않습니다. 내용이 다르면 「(복구본)」을 붙여 나란히 둡니다.', `약 <b class="num">${EX.move.waitMin}분</b> 걸립니다(지난 백업에서 잰 회선 속도로 어림했고, 시작하면 다시 셉니다). 끊겨도 멈춘 곳부터 잇습니다.`])}
    ${acts([{ id: 'next', label: '이 자리로 옮겨 오기', kind: 'main' }], '<p class="alt"><span>파일이 이 PC에 그대로 남아 있나요?</span><button class="lnk sm" type="button" data-act="keep">되살리지 않고 이어서 백업</button></p><span class="hint">Windows를 새로 깔아 파일이 비었거나 일부만 남았으면 누르지 마세요. 「이 자리로 옮겨 오기」로 채웁니다.</span>')}`;
  const r = `<div class="picks rise i4" role="radiogroup" aria-label="놓을 자리">
    ${pick(where === 'same', '원래 자리', '이 PC의 문서, 바탕화면, 사진은 OneDrive 밖이라 그대로 놓습니다.', [['문서', '이 PC의 문서'], ['바탕화면', '이 PC의 바탕화면'], ['사진', '이 PC의 사진'], ['D:\\Projects', 'D:\\Projects']], 'same')}
    ${pick(where === 'new', 'OneDrive 밖 새 폴더', '문서 폴더가 OneDrive 안이면 권합니다. 옮겨 올 양이 OneDrive 남은 공간을 넘으면 동기화가 멈출 수 있습니다.', [['폴더 네 곳', EX.move.newFolder]], 'new')}
    <p class="room-left">이 PC 남은 공간 ${h(EX.move.room)} · 옮겨 올 것 ${EX.total.size}</p></div>`;
  return { kind: 'flow', tone: 'ok', here: '새 PC로 옮겨 오기', seg: [1, 4], top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { next: { id: 'next', to: 'move-2' }, keep: { id: 'keep', pending: '이어서 백업' } } };
}

function move2() {
  const m = EX.move;
  const l = `${kick(`${h(EX.newDevice)} · 옮겨 오는 중`)}${say('옮겨 오고 있습니다.')}
    ${then(`<b class="num">${m.pct}%</b> · <span class="num">${m.doneSize} / ${EX.total.size}</span> · 남은 시간 약 <span class="num">${m.leftMin}</span>분`)}
    <div class="bar rise i3" role="progressbar" aria-valuenow="${m.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="옮겨 오기"><i data-pct="${m.pct}"></i></div>
    ${notes(['받은 파일은 하나씩 원본과 같은지 확인한 뒤 자리에 놓습니다.', '끊겨도 처음부터가 아니라 멈춘 곳부터 이어서 합니다.', '전원이 연결돼 있는 동안 절전 모드로 들어가지 않습니다.'])}
    ${acts([{ id: 'pause', label: '잠시 멈추기', kind: 'line' }])}`;
  const r = panel('옮겨 오기 장부', `${h(m.from)} → ${h(EX.newDevice)}`, `<div class="rows">
    ${row('문서', `${gauge(96)}<span class="pc">96%</span>`, '5,117 / 5,310', 'g')}
    ${row('바탕화면', '기다림', '420')}${row('사진', '기다림', '4,880')}${row('프로젝트', '기다림', '1,870')}
    ${row('대조 끝', `<span class="num">${m.doneFiles} / ${EX.total.files}</span>`)}</div><p class="foot">대조를 마친 파일만 적힙니다.</p>`);
  return { kind: 'flow', tone: 'run', here: '새 PC로 옮겨 오기', seg: [2, 4], top: [], html: flow(l, r), acts: { pause: { id: 'pause', pending: '잠시 멈추기' } } };
}

function move3() {
  const m = EX.move;
  const l = `${kick(`${h(EX.newDevice)} · 대조 끝`)}${say('다 옮겨 왔습니다.')}
    ${then(`받은 파일은 모두 ${h(m.fromLast)} 백업과 한 바이트도 다르지 않습니다.`)}
    ${notes([`「(복구본)」 <b class="num">${m.sideBySide}</b>개는 이 PC에 같은 이름의 다른 파일이 있어 나란히 두었습니다.`, `저절로 실행되는 자리의 파일 <b class="num">2</b>개는 원래 자리 대신 「따로 둔 폴더」에 놓았습니다. 옛 PC에 나쁜 프로그램이 있었다면 새 PC에서 저절로 실행되지 않게 하려는 것입니다.`])}
    ${acts([{ id: 'next', label: '다음 · 백업 켜기', kind: 'main' }, { id: 'side', label: `나란히 둔 ${m.sideBySide}개 보기`, kind: 'link' }], '<span class="hint">아직 이 PC는 백업하지 않습니다. 다음 화면에서 옛 노트북 연결을 끊고 자동 백업을 켭니다.</span>')}`;
  const r = panel('옮겨 오기 확인서', `${h(m.from)} → ${h(EX.newDevice)}`, `<div class="rows">
    ${row('되살림', `${m.restored}개`)}${row('이미 있던 같은 파일', `${m.same}개`)}${row('「(복구본)」으로 나란히', `${m.sideBySide}개`)}${row('건너뜀', `${m.skipped}개`, '연결 폴더')}
    ${m.skippedList.map((x) => row(h(x), '', '연결 폴더', 'sub')).join('')}
    ${row('합계', `${EX.total.files}개`)}</div>
    <p class="foot">건너뛴 넷은 다른 곳을 가리키는 연결 폴더라 백업에 내용이 없습니다.</p>
    <h3>따로 둔 자동 실행 파일 2개</h3><div class="rows">${m.autorunList.map(([w, n]) => row(h(w), h(n))).join('')}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="open">놓은 곳 열기 · ${h(m.autorunTo)} ${I.rarr}</button></div>
    <h3>옛 노트북 백업이 남아 있는 까닭</h3><p class="foot">건너뛴 것이 있어 바로 정리하지 않습니다. 필요 없으면 설정 › 내 기기에서 「나머지는 필요 없음」을 누르세요.</p>`);
  return { kind: 'flow', tone: 'ok', here: '새 PC로 옮겨 오기', seg: [3, 4], top: [], html: flow(l, r), acts: { next: { id: 'next', to: 'move-4' }, side: { id: 'side', pending: '나란히 둔 파일' }, open: { id: 'open', pending: '폴더 열기' } } };
}

function move4() {
  const l = `${kick(`${h(EX.newDevice)} · 마지막 걸음`)}${say('옛 노트북 연결을', '끊고 이어서 백업합니다.')}
    ${then('끊으면 이 PC가 같은 백업에 이어서 매시간 올립니다. 백업하는 기기는 한 번에 하나라, 옛 노트북은 그때부터 백업하지 않습니다.')}
    ${notes(['이 목록은 앱이 대신 깔지 않습니다. 보며 하나씩 깔고 로그인하세요. 인쇄해 두어도 됩니다.', 'winget 줄은 PowerShell에 붙여 넣으면 깔립니다.'])}
    ${acts([{ id: 'done', label: '끊고 이 PC로 이어서 백업', kind: 'main' }, { id: 'nocut', label: '끊지 않고 이 PC는 백업하지 않기', kind: 'link' }])}`;
  const r = panel('다시 깔 프로그램', `옛 노트북에서 찾은 것 · ${EX.programs.length}개`, `<div class="files">${EX.programs.map((p) => `<div class="fl plain"><span class="nm">${h(p.name)}</span><span class="vl">${p.id ? `winget install ${h(p.id)}` : '공식 사이트에서'}</span></div>`).join('')}</div>
    <h3>다시 로그인할 곳</h3><div class="files">${EX.relogin.map((x) => `<div class="fl plain"><span class="nm">${h(x.what)}</span><span class="vl"></span><span class="ds">${h(x.how)}</span></div>`).join('')}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="print">인쇄 ${I.rarr}</button></div>`);
  return { kind: 'flow', tone: 'ok', here: '새 PC로 옮겨 오기', seg: [4, 4], top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { done: { id: 'done', pending: '연결 끊고 이어서 백업' }, nocut: { id: 'nocut', to: 'home' }, print: { id: 'print', pending: '인쇄' } } };
}

/* ── 사고 되돌리기 ─────────────────────────── */
function undo1(now) {
  const u = EX.undo, w = undoWindow(u.pickAt, now), max = Math.max(...EX.undoHours.map(([, v]) => v));
  const bars = EX.undoHours.map(([, v], i) => `<div class="b${v > 1000 ? ' hot' : ''}${v === 0 ? ' z' : ''}${i === 6 ? ' pickd' : ''}" data-pct="${v === 0 ? 0 : Math.max(1.4, (v / max) * 100).toFixed(1)}">${v > 1000 ? `<span class="v">${v.toLocaleString('en-US')}</span>` : ''}${i === 6 ? '<span class="pk">오후 2:59</span>' : ''}</div>`).join('');
  const ticks = EX.undoHours.map((_, i) => `<span class="${EX.undoTicks[i] ? 's' : ''}${i === EX.undoHours.length - 1 ? ' e' : ''}">${EX.undoTicks[i] || ''}</span>`).join('');
  const l = `${kick('백업이 바뀌었습니다')}${say('언제로 되돌릴까요?')}
    ${then(`${h(u.detectKo)}부터 지워진 백업 묶음이 한꺼번에 늘었습니다. 그 직전인 <b class="num">${h(u.pickKo)}</b>${pp(u.pickKo, '을/를')} 골라 두었습니다.`)}
    <div class="box rise i3"><b>되돌릴 수 있는 날이 ${w.daysLeft}일 남았습니다</b>지워진 묶음은 30일째부터 사라지기 시작해, 하루 여유를 두고 <span class="keep">${h(w.untilKo)}</span>까지 되돌릴 수 있습니다.</div>
    ${acts([{ id: 'next', label: '이 시각으로 미리 보기', kind: 'main' }, { id: 'other', label: '다른 시각 고르기', kind: 'link' }])}`;
  const r = panel('시간마다 숨겨진 백업 묶음', '11월 12일 오전 8시 ~ 13일 오전 8시 · SYNK 서버가 센 수', `<p class="foot">백업은 작은 묶음으로 나눠 올리고, 지워진 묶음은 30일 동안 숨겨 둡니다.</p>
    <div class="chart" role="img" aria-label="11월 12일 오후 3시와 4시에 숨겨진 묶음이 3,412개와 1,980개로 크게 늘었습니다"><div class="bars">${bars}</div><div class="ticks">${ticks}</div></div>
    <div class="legend"><span>평소에는 지난 판을 정리하며 한 시간에 수십 개씩 숨겨집니다.</span><b class="num">오후 3시~5시: ${u.spike}개</b></div>`);
  return { kind: 'flow', tone: 'bad', here: '사고가 났을 때 되돌리기', seg: [1, 3], top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { next: { id: 'next', to: 'undo-2' }, other: { id: 'other', pending: '다른 시각' } } };
}

function undo2() {
  const u = EX.undo;
  const l = `${kick('미리 보기')}${say(`${h(u.pickShortKo)}로`, '되돌립니다.')}${then('클라우드 백업만 그 시각으로 되돌리고, 이 PC의 파일은 그대로 둡니다.')}
    <div class="rise i3">${steps([
      { h: '이 계정의 모든 기기 연결을 새 것으로 바꿉니다', p: '이 PC만 새 연결을 받습니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다. 전에 받은 복구 코드도 쓸 수 없게 되어, 끝나면 새로 만듭니다.' },
      { h: '그 시각의 백업을 다시 보이게 합니다', p: '지우는 것은 없습니다. 도중에 끊겨도 다시 누르면 이어서 합니다.' },
      { h: '확인을 마칠 때까지 자동 백업과 정리를 멈춥니다', p: '요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.' },
    ])}</div>
    ${acts([{ id: 'next', label: 'Google로 확인하고 되돌리기', kind: 'main', icon: 'google' }], '<span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>')}`;
  const r = panel('그 시각의 가장 최근 판', `${h(u.versionKo)} 판`, `<div class="rows">${EX.folders.map((f, i) => row(h(f.name), `${u.byFolder[i]}개`)).join('')}${row('합계', `${u.files}개 · ${u.size}`)}${row('지금 상태의 백업', '<span class="x">열 수 없음</span>', '숨겨진 묶음이 많아서')}</div>
    <h3>이 PC가 감염됐을 수 있으면</h3><p class="foot">먼저 치료하거나 깨끗한 다른 PC에서 되돌리세요. 같은 사용자 권한의 프로그램은 새 Google 로그인도 읽습니다. 그다음 Google에서 이 PC를 로그아웃하고 「업무 백업」 접근을 지운 뒤 다시 로그인하세요.</p>
    <div class="act"><button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 ${I.ext}</button><button class="lnk sm" type="button" data-act="g-app">연결된 앱 ${I.ext}</button></div>`);
  return { kind: 'flow', tone: 'bad', here: '사고가 났을 때 되돌리기', seg: [2, 3], back: 'undo-1', top: [{ id: 'back', label: '뒤로' }, { id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { next: { id: 'next', pending: '되돌리기' }, 'g-dev': { id: 'g-dev', pending: 'Google 기기 관리 열기' }, 'g-app': { id: 'g-app', pending: '연결된 앱 열기' } } };
}

function undo3() {
  const u = EX.undo;
  const l = `${kick('되돌렸습니다 · 자동 백업 멈춤')}${say(`${h(u.pickShortKo)}로`, '되돌렸습니다.')}${then('자동 백업과 정리를 멈춰 두었습니다. 먼저 필요한 파일을 새 폴더로 꺼내 확인하세요.')}
    ${notes(['<b>파일 꺼내기</b>는 되돌린 판에서 필요한 파일을 새 폴더로 꺼냅니다. 이 PC의 파일은 건드리지 않습니다.', '<b>여기서부터 계속</b>은 이 PC의 지금 파일로 다시 매시간 백업합니다. 지키는 폴더에 망가진 파일이 남아 있으면, 꺼낸 파일로 바꿔 놓은 뒤에 누르세요.', `<b>되돌리기 취소</b>는 되돌리기 직전(${h(u.cancelKo)})으로 다시 돌립니다.`])}
    ${acts([{ id: 'out', label: '파일 꺼내기', kind: 'main' }, { id: 'go', label: '여기서부터 계속', kind: 'line' }, { id: 'cancel', label: '되돌리기 취소', kind: 'link' }])}`;
  const r = panel('되돌리기 확인서', '', `<div class="rows">${row('되돌린 시각', h(u.pickShortKo))}${row('그때 가장 최근 판', `${h(u.versionKo)} · ${u.files}개`)}${row('이 PC의 파일', '그대로')}${row('기기 연결', '새로 바꿈 · 이 PC만')}${row('알림', '모든 기기 · 메일')}${row('자동 백업', '고를 때까지 멈춤')}</div>
    <h3>다음 할 일</h3><p class="foot">새 복구 코드를 만들어 두세요. 전에 받은 코드는 이제 쓸 수 없습니다. 이 PC가 감염됐을 수 있으면 치료한 뒤에 만드세요.</p>
    <div class="act"><button class="lnk sm" type="button" data-act="code">새 복구 코드 만들기 ${I.rarr}</button></div>`);
  return { kind: 'flow', tone: 'warn', here: '사고가 났을 때 되돌리기', seg: [3, 3], top: [], html: flow(l, r), acts: { out: { id: 'out', to: 'restore' }, go: { id: 'go', to: 'home' }, cancel: { id: 'cancel', pending: '되돌리기 취소' }, code: { id: 'code', to: 'code' } } };
}

/* ── 분실 신고 ─────────────────────────────── */
function lost1() {
  const l = `${kick(`${h(EX.newDevice)}에서`)}${say(`「${h(EX.device)}」${pp(EX.device, '을/를')}`, '분실 신고합니다.')}
    ${then('신고하는 즉시 그 노트북의 백업 연결을 끊습니다. 백업은 지워지지 않고, 잃어버린 노트북 안의 파일은 이 앱이 지울 수 없습니다.')}
    <div class="box rise i3"><b>신고한 뒤에는</b>새 기기를 이을 때까지 SYNK 서버를 거쳐야 백업을 열 수 있고, 전에 받은 복구 코드는 쓸 수 없습니다.</div>
    ${acts([{ id: 'next', label: 'Google로 확인하고 분실 신고', kind: 'main', icon: 'google' }, { id: 'drawer', label: '취소', kind: 'link' }])}`;
  const r = panel('분실 신고 순서', '끝까지 하면 잃어버린 노트북은 백업을 읽지도 올리지도 못합니다', steps([
    { st: 'now', h: 'Google로 확인', p: '본인인지 Google 로그인으로 한 번 더 확인합니다.' },
    { h: '그 노트북의 백업 연결 끊기', p: 'SYNK 서버가 바로 합니다.' },
    { h: 'Google 계정에서 그 노트북을 로그아웃하고 「업무 백업」 접근 지우기', p: '잃어버린 노트북에 남은 Google 로그인으로 복구 정보를 계속 읽을 수 있어서입니다. 신고한 뒤 다음 화면에서 합니다.' },
    { h: '이 PC에서 다시 로그인', p: '새 복구 정보를 맡기고, 새 복구 코드를 만듭니다.' },
  ]));
  return { kind: 'flow', tone: 'warn', here: '분실 신고', seg: [1, 2], top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { next: { id: 'next', pending: '분실 신고' }, drawer: { id: 'drawer', drawer: true } } };
}

function lost2() {
  const l = `${kick(`${h(EX.newDevice)} · 신고 끝, 남은 걸음 둘`)}${say('Google에서도', '그 노트북을 내보내세요.')}${then('백업 연결은 끊었습니다. 그 노트북에 남은 Google 로그인도 끊어야 합니다.')}
    <div class="rise i3">${steps([
      { st: 'now', h: `Google 기기 관리에서 「${h(EX.device)}」 로그아웃`, p: '훔쳐 갔을 수 있으면 Google 비밀번호도 바꾸세요.', lk: `<button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 열기 ${I.ext}</button>` },
      { st: 'now', h: '연결된 앱에서 「업무 백업」 접근 지우기', p: '1번을 마친 뒤에 지웁니다. 이 PC도 함께 로그아웃됩니다.', lk: `<button class="lnk sm" type="button" data-act="g-app">연결된 앱 열기 ${I.ext}</button>` },
    ])}</div>
    ${acts([{ id: 'next', label: '두 걸음을 마쳤습니다 · 다시 로그인', kind: 'main' }], '<span class="hint">2번은 앱이 알아채지만 1번은 알 수 없어 여기서 확인을 받습니다. 누르기 전에는 새 복구 정보를 맡기지 않습니다.</span>')}`;
  const r = panel('분실 신고 확인서', '', `<div class="rows">${row('신고한 때', h(EX.lost.ko))}${row('신고한 곳', h(EX.newDevice))}${row('백업 연결', '끊음')}${row('전에 받은 복구 코드', '쓸 수 없음')}${row('백업', '그대로')}${row('Google에서 로그아웃', '기다림')}${row('「업무 백업」 접근 지우기', '기다림')}${row('새 복구 코드', '그다음')}</div>`);
  return { kind: 'flow', tone: 'warn', here: '분실 신고', seg: [2, 2], top: [], html: flow(l, r),
    acts: { next: { id: 'next', to: 'home' }, 'g-dev': { id: 'g-dev', pending: 'Google 기기 관리 열기' }, 'g-app': { id: 'g-app', pending: '연결된 앱 열기' } } };
}

/* ── 복구 코드 ─────────────────────────────── */
function code(s) {
  const l = `${kick('되찾는 길 · 첫 주 안에 한 번')}${say('복구 코드를', '한 장 만들어 두세요.')}${then('Google 계정에 들어갈 수 없을 때 이 종이 한 장으로 백업을 엽니다.')}
    <div class="box rise i3"><b>이 종이를 가진 사람은 백업을 열 수 있습니다</b>금고나 서랍처럼 PC와 떨어진 곳에 두세요. 백업하는 폴더나 OneDrive 폴더 안에는 저장할 수 없습니다.</div>
    ${acts([{ id: 'print', label: '인쇄', kind: 'main' }, { id: 'usb', label: 'USB에 저장', kind: 'line' }, { id: 'home', label: '다음에 하기', kind: 'link' }], '<span class="hint">건너뛰면 설정 › 복구 코드에서 언제든 만들 수 있습니다.</span>')}`;
  const groups = EX.codeGroups;
  const grid = Array.from({ length: Math.ceil(groups.length / 4) }, (_, r) => `<i>${r + 1}</i>${groups.slice(r * 4, r * 4 + 4).map((g) => `<span>${g}</span>`).join('')}`).join('');
  const r = panel('업무 백업 · 복구 코드', `만든 날 2026. 11. 13. · ${h(s?.device || EX.device)} · ${h(s?.recovery?.email || EX.account)}`, `<div class="code">
    <div class="selbar"><span>가려 둠 · 옆에 다른 사람이 없을 때만 펼쳐 보세요</span><button class="lnk sm" type="button" data-act="reveal" aria-controls="cg" aria-expanded="false">글자 보기</button></div>
    <div class="cg hide" id="cg" role="group" aria-label="복구 코드" aria-hidden="true">${grid}</div>
    <p class="foot">새 PC에서 업무 백업을 깔고 첫 화면의 <b>「복구 코드로 되살리기」</b>를 누른 뒤, USB에 저장한 파일을 열거나 이 글자를 그대로 넣으세요. Google 계정 없이 열립니다.</p>
    <p class="foot">분실 신고나 사고 되돌리기를 하면 이 코드는 쓸 수 없게 되고, 새 코드를 다시 권해 드립니다.</p></div>`);
  return { kind: 'flow', tone: 'ok', here: '복구 코드', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { print: { id: 'print', pending: '복구 코드 인쇄' }, usb: { id: 'usb', pending: '복구 코드 저장' }, home: { id: 'home', to: 'home' }, reveal: { id: 'reveal' } } };
}

/* ── 한꺼번에 지워진 파일 ─────────────────── */
function massList() {
  const l = `${kick('작업 노트북 · 확인이 필요합니다')}${say('지워진 3,980개', '「문서」의 네 폴더입니다.')}${then('오늘 오전 11시 무렵 사라졌습니다. 확인하기 전까지 이전 판을 지우지 않습니다.')}
    ${acts([{ id: 'restore', label: '지워지기 전으로 되살리기', kind: 'main' }, { id: 'home', label: '돌아가기', kind: 'line' }])}`;
  const r = panel('지워진 파일', '폴더마다 · 지우기 전 판에 있던 수', `<div class="rows">${EX.massFiles.map(([n, w, c]) => row(`${h(n)}<br><span class="meta">${h(w)}</span>`, '', h(c))).join('')}${row('합계', '3,980개')}</div>`);
  return { kind: 'flow', tone: 'bad', here: '한꺼번에 지워짐', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { restore: { id: 'restore', pending: '지워지기 전 판에서 되살리기' }, home: { id: 'home', to: 'home' } } };
}

/* ── 설정 서랍 ─────────────────────────────── */
export function drawer(s) {
  const st = s || {};
  const folders = (st.sources || []).map((p) => `<div class="dr"><span class="nm">${h(folderName(p))}</span><span class="vl">${h(p)}${(st.missingSources || []).some((m) => m.toLowerCase() === p.toLowerCase()) ? ' · 찾을 수 없음' : ''}</span><button class="lnk sm" type="button" data-act="drop" data-path="${h(p)}" aria-label="「${h(folderName(p))}」 지키는 목록에서 빼기">빼기</button></div>`).join('');
  const automatic = !!st.automatic;
  const G = (title, rows) => `<section class="dg"><h3>${h(title)}</h3>${rows}</section>`;
  const R = (nm, vl, a = null, nudge = false) => `<div class="dr"><span class="nm">${h(nm)}${nudge ? '<i aria-hidden="true"></i><span class="sr"> (권함)</span>' : ''}</span><span class="vl">${vl}</span>${a ? `<button class="lnk sm" type="button" data-act="${h(a.id)}" aria-label="${h(`${nm} ${a.label}`)}">${h(a.label)}</button>` : ''}</div>`;
  return `<div class="dh"><h2>설정</h2><button class="tbtn" type="button" data-act="drawer-close">닫기</button></div>
    <p class="who">${h(st.recovery?.email || '')}${st.recovery?.email ? ' · ' : ''}${h(st.device || '이 PC')} · <span class="num">${h(st.version || '0.7.0')}</span></p>
    ${G('지키는 것', `${folders || R('지키는 폴더', '아직 없음')}<div class="dr"><span class="nm">폴더 더하기</span><span class="vl">문서, 바탕화면 밖의 작업 폴더도 지킬 수 있습니다</span><button class="lnk sm" type="button" data-act="add">더하기</button></div>
      ${R('쓰는 중인 파일', st.admin === false ? '표준 사용자 계정이라 그 프로그램을 닫았을 때 새로 담깁니다' : st.admin === true ? '관리자 계정이라 4시간에 한 번 따로 읽어 채웁니다' : '다른 프로그램이 쓰는 중인 파일은 그 프로그램을 닫은 뒤 첫 확인 때 담깁니다')}
      ${R('외장 드라이브 사본', '꺼짐', { id: 'external', label: '켜기' })}`)}
    ${G('되찾는 길', `${R('복구 코드', 'Google 계정에 못 들어갈 때 쓰는 종이 한 장 · 다음 업데이트에서 엽니다', { id: 'code', label: '만들기' }, true)}
      ${R('내 기기', `${st.device ? `${h(st.device)}(이 PC)` : '이 PC'} · 백업하는 기기. 잃어버리면 다른 PC나 새 PC의 이 서랍에서 분실 신고합니다(다음 업데이트에서 엽니다). 다른 PC가 없으면 SYNK에 연락해 주세요`, { id: 'lost', label: '다른 기기 분실 신고' })}
      ${R('사고가 났을 때 되돌리기', '29일 안이면 그 시각으로 되돌립니다 · 다음 업데이트에서 엽니다', { id: 'undo-1', label: '되돌리기' })}`)}
    ${G('이 앱', `${R('매시간 자동 백업', automatic ? '켜짐 · 창을 닫아도 매시간 뒤에서 조용히 돕니다' : '꺼짐', { id: automatic ? 'auto-off' : 'auto-on', label: automatic ? '끄기' : '켜기' })}
      ${R('트레이 아이콘', '알림 영역의 아이콘이 없어도 백업은 매시간 돕니다', { id: 'tray', label: '켜고 끄기' })}
      ${R('시범 측정', '백업, 알림, 설치 결과 숫자를 보냅니다. 파일 이름, 경로, 내용은 보내지 않습니다', { id: 'telemetry', label: '보내는 내용 보기' })}
      ${R('업데이트', `지금 판 <span class="num">${h(st.version || '0.7.0')}</span>`)}
      ${R('도움 요청', '보낼 내용을 먼저 보여 드립니다', { id: 'help', label: '쓰기' })}
      ${R('계정', `${h(st.recovery?.email || 'Google 계정')} · Google 2단계 인증을 켜 두세요`)}`)}`;
}

/** 쓰는 중인 파일 화면의 계정 갈래 — 엔진이 관리자 여부를 아직 주지 않으면(FUTURE.admin) 4시간 따로 읽기를 약속하지 않는다 */
function partialMode(id, s, fake) {
  if (id === 'partial-std' || s?.admin === false) return 'std';
  if (s?.admin === true || fake) return 'admin';
  return 'plain';
}

/** 화면 이름 → 그릴 것. ctx = { state, model, now, catalog, ui, fake } — fake는 예시 상태로 그리는 화면 확인용(시험 · 캡처) */
export function renderScreen(id, ctx) {
  const s = ctx.state, now = ctx.now, fake = !!ctx.fake;
  switch (id) {
    case 'start-1': return start1();
    case 'start-2': return start2();
    case 'start-3': return start3(s, fake);
    case 'restore': return restore(s, now, ctx.catalog);
    case 'partial': case 'partial-std': return partial(s, now, partialMode(id, s, fake));
    case 'move-0': return move0(s, now, fake);
    case 'move-1': return move1(ctx.ui);
    case 'move-2': return move2();
    case 'move-3': return move3();
    case 'move-4': return move4();
    case 'undo-1': return undo1(now);
    case 'undo-2': return undo2();
    case 'undo-3': return undo3();
    case 'lost': return lost1();
    case 'lost-2': return lost2();
    case 'code': return code(s);
    case 'mass-list': return massList();
    default: return homeScreen(ctx.model);
  }
}

/** 앱이 그리는 화면 이름 전부(시험 · tauri-driver · 캡처가 돈다) */
export const SCREENS = ['home', 'start-1', 'start-2', 'start-3', 'restore', 'partial', 'partial-std', 'move-0', 'move-1', 'move-2', 'move-3', 'move-4', 'undo-1', 'undo-2', 'undo-3', 'lost', 'lost-2', 'code', 'mass-list'];
export { FAKE };

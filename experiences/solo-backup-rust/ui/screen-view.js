// 화면 그리기 — 화면 모델(screen-model.js)과 예시 값(fake-screens.js)을 HTML 조각으로 바꾼다. DOM을 만지지 않는 순수 함수라 시험이 그대로 부른다.
// 말씨는 검정 클라이언트(결정 11-16): 상태 한 줄 · 큰 문장과 회색 둘째 줄 · 1px 줄 증거 · 채운 알약 하나 + 선 알약 + 밑줄 글자.
// 문구와 흐름은 시안 A(ui-mockups/_src/a.mjs)의 26화면 그대로이고, 종이 · 도장 · 책상만 걷었다.
// 동적인 값(경로 · 파일 이름 · 기기 이름)은 모두 h()로 막는다. 인라인 style은 쓰지 않는다(CSP) — 너비는 data-pct를 app.js가 넣는다.

import { count, dayKo, josa, placesKo, size, timeKo, whenKo } from './ko-format.js';
import { folderName, undoWindow, startStep, writerName, deviceLine, GOOGLE_STEP, pickedSources, restorePlace, sameOf, afterUndo,
  moveJob, moveRows, moveVolumes, moveKitNote, moveDeviceName, moveStopText, moveCounts, moveGroups, moveTitle, moveTakeList, moveFresh, moveLeft, placeKo,
  moveRechoose, moveStopCode, moveBigFolders, folderSubjectKo, tooBigKept, oldWho, oldFolders, oldWhere, oldFailText, OLD_NO_SPLIT_THEN, moveProgress, etaKo, COUNT_PART, moveRoots, appsRows, appsPhase, appsOutcome, settingRows, checksLeft, wingetText, APPS_MAX,
  appsJob, appsSettings, appsUnrestored, movedHere, AI_TOOL_ROWS, REST_MAX, MASK_MAX, MASK_LEN, massOf, massModel, leftOutOf, leftOutCountKo, leftOutName, UNNAMED } from './screen-model.js';
import { EX, FAKE } from './fake-screens.js';
import { failureText } from './state-store.js';

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
  // 지킬 폴더를 아직 모르는 연결(복구 전용, 첫 판 전)에는 「0곳」을 쓰지 않는다(Fable F4)
  if (present || ev.folders.rows.length) out.push(row('지키는 폴더', `${h(placesKo(present))}${files ? ` · ${h(files)}` : ''}`, h(bytes || '')));
  for (const r of ev.folders.rows.filter((x) => x.x)) out.push(r.gone ? row(h(r.k), h(r.path || ''), '<span class="x">찾을 수 없음</span>', 'sub') : row(h(r.k), h(r.main || ''), `<span class="x">${h(r.mark || '')}</span>`, 'sub'));
  if (ev.folders.more) out.push(row('그 밖의 폴더', `${h(count(ev.folders.more))}곳 더 바뀜`, '', 'sub'));
  for (const e of ev.extra) out.push(row(h(e.k), h(e.v)));
  // 한꺼번에 지워짐 화면은 그 일의 줄만 둔다 — 작은 창에서도 두 단추가 첫 화면에 남게(되살려 본 날은 그 일과 상관없다)
  if (m.id !== 'home-run' && m.id !== 'home-mass') out.push(row(h(ev.proof.k), h(ev.proof.day), ev.proof.bad ? `<span class="x">${h(ev.proof.short)}</span>` : h(ev.proof.short || '')));
  return `<div class="rows rise i4">${out.join('')}</div>`;
}

/**
 * 솔리오가 넘긴 처음 시작을 이 창이 바로 잇지 못했을 때의 상자(app.js solioSetup — acct.solioBox = { mode, restore }). 글은 그릴 때마다
 * 지금 상태와 지금 화면의 단추로 짓는다. 되살리기만 하던 PC가 이어서 백업해 백업하는 PC가 되면 상자를 걷는다(Opus 대체 다시 검수 -b).
 * 짚는 단추는 화면 모델이 「이 PC에서 백업을 시작하는 걸음」으로 표시한 것(take)뿐이다. 그런 걸음이 없는 화면(되돌리기 확인 등)에는 짚지 않는다(-c)
 */
function solioBoxOf(sb, s, m) {
  if (!sb) return null;
  const restore = s?.mode === 'restore';
  if (sb.restore && !restore) return null;
  const title = `솔리오의 ${sb.mode === 'move' ? '「이 PC로 옮겨 오기」를' : '「보호 시작」을'} 여기서 바로 잇지 못했습니다`;
  if (!restore) return { title, text: '이 PC는 이미 이 앱으로 백업하도록 설정되어 있습니다. 지키는 폴더는 설정 서랍에서 바꿀 수 있습니다.' };
  const take = (m?.actions || []).find((x) => x.take);
  const lead = s?.account?.connected ? '이 PC는 이미 한 Google 계정의 백업에 이어 둔 연결이라 처음부터 새로 시작하지 않았습니다. 아직 이 PC에서는 백업하지 않고 있습니다.'
    : '이 PC는 이미 되살리기만 하는 연결로 설정되어 있어 처음부터 새로 시작하지 않았습니다.';
  return { title, text: [lead,
    take ? `같은 Google 계정으로 이 PC에서 백업하려면 아래 「${take.label}」${josa(take.label, '을/를').slice(take.label.length)} 누르세요.` : '',
    '다른 Google 계정으로 새로 지키는 길은 다음 업데이트에서 엽니다.'].filter(Boolean).join(' ') };
}
/** 단추 줄의 힌트와 그 옆의 밑줄 단추(hintAct — 한꺼번에 지워짐의 놓을 자리 바꾸기). 도는 호출이 있으면 막는다 */
const hintOf = (m, acct) => (m.hint || m.hintAct ? `<span class="hint">${m.hint ? h(m.hint) : ''}${m.hintAct ? `${m.hint ? ' ' : ''}<button class="lnk sm" type="button" data-act="${h(m.hintAct.id)}"${acct?.running ? ' aria-disabled="true"' : ''}>${h(m.hintAct.label)}</button>` : ''}</span>` : '');
export function homeScreen(m, acct = null, s = null) {
  // 고리는 여럿일 수 있다(담지 못한 이름과 쓰는 중인 파일이 함께 있을 때)
  const links = m.links || (m.link ? [m.link] : []);
  const link = links.length ? `<div class="act rise i3">${links.map((x) => `<button class="lnk" type="button" data-act="${h(x.to)}">${h(x.label)} ${I.rarr}</button>`).join('')}</div>` : '';
  const r = m.restored;
  const done = r ? `<p class="done${r.bad ? ' bad' : ''} rise i3"><i class="dot" aria-hidden="true"></i><span>${h(r.text)}</span>${r.act ? `<button class="lnk sm" type="button" data-act="${h(r.act.id)}">${h(r.act.label)}</button>` : ''}</p>` : '';
  // 분실 신고 뒤 Google 걸음 — 확인을 받아야 그 화면의 계정 단추(continueBackup · rotateReadKey)가 열린다
  const ack = !!acct?.googleAck, stepAck = m.googleStep ? stepAckOf(ack) : '';
  // 도는 중인 단추(acct.running)와, Google 걸음을 확인하기 전의 계정 단추는 막는다
  const actions = m.actions.map((a) => (acct?.running === a.id || (m.googleStep && !ack && a.account) ? { ...a, disabled: true } : a));
  const html = `<div class="in">${kick(h(m.kick))}${say(h(m.title))}${then(h(m.sub))}${box(m.box)}${box(solioBoxOf(acct?.solioBox, s, m))}${stepAck}${notes((m.notes || []).map(h))}${link}${done}${homeRows(m)}${acts(actions.map((a) => ({ ...a })), `${hintOf(m, acct)}${gcancel(acct)}`)}</div>`;
  const map = {}; for (const a of m.actions) map[a.id] = a; if (m.googleStep) map['google-ack'] = { id: 'google-ack' }; for (const x of links) map[x.to] = { id: x.to, to: x.to }; if (r?.act) map[r.act.id] = r.act;
  if (m.hintAct) map[m.hintAct.id] = { id: m.hintAct.id };
  return { kind: 'home', tone: m.tone, here: '백업·복구', top: [{ id: 'drawer', label: '설정' }], html, acts: map };
}

/* ── 첫 시작 ───────────────────────────────── */
/** 기기 목록의 한 줄(서버 devices · LIMIT_DEVICES의 details.devices) */
// 좁은 판에서도 꺾이지 않게 마지막 연결은 이름 아래 작은 글로 둔다
const deviceRow = (d, now, same) => { const x = deviceLine(d, now, same); return row(`${h(x.name)}${x.seen ? `<span class="sr"> · </span><br><span class="meta">${h(x.seen)}</span>` : ''}`, h(x.role)); };
/** 계정 주소 — 개통 계정(account.email), 없으면 옛 복구 연결(recovery.email) */
const mail = (s) => s?.account?.email || s?.recovery?.email || '';
/** Google 로그인을 기다리는 동안의 「그만두기」(cancelGoogle — 창의 호출 줄을 잡지 않는 길로 간다) */
const gcancel = (acct) => (acct?.googleWait || acct?.signing ? '<button class="lnk sm" type="button" data-act="google-cancel">Google 로그인 그만두기</button>' : '');
/** 분실 신고 뒤 Google 걸음에서 여는 두 페이지(openGoogleAccount 'devices' · 'removal' — 주소는 엔진이 정한다) */
const gpages = () => `<button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 열기 ${I.ext}</button><button class="lnk sm" type="button" data-act="g-app">연결된 앱 열기 ${I.ext}</button>`;
/** 분실 신고 뒤 Google 걸음 확인 단추 */
export const stepAckOf = (ack) => `<div class="act rise i3">${gpages()}<button class="lnk sm" type="button" data-act="google-ack" aria-pressed="${ack}">${ack ? 'Google에서 지웠습니다 · 확인함' : 'Google에서 지웠습니다'}</button></div>`;
/** 분실 신고 뒤 Google 걸음 상자와 확인 단추 */
const stepBoxOf = (needStep, ack) => (needStep ? `<div class="box rise i3"><b>${h(GOOGLE_STEP.title)}</b>${h(GOOGLE_STEP.text)}</div>
    ${stepAckOf(ack)}` : '');
/** 11월 12일 오후 2:59 */
const atKo = (t) => `${dayKo(t).replace(/ [일월화수목금토]$/, '')} ${timeKo(t)}`;

/**
 * 기기가 다 찼을 때(LIMIT_DEVICES) — 되살리기만 하는 기기는 Google 확인만으로 끊는다(revokeDevice, 화면 요청 9 — 이 PC에 기기가 없어도 된다).
 * 서버는 그때 백업하는 기기를 끊지 않으므로(DEVICE_STATE) 그 줄에는 단추를 두지 않는다. 다시 깐 PC의 옛 연결(sameInstall, 요청 15)이 백업하는
 * 기기이면 되살리기만 하는 기기 하나를 끊고 이은 뒤 「이 PC로 옮겨 오기」나 「되살리지 않고 이 PC에서 이어서 백업」(startRead)으로 자리를 옮기게 한다.
 * acct.freed = 방금 끊은 기기 이름 — 그동안 남은 줄에는 「끊기」를 두지 않는다(한 자리면 이을 수 있다, Fable F2). 「다시 시작」이 freed를 비운다
 */
function limitBox(limit, acct, now, s) {
  const run = acct?.running || null, same = s?.account?.sameInstall;
  const rows = limit.map((d) => {
    const x = deviceLine(d, now, same), can = !acct?.freed && d?.role === 'read' && typeof d?.id === 'string' && d.id;
    const btn = !can ? ''
      : acct?.revoking === d.id ? `<span class="meta">끊는 중</span> <button class="lnk sm" type="button" data-act="google-cancel" data-device="${h(d.id)}" aria-label="${h(`「${x.name}」 연결 끊기 그만두기`)}">그만두기</button>`
      : `<button class="lnk sm" type="button" data-act="limit-revoke" data-device="${h(d.id)}" aria-label="${h(`「${x.name}」 연결 끊기`)}"${run ? ' aria-disabled="true"' : ''}>끊기</button>`;
    return row(`${h(x.name)}${x.seen ? `<span class="sr"> · </span><br><span class="meta">${h(x.seen)}</span>` : ''}`, h(x.role), btn);
  }).join('');
  const reads = limit.filter((d) => d?.role === 'read').length, oldWrite = limit.some((d) => d?.role === 'write' && deviceLine(d, now, same).earlier);
  // 다시 깐 PC의 옛 연결이 백업하는 기기이면, 끊기 안내 대신 자리를 옮기는 길을 상자 안에 쓴다(좁은 창에서도 주 단추가 첫 화면에 남게)
  const body = !reads ? '백업하는 기기는 여기서 끊을 수 없습니다. 급하면 SYNK에 연락해 주세요.'
    : oldWrite ? '「이 PC · 앞서 깐 것」은 백업하는 기기라 끊을 수 없습니다. 되살리기만 하는 기기 하나를 끊고 이 PC를 이으세요. 그다음 「이 PC로 옮겨 오기」나 「되살리지 않고 이 PC에서 이어서 백업」을 고르면 이 PC가 백업을 이어받습니다.'
    : '쓰지 않는 되살리기 기기를 끊으면 이 PC를 이을 수 있습니다. 끊을 때 Google 로그인을 한 번 더 합니다.';
  // 끊지 못한 까닭(acct.limitWhy — NOT_FOUND · DEVICE_STATE)은 다음 누름까지 상자에 남긴다(Fable -b 2)
  const why = acct?.limitWhy && typeof acct.limitWhy.text === 'string' ? acct.limitWhy : null;
  const head = acct?.freed ? `<b>「${h(acct.freed)}」 연결을 끊었습니다</b>「다시 시작」을 누르면 이 PC를 이을 수 있습니다. 이은 뒤 「복구 정보 다시 맡기기」 단추가 보이면 눌러 주세요. 눌러야 끊은 기기가 이 백업을 더는 열지 못합니다.`
    : why ? `<b>「${h(why.name || '그 기기')}」 연결을 끊지 못했습니다</b>${h(why.text)}`
    : `<b>이 계정에 이을 수 있는 기기가 다 찼습니다</b>백업하는 기기 하나와 되살리기만 하는 기기 둘까지 이을 수 있습니다. ${body}`;
  return `<div class="box rise i3">${head}</div>${rows ? `<div class="rows rise i3">${rows}</div>` : ''}`;
}

/** 첫 시작 — Google로 시작(signInGoogle). acct는 창이 기억하는 개통 걸음(app.js): signing · limit(기기가 다 참) */
function start1(s, acct, now, fake) {
  const signing = !!acct?.signing, limit = Array.isArray(acct?.limit) ? acct.limit.filter((d) => !d?.state || d.state === 'active') : null;
  const full = limit ? limitBox(limit, acct, now, s) : '';
  // 기기를 끊는 동안(limit-revoke)에도 브라우저의 Google 로그인을 기다린다 — 그 걸음에 맞는 글을 쓴다(카본 A1)
  const revoking = acct?.running === 'limit-revoke';
  // Google 동의 화면의 Drive 칸은 꺼진 채로 나온다 — 켜지 않으면 DENIED로 끝난다(개통 서버 세션 실측 11-17). 누르기 전부터 말한다
  // 솔리오의 「보호 시작」 · 「이 PC로 옮겨 오기」로 온 처음 시작(설계 4.13) — 브라우저가 저절로 열린 까닭을 먼저 쓴다
  const solioBy = signing && acct?.solio ? `솔리오에서 ${acct.solio === 'move' ? '「이 PC로 옮겨 오기」를' : '「보호 시작」을'} 눌러 Google 로그인을 바로 열었습니다. ` : '';
  const hint = signing ? `${solioBy}브라우저에서 Google 계정을 고르고 「계속」을 누르세요. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요. 5분 안에 마치지 않으면 다시 눌러야 합니다.`
    : revoking ? '브라우저에서 Google 계정을 고르고 「계속」을 누르세요. Google Drive가 적힌 칸이 나오면 켜고 「계속」을 눌러 주세요. 그러면 그 기기의 연결을 끊습니다.' : '브라우저가 열리면 계정을 고르고 「계속」을 누르세요. Google Drive가 적힌 칸이 나오면 꼭 켜 주세요.';
  // 앞선 「Google로 시작」이 DENIED로 끝났으면 다시 누르기 전에 그 칸을 상자로 보인다(다음 누름에 비운다)
  const denied = acct?.denied && !limit ? '<div class="box rise i3"><b>Google에서 허락을 받지 못했습니다</b>Google 화면의 Google Drive가 적힌 칸은 꺼진 채로 나옵니다. 그 칸을 켜지 않고 넘어가면 복구 정보를 Google 계정에 맡길 수 없어 시작하지 못합니다. 다시 눌러 「계속」까지 눌러 주세요. 그 칸이 나오면 켜 주세요.</div>' : '';
  // 진단(찾아낸 작업 폴더)이 엔진에 들어오기 전에는 다음 화면에서 손님이 폴더를 고른다 — 그 흐름대로 말한다(Fable F3).
  // 상태에 계정 칸이 없는 예시 화면은 시안 A의 글 그대로
  const real = !!s?.account || !fake;
  const html = `<div class="in">${kick(real ? 'Google로 시작' : '설정할 것이 없습니다')}${say('업무 자료를', '매시간 저절로 지킵니다.')}
    ${limit ? '' : then(real ? 'Google 계정으로 시작한 뒤 지킬 폴더를 고르면, 그 폴더를 암호화해 클라우드에 올리고 그다음부터 매시간 바뀐 것만 저절로 올립니다.' : 'Google 계정으로 시작하면 이 PC의 문서, 바탕화면, 사진과 찾아낸 작업 폴더를 암호화해 클라우드에 올립니다.')}
    ${denied}${full || notes(['<b>SYNK도 백업 내용을 열 수 없습니다.</b> 여는 열쇠는 내 Google 계정에만 맡깁니다.', '그래서 Google 계정에 들어갈 수 있는 사람은 백업도 열 수 있습니다. <b>Google 2단계 인증을 켜 두세요.</b>'])}
    ${acts([{ id: 'google', label: signing ? '브라우저에서 계속해 주세요' : limit ? '다시 시작' : 'Google로 시작', kind: 'main', icon: 'google', disabled: signing || revoking }], `<span class="hint">${h(hint)}</span>${revoking ? '' : gcancel(acct)}<p class="alt"><span>Google 계정에 들어갈 수 없나요?</span><button class="lnk sm" type="button" data-act="code-in">복구 코드로 되살리기</button></p>`)}
    <p class="foot rise i6">${h(EX.telemetry)}</p></div>`;
  return { kind: 'home', tone: 'setup', here: '백업·복구', top: [], html, acts: { google: { id: 'google', call: 'signInGoogle', signin: true }, 'code-in': { id: 'code-in', pending: '복구 코드' } } };
}

function start2Example() {
  const list = EX.folders.map((f) => `<div class="row share"><span class="k">${h(f.name)}<span class="sr"> · </span><br><span class="meta">${f.found ? '찾아낸 작업 폴더 · ' : ''}${h(f.path)}</span></span><span class="v">${gauge(f.pct)}</span><span class="w">${h(f.size)} · ${h(f.files)}개</span></div>`).join('');
  const r = panel('보호 범위', `예상 ${EX.total.files}개 · ${EX.total.size}`, `<div class="rows">${list}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="add">다른 폴더 더하기 ${I.rarr}</button></div>
    <p class="foot">OneDrive에만 있는 파일 <b class="num">${EX.onedriveOnly}</b>개는 OneDrive가 지킵니다. 이 백업에는 담지 않습니다.</p>
    <div class="rows">${row('지키는 양', gauge(EX.capPct), `${EX.total.size} / ${EX.cap}까지`, 'share')}</div>`);
  const l = `${kick(`${h(EX.device)} · 보호 범위`)}${say('이 폴더를 지킵니다.')}${then('앱이 골라 둔 그대로 두면 됩니다. 「보호 시작」을 누르면 목록의 폴더를 암호화해 올리기 시작합니다.')}${acts([{ id: 'protect', label: '보호 시작', kind: 'main' }])}<p class="foot rise i6">${h(EX.telemetry)}</p>`;
  return { kind: 'flow', tone: 'setup', here: '보호 범위', top: [], html: flow(l, r), acts: { protect: { id: 'protect', pending: '개통' }, add: { id: 'add', call: 'addSources' } } };
}

/**
 * 보호 범위(실제 상태) — 이 PC가 백업할 기기일 때. 고른 폴더(state.selection — b2 프로필)를 보이고 「보호 시작」(startProtection)으로 간다.
 * 저장소가 이미 있으면(REPO_EXISTS) 「이어서 백업」(continueBackup). 분실 신고 뒤에는 Google 걸음을 확인받아야 단추가 열린다.
 * 진단이 찾은 작업 폴더 · 예상 크기는 엔진이 아직 주지 않아 그리지 않는다(엔진 부탁 3).
 */
function start2(s, acct, fake, now) {
  if (!s?.account && fake) return start2Example();
  if (startStep(s) === 'read') return startRead(s, acct, now);
  const device = h(s?.device || '이 PC');
  const picked = Array.isArray(s?.selection?.sources) ? s.selection.sources : [];
  const needStep = !!s?.account?.googleStepRequired, ack = !!acct?.googleAck, run = acct?.running || null;
  const blocked = !picked.length || (needStep && !ack) || !!run;
  // 보호 범위도 같은 상자와 두 페이지 단추를 쓴다(카본 셋째 B1)
  const stepBox = stepBoxOf(needStep, ack);
  // 솔리오의 「이 PC로 옮겨 오기」로 왔는데 이 계정을 백업하는 다른 PC가 없다 — 옮겨 오기를 열지 않은 까닭을 쓴다(app.js solioMove)
  const noMove = acct?.solioNoMove ? `<div class="box rise i3"><b>옮겨 올 PC가 없습니다</b>솔리오에서 「이 PC로 옮겨 오기」를 고르셨지만, 이 계정을 지금 백업하는 다른 PC가 없어 옮겨 오기를 시작하지 않았습니다. ${acct.repoExists ? '이 계정의 백업에 이어서 이 PC가 백업할 수 있습니다.' : '이 PC를 지키려면 지킬 폴더를 고르세요.'}</div>` : '';
  const list = picked.length ? picked.map((p) => row(h(folderName(p)), `<span class="meta">${h(p)}</span>`)).join('') : '<p class="empty">아직 고른 폴더가 없습니다.</p>';
  const r = panel(acct?.repoExists ? '이어서 지킬 폴더' : '보호 범위', picked.length ? `폴더 ${count(picked.length)}개` : '', `<div class="rows">${list}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="pick"${run ? ' aria-disabled="true"' : ''}>${picked.length ? '폴더 다시 고르기' : '폴더 고르기'} ${I.rarr}</button></div>
    <p class="foot">여러 폴더를 한 번에 고를 수 있습니다. 고른 폴더 안의 파일을 모두 암호화해 올립니다. 프로그램 목록과 앱 설정도 하루 한 번 함께 지킵니다. 로그인 정보와 열쇠는 담지 않습니다.</p>`);
  const hint = !picked.length ? '<span class="hint">지킬 폴더를 먼저 골라 주세요.</span>' : needStep && !ack ? '<span class="hint">Google 계정을 정리한 뒤에 누를 수 있습니다.</span>' : '';
  const l = acct?.repoExists
    ? `${kick(`${device} · 이어서 백업`)}${say('이 계정에는', '이미 백업이 있습니다.')}${then('같은 PC를 다시 깔았거나 옛 PC의 연결을 끊었다면, 그 백업에 이어서 이 PC가 매시간 올립니다. 지금까지의 판은 그대로 둡니다.')}${noMove}${stepBox}${acts([{ id: 'continue', label: '이어서 백업', kind: 'main', disabled: blocked }], hint)}`
    : `${kick(`${device} · 보호 범위`)}${say(picked.length ? '이 폴더를 지킵니다.' : '지킬 폴더를 고르세요.')}${then(picked.length ? '「보호 시작」을 누르면 목록의 폴더를 암호화해 올리기 시작합니다.' : '문서, 바탕화면, 작업 폴더처럼 매일 고치는 폴더를 고르세요.')}${noMove}${stepBox}${acts([{ id: 'protect', label: '보호 시작', kind: 'main', disabled: blocked }], hint)}`;
  return { kind: 'flow', tone: 'setup', here: '보호 범위', top: [], html: flow(l, r),
    acts: { protect: { id: 'protect', call: 'startProtection', account: true }, continue: { id: 'continue', call: 'continueBackup', account: true }, pick: { id: 'pick', call: 'chooseSources', onAccountProfile: true }, 'google-ack': { id: 'google-ack' } } };
}

/**
 * 이 계정의 백업을 다른 PC가 하고 있을 때(role read). 「이 PC에서 이어서 백업」은 폴더 고르기 → 확인 → openAccountBackup →
 * takeWriteSeat → continueBackup 차례다(app.js takeOver, 조율 세션 c725f319c 부탁 12). 옮겨 오기는 옮겨 오기 메서드 뒤에 잇는다.
 */
function startRead(s, acct, now) {
  const device = h(s?.device || '이 PC'), writer = writerName(s, acct?.devices);
  const devices = Array.isArray(acct?.devices) ? acct.devices : null;
  const devicePanel = panel('이 계정의 기기', '', devices ? (devices.length ? `<div class="rows">${devices.map((d) => deviceRow(d, now, s?.account?.sameInstall)).join('')}</div>` : '<p class="empty">기기 목록이 비어 있습니다.</p>')
    : acct?.devicesError ? `<p class="empty">기기 목록을 읽지 못했습니다. ${h(acct.devicesError)}</p><div class="act"><button class="lnk sm" type="button" data-act="devices-reload">다시 읽기 ${I.rarr}</button></div>` : '<p class="empty">기기 목록을 읽는 중입니다.</p>');
  if (acct?.take) {
    const picked = pickedSources(s), needStep = !!s?.account?.googleStepRequired, ack = !!acct?.googleAck, run = acct?.running || null;
    const list = picked.length ? picked.map((p) => row(h(folderName(p)), `<span class="meta">${h(p)}</span>`)).join('') : '<p class="empty">아직 고른 폴더가 없습니다.</p>';
    const r = panel('이 PC에서 지킬 폴더', picked.length ? `폴더 ${count(picked.length)}개` : '', `<div class="rows">${list}</div>
      <div class="act"><button class="lnk sm" type="button" data-act="pick"${run ? ' aria-disabled="true"' : ''}>${picked.length ? '폴더 다시 고르기' : '폴더 고르기'} ${I.rarr}</button></div>
      <p class="foot">고른 폴더를 이 PC에서 매시간 올립니다. 이 PC의 파일은 옛 백업으로 되살리지 않습니다.</p>`);
    const l = `${kick(`${device} · 이 PC에서 이어서 백업`)}${say('이 PC에서', '이어서 백업합니다.')}
      ${then(`${writer ? `「${h(writer)}」${pp(writer, '은/는')}` : '지금 백업하는 PC는'} 그때부터 백업하지 않습니다. 지금까지의 판은 그대로 두고, 이 PC가 같은 백업에 이어서 매시간 올립니다.`)}${stepBoxOf(needStep, ack)}
      ${acts([{ id: 'take-go', label: '이 PC에서 이어서 백업', kind: 'main', disabled: !picked.length || (needStep && !ack) || !!run }, { id: 'take-back', label: '돌아가기', kind: 'link' }],
        `<span class="hint">${!picked.length ? '지킬 폴더를 먼저 골라 주세요.' : '누르면 Google 로그인을 한 번 더 합니다.'}</span>${gcancel(acct)}`)}`;
    return { kind: 'flow', tone: 'setup', here: '이 계정의 백업', top: [], html: flow(l, r),
      acts: { 'take-go': { id: 'take-go', flow: 'takeOver', account: true, google: true }, 'take-back': { id: 'take-back' }, pick: { id: 'pick', call: 'chooseSources', onAccountProfile: true }, 'google-ack': { id: 'google-ack' } } };
  }
  const needStep = !!s?.account?.googleStepRequired, ack = !!acct?.googleAck;
  const l = `${kick(`${device} · 이 계정의 백업`)}${say('이 계정의 백업은', writer ? `「${h(writer)}」${pp(writer, '이/가')} 하고 있습니다.` : '다른 PC가 하고 있습니다.')}
    ${then('백업하는 기기는 한 번에 하나입니다. 새 PC로 바꾸셨다면 옛 PC의 백업을 이 PC로 옮겨 올 수 있습니다.')}${stepBoxOf(needStep, ack)}
    ${acts([{ id: 'move', label: '이 PC로 옮겨 오기', kind: 'main', disabled: (needStep && !ack) || !!acct?.running }, { id: 'open', label: '이 PC에서 파일만 되살리기', kind: 'line', disabled: (needStep && !ack) || !!acct?.running }, { id: 'take', label: '되살리지 않고 이 PC에서 이어서 백업', kind: 'link' }],
      `<span class="hint">「옮겨 오기」는 옛 PC의 백업을 이 PC의 자리에 놓은 뒤 이 PC로 이어서 백업합니다. 「파일만 되살리기」는 옛 PC의 백업을 그대로 두고 이 PC에서 파일을 꺼낼 때 씁니다. 잃어버린 기기는 「설정」에서 분실 신고합니다.</span>${gcancel(acct)}`)}`;
  return { kind: 'flow', tone: 'setup', here: '이 계정의 백업', top: [{ id: 'drawer', label: '설정' }], html: flow(l, devicePanel),
    acts: { move: { id: 'move', flow: 'moveOpen', account: true, ...(needStep ? { google: 'maybe' } : {}) }, open: { id: 'open', flow: 'openRead', account: true, ...(needStep ? { google: 'maybe' } : {}) }, take: { id: 'take' }, 'google-ack': { id: 'google-ack' } } };
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
function restore(s, now, cat, ui, mv, acct) {
  if (cat?.req) return restoreScoped(s, now, cat, ui, mv, acct);
  const place = restorePlace(s, ui?.place, now, ui?.sentDefaultAt);
  const last = s?.lastBackup?.at;
  const total = cat?.fileCount ?? s?.lastBackup?.files;
  const sel = cat?.selection?.count || 0;
  const placeHint = place.mode === 'default' ? `누르면 다운로드 안의 「${place.name}」 폴더에 바로 놓습니다. 같은 이름이 있으면 번호를 붙여 새로 만듭니다.`
    : place.unsafe ? '다운로드에는 놓을 수 없어, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : place.guarded ? '다운로드도 지키는 폴더라, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : '누르면 놓을 폴더를 고르는 창이 한 번 뜹니다.';
  // 기본 자리에는 폴더 고르는 창이 없어, 전체 되살리기는 크기와 자리를 적고 한 번 더 누르게 한다(도는 되살리기를 그만두는 길이 아직 없다)
  const confirmAll = place.mode === 'default' && !!ui?.confirmAll;
  const allSize = s?.lastBackup?.bytes ? ` · ${size(s.lastBackup.bytes)}` : '';
  const confirmBox = confirmAll ? `<div class="box rise i3" id="confirm-all"><b>전체 ${total ? `${count(total)}개` : ''}${h(allSize)}를 되살릴까요?</b>다운로드 안의 「${h(place.name)}」 폴더에 놓습니다. 끝날 때까지 다른 일은 기다립니다. 원래 파일은 그대로 둡니다.</div>` : '';
  // 한꺼번에 지워지기 전의 판은 기본 화면에서 꺼낸다(restoreMassBefore — 되살린 뒤에는 단추 이름이 바뀌어 이름으로 부르지 않는다, FA6). 찾을 수 없는 폴더의 판에서 꺼내는 길은 아직 없다
  const mh = massOf(s);
  const heldText = [s?.missingSources?.length ? '찾을 수 없는 폴더의 판은 지우지 않고 붙들어 두었습니다. 그 판에서 꺼내는 길은 아직 준비 중입니다.' : '',
    mh ? `한꺼번에 ${mh.word} 전의 판은 기본 화면에서 꺼냅니다.` : ''].filter(Boolean);
  const held = heldText.length ? notes([`${heldText.join(' ')} 이 목록은 가장 최근 판입니다.`]) : '';
  // 옮겨 온 PC — 옛 PC의 판에서 꺼내는 길(조율 세션 793e0d6dc). 이 목록은 이 PC의 판이다
  const oldLink = mv?.state?.from ? `<div class="act rise i3"><button class="lnk sm" type="button" data-act="old-start">옛 PC 백업에서 꺼내기 ${I.rarr}</button></div>` : '';
  const l = `${kick(last ? `가장 최근 판 · ${h(whenKo(last, now).replace(/^(오전|오후)/, '오늘 $1'))}` : '아직 백업이 없습니다')}${say('무엇을 되살릴까요?')}
    ${then('고른 파일은 지키는 폴더 밖의 새 폴더에 되살립니다. 원래 파일은 그대로 두고, 되살린 뒤 백업과 같은지 하나하나 확인합니다.')}${held}${oldLink}
    ${confirmBox}${confirmAll ? acts([{ id: 'restore-all-go', label: '전체 되살리기 시작', kind: 'main' }, { id: 'restore-all-no', label: '그만두기', kind: 'link' }])
      : acts([{ id: 'restore-sel', label: sel ? `고른 ${count(sel)}개 되살리기` : '고른 파일 되살리기', kind: 'main', disabled: !sel }, { id: 'restore-all', label: total ? `전체 ${count(total)}개 되살리기` : '전체 되살리기', kind: 'line' }],
      `<span class="hint">${h(placeHint)}</span>`)}`;
  let list;
  if (cat?.error) list = `<p class="empty">${h(cat.error)}</p><div class="act"><button class="lnk sm" type="button" data-act="reopen">목록 다시 열기 ${I.rarr}</button></div>`;
  else if (!cat || cat.loading) list = '<p class="empty">목록을 여는 중입니다.</p>';
  else if (!cat.rows?.length) list = `<p class="empty">${cat.query ? `「${h(cat.query)}」${pp(cat.query, '이/가')} 든 파일이 없습니다.` : '되살릴 파일이 없습니다.'}</p>`;
  else list = cat.rows.map((f) => `<button class="fl" type="button" role="checkbox" aria-checked="${!!f.selected}" data-file="${h(f.id)}"><span class="cb" aria-hidden="true"></span><span class="nm">${h(f.name)}</span><span class="vl">${h(size(f.size))}${f.mtime ? ` · ${h(dayKo(f.mtime).replace(/ [일월화수목금토]$/, ''))}` : ''}</span><span class="ds">${h(folderName(String(f.source || '').replace(/^\d+-/, '')))}${sub(f.path)}</span></button>`).join('');
  const more = cat && cat.total > (cat.offset || 0) + (cat.rows?.length || 0) ? `<div class="act"><button class="lnk sm" type="button" data-act="more">더 보기 · ${count(cat.total - (cat.offset || 0) - cat.rows.length)}개 ${I.rarr}</button></div>` : '';
  const r = panel('찾기', `${total ? `${count(total)}개 가운데 · ` : ''}${last ? `${h(whenKo(last, now))} 판` : ''}`,
    `<div class="find">${I.search}<input id="find" type="search" aria-label="파일 이름으로 찾기" placeholder="파일 이름으로 찾기" autocomplete="off" spellcheck="false" maxlength="200" value="${h(cat?.query || '')}"><em aria-live="polite">${cat?.total !== undefined ? `${count(cat.total)}개 찾음` : ''}</em></div>
    <div class="files" role="group" aria-label="찾은 파일">${list}</div>${more}
    <div class="selbar"><span><b class="num">${count(sel)}개</b> 고름${sel ? ` · <span class="num">${h(size(cat.selection.bytes))}</span>` : ''}${sel ? ' <button class="lnk sm" type="button" data-act="clear">고른 것 비우기</button>' : ''}</span>
      <span>놓을 자리 ${place.mode === 'default' ? `<b>다운로드 › ${h(place.name)}</b> <button class="lnk sm" type="button" data-act="place-pick">자리 바꾸기</button>` : `<b>누를 때 고름</b>${place.guarded ? '' : ' <button class="lnk sm" type="button" data-act="place-default">다운로드에 놓기</button>'}`}</span></div>`);
  return { kind: 'flow', tone: 'ok', here: '파일 되살리기', back: 'home', top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { 'restore-sel': { id: 'restore-sel', call: 'restoreSelected' }, 'restore-all': place.mode === 'default' ? { id: 'restore-all', confirmAll: true } : { id: 'restore-all', call: 'restoreLatest' },
      'restore-all-go': { id: 'restore-all-go', call: 'restoreLatest' }, more: { id: 'more' }, clear: { id: 'clear' } } };
}

/**
 * 옛 PC 판의 범위로 연 목록(openFileCatalog의 from · folder · sub, 조율 세션 793e0d6dc). 받는 곳은 늘 새 폴더라 고른 파일만 꺼낸다 —
 * 「전체 되살리기」(restoreLatest)는 이 PC의 판을 통째로 되살리는 길이라 두지 않는다. cat.req = 창이 연 범위({ fromName, label, sub })
 */
function restoreScoped(s, now, cat, ui, mv, acct) {
  const place = restorePlace(s, ui?.place, now, ui?.sentDefaultAt), req = cat.req, where = oldWhere(req.label, req.sub);
  // 옛 기기 이름은 그릴 때 정한다 — 기기 목록이 늦게 와도 맞는 이름이 된다(카본 A1)
  const fromName = moveDeviceName(req.from, acct?.devices, s?.account?.sameInstall);
  const sel = cat.selection?.count || 0, total = cat.fileCount;
  const placeHint = place.mode === 'default' ? `누르면 다운로드 안의 「${place.name}」 폴더에 바로 놓습니다. 같은 이름이 있으면 번호를 붙여 새로 만듭니다.`
    : place.unsafe ? '다운로드에는 놓을 수 없어, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : place.guarded ? '다운로드도 지키는 폴더라, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : '누르면 놓을 폴더를 고르는 창이 한 번 뜹니다.';
  const at = cat.snapshotAt ? ` · ${h(whenKo(cat.snapshotAt, now))} 판` : '';
  // 받기는 옛 PC가 백업하던 폴더 모두와 겹치는 자리(그 안, 그 폴더들이 든 위 폴더)에 놓지 않는다(engine.cjs restoreSelected — capture의
  // plans 전체, paths.cjs overlap · Opus 대체 검수 F4, -b FA1). 결과를 읽어 두었으면 그 폴더 이름을 적는다
  const olds = oldFolders(mv?.result).map((f) => f.label), oldNames = olds.length > 4 ? `${olds.slice(0, 3).join(' · ')} 등 ${count(olds.length)}곳` : olds.join(' · ');
  const notHere = `옛 PC가 백업하던 폴더${oldNames ? `(${oldNames})` : ''}와 그 안, 그 폴더들이 든 위 폴더에는 놓을 수 없습니다.`;
  // 한 번에 1,000개까지 고른다(restore-select.cjs LIMITS.selected). 찾은 것이 그 안이면 모두 고르는 단추를 둔다(Opus 대체 검수 F2)
  // 모두 고르기는 이미 고른 것과의 합집합이라(restore-select.cjs) 화면이 미리 셀 수 없다 — 찾은 것이 1,000개 이하면 단추를 늘 두고,
  // 합이 넘으면 엔진의 SELECTION_LIMIT를 app.js가 그 까닭으로 알린다(Opus -c FA1)
  const found = cat.total ?? 0;
  const allBtn = cat.token && found > 0 && found <= 1000 ? `<button class="lnk sm" type="button" data-act="old-all">찾은 ${count(found)}개 모두 고르기</button>` : '';
  const tooMany = cat.token && found > 1000 ? '<p class="foot">찾은 파일이 1,000개를 넘어 모두 고를 수는 없습니다. 찾기나 안쪽 폴더로 범위를 줄여 주세요.</p>' : '';
  const l = `${kick(`${h(oldWho(fromName))} 백업${at}`)}${say('무엇을 꺼낼까요?', `${h(where)} 안의 파일입니다.`)}
    ${then('고른 파일은 새 폴더에 꺼냅니다. 옛 PC의 백업은 그대로 두고, 꺼낸 뒤 백업과 같은지 하나하나 확인합니다.')}
    <div class="act rise i3"><button class="lnk sm" type="button" data-act="old-back">다른 폴더 고르기 ${I.rarr}</button></div>
    ${acts([{ id: 'restore-sel', label: sel ? `고른 ${count(sel)}개 꺼내기` : '고른 파일 꺼내기', kind: 'main', disabled: !sel }], `<span class="hint">${h(placeHint)} ${h(notHere)}</span>`)}`;
  let list;
  // 판이 바뀌어 고른 자리가 없으면 처음부터 고르는 단추를 둔다(카본 A5). 목록이 너무 크면 왼쪽의 「다른 폴더 고르기」로 안쪽을 고른다
  if (cat.error) list = `<p class="empty">${h((cat.errorCode && oldFailText(cat.errorCode, fromName, { open: true })) || cat.error)}</p><div class="act">${cat.errorCode === 'INVALID_REQUEST' ? `<button class="lnk sm" type="button" data-act="old-top">처음부터 고르기 ${I.rarr}</button>` : ['CATALOG_TOO_LARGE', 'UNSAFE_MANIFEST'].includes(cat.errorCode) ? '' : `<button class="lnk sm" type="button" data-act="reopen">목록 다시 열기 ${I.rarr}</button>`}</div>`;
  else if (cat.loading) list = '<p class="empty">목록을 여는 중입니다. 폴더가 크면 몇 분 걸립니다.</p>';
  else if (!cat.rows?.length) list = `<p class="empty">${cat.query ? `「${h(cat.query)}」${pp(cat.query, '이/가')} 든 파일이 없습니다.` : '이 폴더에는 꺼낼 파일이 없습니다.'}</p>`;
  else list = cat.rows.map((f) => `<button class="fl" type="button" role="checkbox" aria-checked="${!!f.selected}" data-file="${h(f.id)}"><span class="cb" aria-hidden="true"></span><span class="nm">${h(f.name)}</span><span class="vl">${h(size(f.size))}${f.mtime ? ` · ${h(dayKo(f.mtime).replace(/ [일월화수목금토]$/, ''))}` : ''}</span><span class="ds">${h([req.label, ...String(f.path || '').split('/').filter(Boolean).slice(0, -1)].join(' › '))}</span></button>`).join('');
  const more = cat.total > (cat.offset || 0) + (cat.rows?.length || 0) ? `<div class="act"><button class="lnk sm" type="button" data-act="more">더 보기 · ${count(cat.total - (cat.offset || 0) - cat.rows.length)}개 ${I.rarr}</button></div>` : '';
  const r = panel('찾기', `${total ? `${count(total)}개 가운데 · ` : ''}${h(where)}`,
    `<div class="find">${I.search}<input id="find" type="search" aria-label="파일 이름으로 찾기" placeholder="파일 이름으로 찾기" autocomplete="off" spellcheck="false" maxlength="200" value="${h(cat.query || '')}"${cat.token ? '' : ' disabled'}><em aria-live="polite">${cat.total !== undefined ? `${count(cat.total)}개 찾음` : ''}</em></div>
    <div class="files" role="group" aria-label="찾은 파일">${list}</div>${more}${tooMany}
    <div class="selbar"><span><b class="num">${count(sel)}개</b> 고름${sel ? ` · <span class="num">${h(size(cat.selection.bytes))}</span>` : ''}${sel ? ' <button class="lnk sm" type="button" data-act="clear">고른 것 비우기</button>' : ''}${allBtn ? ` ${allBtn}` : ''}</span>
      <span>놓을 자리 ${place.mode === 'default' ? `<b>다운로드 › ${h(place.name)}</b> <button class="lnk sm" type="button" data-act="place-pick">자리 바꾸기</button>` : `<b>누를 때 고름</b>${place.guarded ? '' : ' <button class="lnk sm" type="button" data-act="place-default">다운로드에 놓기</button>'}`}</span></div>`);
  return { kind: 'flow', tone: 'ok', here: '옛 PC 백업에서 꺼내기', back: 'restore-old', top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { 'restore-sel': { id: 'restore-sel', call: 'restoreSelected' }, more: { id: 'more' }, clear: { id: 'clear' }, home: { id: 'home', to: 'home' } } };
}

/**
 * 옛 PC 백업에서 꺼내기 — 폴더 고르기(조율 세션 793e0d6dc, 설계 4.6). 옮겨 온 결과의 폴더 가운데 하나를 고르고, 큰 폴더는 browseBackupFolder로
 * 바로 아래 폴더를 한 층씩 보여 안쪽 폴더를 고르게 한다. 고른 범위로 목록을 연다(「이 폴더 열기」 → restoreScoped).
 * old = 창이 기억하는 고름 { from, folder, label, sub, level(엔진 값 · 읽는 중 undefined · 실패 null), error, code }
 */
function restoreOld(s, mv, acct, old, now, ui) {
  const fromName = movedFromOf(s, mv, acct), run = acct?.running || null;
  // 옛 PC 판의 거절 글은 옛 기기 이름으로 그릴 때 만든다(카본 A1)
  const errText = old?.code ? oldFailText(old.code, fromName) || old.error : old?.error;
  const base = { kind: 'flow', tone: 'ok', here: '옛 PC 백업에서 꺼내기', back: 'home', top: [{ id: 'home', label: '닫기' }], acts: { home: { id: 'home', to: 'home' }, 'old-whole': { id: 'old-whole', call: 'restoreScope' } } };
  if (!old?.folder) {
    const res = mv?.result;
    if (res === undefined) return { ...base, tone: 'run', html: flow(`${kick(`${h(oldWho(fromName))} 백업`)}${say('폴더 목록을', '읽고 있습니다.')}`, panel('꺼낼 폴더', '', '<p class="empty">읽는 중입니다.</p>')) };
    const list = oldFolders(res);
    const l = `${kick(`${h(oldWho(fromName))} 백업`)}${say('어느 폴더에서', '꺼낼까요?')}
      ${then('옮겨 올 때 고른 폴더 가운데 하나를 고르세요. 큰 폴더는 안쪽 폴더를 골라 그 부분만 엽니다. 꺼낸 파일은 새 폴더에 놓고, 옛 PC의 백업은 그대로 둡니다.')}
      ${acts([{ id: 'home', label: '돌아가기', kind: 'line' }])}`;
    const body = list.length ? `<div class="files mvlist" role="group" aria-label="꺼낼 폴더">${list.map((f) => `<button class="fl plain mv" type="button" data-act="old-folder" data-folder="${h(f.original)}"${run ? ' aria-disabled="true"' : ''}><span class="nm">${h(f.label)}</span><span class="vl">${f.tooBig ? '<span class="x">너무 커서 옮기지 않음</span>' : f.skip ? '옮기지 않음' : '옮겨 옴'}</span><span class="ds">${h(f.original)}</span></button>`).join('')}</div>`
      : `<p class="empty">${res ? '옮겨 온 결과에 폴더가 없습니다.' : '고를 폴더 목록이 없습니다. 옮겨 오기를 마친 뒤에 열 수 있습니다.'}</p>${res ? '' : `<div class="act"><button class="lnk sm" type="button" data-act="old-reload">다시 읽기 ${I.rarr}</button></div>`}`;
    return { ...base, html: flow(l, panel('꺼낼 폴더', list.length ? `${count(list.length)}곳` : '', body)) };
  }
  const where = oldWhere(old.label, old.sub), lv = old.level;
  const at = lv?.snapshotAt ? ` · ${h(whenKo(lv.snapshotAt, now))} 판` : '';
  const noSplit = old.code === 'CATALOG_TOO_LARGE';
  // 통째로 꺼내기(restoreScope, E27)도 한 범위에 100만 개까지다 — 너무 커서 옮기지 않은 폴더(100만 개 넘음)의 맨 위 층은 통째로 꺼낼 수 없고,
  // 목록(20만 개까지)으로도 열리지 않는다. 안쪽 폴더를 고르게 한다
  const tooBigTop = !old.sub && oldFolders(mv?.result).some((f) => f.original === old.folder && f.tooBig);
  // 통째로 꺼내기는 층을 읽은 뒤에, 또는 안쪽 목록만 못 읽은 층(noSplit)에서 된다. 판이 바뀐 자리 · 읽기 실패에는 두지 않는다
  const canWhole = !run && !tooBigTop && (!!lv || noSplit);
  const place = restorePlace(s, ui?.place, now, ui?.sentDefaultAt);
  const placeHint = place.mode === 'default' ? `누르면 다운로드 안의 「${place.name}」 폴더에 바로 놓습니다.`
    : place.unsafe ? '다운로드에는 놓을 수 없어, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : place.guarded ? '다운로드도 지키는 폴더라, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : '누르면 놓을 폴더를 고르는 창이 한 번 뜹니다.';
  const busy = run ? ' aria-disabled="true"' : '';
  const placeLink = place.mode === 'default' ? `<button class="lnk sm" type="button" data-act="place-pick"${busy}>자리 바꾸기</button>` : place.guarded ? '' : `<button class="lnk sm" type="button" data-act="place-default"${busy}>다운로드에 놓기</button>`;
  // 놓을 자리 안내는 통째로 꺼낼 수 있는 층에만 둔다 — 읽는 중 · 읽지 못함 · 100만 개 넘는 맨 위 층에는 두지 않는다(Fable F4)
  const showPlace = !tooBigTop && (!!lv || noSplit);
  const stuck = noSplit && tooBigTop;
  const l = `${kick(`${h(oldWho(fromName))} 백업${at}`)}${say(h(where), stuck ? '이 앱으로는 꺼낼 수 없습니다.' : noSplit ? '안쪽 폴더를 보여 드릴 수 없습니다.' : '어떻게 꺼낼까요?')}
    ${then(stuck ? '바로 안에 파일이 너무 많아 안쪽 폴더 목록을 보여 드릴 수 없고, 파일과 폴더가 100만 개를 넘어 통째로도 꺼낼 수 없습니다. 옛 PC를 아직 쓸 수 있으면, 정리하기 전에 그 폴더를 USB나 외장 디스크로 직접 옮겨 두세요.'
      : noSplit ? h(OLD_NO_SPLIT_THEN) : tooBigTop ? h(['이 폴더는 파일과 폴더가 100만 개를 넘어 통째로도, 목록으로도 꺼낼 수 없습니다.',
      ...(lv?.folders?.length ? ['「안쪽 폴더」 목록에서 안쪽 폴더를 골라 그 폴더를 통째로 꺼내거나, 파일을 골라 꺼내세요.'] : []),
      // 그 층 바로 안의 파일은 어느 길로도 꺼낼 수 없다 — 그때만 직접 옮겨 두라고 쓴다
      ...(lv?.files ? [`바로 안의 파일 ${count(lv.files)}개는 이 앱으로 꺼낼 수 없으니, 옛 PC를 아직 쓸 수 있으면 정리하기 전에 직접 옮겨 두세요.`] : [])].join(' '))
      : lv?.leftOut ? h(['Windows에 둘 수 없는 이름의 폴더가 있어 이 층은 파일을 골라 꺼낼 수 없습니다. 통째로 꺼내면 그런 이름의 폴더와 그 안의 파일은 빼고 나머지를 꺼냅니다.',
      ...(lv.folders?.length ? ['안쪽 폴더만 필요하면 「안쪽 폴더」 목록에서 골라 주세요.'] : [])].join(' '))
      : !lv ? (errText ? '이 층을 읽지 못해 지금은 꺼낼 수 없습니다.' : '안쪽 폴더를 읽고 있습니다. 다 읽으면 꺼낼 수 있습니다.')
      : '「이 폴더 통째로 꺼내기」는 안의 파일과 폴더를 모두 새 폴더에 꺼냅니다. 몇 개만 필요하면 「파일 골라 꺼내기」로 목록을 열어 고르세요. 파일이 아주 많으면 목록은 열리지 않습니다.')}
    ${acts([{ id: 'old-whole', label: '이 폴더 통째로 꺼내기', kind: 'main', disabled: !canWhole }, { id: 'old-open', label: '파일 골라 꺼내기', kind: 'line', disabled: !lv || !!run || noSplit || !!lv?.leftOut || tooBigTop },
      { id: 'old-up', label: old.sub ? '한 칸 위로' : '다른 폴더 고르기', kind: 'link', disabled: !!run }],
      showPlace ? `<span class="hint">${h(placeHint)} 옛 PC가 백업하던 폴더와 그 안, 그 폴더들이 든 위 폴더에는 놓을 수 없습니다. ${placeLink}</span>` : '')}`;
  let body;
  // 나눌 수 없는 층은 왼쪽 글이 까닭과 할 일을 말한다 — 오른쪽에 같은 글을 되풀이하지 않는다
  if (noSplit) body = '<p class="empty">바로 안의 파일이 너무 많아 안쪽 목록을 읽지 못했습니다.</p>';
  else if (errText) body = `<p class="empty">${h(errText)}</p>${noSplit ? '' : `<div class="act"><button class="lnk sm" type="button" data-act="${old.code === 'INVALID_REQUEST' ? 'old-top' : 'old-reload'}">${old.code === 'INVALID_REQUEST' ? '처음부터 고르기' : '다시 읽기'} ${I.rarr}</button></div>`}`;
  else if (!lv) body = '<p class="empty">안쪽 폴더를 읽고 있습니다. 폴더가 크면 몇 분 걸립니다.</p>';
  else {
    const dirs = lv.folders || [];
    const rows = dirs.map((name) => `<button class="fl plain mv" type="button" data-act="old-in" data-name="${h(name)}"${run ? ' aria-disabled="true"' : ''}><span class="nm">${h(name)}</span><span class="vl">안쪽 보기</span></button>`).join('');
    body = `${dirs.length ? `<div class="files mvlist" role="group" aria-label="안쪽 폴더">${rows}</div>` : '<p class="empty">안쪽 폴더가 없습니다.</p>'}
      ${notes([`바로 안의 파일은 <b class="num">${count(lv.files || 0)}</b>개입니다.`,
        ...(lv.cut ? ['안쪽 폴더가 많아 이름 순으로 앞 2,000곳만 보입니다.'] : []),
        ...(lv.leftOut ? [`Windows에 둘 수 없는 이름의 폴더 ${count(lv.leftOut)}곳은 열 수 없어 뺐습니다.`] : [])])}`;
  }
  return { ...base, back: 'restore-old', html: flow(l, panel('안쪽 폴더', lv?.folders ? `${count(lv.folders.length)}곳${lv.cut ? ' 이상' : ''}` : '', body)),
    acts: { ...base.acts, 'old-open': { id: 'old-open' }, 'old-up': { id: 'old-up' } } };
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
    { h: '같은 Google 계정으로 시작', p: h(mail(s) || (fake ? EX.account : '이 PC에서 백업을 시작한 그 계정입니다.')) },
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

/* ── 옮겨 오기 · 실제 상태(조율 세션 d32d25233 · 옮겨 오기 상태 moveState · 결과의 뿌리 folders[].roots) ── */
// 창이 기억하는 것(app.js의 mv): devices · from · preview · first(처음 본 폴더별 수) · choices · open(폴더마다 바꾸기) · dirty(고름을 바꿈) ·
// counting(공간 다시 세는 중) · state(moveState) · result(moveResult) · added · off(넘기기에서 뺀 폴더) · quit(결과 없이 넘김) · error
// 걸음은 다섯이다 — 놓을 자리 · 옮겨 오기 · 확인서 · 프로그램과 설정(4b) · 넘기기
const mvBase = (seg, extra = {}) => ({ kind: 'flow', tone: 'ok', here: '새 PC로 옮겨 오기', seg: [seg, 5], top: [{ id: 'home', label: '닫기' }], back: 'home', ...extra });
const fromNameOf = (s, mv, acct) => moveDeviceName(mv?.from || mv?.state?.from, acct?.devices, s?.account?.sameInstall);
/** 진행 · 확인서 · 넘기기의 옛 기기 — 미리 본 기기(mv.from)가 아니라 실제로 옮긴 기기(moveState.from)다(카본 B1) */
const movedFromOf = (s, mv, acct) => moveDeviceName(mv?.state?.from || mv?.from, acct?.devices, s?.account?.sameInstall);
const mvActs = { home: { id: 'home', to: 'home' }, 'move-in': { id: 'move-in', to: 'move-1' }, 'move-reload': { id: 'move-reload' }, 'move-quit': { id: 'move-quit' } };
/** 엔진 값을 아직 읽지 않은 동안(창 기억의 칸이 undefined) — 없음(null)으로 읽어 「없습니다」나 다른 목록을 잠깐 보이지 않게 한다 */
const mvReading = (s, seg, what, title = '옮겨 오기') => ({ ...mvBase(seg, { tone: 'run' }), acts: mvActs,
  html: flow(`${kick(`${h(s?.device || '이 PC')} · ${title}`)}${say(what, '읽고 있습니다.')}`, panel(seg === 3 ? '옮겨 오기 확인서' : seg === 5 ? '이 PC에서 지킬 폴더' : '옮겨 올 것', '', '<p class="empty">읽는 중입니다.</p>')) });

/** 옮겨 올 PC 고르기(옛 기기가 둘 이상일 때) */
const devPickOf = (s, mv, acct, now, dis) => ((mv?.devices || []).length > 1 ? `<h3>옮겨 올 PC</h3><div class="files" role="group" aria-label="옮겨 올 PC">${mv.devices.map((d) => `<button class="fl" type="button" aria-pressed="${d.from === mv.from}" data-act="move-from" data-from="${h(d.from)}"${dis}><span class="cb" aria-hidden="true"></span><span class="nm">${h(moveDeviceName(d.from, acct?.devices, s?.account?.sameInstall))}</span><span class="vl">마지막 백업 ${h(whenKo(d.lastBackupAt, now))}</span></button>`).join('')}</div>` : '');
/** 어디에 놓을까요 — 옛 기기 · 폴더마다 놓일 자리(접어 두고 「폴더마다 바꾸기」로 편다) · 드라이브 공간 */
function move1Real(s, mv, acct, now) {
  const device = h(s?.device || '이 PC'), run = acct?.running || null, top = kick(`${device} · 같은 Google 계정`);
  const quit = { id: 'move-quit', label: '되살리지 않고 이 PC에서 이어서 백업', kind: 'link' };
  if (mv?.error) {
    // 100만 개 넘는 폴더는 이제 미리 보기를 막지 않는다(E25) — 「지금은 옮겨 올 수 없습니다」 갈래를 걷었다
    const l = `${top}${say('옛 PC의 백업을', '읽지 못했습니다.')}${then(h(mv.error))}${acts([{ id: 'move-reload', label: '다시 읽기', kind: 'main' }, { id: 'home', label: '돌아가기', kind: 'link' }])}`;
    return { ...mvBase(1, { tone: 'warn' }), html: flow(l, panel('놓을 자리', '', '<p class="empty">읽지 못했습니다.</p>')), acts: mvActs };
  }
  if (Array.isArray(mv?.devices) && !mv.devices.length) {
    const l = `${top}${say('이 계정에는 옮겨 올', 'PC 백업이 없습니다.')}${then('옛 PC가 아직 한 번도 백업을 마치지 않았거나, 다른 Google 계정으로 백업했을 수 있습니다.')}
      ${acts([{ id: 'home', label: '돌아가기', kind: 'main' }, { ...quit, label: '이 PC에서 이어서 백업' }])}`;
    return { ...mvBase(1), html: flow(l, panel('놓을 자리', '', '<p class="empty">옮겨 올 백업이 없습니다.</p>')), acts: mvActs };
  }
  const p = mv?.preview;
  if (!p) {
    const l = `${top}${say('옛 PC의 백업을', '찾고 있습니다.')}${then(Array.isArray(mv?.devices) ? '폴더마다 옮겨 올 목록을 읽고 놓을 자리와 공간을 셉니다. 폴더가 크면 몇 분 걸립니다.' : '이 계정에 백업이 있는 PC를 찾습니다.')}`;
    return { ...mvBase(1, { tone: 'run' }), html: flow(l, panel('놓을 자리', '', '<p class="empty">찾는 중입니다.</p>')), acts: mvActs };
  }
  const fromName = fromNameOf(s, mv, acct), dev = (mv.devices || []).find((d) => d.from === mv.from);
  const rows = moveRows(p, mv.choices, mv.first), vol = moveVolumes(p), kit = moveKitNote(p);
  // 멈춘 옮겨 오기를 이을 때는 그때 고른 자리를 그대로 쓴다 — 엔진도 놓기 시작한 것은 처음 고른 자리로 잇는다(Fable F6 · E9).
  // 파일을 놓기 전에 공간이나 목록 때문에 멈췄으면 자리를 다시 고르게 한다(E9 GA1)
  const rechoose = !!(mv.state?.from === mv.from && moveRechoose(s, mv.state));
  const resuming = !!(mv.state?.unfinished && mv.state.from === mv.from) && !rechoose;
  const busy = !!mv.counting || !!run, blocked = vol.short.length > 0 && !mv.dirty;
  // 미리 보기는 이번에 받을 것만 센다(E8 · E11) — 받을 것이 0이고 고름을 바꾸지 않았으면 시작해도 할 일이 없다(Fable F3)
  // 멈춘 옮겨 오기를 이을 때는 남은 것이 0이어도 누르면 확인서를 마저 쓴다 — 막지 않는다(Fable FA3)
  const nothing = !!rows.places && !rows.files && !mv.dirty && !resuming, hadResult = !!(mv.state?.resultAt && mv.state.from === mv.from);
  const hint = mv.counting ? '고른 자리로 공간을 다시 세고 있습니다. 폴더가 크면 몇 분 걸립니다.'
    : !rows.places ? (rows.rows.length && rows.big.length === rows.rows.length ? '모든 폴더가 너무 커서 옮겨 올 폴더가 없습니다.' : '옮겨 올 폴더가 하나도 없습니다. 「놓을 자리」 목록에서 한 폴더 이상 「옮기지 않음」을 풀어 주세요.')
      : nothing ? (hadResult ? '받을 파일이 없어 시작하지 않습니다. 확인서에서 앞서 옮겨 온 결과를 볼 수 있습니다.' : '받을 파일이 없어 시작하지 않습니다.')
      : blocked ? `${vol.short.map((v) => `${v.drive} 드라이브`).join(', ')}의 빈 공간이 모자랍니다. ${resuming ? '공간을 비운 뒤' : '공간을 비우거나 다른 자리를 고른 뒤'} 「공간 다시 세기」를 누르세요.`
        : mv.dirty ? '누르면 고른 자리로 공간을 한 번 더 센 뒤 시작합니다.' : '누르면 바로 시작합니다. 끝날 때까지 파일 되살리기와 다른 일은 기다립니다.';
  const last = dev?.lastBackupAt ? `마지막 백업은 ${h(whenKo(dev.lastBackupAt, now))}이고, ` : '';
  const l = `${top}${say('어디에 놓을까요?')}
    ${then(`「${h(fromName)}」의 백업을 찾았습니다. ${last}${rows.files || !rows.places ? `옮겨 올 것은 <span class="num">${count(rows.files)}개 · ${h(size(rows.bytes))}</span>입니다.` : mv.dirty ? '바꾼 자리로는 아직 세지 않았습니다.' : resuming ? '남은 파일이 없습니다. 누르면 확인서를 마저 씁니다.' : `받을 파일이 없습니다.${hadResult ? ' 앞서 옮겨 온 파일은 다시 받지 않습니다.' : ''}`}`)}
    ${notes([...(kit ? [h(kit)] : []), ...(resuming ? ['앞서 멈춘 옮겨 오기를 잇습니다. 그때 고른 자리를 그대로 씁니다.'] : []),
      ...(rechoose ? [`${h(moveStopText(s, mv.state))} 파일을 놓기 전에 멈춰 자리를 다시 고를 수 있습니다.`] : []),
      '이미 있는 파일은 덮어쓰지 않습니다. 내용이 다르면 「(복구본)」을 붙여 나란히 둡니다.', '창을 닫아도 계속되고, 끊겨도 다시 시작하면 멈춘 곳부터 잇습니다.'])}
    ${rows.big.length ? `<div class="box rise i3"><b>${h(josa(folderSubjectKo(rows.big), '은/는'))} 옮겨 오지 못합니다.</b>${rows.big.length === rows.rows.length ? '파일과 폴더가 100만 개를 넘는 폴더라 옮기지 않습니다. 옮겨 올 수 있는 폴더가 없습니다.' : '파일과 폴더가 100만 개를 넘는 폴더라 옮기지 않고, 나머지 폴더만 옮겨 옵니다.'} 옛 PC의 백업에는 그대로 있고, 옮겨 온 뒤 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다. 옛 PC를 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요.</div>` : ''}
    ${p.suggestKeepAsIs ? '<div class="box rise i3"><b>이 PC에 같은 파일이 이미 많습니다.</b>같은 PC를 다시 깐 것이라면 되살리지 않고 이 PC에서 이어서 백업하는 편이 빠릅니다.</div>' : ''}
    ${acts([nothing && hadResult ? { id: 'move-result', label: '확인서 보기', kind: 'main' } : { id: 'move-go', label: '이 자리로 옮겨 오기', kind: 'main', disabled: !rows.places || blocked || busy || nothing }, ...(p.suggestKeepAsIs ? [quit] : [])], `<span class="hint">${h(hint)}</span>`)}`;
  const dis = busy ? ' aria-disabled="true"' : '';
  const devPick = devPickOf(s, mv, acct, now, dis);
  const folderRow = (r) => {
    const where = r.tooBig ? '너무 커서 옮기지 않음' : r.place.kind === 'skip' ? '옮기지 않음' : `${placeKo(r.place)}${r.place.path ? ` · ${r.place.path}` : ''}`;
    const opts = mv.open && !resuming && r.modes.length > 1 ? `<span class="mvopt" role="group" aria-label="${h(`「${r.label}」 놓을 자리`)}">${r.modes.map((m) => `<button type="button" aria-pressed="${m.id === r.mode}" data-act="move-mode" data-folder="${h(r.original)}" data-mode="${h(m.id)}"${dis}>${h(m.label)}</button>`).join('')}</span>` : '';
    return `<div class="fl plain mv"><span class="nm">${h(r.label)}</span><span class="vl">${r.place.kind === 'skip' ? '' : `${count(r.files)}개 · ${h(size(r.bytes))}`}</span><span class="ds">${h(where)}</span>${r.why ? `<span class="why">${h(r.why)}</span>` : ''}${opts}</div>`;
  };
  const vols = vol.rows.length ? `<div class="rows">${vol.rows.map((v) => row(`${h(v.drive)} 드라이브`, v.enough === false ? `<span class="x">${h(size(v.bytes))} 필요</span>` : `${h(size(v.bytes))} 필요`, v.free === null ? '남은 공간을 읽지 못함' : `남은 공간 ${h(size(v.free))}`)).join('')}</div>` : '<p class="foot">놓을 파일이 없습니다.</p>';
  const r = panel('놓을 자리', `${placesKo(rows.places)} · ${h(size(rows.bytes))}`, `${devPick}<div class="files mvlist" role="group" aria-label="옮겨 올 폴더">${rows.rows.map(folderRow).join('')}</div>
    ${resuming ? '<p class="foot">이어 하는 동안에는 폴더마다 자리를 바꾸지 않습니다.</p>' : `<div class="act"><button class="lnk sm" type="button" data-act="move-open" aria-expanded="${!!mv.open}">${mv.open ? '접기' : '폴더마다 바꾸기'} ${I.rarr}</button></div>`}
    <h3>드라이브 공간${mv.counting ? ' · 다시 세는 중' : mv.dirty ? ' · 바꾼 자리는 아직 세지 않음' : ''}</h3>${vols}
    ${mv.counting ? '' : `<div class="act"><button class="lnk sm" type="button" data-act="move-count"${dis}>공간 다시 세기 ${I.rarr}</button></div>`}`);
  return { ...mvBase(1), html: flow(l, r), acts: { ...mvActs, 'move-go': { id: 'move-go', flow: 'moveGo' }, 'move-result': { id: 'move-result', to: 'move-3' } } };
}

/** 옮겨 오고 있습니다 — 엔진 작업(move)의 퍼센트와 진행(E7 move.progress)의 받은 양 · 지금 폴더 · 속도. 남은 시간은 속도가 있을 때만 어림한다 */
function move2Real(s, mv, acct, now) {
  const device = h(s?.device || '이 PC'), job = moveJob(s), st = mv?.state || null, run = acct?.running || null, fromName = movedFromOf(s, mv, acct);
  if (!job && mv?.state === undefined) return mvReading(s, 2, '옮겨 오기 상태를');
  const plan = mv?.preview && (!st?.from || mv.from === st.from) ? moveRows(mv.preview, mv.choices, mv.first) : null;
  const r = panel('옮겨 올 것', `「${h(fromName)}」에서`, plan ? `<div class="rows">${plan.rows.filter((x) => x.place.kind !== 'skip').map((x) => row(h(x.label), x.files ? `${count(x.files)}개` : '받을 것 없음', x.files ? h(size(x.bytes)) : '')).join('')}</div><p class="foot">폴더마다 무엇을 어디에 놓았는지는 끝난 뒤 확인서에 적습니다.</p>`
    : '<p class="empty">폴더마다 무엇을 어디에 놓았는지는 끝난 뒤 확인서에 적습니다.</p>');
  if (job) {
    const p = job.percent === null || job.percent === undefined || !Number.isFinite(Number(job.percent)) ? null : Math.max(0, Math.min(100, Math.round(Number(job.percent))));
    // 받은 양은 이번에 받을 양 기준이다 — 이어받기에서는 전체가 남은 양이다(E7)
    const g = moveProgress(s), amount = g?.total ? `<span class="num">${h(size(g.bytes || 0))} / ${h(size(g.total))}</span>` : plan ? `모두 <span class="num">${h(size(plan.bytes))}</span>` : '';
    const at = g?.folder ? (plan?.rows.find((x) => x.original.toLowerCase() === g.folder.toLowerCase())?.label || folderName(g.folder)) : '';
    const eta = g?.rate ? `${g.leftSec !== null ? `남은 시간 ${etaKo(g.leftSec)} · ` : ''}초당 ${h(size(g.rate))}` : '';
    const l = `${kick(`${device} · 옮겨 오는 중`)}${say('옮겨 오고 있습니다.')}
      ${then(p === null ? '옮겨 올 목록을 폴더마다 읽고 있습니다. 폴더가 크면 몇 분 걸립니다.' : `<b class="num">${p}%</b>${amount ? ` · ${amount}` : ''}${eta ? ` · ${eta}` : ''}`)}
      ${p === null ? '' : `<div class="bar rise i3" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="옮겨 오기"><i data-pct="${p}"></i></div>`}
      ${at && p !== null ? `<p class="then rise i3">지금 받는 폴더 · ${h(at)}</p>` : ''}
      ${notes(['받은 파일은 디스크에 쓴 뒤 다시 읽어 백업과 같은지 확인하고 자리에 놓습니다.', '창을 닫아도 계속됩니다. 끊겨도 다시 시작하면 멈춘 곳부터 잇습니다.', '끝날 때까지 파일 되살리기와 다른 일은 기다립니다.'])}`;
    return { ...mvBase(2, { tone: 'run' }), html: flow(l, r), acts: mvActs };
  }
  if (st?.unfinished) {
    // 파일을 놓기 전에 공간이나 목록 때문에 멈췄으면 같은 자리로 다시 눌러도 또 멈춘다 — 자리를 다시 고르게 한다(E9 GA1)
    // 100만 개 넘는 폴더로 멈춘 앞선 판의 옮겨 오기도 이제는 그 폴더만 빼고 잇는다(E25) — 「파일 되살리기」로 보내지 않는다
    const again = moveRechoose(s, st);
    const l = `${kick(`${device} · 옮겨 오기 멈춤`)}${say('옮겨 오기가', '중간에 멈췄습니다.')}${then(h(moveStopText(s, st)))}
      ${acts([again ? { id: 'move-in', label: '자리 다시 고르기', kind: 'main', disabled: !!run } : { id: 'move-resume', label: '이어서 옮겨 오기', kind: 'main', disabled: !!run },
        ...(st.resultAt ? [{ id: 'move-result', label: '앞서 옮겨 온 결과 보기', kind: 'line' }] : []), { id: 'home', label: '돌아가기', kind: 'link' }])}`;
    return { ...mvBase(2, { tone: 'warn' }), html: flow(l, r), acts: { ...mvActs, 'move-resume': { id: 'move-resume', flow: 'moveResume' }, 'move-result': { id: 'move-result', to: 'move-3' } } };
  }
  if (st?.resultAt) {
    const l = `${kick(`${device} · 옮겨 오기 끝`)}${say('옮겨 오기를', '마쳤습니다.')}${then('무엇을 어디에 놓았는지 확인서에 적었습니다.')}${acts([{ id: 'move-result', label: '확인서 보기', kind: 'main' }])}`;
    return { ...mvBase(2), html: flow(l, r), acts: { ...mvActs, 'move-result': { id: 'move-result', to: 'move-3' } } };
  }
  const l = `${kick(`${device} · 옮겨 오기`)}${say('옮겨 오는 중인 일이', '없습니다.')}${acts([{ id: 'move-in', label: '이 PC로 옮겨 오기', kind: 'main' }, { id: 'home', label: '돌아가기', kind: 'link' }])}`;
  return { ...mvBase(2), html: flow(l, r), acts: mvActs };
}

/** 옮겨 오기 확인서 — 큰 글은 결과에 따라 가르고(Fable F10), 끝나지 않은 것은 까닭별로 묶는다(F8 · F9) */
function move3Real(s, mv, acct, now) {
  const device = h(s?.device || '이 PC'), res = mv?.result, run = acct?.running || null;
  if (res === undefined) return mvReading(s, 3, '확인서를');
  if (!res) {
    const l = `${kick(`${device} · 옮겨 오기`)}${say('옮겨 온 결과가', '아직 없습니다.')}${then('옮겨 오기를 마치면 이 자리에 확인서가 생깁니다.')}${acts([{ id: 'move-in', label: '이 PC로 옮겨 오기', kind: 'main' }, { id: 'home', label: '돌아가기', kind: 'link' }])}`;
    return { ...mvBase(3), html: flow(l, panel('옮겨 오기 확인서', '', '<p class="empty">아직 없습니다.</p>')), acts: mvActs };
  }
  const t = moveTitle(res), c = res.counts || {}, groups = moveGroups(res), fromName = movedFromOf(s, mv, acct);
  // 「다시 옮겨 오기」는 실패만이 아니라 옮겨 오지 못한 것(주의 묶음)이 있으면 둔다(Fable 화면 검수 F2)
  const copy = Number(c.copy) || 0, side = Number(c.side) || 0, fail = moveLeft(res).n;
  // 끝난 옮겨 오기를 다시 시작해도 앞선 결과는 새 결과가 적힐 때까지 남는다(E13) — 다시 시작한 것이 멈췄으면 이 확인서는 그 앞의 것이다
  const older = !!(mv?.state?.unfinished && !moveJob(s));
  // 프로그램을 까는 동안에는 옮겨 오기를 다시 시작하지 않는다 — 엔진이 거절하는데 그 전에 몇 분짜리 공간 세기를 돈다(Fable 4b 덧붙임)
  const installing = !!s?.move?.reinstall?.running;
  const l = `${kick(`${device} · 옮겨 오기 끝`)}${say(h(t.main), h(t.soft))}${then(h(t.then))}
    ${older ? `<div class="box rise i3"><b>앞서 마친 옮겨 오기의 확인서입니다.</b>그 뒤 다시 시작한 옮겨 오기는 중간에 멈춰 있습니다. ${h(moveStopText(s, mv.state))}</div>` : ''}
    ${notes([...(copy ? [`「(복구본)」 <b class="num">${count(copy)}</b>개는 이 PC에 같은 이름의 다른 파일이 있어 나란히 두었습니다.`] : []),
      ...(side ? [`<b class="num">${count(side)}</b>개는 저절로 실행되는 자리나 프로그램이 쓰는 자리의 파일이라 「따로 둔 것」에 놓았습니다. 옛 PC에 나쁜 프로그램이 있었더라도 이 PC에서 저절로 실행되지 않게 하려는 것입니다.`] : []),
      ...(fail && !older ? ['다시 옮겨 오면 앞서 놓고 그대로인 파일은 다시 받지 않습니다. 못 옮긴 파일, 「(복구본)」으로 둔 파일, 견주지 못한 파일, 그 뒤 바뀐 파일은 다시 받습니다.'] : []), '옛 PC 백업은 지우지 않고 그대로 둡니다.'])}
    ${acts([{ id: 'move-next', label: '다음 · 프로그램과 설정', kind: 'main', disabled: !!run },
      // 다시 시작했다가 멈춘 옮겨 오기는 엔진이 멈춘 곳부터 잇는다 — 「다시」(처음부터)가 아니라 「이어서」다(카본 C6)
      ...(older ? [{ id: 'move-resume', label: '이어서 옮겨 오기', kind: 'line', disabled: !!run || installing }] : fail ? [{ id: 'move-again', label: '다시 옮겨 오기', kind: 'line', disabled: !!run || installing }] : []),
      ...(moveBigFolders(res).length ? [{ id: 'old-start', label: '옛 PC 백업에서 꺼내기', kind: 'link', disabled: !!run }] : [])],
      `<span class="hint">${mv.counting ? '다시 옮겨 오기 전에 빈 공간을 세고 있습니다. 폴더가 크면 몇 분 걸립니다.' : installing && (fail || older) ? '프로그램을 깔고 있어, 다 깐 뒤에 다시 옮겨 올 수 있습니다.' : '다음 화면에서 옛 PC의 프로그램을 다시 깔고 설정을 되돌립니다. 아직 이 PC는 백업하지 않습니다.'}</span>`)}`;
  // 「그 가운데 내용은 견주지 못함」(unverified)은 OneDrive에 이미 있음의 일부라 합계에 더하지 않는다(E5)
  const total = Object.entries(c).filter(([k]) => k !== 'folder-skip' && !COUNT_PART.has(k)).reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const counts = moveCounts(res).map((x) => row(h(x.label), x.key === 'fail' ? `<span class="x">${count(x.n)}개</span>` : `${count(x.n)}${x.key === 'folder-skip' ? '곳' : '개'}`, '', COUNT_PART.has(x.key) ? 'sub' : '')).join('');
  // 옮겨 온 자리 열기(E6 moveOpen — 결과가 적은 자리만 연다). 지금 디스크에 없는 자리(E15 exists false)는 열 단추를 두지 않는다
  const places = [...moveRoots(res).list, ...(res.side && side ? [{ path: res.side, label: '따로 둔 것', where: '따로 둔 자리', missing: false }] : [])];
  const dis = run ? ' aria-disabled="true"' : '';
  const open = places.length ? `<h3>옮겨 온 자리</h3><div class="files mvlist" role="group" aria-label="옮겨 온 자리">${places.map((x) => `<div class="fl plain mv"><span class="nm">${h(x.label)}</span><span class="vl">${x.missing ? '지금 없음' : h(x.where)}</span><span class="ds">${h(x.path)}</span>${x.missing ? '<span class="why">놓인 파일이 없어 폴더가 만들어지지 않았거나, 그 뒤 옮기거나 지웠습니다.</span>' : `<span class="mvopt"><button type="button" data-act="move-folder" data-path="${h(x.path)}" aria-label="${h(`「${x.label}」 폴더 열기`)}"${dis}>폴더 열기</button></span>`}</div>`).join('')}</div>` : '';
  const moreAll = groups.cut ? ' 이상' : '';
  const grp = groups.list.length ? `<h3>옮기지 않은 것 · 까닭별</h3><div class="files mvlist" role="group" aria-label="옮기지 않은 것">${groups.list.map((g) => { const u = g.key === 'toobig' ? '곳' : '개', more = g.exact ? '' : moreAll; return `<div class="fl plain mv"><span class="nm">${h(g.label)}</span><span class="vl">${g.tone === 'warn' ? `<span class="x">${count(g.n)}${u}${more}</span>` : `${count(g.n)}${u}${more}`}</span><span class="why">${h(g.text)}</span>${g.examples.map((p) => `<span class="ds">${h(p)}</span>`).join('')}</div>`; }).join('')}</div>${groups.cut && groups.list.some((g) => !g.exact) ? '<p class="foot">목록이 길어 앞의 2,000개만 남겼습니다. 파일 수는 그 안에서 센 것입니다.</p>' : ''}` : '';
  const r = panel('옮겨 오기 확인서', `「${h(fromName)}」 → ${device}`, `<div class="rows">${counts}${row('합계', `${count(total)}개`)}</div>${grp}${open}`);
  return { ...mvBase(3, { tone: t.tone }), html: flow(l, r), acts: { ...mvActs, 'move-next': { id: 'move-next', to: 'move-apps' }, 'move-again': { id: 'move-again', flow: 'moveAgain' }, 'move-resume': { id: 'move-resume', flow: 'moveResume' } } };
}

/** 마지막 걸음 — 지킬 폴더는 옮겨 온 결과의 실제 자리로 채우고(설계 검토 권고 1), 옛 PC의 새 판이 있으면 한 번 더 옮겨 오기를 먼저 권한다(F15) */
function move4Real(s, mv, acct, now) {
  const device = h(s?.device || '이 PC'), st = mv?.state || null, run = acct?.running || null;
  // 옮겨 온 결과를 읽기 전에는 지킬 폴더를 채우지 않는다 — 고른 폴더로 잠깐 그린 목록을 넘기지 않게(결과 없이 넘기기는 quit)
  if (mv?.result === undefined && !mv?.quit) return mvReading(s, 5, '옮겨 온 자리를', '마지막 걸음');
  const take = moveTakeList(s, mv), res = take.result, n = take.checked.length;
  const fromName = st?.from || mv?.from ? movedFromOf(s, mv, acct) : '', old = writerName(s, acct?.devices) || fromName || '옛 PC';
  const fresh = res ? moveFresh(mv?.devices, st, res) : null;
  const needStep = !!s?.account?.googleStepRequired, ack = !!acct?.googleAck;
  // 내용이 없는 연결 같은 건너뜀은 빼고, 옮기지 못했거나 견주지 못한 것만 센다(엔진이 남긴 앞 2,000개 안에서)
  const g = res ? moveLeft(res) : null;
  // 깔고 있어도 넘긴다 — 엔진이 첫 백업 중에도 깔기 · 설정 되돌리기 · 체크를 받는다(E19, 앞서는 Fable 4b D1로 막았다)
  const installing = !!s?.move?.reinstall?.running, left = checksLeft(mv?.apps?.checks);
  const hint = mv?.counting ? '한 번 더 옮겨 오기 전에 빈 공간을 세고 있습니다. 폴더가 크면 몇 분 걸립니다.'
    : !n ? '지킬 폴더를 하나 이상 고르세요.' : n > 30 ? '지킬 폴더는 30곳까지입니다. 몇 곳을 빼 주세요.'
    : needStep && !ack ? 'Google에서 잃어버린 기기를 지운 뒤 「Google에서 지웠습니다」를 눌러 주세요.' : installing ? '누르면 Google 로그인을 한 번 더 합니다. 넘겨도 프로그램은 뒤에서 계속 깝니다.' : '누르면 Google 로그인을 한 번 더 합니다.';
  const l = `${kick(`${device} · 마지막 걸음`)}${say(`「${h(old)}」 연결을`, '끊고 이어서 백업합니다.')}
    ${then(`끊으면 이 PC가 같은 백업에 이어서 매시간 올립니다. 백업하는 기기는 한 번에 하나라, 「${h(old)}」${pp(old, '은/는')} 그때부터 백업하지 않습니다. 지금까지의 판은 그대로 둡니다.`)}
    ${fresh ? `<div class="box rise i3"><b>옮겨 온 뒤 「${h(fromName)}」${pp(fromName, '이/가')} 다시 백업했습니다.</b>그 사이 바뀐 파일은 이 PC에 없습니다. 한 번 더 옮겨 오면 바뀐 파일을 받고, 이미 있는 파일과 내용이 다르면 「(복구본)」으로 나란히 둡니다.</div><div class="act rise i3"><button class="lnk sm" type="button" data-act="move-again"${run || installing ? ' aria-disabled="true"' : ''}>한 번 더 옮겨 오기 ${I.rarr}</button></div>` : ''}
    ${stepBoxOf(needStep, ack)}
    ${notes([...(g?.failed ? [`옮겨 오지 못한 파일(${count(g.failed)}개${g.cut ? ' 이상' : ''})은 「${h(fromName)}」의 백업에 그대로 있습니다.`] : []),
      ...(g?.unverified ? [`내용을 견주지 못한 파일(${count(g.unverified)}개${g.cut ? ' 이상' : ''})은 이 PC에 있던 것을 그대로 두었고, 백업의 것은 「${h(fromName)}」의 백업에 그대로 있습니다.`] : []),
      ...(g?.big ? [`${h(josa(folderSubjectKo(moveBigFolders(res)), '은/는'))} 너무 커서 옮기지 않았습니다. ${h(tooBigKept(fromName))} 넘긴 뒤에도 「파일 되살리기」 화면의 「옛 PC 백업에서 꺼내기」 단추로 다시 들어올 수 있습니다.`] : []),
      ...(!res && st?.unfinished ? ['옮겨 오기를 마치지 않았습니다. 옮겨 오지 않은 파일은 옛 PC 백업에 그대로 있습니다.'] : []),
      ...(res ? ['넘긴 뒤에도 「설정」의 「프로그램과 설정」에서 프로그램을 깔고 다시 로그인할 곳을 볼 수 있습니다.'] : [])])}
    ${g?.big ? `<div class="act rise i3"><button class="lnk sm" type="button" data-act="old-start"${run ? ' aria-disabled="true"' : ''}>옛 PC 백업에서 꺼내기 ${I.rarr}</button></div>` : ''}
    ${res ? `<div class="act rise i3"><button class="lnk sm" type="button" data-act="move-apps-open"${run ? ' aria-disabled="true"' : ''}>프로그램과 설정${installing ? ' · 까는 중' : left ? ` · 다시 로그인할 곳 ${count(left)}곳 남음` : ''} ${I.rarr}</button></div>` : ''}
    ${acts([{ id: 'move-take', label: '끊고 이 PC로 이어서 백업', kind: 'main', icon: 'google', disabled: !n || n > 30 || (needStep && !ack) || !!run },
      res ? { id: 'move-release', label: '끊지 않고 이 PC는 백업하지 않기', kind: 'link', disabled: !!run } : { id: 'home', label: '돌아가기', kind: 'link' }], `<span class="hint">${h(hint)}</span>${gcancel(acct)}`)}`;
  const dis = run ? ' aria-disabled="true"' : '';
  // 지금 이 PC에 없는 자리(E15)는 체크하지 못하게 둔다 — 넘기기가 없는 폴더를 통째로 거절한다
  const list = take.list.map((x) => `<button class="fl" type="button" role="checkbox" aria-checked="${!take.isOff(x.path)}" data-act="move-root" data-root="${h(x.path)}"${run || x.missing ? ' aria-disabled="true"' : ''}><span class="cb" aria-hidden="true"></span><span class="nm">${h(x.label)}</span><span class="vl">${x.missing ? '지금 없음' : h(x.where)}</span><span class="ds">${h(x.path)}</span>${x.missing ? '<span class="why">이 PC에 없는 폴더라 넣지 않았습니다. 놓인 파일이 없었거나 그 뒤 옮겼을 수 있습니다.</span>' : ''}</button>`).join('');
  const gone = take.list.filter((x) => x.missing).length;
  const r = panel('이 PC에서 지킬 폴더', n ? `${count(n)}곳` : '', `<div class="files" role="group" aria-label="지킬 폴더">${list || '<p class="empty">아직 고른 폴더가 없습니다.</p>'}</div>
    <div class="act"><button class="lnk sm" type="button" data-act="move-add"${dis}>폴더 더하기 ${I.rarr}</button></div>
    <p class="foot">${res ? '옮겨 온 자리를 골라 두었습니다. 「따로 둔 것」은 넣지 않았습니다.' : '고른 폴더를 이 PC에서 매시간 올립니다. 이 PC의 파일은 옛 백업으로 되살리지 않습니다.'}${gone ? ` 이 PC에 없는 ${count(gone)}곳은 뺐습니다.` : ''}${take.cut ? ' 한 폴더의 파일이 여러 자리로 흩어져 목록에 없는 자리가 있습니다. 필요하면 「폴더 더하기」로 고르세요.' : ''}</p>`);
  return { ...mvBase(5, { back: res ? 'move-apps' : 'home' }), html: flow(l, r),
    acts: { ...mvActs, 'move-take': { id: 'move-take', flow: 'moveTake', account: true, google: true, wait: 180000 }, 'move-release': { id: 'move-release', flow: 'moveRelease' }, 'move-again': { id: 'move-again', flow: 'moveAgain' }, 'google-ack': { id: 'google-ack' },
      'move-apps-open': { id: 'move-apps-open', to: 'move-apps' } } };
}

/* ── 옮겨 오기 4b · 프로그램과 설정(엔진 reinstallList · reinstall · restoreSettings · checklist, Fable 5.2 설계 검토 D1~D18) ── */
// 창이 기억하는 것(mv.apps): list(reinstallList, 못 읽으면 null) · listError · picks(고른 것) · open(펼친 묶음) · checks(checklist) ·
// settings(restoreSettings, 못 하면 settingsError) · restoring · names(깐 프로그램의 이름 — 표 밖은 결과에 이름이 없다, D8)
const MANUAL_MAX = 60;
/** 다시 로그인할 곳 — 깔기와 상관없이 어느 상태에서도 보인다(Fable D10) */
function checksHtml(checks, run) {
  if (checks === undefined) return '<h3>다시 로그인할 곳</h3><p class="foot">읽는 중입니다.</p>';
  if (!Array.isArray(checks)) return `<h3>다시 로그인할 곳</h3><p class="foot">목록을 읽지 못했습니다.</p><div class="act"><button class="lnk sm" type="button" data-act="app-checks-reload"${run ? ' aria-disabled="true"' : ''}>다시 읽기 ${I.rarr}</button></div>`;
  // 빈 목록이면 「모두 했습니다」가 아니라 없다고 쓴다(카본 B6 — 엔진은 늘 보이는 셋을 주지만 꼴이 틀린 답을 대비한다)
  if (!checks.length) return '<h3>다시 로그인할 곳</h3><p class="foot">다시 로그인할 곳을 찾지 못했습니다. 쓰시던 브라우저와 프로그램에 하나씩 로그인해 주세요.</p>';
  const left = checksLeft(checks), dis = run ? ' aria-disabled="true"' : '';
  return `<h3>다시 로그인할 곳 · ${left ? `남은 ${count(left)}곳` : '모두 했습니다'}</h3><div class="files" role="group" aria-label="다시 로그인할 곳">${checks.map((c) => `<button class="fl mv" type="button" role="checkbox" aria-checked="${!!c.done}" data-act="app-check" data-check="${h(c.id)}"${dis}><span class="cb" aria-hidden="true"></span><span class="nm">${h(c.text)}</span></button>`).join('')}</div>
    <p class="foot">로그인 정보와 비밀번호는 옮기지 않습니다. 하나씩 로그인한 뒤 체크해 두면 이 PC에 남습니다.</p>`;
}
/**
 * 프로그램 한 줄 — 고르는 단추는 이름 칸만이고, 주소와 명령은 골라 복사할 수 있는 글이다. 표의 프로그램은 공식 · 사용권 페이지를
 * 연다(E16 moveOpenProgramPage — 주소는 엔진이 앱에 든 표에서 꺼낸다). 표 밖 프로그램의 주소는 winget이 준 값이라 열지 않는다
 */
function appRowHtml(p, { pick, cmds, last, run }) {
  const why = last ? `<span class="why">지난번 깔기 · ${h(last.text)}${last.why ? `. ${h(last.why)}` : ''}</span>` : '';
  const name = h(p.name || p.id);
  const head = pick && !p.installed
    ? `<button class="pickb" type="button" role="checkbox" aria-checked="${!!p.on}" data-act="app-pick" data-app="${h(p.id)}"${run ? ' aria-disabled="true"' : ''}><span class="cb" aria-hidden="true"></span><span class="nm">${name}</span></button>`
    : `<span class="nm">${name}</span>`;
  const vl = p.installed ? '이미 깔려 있음' : p.scope === 'outside' ? h(p.publisher || '') : h(p.scopeKo);
  const lic = p.scope === 'outside' ? (p.license ? `사용권 · ${h(p.license)}` : `사용권 주소를 읽지 못했습니다 · winget show --id ${h(p.id)} -e`) : p.license ? `사용권 · ${h(p.license)}` : '';
  const page = (kind, label) => `<button type="button" data-act="app-page" data-app="${h(p.id)}" data-kind="${kind}" aria-label="${h(`${p.name || p.id} ${label}`)}">${label}</button>`;
  const pages = cmds && p.scope !== 'outside' && (p.site || p.license) ? `<span class="mvopt">${p.site ? page('site', '공식 페이지 열기') : ''}${p.license ? page('license', '사용권 열기') : ''}</span>` : '';
  const more = cmds ? `${p.site ? `<span class="ds url">공식 · ${h(p.site)}</span>` : ''}${lic ? `<span class="ds url">${lic}</span>` : ''}<span class="ds cmd">${h(p.command || `winget install --id ${p.id} -e`)}</span>${pages}` : '';
  return `<div class="fl plain mv app">${head}<span class="vl">${vl}</span>${more}${why}</div>`;
}
function moveAppsReal(s, mv, acct, now) {
  const device = h(s?.device || '이 PC'), apps = mv?.apps || {}, st = mv?.state || null, run = acct?.running || null;
  // 지난 깔기와 되돌린 설정 — 이 창이 지켜본 것이 먼저고, 앱을 다시 켰으면 엔진이 적은 마지막 결과다(E17)
  const job = appsJob(s, st), phase = appsPhase(s, apps, st), set0 = appsSettings(apps, st, job);
  const view = appsRows(apps.list, apps.picks), names = { ...view.names, ...(apps.names || {}) }, out = appsOutcome(job, names);
  const lastOf = new Map((out?.rows || []).map((r) => [r.id, r]));
  // 넘긴 뒤(E19)에는 옮겨 오기 단계 없이 열고, 끝 단추는 기본 화면으로 간다
  const handed = movedHere(s, st), next = handed ? 'home' : 'move-4';
  // 옛 PC의 앱이 다른 판이면 엔진이 앱 설정을 쓰지 않는다(E21 kitProblems rules-old) — 고르기 · 깔는 중 · 결과가 같은 말을 한다(카본 A1)
  const problems = Array.isArray(apps.list?.kitProblems) ? apps.list.kitProblems : [], rulesOld = problems.includes('rules-old');
  const acts0 = { ...mvActs, 'apps-go': { id: 'apps-go', flow: 'appsGo' }, 'apps-later': { id: 'apps-later', to: next }, 'apps-next': { id: 'apps-next', to: next },
    'apps-reload': { id: 'apps-reload', flow: 'appsReload' }, 'apps-restore': { id: 'apps-restore', flow: 'appsRestore' } };
  const base = handed ? { kind: 'flow', tone: 'ok', here: '프로그램과 설정', seg: null, top: [{ id: 'home', label: '닫기' }], back: 'home' } : mvBase(4, { back: 'move-3' }), checks = checksHtml(apps.checks, run);
  // 넘긴 뒤에도 이 화면을 연다(E19) — 「나중에」라 해도 된다
  const later = handed ? { id: 'apps-later', label: '기본 화면으로', kind: 'link' } : { id: 'apps-later', label: '나중에 하고 백업 켜기', kind: 'link', disabled: !!run };
  const reopen = handed ? [] : ['넘긴 뒤에도 「설정」의 「프로그램과 설정」에서 다시 열 수 있습니다.'];
  const top = (t = '프로그램과 설정') => kick(`${device} · ${t}`);
  const toggle = (id, open, label, name) => `<div class="act"><button class="lnk sm" type="button" data-act="${id}" aria-expanded="${!!open}" aria-label="${h(`${name} ${open ? '접기' : '펴기'}`)}">${open ? '접기' : label} ${I.rarr}</button></div>`;
  const manualHtml = (always) => {
    if (!view.manual.length) return '';
    const open = always || apps.open?.manual, shown = view.manual.slice(0, MANUAL_MAX);
    return `<h3>직접 까실 것 · ${count(view.manual.length)}개</h3>${open ? `<div class="files mvlist" role="group" aria-label="직접 까실 것">${shown.map((m) => `<div class="fl plain mv app"><span class="nm">${h(m.name)}</span><span class="vl"></span><span class="ds url">${m.site ? `공식 · ${h(m.site)}` : '제작사 누리집에서 받으세요'}</span>${m.command ? `<span class="ds cmd">${h(m.command)}</span>` : ''}</div>`).join('')}</div>${view.manual.length > shown.length ? `<p class="foot">그 밖에 ${count(view.manual.length - shown.length)}개가 더 있습니다.</p>` : ''}` : ''}
      ${always ? '' : toggle('app-manual', open, 'winget에 없는 프로그램 보기', '직접 까실 것')}`;
  };

  if (phase === 'running') {
    const elevated = job.stage === 'elevated', user = job.stage === 'user';
    // 확인을 기다리는 동안만 「눌러 주세요」를 둔다(E18 approval — 관리자 쪽은 2초쯤 늦게 비친다, 앞서는 Fable D2 · D3로 두 때를 함께 덮었다)
    const wait = elevated && job.approval === true, cur = typeof job.current === 'string' && job.current ? job.current : null;
    const left = Number.isSafeInteger(job.left) && job.left > 0 ? job.left : null, curName = cur ? names[cur] || cur : '';
    const doing = cur ? `지금 「${h(curName)}」${pp(curName, '을/를')} 깔고 있습니다.${left ? ` 이것까지 ${count(left)}개가 남았습니다.` : ''}`
      : wait ? '컴퓨터 전체용 프로그램은 관리자 확인을 받은 뒤에 깝니다.' : elevated ? '컴퓨터 전체용 프로그램을 관리자 권한으로 깔고 있습니다.' : user ? '사용자용 프로그램을 하나씩 깔고 있습니다.' : '깔 준비를 하고 있습니다.';
    const l = `${top('프로그램 까는 중')}${say('프로그램을', '깔고 있습니다.')}
      ${then(doing)}
      ${wait ? '<div class="box rise i3"><b>관리자 확인 창에서 「예」를 눌러 주세요.</b>이어서 뜨는 「SYNK 업무 백업 — 프로그램 다시 깔기」 창에서 「확인」을 한 번 더 누르면 깔기 시작합니다. 확인 창은 10분 안에 누르지 않으면 닫히고, 그때는 아무것도 깔지 않습니다.</div>' : ''}
      ${notes([...(user ? ['설치기가 따로 창을 띄울 수 있습니다.'] : []), rulesOld ? '프로그램이 많으면 한 시간 넘게 걸릴 수 있습니다. 옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정은 되돌리지 않습니다.' : '프로그램이 많으면 한 시간 넘게 걸릴 수 있습니다. 다 깔면 깐 프로그램의 설정을 저절로 되돌립니다.',
        '창을 닫아도 앱이 뒤에서 계속 깝니다. 다시 열면 결과가 보입니다.'])}`;
    const ran = Array.isArray(apps.ran) ? apps.ran : [];
    const scopeOf = new Map([...view.table, ...view.others].map((p) => [p.id, p.scope]));
    // 엔진은 컴퓨터 전체용을 먼저 한 번에, 나머지를 고른 차례로 하나씩 깐다(move-service.cjs reinstall)
    const rest = ran.filter((id) => scopeOf.get(id) !== 'machine'), at = cur ? rest.indexOf(cur) : -1;
    const rowState = (id) => {
      if (id === cur) return '까는 중';
      const machine = scopeOf.get(id) === 'machine';
      if (wait) return machine ? '확인을 기다림' : '그다음 차례';
      if (elevated) return machine ? '관리자 권한으로 깔기' : '그다음 차례';
      if (user) return machine || (at >= 0 && rest.indexOf(id) < at) ? '차례 지남' : '차례를 기다림';
      return '준비 중';
    };
    const list = ran.length ? `<div class="files mvlist" role="group" aria-label="까는 프로그램">${ran.map((id) => `<div class="fl plain mv"><span class="nm">${h(names[id] || id)}</span><span class="vl">${rowState(id)}</span></div>`).join('')}</div><p class="foot">줄마다의 결과는 다 깐 뒤에 적습니다.</p>` : '<p class="empty">고른 프로그램을 깔고 있습니다.</p>';
    return { ...base, tone: 'run', html: flow(l, panel('까는 프로그램', left ? `남은 ${count(left)}개` : ran.length ? `${count(ran.length)}개` : '', `${list}${checks}`)), acts: acts0 };
  }
  if (phase === 'restoring') {
    const l = `${top('설정 되돌리는 중')}${say('설정을', '되돌리고 있습니다.')}${then('깐 프로그램의 설정 파일을 원래 자리에 놓습니다. 이 PC에 이미 있는 파일은 덮지 않습니다.')}`;
    return { ...base, tone: 'run', html: flow(l, panel('되돌릴 설정', '', `<p class="empty">되돌리는 중입니다.</p>${checks}`)), acts: acts0 };
  }
  if (phase === 'result') {
    const set = settingRows(set0?.list), rows = out?.rows || [];
    const when = set0?.saved && set0.at ? `${h(whenKo(set0.at, now))}에 마친 결과입니다. ` : '';
    const redo = !rulesOld && (out?.reboot || set.some((a) => a.warn) || !!apps.settingsError) && { id: 'apps-restore', label: apps.settingsError ? '설정 되돌리기' : '설정 다시 되돌리기', kind: apps.settingsError ? 'main' : 'link', disabled: !!run };
    // 설정 되돌리기가 앞의 일에 밀렸으면 그 말로 쓴다 — 새 PC는 아직 예약 백업을 하지 않는다(카본 C3)
    const busyCode = ['BUSY', 'JOB_BUSY', 'RUN_ACTIVE'].includes(apps.settingsError);
    const put = set.some((a) => a.restoredN > 0), aside = set.some((a) => a.asideN > 0);
    const main = apps.settingsError ? say('설정을', '되돌리지 못했습니다.') : out?.bad ? say(`${count(out.bad)}개는`, '깔지 못했습니다.')
      : put ? (rows.length ? say('프로그램을 깔고', '설정을 되돌렸습니다.') : say('설정을', '되돌렸습니다.'))
        : aside ? (rows.length ? say('프로그램을 깔았습니다.', '설정은 따로 두었습니다.') : say('설정을', '따로 두었습니다.'))
          : rows.length ? say('프로그램을 깔았습니다.', '되돌린 설정은 없습니다.') : say('되돌린 설정이', '없습니다.');
    const l = `${top()}${main}
      ${then(apps.settingsError ? (busyCode ? '앞의 일이 끝나지 않아 되돌리지 못했습니다. 잠시 뒤 「설정 되돌리기」를 다시 눌러 주세요.' : h(failureText(apps.settingsError))) : `${when}${set.length ? `프로그램 ${count(set.length)}개의 설정을 살폈습니다. 프로그램마다 무엇을 되돌렸는지 「되돌린 설정」에 적었습니다.` : rulesOld ? '옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정은 되돌리지 않았습니다.' : '되돌릴 프로그램 설정이 없었습니다.'}`)}
      ${notes([...(out?.reboot ? [rulesOld ? 'PC를 다시 켜면 마저 깔리는 프로그램이 있습니다.' : 'PC를 다시 켜면 마저 깔리는 프로그램이 있습니다. 다시 켠 뒤 「프로그램과 설정」을 열어 「설정만 되돌리기」를 누르면 그 프로그램의 설정도 되돌립니다.'] : []),
        ...(out?.admin ? ['표준 사용자 계정이면 컴퓨터 전체용 프로그램은 관리자에게 부탁해야 합니다. 「깐 프로그램」 줄의 명령을 전해 주세요.'] : []),
        ...(view.manual.length ? [`winget에 없는 ${count(view.manual.length)}개는 「직접 까실 것」을 보고 깔아 주세요.`] : []),
        '로그인 정보와 비밀번호는 옮기지 않았습니다. 「다시 로그인할 곳」을 하나씩 해 주세요.'])}
      ${acts([...(apps.settingsError && redo ? [redo] : []), { id: 'apps-next', label: handed ? '기본 화면으로' : '다음 · 백업 켜기', kind: apps.settingsError ? 'line' : 'main', disabled: !handed && !!run },
        { id: 'apps-reload', label: out?.bad ? '다시 깔기' : '다른 프로그램 더 깔기', kind: 'link', disabled: !!run }, ...(!apps.settingsError && redo ? [redo] : [])])}`;
    const prog = rows.length ? `<h3>깐 프로그램</h3><div class="files mvlist" role="group" aria-label="깐 프로그램">${rows.map((r) => `<div class="fl plain mv"><span class="nm">${h(r.name)}</span><span class="vl">${r.ok ? h(r.text) : `<span class="x">${h(r.text)}</span>`}</span>${r.why ? `<span class="why">${h(r.why)}</span>` : ''}${!r.ok && r.id ? `<span class="ds cmd">winget install --id ${h(r.id)} -e</span>` : ''}</div>`).join('')}</div>` : '';
    const exts = (a) => (a.extensions.length ? `${a.extensions.slice(0, 5).map((x) => `<span class="ds cmd">${h(x.command)}</span>`).join('')}${a.extensions.length > 5 ? `<span class="ds">그 밖에 ${count(a.extensions.length - 5)}개</span>` : ''}` : '');
    const setHtml = set.length ? `<h3>되돌린 설정</h3><div class="files mvlist" role="group" aria-label="되돌린 설정">${set.map((a) => `<div class="fl plain mv"><span class="nm">${h(a.name)}</span><span class="vl">${a.warn ? `<span class="x">${h(a.label)}</span>` : h(a.label)}</span>${a.lines.map((t) => `<span class="why">${h(t)}</span>`).join('')}${exts(a)}</div>`).join('')}</div>` : '';
    return { ...base, tone: apps.settingsError || out?.bad ? 'warn' : 'ok', html: flow(l, panel('프로그램과 설정', '', `${prog}${setHtml}${manualHtml(false)}${checks}`)), acts: acts0 };
  }
  if (phase === 'loading' || phase === 'error') {
    const l = phase === 'loading'
      ? `${top()}${say('옛 PC의 프로그램 목록을', '읽고 있습니다.')}${then('이 PC에 깔린 프로그램과 견주느라 몇 분 걸릴 수 있습니다.')}${acts([later])}`
      : `${top()}${say('옛 PC의 프로그램 목록을', '읽지 못했습니다.')}${then(['JOB_BUSY', 'RUN_ACTIVE'].includes(apps.listError) && s?.job ? '백업이 도는 동안에는 옛 PC의 프로그램 목록을 읽지 못합니다. 백업이 끝나면 저절로 다시 읽습니다.' : h(failureText(apps.listError)))}${acts([{ id: 'apps-reload', label: '목록 다시 읽기', kind: 'main', disabled: !!run }, later])}`;
    return { ...base, tone: phase === 'loading' ? 'run' : 'warn', html: flow(l, panel('옛 PC에서 찾은 프로그램', '', `<p class="empty">${phase === 'loading' ? '읽는 중입니다.' : '읽지 못했습니다.'}</p>${checks}`)), acts: acts0 };
  }
  if (phase === 'notready') {
    // winget이 없으면 깔린 프로그램도 읽지 못해, 설정을 되돌리면 모두 「앱이 없음」으로 따로만 간다 — 설정 되돌리기도 두지 않는다(Fable D5)
    const l = `${top()}${say('프로그램 설치 도구가', '아직 준비되지 않았습니다.')}${then(h(wingetText(apps.list.wingetStatus)))}
      ${notes([...(view.table.length || view.others.length ? ['명령은 winget이 준비된 뒤에 PowerShell에 붙여 넣어야 돕니다. 지금은 공식 누리집에서 받아 깔 수 있습니다.'] : []),
        ...reopen])}
      ${acts([{ id: 'apps-reload', label: '목록 다시 읽기', kind: 'main', disabled: !!run }, later])}`;
    const rows = view.table.length || view.others.length ? `<div class="files mvlist" role="group" aria-label="옛 PC에서 찾은 프로그램">${[...view.table, ...view.others].map((p) => appRowHtml(p, { pick: false, cmds: true, run })).join('')}</div>` : '';
    return { ...base, tone: 'warn', html: flow(l, panel('옛 PC에서 찾은 프로그램', '', `${rows}${manualHtml(true)}${checks}`)), acts: acts0 };
  }
  // 고르기 — 지난 깔기가 설정 되돌리기 없이 끝났으면(모두 관리자 확인을 받지 못함 · 시간 초과 · 결과를 못 읽음) 그 까닭을 먼저 알린다(D9)
  const n = view.ids.length, over = n > APPS_MAX;
  const unknown = apps.list?.installedKnown === false, unrestored = appsUnrestored(apps, st, job);
  const again = out?.declined ? '관리자 확인을 받지 못한 프로그램은 다시 누르면 확인 창이 한 번 더 뜹니다. ' : '';
  const alert = out?.failedStage ? '<div class="box rise i3"><b>깔기 결과를 읽지 못했습니다.</b>깔린 것이 있는지 「목록 다시 읽기」로 확인해 주세요.</div>'
    : unrestored && !rulesOld ? `<div class="box rise i3"><b>지난번에 깐 프로그램의 설정을 아직 되돌리지 않았습니다.</b>깐 뒤 설정을 되돌리기 전에 앱이 끝났습니다. 「설정만 되돌리기」를 눌러 주세요.${out?.bad ? ` 깔지 못한 ${count(out.bad)}개의 까닭은 목록의 줄마다 적었습니다. ${again}` : ''}</div>`
      : out?.bad ? `<div class="box rise i3"><b>지난번에 ${count(out.bad)}개를 깔지 못했습니다.</b>${again}목록의 줄마다 까닭을 적었습니다.</div>` : '';
  // 상자가 누르라고 하는 「설정만 되돌리기」를 채운 단추로 올린다 — 고른 것이 있으면 둘째 줄의 작은 단추라 첫 화면 밖이었다(Fable F4)
  const restoreFirst = unrestored && !rulesOld && view.ids.length > 0;
  // 이 PC에 깔린 목록을 못 읽었으면 표가 모두 「깔리지 않음」으로 온다(E21 installedKnown)
  const unknownBox = unknown ? '<div class="box rise i3"><b>이 PC에 깔린 프로그램 목록을 읽지 못했습니다.</b>이미 깔린 프로그램도 고른 채로 보일 수 있습니다. 「목록 다시 읽기」를 눌러 보세요.</div>' : '';
  const say1 = view.empty ? say('옛 PC에서 다시 깔', '프로그램을 찾지 못했습니다.') : say('다시 깔 프로그램을', '골라 주세요.');
  // 꾸러미가 없음(E21 kitProblems no-kit) — 앞서는 미리 보기의 kitAt으로 짐작했다
  const kitless = problems.includes('no-kit') || (!apps.list?.kitProblems && mv?.preview && mv.preview.kitAt === null);
  const then1 = view.empty ? (kitless ? '옛 PC의 프로그램 목록이 백업에 없습니다. 옛 PC가 업무 백업으로 백업하면 하루 한 번 담깁니다.' : rulesOld ? '업무 백업이 다시 깔 수 있는 프로그램이 옛 PC에 없었습니다. 옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정도 되돌리지 않습니다.' : '프로그램 목록이 백업에 없거나, 업무 백업이 다시 깔 수 있는 프로그램이 옛 PC에 없었습니다. 프로그램 설정은 그대로 되돌릴 수 있습니다.')
    : rulesOld ? '고른 프로그램을 한 번에 깝니다. 옛 PC의 업무 백업이 이 PC와 다른 판이라 프로그램 설정은 되돌리지 않습니다. 로그인 정보와 비밀번호는 옮기지 않으니 끝난 뒤 다시 로그인하세요.'
      : '고른 프로그램을 한 번에 깔고, 깐 뒤에 그 프로그램의 설정을 되돌립니다. 로그인 정보와 비밀번호는 옮기지 않으니 끝난 뒤 다시 로그인하세요.';
  const l = `${top()}${say1}${then(h(then1))}${alert}${unknownBox}
    ${view.machine ? '<div class="box rise i3"><b>관리자 확인이 한 번 뜹니다.</b>「예」를 누른 뒤 뜨는 「SYNK 업무 백업 — 프로그램 다시 깔기」 창에서 「확인」을 한 번 더 누르세요. 표준 사용자 계정이면 Windows가 관리자 계정의 이름과 비밀번호를 묻습니다.</div>' : ''}
    ${notes([...(view.outside ? ['「그 밖에 winget이 찾은 프로그램」은 설치기가 스스로 관리자 확인을 띄울 수 있습니다. 그 창에는 그 설치기 제작사의 이름이 뜹니다.'] : []),
      ...(view.noLicense ? [`고른 것 가운데 ${count(view.noLicense)}개는 사용권 주소를 읽지 못했습니다. 그 줄의 winget show 명령으로 계약을 볼 수 있습니다.`] : []),
      ...(n ? ['프로그램이 많으면 한 시간 넘게 걸릴 수 있습니다. 창을 닫아도 앱이 뒤에서 계속 깝니다.'] : []), ...reopen])}
    ${n ? '<div class="notes rise i5"><p class="note">누르면 고른 프로그램의 사용권 계약에 동의하게 됩니다. 계약 주소는 「주소와 명령 보기」에 있습니다.</p></div>' : ''}
    ${acts([...(restoreFirst ? [{ id: 'apps-restore', label: '설정만 되돌리기', kind: 'main', disabled: !!run }] : []),
      ...(n || !rulesOld ? [{ id: 'apps-go', label: n ? (rulesOld ? `고른 ${count(n)}개 깔기` : `고른 ${count(n)}개 깔고 설정 되돌리기`) : view.empty ? '설정 되돌리기' : '설정만 되돌리기', kind: restoreFirst ? 'line' : 'main', disabled: !!run || over }] : []),
      view.empty || (rulesOld && !n) ? { ...later, label: handed ? '기본 화면으로' : '다음 · 백업 켜기', kind: rulesOld && !n ? 'main' : 'link' } : later,
      ...(out?.failedStage || unknown ? [{ id: 'apps-reload', label: '목록 다시 읽기', kind: 'link', disabled: !!run }] : []),
      ...(n && !rulesOld && !restoreFirst ? [{ id: 'apps-restore', label: '설정만 되돌리기', kind: 'link', disabled: !!run }] : [])],
      over ? `<span class="hint">한 번에 ${count(APPS_MAX)}개까지 깔 수 있습니다. 몇 개를 빼 주세요.</span>` : '')}`;
  const cmds = !!apps.open?.cmds, rowOf = (p) => appRowHtml(p, { pick: true, cmds, last: lastOf.get(p.id), run });
  const table = view.table.length ? `<div class="files mvlist" role="group" aria-label="옛 PC에서 찾은 프로그램">${view.table.map(rowOf).join('')}</div>` : '';
  const others = view.others.length ? `<h3>그 밖에 winget이 찾은 프로그램 · ${count(view.others.length)}개</h3>${apps.open?.others ? `<div class="files mvlist" role="group" aria-label="그 밖에 winget이 찾은 프로그램">${view.others.map(rowOf).join('')}</div>` : '<p class="foot">업무 백업이 다시 깔기를 시험한 목록에 없는 프로그램입니다. 고르지 않았습니다.</p>'}${toggle('app-others', apps.open?.others, '펼쳐서 고르기', '그 밖에 winget이 찾은 프로그램')}` : '';
  const meta = view.empty ? '' : `${count(view.table.length)}개${view.others.length ? ` · 그 밖에 ${count(view.others.length)}개` : ''}${n ? ` · 고름 ${count(n)}개` : ''}`;
  // 옛 PC가 목록을 담은 때(E21 kitAt) — 옮겨 오기 전 마지막 판의 것이라 그 뒤에 깐 프로그램은 없다
  const kitWhen = apps.list?.kitAt && !view.empty ? `<p class="foot">옛 PC가 ${h(whenKo(apps.list.kitAt, now))}에 담은 목록입니다.</p>` : '';
  // 「주소와 명령 보기」는 펼친 줄이 있을 때만 둔다(카본 B5)
  const cmdToggle = view.table.length || (view.others.length && apps.open?.others) ? toggle('app-cmds', cmds, '주소와 명령 보기', '주소와 명령') : '';
  const r = panel('옛 PC에서 찾은 프로그램', meta, `${table}${view.empty ? '<p class="empty">다시 깔 프로그램이 없습니다.</p>' : ''}${kitWhen}${cmdToggle}${others}${manualHtml(false)}${checks}`);
  return { ...base, tone: alert || unknownBox ? 'warn' : 'ok', html: flow(l, r), acts: acts0 };
}

/* ── 사고 되돌리기 ─────────────────────────── */
function undo1Example(now) {
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

function undo2Example() {
  const u = EX.undo;
  const l = `${kick('미리 보기')}${say(`${h(u.pickShortKo)}로`, '되돌립니다.')}${then('클라우드 백업만 그 시각으로 되돌리고, 이 PC의 파일은 그대로 둡니다.')}
    <div class="rise i3">${steps([
      { h: '이 계정의 모든 기기 연결을 새 것으로 바꿉니다', p: '이 PC만 새 연결을 받습니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다. 전에 받은 복구 코드도 쓸 수 없게 되어, 끝나면 새로 만듭니다.' },
      { h: '그 시각의 백업을 다시 보이게 합니다', p: '지우는 것은 없습니다. 도중에 끊겨도 다시 누르면 이어서 합니다.' },
      { h: '확인을 마칠 때까지 자동 백업과 정리를 멈춥니다', p: '요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.' },
    ])}</div>
    ${acts([{ id: 'next', label: 'Google로 확인하고 되돌리기', kind: 'main', icon: 'google' }], '<span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>')}`;
  const r = panel('그 시각의 가장 최근 판', `${h(u.versionKo)} 판`, `<div class="rows">${EX.folders.map((f, i) => row(h(f.name), `${u.byFolder[i]}개`)).join('')}${row('합계', `${u.files}개 · ${u.size}`)}${row('지금 상태의 백업', '<span class="x">열 수 없음</span>', '숨겨진 묶음이 많아서')}</div>
    <h3>이 PC가 감염됐을 수 있으면</h3><p class="foot">먼저 치료한 뒤에 되돌리세요. 같은 사용자 권한의 프로그램은 새 Google 로그인도 읽습니다. 그다음 Google에서 이 PC를 로그아웃하고 「업무 백업」 접근을 지운 뒤 다시 로그인하세요. 깨끗한 다른 PC에서 되돌리려면, 그 PC에서 같은 Google 계정으로 시작해 「이 PC에서 파일만 되살리기」로 이은 뒤 설정의 「사고가 났을 때 되돌리기」를 누르세요.</p>
    <div class="act"><button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 ${I.ext}</button><button class="lnk sm" type="button" data-act="g-apps">연결된 앱 ${I.ext}</button></div>`);
  return { kind: 'flow', tone: 'bad', here: '사고가 났을 때 되돌리기', seg: [2, 3], back: 'undo-1', top: [{ id: 'back', label: '뒤로' }, { id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { next: { id: 'next', pending: '되돌리기' } } };
}

/** 서버가 고른 되돌릴 시각의 까닭(server/detect.mjs suggest) */
const REASON = { 'before-overwrite': '파일이 한꺼번에 덮어써지기 직전', 'before-settings-change': '백업 설정이 바뀌기 직전', 'before-mass-hide': '백업 묶음이 한꺼번에 지워지기 직전' };
const reasonKo = (r) => REASON[r] || '백업이 크게 바뀌기 직전';

/**
 * 사고 되돌리기 1(실제 상태) — restorePlan()의 { suggestions, plan, oldestAt }. 시간마다 숨겨진 묶음 수는 서버가 주지 않아
 * 예시의 막대 그림 대신 서버가 찾은 시각을 고르게 한다. undo는 창이 기억하는 { loading, error, value, pickAt }.
 */
function undo1(undo, now) {
  const v = undo?.value, list = Array.isArray(v?.suggestions) ? v.suggestions.filter((x) => Number.isFinite(Number(x?.at))) : [];
  const pickAt = Number(undo?.pickAt ?? v?.plan?.at ?? list[0]?.at);
  const pick = list.find((x) => Number(x.at) === pickAt) || null;
  const top = [{ id: 'home', label: '닫기' }];
  const base = { kind: 'flow', tone: 'bad', here: '사고가 났을 때 되돌리기', seg: [1, 3], top };
  if (!v) {
    const l = `${kick('사고가 났을 때 되돌리기')}${say('되돌릴 시각을', '찾고 있습니다.')}${then(undo?.error ? h(undo.error) : '지난 29일 동안 백업이 한꺼번에 바뀐 때를 SYNK 서버가 찾습니다.')}${undo?.error ? acts([{ id: 'replan', label: '다시 찾기', kind: 'line' }]) : ''}`;
    return { ...base, html: flow(l, panel('되돌릴 수 있는 시각', '', `<p class="empty">${undo?.error ? '시각을 찾지 못했습니다.' : '찾는 중입니다.'}</p>`)), acts: { replan: { id: 'replan' } } };
  }
  if (!list.length) {
    const l = `${kick('사고가 났을 때 되돌리기')}${say('한꺼번에 바뀐 때를', '찾지 못했습니다.')}${then('지난 29일 동안 백업 묶음이 덮어써지거나 한꺼번에 지워진 때가 없습니다. 파일 하나를 잘못 고쳤다면 「파일 되살리기」로 꺼내는 편이 빠릅니다.')}
      ${acts([{ id: 'restore', label: '파일 되살리기', kind: 'main' }, { id: 'other', label: '다른 시각 고르기', kind: 'link' }])}`;
    return { ...base, html: flow(l, panel('되돌릴 수 있는 시각', '', '<p class="empty">서버가 찾은 시각이 없습니다.</p>')), acts: { restore: { id: 'restore', to: 'restore' }, other: { id: 'other', pending: '다른 시각 고르기' } } };
  }
  const w = pick ? undoWindow(Number(pick.at), now) : null;
  const rows = list.map((x) => `<button class="fl pickrow" type="button" role="radio" aria-checked="${Number(x.at) === pickAt}" data-act="undo-pick" data-at="${Number(x.at)}"><span class="cb" aria-hidden="true"></span><span class="nm">${h(atKo(Number(x.at)))}</span><span class="ds">${h(reasonKo(x.reason))}</span></button>`).join('');
  const l = `${kick('백업이 바뀌었습니다')}${say('언제로 되돌릴까요?')}
    ${then(pick ? `${h(reasonKo(pick.reason))}인 <b class="num">${h(atKo(Number(pick.at)))}</b>${pp(atKo(Number(pick.at)), '을/를')} 골라 두었습니다.` : '오른쪽에서 되돌릴 시각을 골라 주세요.')}
    ${w ? `<div class="box rise i3"><b>되돌릴 수 있는 날이 ${w.daysLeft}일 남았습니다</b>지워진 묶음은 30일째부터 사라지기 시작해, 하루 여유를 두고 <span class="keep">${h(w.untilKo)}</span>까지 되돌릴 수 있습니다.</div>` : ''}
    ${acts([{ id: 'next', label: '이 시각으로 미리 보기', kind: 'main', disabled: !pick }, { id: 'other', label: '다른 시각 고르기', kind: 'link' }])}`;
  const r = panel('되돌릴 수 있는 시각', 'SYNK 서버가 찾은 때 · 지난 29일', `<div class="files" role="radiogroup" aria-label="되돌릴 시각">${rows}</div>
    <p class="foot">백업은 작은 묶음으로 나눠 올리고, 지워진 묶음은 30일 동안 숨겨 둡니다. 서버는 묶음이 한꺼번에 덮어써지거나 숨겨진 때의 바로 앞을 고릅니다.</p>`);
  return { ...base, html: flow(l, r), acts: { next: { id: 'next', to: 'undo-2' }, other: { id: 'other', pending: '다른 시각 고르기' } } };
}

/** 사고 되돌리기 2(실제 상태) — 고른 시각의 계획(plan: counts{copy, hide, unchanged} · copyBytes). 실행은 엔진 부탁 7 · 8 뒤에 잇는다 */
function undo2(undo, now, s = null) {
  const ro = s?.mode === 'restore';
  const plan = undo?.plans?.[undo?.pickAt] || (Number(undo?.value?.plan?.at) === Number(undo?.pickAt) ? undo.value.plan : null);
  const at = Number(undo?.pickAt ?? plan?.at);
  const when = Number.isFinite(at) ? atKo(at) : '';
  const c = plan?.counts || {};
  const l = `${kick('미리 보기')}${say(when ? `${h(when)}${pp(when, '으로/로')}` : '고른 시각으로', '되돌립니다.')}${then('클라우드 백업만 그 시각으로 되돌리고, 이 PC의 파일은 그대로 둡니다.')}
    <div class="rise i3">${steps([
      { h: '이 계정의 모든 기기 연결을 새 것으로 바꿉니다', p: ro ? '이 PC만 새 연결을 받고, 이 계정의 백업 자리도 이 PC로 옮겨져 옛 PC는 백업을 쉽니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다.' : '이 PC만 새 연결을 받습니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다.' },
      { h: '그 시각의 백업을 다시 보이게 합니다', p: '지우는 것은 없습니다. 그 시각 뒤에 올라온 묶음은 숨겨 두었다가 「되돌리기 취소」로 다시 보이게 할 수 있습니다.' },
      ro ? { h: '되돌린 결과를 확인할 때까지 정리를 멈춥니다', p: `이 PC는 되살리기만 하는 연결이라, 「여기서부터 계속」과 「되돌리기 취소」 어느 쪽을 골라도 백업은 저절로 다시 돌지 않습니다. 고른 뒤 이 PC에서 「이어서 백업」을 누르거나 옛 PC에서 「이 PC로 다시 백업」을 누르세요. 요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.` }
        : { h: '되돌린 결과를 확인할 때까지 자동 백업과 정리를 멈춥니다', p: '되돌린 뒤 「여기서부터 계속」과 「되돌리기 취소」 가운데 하나를 고르면 다시 돕니다. 요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.' },
    ])}</div>
    ${acts([{ id: 'run', label: 'Google로 확인하고 되돌리기', kind: 'main', icon: 'google', disabled: !plan || !Number.isFinite(at) || !!undo?.running }], `<span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>${gcancel(undo?.acct)}`)}`;
  const body = plan ? `<div class="rows">${row('다시 보이게 할 묶음', `${count(c.copy ?? 0)}개`, h(size(plan.copyBytes ?? 0)))}${row('숨길 묶음', `${count(c.hide ?? 0)}개`, '그 시각 뒤에 올라온 것')}${row('그대로인 묶음', `${count(c.unchanged ?? 0)}개`)}</div>
    <p class="foot">묶음은 백업을 나눠 올린 조각이라 파일 수와 다릅니다. 되돌린 뒤에는 「파일 되살리기」로 그 시각의 파일을 꺼내 확인합니다.</p>`
    : `<p class="empty">${undo?.planError ? h(undo.planError) : '계획을 세우는 중입니다.'}</p>`;
  const r = panel('그 시각으로 되돌리면', when ? `${h(when)} 기준` : '', `${body}
    <h3>이 PC가 감염됐을 수 있으면</h3><p class="foot">먼저 치료한 뒤에 되돌리세요. 같은 사용자 권한의 프로그램은 새 Google 로그인도 읽습니다. 그다음 Google에서 이 PC를 로그아웃하고 「업무 백업」 접근을 지운 뒤 다시 로그인하세요. 깨끗한 다른 PC에서 되돌리려면, 그 PC에서 같은 Google 계정으로 시작해 「이 PC에서 파일만 되살리기」로 이은 뒤 설정의 「사고가 났을 때 되돌리기」를 누르세요.</p>
    <div class="act"><button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 ${I.ext}</button><button class="lnk sm" type="button" data-act="g-apps">연결된 앱 ${I.ext}</button></div>`);
  return { kind: 'flow', tone: 'bad', here: '사고가 났을 때 되돌리기', seg: [2, 3], back: 'undo-1', top: [{ id: 'back', label: '뒤로' }, { id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { run: { id: 'run', call: 'restoreRun', arg: at, google: true, then: 'undo-3' } } };
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

/**
 * 사고 되돌리기 3(실제 상태) — state.account.restore(hold · jobId · state · awaitingChoice · at · byThisDevice · error · undo,
 * 조율 세션 c725f319c). 엔진이 멈춤 동안 1분마다 서버를 살펴 이 칸을 고친다. 고르기는 요청한 기기만 한다(server restore/choose).
 */
function undo3Real(s, acct, now) {
  const r = s?.account?.restore || null, at = Number(r?.at), when = r?.at != null && Number.isFinite(at) ? atKo(at) : '';
  const top = [{ id: 'home', label: '닫기' }], base = { kind: 'flow', tone: 'warn', here: '사고가 났을 때 되돌리기', seg: [3, 3], top };
  // 확인서의 말은 그 갈래에 맞춘다 — 끝나기 전에는 「되돌릴 시각」, 멈춤은 무엇을 기다리는지(카본 B6)
  const done = r?.state === 'done' || r?.state === 'continued' || r?.state === 'undone';
  const choosing = !!r?.awaitingChoice && r?.byThisDevice !== false;
  // 멈춤이 풀린 뒤에는 되돌리기 때문에 쉬지 않는다는 것만 말한다 — 자동 백업이 꺼졌거나 쉬는 PC도 있다(Fable 둘째 -c FA1)
  const pause = !r?.hold ? '되돌리기로 멈추지 않음' : r.state === 'failed' ? '되돌리기를 마칠 때까지 멈춤' : choosing ? '고를 때까지 멈춤' : r.undo ? '취소가 끝날 때까지 멈춤' : r.awaitingChoice ? '요청한 기기가 고를 때까지 멈춤' : '되돌리기가 끝나고 고를 때까지 멈춤';
  // 복구 전용 연결(되살리기만 하는 PC)은 되돌린 뒤에도 백업하지 않는다(조율 세션 57c3d17e6)
  const ro = s?.mode === 'restore';
  const sheet = (extra = []) => panel('되돌리기 확인서', '', `<div class="rows">${[[done ? '되돌린 시각' : '되돌릴 시각', when || '서버에서 읽는 중'], ['요청한 곳', r?.byThisDevice === false ? '다른 기기' : '이 PC'], ['이 PC의 파일', '그대로'], ['자동 백업', ro ? '이 PC는 되살리기만 함' : pause], ...extra].map(([k, v]) => row(h(k), h(v))).join('')}</div>`);
  const left = s?.account?.left ? notes(['새 복구 정보를 맡기는 걸음이 남았습니다. 고른 뒤 기본 화면의 「복구 정보 다시 맡기기」로 마칩니다.']) : '';
  const ended = !r && (s?.account?.restoreEnded ? { undo: s.account.restoreEnded.result === 'undone', jobId: s.account.restoreEnded.jobId, known: true } : acct?.restoreEnded ? (acct.restoreEnded.undo ? { undo: true, known: true } : { known: false }) : null);
  if (ended) {
    const e = ended;
    const now2 = afterUndo(s);
    const after = `${!e.known ? '' : e.undo ? '되돌리기 직전으로 다시 돌렸습니다.' : '되돌린 판에서 이어 갑니다.'}${now2.text ? ` ${now2.text}` : ''}`.trim();
    const l = `${kick('되돌리기 · 끝')}${!e.known ? say('되돌리기가', '끝났습니다.') : say(e.undo ? '되돌리기 취소를' : '되돌리기를', '마쳤습니다.')}${after ? then(after) : ''}${acts([{ id: 'home', label: '돌아가기', kind: 'main' }])}`;
    // 「돌아가기」가 엔진에 알렸다고 하면(restoreSeen) 기본 화면에 다시 띄우지 않는다
    return { ...base, tone: 'ok', html: flow(l, panel('되돌리기 확인서', '', `<div class="rows">${row('자동 백업', ro ? '이 PC는 되살리기만 함' : now2.backing ? '다시 돎' : '돌지 않음')}${row('이 PC의 파일', '그대로')}</div>`)),
      acts: { home: e.jobId ? { id: 'home', call: 'restoreSeen', arg: e.jobId, then: 'home' } : { id: 'home', to: 'home' } } };
  }
  if (!r) {
    const l = `${kick('사고가 났을 때 되돌리기')}${say('되돌리는 중인', '작업이 없습니다.')}${then('되돌리기는 설정의 「사고가 났을 때 되돌리기」에서 시작합니다.')}${acts([{ id: 'home', label: '돌아가기', kind: 'line' }])}`;
    // 작업이 없으면 확인서를 그리지 않는다(카본 A7)
    return { ...base, tone: 'ok', html: flow(l, panel('되돌리기 확인서', '', '<p class="empty">진행 중인 되돌리기가 없습니다.</p>')), acts: { home: { id: 'home', to: 'home' } } };
  }
  if (r.state === 'failed') {
    // 취소 작업의 실패에 되돌리기(반대 동작)를 다시 걸지 않는다(카본 A6)
    const again = !r.undo && r.error === 'INTERRUPTED' && r.byThisDevice !== false && Number.isFinite(at) && r.at != null;
    const l = `${kick('되돌리기 · 멈춤')}${say(r.undo ? '되돌리기 취소가' : '되돌리기가', '중간에 멈췄습니다.')}
      ${then(`${again ? 'SYNK 서버의 작업이 끊겼습니다. 같은 시각으로 다시 누르면 남은 것부터 이어서 합니다.' : '되돌리기를 마치지 못했습니다. SYNK가 확인하고 있으니 급하면 SYNK에 연락해 주세요.'} ${r.hold ? '그동안 백업을 쉽니다.' : ''}`.trim())}
      ${again ? acts([{ id: 'retry', label: 'Google로 확인하고 다시 되돌리기', kind: 'main', icon: 'google', disabled: !!acct?.running }], `<span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>${gcancel(acct)}`) : ''}`;
    return { ...base, tone: 'bad', html: flow(l, sheet()), acts: { retry: { id: 'retry', call: 'restoreRun', arg: at, google: true } } };
  }
  if (r.awaitingChoice && r.byThisDevice !== false) {
    const run = acct?.running || null;
    const undoFail = r.undoError ? '<div class="box rise i3"><b>되돌리기 취소를 마치지 못했습니다</b>SYNK 서버가 취소를 끝내지 못해 되돌린 상태 그대로입니다. 다시 골라 주세요. 또 실패하면 SYNK에 연락해 주세요.</div>' : '';
    const goNote = ro ? '<b>여기서부터 계속</b>은 되돌린 판을 이 계정의 백업으로 둡니다. 이 PC는 되살리기만 하는 연결이라 백업하지 않고, 옛 PC도 백업을 쉽니다. 고른 뒤 이 PC에서 「이어서 백업」을 누르거나, 옛 PC에서 「이 PC로 다시 백업」을 누르세요.'
      : '<b>여기서부터 계속</b>은 이 PC의 지금 파일로 다시 매시간 백업합니다. 지키는 폴더에 망가진 파일이 남아 있으면, 꺼낸 파일로 바꿔 놓은 뒤에 누르세요.';
    const l = `${kick(ro ? '되돌렸습니다 · 고를 차례' : '되돌렸습니다 · 자동 백업 멈춤')}${say(when ? `${h(when)}${pp(when, '으로/로')}` : '고른 시각으로', '되돌렸습니다.')}${then(ro ? '먼저 필요한 파일을 새 폴더로 꺼내 확인하세요. 고를 때까지 지난 판을 정리하지 않습니다.' : '자동 백업과 정리를 멈춰 두었습니다. 먼저 필요한 파일을 새 폴더로 꺼내 확인하세요.')}${undoFail}
      ${notes(['<b>파일 되살리기</b>는 되돌린 판에서 필요한 파일을 새 폴더로 꺼냅니다. 이 PC의 파일은 건드리지 않습니다.', goNote, ro ? '<b>되돌리기 취소</b>는 되돌리기 직전으로 다시 돌립니다. 누르면 Google 로그인을 한 번 더 합니다. 취소가 끝나도 백업은 저절로 다시 돌지 않으니, 위와 같이 「이어서 백업」이나 「이 PC로 다시 백업」을 누르세요.'
        : '<b>되돌리기 취소</b>는 되돌리기 직전으로 다시 돌립니다. 누르면 Google 로그인을 한 번 더 하고, 끝날 때까지 백업을 쉽니다.'])}${left}
      ${acts([{ id: 'out', label: '파일 되살리기', kind: 'main' }, { id: 'go', label: '여기서부터 계속', kind: 'line', disabled: !!run }, { id: 'cancel', label: '되돌리기 취소', kind: 'link', disabled: !!run }], gcancel(acct))}`;
    return { ...base, html: flow(l, sheet([['기기 연결', '새로 바꿈 · 이 PC만'], ['알림', '모든 기기 · 메일']])),
      acts: { out: { id: 'out', to: 'restore' }, go: { id: 'go', call: 'restoreChoose', args: [r.jobId, 'continue'] }, cancel: { id: 'cancel', call: 'restoreChoose', args: [r.jobId, 'undo'], google: true } } };
  }
  if (r.awaitingChoice) {
    const l = `${kick('되돌리기 · 다른 기기')}${say('다른 기기가', '백업을 되돌렸습니다.')}${then(ro ? '고르기는 되돌리기를 요청한 기기에서 합니다. 그동안 파일 되살리기는 쓸 수 있습니다.' : '고르기는 되돌리기를 요청한 기기에서 합니다. 그 기기가 이 계정의 백업을 맡게 되므로, 이 PC에서 다시 백업하려면 고른 뒤 「이 PC로 다시 백업」을 누르세요. 그동안 파일 되살리기는 쓸 수 있습니다.')}${acts([{ id: 'out', label: '파일 되살리기', kind: 'main' }])}`;
    return { ...base, html: flow(l, sheet()), acts: { out: { id: 'out', to: 'restore' } } };
  }
  if (!r.hold && (r.state === 'continued' || r.state === 'undone')) {
    const now3 = afterUndo(s);
    const l = `${kick('되돌리기 · 끝')}${say(r.state === 'undone' ? '되돌리기 취소를' : '되돌리기를', '마쳤습니다.')}${then(`${r.state === 'undone' ? '되돌리기 직전으로 다시 돌렸습니다.' : '되돌린 판에서 이어 갑니다.'}${now3.text ? ` ${now3.text}` : ''}`)}${left}${acts([{ id: 'home', label: '돌아가기', kind: 'main' }])}`;
    return { ...base, tone: 'ok', html: flow(l, sheet()), acts: { home: r.jobId ? { id: 'home', call: 'restoreSeen', arg: r.jobId, then: 'home' } : { id: 'home', to: 'home' } } };
  }
  const l = r.undo
    ? `${kick('되돌리기 취소 · 진행 중')}${say('되돌리기를', '취소하는 중입니다.')}${then(ro ? '되돌리기 직전으로 다시 돌리고 있습니다. 끝나도 백업은 저절로 다시 돌지 않습니다. 끝난 뒤 이 PC에서 「이어서 백업」을 누르거나 옛 PC에서 「이 PC로 다시 백업」을 누르세요. 창을 닫아도 됩니다.' : '되돌리기 직전으로 다시 돌리고 있습니다. 끝날 때까지 백업을 쉽니다. 창을 닫아도 됩니다.')}`
    : `${kick('되돌리기 · 진행 중')}${say(when ? `${h(when)}${pp(when, '으로/로')}` : '고른 시각으로', '되돌리는 중입니다.')}${then(r.byThisDevice === false ? 'SYNK 서버가 그 시각의 백업을 다시 보이게 하고 있습니다. 다른 기기가 요청한 되돌리기라, 고르기는 그 기기에서 합니다. 그동안 이 PC도 백업을 쉽니다.' : 'SYNK 서버가 그 시각의 백업을 다시 보이게 하고 있습니다. 끝나면 이 화면에서 고릅니다. 창을 닫아도 됩니다.')}`;
  return { ...base, html: flow(`${l}${left}${acts([{ id: 'out', label: '파일 되살리기', kind: 'line' }])}`, sheet()), acts: { out: { id: 'out', to: 'restore' } } };
}

/* ── 분실 신고 ─────────────────────────────── */
/** 분실 신고 1(실제 상태) — 서랍에서 고른 기기(acct.lostTarget). reportLost는 Google 확인을 한 번 더 한다 */
function lost1Real(s, acct) {
  const t = acct.lostTarget, name = String(t?.name || '').trim() || '그 기기', run = acct?.running || null;
  const l = `${kick(`${h(s?.device || '이 PC')}에서`)}${say(`「${h(name)}」${pp(name, '을/를')}`, '분실 신고합니다.')}
    ${then('신고하는 즉시 그 기기의 백업 연결을 끊습니다. 백업은 지워지지 않고, 잃어버린 기기 안의 파일은 이 앱이 지울 수 없습니다.')}
    <div class="box rise i3"><b>신고한 뒤에는</b>Google 계정에서 그 기기를 정리하고, 이 계정의 복구 정보를 새로 맡깁니다. 그 전까지는 SYNK 서버를 거쳐야 백업을 열 수 있습니다.</div>
    ${acts([{ id: 'next', label: 'Google로 확인하고 분실 신고', kind: 'main', icon: 'google', disabled: !!run }, { id: 'drawer', label: '취소', kind: 'link' }], `<span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>${gcancel(acct)}`)}`;
  const r = panel('분실 신고 순서', '끝까지 하면 잃어버린 기기는 백업을 읽지도 올리지도 못합니다', steps([
    { st: 'now', h: 'Google로 확인', p: '본인인지 Google 로그인으로 한 번 더 확인합니다.' },
    { h: '그 기기의 백업 연결 끊기', p: 'SYNK 서버가 바로 합니다.' },
    { h: 'Google 계정에서 그 기기를 로그아웃하고 「업무 백업」 접근 지우기', p: '잃어버린 기기에 남은 Google 로그인으로 복구 정보를 계속 읽을 수 있어서입니다. 신고한 뒤 다음 화면에서 합니다.' },
    { h: '이 PC에서 새 복구 정보 맡기기', p: '앞 걸음을 마쳤다고 확인한 뒤에만 맡깁니다.' },
  ]));
  return { kind: 'flow', tone: 'warn', here: '분실 신고', seg: [1, 2], top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { next: { id: 'next', call: 'reportLost', arg: t?.id, google: true, after: 'lost' }, drawer: { id: 'drawer', drawer: true } } };
}

/** 분실 신고 2(실제 상태) — 두 페이지를 openGoogleAccount로 열고 주소도 글로 남긴다(브라우저를 못 열 때). 확인한 뒤 rotateReadKey({googleStepDone: true}) */
function lost2Real(s, acct, now) {
  const lost = acct?.lost || null, name = String(lost?.name || '').trim() || '잃어버린 기기', run = acct?.running || null;
  const url = String((typeof lost?.url === 'string' && lost.url) || s?.account?.googleRemovalUrl || '').replace(/^https:\/\//, '');
  const l = `${kick(`${h(s?.device || '이 PC')} · 신고 뒤 남은 걸음`)}${say('Google에서도', '그 기기를 내보내세요.')}${then('백업 연결은 끊었습니다. 그 기기에 남은 Google 로그인도 끊어야 합니다.')}
    <div class="rise i3">${steps([
      { st: 'now', h: `Google 기기 관리에서 「${h(name)}」 로그아웃`, p: '훔쳐 갔을 수 있으면 Google 비밀번호도 바꾸세요. 주소: myaccount.google.com/device-activity', lk: `<button class="lnk sm" type="button" data-act="g-dev">Google 기기 관리 열기 ${I.ext}</button>` },
      { st: 'now', h: '연결된 앱에서 「업무 백업」 접근 지우기', p: `1번을 마친 뒤에 지웁니다. 이 PC도 함께 로그아웃됩니다. 주소: ${h(url || 'myaccount.google.com/connections')}`, lk: `<button class="lnk sm" type="button" data-act="g-app">연결된 앱 열기 ${I.ext}</button>` },
    ])}</div>
    ${acts([{ id: 'next', label: '두 걸음을 마쳤습니다 · 새 복구 정보 맡기기', kind: 'main', disabled: !!run }], `<span class="hint">앱은 1번을 알 수 없어 여기서 확인을 받습니다. 누르기 전에는 새 복구 정보를 맡기지 않습니다.</span>${gcancel(acct)}`)}`;
  const r = panel('분실 신고 확인서', '', `<div class="rows">${row('신고한 기기', h(name))}${lost?.at ? row('신고한 때', h(whenKo(lost.at, now))) : ''}${row('백업 연결', '끊음')}${row('백업', '그대로')}${row('Google에서 로그아웃', '기다림')}${row('「업무 백업」 접근 지우기', '기다림')}${row('새 복구 정보', '그다음')}</div>`);
  return { kind: 'flow', tone: 'warn', here: '분실 신고', seg: [2, 2], top: [{ id: 'home', label: '닫기' }], html: flow(l, r),
    acts: { next: { id: 'next', call: 'rotateReadKey', arg: { googleStepDone: true }, google: 'maybe', after: 'lost-done' } } };
}


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
    acts: { next: { id: 'next', to: 'home' } } };
}

/* ── 복구 코드 ─────────────────────────────── */
function code(s) {
  const l = `${kick('되찾는 길 · 첫 주 안에 한 번')}${say('복구 코드를', '한 장 만들어 두세요.')}${then('Google 계정에 들어갈 수 없을 때 이 종이 한 장으로 백업을 엽니다.')}
    <div class="box rise i3"><b>이 종이를 가진 사람은 백업을 열 수 있습니다</b>금고나 서랍처럼 PC와 떨어진 곳에 두세요. 백업하는 폴더나 OneDrive 폴더 안에는 저장할 수 없습니다.</div>
    ${acts([{ id: 'print', label: '인쇄', kind: 'main' }, { id: 'usb', label: 'USB에 저장', kind: 'line' }, { id: 'home', label: '다음에 하기', kind: 'link' }], '<span class="hint">건너뛰면 설정 › 복구 코드에서 언제든 만들 수 있습니다.</span>')}`;
  const groups = EX.codeGroups;
  const grid = Array.from({ length: Math.ceil(groups.length / 4) }, (_, r) => `<i>${r + 1}</i>${groups.slice(r * 4, r * 4 + 4).map((g) => `<span>${g}</span>`).join('')}`).join('');
  const r = panel('업무 백업 · 복구 코드', `만든 날 2026. 11. 13. · ${h(s?.device || EX.device)} · ${h(mail(s) || EX.account)}`, `<div class="code">
    <div class="selbar"><span>가려 둠 · 옆에 다른 사람이 없을 때만 펼쳐 보세요</span><button class="lnk sm" type="button" data-act="reveal" aria-controls="cg" aria-expanded="false">글자 보기</button></div>
    <div class="cg hide" id="cg" role="group" aria-label="복구 코드" aria-hidden="true">${grid}</div>
    <p class="foot">새 PC에서 업무 백업을 깔고 첫 화면의 <b>「복구 코드로 되살리기」</b>를 누른 뒤, USB에 저장한 파일을 열거나 이 글자를 그대로 넣으세요. Google 계정 없이 열립니다.</p>
    <p class="foot">분실 신고나 사고 되돌리기를 하면 이 코드는 쓸 수 없게 되고, 새 코드를 다시 권해 드립니다.</p></div>`);
  return { kind: 'flow', tone: 'ok', here: '복구 코드', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { print: { id: 'print', pending: '복구 코드 인쇄' }, usb: { id: 'usb', pending: '복구 코드 저장' }, home: { id: 'home', to: 'home' }, reveal: { id: 'reveal' } } };
}

/* ── 한꺼번에 지워지거나 바뀐 파일(설계 4.4 — 엔진 massHold) ─────────────────── */
/** 목록의 이름은 그 폴더 안의 상대 경로(a/b/c.docx)다. 폴더를 가르지 못한 판이면 판 안의 경로(/C/…)라 폴더 이름 없이 쓴다 */
function massItem(x) {
  const parts = String(x.name).split('/').filter(Boolean), file = parts.pop() || x.name;
  const where = [x.folder ? folderName(x.folder) : '', ...parts].filter(Boolean).join(' › ');
  return `<div class="fl plain" role="listitem"><span class="nm">${h(file)}</span><span class="vl">${x.kind === 'changed' ? '<span class="x">바뀜</span>' : '지워짐'}</span>${where ? `<span class="ds">${h(where)}</span>` : ''}</div>`;
}
function massList(s, now, ui, acct, home) {
  const mh = massOf(s), mm = massModel(s, now, { place: ui?.place, sentDefaultAt: ui?.sentDefaultAt, massAsk: ui?.massAsk, massSent: acct?.massSent, massGot: acct?.massGot });
  // 기본 화면이 다른 일(도는 백업 · 다시 로그인 등)을 먼저 보이면 그 일이 끝날 때까지 막는다(Opus 대체 검수 FA2)
  const first = !!home && home.id !== 'home-mass', run = acct?.running || (first ? 'first' : null);
  const actions = mm.actions.map((a) => (run === a.id || first ? { ...a, disabled: true } : a));
  const wait = first ? notes([h(home.id === 'home-run' ? '지금 다른 일이 도는 중입니다. 끝나면 누를 수 있습니다.' : '기본 화면에 먼저 할 일이 있습니다. 그 일을 마치면 누를 수 있습니다.')]) : '';
  const l = `${kick(h(mm.kick))}${say(h(mm.title))}${then(h(mm.sub))}${box(mm.box)}${wait}${notes(mm.notes.map(h))}${acts(actions, hintOf(mm, run ? { running: run } : acct))}`;
  // 바뀐 폴더가 여럿이면 폴더마다 되살릴 수 있다 — 한 번에 받다 100만 개를 넘어 거절될 때도 이 길이다
  const many = mh.folders.length > 1;
  const fRows = mh.folders.map((f) => {
    const n = folderName(f.path), counts = [f.removed ? `지워짐 ${count(f.removed)}` : '', f.changed ? `바뀜 ${count(f.changed)}` : ''].filter(Boolean).join(' · ');
    const btn = many ? `<button class="lnk sm" type="button" data-act="mass-one" data-path="${h(f.path)}" aria-label="${h(`「${n}」 폴더만 ${mh.word} 전으로 되살리기`)}"${run ? ' aria-disabled="true"' : ''}>이 폴더만 되살리기</button>` : '';
    return row(h(n), `${h(counts)}<br><span class="meta">${h(f.path)}</span>`, btn);
  }).join('');
  const total = mh.removed + mh.changed;
  const files = mh.list.length ? `<div class="files" role="list" aria-label="${h(mh.listLabel.replace(/ 보기$/, ''))}">${mh.list.map(massItem).join('')}</div>`
    : '<p class="empty">파일 이름을 읽지 못했습니다. 바뀐 폴더와 수는 맞습니다.</p>';
  const r = (mh.folders.length ? panel('바뀐 폴더', `${count(mh.folders.length)}곳`, `<div class="rows">${fRows}</div>`) : '')
    + panel('파일', mh.list.length && total > mh.list.length ? `${count(total)}개 가운데 ${count(mh.list.length)}개` : mh.list.length ? `${count(mh.list.length)}개` : '', `${files}
    ${total > mh.list.length ? `<p class="foot">목록은 500개까지만 보입니다. 되살리기는 ${mh.folders.length ? '바뀐' : '백업한'} 폴더를 통째로 받으므로 목록에 없는 파일도 함께 되살립니다.</p>` : ''}`);
  const map = { home: { id: 'home', to: 'home' } };
  for (const a of mm.actions) map[a.id] = a;
  if (mm.hintAct) map[mm.hintAct.id] = { id: mm.hintAct.id };
  // 기본 자리면 한 번 더 묻고, 고르는 자리면 그 창이 묻는다(모델의 「되살리기」 단추와 같은 갈래)
  if (many) map['mass-one'] = mm.go.call ? { id: 'mass-one', call: 'restoreMassBefore', perFolder: true } : { id: 'mass-one', massAsk: 'one' };
  return { kind: 'flow', tone: 'bad', here: mm.here, back: 'home', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: map };
}

/* ── 이 백업에 담지 못하는 이름(설계 4.2 — 엔진 leftOutNames) ─────────────────── */
function leftOut(s, now) {
  const lo = leftOutOf(s), device = typeof s?.device === 'string' && s.device.trim() ? s.device.trim() : '이 PC';
  const l = `${kick(`${h(device)} · 이 백업에 담지 못한 이름`)}${say(`파일이나 폴더 ${h(leftOutCountKo(lo))}`, '이름 때문에 백업에 담지 못했습니다.')}
    ${then('Windows는 이름 끝의 점(.)이나 빈칸을 다루지 못해, 이런 파일과 폴더는 백업할 수 없습니다. 폴더 이름이 그렇다면 그 안의 파일도 함께 빠집니다.')}
    ${notes([...(lo.checked ? [] : ['이번 백업은 폴더를 다 보지 못했습니다. 아직 보지 못한 폴더에 이런 이름이 더 있을 수 있습니다.']),
      '이름 끝의 점이나 빈칸을 지우면 다음 백업에 담깁니다.', '탐색기에서 이름이 바뀌지 않으면 그 파일을 만든 프로그램에서 바꿔 주세요.'])}
    ${acts([{ id: 'home', label: '돌아가기', kind: 'line' }])}`;
  const items = lo.names.map((p) => { const x = leftOutName(p); return `<div class="fl plain lo" role="listitem"><span class="nm">「${h(x.name)}」</span><span class="vl"></span>${x.where ? `<span class="ds">${h(x.where)}</span>` : ''}</div>`; }).join('');
  const more = lo.count > lo.names.length ? `<p class="foot">외 ${h(count(lo.count - lo.names.length))}개${lo.cut ? ' 이상' : ''}</p>` : '';
  const body = lo.names.length ? `<div class="files" role="list" aria-label="담지 못한 이름">${items}</div>${more}` : `<p class="empty">${h(UNNAMED)}</p>`;
  const r = panel('담지 못한 이름', `${h(`${count(lo.count)}개${lo.cut ? ' 이상' : ''}`)}${lo.at ? ` · ${h(whenKo(lo.at, now))}에 찾음` : ''}`, body);
  return { kind: 'flow', tone: 'warn', here: '담지 못한 이름', back: 'home', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { home: { id: 'home', to: 'home' } } };
}

/* ── 설정 서랍 ─────────────────────────────── */
export function drawer(s, extra = {}) {
  const st = s || {};
  const folders = (st.sources || []).map((p) => `<div class="dr"><span class="nm">${h(folderName(p))}</span><span class="vl">${h(p)}${(st.missingSources || []).some((m) => m.toLowerCase() === p.toLowerCase()) ? ' · 찾을 수 없음' : ''}</span><button class="lnk sm" type="button" data-act="drop" data-path="${h(p)}" aria-label="「${h(folderName(p))}」 지키는 목록에서 빼기">빼기</button></div>`).join('');
  const automatic = !!st.automatic;
  const G = (title, rows) => `<section class="dg"><h3>${h(title)}</h3>${rows}</section>`;
  const R = (nm, vl, a = null, nudge = false) => `<div class="dr"><span class="nm">${h(nm)}${nudge ? '<i aria-hidden="true"></i><span class="sr"> (권함)</span>' : ''}</span><span class="vl">${vl}</span>${a ? `<button class="lnk sm" type="button" data-act="${h(a.id)}" aria-label="${h(nm.includes(a.label) ? nm : `${nm} ${a.label}`)}">${h(a.label)}</button>` : ''}</div>`;
  return `<div class="dh"><h2>설정</h2><button class="tbtn" type="button" data-act="drawer-close">닫기</button></div>
    <p class="who">${h(mail(st))}${mail(st) ? ' · ' : ''}${h(st.device || '이 PC')} · <span class="num">${h(st.version || '0.7.0')}</span></p>
    ${G('지키는 것', `${folders || R('지키는 폴더', '아직 없음')}<div class="dr"><span class="nm">폴더 더하기</span><span class="vl">문서, 바탕화면 밖의 작업 폴더도 지킬 수 있습니다</span><button class="lnk sm" type="button" data-act="add">더하기</button></div>
      ${st.moveKit?.at ? R('프로그램 목록과 앱 설정', `앱 설정 ${h(count(Number(st.moveKit.apps) || 0))}개도 함께 지킵니다. 새 PC로 옮겨 올 때 씁니다. 로그인 정보와 열쇠는 담지 않습니다`) : ''}
      ${extra.moved ? R('프로그램과 설정', extra.moved.installing ? '옛 PC의 프로그램을 깔고 있습니다' : `옛 PC의 프로그램을 다시 깔고 설정을 되돌립니다${extra.moved.left ? ` · 다시 로그인할 곳 ${h(count(extra.moved.left))}곳 남음` : ''}`, { id: 'move-apps', label: '열기' }) : ''}
      ${R('쓰는 중인 파일', st.admin === false ? '표준 사용자 계정이라 그 프로그램을 닫았을 때 새로 담깁니다' : st.admin === true ? '관리자 계정이라 4시간에 한 번 따로 읽어 채웁니다' : '다른 프로그램이 쓰는 중인 파일은 그 프로그램을 닫은 뒤 첫 확인 때 담깁니다')}
      ${R('외장 드라이브 사본', '꺼짐', { id: 'external', label: '켜기' })}`)}
    ${G('되찾는 길', `${R('복구 코드', 'Google 계정에 못 들어갈 때 쓰는 종이 한 장 · 다음 업데이트에서 엽니다', { id: 'code', label: '만들기' }, true)}
      ${myDevices(st, extra, R)}
      ${R('사고가 났을 때 되돌리기', st.account?.connected && st.configured ? '29일 안이면 그 시각으로 되돌립니다' : '29일 안이면 그 시각으로 되돌립니다 · 계정으로 시작한 PC에서 엽니다', { id: 'undo-1', label: '되돌리기' })}`)}
    ${G('이 앱', `${R('매시간 자동 백업', automatic ? '켜짐 · 창을 닫아도 매시간 뒤에서 조용히 돕니다' : '꺼짐', { id: automatic ? 'auto-off' : 'auto-on', label: automatic ? '끄기' : '켜기' })}
      ${solioRows(st, R)}
      ${R('트레이 아이콘', '알림 영역의 아이콘이 없어도 백업은 매시간 돕니다', { id: 'tray', label: '켜고 끄기' })}
      ${R('시범 측정', '백업, 알림, 설치 결과 숫자를 보냅니다. 파일 이름, 경로, 내용은 보내지 않습니다', { id: 'telemetry', label: '보내는 내용 보기' })}
      ${R('업데이트', `지금 판 <span class="num">${h(st.version || '0.7.0')}</span>`)}
      ${R('도움 요청', '보낼 내용을 먼저 보여 드립니다', { id: 'help', label: '쓰기' })}
      ${R('계정', `${h(mail(st) || 'Google 계정')} · Google 2단계 인증을 켜 두세요`)}`)}`;
}

/** 설정 서랍의 솔리오 잇기 줄 — 쉬는 Wi-Fi(설계 4.14) · AI 도구(4.16). 이 칸이 없는 엔진 판에는 그리지 않는다 */
function solioRows(st, R) {
  const so = st.solio && typeof st.solio === 'object' ? st.solio : null;
  if (!so) return '';
  const rest = Array.isArray(so.restNetworks) ? so.restNetworks : [];
  const on = AI_TOOL_ROWS.filter((x) => so.aiTools?.tools?.[x.id] === true).map((x) => x.name);
  const restText = rest.length ? `${rest.slice(0, 2).map((n) => `「${h(n)}」`).join(', ')}${rest.length > 2 ? ` 외 ${h(count(rest.length - 2))}곳` : ''}에서는 매시간 백업을 쉽니다`
    : '휴대폰 핫스팟처럼 데이터 요금이 드는 Wi-Fi에서 매시간 백업을 쉬게 합니다';
  return `${R('쉬는 Wi-Fi', restText, { id: 'rest-net', label: '고르기' })}
      ${R('AI 도구', on.length ? `${h(on.join(', '))} 켜짐 · AI 도구에 파일 이름과 폴더 이름이 나갑니다` : '백업 상태만 답합니다 · 파일 이름은 나가지 않습니다', { id: 'ai-tools', label: '열기' })}`;
}

/**
 * 설정 서랍의 「내 기기」 — 계정에 이은 PC면 기기 목록(devicesList, 서랍을 열 때 읽는다)을 줄마다 보인다.
 * 분실 신고 · 끊기는 엔진 부탁(9 · 10 · 11)이 들어온 뒤에 연다.
 */
function myDevices(st, extra, R) {
  const devices = extra?.devices, now = extra?.now ?? Date.now();
  const me = `${st.device ? `${h(st.device)}(이 PC)` : '이 PC'}`;
  // 계정에 잇지 않은 PC — 분실 신고는 다른 PC나 새 PC에서 Google로 시작한 뒤 그 서랍의 기기 줄에서 한다(카본 A8)
  if (!st.account?.connected) return R('내 기기', `${me} · 잃어버리면 다른 PC나 새 PC에서 Google로 시작한 뒤 이 서랍의 기기 줄에서 분실 신고합니다. 다른 PC가 없으면 SYNK에 연락해 주세요`);
  const role = st.account.role === 'read' ? '되살리기만 하는 기기' : '백업하는 기기';
  const list = Array.isArray(devices) ? devices.filter((d) => !d.current) : null;
  // 다른 active 기기 줄마다 「분실 신고」(reportLost — 조율 세션 c725f319c 뒤). 끊긴 · 분실 신고한 기기에는 단추가 없다
  // 이 PC에 앞서 깐 연결(sameInstall)은 분실 신고하지 않는다 — 잃어버린 기기가 아니다
  const same = sameOf(st.account.sameInstall);
  const rows = list ? list.map((d) => { const x = deviceLine(d, now, same); const can = d.state === 'active' && typeof d.id === 'string' && !x.earlier;
    return `<div class="dr sub"><span class="nm">${h(x.name)}</span><span class="vl">${h(x.role)}${x.seen ? ` · ${h(x.seen)}` : ''}</span>${can ? `<button class="lnk sm" type="button" data-act="lost-dev" data-device="${h(d.id)}" aria-label="${h(`「${x.name}」 분실 신고`)}">분실 신고</button>` : ''}</div>`; }).join('') : '';
  return `${R('내 기기', `${me} · ${role}${list && !list.length ? ' · 이 계정에 이은 다른 기기는 없습니다' : list ? '. 잃어버린 기기가 있으면 그 줄에서 분실 신고합니다' : extra?.devicesError ? ' · 다른 기기를 읽지 못했습니다. 서랍을 다시 열면 다시 읽습니다' : ' · 다른 기기를 읽는 중입니다'}`)}${rows}`;
}

/** 쓰는 중인 파일 화면의 계정 갈래 — 엔진이 관리자 여부를 아직 주지 않으면(FUTURE.admin) 4시간 따로 읽기를 약속하지 않는다 */
function partialMode(id, s, fake) {
  if (id === 'partial-std' || s?.admin === false) return 'std';
  if (s?.admin === true || fake) return 'admin';
  return 'plain';
}

/* ── 솔리오 잇기 — 쉬는 Wi-Fi(설계 4.14) ─────── */
/**
 * 설정 서랍의 「쉬는 Wi-Fi」(setRestNetworks). ui.wifi는 지금 이어진 Wi-Fi — undefined 읽는 중 · false 읽을 길이 없음(그 메서드가 없는 엔진 판) ·
 * null 읽지 못함(Wi-Fi가 아니거나 위치 권한) · 문자열 그 이름. 고르는 동안(acct.running)은 단추를 막고 칸은 읽기만 둔다(포커스를 지킨다)
 */
function restNet(s, ui, acct) {
  const names = Array.isArray(s?.solio?.restNetworks) ? s.solio.restNetworks : [];
  const run = !!acct?.running, full = names.length >= REST_MAX, dis = run ? ' aria-disabled="true"' : '';
  const wifi = ui?.wifi;
  const here = typeof wifi === 'string' && wifi
    ? (names.includes(wifi) ? `<p class="now">지금 이어진 Wi-Fi 「${h(wifi)}」에서는 매시간 백업을 쉽니다. 이미 고른 Wi-Fi입니다.</p>`
      : `<p class="now">지금 이어진 Wi-Fi는 「${h(wifi)}」입니다. <button class="lnk sm" type="button" data-act="rest-here"${run || full ? ' aria-disabled="true"' : ''}>이 Wi-Fi에서 쉬기</button></p>`)
    : wifi === null ? '<p class="now">지금 이어진 Wi-Fi 이름을 읽지 못했습니다. Wi-Fi가 아닌 회선에 이어져 있거나, Windows가 위치 권한을 막았을 수 있습니다.</p>'
    : wifi === undefined ? '<p class="now">지금 이어진 Wi-Fi를 확인하고 있습니다.</p>' : '';
  const list = names.length ? names.map((n) => row(h(n), '', `<button class="lnk sm" type="button" data-act="rest-drop" data-name="${h(n)}"${dis} aria-label="${h(`「${n}」 빼기`)}">빼기</button>`)).join('')
    : '<p class="empty">아직 고른 Wi-Fi가 없습니다.</p>';
  const add = `<div class="find add"><input id="rest-in" type="text" aria-label="쉴 Wi-Fi 이름" placeholder="Wi-Fi 이름 적기" maxlength="32" autocomplete="off" spellcheck="false"${full ? ' disabled' : run ? ' readonly' : ''}><button class="lnk sm" type="button" data-act="rest-add"${run || full ? ' aria-disabled="true"' : ''}>더하기</button></div>`;
  const l = `${kick('설정 · 쉬는 Wi-Fi')}${say('고른 Wi-Fi에서는', '매시간 백업을 쉽니다.')}
    ${then('휴대폰 핫스팟처럼 데이터 요금이 드는 Wi-Fi를 고르세요. 그 Wi-Fi에 이어져 있는 동안에는 매시간 저절로 도는 백업을 쉬고, 다른 회선에 이어지면 다시 합니다. 이 창에서 「보호 시작」, 「이어서 백업」, 「지금 백업」을 직접 눌러 도는 백업은 쉬지 않습니다.')}
    ${acts([{ id: 'drawer', label: '설정으로 돌아가기', kind: 'link' }])}`;
  const r = panel('쉬는 Wi-Fi', names.length ? `${count(names.length)}개` : '', `${here}<div class="rows">${list}</div>${add}
    <p class="foot">Windows에 보이는 이름 그대로, 대소문자와 띄어쓰기까지 같게 적어 주세요. 한 글자라도 다르면 쉬지 않습니다. 그 Wi-Fi에 이어진 채로 「이 Wi-Fi에서 쉬기」를 누르면 가장 정확합니다.</p>
    <p class="foot">Wi-Fi 이름은 이 PC에만 두고 어디로도 보내지 않습니다. ${REST_MAX}개까지 고를 수 있습니다.</p>
    <p class="foot">Windows가 위치 권한을 막으면 이 앱이 Wi-Fi 이름을 읽지 못해, 고른 Wi-Fi에서도 쉬지 않습니다. 그럴 때는 Windows 설정의 「네트워크 및 인터넷」에서 그 Wi-Fi의 「데이터 통신 연결」을 켜 두세요. 데이터 통신 연결에서는 Wi-Fi 이름과 상관없이 쉽니다.</p>`);
  return { kind: 'flow', tone: 'setup', here: '쉬는 Wi-Fi', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { drawer: { id: 'drawer', drawer: true } } };
}

/* ── 솔리오 잇기 — AI 도구(설계 4.16) ─────── */
/**
 * 설정 서랍의 「AI 도구」 — 도구마다 켜고 끄기와 가리는 낱말(setAiTools), MCP로 이어 온 도구(aiToolsState의 clients — 화면에 들어올 때
 * 다시 읽은 ui.aiClients가 먼저). 이름과 판은 그 도구가 스스로 알린 것이라 그렇게 적고, 그 연결을 띄운 프로그램의 경로를 함께 보인다
 */
function aiToolsScreen(s, ui, acct, now) {
  const t = s?.solio?.aiTools || {}, tools = t.tools || {}, masks = Array.isArray(t.masks) ? t.masks : [];
  const clients = Array.isArray(ui?.aiClients) ? ui.aiClients : Array.isArray(t.clients) ? t.clients : [];
  const run = !!acct?.running, full = masks.length >= MASK_MAX, dis = run ? ' aria-disabled="true"' : '';
  const toolRows = row('백업 상태', '<span class="meta">지켜지고 있는지, 마지막으로 백업한 때, 살펴볼 것을 알려 줍니다. 파일 이름이 들어 있지 않아 늘 답합니다.</span>', '늘 답함')
    + AI_TOOL_ROWS.map((x) => {
      const on = tools[x.id] === true;
      return row(h(x.name), `<span class="meta">${h(x.what)}</span>`, `${on ? '켜짐' : '꺼짐'} <button class="lnk sm" type="button" data-act="ai-tool" data-tool="${h(x.id)}"${dis} aria-label="${h(`${x.name} ${on ? '끄기' : '켜기'}`)}">${on ? '끄기' : '켜기'}</button>`);
    }).join('');
  const maskRows = masks.length ? masks.map((w) => row(h(w), '', `<button class="lnk sm" type="button" data-act="mask-drop" data-name="${h(w)}"${dis} aria-label="${h(`「${w}」 가리지 않기`)}">빼기</button>`)).join('')
    : '<p class="empty">가리는 낱말이 없습니다.</p>';
  const maskAdd = `<div class="find add"><input id="mask-in" type="text" aria-label="가릴 낱말" placeholder="가릴 낱말 적기 (예: 건강, 계약)" maxlength="${MASK_LEN}" autocomplete="off" spellcheck="false"${full ? ' disabled' : run ? ' readonly' : ''}><button class="lnk sm" type="button" data-act="mask-add"${run || full ? ' aria-disabled="true"' : ''}>더하기</button></div>`;
  const seen = (c) => [c.firstSeen ? `처음 ${dayKo(c.firstSeen).replace(/ \S$/, '')}` : '', c.lastSeen ? `마지막 ${whenKo(c.lastSeen, now)}` : ''].filter(Boolean).join(' · ');
  const clientRows = clients.length ? clients.map((c) => row(`${h(c.name)}${c.version ? ` <span class="num">${h(c.version)}</span>` : ''}`, `<span class="meta">${h(c.exe || '띄운 프로그램을 알 수 없습니다')}</span>`, h(seen(c)))).join('')
    : '<p class="empty">아직 이 앱에 이은 AI 도구가 없습니다.</p>';
  const l = `${kick('설정 · AI 도구')}${say('AI 도구에는', '켠 것만 답합니다.')}
    ${then('Claude 같은 AI 도구를 이 앱에 이으면, AI 도구가 이 PC의 백업을 물어볼 수 있습니다. 백업 상태는 파일 이름이 들어 있지 않아 늘 답합니다. 공간 보고서와 백업 안 파일 찾기는 여기서 켠 것만 답합니다.')}
    <div class="box rise i3"><b>켜면 AI 도구에 파일 이름과 폴더 이름이 나갑니다</b>파일 내용은 나가지 않습니다. 지금 AI 도구는 보기만 하고, 백업을 바꾸거나 지우지 못합니다.</div>
    ${acts([{ id: 'drawer', label: '설정으로 돌아가기', kind: 'link' }])}`;
  const r = panel('AI 도구에 답하는 것', '', `<div class="rows">${toolRows}</div>`)
    + panel('가리는 낱말', masks.length ? `${count(masks.length)}개` : '', `<div class="rows">${maskRows}</div>${maskAdd}
    <p class="foot">이 낱말이 경로에 든 파일과 폴더는 AI 도구에 보이지 않습니다. 이 낱말로 찾으면 찾은 것이 없다고 답합니다. ${MASK_MAX}개까지, 낱말 하나는 ${MASK_LEN}자까지입니다.</p>`)
    + panel('이은 AI 도구', clients.length ? `${count(clients.length)}개` : '', `<div class="rows">${clientRows}</div>
    <p class="foot">이름과 판은 그 AI 도구가 스스로 알린 것입니다. 줄마다 적은 경로는 그 연결을 띄운 프로그램입니다. AI 도구에 잇는 단추는 다음 업데이트에서 엽니다.</p>`);
  return { kind: 'flow', tone: 'setup', here: 'AI 도구', top: [{ id: 'home', label: '닫기' }], html: flow(l, r), acts: { drawer: { id: 'drawer', drawer: true } } };
}

/** 화면 이름 → 그릴 것. ctx = { state, model, now, catalog, ui, fake } — fake는 예시 상태로 그리는 화면 확인용(시험 · 캡처) */
export function renderScreen(id, ctx) {
  const s = ctx.state, now = ctx.now, fake = !!ctx.fake;
  switch (id) {
    case 'start-1': return start1(s, ctx.acct, now, fake);
    case 'start-2': return start2(s, ctx.acct, fake, now);
    case 'start-3': return start3(s, fake);
    case 'restore': return restore(s, now, ctx.catalog, ctx.ui, ctx.mv, ctx.acct);
    case 'restore-old': return restoreOld(s, ctx.mv, ctx.acct, ctx.old, now, ctx.ui);
    case 'partial': case 'partial-std': return partial(s, now, partialMode(id, s, fake));
    case 'move-0': return move0(s, now, fake);
    // 실제 상태(또는 창의 옮겨 오기 기억 mv가 있는 예시)는 엔진에 잇는 갈래로, 기억 없는 예시 상태는 시안 그대로 그린다
    case 'move-1': return ctx.mv || !fake ? move1Real(s, ctx.mv, ctx.acct, now) : move1(ctx.ui);
    case 'move-2': return ctx.mv || !fake ? move2Real(s, ctx.mv, ctx.acct, now) : move2();
    case 'move-3': return ctx.mv || !fake ? move3Real(s, ctx.mv, ctx.acct, now) : move3();
    case 'move-4': return ctx.mv || !fake ? move4Real(s, ctx.mv, ctx.acct, now) : move4();
    case 'move-apps': return moveAppsReal(s, ctx.mv, ctx.acct, now);
    case 'undo-1': return ctx.undo || !fake ? undo1(ctx.undo, now) : undo1Example(now);
    case 'undo-2': return ctx.undo || !fake ? undo2(ctx.undo && { ...ctx.undo, acct: ctx.acct, running: ctx.acct?.running }, now, s) : undo2Example();
    // 계정 칸이 있는 상태(실제 상태의 꼴)는 실제 갈래로 — 끝나 상태에서 빠진 작업(acct.restoreEnded)도 거기서 그린다
    case 'undo-3': return s?.account || !fake ? undo3Real(s, ctx.acct, now) : undo3();
    case 'lost': return ctx.acct?.lostTarget ? lost1Real(s, ctx.acct) : lost1();
    case 'lost-2': return ctx.acct?.lost || (!fake && s?.account) ? lost2Real(s, ctx.acct, now) : lost2();
    case 'code': return code(s);
    case 'rest-net': return restNet(s, ctx.ui, ctx.acct);
    case 'ai-tools': return aiToolsScreen(s, ctx.ui, ctx.acct, now);
    // 멈춤이 풀렸으면(확인을 마침) 기본 화면을 그린다 — 창은 기본 화면으로 돌린다(app.js resolve)
    case 'mass-list': return massOf(s) ? massList(s, now, ctx.ui, ctx.acct, ctx.model) : homeScreen(ctx.model, ctx.acct, s);
    // 담지 못한 이름이 없으면 기본 화면을 그린다 — 창은 기본 화면으로 돌린다(app.js resolve)
    case 'left-out': return leftOutOf(s)?.count > 0 ? leftOut(s, now) : homeScreen(ctx.model, ctx.acct, s);
    default: return homeScreen(ctx.model, ctx.acct, s);
  }
}

/** 앱이 그리는 화면 이름 전부(시험 · tauri-driver · 캡처가 돈다) */
export const SCREENS = ['home', 'start-1', 'start-2', 'start-3', 'restore', 'restore-old', 'partial', 'partial-std', 'move-0', 'move-1', 'move-2', 'move-3', 'move-apps', 'move-4', 'undo-1', 'undo-2', 'undo-3', 'lost', 'lost-2', 'code', 'mass-list', 'left-out', 'rest-net', 'ai-tools'];
export { FAKE };

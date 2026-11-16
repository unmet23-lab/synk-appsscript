// 엔진 상태 → 화면 모델. 화면은 이 모델만 그리고, 엔진의 글(단계 · 오류 · 경고)은 그대로 옮기지 않는다.
// 문구의 근거는 시안 A의 원고(ui-mockups/_src/copy.mjs · a.mjs)와 설계 2.2 · 4.2 · 4.4 · 4.6 · 4.7 · 4.12다.
// 보이는 법(A 확인서 · 검정)과 상관없이 같다: 둘 다 「상태 한 줄 · 큰 문장 · 뜻 한 줄 · 할 일 · 그 증거」를 그린다.
//
// 상태 값은 워커의 state()(worker/handlers.cjs) 그대로다. 아직 엔진에 없는 값은 이름만 정해 두고(아래 FUTURE),
// 있으면 쓰고 없으면 그 줄을 그리지 않는다. 없는 값으로 그린 화면은 engine-fixtures.js의 예시 상태로만 볼 수 있다.

import { aroundKo, agoKo, count, dayKo, dayParen, daysLeft, josa, ms, placesKo, size, timeKo, undoDeadline, whenKo, baseName } from './ko-format.js';
import { failureText } from './state-store.js';

/** 엔진에 아직 없는 상태 칸 — 엔진 담당(조율 세션)과 이름을 맞출 목록. QA에 「가짜 상태」로 적는다. */
export const FUTURE = Object.freeze({
  'lastBackup.folders': '폴더마다 담은 파일 수 · 크기([{path, files, bytes}])',
  'lastProbe.v2': '되살리기 증명 v2 — 폴더마다 무작위 파일 합 64MiB 안(files · bytes · nextAt)',
  massHold: '한꺼번에 지워짐 멈춤(설계 4.4) — {at, path, removed, left, totalNow, bytesNow, before}',
  'lastPartial.program': '쓰는 중이라 못 읽은 파일을 쥔 프로그램 이름과 파일 목록',
  admin: '관리자 계정인지(쓰는 중이라 못 읽은 파일을 따로 읽어 채우는지)',
});

const MINUTE = 60000;

/** 작업 종류 → 화면 말(엔진 단계 글에는 「저장소」 같은 말이 있어 옮기지 않는다) */
function jobName(job) {
  if (!job) return '';
  if (job.scheduled) return '예약 백업';
  return ({ protect: '첫 백업', backup: '지금 백업', restore: '파일 되살리기', 'restore-selected': '파일 되살리기', browse: '파일 목록 열기', check: '백업 점검', probe: '되살려 보기', setup: '보호 준비', sources: '폴더 바꾸기', credentials: '다시 연결', import: '복구 코드 읽기', key: '복구 정보 맡기기', recovery: '복구 정보 맡기기', 'recovery-key': '복구 정보 맡기기' })[job.kind] || '작업';
}

/** 도는 작업마다 큰 문장과 뜻 한 줄(백업이 아닌 일을 「백업하고 있습니다」라 하지 않는다) */
function jobSay(job) {
  switch (job.kind) {
    case 'restore': case 'restore-selected': return ['파일을 되살리고 있습니다.', '끝나면 이 화면에서 되살린 폴더를 열 수 있습니다. 원래 파일은 건드리지 않습니다.'];
    case 'protect': return ['첫 백업 중입니다.', null];
    case 'backup': return ['지금 백업하고 있습니다.', null];
    case 'check': return ['백업을 점검하고 있습니다.', '창을 닫아도 계속됩니다. 끝나면 결과를 이 화면에 적습니다.'];
    case 'probe': return ['파일을 되살려 보고 있습니다.', '백업에서 파일을 꺼내 원본과 같은지 견줍니다. 이 PC의 파일은 건드리지 않습니다.'];
    case 'browse': return ['파일 목록을 여는 중입니다.', '잠시면 끝납니다.'];
    case 'setup': return ['보호를 준비하고 있습니다.', '잠시면 끝납니다.'];
    case 'sources': return ['지키는 폴더를 바꾸고 있습니다.', '잠시면 끝납니다.'];
    case 'credentials': return ['백업 연결을 다시 잇고 있습니다.', '잠시면 끝납니다.'];
    case 'import': return ['복구 코드를 읽고 있습니다.', '잠시면 끝납니다.'];
    case 'key': case 'recovery': case 'recovery-key': return ['복구 정보를 맡기고 있습니다.', '잠시면 끝납니다.'];
    default: return ['하던 일을 마치는 중입니다.', '잠시면 끝납니다.'];
  }
}

/** 진행 퍼센트(0~100, 모르면 null) */
function pct(job) {
  const p = Number(job?.percent);
  return Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : null;
}

/** 단계 말 — 엔진 단계 글에서 손님에게 뜻이 있는 것만 골라 바꾼다 */
function stageWord(job) {
  const s = String(job?.stage || '');
  if (/정리/.test(s)) return '지난 판 정리 중';
  if (/점검|확인 중|구조/.test(s) && !/복구 확인/.test(s)) return '확인하는 중';
  if (/내려받|해독|복구 확인/.test(s)) return '되살려 보는 중';
  if (/복구/.test(s)) return '되살리는 중';
  if (/읽지 못/.test(s)) return '쓰는 중이던 파일 다시 읽는 중';
  if (/백업 중|올리/.test(s)) return '올리는 중';
  if (/연결|준비/.test(s)) return '준비 중';
  return '진행 중';
}

/** 지키는 폴더의 이름(알려진 폴더는 한국어 이름) */
const KNOWN = { documents: '문서', desktop: '바탕화면', pictures: '사진', music: '음악', videos: '동영상', downloads: '다운로드' };
export function folderName(p) {
  const b = baseName(p);
  return KNOWN[b.toLowerCase()] || b;
}

function samePath(a, b) { return String(a || '').replace(/[\\/]+$/, '').toLowerCase() === String(b || '').replace(/[\\/]+$/, '').toLowerCase(); }

/** 되살려 본 날 줄 */
function proofOf(s, now) {
  const p = s.lastProbe;
  if (!p || !ms(p.at)) return { k: '되살려 본 날', day: '아직 없음', result: '', short: '첫 백업 뒤 일주일 안에', text: '첫 백업 뒤 일주일 안에 파일을 실제로 되살려 원본과 견줍니다.' };
  const files = Number(p.files) > 0 ? Number(p.files) : 0, bytes = Number(p.bytes) > 0 ? Number(p.bytes) : 0;
  const next = ms(p.nextAt) ?? ms(p.at) + 7 * 86400000;
  if (p.result === 'passed') {
    const what = files ? `${files > 1 ? '폴더마다 무작위로 고른' : '무작위로 고른'} 파일 ${count(files)}개${bytes ? `(${size(bytes)})` : ''}를` : '무작위로 고른 파일을';
    return { k: '되살려 본 날', day: dayKo(p.at), result: '같음', short: files > 1 ? `무작위 ${count(files)}개 모두 원본과 같음` : files === 1 ? '파일 1개가 원본과 같음' : '원본과 같음',
      text: `${what} 실제로 되살려 원본과 견줬습니다. 다음은 ${dayParen(Math.max(next, now))}입니다.` };
  }
  if (p.result === 'failed') return { k: '되살려 본 날', day: dayKo(p.at), result: '다름', short: '원본과 다른 파일이 나옴', bad: true, text: '되살린 파일이 원본과 달랐습니다. 확인하기 전까지 이전 판을 지우지 않습니다.' };
  const again = ms(p.nextAt) ?? ms(p.at) + (p.reason === 'limit' ? 30 : 7) * 86400000;
  const why = p.reason === 'limit' ? '백업 목록이 커서 이번에는 되살려 보기를 건너뛰었습니다.' : p.reason === 'no-snapshot' ? '아직 되살려 볼 판이 없었습니다.' : p.reason === 'no-small-file' ? '되살려 볼 만한 작은 파일이 없어 건너뛰었습니다.' : '이번에는 끝까지 되살려 보지 못했습니다.';
  return { k: '되살려 본 날', day: dayKo(p.at), result: '다시 해 봄', short: `${dayParen(Math.max(again, now))}에 다시 해 봄`, text: `${why} ${dayParen(Math.max(again, now))}에 다시 해 봅니다.` };
}

/** 확인서(증거) — 마지막 확인 · 다음 확인 · 지키는 폴더 · 합계 · 되살려 본 날 */
function evidence(s, now, { state = 'ok', next } = {}) {
  const missing = Array.isArray(s.missingSources) ? s.missingSources : [];
  const per = Array.isArray(s.lastBackup?.folders) ? s.lastBackup.folders : [];
  // 복구 전용 연결은 sources를 비운다(engine.cjs importRepository) — 마지막 판이 담은 폴더로 센다(Fable F4)
  const sources = Array.isArray(s.sources) && s.sources.length ? s.sources : per.map((x) => x?.path).filter((x) => typeof x === 'string' && x);
  const present = sources.filter((p) => !missing.some((m) => samePath(m, p)));
  const lastAt = Math.max(ms(s.lastBackup?.at) || 0, ms(s.lastPartial?.at) || 0) || null;
  const head = [
    { k: '마지막 확인', v: lastAt ? `${whenKo(lastAt, now)}${missing.length && present.length ? ` · ${placesKo(present.length)}` : ''}` : '아직 없음' },
  ];
  const nextAt = next === undefined ? s.nextBackupAt : next;
  if (nextAt && state !== 'moved') head.push({ k: '다음 확인', v: aroundKo(nextAt, now) });
  const rows = sources.map((p) => {
    const gone = missing.some((m) => samePath(m, p));
    const f = per.find((x) => samePath(x.path, p));
    const mass = s.massHold && samePath(s.massHold.path, p);
    return { k: folderName(p), path: p, gone, v: gone ? '찾을 수 없음' : mass ? `${count(s.massHold.left)}개 · −${count(s.massHold.removed)}` : f ? `${count(f.files)}개` : '', x: gone || mass };
  });
  const files = s.massHold ? s.massHold.totalNow : s.lastBackup?.files;
  const bytes = s.massHold ? s.massHold.bytesNow : s.lastBackup?.bytes;
  const total = s.lastBackup ? `${count(files)}개 · ${size(bytes)}` : '';
  const extra = [];
  if (s.lastPartial && state === 'partial') extra.push({ k: '쓰는 중이라 앞 판으로', v: `${count(s.lastPartial.unreadable)}개${s.lastBackup?.at ? ` · ${whenKo(s.lastBackup.at, now)}` : ''}` });
  if (missing.length && state === 'missing' && s.lastBackup?.at) extra.push({ k: '붙들어 둔 판', v: whenKo(s.lastBackup.at, now) });
  if (s.massHold && state === 'mass') extra.push({ k: '지우기 전 판', v: `${count(s.massHold.before)}개 · 붙들어 둠` });
  return {
    head,
    folders: { k: '지키는 폴더', v: `${count(present.length)}곳`, rows },
    total: { k: `${placesKo(missing.length ? present.length : sources.length)} 합계`, v: total },
    extra,
    proof: proofOf(s, now),
    end: state === 'moved' ? '이 PC의 마지막 확인서' : '매시간 새로 찍힙니다',
  };
}

const RESTORE = { id: 'restore', label: '파일 되살리기', kind: 'main', to: 'restore' };
const MOVE = { id: 'move', label: '새 PC로 옮겨 오기', kind: 'link', to: 'move-0' };

/**
 * 첫 시작의 걸음(개통 · engine/src/account.cjs state()). 'signin'은 Google로 시작하기 전, 'scope'는 이 PC가 백업할 기기라
 * 보호 범위를 고를 차례, 'read'는 이 계정의 백업을 다른 PC가 하고 있는 때다.
 */
export function startStep(s) {
  const a = s && typeof s === 'object' ? s.account : null;
  if (!a || !a.connected) return 'signin';
  return a.role === 'read' ? 'read' : 'scope';
}

/** 분실 신고 뒤 Google 걸음(설계 2.4 (5)(나) — 건너뛸 수 없다). 엔진이 googleStepRequired로 알리고, 손님이 확인해야 봉투를 올린다 */
export const GOOGLE_STEP = Object.freeze({ title: '먼저 Google 계정을 정리해 주세요',
  text: '잃어버린 기기를 신고한 뒤라, Google 기기 관리에서 그 기기를 로그아웃하고 연결된 앱에서 「업무 백업」 접근을 지운 다음에 새 복구 정보를 맡깁니다. 두 걸음을 마쳤으면 「Google에서 지웠습니다」를 누르세요.' });

/** 이 계정을 백업하는 기기의 이름 — 상태의 writer, 없으면 기기 목록에서 찾는다(창을 다시 열면 writer가 빈다 · Fable 개통 설계 12) */
export function writerName(s, devices) {
  const w = s?.account?.writer;
  if (typeof w === 'string' && w.trim()) return w.trim();
  const d = Array.isArray(devices) ? devices.find((x) => x && x.role === 'write' && x.state === 'active' && !x.current) : null;
  return d && typeof d.name === 'string' && d.name.trim() ? d.name.trim() : null;
}

/** 지킬 폴더로 고른 것 — 연 뒤에는 엔진 설정(nextSources), 열기 전에는 창의 고르기(selection) */
export function pickedSources(s) {
  const next = Array.isArray(s?.nextSources) ? s.nextSources : [];
  if (next.length) return next;
  return Array.isArray(s?.selection?.sources) ? s.selection.sources : [];
}

/** 계정의 기기 한 줄 — 역할과 상태(서버 devices · account.cjs listed) */
export function deviceLine(d, now = Date.now(), same = []) {
  const STATE = { moved: '옮겨짐', revoked: '끊김', lost: '분실 신고함', abandoned: '개통을 마치지 않음' };
  const role = d?.state && d.state !== 'active' ? STATE[d.state] || '쓰지 않음' : d?.role === 'write' ? '백업하는 기기' : '되살리기만 하는 기기';
  const seen = Number.isFinite(Number(d?.lastSeenAt)) && Number(d.lastSeenAt) > 0 ? `마지막 연결 ${whenKo(Number(d.lastSeenAt), now)}` : '';
  // 이 PC에 앞서 깔았던 연결(sameInstall)은 「이 PC」로 부른다 — 다시 깐 PC가 제 옛 연결을 남의 기기로 읽지 않게
  const earlier = !d?.current && sameOf(same).includes(d?.id);
  return { name: `${String(d?.name || '').trim() || '이름 없는 기기'}${d?.current ? '(이 PC)' : earlier ? '(이 PC · 앞서 깐 것)' : ''}`, role, seen, earlier };
}
/** 엔진 account.sameInstall — 기기 번호 목록만 받는다 */
export function sameOf(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

/**
 * 되살린 파일을 놓을 자리. 기본은 다운로드 아래 「되살린 파일 (<날짜>)」이고 엔진이 그 폴더를 만든다(place: 'default',
 * 같은 날 두 번째는 「… 2」 — 조율 세션 25d66f324). 지키는 폴더가 다운로드를 품거나 그 안에 있어 보이면 처음부터 고르게 한다
 * (엔진은 겹치는 자리를 OUTPUT_UNSAFE로 거절한다). chosen은 창이 기억하는 손님의 고름('default' | 'pick' | 없음)
 */
export function restorePlace(s, chosen, now = Date.now(), sentDefaultAt = null) {
  const d = new Date(now), name = `되살린 파일 (${d.getMonth() + 1}월 ${d.getDate()}일)`;
  const guarded = downloadsGuarded(s?.sources);
  // 복구 전용 연결은 지키는 폴더가 비어 있어, 옛 PC가 지킨 폴더와 겹쳐 엔진이 작업 안에서 거절할 수 있다(Fable 셋째 F3) —
  // 이 창이 기본 자리로 보낸 되살리기(sentDefaultAt) 뒤에 그렇게 거절됐으면 고르기로 시작한다. 실패 칸에는 어느 자리였는지가 없어,
  // 손님이 고른 자리의 거절을 다운로드 탓으로 읽지 않게 이 창이 보낸 때로 가린다(Fable 셋째 -b FA1)
  const sent = Number.isFinite(sentDefaultAt) ? sentDefaultAt : null;
  const unsafe = sent !== null && [s?.lastRestoreError, s?.lastSelectedRestoreError].some((e) => e?.code === 'OUTPUT_UNSAFE' && recentOf(e, now) && ms(e.at) >= sent - MINUTE);
  return { mode: guarded || unsafe || chosen === 'pick' ? 'pick' : 'default', name, guarded: guarded || unsafe, unsafe };
}
function downloadsGuarded(sources) {
  return (Array.isArray(sources) ? sources : []).some((p) => {
    const t = String(p || '').replace(/[\\/]+$/, '');
    // 드라이브 맨 위 · 사용자 폴더 전체를 지키면 다운로드도 그 안이다
    if (/^[a-z]:$/i.test(t) || /^[a-z]:[\\/]users([\\/][^\\/]+)?$/i.test(t)) return true;
    return t.split(/[\\/]/).some((x) => /^(downloads|다운로드)$/i.test(x));
  });
}

/**
 * 기본 화면 모델. state는 워커 state(), now는 밀리초, device는 이 PC 이름.
 * id는 시안 A의 화면 이름(home · home-run · home-partial · home-missing · home-mass · home-moved)과 그 밖의 주의 상태다.
 */
export function homeModel(state, opts = {}) {
  const now = opts.now ?? Date.now();
  const m = baseModel(state, now, opts);
  if (m.id === 'start' || m.id === 'home-run') return m;
  const st = state && typeof state === 'object' ? state : {};
  const note = restoreNote(st, now, m.id === 'home-restore-error'), ended = endedNote(st, now, m.id === 'home' || m.id === 'home-partial');
  // 되살리기 결과 줄과 끝난 되돌리기 줄이 함께 있으면 더 새것을 쓴다
  const restored = (note && ended ? (ended.at >= note.at ? ended : note) : note || ended) || undoNote(state, m.id === 'home', opts.undoSeen);
  return restored ? { ...m, restored } : m;
}

/**
 * 되돌리기가 끝난 뒤 이 PC의 백업이 어떤지 — 되돌리기를 요청한 기기가 쓰는 자리를 가져가므로(서버 2.5 · 조율 세션 57c3d17e6),
 * 다른 PC가 맡았거나 되살리기만 하는 PC면 「다시 매시간 백업합니다」라고 하지 않는다. 단추 이름은 그 PC 화면의 것이다(카본 A2 · A3 · A5)
 */
export function afterUndo(s) {
  const a = s?.account || {};
  if (s?.mode === 'restore') {
    // 되살리기만 하는 PC가 쓰는 자리를 쥐었으면(되돌리기 요청으로 옮겨 옴) 어느 PC도 백업하지 않는다
    return a.role === 'write' ? { backing: false, text: '지금은 어느 PC도 백업하지 않습니다. 이 PC에서 「이어서 백업」을 누르거나, 옛 PC에서 「이 PC로 다시 백업」을 누르세요.' }
      : { backing: false, text: '' };
  }
  if (s?.movedTo || a.role === 'read') return { backing: false, text: '이 계정의 백업은 다른 PC가 맡고 있습니다. 이 PC에서 다시 백업하려면 「이 PC로 다시 백업」을 누르세요.' };
  if (s?.automatic === false) return { backing: false, text: '자동 백업이 꺼져 있습니다. 켜면 다시 매시간 백업합니다.' };
  return { backing: true, text: '이 PC는 다시 매시간 백업합니다.' };
}

/** 끝난 사고 되돌리기(엔진 account.restoreEnded { jobId, result: 'continued' | 'undone', at } — 일주일까지 · 조율 세션 57c3d17e6) */
function endedNote(s, now, running = false) {
  const e = s.account?.restoreEnded;
  if (!e || typeof e.jobId !== 'string' || !['continued', 'undone'].includes(e.result) || ms(e.at) === null) return null;
  // 새 되돌리기가 열려 있으면 앞선 끝 줄을 띄우지 않는다(카본 A3)
  if (s.account?.restore?.hold) return null;
  // 이 PC가 맡은 백업이어도 지금 도는 갈래(안전 · 부분 판)가 아니면 「다시 매시간 백업합니다」를 붙이지 않는다(Fable F4)
  const a = afterUndo(s), after = a.backing && !running ? '' : a.text;
  const text = `${whenKo(e.at, now)}에 ${e.result === 'undone' ? '되돌리기 취소를 마쳤습니다. 되돌리기 전으로 돌아갔습니다.' : '사고 되돌리기를 마쳤습니다.'}${after ? ` ${after}` : ''}`;
  return { at: ms(e.at), text, act: { id: 'restore-seen', label: '확인', kind: 'link', call: 'restoreSeen', arg: e.jobId } };
}

/** 멈춤이 풀린 채 끊긴 사고 되돌리기(엔진은 실패 때 멈춤을 푼다 · Fable F4) — 같은 시각으로 다시 할 수 있을 때만 한 줄로 */
function undoNote(s, running, seen) {
  const r = s?.account?.restore;
  if (!r || r.hold || r.state !== 'failed' || r.undo || r.byThisDevice === false || r.error !== 'INTERRUPTED') return null;
  // 확인하러 간 작업은 이 창에서 다시 띄우지 않는다 — 엔진은 실패를 다음 되돌리기까지 들고 있다(Fable 둘째 -b FA3)
  if (seen && r.jobId && seen === r.jobId) return null;
  return { bad: true, text: `사고 되돌리기가 중간에 끊겼습니다.${running ? ' 백업은 다시 돕니다.' : ''}`, act: { id: 'undo-3', label: '확인하러 가기', kind: 'link', to: 'undo-3' } };
}

/**
 * 하루 안에 끝난 되살리기의 결과 한 줄 — 엔진은 폴더를 저절로 열지 않으므로 여기에 「되살린 폴더 열기」를 둔다.
 * 고른 파일 되살리기는 결과(lastSelectedRestore)와 실패(lastSelectedRestoreError)를, 전체 되살리기는 결과(lastRestore)와
 * 실패(lastRestoreError { code, at, path? }, 조율 세션 25d66f324)를 엔진이 남긴다. 실패가 기본 화면의 제목이면(skipFull) 줄로 또 쓰지 않는다.
 */
const recentOf = (x, now) => !!x && ms(x.at) !== null && now - ms(x.at) < 86400000 && ms(x.at) <= now + MINUTE;
/** 되살리다 멈춘 폴더(엔진 lastRestoreError.path) — 그 안의 파일은 다 확인하지 못했다 */
const leftover = (e) => (typeof e?.path === 'string' && baseName(e.path) ? ` 멈춘 폴더 「${baseName(e.path)}」의 파일은 다 확인하지 못했으니 쓰지 말고 지워 주세요.` : '');
/** 다운로드 아래 기본 자리에 만든 폴더면 그 이름(「되살린 파일 (11월 16일) 2」)을 쓴다 — 고른 자리의 엔진 이름은 쓰지 않는다 */
const madeIn = (r) => { const b = baseName(r?.path); return /^되살린 파일 \(\d{1,2}월 \d{1,2}일\)( \d{1,2})?$/.test(b) ? `「${b}」에 ` : ''; };
/** 하루 안에 실패한 전체 되살리기(그 뒤에 성공한 것이 없을 때) */
function fullRestoreError(s, now) {
  const e = s.lastRestoreError, full = s.lastRestore;
  return recentOf(e, now) && typeof e.code === 'string' && (!full || !(ms(full.at) > ms(e.at))) ? e : null;
}
function restoreNote(s, now, skipFull = false) {
  const recent = (x) => recentOf(x, now);
  const sel = s.lastSelectedRestore, full = s.lastRestore, err = s.lastSelectedRestoreError;
  const items = [];
  const fullErr = fullRestoreError(s, now);
  if (fullErr && !skipFull) items.push({ at: ms(fullErr.at), bad: true, text: `${whenKo(fullErr.at, now)}에 전체를 되살리지 못했습니다. ${failureText(fullErr.code)}${leftover(fullErr)}` });
  if (recent(err) && (!sel || ms(err.at) > ms(sel.at))) items.push({ at: ms(err.at), bad: true, text: `${whenKo(err.at, now)}에 고른 파일을 되살리지 못했습니다. ${failureText(err.code)}` });
  if (recent(sel)) items.push({ at: ms(sel.at), text: `${whenKo(sel.at, now)}에 고른 파일 ${count(sel.files)}개를 ${madeIn(sel)}되살렸습니다.`, act: { id: 'open-selected', label: '되살린 폴더 열기', kind: 'link', call: 'openSelectedRestoreFolder', withProfile: true } });
  // 엔진은 연결점 · 링크 · 특수 파일 · Windows가 담지 못하는 이름은 만들지 않고 그 수만 센다(lastRestore.skipped, 조율 세션 74a22589a)
  const skipped = Number(full?.skipped) > 0 ? Number(full.skipped) : 0;
  if (recent(full)) items.push({ at: ms(full.at), text: `${whenKo(full.at, now)}에 가장 최근 판 전체를 ${madeIn(full)}되살렸습니다.${skipped ? ` ${count(skipped)}개는 만들지 않고 건너뛰었습니다. 다른 곳을 가리키는 연결, 특수 파일, Windows에서 쓸 수 없는 이름입니다.` : ''}`, act: { id: 'open-full', label: '되살린 폴더 열기', kind: 'link', call: 'openRestoreFolder' } });
  // 실패가 기본 화면의 제목이면, 그보다 앞선 결과 줄(같은 날 먼저 성공한 되살리기)은 띄우지 않는다 — 방금 된 것으로 읽힌다(카본 A1)
  const after = skipFull && fullErr ? items.filter((x) => x.at > ms(fullErr.at)) : items;
  return after.sort((a, b) => b.at - a.at)[0] || null;
}

function baseModel(state, now, opts) {
  const s = state && typeof state === 'object' ? state : {};
  const device = typeof s.device === 'string' && s.device.trim() ? s.device.trim() : '이 PC';
  const p = s.protection || {};
  const base = { device, stamp: null, notes: [], box: null, link: null, hint: null, sub: '' };

  if (!s.configured && !s.job) return { ...base, id: 'start', tone: 'setup', kick: '설정할 것이 없습니다', title: '업무 자료를 매시간 저절로 지킵니다.', actions: [{ id: 'start', label: '보호 시작', kind: 'main', to: 'start-1' }], evidence: null };

  // 쓰는 기기를 다른 PC에 넘겨준 옛 PC(설계 4.6 N2) — 엔진이 서버 상태에서 적는다(movedTo, def8dde6d). 「이 PC로 다시 백업」은 takeWriteSeat가 지운다
  if (s.movedTo) {
    const to = String(s.movedTo.device || '새 PC');
    return { ...base, id: 'home-moved', tone: 'moved', stamp: '옮김', kick: `${device} · 백업을 쉬는 중`, title: `백업이 「${to}」${josa(to, '으로/로').slice(to.length)} 옮겨졌습니다.`,
      sub: `여기서 고친 파일은 백업되지 않습니다. ${whenKo(s.lastBackup?.at, now)}까지의 판은 그대로라 파일 되살리기는 계속 쓸 수 있습니다.`,
      actions: [RESTORE, { id: 'reclaim', label: '이 PC로 다시 백업', kind: 'line', call: 'takeWriteSeat', arg: {}, google: true }],
      hint: `다시 백업하면 「${to}」${josa(to, '은/는').slice(to.length)} 백업을 멈추고, 그 PC와 메일로 알립니다.`,
      evidence: evidence(s, now, { state: 'moved' }) };
  }

  if (s.job) {
    const name = jobName(s.job), percent = pct(s.job);
    const restoring = s.job.kind === 'restore' || s.job.kind === 'restore-selected';
    const [title, said] = s.job.scheduled ? ['지금 백업하고 있습니다.', null] : jobSay(s.job);
    // 첫 백업 전(설정 전에 도는 보호 준비 등)에는 되살릴 것도, 옮겨 올 것도, 증거도 아직 없다
    const ready = !!s.configured && !!s.lastBackup;
    return { ...base, id: 'home-run', tone: 'run', kick: `${device} · ${name} 도는 중`, title,
      sub: said ?? (s.lastBackup?.at ? `창을 닫아도 계속됩니다. 끝나기 전까지 가장 최근 판은 ${whenKo(s.lastBackup.at, now)} 판입니다.` : '창을 닫아도 계속됩니다. 끝나면 알림으로 알려 드립니다.'),
      actions: restoring || !ready ? [] : [RESTORE, MOVE],
      hint: s.job.scheduled && ready ? `파일 되살리기는 지금 누르면 ${josa(name, '이/가')} 끝나는 대로 이어서 엽니다.` : null,
      progress: { label: name, stage: stageWord(s.job), percent },
      evidence: s.configured ? { ...evidence(s, now), run: { label: `${name} · ${stageWord(s.job)}`, percent } } : null };
  }

  // 새 복구 정보를 맡길 차례(read-key · 되돌리기가 남긴 단계 · 분실 신고 뒤 Google 걸음) — 복구 전용 연결에서도 rotateReadKey가 된다(카본 A1)
  const needs0 = Array.isArray(s.account?.needs) ? s.account.needs : [];
  if (s.configured && s.account?.connected && !s.account?.restore?.hold && (needs0.includes('read-key') || s.account.left || s.account.googleStepRequired)) {
    return { ...base, id: 'home-readkey', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`, title: '새 복구 정보를 맡기는 걸음이 남았습니다.',
      sub: s.mode === 'restore' ? '맡겨 두어야 이 PC와 다른 PC에서 이 계정의 백업을 열 수 있습니다. 이 PC는 파일을 되살리기만 하는 연결입니다.'
        : '맡겨 두어야 이 PC를 잃어도 다른 PC에서 백업을 열 수 있습니다. 백업은 그대로 매시간 돕니다.',
      box: s.account.googleStepRequired || s.account.left === 'GOOGLE_STEP' ? GOOGLE_STEP : null, googleStep: !!s.account.googleStepRequired || s.account.left === 'GOOGLE_STEP',
      actions: [{ id: 'readkey', label: '복구 정보 다시 맡기기', kind: 'main', call: 'rotateReadKey', account: true, google: 'maybe' }, { ...RESTORE, kind: 'line' }],
      evidence: evidence(s, now) };
  }
  // 되살리기만 하는 연결은 쓰기 단추(폴더 다시 고르기 · 빼기 · 지금 백업)를 하나도 두지 않는다 — 엔진 순서(protection.cjs)와 같이 앞에서 가른다
  const undoOpen = !!s.account?.restore?.hold || (needs0.includes('restore') && !s.account?.restore?.jobId && !s.account?.restore?.state);
  if ((p.level === 'restoreOnly' || s.readOnly || s.mode === 'restore') && !undoOpen) {
    // 「이어서 백업」이 계정의 백업을 연 뒤 멈춘 PC(REPO_EXISTS → continueBackup 실패 · Fable 개통 설계 2): 이 PC가 쓰는 기기면 다시 잇는다.
    // 고른 폴더는 작업자 기억에만 있어 창을 다시 열면 비고, 연 뒤에는 폴더를 다시 고를 길이 엔진에 없다(엔진 부탁 12)
    const a = s.account;
    // 연 뒤에 고른 폴더는 엔진 설정(nextSources)에 남는다(조율 세션 c725f319c · 부탁 12). 열기 전에 고른 것(selection)도 함께 본다
    const picked = pickedSources(s);
    if (s.mode === 'restore' && a?.connected && a.role === 'write') {
      return { ...base, id: 'home-continue', tone: 'setup', kick: `${device} · 이어서 백업할 차례`, title: '이 계정의 백업을 열어 두었습니다.',
        sub: picked.length ? '「이어서 백업」을 누르면 이 PC가 그 백업에 이어서 매시간 올립니다. 지금까지의 판은 그대로 둡니다.' : '이어서 지킬 폴더를 먼저 고르세요. 고른 뒤 「이어서 백업」을 누르면 이 PC가 그 백업에 이어서 매시간 올립니다.',
        box: a.googleStepRequired ? GOOGLE_STEP : null, googleStep: !!a.googleStepRequired,
        actions: [picked.length ? { id: 'continue', label: '이어서 백업', kind: 'main', call: 'continueBackup', account: true } : { id: 'pick', label: '지킬 폴더 고르기', kind: 'main', call: 'chooseSources', onAccountProfile: true },
          ...(picked.length ? [{ id: 'pick', label: '폴더 다시 고르기', kind: 'link', call: 'chooseSources', onAccountProfile: true }] : []), { ...RESTORE, kind: 'line' }],
        evidence: evidence(s, now, { state: 'moved' }) };
    }
    // 다른 PC가 쓰는 계정의 백업을 연 PC(옮겨 오기의 앞 걸음, 또는 「이 PC에서 이어서 백업」이 쓰는 자리를 옮기기 전에 멈춘 PC)
    if (s.mode === 'restore' && a?.connected && a.role === 'read') {
      const writer = writerName(s);
      return { ...base, id: 'home-restore-read', tone: 'moved', stamp: '옮김', kick: `${device} · 되살리기만 하는 연결`, title: '이 PC는 파일을 되살리기만 합니다.',
        sub: `이 계정의 백업은 ${writer ? `「${writer}」${josa(writer, '이/가').slice(writer.length)}` : '다른 PC가'} 하고 있습니다. 이 PC에서 이어서 백업하면 그 PC는 그때부터 백업하지 않습니다.`,
        box: a.googleStepRequired ? GOOGLE_STEP : null, googleStep: !!a.googleStepRequired,
        actions: [RESTORE, picked.length ? { id: 'take-go', label: '이 PC에서 이어서 백업', kind: 'line', flow: 'takeOver', account: true, google: true } : { id: 'pick', label: '이 PC에서 백업할 폴더 고르기', kind: 'line', call: 'chooseSources', onAccountProfile: true },
          ...(picked.length ? [{ id: 'pick', label: '폴더 다시 고르기', kind: 'link', call: 'chooseSources', onAccountProfile: true }] : [])],
        evidence: evidence(s, now, { state: 'moved' }) };
    }
    return { ...base, id: 'home-restore-only', tone: 'moved', stamp: '옮김', kick: `${device} · 되살리기만 하는 연결`, title: '이 PC는 파일을 되살리기만 합니다.',
      sub: '이 연결로는 백업을 바꾸거나 지우지 않습니다.', actions: [RESTORE], evidence: evidence(s, now, { state: 'moved' }) };
  }

  // 계정이 서버에 다시 물어야 할 것(account.needs) — 'restore'는 되돌리기 요청의 답을 못 받아 백업이 쉬는 중이다(멈춤 표시가 남는다)
  const needs = Array.isArray(s.account?.needs) ? s.account.needs : [];
  const rs = s.account?.restore;
  // 답을 잃은 되돌리기(작업 번호도 상태도 아직 없음)는 「답을 받지 못했습니다」가 먼저다(Fable F6)
  if (needs.includes('restore') && !rs?.jobId && !rs?.state) {
    return { ...base, id: 'home-restore-wait', tone: 'warn', stamp: '멈춤', kick: `${device} · 백업을 쉬는 중`, title: '되돌리기 요청의 답을 받지 못했습니다.',
      sub: '요청이 SYNK 서버에 닿았는지 알 수 없어, 되돌리기를 마칠 때까지 백업을 쉽니다. 서버에서 작업을 찾으면 이 창에서 이어서 고를 수 있습니다. 급하면 SYNK에 연락해 주세요.',
      actions: s.lastBackup ? [{ ...RESTORE, kind: 'line' }] : [], evidence: evidence(s, now, { next: null }) };
  }
  if (rs?.hold) {
    // 고르기를 먼저 본다 — 취소 작업이 서버에서 실패하면 엔진이 원래 작업을 undo 표시로 다시 잡는다(Fable F5)
    const failed = rs.state === 'failed', choose = rs.awaitingChoice && rs.byThisDevice !== false;
    // 복구 전용 연결(되살리기만 하는 PC)은 고른 뒤에도 백업하지 않는다 — 「백업이 다시 돕니다」라고 하지 않는다(조율 세션 57c3d17e6)
    const ro = s.mode === 'restore';
    // 「되돌리기 취소」가 실패해 원래 작업이 다시 고르기를 기다리면 그 까닭(undoError)을 고를 때까지 보인다
    const undoFailed = choose && rs.undoError;
    return { ...base, id: 'home-restore-hold', tone: failed || undoFailed ? 'bad' : 'warn', stamp: '멈춤', kick: `${device} · ${ro ? '되돌리기를 확인하는 중' : '백업을 쉬는 중'}`,
      title: failed ? (rs.undo ? '되돌리기 취소가 중간에 멈췄습니다.' : '되돌리기가 중간에 멈췄습니다.') : undoFailed ? '되돌리기 취소를 마치지 못했습니다.' : choose ? '되돌린 백업을 확인할 차례입니다.' : rs.undo ? '되돌리기를 취소하는 중입니다.' : rs.awaitingChoice ? '다른 기기가 되돌린 백업을 확인하는 중입니다.' : '백업을 되돌리는 중입니다.',
      sub: failed ? (ro ? '되돌리기를 마치지 못했습니다. 확인하러 가서 다시 시도해 주세요.' : '되돌리기를 마칠 때까지 백업을 쉽니다. 확인하러 가서 다시 시도해 주세요.')
        : undoFailed ? 'SYNK 서버가 취소를 끝내지 못해 되돌린 상태 그대로입니다. 「여기서부터 계속」이나 「되돌리기 취소」를 다시 골라 주세요. 또 실패하면 SYNK에 연락해 주세요.'
        : choose ? (ro ? '되돌린 판에서 필요한 파일을 꺼내 본 뒤 「여기서부터 계속」이나 「되돌리기 취소」를 고르세요. 어느 쪽을 골라도 백업은 저절로 다시 돌지 않습니다.'
          : '되돌린 판에서 필요한 파일을 꺼내 본 뒤 「여기서부터 계속」이나 「되돌리기 취소」를 고르면 백업이 다시 돕니다.')
        : rs.awaitingChoice || rs.byThisDevice === false ? (ro ? '되돌리기를 요청한 기기에서 고를 때까지 기다립니다. 그동안 파일 되살리기는 쓸 수 있습니다.'
          : '되돌리기를 요청한 기기에서 고릅니다. 그 기기가 이 계정의 백업을 맡게 되므로, 이 PC에서 다시 백업하려면 고른 뒤 「이 PC로 다시 백업」을 누르세요.')
        : rs.undo ? `취소가 끝나면 되돌리기 전으로 돌아갑니다. 창을 닫아도 됩니다.${ro ? ' 끝나도 백업은 저절로 다시 돌지 않습니다. 끝난 뒤 이 PC에서 「이어서 백업」을 누르거나 옛 PC에서 「이 PC로 다시 백업」을 누르세요.' : ''}`
        : 'SYNK 서버가 끝내면 이 창에서 고를 수 있습니다. 창을 닫아도 됩니다.',
      actions: [{ id: 'undo-3', label: '확인하러 가기', kind: 'main', to: 'undo-3' }, ...(s.lastBackup || ro ? [{ ...RESTORE, kind: 'line' }] : [])],
      evidence: ro ? evidence(s, now, { state: 'moved' }) : evidence(s, now, { next: null }) };
  }
  if (s.account?.connected && needs.includes('write-key')) {
    return { ...base, id: 'home-writekey', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`, title: '이 PC가 백업할 준비가 끝나지 않았습니다.',
      sub: '백업 연결을 새로 받으면 바로 이어서 합니다.', hint: '누르면 Google 로그인을 한 번 더 합니다.',
      actions: [{ id: 'writekey', label: '연결 다시 받기', kind: 'main', call: 'takeWriteSeat', arg: {}, google: true }, ...(s.lastBackup ? [{ ...RESTORE, kind: 'line' }] : [])],
      evidence: evidence(s, now, { next: null }) };
  }

  // 연결이 끊기면 아무것도 올리지 못한다 — 폴더 · 경고보다 먼저(엔진 protection.cjs도 credential이 맨 앞)
  const reason = p.reason || (s.credentialRequired ? 'credential' : s.clockHold ? 'clock' : s.lastError ? 'error' : null);
  if (reason === 'credential') {
    return { ...base, id: 'home-credential', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`, title: '다시 로그인해야 이어서 지킵니다.',
      sub: '이 PC의 백업 연결이 끊겼습니다. 다시 로그인하면 바로 이어서 합니다.',
      actions: [{ id: 'relogin', label: '다시 로그인', kind: 'main', pending: '다시 로그인' }, ...(s.lastBackup ? [{ ...RESTORE, kind: 'line' }] : [])],
      evidence: evidence(s, now, { next: null }) };
  }

  // 한꺼번에 지워짐(설계 4.4) — 엔진에 아직 없다(FUTURE.massHold)
  if (s.massHold) {
    const m = s.massHold, folder = folderName(m.path);
    return { ...base, id: 'home-mass', tone: 'bad', stamp: '경고', kick: `${device} · 확인이 필요합니다`, title: '많은 파일이 한꺼번에 지워졌습니다.',
      sub: `${aroundKo(m.at, now)} 「${folder}」에서 ${count(m.removed)}개가 사라졌습니다. 확인하기 전까지 이전 판을 지우지 않습니다.`,
      notes: ['직접 지웠거나, 폴더를 옮기거나 이름을 바꿨다면 「내가 한 일이 맞음」을 누르세요.', '모르는 일이면 지워지기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.'],
      link: { label: `지워진 ${count(m.removed)}개 보기`, to: 'mass-list' },
      actions: [{ id: 'mass-restore', label: '지워지기 전으로 되살리기', kind: 'main', pending: '지워지기 전 판에서 되살리기' }, { id: 'mass-ok', label: '내가 한 일이 맞음', kind: 'line', pending: '「내가 한 일이 맞음」 알리기' }],
      evidence: evidence(s, now, { state: 'mass' }) };
  }

  // 되살려 보기에서 다름(설계 4.7) — 손상은 그날 알린다
  if (s.probeHold || s.lastProbe?.result === 'failed') {
    return { ...base, id: 'home-probe', tone: 'bad', stamp: '경고', kick: `${device} · 확인이 필요합니다`, title: '되살려 본 파일이 원본과 달랐습니다.',
      sub: '확인하기 전까지 이전 판을 지우지 않습니다. 같은 파일을 다시 되살려 보면 원인이 이 PC인지 백업인지 가립니다.',
      actions: [{ id: 'probe', label: '다시 되살려 보기', kind: 'main', call: 'probeRestore' }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now) };
  }

  const missing = Array.isArray(s.missingSources) ? s.missingSources : [];
  if (missing.length) {
    const one = missing.length === 1, m = missing[0], name = folderName(m);
    const rest = Math.max(0, (s.sources || []).length - missing.length), backed = !!s.lastBackup?.at;
    const lastAt = Math.max(ms(s.lastBackup?.at) || 0, ms(s.lastPartial?.at) || 0) || null;
    const names = missing.slice(0, 3).map((x) => `「${folderName(x)}」`).join(', ') + (missing.length > 3 ? ' 등' : '');
    // 빠진 것이 하나면 이름과 경로를, 여럿이면 몇 곳인지와 이름을 쓴다. 모두 빠졌으면 백업할 것이 없다고 쓴다
    const what = one ? `「${name}」(${m})${josa(name, '이/가').slice(name.length)}` : `폴더 ${placesKo(missing.length)}(${names})이`;
    const sub = rest === 0
      ? `${what} 없어 지금은 백업할 폴더가 없습니다. 폴더가 다시 보이거나 새로 고르면 이어서 지킵니다.`
      : `${what} 없어 ${one ? '그 폴더만' : '그 폴더들만'} 빼고 ${backed ? '백업했습니다' : '지킵니다'}.${backed && lastAt ? ` 나머지 ${placesKo(rest)}은 ${whenKo(lastAt, now)}에 지켰습니다.` : ''}`;
    return { ...base, id: 'home-missing', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`,
      title: rest === 0 ? '지키는 폴더를 모두 찾을 수 없습니다.' : one ? '폴더 하나를 찾을 수 없습니다.' : `폴더 ${placesKo(missing.length)}을 찾을 수 없습니다.`,
      sub,
      box: backed ? { title: '마지막 판은 붙들어 둡니다', text: `${one ? '그 폴더가' : '그 폴더들이'} 든 마지막 판은 지워지지 않게 붙들어 둡니다. 폴더가 다시 보이면 저절로 이어서 지킵니다.` } : null,
      // 빼기는 한 폴더씩이다 — 여럿이면 폴더마다 「빼기」가 있는 설정 서랍을 연다
      actions: [{ id: 'reselect', label: '다시 고르기', kind: 'main', call: 'addSources' }, one ? { id: 'drop', label: '목록에서 빼기', kind: 'line', call: 'removeSource', arg: m } : { id: 'folders', label: '설정에서 폴더 빼기', kind: 'line', drawer: true }],
      hint: backed ? '목록에서 빼면 그 폴더의 백업은 30일 뒤 지워집니다.' : null, evidence: evidence(s, now, { state: 'missing' }) };
  }

  // 전체 되살리기가 실패하면 엔진은 lastRestoreError를 적고, 다음 전체 점검까지 지난 판을 정리하지 않으려 점검 주의(health)도 건다
  // (engine.cjs restoreLatest). 그 주의가 방금의 되살리기 실패에서 왔으면 「점검을 마치지 못했다」가 아니라 되살리기 말로 쓴다
  const rErr = fullRestoreError(s, now), hAt = ms(s.health?.checkedAt);
  if (reason === 'health' && rErr && hAt !== null && Math.abs(ms(rErr.at) - hAt) <= 10 * MINUTE) {
    return { ...base, id: 'home-restore-error', tone: 'warn', stamp: '주의', kick: `${device} · 되살리기를 마치지 못함`, title: '파일을 되살리지 못했습니다.',
      sub: `${failureText(rErr.code)} 원래 파일과 백업은 그대로입니다.${leftover(rErr)}`,
      box: { title: '전체 점검을 마칠 때까지 지난 판을 지우지 않습니다', text: '되살리기를 마치지 못한 뒤라, 한 번 전체 점검을 마칠 때까지는 지난 판을 정리하지 않고 둡니다.' },
      actions: [{ ...RESTORE, label: '다시 되살리기' }, { id: 'check', label: '전체 점검', kind: 'line', call: 'checkRepository' }], evidence: evidence(s, now) };
  }

  // 그 밖의 주의 상태(엔진 protection.level · reason)
  // 계정으로 시작한 PC가 「보호 시작」 도중 복구 정보를 맡기는 걸음에서 멈췄으면 옛 연결(connectRecovery)이 아니라
  // startProtection을 다시 불러 멈춘 자리부터 잇는다 — 첫 백업도 그다음에 시작한다(Fable F1)
  const acc = s.account?.connected && s.account.role === 'write' ? s.account : null;
  const attention = {
    recovery: acc ? { title: s.lastBackup ? '복구 정보를 아직 맡기지 않았습니다.' : '보호 시작이 중간에 멈췄습니다.',
      sub: s.lastBackup ? '이 PC를 잃어버렸을 때 백업을 열 열쇠입니다. 누르면 멈춘 자리부터 이어서 맡깁니다.' : '복구 정보를 Google 계정에 맡기는 걸음에서 멈췄습니다. 누르면 멈춘 자리부터 잇고 첫 백업을 시작합니다.',
      act: { id: 'recovery', label: s.lastBackup ? '복구 정보 맡기기' : '이어서 보호 시작', kind: 'main', call: 'startProtection', account: true } } : {
      title: '복구 정보를 아직 맡기지 않았습니다.', sub: `이 PC를 잃어버렸을 때 백업을 열 열쇠입니다. Google 계정에 한 번 맡기면 끝납니다.${s.recovery?.connected ? '' : ' 누르면 Google 로그인 창이 한 번 뜹니다.'}`,
      act: s.recovery?.available === false ? { id: 'recovery', label: '복구 정보 맡기기', kind: 'main', pending: '복구 정보 맡기기' }
        : { id: 'recovery', label: '복구 정보 맡기기', kind: 'main', call: s.recovery?.connected ? 'syncRecovery' : 'connectRecovery' } },
    clock: { title: '이 PC의 시계가 맞지 않습니다.', sub: '시계가 맞지 않으면 언제 백업했는지 셀 수 없어 쉬고 있습니다. Windows 시계를 맞추면 이어서 합니다.', act: null },
    health: { title: '백업 점검을 마치지 못했습니다.', sub: '확인하기 전까지 이전 판을 지우지 않습니다. 다시 점검하면 무엇이 문제인지 가립니다.', act: { id: 'check', label: '다시 점검', kind: 'main', call: 'checkRepository' } },
    error: { title: '지난 백업을 마치지 못했습니다.', sub: s.lastBackup?.at ? `가장 최근 판은 ${whenKo(s.lastBackup.at, now)} 판입니다. 다음 확인 때 다시 해 봅니다.` : '다음 확인 때 다시 해 봅니다.', act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    empty: { title: '아직 첫 백업이 없습니다.', sub: '첫 백업이 끝나야 파일을 되살릴 수 있습니다.', act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    overdue: { title: `${agoKo(s.lastBackup?.at, now)} 동안 백업하지 못했습니다.`, sub: `가장 최근 판은 ${whenKo(s.lastBackup?.at, now)} 판입니다. PC가 켜져 있고 인터넷에 이어져 있으면 저절로 이어서 합니다.`, act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    startup: { title: '매시간 예약이 걸려 있지 않습니다.', sub: '지금은 매시간 백업이 돌지 않습니다. 다시 걸면 창을 닫아 두어도 매시간 뒤에서 조용히 돕니다.', act: { id: 'schedule', label: '예약 다시 걸기', kind: 'main', call: 'setLaunchAtLogin', arg: true } },
  }[reason];
  if (attention) {
    // 시계가 맞지 않으면 다음 확인을 셀 수 없다
    return { ...base, id: `home-${reason}`, tone: reason === 'health' ? 'bad' : 'warn', stamp: reason === 'health' ? '경고' : '주의', kick: `${device} · 확인이 필요합니다`,
      title: attention.title, sub: attention.sub, actions: [...(attention.act ? [attention.act] : []), ...(s.lastBackup ? [{ ...RESTORE, kind: attention.act ? 'line' : 'main' }] : [])],
      // 계정 단추(startProtection)는 분실 신고 뒤 Google 걸음을 확인받아야 열린다
      ...(attention.act?.account && s.account?.googleStepRequired ? { box: GOOGLE_STEP, googleStep: true } : {}),
      evidence: evidence(s, now, reason === 'clock' || reason === 'startup' ? { next: null } : {}) };
  }
  // 엔진이 「확인이 필요함」이라고 했는데 이 화면이 모르는 까닭이면, 안전하다고 하지 않는다
  if (p.level === 'attention') {
    return { ...base, id: 'home-attention', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`, title: '백업을 이어서 하지 못하고 있습니다.',
      sub: '다시 점검하면 무엇이 문제인지 가립니다. 확인하기 전까지 이전 판을 지우지 않습니다.',
      actions: [{ id: 'check', label: '다시 점검', kind: 'main', call: 'checkRepository' }, ...(s.lastBackup ? [{ ...RESTORE, kind: 'line' }] : [])], evidence: evidence(s, now) };
  }
  if (p.level === 'paused') {
    // 쉬는 동안의 다음 확인은 다시 시작하는 때다(엔진의 매시간 예정을 그대로 쓰면 위 문장과 어긋난다)
    return { ...base, id: 'home-paused', tone: 'warn', stamp: '주의', kick: `${device} · 잠시 쉬는 중`, title: '백업을 잠시 쉬고 있습니다.',
      sub: `${aroundKo(s.pausedUntil, now).replace(' 무렵', '')}에 다시 시작합니다. 그동안 고친 파일은 다시 시작할 때 담깁니다.`,
      actions: [{ id: 'resume', label: '지금 다시 시작', kind: 'main', call: 'resumeAutomatic' }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now, { next: s.pausedUntil || null }) };
  }
  if (p.level === 'off') {
    return { ...base, id: 'home-off', tone: 'warn', stamp: '주의', kick: `${device} · 자동 백업 꺼짐`, title: '자동 백업이 꺼져 있습니다.',
      sub: '켜 두면 창을 닫아도 매시간 뒤에서 조용히 돕니다.', actions: [{ id: 'on', label: '자동 백업 켜기', kind: 'main', call: 'setAutomatic', arg: true }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now, { next: null }) };
  }

  // 안전함 — 쓰는 중인 파일 몇 개만 앞 판(부분 판)이면 그 사실을 한 줄로
  const partial = s.lastPartial && ms(s.lastPartial.at) && (!s.lastBackup || ms(s.lastPartial.at) >= ms(s.lastBackup.at) - MINUTE) ? s.lastPartial : null;
  if (partial) {
    const n = count(partial.unreadable) + (partial.cut ? '개 넘게' : '개');
    const who = typeof partial.program === 'string' && partial.program ? partial.program : null;
    const holder = who ? `${josa(who, '이/가')} 쓰는 중인` : '다른 프로그램이 쓰는 중인';
    // 앞선 온전한 판이 없으면(첫 백업이 부분 판) 그 파일은 어느 판에도 없다 — 「앞 판으로 지킨다」고 하지 않는다(엔진 engine.cjs 부분 판 주석)
    const firstOnly = !s.lastBackup || s.lastBackup.id === partial.id;
    const link = { label: '어떤 파일인지 보기', to: s.admin === false ? 'partial-std' : 'partial' };
    if (firstOnly) {
      return { ...base, id: 'home-partial', tone: 'warn', stamp: '주의', kick: `${device} · 매시간 저절로 지키는 중`, title: '쓰는 중인 파일은 아직 담지 못했습니다.',
        sub: `${holder} 파일 ${n}는 아직 어느 판에도 없습니다. 그 프로그램을 닫으면 다음 확인 때 담깁니다. 나머지는 모두 지켰습니다.`,
        link, actions: [RESTORE, MOVE], evidence: evidence(s, now, { state: 'partial' }) };
    }
    return { ...base, id: 'home-partial', tone: 'ok', stamp: '안전', kick: `${device} · 매시간 저절로 지키는 중`, title: '안전합니다.',
      sub: `${holder} 파일 ${n}만 앞 판으로 지키고, 나머지는 모두 최신 판입니다.`,
      link, actions: [RESTORE, MOVE], evidence: evidence(s, now, { state: 'partial' }) };
  }
  return { ...base, id: 'home', tone: 'ok', stamp: '안전', kick: `${device} · 매시간 저절로 지키는 중`, title: '안전합니다.',
    sub: '매시간 저절로 확인하고, 일주일에 한 번은 파일을 실제로 되살려 원본과 같은지 봅니다.',
    actions: [RESTORE, MOVE], evidence: evidence(s, now) };
}

/** 사고 되돌리기 마감 — 화면이 직접 셈한다(T + 29일) */
export function undoWindow(hiddenAt, now = Date.now()) {
  const until = undoDeadline(hiddenAt);
  return until === null ? null : { until, untilKo: `${dayKo(until).replace(/ [일월화수목금토]$/, '')} ${timeKo(until)}`, daysLeft: daysLeft(until, now) };
}

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
  'lastPartial.program': '쓰는 중이라 못 읽은 파일을 쥔 프로그램 이름과 파일 목록',
  admin: '관리자 계정인지(쓰는 중이라 못 읽은 파일을 따로 읽어 채우는지)',
});

const MINUTE = 60000;

/** 작업 종류 → 화면 말(엔진 단계 글에는 「저장소」 같은 말이 있어 옮기지 않는다) */
function jobName(job) {
  if (!job) return '';
  if (job.scheduled) return '예약 백업';
  return ({ protect: '첫 백업', backup: '지금 백업', restore: '파일 되살리기', 'restore-selected': '파일 되살리기', browse: '파일 목록 열기', check: '백업 점검', probe: '되살려 보기', setup: '보호 준비', sources: '폴더 바꾸기', credentials: '다시 연결', import: '복구 코드 읽기', key: '복구 정보 맡기기', recovery: '복구 정보 맡기기', 'recovery-key': '복구 정보 맡기기', move: '옮겨 오기' })[job.kind] || '작업';
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
    case 'move': return ['옮겨 오고 있습니다.', '창을 닫아도 계속됩니다. 끊겨도 다시 시작하면 멈춘 곳부터 잇습니다.'];
    default: return ['하던 일을 마치는 중입니다.', '잠시면 끝납니다.'];
  }
}

/** 진행 퍼센트(0~100, 모르면 null) */
function pct(job) {
  // 퍼센트가 없는 단계(null — 보호 준비 · 점검 · 그만두는 중)를 0%로 그리지 않는다: Number(null)은 0이다
  if (job?.percent === null || job?.percent === undefined || job?.percent === '') return null;
  const p = Number(job?.percent);
  return Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : null;
}

/** 단계 말 — 엔진 단계 글에서 손님에게 뜻이 있는 것만 골라 바꾼다 */
function stageWord(job) {
  // 옮겨 오기는 처음에 폴더마다 목록을 읽느라 퍼센트가 없다(Fable F12)
  if (job?.kind === 'move') return Number.isFinite(Number(job.percent)) && job.percent !== null ? '옮겨 오는 중' : '옮겨 올 목록 읽는 중';
  // 그만두는 되살리기(요청 16 — 엔진 단계 글 「되살리기를 그만두는 중」)
  if (job?.cancelled === true) return '그만두는 중';
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
  const mh = massOf(s);
  // 한꺼번에 지워지거나 바뀐 폴더는 많이 바뀐 두 곳까지 줄로 두고, 나머지는 수만 센다 — 작은 창에서도 두 단추가 첫 화면에 남게(Opus 대체 검수 FA3)
  // 엔진이 둘째 줄의 폴더(path)를 고르는 기준과 같다 — 지워짐 · 큰 파일이면 지운 수, 바뀜이면 바뀐 수, 같으면 합(다시 검수 -b 1)
  const weight = (f) => (mh.kind === 'changed' ? f.changed : f.removed);
  const top = mh ? [...mh.folders].sort((a, b) => weight(b) - weight(a) || (b.removed + b.changed) - (a.removed + a.changed)).slice(0, 2) : [];
  const more = mh ? mh.folders.filter((f) => sources.some((p) => samePath(p, f.path)) && !top.includes(f)).length : 0;
  const rows = sources.map((p) => {
    const gone = missing.some((m) => samePath(m, p));
    const f = per.find((x) => samePath(x.path, p));
    // 지금 수(멈춤이 가장 많이 바뀐 폴더에서 센 것, 없으면 마지막 판의 수) 옆에 사라진 수와 바뀐 수를 붙인다
    const mf = !gone && mh ? top.find((x) => samePath(x.path, p)) : null;
    if (mf) {
      const has = samePath(mh.path, p) && mh.left !== null ? mh.left : Number.isSafeInteger(f?.files) ? f.files : null;
      const main = has === null ? '' : `${count(has)}개`, mark = [mf.removed ? `−${count(mf.removed)}` : '', mf.changed ? `바뀜 ${count(mf.changed)}` : ''].filter(Boolean).join(' · ');
      return { k: folderName(p), path: p, gone, v: [main, mark].filter(Boolean).join(' · '), main, mark, x: true };
    }
    return { k: folderName(p), path: p, gone, v: gone ? '찾을 수 없음' : f ? `${count(f.files)}개` : '', x: gone };
  });
  const files = mh?.totalNow ?? s.lastBackup?.files;
  const bytes = mh?.bytesNow ?? s.lastBackup?.bytes;
  const total = s.lastBackup ? `${count(files)}개 · ${size(bytes)}` : '';
  const extra = [];
  if (s.lastPartial && state === 'partial') extra.push({ k: '쓰는 중이라 앞 판으로', v: `${count(s.lastPartial.unreadable)}개${s.lastBackup?.at ? ` · ${whenKo(s.lastBackup.at, now)}` : ''}` });
  if (missing.length && state === 'missing' && s.lastBackup?.at) extra.push({ k: '붙들어 둔 판', v: whenKo(s.lastBackup.at, now) });
  return {
    head,
    folders: { k: '지키는 폴더', v: `${count(present.length)}곳`, rows, more },
    total: { k: `${placesKo(missing.length ? present.length : sources.length)} 합계`, v: total },
    extra,
    proof: proofOf(s, now),
    end: state === 'moved' ? '이 PC의 마지막 확인서' : '매시간 새로 찍힙니다',
  };
}

/**
 * 한꺼번에 지워지거나 바뀐 멈춤(설계 4.4 — 엔진 massHold, 조율 세션 9ddcbeb40). 정리가 지울 판을 남는 판과 견줘 문턱을 넘으면 지울 판을
 * 번호로 붙들어 둔다(beforeId). kind: removed 지워짐 · changed 내용이 바뀜 · bytes 큰 파일이 지워짐. path가 null이면 판의 폴더를 가르지 못한 것이다.
 * 되살린 결과(lastRestore.mass)는 같은 판(beforeId)에서, 멈춘 뒤(since)에 받은 것만 이 멈춤의 것으로 본다
 */
/**
 * 지워지기 전 판에서 받은 범위(FA1) — 엔진이 적었으면(E31 lastRestore.mass.folder · sub) 그것, 아니면 이 창이 보낸 것(sent = { beforeId, folder, at },
 * 그 뒤에 끝난 결과만). 바뀐 폴더 모두면 null, 한 폴더면 그 경로, 모르면 undefined
 */
export function massGot(mass, at, sent) {
  if (!mass) return undefined;
  if (Object.prototype.hasOwnProperty.call(mass, 'folder')) return typeof mass.folder === 'string' && mass.folder ? mass.folder : null;
  if (sent && sent.beforeId === mass.beforeId && Number.isFinite(sent.at) && ms(at) !== null && ms(at) >= sent.at) return typeof sent.folder === 'string' && sent.folder ? sent.folder : null;
  return undefined;
}
export function massOf(s, sent = null, gotMem = null) {
  const m = s?.massHold;
  if (!m || typeof m !== 'object') return null;
  const kind = m.kind === 'changed' ? 'changed' : m.kind === 'bytes' ? 'bytes' : 'removed';
  const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0), opt = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
  const folders = (Array.isArray(m.folders) ? m.folders : []).filter((f) => f && typeof f.path === 'string' && f.path && (n(f.removed) || n(f.changed)))
    .map((f) => ({ path: f.path, removed: n(f.removed), changed: n(f.changed) }));
  const list = (Array.isArray(m.list) ? m.list : []).filter((x) => x && typeof x.name === 'string' && x.name)
    .map((x) => ({ folder: typeof x.folder === 'string' && x.folder ? x.folder : null, name: x.name, kind: x.kind === 'changed' ? 'changed' : 'removed' }));
  const last = s.lastRestore, since = ms(m.since);
  const mine = last?.mass && typeof m.beforeId === 'string' && last.mass.beforeId === m.beforeId && ms(last.at) !== null && (since === null || ms(last.at) >= since);
  const removed = n(m.removed), changed = n(m.changed);
  // 「지워진 파일 보기」 — 목록에는 지워진 것과 바뀐 것이 함께 있다
  const listLabel = removed && changed ? `지워지거나 바뀐 파일 ${count(removed + changed)}개 보기` : kind === 'changed' ? `바뀐 파일 ${count(changed)}개 보기` : `지워진 파일 ${count(removed)}개 보기`;
  // 받은 범위 — all(바뀐 폴더 모두) · one(한 폴더나 그 안쪽만) · unknown(엔진도 이 창도 모름)
  const got = mine ? massGot(last.mass, last.at, sent) : undefined, sub = mine && typeof last.mass.sub === 'string' && last.mass.sub;
  // 이 멈춤에서 지금까지 받은 폴더 — 창이 결과마다 모아 둔 것(gotMem)과 이번 결과. 바뀐 폴더를 하나씩 다 받아도 「다 받음」이 된다(다시 검수 -b 2)
  const mem = gotMem && gotMem.beforeId === m.beforeId ? gotMem : null;
  const have = [...(Array.isArray(mem?.folders) ? mem.folders : []), ...(typeof got === 'string' && !sub ? [got] : [])];
  const all = (got === null && !sub) || mem?.all === true || (folders.length > 0 && folders.every((f) => have.some((p) => samePath(p, f.path))));
  const scope = !mine ? null : all ? 'all' : have.length || typeof got === 'string' ? 'one' : 'unknown';
  const missing = scope === 'one' ? folders.filter((f) => !have.some((p) => samePath(p, f.path))).map((f) => f.path) : [];
  const restored = mine ? { ...last, got, scope, missing } : null;
  return { kind, word: kind === 'changed' ? '바뀌기' : '지워지기', path: typeof m.path === 'string' && m.path ? m.path : null, folders, list, restored, listLabel,
    at: m.at, beforeAt: m.beforeAt, removed, changed, removedBytes: n(m.removedBytes), left: opt(m.left), totalNow: opt(m.totalNow), bytesNow: opt(m.bytesNow) };
}
const MASS_TITLE = { removed: '많은 파일이 한꺼번에 지워졌습니다.', changed: '많은 파일의 내용이 한꺼번에 바뀌었습니다.', bytes: '큰 파일이 한꺼번에 지워졌습니다.' };
/** 되살릴 자리 글 — 기본 자리(다운로드 아래)면 그 이름, 고르는 자리면 고르는 창이 뜬다는 글. 바꾸는 단추는 hintAct */
function placeHintOf(place) {
  if (place.mode === 'default') return { hint: `되살린 파일은 다운로드 안의 「${place.name}」 폴더에 놓습니다.`, hintAct: { id: 'place-pick', label: '자리 바꾸기' } };
  return { hint: place.unsafe ? '다운로드에는 놓을 수 없어, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : place.guarded ? '다운로드도 지키는 폴더라, 누르면 놓을 폴더를 고르는 창이 뜹니다.' : '누르면 놓을 폴더를 고르는 창이 뜹니다.',
    hintAct: place.guarded ? null : { id: 'place-default', label: '다운로드에 놓기' } };
}
/**
 * 멈춤의 화면 글과 단추 — 기본 화면(home-mass)과 「지워진 파일 보기」(mass-list)가 같이 쓴다. 엔진 메서드는 restoreMassBefore({ place, folder? })와
 * massConfirm()이다. opts.massAsk: 'ok'(「확인을 마침」을 한 번 더 묻는 중) · { folder }(기본 자리로 되살리기를 한 번 더 묻는 중 — folder가 있으면
 * 그 폴더만). 기본 자리에는 폴더 고르는 창이 없어 크기 대신 자리와 범위를 적고 한 번 더 누르게 한다. 고르는 자리면 그 창이 묻는다
 */
export function massModel(s, now = Date.now(), opts = {}) {
  const mh = massOf(s, opts.massSent, opts.massGot);
  if (!mh) return null;
  const device = typeof s.device === 'string' && s.device.trim() ? s.device.trim() : '이 PC';
  const day = (t) => whenKo(t, now).replace(/^(오전|오후)/, '오늘 $1');
  // 「등 N곳」은 이 갈래(지워짐 · 바뀜)의 수가 있는 폴더만 센다 — 되살리기는 둘 다 있는 폴더를 모두 받는다(바뀐 폴더)
  const name = mh.path ? folderName(mh.path) : '', same = mh.folders.filter((f) => (mh.kind === 'changed' ? f.changed : f.removed) > 0).length;
  const where = name ? `「${name}」${same > 1 ? ` 등 ${count(same)}곳` : ''}에서` : '백업한 폴더에서';
  const what = mh.kind === 'changed' ? `${where} 파일 ${count(mh.changed)}개의 내용이 바뀌었습니다.`
    : mh.kind === 'bytes' ? `${where} 파일 ${count(mh.removed)}개가 사라졌습니다. 모두 ${size(mh.removedBytes)}입니다.` : `${where} 파일 ${count(mh.removed)}개가 사라졌습니다.`;
  const between = ms(mh.beforeAt) !== null && ms(mh.at) !== null ? `${day(mh.beforeAt)}부터 ${day(mh.at)} 사이에 ` : '';
  const label = `${mh.word} 전으로 되살리기`;
  const place = restorePlace(s, opts.place, now, opts.sentDefaultAt);
  // 되살리기 단추의 갈래 — 기본 자리는 한 번 더 묻고(massAsk), 고르는 자리는 바로 부른다. 목록 화면의 폴더마다 단추도 이것을 따른다(카본 A2)
  const go = place.mode === 'default' ? { massAsk: 'restore' } : { call: 'restoreMassBefore' };
  const out = { id: 'home-mass', tone: 'bad', stamp: '경고', kick: `${device} · 확인이 필요합니다`, title: MASS_TITLE[mh.kind], here: mh.kind === 'changed' ? '한꺼번에 바뀜' : '한꺼번에 지워짐',
    sub: `${between}${what} 확인하기 전까지 그 전의 판을 지우지 않습니다.`, link: { label: mh.listLabel, to: 'mass-list' }, box: null, notes: [], hint: null, hintAct: null, word: mh.word, label, go };
  const ask = opts.massAsk;
  if (ask === 'ok') {
    // 되살린 뒤의 「확인을 마침」은 「내가 한 일」이 아니어도 누르는 단추다 — 필요한 파일을 옮긴 뒤 누르라고 쓴다(카본 A3)
    const when = mh.restored ? '되살린 파일에서 필요한 것을 다 옮겼을 때 누르세요.' : '내가 한 일이 맞을 때만 누르세요.';
    return { ...out, link: null, box: { title: '확인을 마치면 이전 판을 다시 정리합니다', text: `정리가 다시 돌아 보관 기간이 지난 판부터 지웁니다. 붙들어 둔 ${day(mh.beforeAt)} 판도 그때 지워질 수 있습니다. ${when}` },
      actions: [{ id: 'mass-ok-go', label: '확인을 마침', kind: 'main', call: 'massConfirm' }, { id: 'mass-no', label: '그만두기', kind: 'link' }] };
  }
  const one = ask && typeof ask === 'object' && typeof ask.folder === 'string' ? mh.folders.find((f) => samePath(f.path, ask.folder)) : null;
  if (ask && typeof ask === 'object' && place.mode === 'default' && (one || !ask.folder)) {
    const target = one ? `「${folderName(one.path)}」 폴더를` : mh.folders.length ? `바뀐 폴더 ${count(mh.folders.length)}곳을` : '백업한 폴더를';
    return { ...out, link: null, box: { title: `${target} ${mh.word} 전 판으로 되살릴까요?`, text: `${day(mh.beforeAt)} 판에서 통째로 꺼내 다운로드 안의 「${place.name}」 폴더에 놓습니다. 원래 파일은 그대로 둡니다. 끝날 때까지 다른 일은 기다립니다.` },
      actions: [{ id: 'mass-restore-go', label: '되살리기 시작', kind: 'main', call: 'restoreMassBefore', folder: one ? one.path : null }, { id: 'mass-no', label: '그만두기', kind: 'link' }],
      hintAct: { id: 'place-pick', label: '자리 바꾸기' } };
  }
  // 되살린 뒤 — 결과 줄(되살린 폴더 열기)은 기본 화면의 되살리기 결과 줄이 쓴다. 바뀐 폴더를 다 받은 것을 알 때만 「확인을 마침」이 주 단추다(FA1).
  // 한 폴더만 받았거나 범위를 모르면 되살리기를 주 단추로 두고, 다 받은 뒤 「확인을 마침」을 누르라고 쓴다
  if (mh.restored && mh.restored.scope !== 'all') {
    // 남은 폴더는 두 곳까지 이름으로, 나머지는 「등 N곳」(다시 검수 -c 1). 100만 개를 넘어 지금 받을 수 없는 폴더는 「다 받은 뒤」에서 뺀다(-c 2)
    // 받지 못한 큰 폴더는 지금 실패 칸과, 실패가 지워진 뒤에도 남게 창이 모아 둔 것(massBig)을 합친다(mass -d FA1)
    const now0 = massTooBig(s, opts.massSent), mem = opts.massBig?.beforeId === s.massHold.beforeId && Array.isArray(opts.massBig.folders) ? opts.massBig.folders : [];
    const bigs = [...mem, ...(now0 ? [now0] : [])], isBig = (p) => bigs.some((b) => samePath(b, p));
    const left = mh.restored.missing.filter((p) => !isBig(p)).map(folderName), bigLeft = mh.restored.missing.filter(isBig).map(folderName);
    const names = left.length <= 2 ? `「${left.join('」 · 「')}」 폴더는` : `「${left[0]}」 · 「${left[1]}」 등 ${count(left.length)}곳은`;
    // 남은 것이 큰 폴더뿐이면 전체 되살리기는 그 폴더 때문에 반드시 실패한다 — 그 단추를 두지 않고 「확인을 마침」만 둔다(mass -d FA2)
    if (!left.length && bigLeft.length && mh.restored.scope === 'one') {
      return { ...out, notes: [`「${bigLeft.join('」 · 「')}」 폴더 말고는 다 되살렸습니다. 그 폴더가 필요 없으면 「확인을 마침」을 누르세요.`],
        actions: [{ id: 'mass-done', label: '확인을 마침', kind: 'line', massAsk: 'ok' }] };
    }
    const note = left.length ? `아직 ${names} 되살리지 않았습니다. 다 받은 뒤 「확인을 마침」을 누르세요.` : '바뀐 폴더가 다 왔는지 되살린 폴더에서 확인한 뒤 「확인을 마침」을 누르세요.';
    return { ...out, notes: [note],
      actions: [{ id: 'mass-restore', label, kind: 'main', ...go }, { id: 'mass-done', label: '확인을 마침', kind: 'line', massAsk: 'ok' }], ...placeHintOf(place) };
  }
  if (mh.restored) {
    return { ...out, notes: ['되살린 파일은 새 폴더에 있습니다. 필요한 파일을 원래 자리로 옮긴 뒤 「확인을 마침」을 누르세요.'],
      actions: [{ id: 'mass-done', label: '확인을 마침', kind: 'main', massAsk: 'ok' }, { id: 'mass-restore', label: '다시 되살리기', kind: 'line', ...go }], ...placeHintOf(place) };
  }
  const notes = mh.kind === 'changed'
    ? ['직접 고쳤거나 프로그램으로 한꺼번에 바꿨다면 「내가 한 일이 맞음」을 누르세요.', '모르는 일이면 바뀌기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.']
    : ['직접 지웠거나, 폴더를 옮기거나 이름을 바꿨다면 「내가 한 일이 맞음」을 누르세요.', '모르는 일이면 지워지기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.'];
  return { ...out, notes, actions: [{ id: 'mass-restore', label, kind: 'main', ...go }, { id: 'mass-ok', label: '내가 한 일이 맞음', kind: 'line', massAsk: 'ok' }], ...placeHintOf(place) };
}
/**
 * 멈춘 뒤 100만 개를 넘어 받지 못한 한 폴더 — 실패 칸에 범위가 있으면(E31) 그것, 없으면 이 창이 그 실패보다 먼저 보낸 한 폴더(sent). 모르면 null
 */
export function massTooBig(s, sent) {
  const mh = s?.massHold, e = s?.lastRestoreError;
  if (!mh || e?.code !== 'CATALOG_TOO_LARGE' || ms(e.at) === null) return null;
  const since = ms(mh.since);
  if (since !== null && ms(e.at) < since) return null;
  // 옛 PC 백업 꺼내기의 실패(from)는 멈춤의 실패가 아니다(restoreNote의 old와 같다, mass -d FA3)
  if (typeof e.from === 'string' && e.from) return null;
  // 엔진이 범위를 적었으면(E31, b18e0775b) 그것만 믿는다 — 바뀐 폴더 모두(null)면 어느 폴더가 큰지 모른다. 범위가 없는 옛 엔진만 이 창이 보낸 것으로 가린다
  if (e.mass && typeof e.mass === 'object' && Object.prototype.hasOwnProperty.call(e.mass, 'folder')) return typeof e.mass.folder === 'string' && e.mass.folder ? e.mass.folder : null;
  return sent && sent.beforeId === mh.beforeId && Number.isFinite(sent.at) && ms(e.at) >= sent.at && typeof sent.folder === 'string' && sent.folder ? sent.folder : null;
}
/** 멈춤이 있는 동안 끝난 되살리기의 실패 글 — 실패 칸에는 어느 되살리기였는지가 없어(lastRestoreError) 멈춤의 말로 쓴다 */
export function massFailText(code, mh, folder = null) {
  if (code === 'CATALOG_TOO_LARGE' && typeof folder === 'string' && folder) return `「${folderName(folder)}」 폴더는 파일과 폴더가 100만 개를 넘어 통째로 받을 수 없습니다. 안쪽 폴더만 꺼내는 길은 다음 업데이트에서 엽니다.`;
  if (code === 'CATALOG_TOO_LARGE') return mh?.folders?.length > 1 ? `100만 개가 넘는 폴더가 있습니다. 「${mh.listLabel}」에서 폴더마다 되살려 주세요.`
    : '파일과 폴더가 100만 개를 넘습니다. 안쪽 폴더만 꺼내는 길은 다음 업데이트에서 엽니다.';
  if (code === 'NO_SNAPSHOT') return '붙들어 둔 판을 찾지 못했습니다. 「파일 되살리기」에서 남은 판을 확인해 주세요.';
  return null;
}

/**
 * 이 백업에 담지 못하는 이름(설계 4.2 — 엔진 leftOutNames, b18e0775b). 이름 끝이 점(.)이나 빈칸인 파일과 폴더는 Windows에서
 * 백업할 수 없어 판에서 빠진다. names는 Windows 경로 1,000개(모두 32,768자)까지, count는 전체 수(cut이면 그 이상), checked가 false면 그 백업의 걷기가 폴더를 다 보지 못했다
 */
export function leftOutOf(s) {
  const x = s?.leftOutNames;
  if (!x || typeof x !== 'object') return null;
  const names = (Array.isArray(x.names) ? x.names : []).filter((p) => typeof p === 'string' && p).slice(0, 1000);
  const n = Number.isSafeInteger(x.count) && x.count >= 0 ? Math.max(x.count, names.length) : names.length;
  return { at: x.at, count: n, names, cut: x.cut === true, checked: x.checked !== false };
}
/** 「3개는」 · 「1,000개 이상은」 */
export function leftOutCountKo(lo, pair = '은/는') { const w = `${count(lo.count)}개${lo.cut ? ' 이상' : ''}`; return `${w}${josa(w, pair).slice(w.length)}`; }
/** 경로의 마지막 이름과 그 위 폴더 — 끝의 점이나 빈칸이 보이게 이름은 「」로 감싼다 */
export function leftOutName(p) {
  const parts = String(p).split('\\'), name = parts.pop() || String(p);
  return { name, where: parts.join(' › ') };
}
const LEFT_LINK = { label: '어떤 파일인지 보기', to: 'left-out' };
/** 수는 알지만 이름을 아직 알아내지 못한 몫 — 기본 화면 줄과 목록이 같은 말을 쓴다 */
export const UNNAMED = '이름은 아직 알아내지 못했습니다. 폴더를 다 보는 다음 백업에서 이름이 나옵니다.';
/**
 * 담지 못한 이름보다 먼저 서는 주의 화면 가운데 이 PC가 백업을 맡는 것 — 회차의 하루 한 번 알림(주제 status)이 기본 화면을 여니,
 * 그 화면에도 한 줄과 「어떤 파일인지 보기」를 둔다(Opus 대체 검수 F1). 넘긴 PC · 되살리기만 하는 PC · 되돌리기 중은 뺀다
 */
const LEFT_ALSO = new Set(['home-off', 'home-paused', 'home-readkey', 'home-writekey', 'home-missing', 'home-probe', 'home-mass', 'home-restore-error', 'home-health', 'home-error', 'home-overdue', 'home-credential', 'home-startup']);

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
  // 이 PC에 앞서 깔았던 연결(sameInstall)은 「이 PC」로 부른다 — 다시 깐 PC가 제 옛 연결을 남의 기기로 읽지 않게.
  // 계정 상태의 목록(account.sameInstall) 말고, 기기가 다 찼을 때의 목록은 줄마다 sameInstall: true를 준다(화면 요청 15, 개통 서버 ecbb3f91d)
  const earlier = !d?.current && (d?.sameInstall === true || sameOf(same).includes(d?.id));
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
  if (m.id === 'start') return m;
  // 넘긴 뒤 「프로그램과 설정」 한 줄 — 첫 백업이 도는 동안에도 둔다(E19). 되살리기 결과 줄이 있으면 그것이 먼저다
  const apps = movedAppsNote(state, opts.move, opts.checks, now);
  if (m.id === 'home-run') return apps ? { ...m, restored: apps } : m;
  const st = state && typeof state === 'object' ? state : {};
  // 담지 못한 이름(home-leftout)도 매시간 도는 안전 갈래다 — 되돌리기 뒤 줄에서 안전 · 부분 판과 같게 다룬다(카본 A1)
  const running = m.id === 'home' || m.id === 'home-partial' || m.id === 'home-leftout';
  const note = restoreNote(st, now, m.id === 'home-restore-error', opts.massSent), ended = endedNote(st, now, running);
  // 되살리기 결과 줄과 끝난 되돌리기 줄이 함께 있으면 더 새것을 쓴다
  const restored = (note && ended ? (ended.at >= note.at ? ended : note) : note || ended) || undoNote(state, m.id === 'home' || m.id === 'home-leftout', opts.undoSeen);
  // 한꺼번에 지워짐에서 되살리기가 실패했으면 그 줄이 할 일을 말한다 — 되살리기 안내 줄(둘째)은 빼서 두 단추를 첫 화면에 남긴다
  // (이 갈래도 아래 담지 못한 이름의 고리를 거친다 — 다시 검수 -b 2)
  const out = restored && m.id === 'home-mass' && restored.mass && m.notes.length > 1 ? { ...m, notes: m.notes.slice(0, 1), restored }
    : restored ? { ...m, restored } : apps ? { ...m, restored: apps } : m;
  // 담지 못한 이름이 있는데 다른 주의가 먼저 서면 그 화면에도 고리를 둔다(LEFT_ALSO). 고리 이름이 무엇인지 말하게 해 줄을 따로 두지 않는다 —
  // 상자가 있는 주의 화면도 760×640에서 주 단추가 첫 화면에 남는다. 원래 고리가 있으면 같은 줄에 잇고, 한 번 더 묻는 상자가 열린 동안은 두지 않는다
  const lo = leftOutOf(st);
  if (lo && lo.count > 0 && LEFT_ALSO.has(out.id) && !(out.id === 'home-mass' && out.box)) {
    // 수는 파일과 폴더를 함께 센 이름 수다 — 목록 화면(「이 백업에 담지 못한 이름」)과 같은 말로 부른다(다시 검수 -b 1)
    const mine = { label: `백업에 담지 못한 이름 ${count(lo.count)}개${lo.cut ? ' 이상' : ''} 보기`, to: 'left-out' };
    return { ...out, link: out.link || mine, links: [...(out.links || (out.link ? [out.link] : [])), mine] };
  }
  return out;
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
/** 되살리다 멈춘 폴더(엔진 lastRestoreError.path) — 그 안의 파일은 다 확인하지 못했다. 단추(「만들다 만 폴더 열기」)와 같은 이름으로 부른다(Fable F3) */
const leftover = (e) => (typeof e?.path === 'string' && baseName(e.path) ? ` 만들다 만 폴더 「${baseName(e.path)}」의 파일은 다 확인하지 못했으니 쓰지 말고 지워 주세요.` : '');
/** 만들다 만 폴더 열기(E29 — openRestoreFolder · openSelectedRestoreFolder의 unfinished). 엔진이 적어 둔 폴더(path)가 있을 때만 */
const leftOpen = (e, selected) => (typeof e?.path === 'string' && e.path
  ? (selected ? { id: 'open-left-sel', label: '만들다 만 폴더 열기', kind: 'link', call: 'openSelectedRestoreFolder', withProfile: true, extra: { unfinished: true } }
    : { id: 'open-left', label: '만들다 만 폴더 열기', kind: 'link', call: 'openRestoreFolder', arg: { unfinished: true } })
  : undefined);
/** 옛 PC 판을 받다 거절된 줄(안쪽 폴더나 다른 자리를 고르라는 글)에서 그 화면으로 돌아가는 길. 만들다 만 폴더가 있으면 그 폴더 열기가 먼저다 */
const OLD_AGAIN = { id: 'old-start', label: '옛 PC 백업에서 꺼내기', kind: 'link' };
/** 그만둔 되살리기(요청 16)의 만들다 만 폴더 — 그 안의 파일은 끝까지 확인하지 않았다 */
// 기본 자리의 이름은 「되살린 파일 (11월 13일)」처럼 괄호로 끝난다 — 조사는 괄호를 뗀 끝 글자로 고른다
const keptOf = (e) => { const b = typeof e?.path === 'string' ? baseName(e.path) : '', w = b.replace(/[)\]\s]+$/, '') || b; return b ? ` 만들다 만 폴더 「${b}」${josa(w, '은/는').slice(w.length)} 그대로 두었습니다. 그 안의 파일은 다 확인하지 못했으니 쓰지 말고 지워 주세요.` : ''; };
/** 다운로드 아래 기본 자리에 만든 폴더면 그 이름(「되살린 파일 (11월 16일) 2」)을 쓴다 — 고른 자리의 엔진 이름은 쓰지 않는다 */
const madeIn = (r) => { const b = baseName(r?.path); return /^되살린 파일 \(\d{1,2}월 \d{1,2}일\)( \d{1,2})?$/.test(b) ? `「${b}」에 ` : ''; };
/** 하루 안에 실패한 전체 되살리기(그 뒤에 성공한 것이 없을 때) */
function fullRestoreError(s, now) {
  const e = s.lastRestoreError, full = s.lastRestore;
  return recentOf(e, now) && typeof e.code === 'string' && (!full || !(ms(full.at) > ms(e.at))) ? e : null;
}
function restoreNote(s, now, skipFull = false, sent = null) {
  const recent = (x) => recentOf(x, now);
  const sel = s.lastSelectedRestore, full = s.lastRestore, err = s.lastSelectedRestoreError;
  const items = [];
  const fullErr = fullRestoreError(s, now);
  // 옛 PC 판을 받다 멈추거나 실패했으면 실패 칸에 from이 실린다(E26 알림 · restoreScope). 만들다 만 폴더는 열어 지울 수 있다(E29)
  if (fullErr && !skipFull) {
    const when = whenKo(fullErr.at, now), old = typeof fullErr.from === 'string' && fullErr.from, act = leftOpen(fullErr, false) || (old ? OLD_AGAIN : undefined);
    // 멈춤이 있는 동안에는 지워지기 전 판에서 받다 멈춘 것일 수 있다 — 실패 칸에 어느 되살리기였는지가 없어 「전체」라 하지 않는다
    const mh0 = old ? null : massOf(s), since = mh0 ? ms(s.massHold.since) : null;
    const mh = mh0 && (since === null || ms(fullErr.at) >= since) ? mh0 : null;
    // 실패 칸에 범위가 있으면(E31) 그것, 없으면 이 창이 그 뒤에 보낸 한 폴더(FA5)
    const failFolder = mh && fullErr.code === 'CATALOG_TOO_LARGE' ? massTooBig(s, sent) : null;
    items.push(fullErr.code === 'CANCELED' ? { at: ms(fullErr.at), text: `${when}에 ${old ? '옛 PC 백업 꺼내기' : mh ? '되살리기' : '전체 되살리기'}를 그만두었습니다.${keptOf(fullErr)}`, act }
      : old ? { at: ms(fullErr.at), bad: true, text: `${when}에 옛 PC 백업에서 폴더를 꺼내지 못했습니다. ${scopeFailText(fullErr.code) || failureText(fullErr.code)}${leftover(fullErr)}`, act }
      : mh ? { at: ms(fullErr.at), bad: true, mass: true, text: `${when}에 되살리기를 마치지 못했습니다. ${massFailText(fullErr.code, mh, failFolder) || failureText(fullErr.code)}${leftover(fullErr)}`, act }
      : { at: ms(fullErr.at), bad: true, text: `${when}에 전체를 되살리지 못했습니다. ${failureText(fullErr.code)}${leftover(fullErr)}`, act });
  }
  if (recent(err) && (!sel || ms(err.at) > ms(sel.at))) {
    const when = whenKo(err.at, now), old = typeof err.from === 'string' && err.from, act = leftOpen(err, true) || (old ? OLD_AGAIN : undefined);
    items.push(err.code === 'CANCELED' ? { at: ms(err.at), text: `${when}에 ${old ? '옛 PC 백업에서 고른 파일 꺼내기' : '고른 파일 되살리기'}를 그만두었습니다.${keptOf(err)}`, act }
      : { at: ms(err.at), bad: true, text: `${when}에 ${old ? '옛 PC 백업에서 고른 파일을 꺼내지' : '고른 파일을 되살리지'} 못했습니다. ${(old && err.code === 'OUTPUT_UNSAFE' && scopeFailText(err.code)) || failureText(err.code)}`, act });
  }
  if (recent(sel)) items.push({ at: ms(sel.at), text: `${whenKo(sel.at, now)}에 고른 파일 ${count(sel.files)}개를 ${madeIn(sel)}되살렸습니다.`, act: { id: 'open-selected', label: '되살린 폴더 열기', kind: 'link', call: 'openSelectedRestoreFolder', withProfile: true } });
  // 엔진은 연결점 · 링크 · 특수 파일 · Windows가 담지 못하는 이름은 만들지 않고 그 수만 센다(lastRestore.skipped, 조율 세션 74a22589a)
  const skipped = Number(full?.skipped) > 0 ? Number(full.skipped) : 0;
  // 범위를 통째로 받은 것(restoreScope — lastRestore.scope { from, folder, sub })은 그 범위를 말한다
  const scope = full?.scope && typeof full.scope.folder === 'string' ? full.scope : null;
  // 지워지기 전 판에서 받은 것(restoreMassBefore — lastRestore.mass { beforeId, beforeAt })은 그 판을 말한다
  // 받은 범위를 알면 그 범위를(FA1), 모르면 범위 없이 쓴다. 판의 폴더를 가르지 못한 멈춤은 모든 폴더를 받는다
  const massAt = full?.mass && ms(full.mass.beforeAt) !== null ? full.mass.beforeAt : null;
  const got = massAt ? massGot(full.mass, full.at, sent) : undefined, held = massAt ? massOf(s) : null;
  const massWhat = typeof got === 'string' ? `「${folderName(got)}」 폴더를 ${madeIn(full)}통째로 되살렸습니다.`
    : got === null ? `${held && !held.folders.length ? '백업한' : '바뀐'} 폴더를 ${madeIn(full)}통째로 되살렸습니다.` : `${madeIn(full)}되살렸습니다.`;
  const what = massAt ? `${whenKo(massAt, now)} 판에서 ${massWhat}`
    : scope ? `${scope.from ? '옛 PC 백업의 ' : ''}${oldWhere(folderName(scope.folder), scope.sub)} 폴더를 ${madeIn(full)}통째로 꺼냈습니다.` : `가장 최근 판 전체를 ${madeIn(full)}되살렸습니다.`;
  if (recent(full)) items.push({ at: ms(full.at), text: `${whenKo(full.at, now)}에 ${what}${skipped ? ` ${count(skipped)}개는 만들지 않고 건너뛰었습니다. 다른 곳을 가리키는 연결, 특수 파일, Windows에서 쓸 수 없는 이름입니다.` : ''}`, act: { id: 'open-full', label: '되살린 폴더 열기', kind: 'link', call: 'openRestoreFolder' } });
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

  // 지금 프로필이 로컬이어도 계정 프로필(b2)의 옮겨 오기는 도는 작업이다(카본 A4)
  const job = s.job || moveJob(s);
  if (job) {
    const name = jobName(job), percent = pct(job);
    const restoring = job.kind === 'restore' || job.kind === 'restore-selected';
    const stopping = restoring && job.cancelled === true, canStop = restoring && !stopping && job.final !== true;
    const [title, said] = stopping ? ['되살리기를 그만두는 중입니다.', '곧 멈춥니다. 그때까지 만든 폴더는 그대로 둡니다.'] : job.scheduled ? ['지금 백업하고 있습니다.', null] : jobSay(job);
    // 첫 백업 전(설정 전에 도는 보호 준비 등)에는 되살릴 것도, 옮겨 올 것도, 증거도 아직 없다
    const ready = !!s.configured && !!s.lastBackup;
    return { ...base, id: 'home-run', tone: 'run', kick: stopping ? `${device} · 되살리기 그만두는 중` : `${device} · ${name} 도는 중`, title,
      sub: said ?? (s.lastBackup?.at ? `창을 닫아도 계속됩니다. 끝나기 전까지 가장 최근 판은 ${whenKo(s.lastBackup.at, now)} 판입니다.` : '창을 닫아도 계속됩니다. 끝나면 알림으로 알려 드립니다.'),
      // 옮겨 오기는 그 화면(move-2)에서 본다 — 도는 동안 다른 일은 엔진이 받지 않는다
      actions: job.kind === 'move' ? [{ id: 'move-see', label: '진행 보기', kind: 'main', to: 'move-2' }]
        : canStop ? [{ id: 'restore-stop', label: '되살리기 그만두기', kind: 'line', call: 'cancelRestore' }] : restoring || !ready ? [] : [RESTORE, MOVE],
      hint: canStop ? '잘못 골랐다면 그만둘 수 있습니다. 그때까지 만든 폴더는 그대로 둡니다.' : job.scheduled && ready ? `파일 되살리기는 지금 누르면 ${josa(name, '이/가')} 끝나는 대로 이어서 엽니다.` : null,
      progress: { label: name, stage: stageWord(job), percent },
      evidence: s.configured ? { ...evidence(s, now), run: { label: `${name} · ${stageWord(job)}`, percent } } : null };
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
        actions: [picked.length ? { id: 'continue', label: '이어서 백업', kind: 'main', call: 'continueBackup', account: true, take: true } : { id: 'pick', label: '지킬 폴더 고르기', kind: 'main', call: 'chooseSources', onAccountProfile: true, take: true },
          ...(picked.length ? [{ id: 'pick', label: '폴더 다시 고르기', kind: 'link', call: 'chooseSources', onAccountProfile: true }] : []), { ...RESTORE, kind: 'line' }],
        evidence: evidence(s, now, { state: 'moved' }) };
    }
    // 옮겨 오기의 지금(moveState — 창이 읽어 opts.move로 넘긴다, 설계 검토 권고 3): 멈춘 옮겨 오기는 이어서 하게, 끝났고
    // 「끊지 않기」를 고르지 않았으면 넘기기로 이끈다. 쓰는 기기가 되면(mode backup) 아무 줄도 두지 않는다
    const mvs = opts?.move || null;
    if (s.mode === 'restore' && a?.connected && a.role === 'read' && mvs && !moveJob(s)) {
      const step = { box: a.googleStepRequired ? GOOGLE_STEP : null, googleStep: !!a.googleStepRequired };
      if (mvs.unfinished) {
        return { ...base, ...step, id: 'home-move-stopped', tone: 'warn', stamp: '멈춤', kick: `${device} · 옮겨 오기 멈춤`, title: '옮겨 오기가 중간에 멈췄습니다.', sub: moveStopText(s, mvs),
          // 파일을 놓기 전에 공간이나 목록 때문에 멈췄으면 같은 자리로는 또 멈춘다 — 자리를 다시 고르게 한다(E9 GA1)
          actions: [moveRechoose(s, mvs) ? { id: 'move-in', label: '자리 다시 고르기', kind: 'main', to: 'move-1' } : { id: 'move-resume', label: '이어서 옮겨 오기', kind: 'main', flow: 'moveResume' },
            { ...RESTORE, kind: 'line' }, { id: 'move-quit', label: '그만두고 이 PC로 이어서 백업', kind: 'link', to: 'move-4', take: true }],
          evidence: evidence(s, now, { state: 'moved' }) };
      }
      if (mvs.resultAt && !mvs.released) {
        // 결과를 읽어 두었으면 제목도 확인서의 큰 글과 같게 쓴다 — 놓은 파일 없이 실패만 있으면 「옮겨 오지 못했습니다.」(Opus -c 참고)
        const title = opts?.result && mvs.complete !== true ? moveTitle(opts.result).main : '옮겨 왔습니다.';
        return { ...base, ...step, id: 'home-move-done', tone: 'moved', stamp: '옮김', kick: `${device} · 옮겨 오기 끝`, title,
          sub: mvs.complete === true ? '이 PC로 이어서 백업하면 옛 PC는 그때부터 백업하지 않습니다. 그때까지 이 PC는 파일을 되살리기만 합니다.' : moveDoneLeftText(opts?.result),
          actions: [{ id: 'move-next', label: '이 PC로 이어서 백업', kind: 'main', to: 'move-4', take: true }, { id: 'move-result', label: '결과 보기', kind: 'line', to: 'move-3' },
            ...(moveBigFolders(opts?.result).length ? [{ id: 'old-start', label: '옛 PC 백업에서 꺼내기', kind: 'link' }] : []), { ...RESTORE, kind: 'link' }],
          evidence: evidence(s, now, { state: 'moved' }) };
      }
    }
    // 다른 PC가 쓰는 계정의 백업을 연 PC(옮겨 오기의 앞 걸음, 또는 「이 PC에서 이어서 백업」이 쓰는 자리를 옮기기 전에 멈춘 PC)
    if (s.mode === 'restore' && a?.connected && a.role === 'read') {
      const writer = writerName(s);
      return { ...base, id: 'home-restore-read', tone: 'moved', stamp: '옮김', kick: `${device} · 되살리기만 하는 연결`, title: '이 PC는 파일을 되살리기만 합니다.',
        sub: `이 계정의 백업은 ${writer ? `「${writer}」${josa(writer, '이/가').slice(writer.length)}` : '다른 PC가'} 하고 있습니다. 새 PC로 바꾸셨다면 옛 PC의 백업을 이 PC로 옮겨 올 수 있습니다.`,
        box: a.googleStepRequired ? GOOGLE_STEP : null, googleStep: !!a.googleStepRequired,
        actions: [RESTORE, { id: 'move-in', label: '이 PC로 옮겨 오기', kind: 'line', to: 'move-1' },
          picked.length ? { id: 'take-go', label: '되살리지 않고 이 PC에서 이어서 백업', kind: 'link', flow: 'takeOver', account: true, google: true, take: true } : { id: 'pick', label: '이 PC에서 백업할 폴더 고르기', kind: 'link', call: 'chooseSources', onAccountProfile: true, take: true },
          ...(picked.length ? [{ id: 'pick', label: '폴더 다시 고르기', kind: 'link', call: 'chooseSources', onAccountProfile: true }] : [])],
        hint: `이 PC에서 이어서 백업하면 ${writer ? `「${writer}」${josa(writer, '은/는').slice(writer.length)}` : '그 PC는'} 그때부터 백업하지 않습니다.`,
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

  // 한꺼번에 지워지거나 바뀜(설계 4.4 — 엔진 massHold, 조율 세션 9ddcbeb40). 붙들어 둔 판은 사람이 「확인을 마침」을 누를 때까지 남는다
  const mass = massModel(s, now, opts);
  if (mass) return { ...base, ...mass, evidence: evidence(s, now, { state: 'mass' }) };

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
  // 손님이 그만둔 되살리기(CANCELED, 요청 16)는 실패가 아니다 — 앞선 실패의 점검 주의가 남아 있어도 이 갈래로 들이지 않는다(Fable F1).
  // 그때는 일반 점검 주의 화면에 「전체 되살리기를 그만두었습니다」 줄이 붙는다
  if (reason === 'health' && rErr && rErr.code !== 'CANCELED' && hAt !== null && Math.abs(ms(rErr.at) - hAt) <= 10 * MINUTE) {
    const oldErr = typeof rErr.from === 'string' && rErr.from, open = leftOpen(rErr, false);
    return { ...base, id: 'home-restore-error', tone: 'warn', stamp: '주의', kick: `${device} · 되살리기를 마치지 못함`, title: oldErr ? '옛 PC 백업에서 폴더를 꺼내지 못했습니다.' : '파일을 되살리지 못했습니다.',
      sub: `${(oldErr && scopeFailText(rErr.code)) || failureText(rErr.code)} 원래 파일과 백업은 그대로입니다.${leftover(rErr)}`,
      box: { title: '전체 점검을 마칠 때까지 지난 판을 지우지 않습니다', text: '되살리기를 마치지 못한 뒤라, 한 번 전체 점검을 마칠 때까지는 지난 판을 정리하지 않고 둡니다.' },
      actions: [oldErr ? { id: 'old-start', label: '옛 PC 백업에서 다시 꺼내기', kind: 'main' } : { ...RESTORE, label: '다시 되살리기' }, { id: 'check', label: '전체 점검', kind: 'line', call: 'checkRepository' }, ...(open ? [open] : [])], evidence: evidence(s, now) };
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
  // 이름 때문에 담지 못한 파일(설계 4.2 — leftOutNames)이 있으면 「안전합니다」 대신 주의로 쓴다. 판은 온전하고 보호 수준도 그대로다.
  // 쓰는 중인 파일과 함께 있으면 둘 다 쓴다(조율 세션 부탁 · GPT 검수 workbackup-oddnames-20261120 GA1)
  const lo = leftOutOf(s);
  if (lo && lo.count > 0) {
    const notes = lo.names.slice(0, 2).map((p) => { const x = leftOutName(p); return `「${x.name}」${x.where ? ` · ${x.where}` : ''}`; });
    // 엔진이 수는 세었지만 이름은 모를 수 있다(이름 보관을 못 읽은 뒤 걷기가 덜 끝남 — names 빈 목록). 그때는 「외」가 아니라 그렇다고 쓴다(Opus 대체 검수 F1)
    if (!notes.length) notes.push(UNNAMED);
    else if (lo.count > notes.length) notes.push(`외 ${count(lo.count - notes.length)}개${lo.cut ? ' 이상' : ''}`);
    // 이름을 모르면 목록 화면에는 까닭과 고치는 법만 있다 — 고리도 그 말로 부른다(다시 검수 -b)
    const own = lo.names.length ? LEFT_LINK : { label: '자세히 보기', to: 'left-out' }, links = [own];
    if (partial) {
      const pn = count(partial.unreadable) + (partial.cut ? '개 넘게' : '개'), who = typeof partial.program === 'string' && partial.program ? partial.program : null;
      const holder = who ? `${josa(who, '이/가')} 쓰는 중인` : '다른 프로그램이 쓰는 중인', firstOnly = !s.lastBackup || s.lastBackup.id === partial.id;
      notes.push(firstOnly ? `${holder} 파일 ${pn}는 아직 어느 판에도 없습니다. 그 프로그램을 닫으면 다음 확인 때 담깁니다.` : `${holder} 파일 ${pn}는 앞 판으로 지킵니다.`);
      links.push({ label: '쓰는 중인 파일 보기', to: s.admin === false ? 'partial-std' : 'partial' });
    }
    return { ...base, id: 'home-leftout', tone: 'warn', stamp: '주의', kick: `${device} · 매시간 저절로 지키는 중`, title: '이름 때문에 담지 못한 파일이 있습니다.',
      sub: `이름 끝에 점(.)이나 빈칸이 있는 파일이나 폴더 ${leftOutCountKo(lo)} Windows에서 백업할 수 없습니다. 이름을 바꾸면 다음 백업에 담깁니다.`,
      // 쓰는 중인 파일은 위 줄에 있으니 확인서의 「쓰는 중이라 앞 판으로」 줄은 두지 않는다 — 760×640에서 주 단추를 첫 화면에 남긴다(Opus 대체 검수 F3)
      notes, link: own, links, actions: [RESTORE, MOVE], evidence: evidence(s, now, { state: 'ok' }) };
  }
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

/* ── 새 PC로 옮겨 오기(조율 세션 d32d25233 · 옮겨 오기 상태 moveState와 결과의 뿌리 folders[].roots) ── */
const MOVE_BASE = '옮겨 온 자료', MOVE_SIDE = '따로 둔 것';
const lowPath = (p) => String(p || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
/** p가 root이거나 그 아래인지(대소문자와 끝의 \ 는 보지 않는다) */
export function pathIn(p, root) { const a = lowPath(p), b = lowPath(root); return !!b && (a === b || a.startsWith(`${b}\\`)); }
const letterOf = (d) => String(d?.letter ?? d ?? '').replace(/[:\\]+$/, '').toUpperCase();

/** 옮겨 오기 작업 — 계정 프로필(b2)의 것만 본다. 지금 프로필이 로컬이면 맨 위 job은 로컬 것이다(Fable F5) */
export function moveJob(s) {
  const j = !s?.profiles?.b2 || s.profile === 'b2' ? s?.job : s.profiles.b2.job;
  return j && j.kind === 'move' ? j : null;
}
/** 옮겨 오기를 여는 PC — 계정의 백업을 되살리기 전용으로 연 PC(새 PC). 쓰는 PC의 「옛 PC 백업에서 꺼내기」는 다음 증분이다 */
export function moveOpen(s) { return !!(s?.configured && s.mode === 'restore' && s.account?.connected); }

/**
 * 폴더 하나가 놓일 곳(movePreview folders[]의 한 줄과 그 고름). 갈래는 why가 아니라 실제 자리로 정한다(Fable F3):
 * 원래 자리 규칙의 자리(destination)가 「옮겨 온 자료」 아래면 그 아래, 그 안의 「따로 둔 것」이면 따로 둔 곳, 아니면 이 PC의 같은 자리다.
 * 「같은 드라이브에 그대로」는 미리 보기의 destination에 들어 있지 않으므로 옛 경로 그대로다.
 */
export function movePlace(f, choice = {}) {
  const mode = choice?.mode || f?.mode || 'original';
  if (mode === 'skip') return { kind: 'skip', path: null };
  if (mode === 'newFolder') return { kind: 'newFolder', path: f?.newFolder || null };
  if (mode === 'oneDriveGaps') return { kind: 'oneDrive', path: f?.newFolder || null };
  if (choice?.sameDrive && f?.sameDrive) return { kind: 'sameDrive', path: f.original, drive: letterOf(f.sameDrive) };
  // 원래 자리 규칙이 「따로 둔 것」으로 보내는지는 엔진이 준다(E3 side — 고른 갈래와 상관없이 원래 자리 규칙의 것이다). 없으면 경로로 가른다
  const parts = lowPath(f?.destination).split('\\'), at = parts.indexOf(MOVE_BASE);
  const side = typeof f?.side === 'boolean' ? f.side : at >= 0 && parts[at + 1] === MOVE_SIDE;
  return { kind: side ? 'side' : at < 0 ? 'same' : 'moved', path: f?.destination || null };
}
const PLACE_KO = { same: '이 PC의 같은 자리', moved: '「옮겨 온 자료」 아래', side: '「따로 둔 것」 아래', newFolder: '새 폴더', oneDrive: 'OneDrive에 없는 것만 새 폴더로', skip: '옮기지 않음' };
export function placeKo(p) { return p?.kind === 'sameDrive' ? `${p.drive} 드라이브의 같은 자리` : PLACE_KO[p?.kind] || ''; }

/** 그 자리로 가는 까닭 한 줄 — 동기화 폴더는 OneDrive만이 아니다(Fable F13). 경로가 다 말하는 자리는 빈 글 */
export function moveWhy(f, choice, place = movePlace(f, choice)) {
  if (place.kind === 'skip') return '';
  // 동기화 종류는 엔진이 준다(E3 oldSync · newSync — 'oneDrive' · 'other' · null). 옛 판의 미리 보기면 why만으로 쓴다
  const sync = (k) => (k === 'oneDrive' ? 'OneDrive' : k === 'other' ? '동기화 폴더(Dropbox나 Google Drive 같은)' : '동기화 폴더');
  // 같은 OneDrive 계정이면 온라인에만 있던 파일도 OneDrive에서 온다 — 「일부만」보다 이 글이 먼저다
  if (place.kind === 'oneDrive') return '같은 OneDrive 계정이라, OneDrive에 없거나 내용이 다른 파일만 새 폴더에 받습니다.';
  if (f?.why === 'old-synced' || f?.partial) {
    return f?.partial || f?.oldSync === 'oneDrive'
      ? '옛 PC에서 OneDrive 안이던 폴더라 일부만 올 수 있습니다. 온라인에만 있던 파일은 백업에 없으니, 같은 계정으로 OneDrive에 로그인해 받으세요.'
      : `옛 PC에서 ${sync(f?.oldSync)} 안이던 폴더입니다. 온라인에만 있던 파일은 백업에 없으니, 같은 계정으로 그 서비스에 로그인해 받으세요.`;
  }
  if (f?.why === 'new-synced' && place.kind === 'newFolder') return `이 PC의 그 폴더가 ${sync(f?.newSync)} 안이라, ${f?.newSync === 'oneDrive' ? 'OneDrive' : '동기화 폴더'} 밖 새 폴더에 받습니다.`;
  if (f?.why === 'new-synced') return `${sync(f?.newSync)} 안에 놓습니다. 옮겨 올 양이 그 서비스의 남은 공간을 넘으면 동기화가 멈출 수 있습니다.`;
  if (place.kind === 'side') return '이 PC에서 프로그램이 쓰는 자리라, 저절로 실행되지 않게 따로 둡니다.';
  return '';
}

/** 폴더마다 고를 수 있는 자리(펼쳤을 때) — 「원래 자리」라는 이름은 실제로 같은 자리일 때만 맞으므로 자리 이름을 쓴다(Fable F3) */
export function moveModes(f) {
  const modes = Array.isArray(f?.modes) ? f.modes : ['original', 'skip'], out = [];
  for (const m of modes) {
    if (m === 'original') {
      out.push({ id: 'original', label: placeKo(movePlace(f, { mode: 'original' })), choice: { mode: 'original' } });
      if (f.sameDrive) out.push({ id: 'sameDrive', label: `${letterOf(f.sameDrive)} 드라이브의 같은 자리`, choice: { mode: 'original', sameDrive: true } });
    } else if (m === 'newFolder') out.push({ id: 'newFolder', label: '새 폴더', choice: { mode: 'newFolder' } });
    else if (m === 'oneDriveGaps') out.push({ id: 'oneDriveGaps', label: 'OneDrive에 없는 것만', choice: { mode: 'oneDriveGaps' } });
    else if (m === 'skip') out.push({ id: 'skip', label: '옮기지 않음', choice: { mode: 'skip' } });
  }
  return out;
}
export const modeId = (c) => (c?.sameDrive ? 'sameDrive' : c?.mode || null);

/**
 * 「어디에 놓을까요」의 폴더 줄과 합계. 수와 크기는 처음 본 미리 보기의 것(first)을 쓴다 — 「옮기지 않음」으로 바꾸면 미리 보기가 0을 주고,
 * 고름을 바꿀 때마다 미리 보기를 다시 부르지 않기 때문이다(Fable F12)
 */
// 너무 커서 옮기지 않은 폴더는 옛 PC의 판에 남는다. 「옛 PC 백업에서 꺼내기」(조율 세션 793e0d6dc · ced52da00)로 안쪽 폴더를 골라
// 그 폴더를 통째로(restoreScope, E27) 또는 파일을 골라(openFileCatalog의 범위) 새 폴더에 꺼낸다. 통째로 받기도 한 범위에 100만 개까지라
// (restore-tar의 목록 한도) 100만 개를 넘는 그 폴더 자체는 통째로 꺼낼 수 없고 안쪽 폴더를 고른다
// 꺼낼 길이 없는 것(100만 개 넘는 맨 위 층 바로 안의 파일, 다시 100만 개를 넘는 안쪽 폴더)은 그 층을 열어야 보인다 —
// 옛 PC를 정리하기 전에 한 번 들어가 보라고 함께 쓴다(Fable F1)
export const tooBigKept = (from) => {
  // 기기 이름을 모르면(「이름을 알 수 없는 PC」) 「옛 PC」로 부른다 — oldWho와 같은 셈(Fable -b 2)
  const named = !!from && from !== '이름을 알 수 없는 PC', who = named ? `「${from}」` : '옛 PC', obj = named ? `「${from}」${josa(from, '을/를').slice(String(from).length)}` : '옛 PC를';
  return `${who}의 백업에는 그대로 있습니다. 「옛 PC 백업에서 꺼내기」에서 안쪽 폴더를 골라 통째로 꺼낼 수 있습니다. ${obj} 정리하기 전에 그 화면에 한 번 들어가, 꺼낼 수 없다고 나오는 것이 없는지 확인해 주세요.`;
};
/** 옛 기기를 부르는 말 — 계정의 기기 목록에 이름이 없으면 「옛 PC」(「이름을 알 수 없는 PC」를 머리줄에 쓰지 않는다, Opus 대체 검수 F5) */
export const oldWho = (name) => (name && name !== '이름을 알 수 없는 PC' ? `「${name}」` : '옛 PC');
// 바로 안에 파일만 20만 개 넘게 둔 층은 안쪽 목록을 읽을 수 없다(browseBackupFolder의 CATALOG_TOO_LARGE). 그 층도 통째로는 꺼낼 수 있고(E27),
// 100만 개를 넘을 때만 길이 없다 — 그때만 옛 PC를 정리하기 전에 직접 옮겨 두라고 쓴다
export const OLD_NO_SPLIT_THEN = '바로 안에 파일이 너무 많아 안쪽 폴더 목록을 보여 드릴 수 없습니다. 이 폴더는 「이 폴더 통째로 꺼내기」로 꺼내 주세요. 파일과 폴더가 100만 개를 넘으면 통째로도 꺼낼 수 없으니, 그때는 옛 PC를 정리하기 전에 그 폴더를 USB나 외장 디스크로 직접 옮겨 두세요.';
export const OLD_NO_SPLIT = OLD_NO_SPLIT_THEN;
// 폴더 줄에는 까닭만 둔다 — 백업에 남는다는 말과 지금은 꺼낼 수 없다는 말은 위 상자 한 곳에 둔다(Fable E26 F2)
export const TOO_BIG_WHY = '파일과 폴더가 100만 개를 넘는 폴더라 옮겨 오지 못합니다.';
export function moveRows(preview, choices = {}, first = null) {
  const folders = Array.isArray(preview?.folders) ? preview.folders : [];
  const rows = folders.map((f) => {
    // 100만 개 넘는 폴더(E25 tooBig)는 고름과 상관없이 옮기지 않는다 — 엔진이 어떤 고름을 보내도 그 폴더를 건너뛴다
    const big = f?.tooBig === true, choice = big ? { mode: 'skip' } : choices?.[f.original] || { mode: f.mode }, b = first?.[f.original] || f, place = movePlace(f, choice);
    return { original: f.original, label: f.label || folderName(f.original), files: big ? 0 : Number(b.files) || 0, bytes: big ? 0 : Number(b.bytes) || 0, skipped: Number(f.skipped) || 0,
      place, mode: big ? 'skip' : modeId(choice) || f.mode, why: big ? TOO_BIG_WHY : moveWhy(f, choice, place), modes: big ? [] : moveModes(f), tooBig: big };
  });
  const moving = rows.filter((r) => r.place.kind !== 'skip');
  return { rows, files: moving.reduce((n, r) => n + r.files, 0), bytes: moving.reduce((n, r) => n + r.bytes, 0), places: moving.length, big: rows.filter((r) => r.tooBig) };
}
/**
 * 끝났고 complete가 아닌 옮겨 오기의 기본 화면 글(Fable E26 F1). 「옛 PC 백업에 그대로 있습니다」만 쓰면 바로 옆의 「파일 되살리기」로
 * 꺼낼 수 있다고 읽히는데, 너무 커서 옮기지 않은 폴더는 지금 이 앱으로 꺼낼 수 없다(E26).
 * 확인서의 큰 글(moveTitle)과 같은 셈(moveLeft)으로 남은 것을 모두 말한다 — 실패와 큰 폴더가 섞여도 하나만 말하지 않는다(Opus -b 1).
 * complete는 연결 건너뜀이나 복구본만 있어도 거짓이라, 남은 것이 없거나 결과를 아직 안 읽었으면(창을 다시 켬) 못했다고 단정하지 않는다(Opus -b 2)
 */
export function moveDoneLeftText(result) {
  const next = '결과를 본 뒤 이 PC로 이어서 백업하세요.', neutral = '옮긴 것과 옮기지 않은 것을 결과에서 본 뒤 이 PC로 이어서 백업하세요.';
  if (!result) return neutral;
  const left = moveLeft(result), title = moveTitle(result), more = left.cut ? ' 이상은' : '는', parts = [];
  // 놓은 파일이 하나도 없으면 제목(「옮겨 오지 못했습니다.」)이 이미 그렇게 말한다 — 「N개는」으로 대조하지 않고
  // 확인서처럼 「이 PC에 놓은 파일이 없습니다.」로 잇는다(Opus -d 1)
  if (title.none) { if (title.soft) parts.push(title.soft); } else {
    if (left.failed) parts.push(`${count(left.failed)}개${more} 옮겨 오지 못했습니다.`);
    if (left.unverified) parts.push(`${count(left.unverified)}개${more} 내용을 견주지 못했습니다.`);
  }
  if (left.big) parts.push(`${josa(folderSubjectKo(moveBigFolders(result)), '은/는')} 너무 커서 옮기지 않았습니다. ${tooBigKept()}`);
  if (parts.length) return `${parts.join(' ')} ${next}`;
  // 놓은 파일도 실패도 큰 폴더도 없으면 제목이 「옮겨 온 파일이 없습니다.」다 — 「옮긴 것과」로 잇지 않는다(Opus -e 참고)
  return title.none ? '옮기지 않은 까닭을 결과에서 본 뒤 이 PC로 이어서 백업하세요.' : neutral;
}
/* ── 옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc, 설계 4.6) ── */
/** 첫 목록 — 옮겨 온 결과의 폴더. 너무 커서 옮기지 않은 폴더를 앞에 둔다(그 폴더를 꺼내려고 오는 길이 가장 많다) */
export function oldFolders(result) {
  // 손님이 놓을 자리에서 「옮기지 않음」으로 고른 폴더도 결과에 mode skip · roots []로 남는다 — 「옮겨 옴」이 아니다(Opus 대체 검수 F1)
  const list = (Array.isArray(result?.folders) ? result.folders : []).filter((f) => f && typeof f.original === 'string' && f.original)
    .map((f) => ({ original: f.original, label: f.label || folderName(f.original), tooBig: f.tooBig === true, skip: f.tooBig !== true && f.mode === 'skip' }));
  return [...list.filter((f) => f.tooBig), ...list.filter((f) => f.skip), ...list.filter((f) => !f.tooBig && !f.skip)];
}
/** 고른 자리 — 「사진 › 2024 › 여행」(sub는 엔진처럼 / 로 잇는다) */
export function oldWhere(label, sub) {
  return `「${[label, ...String(sub || '').split('/').filter(Boolean)].join(' › ')}」`;
}
/** 한 칸 위 — 「2024/여행」 → 「2024」, 「2024」 → 「」 */
export function oldUp(sub) { return String(sub || '').split('/').filter(Boolean).slice(0, -1).join('/'); }
/** 옛 PC 판을 읽다 거절된 글. open은 목록 열기(openFileCatalog), 아니면 한 층 읽기(browseBackupFolder). 모르는 부호는 null(창의 공통 글) */
export function oldFailText(code, fromName, { open = false } = {}) {
  if (code === 'UNSAFE_MANIFEST' && open) return '이 폴더 안에 Windows에 둘 수 없는 이름이 있어 목록을 열 수 없습니다. 「다른 폴더 고르기」로 돌아가 통째로 꺼내면 그런 이름의 파일과 폴더는 그 안까지 빼고 나머지를 꺼냅니다.';
  if (code === 'CATALOG_TOO_LARGE') return open ? '이 폴더는 파일이 너무 많아 목록을 한 번에 열 수 없습니다. 「다른 폴더 고르기」로 돌아가 통째로 꺼내거나, 안쪽 폴더를 골라 나눠 열어 주세요.' : OLD_NO_SPLIT;
  if (code === 'INVALID_REQUEST') return '백업의 폴더가 바뀌어 고른 자리를 찾지 못했습니다. 처음부터 다시 골라 주세요.';
  if (code === 'NO_SNAPSHOT') return `${oldWho(fromName)}의 확인된 백업이 없어 꺼낼 수 없습니다.`;
  if (code === 'OPERATION_FAILED') return '옛 PC의 백업을 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
  return null;
}
/**
 * 범위를 통째로 받다(restoreScope, E27) 거절된 글 — 부르는 자리의 거절과 끝난 되살리기의 실패 칸(lastRestoreError.code)에 함께 쓴다.
 * 놓을 자리는 지키는 폴더와 백업 저장소뿐 아니라 옛 PC에서 그 판의 폴더가 있던 자리와도 겹치면 안 된다. 모르는 부호는 null
 */
export function scopeFailText(code) {
  if (code === 'CATALOG_TOO_LARGE') return '파일과 폴더가 100만 개를 넘어 통째로 꺼낼 수 없습니다. 안쪽 폴더를 골라 주세요.';
  if (code === 'OUTPUT_UNSAFE') return '놓을 자리가 이 PC가 지키는 폴더나 백업을 담는 폴더, 또는 옛 PC가 백업하던 폴더와 겹칩니다. 그 폴더들의 안이나 위 폴더에는 놓을 수 없으니 다른 폴더를 골라 주세요.';
  if (code === 'INVALID_REQUEST') return '백업의 폴더가 바뀌어 고른 자리를 찾지 못했습니다. 처음부터 다시 골라 주세요.';
  return null;
}
/** 옮겨 온 결과에서 너무 커서 옮기지 않은 폴더(E25 — 결과 folders[]의 tooBig) */
export function moveBigFolders(result) {
  return (Array.isArray(result?.folders) ? result.folders : []).filter((f) => f && f.tooBig === true).map((f) => ({ original: f.original, label: f.label || folderName(f.original) }));
}
/**
 * 폴더 묶음의 주어 말 — 「사진」 폴더 · 「사진」과 「영상」 폴더 · 「문서」 등 폴더 3곳. 조사는 부르는 쪽이 josa로 붙인다
 * (「폴더는」 · 「3곳은」 — 「외 2곳 폴더는」처럼 단위가 겹치지 않게, 카본 A1)
 */
export function folderSubjectKo(list) {
  const items = Array.isArray(list) ? list : [], names = items.map((x) => `「${x.label}」`);
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]} 폴더`;
  // 조사는 꺾쇠가 아니라 이름의 끝 소리에 맞춘다(「사진」과)
  if (names.length === 2) return `${names[0]}${josa(items[0].label, '과/와').slice(String(items[0].label).length)} ${names[1]} 폴더`;
  return `${names[0]} 등 폴더 ${names.length}곳`;
}
/** 드라이브마다 드는 양과 남은 공간 — 남은 공간을 못 읽은 드라이브(enough: null)는 막지 않고 그렇게 적는다 */
export function moveVolumes(preview) {
  const rows = (Array.isArray(preview?.volumes) ? preview.volumes : []).map((v) => ({ drive: letterOf(v.volume), bytes: Number(v.bytes) || 0, free: typeof v.free === 'number' ? v.free : null, enough: v.enough === true ? true : v.enough === false ? false : null }));
  return { rows, short: rows.filter((r) => r.enough === false) };
}
/** 옛 PC 자리 정보(꾸러미) — 없음은 kitAt으로 가른다. 일부 문제는 폴더 자리에 닿는 것만 여기서 말한다(앱 쪽은 다음 증분, Fable F14) */
export function moveKitNote(preview) {
  if (!preview) return null;
  if (!preview.kitAt) return '옛 PC의 폴더 자리 정보가 백업에 없어, 이 PC의 배치로 자리를 정했습니다. 놓이는 자리를 「놓을 자리」 목록에서 확인하세요.';
  const p = Array.isArray(preview.kitProblems) ? preview.kitProblems : [];
  return p.some((x) => /^known:|^rules-old$/.test(String(x))) ? '옛 PC 정보 일부를 읽지 못했습니다. 놓이는 자리를 「놓을 자리」 목록에서 확인하세요.' : null;
}

/** 옛 기기 — 이어 하기면 저장된 기기, 아니면 이 계정에서 지금 백업하는 기기, 없으면 가장 새 판의 기기(Fable F6 · F18) */
export function moveFrom(devices, st, accountDevices) {
  const list = Array.isArray(devices) ? devices : [];
  // 끝났거나 「끊지 않기」를 고른 옮겨 오기의 기기는 기본이 아니다 — 엔진은 그 뒤에도 마지막 기기를 돌려준다(카본 A5)
  if (st?.unfinished && st.from && list.some((d) => d.from === st.from)) return st.from;
  const w = Array.isArray(accountDevices) ? accountDevices.find((d) => d && d.role === 'write' && d.state === 'active' && !d.current) : null;
  if (w && list.some((d) => d.from === w.id)) return w.id;
  return list[0]?.from || null;
}
/** 옛 기기 이름 — 계정의 기기 목록에서 찾는다. 계정 전의 백업은 Windows가 붙인 PC 이름이고, 못 찾은 기기 번호는 이름 없이 부른다 */
export function moveDeviceName(from, accountDevices, same = []) {
  const d = Array.isArray(accountDevices) ? accountDevices.find((x) => x && x.id === from) : null;
  if (d) return deviceLine(d, Date.now(), same).name;
  return typeof from === 'string' && from && !/^[a-z0-9]{12}$/.test(from) ? from : '이름을 알 수 없는 PC';
}

/** 옮겨 오기가 멈춘 까닭 — 이번 시작 뒤에 적힌 실패만 쓴다(옛 실패를 지금 실패로 읽지 않는다, Fable F5). 부호가 없는 실패는 다시 시작을 권한다(F11) */
export function moveStopText(s, st) {
  const fresh = moveStopCode(s, st);
  const kept = st?.resultAt ? ' 앞서 옮겨 온 결과는 그대로 있습니다.' : '';
  if (!fresh || fresh === 'MOVE_FAILED') return `옛 PC의 백업은 그대로 있습니다. 이어서 옮겨 오면 멈춘 곳부터 잇습니다.${kept}`;
  if (fresh === 'BUSY') return `다른 PC가 백업을 쓰고 있어 멈췄습니다. 잠시 뒤 이어서 옮겨 오면 멈춘 곳부터 잇습니다.${kept}`;
  // 한 파일도 놓기 전의 공간 부족은 자리를 다시 고르게 한다 — 엔진은 그때 새 고름을 받는다(E9 · E24 begun)
  // 목록 초과(앞선 판이 남긴 실패)는 이제 그 폴더만 빼고 옮겨 오므로 이어서 하면 된다(E25)
  if (moveRechoose(s, st)) return `${failureText(fresh)}${kept}`;
  return `${failureText(fresh)} 이어서 옮겨 오면 멈춘 곳부터 잇습니다.${kept}`;
}
/** 이번 시작 뒤에 적힌 실패의 부호 — 옛 실패는 지금 실패가 아니다(Fable F5). 새로 시작하면 엔진이 앞선 실패 칸을 비운다(E4) */
export function moveStopCode(s, st) {
  const e = s?.lastMoveError, started = Date.parse(st?.startedAt || '') || 0;
  return e && typeof e === 'object' && (Date.parse(e.at || '') || 0) >= started && typeof e.code === 'string' ? e.code : null;
}
/**
 * 멈춘 옮겨 오기에서 자리를 다시 고를 수 있는지. 엔진은 한 파일도 놓기 전(장부가 빈) 멈춘 것만 새 고름을 받는다(E9 begun).
 * 공간 부족은 놓기 시작한 뒤 이어 할 때도 나서(그때 엔진은 처음 고른 자리를 지킨다) begun이 거짓일 때만 푼다(카본 A2, E24).
 * 100만 개 넘는 폴더는 이제 거절되지 않고 그 폴더만 「옮기지 않음」으로 고정된다(E25) — 따로 가르지 않는다
 */
export function moveRechoose(s, st) {
  if (!st?.unfinished) return false;
  return moveStopCode(s, st) === 'MOVE_NO_SPACE' && st.begun === false;
}
/**
 * 옮겨 오는 동안의 양 · 폴더 · 속도(E7 move.progress — 옮겨 오기가 도는 동안만 있다). 이어받기에서는 전체가 남은 양이라 「이번에 받을 양」이라 쓴다.
 * 남은 시간은 처음 5초 뒤 엔진이 준 속도로만 어림한다(속도가 없으면 쓰지 않는다)
 */
export function moveProgress(s) {
  const p = s?.move?.progress;
  if (!p || typeof p !== 'object') return null;
  // 아직 정해지지 않은 칸은 null로 온다 — Number(null)은 0이라 숫자만 받는다(카본 A1)
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const bytes = n(p.bytes), total = n(p.total), rate = n(p.bytesPerSecond);
  const left = rate && total !== null && bytes !== null && total > bytes ? (total - bytes) / rate : null;
  return { bytes, total, rate: rate || null, folder: typeof p.folder === 'string' && p.folder ? p.folder : null, leftSec: left };
}
/** 남은 시간 어림 — 「약 N분」 · 「약 N시간 M분」 · 1분 안 */
export function etaKo(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '';
  if (sec < 60) return '1분 안';
  const m = Math.round(sec / 60);
  return m < 60 ? `약 ${m}분` : `약 ${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;
}

// unverified는 onedrive 안의 일부다(E5) — 줄로 보이되 합계에는 더하지 않는다(PART). carried(다시 돌릴 때 앞 장부에서 넘겨받은 수, E11)도
// placed · same · side · onedrive의 일부라 더하면 두 번 센다 — 줄로 두지 않고 확인서의 한 줄로 말한다
export const COUNT_PART = new Set(['unverified', 'carried']);
const COUNT_KO = [['placed', '새로 놓음'], ['same', '이미 있던 같은 파일'], ['copy', '「(복구본)」으로 나란히'], ['onedrive', 'OneDrive에 이미 있음'],
  ['unverified', '그 가운데 내용은 견주지 못함'], ['same-unverified', '같아 보이나 내용은 견주지 못함'], ['side', '「따로 둔 것」에 놓음'], ['skip', '건너뜀'], ['folder-skip', '옮기지 않은 폴더'], ['fail', '옮기지 못함']];
/** 확인서의 수 — 갈래 이름은 엔진 summary()의 것이다 */
export function moveCounts(result) {
  const c = result?.counts || {};
  return COUNT_KO.map(([key, label]) => ({ key, label, n: Number(c[key]) || 0 })).filter((r) => r.n > 0);
}
const WHY = {
  link: { label: '다른 곳을 가리키는 연결', text: '연결 폴더나 바로 가기라 백업에 내용이 없습니다. Windows가 문서 폴더마다 두는 연결도 여기에 듭니다.', tone: 'info' },
  special: { label: 'Windows 특수 항목', text: '파일도 폴더도 아닌 항목이라 옮기지 않았습니다.', tone: 'info' },
  chosen: { label: '고른 대로 뺀 것', text: '놓을 자리를 고를 때 뺀 것입니다.', tone: 'info' },
  name: { label: 'Windows가 받지 않는 이름', text: '이름에 Windows에서 쓸 수 없는 글자가 있어 놓지 못했습니다.', tone: 'warn' },
  long: { label: '너무 긴 자리', text: '놓을 자리의 경로가 Windows가 받는 길이를 넘습니다.', tone: 'warn' },
  protected: { label: 'Windows가 지키는 자리', text: 'Windows나 프로그램이 쓰는 자리라 그 안에 놓지 않았습니다.', tone: 'warn' },
  blocked: { label: '같은 이름이 자리를 막음', text: '폴더를 만들 자리에 같은 이름의 파일이나 연결이 있습니다.', tone: 'warn' },
  busy: { label: '다른 프로그램이 쓰는 중', text: '그 자리의 파일을 다른 프로그램이 열고 있었습니다. 프로그램을 닫고 다시 옮겨 오면 됩니다.', tone: 'warn' },
  denied: { label: '쓸 권한이 없음', text: '그 자리에 파일을 쓰거나 폴더를 만들지 못했습니다.', tone: 'warn' },
  space: { label: '빈 공간 모자람', text: '놓을 드라이브의 빈 공간이 모자랐습니다.', tone: 'warn' },
  changed: { label: '놓는 동안 바뀜', text: '디스크에 쓴 내용이 백업과 다르거나, 놓는 동안 그 자리의 파일이 바뀌었습니다.', tone: 'warn' },
  online: { label: '이 PC의 파일을 읽지 못함', text: '그 자리에 있던 파일이 온라인 전용이라 내용을 견주지 못했습니다.', tone: 'warn' },
  stream: { label: '백업에서 받지 못함', text: '백업에서 이 파일의 내용을 받지 못했습니다.', tone: 'warn' },
  other: { label: '그 밖의 까닭', text: '까닭을 가리지 못한 오류로 놓지 못했습니다.', tone: 'warn' },
  unverified: { label: '같아 보이나 내용은 견주지 못함', text: '이 PC에 크기와 시각이 같은 파일이 있어 그대로 두었지만, 내용까지 견주지는 못했습니다.', tone: 'warn' },
  'od-unverified': { label: 'OneDrive에서 내용을 견주지 못함', text: 'OneDrive에 같은 이름의 파일이 있지만 온라인 전용이라 내용을 견주지 못했습니다.', tone: 'warn' },
  toobig: { label: '너무 커서 옮기지 않은 폴더', text: `파일과 폴더가 100만 개를 넘는 폴더라 옮겨 오지 못했습니다. ${tooBigKept()}`, tone: 'warn' },
};
const WHY_CODE = [[/^(link|MOVE_SKIP_LINK|LINK_ABOVE)$/, 'link'], [/^special$/, 'special'], [/^chosen$/, 'chosen'], [/^(name|MOVE_PATH)$/, 'name'], [/^(long|ENAMETOOLONG)$/, 'long'],
  [/^MOVE_PROTECTED$/, 'protected'], [/^(MOVE_SKIP_FILE|FILE_ABOVE|EEXIST)$/, 'blocked'], [/^(MOVE_BUSY|EBUSY)$/, 'busy'],
  [/^(EACCES|EPERM|MOVE_RENAME_DENIED|MOVE_OPEN|MOVE_MKDIR|MOVE_RENAME|MOVE_DELETE)$/, 'denied'], [/^ENOSPC$/, 'space'],
  [/^(MOVE_WRITE_CHANGED|MOVE_GONE|MOVE_SIZE|ENOENT)$/, 'changed'], [/^MOVE_NOT_READABLE$/, 'online'], [/^(MOVE_NOT_IN_STREAM|MOVE_READ)$/, 'stream']];
/** 건너뜀 · 실패 부호 → 까닭 갈래. 호스트 부호는 Windows 오류 번호를 붙여 온다(MOVE_OPEN:5 등) */
export function moveReason(c) {
  const [base, num] = String(c || '').split(':'), n = Number(num);
  if (n === 5) return 'denied';
  if (n === 32 || n === 33) return 'busy';
  if (n === 39 || n === 112) return 'space';
  if (n === 206) return 'long';
  return (WHY_CODE.find(([re]) => re.test(base)) || [null, 'other'])[1];
}
const itemPath = (it) => it?.p || (it?.name ? `${String(it.original || '').replace(/\\+$/, '')}\\${String(it.name).replace(/\//g, '\\')}` : String(it?.original || ''));
/**
 * 끝나지 않은 파일을 까닭별로 묶는다(Fable F8 · F9) — 문서 폴더의 연결처럼 늘 있는 건너뜀은 알림으로, 실패와 견주지 못한 것은 주의로 가른다.
 * 엔진은 앞 2,000개만 남기므로(cut) 묶음의 수는 그만큼에서 센 것이다
 */
export function moveGroups(result) {
  const items = Array.isArray(result?.items) ? result.items : [], groups = new Map();
  const put = (key, why, tone, it) => { const g = groups.get(key) || { key, ...WHY[why], tone, n: 0, examples: [] }; g.n++; if (g.examples.length < 3) g.examples.push(itemPath(it)); groups.set(key, g); };
  for (const it of items) {
    if (it?.result === 'skip' || it?.result === 'fail') { const why = moveReason(it.c); put(`${it.result}:${why}`, why, it.result === 'fail' ? 'warn' : WHY[why].tone, it); }
    else if (it?.result === 'same-unverified') put('unverified', 'unverified', 'warn', it);
    else if (it?.result === 'onedrive' && it.u) put('od-unverified', 'od-unverified', 'warn', it);
  }
  // 너무 커서 옮기지 않은 폴더(E25)는 항목이 아니라 결과의 폴더 목록으로 묶는다 — 엔진은 폴더 항목을 파일 항목 뒤에 붙이고 앞 2,000개만
  // 남겨, 항목이 많은 옮겨 오기에서는 폴더 항목이 잘린다(Fable F1). 폴더 목록은 잘리지 않아 수가 정확하다(exact — 「이상」을 붙이지 않는다)
  const big = moveBigFolders(result);
  if (big.length) groups.set('toobig', { key: 'toobig', ...WHY.toobig, tone: 'warn', n: big.length, exact: true, examples: big.slice(0, 3).map((f) => f.original) });
  return { cut: items.length >= 2000, list: [...groups.values()].sort((a, b) => (a.tone === b.tone ? b.n - a.n : a.tone === 'warn' ? -1 : 1)) };
}
/**
 * 옮겨 오지 못한 파일 수 — 실패만이 아니라 주의 묶음 전부다. 엔진은 놓을 폴더를 만들지 못한 파일을 실패가 아니라 건너뜀으로 적는다
 * (Fable 화면 검수 F2). 큰 글 · 「다시 옮겨 오기」 · 넘기기 화면이 같은 셈을 쓴다. 엔진이 남긴 앞 2,000개에서 센 것이면 cut
 */
export function moveLeft(result) {
  const g = moveGroups(result), sum = (list) => list.reduce((k, x) => k + x.n, 0);
  // 견주지 못한 것은 이 PC에 이미 있어 그대로 둔 파일이다 — 옮기지 못한 것과 따로 센다(Fable 화면 검수 FA1).
  // 실패와 견주지 못한 수는 counts가 정확하다 — 앞 2,000개만 남긴 목록보다 작게 세지 않는다
  // 너무 커서 옮기지 않은 폴더(E25)는 파일이 아니라 폴더 단위라 따로 센다(big) — 「N개는 옮겨 오지 못했습니다」에 섞지 않는다
  const c = result?.counts || {}, warn = g.list.filter((x) => x.tone === 'warn' && x.key !== 'toobig'), unv = (x) => x.key === 'unverified' || x.key === 'od-unverified';
  // OneDrive에서 견주지 못한 수는 엔진이 따로 센다(E5 counts.unverified)
  const failed = Math.max(Number(c.fail) || 0, sum(warn.filter((x) => !unv(x)))), unverified = Math.max((Number(c['same-unverified']) || 0) + (Number(c.unverified) || 0), sum(warn.filter(unv)));
  return { n: failed + unverified, failed, unverified, cut: g.cut, big: moveBigFolders(result).length };
}
/** 확인서의 큰 글 — 「다」와 「모두 같다」는 그 말이 맞을 때만 쓴다(Fable F10) */
export function moveTitle(result) {
  const c = result?.counts || {}, left = moveLeft(result), fail = left.failed, put = (Number(c.placed) || 0) + (Number(c.copy) || 0) + (Number(c.side) || 0);
  // 넘겨받은 파일(E11 carried)은 이번에 받지 않았다 — 앞선 옮겨 오기에서 놓을 때 확인했고, 지금은 크기와 시각이 같은지만 보았다
  const carried = Number(c.carried) || 0;
  const then = !put ? '' : carried ? `옮겨 놓은 파일은 디스크에 쓴 뒤 다시 읽어 백업과 같은지 확인했습니다. 앞선 옮겨 오기에서 확인한 ${count(carried)}개는 지금도 크기와 시각이 같아 다시 받지 않았습니다.`
    : '옮겨 놓은 파일은 모두 디스크에 쓴 뒤 다시 읽어, 백업과 한 바이트도 다르지 않은지 확인했습니다.';
  const here = ['placed', 'copy', 'side', 'same', 'onedrive', 'same-unverified'].reduce((n, k) => n + (Number(c[k]) || 0), 0);
  if (!here) return fail ? { main: '옮겨 오지 못했습니다.', soft: '이 PC에 놓은 파일이 없습니다.', then: '옛 PC 백업은 그대로 있습니다.', tone: 'warn', none: true }
    : { main: '옮겨 온 파일이 없습니다.', soft: '', then: '옮기지 않은 것은 옛 PC 백업에 그대로 있습니다.', tone: 'warn', none: true };
  if (fail) return { main: '옮겨 왔습니다.', soft: `${count(fail)}개${left.cut ? ' 이상은' : '는'} 옮겨 오지 못했습니다.`, then, tone: 'warn' };
  if (left.unverified) return { main: '옮겨 왔습니다.', soft: `${count(left.unverified)}개${left.cut ? ' 이상은' : '는'} 내용을 견주지 못했습니다.`, then, tone: 'warn' };
  // 너무 커서 옮기지 않은 폴더(E25) — 나머지는 다 왔어도 「다 옮겨 왔습니다」가 아니다
  if (left.big) return { main: '옮겨 왔습니다.', soft: `${josa(folderSubjectKo(moveBigFolders(result)), '은/는')} 너무 커서 옮기지 않았습니다.`, then, tone: 'warn' };
  if (result?.complete === true) return { main: '다 옮겨 왔습니다.', soft: '', then, tone: 'ok' };
  return { main: '옮겨 왔습니다.', soft: '옮기지 않은 것은 옛 PC 백업에 그대로 있습니다.', then, tone: 'ok' };
}

const ROOT_KO = { place: '같은 자리', moved: '「옮겨 온 자료」 아래', newFolder: '새 폴더', oneDrive: 'OneDrive 안의 자리' };
/**
 * 넘길 때 지킬 폴더의 기본(설계 검토 권고 1) — 옮겨 온 결과의 실제 뿌리(E2)에서 「따로 둔 것」을 빼고, 서로 포함되면 바깥 것만 남긴다.
 * 엔진이 서로 포함되는 폴더를 받지 않기 때문이다(paths.cjs validateSources). 더한 폴더(extra)도 같은 규칙으로 합친다
 */
export function moveRoots(result, extra = []) {
  const all = [];
  for (const f of Array.isArray(result?.folders) ? result.folders : []) {
    // exists(E15): 지금 디스크에 그 폴더가 있는지. 호스트가 답하지 못하면 칸이 없다(undefined — 있다고 보고 넘기기가 검사한다)
    for (const r of Array.isArray(f?.roots) ? f.roots : []) if (r && typeof r.path === 'string' && r.path && r.kind !== 'side') all.push({ path: r.path, kind: r.kind, label: folderName(r.path), where: ROOT_KO[r.kind] || '', missing: r.exists === false });
  }
  for (const p of Array.isArray(extra) ? extra : []) if (typeof p === 'string' && p) all.push({ path: p, kind: 'added', label: folderName(p), where: '고른 폴더' });
  const seen = new Set(), list = all.filter((x) => { const k = lowPath(x.path); if (seen.has(k)) return false; seen.add(k); return true; });
  return { list, cut: (Array.isArray(result?.folders) ? result.folders : []).some((f) => f?.rootsCut) };
}
/**
 * 넘기기 화면의 지킬 폴더 — 옮겨 온 결과가 있으면 그 뿌리와 더한 폴더, 결과 없이 넘기면(옮겨 오기를 그만둠 · 같은 PC를 다시 깜)
 * 고른 폴더(nextSources)와 더한 폴더. 손님이 뺀 것(off)은 체크를 푼다. 창(app.js)과 그리기가 같은 목록을 쓴다
 */
export function moveTakeList(s, mv) {
  const result = mv?.result && !mv?.quit ? mv.result : null;
  // 넘기기의 고름은 창 기억(off · added)에만 둔다. 엔진에 적어 둔 nextSources로 되살리는 길(E10)은 걷었다 — 적힌 고름이 이 결과의
  // 넘기기에서 온 것인지 옮겨 오기 전에 고른 것인지 가를 값이 없어, 겹치는 폴더 하나로 짐작하면 정상 경로에서 틀린다(카본 A3)
  const added = Array.isArray(mv?.added) ? mv.added : [], offList = Array.isArray(mv?.off) ? mv.off : [];
  const roots = moveRoots(result, result ? added : [...pickedSources(s), ...added]);
  // 지금 디스크에 없는 자리(E15)와 넘기기가 없다고 돌려준 자리(SOURCES_MISSING의 paths, mv.gone)는 늘 뺀다 — 넘기기가 통째로 거절된다
  const gone = new Set((Array.isArray(mv?.gone) ? mv.gone : []).map(lowPath));
  for (const x of roots.list) if (gone.has(lowPath(x.path))) x.missing = true;
  const off = new Set(offList.map(lowPath)), isOff = (p) => off.has(lowPath(p)) || gone.has(lowPath(p)) || roots.list.some((x) => x.missing && lowPath(x.path) === lowPath(p));
  // 서로 포함되면 체크된 바깥 폴더만 안쪽을 가린다 — 엔진은 서로 포함되는 폴더를 받지 않는다. 체크를 끈 바깥 폴더는 안쪽을 가리지 않는다(카본 A3)
  const on = roots.list.filter((x) => !isOff(x.path));
  const list = roots.list.filter((x) => !on.some((o) => o !== x && lowPath(o.path) !== lowPath(x.path) && pathIn(x.path, o.path)));
  // off · added: 창이 고침을 시작할 바탕 — off는 pathKey로 둔다
  return { ...roots, list, result, isOff, off: offList.map(lowPath), added, checked: list.filter((x) => !isOff(x.path)).map((x) => x.path) };
}
export const pathKey = (p) => lowPath(p);
/** 옮겨 온 뒤 옛 PC가 다시 백업했는지 — 마지막 시작 뒤의 판이 있으면 그 사이 바뀐 파일은 이 PC에 없다(Fable F15) */
export function moveFresh(devices, st, result) {
  const d = (Array.isArray(devices) ? devices : []).find((x) => x && x.from === st?.from);
  const since = Date.parse(st?.startedAt || '') || Date.parse(result?.at || '') || 0;
  return d && since && Date.parse(d.lastBackupAt || '') > since ? d : null;
}

/* ── 옮겨 오기 4b — 프로그램 다시 깔기 · 앱 설정 되돌리기 · 다시 로그인할 곳(engine move-service.cjs의 reinstallList · reinstall ·
   restoreSettings · checklist, 창 상태 move.reinstall). 설계 검토는 Fable 5.2 「고친 뒤 지음」(D1~D18)이다 ── */
// 표 밖(others)은 화면에 「그 밖에 winget이 찾은 프로그램」으로 부른다 — 「표」는 엔진 말이다(카본 C9)
const SCOPE_KO = { machine: '컴퓨터 전체', user: '사용자', outside: '그 밖' };
/** 깔 수 있는 수(엔진 moveReinstall이 받는 1~200개) */
export const APPS_MAX = 200;
/**
 * 다시 깔 목록의 줄과 고른 것. 표의 프로그램은 엔진의 chosen(새 PC에 없으면 고름)이 기본이고, 표 밖은 고르지 않음이 기본이다.
 * 이미 깔린 것과 winget이 준비되지 않았을 때는 고르지 않는다. names는 깐 결과에 이름이 없는 표 밖 프로그램을 부를 때 쓴다(Fable D8)
 */
export function appsRows(list, picks = {}) {
  const ready = list?.wingetStatus?.ready === true;
  const on = (p, def) => (!ready || p.installed ? false : typeof picks?.[p.id] === 'boolean' ? picks[p.id] : def);
  const table = (Array.isArray(list?.table) ? list.table : []).filter((p) => p && typeof p.id === 'string').map((p) => ({ ...p, scopeKo: SCOPE_KO[p.scope] || '', on: on(p, p.chosen === true) }));
  const others = (Array.isArray(list?.others) ? list.others : []).filter((p) => p && typeof p.id === 'string').map((p) => ({ ...p, scope: 'outside', scopeKo: SCOPE_KO.outside, on: on(p, false) }));
  const manual = (Array.isArray(list?.manual) ? list.manual : []).filter((p) => p && typeof p.name === 'string');
  const chosen = [...table, ...others].filter((p) => p.on);
  return { ready, table, others, manual, chosen, ids: chosen.map((p) => p.id), machine: chosen.filter((p) => p.scope === 'machine').length,
    outside: chosen.filter((p) => p.scope === 'outside').length, noLicense: chosen.filter((p) => p.scope === 'outside' && !p.license).length,
    names: Object.fromEntries([...table, ...others].map((p) => [p.id, p.name || p.id])), empty: !table.length && !others.length && !manual.length };
}
/** winget이 준비되지 않은 까닭(호스트 reinstall.status의 reason) — 새로 깐 Windows는 처음 몇 분 동안 그럴 수 있다(4.6b) */
export function wingetText(st) {
  if (st?.reason === 'WINGET_OLD') return '프로그램 설치 도구(winget)의 판이 오래되었습니다. Microsoft Store에서 「앱 설치 관리자」를 업데이트한 뒤 「목록 다시 읽기」를 누르세요.';
  if (st?.reason === 'WINGET_START') return '프로그램 설치 도구(winget)가 아직 답하지 않습니다. 새로 깐 Windows는 처음 몇 분 동안 그럴 수 있습니다. 잠시 뒤 「목록 다시 읽기」를 누르세요.';
  return '프로그램 설치 도구(winget)를 찾지 못했습니다. 새로 깐 Windows는 처음 몇 분 동안 그럴 수 있습니다. 잠시 뒤 「목록 다시 읽기」를 누르고, 그래도 없으면 Microsoft Store에서 「앱 설치 관리자」를 받으세요.';
}
/** 다시 로그인할 곳의 남은 수 */
export const checksLeft = (list) => (Array.isArray(list) ? list.filter((x) => x && !x.done).length : 0);
/** 깔지 못한 까닭(엔진 결과의 code) — 손님이 할 일을 쓴다(Fable D7 · D15) */
export function appReason(code) {
  const c = String(code || '');
  if (c === 'EXIT_2') return '앞서 시작한 깔기가 아직 돌고 있을 수 있습니다. 잠시 뒤 「다시 깔기」를 눌러 주세요.';
  if (c === 'WINGET_ADMIN_MISSING') return '승인한 관리자 계정에 winget이 없습니다. 그 계정에서 Microsoft Store의 「앱 설치 관리자」를 받거나, 관리자에게 아래 명령으로 깔아 달라고 부탁하세요.';
  if (c === 'WINGET_TIMEOUT') return '20분이 지나도 끝나지 않아 멈췄습니다.';
  if (c === 'START_FAILED') return '관리자 권한으로 시작하지 못했습니다.';
  if (c === 'REINSTALL_NEEDS_ELEVATION') return '관리자 확인이 있어야 깔리는 프로그램입니다.';
  const n = /^EXIT_(-?\d+)$/.exec(c);
  // 조사는 번호 읽는 소리에 맞춘다(「1603으로」 · 「0x8A15002B로」, 카본 A6)
  if (n) { const v = Number(n[1]), num = v < 0 || v > 0xffff ? `0x${(v >>> 0).toString(16).toUpperCase()}` : String(v); return `설치 도구가 오류 번호 ${josa(num, '으로/로')} 끝났습니다.`; }
  return '까닭을 가리지 못한 오류입니다.';
}
/**
 * 깐 결과 한 줄 — 깔렸는지는 설치 목록 확인(listed — winget list --id)을 먼저 본다(Fable D6). true는 깔려 있음, false는 목록에 없음,
 * null은 확인하지 못함이다. 「아니요」인지 창이 스스로 닫혔는지 가를 수 없어 누가 눌렀는지 말하지 않는다(D16)
 */
export function appResult(r, names = {}) {
  const name = r?.name || names?.[r?.id] || r?.id || '', listed = r?.listed, st = r?.state;
  const row = (ok, text, why = '') => ({ id: r?.id, name, ok, text, why, state: st, scope: r?.scope, listed, reboot: st === 'reboot' });
  if (st === 'installed') return row(listed !== false, listed === false ? '깔았다고 했지만 설치 목록에 없습니다' : listed === true ? '깔았습니다' : '깔았습니다. 설치 목록에서는 확인하지 못했습니다');
  if (st === 'already') return row(true, '이미 깔려 있었습니다');
  if (st === 'reboot') return row(true, 'PC를 다시 켜면 마저 깔립니다');
  if (listed === true) return row(true, '설치 도구는 끝을 알리지 못했지만 깔려 있습니다');
  if (st === 'declined') return row(false, '관리자 확인을 받지 못해 깔지 않았습니다');
  // 확인 창이 10분 안에 눌리지 않아 닫혔다 — 아무것도 깔지 않았다(E23 approval-timeout)
  if (st === 'approval-timeout') return row(false, '확인 창이 닫혀 깔지 않았습니다', '확인 창을 10분 안에 누르지 않아 닫혔습니다. 다시 깔면 확인 창이 다시 뜹니다.');
  if (st === 'timeout') return row(false, '시간이 지나 끝내지 못했습니다', '설치가 정해진 시간을 넘겨 멈췄습니다. 잠시 뒤 다시 깔아 보세요.');
  return row(false, '깔지 못했습니다', appReason(r?.code));
}
/**
 * 깐 결과 묶음(창 상태 move.reinstall이 끝난 것). restore: 설정을 저절로 되돌릴지 — 하나라도 깔렸을 때만이다(Fable D9).
 * 모두 「관리자 확인을 받지 못함」이나 시간 초과면 되돌려도 설정이 따로 둔 곳에만 가므로 부르지 않고 고르는 화면에 남는다
 */
export function appsOutcome(job, names = {}) {
  if (!job || job.running) return null;
  const rows = (Array.isArray(job.results) ? job.results : []).map((r) => appResult(r, names));
  return { rows, at: job.at || null, failedStage: job.stage === 'failed', error: job.error || null, bad: rows.filter((r) => !r.ok).length, reboot: rows.some((r) => r.reboot),
    restore: job.stage === 'done' && rows.some((r) => ['installed', 'already', 'reboot'].includes(r.state) || r.listed === true),
    declined: rows.some((r) => r.state === 'declined' || r.state === 'approval-timeout'), admin: rows.some((r) => r.why && /관리자에게/.test(r.why)) };
}
/**
 * 지난 깔기 — 이 창이 지켜본 것(창 상태 move.reinstall)이 먼저다. 앱을 다시 켜 작업자 기억이 비면 엔진이 적은 마지막 결과
 * (moveState.reinstall { at, results }, E17)를 쓴다. saved: 엔진에 적힌 것(at은 끝난 때다)
 */
export function appsJob(s, st) {
  const live = s?.move?.reinstall;
  if (live) return live;
  const r = st?.reinstall;
  return r && typeof r === 'object' && Array.isArray(r.results) ? { running: false, stage: 'done', at: r.at || null, results: r.results, error: null, saved: true } : null;
}
/**
 * 되돌린 설정 — 이 창이 되돌린 것이 먼저고, 없으면 엔진이 적은 마지막 결과(moveState.settings, E17)다. 「다른 프로그램 더 깔기」로
 * 다시 고르러 왔거나(fresh) 이 창에서 새로 깐 뒤라면 앞선 결과를 쓰지 않는다. 엔진에 적힌 깔기가 그 설정보다 뒤면(깐 뒤 되돌리기 전에
 * 앱이 끝남) 그 설정은 지난 깔기의 것이 아니다
 */
export function appsSettings(apps, st, job) {
  if (Array.isArray(apps?.settings)) return { list: apps.settings, at: null, saved: false };
  if (apps?.fresh || apps?.settingsError || (job && !job.saved)) return null;
  const set = st?.settings;
  if (!set || typeof set !== 'object' || !Array.isArray(set.results)) return null;
  if (job?.saved && (Date.parse(job.at || '') || 0) > (Date.parse(set.at || '') || 0)) return null;
  return { list: set.results, at: set.at || null, saved: true };
}
/** 지난 깔기 뒤 설정을 아직 되돌리지 않았는지 — 하나라도 깔렸는데 그 뒤에 적힌 설정 결과가 없다(앱이 그 사이에 끝났다) */
export function appsUnrestored(apps, st, job) {
  return !!(job?.saved && appsOutcome(job)?.restore && !Array.isArray(apps?.settings) && !appsSettings({ ...apps, fresh: false }, st, job));
}
/**
 * 옮겨 온 뒤 넘긴 PC — 이 PC가 백업하고(복구 전용이 아님) 옮겨 온 결과가 있다. 엔진이 첫 백업 중에도 「프로그램과 설정」을 받으므로(E19)
 * 넘긴 뒤에도 그 화면을 연다. left: 다시 로그인할 곳의 남은 수(창이 읽은 체크 목록, 없으면 엔진의 checklistLeft — E17)
 */
export const movedHere = (s, st) => !!(s?.configured && s.mode !== 'restore' && typeof st?.from === 'string' && st.from && st.resultAt && !st.released);
export function movedApps(s, st, checks) {
  if (!movedHere(s, st)) return null;
  const left = Array.isArray(checks) ? checksLeft(checks) : Number.isSafeInteger(st.checklistLeft) && st.checklistLeft > 0 ? st.checklistLeft : 0;
  return { left, installing: !!s?.move?.reinstall?.running };
}
/**
 * 넘긴 뒤 기본 화면의 한 줄 — 깔고 있거나 다시 로그인할 곳이 남았을 때만 둔다. 쓰지 않는 항목은 체크할 까닭이 없어, 옮겨 온 지
 * 두 주가 지나면 「다시 로그인할 곳」 줄은 거둔다. 설정 서랍의 줄은 남는다(Fable F6)
 */
export const MOVED_NOTE_DAYS = 14;
export function movedAppsNote(s, st, checks, now = Date.now()) {
  const a = movedApps(s, st, checks);
  if (!a) return null;
  const act = (label) => ({ id: 'move-apps-home', label, kind: 'link', to: 'move-apps' });
  if (a.installing) return { text: '옛 PC의 프로그램을 깔고 있습니다.', act: act('진행 보기') };
  const at = Date.parse(st?.resultAt || ''), old = Number.isFinite(at) && now - at > MOVED_NOTE_DAYS * 86400000;
  return a.left && !old ? { text: `옮겨 온 뒤 다시 로그인할 곳이 ${count(a.left)}곳 남았습니다.`, act: act('프로그램과 설정') } : null;
}
const LEFT_KO = { 'secret-looking': '열쇠로 보이는 글이 있어', unreadable: '읽지 못해', 'too-big': '너무 커서', 'too-many': '파일이 너무 많아' };
/** 앱 설정 결과 한 앱 — 되돌림 · 덮지 않음 · 앱이 없어 따로만 · 뺀 칸 · 옮기지 않은 것 · 확장 명령 · 쓰지 못한 파일(4.6b · Fable D8) */
export function settingRows(results) {
  return (Array.isArray(results) ? results : []).filter((a) => a && typeof a.name === 'string').map((a) => {
    const n = (x) => (Array.isArray(x) ? x.length : 0), lines = [];
    if (n(a.restored)) lines.push(`설정 파일 ${count(n(a.restored))}개를 원래 자리에 되돌렸습니다.`);
    if (a.instructions) lines.push('AI 도구 지침 파일을 되돌렸습니다. 다음에 그 도구를 열 때부터 읽힙니다.');
    if (n(a.kept)) lines.push(`이 PC에 이미 있던 ${count(n(a.kept))}개는 덮지 않고, 옛 PC의 것을 따로 둔 곳에 두었습니다.`);
    if (a.notInstalled) lines.push('프로그램이 깔려 있지 않아 따로 둔 곳에만 두었습니다. 프로그램을 깐 뒤 「설정 다시 되돌리기」를 누르세요.');
    if (Number(a.dropped) > 0) lines.push(`옮겨도 되는 칸만 되돌리고, 그 밖의 ${count(Number(a.dropped))}칸은 뺐습니다.`);
    if (n(a.droppedProfiles)) lines.push(`실행 명령이 든 Terminal 프로필 ${count(n(a.droppedProfiles))}개(${a.droppedProfiles.slice(0, 3).join(', ')}${n(a.droppedProfiles) > 3 ? ' 들' : ''})는 옮기지 않았습니다.`);
    const left = new Map();
    for (const l of Array.isArray(a.left) ? a.left : []) left.set(l?.why, (left.get(l?.why) || 0) + 1);
    for (const [why, k] of left) lines.push(`${LEFT_KO[why] || '그 밖의 까닭으로'} 옮기지 않은 것이 ${count(k)}개 있습니다.`);
    if (n(a.extensions)) lines.push(`확장 ${count(n(a.extensions))}개는 명령으로 다시 까세요.`);
    if (n(a.failed)) lines.push(`${count(n(a.failed))}개는 쓰지 못했습니다. 그 자리의 폴더 권한을 확인해 주세요.`);
    // 앱마다 실제로 한 일의 이름 — 되돌린 파일이 없고 따로만 두었으면 「되돌림」이라 하지 않는다
    // 옮기지 않은 것(열쇠로 보임 · 읽지 못함 · 너무 큼)만 있으면 「옮길 것 없음」이 아니라 「옮기지 않음」이다(카본 A5)
    const warn = !!(n(a.failed) || a.notInstalled);
    const label = n(a.failed) ? '확인할 것' : a.notInstalled ? '따로 둠' : n(a.restored) ? '되돌림' : n(a.kept) || n(a.side) ? '따로 둠' : n(a.extensions) ? '명령으로'
      : left.size || n(a.droppedProfiles) || Number(a.dropped) > 0 ? '옮기지 않음' : '옮길 것 없음';
    // 큰 글은 이름이 아니라 실제 수로 가른다 — 쓰지 못한 파일이 섞이면 이름은 「확인할 것」이다(Fable FA2)
    return { app: a.app, name: a.name, lines, warn, label, restoredN: n(a.restored), asideN: n(a.kept) + n(a.side) + (a.notInstalled ? 1 : 0), extensions: (a.extensions || []).filter((x) => x && typeof x.command === 'string'), failed: a.failed || [] };
  });
}
/**
 * 「프로그램과 설정」 화면의 지금 — running(깔는 중, 창 상태) · restoring(설정 되돌리는 중) · result(설정까지 끝남 또는 되돌리기 실패) ·
 * loading · error(목록을 읽지 못함) · notready(winget 없음) · pick(고르기, 지난 깔기의 결과가 있으면 함께)
 */
export function appsPhase(s, apps, st = null) {
  if (s?.move?.reinstall?.running) return 'running';
  if (apps?.restoring) return 'restoring';
  if (apps?.settingsError || appsSettings(apps, st, appsJob(s, st))) return 'result';
  if (apps?.list === undefined) return 'loading';
  if (!apps.list) return 'error';
  if (apps.list.wingetStatus?.ready !== true) return 'notready';
  return 'pick';
}

/* ── 솔리오 잇기(설계 4.13 · 4.14 · 4.16) ── */
/** 엔진(engine/src/solio.cjs)이 받는 꼴 — 쉬는 Wi-Fi는 20개 · 이름 하나 UTF-8 32바이트, 가리는 낱말은 20개 · 낱말 하나 40자 */
export const REST_MAX = 20, MASK_MAX = 20, MASK_LEN = 40;
const CTRL = /[\u0000-\u001f\u007f]/;
/** 쉴 Wi-Fi 이름을 엔진에 보내기 전에 거른다 — 맞으면 null, 아니면 손님에게 보일 까닭 */
export function restNameProblem(name, names = []) {
  if (typeof name !== 'string' || !name) return 'Wi-Fi 이름을 적어 주세요.';
  if (CTRL.test(name)) return '이름에 쓸 수 없는 글자가 들어 있습니다.';
  if (new TextEncoder().encode(name).length > 32) return 'Wi-Fi 이름이 너무 깁니다. 한글은 10자, 영문과 숫자는 32자까지입니다.';
  if (names.includes(name)) return '이미 고른 Wi-Fi입니다.';
  if (names.length >= REST_MAX) return `${REST_MAX}개까지 고를 수 있습니다. 하나를 뺀 뒤 더해 주세요.`;
  return null;
}
/** 가릴 낱말(앞뒤 빈칸을 뗀 것)을 거른다 — 맞으면 null */
export function maskProblem(word, masks = []) {
  const w = typeof word === 'string' ? word.trim() : '';
  if (!w) return '가릴 낱말을 적어 주세요.';
  if (CTRL.test(w)) return '낱말에 쓸 수 없는 글자가 들어 있습니다.';
  if (w.length > MASK_LEN) return `가리는 낱말은 ${MASK_LEN}자까지입니다.`;
  if (masks.includes(w)) return '이미 가리는 낱말입니다.';
  if (masks.length >= MASK_MAX) return `${MASK_MAX}개까지 둘 수 있습니다. 하나를 뺀 뒤 더해 주세요.`;
  return null;
}
/** 동의가 드는 AI 도구(엔진 AI_TOOLS) — 백업 상태(protection_status)는 이름이 없어 늘 답하므로 켜고 끄는 칸이 없다 */
export const AI_TOOL_ROWS = Object.freeze([
  Object.freeze({ id: 'space_report', name: '공간 보고서', obj: '공간 보고서를', what: '드라이브마다 남은 공간과 늘어나는 속도, 지난 7일 늘어난 폴더, 비울 수 있는 후보를 알려 줍니다.' }),
  Object.freeze({ id: 'find_restorable', name: '백업 안 파일 찾기', obj: '백업 안 파일 찾기를', what: '이름 일부로 백업 안의 파일을 찾아 경로, 크기, 백업한 때를 50개까지 알려 줍니다.' }),
]);

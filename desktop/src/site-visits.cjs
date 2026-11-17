'use strict';
// 솔리오 「방문자 분석」(2026-11-17): 이 PC의 모으기 도구(tools/사이트방문/모으기.js)가 쓴 요약 한 장을 읽는다.
// 자리는 %LOCALAPPDATA%\synk\site-visits\summary.json 하나다. 파일이 없으면 이 프로그램은 솔리오에 나오지 않는다.
// 같은 폴더의 viewers.json(저장소 밖)에 적힌 SYNK 계정으로 로그인했을 때만 보인다. 이 PC는 시험 · 시연 계정으로도 로그인하므로
// PC만으로 가르지 않는다(11-17 Fable 설계 검토 P1-2). viewers.json이 없으면 아무에게도 보이지 않고, 물은 계정의 번호와 이름을
// viewer-pending.json에 남긴다 — 사람이 이름을 확인하고 `node tools/사이트방문/모으기.js 보는계정 --받기`로 옮긴다.
// 요약에는 집계 숫자와 상태만 있다(사람을 잇는 값이 없다). 이 모듈은 꼴만 확인하고 고치지 않는다.
// 설계: docs/마케팅/사이트방문_분석/설계.md 6절.
const fs = require('node:fs');
const path = require('node:path');

const SUMMARY_VERSION = 1;
const MAX_BYTES = 512 * 1024;
const SECTIONS = ['방문', '쪽', '행동', '목적', 'AI'];
const ID = /^[A-Za-z0-9_-]{8,80}$/;

function defaultFile(env = process.env, platform = process.platform) {
  if (env.SYNK_SITE_VISITS_SUMMARY) return env.SYNK_SITE_VISITS_SUMMARY;
  if (platform !== 'win32' || !env.LOCALAPPDATA) return null;
  return path.join(env.LOCALAPPDATA, 'synk', 'site-visits', 'summary.json');
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 요약의 꼴을 확인한다. 맞으면 null, 틀리면 까닭 코드 */
function shapeProblem(summary) {
  if (!isObject(summary)) return 'NOT_OBJECT';
  if (summary.판 !== SUMMARY_VERSION) return 'VERSION';
  if (typeof summary.만든때 !== 'string' || !Number.isFinite(Date.parse(summary.만든때))) return 'MADE_AT';
  for (const key of SECTIONS) if (!isObject(summary[key]) || typeof summary[key].상태 !== 'string') return 'SECTION_' + key;
  if (!isObject(summary.검색) || !isObject(summary.검색.구글) || !isObject(summary.검색.네이버)) return 'SECTION_검색';
  return null;
}

function createSiteVisits({ file = defaultFile(), fsImpl = fs, now = () => new Date() } = {}) {
  let cache = null; // { mtimeMs, size, result }
  const dir = file ? path.dirname(file) : null;
  const viewersFile = dir ? path.join(dir, 'viewers.json') : null;
  const pendingFile = dir ? path.join(dir, 'viewer-pending.json') : null;
  let pendingWritten = null;

  /** 볼 수 있는 계정 번호 목록. 파일이 없거나 깨졌으면 null(아무에게도 보이지 않는다). */
  function viewers() {
    try {
      const v = JSON.parse(fsImpl.readFileSync(viewersFile, 'utf8'));
      const ids = Array.isArray(v?.synk_user_ids) ? v.synk_user_ids.filter(id => typeof id === 'string' && ID.test(id)) : [];
      return ids.length ? ids : null;
    } catch { return null; }
  }
  /** 볼 계정이 아직 정해지지 않았을 때, 물은 계정을 남긴다(같은 계정이면 한 번만). */
  function notePending(account) {
    if (pendingWritten === account.synk_user_id) return;
    try {
      const body = { synk_user_id: account.synk_user_id, display_name: String(account.display_name || '').slice(0, 80), asked_at: now().toISOString() };
      fsImpl.writeFileSync(pendingFile, JSON.stringify(body, null, 2) + '\n', 'utf8');
      pendingWritten = account.synk_user_id;
    } catch { /* 남기지 못해도 화면은 그대로 숨긴다 */ }
  }
  function readSummary(stat) {
    if (stat.size > MAX_BYTES) return { ok: false, available: true, code: 'TOO_LARGE' };
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache.result;
    let result;
    try {
      const summary = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
      const problem = shapeProblem(summary);
      result = problem
        ? { ok: false, available: true, code: problem === 'VERSION' ? 'VERSION' : 'SHAPE', ...(problem === 'VERSION' && Number.isInteger(summary?.판) ? { version: summary.판, supported: SUMMARY_VERSION } : {}) }
        : { ok: true, available: true, summary };
    } catch {
      result = { ok: false, available: true, code: 'UNREADABLE' };
    }
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, result };
    return result;
  }
  /**
   * @param account 로그인한 계정 { synk_user_id, display_name } (main.cjs의 accountStatus().account)
   * @returns { ok:true, available:false } — 파일 없음, 계정 없음, 볼 계정이 아님
   *          { ok:true, available:true, summary } — 읽음
   *          { ok:false, available:true, code[, version, supported] } — 볼 계정인데 파일을 못 읽음(깨짐 · 판이 다름 · 너무 큼)
   */
  function snapshot(account) {
    if (!file) return { ok: true, available: false };
    let stat;
    try { stat = fsImpl.statSync(file); } catch { cache = null; return { ok: true, available: false }; }
    if (!stat.isFile()) return { ok: true, available: false };
    if (!isObject(account) || typeof account.synk_user_id !== 'string' || !ID.test(account.synk_user_id)) return { ok: true, available: false };
    const allowed = viewers();
    if (!allowed) { notePending(account); return { ok: true, available: false }; }
    if (!allowed.includes(account.synk_user_id)) return { ok: true, available: false };
    return readSummary(stat);
  }
  return { snapshot, file, viewersFile, pendingFile };
}

module.exports = { createSiteVisits, defaultFile, shapeProblem, SUMMARY_VERSION, MAX_BYTES };

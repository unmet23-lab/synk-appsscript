'use strict';
// 솔리오 「계정 건강」(2026-11-19): 이 PC의 진단 도구(tools/계정건강.js --요약쓰기)가 쓴 요약 한 장을 읽는다.
// 자리는 %LOCALAPPDATA%\synk\sns-health\summary.json 하나다. 파일이 없으면 이 프로그램은 솔리오에 나오지 않는다.
// 볼 계정은 「방문자 분석」과 같은 목록을 쓴다 — %LOCALAPPDATA%\synk\site-visits\viewers.json의 synk_user_ids.
// 두 프로그램 모두 회사 숫자를 보는 화면이라 볼 사람이 같다. 이 모듈은 그 파일을 읽기만 한다. 물은 계정을 대기 줄에
// 남기는 일은 site-visits.cjs가 한다(솔리오를 열면 두 프로그램을 함께 묻는다).
// 요약에는 우리 SNS 계정의 이름, 집계 숫자, 우리 게시물의 제목과 진단 글이 있다. 이 모듈은 겉 꼴만 확인하고 고치지 않는다.
// 줄 안쪽은 renderer/sns-health-model.mjs가 하나씩 다듬는다. 설계: docs/디자인/솔리오_계정건강_20261119/PC앱_구현설계.md.
const fs = require('node:fs');
const path = require('node:path');
const { defaultFile: siteVisitsFile, ID } = require('./site-visits.cjs');

const SUMMARY_VERSION = 1;
const MAX_BYTES = 512 * 1024;

function defaultFile(env = process.env, platform = process.platform) {
  if (env.SYNK_SNS_HEALTH_SUMMARY) return env.SYNK_SNS_HEALTH_SUMMARY;
  if (platform !== 'win32' || !env.LOCALAPPDATA) return null;
  return path.join(env.LOCALAPPDATA, 'synk', 'sns-health', 'summary.json');
}
/** 볼 계정 목록의 자리 — 방문자 분석 요약의 옆이다 */
function defaultViewersFile(env = process.env, platform = process.platform) {
  const summary = siteVisitsFile(env, platform);
  return summary ? path.join(path.dirname(summary), 'viewers.json') : null;
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 요약의 겉 꼴을 확인한다. 맞으면 null, 틀리면 까닭 코드 */
function shapeProblem(summary) {
  if (!isObject(summary)) return 'NOT_OBJECT';
  if (summary.판 !== SUMMARY_VERSION) return 'VERSION';
  if (typeof summary.만든때 !== 'string' || !Number.isFinite(Date.parse(summary.만든때))) return 'MADE_AT';
  if (!isObject(summary.방) || !Array.isArray(summary.방.rows)) return 'ROOM';
  return null;
}

function createSnsHealth({ file = defaultFile(), viewersFile = defaultViewersFile(), fsImpl = fs } = {}) {
  let cache = null; // { mtimeMs, size, result }

  /** 볼 수 있는 계정 번호 목록. 파일이 없거나 깨졌으면 null(아무에게도 보이지 않는다). */
  function viewers() {
    if (!viewersFile) return null;
    try {
      const v = JSON.parse(fsImpl.readFileSync(viewersFile, 'utf8'));
      const ids = Array.isArray(v?.synk_user_ids) ? v.synk_user_ids.filter(id => typeof id === 'string' && ID.test(id)) : [];
      return ids.length ? ids : null;
    } catch { return null; }
  }
  function readSummary(stat) {
    if (stat.size > MAX_BYTES) return { ok: false, available: true, code: 'TOO_LARGE' };
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache.result;
    let result;
    try {
      const summary = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
      const problem = shapeProblem(summary);
      result = problem
        ? { ok: false, available: true, code: problem, ...(problem === 'VERSION' && Number.isInteger(summary?.판) ? { version: summary.판, supported: SUMMARY_VERSION } : {}) }
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
   *          { ok:false, available:true, code[, version, supported] } — 볼 계정인데 파일을 못 읽음
   *          code: TOO_LARGE · UNREADABLE · NOT_OBJECT · VERSION · MADE_AT · ROOM
   */
  function snapshot(account) {
    if (!file) return { ok: true, available: false };
    let stat;
    try { stat = fsImpl.statSync(file); } catch { cache = null; return { ok: true, available: false }; }
    if (!stat.isFile()) return { ok: true, available: false };
    if (!isObject(account) || typeof account.synk_user_id !== 'string' || !ID.test(account.synk_user_id)) return { ok: true, available: false };
    const allowed = viewers();
    if (!allowed || !allowed.includes(account.synk_user_id)) return { ok: true, available: false };
    return readSummary(stat);
  }
  return { snapshot, file, viewersFile };
}

module.exports = { createSnsHealth, defaultFile, defaultViewersFile, shapeProblem, SUMMARY_VERSION, MAX_BYTES };

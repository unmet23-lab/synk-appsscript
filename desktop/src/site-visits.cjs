'use strict';
// 솔리오 「방문자 분석」(2026-11-17): 이 PC의 모으기 도구(tools/사이트방문/모으기.js)가 쓴 요약 한 장을 읽는다.
// 자리는 %LOCALAPPDATA%\synk\site-visits\summary.json 하나다. 파일이 없으면 이 프로그램은 솔리오에 나오지 않는다 —
// 회사 대표만 가르는 판정이 앱에 없어서, 모으기가 도는 PC(대표의 PC)에서만 보이게 하는 가장 단순한 길이다.
// 요약에는 집계 숫자와 상태만 있다(사람을 잇는 값이 없다). 이 모듈은 꼴만 확인하고 고치지 않는다.
// 설계: docs/마케팅/사이트방문_분석/설계.md 6절.
const fs = require('node:fs');
const path = require('node:path');

const SUMMARY_VERSION = 1;
const MAX_BYTES = 512 * 1024;
const SECTIONS = ['방문', '쪽', '행동', '목적', 'AI'];

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

function createSiteVisits({ file = defaultFile(), fsImpl = fs } = {}) {
  let cache = null; // { mtimeMs, size, result }
  /** { ok:true, available:false } — 파일 없음(이 PC는 모으지 않는다)
   *  { ok:true, available:true, summary } — 읽음
   *  { ok:false, available:true, code } — 파일은 있는데 못 읽음(깨짐 · 판이 다름 · 너무 큼) */
  function snapshot() {
    if (!file) return { ok: true, available: false };
    let stat;
    try { stat = fsImpl.statSync(file); } catch { cache = null; return { ok: true, available: false }; }
    if (!stat.isFile()) return { ok: true, available: false };
    if (stat.size > MAX_BYTES) return { ok: false, available: true, code: 'TOO_LARGE' };
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache.result;
    let result;
    try {
      const summary = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
      const problem = shapeProblem(summary);
      result = problem ? { ok: false, available: true, code: problem === 'VERSION' ? 'VERSION' : 'SHAPE' } : { ok: true, available: true, summary };
    } catch {
      result = { ok: false, available: true, code: 'UNREADABLE' };
    }
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, result };
    return result;
  }
  return { snapshot, file };
}

module.exports = { createSiteVisits, defaultFile, shapeProblem, SUMMARY_VERSION, MAX_BYTES };

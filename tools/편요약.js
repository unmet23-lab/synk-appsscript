#!/usr/bin/env node
'use strict';
/* 편 요약 보내기(2026-10-24) — 저장소 편 기록을 회사 작업실 SNS·마케팅 간편판(오늘·성과·계정)이 읽게 서버에 한 장으로 보낸다.
 *
 *   node tools/편요약.js            미리 보기 — 요약을 만들어 편·판정 수와 크기만 보인다(서버에 보내지 않는다)
 *   node tools/편요약.js --json     요약 전체를 출력한다
 *   node tools/편요약.js --실행     작업실 자동화 계정으로 POST /api/social/repo-digest 하고 로그아웃한다
 *   공통: --주소 <작업실 주소>(기본 https://workspace.synk.im) · --저장소 <폴더>(기본: 이 도구가 든 저장소)
 *
 * 정기 작업 「SYNK 예약큐」(30분, 운영 사본)의 첫 단계다(tools/예약큐예약/run-hidden.py). 운영 사본은 origin/master만 따라가므로
 * 게시/준비.json·게시결과.json을 바꾼 세션은 그 자리에서 바로올리기로 올려야 화면에 보인다.
 * 만들기는 tools/lib/편요약.js(공개 게시물의 제목·주소·핸들·시각·상태와 배수만 — 게시결과의 「방법」 원문·검토 링크는 넣지 않는다).
 * 서버가 더 새 요약을 이미 갖고 있으면(409) 덮지 않고 조용히 끝낸다. 자격이 없으면 종료 코드 3(작업실예약.js와 같다).
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 요약 = require('./lib/편요약.js');

const REPO_DEFAULT = path.resolve(__dirname, '..');
const ORIGIN = 'https://workspace.synk.im';

function 인자(argv) {
  const o = { 실행: false, json: false, 주소: ORIGIN, 저장소: REPO_DEFAULT };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--실행') o.실행 = true;
    else if (a === '--json') o.json = true;
    else if (a === '--주소') o.주소 = argv[++i];
    else if (a === '--저장소') o.저장소 = path.resolve(argv[++i]);
    else if (a === '-h' || a === '--help') o.도움 = true;
    else throw Object.assign(new Error(`모르는 인자: ${a}`), { code: 'USAGE' });
  }
  return o;
}

function 커밋(repo) {
  const r = spawnSync('git', ['-C', repo, 'log', '-1', '--format=%H %cI'], { encoding: 'utf8', windowsHide: true });
  const [hash, at] = String(r.stdout || '').trim().split(' ');
  return r.status === 0 && /^[0-9a-f]{40}$/.test(hash || '') ? { hash, at: Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : null } : { hash: null, at: null };
}

async function 보내기(digest, { origin, connect = require('./작업실예약.js').connect } = {}) {
  const ws = await connect({ origin });
  try {
    return await ws.post('/api/social/repo-digest', digest);
  } catch (error) {
    if (error.status === 409) return { ok: false, skipped: '서버에 더 새 요약이 있어요' };
    // 받는 주소는 회사 이미지 판으로 나간다 — 그 전에는 정기 작업을 실패로 만들지 않는다.
    if (error.status === 404) return { ok: false, skipped: '서버가 아직 편 요약을 받지 않아요(간편판 회사 판 반영 전)' };
    throw error;
  } finally {
    // 회차마다 새 세션을 남기지 않는다(30분마다 돈다).
    await ws.post('/api/logout', {}).catch(() => {});
  }
}

async function main(argv = process.argv.slice(2)) {
  const o = 인자(argv);
  if (o.도움) { console.log(require('node:fs').readFileSync(__filename, 'utf8').split('\n').slice(2, 15).join('\n')); return; }
  const c = 커밋(o.저장소);
  const digest = 요약.build({ repo: o.저장소, commit: c.hash });
  digest.source.commitAt = c.at;
  const bytes = Buffer.byteLength(JSON.stringify(digest));
  if (o.json) { console.log(JSON.stringify(digest, null, 1)); }
  const line = `편 요약 ${digest.today} · 편 ${digest.episodes.length} · 판 ${digest.episodes.reduce((n, e) => n + e.plates.length, 0)} · 판정 ${digest.judgments.length} · ${Math.round(bytes / 1024)}KB · 커밋 ${c.hash ? c.hash.slice(0, 9) : '—'}`;
  if (!o.실행) { if (!o.json) console.log(line + ' (미리 보기 — 보내려면 --실행)'); return; }
  const result = await 보내기(digest, { origin: o.주소 });
  console.log(`${line} → ${result.ok ? `보냄(편 ${result.episodes} · 판정 ${result.judgments}${result.dropped ? ` · 뺀 줄 ${result.dropped}` : ''})` : result.skipped}`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = error.code === 'NO_CREDENTIAL' ? 3 : error.code === 'USAGE' ? 2 : 1; });

module.exports = { main, 보내기, 인자 };

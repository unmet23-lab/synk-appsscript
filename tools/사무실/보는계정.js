#!/usr/bin/env node
'use strict';
/**
 * 솔리오 「사무실」을 볼 SYNK 계정(설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 11.1 · 13절).
 * PC 앱(desktop/src/office.cjs)이 남긴 viewer-pending.json(물은 계정의 번호와 이름, 계정마다 한 줄)을 유호님께 보여
 * 맞다고 하신 줄의 번호로 viewers.json에 옮긴다. 방문자 분석의 `모으기.js 보는계정`과 같은 꼴이다.
 *
 *   node tools/사무실/보는계정.js                    볼 수 있는 계정과 물은 계정(번호 · 이름 · 물은 때)을 보인다
 *   node tools/사무실/보는계정.js --받기 <번호>       그 줄의 계정을 viewers.json에 더하고 대기 파일을 지운다
 *   node tools/사무실/보는계정.js --버리기            대기 파일만 지운다
 *
 * 두 파일은 %LOCALAPPDATA%\synk\office\(저장소 밖)에 있다. 자리는 PC 앱과 같은 함수(defaultViewersFile)로 정하고,
 * 환경 변수 SYNK_OFFICE_VIEWERS가 있으면 그 자리의 viewers.json과 같은 폴더의 viewer-pending.json을 쓴다(시험용).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { defaultViewersFile } = require('../../desktop/src/office.cjs');
const 보는쪽 = require('../../desktop/src/site-visits.cjs'); // 대기 파일을 읽는 법과 계정 번호 꼴을 PC 앱과 하나로 쓴다

function JSON읽기(p, 기본) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 기본; } }
/* 같은 폴더의 임시 파일에 쓰고 이름을 바꿔 넣는다. PC 앱이 쓰다 만 파일을 읽지 않게 한다 */
function JSON쓰기(p, x) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, `${JSON.stringify(x, null, 2)}\n`, 'utf8'); fs.renameSync(tmp, p); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

/**
 * 본 것과 받는 것을 번호로 묶는다. 그 사이에 다른 계정이 사무실을 물어도 다른 계정이 들어가지 않는다. 깨진 viewers.json은 덮지 않고 멈춘다.
 * @param 옵션.받기 받을 계정 번호(목록의 줄과 글자까지 같아야 한다) · 옵션.버리기 물은 계정 목록을 지운다
 * @param 목록자리 viewers.json의 자리(기본은 PC 앱과 같은 자리)
 */
function 보는계정({ 받기 = null, 버리기 = false } = {}, 목록자리 = defaultViewersFile()) {
  if (!목록자리) { console.error('볼 계정 파일의 자리를 정하지 못했다. Windows에서 부르거나 SYNK_OFFICE_VIEWERS에 viewers.json의 자리를 준다.'); return 1; }
  const 물음자리 = path.join(path.dirname(목록자리), 'viewer-pending.json');
  let 목록 = { synk_user_ids: [] };
  if (fs.existsSync(목록자리)) {
    목록 = JSON읽기(목록자리, null);
    if (!목록 || typeof 목록 !== 'object' || !Array.isArray(목록.synk_user_ids) || !목록.synk_user_ids.every((id) => typeof id === 'string' && 보는쪽.ID.test(id))) {
      console.error(`${목록자리}를 읽지 못했다(깨졌거나 꼴이 다르다). 덮어쓰지 않고 멈춘다 — 파일을 고치거나 지운 뒤 다시 부른다. 그동안 솔리오의 사무실은 아무에게도 보이지 않는다.`);
      return 1;
    }
  }
  const 보임 = (id) => `${String(id).slice(0, 6)}…`;
  console.log(`사무실을 볼 수 있는 계정: ${목록.synk_user_ids.length ? 목록.synk_user_ids.map(보임).join(', ') : '없음(아무에게도 보이지 않는다)'}`);
  if (버리기) { fs.rmSync(물음자리, { force: true }); console.log('물은 계정 목록을 지웠다.'); return 0; }
  const 물음 = 보는쪽.pendingEntries(JSON읽기(물음자리, null));
  if (!물음.length) {
    console.log('PC 앱이 남긴 물은 계정이 없다. 로그인한 채 솔리오를 열면 남는다(볼 계정이 정해진 뒤에는 남지 않는다).');
    return 받기 == null ? 0 : 1;
  }
  console.log('물은 계정(오래된 차례):');
  for (const x of 물음) console.log(`  ${x.asked_at} · 이름 「${x.display_name || '이름 없음'}」 · 번호 ${x.synk_user_id}`);
  if (받기 == null) { console.log('유호님께 이름과 시각을 보여 유호님 계정이 맞다고 하시면, 그 줄의 번호를 붙여 「보는계정.js --받기 <번호>」로 다시 부른다. 받은 계정에게는 솔리오의 「사무실」이 보인다.'); return 0; }
  const 고른 = 물음.find((x) => x.synk_user_id === 받기);
  if (!고른) { console.error(`위 목록에 번호 「${String(받기).slice(0, 80)}」인 줄이 없다. 옮기지 않았다. 목록의 번호를 글자 그대로 붙인다.`); return 1; }
  const ids = [...new Set([...목록.synk_user_ids, 고른.synk_user_id])];
  JSON쓰기(목록자리, { ...목록, synk_user_ids: ids, 받은때: new Date().toISOString() });
  // 볼 계정이 정해지면 PC 앱은 대기 줄을 더 쓰지 않는다. 남은 줄(시험 · 시연 계정의 번호와 이름)은 지운다.
  fs.rmSync(물음자리, { force: true });
  console.log(`옮겼다 — 「${고른.display_name || '이름 없음'}」(${보임(고른.synk_user_id)}). 사무실을 볼 수 있는 계정 ${ids.length}개. PC 앱은 다음에 사무실을 물을 때 읽는다.`);
  return 0;
}

function main(argv) {
  const 있나 = (f) => argv.includes(f);
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const 아는것 = new Set(['--받기', '--버리기']);
  const 모르는것 = argv.filter((a, i) => !아는것.has(a) && argv[i - 1] !== '--받기');
  if (모르는것.length || (있나('--받기') && 있나('--버리기'))) { console.error('사용: node tools/사무실/보는계정.js [--받기 <번호> | --버리기]'); return 1; }
  if (있나('--받기') && !보는쪽.ID.test(값('--받기') || '')) { console.error('--받기 뒤에 받을 계정의 번호를 붙인다(「보는계정.js」만 부르면 물은 계정과 번호가 보인다).'); return 1; }
  return 보는계정({ 받기: 있나('--받기') ? 값('--받기') : null, 버리기: 있나('--버리기') });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { 보는계정, main };

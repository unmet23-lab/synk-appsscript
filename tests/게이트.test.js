'use strict';
/**
 * 게이트 회귀 — 서버측 잠금을 여닫는 «비상 열쇠»가 조용히 망가지는 것을 잡는다.
 *
 * ■ 🔴 이 파일이 지키는 세 문장
 *   ① **테스트가 실제 GitHub 을 건드리면 안 된다.** 이 모듈을 여는 것만으로 저장소 설정이
 *      바뀌면 그건 검사가 아니라 사고다(`require.main` 가드).
 *   ② **훅은 네트워크를 안 쓴다.** 세션 시작 비용은 세션 수만큼 곱해진다 — 왕복이 하나
 *      들어가면 그 순간부터 모든 세션이 그 값을 문다(#Q95 가 재고 있는 자리).
 *   ③ **「풀어놓고 잊는 것」을 장부가 기억한다.** 이 접기 로직이 틀리면 훅이 조용해지고,
 *      그러면 잠금이 풀린 채 영구히 남는다 — 그 상태는 화면상 «정상»과 구별되지 않는다.
 *
 * ■ 안 재는 것 (정직하게)
 *   🚫 실제 GitHub API 왕복 — 자격·네트워크가 필요해 CI 에서 깨진다(F296). 탐지는 픽스처가 진다.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 게이트 = require('../tools/게이트.js');
const 소스 = fs.readFileSync(path.join(__dirname, '..', 'tools', '게이트.js'), 'utf8');

/** 픽스처 장부를 임시 파일로 짓는다 — 실장부는 절대 안 건드린다. */
function 임시장부(줄들) {
  const p = path.join(os.tmpdir(), `게이트장부-시험-${process.pid}-${줄들.length}.jsonl`);
  fs.writeFileSync(p, 줄들.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  return p;
}

const 저장소 = 'unmet23-lab/synk-appsscript';

test('① 모듈을 여는 것만으로 GitHub 을 조작하지 않는다', () => {
  /* `require.main === module` 가드가 없으면 위 require 한 줄이 --상태 를 돌리고,
     인자에 따라서는 실제 규칙을 세우거나 푼다. */
  assert.match(소스, /require\.main === module/,
    'CLI 진입이 require.main 으로 안 감싸여 있다 — 테스트가 실제 저장소를 건드린다');
  assert.ok(typeof 게이트.장부의현재상태 === 'function', '장부 접기를 밖에서 못 부른다');
});

test('② 훅 모드가 네트워크를 쓰지 않는다', () => {
  /* 훅 함수 본문만 잘라서 본다 — 파일 전체에는 gh 호출이 당연히 있다. */
  const i = 소스.indexOf('function 훅()');
  assert.ok(i > 0, '훅 함수를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 고친다');
  const 본문 = 소스.slice(i, 소스.indexOf('\n}', i));
  assert.equal(/\bgh\s*\(/.test(본문), false, '훅이 gh 를 부른다 — 세션 시작마다 왕복이 붙는다');
  assert.equal(/spawnSync|fetch\(/.test(본문), false, '훅이 외부 프로세스·네트워크를 쓴다');
  /* 그리고 훅은 «장부 기준»임을 스스로 밝혀야 한다 — 안 밝히면 실측으로 읽힌다 */
  assert.match(본문, /장부 기준/, '훅 출력이 실측인지 장부인지 안 밝힌다');
});

test('③ 장부 접기 — 세우기 → 풀기 → 걸기 순서가 현재 상태를 옳게 낸다', () => {
  const p = 임시장부([
    { 때: '2026-08-15T10:00:00Z', 무엇: '세우기', 저장소, 규칙: 'SYNK-기본잠금' },
    { 때: '2026-08-15T11:00:00Z', 무엇: '풀기', 저장소, 사유: '머지가 막혀서' },
    { 때: '2026-08-15T12:00:00Z', 무엇: '걸기', 저장소 },
  ]);
  const 상태 = 게이트.장부의현재상태(p);
  assert.equal(상태[저장소].걸림, true, '마지막이 「걸기」인데 풀린 것으로 읽는다');
  fs.rmSync(p, { force: true });
});

test('④ 풀린 채로 끝난 장부는 «풀림»으로 남는다 — 이게 훅을 울리는 신호다', () => {
  const p = 임시장부([
    { 때: '2026-08-15T10:00:00Z', 무엇: '세우기', 저장소 },
    { 때: '2026-08-15T11:00:00Z', 무엇: '풀기', 저장소, 사유: '급한 수리' },
  ]);
  const 상태 = 게이트.장부의현재상태(p);
  assert.equal(상태[저장소].걸림, false, '풀린 상태를 못 잡는다 — 훅이 영원히 조용해진다');
  assert.equal(상태[저장소].기록.사유, '급한 수리', '사유를 안 들고 온다 — 왜 풀렸는지 못 말한다');
  fs.rmSync(p, { force: true });
});

test('⑤ 깨진 줄 하나가 장부 전체를 죽이지 않는다', () => {
  const p = path.join(os.tmpdir(), `게이트장부-깨짐-${process.pid}.jsonl`);
  fs.writeFileSync(p, [
    JSON.stringify({ 때: 'x', 무엇: '세우기', 저장소 }),
    '{ 이건 깨진 줄',
    JSON.stringify({ 때: 'y', 무엇: '풀기', 저장소, 사유: '시험' }),
  ].join('\n') + '\n', 'utf8');
  const 상태 = 게이트.장부의현재상태(p);
  assert.equal(상태[저장소].걸림, false, '깨진 줄 때문에 뒤 줄을 못 읽었다');
  fs.rmSync(p, { force: true });
});

test('⑥ 규칙 정의가 한 곳에만 산다 — 두 곳에 적으면 갈라진다', () => {
  /* 지침 신뢰성 ④: 같은 판정이 두 곳에 앉으면 갈라지고 방향은 언제나 「통과」다. */
  assert.equal(게이트.규칙정의.enforcement, 'active');
  assert.deepEqual(게이트.규칙정의.rules.map((r) => r.type).sort(), ['deletion', 'non_fast_forward']);
  /* 기본 가지를 «이름»으로 박으면 나중에 갈릴 때 조용히 빗나간다 */
  assert.deepEqual(게이트.규칙정의.conditions.ref_name.include, ['~DEFAULT_BRANCH'],
    '기본 가지를 특수값이 아니라 이름으로 박았다 — 가지 이름이 바뀌면 규칙이 조용히 빗나간다');
  /* 규칙 목록이 소스에 두 번 적혔는지 — PUT 경로가 정의를 베껴 쓰면 거기서 갈라진다 */
  const 정의개수 = (소스.match(/non_fast_forward/g) || []).length;
  assert.ok(정의개수 <= 2, `non_fast_forward 가 ${정의개수}곳에 적혔다 — 파생이 아니라 복제다`);
});

test('⑦ 다루는 저장소가 둘 다 등록돼 있다', () => {
  /* 형제 저장소를 빠뜨리면 그쪽만 무방비로 남는데, 화면상으로는 「게이트 세움」과 같다. */
  assert.ok(게이트.저장소들.includes('unmet23-lab/synk-appsscript'));
  assert.ok(게이트.저장소들.includes('unmet23-lab/SYNK-talk'));
  assert.equal(게이트.저장소들.length, 2);
});

test('⑧ 푸는 데는 사유가 강제된다', () => {
  /* 사유 없는 해제는 장부를 무의미하게 만든다 — 「누가 왜 풀었나」가 이 장부의 전부다. */
  const i = 소스.indexOf('function 바꾸기');
  const 본문 = 소스.slice(i, i + 600);
  assert.match(본문, /목표 === 'disabled' && !사유/, '사유 없이도 풀 수 있다');
});

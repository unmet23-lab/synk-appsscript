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
  /* 규칙 목록이 소스에 두 번 적혔는지 — PUT 경로가 정의를 베껴 쓰면 거기서 갈라진다.
     🔴 이 검사는 원래 `<= 2` 였고, 실제 사고는 그 «허용된 2번째»에서 났다(⑨⑩ 참조).
        복제를 한 칸 봐 주면 갈라짐도 한 칸 봐 주는 것이다 — 그래서 1로 조인다. */
  const 정의개수 = (소스.match(/non_fast_forward/g) || []).length;
  assert.ok(정의개수 <= 1, `non_fast_forward 가 ${정의개수}곳에 적혔다 — 파생이 아니라 복제다`);
});

test('⑨ 🔴 요청 몸통에 `exclude` 가 살아 있다 — 이게 빠져 «푸는 길»만 422 로 죽었다', () => {
  /* 2026-08-15 실사고. 세우기는 `규칙정의` 를 통째로 보내 통과했고, 바꾸기(PUT)만 gh 인자로
     몸통을 손조립하다 `exclude` 를 빠뜨려 `422 Missing required parameter exclude` 로 죽었다.
     증상이 지독한 자리 = **잠그는 길은 멀쩡하고 여는 길만 죽는다.** 장부도 화면도 초록인데
     막혔을 때 열 열쇠가 없다 — 그건 이 도구의 존재 이유가 통째로 사라진 상태다. */
  for (const 목표 of ['active', 'disabled']) {
    const 몸통 = 게이트.요청몸통(목표);
    assert.deepEqual(몸통.conditions.ref_name.exclude, [],
      `${목표}: exclude 가 빠졌다 — GitHub 이 422 로 거절한다(푸는 길이 막힌다)`);
    assert.deepEqual(몸통.conditions.ref_name.include, ['~DEFAULT_BRANCH'], `${목표}: 대상 가지가 빠졌다`);
    assert.equal(몸통.enforcement, 목표, `${목표}: enforcement 가 안 갈렸다 — 풀어도 안 풀린다`);
    assert.deepEqual(몸통.rules.map((r) => r.type).sort(), ['deletion', 'non_fast_forward'],
      `${목표}: 규칙이 몸통에서 사라졌다 — PUT 이 규칙을 통째로 지운다`);
  }
  /* 원본을 갉아먹지 않는지 — 파생이 정의를 바꾸면 다음 호출이 오염된다 */
  assert.equal(게이트.규칙정의.enforcement, 'active', '요청몸통이 규칙정의를 제자리에서 고쳤다');
});

test('⑩ 몸통을 손으로 조립하지 않는다 — 갈라지는 자리를 원천 차단한다', () => {
  /* 호출부마다 고치는 대신 «잘못 쓸 수 없는 통로»만 남긴다: gh 에는 `--input` 으로만 준다.
     이 검사가 없으면 다음 사람이 또 손조립을 적고, 그때도 세우기는 통과하고
     푸는 길만 죽는다(같은 병 3번째).

     🔑 **주석은 벗기고 본다** — 첫 판에서 이 검사가 스스로 빨개졌다: 사고를 기록한
        «주석»이 금지 문자열을 그대로 인용하고 있었기 때문이다. 사고를 적으면 검사가
        깨지는 도구는, 다음 사람에게 「기록하지 마라」를 가르친다. */
  const 코드만 = 소스.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.equal(/conditions\[/.test(코드만), false,
    'gh 인자에 conditions 손조립이 남아 있다 — 정의와 갈라지는 자리다');
  assert.equal(/rules\[\]/.test(코드만), false, 'gh 인자에 rules 손조립이 남아 있다');
  /* 주석 벗기기가 실제로 일했는지 — 안 벗겨졌으면 위 둘은 「늘 초록」이 아니라 「늘 적색」이다 */
  assert.ok(코드만.length < 소스.length, '주석이 하나도 안 벗겨졌다 — 벗기기 정규식이 죽었다');
  assert.match(코드만, /요청몸통/, '주석을 너무 벗겨 코드까지 날렸다');
  /* 몸통을 보내는 곳은 전부 `--input` 이어야 한다 — POST·PUT 둘 다 */
  const 몸통보냄 = (코드만.match(/'--method', '(POST|PUT)'/g) || []).length;
  const 인풋 = (코드만.match(/'--input', 본문/g) || []).length;
  assert.ok(몸통보냄 > 0, '몸통을 보내는 호출을 하나도 못 찾았다 — 이 검사가 0건을 초록으로 읽고 있다');
  assert.equal(인풋, 몸통보냄, `몸통을 보내는 호출 ${몸통보냄}개 중 --input 은 ${인풋}개다`);
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

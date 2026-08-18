/* 증거 패킷 — 「못 읽음」이 「0」의 얼굴로 유호님께 가지 않게 (F543·F604 계보 · 대기열 #Q103).
 *
 * 이 검사가 지키는 것: **유호님이 「적용할까요?」를 읽고 누를 때, 그 재료가 잰 것인지 못 잰 것인지가
 * 글자로 갈려 있게.** 2026-08-18 실측(`local_163e0921`) — 이 도구는 세 자리에서 관측 실패를
 * 측정된 0으로 접었다:
 *   ⑤ `gh` 출력이 JSON 이 아니면 `catch {}` → `runs=[]` → 「이 SHA 로 등록된 run 0건」
 *   ④ `friction.js` 문구가 바뀌면 정규식이 빗나가 항목이 통째로 빠짐
 *   ④ `승인.js` 가 죽으면 역시 조용히 빠짐
 * 셋 다 빠진 판의 마지막 줄이 「(기계가 세는 잔여 항목 0)」이라, **아무것도 못 잰 판과 진짜 0인
 * 판이 같은 글자**였다. 새는 방향이 「통과」다(CLAUDE.md 가드 맹점 ④).
 *
 * 탐지력은 **픽스처가 진다** — 판정은 순수 함수(`run판정`·`잔여판정`)라 gh·git·fs 없이 전부 재고,
 * 실저장소는 계약(모듈이 그 함수를 실제로 내놓나)만 본다. 실저장소는 지금 안 깨져 있어서
 * 실저장소만 검사하면 파서가 눈이 멀어도 초록이다(가드 맹점 ②).
 * repo 밖(gh 로그인·네트워크)에 기대는 것은 한 줄도 없다 — 그래야 CI 에서 안 깨진다(F296).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 패킷 = require(path.join(ROOT, 'tools', '증거패킷.js'));

/** 실행층이 내는 모양 그대로 — 손으로 베끼면 계약이 갈라진다. */
const 성공 = (out) => ({ ok: true, out, 코드: 0 });
const 실패 = (오류, 코드 = null) => ({ ok: false, out: '', 코드, 오류 });

const RUN = (c) => JSON.stringify([{ conclusion: c, status: 'completed', workflowName: 'CI', url: 'u' }]);

// ─────────────────────────── ⑤ 층 — 「못 읽음」과 「0건」이 갈리나 (픽스처 · gh 0회)

test('🔑 [급소] gh 출력이 JSON 이 아니면 «0건»이 아니라 «못 읽었다»로 나온다', () => {
  const r = 패킷.run판정(성공('not-json at all'), null);
  assert.strictEqual(r.못잼, true, '못 읽은 판이 «잰 것»으로 섰다 — 옛 구멍 그대로다');
  assert.match(r.층, /못 읽었다/);
  assert.ok(!/등록된 run 0건/.test(r.줄.join('\n')),
    '못 읽은 판이 「run 0건」 문구를 냈다 — 유호님은 이걸 「CI 가 안 돌았다」로 읽는다');
  assert.match(r.줄.join('\n'), /0건이 아니라 미측정/);
});

test('[⑤] 빈 출력도 «못 읽었다» 쪽이다 — 빈 문자열은 재서 얻은 0이 아니다', () => {
  assert.strictEqual(패킷.run판정(성공(''), null).못잼, true);
});

test('[⑤] JSON 이지만 배열이 아니면 못 읽은 것이다 — gh 가 오류 객체를 낼 수 있다', () => {
  const r = 패킷.run판정(성공('{"message":"Bad credentials"}'), null);
  assert.strictEqual(r.못잼, true);
  assert.match(r.줄.join('\n'), /배열이 아니다/);
});

test('[⑤] run 이 있으면 잰 것이고 성공·실패 표식이 붙는다', () => {
  const r = 패킷.run판정(성공(RUN('success')), null);
  assert.strictEqual(r.못잼, false);
  assert.match(r.층, /원격 run 1건/);
  assert.match(r.줄[0], /^✅/);
  assert.match(패킷.run판정(성공(RUN('failure')), null).줄[0], /^🔴/);
});

test('🔑 [급소] 진짜 0건인데 대체 조회가 죽으면 그 0 은 «재서 얻은 0»이 아니다', () => {
  const r = 패킷.run판정(성공('[]'), 실패('gh 없음'));
  assert.strictEqual(r.못잼, true, '대체 조회 실패가 「0건」으로 접혔다');
  assert.match(r.줄.join('\n'), /재서 얻은 0이 아니다/);
});

test('[⑤] 셋 다 읽힌 0건만 «재서 얻은 0» 이라고 말한다', () => {
  const r = 패킷.run판정(성공('[]'), 성공(JSON.stringify([{ conclusion: 'success', workflowName: 'CI', headSha: 'abcdef1234', url: 'u' }])));
  assert.strictEqual(r.못잼, false);
  assert.match(r.층, /재서 얻은 0/);
  assert.match(r.줄.join('\n'), /abcdef12/);
});

test('[⑤] gh 자체를 못 띄우면 «원격 미확인» — 로컬 초록을 CI 초록으로 안 읽게 못박는다', () => {
  const r = 패킷.run판정(실패('gh 없음'), null);
  assert.strictEqual(r.못잼, true);
  assert.match(r.줄.join('\n'), /로컬 초록은 CI 초록이 아니다/);
});

// ─────────────────────────── ④ 층 — 분모가 늘 붙나 (픽스처 · git·fs 0회)

const 마찰출력 = '[마찰 신호] 전체 603건 · 해소 514 · 살아있음 89 (열림 10 · 보류 79)';

test('🔑 [급소] 셋 다 재야만 «잔여 0» 이라고 말한다', () => {
  const r = 패킷.잔여판정({ 마찰: 성공(마찰출력), 동결: 실패('일치 없음', 1), 승인: 성공('') });
  assert.strictEqual(r.잰것, 3);
  assert.strictEqual(r.전체, 3);
  assert.strictEqual(r.못잼.length, 0);
  assert.match(r.줄.join('\n'), /살아있음|열린 항목 89건/);
});

test('🔑 [급소] friction 문구가 바뀌면 조용히 빠지지 않고 «못 잰 것»으로 선다', () => {
  const r = 패킷.잔여판정({ 마찰: 성공('[마찰 신호] 전체 603건 · 아직 안 닫힌 것 89'), 동결: 실패('일치 없음', 1), 승인: 성공('') });
  assert.ok(r.잰것 < r.전체, '못 읽은 탐침이 분모에서 «잰 것»으로 세어졌다');
  assert.match(r.못잼.join(' '), /마찰 장부/);
  assert.match(r.줄.join('\n'), /못 잰 것 1\/3/);
  assert.ok(!/재서 얻은 0/.test(r.줄.join('\n')), '못 잰 판이 「재서 얻은 0」이라고 말했다');
});

test('🔑 [급소] git grep 의 «일치 없음»(코드 1)은 재서 얻은 0이고, 오류(코드 2)는 못 잰 것이다', () => {
  const 없음 = 패킷.잔여판정({ 마찰: 성공(마찰출력), 동결: 실패('일치 없음', 1), 승인: 성공('') });
  assert.strictEqual(없음.못잼.length, 0, '「일치 0」을 「못 봤다」로 셌다 — 거짓 경보가 되고 곧 꺼진다');

  const 깨짐 = 패킷.잔여판정({ 마찰: 성공(마찰출력), 동결: 실패('fatal: bad revision', 128), 승인: 성공('') });
  assert.match(깨짐.못잼.join(' '), /failed_p0/, '「못 봤다」를 「일치 0」으로 접었다 — 새는 방향이 통과다');
});

test('[④] 동결 표식이 살아 있으면 ⛔ 로 낸다 — 기록처(장부·보드)는 신호에서 뺀다', () => {
  const r = 패킷.잔여판정({
    마찰: 성공(마찰출력),
    동결: 성공('docs/_ops/마찰신호.md\n계약/C0_API.md\ndocs/설계.md'),
    승인: 성공(''),
  });
  const s = r.줄.join('\n');
  assert.match(s, /⛔ failed_p0/);
  assert.match(s, /계약\/C0_API\.md/);
  assert.ok(!/마찰신호\.md/.test(s), '기록처가 신호로 섰다 — 언제나 걸려서 곧 무시된다');
});

test('🔑 [급소] 승인 큐가 죽으면 조용히 빠지지 않는다', () => {
  const r = 패킷.잔여판정({ 마찰: 성공(마찰출력), 동결: 실패('일치 없음', 1), 승인: 실패('승인.js 없음') });
  assert.match(r.못잼.join(' '), /승인 큐/);
  assert.strictEqual(r.잰것, 2);
});

test('🔑 [급소] 전부 못 재면 빈칸이 «0» 이 아니라고 말한다', () => {
  const r = 패킷.잔여판정({ 마찰: null, 동결: null, 승인: null });
  assert.strictEqual(r.잰것, 0);
  assert.strictEqual(r.못잼.length, 3);
  assert.match(r.줄.join('\n'), /못 셌다/);
  assert.ok(!/기계가 세는 잔여 항목 0/.test(r.줄.join('\n')),
    '아무것도 못 잰 판이 「잔여 0」이라고 말했다 — 이 회귀의 존재 이유다');
});

// ─────────────────────────── json읽기 — 「읽었나」와 「무엇을」이 갈리나

test('[json읽기] 빈 배열은 «읽음» 이고 파싱 실패는 «못 읽음» 이다 — 둘은 다른 값이다', () => {
  assert.strictEqual(패킷.json읽기('[]').읽음, true);
  assert.strictEqual(패킷.json읽기('[]').값.length, 0);
  assert.strictEqual(패킷.json읽기('nope').읽음, false);
  assert.strictEqual(패킷.json읽기(null).읽음, false);
});

// ─────────────────────────── 인자 — sha 고르기

test('🔑 sha 가 플래그 값과 같은 문자열이어도 안 밀린다 (indexOf 는 첫 자리를 준다)', () => {
  assert.strictEqual(패킷.sha고르기(['--env', '운영', '운영']), '운영');
  assert.strictEqual(패킷.sha고르기(['운영', '--env', '운영']), '운영');
  assert.strictEqual(패킷.sha고르기(['abc123', '--env', '개발']), 'abc123');
  assert.strictEqual(패킷.sha고르기(['--env', '개발', 'abc123']), 'abc123');
  assert.strictEqual(패킷.sha고르기(['--영향', '한 줄', 'abc123']), 'abc123');
});

test('[인자] sha 가 없으면 null — 플래그 값을 sha 로 삼지 않는다', () => {
  assert.strictEqual(패킷.sha고르기(['--env', '운영']), null);
  assert.strictEqual(패킷.sha고르기([]), null);
});

// ─────────────────────────── 실저장소 — 계약만 (거짓양성만 검사 · 탐지력은 위 픽스처가 진다)

test('[계약] 판정 함수가 실제로 나온다 — 이름이 바뀌면 위 픽스처가 통째로 안 돈다', () => {
  for (const 이름 of ['잔여', '잔여관측', '테스트결과', '잔여판정', 'run판정', 'json읽기', 'sha고르기']) {
    assert.strictEqual(typeof 패킷[이름], 'function', `${이름} 이 안 나온다`);
  }
});

/** 주석을 걷어낸 소스 — 안 걷으면 JSDoc 의 `{{마찰:…}}` 까지 세어 **거짓 적색**이 난다
 *  (이 회귀를 처음 쓸 때 실제로 그렇게 났다 · 길이는 안 지킨다 — 여기선 개수만 센다). */
const { 코드만, 파일소스 } = require('./lib/소스검사.js');

test('🔑 ④ 의 관측 조립은 **한 벌**이다 — 두 벌이면 갈라지고 갈라진 쪽은 조용히 통과한다', () => {
  const 원문 = 코드만(파일소스(path.join(ROOT, 'tools', '증거패킷.js')));
  /* 세 탐침의 키가 두 번 이상 나오면 `패킷()` 이 `잔여관측()` 을 안 쓰고 제 손으로 조립한 것이다.
   * 그 상태에서 한쪽만 고치면 화면(④)과 모듈(잔여())이 다른 답을 내고, 새는 방향은 「통과」다. */
  for (const 키 of ['마찰:', '동결:', '승인:']) {
    const 횟수 = 원문.split(키).length - 1;
    assert.strictEqual(횟수, 1, `관측 키 ${키} 가 ${횟수}곳에 있다 — 조립이 갈라졌다(맹점 ④)`);
  }
});

test('[자기검사] 주석 걷기가 실제로 돈다 — 안 돌면 위 검사가 늘 빨갛거나 늘 초록이다', () => {
  assert.strictEqual(코드만('/* 마찰: 문서 */ const x = { 마찰: 1 };').split('마찰:').length - 1, 1);
  assert.strictEqual(코드만('// 동결: 주석\nconst y = 1;').trim(), 'const y = 1;');
});

test('[계약] 잔여관측()은 주입구로 돌고 세 탐침을 모두 채운다 — 하나라도 빠지면 분모가 준다', () => {
  const 관측 = 패킷.잔여관측('/없는/경로', { 있나: () => true, 실행: () => 성공('x') });
  for (const 키 of ['마찰', '동결', '승인']) {
    assert.ok(관측[키], `${키} 탐침이 비었다`);
  }
  const 없는장부 = 패킷.잔여관측('/없는/경로', { 있나: () => false, 실행: () => 성공('x') });
  assert.strictEqual(없는장부.마찰.ok, false, 'friction.js 가 없는데 「잰 것」으로 섰다');
});

test('[계약] 잔여판정의 분모는 필수 칸이다 — 빠지면 「0」을 검증 없이 말하게 된다', () => {
  const r = 패킷.잔여판정({});
  for (const 칸 of ['줄', '잰것', '전체', '못잼']) {
    assert.ok(Object.prototype.hasOwnProperty.call(r, 칸), `${칸} 칸이 없다(F543 처방 ㉠)`);
  }
  assert.ok(r.전체 > 0, '분모가 0이면 「잰 것 0/0」이 초록처럼 읽힌다');
});

test('[계약] 잔여()는 주입구로 돌아 실제 gh·git 없이도 재진다', () => {
  const 줄 = 패킷.잔여('/없는/경로', {
    있나: () => true,
    실행: (cmd) => (cmd === 'node' ? 성공(마찰출력) : 실패('일치 없음', 1)),
  });
  assert.ok(Array.isArray(줄));
  assert.match(줄.join('\n'), /열린 항목 89건/);
});

test('[계약] 테스트결과()는 주입구로 돌고, 못 읽은 판에서 대체 조회를 안 부른다', () => {
  let 호출 = 0;
  const r = 패킷.테스트결과('deadbeef', { 실행: () => { 호출 += 1; return 성공('not-json'); } });
  assert.strictEqual(r.못잼, true);
  assert.strictEqual(호출, 1, '못 읽은 판에서 대체 조회를 불렀다 — 그 실패까지 0으로 접힌다');
});

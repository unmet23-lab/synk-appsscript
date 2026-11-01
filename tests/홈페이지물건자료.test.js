'use strict';
// synk.im/builds/homepage(yuhobuilds Y29 나눔 자료) — 요청문 셈, 내용 원천과 실험 정본의 일치, 쪽 · PDF가 같은 원천인지.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOME = path.join(__dirname, '../docs/마케팅/맞춤도구/homepage');
const page = require(path.join(HOME, 'page.js'));
const { request, clean, MAX } = require(path.join(HOME, 'request.js'));
const data = page.read();
const 실험 = fs.readFileSync(path.join(__dirname, '../docs/마케팅/yuhobuilds_홈페이지다똑같다_20261031/자료/실험/요청문.md'), 'utf8');
const Y5 = fs.readFileSync(path.join(__dirname, '../docs/마케팅/yuhobuilds_AI화면한줄_20261025/자료/실험/요청문.md'), 'utf8');

test('요청문: 두 칸이 차면 실험에서 돌린 문장 그대로 완성된다', () => {
  const r = request(data.요청문, '1인 세무사 사무실', '문 앞 빨간 우체통');
  assert.equal(r.ready, true);
  assert.equal(r.text, '1인 세무사 사무실 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로. 우리 가게 문 앞 빨간 우체통의 색과 글씨로 화면을 만들어 줘.');
});

test('요청문: 칸이 비면 빈칸 자리를 보이고 복사를 막는다', () => {
  assert.deepEqual(request(data.요청문, '  ', '우체통'), { ready: false, text: '【업종】 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로. 우리 가게 우체통의 색과 글씨로 화면을 만들어 줘.' });
  assert.equal(request(data.요청문, '빵집', '').ready, false);
});

test('요청문: 업종 칸에 적은 「{물건}」이 다시 바뀌지 않는다(11-01 Fable)', () => {
  assert.equal(request(data.요청문, '{물건}집', '주황 매트').text, '{물건}집 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로. 우리 가게 주황 매트의 색과 글씨로 화면을 만들어 줘.');
});

test('링크 미리보기(og.html)의 제목 · 네 단계 숫자 · 결과가 내용.json과 같다(11-01 Fable)', () => {
  const og = fs.readFileSync(path.join(HOME, 'og.html'), 'utf8');
  assert.ok(og.includes(`${data.제목}<br><span>${data.부제}</span>`));
  for (const s of data.단계) assert.ok(og.includes(`<b>${s.수}</b><span>${s.결과}</span>`), `${s.id}: ${s.수} ${s.결과}`);
});

test('요청문: 줄바꿈 · 겹친 띄어쓰기를 한 칸으로, 긴 글은 자른다, 특수 글자는 그대로 둔다', () => {
  assert.equal(clean(' 문 앞\n\n빨간   우체통 ', MAX.object), '문 앞 빨간 우체통');
  assert.equal(clean('가'.repeat(100), MAX.kind).length, MAX.kind);
  assert.ok(request(data.요청문, '$& 가게', '$1 <b>').text.startsWith('$& 가게 홈페이지'));
  assert.ok(request(data.요청문, '빵집', '$1 <b>').text.includes('우리 가게 $1 <b>의 색과'));
});

test('내용 원천이 검사를 통과하고 그림 56장이 다 있다', () => {
  assert.deepEqual(page.check(data), []);
  assert.deepEqual(page.missingShots(data), []);
});

test('요청문 틀 · 붙인 말 · 물건이 실험 정본과 글자까지 같다', () => {
  assert.ok(Y5.includes('동네 빵집 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로.'));
  assert.ok(data.요청문.startsWith('{업종} 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로.'));
  assert.ok(실험.includes('의 색과 글씨로 화면을 만들어 줘.'));
  const [, 물건을고르게, 종이빼고] = data.단계;
  assert.ok(Y5.includes(물건을고르게.붙인말));
  assert.ok(실험.includes(`그 물건의 색과 글씨로 화면을 만들어 줘. ${종이빼고.붙인말}`));
  for (const p of data.판) assert.ok(실험.includes(p.물건), `${p.물건}이 요청문.md에 없다`);
});

test('네 단계 숫자가 실험 기록과 같고, 몰린 판 수는 원천 안에서 맞물린다', () => {
  assert.deepEqual(data.단계.map((s) => s.수), ['7/7', '6/7', '5/7', '7/7']);
  assert.ok(실험.includes('7판 가운데 **5판이 짙은 초록'));
  assert.ok(실험.includes('7판 모두 준 물건을 그대로 따랐다'));
  assert.ok(실험.includes('한줄B에서 7판 중 6판이 종이'));
});

test('검사가 확인 범위 밖의 말을 잡는다', () => {
  const 고침 = (fn) => { const d = JSON.parse(JSON.stringify(data)); fn(d); return page.check(d); };
  assert.ok(고침((d) => { d.요약 = '이 한 줄이면 손님이 늘어요.'; }).some((m) => m.includes('손님')));
  assert.ok(고침((d) => { d.요약 = '다른 AI에서도 똑같이 돼요.'; }).some((m) => m.includes('다른 AI')));
  assert.ok(고침((d) => { d.요약 = '화면은 AI 생성입니다.'; }).some((m) => m.includes('AI 생성')));
  assert.ok(고침((d) => { d.한계 = d.한계.filter((r) => !r.글.includes('추측')); }).some((m) => m.includes('추측')));
  assert.ok(고침((d) => { d.단계[1].수 = '5/7'; }).some((m) => m.includes('몰린 판')));
  // 물건 · 붙인 말 · 알림 글도 본다(11-01 아르곤 A6)
  assert.ok(고침((d) => { d.판[0].물건 = '손님이 늘어나는 물뿌리개'; }).some((m) => m.includes('손님')));
  assert.ok(고침((d) => { d.만들기.알림.복사됨 = '다른 AI에서도 똑같이 돼요.'; }).some((m) => m.includes('다른 AI')));
});

test('몰린 판은 노란 테만이 아니라 대체 글에도 적고, 물건 이름 뒤에 조사를 붙이지 않는다', () => {
  const html = page.renderPage(data);
  const 몰린 = data.단계.reduce((n, s) => n + s.몰린판.length, 0);
  assert.equal((html.match(/ alt="[^"]*, 한쪽으로 몰린 판"/g) || []).length, 몰린);
  assert.doesNotMatch(html, /(개|니|트|함|판|통|양)으로 만든/);
});

test('쪽과 PDF 원고가 같은 글을 싣는다', () => {
  const html = page.renderPage(data), guide = page.renderGuide(data);
  const 공통 = [data.제목, data.부제, data.요약, data.이렇게.머리, data.고르는법.머리, ...data.구역];
  for (const s of data.단계) 공통.push(s.이름, s.수, s.결과, s.풀이);
  for (const r of data.고르는법.기준) 공통.push(r.제목, r.글);
  for (const r of data.한계) 공통.push(r.제목, r.글);
  for (const p of data.판) 공통.push(p.이름, p.물건);
  for (const t of 공통) {
    assert.ok(html.includes(t), `쪽에 없다: ${t}`);
    assert.ok(guide.includes(t), `PDF에 없다: ${t}`);
  }
  assert.ok(guide.includes('__HEIGHT__'));
});

test('쪽은 서버로 보내는 코드 · 저장 코드가 없고, 공개 파일에 사람 이름이 없다', () => {
  const view = fs.readFileSync(path.join(HOME, 'view.js'), 'utf8') + fs.readFileSync(path.join(HOME, 'request.js'), 'utf8');
  assert.doesNotMatch(view, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  // 보이는 글은 view.js에 적지 않는다 — 알림 세 줄도 내용.json에서 온다(11-01 아르곤 G1)
  for (const t of Object.values(data.만들기.알림)) assert.ok(!view.includes(t) && page.renderPage(data).includes(t), t);
  const html = page.renderPage(data) + page.renderGuide(data);
  assert.doesNotMatch(html, /한서윤|韓瑞允|김도윤/);
  assert.match(html, /data-template="\{업종\} 홈페이지/);
});

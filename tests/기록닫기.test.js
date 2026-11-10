'use strict';

// 기록 닫기 — 지어낸 결정 표 · 트랙과 임시 git 저장소로만 본다. 실제 결정 · 트랙 · origin은 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 닫기도구 = require('../tools/기록닫기.js');
const 결정도구 = require('../tools/결정.js');

const 행 = (날짜, 성격, 결정, 근거 = '근거') => `| ${날짜} | ${성격} | ${결정} | ${근거} |`;
const 결정본문 = (...행들) => ['# 현재 결정', '', '> 머리말', '', 닫기도구.시작표식, '| 날짜 | 성격 | 결정 | 근거 |', '|---|---|---|---|', ...행들, 닫기도구.끝표식, ''].join('\n');
const 없음 = () => null;

test('결정 표: 14일째 행은 남고 15일째 확정 행만 넘어간다 — 안전 · 성격 모름 · 깨진 줄은 남는다', () => {
  const 문 = 결정본문(
    행('2026-11-11', '확정', '14일째'), 행('2026-11-10', '확정', '15일째'), 행('2026-09-01', '안전', '오래된 보호 절차'),
    행('2026-09-01', '보류', '성격 모름'), 행('2026-9-1', '확정', '날짜 깨짐'), 행('2026-08-01', '확정', '아주 오래됨'),
  );
  const r = 닫기도구.결정넘기기(문, 없음, { 오늘: '2026-11-25' });
  assert.deepEqual(r.옮김.map((x) => x.머리), ['15일째', '아주 오래됨']);
  assert.deepEqual(r.셈, { 행: 5, 안전: 1, 최근: 1, 성격모름: 1, 깨짐: 1, 못읽음: 0, 옮김: 2 });
  for (const 남을 of ['14일째', '오래된 보호 절차', '성격 모름', '날짜 깨짐']) assert.ok(r.문.includes(남을), 남을);
  for (const 갈 of ['15일째', '아주 오래됨']) assert.ok(!r.문.includes(갈), 갈);
  assert.ok(r.문.includes(닫기도구.시작표식) && r.문.includes(닫기도구.끝표식) && r.문.includes('|---|---|---|---|'));
  // 달마다 따로, 없던 보관 파일은 머리부터
  assert.deepEqual([...r.보관.keys()], ['2026-08', '2026-11']);
  const 십일월 = r.보관.get('2026-11').split('\n');
  assert.equal(십일월[0], '# 지난 결정 · 2026-11');
  assert.ok(십일월.includes('## 2026-11-25에 옮김 · 14일 지남'));
  assert.ok(십일월.includes('| 날짜 | 성격 | 결정 | 근거 |') && 십일월.includes(행('2026-11-10', '확정', '15일째')));
  assert.equal(r.보관.get('2026-11').endsWith('\n'), true);
  // 옮긴 뒤에도 결정 도구가 그대로 읽는다
  const 다시 = 결정도구.읽기문(r.문, '2026-11-25');
  assert.equal(다시.목록.length, 3);
  assert.equal(다시.깨짐.length, 1);
});

test('결정 표: 옮길 것이 없으면 글이 바이트 그대로다', () => {
  const 문 = 결정본문(행('2026-11-20', '확정', '최근'), 행('2026-01-01', '안전', '보호'));
  const r = 닫기도구.결정넘기기(문, 없음, { 오늘: '2026-11-25' });
  assert.equal(r.문, 문);
  assert.equal(r.보관.size, 0);
});

test('결정 표: 칸이 모자라 못 읽은 행과 줄바꿈으로 갈라진 행은 남기고 드러낸다', () => {   // Fable 검수 P2 — 실제 표에 | 가 빠진 행 셋이 있었다
  const 문 = 결정본문(
    '| 2026-08-01 | 확정 | 결정과 근거 사이 막대가 빠진 행. 근거는 [기획](../a.md). |',
    '| 2026-08-02 | 확정 | 갈라진 행의 앞 토막 | 근거가',
    '다음 줄로 넘어갔다 |',
    행('2026-08-03', '확정', '멀쩡한 옛 행'),
  );
  const r = 닫기도구.결정넘기기(문, 없음, { 오늘: '2027-03-01' });
  assert.deepEqual(r.옮김.map((x) => x.머리), ['멀쩡한 옛 행']);
  assert.equal(r.셈.못읽음, 1);
  assert.equal(r.셈.깨짐, 1);
  assert.equal(r.못읽은.length, 1);
  assert.ok(r.못읽은[0].startsWith('| 2026-08-01 | 확정 | 결정과 근거 사이'));
  assert.ok(r.문.includes('막대가 빠진 행') && r.문.includes('갈라진 행의 앞 토막 | 근거가\n다음 줄로 넘어갔다 |'));
  assert.ok(!r.보관.get('2026-08').includes('갈라진 행'));
});

test('결정 표: 있던 보관 글은 그대로 두고 끝에 붙인다', () => {
  const 옛 = '# 지난 결정 · 2026-10\n\n> 머리\n\n## 2026-11-02에 옮김 · 다이어트 시험\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n| 2026-10-01 | 확정 | 옛 행 | 근거 |\n\n\n';
  const r = 닫기도구.결정넘기기(결정본문(행('2026-10-05', '확정', '새로 넘길 행')), (달) => (달 === '2026-10' ? 옛 : null), { 오늘: '2026-11-25' });
  const 새 = r.보관.get('2026-10');
  assert.ok(새.startsWith(옛.trimEnd()));
  assert.ok(새.endsWith(`## 2026-11-25에 옮김 · 14일 지남\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n${행('2026-10-05', '확정', '새로 넘길 행')}\n`));
  assert.equal(새.includes('\n\n\n'), false);
});

test('결정 표: 옮긴 행의 상대 링크만 보관 폴더에 맞춘다(백틱 안 · 바깥 주소는 그대로)', () => {
  const 원 = 행('2026-10-05', '확정', '[가](../x.md#a) · [나](qa/y.json) · [다](#z) · [라](보관/결정_2026-10.md) · [마](https://e.x/p) · [바](./트랙.md) · `[사](../no.md)` · [아](<../길 이름.md>)');
  const r = 닫기도구.결정넘기기(결정본문(원), 없음, { 오늘: '2026-11-25' });
  const 붙은 = r.보관.get('2026-10').split('\n').find((l) => l.startsWith('| 2026-10-05'));
  assert.equal(붙은, 행('2026-10-05', '확정', '[가](../../x.md#a) · [나](../qa/y.json) · [다](../결정.md#z) · [라](결정_2026-10.md) · [마](https://e.x/p) · [바](../트랙.md) · `[사](../no.md)` · [아](<../../길 이름.md>)'));
});

test('결정 표: CRLF 파일은 CRLF로 남고, CRLF가 한두 줄 섞인 LF 보관에는 LF로 붙인다', () => {
  const 문 = 결정본문(행('2026-11-20', '확정', '최근'), 행('2026-10-05', '확정', '넘길 행')).replace(/\n/g, '\r\n');
  const 옛보관 = '# 지난 결정 · 2026-10\r\n\r\n옛 줄\r\n';
  const r = 닫기도구.결정넘기기(문, () => 옛보관, { 오늘: '2026-11-25' });
  assert.equal(/[^\r]\n/.test(r.문), false);
  assert.equal(/[^\r]\n/.test(r.보관.get('2026-10')), false);
  assert.equal(결정도구.읽기문(r.문, '2026-11-25').목록.length, 1);
  const 섞인 = '# 지난 결정 · 2026-10\n\n줄 하나\n줄 둘\r\n줄 셋\n';
  const 붙인 = 닫기도구.결정넘기기(결정본문(행('2026-10-05', '확정', '넘길 행')), () => 섞인, { 오늘: '2026-11-25' }).보관.get('2026-10');
  assert.equal(붙인.slice(섞인.length).includes('\r'), false);
});

test('결정 표: 이미 보관에 있는 행은 다시 붙이지 않는다(쓰다 끊긴 회차를 다시 돌릴 때)', () => {
  const 문 = 결정본문(행('2026-10-05', '확정', '넘길 행'));
  const 첫 = 닫기도구.결정넘기기(문, 없음, { 오늘: '2026-11-25' });
  const 둘 = 닫기도구.결정넘기기(문, () => 첫.보관.get('2026-10'), { 오늘: '2026-11-25' });
  assert.equal(둘.보관.size, 0);
  assert.equal(둘.옮김.length, 1);
  assert.ok(!둘.문.includes('넘길 행'));
});

test('결정 표: 표식이 없거나 글이 없으면 멈춘다', () => {
  assert.ok(닫기도구.결정넘기기('# 표식 없는 글\n', 없음, { 오늘: '2026-11-25' }).멈춤);
  assert.ok(닫기도구.결정넘기기(null, 없음, { 오늘: '2026-11-25' }).멈춤);
});

test('닫힘 읽기: 줄 끝의 「남은 일: 없음」 하나만 닫힘이다', () => {
  const 본 = (글) => 닫기도구.닫힘읽기(글);
  for (const 글 of ['공개 끝. 남은 일: 없음.', '남은 일 없음', '**남은 일: 없음**', '남음: 없음', '남은 것은 없다.', '남은 일이 없습니다', '끝. `남은 일: 없음`', '(남은 일: 없음)',
    '남은 것：없음 — 참고: 첫 유실 기록은 현장 노트', '남은 일 없음. 근거: 결정 표 11-10 행', '남은 일: 없음 · [결과](qa/r.md)', '27" 화면에서 봄. 남은 일: 없음']) {
    assert.deepEqual(본(글), { 닫힘: true, 열림: false }, 글);
  }
  // 조건이 붙거나 설명하는 글 — Fable 검수: 바로 붙은 글자만 보던 판 · 앞머리만 보던 판은 이것들을 닫힘으로 읽었다
  for (const 글 of ['남은 일: 없음(실기 확인 뒤)', '남은 일: 없음 (실기 확인 뒤)', '남은 일: 없음 — 다만 실기 확인은 유호님', '남은 일: 없음, 단 공개는 다음 판', '남은 일: 없음. 다만 번역은 뒤에',
    '끝난 줄은 **남은 일: 없음**으로 닫는다', '끝난 줄에 `남은 일: 없음` 표시를 적는다', "'남은 일: 없음'으로 닫는다", '"남은 일: 없음"이라고 적는다', '남은 일이 없다면 닫는다',
    '남은 일: 없음. 결과 화면은 유호님 확인 대기', '남은 일: 없음. 참고로 실기 확인은 유호님이 한다', '남은 일: 없음 [다만 번역은 뒤에](x.md)', '남은 일: 없음 「다만 유호님 확인 대기」', '남은 일: 없음. 참고: 번역은 유호님 확인 대기']) {
    const r = 본(글);
    assert.deepEqual([r.닫힘, r.열림], [false, true], 글);
    assert.match(r.까닭, /뒤에 글이 이어진다/, 글);
  }
  // 열린 칸의 여러 꼴 — Fable 검수: 「남은 일:」 꼴만 읽던 판은 괄호 · 줄표 · 다른 낱말 꼴을 못 봤다(실제 트랙에 있는 꼴들)
  for (const 글 of ['남은 일: 실기 확인', '남은 일(유호님): 새 컷을 구울지', '남은 것(막지 않음): 인스타 연결', '남음(Claude): 번역', '남은 일 — 실기 확인', '**남은 것 하나:** 폰 확인', '남은 일은 실기 확인이다', '실기 확인이 남은 일이다',
    '남은 확인: 유튜브 자격 읽기', '남은 확인(10-21): 폰 화면', '남은 고를 것: 실제로 영업할 업체', '남은 유호님 몫(선택): 신고', '남은 정할 것 셋(11-10): 기준', '남은 일정은 다음 주', '27" 화면에서 봄. 남은 일(유호님): 32" 화면 확인',
    '남은일: 실기 확인', '남은것은 번역 검수']) {
    assert.deepEqual(본(글), { 닫힘: false, 열림: true }, 글);
  }
  // 붙여 쓴 닫힘 표시도 닫힘이고, 곧은 따옴표로 인용한 표시는 줄 끝에 있어도 닫힘이 아니다 — Fable 셋째 검수
  assert.deepEqual(본('끝. 남은일: 없음'), { 닫힘: true, 열림: false });
  for (const 글 of ['끝난 줄은 줄 끝에 "남은 일: 없음"', "줄 끝에 '남은 일: 없음'."]) {
    const r = 본(글);
    assert.deepEqual([r.닫힘, r.열림], [false, true], 글);
    assert.match(r.까닭, /따옴표로 인용한/, 글);
  }
  // 칸이 여럿이면 하나가 없음이어도 닫힘이 아니다
  for (const 글 of ['가는 남은 일: 없음, 나는 남은 일: 실기 확인', '남은 일(유호님): 새 컷. Claude 몫은 남은 일: 없음.', '남은 것(유호님 휴대폰 앱): 연결. 저장소 쪽은 남은 일 없음.',
    '남은 확인: tools/sns-발행.js의 유튜브 자격 읽기. Claude 몫은 남은 일: 없음.', '남은 일정은 미정이었지만 끝. 남은 일: 없음']) {
    const r = 본(글);
    assert.deepEqual([r.닫힘, r.열림], [false, true], 글);
    assert.match(r.까닭, /여럿/, 글);
  }
  // 인용한 것 · 칸이 아닌 낱말
  for (const 글 of ['끝난 줄은 「남은 일: 없음」으로 닫는다', '“남은 일: 없음”이라고 적는다', '끝났다', '로그 파일이 남음.', '살아남은것만 옮김']) {
    assert.deepEqual(본(글), { 닫힘: false, 열림: false }, 글);
  }
});

const 트랙글 = (...줄) => 줄.join('\n');

test('트랙: 닫힌 맨 윗줄은 곁줄째 옮기고, 뺀 자리의 빈 줄은 하나만 남긴다', () => {
  const 문 = 트랙글('# 이어갈 작업', '', '- **가(11-01):** 하는 중. 남은 일: 실기 확인', '', '- **나(11-02):** 공개 끝. 남은 일: 없음. [결과](qa/r.md)', '  - 곁줄 하나', '    깊은 줄', '', '- **다(11-03):** 다음: 시안', '');
  const r = 닫기도구.트랙닫기(문, null, { 오늘: '2026-11-11' });
  assert.equal(r.문, 트랙글('# 이어갈 작업', '', '- **가(11-01):** 하는 중. 남은 일: 실기 확인', '', '- **다(11-03):** 다음: 시안', ''));
  assert.deepEqual(r.옮김, [{ 절: '이어갈 작업', 머리: '나(11-02):', 줄수: 3, 곁줄: false }]);
  assert.equal(r.보관글, 트랙글('# 끝난 작업 · 2026-11', '', '> [이어갈 작업](../트랙.md)에서 옮긴 완료 항목이다. 기존 본문과 증거는 보존하고 상대 링크를 이 폴더에 맞췄다.', '',
    '## 이어갈 작업에서 (2026-11-11, 닫힘 표시)', '', '- **나(11-02):** 공개 끝. 남은 일: 없음. [결과](../qa/r.md)', '  - 곁줄 하나', '    깊은 줄', ''));
  assert.deepEqual(r.셈, { 목록줄: 3, 칸없음: 1, 옮김: 1 });
});

test('트랙: 열린 부모 아래 닫힌 곁줄은 부모 머리를 달고 혼자 간다', () => {
  const 문 = 트랙글('## 5. 게임', '', '- **환승 러시(11-05):** 화면 마감 중. 남은 일: 소리', '  - **카드 그림:** 다시 구움.', '    이어 쓴 줄. 남은 일: 없음', '  - **단추:** 남은 일: 색', '');
  const r = 닫기도구.트랙닫기(문, null, { 오늘: '2026-11-11' });
  assert.equal(r.문, 트랙글('## 5. 게임', '', '- **환승 러시(11-05):** 화면 마감 중. 남은 일: 소리', '  - **단추:** 남은 일: 색', ''));
  assert.deepEqual(r.옮김, [{ 절: '5. 게임', 머리: '카드 그림:', 줄수: 2, 곁줄: true }]);
  const 붙은 = r.보관글.split('\n');
  assert.deepEqual(붙은.slice(붙은.indexOf('## 5. 게임에서 (2026-11-11, 닫힘 표시)')), ['## 5. 게임에서 (2026-11-11, 닫힘 표시)', '', '- 「환승 러시(11-05):」의 곁줄', '  - **카드 그림:** 다시 구움.', '    이어 쓴 줄. 남은 일: 없음', '']);
});

test('트랙: 닫힌 부모 안의 닫힌 곁줄은 부모와 함께 한 번만 간다', () => {
  const 문 = 트랙글('- **가:** 끝. 남은 일: 없음', '  - **곁:** 끝. 남은 일: 없음', '- **나:** 남은 일: 있음', '');
  const r = 닫기도구.트랙닫기(문, null, { 오늘: '2026-11-11' });
  assert.equal(r.옮김.length, 1);
  assert.equal(r.문, 트랙글('- **나:** 남은 일: 있음', ''));
  assert.equal(r.보관글.split('\n').filter((l) => l.includes('**곁:**')).length, 1);
});

test('트랙: 열린 칸 · 조건 · 곁줄의 남은 일 · 앵커가 있으면 남긴다', () => {
  const 문 = 트랙글(
    '- **가:** 앞은 남은 일: 없음, 뒤는 남은 일: 실기 확인',
    '- **나:** 남은 일: 없음',
    '  - 곁줄 — 남은 것(유호님): 번역',
    '- <a id="keep"></a>**다:** 남은 일: 없음',
    '- **라:** 남은 일: 없음(다음 판에서 다시)',
    '- **마:** 남은 일: 없음',
    '  1. 번호 곁줄. 남은 일 — 색 고르기',
    '- **바:** 남은 일: 없음',
    '  * 별표 곁줄',
    '',
    '  곁줄들 뒤에 이어 쓴 문단. 남은 일: 실기 확인',
    '');
  const r = 닫기도구.트랙닫기(문, null, { 오늘: '2026-11-11' });
  assert.equal(r.문, 문);
  assert.equal(r.보관글, null);
  assert.deepEqual(r.남김.map((x) => `${x.머리} ${x.까닭.slice(0, 9)}`), ['가: 「남은 …」 칸이', '나: 곁줄에 열린 「남', '다: 앵커가 있어 손으', '라: 닫힘 표시 뒤에 ', '마: 곁줄에 열린 「남', '바: 곁줄 아래 글에 ']);
});

test('트랙: 인용 속 닫힘 표시 · 코드 울타리 안 줄은 읽지 않고, 한 줄 코드는 울타리로 세지 않는다', () => {
  const 줄 = ['- **규칙:** 끝난 줄은 「남은 일: 없음」으로 닫는다. 남은 일: 세션들이 쓰는지 한 주 보기', '', '```', '- 예시 줄. 남은 일: 없음', '```', '',
    '- **끝난 일:** 다시 돌리는 법은 곁줄. 남은 일: 없음', '  - ```node tools/x.js```', '  ```node tools/y.js```', '- **다음 줄:** 남은 일: 검수', '', '## 다음 절', '', '- **멀쩡한 줄:** 남은 일: 시안', ''];
  // Fable 검수 P2 — 한 줄 코드(```…```)를 울타리로 세면 그 줄부터 파일 끝까지 한 덩어리가 됐다
  assert.deepEqual(닫기도구.트랙덩어리(줄).map((d) => [d.시작, d.끝, d.부모]), [[0, 1, null], [6, 9, null], [7, 8, 1], [9, 10, null], [13, 14, null]]);
  const r = 닫기도구.트랙닫기(줄.join('\n'), null, { 오늘: '2026-11-11' });
  assert.deepEqual(r.옮김.map((x) => [x.머리, x.줄수]), [['끝난 일:', 3]]);
  assert.equal(r.문, 트랙글('- **규칙:** 끝난 줄은 「남은 일: 없음」으로 닫는다. 남은 일: 세션들이 쓰는지 한 주 보기', '', '```', '- 예시 줄. 남은 일: 없음', '```', '',
    '- **다음 줄:** 남은 일: 검수', '', '## 다음 절', '', '- **멀쩡한 줄:** 남은 일: 시안', ''));
});

test('트랙: 절 › 소절 이름으로 묶고 CRLF는 CRLF로 남는다 — 끝 줄바꿈이 없던 글에서 마지막 줄을 빼도 홀 CR이 남지 않는다', () => {
  const 문 = 트랙글('## 1. 유호님 차례', '', '### 고르실 것', '', '- **가:** 정함. 남은 일: 없음', '', '## 6. 콘텐츠', '', '- **나:** 올림. 남은 일: 없음', '- **다:** 남은 일: 자막', '').replace(/\n/g, '\r\n');
  const 옛 = '# 끝난 작업 · 2026-11\r\n\r\n옛 줄\r\n';
  const r = 닫기도구.트랙닫기(문, 옛, { 오늘: '2026-11-11' });
  assert.equal(/[^\r]\n/.test(r.문), false);
  assert.equal(/[^\r]\n/.test(r.보관글), false);
  const 붙은 = r.보관글.replace(/\r/g, '').split('\n');
  assert.ok(붙은.includes('## 1. 유호님 차례 › 고르실 것에서 (2026-11-11, 닫힘 표시)') && 붙은.includes('## 6. 콘텐츠에서 (2026-11-11, 닫힘 표시)'));
  assert.ok(r.보관글.startsWith(옛.trimEnd()));
  const 끝없음 = '- **가:** 남은 일: 검수\r\n- **나:** 끝. 남은 일: 없음';
  assert.equal(닫기도구.트랙닫기(끝없음, null, { 오늘: '2026-11-11' }).문, '- **가:** 남은 일: 검수');
});

test('트랙: 덩어리가 통째로 보관에 이어져 있을 때만 다시 붙이지 않는다 — 첫 줄만 같은 다른 덩어리는 붙인다', () => {   // Fable 검수 P1 — 첫 줄만 보던 판은 곁줄을 잃었다
  const 문 = 트랙글('- **B37 편:** 만드는 중. 남은 일: 자막', '  - **검수:** 통과. 남은 일: 없음', '    - 영수증 [b37](qa/b37.json)', '');
  // 어제 다른 편의 곁줄이 같은 글자로 보관에 들어가 있다
  const 어제 = 트랙글('# 끝난 작업 · 2026-11', '', '## 6. 콘텐츠에서 (2026-11-10, 닫힘 표시)', '', '- 「B37 편:」의 곁줄', '  - **검수:** 통과. 남은 일: 없음', '');
  const r = 닫기도구.트랙닫기(문, 어제, { 오늘: '2026-11-11' });
  assert.equal(r.옮김.length, 1);
  assert.ok(r.보관글 !== null, '첫 줄이 같아도 덩어리가 다르면 붙인다');
  assert.ok(r.보관글.includes('    - 영수증 [b37](../qa/b37.json)'));
  assert.ok(!r.문.includes('영수증'));
  // 보관에는 붙었는데 트랙을 못 쓴 채 끊긴 회차 — 다시 돌리면 트랙에서만 뺀다
  const 둘 = 닫기도구.트랙닫기(문, r.보관글, { 오늘: '2026-11-11' });
  assert.equal(둘.보관글, null);
  assert.equal(둘.옮김.length, 1);
  assert.equal(둘.문, 트랙글('- **B37 편:** 만드는 중. 남은 일: 자막', ''));
});

test('검산: 빠진 줄이 계획과 다르거나, 보관의 옛 내용이 바뀌었거나, 빠진 줄이 보관에 없으면 던진다', () => {
  assert.doesNotThrow(() => 닫기도구.검산('시험', 'a\nb\nc\n', 'a\nc\n', ['b'], [['옛\n', '옛\n\nb\n', ['b']]]));
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\nc\n', 'a\n', ['b'], []), /빠진 줄/);
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\n', 'a\nx\n', ['b'], []), /없던 줄/);
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\n', 'a\n', ['b'], [['옛\n', '다른\nb\n', ['b']]]), /보관의 옛 내용/);
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\nc\n', 'a\n', ['b', 'c'], [['옛\n', '옛\n\nb\n', ['b', 'c']]]), /옮긴 줄 1개가 보관에 없다/);
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\n', 'a\n', ['b'], [[null, null, ['b']]]), /보관에 없다/);
  // 같은 글자의 줄이 둘인데 보관에 이미 하나 있어 다시 붙이지 않은 날 — 개수가 아니라 있음으로 본다(Fable 둘째 검수: 날마다 던졌다)
  assert.doesNotThrow(() => 닫기도구.검산('시험', 'a\nb\nb\n', 'a\n', ['b', 'b'], [['옛\nb\n', '옛\nb\n', ['b', 'b']]]));
  // 이번에 붙이기로 한 줄은 개수까지 이번에 붙인 꼬리에 있어야 한다 — 같은 글자의 줄이 보관의 옛 자리에 있다는 것만으로 통과하지 않는다
  assert.doesNotThrow(() => 닫기도구.검산('시험', 'a\nb\n', 'a\n', ['b'], [['옛\nb\n', '옛\nb\n\n## 머리\n\nb\n', ['b'], ['b']]]));
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\n', 'a\n', ['b'], [['옛\nb\n', '옛\nb\n\n## 머리\n', ['b'], ['b']]]), /붙이기로 한 줄 1개가 이번에 붙인 자리에 없다/);
  assert.throws(() => 닫기도구.검산('시험', 'a\nb\nb\n', 'a\n', ['b', 'b'], [[null, '# 머리\n\nb\n', ['b', 'b'], ['b', 'b']]]), /붙이기로 한 줄 1개/);
});

function 방만들기(이름) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), `synk-records-${이름}-`));
  return { 방, 치우기: () => fs.rmSync(방, { recursive: true, force: true, maxRetries: 3 }) };
}
const 쓰기 = (뿌리, 상대, 글) => { const p = path.join(뿌리, ...상대.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
const 읽기 = (뿌리, 상대) => fs.readFileSync(path.join(뿌리, ...상대.split('/')), 'utf8');

test('닫기: 작업본 파일을 고치고, 다시 돌리면 옮길 것이 없다', () => {
  const { 방, 치우기 } = 방만들기('fs');
  try {
    쓰기(방, 'docs/_ops/결정.md', 결정본문(행('2026-11-20', '확정', '최근'), 행('2026-10-05', '확정', '넘길 행 [가](트랙.md)')));
    쓰기(방, 'docs/_ops/트랙.md', 트랙글('# 이어갈 작업', '', '- **가:** 남은 일: 없음', '- **나:** 남은 일: 검수', ''));
    const 미리 = 닫기도구.닫기(방, { 오늘: '2026-11-25' });
    assert.deepEqual(미리.바뀐경로.sort(), ['docs/_ops/결정.md', 'docs/_ops/보관/결정_2026-10.md', 'docs/_ops/보관/트랙_2026-11.md', 'docs/_ops/트랙.md']);
    assert.ok(읽기(방, 'docs/_ops/결정.md').includes('넘길 행'), '미리 보기는 쓰지 않는다');
    const r = 닫기도구.닫기(방, { 오늘: '2026-11-25', 실행: true });
    assert.deepEqual(r.재기, { 결정: { 행: 1, KB: r.재기.결정.KB, 안전: 0, 못읽음: 0, 옮김: 1 }, 트랙: { 목록줄: 1, KB: r.재기.트랙.KB, 칸없음: 0, 옮김: 1, 남김: 0 } });
    assert.ok(!읽기(방, 'docs/_ops/결정.md').includes('넘길 행'));
    assert.ok(읽기(방, 'docs/_ops/보관/결정_2026-10.md').includes('넘길 행 [가](../트랙.md)'));
    assert.ok(읽기(방, 'docs/_ops/보관/트랙_2026-11.md').includes('- **가:** 남은 일: 없음'));
    assert.equal(읽기(방, 'docs/_ops/트랙.md'), 트랙글('# 이어갈 작업', '', '- **나:** 남은 일: 검수', ''));
    assert.deepEqual(닫기도구.닫기(방, { 오늘: '2026-11-25', 실행: true }).바뀐경로, []);
    // 크기는 줄끝과 상관없이 같다(작업본은 CRLF, origin 판은 LF)
    const lf = 결정본문(행('2026-11-20', '확정', '최근'));
    쓰기(방, 'docs/_ops/결정.md', lf.replace(/\n/g, '\r\n'));
    const crlf크기 = 닫기도구.닫기(방, { 오늘: '2026-11-25' }).재기.결정.KB;
    쓰기(방, 'docs/_ops/결정.md', lf);
    assert.equal(crlf크기, 닫기도구.닫기(방, { 오늘: '2026-11-25' }).재기.결정.KB);
  } finally { 치우기(); }
});

const g = (폴더, 인자) => {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', '-c', 'user.name=시험', '-c', 'user.email=t@example.invalid', ...인자], { cwd: 폴더, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${인자.join(' ')} 실패: ${r.stderr}`);
  return r.stdout;
};
/** 맨 저장소(origin) + 공용 작업본 하나. 결정 · 트랙 · 다른 파일 하나를 올려 둔다. */
function 저장소만들기(이름, { autocrlf = 'false' } = {}) {
  const { 방, 치우기 } = 방만들기(이름);
  const origin = path.join(방, 'origin.git'), 공용 = path.join(방, 'main');
  g(방, ['init', '-q', '--bare', '-b', 'master', origin]);
  g(방, ['clone', '-q', origin, 공용]);
  g(공용, ['config', 'core.autocrlf', autocrlf]);   // 이 PC의 전역 설정과 상관없이 시험마다 정한다(연결 사본도 같은 설정을 본다)
  g(공용, ['config', 'user.name', '시험']); g(공용, ['config', 'user.email', 't@example.invalid']);
  const 줄끝 = (s) => (autocrlf === 'true' ? s.replace(/\n/g, '\r\n') : s);
  쓰기(공용, 'docs/_ops/결정.md', 줄끝(결정본문(행('2026-11-20', '확정', '최근'), 행('2026-10-05', '확정', '넘길 행'), 행('2026-10-01', '안전', '보호'))));
  쓰기(공용, 'docs/_ops/트랙.md', 줄끝(트랙글('# 이어갈 작업', '', '- **가:** 끝. 남은 일: 없음', '- **나:** 남은 일: 검수', '')));
  쓰기(공용, 'docs/_ops/보관/결정_2026-10.md', 줄끝('# 지난 결정 · 2026-10\n\n옛 줄\n'));
  쓰기(공용, 'tools/다른파일.txt', 줄끝('사본에 꺼내지 않는 파일\n'));
  g(공용, ['add', '-A']); g(공용, ['commit', '-q', '-m', '처음']); g(공용, ['push', '-q', 'origin', 'HEAD:master']);
  return { 방, origin, 공용, 치우기 };
}
/** 시험용 올리기 — 사본에서 그 경로만 커밋해 origin에 올린다(실제 길은 tools/lib/git-publish-core.cjs 올리기). push 직전 고리도 부른다. */
const 가짜올리기 = (본것, 직전 = () => {}) => async ({ 저장소, 경로들, 메시지, 실행, 공용안따라감, 시험고리 }) => {
  본것.push({ 저장소, 경로들: [...경로들].sort(), 실행, 공용안따라감, 사본파일: fs.readdirSync(저장소).sort(), 메시지 });
  g(저장소, ['add', '--', ...경로들]); g(저장소, ['commit', '-q', '-m', 메시지]);
  직전(본것.length);
  시험고리.push직전(1);
  g(저장소, ['push', '-q', 'origin', 'HEAD:master']);
  return { 결과: '올림', 머리: g(저장소, ['rev-parse', 'HEAD']).trim() };
};
const 사본목록 = (공용) => g(공용, ['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).length;
/** 다른 세션이 origin에 올린 셈 — 옆 복제본에서 트랙을 고쳐 올린다. 받기는 옵션. */
function 남이올림(s, 고치기, 받기 = true) {
  const 옆 = path.join(s.방, `peer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  g(s.방, ['clone', '-q', '-c', 'core.autocrlf=false', s.origin, 옆]);   // 꺼내기 전에 정해야 한다 — 뒤에 정하면 이미 CRLF로 꺼내진 파일이 통째로 바뀐 것이 된다
  const p = path.join(옆, 'docs', '_ops', '트랙.md');
  fs.writeFileSync(p, 고치기(fs.readFileSync(p, 'utf8')));
  g(옆, ['commit', '-q', '-am', '남의 커밋']); g(옆, ['push', '-q', 'origin', 'HEAD:master']);
  if (받기) g(s.공용, ['fetch', '-q', 'origin', '+refs/heads/master:refs/remotes/origin/master']);
  return g(옆, ['rev-parse', 'HEAD']).trim();
}

test('올려닫기: origin 판을 작은 사본에서 고쳐 올리고 사본을 치운다 — 공용 작업본의 파일은 건드리지 않는다', async () => {
  const s = 저장소만들기('push');
  try {
    // 공용 작업본에는 다른 세션이 쓰는 중인 결정 표가 있다
    const 쓰는중 = `${읽기(s.공용, 'docs/_ops/결정.md')}\n남의 미커밋 줄\n`;
    쓰기(s.공용, 'docs/_ops/결정.md', 쓰는중);
    const 본것 = [];
    const 옵션 = { 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수: 가짜올리기(본것) };
    const r = await 닫기도구.올려닫기(옵션);
    assert.equal(r.멈춤, undefined);
    assert.equal(r.올림.결과, '올림');
    assert.equal(본것.length, 1);
    assert.deepEqual(본것[0].경로들, ['docs/_ops/결정.md', 'docs/_ops/보관/결정_2026-10.md', 'docs/_ops/보관/트랙_2026-11.md', 'docs/_ops/트랙.md']);
    assert.equal(본것[0].공용안따라감, true);
    assert.deepEqual(본것[0].사본파일.filter((n) => n !== '.git'), ['docs'], '사본에는 기록 파일만 꺼낸다');
    assert.match(본것[0].메시지, /^chore\(기록 닫기\): 결정 표 1행 · 트랙 1줄을 달별 보관으로/);
    // origin에 올라간 내용
    const 본 = (p) => g(s.공용, ['show', `origin/master:${p}`]);
    g(s.공용, ['fetch', '-q', 'origin']);
    assert.ok(!본('docs/_ops/결정.md').includes('넘길 행') && 본('docs/_ops/결정.md').includes('보호') && 본('docs/_ops/결정.md').includes('최근'));
    assert.ok(본('docs/_ops/보관/결정_2026-10.md').startsWith('# 지난 결정 · 2026-10\n\n옛 줄\n') && 본('docs/_ops/보관/결정_2026-10.md').includes('넘길 행'));
    assert.ok(본('docs/_ops/보관/트랙_2026-11.md').includes('- **가:** 끝. 남은 일: 없음'));
    assert.equal(본('docs/_ops/트랙.md'), 트랙글('# 이어갈 작업', '', '- **나:** 남은 일: 검수', ''));
    assert.equal(본('tools/다른파일.txt'), '사본에 꺼내지 않는 파일\n', '사본에 안 꺼낸 파일이 지워지지 않는다');
    // 사본은 치워졌고 공용 작업본은 그대로다
    assert.equal(사본목록(s.공용), 1);
    assert.deepEqual(fs.readdirSync(path.join(s.방, '사본자리')), []);
    assert.equal(읽기(s.공용, 'docs/_ops/결정.md'), 쓰는중);
    // 장부 한 줄 · 잠금은 풀림
    const 줄 = 닫기도구.추이(path.join(s.방, '장부'));
    assert.equal(줄.length, 1);
    assert.equal(줄[0].결정.옮김, 1);
    assert.equal(줄[0].올림.결과, '올림');
    assert.equal(fs.existsSync(path.join(s.방, '장부', '자동.lock')), false);
    // 다시 돌리면 옮길 것이 없고 올리기를 부르지 않는다
    const 둘 = await 닫기도구.올려닫기(옵션);
    assert.deepEqual(둘.바뀐경로, []);
    assert.equal(본것.length, 1);
    assert.equal(닫기도구.추이(path.join(s.방, '장부')).length, 2);
  } finally { s.치우기(); }
});

test('올려닫기: push 직전에 origin이 움직였으면 올리지 않고 새 판에서 처음부터 다시 한다', async () => {   // Fable 검수 P2 — 옛 판의 판정이 방금 곁줄이 달린 줄에 얹혔다
  const s = 저장소만들기('moved');
  try {
    const 본것 = [];
    // 첫 시도의 push 직전에 다른 세션이 닫힌 줄 아래에 열린 곁줄을 달아 올린다
    const 직전 = (번) => { if (번 === 1) 남이올림(s, (글) => 글.replace('- **가:** 끝. 남은 일: 없음\n', '- **가:** 끝. 남은 일: 없음\n  - **다시 터짐:** 남은 일: 캐시 키 확인\n')); };
    const r = await 닫기도구.올려닫기({ 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수: 가짜올리기(본것, 직전) });
    assert.equal(본것.length, 2, '첫 시도는 버리고 한 번 더');
    assert.equal(r.다시한수, 1);
    assert.equal(r.멈춤, undefined);
    assert.equal(r.올림.결과, '올림');
    assert.deepEqual(본것[1].경로들, ['docs/_ops/결정.md', 'docs/_ops/보관/결정_2026-10.md'], '새 판에서는 그 트랙 줄이 닫힌 줄이 아니다');
    g(s.공용, ['fetch', '-q', 'origin']);
    const 트랙 = g(s.공용, ['show', 'origin/master:docs/_ops/트랙.md']);
    assert.ok(트랙.includes('- **가:** 끝. 남은 일: 없음\n  - **다시 터짐:** 남은 일: 캐시 키 확인\n'), '부모와 곁줄이 함께 남아 있다');
    assert.equal(g(s.공용, ['rev-list', '--count', 'origin/master']).trim(), '3', '처음 · 남의 커밋 · 기록 닫기 — 버린 시도는 올라가지 않았다');
    assert.equal(사본목록(s.공용), 1);
  } finally { s.치우기(); }
});

test('올려닫기: origin이 계속 움직이면 정한 횟수 뒤 멈추고 아무것도 올리지 않는다', async () => {
  const s = 저장소만들기('busy');
  try {
    const 본것 = [];
    const 직전 = (번) => 남이올림(s, (글) => `${글}- **남의 줄 ${번}:** 남은 일: 검수\n`);
    const r = await 닫기도구.올려닫기({ 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수: 가짜올리기(본것, 직전) });
    assert.equal(본것.length, 닫기도구.다시한도);
    assert.match(r.멈춤, /origin이 계속 움직여 3번 모두 올리지 못했다/);
    assert.equal(r.올림, null);
    g(s.공용, ['fetch', '-q', 'origin']);
    assert.ok(g(s.공용, ['show', 'origin/master:docs/_ops/결정.md']).includes('넘길 행'));
    assert.equal(사본목록(s.공용), 1);
    assert.match(닫기도구.추이(path.join(s.방, '장부'))[0].멈춤, /계속 움직여/);
  } finally { s.치우기(); }
});

test('올려닫기: 고리가 안 불린 채 다른 판 위에 쌓여 올라갔고 그 판에서는 옮길 줄이 다르면 멈춤으로 알린다', async () => {
  const s = 저장소만들기('restacked');
  try {
    // 고리를 부르지 않고, 그새 움직인 origin 위에 내 변경을 억지로 다시 쌓아 올리는 올리기(핵심이 바뀌어 고리가 사라진 셈)
    const 다시쌓는올리기 = async ({ 저장소, 경로들, 메시지 }) => {
      g(저장소, ['add', '--', ...경로들]); g(저장소, ['commit', '-q', '-m', 메시지]);
      남이올림(s, (글) => 글.replace('- **나:** 남은 일: 검수\n', '- **나:** 남은 일: 검수\n- **새로 닫힌 줄:** 남은 일: 없음\n'), false);
      g(저장소, ['fetch', '-q', 'origin', '+refs/heads/master:refs/remotes/origin/master']);
      g(저장소, ['rebase', '-q', '-X', 'theirs', 'origin/master']);
      g(저장소, ['push', '-q', 'origin', 'HEAD:master']);
      return { 결과: '올림', 머리: g(저장소, ['rev-parse', 'HEAD']).trim() };
    };
    const r = await 닫기도구.올려닫기({ 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수: 다시쌓는올리기 });
    assert.equal(r.올림.결과, '올림');
    assert.match(r.멈춤, /계산한 판\([0-9a-f]{9}\)이 아닌 [0-9a-f]{9} 위에 쌓였고 그 판에서는 옮길 줄이 다르다/);
  } finally { s.치우기(); }
});

test('올려닫기: 미리 보기는 사본도 잠금도 장부도 만들지 않는다', async () => {
  const s = 저장소만들기('preview');
  try {
    const 본것 = [];
    const r = await 닫기도구.올려닫기({ 저장소: s.공용, 오늘: '2026-11-25', 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수: 가짜올리기(본것) });
    assert.equal(r.바뀐경로.length, 4);
    assert.equal(r.올림, null);
    assert.equal(본것.length, 0);
    assert.equal(fs.existsSync(path.join(s.방, '사본자리')), false);
    assert.equal(fs.existsSync(path.join(s.방, '장부')), false);
    assert.equal(사본목록(s.공용), 1);
  } finally { s.치우기(); }
});

test('올려닫기: 올리기가 실패하면 멈춤으로 남기고 사본은 치운다 · 다른 회차가 잠금을 쥐고 있으면 돌지 않는다', async () => {
  const s = 저장소만들기('fail');
  try {
    const 옵션 = { 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부') };
    const r = await 닫기도구.올려닫기({ ...옵션, 올리기함수: async () => ({ 결과: '멈춤', 이유: '공개 검사에 걸렸다' }) });
    assert.match(r.멈춤, /올리지 못했다 — 멈춤: 공개 검사에 걸렸다/);
    assert.equal(사본목록(s.공용), 1);
    assert.equal(g(s.공용, ['rev-parse', 'origin/master']).trim(), g(s.공용, ['rev-parse', 'HEAD']).trim(), 'origin은 그대로다');
    const 던짐 = await 닫기도구.올려닫기({ ...옵션, 올리기함수: async () => { throw new Error('터짐'); } });
    assert.match(던짐.멈춤, /실패: 터짐/);
    assert.equal(사본목록(s.공용), 1);
    // 고리까지 못 가고 멈췄어도(그새 올라온 변경과 겹쳐 얹지 못함) origin이 움직여서면 새 판에서 다시 한다 — Fable 둘째 검수
    const 본것 = [];
    const 겹쳐멈춤 = async (o) => {
      본것.push(o.경로들.length);
      if (본것.length === 1) { 남이올림(s, (글) => `${글}- **남의 줄:** 남은 일: 검수\n`); return { 결과: '멈춤', 이유: 'origin 위에 얹지 못한 경로가 있다' }; }
      return 가짜올리기([])(o);
    };
    const 다시 = await 닫기도구.올려닫기({ ...옵션, 올리기함수: 겹쳐멈춤 });
    assert.deepEqual([본것.length, 다시.다시한수, 다시.멈춤, 다시.올림.결과], [2, 1, undefined, '올림']);
    assert.equal(사본목록(s.공용), 1);
    const 풀기 = 닫기도구.잠그기(path.join(s.방, '장부'));
    assert.equal(typeof 풀기, 'function');
    assert.deepEqual(await 닫기도구.올려닫기({ ...옵션, 올리기함수: async () => { throw new Error('불리면 안 된다'); } }), { 멈춤: '다른 회차가 돌고 있다' });
    풀기();
  } finally { s.치우기(); }
});

test('올려닫기: 진짜 올리기 핵심으로 — CRLF로 꺼내진 사본에서도 LF blob으로 올라가고 사본 밖 파일은 그대로다', async () => {   // 이 PC처럼 autocrlf=true인 저장소
  const s = 저장소만들기('real', { autocrlf: 'true' });
  const 앞환경 = process.env.SYNK_관련시험;
  process.env.SYNK_관련시험 = '끔';   // 임시 저장소에는 시험 지도가 없다 — 관련 시험 · CI 경고는 이 시험의 대상이 아니다
  try {
    쓰기(s.공용, 'tools/git-storage-policy.json', fs.readFileSync(path.join(__dirname, '..', 'tools', 'git-storage-policy.json'), 'utf8'));
    g(s.공용, ['add', '-A']); g(s.공용, ['commit', '-q', '-m', '용량 정책']); g(s.공용, ['push', '-q', 'origin', 'HEAD:master']);
    // 첫 시도에서는 올리기 핵심을 부르기 직전에 다른 세션이 트랙 끝에 한 줄을 올린다 — 핵심은 그 위에 다시 쌓고(겹치지 않아 깨끗이 얹힌다),
    // push 직전 고리가 「계산한 판이 아니다」로 던져야 한다. 고리 이름이나 부르는 자리가 핵심에서 바뀌면 이 시험이 떨어진다.
    const 진짜 = require('../tools/lib/git-publish-core.cjs').올리기;
    let 부른수 = 0, 앞 = null;
    const 올리기함수 = async (o) => {
      부른수++;
      if (부른수 === 1) 앞 = 남이올림(s, (글) => `${글}- **남의 줄:** 남은 일: 검수\n`, false);
      return 진짜(o);
    };
    const r = await 닫기도구.올려닫기({ 저장소: s.공용, 오늘: '2026-11-25', 실행: true, 사본자리: path.join(s.방, '사본자리'), 장부폴더: path.join(s.방, '장부'), 올리기함수 });
    assert.equal(r.멈춤, undefined, JSON.stringify(r.올림));
    assert.equal(r.올림.결과, '올림');
    assert.deepEqual([부른수, r.다시한수], [2, 1], '첫 시도는 고리가 막고 새 판에서 다시 했다');
    g(s.공용, ['fetch', '-q', 'origin']);
    const 뒤 = g(s.공용, ['rev-parse', 'origin/master']).trim();
    assert.equal(g(s.공용, ['rev-parse', `${뒤}^`]).trim(), 앞, '다시 계산한 판(남의 커밋) 바로 위에 쌓였다 — 버린 첫 시도는 올라가지 않았다');
    assert.deepEqual(g(s.공용, ['diff', '--name-only', '--no-renames', 앞, 뒤]).trim().split('\n').sort(),
      ['docs/_ops/결정.md', 'docs/_ops/보관/결정_2026-10.md', 'docs/_ops/보관/트랙_2026-11.md', 'docs/_ops/트랙.md']);
    const blob = (p) => spawnSync('git', ['-c', 'core.quotepath=false', 'show', `${뒤}:${p}`], { cwd: s.공용, windowsHide: true }).stdout.toString('utf8');
    for (const p of ['docs/_ops/결정.md', 'docs/_ops/트랙.md', 'docs/_ops/보관/결정_2026-10.md', 'docs/_ops/보관/트랙_2026-11.md']) assert.equal(blob(p).includes('\r'), false, `${p} blob에 CR이 없다`);
    assert.equal(blob('docs/_ops/트랙.md'), 트랙글('# 이어갈 작업', '', '- **나:** 남은 일: 검수', '- **남의 줄:** 남은 일: 검수', ''));
    assert.ok(blob('docs/_ops/보관/결정_2026-10.md').startsWith('# 지난 결정 · 2026-10\n\n옛 줄\n') && blob('docs/_ops/보관/결정_2026-10.md').includes('넘길 행'));
    assert.equal(blob('tools/다른파일.txt'), '사본에 꺼내지 않는 파일\n');
    assert.equal(사본목록(s.공용), 1);
  } finally {
    if (앞환경 === undefined) delete process.env.SYNK_관련시험; else process.env.SYNK_관련시험 = 앞환경;
    s.치우기();
  }
});

test('실행: 공용 작업본에서 --실행은 거절하고, 모르는 선택지는 쓰는 법과 함께 던진다', async () => {
  const s = 저장소만들기('cli');
  try {
    const r = await 닫기도구.실행(['--실행', '--저장소', s.공용, '--오늘', '2026-11-25']);
    assert.equal(r.코드, 1);
    assert.match(r.글, /공용 작업본에서는 파일을 고치지 않는다/);
    assert.ok(읽기(s.공용, 'docs/_ops/결정.md').includes('넘길 행'));
    const 미리 = await 닫기도구.실행(['--저장소', s.공용, '--오늘', '2026-11-25']);
    assert.equal(미리.코드, 0);
    assert.match(미리.글, /^\[미리 보기\] 기록 닫기 · 2026-11-25/);
    assert.match(미리.글, /결정 표: 3행 가운데 1행을 보관으로 — 남는 것 2행\(안전 1 · 관찰 기간 안 1\)/);
    const j = JSON.parse((await 닫기도구.실행(['--저장소', s.공용, '--오늘', '2026-11-25', '--json'])).글);
    assert.deepEqual([j.재기.결정.옮김, j.재기.트랙.옮김, j.결정.문, j.트랙.보관글], [1, 1, undefined, undefined]);
  } finally { s.치우기(); }
  assert.throws(() => 닫기도구.인자읽기(['--모름']), /모르는 선택지/);
  assert.throws(() => 닫기도구.인자읽기(['--일수', '0']), /1 이상의 정수/);
  assert.throws(() => 닫기도구.인자읽기(['--오늘', '11-25']), /YYYY-MM-DD/);
  assert.deepEqual(닫기도구.인자읽기(['--올리기', '--실행', '--json', '--일수', '7']), { 실행: true, 올리기: true, json: true, 추이: null, 일수: 7, 오늘: undefined, 저장소: undefined });
});

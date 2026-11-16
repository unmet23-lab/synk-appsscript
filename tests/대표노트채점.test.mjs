// 대표 노트 채점기(tools/대표노트채점.mjs · tools/lib/대표노트비교.mjs) — API를 부르지 않는 부분만 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 코치결정, 채점결정, 같은빠진말, 맞대기, 세기, 합격선 } from '../tools/lib/대표노트비교.mjs';
import os from 'node:os';
import { 입력읽기, 은행읽기, 줄글, 답꼴, 저장소안, 카본요청글, 카본답읽기, 확인글, 섞기, 보고글 } from '../tools/대표노트채점.mjs';
import { judgeLine } from '../tools/lib/드라마판정.mjs';

const 뿌리 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 합성경로 = path.join(뿌리, 'tests/fixtures/대표노트_합성50.jsonl');

test('코치결정 — 소리 관문은 세지 않는 관문, 통과는 노트 없음, 노트는 한국어 갈래로', async () => {
  assert.deepEqual(코치결정({ status: 'no_speech', verdict: null, note: null }).갈래, '관문');
  assert.equal(코치결정({ status: 'ok', verdict: 'pass', note: null, sure: true }).노트, '없음');
  const 끝 = 코치결정({ status: 'ok', verdict: 'note', note: { kind: 'ending', want: 'polite', got: 'plain', at: '있어' } });
  assert.equal(끝.노트, '끝맺음'); assert.equal(끝.끝맺음, '해요체');
  const 빠 = 코치결정({ status: 'ok', verdict: 'note', note: { kind: 'missing', word: '도서관' } });
  assert.equal(빠.노트, '빠진말'); assert.equal(빠.빠진말, '도서관');
  // 실제 판정 규칙과 이어지는지 — 교수님께 「-어」로 끝낸 말은 끝맺음 노트다.
  const { 은행 } = await 은행읽기();
  const spec = 은행.find((l) => l.id === 's1e01-2').spec;
  const 실제 = 코치결정(judgeLine(spec, { transcript: '아직 낯설지만 조금씩 익숙해지고 있어' }));
  assert.equal(실제.노트, '끝맺음');
});

test('채점결정 — 확신이 낮으면 노트를 주지 않는 것으로 보되 원래 답은 남긴다', () => {
  const 낮음 = 채점결정({ 노트: '빠진말', 끝맺음_바랄것: '해당없음', 빠진말: '과제', 확신: '낮음', 까닭: '', 기준밖: '' });
  assert.equal(낮음.노트, '없음'); assert.equal(낮음.원래노트, '빠진말'); assert.equal(낮음.빠진말, '');
  const 끝 = 채점결정({ 노트: '끝맺음', 끝맺음_바랄것: '합쇼체', 빠진말: '', 확신: '높음', 까닭: 'x', 기준밖: '' });
  assert.equal(끝.끝맺음, '합쇼체');
  // 스키마가 강제되지 않는 둘째 채점이 「보통」이나 빈 값을 내면 확신 없음으로 본다.
  assert.equal(채점결정({ 노트: '길이', 확신: '보통' }).노트, '없음');
  assert.equal(채점결정({ 노트: '길이' }).노트, '없음');
  assert.equal(채점결정({ 노트: '끝맺음', 끝맺음_바랄것: '반말', 확신: '높음' }).끝맺음, '반말');
  assert.equal(채점결정({ 노트: '발음', 확신: '높음' }), null);
  assert.equal(채점결정(null), null);
});

test('같은빠진말 — 포함 관계나 허용 표현이면 같은 말로 본다', () => {
  assert.ok(같은빠진말('제출 기한', '제출기한'));
  assert.ok(같은빠진말('새로 온 유학생', '유학생'));
  assert.ok(같은빠진말('제출 기한', '마감일', [{ word: '제출 기한', alts: ['마감', '마감일'] }]));
  assert.ok(!같은빠진말('도서관', '정문'));
  assert.ok(!같은빠진말('', '도서관'));
  // 어느 쪽을 먼저 넣어도 같다 — 허용 표현끼리, 조사가 붙은 꼴도 같은 핵심 말이다.
  const keys = [{ word: '제출 기한', alts: ['마감', '마감일'] }];
  assert.ok(같은빠진말('마감', '제출 기한', keys));
  assert.ok(같은빠진말('마감', '마감일', keys));
  assert.ok(같은빠진말('제출 기한을', '마감', keys));
  assert.ok(같은빠진말('길을 잃어서', '길을 잃다'));
  // 짧은 허용 표현(「어디」)이 양쪽 글에 들어 있기만 해서는 같은 핵심 말이 아니다.
  assert.ok(!같은빠진말('어디 가는 길', '어디 학생', [{ word: '어디에 있는지', alts: ['어디'] }]));
  assert.ok(!같은빠진말('도서관', '도서실'));
  assert.ok(!같은빠진말('어디에 있는지', '어디에 내야'));
});

test('맞대기 — 여섯 갈래', () => {
  const 없음 = { 갈래: '노트', 노트: '없음' };
  const 채없음 = { 노트: '없음' };
  assert.equal(맞대기({ 갈래: '관문' }, 채없음), '관문');
  assert.equal(맞대기(없음, null), '채점없음');
  assert.equal(맞대기(없음, 채없음), '일치');
  assert.equal(맞대기(없음, { 노트: '끝맺음', 끝맺음: '해요체' }), '놓침');
  assert.equal(맞대기({ 갈래: '노트', 노트: '길이' }, 채없음), '코치만노트');
  assert.equal(맞대기({ 갈래: '노트', 노트: '길이' }, { 노트: '빠진말', 빠진말: '과제' }), '다른노트');
  // 해요체와 합쇼체는 둘 다 맞는 끝이라 같은 끝맺음 노트다. 반말을 바라는 쪽과는 다르다.
  assert.equal(맞대기({ 갈래: '노트', 노트: '끝맺음', 끝맺음: '해요체' }, { 노트: '끝맺음', 끝맺음: '합쇼체' }), '일치');
  assert.equal(맞대기({ 갈래: '노트', 노트: '끝맺음', 끝맺음: '해요체' }, { 노트: '끝맺음', 끝맺음: '반말' }), '다른노트');
  assert.equal(맞대기({ 갈래: '노트', 노트: '끝맺음', 끝맺음: '해요체' }, { 노트: '끝맺음', 끝맺음: null }), '일치');
  const spec = { keys: [{ word: '제출 기한', alts: ['마감'] }] };
  assert.equal(맞대기({ 갈래: '노트', 노트: '빠진말', 빠진말: '제출 기한' }, { 노트: '빠진말', 빠진말: '마감' }, spec), '일치');
  assert.equal(맞대기({ 갈래: '노트', 노트: '빠진말', 빠진말: '제출 기한' }, { 노트: '빠진말', 빠진말: '교수님' }, spec), '다른노트');
});

test('세기와 합격선 — 오노트 분모는 코치가 준 노트 수, 관문과 채점없음은 빼고 센다', () => {
  const 줄 = (맞댐, 코치노트, 확인 = null) => ({ 맞댐, 코치노트, 확인 });
  const rows = [
    ...Array.from({ length: 30 }, () => 줄('일치', '없음')),
    ...Array.from({ length: 10 }, () => 줄('일치', '끝맺음')),
    줄('다른노트', '길이', '맞는 지적'), 줄('다른노트', '빠진말', '틀린 지적'), 줄('코치만노트', '빠진말', '틀린 지적'), 줄('코치만노트', '길이', '애매'),
    ...Array.from({ length: 6 }, () => 줄('놓침', '없음')),
    줄('관문', '없음'), 줄('채점없음', '끝맺음'),
  ];
  const 셈 = 세기(rows);
  assert.equal(셈.표본, 52); assert.equal(셈.센표본, 50); assert.equal(셈.관문, 1); assert.equal(셈.채점없음, 1);
  assert.equal(셈.일치, 40); assert.equal(셈.일치율, 0.8);
  // 일치 40개 가운데 30개는 둘 다 노트 없음 — 노트 쪽 비율을 따로 낸다.
  assert.equal(셈.둘다없음, 30); assert.equal(셈.노트일치, 10);
  assert.equal(셈.채점노트수, 6 + 2 + 10); assert.equal(셈.채점노트중코치같음, 10 / 18); assert.equal(셈.코치노트중일치, 10 / 14);
  assert.equal(셈.코치노트수, 14); assert.equal(셈.오노트, 2); assert.equal(셈.오노트율, 2 / 14); assert.equal(셈.애매, 1);
  assert.equal(셈.순서만다름, 1); assert.equal(셈.채점이놓침, 0);
  assert.equal(셈.노트안준비율, 36 / 50); assert.equal(셈.놓침, 6); assert.equal(셈.놓침율, 6 / 50);
  // 채점은 고칠 것이 없다고 봤는데 코치 노트가 맞는 지적이면 「채점이 놓침」이지 순서만 다른 것이 아니다.
  const 놓친 = 세기([줄('코치만노트', '길이', '맞는 지적')]);
  assert.equal(놓친.순서만다름, 0); assert.equal(놓친.채점이놓침, 1);
  // 관문 줄은 두 채점 겹침과 의도 견줌에도 넣지 않는다.
  const 겹침 = 세기([{ 맞댐: '관문', 코치노트: '없음', 두채점같음: true, 의도: '없음', 채점노트: '없음' }, { 맞댐: '일치', 코치노트: '없음', 두채점같음: true, 의도: '없음', 채점노트: '없음' }]);
  assert.deepEqual(겹침.두채점, { 견준줄: 1, 같음: 1 }); assert.deepEqual(겹침.의도견줌, { 견준줄: 1, 같음: 1 });
  // 애매 1개를 틀린 지적으로 치면 3개라 넘는다 — 함께 낸다.
  assert.deepEqual(합격선(셈), { 표본모자람: false, 일치: true, 오노트: true, 오노트애매포함: false });
  const 셋 = 세기([...rows.slice(0, 49), 줄('다른노트', '길이', '틀린 지적')]);
  assert.equal(합격선(셋).오노트, false);
  assert.equal(합격선(세기(rows.slice(0, 40))).표본모자람, true);
  // 확인 호출이 실패한 코치 노트는 오노트인지 모른다 — 숨기지 않고 세고, 오노트 합격은 판정하지 않는다.
  const 모름 = 세기([...rows.slice(0, 49), 줄('코치만노트', '길이', null)]);
  assert.equal(모름.확인못함, 1); assert.equal(합격선(모름).오노트, null);
  assert.equal(셈.확인못함, 0);
  // 센 표본이 없으면 오노트 합격도 판정하지 않는다.
  assert.equal(합격선(세기([줄('채점없음', '끝맺음')])).오노트, null);
});

test('입력읽기 — 동의녹음은 동의 확인과 국외 처리 동의가 있어야 하고 의도 칸을 두지 않는다', () => {
  const 항목 = JSON.stringify({ id: 'a1', 줄: 's1e01-1', 받아적은글: '안녕하세요' });
  assert.throws(() => 입력읽기(`${항목}\n`), /메타/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"동의녹음","국외처리동의":["Anthropic"]}}\n${항목}`), /동의확인/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"동의녹음","동의확인":"2R 동의서 12-05"}}\n${항목}`), /Anthropic/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"동의녹음","동의확인":"x","국외처리동의":["Anthropic"]}}\n${JSON.stringify({ id: 'a1', 줄: 's1e01-1', 받아적은글: '안녕', 의도: '없음' })}`), /의도/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"합성"}}\n${항목}\n${항목}`), /겹친다/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"동의녹음","동의확인":true,"국외처리동의":["Anthropic"]}}\n${항목}`), /동의확인/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"동의녹음","동의확인":"x","국외처리동의":["Anthropic"]}}\n${JSON.stringify({ id: 'a1', 줄: 's1e01-1', 받아적은글: '안녕', 의도: '' })}`), /의도/);
  assert.throws(() => 입력읽기(`{"메타":{"출처":"합성"}}\nnull`), /객체/);
  // 숫자 id는 글로 바꿔 둔다(카본 답을 찾을 때 꼴이 어긋나지 않게).
  assert.equal(입력읽기(`{"메타":{"출처":"합성"}}\n${JSON.stringify({ id: 7, 줄: 's1e01-1', 받아적은글: '네' })}`).항목[0].id, '7');
  assert.throws(() => 입력읽기(`{"메타":{"출처":"합성"}}\n${JSON.stringify({ id: { a: 1 }, 줄: 's1e01-1', 받아적은글: '네' })}`), /id/);
  assert.equal(입력읽기(`{"메타":{"출처":"합성"}}\n${항목}`).항목.length, 1);
});

test('합성 50개 — 모두 검수를 통과한 대사이고, 보낼 글에 의도와 코치 판정이 들어가지 않는다', async () => {
  const { 메타, 항목 } = 입력읽기(fs.readFileSync(합성경로, 'utf8'));
  assert.equal(메타.출처, '합성'); assert.equal(항목.length, 50);
  const { 은행, 맥락 } = await 은행읽기();
  for (const h of 항목) {
    const 줄 = 은행.find((l) => l.id === h.줄);
    assert.ok(줄, `${h.id} 대사 ${h.줄}`);
    assert.equal(줄.review.status, 'passed', `${h.id} 대사 ${h.줄}`);
    assert.ok(['없음', '끝맺음', '길이', '빠진말'].includes(h.의도), h.id);
    const 글 = 줄글(줄.spec, 맥락.get(h.줄), h.받아적은글);
    assert.ok(글.includes(h.받아적은글));
    assert.ok(!/의도|코치|노트/.test(글), `${h.id} 보낼 글에 의도와 코치 판정이 새지 않는다(눈가림)`);
  }
});

test('기준글 — 빠진말 예시는 3음절 이상, 둘 이상 빠졌을 때의 약속은 코치 순서와 같다', async () => {
  const { 기준글 } = await import('../tools/대표노트채점.mjs');
  assert.ok(!기준글.includes('「정문」을 「후문」으로'), '2음절 예시는 2음절 규칙과 부딪친다');
  assert.ok(기준글.includes('2음절 이하인 것을 뺀 나머지 가운데'));
});

test('답꼴 — 정해진 칸만, 모두 필수', () => {
  assert.equal(답꼴.additionalProperties, false);
  assert.deepEqual([...답꼴.required].sort(), Object.keys(답꼴.properties).sort());
});

test('저장소안 — 점 둘로 시작하는 이름도 저장소 안으로 본다', () => {
  assert.equal(저장소안(path.join(뿌리, '..비공개', 'a.jsonl')), true);
  assert.equal(저장소안(path.join(뿌리, '.tmp', '대표노트')), true);
  assert.equal(저장소안(path.join(뿌리, '..', 'SYNK-보관함', 'a.jsonl')), false);
  assert.equal(저장소안(path.join(os.tmpdir(), '대표노트-시험')), false);
  // 다른 작업본(워크트리 · 운영 사본)도 git 작업본이라 막는다 — 조상에 .git(파일이든 폴더든)이 있으면 안이다.
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), '대표노트-작업본-'));
  try {
    fs.writeFileSync(path.join(임시, '.git'), 'gitdir: 어딘가/worktrees/x\n');
    assert.equal(저장소안(path.join(임시, '.tmp', '결과')), true);
    assert.equal(저장소안(path.join(path.dirname(임시), '대표노트-작업본-없는곳', 'a.jsonl')), false);
  } finally { fs.rmSync(임시, { recursive: true, force: true }); }
});

test('카본 요청과 답 — 입력 id를 보내지 않고, 설명이 붙은 답에서도 배열을 찾는다', () => {
  const 줄들 = [{ id: 'missing-01', 글: '학생이 말한 것: 「안녕」' }, { id: 'ending-02', 글: '학생이 말한 것: 「네」' }];
  const { 요청, 순번표 } = 카본요청글(줄들);
  assert.ok(!요청.includes('missing-01') && !요청.includes('ending-02'));
  assert.ok(요청.includes('### k1') && 요청.includes('### k2'));
  const 원소 = (번호, 노트) => ({ 번호, 노트, 끝맺음_바랄것: '해당없음', 빠진말: '', 확신: '높음', 까닭: '', 기준밖: '' });
  const 답 = `[안내] 아래가 결과다.\n\`\`\`json\n${JSON.stringify([원소('k1', '없음'), 원소('k2', '길이')])}\n\`\`\`\n(참고: [기준밖] 칸은 비웠다)`;
  const 읽음 = 카본답읽기(답, 순번표);
  assert.equal(읽음.답.get('missing-01').노트, '없음'); assert.equal(읽음.답.get('ending-02').노트, '길이');
  assert.equal(읽음.받은수, 2); assert.deepEqual(읽음.빠짐, []);
  const 맨답 = `결과: ${JSON.stringify([원소('k2', '끝맺음')])} 끝 [메모]`;
  const 하나 = 카본답읽기(맨답, 순번표);
  assert.equal(하나.답.get('ending-02').노트, '끝맺음'); assert.deepEqual(하나.빠짐, ['missing-01']);
  assert.throws(() => 카본답읽기('죄송하지만 답할 수 없다', 순번표), /배열/);
  // 번호 꼴이 달라도(숫자 · 대문자 · 0 붙임 · 머리글째) 맞춘다.
  for (const 번호 of [1, 'K1', 'k01', '### k1']) assert.equal(카본답읽기(JSON.stringify([원소(번호, '길이')]), 순번표).답.get('missing-01').노트, '길이', String(번호));
  // 울타리가 둘이고 첫 블록이 다른 배열이면 둘째 블록을 본다.
  const 두블록 = `\`\`\`json\n[1, 2, 3]\n\`\`\`\n\`\`\`json\n${JSON.stringify([원소('k1', '없음'), 원소('k2', '없음')])}\n\`\`\``;
  assert.equal(카본답읽기(두블록, 순번표).받은수, 2);
  // 번호가 겹치면 둘 다 버리고 알린다.
  const 겹친 = 카본답읽기(JSON.stringify([원소('k1', '없음'), 원소('k1', '길이'), 원소('k2', '없음')]), 순번표);
  assert.deepEqual(겹친.겹침, ['missing-01']); assert.equal(겹친.답.has('missing-01'), false); assert.equal(겹친.받은수, 1);
});

test('확인글 — 첫 채점이 고른 것과 코치 노트를 함께 보여 준다', () => {
  const r = { 글: '학생이 말한 것: 「도서관 어디」', spec: { line: '네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?', minSyllables: 9 },
    채점: { 노트: '끝맺음', 끝맺음: '해요체' }, 코치: { 노트: '길이' } };
  const 글 = 확인글(r);
  assert.ok(글.includes('첫 채점에서는') && 글.includes('끝맺음') && 글.includes('코치가 준 노트: 길이'));
});

test('섞기 — 같은 입력이면 같은 순서이고, 입력 순서와 다르다', () => {
  const 줄들 = Array.from({ length: 20 }, (_, i) => ({ id: `h${String(i + 1).padStart(2, '0')}` }));
  const 한번 = 섞기(줄들).map((r) => r.id), 두번 = 섞기([...줄들].reverse()).map((r) => r.id);
  assert.deepEqual(한번, 두번); assert.notDeepEqual(한번, 줄들.map((r) => r.id));
});

test('보고글 — 합성 보고에는 합격으로 읽지 말라는 머리말, 카본과 갈린 줄의 표가 있다', () => {
  const 셈 = 세기([{ 맞댐: '일치', 코치노트: '없음', 두채점같음: false }]);
  const 글 = 보고글({ 메타: { 출처: '합성' }, 만든때: 'x', 판: { 채점모델: 'm', 노력: 'high', 둘째: '카본(1/1줄)', 판정판: 'j', 대사판: 'h' }, 셈, 합격선: 합격선(셈),
    토큰: { 호출: 1, 다시씀: 0, 입력: 0, 캐시읽기: 0, 캐시쓰기: 0, 출력: 0 }, 어림USD: 0, 카본: { 보낸수: 1, 받은수: 1, 겹침: [], 빠짐: [], 실패묶음: [] },
    줄들: [{ id: 'h1', 받아적은글: '네\n줄바꿈', 코치: { 빠진말: '' }, 코치노트: '없음', 맞댐: '일치', 채점: { 노트: '없음', 까닭: 'a|b' }, 두채점같음: false, 카본노트: '길이', 카본까닭: 'c' }] });
  assert.ok(글.includes('실제 학생 말의 합격으로 읽지 않는다'));
  assert.ok(글.includes('Claude와 카본이 다르게 고른 줄'));
  assert.ok(글.includes('| h1 | 네 줄바꿈 |'), '표 칸의 줄바꿈은 띄어쓰기로');
});

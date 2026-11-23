'use strict';
// 공모 응모 자격 거르기 시험(2026-11-20, 유호님 「그런것들은 아예 리스트업에서 뺴줘」).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 자격 = require('../tools/lib/contest-eligibility.cjs');
const 지도 = require('../tools/공모지도.js');

// 시험용 가상의 신청자다(실제 신청자 조건은 비공개 보관함에만 있다).
const 조건 = { schema: 'synk-applicant-v1', 만나이: 40, 사는곳: ['강원', '강원특별자치도', '춘천', '춘천시'], 학생: false, 직장인: false, 사업자: false, 법인: false, 가지않는곳: ['대전'] };
const 빈제한 = { 누구나: false, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 최소나이: null, 최대나이: null, 현장지역: [] };

test('다른 시 거주자만 내는 공모는 안 됨, 사는 도 · 시와 전국은 됨', () => {
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['제천시'], 최소나이: 14 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['강원특별자치도'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['춘천시'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['전국'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 누구나: true }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['한국', '일본', '미국'] }, 조건).status, '됨', '나라 이름 한국은 전국이다');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['South Korea'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['일본', '대만'] }, 조건).status, '안 됨');
});

test('쌓인 카본 판정은 지금 규칙으로 다시 맞대고, 사람이 넣은 판정은 건드리지 않는다', () => {
  const 판정 = { items: {
    a: { title: 'a', status: '안 됨', reason: '옛 규칙', by: '카본', 제한: { ...빈제한, 지역: ['한국', '일본'] } },
    b: { title: 'b', status: '안 됨', reason: '사람이 확인', by: '수동' },
    c: { title: 'c', status: '확인 필요', reason: '못 읽음', by: '카본' },
  } };
  assert.strictEqual(자격.다시판정(판정, 조건), 1);
  assert.strictEqual(판정.items.a.status, '됨');
  assert.strictEqual(판정.items.b.status, '안 됨');
  assert.strictEqual(판정.items.c.status, '확인 필요');
});

test('학생만 · 단체만 · 나이 · 대전 현장은 안 됨', () => {
  assert.strictEqual(자격.판정하기({ ...빈제한, 학생만: true, 최소나이: 19 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 단체만: true }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 최대나이: 39 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 최소나이: 19, 최대나이: 49 }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 현장지역: ['대전 유성구'] }, 조건).status, '안 됨');
});

test('카본 인용이 원문에 없으면 버린다', () => {
  const 원문 = '응모자격: 만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)';
  assert.ok(자격.답읽기({ quote: '만 14세 이상 제천시민', 누구나: false, 지역: ['제천'], 최소나이: 14, 최대나이: -1 }, 원문));
  assert.strictEqual(자격.답읽기({ quote: '전국 누구나', 누구나: true }, 원문), null);
  assert.strictEqual(자격.답읽기({ quote: '만 14세 이상 제천시민', 최대나이: -1 }, 원문).제한.최대나이, null);
});

test('운영 조건은 원문에 있는 인용만 받고, 엉뚱한 숫자는 버린다', () => {
  const 원문 = '응모자격: 누구나 접수기간: 2026. 11. 3.(월) ~ 11. 30.(일) 18:00까지 시상식: 12. 4.(금) 수상자 참석 필수 1인 2작품 이내 총상금 1,000만원';
  const 답 = 자격.답읽기({ quote: '응모자격: 누구나', 누구나: true, 지역: [], 최소나이: -1, 최대나이: -1,
    마감: '2026-11-30 18:00', 마감quote: '11. 30.(일) 18:00까지', 현장참석: true, 현장quote: '시상식: 12. 4.(금) 수상자 참석 필수',
    확인전화: false, 서명날인: false, 작품수상한: 2, 상금합계만원: 1000, 주최종류: '공공' }, 원문);
  assert.deepStrictEqual(답.공고, { 마감: '2026-11-30 18:00', 마감quote: '11. 30.(일) 18:00까지', 현장참석: true, 현장quote: '시상식: 12. 4.(금) 수상자 참석 필수',
    확인전화: false, 서명날인: false, 작품수상한: 2, 상금합계만원: 1000, 주최종류: '공공' });
  const 틀린 = 자격.답읽기({ quote: '응모자격: 누구나', 마감: '2026-12-01', 마감quote: '12월 1일까지', 현장참석: true, 현장quote: '본선 참석', 작품수상한: -1, 상금합계만원: -1, 주최종류: '정부' }, 원문);
  assert.deepStrictEqual(틀린.공고, { 마감: '', 현장참석: false, 확인전화: false, 서명날인: false, 작품수상한: null, 상금합계만원: null, 주최종류: '모름' });
  assert.match(자격.공고문장(원문), /시상식: 12\. 4\./);
});

test('자격 문장만 뽑는다', () => {
  const t = '공모명: 응답하라 제천 공모기간: 9월 28일 ~ 11월 20일 응모자격: 만 14세 이상 제천시민 공모분야: AI영상';
  assert.match(자격.자격문장(t), /응모자격: 만 14세 이상 제천시민/);
  assert.strictEqual(자격.자격문장('공모명과 상금만 있는 글'), '');
});

function 폴더() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-elig-'));
  fs.writeFileSync(path.join(dir, '신청자조건.json'), JSON.stringify(조건));
  return dir;
}

test('자격확인은 원문을 읽고 카본 판정을 쌓는다(개인 조건은 카본에 보내지 않는다)', async () => {
  const dir = 폴더();
  const 보낸글 = [];
  const fetchPage = async url => ({ 됨: true, 글: url.includes('jecheon') ? '<p>응모자격: 만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)</p>' : '<p>상금 안내</p>' });
  const carbon = async ({ prompt }) => {
    보낸글.push(prompt);
    const id = 자격.열쇠('응답하라 제천 AI영상 공모전');
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: [{ id, quote: '만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)', 누구나: false, 지역: ['제천'], 학생만: false, 직장인만: false, 단체만: false, 최소나이: 14, 최대나이: -1, 현장지역: [] }] }) };
  };
  const r = await 자격.자격확인(dir, [
    { 제목: '응답하라 제천 AI영상 공모전', 주소: 'https://jecheon.example.kr/notice (접수 메일)' },
    { 제목: '그림만 있는 공모', 주소: 'https://image-only.example.kr/n' },
    { 제목: '주소 없는 공모', 주소: '' },
  ], { fetchPage, carbon, budgetMs: 600000 });
  assert.strictEqual(r.checked, 3);
  const 판정 = 자격.판정읽기(dir);
  assert.strictEqual(자격.판정찾기(판정, '응답하라 제천 AI영상 공모전').status, '안 됨');
  assert.strictEqual(자격.판정찾기(판정, '그림만 있는 공모').status, '확인 필요');
  assert.strictEqual(자격.판정찾기(판정, '주소 없는 공모').status, '확인 필요');
  assert.ok(보낸글.length === 1 && !/춘천|강원|40/.test(보낸글[0]), '카본에는 공고 글만 간다');
  // 이미 판정한 공고는 다시 묻지 않는다.
  const r2 = await 자격.자격확인(dir, [{ 제목: '응답하라 제천 AI영상 공모전', 주소: 'https://jecheon.example.kr/notice' }], { fetchPage, carbon, budgetMs: 600000 });
  assert.strictEqual(r2.checked, 0);
  // 운영 조건이 없는 「확인 필요」는 7일 주기를 지키고, 마감이 7일 안쪽이면 하루마다 다시 본다.
  const 사흘뒤 = new Date(Date.now() + 3 * 864e5);
  const 마감 = 사흘뒤.toISOString().slice(0, 10);
  const r3 = await 자격.자격확인(dir, [{ 제목: '주소 없는 공모', 주소: '', 마감 }], { fetchPage, carbon, budgetMs: 600000 });
  assert.strictEqual(r3.checked, 0);
  const r4 = await 자격.자격확인(dir, [{ 제목: '주소 없는 공모', 주소: '', 마감 }], { fetchPage, carbon, budgetMs: 600000, 지금: new Date(Date.now() + 864e5) });
  assert.strictEqual(r4.checked, 1);
});

test('글에 자격 문장이 없으면 첨부에서 읽어 판정하고 출처를 남긴다', async () => {
  const dir = 폴더();
  const fetchPage = async () => ({ 됨: true, 글: '<p>포스터를 보세요</p><a href="/bbs/download.php?no=0">붙임1. 모집 공고.pdf</a>' });
  const 첨부읽기 = async (page, u, { 고르기 }) => {
    const 글 = '공모개요 응모자격: 만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함) 공모분야';
    assert.ok(고르기(글));
    return { 글, 출처: { 종류: '첨부', 이름: '붙임1. 모집 공고.pdf' }, 본: [{ 이름: '붙임1. 모집 공고.pdf' }] };
  };
  const carbon = async () => ({ selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: [{ id: 자격.열쇠('응답하라 제천 AI영상 공모전'), quote: '만 14세 이상 제천시민', 누구나: false, 지역: ['제천'], 학생만: false, 직장인만: false, 단체만: false, 최소나이: 14, 최대나이: -1, 현장지역: [] }] }) });
  await 자격.자격확인(dir, [{ 제목: '응답하라 제천 AI영상 공모전', 주소: 'https://jecheon.example.kr/n' }], { fetchPage, carbon, 첨부읽기, budgetMs: 600000 });
  const v = 자격.판정찾기(자격.판정읽기(dir), '응답하라 제천 AI영상 공모전');
  assert.strictEqual(v.status, '안 됨');
  assert.strictEqual(v.출처, '첨부(붙임1. 모집 공고.pdf)');
});

test('다시 보다가 카본이 실패하면 앞서 정한 「됨」을 지우지 않는다', async () => {
  const dir = 폴더();
  const 제목 = '전국 누구나 AI 영상 공모전';
  fs.writeFileSync(path.join(dir, '자격판정.json'), JSON.stringify({ schema: 'synk-contest-eligibility-v1', items: {
    [자격.열쇠(제목)]: { title: 제목, status: '됨', reason: '누구나 응모할 수 있다', by: '카본', checkedAt: '2026-11-01T00:00:00.000Z' },
  } }));
  const fetchPage = async () => ({ 됨: true, 글: '<p>응모자격: 전국 누구나</p>' });
  const carbon = async () => { throw Error('구독 통로 실패 — agy가 빈 답을 냈다'); };
  await 자격.자격확인(dir, [{ 제목, 주소: 'https://example.kr/n' }], { fetchPage, carbon, budgetMs: 600000, 지금: new Date('2026-11-20T00:00:00Z') });
  const v = 자격.판정찾기(자격.판정읽기(dir), 제목);
  assert.strictEqual(v.status, '됨');
  assert.match(v.retryReason, /빈 답/);
  assert.strictEqual(v.checkedAt, '2026-11-01T00:00:00.000Z', '다음 회차에 다시 보도록 확인 시각을 그대로 둔다');
});

test('읽기와 묻기를 번갈아 하고, 처음 보는 공고를 옛 판정 채우기보다 먼저 본다', async () => {
  const dir = 폴더();
  const 옛 = '운영 조건 없는 옛 공모';
  fs.writeFileSync(path.join(dir, '자격판정.json'), JSON.stringify({ schema: 'synk-contest-eligibility-v1', items: {
    [자격.열쇠(옛)]: { title: 옛, status: '됨', reason: '누구나', by: '카본', checkedAt: new Date().toISOString() },
  } }));
  const 차례 = [];
  const fetchPage = async (u) => { 차례.push('읽기 ' + u.split('/').pop()); return { 됨: true, 글: '<p>응모자격: 전국 누구나</p>' }; };
  const carbon = async ({ prompt }) => {
    const ids = [...prompt.matchAll(/"id":"([^"]+)"/g)].map(m => m[1]);
    차례.push('묻기 ' + ids.length);
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: ids.map(id => ({ id, quote: '응모자격: 전국 누구나', 누구나: true, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 최소나이: -1, 최대나이: -1, 현장지역: [] })) }) };
  };
  const 후보 = [{ 제목: 옛, 주소: 'https://ex.kr/old' }, ...['a', 'b', 'c'].map(x => ({ 제목: `새 공모 ${x}`, 주소: `https://ex.kr/${x}` }))];
  const r = await 자격.자격확인(dir, 후보, { fetchPage, carbon, budgetMs: 600000 });
  assert.deepStrictEqual(차례, ['읽기 a', '읽기 b', '읽기 c', '묻기 2', '읽기 old', '묻기 2']);
  assert.deepStrictEqual([r.due, r.checked, r.asked], [4, 4, 2]);
});

test('앞서 「됨」인 공고는 이번에 못 읽어도 「확인 필요」로 내리지 않는다', async () => {
  const dir = 폴더();
  const 제목 = '전국 누구나 AI 영상 공모전';
  fs.writeFileSync(path.join(dir, '자격판정.json'), JSON.stringify({ schema: 'synk-contest-eligibility-v1', items: {
    [자격.열쇠(제목)]: { title: 제목, status: '됨', reason: '누구나', by: '카본', checkedAt: '2026-11-01T00:00:00.000Z' },
  } }));
  await 자격.자격확인(dir, [{ 제목, 주소: 'https://example.kr/n' }], { fetchPage: async () => ({ 됨: false, 까닭: '연결하지 못했다' }), carbon: async () => assert.fail('묻지 않는다'), budgetMs: 600000, 지금: new Date('2026-11-20T00:00:00Z') });
  const v = 자격.판정찾기(자격.판정읽기(dir), 제목);
  assert.strictEqual(v.status, '됨');
  assert.strictEqual(v.retryReason, '공고를 읽지 못했다');
});

test('수동 제외는 제목 조각으로 맞고, 지도의 열린 공모에서 빠진다', () => {
  const dir = 폴더();
  자격.수동제외(dir, '응답하라, 제천', '만 14세 이상 제천시민만 응모(공고 원문)');
  const 판정 = 자격.판정읽기(dir);
  const 통합 = { items: [
    { id: 'a', title: '2026 시민 AI영상 공모전 <응답하라, 제천>', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-11-20' } },
    { id: 'b', title: '부산 동구 AI 숏폼 영상 공모전', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-11-22' } },
  ] };
  const 열린 = 지도.열린영상(통합, { items: [] }, '2026-11-20', new Date('2026-11-20T03:00:00Z'), 판정);
  assert.deepStrictEqual(열린.map(o => o.id), ['b']);
  assert.strictEqual(열린[0].자격, '확인 전');
  assert.throws(() => 자격.수동제외(dir, '제천', '짧음'), /네 글자/);
});

test('다른 자격 확인이 돌고 있으면 건너뛰고, 한 시간 넘은 잠금은 덮는다', async () => {
  const dir = 폴더();
  const 잠금 = path.join(dir, '자격판정.lock');
  fs.writeFileSync(잠금, JSON.stringify({ pid: 1, at: new Date().toISOString() }));
  const r = await 자격.자격확인(dir, [{ 제목: '어느 공모', 주소: '' }], { budgetMs: 600000 });
  assert.match(r.skipped, /돌고 있습니다/);
  fs.writeFileSync(잠금, JSON.stringify({ pid: 1, at: new Date(Date.now() - 61 * 6e4).toISOString() }));
  const r2 = await 자격.자격확인(dir, [{ 제목: '어느 공모', 주소: '' }], { fetchPage: async () => ({}), carbon: async () => ({}), budgetMs: 600000 });
  assert.strictEqual(r2.checked, 1);
  assert.ok(!fs.existsSync(잠금), '끝나면 잠금을 지운다');
});

test('특정 기관 수강생 · 회원만 낼 수 있으면 신청자 소속에 없을 때 안 된다(11-23 솔데스크)', () => {
  const 조건 = { 만나이: 30, 사는곳: ['서울'], 학생: false, 직장인: false, 사업자: true, 법인: false, 가지않는곳: [] };
  const 제한 = { 누구나: false, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 소속만: '솔데스크 수강생', 최소나이: null, 최대나이: null, 현장지역: [] };
  assert.deepStrictEqual(자격.판정하기(제한, 조건), { status: '안 됨', reason: '솔데스크 수강생만 응모할 수 있다' });
  assert.strictEqual(자격.판정하기(제한, { ...조건, 소속: ['솔데스크'] }).status, '됨');
  assert.strictEqual(자격.판정하기({ ...제한, 누구나: true }, 조건).status, '됨', '누구나 낼 수 있으면 소속을 보지 않는다');
  assert.strictEqual(자격.판정하기({ ...제한, 소속만: '' }, 조건).status, '됨');
});

test('사람이 넣은 「안 됨」은 같은 공고의 자동 「됨」보다 앞선다(11-23 솔데스크)', () => {
  const 판정 = { items: {
    [자격.열쇠('솔데스크 SAP 온라인 과정 영상 홍보 공모전')]: { title: '솔데스크 SAP 온라인 과정 영상 홍보 공모전', status: '됨', by: '카본' },
    '솔데스크sap온라인과정': { title: '솔데스크 SAP 온라인 과정', status: '안 됨', by: '수동' },
  } };
  assert.strictEqual(자격.판정찾기(판정, '솔데스크 SAP 온라인 과정 영상 홍보 공모전').status, '안 됨');
  assert.strictEqual(자격.판정찾기(판정, '다른 공모전'), null);
});
// 11-23 SHOWVY NEXT는 「SHOWVY 회원」만이라 「안 됨」이 되어 알림에서 빠졌다. 가입은 Google 로그인과 만 18세 확인뿐이라 유호님이 같은 날 출품했다.
// 누구나 무료로 가입하는 플랫폼의 회원 조건은 제한으로 세지 않고, 수강생처럼 실제로 소속이 필요한 조건만 「안 됨」이다.
const 쇼비문구 = '참가 자격 AI로 만든 드라마 시리즈가 있는 만 18세 이상 SHOWVY 회원이라면 누구나 참가할 수 있습니다. 참가비와 인원 제한은 없습니다.';
const 솔데스크문구 = '대상: 솔데스크 수강생 누구나!';
const 소속조건 = { 만나이: 40, 사는곳: ['서울'], 학생: false, 직장인: false, 사업자: true, 법인: false, 가지않는곳: [] };

test('무료로 가입하는 플랫폼 회원은 됨, 수강생은 안 됨, 가를 수 없으면 확인 필요(11-23 SHOWVY · 솔데스크)', () => {
  const 쇼비 = { ...빈제한, 소속만: 'SHOWVY 회원', 최소나이: 18 };
  const 솔데스크 = { ...빈제한, 소속만: '솔데스크 수강생' };
  const 됨 = 자격.판정하기({ ...쇼비, 소속종류: '무료가입' }, 소속조건);
  assert.strictEqual(됨.status, '됨');
  assert.match(됨.reason, /SHOWVY 회원 가입이 필요하다/);
  assert.deepStrictEqual(자격.판정하기({ ...솔데스크, 소속종류: '소속' }, 소속조건), { status: '안 됨', reason: '솔데스크 수강생만 응모할 수 있다' });
  assert.strictEqual(자격.판정하기({ ...쇼비, 소속종류: '모름' }, 소속조건).status, '확인 필요');
  assert.strictEqual(자격.판정하기({ ...쇼비, 소속종류: '무료가입', 최소나이: 50 }, 소속조건).status, '안 됨', '무료 가입이어도 나이 제한은 그대로다');
  // 소속종류가 없는 옛 판정은 낱말로 가른다. 회원은 확인 필요, 수강생 · 단체 소속 · 유료 계정은 안 됨.
  assert.strictEqual(자격.판정하기(쇼비, 소속조건).status, '확인 필요');
  assert.strictEqual(자격.판정하기(솔데스크, 소속조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 소속만: '경기도한의사회' }, 소속조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 소속만: 'paid ZenCreator account' }, 소속조건).status, '안 됨');
});

test('저장된 SHOWVY 「안 됨」은 다시 맞대면 확인 필요가 되고, 소속종류는 카본 답에서 받는다', () => {
  const 판정 = { items: {
    showvy: { title: 'SHOWVY NEXT', status: '안 됨', reason: 'SHOWVY 회원만 응모할 수 있다', by: '카본', quote: 쇼비문구, 제한: { ...빈제한, 소속만: 'SHOWVY 회원', 최소나이: 18 } },
  } };
  assert.strictEqual(자격.다시판정(판정, 소속조건), 1);
  assert.strictEqual(판정.items.showvy.status, '확인 필요');
  // 신청자 소속에 들면 다음 맞댐에서 됨이 된다(확인 필요도 다시 맞댄다).
  assert.strictEqual(자격.다시판정(판정, { ...소속조건, 소속: ['SHOWVY'] }), 1);
  assert.strictEqual(판정.items.showvy.status, '됨');
  const 답 = (원문, 소속만, 소속종류) => 자격.답읽기({ quote: 원문, 누구나: false, 지역: [], 소속만, 소속종류, 최소나이: -1, 최대나이: -1 }, 원문).제한;
  assert.strictEqual(답(쇼비문구, 'SHOWVY 회원', '무료가입').소속종류, '무료가입');
  assert.strictEqual(답(솔데스크문구, '솔데스크 수강생', '소속').소속종류, '소속');
  assert.strictEqual(답(솔데스크문구, '솔데스크 수강생', '아무거나').소속종류, '', '모르는 값은 버린다');
});

test('자격확인은 두 문구의 카본 답을 받아 SHOWVY는 됨, 솔데스크는 안 됨으로 쌓는다', async () => {
  const dir = 폴더();
  fs.writeFileSync(path.join(dir, '신청자조건.json'), JSON.stringify({ schema: 'synk-applicant-v1', ...소속조건 }));
  const 글 = { 'https://showvy.example.com/next': `<p>${쇼비문구}</p>`, 'https://soldesk.example.co.kr/n': `<p>${솔데스크문구}</p>` };
  const 물은글 = [];
  const carbon = async ({ prompt, schema }) => {
    물은글.push(prompt);
    assert.ok(schema.properties.cases.items.required.includes('소속종류'));
    const cases = [];
    if (prompt.includes('SHOWVY')) cases.push({ id: 자격.열쇠('SHOWVY NEXT AI 숏드라마 공모전'), quote: 'SHOWVY 회원이라면 누구나 참가할 수 있습니다.', 누구나: false, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 소속만: 'SHOWVY 회원', 소속종류: '무료가입', 최소나이: 18, 최대나이: -1, 현장지역: [] });
    if (prompt.includes('솔데스크')) cases.push({ id: 자격.열쇠('솔데스크 영상 홍보 공모전'), quote: 솔데스크문구, 누구나: false, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 소속만: '솔데스크 수강생', 소속종류: '소속', 최소나이: -1, 최대나이: -1, 현장지역: [] });
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases }) };
  };
  await 자격.자격확인(dir, [
    { 제목: 'SHOWVY NEXT AI 숏드라마 공모전', 주소: 'https://showvy.example.com/next' },
    { 제목: '솔데스크 영상 홍보 공모전', 주소: 'https://soldesk.example.co.kr/n' },
  ], { fetchPage: async u => ({ 됨: true, 글: 글[u] }), carbon, budgetMs: 600000 });
  const 판정 = 자격.판정읽기(dir);
  assert.strictEqual(자격.판정찾기(판정, 'SHOWVY NEXT AI 숏드라마 공모전').status, '됨');
  assert.strictEqual(자격.판정찾기(판정, '솔데스크 영상 홍보 공모전').status, '안 됨');
  assert.ok(물은글.every(p => p.includes('무료가입') && p.includes('OO 수강생 누구나')), '지시문이 무료 가입 회원과 수강생을 가른다');
});

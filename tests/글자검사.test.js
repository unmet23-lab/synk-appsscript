'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const G = require('../tools/lib/글자검사.js');
const P = require('../tools/lib/현지화프로필.js');
const 판본글 = require('../tools/lib/판본글.js');

const REPO = path.resolve(__dirname, '..');
const 판 = (줄) => ({ 줄: 줄.map((z, i) => ({ 칸: '보기', 대조방식: '직역', 순번: i + 1, ...z })) });
const 코드들 = (fs_) => fs_.map((f) => `${f.수준}:${f.코드}`);
const 있나 = (fs_, 수준, 코드) => fs_.some((f) => f.수준 === 수준 && f.코드 === 코드);
const 도구있나 = (cmd, args = ['-version']) => { try { return spawnSync(cmd, args, { windowsHide: true }).status === 0; } catch { return false; } };
const 파이썬모듈 = () => { try { return spawnSync('python', ['-c', 'import fontTools, uharfbuzz'], { windowsHide: true }).status === 0; } catch { return false; } };

test('안전 영역은 tools/올리기전검사.js ⑤의 SAFE와 같다(SNS 키트 cover916)', () => {
  assert.deepEqual(G.안전영역(), require('../tools/올리기전검사.js').SAFE);
});

test('규칙 — 섞인 문자 · 결합 글자 시작 · 정규화 · 보이지 않는 글자 · 공백', () => {
  const ru = G.규칙검사(판([{ id: 'a', 글: 'Cпасибо' }, { id: 'b', 글: 'Спасибо ' }]), P.언어('ru'));
  assert.ok(있나(ru.filter((f) => f.줄 === 'a'), '고칠 것', '섞인문자'), JSON.stringify(ru));
  assert.ok(있나(ru.filter((f) => f.줄 === 'b'), '확인할 것', '공백'));
  const th = G.규칙검사(판([{ id: 'a', 글: '่กา' }, { id: 'b', 글: 'กา ่ข' }]), P.언어('th'));
  assert.ok(있나(th.filter((f) => f.줄 === 'a'), '고칠 것', '결합시작'));
  assert.ok(있나(th.filter((f) => f.줄 === 'b'), '고칠 것', '결합시작'));
  const 이모지 = G.규칙검사(판([{ id: 'e', 글: 'ขำมาก ❤️ 1️⃣' }]), P.언어('th'));
  assert.ok(!이모지.some((f) => f.코드 === '결합시작'), '이모지 변형 선택자 · 키캡은 결합 시작이 아니다');
  const vi = G.규칙검사(판([{ id: 'a', glyph: 1, 글: 'Tie\u0302\u0301ng Vie\u0323\u0302t' }]), P.언어('vi'));
  assert.ok(있나(vi, '고칠 것', '정규화'));
  const my = G.규칙검사(판([{ id: 'a', 글: 'ဝယ်\u2060သူ' }, { id: 'b', 글: 'ab\u200Bcd' }]), P.언어('my'));
  assert.ok(!my.some((f) => f.줄 === 'a' && f.코드 === '보이지않는글자'), 'U+2060은 버마어 낱말 이음으로 허용');
  assert.ok(있나(my.filter((f) => f.줄 === 'b'), '확인할 것', '보이지않는글자'));
});

test('규칙 — 손으로 넣은 줄바꿈의 금칙 · 낱말 중간(띄어 쓰지 않는 언어)', () => {
  const ja = G.규칙검사(판([{ id: 'a', 글: 'おかしすぎて\n、おなか' }, { id: 'b', 글: '答えは「\nこれ」' }]), P.언어('ja'));
  assert.ok(있나(ja.filter((f) => f.줄 === 'a'), '고칠 것', '줄머리금칙'));
  assert.ok(있나(ja.filter((f) => f.줄 === 'b'), '고칠 것', '줄끝금칙'));
  // 태국어 ขำจน|ท้อง은 낱말 경계, ขำจนท้อ|ง는 낱말 가운데
  const 좋음 = G.규칙검사(판([{ id: 'a', 글: 'ขำจน\nท้องแข็ง' }]), P.언어('th'));
  assert.ok(!좋음.some((f) => f.코드 === '낱말중간줄바꿈'), JSON.stringify(좋음));
  const 나쁨 = G.규칙검사(판([{ id: 'a', 글: 'ขำจนท้อ\nงแข็ง' }]), P.언어('th'));
  assert.ok(있나(나쁨, '고칠 것', '낱말중간줄바꿈'));
  // 띄어 쓰는 언어의 줄바꿈은 공백 자리로 본다
  const en = G.규칙검사(판([{ id: 'a', 글: 'The bus left right\nin front of me…' }]), P.언어('en'));
  assert.ok(!en.some((f) => f.코드 === '낱말중간줄바꿈'));
});

test('규칙 — 언어별 문장부호(간체 전각 · 줄임표, 스페인어 여는 부호, 우즈베크 ʻ, 버마어 자우지 · 마침표)', () => {
  const zh = G.규칙검사(판([{ id: 'a', 글: '太好笑了,我快笑破肚皮了...' }, { id: 'b', 글: '太好笑了，我快笑破肚皮了……' }]), P.언어('zh-Hans'));
  const a = zh.filter((f) => f.줄 === 'a');
  assert.ok(a.filter((f) => f.수준 === '고칠 것' && f.코드 === '문장부호').length >= 2, JSON.stringify(a));
  assert.equal(zh.filter((f) => f.줄 === 'b' && f.코드 === '문장부호').length, 0, JSON.stringify(zh));
  const es = G.규칙검사(판([{ id: 'a', 글: '¿Qué significa de verdad?' }, { id: 'b', 글: 'Qué significa?' }, { id: 'c', 글: '¡NIVEL 1!' }]), P.언어('es'));
  assert.ok(!es.some((f) => f.줄 === 'a' || f.줄 === 'c'));
  assert.ok(있나(es.filter((f) => f.줄 === 'b'), '고칠 것', '문장부호'));
  const uz = G.규칙검사(판([{ id: 'a', 글: "ko'rgan" }, { id: 'b', 글: 'koʻrgan' }]), P.언어('uz'));
  assert.ok(있나(uz.filter((f) => f.줄 === 'a'), '확인할 것', '문장부호'));
  assert.ok(!uz.some((f) => f.줄 === 'b'));
  const my = G.규칙검사(판([{ id: 'a', 글: 'ေမာင္' }, { id: 'b', 글: 'မပြောဘူး.' }]), P.언어('my'));
  assert.ok(my.some((f) => f.줄 === 'a' && f.수준 === '고칠 것' && /자우지/.test(f.말)), JSON.stringify(my));
  assert.ok(my.some((f) => f.줄 === 'b' && /။/.test(f.말)));
});

test('규칙 — 번역 빠짐(비라틴 언어 줄에 그 글자가 없음)과 한국어 · 읽기 칸은 건너뜀', () => {
  const r = G.규칙검사(판([{ id: 'a', 글: 'Laughs hard' }, { id: 'b', 칸: '읽기', 글: 'bae-kkop' }, { id: 'c', 칸: '한국어', 글: '배꼽이 빠지다' }, { id: 'd', 글: 'ขำท้องแข็ง' }]), P.언어('th'));
  assert.ok(있나(r.filter((f) => f.줄 === 'a'), '확인할 것', '번역빠짐'));
  assert.ok(!r.some((f) => ['b', 'c', 'd'].includes(f.줄)), JSON.stringify(r));
});

test('읽기 시간 — 끝이 같은 줄은 한 화면으로 묶고, 모자라면 확인할 것 · 크게 모자라면 고칠 것', () => {
  const L = P.언어('zh-Hans'); // 초당 7자
  const ok = G.읽기시간검사(판([{ id: 'a', 글: '没有客人', 초: [0, 2] }]), L);
  assert.equal(ok.length, 0);
  const 묶음 = G.읽기시간검사(판([{ id: 'a', 글: '抓虫子', 초: [1, 2] }, { id: 'b', 글: '没有客人', 초: [1.2, 2] }, { id: 'c', 글: '房间很脏', 초: [1.4, 2.1] }]), L);
  assert.equal(묶음.length, 1);
  assert.equal(묶음[0].수준, '확인할 것');
  assert.match(묶음[0].줄, /a,b,c/);
  const 많이 = G.읽기시간검사(판([{ id: 'a', 글: '出去旅行才发现，原来我就是井底之蛙！', 초: [0, 1.5] }]), L);
  assert.equal(많이[0].수준, '고칠 것');
});

test('엔진 판정 — 상자 넘침 · 줄 수 · 테두리 닿음 · 엔진 줄바꿈의 낱말 중간 · 버마어 자동 줄바꿈 · 안전 영역 · 대체 글꼴', () => {
  const th = P.언어('th');
  const 줄들 = [
    { id: 'wide', 글: 'ขำท้องแข็ง', 상자: { 폭: 300, 글자크기: 46, 최대줄: 1 } },
    { id: 'lines', 글: 'ตลกมาก ขำจนท้องแข็งเลย', 상자: { 폭: 300, 글자크기: 30, 최대줄: 1 } },
    { id: 'touch', 글: 'กินมากไป', 상자: { 폭: 300, 글자크기: 40 } },
    { id: 'mid', 글: 'ขำจนท้องแข็ง', 상자: { 폭: 300, 글자크기: 40, 최대줄: 2 } },
    { id: 'safe', 글: 'ต่อไป', 상자: { 폭: 200, 글자크기: 40, x: 860, y: 400 } },
  ];
  const 잰것 = [
    { i: 0, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 50, clientH: 50, lines: [{ top: 0, bottom: 50, left: 0, right: 340, start: 0, end: 10 }] },
    { i: 1, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 80, clientH: 80, lines: [{ top: 0, bottom: 38, left: 0, right: 200, start: 0, end: 7 }, { top: 38, bottom: 76, left: 0, right: 250, start: 7, end: 22 }] },
    { i: 2, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 48, clientH: 48, lines: [{ top: 0, bottom: 48, left: 2, right: 296, start: 0, end: 9 }] },
    // ขำจนท้อ|งแข็ง — 7번째 글자 자리에서 갈림(낱말 가운데)
    { i: 3, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 96, clientH: 96, lines: [{ top: 0, bottom: 48, left: 0, right: 200, start: 0, end: 7 }, { top: 48, bottom: 96, left: 0, right: 100, start: 7, end: 12 }] },
    { i: 4, boxLeft: 0, boxRight: 200, boxTop: 0, scrollH: 48, clientH: 48, lines: [{ top: 0, bottom: 48, left: 0, right: 120, start: 0, end: 5 }] },
  ];
  const 글꼴 = { 0: [{ familyName: 'Leelawadee UI', glyphCount: 9 }, { familyName: 'Tahoma', glyphCount: 2 }] };
  const f = G.엔진판정(줄들, 잰것, 글꼴, th);
  const 줄 = (id) => f.filter((x) => x.줄 === id).map((x) => `${x.수준}:${x.코드}`);
  assert.ok(줄('wide').includes('고칠 것:상자넘침'), JSON.stringify(f));
  assert.ok(줄('wide').includes('확인할 것:대체글꼴'));
  // 가변 글꼴의 내부 이름(SUIT → 「SUIT Variable Thin」)은 선언한 글꼴이다 — 대체 글꼴로 짚지 않는다. 이름만 비슷한 다른 글꼴(SUITE)은 짚는다
  const 가변 = (이름) => G.엔진판정([{ id: 'ko', 글: '먹지 마', 상자: { 폭: 300, 글자크기: 46, 글꼴: "'Inter Tight', 'SUIT', sans-serif" } }],
    [{ i: 0, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 50, clientH: 50, lines: [{ top: 0, bottom: 50, left: 0, right: 150, start: 0, end: 4 }] }],
    { 0: [{ familyName: 이름, glyphCount: 3 }] }, P.언어('en')).some((x) => x.코드 === '대체글꼴');
  assert.equal(가변('SUIT Variable Thin'), false);
  assert.equal(가변('SUIT'), false);
  assert.equal(가변('SUITE Sans'), true);
  assert.equal(가변('Malgun Gothic'), true);
  // 그 나라 말로 온 윈도우 글꼴 이름(微軟正黑體 = Microsoft JhengHei)도 선언한 글꼴이다
  const 번체 = (이름) => G.엔진판정([{ id: 'tw', 글: '不要吃！', 상자: { 폭: 300, 글자크기: 46, 글꼴: "'Microsoft JhengHei', 'Inter Tight', sans-serif" } }],
    [{ i: 0, boxLeft: 0, boxRight: 300, boxTop: 0, scrollH: 50, clientH: 50, lines: [{ top: 0, bottom: 50, left: 0, right: 180, start: 0, end: 4 }] }],
    { 0: [{ familyName: 이름, glyphCount: 4 }] }, P.언어('zh-Hant')).some((x) => x.코드 === '대체글꼴');
  assert.equal(번체('微軟正黑體'), false);
  assert.equal(번체('Microsoft JhengHei'), false);
  assert.equal(번체('微软雅黑'), true, '선언하지 않은 글꼴(간체 YaHei)이 맡으면 짚는다');
  assert.ok(줄('lines').includes('고칠 것:줄수넘침'));
  assert.ok(줄('touch').includes('확인할 것:테두리닿음'));
  assert.ok(줄('mid').includes('고칠 것:낱말중간줄바꿈'));
  assert.ok(줄('safe').includes('고칠 것:안전영역'));
  // 버마어는 사전 낱말 가르기를 못 믿어 공백 아닌 엔진 줄바꿈을 늘 확인할 것으로(퀴즈 #5 ဝယ်/သူ)
  const my = G.엔진판정([{ id: 'm', 글: 'ဝယ်သူမရှိဘူး', 상자: { 폭: 200, 글자크기: 40, 최대줄: 2 } }],
    // ဝယ်|သူ… — ICU 사전 경계(ဝယ်는 세 글자)라 「낱말 가운데」로는 안 잡히지만 버마어는 확인할 것
    [{ i: 0, boxLeft: 0, boxRight: 200, boxTop: 0, scrollH: 96, clientH: 96, lines: [{ top: 0, bottom: 48, left: 0, right: 150, start: 0, end: 3 }, { top: 48, bottom: 96, left: 0, right: 150, start: 3, end: 13 }] }], {}, P.언어('my'));
  assert.ok(!my.some((x) => x.코드 === '낱말중간줄바꿈'), JSON.stringify(my));
  assert.ok(my.some((x) => x.코드 === '자동줄바꿈' && x.수준 === '확인할 것'), JSON.stringify(my));
});

test('프레임 판정 — OCR 글이 0.5초 넘게 단추 자리면 고칠 것, 픽셀 차이 · 기준 판 글 자리는 확인할 것, 좁은 여백은 서로 다른 셋', () => {
  const ocr = (x0, x1, y0 = 900, y1 = 950) => ({ x0, x1, y0, y1, 출처: 'ocr' });
  const 차이 = (x0, x1, y0 = 1300, y1 = 1350) => ({ x0, x1, y0, y1, 출처: '차이' });
  const 프레임들 = [
    { 초: 0, 번호: 0, 판본상자: [ocr(300, 960)], 기준상자: [] },
    { 초: 0.5, 번호: 1, 판본상자: [ocr(300, 965)], 기준상자: [] },
    { 초: 1, 번호: 2, 판본상자: [차이(500, 990)], 기준상자: [] },
    { 초: 2, 번호: 4, 판본상자: [ocr(860, 1040, 360, 420)], 기준상자: [{ x0: 870, x1: 1030, y0: 365, y1: 415 }] },
    { 초: 3, 번호: 6, 판본상자: [ocr(100, 500, 600, 650)], 기준상자: [] },
  ];
  const r = G.프레임판정(프레임들, { 플랫폼: 'tiktok' });
  assert.ok(r.찾음.some((f) => f.수준 === '고칠 것' && f.코드 === '단추가림' && /틱톡/.test(f.말)), JSON.stringify(r.찾음));
  assert.ok(r.찾음.some((f) => f.수준 === '확인할 것' && f.코드 === '단추가림차이'));
  assert.ok(r.찾음.some((f) => f.수준 === '확인할 것' && f.코드 === '단추가림기준'));
  assert.equal(r.좁은.length, 3);
  const 초들 = r.좁은.map((m) => m.초).sort((a, b) => a - b);
  for (let i = 1; i < 초들.length; i += 1) assert.ok(초들[i] - 초들[i - 1] >= 1);
  // 한 장면만 걸친 OCR 글은 확인할 것
  const 한번 = G.프레임판정([{ 초: 0, 번호: 0, 판본상자: [ocr(300, 960)], 기준상자: [] }]);
  assert.ok(한번.찾음.every((f) => f.수준 === '확인할 것'));
  // 넘은 띠의 화소가 기준 판과 같은 OCR 상자(그림 속 병 · 펠트 결을 글로 읽은 것)는 0.5초 넘게 머물러도 고칠 것이 아니다
  const 그림 = G.프레임판정([
    { 초: 0, 번호: 0, 판본상자: [{ ...ocr(900, 1068, 500, 560), 정본같음: true }], 기준상자: [] },
    { 초: 0.5, 번호: 1, 판본상자: [{ ...ocr(902, 1066, 500, 560), 정본같음: true }], 기준상자: [] },
  ]);
  assert.ok(그림.찾음.every((f) => f.수준 === '확인할 것'), JSON.stringify(그림.찾음));
  assert.ok(그림.찾음.some((f) => f.코드 === '단추가림기준'));
  // 11-10 화날때: 기준 판 글도 같은 안전선을 같은 자리에서 넘으면(원본부터 선 밖 — 판본마다 글 길이만 다르다) 기준 판 글 자리로 본다.
  // 이 판이 40px 넘게 더 나가거나, 기준 판 글이 선을 안 넘거나, 선을 따라 다른 자리면 그대로 고칠 것
  const R = G.안전영역().right;
  const 판 = (x1, y0 = 700, y1 = 760) => ({ x0: 500, x1, y0, y1, 출처: 'ocr' });
  const 두장 = (판본, 기준) => G.프레임판정([0, 0.5].map((초, 번호) => ({ 초, 번호, 판본상자: [판본], 기준상자: [기준] })));
  const 수준들 = (r) => r.찾음.filter((f) => /단추가림/.test(f.코드)).map((f) => `${f.수준}:${f.코드}`);
  assert.deepEqual(수준들(두장(판(R + 60), 판(R + 30, 710, 770))), ['확인할 것:단추가림기준'], '기준 판도 같은 자리에서 넘는다');
  assert.deepEqual(수준들(두장(판(R + 90), 판(R + 30, 710, 770))), ['고칠 것:단추가림'], '기준 판보다 40px 넘게 더 나간다');
  assert.deepEqual(수준들(두장(판(R + 60), 판(R - 10, 710, 770))), ['고칠 것:단추가림'], '기준 판 글은 선 안이다');
  assert.deepEqual(수준들(두장(판(R + 60), 판(R + 30, 1200, 1260))), ['고칠 것:단추가림'], '선을 따라 다른 자리다');
});

test('넘은 띠 · 다른 화소 비율 — 안전 영역 밖으로 나간 부분이 기준 판과 같은 화소인지', () => {
  const SAFE = G.안전영역();
  const 띠 = G.넘은띠들({ x0: 860, x1: 1040, y0: 400, y1: 460 }, SAFE);
  assert.equal(띠.length, 1);
  assert.equal(띠[0].x0, SAFE.right);
  assert.equal(G.넘은띠들({ x0: 300, x1: 600, y0: 400, y1: 460 }, SAFE).length, 0);
  const W = 540, H = 960;
  const a = Buffer.alloc(W * H, 100), 같은 = Buffer.alloc(W * H, 110), 다른 = Buffer.alloc(W * H, 100);
  for (let y = 200; y < 230; y += 1) for (let x = 460; x < 520; x += 1) 다른[y * W + x] = 250; // 기준 판에는 그 자리에 다른 글이 있다
  assert.equal(G.다른화소비율(a, 같은, 띠[0]), 0, '부호화 잡음(문턱 아래)은 같은 화소다');
  assert.ok(G.다른화소비율(a, 다른, 띠[0]) > 0.5);
});

test('차이 덩어리 — 기준 둘과 모두 다르고 머물러 있는 글만 잡는다(움직이는 판 · 기준 글자는 빠진다)', () => {
  const W = 540, H = 960;
  const 빈 = () => Buffer.alloc(W * H, 100);
  const 칠 = (b, x0, y0, x1, y1, v) => { for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) b[y * W + x] = v; return b; };
  const 판 = 칠(빈(), 100, 100, 200, 120, 250); // 판본 글
  const 기준1 = 칠(빈(), 300, 300, 400, 320, 250); // 기준 글 — 판본엔 없음
  const 기준2 = 빈();
  const 덩어리 = G.차이덩어리(판, [기준1, 기준2]);
  assert.equal(덩어리.length, 1);
  assert.ok(덩어리[0].x0 <= 200 && 덩어리[0].x1 >= 400 && 덩어리[0].y0 <= 200 && 덩어리[0].y1 >= 240, JSON.stringify(덩어리));
  // 앞 장면과 달라진 화소(튀어나오는 판)는 뺀다
  const 앞 = 빈();
  assert.equal(G.차이덩어리(판, [기준2], { 이웃: 앞 }).length, 0);
  assert.equal(G.차이덩어리(판, [기준2], { 이웃: 판 }).length, 1);
});

test('판정 — 고칠 것이 있으면 고칠 것, 확인할 것만이면 확인할 것(눈확인 메모를 주면 통과)', () => {
  assert.equal(G.판정하기([]), '통과');
  assert.equal(G.판정하기([{ 수준: '확인할 것' }]), '확인할 것');
  assert.equal(G.판정하기([{ 수준: '확인할 것' }], { 눈확인: '세 장 봄' }), '통과');
  assert.equal(G.판정하기([{ 수준: '고칠 것' }], { 눈확인: '봄' }), '고칠 것');
});

test('글꼴 검사(fontTools · HarfBuzz) — 네모 글자 · 결합 깨짐(점선 원) · 한자권 부호를 라틴 글꼴이 맡음', { skip: !파이썬모듈() && 'python fontTools · uharfbuzz 없음' }, () => {
  const th = P.언어('th');
  const r = G.글꼴검사(판([
    { id: 'tofu', 글: 'ขำท้องแข็ง', 상자: { 폭: 600, 글자크기: 46, 글꼴: "'Inter Tight', sans-serif" } },
    { id: 'ok', 글: 'ขำท้องแข็ง', 상자: { 폭: 600, 글자크기: 46 } },
  ]), th);
  assert.ok(r.찾음.some((f) => f.줄 === 'tofu' && f.코드 === '네모글자'), JSON.stringify(r.찾음));
  assert.ok(!r.찾음.some((f) => f.줄 === 'ok'), JSON.stringify(r.찾음));
  const my = G.글꼴검사(판([{ id: 'medial', 글: 'ွဝယ်' }]), P.언어('my'));
  assert.ok(my.찾음.some((f) => f.줄 === 'medial' && f.코드 === '결합깨짐'), JSON.stringify(my.찾음));
  const zh = G.글꼴검사(판([{ id: 'dots', 글: '笑到不行……' }]), P.언어('zh-Hans'));
  assert.ok(zh.찾음.some((f) => f.줄 === 'dots' && f.코드 === '라틴글꼴부호'), JSON.stringify(zh.찾음));
  // 이모지는 네모가 아니라 「시스템 글꼴이 그림」(확인할 것), 게시글은 영상에 안 그려 건너뛴다
  const em = G.글꼴검사(판([{ id: 'emoji', 글: 'ขำมาก 😂' }, { id: 'cap', 칸: '게시글', 글: 'ขำมาก 😂' }]), th);
  assert.ok(em.찾음.some((f) => f.줄 === 'emoji' && f.코드 === '기호대체' && f.수준 === '확인할 것'), JSON.stringify(em.찾음));
  assert.ok(!em.찾음.some((f) => f.코드 === '네모글자' || f.줄 === 'cap'), JSON.stringify(em.찾음));
});

test('엔진 잼(크롬) — 실제 크롬으로 넘침을 잰다', { skip: !fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') && !process.env.SYNK_CHROME && '크롬 없음' }, async () => {
  const r = await G.엔진재기(판([
    { id: 'long', 글: 'Supercalifragilisticexpialidocious', 상자: { 폭: 200, 글자크기: 40, 최대줄: 2 } },
    { id: 'fit', 글: 'Keeps secrets', 상자: { 폭: 600, 글자크기: 40, 최대줄: 1 } },
  ]), P.언어('en'));
  assert.ok(r.찾음.some((f) => f.줄 === 'long' && f.코드 === '상자넘침'), JSON.stringify(r.찾음));
  assert.ok(!r.찾음.some((f) => f.줄 === 'fit'), JSON.stringify(r.찾음));
  assert.equal(r.잰것.find((m) => m.id === 'fit').줄수, 1);
});

test('판본 명령 — 영상 프레임을 기준 판과 견주고 --기록이면 돌림.판본[키].검수.글자에 영상 지문을 적는다', { skip: (!도구있나('ffmpeg') || process.platform !== 'win32') && 'ffmpeg · 윈도우 OCR 없음' }, async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '글자검사-시험-'));
  const 편 = path.join(방, 'LAB_시험편_20261110');
  fs.mkdirSync(path.join(편, '게시'), { recursive: true });
  // 판본 영상: 오른쪽 단추 자리(x 920 넘어)까지 흰 띠 · 기준 영상: 가운데 흰 띠
  const 굽기 = (out, box) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x3a6bd0:s=1080x1920:d=2:r=30',
    '-vf', `drawbox=${box}:color=white:t=fill`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out], { windowsHide: true });
  굽기(path.join(편, 'th.mp4'), 'x=500:y=900:w=560:h=80');
  굽기(path.join(편, 'en.mp4'), 'x=300:y=900:w=400:h=80');
  fs.writeFileSync(path.join(편, '글_th.json'), JSON.stringify({ 꼴: '판본글/1', 편: 'LAB_시험편_20261110', 판본: 'TH', 언어: 'th', 나라: ['TH'], 틀: '이야기', 줄: [{ id: 'a', 칸: '상황', 글: 'ขำท้องแข็ง', 초: [0, 2] }] }));
  fs.writeFileSync(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 돌림: { 형식: '이야기', 판본: {
    TH: { 언어: 'th', 파일: 'th.mp4', 글: '글_th.json' }, EN: { 언어: 'en', 파일: 'en.mp4' } } } }, null, 2));
  const 밖 = path.join(방, '밖');
  const { main } = require('../tools/글자검사.js');
  const 원로그 = console.log;
  console.log = () => {};
  let code;
  try { code = await main(['판본', 편, 'TH', '--엔진없이', '--기록', '--밖', 밖]); } finally { console.log = 원로그; }
  assert.equal(code, 3); // 픽셀 차이는 확인할 것까지만
  const 결과 = JSON.parse(fs.readFileSync(path.join(밖, '결과.json'), 'utf8'));
  assert.ok(결과.찾음.some((f) => f.코드 === '단추가림차이'), JSON.stringify(결과.찾음));
  assert.ok(결과.좁은.length >= 1 && fs.existsSync(결과.좁은[0].자른));
  assert.deepEqual(결과.기준.map((p) => path.basename(p)), ['en.mp4']);
  const prep = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8'));
  const 기록 = prep.돌림.판본.TH.검수.글자;
  assert.equal(기록.결과, '확인할 것');
  assert.equal(기록.지문, 판본글.sha256(path.join(편, 'th.mp4')));
  assert.equal(기록.도구, 'tools/글자검사.js');
  assert.equal(prep.돌림.판본.EN.검수, undefined); // 다른 판본은 건드리지 않는다
  // 눈확인 메모를 주면 통과로 적는다
  console.log = () => {};
  try { code = await main(['판본', 편, 'TH', '--엔진없이', '--기록', '--밖', 밖, '--눈확인', '좁은 여백 봄 — 글은 띠 안']); } finally { console.log = 원로그; }
  assert.equal(code, 0);
  const 다시 = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.글자;
  assert.equal(다시.결과, '통과');
  assert.equal(다시.눈확인, '좁은 여백 봄 — 글은 띠 안');
  fs.rmSync(방, { recursive: true, force: true });
});

'use strict';
// 영상 관문(/굽기전검수 · /마감작업, 2026-11-12 유호님 「둘 다 세팅」) — 관문 워크플로 .claude/workflows/video-gate.js를
//   가짜 agent로 모의 실행해 본다: 검수자 하나가 여는 그림 30장 한도 · P0 · P1만 반박 · 「아님」을 두 번 들어야 기각 · 컷별 판정 순위 ·
//   Fable 5.2가 아닌 답이면 결과를 안 씀 · 결과 없는 관점은 빠짐에 남음 · 다시 검수는 고친 자리만 ·
//   다시 검수의 컷별 표는 지난 번호를 「지난 F12」로 가르고 지난 P0 · P1 「그대로」만 컷 판정에 넣음(11-17, 실제 사례 데이터로 표 셈만 떼어 돌린다).
//   그리고 스킬 두 장 · 판 도구 · synk-video 한 장 · 운영 원칙 · .gitignore가 서로를 가리키는지 본다.
//   판 도구(tools/영상관문판.py)는 그림 라이브러리 · ffmpeg가 있어야 돌아 여기서는 돌리지 않는다 — PC에서 실제 편으로 확인한다(11-12 yuhobuilds 55초).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = rel => fs.readFileSync(path.join(뿌리, rel), 'utf8');
const 워크플로 = '.claude/workflows/video-gate.js';
const 소스 = 읽기(워크플로);

function 메타() {
  // 줄끝은 CRLF도 받는다 — core.autocrlf=true인 윈도 작업본은 따라가기 뒤 CRLF로 풀린다(11-12 이 PC에서만 깨졌다, CI 리눅스는 LF)
  const m = 소스.match(/^export const meta = (\{[\s\S]*?\r?\n\})\r?\n/m);
  assert.ok(m, 'meta 블록을 못 찾음');
  return new Function(`return ${m[1]}`)();
}

function 실행기() {
  const 몸 = 소스.replace(/^export const meta =/m, 'const meta =');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', 몸);
}

function 가짜판(n) {
  const 컷 = Array.from({ length: n }, (_, i) => ({
    cut: `C${i + 1}`,
    장면: i < n / 2 ? '낮' : '밤',
    인물: i % 4 === 3 ? [] : ['수아'],
    그림: [`C:/편/검수/마감_1/판/띠_C${i + 1}.jpg`],
    움직임: '',
  }));
  const 판 = k => Array.from({ length: k }, (_, i) => i);
  return {
    끝코드: 0,
    컷,
    기준: [
      { 종류: '장면', 이름: '낮', 그림: 'C:/편/검수/마감_1/판/기준_장면_낮.jpg' },
      { 종류: '장면', 이름: '밤', 그림: 'C:/편/검수/마감_1/판/기준_장면_밤.jpg' },
      { 종류: '인물', 이름: '수아', 그림: 'C:/편/검수/마감_1/판/기준_인물_수아.jpg' },
    ],
    판: {
      전체: 판(Math.ceil(n / 8)).map(i => `C:/편/검수/마감_1/판/전체_${i + 1}.jpg`),
      장면: ['C:/편/검수/마감_1/판/장면_낮_1.jpg', 'C:/편/검수/마감_1/판/장면_밤_1.jpg'],
      얼굴: ['C:/편/검수/마감_1/판/얼굴_수아_1.jpg'],
      끝: 'C:/편/검수/마감_1/판/끝.jpg',
    },
    숫자: 'C:/편/검수/마감_1/판/숫자.json',
    살펴볼움직임: ['C3'],
    도구: [{ 이름: '컷연속성검사', 끝코드: 2, 요약: '걸림 0 · 확인 1' }],
    못함: [],
  };
}

const 지적들 = prompt => JSON.parse(prompt.slice(prompt.indexOf('지적:\n[') + 4));
const 그림수 = prompt => new Set(prompt.match(/[A-Za-z]:[\\/][^\s"'`]+?\.jpe?g/g) || []).size;

// 하네스가 실제로 돌려주는 꼴 — 영문 틀(칸 설명 맨 앞의 「한글」로 짝을 찾는다)대로 칸 이름을 영문으로 바꾼다(11-15 서울로 마감 관문 400)
function 영문으로(v, 틀) {
  if (v == null || !틀) return v;
  if (Array.isArray(v)) return v.map(x => 영문으로(x, 틀.items));
  if (typeof v !== 'object' || !틀.properties) return v;
  const 짝 = {};
  for (const [ek, pt] of Object.entries(틀.properties)) { const m = /^「(.+?)」 칸/.exec(pt.description || ''); 짝[m ? m[1] : ek] = [ek, pt]; }
  const out = {};
  for (const [k, x] of Object.entries(v)) { const [ek, pt] = 짝[k] || [k, null]; out[ek] = 영문으로(x, pt); }
  return out;
}

async function 돌리기({ 판 = 가짜판(12), 훑기답 = () => [], 반박답 = () => ({}), 비평답 = () => [], 덧 = {}, 모델 = 'claude-fable-5-2', 빈관점 = null, 영문답 = false } = {}) {
  const 부름 = [];
  const 로그 = [];
  const agent = async (prompt, opts = {}) => { const r = await 답하기(prompt, opts); return 영문답 ? 영문으로(r, opts.schema) : r; };
  const 답하기 = async (prompt, opts = {}) => {
    부름.push({ prompt, opts });
    if (opts.phase === '준비') return 판;
    if (opts.phase === '훑기') return 빈관점 && opts.label.startsWith(빈관점) ? null : { 모델, 본컷: [], 지적: 훑기답(opts.label, prompt) };
    if (opts.phase === '반박') {
      const 차례 = Number(opts.label.match(/반박 (\d)/)[1]);
      return { 모델, 판정: 지적들(prompt).map(f => ({ id: f.id, 까닭: '봄', ...반박답(f, 차례) })).filter(x => x.답) };
    }
    if (opts.phase === '빠진 것') return { 모델, 빠짐: [], 지적: 비평답() };
    if (opts.phase === '기록') {
      const j = JSON.parse(prompt.slice(prompt.lastIndexOf('JSON:\n') + 6));
      부름.at(-1).결과 = j;
      return { 결과파일: 'C:/편/검수/마감_1/결과.json', 보고파일: 'C:/편/검수/마감_1/보고.md', 지적수: j.지적.length, 컷수: j.컷별.length };
    }
    throw new Error(`모르는 phase ${opts.phase}`);
  };
  const parallel = thunks => Promise.all(thunks.map(t => t().catch(() => null)));
  const args = {
    관문: '마감', 편: 'C:/편', 컷표: 'C:/편/컷표.json', 출력: 'C:/편/검수/마감_1', 판폴더: 'C:/편/검수/마감_1/판', 최종: 'C:/편/최종.mp4', ...덧,
  };
  const 반환 = await 실행기()(agent, parallel, async () => [], () => {}, m => 로그.push(m), args, { total: null, spent: () => 0, remaining: () => Infinity }, async () => null);
  const 기록 = 부름.find(b => b.opts.phase === '기록');
  return { 반환, 부름, 로그, 결과: 기록 && 기록.결과 };
}

const 지적 = (컷, 등급, 고칠곳, 무엇 = '본 것') => ({ 컷, 등급, 무엇, 근거: [`C:/편/검수/마감_1/판/띠_${컷}.jpg`], 고칠곳, 고칠법: '다시' });

test('meta는 순수 리터럴이고, 스크립트의 phase 이름이 모두 meta에 있다', () => {
  const m = 메타();
  assert.equal(m.name, 'video-gate');
  const 이름 = new Set(m.phases.map(p => p.title));
  const 쓴 = [...소스.matchAll(/phase\('([^']+)'\)|phase: '([^']+)'/g)].map(x => x[1] || x[2]);
  assert.ok(쓴.length >= 5);
  for (const p of 쓴) assert.ok(이름.has(p), `meta.phases에 없는 phase: ${p}`);
});

test('다시 돌리기(resume)를 깨는 Date.now · Math.random · 인자 없는 new Date()를 쓰지 않는다', () => {
  assert.doesNotMatch(소스, /Date\.now\(|Math\.random\(|new Date\(\)/);
});

test('검수자 하나가 여는 그림은 30장을 넘지 않고, 컷 관점이 모든 컷을 덮는다', async () => {
  const 판 = 가짜판(70);
  const { 부름 } = await 돌리기({ 판 });
  const 훑기 = 부름.filter(b => b.opts.phase === '훑기');
  for (const b of 훑기) assert.ok(그림수(b.prompt) <= 30, `${b.opts.label}가 그림 ${그림수(b.prompt)}장을 연다`);
  const 컷관점 = 훑기.filter(b => b.opts.label.startsWith('컷 전수'));
  assert.ok(컷관점.length >= 3, '70컷인데 컷 관점이 셋보다 적다');
  const 덮음 = new Set(컷관점.flatMap(b => [...b.prompt.matchAll(/띠_(C\d+)\.jpg/g)].map(x => x[1])));
  assert.equal(덮음.size, 70);
  for (const 라벨 of ['컷 사이', '얼굴', '이야기']) assert.ok(훑기.some(b => b.opts.label.startsWith(라벨)), `${라벨} 관점이 없다`);
});

// 11-20 GPT 검수(영상감정앵글검사-20261120 GA8) — 컷 사이 관점이 판을 묶음으로 나눌 때 경계의 두 판이 서로 다른 검수자에게 갈라져,
//   그 자리의 이웃 컷(크기 · 높이 · 방향이 같은가)을 함께 보는 요청이 없었다. 뒤 묶음은 앞 묶음의 마지막 판부터 연다.
test('컷 사이 관점 — 묶음이 갈라지는 자리의 이웃 두 판은 한 검수자가 함께 연다(30장 한도는 그대로)', async () => {
  const 판 = 가짜판(12);
  판.판.장면 = Array.from({ length: 29 }, (_, i) => `C:/편/검수/마감_1/판/장면_${i + 1}.jpg`);
  const { 부름 } = await 돌리기({ 판 });
  const 사이 = 부름.filter(b => b.opts.phase === '훑기' && b.opts.label.startsWith('컷 사이'));
  assert.ok(사이.length >= 2, '29판인데 컷 사이 관점이 하나다');
  const 든판 = 사이.map(b => new Set([...b.prompt.matchAll(/장면_(\d+)\.jpg/g)].map(x => Number(x[1]))));
  for (let i = 1; i < 29; i++) assert.ok(든판.some(s => s.has(i) && s.has(i + 1)), `장면 판 ${i}과 ${i + 1}을 함께 여는 컷 사이 관점이 없다`);
  for (const b of 사이) assert.ok(그림수(b.prompt) <= 30, `${b.opts.label}가 그림 ${그림수(b.prompt)}장을 연다`);
  assert.equal(new Set(든판.flatMap(s => [...s])).size, 29, '모든 판이 든다');
});

test('준비 · 기록만 Sonnet이고, 검수자는 모델을 정하지 않아 세션 모델(Fable 5.2)을 물려받는다', async () => {
  const { 부름 } = await 돌리기({ 훑기답: l => (l.startsWith('컷 전수') ? [지적('C1', 'P1', '영상만')] : []), 반박답: () => ({ 답: '맞음' }) });
  for (const b of 부름) {
    if (b.opts.phase === '준비' || b.opts.phase === '기록') assert.equal(b.opts.model, 'sonnet', b.opts.label);
    else assert.equal(b.opts.model, undefined, `${b.opts.label}가 모델을 정했다 — 관문 검수자는 Fable 5.2 검수 세션의 모델을 그대로 물려받아야 한다`);
  }
  assert.ok(부름.some(b => b.opts.phase === '반박'));
});

test('P0 · P1만 반박하고, 「아님」은 두 번 들어야 기각된다 — 갈리면 확인', async () => {
  const 훑기답 = l => (l.startsWith('컷 전수 1')
    ? [지적('C1', 'P0', '시작 그림부터', '가'), 지적('C2', 'P1', '영상만', '나'), 지적('C3', 'P1', '편집', '다'), 지적('C4', 'P2', '편집', '라'), 지적('C5', 'P1', '영상만', '마')]
    : [])
  const 반박답 = (f, 차례) => {
    if (f.무엇 === '가') return { 답: '맞음' };
    if (f.무엇 === '나') return { 답: '아님' }; // 두 번 다 아님 → 기각
    if (f.무엇 === '다') return { 답: 차례 === 1 ? '아님' : '맞음' }; // 갈림 → 확인
    if (f.무엇 === '마') return { 답: '모름' }; // 모름 → 확인
    return {};
  };
  const { 부름, 결과 } = await 돌리기({ 훑기답, 반박답 });
  const 반박에간 = 부름.filter(b => b.opts.phase === '반박').flatMap(b => 지적들(b.prompt).map(f => f.무엇));
  assert.ok(!반박에간.includes('라'), 'P2를 반박에 보냈다');
  const 상태 = Object.fromEntries(결과.지적.map(f => [f.무엇, f.상태]));
  assert.deepEqual(상태, { 가: '유지', 나: '기각', 다: '확인', 라: '반박 안 함', 마: '확인' });
  assert.equal(결과.지적.find(f => f.무엇 === '나').반박.length, 2, '기각은 두 반박의 까닭을 남긴다');
});

test('컷별 판정은 유지 지적의 고칠곳 순위로 — 시작 그림부터 > 영상만 > 편집 > 확인 > 그대로', async () => {
  const 훑기답 = l => (l.startsWith('컷 전수')
    ? [지적('C1', 'P1', '영상만'), 지적('C1', 'P0', '시작 그림부터'), 지적('C2', 'P1', '편집'), 지적('C3', 'P1', '확인'), 지적('C4,C5', 'P1', '영상만')]
    : [])
  const { 반환, 결과 } = await 돌리기({ 훑기답, 반박답: () => ({ 답: '맞음' }) });
  const 판정 = Object.fromEntries(결과.컷별.map(c => [c.cut, c.판정]));
  assert.equal(판정.C1, '시작 그림부터');
  assert.equal(판정.C2, '편집');
  assert.equal(판정.C3, '확인');
  assert.equal(판정.C4, '영상만', '「C4,C5」 지적이 C4에 안 걸렸다');
  assert.equal(판정.C5, '영상만');
  assert.equal(판정.C6, '그대로');
  assert.ok(반환.컷별.every(c => c.판정 !== '그대로'), '반환에는 고칠 컷만 싣는다');
  assert.equal(반환.기록맞음, true);
});

test('Fable 5.2가 아닌 답이 섞이면 모델 확인이 거짓이고 알린다', async () => {
  const { 반환, 로그 } = await 돌리기({ 모델: 'claude-fable-5-1' });
  assert.equal(반환.모델확인.맞음, false);
  assert.ok(로그.some(l => /Fable 5\.2가 아닌 답/.test(l)));
  const 바름 = await 돌리기();
  assert.equal(바름.반환.모델확인.맞음, true);
  assert.equal(바름.반환.모델확인.대체, '');
});

test('Fable 한도 대체(11-14): 한도 근거를 준 판만 Opus 5.5 답을 받고, 실제로 Opus가 답했을 때만 「대체 검수」로 남긴다', async () => {
  // 근거 없이 Opus가 답하면 지금처럼 쓰지 않는다
  const 근거없음 = await 돌리기({ 모델: 'claude-opus-5-5' });
  assert.equal(근거없음.반환.모델확인.맞음, false);
  assert.equal(근거없음.반환.모델확인.대체, '');
  // 근거 + Opus 5.5 → 받고, 결과 · 로그에 대체 검수와 근거가 남는다
  const 대체 = await 돌리기({ 모델: 'claude-opus-5-5', 덧: { 한도대체: 'get_usage 주간 Fable 96% · 11-14 05:10' } });
  assert.equal(대체.반환.모델확인.맞음, true);
  assert.match(대체.반환.모델확인.대체, /^Opus 5\.5 대체 검수 — 한도 근거: get_usage 주간 Fable 96%/);
  assert.equal(대체.결과.모델확인.대체, 대체.반환.모델확인.대체, '기록에 넘긴 결과에도 같은 글이 있어야 보고.md에 적힌다');
  assert.ok(대체.로그.some(l => /Opus 5\.5 대체 검수\(Fable 한도\)/.test(l)));
  // 근거를 줬어도 Fable이 다 답했으면 대체 검수가 아니다
  const 페이블 = await 돌리기({ 덧: { 한도대체: '옛 근거' } });
  assert.equal(페이블.반환.모델확인.맞음, true);
  assert.equal(페이블.반환.모델확인.대체, '');
  assert.ok(!페이블.로그.some(l => /대체 검수/.test(l)));
  // 근거를 줘도 그 밖의 모델(5.1 · Sonnet)은 받지 않고, 쓰지 않을 판에 대체 글을 남기지 않는다
  for (const 모델 of ['claude-fable-5-1', 'claude-sonnet-5-5']) {
    const 딴 = await 돌리기({ 모델, 덧: { 한도대체: '근거' } });
    assert.equal(딴.반환.모델확인.맞음, false, 모델);
    assert.equal(딴.반환.모델확인.대체, '', 모델);
  }
  // 빈 글 · 글이 아닌 값은 시작에서 멈춘다
  for (const 값 of ['  ', true, 3]) await assert.rejects(돌리기({ 덧: { 한도대체: 값 } }), /한도 근거/, String(값));
});

test('결과 없는 관점 · 그림 없는 컷 · 판 도구가 못 만든 것은 빠짐에 남는다(조용히 덮지 않는다)', async () => {
  const 판 = 가짜판(10);
  판.컷[9].그림 = [];
  판.못함 = ['C9: 시작 그림 없음'];
  const { 반환 } = await 돌리기({ 판, 빈관점: '얼굴' });
  assert.ok(반환.빠짐.includes('관점 결과 없음: 얼굴'));
  assert.ok(반환.빠짐.some(x => x.includes('C10')));
  assert.ok(반환.빠짐.some(x => x.includes('C9: 시작 그림 없음')));
});

test('빠진 것 찾기가 더 찾은 P0 · P1도 반박을 거친다', async () => {
  const { 부름, 결과 } = await 돌리기({ 비평답: () => [지적('C7', 'P1', '영상만', '새로 찾음')], 반박답: () => ({ 답: '맞음' }) });
  assert.ok(부름.filter(b => b.opts.phase === '반박').some(b => 지적들(b.prompt).some(f => f.무엇 === '새로 찾음')));
  assert.equal(결과.지적.find(f => f.무엇 === '새로 찾음').상태, '유지');
});

test('다시 검수는 고친 컷 · 앞결과가 있어야 하고, 고친 자리만 본다(이야기 · 빠진 것 없음)', async () => {
  await assert.rejects(() => 돌리기({ 덧: { 다시: true } }), /args\.컷/);
  const 훑기답 = l => (l.startsWith('고친 컷')
    ? [{ ...지적('C2', 'P1', '영상만', '아직'), 지난: 'F3', 상태: '그대로' }, { ...지적('C3', 'P1', '편집', '됨'), 지난: 'F4', 상태: '고쳐짐' }, { ...지적('C3', 'P1', '편집', '새것'), 상태: '새 문제' }]
    : []);
  const { 부름, 결과 } = await 돌리기({ 판: 가짜판(4), 덧: { 다시: true, 컷: ['C2', 'C3'], 앞결과: 'C:/편/검수/마감_0/결과.json' }, 훑기답, 반박답: () => ({ 답: '맞음' }) });
  const 라벨 = 부름.map(b => b.opts.label);
  assert.ok(라벨.some(l => l.startsWith('고친 컷')));
  assert.ok(!라벨.some(l => l.startsWith('이야기') || l === '빠진 것'));
  assert.deepEqual(결과.다시결과.map(f => f.상태).sort(), ['고쳐짐', '그대로']);
  assert.deepEqual(결과.지적.map(f => f.무엇), ['새것'], '「새 문제」만 새 지적이 된다');
  const 판정 = Object.fromEntries(결과.컷별.map(c => [c.cut, c.판정]));
  assert.equal(판정.C2, '영상만', '「그대로」인 지난 P1 지적은 판정에 남는다');
  assert.equal(판정.C3, '편집');
});

// 11-20 경산 「밥 뭇나」 A3 — 「밥 먹었냐」를 빈손 시늉에 맡긴 컷을 굽기 전 관문 세 번이 보고도 뜻이 읽히는지 묻지 않았다(유호님 「넣어」).
test('뜻을 전하는 박자 — 컷 전수 · 고친 컷 · 이야기 관점이 시늉에만 기댄 박자를 묻고, 굽기 전에는 이미 받은 영상도 보게 한다', async () => {
  const 글 = (부름, 머리) => 부름.filter(b => b.opts.phase === '훑기' && b.opts.label.startsWith(머리)).map(b => b.prompt).join('\n');
  const 굽기전 = await 돌리기({ 판: 가짜판(4), 덧: { 관문: '굽기전' } });
  const 컷글 = 글(굽기전.부름, '컷 전수');
  assert.match(컷글, /뜻을 전하는 박자/);
  assert.match(컷글, /손짓이나 시늉 하나로만/);
  assert.match(컷글, /C:\/편\) 받음\//, '이미 받은 영상을 찾을 편 폴더를 알려 준다');
  assert.match(글(굽기전.부름, '이야기'), /⑨ 이야기의 열쇠 박자/);
  const 다시 = await 돌리기({ 판: 가짜판(4), 덧: { 관문: '굽기전', 다시: true, 컷: ['C2'], 앞결과: 'C:/편/검수/굽기전_0/결과.json' } });
  assert.match(글(다시.부름, '고친 컷'), /③ 목록의 모든 컷\(고친 컷과 이웃 컷\)에서 뜻을 전하는 박자/);
  const 마감 = await 돌리기({ 판: 가짜판(4) });
  const 마감글 = 글(마감.부름, '컷 전수');
  assert.match(마감글, /⑧ 뜻을 전하는 박자/);
  assert.match(마감글, /띠에서 그 뜻으로 읽히나/);
});

// ── 다시 검수의 컷별 표(2026-11-17 전북 공모전 다시 검수) ──
// 보고서가 제작 세션을 잘못 이끌 뻔한 둘: ① 새 지적이 F1부터 다시 번호를 받아 지난 관문의 번호와 겹쳤고, 표가 둘을 한 목록에 섞어
// 보고서가 C27 줄(지난 F23)에 이번 F23(C24)의 고칠법을 붙였다. ② 지난 P2 · P3이 「그대로」라는 것만으로 컷이 「그림 다시」가 되어
// 진짜 P1은 세 컷인데 요약이 「그림 다시 10 · 그림 지시문 1」로 나왔다.
function 컷별표짓기() {
  // 워크플로에서 컷별 표를 만드는 구획만 떼어 돌린다 — 검수자를 띄우지 않고 사례 데이터로 표만 다시 셈한다
  const m = 소스.match(/\/\/ ── 컷별 표 셈 ──\r?\n([\s\S]*?)\/\/ ── 컷별 표 셈 끝 ──/);
  assert.ok(m, '워크플로에서 「컷별 표 셈」 구획을 못 찾음');
  return new Function(`${m[1]}\nreturn { 컷별표짓기, 지난이름 };`)();
}

test('다시 검수 사례(11-17 전북 공모전): 꼭 고칠 컷은 C11 · C21 · C23 셋이고, 지난 번호와 이번 번호가 섞이지 않는다', () => {
  const 사례 = JSON.parse(읽기('tests/fixtures/영상관문_다시사례_20261117.json'));
  // 고치기 전 표는 이 데이터로 「그림 다시 10 · 그림 지시문 1」을 냈다 — 자료가 그 사례가 맞는지부터 본다
  assert.deepEqual(사례.고치기전.판정, { '그림 다시': 10, 그대로: 12, '그림 지시문': 1 });
  const { 컷별, 셈판정, 지난셈 } = 컷별표짓기().컷별표짓기({ 컷목록: 사례.컷, 지적: 사례.지적, 다시결과: 사례.다시결과, 고칠곳: 사례.고칠곳, 다시: true });
  const 줄 = Object.fromEntries(컷별.map(c => [c.cut, c]));

  // ② 등급 — 컷 판정에는 이번에 유지한 P1과 지난 P0 · P1 「그대로」만 든다
  assert.deepEqual(컷별.filter(c => c.판정 !== '그대로').map(c => c.cut), ['C11', 'C21', 'C23']);
  assert.deepEqual(셈판정, { '그림 다시': 3, 그대로: 20 });
  assert.deepEqual(줄.C11.유지, ['F11']);
  assert.deepEqual(줄.C21.유지, ['F12']);
  assert.deepEqual(줄.C23.유지, ['F13', '지난 F65'], 'C23에는 이번 F13과 지난 관문의 F65(P1 그대로)가 함께 걸린다');
  // 지난 P2 · P3 「그대로」는 「가벼움」으로 — 고치기 전에는 이 컷들이 「그림 다시」 · 「그림 지시문」이었다
  for (const [cut, 번호] of [['C1', '지난 F68'], ['C7', '지난 F39'], ['C8', '지난 F39'], ['C19', '지난 F56'], ['C25', '지난 F70'], ['C26', '지난 F70'], ['C27', '지난 F23'], ['C27', '지난 F57'], ['C28', '지난 F66'], ['C28', '지난 F30']]) {
    assert.equal(줄[cut].판정, '그대로', `${cut}은 지난 P2 · P3만 남았다`);
    assert.ok(줄[cut].가벼움.includes(번호), `${cut}의 「가벼움」에 ${번호}가 없다`);
    assert.ok(!줄[cut].유지.includes(번호));
  }

  // ① 번호 — 지난 관문의 F23(C27)과 이번 F23(C24)은 다른 지적이다
  assert.ok(줄.C24.가벼움.includes('F23') && !줄.C24.가벼움.includes('지난 F23'));
  assert.ok(줄.C27.가벼움.includes('지난 F23') && !줄.C27.가벼움.includes('F23'));
  assert.deepEqual(줄.C27.할일, [], 'C27에는 할 일이 없다 — 이번 F23(C24)의 고칠법이 붙으면 안 된다');
  // 지난 지적의 고칠곳 · 고칠법은 다시 본 검수자가 「다시결과」에 적은 것을 그대로 싣는다
  assert.deepEqual(줄.C23.할일, [
    { 번호: 'F13', 등급: 'P1', 고칠곳: '그림 다시', 고칠법: '이번 F13(C23)의 고칠법' },
    { 번호: '지난 F65', 등급: 'P1', 고칠곳: '그림 다시', 고칠법: '지난 F65(C23)의 고칠법' },
  ]);
  // 모든 줄에서: 「지난 」이 붙지 않은 번호는 이번 지적 목록에, 붙은 번호는 다시결과에 있고, 그 컷에 걸린 것이다
  const 이번 = Object.fromEntries(사례.지적.map(f => [f.id, f]));
  const 지난 = new Set(사례.다시결과.filter(f => f.상태 === '그대로').map(f => `지난 ${f.지난}`));
  for (const c of 컷별) {
    for (const 번호 of [...c.유지, ...c.확인, ...c.가벼움]) {
      if (번호.startsWith('지난 ')) assert.ok(지난.has(번호), `${c.cut}: ${번호}가 다시결과의 「그대로」에 없다`);
      else assert.ok(이번[번호] && 이번[번호].컷.split(',').includes(c.cut), `${c.cut}: ${번호}가 이번 지적 목록의 그 컷 지적이 아니다`);
    }
    assert.deepEqual(c.할일.map(x => x.번호), c.유지, `${c.cut}: 「할일」과 「유지」의 번호가 다르다`);
    assert.equal(c.판정 === '그대로', c.유지.length === 0 && c.확인.length === 0, `${c.cut}: 판정과 할 일이 어긋난다`);
  }

  // 요약의 수가 표와 맞는다 — 이번 유지 3 + 지난 P1 그대로 1이 세 컷에 걸렸다
  // 다시결과는 34줄이지만 지난 F22 · F38을 두 관점이 함께 봐서 번호로는 32개다
  assert.deepEqual(지난셈, { 본것: 32, 고쳐짐: 23, '그대로 P0 · P1': 1, '그대로 P2 · P3': 8 });
  const 표번호 = new Set(컷별.flatMap(c => c.유지));
  assert.equal(표번호.size, 사례.지적.filter(f => f.상태 === '유지').length + 지난셈['그대로 P0 · P1']);
});

test('다시 검수: 지난 지적은 P0 · P1 「그대로」만 컷 판정에 들고, 번호가 겹쳐도 「지난」으로 갈리며, 고칠법은 다시결과의 것이다', async () => {
  const 다시본 = (컷, 등급, 고칠곳, 지난, 상태, 고칠법) => ({ ...지적(컷, 등급, 고칠곳, `${지난} ${상태}`), 지난, 상태, 고칠법 });
  const 훑기답 = l => {
    if (l.startsWith('고친 컷')) return [
      { ...지적('C1', 'P1', '편집', '새것'), 고칠법: '이번 F1 고칠법', 상태: '새 문제' }, // 이번 번호 F1 — 지난 F1(C2)과 겹친다
      다시본('C2', 'P1', '영상만', 'F1', '그대로', '지난 F1 고칠법'),
      다시본('C3', 'P2', '시작 그림부터', 'F7', '그대로', '지난 F7 고칠법'), // P2 — 컷 판정을 바꾸지 않는다
      다시본('C3', 'P3', '영상만', 'F8', '그대로', '지난 F8 고칠법'),
      다시본('C4', 'P0', '확인', 'F9', '그대로', '지난 F9 고칠법'), // 고칠곳 「확인」 — 판정도 확인
      다시본('C5', 'P1', '영상만', 'F2', '고쳐짐', ''),
      다시본('C6', 'P1', '영상만', 'F5', '고쳐짐', ''), // 얼굴 관점은 그대로라 한다 — 한 관점이라도 그대로면 남는다
    ];
    // 얼굴 관점은 지난 F5의 등급을 P2로 낮춰 적었다(11-17 유스업 편에서 실제로 있었다) — 다른 관점이 P1로 적었으니 무겁게 센다
    if (l.startsWith('얼굴')) return [다시본('C6', 'P2', '영상만', 'F5', '그대로', '지난 F5 고칠법'), 다시본('C2', 'P1', '영상만', 'F1', '그대로', '지난 F1 고칠법')];
    return [];
  };
  const { 반환, 부름, 결과 } = await 돌리기({ 판: 가짜판(6), 덧: { 다시: true, 컷: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'], 앞결과: 'C:/편/검수/마감_0/결과.json' }, 훑기답, 반박답: () => ({ 답: '맞음' }) });
  const 줄 = Object.fromEntries(결과.컷별.map(c => [c.cut, c]));
  assert.deepEqual(결과.지적.map(f => f.id), ['F1']);
  assert.deepEqual(줄.C1, { cut: 'C1', 판정: '편집', 유지: ['F1'], 확인: [], 가벼움: [], 할일: [{ 번호: 'F1', 등급: 'P1', 고칠곳: '편집', 고칠법: '이번 F1 고칠법' }] });
  assert.deepEqual(줄.C2, { cut: 'C2', 판정: '영상만', 유지: ['지난 F1'], 확인: [], 가벼움: [], 할일: [{ 번호: '지난 F1', 등급: 'P1', 고칠곳: '영상만', 고칠법: '지난 F1 고칠법' }] }, '두 관점이 같은 지난 지적을 그대로라 해도 한 번만 적는다');
  assert.deepEqual(줄.C3, { cut: 'C3', 판정: '그대로', 유지: [], 확인: [], 가벼움: ['지난 F7', '지난 F8'], 할일: [] }, '지난 P2 · P3 「그대로」는 「가벼움」으로 가고 컷 판정을 바꾸지 않는다');
  assert.equal(줄.C4.판정, '확인');
  assert.deepEqual(줄.C4.유지, ['지난 F9']);
  // 등급을 못 읽은 지난 지적은 빠뜨리지 않고 컷 판정에 넣고, 다음 다시 검수가 넘겨받게 「들어감」으로 적는다
  const 등급없음 = 컷별표짓기().컷별표짓기({ 컷목록: ['C1'], 지적: [], 다시결과: [{ 지난: 'F4', 컷: 'C1', 등급: '', 상태: '그대로', 고칠곳: '영상만' }], 고칠곳: ['시작 그림부터', '영상만', '편집', '확인'], 다시: true });
  assert.equal(등급없음.컷별[0].판정, '영상만');
  assert.deepEqual(등급없음.무거운지난, { '지난 F4': 'P1' });
  assert.equal(줄.C5.판정, '그대로');
  assert.equal(줄.C6.판정, '영상만', '한 관점이라도 「그대로」라 하면 남은 것으로 센다');
  assert.deepEqual(줄.C6.할일, [{ 번호: '지난 F5', 등급: 'P1', 고칠곳: '영상만', 고칠법: '지난 F5 고칠법' }], '관점마다 옮겨 적은 등급이 다르면 가장 무거운 등급으로 센다 — 낮춰 적은 관점 때문에 P1이 「가벼움」으로 빠지면 안 된다');
  assert.deepEqual(결과.요약.지난, { 본것: 6, 고쳐짐: 1, '그대로 P0 · P1': 3, '그대로 P2 · P3': 2 });
  assert.deepEqual(결과.요약.판정, { 편집: 1, 영상만: 2, 그대로: 2, 확인: 1 });
  assert.ok(결과.다시결과.every(f => f.번호 === `지난 ${f.지난}`), '다시결과마다 표에 적는 이름(「지난 F1」)이 있다');
  // 보고서의 「지난 지적 가운데 남은 것」 절은 등급을 다시 따지지 않고 이 칸으로 고른다 — 낮춰 적힌 지난 F5(P2 그대로)도 「들어감」이다
  assert.deepEqual(결과.다시결과.map(f => [f.번호, f.상태, f.컷판정에]), [
    ['지난 F1', '그대로', '들어감'], ['지난 F7', '그대로', '안 들어감'], ['지난 F8', '그대로', '안 들어감'], ['지난 F9', '그대로', '들어감'],
    ['지난 F2', '고쳐짐', undefined], ['지난 F5', '고쳐짐', undefined], ['지난 F5', '그대로', '들어감'], ['지난 F1', '그대로', '들어감'],
  ]);
  // 낮춰 적힌 줄은 기록에도 센 등급으로 남긴다 — P2로 남기면 다음 다시 검수자가 그 P2를 옮겨 적어 아직 「그대로」인 지적이 가벼움으로 빠진다(GPT 검수)
  const 낮춰적힌 = 결과.다시결과.find(f => f.번호 === '지난 F5' && f.상태 === '그대로');
  assert.deepEqual([낮춰적힌.등급, 낮춰적힌.옮겨적은등급], ['P1', 'P2']);
  assert.ok(결과.다시결과.filter(f => f !== 낮춰적힌).every(f => !('옮겨적은등급' in f)), '등급을 바꿔 적은 줄은 그 한 줄뿐이다');
  // 다음 다시 검수: 검수자가 그 줄의 등급을 그대로 옮겨 적고 이번에는 한 관점만 봤다 — 여전히 컷 판정에 든다
  const 다음 = 컷별표짓기().컷별표짓기({ 컷목록: ['C6'], 지적: [], 다시결과: [{ 지난: 낮춰적힌.번호, 컷: 'C6', 등급: 낮춰적힌.등급, 상태: '그대로', 고칠곳: '영상만' }], 고칠곳: ['시작 그림부터', '영상만', '편집', '확인'], 다시: true });
  assert.deepEqual([다음.컷별[0].판정, 다음.컷별[0].유지], ['영상만', ['지난 지난 F5']]);
  assert.deepEqual(반환.컷별.map(c => c.cut), ['C1', 'C2', 'C4', 'C6']);
  // 보고서를 쓰는 에이전트는 「할일」을 그대로 옮기고, 번호로 지적을 다시 찾지 않는다
  const 기록 = 부름.find(b => b.opts.phase === '기록').prompt;
  for (const 낱말 of ['「할일」 목록을 차례대로 그대로 옮긴다', '번호가 같아도 서로 다른 지적이다', '## 지난 지적 가운데 남은 것 (P0 · P1)', '「컷판정에」 칸이 「들어감」인 줄마다', '「지난 F12」 꼴 그대로']) assert.ok(기록.includes(낱말), `다시 검수 기록 지시문에 「${낱말}」이 없다`);
  const 다시관점 = 부름.find(b => b.opts.label.startsWith('고친 컷')).prompt;
  assert.match(다시관점, /등급을 올리거나 내리지 않는다/, '다시 검수자는 지난 등급을 그대로 옮겨야 한다 — 컷 판정이 그 등급으로 갈린다');
});

test('다시 검수를 거듭해도 번호가 갈린다 — 지난 결과의 「다시결과」에서 넘어온 지적은 「지난 지난 F1」이고, 검수자가 그것도 다시 보게 시킨다', async () => {
  // 셋째 관문: 지난 결과(둘째 관문)의 새 지적 F1과, 그 결과의 다시결과에 「그대로」로 남아 있던 첫 관문의 F1(번호 「지난 F1」)이 같은 컷에 함께 남았다
  const 훑기답 = l => (l.startsWith('고친 컷') ? [
    { ...지적('C2', 'P1', '편집', '둘째 관문의 F1'), 지난: 'F1', 상태: '그대로', 고칠법: '둘째 관문 F1 고칠법' },
    { ...지적('C2', 'P1', '영상만', '첫 관문의 F1'), 지난: '지난 F1', 상태: '그대로', 고칠법: '첫 관문 F1 고칠법' },
    { ...지적('C2', 'P1', '편집', '이번 것'), 상태: '새 문제', 고칠법: '이번 F1 고칠법' },
  ] : []);
  const { 부름, 결과 } = await 돌리기({ 판: 가짜판(3), 덧: { 다시: true, 컷: ['C2'], 앞결과: 'C:/편/검수/마감_1/결과.json' }, 훑기답, 반박답: () => ({ 답: '맞음' }) });
  const C2 = 결과.컷별.find(c => c.cut === 'C2');
  assert.deepEqual(C2.유지, ['F1', '지난 F1', '지난 지난 F1']);
  assert.deepEqual(C2.할일.map(x => [x.번호, x.고칠법]), [['F1', '이번 F1 고칠법'], ['지난 F1', '둘째 관문 F1 고칠법'], ['지난 지난 F1', '첫 관문 F1 고칠법']]);
  assert.equal(C2.판정, '영상만');
  assert.deepEqual(결과.요약.지난, { 본것: 2, 고쳐짐: 0, '그대로 P0 · P1': 2, '그대로 P2 · P3': 0 });
  const 다시관점 = 부름.find(b => b.opts.label.startsWith('고친 컷')).prompt;
  // 다음 다시 검수가 넘겨받을 줄은 이번 표가 컷 판정에 넣은 줄과 같아야 한다(등급을 못 읽어 무겁게 센 줄 · 다른 관점 때문에 무겁게 센 줄까지) — 등급 글로 다시 고르면 그 줄이 빠진다(GPT 검수 GA1)
  for (const 낱말 of ['그 「다시결과」에서', '「컷판정에」 칸이 「들어감」인 것도 함께 읽는다', '등급이 P2 · P3이 아닌 줄을 읽는다', '그 줄의 「번호」를 그대로 적는다']) assert.ok(다시관점.includes(낱말), `다시 검수자 지시문에 「${낱말}」이 없다`);
  assert.ok(결과.다시결과.every(f => f.컷판정에 === '들어감'), '컷 판정에 넣은 지난 지적에는 다음 다시 검수가 넘겨받을 표시가 있다');
  assert.ok(부름.find(b => b.opts.phase === '기록').prompt.includes('「지난 지난 F12」는 그보다 한 번 더 앞 관문의 지적이다'));
});

test('첫 관문(다시 아님)의 결과 꼴은 그대로다 — 컷 줄에 「할일」이 없고 요약에 「지난」이 없다', async () => {
  const 훑기답 = l => (l.startsWith('컷 전수') ? [지적('C1', 'P1', '영상만'), 지적('C1', 'P2', '편집'), 지적('C2', 'P1', '확인')] : []);
  const { 부름, 결과 } = await 돌리기({ 훑기답, 반박답: () => ({ 답: '맞음' }) });
  assert.deepEqual(결과.컷별[0], { cut: 'C1', 판정: '영상만', 유지: ['F1'], 확인: [], 가벼움: ['F2'] });
  for (const c of 결과.컷별) assert.deepEqual(Object.keys(c), ['cut', '판정', '유지', '확인', '가벼움']);
  assert.deepEqual(Object.keys(결과.요약), ['컷', '관점', '지적', '상태', '판정']);
  assert.deepEqual(결과.다시결과, []);
  const 기록 = 부름.find(b => b.opts.phase === '기록').prompt;
  assert.ok(기록.includes('| 컷 | 판정 | 할 일(유지 지적 id · 고칠곳 · 고칠법) | 확인 | P2 · P3 |'));
  assert.ok(!기록.slice(0, 기록.lastIndexOf('JSON:\n')).includes('지난'), '첫 관문 기록 지시문에 다시 검수 글이 섞였다');
});

test('답 틀 칸 이름은 영문만 보낸다 — 한글 칸이면 API가 400으로 거절했다(11-15 서울로 마감 관문)', async () => {
  const { 부름 } = await 돌리기({ 훑기답: l => (l.startsWith('컷 전수') ? [지적('C1', 'P1', '영상만')] : []), 반박답: () => ({ 답: '맞음' }) });
  const 칸들 = (틀, 모음 = []) => {
    if (Array.isArray(틀)) { 틀.forEach(x => 칸들(x, 모음)); return 모음; }
    if (!틀 || typeof 틀 !== 'object') return 모음;
    for (const [k, v] of Object.entries(틀)) { if (k === 'properties') { 모음.push(...Object.keys(v)); Object.values(v).forEach(x => 칸들(x, 모음)); } else 칸들(v, 모음); }
    return 모음;
  };
  const 틀있는 = 부름.filter(b => b.opts.schema);
  assert.ok(틀있는.length >= 5, '준비 · 훑기 · 반박 · 빠진 것 · 기록이 모두 틀을 보낸다');
  for (const b of 틀있는) {
    for (const k of 칸들(b.opts.schema)) assert.match(k, /^[a-zA-Z0-9_.-]{1,64}$/, `${b.opts.label} 틀에 API가 거절하는 칸 이름 「${k}」`);
    for (const r of b.opts.schema.required || []) assert.ok(r in b.opts.schema.properties, `${b.opts.label} required 「${r}」가 칸에 없다`);
    assert.match(b.prompt, /^답 틀\(StructuredOutput\)의 칸 이름은 영문/, `${b.opts.label} 지시문 앞에 칸 안내가 없다`);
  }
});

test('영문 칸으로 받은 답도 한글 칸으로 되돌려 같은 판정을 낸다', async () => {
  const 훑기답 = l => (l.startsWith('컷 전수') ? [지적('C1', 'P1', '영상만'), 지적('C2', 'P0', '시작 그림부터'), 지적('C3', 'P2', '편집')] : []);
  const 한글 = await 돌리기({ 훑기답, 반박답: () => ({ 답: '맞음' }) });
  const 영문 = await 돌리기({ 훑기답, 반박답: () => ({ 답: '맞음' }), 영문답: true });
  assert.ok(영문.부름.filter(b => b.opts.phase === '반박').length > 0, '영문 답에서도 반박이 돌았다');
  assert.deepEqual(영문.결과.컷별, 한글.결과.컷별);
  assert.deepEqual(영문.결과.지적.map(f => [f.컷, f.등급, f.상태]), 한글.결과.지적.map(f => [f.컷, f.등급, f.상태]));
  assert.equal(영문.반환.모델확인.맞음, true, '영문 칸의 모델 답도 읽었다');
  const 훑기틀 = 영문.부름.find(b => b.opts.phase === '훑기').opts.schema;
  assert.deepEqual(영문으로({ 모델: 'm', 본컷: [], 지적: [{ 컷: 'C1', 등급: 'P1' }] }, 훑기틀), { k_model: 'm', k_seen_cuts: [], k_findings: [{ k_cut: 'C1', k_grade: 'P1' }] }, '모의 답이 정말 영문 칸으로 갔다');
});

test('판목록을 못 받으면 검수자를 띄우지 않고 멈춘다', async () => {
  const 판 = { ...가짜판(3), 끝코드: -1, 컷: [], 못함: ['판목록.json 없음'] };
  await assert.rejects(() => 돌리기({ 판 }), /tools\/영상관문판\.py를 먼저 돌린다/);
});

test('스킬 두 장 · 판 도구 · synk-video 한 장 · 운영 원칙 · .gitignore가 서로를 가리킨다', () => {
  assert.ok(fs.existsSync(path.join(뿌리, 'tools', '영상관문판.py')));
  for (const [이름, 관문] of [['굽기전검수', '굽기전'], ['마감작업', '마감']]) {
    const 글 = 읽기(`.claude/skills/${이름}/SKILL.md`);
    assert.match(글.split('---')[1] || '', new RegExp(`name: ${이름}`));
    // 11-14: Fable 한도면 「초기화해 주세요」를 여쭙지 않고 Opus 5.5로 같은 관문을 돈다(운영 원칙 「한도」) — 옛 문구가 되살아나면 막는다
    assert.ok(!글.includes('Fable 몫 초기화해 주세요'), `${이름} 스킬에 옛 「Fable 몫 초기화해 주세요」가 남았다`);
    for (const 낱말 of ['claude-fable-5-2', '.claude/workflows/video-gate.js', 'tools/영상관문판.py', `관문: '${관문}'`, 'claude-opus-5-5', '한도대체', '10% 아래', '보고.md']) {
      assert.ok(글.includes(낱말), `${이름} 스킬에 「${낱말}」이 없다`);
    }
  }
  const 한장 = 읽기('.claude/skills/synk-video/SKILL.md');
  for (const 낱말 of ['/굽기전검수', '/마감작업']) assert.ok(한장.includes(낱말), `synk-video 한 장에 ${낱말}이 없다`);
  const 원칙 = 읽기('docs/AI_운영원칙.md');
  for (const 낱말 of ['/굽기전검수', '/마감작업']) assert.ok(원칙.includes(낱말), `운영 원칙에 ${낱말}이 없다`);
  assert.match(읽기('.gitignore'), /검수\/\*\/판\//, '판 그림(다시 만들 수 있는 것)을 무시하는 줄이 없다');
});

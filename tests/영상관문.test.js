'use strict';
// 영상 관문(/굽기전검수 · /마감작업, 2026-11-12 유호님 「둘 다 세팅」) — 관문 워크플로 .claude/workflows/video-gate.js를
//   가짜 agent로 모의 실행해 본다: 검수자 하나가 여는 그림 30장 한도 · P0 · P1만 반박 · 「아님」을 두 번 들어야 기각 · 컷별 판정 순위 ·
//   Fable 5.2가 아닌 답이면 결과를 안 씀 · 결과 없는 관점은 빠짐에 남음 · 다시 검수는 고친 자리만.
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

async function 돌리기({ 판 = 가짜판(12), 훑기답 = () => [], 반박답 = () => ({}), 비평답 = () => [], 덧 = {}, 모델 = 'claude-fable-5-2', 빈관점 = null } = {}) {
  const 부름 = [];
  const 로그 = [];
  const agent = async (prompt, opts = {}) => {
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

test('준비 · 기록만 Sonnet이고, 검수자는 모델을 정하지 않아 세션 모델(Fable 5.2)을 물려받는다', async () => {
  const { 부름 } = await 돌리기({ 훑기답: l => (l.startsWith('컷 전수') ? [지적('C1', 'P1', '영상만')] : []), 반박답: () => ({ 답: '맞음' }) });
  for (const b of 부름) {
    if (b.opts.phase === '준비' || b.opts.phase === '기록') assert.equal(b.opts.model, 'sonnet', b.opts.label);
    else assert.equal(b.opts.model, undefined, `${b.opts.label}가 모델을 정했다 — Agent의 「fable」은 5.1로 간다`);
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
  assert.equal(판정.C2, '영상만', '「그대로」인 지난 지적은 판정에 남는다');
  assert.equal(판정.C3, '편집');
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
    for (const 낱말 of ['claude-fable-5-2', '.claude/workflows/video-gate.js', 'tools/영상관문판.py', `관문: '${관문}'`, 'Fable 몫 초기화해 주세요', '보고.md']) {
      assert.ok(글.includes(낱말), `${이름} 스킬에 「${낱말}」이 없다`);
    }
  }
  const 한장 = 읽기('.claude/skills/synk-video/SKILL.md');
  for (const 낱말 of ['/굽기전검수', '/마감작업']) assert.ok(한장.includes(낱말), `synk-video 한 장에 ${낱말}이 없다`);
  const 원칙 = 읽기('docs/AI_운영원칙.md');
  for (const 낱말 of ['/굽기전검수', '/마감작업']) assert.ok(원칙.includes(낱말), `운영 원칙에 ${낱말}이 없다`);
  assert.match(읽기('.gitignore'), /검수\/\*\/판\//, '판 그림(다시 만들 수 있는 것)을 무시하는 줄이 없다');
});

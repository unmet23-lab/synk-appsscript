'use strict';
// 영상 작업 입구(synk-video 스킬 한 장 · 지시문 틀 · 컷표 틀)가 짧고, 이어져 있고, 점검표를 다 덮는지 본다(2026-11-10).
// 왜: 영상 규칙은 줄을 더할수록 덜 읽혔다 — 슬롭 점검표는 엿새에 13줄 → 56줄이 됐고 한 번에 읽히는 것은 앞 절반뿐이었다
//   (docs/마케팅/제작양식/영상작업_진단_20261110.md). 입구가 다시 불어나거나, 점검표에 줄만 더하고 원칙에 잇지 않으면 같은 일이 되풀이된다.
//   크기 한도에 걸리면 한도를 올리지 말고 원칙 문장을 합치거나 세부를 담당 원문으로 내린다.
//   「원칙 괄호에 없는 점검표 번호」에 걸리면 그 줄이 열두 원칙 가운데 어느 것의 변형인지 정해 괄호에 넣는다(화면 전용 줄은 자리를 「화면 · …」으로 적으면 빠진다).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = rel => fs.readFileSync(path.join(뿌리, rel), 'utf8');
const 스킬 = '.claude/skills/synk-video/SKILL.md';
const 틀 = 'docs/마케팅/제작양식/영상양식/지시문_틀.md';
const 컷표 = 'docs/마케팅/제작양식/영상양식/컷표_틀.json';
const 진단 = 'docs/마케팅/제작양식/영상작업_진단_20261110.md';
const 점검표 = 'docs/마케팅/제작양식/광고영상_슬롭점검표.md';
const 굽기폴더 = 'docs/마케팅/PULSE_포트폴리오_제작준비_20261012/시댄스무제한';

test('한 장은 한 번에 읽히는 크기다 — 스킬 6,000자 · 지시문 틀 6,000자', () => {
  assert.ok(읽기(스킬).length <= 6000, `synk-video 스킬이 ${읽기(스킬).length}자다 — 줄을 더하지 말고 원칙 문장을 고치거나 합친다`);
  assert.ok(읽기(틀).length <= 6000, `지시문 틀이 ${읽기(틀).length}자다 — 까닭 · 실측은 슬롭 점검표 줄로 내린다`);
});

test('스킬 머리말이 영상 작업 · 지적 · 압축 뒤에 부르게 적혀 있다', () => {
  const 머리 = 읽기(스킬).split('---')[1] || '';
  assert.match(머리, /name: synk-video/);
  for (const 낱말 of ['콘티', '지시문', '검수', '지적', '압축']) assert.ok(머리.includes(낱말), `description에 「${낱말}」이 없다`);
});

// 깃허브 꼴 앵커 — 제목을 소문자로, 글자 · 숫자 · 빈칸 · 붙임표만 남기고 빈칸을 붙임표로
const 앵커꼴 = 제목 => 제목.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
// 기록 전용 경로(현장 노트 · 트랙 · 결정 · 보관 · _ops jsonl)는 여기서 열지 않는다 — 그 경로만 바꾼 push에서는 이 시험이 돌지 않아서,
//   열면 CI 「읽기 대조」(tools/ci읽기대조.cjs ②)가 멈춘다. 목록은 .github/workflows/syntax-check.yml의 paths-ignore와 같다
const 기록전용 = 길 => /^docs\/(?:현장노트\/|_ops\/(?:트랙\.md$|결정\.md$|보관\/|[^/]+\.jsonl$))/.test(길);
function 링크검사(rel) {
  const 글 = 읽기(rel);
  const 폴더 = path.dirname(path.join(뿌리, rel));
  const 링크 = [...글.matchAll(/\]\(([^)#\s]+)(#[^)\s]*)?\)/g)].filter(m => !/^https?:/.test(m[1]));
  for (const [, 경로, 앵커] of 링크) {
    const 대상 = path.join(폴더, decodeURIComponent(경로));
    if (기록전용(path.relative(뿌리, 대상).split(path.sep).join('/'))) continue;
    assert.ok(fs.existsSync(대상), `${rel}: 없는 파일을 가리킨다 — ${경로}`);
    if (앵커 && /\.md$/.test(경로)) {
      const 이름 = decodeURIComponent(앵커.slice(1));
      const 본문 = fs.readFileSync(대상, 'utf8');
      const 있음 = 본문.includes(`id="${이름}"`) || 본문.split(/\r?\n/).some(l => /^#{1,6}\s/.test(l) && 앵커꼴(l.replace(/^#{1,6}\s+/, '')) === 이름.toLowerCase());
      assert.ok(있음, `${rel}: ${경로}에 「#${이름}」 자리가 없다`);
    }
  }
  return 링크.length;
}

test('한 장 · 지시문 틀 · 진단의 링크가 실제 파일과 자리를 가리킨다', () => {
  assert.ok(링크검사(스킬) >= 8, '한 장의 링크가 너무 적다 — 찾는 곳이 빠졌다');
  링크검사(틀);
  링크검사(진단);
});

test('단계 표의 도구가 그 자리에 있고, 적힌 인자를 실제로 받는다', () => {
  const 글 = 읽기(스킬);
  const 있어야 = {
    'tools/컷연속성검사.py': ['--그림지시문', '--그림', '--지시문', '--받음', '--영상'],
    'tools/아르곤웹.js': ['점검'],
    'tools/미학맹검.js': ['--영상'],
    'tools/음악층.js': ['--편'],
    'tools/영상세션재기.js': [],
    'tools/고르심장부.js': ['예측', '고르심', '--맹검'],
    'tools/꾸러미만들기.py': ['--실행', '--덮어쓰기', '--컷'],
    'tools/받은뒤검사.py': ['--받음', '--판', '--연속성안함'],
    [`${굽기폴더}/크레딧내기.py`]: ['--걸림무시', '--컷표'],
    [`${굽기폴더}/드리미나내기.py`]: ['--걸림무시', '--컷표'],
    [`${굽기폴더}/사람움직임.py`]: [],
    'docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/끝판검사.py': [],
  };
  for (const [파일, 인자들] of Object.entries(있어야)) {
    assert.ok(fs.existsSync(path.join(뿌리, 파일)), `${파일}이 없다`);
    assert.ok(글.includes(path.basename(파일)), `한 장에 ${path.basename(파일)}가 없다`);
    const 소스 = 읽기(파일);
    for (const 인자 of 인자들) assert.ok(소스.includes(인자), `${파일}이 「${인자}」를 받지 않는다`);
  }
  for (const 인자 of ['--그림지시문', '--그림 ', '--지시문', '--받음', '--영상']) assert.ok(글.includes(인자), `한 장에 「${인자.trim()}」가 없다`);
  assert.ok(글.includes(`${굽기폴더}/`), '한 장에 내기 도구가 있는 폴더가 적혀 있지 않다');
});

// 원칙 줄 끝 괄호의 점검표 번호(「4~7」 꼴 포함)
function 원칙번호(글) {
  const 번호 = new Set();
  const 줄들 = 글.split(/\r?\n/).filter(l => /^\d+\. \*\*/.test(l));
  for (const 줄 of 줄들) {
    const m = 줄.match(/\(([^()]*)\)\s*$/);
    if (!m) continue;
    for (const 조각 of m[1].split('/')[0].split('·').map(x => x.trim())) {
      const 범위 = 조각.match(/^(\d+)~(\d+)$/);
      if (범위) for (let i = Number(범위[1]); i <= Number(범위[2]); i++) 번호.add(i);
      else if (/^\d+$/.test(조각)) 번호.add(Number(조각));
    }
  }
  return { 번호, 줄수: 줄들.length };
}

test('열두 원칙의 괄호가 슬롭 점검표를 다 덮는다 — 점검표에 줄을 더하면 어느 원칙의 변형인지 정해야 한다', () => {
  const { 번호, 줄수 } = 원칙번호(읽기(스킬).split('## 유호님 말씀이 나오면')[0]);
  assert.strictEqual(줄수, 12, `원칙이 ${줄수}줄이다 — 열두 줄을 지킨다(늘리지 말고 합친다)`);
  const 표 = 읽기(점검표).split(/\r?\n/).map(l => l.match(/^\| (\d+) \| ([^|]*)\|/)).filter(Boolean).map(m => ({ n: Number(m[1]), 자리: m[2].trim() }));
  assert.ok(표.length >= 56);
  const 겹침 = 표.map(x => x.n).filter((n, i, a) => a.indexOf(n) !== i);
  assert.deepStrictEqual(겹침, [], `점검표 번호가 겹친다(맹검 도구가 두 줄을 한 줄로 읽는다): ${겹침.join(', ')}`);
  const 있는번호 = new Set(표.map(x => x.n));
  const 없는 = [...번호].filter(n => !있는번호.has(n));
  assert.deepStrictEqual(없는, [], `원칙 괄호가 점검표에 없는 번호를 가리킨다: ${없는.join(', ')}`);
  const 안덮인 = 표.filter(x => !번호.has(x.n) && !/^화면 ·/.test(x.자리)).map(x => `${x.n}(${x.자리.slice(0, 20)})`);
  assert.deepStrictEqual(안덮인, [], `원칙 괄호에 없는 점검표 번호 — 어느 원칙의 변형인지 정해 괄호에 넣는다: ${안덮인.join(', ')}`);
});

test('AGENTS와 제작 규칙 · 슬롭 점검표 · 굽기 시트 · 문서 지도가 한 장을 입구로 가리킨다', () => {
  assert.ok(읽기('AGENTS.md').includes('.claude/skills/synk-video/SKILL.md'), 'AGENTS.md 영상 줄이 스킬을 가리키지 않는다');
  assert.ok(읽기('docs/마케팅/제작양식/AI광고영상_제작규칙.md').includes('skills/synk-video/SKILL.md'));
  assert.ok(읽기(점검표).includes('skills/synk-video/SKILL.md'));
  assert.ok(읽기(`${굽기폴더}/README.md`).includes('영상양식/지시문_틀.md'));
  assert.ok(읽기('docs/문서_지도.md').includes('skills/synk-video/SKILL.md'));
});

test('컷표 틀이 틀 2의 칸을 다 갖췄다', () => {
  const 표 = JSON.parse(읽기(컷표));
  assert.strictEqual(표.틀, 2);
  for (const 칸 of ['이기는것', '한문장', '가까운사례', '엔진', '장면', '인물', '글자', '소리', '끝', 'seq', 'detail', '소리사건', '사건']) assert.ok(칸 in 표, `컷표 틀에 「${칸}」 칸이 없다`);
  for (const d of 표.detail) for (const 칸 of ['장면', '인물', '구도', '카메라', '소리']) assert.ok(칸 in d, `${d.cut}에 「${칸}」 칸이 없다`);
  for (const d of 표.detail.filter(x => x.인물.length)) assert.ok(Array.isArray(d.연기) && d.연기.length >= 2, `${d.cut} 사람 컷에 연기 박자가 둘 이상이어야 한다`);
  for (const [이름, p] of Object.entries(표.인물)) assert.ok(p.설정 && p.묘사 && p.기준그림, `인물 ${이름}에 설정 · 묘사 · 기준그림이 있어야 한다`);
  for (const ev of 표.사건) assert.ok(ev.목적 && Array.isArray(ev.감정설계) && ev.감정설계.length, `사건 ${ev.이름}에 목적 · 감정설계가 있어야 한다`);
  // 예시가 스스로 규칙을 어기지 않는다 — 컷에 나오는 사람은 모두 인물 표에 있고, 끝 로고는 2.5초 넘게 선다
  for (const d of 표.detail) for (const 누구 of d.인물) assert.ok(표.인물[누구], `${d.cut}의 ${누구}가 인물 표에 없다`);
  assert.ok(표.끝.로고멈춤초 > 2.5);
});

test('지시문 틀이 표의 줄을 그대로 쓰게 하고, 정지 낱말 · 웹으로 내는 판 · 대사 판 소리를 적었다', () => {
  const 글 = 읽기(틀);
  for (const 낱말 of ['장면.빛', '장면.장소', '인물.묘사', 'ACTION', 'CAMERA', 'LOOK', '--걸림무시', 'starting pose', '_순서.json', '웹에서 손으로 내는 판', 'over quiet room tone', '--없이 혼자', 'only person']) {
    assert.ok(글.includes(낱말), `지시문 틀에 「${낱말}」이 없다`);
  }
});

test('틀대로 쓴 이미지 지시문은 아르곤 지시문 점검을 지난다(나이 · 점 · 결 · 글자 · 혼자 · 좌우)', () => {
  const 표 = JSON.parse(읽기(컷표));
  const c1 = 표.detail.find(d => d.cut === 'C1');
  const 장면 = 표.장면[c1.장면];
  const 사람 = c1.인물.map(n => 표.인물[n]);
  const 지시문 = [
    `SETTING: ${장면.장소}`,
    `LIGHT: ${장면.빛}`,
    `WHO: ${사람.map(p => [p.묘사, p.옷, p.점].filter(Boolean).join(' ')).join(' ')}`,
    'MOMENT: she has just set the pot on the stove and is about to let go of the handle; her shoulders are slightly raised, lips pressed together.',
    'FRAME: waist-up, three-quarter side view, 50mm, focus on her face.',
    'PROPS: one small pot on the stove, an empty wooden table in the foreground.',
    'NOT: She is the only person in the photo. No text, letters, logos or watermark anywhere. The air is clear, no drifting specks.',
  ].join('\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '영상입구-'));
  const 파일 = path.join(dir, 'C1.txt');
  fs.writeFileSync(파일, 지시문);
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '아르곤웹.js'), '점검', 파일, '--json'], { encoding: 'utf8' });
  const 답 = JSON.parse(r.stdout);
  const 걸림 = 답.결과.flatMap(x => x.걸림).map(x => `${x.등급}(${x.항목})`);
  assert.deepStrictEqual(걸림, [], `틀대로 쓴 지시문이 점검에 걸린다: ${걸림.join(', ')}`);
  fs.rmSync(dir, { recursive: true, force: true });
});
// 단계 에이전트(11-14) — 지시문 쓰기 두 단계는 정의 파일이 있는 에이전트에 편 폴더만 넘겨 맡긴다. 정의가 사라지거나 돈 쓰는 길을 열면 여기서 걸린다.
test('단계 에이전트 둘 — 정의 파일 · 맡기기 문서 · 한 장이 서로를 가리키고, 굽기 · 내기 · 컷표 고치기를 하지 않게 적혀 있다', () => {
  const 문서 = 'docs/마케팅/제작양식/영상양식/단계별_맡기기.md';
  assert.ok(읽기(스킬).includes('단계별_맡기기.md'), '한 장에 맡기기 문서 링크가 없다');
  링크검사(문서);
  const 에이전트 = {
    'video-image-prompts': ['이미지지시문/<컷>.txt', 'tools/아르곤웹.js 점검', '--그림지시문', '그림을 굽지 않는다', '컷표.json · 기준 그림 · 저장소 파일을 고치지 않는다'],
    'video-prompts': ['영상지시문/<컷>.txt', 'tools/꾸러미만들기.py', '영상을 내지 않는다', '`--덮어쓰기`를 붙이지 말고', '컷표.json · 정지 그림 · 저장소 파일을 고치지 않는다'],
  };
  for (const [이름, 낱말들] of Object.entries(에이전트)) {
    const 글 = 읽기(`.claude/agents/${이름}.md`);
    const 머리 = 글.split('---')[1] || '';
    assert.match(머리, new RegExp(`^name: ${이름}$`, 'm'), `${이름}: 머리말 name이 파일 이름과 다르다`);
    assert.match(머리, /^model: opus$/m, `${이름}: 만드는 손은 Opus다`);
    const 도구들 = (머리.match(/^tools: (.+)$/m) || [, ''])[1].split(',').map(x => x.trim()).filter(Boolean);   // 줄이 없거나 비면 빈 목록 — 도구 줄이 빠진 정의는 모든 도구(Agent까지)가 열린다
    assert.ok(도구들.length && !도구들.includes('Agent'), `${이름}: tools 줄이 없거나 다시 맡기는 도구(Agent)가 들어 있다`);
    for (const 낱말 of [...낱말들, '컷표에서 발견한 문제', 'synk-video/SKILL.md', '지시문_틀.md']) assert.ok(글.includes(낱말), `${이름} 정의에 「${낱말}」이 없다`);
    assert.ok(읽기(문서).includes(`\`${이름}\``), `맡기기 문서에 ${이름}이 없다`);
  }
});

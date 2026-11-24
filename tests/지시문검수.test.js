'use strict';
// 지시문 검수(11-25 유호님 「지시문도 자체 검수자가 있어야할것같아 … 그래야 영상만들때 토큰을 낭비하지않을테니까」) —
//   지시문 틀 「굽고 나서 다시 낸 까닭」 표 · 검수자 정의 · tools/지시문검수판.py(판 · 적기) · 컷연속성검사.지시문검수결과검사(내기 도구가 부른다)를 본다.
//   설계: docs/마케팅/제작양식/영상양식/지시문검수_설계_20261125.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 도구폴더 = path.join(뿌리, 'tools');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'print(1)'], { encoding: 'utf8' }).status === 0;
const 건너뜀 = !파이썬 && '파이썬 없음';
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), 'utf8').replace(/\r\n/g, '\n');
const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-prompt-review-'));

function 부르기(스크립트, 입력) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\n' + 스크립트, 도구폴더],
    { input: JSON.stringify(입력), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const 판도구 = (...a) => spawnSync('python', ['-I', '-X', 'utf8', path.join(도구폴더, '지시문검수판.py'), ...a], { encoding: 'utf8', maxBuffer: 1 << 24 });
const 결과검사 = 'a = json.load(sys.stdin)\nprint(json.dumps(k.지시문검수결과검사(a["seq"], a["폴더"], a["판"])))';

test('지시문 흠 표 — 지1부터 빈 번호 없이 줄마다 세 칸이 차 있고, 모든 줄을 검수자가 본다 · 컨셉 팩이 끄지 못한다 · 지시문 틀과 쓰는 손이 가리킨다', () => {
  const 표 = 읽기('docs/마케팅/제작양식/영상양식/지시문_흠표.md');
  const 틀 = 읽기('docs/마케팅/제작양식/영상양식/지시문_틀.md');
  const 줄 = [...표.matchAll(/^\|\s*(지\d+)\s*\|(.*)\|\s*$/gm)];
  assert.ok(줄.length >= 10, `표 줄이 ${줄.length}개다`);
  줄.forEach((m, i) => {
    assert.equal(m[1], `지${i + 1}`, '번은 지1부터 빈 번호 없이');
    const 칸 = m[2].split('|').map((s) => s.trim());
    assert.equal(칸.length, 3, `${m[1]}: 다시 낸 까닭 · 지시문에 적을 것 · 본다 세 칸`);
    assert.ok(칸.every(Boolean), `${m[1]}: 빈 칸이 있다`);
    assert.match(칸[2], /검수자/, `${m[1]}: 검수자가 보지 않는 줄은 검수 판정의 잣대가 될 수 없다`);
  });
  assert.match(표, /컨셉 팩은 이 표를 끄지 못한다/);
  assert.match(틀, /\(지시문_흠표\.md\)/, '지시문 틀의 「낼 때」가 흠 표를 가리킨다');
  assert.match(틀, /--지시문검수/, '웹에서 손으로 내는 판도 검수 결과를 본다');
  assert.match(읽기('.claude/agents/video-prompts.md'), /지시문_흠표\.md/, '쓰는 손도 같은 표로 쓴다');
});

test('검수자 정의 — 쓰는 손(video-prompts)과 다른 모델이고, 판과 적기를 돌리고, 지시문 · 컷표 · 그림을 고치지 않는다', () => {
  const 글 = 읽기('.claude/agents/video-prompt-review.md');
  const 머리 = 글.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(머리, '머리말이 있다');
  assert.match(머리[1], /^name: video-prompt-review$/m);
  const 모델 = 머리[1].match(/^model: (\S+)$/m);
  const 쓰는손 = 읽기('.claude/agents/video-prompts.md').match(/^model: (\S+)$/m);
  assert.ok(모델 && 쓰는손 && 모델[1] !== 쓰는손[1], '쓴 손과 같은 모델이면 같은 눈이다');
  assert.match(글, /tools\/지시문검수판\.py 판/);
  assert.match(글, /tools\/지시문검수판\.py 적기/);
  assert.match(글, /고치지 않는다/);
  assert.match(글, /표에 없는 것/, '새 흠은 주 세션에 올린다');
  assert.match(글, /「새흠」/, '표에 없는 흠을 판정.json에 남긴다');
  assert.match(글, /컷표 <컷> <칸>도 바꾼다/, '컷표 초까지 바꿔야 하는 고침을 따로 밝힌다');
});

test('지시문 지문 — 줄끝 · 줄 끝 빈칸 · 앞뒤 빈 줄은 같은 글로 보고, 글자 하나가 다르면 다른 글로 본다', { skip: 건너뜀 }, () => {
  const [a, b, c] = 부르기('a = json.load(sys.stdin)\nprint(json.dumps([k.지시문지문(x) for x in a]))',
    ['ONE SHOT.\nACTION: at 0.3 s she turns.\n', '\n\nONE SHOT.  \r\nACTION: at 0.3 s she turns.\r\n\r\n', 'ONE SHOT.\nACTION: at 0.4 s she turns.\n']);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('지시문검수결과검사 — 검수 없음 · 고침 · 글 바뀜 · 그림 바뀜은 걸림(11-25부터 편), 같은 글 「그대로」는 지나가고, 앞선 편은 주의', { skip: 건너뜀 }, () => {
  const 바탕 = 임시();
  try {
    const 새편 = path.join(바탕, '편_20261125'); fs.mkdirSync(path.join(새편, '정지'), { recursive: true });
    const 그림 = path.join(새편, '정지', 'C1.png'); fs.writeFileSync(그림, 'x');
    const 옛때 = new Date(Date.now() - 3600_000); fs.utimesSync(그림, 옛때, 옛때);
    const 글 = 'ONE SHOT.\nACTION: at 0.3 s she turns.';
    const 지문 = 부르기('print(json.dumps(k.지시문지문(json.load(sys.stdin))))', 글);
    const 적기 = (이름, 판) => { const d = path.join(새편, '검수', 이름); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, '결과.json'), JSON.stringify({ 판 })); };
    const seq = { 틀: 2, 편: { 이름: '새 편' }, detail: [{ cut: 'C1', 시작그림: '정지/C1.png' }, { cut: 'C2' }] };
    const 판 = [['C1', 글, ['C1']], ['C2', 글, ['C2']]];
    const 등급 = (r) => r.map(([g, n]) => [g, n]);
    let r = 부르기(결과검사, { seq, 폴더: 새편, 판 });
    assert.deepEqual(등급(r), [['걸림', 'C1'], ['걸림', 'C2']]);
    assert.match(r[0][2], /지시문 검수를 받지 않았다/);
    적기('지시문검수_20261125-0100', { C1: { 지문, 판정: '그대로' }, C2: { 지문, 판정: '고침' } });
    r = 부르기(결과검사, { seq, 폴더: 새편, 판 });
    assert.deepEqual(등급(r), [['걸림', 'C2']]);
    assert.match(r[0][2], /「고침」으로 봤다/);
    // 나중 기록(이름이 더 나중인 폴더)이 C2만 다시 보고 「그대로」 — 앞 기록의 C1과 함께 지나간다
    적기('지시문검수_20261125-0130', { C2: { 지문, 판정: '그대로' } });
    assert.deepEqual(부르기(결과검사, { seq, 폴더: 새편, 판 }), []);
    // 검수 뒤에 글이 바뀌면 걸림
    r = 부르기(결과검사, { seq, 폴더: 새편, 판: [['C1', `${글} She smiles.`, ['C1']]] });
    assert.equal(r.length, 1);
    assert.match(r[0][2], /검수 뒤에 글이 바뀌었다/);
    // 검수 뒤에 시작 그림을 다시 구웠으면 걸림
    const 새때 = new Date(Date.now() + 60_000); fs.utimesSync(그림, 새때, 새때);
    r = 부르기(결과검사, { seq, 폴더: 새편, 판: [['C1', 글, ['C1']]] });
    assert.equal(r.length, 1);
    assert.match(r[0][2], /검수 뒤에 그림이 바뀌었다\(C1 시작그림\)/);
    // 앞선 편(폴더 날짜 11-24 · 「만든날」 11-24)은 주의, 「경계확인」 필수면 걸림, 날짜를 못 읽는 편은 보지 않는다
    const 옛편 = path.join(바탕, '편_20261124'); fs.mkdirSync(옛편);
    assert.deepEqual(등급(부르기(결과검사, { seq, 폴더: 옛편, 판: [['C1', 글, ['C1']]] })), [['주의', 'C1']]);
    assert.deepEqual(등급(부르기(결과검사, { seq: { ...seq, 편: { 경계확인: '필수' } }, 폴더: 옛편, 판: [['C1', 글, ['C1']]] })), [['걸림', 'C1']]);
    const 날없는 = path.join(바탕, '날짜없는편'); fs.mkdirSync(날없는);
    assert.deepEqual(부르기(결과검사, { seq, 폴더: 날없는, 판: [['C1', 글, ['C1']]] }), []);
    assert.deepEqual(등급(부르기(결과검사, { seq: { ...seq, 편: { 만든날: '2026-11-24' } }, 폴더: 날없는, 판: [['C1', 글, ['C1']]] })), [['주의', 'C1']]);
    assert.deepEqual(등급(부르기(결과검사, { seq: { ...seq, 편: { 만든날: '2026-11-25' } }, 폴더: 날없는, 판: [['C1', 글, ['C1']]] })), [['걸림', 'C1']]);
  } finally {
    fs.rmSync(바탕, { recursive: true, force: true });
  }
});

function 편짓기(바탕) {
  const 편 = path.join(바탕, '편_20261125');
  fs.mkdirSync(path.join(편, '정지'), { recursive: true });
  for (const c of ['C1', 'C2', 'C3']) fs.writeFileSync(path.join(편, '정지', `${c}.png`), 'x');
  const 빛 = 'Night. One warm pendant lamp above the table lights her face from the left of the frame.';
  const 연기 = [{ t: 0.3, 무엇: '수아가 고개를 문 쪽으로 돌린다' }, { t: 1.4, 무엇: '수아가 오른손으로 컵을 든다' }];
  const 컷표 = {
    틀: 2, 편: { 이름: '시험 편' }, 컨셉: '감동',
    장면: { 부엌: { 장소: 'A small kitchen with a round wooden table.', 빛 } },
    인물: { 수아: { 묘사: 'Sua is 28 years old.', 옷: 'A grey hoodie.' } },
    소품: { 컵: { 종류: '소품', 낱말: ['cup'], 색: 'white', 생김새: 'A plain white cup.' } },
    detail: ['C1', 'C2', 'C3'].map((cut, i) => ({ cut, t: i * 3, dur: 3, in: 0.3, out: 3.3, 장면: '부엌', 인물: ['수아'], 시작그림: `정지/${cut}.png`, 구도: '가슴 위', 연기, 소품: { 컵: '식탁 위' } })),
  };
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(컷표), 'utf8');
  const 꾸러미 = path.join(편, '꾸러미'); fs.mkdirSync(path.join(꾸러미, '002_C2'), { recursive: true });
  const 지시문 = `@이미지 1 is the exact first frame of this video.\nONE SINGLE CONTINUOUS SHOT.\nWHO: Sua, exactly as in the start frame.\nACTION: at about 0.3 s she turns her head toward the door; at about 1.4 s she lifts the cup with her right hand.\nCAMERA: Static shot.\nLOOK: ${빛} The light and colour stay exactly like this to the last frame. No new people, no new text.\nSOUND: No sound.\n`;
  fs.writeFileSync(path.join(꾸러미, '002_C2', '지시문.txt'), 지시문, 'utf8');
  fs.writeFileSync(path.join(꾸러미, '_순서.json'), JSON.stringify([{ 순서: 1, id: 'C2', 폴더: '002_C2', 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [] }]), 'utf8');
  return { 편, 지시문파일: path.join(꾸러미, '002_C2', '지시문.txt') };
}

test('지시문검수판.py — 판은 판마다 지문 · 컷표 줄 · 앞뒤 컷을 담고, 적기는 꼴이 틀린 판정을 거절하고 결과를 써서 내기 쪽 검사가 그 결과를 읽는다', { skip: 건너뜀 }, () => {
  const 바탕 = 임시();
  try {
    const { 편, 지시문파일 } = 편짓기(바탕);
    const 출력 = path.join(편, '검수', '지시문검수_20261125-0200');
    const p = 판도구('판', 편, '--출력', 출력);
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const 판 = JSON.parse(fs.readFileSync(path.join(출력, '판.json'), 'utf8'));
    assert.equal(판.판.length, 1);
    const x = 판.판[0];
    assert.equal(x.id, 'C2');
    assert.deepEqual(x.컷들, ['C2']);
    assert.equal(x.앞컷.cut, 'C1');
    assert.equal(x.뒤컷.cut, 'C3');
    assert.equal(x.컷표[0].시작그림.있음, true);
    assert.equal(x.지문, 부르기('print(json.dumps(k.지시문지문(json.load(sys.stdin))))', fs.readFileSync(지시문파일, 'utf8')));
    assert.ok(Object.keys(x.인물표).includes('수아') && Object.keys(x.소품표).includes('컵'));
    assert.ok('지1' in 판.흠 && '지14' in 판.흠);
    assert.equal(판.컨셉, '감동');
    const 판정 = (v) => fs.writeFileSync(path.join(출력, '판정.json'), JSON.stringify({ 검수자: { 모델: 'claude-fable-5-2' }, 판: { C2: v } }), 'utf8');
    // 꼴이 틀린 판정은 결과를 쓰지 않는다
    판정({ 판정: '고침', 흠: ['지99'], 고칠것: [] });
    let a = 판도구('적기', 출력);
    assert.equal(a.status, 1, a.stdout + a.stderr);
    assert.match(a.stdout, /모르는 번/);
    assert.match(a.stdout, /고칠문장/);
    assert.ok(!fs.existsSync(path.join(출력, '결과.json')));
    판정({ 판정: '그대로', 흠: ['지1'], 고칠것: [] });
    a = 판도구('적기', 출력);
    assert.equal(a.status, 1);
    assert.match(a.stdout, /「그대로」인데 흠이나 고칠 것이 있다/);
    // 표에 없는 흠(새흠, 11-25 시험 검수) — 그대로와 함께 쓸 수 없고, 고침은 고칠문장이, 시험 먼저는 무엇만 있으면 된다 · 결과에 남는다
    판정({ 판정: '그대로', 흠: [], 고칠것: [], 새흠: [{ 무엇: '말하지 않는 사람의 입' }] });
    assert.equal(판도구('적기', 출력).status, 1);
    판정({ 판정: '고침', 흠: [], 고칠것: [], 새흠: [{ 무엇: '말하지 않는 사람의 입' }] });
    a = 판도구('적기', 출력);
    assert.equal(a.status, 1);
    assert.match(a.stdout, /고칠문장/);
    판정({ 판정: '시험 먼저', 흠: [], 고칠것: [], 새흠: [{ 무엇: '두 사람이 맞닿는 동작 — 해낼지 모른다' }] });
    a = 판도구('적기', 출력);
    assert.equal(a.status, 2, a.stdout + a.stderr);
    assert.match(a.stdout, /표에 없는 흠 1개/);
    const 새 = JSON.parse(fs.readFileSync(path.join(출력, '결과.json'), 'utf8'));
    assert.equal(새.판.C2.새흠.length, 1);
    assert.equal(새.요약.새흠, 1);
    // 고침 → 끝 코드 2 · 내기 쪽 검사가 걸림
    판정({ 판정: '고침', 흠: ['지8'], 고칠것: [{ 흠: '지8', 무엇: '컵의 생김새를 못 박지 않았다', 고칠문장: 'the cup keeps its plain white look exactly as in the first frame' }] });
    a = 판도구('적기', 출력);
    assert.equal(a.status, 2, a.stdout + a.stderr);
    const 결과 = JSON.parse(fs.readFileSync(path.join(출력, '결과.json'), 'utf8'));
    assert.equal(결과.판.C2.판정, '고침');
    assert.equal(결과.판.C2.지문, x.지문);
    const seq = JSON.parse(fs.readFileSync(path.join(편, '컷표.json'), 'utf8'));
    const 글 = fs.readFileSync(지시문파일, 'utf8');
    let r = 부르기(결과검사, { seq, 폴더: 편, 판: [['C2', 글, ['C2']]] });
    assert.equal(r.length, 1);
    assert.equal(r[0][0], '걸림');
    // 그대로 → 끝 코드 0 · 지나간다
    판정({ 판정: '그대로', 흠: [], 고칠것: [] });
    a = 판도구('적기', 출력);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.deepEqual(부르기(결과검사, { seq, 폴더: 편, 판: [['C2', 글, ['C2']]] }), []);
    // --지시문검수를 붙인 컷연속성검사도 같은 결과를 읽는다(웹에서 손으로 내는 판의 관문)
    const 검사 = spawnSync('python', ['-I', '-X', 'utf8', path.join(도구폴더, '컷연속성검사.py'), path.join(편, '컷표.json'), '--지시문', path.join(편, '꾸러미'), '--지시문검수', '--json', '--출력', path.join(바탕, '검사')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const 항목 = JSON.parse(검사.stdout.slice(검사.stdout.indexOf('[')));
    assert.ok(!항목.some((h) => /\(검수\)/.test(h.글)), JSON.stringify(항목.filter((h) => /\(검수\)/.test(h.글))));
    // 판을 만든 뒤 지시문이 바뀌면 적기가 거절한다 · 검사도 걸림
    fs.writeFileSync(지시문파일, `${글}PHYSICS: the cup stays where it is.\n`, 'utf8');
    a = 판도구('적기', 출력);
    assert.equal(a.status, 1);
    assert.match(a.stdout, /판을 만든 뒤 지시문이 바뀌었다/);
    const 검사2 = spawnSync('python', ['-I', '-X', 'utf8', path.join(도구폴더, '컷연속성검사.py'), path.join(편, '컷표.json'), '--지시문', path.join(편, '꾸러미'), '--지시문검수', '--json', '--출력', path.join(바탕, '검사')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const 항목2 = JSON.parse(검사2.stdout.slice(검사2.stdout.indexOf('[')));
    const 걸린 = 항목2.filter((h) => /\(검수\)/.test(h.글));
    assert.equal(걸린.length, 1, JSON.stringify(걸린));
    assert.equal(걸린[0].등급, '걸림');
    assert.match(걸린[0].글, /검수 뒤에 글이 바뀌었다/);
    // --지시문검수 없이(꾸러미를 짓는 도구가 부르는 꼴) — 검수 줄을 내지 않는다
    const 검사3 = spawnSync('python', ['-I', '-X', 'utf8', path.join(도구폴더, '컷연속성검사.py'), path.join(편, '컷표.json'), '--지시문', path.join(편, '꾸러미'), '--json', '--출력', path.join(바탕, '검사')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const 항목3 = JSON.parse(검사3.stdout.slice(검사3.stdout.indexOf('[')));
    assert.ok(!항목3.some((h) => /\(검수\)/.test(h.글)));
  } finally {
    fs.rmSync(바탕, { recursive: true, force: true });
  }
});

test('내기 도구 — 굽기전(): 11-25부터 시작한 편은 지시문 검수가 「그대로」로 본 판만 내고, 그 판만 까닭을 적어 넘길 수 있다', { skip: 건너뜀 }, () => {
  const 바탕 = 임시();
  try {
    const { 편 } = 편짓기(바탕);
    const 내기폴더 = path.join(뿌리, 'docs/마케팅/PULSE_포트폴리오_제작준비_20261012/시댄스무제한');
    const 스크립트 = 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 크레딧내기 as 내기\n'
      + 'pack = sys.argv[2]\nb = json.load(open(pack + "/_순서.json", encoding="utf-8"))[0]\n'
      + 'try:\n    print(json.dumps(내기.굽기전([(pack, b)], sys.argv[3] or None), ensure_ascii=False))\nexcept SystemExit as e:\n    print("멈춤", e)\n';
    const 돌림 = (무시 = '') => spawnSync('python', ['-I', '-X', 'utf8', '-c', 스크립트, 내기폴더, path.join(편, '꾸러미'), 무시], { encoding: 'utf8', maxBuffer: 1 << 24 });
    let g = 돌림();
    assert.equal(g.status, 0, g.stderr);
    assert.match(g.stdout, /✗ C2: \(검수\) 지시문 검수를 받지 않았다/);
    assert.match(g.stdout, /멈춤/);
    // 시험 컷표는 칸이 덜 차 표 걸림이 있다 — 표 걸림만 넘기면 검수 걸림이 남아 멈춘다
    g = 돌림('컷표: 시험 컷표');
    assert.match(g.stdout, /넘기지 않은 걸림이 남았다: C2/, g.stdout);
    g = 돌림('C2,컷표: 시험 먼저 — 480p');
    assert.match(g.stdout, /"C2": "시험 먼저 — 480p"/, g.stdout);
  } finally {
    fs.rmSync(바탕, { recursive: true, force: true });
  }
});

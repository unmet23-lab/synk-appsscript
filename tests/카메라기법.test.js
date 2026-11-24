'use strict';
// 카메라 기법(11-25 유호님 「카메라 감독 앵글 보니까 너무 부족한데? 불릿샷이나 이런거 카메라 앵글 효과가 이것보다 훨씬 많을텐데 너무 없는데?」) —
//   기법 사전(docs/마케팅/제작양식/영상양식/카메라기법.json)과 컷표 「앵글.기법」, 컷 연속성 검사 T29의 기법검사 · 기법대조(영상 지시문 · 이미지 지시문).
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
const 사전경로 = 'docs/마케팅/제작양식/영상양식/카메라기법.json';
const 읽기 = p => fs.readFileSync(path.join(뿌리, p), 'utf8').replace(/\r\n/g, '\n');

function 부르기(스크립트, 입력) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c',
    'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\nfrom pathlib import Path\na = json.load(sys.stdin)\n'
    + 'if a.get("사전"):\n    k.기법사전경로 = Path(a["사전"]); k._기법사전캐시 = None\n' + 스크립트, 도구폴더],
    { input: JSON.stringify(입력), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// 사전 꼴에 기대지 않고 검사의 규칙만 보는 시험용 사전
const 시험사전 = {
  기법: [
    { 이름: '고정', 갈래: '움직임', 만드는곳: '영상', 낱말: ['locked-off', 'static camera'], 큰움직임: false },
    { 이름: '휩 팬', 갈래: '움직임', 만드는곳: '영상', 낱말: ['whip pan'], 길: true, 큰움직임: true },
    { 이름: '크래시 줌', 갈래: '렌즈', 만드는곳: '영상', 낱말: ['crash zoom', 'snap zoom'], 큰움직임: true },
    { 이름: '불릿 타임', 갈래: '시간', 만드는곳: '영상', 낱말: ['bullet time'], 길: true, 큰움직임: true, 한번: true, 시험먼저: true, 조심: '사람에게 정지 낱말을 쓰지 않는다' },
    { 이름: '더치', 갈래: '구도', 만드는곳: '그림', 낱말: ['dutch angle', 'canted frame'], 큰움직임: false },
    { 이름: '속도 변화', 갈래: '시간', 만드는곳: '편집', 낱말: [], 큰움직임: false },
    { 이름: '밀어 들어감', 갈래: '움직임', 만드는곳: '영상', 낱말: ['push in', 'dolly in'], 큰움직임: false },
  ],
  컨셉: { 코믹: { 최소: 3, 자주: ['휩 팬', '크래시 줌'], 한방: ['불릿 타임'], 피함: ['밀어 들어감'], 피함까닭: '진지해진다' } },
};
function 시험사전파일(t) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-camera-moves-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const p = path.join(폴더, '카메라기법.json');
  fs.writeFileSync(p, JSON.stringify(시험사전));
  return p;
}
const 검사 = 'print(json.dumps(k.기법검사(a["seq"], a.get("폴더"), a["seq"]["detail"]), ensure_ascii=False))';
const 대조 = 'print(json.dumps([k.기법대조(a["seq"], c, g, None, 곳) for c, g, 곳 in a["글"]], ensure_ascii=False))';
const 컷 = (cut, 기법, 덧 = {}) => ({ cut, 장면: '방', 인물: ['수아'], 앵글: { 크기: '클로즈', 높이: '눈높이', 방향: '정면', 까닭: '까닭', ...(기법 === undefined ? {} : { 기법 }) }, ...덧 });
const 새날 = { 만든날: '2026-11-25' };

test('기법검사 — 사전 밖 이름은 새 편 걸림 · 앞선 편 주의(비슷한 이름을 알려 준다), 글 하나로 적어도 읽는다', { skip: 건너뜀 }, t => {
  const 사전 = 시험사전파일(t);
  const 새 = 부르기(검사, { 사전, seq: { 편: 새날, detail: [컷('C1', ['휩팬']), 컷('C2', '고정')] } });
  assert.equal(새.length, 1, JSON.stringify(새));
  assert.deepEqual([새[0][0], 새[0][1]], ['걸림', 'C1']);
  assert.match(새[0][2], /「휩팬」은 카메라 기법 사전에 없다 — 사전의 이름으로 적는다\(「휩 팬」\?\)/);
  const 옛 = 부르기(검사, { 사전, seq: { 편: { 만든날: '2026-11-24' }, detail: [컷('C1', ['휩팬'])] } });
  assert.equal(옛[0][0], '주의');
  assert.deepEqual(부르기(검사, { 사전, seq: { detail: [컷('C1', '휩 팬'), 컷('C2', '고정')] } }), [], '글 하나로 적은 기법');
});

test('기법검사 — 큰 움직임이 이웃 컷에 잇달아 오거나(이어 찍은 컷은 뺀다) 한 컷에 카메라 경로가 둘이면 주의 · 시험먼저 · 피함은 주의', { skip: 건너뜀 }, t => {
  const 사전 = 시험사전파일(t);
  const 줄 = 부르기(검사, { 사전, seq: { 컨셉: '코믹', detail: [
    컷('C1', ['휩 팬']), 컷('C2', ['크래시 줌']), 컷('C3', ['고정']), 컷('C4', ['휩 팬']), 컷('C5', ['크래시 줌'], { 이어찍기: true }),
    컷('C6', ['불릿 타임', '휩 팬']), 컷('C7', ['밀어 들어감'])] } });
  const 찾기 = (어디, 꼴) => 줄.filter(x => x[1] === 어디 && 꼴.test(x[2]));
  assert.equal(찾기('C2', /큰 움직임이 앞 컷 C1에 이어 또 온다\(휩 팬 → 크래시 줌\)/).length, 1);
  assert.equal(찾기('C5', /큰 움직임이 앞 컷/).length, 0, '이어 찍은 컷');
  assert.equal(찾기('C6', /한 컷에 카메라 경로가 둘이다\(불릿 타임 · 휩 팬\) — 한 판에는 움직임을 하나만 쓴다/).length, 1);
  assert.equal(찾기('C6', /큰 움직임이 앞 컷 C5에 이어/).length, 1);
  assert.match(찾기('C6', /「불릿 타임」은 시험부터/)[0][2], /480p로 먼저 굽고 .*\. 사람에게 정지 낱말을 쓰지 않는다$/);
  assert.match(찾기('C7', /「밀어 들어감」은 코믹 컨셉이 피하는 기법이다/)[0][2], /진지해진다$/);
  assert.ok(줄.every(x => x[0] === '주의'), JSON.stringify(줄));
  const 두번 = 부르기(검사, { 사전, seq: { detail: [컷('C1', ['불릿 타임']), 컷('C2', ['고정']), 컷('C3', ['불릿 타임'])] } });
  assert.ok(두번.find(x => x[1] === '표' && /「불릿 타임」 2번 — 한 편에 한 번만 쓰는 기법이다/.test(x[2])), JSON.stringify(두번));
});

test('기법검사 — 새 컨셉 편(컷 여섯부터)은 고정 말고 「최소」 가지부터, 앞선 편과 컨셉 없는 편은 묻지 않는다', { skip: 건너뜀 }, t => {
  const 사전 = 시험사전파일(t);
  const 여섯 = 기법들 => 기법들.map((g, i) => 컷(`C${i + 1}`, g));
  const 적음 = 부르기(검사, { 사전, seq: { 컨셉: '코믹', 편: 새날, detail: 여섯([['고정'], ['휩 팬'], ['고정'], [], ['고정'], undefined]) } });
  assert.equal(적음.length, 1, JSON.stringify(적음));
  assert.match(적음[0][2], /카메라 기법이 1가지뿐이다\(휩 팬\) — 코믹 컨셉은 컷 6개에 고정 말고 3가지부터 쓴다\. 자주 쓰는 것: 휩 팬 · 크래시 줌/);
  assert.deepEqual(부르기(검사, { 사전, seq: { 컨셉: '코믹', 편: 새날, detail: 여섯([['고정'], ['휩 팬'], ['고정'], ['크래시 줌'], ['고정'], ['더치']]) } }), [], '세 가지');
  assert.deepEqual(부르기(검사, { 사전, seq: { 컨셉: '코믹', 편: { 만든날: '2026-11-24' }, detail: 여섯([[], [], [], [], [], []]) } }), [], '앞선 편');
  assert.deepEqual(부르기(검사, { 사전, seq: { 편: 새날, detail: 여섯([[], [], [], [], [], []]) } }), [], '컨셉 없는 편');
  assert.deepEqual(부르기(검사, { 사전, seq: { 컨셉: '코믹', 편: 새날, detail: 여섯([[], [], [], [], [], []]).slice(0, 5) } }), [], '컷 다섯');
});

test('기법대조 — 영상 기법은 영상 지시문에, 그림 기법은 이미지 지시문에 낱말 하나가 있어야 하고, 편집 기법은 보지 않는다', { skip: 건너뜀 }, t => {
  const 사전 = 시험사전파일(t);
  const seq = { 편: 새날, detail: [컷('C1', ['휩 팬', '더치', '속도 변화']), 컷('C2', ['크래시 줌'])] };
  const 값 = 부르기(대조, { 사전, seq, 글: [
    [['C1'], 'CAMERA: a fast Whip-Pan, to the left, ending on her face.', '영상'],
    [['C1'], 'CAMERA: the camera turns left.', '영상'],
    [['C1', 'C2'], 'CAMERA: whip pan, then a snap zoom.', '영상'],
    [['C1'], 'FRAME: canted frame, 35mm lens.', '그림'],
    [['C1'], 'FRAME: close-up, 35mm lens.', '그림'],
  ] });
  assert.deepEqual(값[0], [], '대소문자 · 붙임표 · 쉼표를 가리지 않는다');
  assert.equal(값[1].length, 1);
  assert.deepEqual(값[1][0], ['걸림', '컷 C1의 기법 「휩 팬」이 CAMERA 줄에 없다 — 「whip pan」를 쓴다(영상양식/카메라기법.json)']);
  assert.equal(값[2].length, 1, '나누지 않은 두 컷 판 — 낱말은 다 있어도 어느 샷의 것인지 가를 수 없다(r2 GA6)');
  assert.deepEqual(값[2][0][0], '걸림', '컷마다 기법이 다르면 새 편은 SHOT으로 나눠야 지나간다(r3 GA5)');
  assert.match(값[2][0][1], /컷 C1 · C2의 판이 SHOT으로 나뉘지 않아 컷마다 기법을 가를 수 없다/);
  assert.deepEqual(값[3], [], '그림 기법은 이미지 지시문에서');
  assert.match(값[4][0][1], /컷 C1의 기법 「더치」이 FRAME 줄\(이나 첫 문장\)에 없다 — 「dutch angle」\(또는 canted frame\)를 쓴다/);
  const 옛 = 부르기(대조, { 사전, seq: { ...seq, 편: { 만든날: '2026-11-24' } }, 글: [[['C1'], 'CAMERA: no move.', '영상']] });
  assert.equal(옛[0][0][0], '주의', '앞선 편은 주의');
});

// 11-25 GPT 검수(camera-moves-20261125) GA2~GA6 — 사전을 못 읽음 · 제자리 밖 낱말 · 두 샷 · 부정 · 뭉뚱그린 궤도
test('기법대조 — 낱말은 제자리(CAMERA · FRAME · 첫 문장)에서만, 부정하면 세지 않고, 두 샷 판은 컷마다 제 SHOT, 사전을 못 읽으면 새 편은 걸림', { skip: 건너뜀 }, t => {
  const 사전 = 시험사전파일(t);
  const seq = { 편: 새날, detail: [컷('C1', ['밀어 들어감']), 컷('C2', ['휩 팬'])] };
  const 값 = 부르기(대조, { 사전, seq, 글: [
    [['C1'], 'ACTION: at about 0.4 s she moves closer to the door.\nCAMERA: locked-off.', '영상'],
    [['C2'], 'CAMERA: No whip pan. Keep a static camera.', '영상'],
    [['C2'], 'CAMERA: instead of a whip pan, the camera holds.', '영상'],
    [['C2'], 'CAMERA: a fast whip pan to the left, no other movement.', '영상'],
    [['C1', 'C2'], 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0-2 s) ACTION: at about 0.5 s she turns. CAMERA: a fast whip pan right.\nSHOT 2 (2-4 s) ACTION: at about 2.5 s she sits. CAMERA: slow push in.', '영상'],
    [['C1', 'C2'], 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0-2 s) ACTION: at about 0.5 s she turns. CAMERA: slow push in.\nSHOT 2 (2-4 s) ACTION: at about 2.5 s she sits. CAMERA: a fast whip pan right.', '영상'],
    [['C2'], 'CAMERA: a fast whip pan to the left. No other movement.', '영상'],
  ] });
  assert.match(값[0][0][1], /컷 C1의 기법 「밀어 들어감」이 CAMERA 줄에 없다/, 'ACTION의 사람 동작은 카메라 기법이 아니다(GA3)');
  assert.equal(값[1].length, 1, '「No whip pan」은 기법 지시가 아니다(GA5)');
  assert.equal(값[2].length, 1, '「instead of a whip pan」도 부정이다');
  assert.equal(값[3].length, 1, '같은 문장의 no other movement도 부정어다 — 기법은 부정어 없는 한 문장으로(Fable 설계 검토)');
  assert.match(값[3][0][1], /컷 C2의 기법 「휩 팬」 낱말이 CAMERA 줄에서 부정어\(no · not · never · without · instead\)가 든 문장에만 있다/);
  assert.deepEqual(값[6], [], '금지를 다른 문장으로 떼면 지나간다');
  assert.equal(값[4].length, 2, JSON.stringify(값[4]));
  assert.match(값[4][0][1], /컷 C1의 기법 「밀어 들어감」이 CAMERA 줄\(SHOT 1\)에 없다/, '순서를 뒤집은 두 샷 판(GA4)');
  assert.match(값[4][1][1], /컷 C2의 기법 「휩 팬」이 CAMERA 줄\(SHOT 2\)에 없다/);
  assert.deepEqual(값[5], [], '제 순서의 두 샷 판');
  const 없는 = path.join(os.tmpdir(), 'synk-없는-사전-20261125.json');
  const 새 = 부르기(대조, { 사전: 없는, seq, 글: [[['C2'], 'CAMERA: locked-off.', '영상']] });
  assert.equal(새[0][0][0], '걸림', '사전을 못 읽으면 새 편은 막는다(GA2)');
  assert.match(새[0][0][1], /카메라 기법 사전을 못 읽어 컷표 「앵글\.기법」을 지시문과 대조하지 못했다/);
  assert.equal(부르기(검사, { 사전: 없는, seq })[0][0], '걸림', '표 검사도 새 편은 걸림');
  assert.deepEqual(부르기(대조, { 사전: 없는, seq: { 편: 새날, detail: [컷('C1')] }, 글: [[['C1'], 'CAMERA: locked-off.', '영상']] })[0], [], '기법을 안 적은 컷은 묻지 않는다');
});

test('진짜 사전 — 360 궤도는 90° 궤도 문장으로 지나지 않고, 연기 · 전체에서 찾는 기법은 그 자리에서 찾는다', { skip: 건너뜀 }, () => {
  const seq = d => ({ 편: 새날, detail: [d] });
  const 값 = 부르기(대조, { seq: seq(컷('C1', ['360 궤도'])), 글: [
    [['C1'], 'CAMERA: The camera orbits around her by 90 degrees.', '영상'],
    [['C1'], 'CAMERA: a slow 360 orbit around the bottle over 12 seconds.', '영상'],
  ] });
  assert.equal(값[0].length, 1, '90° 궤도는 360 궤도가 아니다(GA6)');
  assert.deepEqual(값[1], []);
  const 말 = 부르기(대조, { seq: seq(컷('C1', ['렌즈 보고 말하기', '판 안 컷'])), 글: [
    [['C1'], 'TWO SHOTS, ONE hard cut at 2.0 s.\nACTION: at about 0.5 s he looks straight into the lens and smiles.\nCAMERA: locked-off.', '영상'],
    [['C1'], 'ACTION: at about 0.5 s he smiles.\nCAMERA: he looks straight into the lens.', '영상'],
  ] });
  assert.deepEqual(말[0], [], '렌즈 보고 말하기는 ACTION에서, 판 안 컷은 샷 머리에서 찾는다');
  assert.equal(말[1].length, 2, '렌즈 보고 말하기를 CAMERA에만 쓰면 걸리고, 샷 머리가 없으면 판 안 컷도 걸린다');
  // 11-25 GPT 다시 검수(camera-moves-20261125-r2) — 문장을 건너는 부정 · 먼 부정 · 칸을 건너 붙은 낱말 · 사람의 회전 · 커피 두 잔
  const 꼴 = (기법, 글) => 부르기(대조, { seq: seq(컷('C1', [기법])), 글: [[['C1'], 글, '영상']] })[0];
  assert.deepEqual(꼴('휩 팬', 'CAMERA: No zoom. Whip pan right.'), [], '앞 문장의 No는 뒤 문장을 부정하지 않는다(r2 GA2)');
  assert.equal(꼴('휩 팬', 'CAMERA: Do not use a fast whip pan. Keep a static camera.').length, 1, '같은 절의 do not은 부정이다(r2 GA7)');
  assert.equal(꼴('시간 멈춤', 'ACTION: She carries the boxes one at a time.\nCAMERA: Stops tracking at the doorway and holds.').length, 1, '칸을 건너 time stops가 생기지 않는다(r2 GA3)');
  assert.equal(꼴('360 궤도', 'CAMERA: Arc 90 degrees around her as she completes a full 360 turn.').length, 1, '사람의 360 회전은 카메라 궤도가 아니다(r2 GA1)');
  assert.equal(꼴('판 안 컷', 'ONE SINGLE CONTINUOUS SHOT.\nACTION: at about 0.5 s she orders two shots of espresso.\nCAMERA: locked-off.').length, 1, '샷 머리 밖의 two shots는 판 안 컷이 아니다(r2 GA5)');
  // 11-25 GPT 다시 검수(camera-moves-20261125-r3)와 Fable 설계 검토 — 부정은 낱말이 든 문장 전체에서, 두 컷 판은 SHOT으로
  assert.match(꼴('휩 팬', 'CAMERA: No pans, including whip pans. Keep the camera locked off.')[0][1], /부정어\(no · not · never · without · instead\)가 든 문장에만 있다/, '쉼표 뒤로 이어진 부정(r3 GA1 · GA6)');
  assert.equal(꼴('휩 팬', 'CAMERA: Do not zoom but use a whip pan to the right.').length, 1, '부정어가 든 문장의 기법은 세지 않는다 — 규칙대로의 걸림(r3 GA2)');
  assert.deepEqual(꼴('휩 팬', 'CAMERA: Whip pan to the right. No zoom.'), [], '기법 문장과 금지 문장을 떼면 지나간다');
  assert.equal(꼴('휩 팬', 'CAMERA: No pans until 1.5 s, including whip pans.').length, 1, '숫자 사이의 점은 문장 끝이 아니다');
  assert.equal(꼴('고정', 'CAMERA: locked-off, no zoom, no pan.').length, 1, '치르는 값 — 고정도 금지와 한 문장이면 걸린다');
  assert.deepEqual(꼴('고정', 'CAMERA: Locked-off. No zoom, no pan.'), []);
  assert.deepEqual(꼴('휩 팬', 'CAMERA: Whip pans are forbidden.'), [], '받아들인 한계 — 부정어 없이 금하는 문장은 검수자 몫(흠 표 지17)');
  const 두 = (글, 덧 = {}) => 부르기(대조, { seq: { 편: 새날, detail: [컷('C1', ['밀어 들어감']), 컷('C2', ['물러남'], 덧)] }, 글: [[['C1', 'C2'], 글, '영상']] })[0];
  const 나눈 = 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0-2 s) CAMERA: slow push in.\nSHOT 2 (2-4 s) CAMERA: pull back.';
  assert.deepEqual(두(나눈), [], '제 차례로 나눈 두 컷 판');
  const 안나눈 = 두('TWO SHOTS, ONE hard cut at 2.0 s.\nCAMERA: The first shot pulls back. The second shot pushes in.');
  assert.equal(안나눈.length, 1, JSON.stringify(안나눈));
  assert.equal(안나눈[0][0], '걸림', '틀대로 머리만 쓴 두 컷 판은 차례를 뒤집어도 몰랐다(r3 GA5)');
  assert.match(안나눈[0][1], /SHOT으로 나뉘지 않아 컷마다 기법을 가를 수 없다 — 샷 머리 아래를 SHOT 1 \(0–2 s\) · SHOT 2 \(2–4 s\)로 나눠/);
  const 뒤집은번호 = 두('TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 2 (2-4 s) CAMERA: pull back.\nSHOT 1 (0-2 s) CAMERA: slow push in.');
  assert.equal(뒤집은번호[0][0], '걸림');
  assert.match(뒤집은번호[0][1], /SHOT 번호가 1부터 차례가 아니다\(SHOT 2 · SHOT 1\)/, 'SHOT 번호를 뒤집으면 나온 차례로 잘못 짝짓는다(Fable 설계 검토)');
  assert.deepEqual(두('CAMERA: slow push in, then pull back.', { 이어찍기: true }).map(x => x[0]), ['주의'], '한 번에 이어 찍는 판(뒤 컷이 이어찍기: true)은 나눌 수 없어 주의 — 차례는 검수자가 본다');
  assert.deepEqual(두('ONE SINGLE CONTINUOUS SHOT.\nSHOT 1 (0-4 s) CAMERA: slow push in, then pull back.', { 이어찍기: true }).map(x => x[0]), ['주의'], '이어 찍는 판의 SHOT 하나는 번호 걸림이 아니다(r5 GA1)');
  assert.deepEqual(두('CAMERA: slow push in, then pull back.').map(x => x[0]), ['걸림'], '이어찍기가 없으면 걸림');
  // 11-25 GPT 다시 검수(camera-moves-20261125-r4) — 낱자 t · 빠진 SHOT 1 · 글의 continuous
  assert.deepEqual(두('ONE SINGLE CONTINUOUS SHOT.\nCAMERA: slow push in, then pull back.').map(x => x[0]), ['걸림'], '글의 continuous는 믿지 않는다 — 컷표 이어찍기 칸만 본다(r4 GA6)');
  assert.deepEqual(두('TWO SHOTS, ONE hard cut at 2 s, with continuous room tone.\nCAMERA: Pull back first. Then slow push in.').map(x => x[0]), ['걸림'], '실내음의 continuous로 이어찍기 예외가 켜지지 않는다(r4 GA6)');
  const 둘다고정 = 부르기(대조, { seq: { 편: 새날, detail: [컷('C1', ['고정']), 컷('C2', ['고정'])] }, 글: [[['C1', 'C2'], 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 2 (2-4 s) CAMERA: Locked-off.', '영상']] })[0];
  assert.equal(둘다고정[0][0], '걸림');
  assert.match(둘다고정[0][1], /SHOT 번호가 1부터 차례가 아니다\(SHOT 2\)/, 'SHOT 1이 빠진 판은 기법이 같아도 걸린다(r4 GA2)');
  assert.deepEqual(꼴('휩 팬', 'CAMERA: Whip pan right at t=1.5 s.'), [], '「t=1.5 s」의 t는 부정어가 아니다(r4 GA1)');
  assert.equal(꼴('휩 팬', "CAMERA: Don't whip pan. Keep it locked-off.").length, 1, '줄임 부정은 not으로 푼다');
  assert.equal(꼴('휩 팬', 'CAMERA: The camera cannot whip pan here.').length, 1, 'cannot도 부정이다');
});

test('사전 — 기법 일흔부터, 이름 · 낱말이 겹치지 않고, 편집이 아닌 기법은 낱말이 있으며, 컨셉 아홉이 사전의 이름만 쓰고 「자주」가 「최소」를 채운다', () => {
  const 사전 = JSON.parse(읽기(사전경로));
  const 이름 = 사전.기법.map(x => x.이름);
  assert.ok(이름.length >= 70, `기법 ${이름.length}가지`);
  assert.equal(new Set(이름).size, 이름.length, '이름이 겹친다');
  const 낱말 = 사전.기법.flatMap(x => x.낱말);
  assert.equal(new Set(낱말).size, 낱말.length, '두 기법이 같은 낱말을 쓴다');
  for (const x of 사전.기법) {
    assert.ok(['움직임', '장비', '렌즈', '구도', '시간', '이음'].includes(x.갈래), `${x.이름}: 갈래 ${x.갈래}`);
    assert.ok(['그림', '영상', '편집'].includes(x.만드는곳), `${x.이름}: 만드는곳 ${x.만드는곳}`);
    assert.equal(x.낱말.length > 0, x.만드는곳 !== '편집', `${x.이름}: 지시문에서 만드는 기법만 낱말이 있다`);
    assert.ok(x.낱말.every(w => w === w.toLowerCase() && /^[\x20-\x7e]+$/.test(w)), `${x.이름}: 낱말은 소문자 영어`);
    assert.ok(x.화면 && x.쓰는자리, `${x.이름}: 화면 · 쓰는자리`);
  }
  assert.deepEqual(Object.keys(사전.컨셉).sort(), ['B급', '감동', '멜로', '뮤직', '비주얼', '스릴러', '스펙터클', '코믹', '홍보'].sort());
  for (const [c, 줄] of Object.entries(사전.컨셉)) {
    for (const k of ['자주', '한방', '피함']) for (const n of 줄[k]) assert.ok(이름.includes(n), `${c}.${k}: 「${n}」이 사전에 없다`);
    assert.ok(Number.isInteger(줄.최소) && 줄.자주.filter(n => n !== '고정').length >= 줄.최소, `${c}: 자주가 최소를 못 채운다`);
    assert.ok(!줄.자주.some(n => 줄.피함.includes(n)), `${c}: 자주와 피함이 겹친다`);
    assert.ok(줄.요령, `${c}: 요령`);
    if (줄.피함.length) assert.ok(줄.피함까닭, `${c}: 피함까닭`);
  }
  // 컷표 틀의 예시 기법은 사전의 이름이고, 카메라 글(다가감 · 따라감 · 물러남)과 같은 움직임이다
  const 틀 = JSON.parse(읽기('docs/마케팅/제작양식/영상양식/컷표_틀.json'));
  for (const d of 틀.detail) for (const n of d.앵글.기법) assert.ok(이름.includes(n), `컷표 틀 ${d.cut}: 「${n}」`);
  assert.match(틀.읽는법, /카메라기법\.json/);
  const 틀글 = 읽기('docs/마케팅/제작양식/영상양식/지시문_틀.md');
  assert.match(틀글, /`앵글\.기법`은 \[기법 사전\]\(카메라기법\.json\)의 `낱말`로 쓴다 — 그 `찾는곳`에 부정어 없는 한 문장으로/);
  assert.match(틀글, /`SHOT 1 \(0–2 s\)` · `SHOT 2 \(2–4 s\)`/, '틀이 두 샷 판을 SHOT으로 나누게 가르친다(r3 GA5)');
  for (const 손 of ['.claude/agents/video-prompts.md', '.claude/agents/video-image-prompts.md']) assert.match(읽기(손), /부정어 없는 한 문장/, `${손}: 기법 낱말을 쓰는 꼴`);
  assert.match(읽기('.claude/agents/video-prompts.md'), /SHOT 1 · SHOT 2/, '쓰는 손도 두 컷 판을 나눈다');
});

test('기법검사 — 사전을 못 읽으면 기법을 적은 편에만 주의 한 줄', { skip: 건너뜀 }, () => {
  const 없는 = path.join(os.tmpdir(), 'synk-없는-사전-20261125.json');
  assert.deepEqual(부르기(검사, { 사전: 없는, seq: { detail: [컷('C1')] } }), []);
  const 줄 = 부르기(검사, { 사전: 없는, seq: { detail: [컷('C1', ['휩 팬'])] } });
  assert.equal(줄.length, 1);
  assert.match(줄[0][2], /카메라 기법 사전을 못 읽어 「앵글\.기법」을 보지 못했다/);
});

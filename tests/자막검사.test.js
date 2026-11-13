// 자막 · 화면 글 검사(tools/자막검사.py) — 렌더 앞에서 잡아야 하는 것들.
// 왜 있나: 11-13 서울로 애니에서 자막을 세 번 렌더(11분씩)한 뒤에야 ① 강조가 조사 · 어미 앞에서 끊긴 것(맥락 없는 시험관 둘이 따로 「노래방 자막」이라 했다)
//   ② 가장 긴 줄이 한쪽으로 쏠린 것 ③ 실제 화면(640×120 LED)에서 몇 화소인지 재지 않은 것을 알았다. 모두 글자 그림 단계에서 걸린다.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 도구 = path.join(__dirname, '..', 'tools', '자막검사.py');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'print(1)'], { encoding: 'utf8' }).status === 0;

const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-자막검사-'));
function 돌리기(글들, 더 = []) {
  const dir = 임시();
  const p = path.join(dir, '자막글.json');
  fs.writeFileSync(p, JSON.stringify(Array.isArray(글들) ? 글들 : 글들), 'utf8');
  const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, p, '--json', ...더], { encoding: 'utf8' });
  assert.ok(r.stdout, r.stderr);
  return { ...JSON.parse(r.stdout), 끝코드: r.status, dir };
}
const 등급 = (항목, 화면) => 항목.filter((x) => x.화면 === String(화면)).map((x) => x.등급);

test('강조는 어절 경계에서만 — 조사 · 어미 앞에서 끊기면 걸림, 통째로 묶으면 통과(점검표 61)', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-13 서울로 실제 자막 — 왼쪽이 고치기 전, 오른쪽이 고친 판
  const 나쁨 = ['이번엔, <i>누구나 걷는 길</i>로', '이 다리는 다 <i>기억</i>하고 있을 거야', '그해 <i>크리스마스</i>에', '너도 이 <i>이야기</i>를 들려주렴', '<i>스무 살</i>이었어'];
  const 좋음 = ['이번엔, <i>누구나 걷는 길로</i>', '이 다리는 다 <i>기억하고</i> 있을 거야', '그해 <i>크리스마스에</i>', '너도 이 <i>이야기를</i> 들려주렴', '얘야, <i>옛날이야기</i> 하나 해 줄까?'];
  const a = 돌리기(나쁨);
  assert.equal(a.걸림, 5, JSON.stringify(a.항목));
  assert.ok(a.항목.filter((x) => x.등급 === '걸림').every((x) => x.글.includes('어절 중간')), JSON.stringify(a.항목));
  assert.equal(a.끝코드, 1);
  const b = 돌리기(좋음);
  assert.equal(b.걸림, 0, JSON.stringify(b.항목));
  // 끝코드는 보지 않는다 — 이 시험은 어절 경계만 맡고, 갈래 · 무늬 「확인」은 아래 규칙 시험이 본다
});

test('강조가 어절 중간에서 시작해도 걸림 · 본문에 없는 강조도 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const r = 돌리기(['할머니<i>도 그해</i>', '<i>없는말</i>이 여기 있다'.replace('<i>없는말</i>', '여기')]);
  assert.deepEqual(등급(r.항목, 1), ['걸림']);
  assert.ok(r.항목[0].글.includes('어절 중간에서 시작'));
});

test('강조를 고르는 규칙 — 장면 글이 말한 연도를 또 칠하면 걸림, 갈래가 섞이면 확인, 한 갈래면 통과(점검표 61)', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-14 유호님 「흰색으로 통일」 — 어절 경계를 맞춘 뒤에도 맥락 없는 맹검 둘이 따로 「노래방 자막처럼 읽힌다」고 했다.
  //   까닭은 끊김이 아니라 칠하는 규칙이었다: 때(1970년 여름에) · 사람(할머니도) · 주제(누구나 걷는 길로)를 한 색으로 섞었고,
  //   연도 셋은 장면 안 현수막이 이미 다른 색으로 말하고 있었다. 아홉 줄 모두에 색이 있어 강조가 무늬가 됐다.
  const 장면 = ['--장면글', '1970 처음 열린 찻길;2015 차가 멈춘 날'];
  const 섞임 = 돌리기(['<i>1970년 여름에,</i> 이 다리가 처음 생겼지', '<i>할머니도</i> 그해', '이번엔, <i>누구나 걷는 길로</i>'], 장면);
  assert.ok(섞임.항목.some((x) => x.등급 === '걸림' && x.글.includes('또 칠했다')), '장면 글이 말한 연도를 자막에서 또 칠하면 걸림');
  assert.ok(섞임.항목.some((x) => x.등급 === '확인' && x.글.includes('갈래가 섞였다')), '때 · 사람 · 주제를 섞으면 확인');
  // 한 갈래(주제)로만 칠하고 장면 글과 겹치지 않으면 깨끗하다
  const 한갈래 = 돌리기(['얘야, <i>옛날이야기</i> 하나 해 줄까?', '이번엔, <i>누구나 걷는 길로</i>', '너도 이 <i>이야기를</i> 들려주렴', '그해 크리스마스에', '밤이 가면, 다리에는 또 아침이 온단다', '그러면 또 누군가'], 장면);
  assert.equal(한갈래.걸림, 0, JSON.stringify(한갈래.항목));
  assert.ok(!한갈래.항목.some((x) => x.글.includes('갈래가 섞였다')), '한 갈래면 갈래 지적 없음');
  assert.ok(!한갈래.항목.some((x) => x.글.includes('무늬가')), '절반 아래로 칠하면 무늬 지적 없음');
  // 줄마다 칠하면 강조가 아니라 무늬
  const 무늬 = 돌리기(['<i>하나</i>인 줄', '<i>둘</i>인 줄', '<i>셋</i>인 줄']);
  assert.ok(무늬.항목.some((x) => x.글.includes('무늬가')), '절반 넘게 칠하면 확인');
});

test('마침표는 확인 · 겹친 빈칸은 걸림(점검표 6)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const r = 돌리기(['저 바닷가.', '두  칸 빈칸', '깨끗한 줄']);
  assert.deepEqual(등급(r.항목, 1), ['확인']);
  assert.deepEqual(등급(r.항목, 2), ['걸림']);
  assert.deepEqual(등급(r.항목, 3), []);
});

test('장면 안 글(현수막)과 자막이 같은 연도를 함께 말하면 확인', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-13 두 시험관이 따로 짚었다 — 「2015 차가 멈춘 날」 현수막 아래 「2015년 겨울…」 자막이 6초 동안 함께 떴다
  const r = 돌리기(['2015년 겨울, 다리는 마지막 차를 보냈어', '텅 빈 다리에, 눈이 소복소복 내렸지'], ['--장면글', '2015 차가 멈춘 날;2017 걷는 길이 된 날']);
  assert.deepEqual(등급(r.항목, 1), ['확인']);
  assert.deepEqual(등급(r.항목, 2), []);
  assert.equal(r.끝코드, 2, '걸림 없이 확인만 있으면 끝코드 2 — 통과로 치지 않는다');
});

test('규정 글자 크기(pt)에 못 미치면 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 서울로미디어캔버스 공고: 「영상에 글자 사용 시 서울서체 70pt 이상」 → 70pt = 93.3px
  assert.equal(돌리기(['한 줄'], ['--크기', '90', '--pt', '70']).걸림, 1);
  assert.equal(돌리기(['한 줄'], ['--크기', '108', '--pt', '70']).걸림, 0);
});

test('구운 PNG — 글자가 가운데가 아니면 걸림, 실제 화면 화소에서 너무 작아도 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 그림 = path.join(dir, '글자');
  const 만들기 = `
import sys
from PIL import Image, ImageDraw
root = sys.argv[1]
import os
for name, (x0, x1), h in [("S01_1", (900, 1100), 108), ("S02_1", (1400, 1900), 108), ("S03_1", (960, 1040), 20)]:
    d = os.path.join(root, name); os.makedirs(d, exist_ok=True)
    for i in (1, 2, 3):
        im = Image.new("RGBA", (2000, 550), (0, 0, 0, 0))
        ImageDraw.Draw(im).rectangle((x0, 300, x1, 300 + h), fill=(255, 243, 220, 255))
        im.save(os.path.join(d, f"{i:04d}.png"))
`;
  const mk = spawnSync('python', ['-I', '-X', 'utf8', '-c', 만들기, 그림], { encoding: 'utf8' });
  assert.equal(mk.status, 0, mk.stderr);
  const p = path.join(dir, '자막글.json');
  fs.writeFileSync(p, JSON.stringify({ 줄: { 1: { 화면: ['가운데'] }, 2: { 화면: ['오른쪽으로 쏠린 줄'] }, 3: { 화면: ['아주 작은 글'] } } }), 'utf8');
  const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, p, '--json', '--그림', 그림, '--화면', '640x120'], { encoding: 'utf8' });
  const o = JSON.parse(r.stdout);
  assert.deepEqual(등급(o.항목, '1_1'), [], '가운데 있는 글자는 통과');
  assert.ok(등급(o.항목, '2_1').includes('걸림'), '한쪽으로 쏠린 글자는 걸림');
  assert.ok(o.항목.find((x) => x.화면 === '2_1').글.includes('가운데'));
  assert.ok(등급(o.항목, '3_1').includes('걸림'), '실제 화면에서 너무 작은 글자는 걸림');
  assert.ok(o.항목.find((x) => x.화면 === '3_1').글.includes('640×120'));
});

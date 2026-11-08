'use strict';
// 컷 연속성 검사(tools/컷연속성검사.py · 2026-11-09) — 「문 앞」 지적 9건이 다시 새지 않는지 작은 가짜 자료로 본다.
//   지시문 낱말(쪽지 떨림 · 문이 저 혼자 · 실내 눈 + Astra · 아르곤 검수 재현 문장) · 표(소품 상태 · 사건 네 박 · 소리 사건 간격) · 지도 대조(정지 그림 · 짝짓기 · 미리 붙은 쪽지)
//   · 소품 고요 · 큰 물건 고요(천천히 미는 문) · 소리 봉우리(실제 시작 시각) · 점 시트(사람 확인).
//   파이썬(numpy · PIL · cv2 · scipy) · ffmpeg가 없으면 그림 · 영상 시험은 건너뛴다(표 · 지시문 시험은 파이썬만 있으면 돈다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '컷연속성검사.py');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' }).status === 0;
const 그림라이브러리 = 파이썬 && spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import numpy, PIL, cv2, scipy'], { encoding: 'utf8' }).status === 0;
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cut-'));
const 쓰기 = (dir, name, text) => { const p = path.join(dir, name); fs.writeFileSync(p, text, 'utf8'); return p; };
function 돌리기(args) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, ...args, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  assert.ok(r.status !== null, `파이썬이 죽음: ${r.stderr}`);
  let 항목들 = [];
  try { 항목들 = JSON.parse(r.stdout); } catch (e) { assert.fail(`JSON이 아님(코드 ${r.status}): ${r.stdout.slice(0, 400)} ${r.stderr.slice(0, 400)}`); }
  return { 코드: r.status, 항목들, stderr: r.stderr };
}
const 등급 = (항목들, 항목, 컷) => 항목들.filter((x) => x.항목 === 항목 && (컷 === undefined || x.컷 === 컷)).map((x) => x.등급);
// 가짜 그림 · 영상을 파이썬(PIL)으로 만든다 — 어두운 문(80) 위에 밝은 네모(노랑 · 연파랑)
const 그림스크립트 = String.raw`
import json, sys, subprocess, random
from pathlib import Path
from PIL import Image, ImageDraw
out = Path(sys.argv[1]); W, H = 400, 700
지도 = {"src": "", "size": [W, H], "영역": [0.2, 0.1, 0.8, 0.7], "따뜻한색": "노랑",
        "notes": [{"id": "Y1", "color": "노랑", "box": [150, 200, 190, 240], "cx": 170, "cy": 220},
                  {"id": "Y2", "color": "노랑", "box": [230, 300, 270, 340], "cx": 250, "cy": 320},
                  {"id": "B1", "color": "파랑", "box": [150, 380, 190, 420], "cx": 170, "cy": 400}],
        "상태": {"1": ["Y1"], "2": ["Y1", "Y2"], "3": ["Y1", "Y2", "B1"]}}
(out / "지도.json").write_text(json.dumps(지도, ensure_ascii=False), encoding="utf-8")
# 짝짓기 지도 — 같은 줄에 한 변(40) 간격으로 붙은 두 자리(Astra 재현: 기대 100 · 140, 찾음 78 · 120 — 차례 짝짓기는 둘째를 못 맞춘다)
지도2 = {"src": "", "size": [W, H], "영역": [0.1, 0.1, 0.9, 0.7], "따뜻한색": "노랑",
         "notes": [{"id": "Y1", "color": "노랑", "box": [80, 200, 120, 240], "cx": 100, "cy": 220}, {"id": "Y2", "color": "노랑", "box": [120, 200, 160, 240], "cx": 140, "cy": 220}],
         "상태": {"둘": ["Y1", "Y2"]}}
(out / "지도2.json").write_text(json.dumps(지도2, ensure_ascii=False), encoding="utf-8")
def 바탕(bg=80):
    im = Image.new("RGB", (W, H), (bg, bg, bg)); d = ImageDraw.Draw(im)
    d.rectangle((int(W*0.2), int(H*0.1), int(W*0.8), int(H*0.7)), fill=(bg - 10, bg - 10, bg - 10)); return im
def 장(notes, dx=0, bg=80):
    im = 바탕(bg); d = ImageDraw.Draw(im)
    for n in 지도["notes"]:
        if n["id"] not in notes: continue
        x0, y0, x1, y1 = n["box"]; col = (235, 215, 90) if n["color"] == "노랑" else (170, 205, 235)
        d.rectangle((x0 + dx, y0, x1 + dx, y1), fill=col)
    return im
장(["Y1", "Y2"]).save(out / "A1.png")                 # 상태 2 그대로
장(["Y1", "Y2"], dx=-60).save(out / "A2.png")          # 두 장이 1.5변 왼쪽으로(면 안에 남은 채) — 어긋남
장(["Y1", "Y2", "B1"]).save(out / "A5.png")            # 상태 2인데 상태 3의 B1이 벌써 붙어 있다 — 미리 붙은 쪽지(걸림)
im = 바탕(); d = ImageDraw.Draw(im)                     # 짝짓기: 24px 네모 둘을 78 · 120에(지도2 기대 100 · 140)
for cx in (78, 120): d.rectangle((cx - 12, 208, cx + 12, 232), fill=(235, 215, 90))
im.save(out / "A9.png")
im = 바탕(); d = ImageDraw.Draw(im); random.seed(3)     # 실내 점: 어두운 문 위에 흰 점 30개
for _ in range(30):
    x, y = random.randint(90, 310), random.randint(80, 480); d.ellipse((x, y, x + 3, y + 3), fill=(250, 250, 250))
im.save(out / "A6.png")
if len(sys.argv) > 2 and sys.argv[2] == "영상":
    for name, tremble, door, slow in (("clip-A3", True, False, False), ("clip-A4", False, False, False), ("clip-A6", False, True, False), ("clip-A7", False, False, True)):
        f = out / name; f.mkdir(exist_ok=True)
        for i in range(40):
            dx = (4 if i % 2 else -4) if tremble else 0
            im = 장(["Y1", "Y2"], dx=dx)
            if door:   # 큰 물건: 왼쪽 큰 어두운 판이 장마다 3px씩 옆으로 밀린다
                ImageDraw.Draw(im).rectangle((20 + 3 * i, int(H*0.1), 70 + 3 * i, int(H*0.7)), fill=(30, 30, 30))
            if slow:   # 천천히 — 장마다 1px(10fps 표본으로는 2px): 이웃 장 차이는 작아도 2초 뒤 40px 밀려 있다
                ImageDraw.Draw(im).rectangle((20 + i, int(H*0.1), 70 + i, int(H*0.7)), fill=(30, 30, 30))
            im.save(f / f"{i:03d}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "20", "-i", str(f / "%03d.png"),
                        "-f", "lavfi", "-i", "aevalsrc=if(between(t\\,1.0\\,1.06)\\,0.8*sin(2*PI*1000*t)\\,0):s=16000:d=2",
                        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(out / f"{name}.mp4")], check=True)
print("ok")
`;

const 옛쪽지 = 'ACTION: at about 0.3 s she turns away from the door toward the stairs; at about 1.2 s the sticky notes on the door tremble twice in a row — two small knocks from inside — and she stops mid-step.';
const 옛펄럭 = 'ACTION: from about 5.0 s a gentle draft from inside the open door makes all the sticky notes on the door flutter, corners lifting and settling a few at a time.';
const 옛문 = 'ACTION: at about 5.0 s the door drifts open a few more degrees on its own, slowly, the sticky notes staying flat and fixed on it.';
const 옛눈 = 'ACTION: her head is bowed over the note; at about 2.3 s she pulls her scarf up over her chin and starts to turn away. Snowflakes on her shoulders melt.';
const 새노크 = 'ACTION: at about 1.2 s two small knocks sound from inside the door and she stops mid-step (nothing on the door moves — the door and every sticky note stay perfectly still); at about 2.3 s she steps to the door and knocks twice with her knuckles, softly.';
const 새문 = 'ACTION: at about 3.0 s the grey-socked feet wiggle; the door stays exactly where it is the whole time — it never swings, opens or closes — and the sticky notes stay flat and fixed on it.';
const 새눈 = 'ACTION: at about 1.3 s she pats the note twice with two fingers. Indoors: the air is clear and still, nothing falls or drifts anywhere in the stairwell.';
const 손문 = 'ACTION: at about 0.4 s the door opens outward just a hand\'s width; a hand in a heather-grey sweatshirt sleeve slowly comes out and lifts the bag off the lever handle; at about 2.6 s the door closes gently.';
const 손잡이 = 'ACTION: at about 0.4 s the handle turns down from inside before she can hang it — she stops, surprised; at about 1.0 s the door begins to swing outward a hand\'s width and she lowers the bag a little.';
const 그림자 = 'ACTION: at about 0.6 s the middle of the warm band of light on the floor under the door darkens as a shadow moves across it; a person inside has sat down.';

test('지시문 낱말 — 옛 「문 앞」 지시문 넷(쪽지 떨림 · 바람에 펄럭 · 문이 저 혼자 · 실내 눈)은 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 파일 = [['A11_old.txt', 옛쪽지], ['A15_old.txt', 옛펄럭], ['A15_door.txt', 옛문], ['A5_old.txt', 옛눈]].map(([n, t]) => 쓰기(dir, n, t));
  const r = 돌리기(['지시문', ...파일, '--실내', 'A5_old']);
  assert.equal(r.코드, 1);
  assert.deepEqual(등급(r.항목들, '지시문', 'A11_old'), ['걸림']);
  assert.ok(r.항목들.find((x) => x.컷 === 'A11_old').글.includes('물건이 소리 · 바람에 반응'));
  assert.ok(등급(r.항목들, '지시문', 'A15_old').includes('걸림'));
  assert.ok(r.항목들.find((x) => x.컷 === 'A15_door' && x.등급 === '걸림').글.includes('저 혼자'));
  assert.ok(r.항목들.find((x) => x.컷 === 'A5_old' && x.등급 === '걸림').글.includes('Snowflakes'));
});

test('지시문 낱말 — 고친 지시문(물건은 정지 · 문은 그대로 · nothing falls)과 손이 움직이는 문 · 그림자 문장은 걸림 아님', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 파일 = [['A11.txt', 새노크], ['A15.txt', 새문], ['A5.txt', 새눈], ['A3.txt', 손문], ['A14.txt', 손잡이], ['A7.txt', 그림자]].map(([n, t]) => 쓰기(dir, n, t));
  const r = 돌리기(['지시문', ...파일, '--실내', 'A11,A15,A5,A7']);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 === '걸림')));
  assert.ok(!등급(r.항목들, '지시문', 'A5').includes('주의'), '「nothing falls or drifts」 줄이 있으면 실내 주의도 없다');
  assert.ok(등급(r.항목들, '지시문', 'A11').includes('주의'), '실내인데 「nothing falls」 줄이 없으면 주의로 알린다');
  assert.ok(!등급(r.항목들, '지시문', 'A3').includes('주의'), '실내 낱말이 없는 지시문은 실내 주의를 묻지 않는다');
});

// 11-09 Astra · 아르곤 검수가 짚은 오탐 · 미탐 문장 — 같은 등급 묶음이 나와야 한다(걸림 · 주의 · 없음)
const 재현 = [
  ['the door never opens on its own.', null, []],
  ['the door opens without warning.', null, ['걸림']],
  ['the sticky notes still tremble twice.', null, ['걸림']],
  ['she waits by the elevator; the sticky notes tremble twice.', null, ['걸림', '주의']],
  ['she raises her hand to knock; the door closes slowly.', null, ['걸림']],
  ['a breeze makes the leaves sway; footsteps approach on the path.', null, ['주의']],
  ['SOUND: distant footsteps. The door closes gently.', null, []],
  ['SOUND: Low room tone. At 2.0 s the door shuts softly.', null, []],
  ['she watches snow falling outside through the window.', true, ['주의']],
  ['inside the elevator the steel doors slide shut from both sides.', null, ['주의']],
  ['she gets off the bus; the apartment door opens on its own.', null, ['걸림', '주의']],
  ['at 0.5 s her hand pats the note on the wall; at 3.0 s the door swings shut.', null, ['걸림']],
  ['she pulls the drawer; at 3.0 s the door swings shut.', null, ['걸림']],
  ['she turns the brass knob. At 1.0 s the door swings open slowly.', null, []],
  ['at 5.0 s the door with the sticky notes drifts open a few degrees.', null, ['걸림']],
  ['at 1.2 s a sharp knock is heard, shaking the sticky notes on the door.', null, ['걸림']],
  ['the sticky notes fixed to the door flutter in the draft.', null, ['걸림']],
  ['she holds the letter to her chest and her hands tremble slightly.', null, []],
  ['she pulls the envelope from her shaking hand.', null, []],
  ['in the hallway, she looks out the window at the snow falling outside.', true, ['주의']],
  ['she stops mid-step and snow falls around her in the stairwell.', true, ['걸림', '주의']],
  ['Indoors: snowflakes drift down past her face.', null, ['걸림', '주의']],
  ['the living-room curtains sway in the draft.', null, ['걸림', '주의']],
];

test('지시문 낱말 — Astra · 아르곤 재현 문장 23개가 뜻대로 갈린다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 파일 = 재현.map(([t], i) => 쓰기(dir, `c${String(i).padStart(2, '0')}.txt`, t.startsWith('SOUND:') ? t : `ACTION: ${t}`));
  const 실내 = 재현.map(([, 실내], i) => (실내 === true ? `c${String(i).padStart(2, '0')}` : null)).filter(Boolean);
  const r = 돌리기(['지시문', ...파일, '--실내', 실내.join(',')]);
  const 틀림 = [];
  재현.forEach(([t, , want], i) => {
    const got = [...new Set(등급(r.항목들, '지시문', `c${String(i).padStart(2, '0')}`).filter((g) => g !== '통과'))].sort();
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) 틀림.push(`${t} → ${got.join('·') || '없음'} (원함 ${want.join('·') || '없음'})`);
  });
  assert.deepEqual(틀림, []);
});

test('지시문 낱말 — 한국어: 「쪽지가 두 번 떨림」은 걸림, 「면접 또 떨어짐」 · 따옴표 안 「문 열게」는 아님', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const seq = { detail: [{ cut: 'A11', t: 0, dur: 1, keep: '두 번 노크 · 쪽지가 두 번 떨림' }, { cut: 'A5i', t: 1, dur: 1, line: '쪽지 「나 면접 또 떨어짐ㅋㅋ」' }, { cut: 'A12', t: 2, dur: 1, line: '파랑 「내일은 내가 문 열게」' }] };
  const r = 돌리기([쓰기(dir, '컷순서.json', JSON.stringify(seq)), '--항목', '지시문']);
  assert.deepEqual(등급(r.항목들, '지시문', 'A11'), ['주의']);
  assert.deepEqual(등급(r.항목들, '지시문', 'A5i'), []);
  assert.deepEqual(등급(r.항목들, '지시문', 'A12'), []);
});

test('표 — 소품이 동작 컷 없이 바뀜 · 사건 네 박 빠짐 · 반응이 소리보다 먼저면 걸림, 다 채우면 0', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 나쁜 = {
    detail: [
      { cut: 'A1', t: 0, dur: 2, 소품: { 봉투: '없음' } },
      { cut: 'A1h', t: 2, dur: 2, 소품: { 봉투: '화면밖' } },
      { cut: 'A1', t: 4, dur: 2, 소품: { 봉투: '문고리에' } },
      { cut: 'A11c', t: 6, dur: 2 },
    ],
    소리사건: [{ 이름: '노크', t: 6.4, 반응: 'A11c' }],
    사건: [{ 이름: '첫 쪽지', 넓게: 'A1', 감정: '', 행동: 'A1h', 결과: 'A1' }],
  };
  const r = 돌리기([쓰기(dir, '나쁜.json', JSON.stringify(나쁜))]);
  assert.equal(r.코드, 1);
  assert.ok(r.항목들.some((x) => x.항목 === '소품' && x.컷 === 'A11c' && x.등급 === '걸림' && x.글.includes('칸이 비었다')), '소품 칸 빈 컷');
  assert.ok(r.항목들.some((x) => x.항목 === '소품' && x.컷 === 'A1' && x.등급 === '걸림' && x.글.includes('없음 → 문고리에')), '동작 컷 없는 변화');
  assert.ok(r.항목들.some((x) => x.항목 === '사건' && x.등급 === '걸림' && x.글.includes('감정')), '감정 컷 빠짐');
  assert.ok(r.항목들.some((x) => x.항목 === '소리' && x.등급 === '걸림' && x.글.includes('먼저')), '반응이 소리보다 먼저');
  const 좋은 = {
    detail: [
      { cut: 'A1', t: 0, dur: 2, 소품: { 봉투: '없음' }, 실내: true },
      { cut: 'A1c', t: 2, dur: 1, 소품: { 봉투: '화면밖' }, 실내: true },
      { cut: 'A1h', t: 3, dur: 1, 소품: { 봉투: '화면밖' }, 실내: true },
      { cut: 'A1', t: 4, dur: 2, 소품: { 봉투: '문고리에' }, 소품행동: { 봉투: '봉지를 문고리에 건다' }, 실내: true },
      { cut: 'A11', t: 6, dur: 1.6, 소품: { 봉투: '없음' }, 시간건너뜀: true, 실내: true },
      { cut: 'A11c', t: 7.6, dur: 2, 소품: { 봉투: '화면밖' }, 실내: true },
      { cut: 'A11', t: 9.6, dur: 2, 소품: { 봉투: '없음' }, 실내: true },
    ],
    소리사건: [{ 이름: '노크', t: 6.8, 반응: 'A11c' }, { 이름: '정확히 0.6', t: 1.7, 반응t: 2.3 }],
    사건: [{ 이름: '첫 쪽지', 넓게: 'A1', 감정: 'A1c', 행동: 'A1h', 결과: 'A1#2' }, { 이름: '노크', 넓게: 'A11', 감정: 'A11c', 행동: 'A11#2', 결과: 'A11#2' }],
  };
  const r2 = 돌리기([쓰기(dir, '좋은.json', JSON.stringify(좋은))]);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들.filter((x) => x.등급 !== '통과')));
  assert.ok(r2.항목들.some((x) => x.항목 === '소리' && x.등급 === '통과' && x.글.includes('0.80초')));
  assert.ok(r2.항목들.some((x) => x.항목 === '소리' && x.컷 === '정확히 0.6' && x.등급 === '통과'), '0.6초 정확히는 소수 오차로 걸리지 않는다');
});

test('표 — 한 동작은 한 변화만 설명한다(건다 → 사라짐은 걸림), 화면밖 컷에 적은 시간 건너뜀도 받는다, 결과가 행동보다 앞서면 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 재사용 = { detail: [
    { cut: 'A', t: 0, dur: 1, 소품: { 봉투: '없음' } },
    { cut: 'B', t: 1, dur: 1, 소품: { 봉투: '문고리에' }, 소품행동: { 봉투: '건다' } },
    { cut: 'C', t: 2, dur: 1, 소품: { 봉투: '없음' } },
  ], 사건: [], 소리사건: [] };
  const r = 돌리기([쓰기(dir, '재사용.json', JSON.stringify(재사용))]);
  assert.ok(r.항목들.some((x) => x.항목 === '소품' && x.컷 === 'C' && x.등급 === '걸림'), JSON.stringify(r.항목들));
  const 건너뜀 = { detail: [
    { cut: 'A', t: 0, dur: 1, 소품: { 봉투: '문고리에' } },
    { cut: 'B', t: 1, dur: 1, 소품: { 봉투: '화면밖' }, 시간건너뜀: true },
    { cut: 'C', t: 2, dur: 1, 소품: { 봉투: '없음' } },
  ], 사건: [], 소리사건: [] };
  const r2 = 돌리기([쓰기(dir, '건너뜀.json', JSON.stringify(건너뜀))]);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들.filter((x) => x.등급 !== '통과')));
  const 역전 = { detail: [{ cut: 'R', t: 0, dur: 1 }, { cut: 'W', t: 1, dur: 1 }, { cut: 'E', t: 2, dur: 1 }, { cut: 'A', t: 3, dur: 1 }],
    사건: [{ 이름: '뒤집힘', 넓게: 'W', 감정: 'E', 행동: 'A', 결과: 'R' }], 소리사건: [], 소품: [] };
  const r3 = 돌리기([쓰기(dir, '역전.json', JSON.stringify(역전))]);
  assert.ok(r3.항목들.some((x) => x.항목 === '사건' && x.등급 === '걸림' && x.글.includes('결과')), JSON.stringify(r3.항목들));
});

test('표 — 소리 사건 · 사건 · 소품 표가 하나도 없으면 「확인」으로 남고(코드 2), 빈 목록으로 밝히면 통과', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const r = 돌리기([쓰기(dir, '빈.json', JSON.stringify({ detail: [{ cut: 'A1', t: 0, dur: 2 }] }))]);
  assert.equal(r.코드, 2);
  assert.deepEqual([...new Set(r.항목들.map((x) => x.항목))].sort(), ['사건', '소리', '소품']);
  const r2 = 돌리기([쓰기(dir, '밝힘.json', JSON.stringify({ detail: [{ cut: 'A1', t: 0, dur: 2 }], 소품: [], 사건: [], 소리사건: [] }))]);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들));
});

test('지도 대조(정지 그림) — 자리 그대로면 통과, 1.5변 밀리면 걸림, 아직 없어야 할 자리에 붙은 쪽지는 걸림, 붙은 두 자리는 한 쌍씩 맞춘다', { skip: !그림라이브러리 && '파이썬 그림 라이브러리 없음' }, () => {
  const dir = 임시();
  const g = spawnSync('python', ['-I', '-X', 'utf8', '-c', 그림스크립트, dir], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stderr);
  const seq = { detail: [{ cut: 'A1', t: 0, dur: 2, 상태: '2' }, { cut: 'A2', t: 2, dur: 2, 상태: '2' }, { cut: 'A5', t: 4, dur: 2, 상태: '2' }], 지도: '지도.json' };
  const r = 돌리기([쓰기(dir, '컷순서.json', JSON.stringify(seq)), '--그림', dir, '--항목', '지도', '--출력', path.join(dir, '검사')]);
  assert.deepEqual(등급(r.항목들, '지도', 'A1'), ['통과']);
  assert.deepEqual(등급(r.항목들, '지도', 'A2'), ['걸림']);
  assert.deepEqual(등급(r.항목들, '지도', 'A5'), ['걸림'], JSON.stringify(r.항목들.filter((x) => x.컷 === 'A5')));
  assert.ok(r.항목들.find((x) => x.컷 === 'A5').글.includes('미리 붙은'));
  assert.ok(fs.existsSync(path.join(dir, '검사', '지도_A2.jpg')), '시트를 남긴다');
  assert.ok(fs.existsSync(path.join(dir, '검사', '결과.json')));
  const seq2 = { detail: [{ cut: 'A9', t: 0, dur: 2, 상태: '둘' }], 지도: '지도2.json' };
  const r2 = 돌리기([쓰기(dir, '컷순서2.json', JSON.stringify(seq2)), '--그림', dir, '--항목', '지도', '--출력', path.join(dir, '검사2')]);
  assert.deepEqual(등급(r2.항목들, '지도', 'A9'), ['통과'], JSON.stringify(r2.항목들));
});

test('점 시트 — 실내 그림에 점 후보가 있으면 사람이 볼 「확인」(코드 2)으로 남는다', { skip: !그림라이브러리 && '파이썬 그림 라이브러리 없음' }, () => {
  const dir = 임시();
  const g = spawnSync('python', ['-I', '-X', 'utf8', '-c', 그림스크립트, dir], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stderr);
  const seq = { detail: [{ cut: 'A6', t: 0, dur: 2, 실내: true }], 소품: [], 사건: [], 소리사건: [] };
  const r = 돌리기([쓰기(dir, '컷순서.json', JSON.stringify(seq)), '--그림', dir, '--항목', '점', '--출력', path.join(dir, '검사')]);
  assert.equal(r.코드, 2, JSON.stringify(r.항목들));
  assert.ok(r.항목들.some((x) => x.항목 === '점' && x.컷 === '시트' && x.등급 === '확인'));
  assert.ok(fs.existsSync(path.join(dir, '검사', '점_A6.jpg')));
});

test('고요(가짜 영상) — 떨리는 쪽지는 걸림, 가만한 쪽지는 통과, 밀리는 큰 판 · 천천히 미는 판(고정 영역)은 걸림, 소리 봉우리와 실제 시작 시각', { skip: !(그림라이브러리 && ffmpeg) && '파이썬 그림 라이브러리 · ffmpeg 없음' }, () => {
  const dir = 임시();
  const g = spawnSync('python', ['-I', '-X', 'utf8', '-c', 그림스크립트, dir, '영상'], { encoding: 'utf8' });
  assert.equal(g.status, 0, g.stderr);
  const seq = {
    detail: [
      { cut: 'A3', t: 0, dur: 2, in: 0, out: 2, 상태: '2', 고요: true },
      { cut: 'A4', t: 2, dur: 2, in: 0, out: 2, 상태: '2', 고요: true },
      { cut: 'A6', t: 4, dur: 2, in: 0, out: 2, 고정: [0.02, 0.1, 0.45, 0.7] },
      { cut: 'A7', t: 6, dur: 2, in: 0, out: 2, 고정: [0.02, 0.1, 0.45, 0.7] },
    ],
    지도: '지도.json',
  };
  const r = 돌리기([쓰기(dir, '컷순서.json', JSON.stringify(seq)), '--받음', dir, '--앞', 'clip-', '--항목', '고요,지도', '--출력', path.join(dir, '검사')]);
  assert.deepEqual(등급(r.항목들, '고요', 'A3'), ['걸림'], JSON.stringify(r.항목들.filter((x) => x.컷 === 'A3')));
  assert.deepEqual(등급(r.항목들, '고요', 'A4'), ['통과']);
  assert.deepEqual(등급(r.항목들, '고요', 'A6'), ['걸림']);
  assert.deepEqual(등급(r.항목들, '고요', 'A7'), ['걸림'], `천천히 미는 판: ${JSON.stringify(r.항목들.filter((x) => x.컷 === 'A7'))}`);
  assert.deepEqual(등급(r.항목들, '지도', 'A4'), ['통과'], '받은 판 프레임도 지도와 대조한다');
  // 소리: 1.0초의 삑 소리는 봉우리로 잡히고(시작 시각까지), 0.4초에는 소리가 없다. 표에 0.7초로 적어도 실제 시작 1.0초로 다시 재 0.5초 간격은 걸림
  const seq2 = { detail: [{ cut: 'A4', t: 0, dur: 2 }, { cut: 'A4', t: 2, dur: 2 }],
    소리사건: [{ 이름: '삑', t: 1.0, 반응t: 1.8 }, { 이름: '없는 소리', t: 0.4, 반응t: 1.2 }, { 이름: '표가 틀림', t: 0.7, 반응t: 1.5 }] };
  const r2 = 돌리기([쓰기(dir, '컷순서2.json', JSON.stringify(seq2)), '--영상', path.join(dir, 'clip-A4.mp4'), '--항목', '소리', '--출력', path.join(dir, '검사2')]);
  const 삑 = r2.항목들.filter((x) => x.컷 === '삑');
  assert.ok(삑.some((x) => x.등급 === '통과' && x.글.includes('봉우리') && x.글.includes('시작')), JSON.stringify(삑));
  assert.ok(r2.항목들.some((x) => x.컷 === '없는 소리' && x.등급 === '걸림' && x.글.includes('안 튄다')), JSON.stringify(r2.항목들));
  assert.ok(r2.항목들.some((x) => x.컷 === '표가 틀림' && x.등급 === '걸림' && x.글.includes('실제 소리로')), JSON.stringify(r2.항목들.filter((x) => x.컷 === '표가 틀림')));
});

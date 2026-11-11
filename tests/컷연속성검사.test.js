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
const { spawn, spawnSync } = require('node:child_process');

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

// ───────── 2026-11-10: 컷표 「틀 2」 표 검사 · 사람 연기 낱말(꾸러미점검에서 옮김) · 빛 문장 대조 · 이미지 지시문 대조 · 내기 도구의 굽기 전 검사 ─────────
// 왜: 되풀이된 지적(사람이 굳음 · 컷마다 빛이 바뀜 · 같은 구도를 잇달아 붙임 · 끝에 제품이 안 보임 · 글자가 기본 글꼴)을 콘티 표의 빈 칸과 내기 도구의 관문으로 막는다.
// 이 시험들은 파이썬만 있으면 돈다(그림 라이브러리 · ffmpeg · 계정 · 네트워크 없음).
const 픽스처 = path.join(__dirname, 'fixtures', '컷연속성검사');
const 틀경로 = path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '영상양식', '컷표_틀.json');
const 틀읽기 = () => JSON.parse(fs.readFileSync(틀경로, 'utf8'));
// 예시 틀을 고쳐(고침) 임시 폴더에 쓰고 돌린다 — 결과 파일도 임시 폴더로(docs 옆에 검사_연속성 폴더를 만들지 않게)
function 틀돌리기(고침, 더 = [], dir = 임시()) {
  const seq = 틀읽기();
  if (고침) 고침(seq);
  return { ...돌리기([쓰기(dir, '컷표.json', JSON.stringify(seq)), '--출력', path.join(dir, '검사'), ...더]), dir, seq };
}
const 걸림글 = (r, 항목 = '틀') => r.항목들.filter((x) => x.항목 === 항목 && x.등급 === '걸림').map((x) => `${x.컷}: ${x.글}`);
const 컷 = (seq, 이름) => seq.detail.find((d) => d.cut === 이름);

test('틀 2 — 예시 컷표(docs/…/영상양식/컷표_틀.json)는 걸림 · 확인 · 주의 없이 통과한다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const r = 돌리기([틀경로, '--출력', path.join(dir, '검사')]);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과')));
  assert.deepEqual(r.항목들.filter((x) => ['걸림', '확인', '주의', '알림'].includes(x.등급)), []);
  assert.ok(r.항목들.some((x) => x.항목 === '틀' && x.등급 === '통과' && x.글.includes('틀 2')), '틀 2 검사가 기본으로 돈다');
});

// [이름, 고침, 나와야 할 걸림] — 한 가지만 깨뜨렸으니 틀 걸림은 모두 그 까닭이어야 한다(다른 칸이 덩달아 걸리지 않는다)
const 깨뜨림 = [
  ['T1 장면의 빛 칸이 비었다', (s) => { s.장면.부엌밤.빛 = ''; }, /장면 「부엌밤」의 빛 칸이 비었다.*\(51\)/],
  ['T1 컷이 표에 없는 장면을 쓴다', (s) => { 컷(s, 'C2').장면 = '거실밤'; }, /C2: 장면 「거실밤」이 장면 표에 없다.*\(51\)/],
  ['T2 인물 표에 없는 이름', (s) => { 컷(s, 'C1').인물 = ['수아', '민호']; }, /C1: 인물 「민호」가 인물 표에 없다.*12 · G11/],
  ['T2 인물 칸 자체가 없다', (s) => { delete 컷(s, 'C4').인물; }, /C4: 「인물」 칸이 없다.*\[\]/],
  ['T2 인물 기준 그림이 비었다', (s) => { s.인물.수아.기준그림 = ' '; }, /인물 「수아」의 기준그림 칸이 비었다/],
  ['T3 사람 컷에 연기 박자가 하나', (s) => { 컷(s, 'C2').연기 = [{ t: 0.8, 무엇: '고개가 문 쪽으로 돈다' }]; }, /C2: 사람 컷에 연기 박자.*\(26\)/],
  ['T3 초가 없는 박자는 박자가 아니다', (s) => { 컷(s, 'C3').연기 = [{ 무엇: '그릇을 잡는다' }, { t: '곧', 무엇: '당겨 받는다' }]; }, /C3: 사람 컷에 연기 박자.*0개/],
  ['T3 연기에 「가만히 서 있다」', (s) => { 컷(s, 'C1').연기[1].무엇 = '냄비 앞에 가만히 서 있다'; }, /C1: 연기 박자에 사람을 멈추는 낱말 「가만히 서」.*\(26\)/],
  ['T3 연기에 「멈춘 채로 바라본다」', (s) => { 컷(s, 'C2').연기[1].무엇 = '문 쪽을 멈춘 채로 바라본다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「멈춘 채로 바라」/],
  ['T3 연기에 「무표정」', (s) => { 컷(s, 'C3').연기[0].무엇 = '무표정으로 그릇을 본다'; }, /C3: 연기 박자에 사람을 멈추는 낱말 「무표정」/],
  ['T3 연기에 영어 정지 낱말',(s) => { 컷(s, 'C2').연기[0].무엇 = 'she holds the pose, expressionless'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「expressionless · holds the pose」/],
  ['T3 연기에 「그대로 서 있다」', (s) => { 컷(s, 'C1').연기[1].무엇 = '냄비 앞에 그대로 서 있다'; }, /C1: 연기 박자에 사람을 멈추는 낱말 「그대로 서 있」/],
  ['T3 연기에 「자세를 유지한다」', (s) => { 컷(s, 'C1').연기[1].무엇 = '같은 자세를 유지한다'; }, /C1: 연기 박자에 사람을 멈추는 낱말 「자세를 유지」/],
  ['T3 연기에 「꼼짝 않는다」', (s) => { 컷(s, 'C2').연기[1].무엇 = '꼼짝 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「꼼짝 않는」/],
  ['T3 연기에 「멈춰 있다」', (s) => { 컷(s, 'C2').연기[0].무엇 = '문 앞에 멈춰 있다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「멈춰 있」/],
  ['T3 연기에 「표정 없이 바라본다」', (s) => { 컷(s, 'C3').연기[1].무엇 = '표정 없이 바라본다'; }, /C3: 연기 박자에 사람을 멈추는 낱말 「표정 없이」/],
  ['T3 연기에 「포즈를 유지한다」', (s) => { 컷(s, 'C1').연기[1].무엇 = '포즈를 유지한다'; }, /C1: 연기 박자에 사람을 멈추는 낱말 「포즈를 유지」/],
  ['T3 연기에 「미동이 없다」', (s) => { 컷(s, 'C2').연기[1].무엇 = '미동이 없다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「미동이 없」/],
  ['T3 연기에 「그 자리에 서 있다」', (s) => { 컷(s, 'C1').연기[2].무엇 = '그 자리에 서 있다'; }, /C1: 연기 박자에 사람을 멈추는 낱말 「그 자리에 서 있」/],
  ['T3 연기에 「수아는 움직이지 않는다」(인물 이름이 주어)', (s) => { 컷(s, 'C2').연기[0].무엇 = '수아는 움직이지 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「움직이지 않는다」/],
  ['T3 연기에 「학생이 움직이지 않는다」(목록에 없는 사람 낱말이 주어 — 아는 물건일 때만 넘긴다)', (s) => { 컷(s, 'C2').연기[0].무엇 = '학생이 움직이지 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「움직이지 않는다」/],
  ['T3 연기에 「수아와 컵은 움직이지 않는다」(사람과 나란히 놓인 물건)', (s) => { 컷(s, 'C2').연기[0].무엇 = '수아와 컵은 움직이지 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「움직이지 않는다」/],
  ['T3 연기에 「문이 닫힌 뒤에도 움직이지 않는다」(물건은 딴 절의 주어다 — 다섯째 검수)', (s) => { 컷(s, 'C2').연기[0].무엇 = '문이 닫힌 뒤에도 움직이지 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「움직이지 않는다」/],
  ['T3 연기에 「컵과 수아 모두 움직이지 않는다」', (s) => { 컷(s, 'C2').연기[0].무엇 = '컵과 수아 모두 움직이지 않는다'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「움직이지 않는다」/],
  ['T3 연기에 「the kettle steams, perfectly still」(사람 컷의 연기 칸 — 주어 없는 정지 말은 사람이다)', (s) => { 컷(s, 'C2').연기[1].무엇 = 'the kettle steams, perfectly still'; }, /C2: 연기 박자에 사람을 멈추는 낱말 「perfectly still」/],
  ['T4 구도 칸이 비었다', (s) => { 컷(s, 'C3').구도 = ''; }, /C3: 「구도」 칸이 비었다.*\(50\)/],
  ['T4 이웃 컷이 같은 구도(띄어쓰기 · 가운뎃점만 다름)', (s) => { 컷(s, 'C2').구도 = '허리 위·옆  45도'; }, /C2: 같은 구도 컷을 잇달아 붙임\(50\).*앞 컷 C1/],
  ['T5 시간대가 바뀌는데 시간건너뜀이 없다', (s) => { s.장면.부엌낮 = { ...s.장면.부엌밤, 시간대: '낮' }; 컷(s, 'C4').장면 = '부엌낮'; delete 컷(s, 'C4').시간건너뜀; }, /C4: 컷 사이 낮 · 밤이 바뀜\(51\).*「밤」 → 이 컷 「낮」/],
  ['T14 인물 설정이 비었다', (s) => { s.인물.수아.설정 = { 믿음: '', 버릇: ' ' }; }, /인물 수아: 인물 「수아」의 「설정」 칸이 비었다.*순서 1-1/],
  ['T14 인물 설정 칸이 없다', (s) => { delete s.인물.옆집.설정; }, /인물 옆집: 인물 「옆집」의 「설정」 칸이 비었다/],
  ['T15 사건에 목적이 없다', (s) => { delete s.사건[0].목적; }, /사건 「혼자 끓이던 라면이 둘이 된다」의 목적 칸이 비었다.*심사 4-3/],
  ['T15 사건에 감정 설계가 없다', (s) => { s.사건[0].감정설계 = [{ 감정: '', 장치: 'C2' }]; }, /사건 「혼자 끓이던 라면이 둘이 된다」의 감정설계 칸이 비었다/],
  ['T7 띠에 전이 없다', (s) => { s.seq[2][2] = '승'; }, /seq의 띠에 전.*\(14\)/],
  ['T8 끝 컷이 마지막 컷이 아니다', (s) => { s.끝.컷 = 'C3'; }, /「끝\.컷」\(C3\)이 seq의 마지막 컷\(C4\)이 아니다.*2 · 45 · 53/],
  ['T8 끝에 제품이 안 보인다', (s) => { s.끝.제품보임 = false; }, /끝에 제품\(브랜드\)이 안 보인다.*2 · 45 · 53/],
  ['T8 가장 센 그림이 비었다', (s) => { s.끝.가장센그림 = ''; }, /「끝\.가장센그림」 칸이 비었다/],
  ['T8 로고 멈춤이 2초보다 짧다', (s) => { s.끝.로고멈춤초 = 1.2; }, /로고 멈춤 1\.2초 — 2초 이상/],
  ['T8 끝 표가 없다', (s) => { delete s.끝; }, /「끝」 표가 없다/],
  ['T9 끝로고를 글꼴로 쳤다', (s) => { s.글자[0].만드는법 = 'SUIT로 침'; }, /\(끝로고\) 만드는법 「SUIT로 침」.*글꼴로 치지 않는다\(24 · 46 · 55\)/],
  ['T9 장면 속 글자를 화면 글꼴로', (s) => { s.글자.push({ 글: '오늘도 수고했어', 종류: '장면속', 어디: 'C4 냉장고 쪽지', 만드는법: '편집에서 화면 글꼴로 얹음' }); }, /\(장면속\).*글꼴로 치지 않는다/],
  ['T9 종류가 목록에 없다', (s) => { s.글자[0].종류 = '제목'; }, /종류\(「제목」\)가 말자막 · 강조 · 이름 · 끝로고 · 장면속 · 정보 가운데 하나가 아니다/],
  ['T9 만드는법이 비었다', (s) => { s.글자[0].만드는법 = ''; }, /「만드는법」 칸이 비었다/],
  ['T9 글자 칸 자체가 없다', (s) => { delete s.글자; }, /「글자」 칸이 없다.*\[\]/],
  ['T10 한문장이 비었다', (s) => { s.한문장 = '  '; }, /「한문장」 칸이 비었다.*\(3\)/],
  ['T10 이기는것이 없다', (s) => { delete s.이기는것; }, /「이기는것」 칸이 비었다.*\(3\)/],
  ['T11 누구 목소리인지 없다', (s) => { s.소리.목소리 = ''; }, /「소리\.목소리」 칸이 비었다.*\(52\)/],
  ['T12 그림 엔진이 둘', (s) => { s.엔진.그림 = '나노바나나 + GPT'; }, /「엔진\.그림」에 둘 이상.*「나노바나나 \+ GPT」.*\(G11\)/],
  ['T12 영상 모델이 비었다', (s) => { s.엔진.영상 = ''; }, /「엔진\.영상」 칸이 비었다.*\(G11\)/],
  // T16 빛 이름(11-11 — 팁 장부 47행 · 점검표 60)
  ['T16 사람이 나오는 장면의 빛이름 칸이 없다', (s) => { delete s.장면.부엌밤.빛이름; }, /장면 「부엌밤」의 「빛이름」 칸이 비었다.*\(60\)/],
  ['T16 표에 없는 빛 이름(오타)', (s) => { s.장면.부엌밤.빛이름 = ['Rembrant']; }, /빛 이름 「Rembrant」이 빛 이름 표에 없다\(「Rembrandt[^」]*」\?\).*\(60\)/],
  ['T16 Day for night은 지시문에 쓰지 않는다', (s) => { s.장면.부엌밤.빛이름 = ['Day for night']; }, /빛 이름 「Day for night」은 지시문에 쓰지 않는다 — Moonlight · Blue hour/],
  ['T16 옆빛 이름인데 빛 문장이 앞에서 비춘다', (s) => { s.장면.부엌밤.빛이름 = ['Soft light']; s.장면.부엌밤.빛 = 'Night. A large soft light falls on the table from the front; the wall behind is one stop darker.'; }, /빛 문장에 앞에서 고르게 비추는 말 「from the front」.*\(60\)/],
  ['T16 「evenly lit」도 앞에서 고르게 비추는 말이다', (s) => { s.장면.부엌밤.빛 = 'Night. The kitchen is evenly lit by the lamp above the stove at the left edge of the frame.'; }, /앞에서 고르게 비추는 말 「evenly lit」.*\(60\)/],
  ['T16 옆빛 이름인데 키 빛의 쪽이 없다', (s) => { s.장면.부엌밤.빛이름 = ['Rembrandt']; s.장면.부엌밤.빛 = 'Night. One warm lamp is the only light source; shadows fall off softly.'; }, /빛 이름 「Rembrandt」은 키 빛의 쪽이 있어야 한다.*\(60\)/],
  ['T16 사람 없는 컷도 쓰는 장면의 빛 줄에 사람 낱말', (s) => { s.장면.부엌밤.빛 += ' The side of her face toward the stove is lit.'; }, /빛 문장에 사람 낱말 「her」 — 사람 없는 컷\(C4\)도 이 줄을 그대로 쓴다.*\(60\)/],
  // T17 같은 시작 그림 · 같은 받은 영상을 두 컷이 쓴다(11-12 서울로 애니 「똑같은 장면이 반복되는부분이 몇장면 있어」 · 점검표 50)
  ['T17 두 컷이 같은 시작 그림을 쓴다', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; }, /C2: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 시작 그림 「정지\/C1\.png」.*같은판: "<까닭>"/],
  ['T17 역슬래시 · 앞의 ./ · 대소문자만 다른 이름도 같은 그림이다', (s) => { 컷(s, 'C3').시작그림 = '.\\정지\\c1.PNG'; }, /C3: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 시작 그림/],
  ['T17 두 컷이 같은 받은 영상(판)을 쓴다', (s) => { 컷(s, 'C2').판 = 'C1'; }, /C2: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 받은 영상\(판\) 「C1」/],
  ['T17 같은판에 true만 적으면 밝힌 것이 아니다(까닭을 글로)', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').같은판 = true; }, /C2: 같은 시작 그림을 두 컷이 쓴다\(50\).*같은판은 true가 아니라 까닭을 글로 적는다/],
  ['T17 셋이 같은 그림이면 밝히지 않은 둘째부터 걸린다', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').같은판 = '한 방을 둘로 자른 컷'; 컷(s, 'C4').시작그림 = '정지/C1.png'; }, /C4: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 시작 그림/],
  // T18 되풀이해 나오는 탈것 · 소품 한 줄(11-12 서울로 애니 「16초 18초 버스 색이 달라」 · 점검표 51)
  ['T18 소품 줄의 생김새가 비었다', (s) => { s.소품.빈그릇.생김새 = ''; }, /소품 빈그릇: 소품 「빈그릇」의 생김새 칸이 비었다.*\(51\)/],
  ['T18 소품 줄에 지시문에서 부르는 낱말이 없다', (s) => { delete s.소품.빈그릇.낱말; }, /소품 빈그릇: 소품 「빈그릇」의 낱말 칸이 비었다.*\(51\)/],
  ['T18 소품 줄에 색 · 기준 그림이 없다', (s) => { s.소품.빈그릇.색 = ' '; delete s.소품.빈그릇.기준그림; }, /소품 「빈그릇」의 색 · 기준그림 칸이 비었다/],
  ['T18 세 컷에 나오는 소품인데 표에 줄이 없다', (s) => { delete s.소품; 컷(s, 'C2').소품.빈그릇 = '문틈에'; }, /소품 빈그릇: 소품 「빈그릇」 — 3컷\(C2 · C3 · C4\)에 나오는데 맨 위 「소품」 표에 줄이 없다.*51\)/],
  ['T18 두 컷에 나오는 탈것인데 표에 줄이 없다', (s) => { for (const d of s.detail) d.소품.버스 = '화면밖'; 컷(s, 'C1').소품.버스 = '창밖을 지남'; 컷(s, 'C2').소품.버스 = '창밖을 지남'; }, /소품 버스: 탈것 「버스」 — 2컷\(C1 · C2\)에 나오는데 맨 위 「소품」 표에 줄이 없다.*51\)/],
];
const 버스줄 = { 종류: '탈것', 낱말: ['bus'], 색: 'cream and cobalt-blue', 생김새: 'One rounded 1970s Seoul city bus: a cream roof and window band over a cobalt-blue lower body.', 기준그림: 'ref/소품_버스.jpg' };
// 버스가 C1 · C2의 창밖을 지나는 표 — 줄: 맨 위 「소품」 표에 버스 줄을 넣는다
const 버스넣기 = (s, { 줄 = true } = {}) => {
  if (줄) s.소품.버스 = { ...버스줄 };
  for (const d of s.detail) d.소품.버스 = ['C1', 'C2'].includes(d.cut) ? '창밖을 지남' : '화면밖';
};
// 표의 줄을 그대로 옮긴 이미지 지시문(지시문 틀 순서) — 그 컷에 나오는 소품은 맨 위 「소품」 표의 생김새 문장을 PROPS에 그대로 쓴다. 더: 끝에 붙일 줄
const 표대로그림글 = (표, d, { 옷 = true, 소품 = true, 더 = [] } = {}) => [
  `SETTING: ${표.장면[d.장면].장소}`,
  `LIGHT: ${표.장면[d.장면].빛}`,
  ...d.인물.map((n) => `WHO: ${표.인물[n].묘사}${옷 ? ` ${표.인물[n].옷}` : ' A grey hoodie.'}`),
  `MOMENT: ${d.line}`,
  `FRAME: ${d.구도}`,
  ...(소품 ? Object.entries(표.소품 || {}).filter(([n]) => !['화면밖', '없음', undefined].includes((d.소품 || {})[n])).map(([, p]) => `PROPS: ${p.생김새}`) : []),
  ...더,
].join('\n');

// 표 사본이 수십 벌이라 여덟 벌씩 함께 돌린다(한 벌에 파이썬 한 번 — 차례로 돌리면 이 시험만 20초가 넘는다)
function 돌리기_함께(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('python', ['-I', '-X', 'utf8', 도구, ...args, '--json']);
    let out = ''; let err = '';
    p.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
    p.stderr.setEncoding('utf8').on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (코드) => {
      try { resolve({ 코드, 항목들: JSON.parse(out), stderr: err }); } catch (e) { reject(new Error(`JSON이 아님(코드 ${코드}): ${out.slice(0, 400)} ${err.slice(0, 400)}`)); }
    });
  });
}
async function 틀돌리기_여럿(고침들) {
  const out = [];
  for (let i = 0; i < 고침들.length; i += 8) {
    out.push(...await Promise.all(고침들.slice(i, i + 8).map((고침) => {
      const dir = 임시(); const seq = 틀읽기(); 고침(seq);
      return 돌리기_함께([쓰기(dir, '컷표.json', JSON.stringify(seq)), '--출력', path.join(dir, '검사')]);
    })));
  }
  return out;
}

test(`틀 2 — 한 칸씩 깨뜨린 ${깨뜨림.length}가지는 저마다 그 걸림이 난다(장면 · 인물 · 연기 · 구도 · 시간대 · 기승전결 · 끝 · 글자 · 볼 이유 · 소리 · 엔진 · 빛 이름 · 같은 시작 그림 · 소품 한 줄)`, { skip: !파이썬 && '파이썬 없음' }, async () => {
  const 틀림 = [];
  const 결과들 = await 틀돌리기_여럿(깨뜨림.map(([, 고침]) => 고침));
  깨뜨림.forEach(([이름, , 원함], i) => {
    const r = 결과들[i];
    const 걸림 = 걸림글(r);
    if (r.코드 !== 1 || !걸림.length || !걸림.every((g) => 원함.test(g))) 틀림.push(`${이름} → 코드 ${r.코드} · ${걸림.join(' / ') || '걸림 없음'}`);
    const 다른 = r.항목들.filter((x) => x.항목 !== '틀' && x.등급 === '걸림');
    if (다른.length) 틀림.push(`${이름} → 다른 항목이 걸림: ${JSON.stringify(다른)}`);
  });
  assert.deepEqual(틀림, []);
});

// 걸면 안 되는 꼴 — 오탐을 고정한다
const 지나감 = [
  ['이어 찍은 컷은 같은 구도여도 된다(이어찍기: true)', (s) => { 컷(s, 'C2').구도 = 컷(s, 'C1').구도; 컷(s, 'C2').이어찍기 = true; }],
  ['날이 바뀌는 컷은 시간대가 달라도 된다(시간건너뜀: true)', (s) => { s.장면.부엌낮 = { ...s.장면.부엌밤, 시간대: '낮' }; 컷(s, 'C4').장면 = '부엌낮'; 컷(s, 'C4').시간건너뜀 = true; }],
  ['제품 대신 브랜드가 보여도 된다(브랜드보임: true)', (s) => { s.끝.제품보임 = false; s.끝.브랜드보임 = true; }],
  ['「숨을 멈춘다」 · 「걸음을 멈추고」 · 「굳은 표정」 · 「가만히 서 있다가」는 동작이다', (s) => {
    컷(s, 'C1').연기 = [{ t: 0.4, 무엇: '숨을 멈춘다, 어깨가 올라간다' }, { t: 1.2, 무엇: '걸음을 멈추고 굳은 표정으로 고개를 든다' }, { t: 2.2, 무엇: '가만히 서 있다가 돌아선다' }];
  }],
  ['「그대로 서둘러 나간다」 · 「자세를 낮춘다」 · 「멈춰 있다가 고개를 든다」 · 「표정이 풀린다」는 동작이다', (s) => {
    컷(s, 'C1').연기 = [{ t: 0.4, 무엇: '냄비를 든 채 그대로 서둘러 나간다' }, { t: 1.2, 무엇: '자세를 낮춘다, 표정이 풀린다' }, { t: 2.2, 무엇: '멈춰 있다가 고개를 든다' }];
  }],
  ['물건이 주어인 「움직이지 않고」 · 풀리는 「무표정하던 얼굴」 · 「그 자리에 서 있다가」는 사람 정지가 아니다', (s) => {
    컷(s, 'C1').연기 = [{ t: 0.4, 무엇: '냄비는 움직이지 않고 수아가 젓가락을 든다' }, { t: 1.2, 무엇: '무표정하던 얼굴이 풀린다' }, { t: 2.2, 무엇: '그 자리에 서 있다가 식탁으로 간다' }];
  }],
  ['부사가 낀 물건 주어 「냄비는 조금도 움직이지 않는다」 · 「문은 전혀 움직임이 없다」 · 「컵들은 움직이지 않는다」도 사람 정지가 아니다', (s) => {
    컷(s, 'C1').연기 = [{ t: 0.4, 무엇: '냄비는 조금도 움직이지 않는다, 수아가 젓가락을 든다' }, { t: 1.2, 무엇: '문은 전혀 움직임이 없다, 수아가 고개를 든다' }, { t: 2.2, 무엇: '컵들은 움직이지 않는다, 수아가 식탁으로 간다' }];
  }],
  ['자리 말이 낀 물건 주어 「캔은 탁자 위에서 움직이지 않는다」도 사람 정지가 아니다', (s) => { 컷(s, 'C2').연기[1].무엇 = '캔은 탁자 위에서 움직이지 않는다, 수아가 눈을 깜빡인다'; }],
  ['물건을 멈추라는 말은 사람 정지가 아니다', (s) => { 컷(s, 'C2').연기[1].무엇 = '눈을 깜빡인다 — the door stays perfectly still'; }],
  ['글꼴을 쓰지 않는다는 말은 글꼴로 친 것이 아니다', (s) => { s.글자[0].만드는법 = '화면 글꼴 대신 직접 그린 로고타입 — SUIT 말고'; }],
  ['말자막 · 정보 글자는 글꼴로 쳐도 된다', (s) => { s.글자.push({ 글: '(대사 자막)', 종류: '말자막', 어디: '아래 가운데', 만드는법: '회사 글꼴 SUIT로 침' }); }],
  ['글자 없는 편은 []', (s) => { s.글자 = []; }],
  ['초를 글로 적은 박자(「0.8」)도 받는다', (s) => { 컷(s, 'C2').연기.forEach((b) => { b.t = String(b.t); }); }],
  ['띠에 번호를 붙여도 된다(승1 · 승2)', (s) => { s.seq[1][2] = '승1'; }],
  // 빛 이름(60) — 앞빛이 맞는 자리(만족 사례 S41 아이돌 · 유호님 얼굴 시안 B)는 막지 않는다
  ['앞빛 이름(High key)을 고른 장면은 앞에서 비추는 말을 써도 된다', (s) => { s.장면.부엌밤.빛이름 = ['High key', 'Rim light']; s.장면.부엌밤.빛 = 'Bright, airy high-key light from the front and above; a thin rim of light from behind separates every outline from the wall.'; }],
  ['Butterfly도 앞빛 이름이다(사람만 나오는 장면은 얼굴 낱말을 써도 된다)', (s) => { s.장면.부엌얼굴 = { ...s.장면.부엌밤, 빛이름: ['Butterfly'], 빛: 'Night. One soft key from the front and above her face casts a small butterfly-shaped shadow under the nose.' }; 컷(s, 'C2').장면 = '부엌얼굴'; }],
  ['빛 이름의 대소문자는 가리지 않고, 글 하나로 적어도 받는다', (s) => { s.장면.부엌밤.빛이름 = 'practical LIGHT'; }],
  ['사람 없는 컷만 쓰는 장면은 빛이름이 비어도 걸리지 않는다(주의)', (s) => { s.장면.식탁밤 = { ...s.장면.부엌밤 }; delete s.장면.식탁밤.빛이름; 컷(s, 'C4').장면 = '식탁밤'; }],
  ['비스듬한 앞옆 빛(from the front-left)은 앞빛이 아니고 키 빛의 쪽이다', (s) => { s.장면.부엌밤.빛이름 = ['Soft light']; s.장면.부엌밤.빛 = 'Night. A warm soft key from the front-left of the frame is the only light source; the far sides of everything fall into shadow.'; }],
  ['뒤 · 위에서 오는 빛도 키 빛의 쪽이다', (s) => { s.장면.부엌밤.빛이름 = ['Window light']; s.장면.부엌밤.빛 = 'Night. Cold light from the window behind the table is the only source; everything in front of it reads as a soft dark shape.'; }],
  // 같은 시작 그림(50) · 소품 한 줄(51) — 일부러 그런 것과 줄이 필요 없는 것은 막지 않는다
  ['한 판을 일부러 이어 쓰는 컷은 같은판에 까닭을 적으면 된다(같은 시작 그림 · 같은 판)', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').판 = 'C1'; 컷(s, 'C2').같은판 = '한 방을 둘로 자른 컷 — C1의 뒤 3초'; }],
  ['같은 컷 이름의 토막은 한 컷이라 같은 시작 그림이어도 된다', (s) => { s.detail.push({ ...컷(s, 'C1'), t: 15.0 }); }],
  ['시작그림을 목록으로 적어도 받는다(첫 장 · 끝 장)', (s) => { 컷(s, 'C1').시작그림 = ['정지/C1.png', '정지/C1_끝.png']; }],
  ['한 컷이 같은 그림을 두 번 적어도(첫 장 · 끝 장이 같은 그림) 제 자신과 겹치는 것은 아니다', (s) => { 컷(s, 'C1').시작그림 = ['정지/C1.png', './정지/C1.png']; 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').같은판 = '한 방을 둘로 자른 컷'; }],
  ['두 컷에만 나오는 소품은 맨 위 표에 줄이 없어도 된다', (s) => { delete s.소품; }],
  ['세 컷에 나오는 소품도 표에 줄이 있으면 된다', (s) => { 컷(s, 'C2').소품.빈그릇 = '문틈에'; }],
  ['두 컷에 나오는 탈것도 표에 줄이 있으면 된다', (s) => { 버스넣기(s); }],
  ['한 컷에만 나오는 탈것은 줄이 없어도 된다', (s) => { for (const d of s.detail) d.소품.버스 = d.cut === 'C1' ? '창밖을 지남' : '화면밖'; }],
];

test(`틀 2 — 걸면 안 되는 ${지나감.length}가지는 통과한다(이어찍기 · 시간건너뜀 · 브랜드보임 · 동작인 「멈춘다」 · 물건 정지 · 글꼴 부정문 · 같은판 · 줄이 필요 없는 소품)`, { skip: !파이썬 && '파이썬 없음' }, async () => {
  const 틀림 = [];
  const 결과들 = await 틀돌리기_여럿(지나감.map(([, 고침]) => 고침));
  지나감.forEach(([이름], i) => {
    const r = 결과들[i];
    if (r.코드 !== 0 || 걸림글(r).length) 틀림.push(`${이름} → 코드 ${r.코드} · ${JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과'))}`);
  });
  assert.deepEqual(틀림, []);
});

test('틀 2 — 주의는 알리기만 하고 끝 코드를 바꾸지 않는다(넘어옴 · 가까운사례 · 사람 없는 컷의 움직임 · 시간대 · 첫 말 · 정보 글자 자리 · 로고 없는 편)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const r = 틀돌리기((s) => {
    컷(s, 'C2').넘어옴 = '';
    s.가까운사례 = '';
    delete 컷(s, 'C4').움직임;
    s.장면.부엌밤.시간대 = '';
    s.소리.첫말초 = 4.5;
    s.글자.push({ 글: '15초', 종류: '정보', 어디: '오른쪽 위 구석', 만드는법: '자막 도구' });
    s.끝.로고멈춤초 = null;
  });
  assert.equal(r.코드, 0, JSON.stringify(걸림글(r)));
  const 주의 = r.항목들.filter((x) => x.항목 === '틀' && x.등급 === '주의').map((x) => `${x.컷}: ${x.글}`).join('\n');
  for (const 원함 of [/C2: 「넘어옴」 칸이 비었다.*\(29\)/, /가까운사례.*S번호/, /C4: 사람 없는 컷 — 무엇이 움직이나/, /장면 「부엌밤」의 「시간대」 칸이 비었다/, /첫 말이 4\.5초.*\(30\)/, /\(정보\)가 화면 구석.*\(40\)/, /로고 없는 편이면 「끝\.로고없음」/]) {
    assert.match(주의, 원함);
  }
  // 첫 말도 없고 초반을 끄는 것도 없으면 주의, 로고 없는 까닭을 적으면 그 주의는 없다
  const r2 = 틀돌리기((s) => { s.소리.초반을끄는것 = ''; s.끝.로고멈춤초 = null; s.끝.로고없음 = '공익 편 — 끝 화면은 문구만'; });
  assert.equal(r2.코드, 0);
  const 주의2 = r2.항목들.filter((x) => x.항목 === '틀' && x.등급 === '주의').map((x) => x.글);
  assert.equal(주의2.length, 1, JSON.stringify(주의2));
  assert.match(주의2[0], /초반을끄는것.*\(30\)/);
});

test('옛 틀 — 틀이 없는 「문 앞」 컷순서는 걸림 · 확인 수와 끝 코드가 전과 같고 알림 한 줄만 는다, --항목으로 틀을 빼면 그 줄도 없다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 문앞 = path.join(픽스처, '문앞_컷순서.json');
  const r = 돌리기([문앞, '--출력', path.join(dir, '검사')]);
  const 셈 = (항목들) => { const n = {}; for (const x of 항목들) n[`${x.항목} ${x.등급}`] = (n[`${x.항목} ${x.등급}`] || 0) + 1; return n; };
  // 2026-11-10 틀 2를 넣기 전에 같은 명령으로 잰 값: 13줄 · 끝 코드 0
  assert.equal(r.코드, 0);
  const 알림 = r.항목들.filter((x) => x.등급 === '알림');
  assert.deepEqual(알림.map((x) => x.글), ['옛 틀 — 장면 · 구도 · 연기 · 끝 칸 검사 없음(틀 2로 옮기면 돈다)']);
  assert.deepEqual(셈(r.항목들.filter((x) => x.등급 !== '알림')), { '소품 통과': 6, '소품 주의': 1, '사건 통과': 5, '소리 통과': 1 });
  assert.ok(!r.항목들.some((x) => x.항목 === '틀'), '옛 틀에서는 틀 검사가 돌지 않는다');
  const r2 = 돌리기([문앞, '--출력', path.join(dir, '검사2'), '--항목', '소품,사건,소리']);
  assert.deepEqual(r2.항목들.filter((x) => x.등급 === '알림'), []);
  assert.equal(r2.항목들.length, 13);
  // 틀 1이라고 적어도 옛 틀이다. 틀 2 표에서 --항목 틀만 고르면 틀 검사만 돈다
  const r3 = 돌리기([쓰기(dir, '틀1.json', JSON.stringify({ 틀: 1, detail: [{ cut: 'A1', t: 0, dur: 2 }], 소품: [], 사건: [], 소리사건: [] }))]);
  assert.equal(r3.코드, 0);
  assert.equal(r3.항목들.filter((x) => x.등급 === '알림').length, 1);
  const r4 = 틀돌리기((s) => { s.한문장 = ''; }, ['--항목', '틀']);
  assert.equal(r4.코드, 1);
  assert.deepEqual([...new Set(r4.항목들.map((x) => x.항목))], ['틀']);
});

// ───────── 지시문의 사람 연기 낱말(항목 「연기」) ─────────
const 빛문장 = 틀읽기().장면.부엌밤.빛;
const 좋은연기 = 'at about 0.4 s she sets the pot on the stove and lets go of the handle; at about 1.6 s her shoulders drop once as she breathes out; at about 2.6 s her eyes go from the pot to the empty table.';
// 지시문 틀(docs/…/영상양식/지시문_틀.md) 순서대로 쓴 판 — 박자 있는 연기 · 표의 빛 문장 · 실내 한 줄
const 지시문글 = ({ 첫줄 = '@이미지 1 is the exact first frame of this video.', 연기 = 좋은연기, 빛 = 빛문장, 실내줄 = true } = {}) => [
  첫줄,
  'ONE SINGLE CONTINUOUS SHOT.',
  'WHO: the same woman as in the start image, in the same hoodie.',
  `ACTION: ${연기}`,
  'CAMERA: a slow push-in of 4% from 0 s to 3.5 s.',
  `LOOK: ${빛} The light and colour stay exactly like this to the last frame. No new people, no new text.`,
  ...(실내줄 ? ['Indoors: the air is clear and still, nothing falls or drifts anywhere.'] : []),
  'SOUND: No sound.',
].join('\n');

test('지시문 — 사람 연기: 「stands still, expressionless」 · 박자 없는 사람 ACTION은 걸림, 물건의 「stay perfectly still」과 박자 있는 연기는 통과, 「start from it unchanged」 + 사람은 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 글 = {
    굳음: 'ACTION: at about 0.5 s she reaches the counter. She stands still, expressionless.',
    물건: 'ACTION: at about 1.2 s two small knocks sound from inside the door and she stops mid-step (nothing on the door moves — the door and every sticky note stay perfectly still).',
    박자없음: 'ACTION: she walks to the window and looks out, then smiles.',
    시작그대로: '@이미지 1 is the exact first frame of this video; start from it unchanged.\nACTION: at about 0.6 s she lifts her chin and her gaze goes to the window.',
    좋음: 지시문글(),
    이름줄: 'YUNA: the same young Korean woman, she holds the pose like a statue.\nACTION: at about 0.6 s Yuna blinks.',
    카메라: 'ACTION: at about 0.6 s steam rises from the two bowls.\nCAMERA: the camera holds still from first to last.',
    옛꼴: 'Extreme close-up from just above her eye level. She stands still and looks at the door.\nCamera: handheld with a faint drift.',
  };
  const 파일 = Object.entries(글).map(([이름, t]) => 쓰기(dir, `${이름}.txt`, t));
  const r = 돌리기(['지시문', ...파일]);
  assert.equal(r.코드, 1);
  const 연기 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름);
  assert.deepEqual(연기('굳음').map((x) => x.등급), ['걸림', '걸림']);
  assert.match(연기('굳음').map((x) => x.글).join(' '), /「expressionless」\(ACTION\).*「stands still」\(ACTION\).*점검표 26/);
  assert.deepEqual(연기('물건'), [], '물건이 주어인 정지는 사람 정지가 아니다');
  assert.deepEqual(연기('박자없음').map((x) => x.등급), ['걸림'], '꾸러미점검과 같은 등급(걸림)');
  assert.match(연기('박자없음')[0].글, /시간 박자 없음/);
  assert.deepEqual(연기('시작그대로').map((x) => x.등급), ['주의']);
  assert.match(연기('시작그대로')[0].글, /시작 자세 첫 줄로\(26 — 굽기 시트 지시문 틀/);
  assert.deepEqual(연기('좋음'), []);
  assert.deepEqual(등급(r.항목들, '지시문', '좋음'), ['통과'], '틀대로 쓴 지시문은 물건 · 실내 낱말도 걸리지 않는다');
  assert.deepEqual(연기('이름줄').map((x) => x.등급), ['걸림', '걸림'], '사람 이름 줄의 정지 낱말도 건다');
  assert.match(연기('이름줄').map((x) => x.글).join(' '), /\(YUNA\)/);
  assert.deepEqual(연기('카메라'), [], 'CAMERA 줄의 「holds still」은 사람이 아니다');
  // ACTION: 줄 없이 풀어 쓴 옛 꼴 — 본문의 정지 낱말을 걸고, 박자를 볼 칸이 없으니 그것도 걸림이다(이 도구의 --지시문은 내기 도구와 같은 등급이다 — 웹에서 손으로 내는 판의 관문)
  assert.deepEqual(연기('옛꼴').map((x) => x.등급), ['걸림', '걸림']);
  assert.match(연기('옛꼴').map((x) => x.글).join(' '), /「stands still」\(본문\).*ACTION: 칸이 없다/);
  // 걸림 없는 것만 돌리면 끝 코드 0(주의는 코드를 바꾸지 않는다) — 사람 낱말 줄은 물건 · 실내 줄(항목 지시문)과 섞이지 않는다
  const r2 = 돌리기(['지시문', 파일[1], 파일[3], 파일[4], 파일[6]]);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들.filter((x) => x.등급 === '걸림')));
});

test('지시문 — 사람 연기 판정은 꾸러미점검.py의 check()와 같다(같은 지시문 묶음을 두 판정에 넣어 견줌)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 묶음 = [
    'ACTION: at about 0.5 s she reaches the counter. She stands still, expressionless.',
    'ACTION: at about 1.2 s she stops mid-step (nothing on the door moves — the door and every sticky note stay perfectly still).',
    'ACTION: she walks to the window and looks out, then smiles.',
    지시문글(),
    'YUNA: the same young Korean woman, she holds the pose like a statue.\nACTION: at about 0.6 s Yuna blinks.',
    'ACTION: at about 0.6 s steam rises from the two bowls.\nCAMERA: the camera holds still from first to last.',
    'ACTION: at about 0.3 s she stands beside the door, perfectly still; from 1.0 s her eyes move.',
    'TWO SHOTS of the same hallway, ONE hard cut at 2.0 s.\nSHOT 1 (0-2 s) ACTION: he is frozen at the door, motionless.\nSHOT 2 (2-4 s) ACTION: at about 2.4 s he exhales.\nCAMERA: locked off.',
    'ACTION: the bottle stays perfectly still on the table while the light moves.',
    'ACTION: at about 0.4 s the model does not move her head, only her eyes; she never moves her feet.',
    'ACTION: her hair lifts in the breeze and she almost still smiles.\nLOOK: completely still air.',
    'SOUND: No sound.\nCAMERA: slow push-in.',
    'WHO: the same man, statue-like in the doorway.\nACTION: from 0.5 s he turns without moving his feet.',
    // 11-10 다시 짬 — 이름만 쓴 연기 · 한 줄 두 샷 · 풀어 쓴 옛 꼴 · 빠져 있던 정지 말도 두 길이 같은 판정을 낸다(꾸러미점검이 판정을 검사 도구에 맡긴다)
    'ACTION: Sua stands by the stove and looks at the pot.',
    'TWO SHOTS, ONE hard cut at 1.9 s.\nSHOT 1 (0–1.9 s) begins on @이미지 1. ACTION: Minjae holds the dog up like a handbag. CAMERA: almost still: from 0 s to 1.9 s it drifts 1%.\nSHOT 2 (1.9 s to the end) begins on @이미지 2. ACTION: he looks down. CAMERA: locked off, perfectly still.',
    'Extreme close-up. She stands still and looks at the door.\nCamera: handheld with a faint drift.',
    'ACTION: at about 0.4 s she turns. Everyone else in the frame keeps still with lips closed. She keeps her pose.',
  ];
  const g = spawnSync('python', ['-I', '-X', 'utf8', path.join(픽스처, '사람판정_견줌.py'), 쓰기(dir, '묶음.json', JSON.stringify(묶음)), dir], { encoding: 'utf8', maxBuffer: 1 << 24 });
  assert.equal(g.status, 0, g.stderr);
  const 줄 = JSON.parse(g.stdout);
  assert.equal(줄.length, 묶음.length);
  assert.deepEqual(줄.filter((x) => JSON.stringify(x.꾸러미점검) !== JSON.stringify(x.검사기)), [], '두 판정이 갈린 지시문');
  // 견줌이 빈 것끼리 같아서 통과한 게 아닌지 — 걸리는 것과 안 걸리는 것이 뜻대로 섞여 있다
  assert.deepEqual(줄[0].검사기, ['정지:expressionless(ACTION)', '정지:stands still(ACTION)']);
  assert.deepEqual(줄[1].검사기, []);
  assert.deepEqual(줄[2].검사기, ['박자없음']);
  assert.deepEqual(줄[3].검사기, []);
  assert.deepEqual(줄[6].검사기, ['정지:perfectly still(ACTION)']);
  assert.ok(줄[7].검사기.includes('정지:frozen(ACTION)') && 줄[7].검사기.includes('정지:motionless(ACTION)'));
  assert.deepEqual(줄[13].검사기, ['박자없음'], '이름만 쓴 연기');
  assert.deepEqual(줄[14].검사기, ['박자없음'], '한 줄 두 샷 — CAMERA 칸의 정지 말은 걸지 않고 샷 머리의 초는 박자가 아니다');
  assert.deepEqual(줄[15].검사기, ['정지:stands still(본문)'], '풀어 쓴 옛 꼴의 본문');
  assert.deepEqual(줄[16].검사기, ['정지:keeps her pose(ACTION)', '정지:keeps still(ACTION)']);
});

// ───────── 틀 2 + 꾸러미: 판을 컷에 이어 장면의 빛 문장을 견준다 ─────────
function 꾸러미만들기(dir, 판들, 이름 = '꾸러미') {
  const pack = path.join(dir, 이름);
  fs.mkdirSync(pack, { recursive: true });
  const 순서 = 판들.map((p, i) => {
    const 폴더 = `${String(i + 1).padStart(3, '0')}_${p.id}`;
    fs.mkdirSync(path.join(pack, 폴더));
    fs.writeFileSync(path.join(pack, 폴더, '지시문.txt'), p.글, 'utf8');
    return { 순서: i + 1, id: p.id, 폴더, 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [], ...(p.실내 === undefined ? {} : { 실내: p.실내 }) };
  });
  fs.writeFileSync(path.join(pack, '_순서.json'), JSON.stringify(순서), 'utf8');
  return pack;
}

test('틀 2 + --지시문 — 판(id = 컷 이름 · <편>-<컷> · 컷의 「판」 · 판 폴더 이름)의 지시문에 장면의 빛 문장이 그대로면 통과, 한 낱말 바꾸면 걸림, 컷표에 없는 판은 걸림, 장면이 실내면 실내로 본다(걸림은 판 id로 적는다)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 좋은 = 꾸러미만들기(dir, [
    { id: 'C1', 글: 지시문글() },
    { id: 'rm-C2', 글: 지시문글({ 빛: 빛문장.replace('; the window', ';\n   the window') }) },   // 줄바꿈 · 공백 여러 칸은 한 칸으로 견준다
    { id: 'A7', 글: 지시문글() },
  ], '좋은');
  const r = 틀돌리기((s) => { 컷(s, 'C3').판 = 'A7'; }, ['--지시문', 좋은], dir);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과')));
  assert.deepEqual(r.항목들.filter((x) => ['지시문', '연기'].includes(x.항목) && x.등급 !== '통과'), []);
  const 나쁜 = 꾸러미만들기(dir, [
    { id: 'C1', 글: 지시문글({ 빛: 빛문장.replace('warm', 'cold') }) },
    { id: 'rm-C2', 글: 지시문글() },
    { id: 'X9', 글: 지시문글() },
  ], '나쁜');
  const r2 = 틀돌리기(null, ['--지시문', 나쁜], dir);
  assert.equal(r2.코드, 1);
  assert.deepEqual(걸림글(r2, '지시문').length, 2, JSON.stringify(걸림글(r2, '지시문')));
  assert.match(걸림글(r2, '지시문').find((g) => g.startsWith('C1')), /^C1: \(빛\) 장면의 빛 문장이 표와 다르다 — 표의 빛 줄을 그대로 쓴다\(51\).*「부엌밤」/);
  assert.deepEqual(등급(r2.항목들, '지시문', 'rm-C2'), ['통과'], '<편>-<컷> 꼴 판 id는 그 컷으로 잇는다(결과는 판 id로 적는다 — 한 꾸러미에서 이름표가 겹치지 않게)');
  // 컷표(틀 2)에 없는 판은 걸림 — 연기 · 구도 · 빛 검사를 하나도 안 거친 판이다(11-10)
  const x9 = r2.항목들.filter((x) => x.항목 === '지시문' && x.컷 === 'X9' && x.등급 === '걸림');
  assert.equal(x9.length, 1);
  assert.match(x9[0].글, /\(컷표\) 컷표에 없는 판/);
  // 장면 표에만 실내: true를 적어도(컷의 실내 칸 없이) 그 컷의 판은 실내로 본다 — 눈이 떨어지면 걸림
  const 눈 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글({ 연기: 'at about 0.4 s she sets the pot down; at about 2.3 s snowflakes on her shoulders melt.', 실내줄: false }) }], '눈');
  const r3 = 틀돌리기((s) => { s.detail.forEach((d) => { delete d.실내; }); }, ['--지시문', 눈], dir);
  assert.equal(r3.코드, 1);
  assert.ok(걸림글(r3, '지시문').some((g) => /^C1: \(실내\) 실내 컷에 떨어지는/.test(g)), JSON.stringify(r3.항목들.filter((x) => x.항목 === '지시문')));
  // 옛 틀 표에서는 빛을 견주지 않는다(판이 컷표에 없어도 말하지 않는다)
  const r4 = 돌리기([쓰기(dir, '옛.json', JSON.stringify({ detail: [{ cut: 'A1', t: 0, dur: 2 }], 소품: [], 사건: [], 소리사건: [] })), '--지시문', 나쁜, '--출력', path.join(dir, '검사옛')]);
  assert.equal(r4.코드, 0, JSON.stringify(r4.항목들.filter((x) => x.등급 !== '통과')));
  assert.ok(!r4.항목들.some((x) => /\(빛\)/.test(x.글)));
  // 판 id가 컷 이름이 아니어도 판 폴더 이름(001_C1)이 컷 이름이면 그 컷으로 잇는다 — --지시문과 굽기전()이 같은 판정이다
  const 폴더판 = path.join(dir, '폴더판'); fs.mkdirSync(path.join(폴더판, '001_C1'), { recursive: true });
  fs.writeFileSync(path.join(폴더판, '001_C1', '지시문.txt'), 지시문글({ 빛: 빛문장.replace('warm', 'cold') }), 'utf8');
  fs.writeFileSync(path.join(폴더판, '_순서.json'), JSON.stringify([{ 순서: 1, id: 'X1', 폴더: '001_C1', 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [] }]), 'utf8');
  const r5 = 틀돌리기(null, ['--지시문', 폴더판], dir);
  assert.equal(걸림글(r5, '지시문').length, 1, JSON.stringify(걸림글(r5, '지시문')));
  assert.match(걸림글(r5, '지시문')[0], /^X1: \(빛\) 장면의 빛 문장이 표와 다르다/);
  const g5 = 굽기전('함수', 폴더판, '--컷표', path.join(dir, '컷표.json'));
  assert.equal(g5.status, 1, g5.stdout + g5.stderr);
  assert.match(g5.stdout, /✗ X1: \(빛\) 장면의 빛 문장이 표와 다르다/);
  assert.ok(!/컷표에 없는 판/.test(g5.stdout), g5.stdout);
});

// ───────── 빛 이름(11-11 — 팁 장부 47행 「조명효과 기억해」 · 점검표 60) ─────────
test('빛 이름 — 로맨스 10-31 옛 빛 줄(「a large soft light falls on his face from the front」)은 옆빛 이름과 함께면 걸리고, 앞빛 이름(High key · Butterfly)을 고른 장면에서는 지나간다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 옛 = 'A large soft light falls on his face from the front.';
  const 얼굴장면 = (이름들) => (s) => { s.장면.얼굴 = { ...s.장면.부엌밤, 빛: 옛, 빛이름: 이름들 }; for (const c of ['C1', 'C2', 'C3']) 컷(s, c).장면 = '얼굴'; };
  const r = 틀돌리기(얼굴장면(['Soft light']));
  assert.equal(r.코드, 1);
  const 걸림 = 걸림글(r);
  assert.ok(걸림.some((g) => /장면 얼굴: 장면 「얼굴」의 빛 문장에 앞에서 고르게 비추는 말 「from the front」.*\(60\)/.test(g)), JSON.stringify(걸림));
  assert.ok(걸림.some((g) => /빛 이름 「Soft light」은 키 빛의 쪽이 있어야 한다/.test(g)), JSON.stringify(걸림));
  assert.equal(걸림.length, 2, JSON.stringify(걸림));
  for (const 이름들 of [['High key', 'Rim light'], ['Butterfly'], ['butterfly', 'Rim light']]) {
    const r2 = 틀돌리기(얼굴장면(이름들));
    assert.equal(r2.코드, 0, `${이름들.join(' · ')}: ${JSON.stringify(r2.항목들.filter((x) => x.등급 !== '통과'))}`);
  }
  // Flat light는 지나가되 일부러 고른 컷인지 주의로 묻는다
  const r3 = 틀돌리기(얼굴장면(['Flat light']));
  assert.equal(r3.코드, 0);
  assert.ok(r3.항목들.some((x) => x.항목 === '틀' && x.등급 === '주의' && /Flat light다 — 일부러 고른 컷/.test(x.글)));
});

test('틀 2 + --지시문 — 빛 이름: 표의 빛 줄 밖에 앞에서 고르게 비추는 빛을 따로 적으면 걸림(--지시문 · 굽기전 같은 판정), 카메라 자리 「from the front」와 앞빛 이름 장면은 통과', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 판들 = [
    { id: 'C1', 글: 지시문글().replace('WHO:', 'LIGHTING: her face is evenly lit.\nWHO:') },
    { id: 'C2', 글: 지시문글().replace('WHO:', 'NOTE: a large soft light falls on her face from the front.\nWHO:') },
    { id: 'C3', 글: 지시문글().replace('3.5 s.', '3.5 s, the two of them seen from the front.') },   // 카메라 자리 — 빛 낱말과 한 절이 아니다
  ];
  const pack = 꾸러미만들기(dir, 판들, '앞빛');
  const r = 틀돌리기(null, ['--지시문', pack], dir);
  const 빛걸림 = 걸림글(r, '지시문').filter((g) => /\(빛\)/.test(g));
  assert.equal(빛걸림.length, 2, JSON.stringify(걸림글(r, '지시문')));
  assert.match(빛걸림.find((g) => g.startsWith('C1')), /^C1: \(빛\) 지시문에 앞에서 고르게 비추는 빛 「evenly lit」 — 장면 「부엌밤」의 빛 이름\(Practical light · Low key\)과 어긋난다\(60\)/);
  assert.match(빛걸림.find((g) => g.startsWith('C2')), /^C2: \(빛\) 지시문에 앞에서 고르게 비추는 빛 「light falls on her face from the front」/);
  assert.ok(!r.항목들.some((x) => x.컷 === 'C3' && /\(빛\)/.test(x.글)), JSON.stringify(r.항목들.filter((x) => x.컷 === 'C3')));
  const g = 굽기전('함수', pack, '--컷표', path.join(dir, '컷표.json'));
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ C1: \(빛\) 지시문에 앞에서 고르게 비추는 빛 「evenly lit」/);
  assert.match(g.stdout, /✗ C2: \(빛\) 지시문에 앞에서 고르게 비추는 빛/);
  assert.ok(!/✗ C3: \(빛\)/.test(g.stdout), g.stdout);
  // 실물 지시문 775판에서 나온 꼴(11-11): 다시 얹을 자리를 고르게 칠한 초록 판 · 비스듬한 앞옆 빛은 걸지 않고, 정면 빛(「a hard frontal light」)은 건다
  const 실물 = 꾸러미만들기(dir, [
    { id: 'C1', 글: 지시문글().replace('WHO:', 'PROPS: the phone screen is a flat, plain, evenly lit chroma-green panel that stays exactly as in the first frame.\nWHO:') },
    { id: 'C2', 글: 지시문글().replace('WHO:', 'NOTE: a warm light from the front-left catches her profile.\nWHO:') },
    { id: 'C3', 글: 지시문글().replace('WHO:', 'NOTE: against a near-black background under a hard frontal light, her face fills the frame.\nWHO:') },
  ], '실물꼴');
  const r1 = 틀돌리기(null, ['--지시문', 실물], dir);
  const 빛걸림1 = 걸림글(r1, '지시문').filter((x) => /\(빛\)/.test(x));
  assert.equal(빛걸림1.length, 1, JSON.stringify(걸림글(r1, '지시문')));
  assert.match(빛걸림1[0], /^C3: \(빛\) 지시문에 앞에서 고르게 비추는 빛 「frontal light」/);
  // 앞빛 이름을 고른 장면이면 같은 말이 지나간다
  const 새빛 ='Bright, airy high-key light from the front and above; a thin rim of light from behind separates every outline from the wall.';
  const pack2 = 꾸러미만들기(dir, 판들.slice(0, 2).map((p) => ({ id: p.id, 글: p.글.replace(빛문장, 새빛) })), '하이키');
  const r2 = 틀돌리기((s) => { s.장면.부엌밤.빛이름 = ['High key', 'Rim light']; s.장면.부엌밤.빛 = 새빛; }, ['--지시문', pack2], dir);
  assert.deepEqual(걸림글(r2, '지시문'), [], JSON.stringify(r2.항목들.filter((x) => x.등급 === '걸림')));
});

const 빛단위 = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
import 컷연속성검사 as k
표, 까닭 = k.빛이름표()
out = {"까닭": 까닭, "수": len(표["이름"]), "앞빛허용": sorted(표["앞빛허용"]), "문턱": 표["좌우문턱"]}
seq = json.load(open(sys.argv[2], encoding="utf-8")); 빛 = seq["장면"]["부엌밤"]["빛"]
글 = "LOOK: " + 빛 + " The table is evenly lit."
out["사람판"] = k.빛대조(seq, ["C1"], 글); out["사람없는판"] = k.빛대조(seq, ["C4"], 글)
줄들 = list(표["이름"].values())
out["뼈대_쪽없음"] = [x["이름"] for x in 줄들 if x.get("방향") is True and not (k._빛쪽.search(x["뼈대"]) or k._빛뒤위.search(x["뼈대"]))]
out["뼈대_앞빛"] = [x["이름"] for x in 줄들 if x["이름"].lower() not in 표["앞빛허용"] and k._앞빛_표.search(x["뼈대"])]
out["칸빠짐"] = [x["이름"] for x in 줄들 if not x.get("뜻") or not isinstance(x.get("잣대"), list) or (not x.get("뼈대") and not x.get("대신"))]
out["옆빛인데_방향아님"] = [x["이름"] for x in 줄들 if ("좌우" in x["잣대"]) != (x.get("방향") is True)]
값 = {"좌우": 0.131, "위아래": 0.02, "색": 3.0, "역광": 0.99}
옆 = "Soft daylight from a window at the left of the frame."
out["판정"] = {
    "옆빛_낮음": k.빛판정(["Window light"], 옆, 값, 표),
    "옆빛_넘음": k.빛판정(["Window light"], 옆, dict(값, 좌우=0.289), 표),
    "뒤에서": k.빛판정(["Window light"], "Daylight from the window behind the table.", 값, 표),
    "앞빛이름": k.빛판정(["Butterfly", "Soft light"], "A soft key from the front and above, slightly toward the left of the frame.", 값, 표),
    "색이름": k.빛판정(["Neon light"], "Pink neon at the left of the frame, blue at the right.", 값, 표),
}
if len(sys.argv) > 3:
    import numpy as np
    a = np.full((300, 300, 3), 60, np.uint8); a[100:200, 100:150] = 200; a[100:200, 150:200] = 100
    b = np.full((300, 300, 3), 60, np.uint8); b[100:133, 100:200] = 220; b[133:200, 100:200] = 110
    c = np.full((300, 300, 3), 60, np.uint8); c[100:200, 100:150] = (220, 60, 60); c[100:200, 150:200] = (60, 60, 220)
    out["값"] = {"좌우": k.얼굴빛값(a, (100, 100, 200, 200)), "위아래": k.얼굴빛값(b, (100, 100, 200, 200)), "색": k.얼굴빛값(c, (100, 100, 200, 200)), "작음": k.얼굴빛값(a, (100, 100, 104, 104))}
print(json.dumps(out, ensure_ascii=False))
`;
const 빛단위돌리기 = (그림도) => {
  const dir = 임시();
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 빛단위, path.join(__dirname, '..', 'tools'), 틀경로, ...(그림도 ? ['그림'] : [])], { encoding: 'utf8', maxBuffer: 1 << 24, cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

test('빛 이름 — 표(빛이름.json)는 34줄이고 스스로 규칙을 어기지 않는다, 사람 없는 판은 앞빛 낱말을 걸지 않고, 얼굴 빛 판정은 옆빛 이름 + 옆쪽 문장 + 문턱 아래일 때만 「확인」이다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const o = 빛단위돌리기(false);
  assert.equal(o.까닭, null);
  assert.equal(o.수, 34);
  assert.deepEqual(o.앞빛허용, ['butterfly', 'flat light', 'high key']);
  assert.equal(o.문턱, 0.2);
  assert.deepEqual([o.뼈대_쪽없음, o.뼈대_앞빛, o.칸빠짐, o.옆빛인데_방향아님], [[], [], [], []]);
  assert.equal(o.사람판.length, 1, JSON.stringify(o.사람판));
  assert.match(o.사람판[0][1], /앞에서 고르게 비추는 빛 「evenly lit」/);
  assert.deepEqual(o.사람없는판, [], '사람 없는 컷의 판은 걸지 않는다');
  assert.equal(o.판정.옆빛_낮음[0], '확인');
  assert.match(o.판정.옆빛_낮음[1], /얼굴 좌우빛 0\.131 — 옆빛 이름\(Window light\)인데 문턱 0\.2 아래다/);
  assert.equal(o.판정.옆빛_넘음[0], '통과');
  assert.equal(o.판정.뒤에서[0], '알림', '문장에 왼쪽 · 오른쪽이 없으면(뒤에서 오는 빛) 좌우로 판정하지 않는다');
  assert.equal(o.판정.앞빛이름[0], '알림', '앞빛 이름을 고른 장면은 좌우로 판정하지 않는다');
  assert.equal(o.판정.색이름[0], '알림');
});

test('빛 이름 — 얼굴 빛 값(가짜 그림): 좌우 · 위아래 · 색 · 역광 셈, 너무 작은 상자는 재지 않는다 · 얼굴 없는 그림은 알림(검출기가 없는 곳은 확인)', { skip: !그림라이브러리 && '파이썬 그림 라이브러리 없음' }, () => {
  const o = 빛단위돌리기(true);
  assert.ok(Math.abs(o.값.좌우.좌우 - 0.667) < 0.005 && Math.abs(o.값.좌우.위아래) < 0.005 && o.값.좌우.색 < 1, JSON.stringify(o.값.좌우));
  assert.ok(Math.abs(o.값.좌우.역광 - 2.5) < 0.01, `얼굴 150 ÷ 둘레 60: ${o.값.좌우.역광}`);
  assert.ok(o.값.위아래.위아래 > 0.7 && o.값.위아래.좌우 < 0.005, JSON.stringify(o.값.위아래));
  assert.ok(o.값.색.색 > 60, JSON.stringify(o.값.색));
  assert.equal(o.값.작음, null);
  // 사람 컷의 정지 그림에 얼굴이 없으면 알림으로만 남는다(검출 모델이 없는 곳에서는 못 쟀다는 「확인」 한 줄)
  const dir = 임시(); const 그림 = path.join(dir, '정지'); fs.mkdirSync(그림);
  const 만들기 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys\nfrom PIL import Image\nfor c in ("C1", "C2", "C3"): Image.new("RGB", (360, 640), (70, 70, 70)).save(sys.argv[1] + "/" + c + ".png")', 그림], { encoding: 'utf8' });
  assert.equal(만들기.status, 0, 만들기.stderr);
  const r = 틀돌리기(null, ['--그림', 그림, '--항목', '틀,빛'], dir);
  const 빛줄 = r.항목들.filter((x) => x.항목 === '빛');
  assert.ok(빛줄.length >= 1, JSON.stringify(r.항목들));
  const 검출기없음 = 빛줄.some((x) => x.등급 === '확인' && /얼굴 검출기를 못 불러/.test(x.글));
  if (!검출기없음) assert.deepEqual(빛줄.map((x) => `${x.컷}:${x.등급}`), ['C1:알림', 'C2:알림', 'C3:알림'], JSON.stringify(빛줄));
});

test('틀 2 + --그림지시문 — 장소 · 빛 · 인물 줄이 표 그대로면 통과, 인물 옷 문장이 빠지면 걸림, 파일 없는 컷은 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 틀 = 틀읽기();
  const 그림글 = (d, { 옷 = true } = {}) => 표대로그림글(틀, d, { 옷 });
  const 좋은 = path.join(dir, '좋은그림'); fs.mkdirSync(좋은);
  for (const d of 틀.detail) 쓰기(좋은, `${d.cut}.txt`, 그림글(d));
  const r = 틀돌리기(null, ['--그림지시문', 좋은], dir);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과')));
  assert.deepEqual(r.항목들.filter((x) => x.항목 === '그림지시문').map((x) => `${x.컷} ${x.등급}`), ['C1 통과', 'C2 통과', 'C3 통과', 'C4 통과']);
  const 나쁜 = path.join(dir, '나쁜그림'); fs.mkdirSync(나쁜);
  쓰기(나쁜, 'C1.txt', 그림글(컷(틀, 'C1')));
  쓰기(나쁜, 'C2.txt', 그림글(컷(틀, 'C2'), { 옷: false }));
  쓰기(나쁜, 'C4.txt', 그림글(컷(틀, 'C4')).replace('Night. One warm pendant lamp', 'Late night. A warm pendant lamp'));
  쓰기(나쁜, '메모.txt', '컷 이름이 아닌 파일');
  const r2 = 틀돌리기(null, ['--그림지시문', 나쁜], dir);
  assert.equal(r2.코드, 1);
  const 그림 = (이름) => r2.항목들.filter((x) => x.항목 === '그림지시문' && x.컷 === 이름).map((x) => `${x.등급}: ${x.글}`);
  assert.deepEqual(그림('C1'), ['통과: 장소 · 빛 · 인물 줄이 표 그대로']);
  assert.equal(그림('C2').length, 1);
  assert.match(그림('C2')[0], /^걸림: 인물 「수아」의 옷 문장이 글자 그대로 들어 있지 않다 — 이미지 지시문은 표의 장소 · 빛 · 인물 · 소품 줄을 그대로 쓴다\(G11 · 51\)/);
  assert.match(그림('C3')[0], /^주의: 이미지 지시문 파일이 없다: C3\.txt/);
  assert.match(그림('C4')[0], /^걸림: 장면 「부엌밤」의 빛 문장/);
  assert.match(그림('메모')[0], /^주의: 컷표에 없는 컷 이름/);
  // 파일을 하나씩 줘도 되고, 옛 틀 표에서는 견주지 않는다(알림)
  const r3 = 틀돌리기(null, ['--그림지시문', path.join(좋은, 'C1.txt'), path.join(좋은, 'C4.txt')], dir);
  assert.equal(r3.코드, 0);
  assert.deepEqual(r3.항목들.filter((x) => x.항목 === '그림지시문').map((x) => `${x.컷} ${x.등급}`), ['C1 통과', 'C2 주의', 'C3 주의', 'C4 통과']);
  const r4 = 돌리기([쓰기(dir, '옛.json', JSON.stringify({ detail: [{ cut: 'A1', t: 0, dur: 2 }], 소품: [], 사건: [], 소리사건: [] })), '--그림지시문', 좋은, '--출력', path.join(dir, '검사옛')]);
  assert.equal(r4.코드, 0);
  assert.deepEqual(r4.항목들.filter((x) => x.항목 === '그림지시문').map((x) => x.등급), ['알림']);
});

// ───────── 내기 도구(크레딧내기.py · 드리미나내기.py)의 굽기 전 검사 — 계정 · 잔액 · 네트워크 없이, --실행 없이 ─────────
const 굽기전 = (...args) => spawnSync('python', ['-I', '-X', 'utf8', path.join(픽스처, '굽기전_시험.py'), ...args], { encoding: 'utf8', maxBuffer: 1 << 24 });
const 굳은글 = 지시문글({ 연기: 'at about 0.4 s she stands perfectly still by the stove, expressionless.' });

test('내기 도구 — 굽기전(): 걸림 있는 꾸러미는 SystemExit, 까닭을 주면 지나가고 그 판에 까닭이 남는다, 빈 까닭은 거절, 걸림 없으면 지나간다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 나쁜 = 꾸러미만들기(dir, [{ id: 'C1', 글: 굳은글 }, { id: 'C2', 글: 지시문글() }], '나쁜');
  const g = 굽기전('함수', 나쁜);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stderr, /멈춤: 지시문 걸림 2 — 고친 뒤 다시 낸다\(사람을 굳히는 낱말 · 손 없이 움직이는 물건 · 실내의 눈 · 컷표\)\. 쓰는 법: docs\/마케팅\/제작양식\/영상양식\/지시문_틀\.md\. 그래도 내야 하면 --걸림무시 "<판 id>,<판 id>: <까닭>"\(그 판만\) · --걸림무시 "모두: <까닭>"/);
  assert.match(g.stdout, /✗ C1: \(연기\) 사람 정지 낱말 「expressionless」/);
  assert.match(g.stdout, /✗ C1: \(연기\) 사람 정지 낱말 「perfectly still」/);
  assert.match(g.stdout, /지시문 검사: 걸림 2 · 주의 0/);
  assert.match(g.stdout, /컷표 없음 — 표 검사 건너뜀/);
  assert.ok(!/결과:/.test(g.stdout), '멈추면 돌려주는 값이 없다');
  const g2 = 굽기전('함수', 나쁜, '--무시', 'C1: 정지 컷 — 유호님 확인');
  assert.equal(g2.status, 0, g2.stdout + g2.stderr);
  assert.match(g2.stdout, /걸림 2개를 넘겨 낸다 — 까닭: 정지 컷 — 유호님 확인/);
  assert.deepEqual(JSON.parse(g2.stdout.trim().split(/\r?\n/).pop().replace(/^결과: /, '')), { C1: '정지 컷 — 유호님 확인' }, '걸린 판에만 까닭이 남는다');
  const g3 = 굽기전('함수', 나쁜, '--무시', '   ');
  assert.equal(g3.status, 1);
  assert.match(g3.stderr, /--걸림무시에는 까닭을 적는다/);
  // 판 이름 없이 까닭만 적은 값 · 쌍점이 없는 값 · 까닭이 빈 값은 거절한다 — 어긋난 값 하나로 걸린 판이 모두 넘어가지 않게(11-10 검수)
  for (const 값 of ['정지 컷 — 유호님 확인', 'C1', 'C1:', '정지 컷: 유호님 확인']) {
    const 거절 = 굽기전('함수', 나쁜, '--무시', 값);
    assert.equal(거절.status, 1, `${값}: ${거절.stdout}${거절.stderr}`);
    assert.match(거절.stderr, /--걸림무시는 "<판 id>,<판 id>: <까닭>"\(그 판의 걸림만 — 컷표의 걸림은 「컷표」\) 또는 "모두: <까닭>"으로 적는다 — (?:받은 값|낼 판에 없는 이름)/, 값);
    assert.ok(!/결과:/.test(거절.stdout), 값);
  }
  const 좋은 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글() }, { id: 'C2', 글: 지시문글() }], '좋은');
  const g4 = 굽기전('함수', 좋은);
  assert.equal(g4.status, 0, g4.stdout + g4.stderr);
  assert.match(g4.stdout, /지시문 검사: 걸림 0 · 주의 0/);
  assert.match(g4.stdout, /결과: \{\}/);
  // 물건 · 실내 규칙도 같은 관문에서: _순서.json의 실내: true 판에 눈이 떨어지면 걸림, 손 없이 닫히는 문도 걸림. 프리비즈 판(pv…)은 꾸러미점검처럼 건너뛴다
  const 물건 = 꾸러미만들기(dir, [
    { id: 'S1', 실내: true, 글: 지시문글({ 연기: 'at about 0.4 s she sets the pot down; at about 2.3 s snowflakes on her shoulders melt.', 실내줄: false }) },
    { id: 'S2', 글: 지시문글({ 연기: 'at about 0.4 s she looks up; at about 3.0 s the door swings shut.' }) },
    { id: 'pv-1', 글: 'ACTION: she stands still.' },
  ], '물건');
  const g5 = 굽기전('함수', 물건);
  assert.equal(g5.status, 1);
  assert.match(g5.stdout, /✗ S1: \(실내\) 실내 컷에 떨어지는/);
  assert.match(g5.stdout, /✗ S2: \(물건\) 큰 물건이 손 없이 움직인다/);
  assert.match(g5.stdout, /· pv-1: 프리비즈 판 — 지시문 검사 건너뜀/);
  assert.match(g5.stderr, /멈춤: 지시문 걸림 2 /);
  // 넘겨 낸 판은 장부(_크레딧내기.json) 그 판 줄에 「걸림무시」 칸이 하나 더 붙는다 — 다른 칸과 걸림 없던 판의 줄은 그대로
  const g6 = 굽기전('장부', dir);
  assert.equal(g6.status, 0, g6.stdout + g6.stderr);
  const 장부 = JSON.parse(g6.stdout.trim().split(/\r?\n/).pop().replace(/^결과: /, ''));
  assert.equal(장부['job-C1'].걸림무시, '정지 컷 시험');
  assert.deepEqual(Object.keys(장부['job-C1']), ['판', '계정', '받을곳', '파일', '상태', '만든때', '크레딧', '걸림무시']);
  assert.deepEqual(Object.keys(장부['job-C2']), ['판', '계정', '받을곳', '파일', '상태', '만든때', '크레딧']);
});

test('내기 도구 — 굽기전() + 컷표: 꾸러미 한 층 위의 컷표.json을 스스로 찾아 표 검사와 빛 문장 대조를 돌고, --컷표로 줘도 같다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 편 = path.join(dir, '편'); fs.mkdirSync(편);
  쓰기(편, '컷표.json', JSON.stringify(틀읽기()));
  const 좋은 = 꾸러미만들기(편, [{ id: 'C1', 글: 지시문글() }, { id: 'rm-C2', 글: 지시문글() }]);
  const g = 굽기전('함수', 좋은);
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.ok(!/컷표 없음/.test(g.stdout));
  assert.match(g.stdout, /지시문 검사: 걸림 0 · 주의 0/);
  // 빛 문장이 표와 다른 판 · 컷표에 없는 판 · 표의 빈 칸(한문장)
  const 편2 = path.join(dir, '편2'); fs.mkdirSync(편2);
  const 나쁜표 = 틀읽기(); 나쁜표.한문장 = '';
  const 표경로 = 쓰기(편2, '컷표.json', JSON.stringify(나쁜표));
  const 나쁜 = 꾸러미만들기(편2, [{ id: 'C1', 글: 지시문글({ 빛: 빛문장.replace('warm', 'cold') }) }, { id: 'X9', 글: 지시문글() }]);
  const g2 = 굽기전('함수', 나쁜);
  assert.equal(g2.status, 1, g2.stdout + g2.stderr);
  assert.match(g2.stdout, /✗ 컷표 표: \[틀\] 「한문장」 칸이 비었다/);
  assert.match(g2.stdout, /✗ C1: \(빛\) 장면의 빛 문장이 표와 다르다/);
  assert.match(g2.stdout, /✗ X9: \(컷표\) 컷표에 없는 판/);
  assert.match(g2.stdout, /지시문 검사: 걸림 3 · 주의 0/);
  // 표가 걸리면 무시하고 낼 때 그 꾸러미의 판 모두에 까닭이 남는다
  const g3 = 굽기전('함수', 나쁜, '--무시', '모두: 표는 내일 채운다');
  assert.equal(g3.status, 0, g3.stdout + g3.stderr);
  assert.deepEqual(JSON.parse(g3.stdout.trim().split(/\r?\n/).pop().replace(/^결과: /, '')), { C1: '표는 내일 채운다', X9: '표는 내일 채운다' });
  // 컷표가 곁에 없는 꾸러미에 --컷표로 주면 같은 검사가 돈다, 없는 파일은 거절
  const 따로 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글({ 빛: 빛문장.replace('warm', 'cold') }) }], '따로');
  const g4 = 굽기전('함수', 따로, '--컷표', 표경로);
  assert.equal(g4.status, 1);
  assert.match(g4.stdout, /✗ C1: \(빛\) 장면의 빛 문장이 표와 다르다/);
  const g5 = 굽기전('함수', 따로, '--컷표', path.join(dir, '없는표.json'));
  assert.equal(g5.status, 1);
  assert.match(g5.stderr, /--컷표 파일이 없다/);
});

test('내기 도구 — 크레딧내기 · 드리미나내기 main()(미리 보기 · 가짜 계정): 견적 뒤에 지시문 검사를 찍고 걸림이면 멈춘다, --걸림무시 "<판 id>: <까닭>"이면 지나가고 값 없는 --걸림무시 · 판 이름 없는 까닭은 거절', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 나쁜 = 꾸러미만들기(dir, [{ id: 'C1', 글: 굳은글 }, { id: 'C2', 글: 지시문글() }], '나쁜');
  const 좋은 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글() }], '좋은');
  for (const 도구이름 of ['크레딧', '드리미나']) {
    const g = 굽기전(도구이름, 나쁜);
    assert.equal(g.status, 1, `${도구이름}: ${g.stdout}${g.stderr}`);
    assert.match(g.stdout, /낼 것 2판[\s\S]*✗ C1: \(연기\)[\s\S]*지시문 검사: 걸림 2 · 주의 0/, `${도구이름}: 견적 뒤에 검사를 찍는다`);
    assert.match(g.stderr, /멈춤: 지시문 걸림 2 /);
    assert.ok(!/미리 보기만 했다/.test(g.stdout), `${도구이름}: 걸림이면 내는 갈림길까지 가지 않는다`);
    const g2 = 굽기전(도구이름, 나쁜, '--걸림무시', 'C1: 정지 컷 시험');
    assert.equal(g2.status, 0, `${도구이름}: ${g2.stdout}${g2.stderr}`);
    assert.match(g2.stdout, /낼 것 2판/, `${도구이름}: 까닭 글을 판 id로 읽지 않는다`);
    assert.match(g2.stdout, /걸림 2개를 넘겨 낸다 — 까닭: 정지 컷 시험[\s\S]*미리 보기만 했다/);
    const g3 = 굽기전(도구이름, 나쁜, '--걸림무시');
    assert.equal(g3.status, 1);
    assert.match(g3.stderr, /--걸림무시에는 까닭을 적는다: --걸림무시는 "<판 id>,<판 id>: <까닭>"/);
    const g3b = 굽기전(도구이름, 나쁜, '--걸림무시', '정지 컷 시험');
    assert.equal(g3b.status, 1, `${도구이름}: 판 이름 없는 까닭은 거절한다`);
    assert.match(g3b.stderr, /--걸림무시는 "<판 id>,<판 id>: <까닭>".*받은 값/);
    assert.ok(!/미리 보기만 했다/.test(g3b.stdout));
    const g4 = 굽기전(도구이름, 좋은, 'C1', '--컷표', 틀경로);
    assert.equal(g4.status, 0, `${도구이름}: ${g4.stdout}${g4.stderr}`);
    assert.match(g4.stdout, /낼 것 1판[\s\S]*지시문 검사: 걸림 0 · 주의 0[\s\S]*미리 보기만 했다/);
    assert.ok(!/컷표 없음/.test(g4.stdout));
    const g5 = 굽기전(도구이름, 좋은, '--실행');
    assert.equal(g5.status, 1, '시험 스크립트는 --실행을 받지 않는다');
  }
});

// ───────── 11-10 덧붙임 — 내기 도구가 이 낱말로 제출을 막으므로 사람 정지가 아닌 말은 걸지 않는다 ─────────
test('지시문 — 사람 연기: 정지를 부정하는 말 · 물건이 주어인 정지는 걸지 않고, 사람 · 몸이 주어면 그대로 건다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 박 = 'at about 0.5 s she lifts the can to her lips; ';
  const 글 = {
    // 걸지 않는다 — 실물 꾸러미에서 나온 오탐(p10-10n · rs-C64g · om2-3b)과 지시문 틀의 권장 문장
    부정1: `ACTION: ${박}nobody holds a frozen pose.`,
    부정2: `ACTION: ${박}nothing frozen in the air, and the picture never holds still.`,
    물건1: `ACTION: ${박}The can stays exactly where it stands on the counter and it never moves.`,
    물건2: `ACTION: ${박}the bottle stays perfectly still on the table while the light moves.`,
    물건3: `ACTION: ${박}the steam hangs almost still above the bowl; the camera holds still.`,
    // 그대로 건다 — 사람 · 몸이 주어이거나, 부정어와 정지 사이에 접속사 · 새 주어가 낀 말
    사람1: `ACTION: ${박}the young woman stands still.`,
    사람2: `ACTION: ${박}her hand stays still on the table.`,
    사람3: `ACTION: ${박}she says nothing and stands still.`,
    사람4: `ACTION: ${박}the hand stays perfectly still.`,
    사람5: `ACTION: ${박}she never moves her feet.`,
    사람6: 'ACTION: from 0.5 s Yuna looks at the door and stands still.',
    사람7: 'ACTION: from 0.5 s the woman by the window stands still.',
  };
  const 파일 = Object.entries(글).map(([이름, t]) => 쓰기(dir, `${이름}.txt`, t));
  const r = 돌리기(['지시문', ...파일]);
  const 낱말 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름 && x.등급 === '걸림').map((x) => (x.글.match(/「(.+?)」/) || [])[1]);
  for (const 이름 of ['부정1', '부정2', '물건1', '물건2', '물건3']) assert.deepEqual(낱말(이름), [], `${이름}: ${글[이름]}`);
  assert.deepEqual(낱말('사람1'), ['stands still']);
  assert.deepEqual(낱말('사람2'), ['stays still']);
  assert.deepEqual(낱말('사람3'), ['stands still']);
  assert.deepEqual(낱말('사람4'), ['perfectly still']);
  assert.deepEqual(낱말('사람5'), ['never moves']);
  assert.deepEqual(낱말('사람6'), ['stands still'], '이름이 주어고 물건이 접속사 앞에 있을 뿐이다');
  assert.deepEqual(낱말('사람7'), ['stands still'], '같은 절에 사람이 있으면 물건 주어로 보지 않는다');
});

test('내기 도구 — 굽기전(): 사람이 나오는데 ACTION 칸이 없는 지시문은 내지 않는다(검사 도구의 --지시문도 같은 등급)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 풀어쓴 = 'Extreme close-up from just above her eye level. She turns to the door and smiles.\nCamera: handheld with a faint drift.';
  const 사람없는 = 'Macro shot of the can on wet stone. No people.\nCAMERA: a slow push-in of 4% from 0 s to 3.5 s.';
  const 꾸러미 = 꾸러미만들기(dir, [{ id: 'C1', 글: 풀어쓴 }, { id: 'C2', 글: 사람없는 }], '풀어쓴');
  const g = 굽기전('함수', 꾸러미);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ C1: \(연기\) 사람이 나오는데 ACTION: 칸이 없다/);
  assert.ok(!/C2: \(연기\)/.test(g.stdout), '사람 대명사가 없는 제품 컷은 걸지 않는다');
  assert.match(g.stdout, /지시문 검사: 걸림 1 /);
  // 웹에서 손으로 내는 판은 이 도구의 --지시문이 관문이다 — 내기 도구와 등급이 같아야 걸림 0이 같은 뜻이 된다
  const r = 돌리기(['지시문', 쓰기(dir, '풀어쓴.txt', 풀어쓴)]);
  assert.equal(r.코드, 1);
  assert.deepEqual(r.항목들.filter((x) => x.항목 === '연기').map((x) => x.등급), ['걸림'], '검사 도구의 --지시문도 내기 도구와 같은 등급이다');
});

test('꾸러미점검.py는 사람 연기 판정을 검사 도구의 함수에 맡긴다(낱말만 빌려 와 다시 판정하지 않는다)', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', 'PULSE_포트폴리오_제작준비_20261012', '시댄스무제한', '꾸러미점검.py'), 'utf8');
  assert.match(글, /from 컷연속성검사 import 지시문검사, 사람지시문검사, 판정보/);
  assert.match(글, /사람지시문검사\(t, 인물=정보\["인물"\], 소리만=정보\["소리만"\]\)/);
  assert.ok(!/^STILL = re\.compile/m.test(글) && !/사람정지낱말\(|BEAT\.search|PERSON\.search/.test(글), '정지 낱말 · 박자를 여기서 다시 판정하면 내기 도구와 판정이 갈린다');
});

// ───────── 11-10 다시 짬(두 번) — 사람 정지 판정(둘째 · 셋째 검수의 재현 문장) ─────────
// 왜 다시 짰나: 이 자리에서 검수 세 회차 연달아 큰 지적이 나왔다 — 낱말을 더하면 미탐 · 오탐이 자리를 옮겼고(둘째 회), 「건너뛰는 갈래」를 두면 그 갈래로 샜다(셋째 회).
//   그래서 건너뛰는 갈래를 없앴다: 정지 말은 어느 판 · 어느 칸에서든 보고(연기 글에서는 주어가 아는 물건일 때만 지나가고, 그 밖의 칸에서는 사람 주어가 드러난 것만 건다),
//   사람이 나오는 판인지는 컷표의 「인물」이 먼저 정하고 글의 증거가 더하며, 칸은 라벨에서 다음 라벨까지다.
const 박 = 'at about 0.5 s she lifts the can to her lips; ';
const 걸려야 = [
  // 사람 · 몸이 주어인데 물건 낱말(door · window · frame · camera)이 곁에 있다
  'her hand on the door handle stays perfectly still.',
  'the woman by the window stays perfectly still.',
  'she leans on the frame and her shoulders are completely still.',
  'the man behind the camera is motionless.',
  // 이름이 주어 · 전치사구가 낀 주어
  'Seojin in the foreground stays still while Minjae speaks.',
  'Sua at the stove is completely still.',
  'Minjae by the window does not move.',
  'Yuna looks at the door and stands still.',
  'Mina, calm, perfectly still.',
  // 목록에 없는 사람 낱말 · 주어 없는 말
  'the others stay still.',
  'the two stand still facing each other.',
  'the interviewer stays completely still.',
  'the character stands still.',
  'the expression stays frozen.',
  'the vlogger waves and stays still.',
  'the vloggers wave and stay still.',
  'Sua waves and stays still.',
  'the other waves and stays still.',
  // 부정어가 정지를 다스리지 않는다
  'she never blinks standing perfectly still.',
  'the man who never looks up sits still at the desk.',
  'she has no expression frozen like a statue.',
  'she says nothing and stands still.',
  // 빠져 있던 정지 말
  'Everyone else in the frame keeps still with lips closed.',
  'She keeps her pose and her gaze as in the first frame.',
  'He keeps lying still to the end.',
  'she is standing still by the door.',
  'he remains still.',
  'she is holding the pose.',
  'he holds a pose for the camera.',
  'she freezes.',
  'her hands rest motionless on the table.',
  'he stays frozen in place.',
  'an expressionless face turns to the door.',
  'she holds a frozen pose.',
  'the dog hangs calmly and it stays perfectly still.',
  'she stays put by the door.',
  'he stands rooted to the spot.',
  'her expression never changes.',
  'she stays in the same pose until the end.',
  'he sits with no movement at all.',
  'Nobody moves.',
  'all stay still.',
  // 물건 낱말이 사람 낱말을 꾸미거나 곁에 있을 뿐이다
  'the camera operator stays still.',
  'the shop owner stands still.',
  'the girl in the red dress stays still.',
  'the hand holding the can stays perfectly still.',
  'she stands by the still water, perfectly still.',
  'the model holds the bag and stays still.',
  'the vlogger waves, perfectly still.',
  'both stay still.',
  'Hold still for one second.',
  'he never moves a muscle.',
  // 셋째 검수 — 서술 자리의 frozen · motionless · expressionless(앞이 동사다)
  'she stays frozen for a beat, then exhales.',
  'she stands frozen staring at the door.',
  'he stands frozen the whole time.',
  'she stands motionless facing the window.',
  'he stands motionless holding the cup.',
  'she stays expressionless the whole shot.',
  'a frozen Sua in the doorway.',
  // 셋째 검수 — 물건 판정의 구멍(사람으로도 읽히는 낱말 · 물건 뒤의 모르는 낱말 · 한정사 없는 동사구 · 부정이 아닌 nothing · 강조 따옴표)
  'the speaker stays perfectly still while talking.',
  'her shadow stays perfectly still.',
  'The shop assistants wait by the door, perfectly still.',
  'The street performers wait by the fountain, motionless.',
  'she turns, then grabs cup and stands still.',
  'Nothing distracts the woman standing perfectly still.',
  'she stays "perfectly still" until the end.',
  'the vlogger by the door stays still.',
  // 셋째 검수 — 목록 밖에 있던 정지 말
  'she keeps her head still and only her eyes move.',
  'she holds her hands still on the table.',
  'she waits, her body still, her eyes on the door.',
  'she stays as still as possible.',
  'she stands there, still and silent.',
  'she stays in place until the end.',
  'she holds position to the last frame.',
  'she does not change her pose.',
  'she sits in the same pose throughout.',
  "she isn't moving at all.",
  'No one else in the frame moves.',
  'Neither of them moves.',
  'she barely moves.',
  'she is extremely still.',
  'at 1.0 s she stops moving and stays like that.',
  'she strikes a pose and holds it to the end.',
  'he turns to the lens and holds that look to the end.',
  'her face stays blank, a neutral expression that never shifts.',
  'she freezes mid-step.',
  // 장면 전체를 멈추는 말은 사람이 나오는 판에서는 사람도 멈춘다(사람 없는 판에서는 아래 시험이 통과를 본다)
  'after that the liquid soaks quietly into the ground and everything is still.',
  'Then all is still.',
  'He looks down at it. No other movement.',
  // 넷째 검수 — 풀어 주는 갈래로 새던 사람 정지: 사람이 나오는 판에서는 주어 없는 절 · they를 앞 절의 물건으로 풀지 않는다
  'Rain pours off the awning; the reflections on the wet street shimmer. They barely move.',
  'Sua and Minjae wait at the bus stop; rain runs down the glass. They stay perfectly still.',
  'she waits by the door, the kettle steaming behind her, perfectly still.',
  'The curtain hangs beside her. Perfectly still, she watches the street.',
  'at about 1.6 s the kettle clicks off. Perfectly still to the end.',
  'she sets the two cups on the table. They stay perfectly still.',
  'the baby lies in the cot. The mobile turns above. It stays perfectly still.',
  // 그래서 물건인데도 걸리는 문장(감수 — 주어를 밝혀 「the turbine stays completely still」로 쓴다)
  'In the dark test cell lined with panels, the turbine stands at the end of the long room, completely still.',
  'Once open, the lid stays tipped back in that raised position for the rest of the clip, perfectly still.',
  "the clock's bells rattle and the phones jitter; at about 0.6 s they all stop and go still.",
  // 넷째 검수 — 사람 주어를 물건 덩이로 읽던 꼴(모르는 사람 낱말 + 동사 + 물건 · 사람 and 물건 · 사람의 그림자 · 모르는 꾸밈말 둘)
  'the waiter pours water and stays perfectly still.',
  'the sommelier pours water and stays perfectly still.',
  'the monks carry lanterns and stay perfectly still.',
  'the monk sipping tea stays perfectly still.',
  'the director watches monitor and stays still.',
  'she and the bottles stay still.',
  'Sua and the cups stay perfectly still.',
  'people and cars stand still.',
  "Minjae's shadow stays perfectly still.",
  'the shadow of the man stays still.',
  'she stands with her bag perfectly still.',
  'the can and its odd pull tab stay perfectly still.',
  // 넷째 검수 — 「잠깐」이 아닌 멈춤(긴 초 · 사람이 잇지 않는 then)
  'at 0.2 s she freezes for 4 s.',
  'he holds that look for 5 seconds.',
  'she freezes until 4 s.',
  'he holds that stare until about 3.2 s.',
  'she freezes mid-step, then the camera pushes in.',
  'he holds that look, then the shot ends.',
  'she freezes, then stays like that.',
  // 넷째 검수 — 실물에 있던 목록 밖 정지 말
  'a worker in a white hard hat stands with his back to the camera, still.',
  'she waits by the door, still, until the cut.',
  'the finger lifts off at about 1.13 s, then hovers still just above the screen until the end.',
  'At about 0.7 s he lowers his hand. Nothing else moves.',
  'a small worker stands near it. Nothing moves.',
  'From about 1.2 s to the end she keeps that quiet look, exactly as in the last frame.',
  'he turns to the lens and holds that look.',
  'at about 2.8 s he rises into the frame once more and holds there to the end.',
  'he leans in a touch toward his hands, unblinking.',
  'the man stares straight ahead, lips closed, and never reacts.',
  'His face stays blank.',
  'she poses for the camera like a mannequin.',
  // 다섯째 검수 — 풀어 주는 갈래를 걷은 자리: 잠깐 예외는 없다(「freezes」 · 「holds that stare」는 짧아도 걸린다 — 멎는 연기는 pauses · hesitates로 쓴다)
  'she freezes for a moment, then answers.',
  'she freezes briefly.',
  'he freezes for about 0.6 s, then nods.',
  'she freezes mid-step, then runs to the door.',
  'she freezes, then she stays exactly like this to the last frame.',
  'she freezes for a moment that stretches to the end of the shot.',
  'at about 2.0 s he looks up into the lens and holds that stare until about 3.2 s.',
  'At about 3.0 s the door clicks. She freezes until 4.4 s.',
  // 「too」는 부정이 아니다 · 꾸밈 자리의 still은 풀지 않는다 · 장면 낱말 주어 · 물건의 부분 · 모르는 꾸밈말의 사람 꼴 · 쉼표 나열의 사람
  'he looks at her; she too stands perfectly still.',
  'Minjae too stays completely still.',
  'a perfectly still shot of her face.',
  'she is a perfectly still statue.',
  'she poses like a perfectly still statue.',
  'the whole scene stays perfectly still.',
  'the picture is completely still.',
  'the whole frame is perfectly still.',
  'nothing at all moves.',
  'not a thing moves.',
  'the bottle hand stays perfectly still.',
  'the janitor light stays still.',
  'Sua, the pot and the bowls stay perfectly still.',
  'The woman, the cup and the bottles stay perfectly still.',
  // 꾸밈 자리 — 사람에게만 쓰는 꾸밈말 · 「of + 사람」 · 부정이 아닌 nothing · 목록 밖에 있던 말 · 탭과 줄바꿈으로 띄운 말
  'an expressionless close-up of her face.',
  'a motionless portrait shot of the woman.',
  'a frozen tableau of the family at the table.',
  'nothing breaks the perfectly still pose.',
  'she goes still and waits.',
  'she stays exactly as she is in the first frame.',
  'she stays perfectly\tstill.',
  'she stands perfectly\nstill until the end.',
  'the shot ends on an expressionless close-up.',
  'a frozen line of commuters fills the platform.',
  'a frozen cellist stands in the doorway.',
  'the cut ends on a frozen scene.',
  'the shark dives into the water and it stays perfectly still.',
  'the sign reads 24" wide 간판; she stands perfectly still by the "OPEN" sign.',
  // 변이 시험이 찾은 빈자리(11-10) — 목록에 없는 사람 꼴 낱말이 꾸밈말 자리에(「the glazier, glass in hand」를 쉼표 없이) · 모르는 낱말 뒤의 낱말 둘(주어 + 동사 + 물건) ·
  //   물건이 주어여도 사람을 멈추는 말(자세 · her) · 사람을 가리키는 말을 바로 멈추는 말(keep her still — 목록에 없었다)
  'the glazier glass in hand stays still.',
  'the rookie watches monitor and stays still.',
  'the cup in hand holds the pose to the end.',
  'the chair keeps her perfectly still.',
  'keep her still to the end.',
  'he holds her still.',
  'the seat belt keeps him still.',
  'she holds herself still.',
  'the guard keeps everyone still.',
  'the cold floor keeps everyone still.',
  // 감수한 오탐(진단 문서의 알려진 한계) — 실물에 없는 꼴이라 풀어 주는 갈래를 두지 않는다. 물건을 멈추는 말은 주어를 밝혀 쓴다
  'the clock hands stay still.',
  'she walks along the shore of a perfectly still lake.',
  'unable to keep still, he drums his fingers on the desk.',
  'too excited to stand still, the child hops from foot to foot.',
];
const 안걸려야 = [
  // 아는 물건이 주어 — 지시문 틀의 물리 줄(12 · 23 · 35 · 38)
  'nothing on the door moves — the door and every sticky note stay perfectly still.',
  'The can stays exactly where it stands on the counter and it never moves.',
  'she holds her still-warm cup close.',
  'she holds her still warm mug in both hands.',
  'she keeps her still-smiling face toward him.',
  'the bottle stays perfectly still on the table while the light moves.',
  'the steam hangs almost still above the bowl; the camera holds still.',
  'The can and pull tab stay perfectly still.',
  'the turbine stands with its blades completely still.',
  'chopsticks rest motionless on the rim.',
  'The ruby crown hangs frozen in mid-splash for the whole shot — the drop itself never moves while the court around it cools.',
  'The ice itself does not move.',
  'The branch itself stays still — no wind, no falling frost.',
  'The satin lies still.',
  'Behind it the can stays perfectly still and exactly as sharp as in the first frame.',
  'The white ledge with the candle and the white door behind him stay still.',
  'Every printed photo in the scene (on a bag, a window poster) is a flat, still print whose picture never moves or changes.',
  'Close-up of the rear mud flap of a heavy low-bed trailer standing still on a concrete yard.',
  'at about 2.0 s the lid stays shut and the can stays still.',
  'at about 1.4 s the alarms stop and the clock and the phones go still.',
  "Taejun's clear umbrella does not move.",
  // 물건을 꾸미는 frozen · 「아직」이라는 뜻의 still
  'Inside the tall block of clear ice, the frozen pine needles and tiny bubbles stay fixed in the ice.',
  'the whole court is blue dusk, the frozen ruby crown unchanged.',
  'she takes out a frozen dumpling.',
  'the toe is still on the ground at the end.',
  'his left hand holds the bag, its flashlight still on.',
  // 정지를 부정하는 말
  'rather than staying frozen she shifts her weight.',
  'nothing in the frame is ever perfectly still.',
  'nobody holds a frozen pose.',
  'the picture never holds still.',
  'he never holds still — he is really listening, his head keeps drifting gently, never freezing between words.',
  'his lips stay closed and never move like speech.',
  // 따옴표 안(대사)은 연기 지시가 아니다 · 물건의 자리 · 「motion blur」
  'she says in Korean: "가만히 있어, stay still!" and laughs.',
  'the cup is in the same position as in the first frame.',
  'the can is sharp, with no motion blur.',
  'the background stays perfectly still.',
  'the bag on the chair stays still.',
  'the two cups stay still.',
  'all the bottles stay perfectly still.',
  'she is still smiling.',
  'a still photograph hangs on the wall.',
  'the frozen lake behind her.',
  'the ice cube sits motionless in the glass.',
  'she never stands still for long.',
  'no one stands still.',
  // 셋째 검수 — 물건인데 걸리던 실물 문장(it이 가리키는 물건 · 접속사 뒤의 물건 주어 · 얼음 속의 frozen)
  'At first the ruby crown of the drop hangs frozen in mid-splash.',
  'on her desk a small deep-blue felt quadcopter drone sits still on its charging pad.',
  'the cup lands upright right beside his head - one small bounce and it stands still, straw in.',
  'The clear-ice sculpture stands still with the pine sprig frozen inside its right leg.',
  'she lifts the cup and the can stays perfectly still.',
  'The long sun shadows on the wooden floor stay still.',
  // 셋째 검수 — 부정 · 말하는 결 · 화면 결. 멎는 연기는 pauses · hesitates · stops short로 쓴다(「freezes」는 짧아도 걸린다 — 다섯째 검수)
  'the wind never lets her stand still.',
  'do not let her stand still.',
  'she is not able to keep still.',
  'she pauses for a moment, then answers.',
  'she hesitates, then slowly smiles.',
  'she stops short, then runs to the door.',
  'his lips barely moving, he says one flat word.',
  'keep the look of a photoreal TV drama.',
  // 풀어 주는 갈래마다 하나씩(이것만 지나간다): 아는 물건 주어(모르는 꾸밈말 하나 · 물건의 소유격 · 묶음말) · it · 접속사 뒤의 물건 주어 · 물건을 꾸미는 frozen · freezing + 날씨 · 카메라인 「the frame」
  'the pull tab stays still.',
  "the building's shadow stays perfectly still.",
  'a pair of chopsticks rests motionless on the rim.',
  'a row of bottles stands perfectly still on the shelf.',
  'she sets the can down and it stays still.',
  'the hiker stops, then the tent stays still.',
  'the sticky notes never flutter and stay perfectly still.',
  'she takes out the frozen yogurt.',
  'freezing rain falls on the street.',
  'the frame holds still.',
  'Beside the woman, the lamp stays perfectly still.',
  // 자리 · 자세 · 모양을 지키라는 말은 정지 말이 아니다(실물)
  'The guests on the daybeds behind stay where they are.',
  'She stays seated with her hands on her knees to the last frame — she does not stand up, does not wave, does not speak.',
  'the claw tugs upward twice, but the dog does not budge.',
  "The tower's steel lattice stays rigid and sharp-edged as it passes.",
  'the teacher beams with the same wide, fixed smile and wide-open eyes.',
];
// 사람 기척이 하나도 없는 판 — 주어 없는 절 · they는 앞 절의 물건을 따르고, 장면 전체를 멈추는 말도 물건의 것이다(박자 한 줄을 붙이지 않고 넣는다)
const 물건판 = [
  'Two cans sit on crushed ice. They stay perfectly still.',
  'An old persimmon tree stands as a black silhouette against the glow. The scene is still — only the dry grass at the bottom stirs.',
  'Top-down still life: two lunchboxes on the light-oak table, wooden lids and chopsticks beside them. Nothing moves.',
  'The can sits on crushed ice, perfectly still; at about 1.0 s one drop runs down its side.',
  'The curtain hangs by the window. Perfectly still. At about 1.0 s the lamp flickers.',
  'Once open, the lid stays tipped back in that raised position for the rest of the clip, perfectly still; only the vapor keeps drifting.',
  'The crown splash of the single drop of sweat, frozen in the first frame, collapses back into the hot asphalt. Nothing else moves; no person, no hand, no new drop.',
  'A close-up of the center of the blade ring: the round machined steel hub and the roots of the dark blades. Nothing moves.',
  'Top-down still life: two lunchboxes on the light-oak table, wooden lids and chopsticks beside them. Everything else is still.',
  'at about 0.5 s the steam rises; the rest of the frame stays perfectly still.',
  'a sticker on the glass shows a printed photo of a smiling young woman; behind the glass, bottles of milk stand in cold white light. Nothing moves.',
];
// 그래도 걸리는 것 — they가 받을 복수 물건이 없다 · 이름만 쓴 판(사람 판의 증거는 못 돼도 기척은 있다: 박자는 요구하지 않고 정지 말은 사람 판처럼 본다)
const 물건판걸림 = [
  'Rain pours off the awning. They barely move.',
  'Two silhouettes stand in the doorway. They do not move.',
  'Yuna and Taejun huddle under the awning. Rain pours off the awning; the reflections on the wet street shimmer. Barely moving.',
  'Yuna standing by the window; the steam rises from the cup, perfectly still.',
  'Yuna, seated at the table. The candle flickers. Nothing moves.',
  'The model sits on the sofa. Nothing moves.',
];

test(`지시문 — 사람 정지(다시 짬): 사람 · 이름 · 모르는 낱말이 주어인 정지 ${걸려야.length}문장은 걸리고, 아는 물건이 주어인 정지 · 물건을 꾸미는 frozen · 정지를 부정하는 말 ${안걸려야.length}문장은 걸리지 않는다`, { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 파일 = [
    ...걸려야.map((문장, i) => 쓰기(dir, `걸${i}.txt`, `ACTION: ${박}${문장}`)),
    ...안걸려야.map((문장, i) => 쓰기(dir, `안${i}.txt`, `ACTION: ${박}${문장}`)),
    ...물건판.map((문장, i) => 쓰기(dir, `물${i}.txt`, `ACTION: ${문장}`)),
    ...물건판걸림.map((문장, i) => 쓰기(dir, `물걸${i}.txt`, `ACTION: ${문장}`)),
  ];
  const r = 돌리기(['지시문', ...파일]);
  const 정지 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름 && x.등급 === '걸림' && /사람 정지 낱말/.test(x.글));
  assert.deepEqual(걸려야.filter((문장, i) => !정지(`걸${i}`).length), [], '사람 정지인데 안 걸린 문장(미탐)');
  assert.deepEqual(안걸려야.filter((문장, i) => 정지(`안${i}`).length), [], '물건 · 부정인데 걸린 문장(오탐)');
  // 사람 기척이 없는 판은 사람 연기 걸림(정지 말 · 박자)이 하나도 없다 — 받을 복수 물건이 없는 they와 이름만 쓴 판은 풀지 않는다
  assert.deepEqual(물건판.filter((문장, i) => r.항목들.some((x) => x.항목 === '연기' && x.컷 === `물${i}` && x.등급 === '걸림')), [], '사람 없는 판인데 걸린 문장(오탐)');
  assert.deepEqual(물건판걸림.filter((문장, i) => !정지(`물걸${i}`).length), [], '사람 기척이 있거나 they가 받을 물건이 없는 판인데 안 걸린 문장(미탐)');
});

test('지시문 — 사람이 나오는 판인지: 이름만 쓴 연기 · WHO 칸 · 풀어 쓴 글도 사람 판이고, 「No people」 제품 판 · PHYSICS 줄 · 소문자 Action:은 뜻대로, 판 길이 「4 s clip」은 박자가 아니다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 글 = {
    이름만: 'ACTION: Sua stands by the stove and looks at the pot.',
    who정지: 'WHO: Sua exactly as in the first frame, standing perfectly still.\nACTION: at about 0.4 s Sua blinks; at about 1.5 s Sua looks up.',
    풀어쓴정지: 'Sua stands perfectly still by the stove.',
    판길이: 'ACTION: for the whole 4 s clip she smiles at the lens.',
    소문자: 'Action: at about 0.4 s she lifts the cup; at about 1.5 s she sips.',
    제품: 'Macro shot of the can on wet stone. No people.\nACTION: The can and its pull tab stay perfectly still while condensation runs down the side.\nCAMERA: a slow push-in of 4% from 0 s to 3.5 s.',
    물리줄: 'ACTION: at about 0.4 s she lifts the cup; at about 1.5 s she sips.\nPHYSICS: the odd gizmo stays perfectly still; the door stays exactly where it is.',
    물건이름줄: 'KNIT: her cream fine-knit sweater — small, even knit loops.\nACTION: An extreme close-up of the sweater lying in soft folds. The knit stays still; no person, no hands.\nCAMERA: macro, smooth.',
    소유격: 'ACTION: From the driver\'s seat, looking out of the open side window: the round side mirror on its steel arm; the trailer follows behind, steady.',
    동물: 'ACTION: On a windy beach, the dog stands sideways; the wind tosses its mohawk. Blue waves roll in behind it.',
    // 셋째 검수 — 이름만 쓴 사람의 다른 꼴 · 박자가 아닌 초 · 칸 밖의 사람 정지 · 장면 전체를 멈추는 말
    이름진행: 'ACTION: Sua is standing by the stove, looking at the pot.',
    이름둘: 'ACTION: Sua and Minjae walk to the door.',
    이름전치사: 'ACTION: Sua in a grey hoodie stands by the stove.',
    이름삽입: 'ACTION: Sua, tired, stands by the stove.',
    길이: 'ACTION: she holds the cup and smiles for 4 seconds.',
    나이: 'ACTION: a Korean woman in 20s smiles at the lens.',
    물리줄사람: 'ACTION: at about 0.4 s she lifts the cup; at about 1.5 s she sips.\nPHYSICS: she stays perfectly still; her hands do not move.',
    노트줄: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nNOTE: the model holds the pose and does not move.',
    룩줄: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nCAMERA: static.\nLOOK: natural light. She stays perfectly still, like a statue.',
    머리글: '@이미지 1 is the exact first frame of this video. She stands perfectly still throughout.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nCAMERA: static.',
    샷글: 'TWO SHOTS of the same hallway, ONE hard cut at 2.0 s.\nSHOT 1 (0–2 s): she stands frozen at the door, motionless.\nSHOT 2 (2–4 s): he sits perfectly still at the desk.\nCAMERA: locked off.',
    한쪽샷: 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0–2 s) she stands frozen at the door. CAMERA: locked off.\nSHOT 2 (2–4 s) ACTION: at about 2.4 s he exhales; at about 3.1 s he looks up. CAMERA: locked off.',
    모르는라벨: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nEND: holds the final pose, perfectly still.',
    밑줄라벨: 'HARIN_FACE: the same woman, expressionless.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.',
    카메라줄: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nCAMERA: handheld, close on her face, almost still: from 0 s to 2 s it drifts 1% (so his eyes sink a little); from 1.6 s it holds still.',
    장면전체: 'ACTION: the liquid soaks quietly into the ground and everything is still. No other movement.',
    빈글: '   \n',
    // 넷째 검수 — 사람 판의 증거는 확실한 것만: WHO 칸 · 사람 이름 줄은 증거, they · 물건을 꾸미는 사람 낱말 · 보통 낱말 + 동사 · 「WHO: no people」 · 그림 속 사람은 아니다
    who만: 'WHO: Sua, mid-20s.\nACTION: steam rises from the bowl.',
    이름줄: 'YUNA: the same woman as in the first frame.\nACTION: steam rises from the bowl.',
    who없음: 'WHO: no people in this shot.\nACTION: steam rises from the bowl.',
    약한they: 'ACTION: Top-down still life: two lunchboxes on the light-oak table, wooden lids and chopsticks beside them; thin wisps of steam rise as they cool.',
    약한낱말: 'ACTION: The passenger door clicks shut; the driver mirror folds in beside the wheel guard and the phone speaker; twin burners glow under the crew neck sweater on the rack.',
    // 물건으로도 읽히는 사람 낱말(model · speaker)이 사람 자리에 있으면 표 없는 판에서는 사람 판으로 본다(약한 증거) — 틀리면 그 판에 "인물": []
    약한증거: 'ACTION: A portable speaker plays on the shelf and the new model turns on the turntable.',
    모델: 'ACTION: The model turns toward the window and smiles.',
    그들산동사: 'ACTION: They walk along the river holding umbrellas; they stop and look at each other.',
    소유격몸: "ACTION: The woman's eyes open; the woman's lips part.",
    나란히: 'ACTION: Two friends side by side on a bench; one points at the sky.',
    화면속: 'ACTION: The phone on the table shows a man waving.',
    사진꼴: 'ACTION: A photo of a woman laughing at a café table, steam rising from the cup.',
    이름겹침: 'ACTION: Sua steps forward and smiles. Minjae stops short and stares.',
    이름사역: 'ACTION: The camera lets Sua smile and turn.',
    보통낱말: 'ACTION: Autumn leaves drift across the wet pavement. Gentle waves roll onto the sand. Overhead look at the table. Snowflakes dance in the lamplight. Energy drinks line the shelf.',
    부사: 'ACTION: Extremely close on the upright clear-ice sculpture where its two thick legs split apart: the ice does not move or melt, only tiny glints catch the light.',
    그림속: 'ACTION: Close on the fridge door: a photo sticker stuck on the outside of the glass door shows a smiling young woman; bottles of milk stand in cold white light.',
    // 박자는 사람의 것만 센다 — 물건 · 날씨의 박자 · 길이 「for about 2 s」 · 「about 4 s long」은 사람 연기의 박자가 아니다. 주어를 줄인 박자는 센다
    물건박자: 'ACTION: at about 0.5 s rain pours off the awning; she watches the street.',
    길이2: 'ACTION: she smiles for about 2 s.',
    긴판: 'ACTION: she smiles at the lens; the take is about 4 s long.',
    판길이2: 'ACTION: over the 4 s of the take she sits by the window; within the 4 seconds of the shot she breathes.',
    길이3: 'ACTION: in about 4 s cut she smiles; in about 4 s edit she nods.',
    줄인주어: 'WHO: Sua.\nACTION: - 0.5 s: looks up\n- 1.5 s: smiles',
    // 열린 쪽 — 사람에게만 쓰는 말은 주어가 없어도 걸고, 화면 결 · 카메라 · 물건의 말은 걸지 않는다
    노트그녀: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nNOTE: Keep her perfectly still.',
    룩자세: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nLOOK: soft daylight. Holds the pose to the end.',
    조각상: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nNOTE: Perfectly still throughout, like a statue.',
    물리그들: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nPHYSICS: they barely move.',
    물리물건: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nPHYSICS: the bottles stand on the shelf; they stay still. The can stays perfectly still.',
    머리명령: 'ONE SINGLE CONTINUOUS SHOT. Hold still for the whole clip.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.',
    첫장줄: '@이미지 1 is the exact first frame of this video and she holds this pose without moving to the last frame.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.',
    룩결: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nCAMERA: hold still on her face; a 4% push-in at an even speed, no other movement.\nLOOK: the light and colour stay exactly like this to the last frame.',
    // 다섯째 검수 — 곁 칸(NOTE · LOOK · PHYSICS · 머리 글)의 주어 없는 정지 말 · 장면 전체 말도 사람 판에서는 걸린다. 드러난 모르는 주어(the odd gizmo)만 물건으로 봐 준다
    노트명령: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nNOTE: Hold perfectly still for the whole clip.',
    노트장면: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nNOTE: Nothing moves.',
    룩빈: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nLOOK: quiet evening light. Perfectly still to the end.',
    물리빈: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nPHYSICS: completely motionless.',
    물리그들단수: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nPHYSICS: Rain pours off the awning. They barely move.',
    카메라사람: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nCAMERA: static. The talent holds perfectly still.',
    머리명령2: '@이미지 1 is the exact first frame of this video. Stay perfectly still from the first frame to the last.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.',
    // 사람 없는 판(기척이 전혀 없다)의 곁 칸 — 주어 없는 정지 말은 물건의 것이다
    제품노트: 'ACTION: The can sits on crushed ice; at about 1.0 s one drop runs down its side.\nNOTE: Perfectly still throughout. Nothing moves.',
    // 칸 — 한글 이름 줄 · 문장 끝 뒤에 이어 쓴 「Camera:」 · 줄바꿈으로 접힌 문장
    한글이름줄: '유나: the same woman, standing motionless.\nACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.',
    // 문장 끝 뒤의 소문자 라벨(Camera: · Note: · Sound:)은 칸으로 읽지 않는다 — 읽으면 ACTION 안의 정지 말이 그 뒤로 숨는다(다섯째 검수)
    줄안카메라: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up. Camera: locked off, perfectly still.',
    줄안소리: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up. Sound: a soft click. Then stands perfectly still to the end.',
    줄넘김: 'ACTION: at about 0.5 s she blinks; at about 1.4 s she looks up.\nThe kettle steaming on the stove\nperfectly still to the end.',
    접힌줄: 'ACTION: at about 0.5 s she looks up; then she stands perfectly\nstill until the end.',
    // 두 샷 판 — 장면 전체를 멈추는 말은 사람이 나오는 판이면 어느 샷의 ACTION에서든 사람 정지다(사람 샷이 「Same framing. Nothing moves.」라고만 써도 지나가지 않게).
    //   물건 끼움 샷은 주어를 밝혀 쓴다(「the sheet lies still」)
    끼움샷: 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0–2 s) ACTION: at about 0.5 s she looks down at the sheet; at about 1.2 s she exhales. CAMERA: static.\nSHOT 2 (2–4 s) ACTION: A close-up of the sheet of paper on the table; it lies still. CAMERA: static.',
    같은구도샷: 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0–2 s) ACTION: at about 0.5 s she looks down at the sheet; at about 1.2 s she exhales. CAMERA: static.\nSHOT 2 (2–4 s) ACTION: Same framing, closer. Nothing moves. CAMERA: static.',
    // 사람 낱말 뒤의 물건 낱말이 동사로도 읽히면 증거다(「the woman signs the paper」 · 「the men pack the bags」) — 물건을 꾸미는 자리(「the driver mirror folds in」)만 넘긴다
    동사인물건: 'ACTION: the woman signs the paper and the men pack the bags.',
    사람샷: 'TWO SHOTS, ONE hard cut at 2.0 s.\nSHOT 1 (0–2 s) ACTION: A close-up of the sheet of paper on the table; it lies still. CAMERA: static.\nSHOT 2 (2–4 s) ACTION: at about 2.5 s he lowers his hand. Nothing else moves. CAMERA: static.',
  };
  const 파일 = Object.entries(글).map(([이름, t]) => 쓰기(dir, `${이름}.txt`, t));
  const r = 돌리기(['지시문', ...파일]);
  const 연기 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름 && x.등급 === '걸림').map((x) => x.글);
  assert.equal(연기('이름만').length, 1, '대명사가 없어도 「이름 + 연기 동사」면 사람 판이다');
  assert.match(연기('이름만')[0], /시간 박자 없음/);
  assert.equal(연기('who정지').length, 1);
  assert.match(연기('who정지')[0], /「perfectly still」\(WHO\)/);
  assert.deepEqual(연기('풀어쓴정지').map((g) => (g.match(/「.+?」\(본문\)|ACTION: 칸이 없다/) || [])[0]), ['「perfectly still」(본문)', 'ACTION: 칸이 없다']);
  assert.equal(연기('판길이').length, 1, '「for the whole 4 s clip」은 몇 초에 무엇을 하는지가 아니다');
  assert.match(연기('판길이')[0], /시간 박자 없음/);
  for (const 이름 of ['소문자', '제품', '물리줄', '물건이름줄', '소유격', '동물', '카메라줄', '장면전체']) assert.deepEqual(연기(이름), [], `${이름}: ${글[이름]}`);
  // 이름만 쓴 사람(진행형 · 둘 · 전치사구 · 삽입) · 길이 「for 4 seconds」 · 나이 「in 20s」 — 모두 사람 판이고 박자가 없다
  for (const 이름 of ['이름진행', '이름둘', '이름전치사', '이름삽입', '길이', '나이']) {
    assert.equal(연기(이름).length, 1, `${이름}: ${JSON.stringify(연기(이름))}`);
    assert.match(연기(이름)[0], /시간 박자 없음/, 이름);
  }
  // 사람을 멈추는 말은 ACTION 밖 어느 칸에 써도 걸린다 — 걸린 문장을 PHYSICS · NOTE 줄로 옮겨도 지나가지 않는다
  assert.deepEqual(연기('물리줄사람').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「do not move」(PHYSICS)', '「perfectly still」(PHYSICS)']);
  assert.deepEqual(연기('노트줄').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「does not move」(NOTE)', '「holds the pose」(NOTE)']);
  assert.deepEqual(연기('룩줄').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「like a statue」(LOOK)', '「perfectly still」(LOOK)']);
  assert.deepEqual(연기('머리글').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「perfectly still」(본문)']);
  assert.deepEqual(연기('모르는라벨').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「holds the final pose」(END)', '「perfectly still」(END)']);
  assert.deepEqual(연기('밑줄라벨').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「expressionless」(HARIN_FACE)']);
  // ACTION 라벨 없이 SHOT 줄에 바로 쓴 연기 — 정지 말을 걸고, ACTION 칸이 없다는 것도 건다. 한쪽 샷만 라벨이 없어도 그 줄의 정지 말은 걸린다
  assert.deepEqual(연기('샷글').map((g) => (g.match(/「.+?」\(.+?\)|ACTION: 칸이 없다/) || [])[0]), ['「frozen」(SHOT 1)', '「motionless」(SHOT 1)', '「perfectly still」(SHOT 2)', 'ACTION: 칸이 없다']);
  assert.deepEqual(연기('한쪽샷').map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]), ['「frozen」(SHOT 1)']);
  // 빈 지시문은 걸림이다(내기 도구와 같다)
  assert.deepEqual(r.항목들.filter((x) => x.컷 === '빈글').map((x) => `${x.항목} ${x.등급}`), ['지시문 걸림']);
  // 넷째 검수 — 증거: WHO 칸 · 사람 이름 줄만으로도 사람 판(박자 없음), 약한 말만 있는 판은 사람 판이 아니다
  //   다섯째 검수 — 좁히다 빠진 증거를 되돌렸다: model 같은 낱말(표 없는 판의 약한 증거) · they + 산 것만 하는 동사 · 소유격 + 몸 · 「side by side」 · 화면 속 사람 · 「A photo of a woman」 · 이름 + 겹치는 꼴 · 사역
  for (const 이름 of ['who만', '이름줄', '약한증거', '모델', '그들산동사', '소유격몸', '나란히', '화면속', '사진꼴', '이름겹침', '이름사역']) {
    assert.equal(연기(이름).length, 1, `${이름}: ${JSON.stringify(연기(이름))}`);
    assert.match(연기(이름)[0], /시간 박자 없음/, 이름);
  }
  for (const 이름 of ['who없음', '약한they', '약한낱말', '보통낱말', '부사', '그림속', '제품노트']) assert.deepEqual(연기(이름), [], `${이름}: ${글[이름]}`);
  // 박자
  for (const 이름 of ['물건박자', '길이2', '긴판', '판길이2', '길이3']) {
    assert.equal(연기(이름).length, 1, `${이름}: ${JSON.stringify(연기(이름))}`);
    assert.match(연기(이름)[0], /시간 박자 없음/, 이름);
  }
  assert.deepEqual(연기('줄인주어'), [], '주어를 줄인 박자(「0.5 s: looks up」)는 사람의 박자로 센다');
  // 열린 쪽
  const 낱말 = (이름) => 연기(이름).map((g) => (g.match(/「.+?」\(.+?\)/) || [])[0]);
  assert.deepEqual(낱말('노트그녀'), ['「keep her perfectly still」(NOTE)']);
  assert.deepEqual(낱말('룩자세'), ['「holds the pose」(LOOK)']);
  assert.deepEqual(낱말('조각상'), ['「like a statue」(NOTE)', '「perfectly still」(NOTE)']);
  assert.deepEqual(낱말('물리그들'), ['「barely move」(PHYSICS)']);
  assert.deepEqual(낱말('머리명령'), ['「hold still」(본문)']);
  assert.deepEqual(낱말('첫장줄'), ['「holds this pose」(본문)', '「without moving」(본문)']);
  for (const 이름 of ['물리물건', '룩결', '끼움샷']) assert.deepEqual(연기(이름), [], `${이름}: ${글[이름]}`);
  assert.deepEqual(낱말('노트명령'), ['「perfectly still」(NOTE)']);
  assert.deepEqual(낱말('노트장면'), ['「nothing moves」(NOTE)']);
  assert.deepEqual(낱말('룩빈'), ['「perfectly still」(LOOK)']);
  assert.deepEqual(낱말('물리빈'), ['「motionless」(PHYSICS)']);
  assert.deepEqual(낱말('물리그들단수'), ['「barely move」(PHYSICS)']);
  assert.deepEqual(낱말('카메라사람'), ['「perfectly still」(CAMERA)']);
  assert.deepEqual(낱말('머리명령2'), ['「perfectly still」(본문)']);
  for (const 이름 of ['줄안카메라', '줄안소리', '줄넘김']) assert.deepEqual(낱말(이름), ['「perfectly still」(ACTION)'], 이름);
  assert.deepEqual(낱말('한글이름줄'), ['「motionless」(유나)']);
  assert.deepEqual(낱말('접힌줄'), ['「perfectly still」(ACTION)']);
  assert.deepEqual(낱말('사람샷'), ['「nothing else moves」(ACTION)']);
  assert.deepEqual(낱말('같은구도샷'), ['「nothing moves」(ACTION)']);
  assert.equal(연기('동사인물건').length, 1, JSON.stringify(연기('동사인물건')));
  assert.match(연기('동사인물건')[0], /시간 박자 없음/);
});

test('컷표 없는 편 — _순서.json 판의 「인물」: 이름을 적으면 글에 사람 낱말이 없어도 사람 판이고, []인데 글에 사람이 나오면 걸림(--지시문 · 굽기전), 빈 지시문 파일은 내지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 맨 = (연기) => ['@이미지 1 is the exact first frame of this video.', `ACTION: ${연기}`, 'CAMERA: static frame.', 'SOUND: No sound.'].join('\n');
  const pack = 꾸러미만들기2(dir, [
    { id: 'S1', 글: 맨('steam rises from the pot and the lid rattles.'), 더: { 인물: ['수아'] } },
    { id: 'S2', 글: 맨('steam rises from the pot and the lid rattles.') },
    { id: 'S3', 글: 맨('at about 0.5 s the two customers stand perfectly still at the counter.'), 더: { 인물: [] } },
    { id: 'S4', 글: '' },
  ]);
  const r = 돌리기(['지시문', pack]);
  assert.equal(r.코드, 1);
  const 걸림 = (이름) => r.항목들.filter((x) => x.컷 === 이름 && x.등급 === '걸림').map((x) => x.글);
  assert.equal(걸림('S1').length, 1);
  assert.match(걸림('S1')[0], /시간 박자 없음/);
  assert.deepEqual(걸림('S2'), [], '표도 증거도 없는 판은 박자를 요구하지 않는다');
  assert.equal(걸림('S3').length, 2, JSON.stringify(걸림('S3')));
  assert.match(걸림('S3').join(' '), /컷표에는 사람 없는 컷\(인물: \[\]\)인데 지시문에 사람이 나온다.*사람 정지 낱말 「perfectly still」/);
  assert.match(걸림('S4')[0], /지시문이 비었다/);
  const g = 굽기전('함수', pack);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ S1: \(연기\) 사람 연기에 시간 박자 없음/);
  assert.match(g.stdout, /✗ S3: \(연기\) 컷표에는 사람 없는 컷/);
  assert.match(g.stdout, /✗ S3: \(연기\) 사람 정지 낱말 「perfectly still」/);
  assert.match(g.stdout, /✗ S4: 지시문이 비었다/);
  assert.ok(!/✗ S2: /.test(g.stdout), g.stdout);
  assert.match(g.stdout, /지시문 검사: 걸림 4 /);
});

const 두샷 = (연기1, 연기2) => [
  'TWO SHOTS of real smartphone footage, joined by ONE hard cut at 1.9 s — the same moment in the same place.',
  `SHOT 1 (0–1.9 s) begins exactly on @이미지 1 — same framing, light and colors. ACTION: ${연기1} CAMERA: almost still: from 0 s to 1.9 s it drifts right about 1%, fast at first and easing to almost still.`,
  `SHOT 2 (1.9 s to the end) begins exactly on @이미지 2 — same framing, light and colors. ACTION: ${연기2} CAMERA: locked off on a tripod, perfectly still.`,
  'LOOK: true-to-life colors and natural daylight; no extra people or animals.',
  'SOUND: silent clip — no dialogue.',
].join('\n');

test('지시문 — 한 줄에 이어 쓴 두 샷 판: CAMERA 칸의 「almost still」은 ACTION으로 새지 않고, 샷 머리 「(0–1.9 s)」와 CAMERA의 초는 사람 연기의 박자가 아니다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 좋은 = 쓰기(dir, '좋은.txt', 두샷('At about 0.4 s Minjae lifts the dog by the two vest handles; at about 1.2 s he grins.', 'At about 2.3 s he looks down at the dog.'));
  const 박자없는 = 쓰기(dir, '박자없는.txt', 두샷('Minjae holds the dog up by the two vest handles like a handbag.', 'The dog hangs calmly and he looks down at it.'));
  const r = 돌리기(['지시문', 좋은, 박자없는]);
  const 연기 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름 && x.등급 === '걸림').map((x) => x.글);
  assert.deepEqual(연기('좋은'), [], '카메라를 멈추는 말은 CAMERA 칸에 있다');
  assert.equal(연기('박자없는').length, 1);
  assert.match(연기('박자없는')[0], /시간 박자 없음/);
});

// _순서.json 판에 칸을 더 적는 꾸러미(컷 · 방식 · 소리만 · 인물)
function 꾸러미만들기2(dir, 판들, 이름 = '꾸러미') {
  const pack = 꾸러미만들기(dir, 판들, 이름);
  const p = path.join(pack, '_순서.json');
  const 순서 = JSON.parse(fs.readFileSync(p, 'utf8')).map((x, i) => ({ ...x, ...(판들[i].더 || {}) }));
  fs.writeFileSync(p, JSON.stringify(순서), 'utf8');
  return pack;
}
// 사람 낱말이 하나도 없는 판 — 사람이 나오는지는 컷표가 정한다
const 맨글 = (연기) => ['@이미지 1 is the exact first frame of this video.', `ACTION: ${연기}`, 'CAMERA: static frame.', `LOOK: ${빛문장} No new text.`,
  'Indoors: the air is clear and still, nothing falls or drifts anywhere.', 'SOUND: No sound.'].join('\n');
const 목소리글 = ['@이미지 1 is the exact first frame of this video.', 'ACTION: She looks just past the camera and says in Korean: "오늘은 일찍 잘 것 같아." Everyone else in the frame keeps still with lips closed.',
  'CAMERA: static frame.', 'SOUND: only her natural speaking voice saying this one Korean line, over quiet room tone.'].join('\n');

test('틀 2 — 사람이 나오는 판인지는 컷표의 「인물」이 먼저 정한다: 인물이 있는 컷은 대명사가 없어도 박자 둘을 요구하고, 인물 []인 컷도 정지 말은 그대로 보며(아는 물건 · PHYSICS 줄은 통과), []인데 지시문에 사람이 나오면 걸림(--지시문 · 굽기전 같은 판정)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 편 = path.join(dir, '편'); fs.mkdirSync(편);
  쓰기(편, '컷표.json', JSON.stringify(틀읽기()));
  const pack = 꾸러미만들기(편, [
    { id: 'C1', 글: 맨글('steam rises from the pot and the lid rattles.') },   // 수아가 나오는 컷 — 글에는 사람 낱말이 없다
    // 사람 없는 컷 — 아는 물건의 정지는 ACTION에 써도 되고, 모르는 물건(gizmo)의 정지는 PHYSICS 줄에 쓴다
    { id: 'C4', 글: `${맨글('at about 2.0 s two pairs of chopsticks settle on the bowls; the bowls stay perfectly still.')}\nPHYSICS: the odd gizmo stays perfectly still.` },
    { id: 'rm-C4', 글: 맨글('at about 1.0 s she sets the chopsticks down beside the bowls.') },   // 표는 사람 없음인데 사람이 나온다
    { id: 'C2', 글: 지시문글({ 연기: 'at about 0.8 s she turns her head toward the door and her eyebrows lift.' }) },   // 표의 연기 박자는 둘인데 지시문에는 하나
    // 표는 사람 없음([])인데 손님 · 이름 · 「Everyone else」가 멈춰 있다 — []라고 정지 말을 건너뛰지 않는다(셋째 검수)
    { id: 'x1-C4', 글: 맨글('at about 0.5 s the two customers stand perfectly still at the counter.') },
    { id: 'x2-C4', 글: 맨글('Sua stays frozen by the stove, expressionless.') },
    { id: 'x3-C4', 글: 맨글('Everyone else in the frame keeps still with lips closed.') },
    { id: 'x4-C4', 글: 맨글('at about 0.5 s the others stay still.') },   // 글에서도 사람인지 모르는 주어 — 그래도 정지 말은 닫힌 쪽으로 건다
    // 넷째 검수 — []라고 밝힌 컷은 약한 말(them · 상품 이름 + 동사 · 물건을 꾸미는 사람 낱말)로는 어긋남을 걸지 않는다
    { id: 'y1-C4', 글: 맨글('at about 2.0 s two pairs of chopsticks settle on the bowls beside them; Omitok sits on the counter by the passenger door.') },
    //   model · speaker 같은 약한 말로도 어긋남은 걸지 않지만, 그런 판은 사람 없는 판으로 믿지도 않는다 — 주어 없는 정지 말은 걸린다
    { id: 'y2-C4', 글: 맨글('at about 2.0 s the new model turns on the turntable beside the portable speaker.') },
    { id: 'y3-C4', 글: 맨글('The model sits by the window, the kettle steaming, perfectly still.') },
    // 컷표에 이어진 사람 판 — 범위는 한 박자, 물건의 박자는 사람의 박자가 아니다, 물건 절 뒤의 주어 없는 정지 말은 사람이다
    { id: 'z1-C2', 글: 지시문글({ 연기: 'from 0.8 s to 2.0 s she turns her head toward the door and her eyebrows lift.' }) },
    { id: 'z2-C2', 글: 지시문글({ 연기: 'at about 0.8 s she turns her head toward the door; at about 1.6 s the kettle clicks off.' }) },
    { id: 'z3-C1', 글: 맨글('at about 0.4 s Sua sets the pot on the stove; at about 1.6 s Sua breathes out, shoulders dropping; the kettle steams. Perfectly still to the end.') },
    // 박자로 세는 꼴 — 틀의 「at about N s」 밖의 흔한 꼴도 센다(덜 세면 사람 판을 잘못 막는다)
    { id: 'z4-C2', 글: 지시문글({ 연기: 'at ~0.8 s she turns her head toward the door; [1.8 s] her eyebrows lift.' }) },
    { id: 'z5-C2', 글: 지시문글({ 연기: 'at about 0.8 s, 1.4 s and 2.0 s she blinks, her head turning toward the door.' }) },
    { id: 'z6-C2', 글: 지시문글({ 연기: 'at the 1-second mark she turns her head toward the door; from 1.5~2.0 s her eyebrows lift.' }) },
    // 다섯째 검수 — 컷표에 이어진 인물 판에서 두 관문을 걸림 0으로 지나가던 꼴(풀어 주는 갈래를 걷은 자리): 줄을 넘긴 주어 없는 절 · 문장 끝 뒤의 소문자 라벨 · too · 꾸밈 자리의 still ·
    //   NOTE 줄의 명령 · 잠깐 예외 · 물건의 박자만 있는 ACTION · 쉼표 나열의 사람
    { id: 'w1-C2', 글: 지시문글({ 연기: `${좋은연기}\nThe kettle steaming on the stove\nperfectly still to the end.` }) },
    { id: 'w2-C2', 글: 지시문글({ 연기: `${좋은연기} Note: otherwise perfectly still.` }) },
    { id: 'w3-C2', 글: 지시문글({ 연기: `${좋은연기}; she too stands perfectly still.` }) },
    { id: 'w4-C2', 글: 지시문글({ 연기: `${좋은연기}; a perfectly still shot of her face.` }) },
    { id: 'w5-C2', 글: `${지시문글()}\nNOTE: Hold perfectly still for the whole clip.` },
    { id: 'w6-C2', 글: 지시문글({ 연기: `${좋은연기}; she freezes, then she just stares at the door until the cut.` }) },
    { id: 'w7-C2', 글: 지시문글({ 연기: 'at about 0.4 s the lamp flickers behind her; at about 1.6 s the kettle clicks off beside her.' }) },
    { id: 'w8-C2', 글: 지시문글({ 연기: `${좋은연기}; Sua, the pot and the bowls stay perfectly still.` }) },
  ]);
  // 표가 없으면 C1 글은 사람 증거가 없어 지나간다(짐작으로는 못 잡는다 — 그래서 표가 정한다)
  const 맨 = 돌리기(['지시문', path.join(pack, '001_C1', '지시문.txt')]);
  assert.deepEqual(맨.항목들.filter((x) => x.항목 === '연기'), []);
  const r = 틀돌리기(null, ['--지시문', pack], 편);
  assert.equal(r.코드, 1);
  const 연기 = (이름) => r.항목들.filter((x) => x.항목 === '연기' && x.컷 === 이름 && x.등급 === '걸림').map((x) => x.글);
  assert.equal(연기('C1').length, 1);
  assert.match(연기('C1')[0], /시간 박자 없음/);
  assert.deepEqual(연기('C4'), [], '사람 없는 컷 — 아는 물건의 정지와 PHYSICS 줄의 물건 정지는 걸지 않는다');
  assert.equal(연기('rm-C4').length, 1);
  assert.match(연기('rm-C4')[0], /컷표에는 사람 없는 컷\(인물: \[\]\)인데 지시문에 사람이 나온다/);
  // 컷표에 이어진 사람 판은 ACTION 박자가 둘 이상이어야 한다 — 표의 「연기」를 그대로 옮겼는지(표 없이는 하나여도 지나간다)
  assert.equal(연기('C2').length, 1);
  assert.match(연기('C2')[0], /사람 연기 박자가 1개뿐 — 컷표 「연기」의 박자\(둘 이상\)를 ACTION에 초와 함께 그대로 옮긴다/);
  const 표없이 = 돌리기(['지시문', path.join(pack, '004_C2', '지시문.txt')]);
  assert.deepEqual(표없이.항목들.filter((x) => x.항목 === '연기' && x.등급 === '걸림'), []);
  // 인물 []인 컷의 사람 정지 — 표 어긋남과 정지 말이 함께 걸린다. 이름만 쓴 x2 · 글의 증거가 없는 x4는 정지 말만(이름은 상품 이름일 수 있어 어긋남을 걸지 않는다)
  assert.match(연기('x1-C4').join(' '), /사람 없는 컷.*「perfectly still」/);
  assert.deepEqual(연기('x2-C4').map((g) => (g.match(/「.+?」/) || [])[0]), ['「expressionless」', '「frozen」']);
  assert.match(연기('x3-C4').join(' '), /사람 없는 컷.*「keeps still」/);
  assert.deepEqual(연기('x4-C4').map((g) => (g.match(/「.+?」/) || [])[0]), ['「stay still」']);
  assert.deepEqual(연기('y1-C4'), [], '[]라고 밝힌 컷은 them · 상품 이름 · 「passenger door」로 막지 않는다');
  assert.deepEqual(연기('y2-C4'), [], '[]라고 밝힌 컷은 「the new model」 · 「portable speaker」로도 막지 않는다');
  assert.deepEqual(연기('y3-C4').map((g) => (g.match(/「.+?」/) || [])[0]), ['「perfectly still」'], '「the model sits …」가 있는 [] 컷은 사람 없는 판으로 믿지 않는다');
  for (const 이름 of ['z1-C2', 'z2-C2']) {
    assert.equal(연기(이름).length, 1, `${이름}: ${JSON.stringify(연기(이름))}`);
    assert.match(연기(이름)[0], /사람 연기 박자가 1개뿐/, 이름);
  }
  assert.deepEqual(연기('z3-C1').map((g) => (g.match(/「.+?」/) || [])[0]), ['「perfectly still」'], '사람이 나오는 판에서는 물건 절 뒤의 주어 없는 정지 말을 물건으로 풀지 않는다');
  for (const 이름 of ['z4-C2', 'z5-C2', 'z6-C2']) assert.deepEqual(연기(이름), [], `${이름}: 박자 둘 이상으로 세어야 한다`);
  const 다섯째 = { 'w1-C2': /「perfectly still」\(ACTION\)/, 'w2-C2': /「perfectly still」\(ACTION\)/, 'w3-C2': /「perfectly still」\(ACTION\)/, 'w4-C2': /「perfectly still」\(ACTION\)/,
    'w5-C2': /「perfectly still」\(NOTE\)/, 'w6-C2': /「freezes」\(ACTION\)/, 'w7-C2': /사람 연기에 시간 박자 없음/, 'w8-C2': /「perfectly still」\(ACTION\)/ };
  for (const [이름, 무늬] of Object.entries(다섯째)) {
    assert.equal(연기(이름).length, 1, `${이름}: ${JSON.stringify(연기(이름))}`);
    assert.match(연기(이름)[0], 무늬, 이름);
  }
  const g = 굽기전('함수', pack);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ C1: \(연기\) 사람 연기에 시간 박자 없음/);
  assert.match(g.stdout, /✗ rm-C4: \(연기\) 컷표에는 사람 없는 컷/);
  assert.match(g.stdout, /✗ C2: \(연기\) 사람 연기 박자가 1개뿐/);
  assert.match(g.stdout, /✗ x1-C4: \(연기\) 사람 정지 낱말 「perfectly still」/);
  assert.match(g.stdout, /✗ x4-C4: \(연기\) 사람 정지 낱말 「stay still」/);
  assert.match(g.stdout, /✗ w2-C2: \(연기\) 사람 정지 낱말 「perfectly still」\(ACTION\)/);
  assert.match(g.stdout, /✗ w7-C2: \(연기\) 사람 연기에 시간 박자 없음/);
  assert.ok(!/✗ C4: /.test(g.stdout), g.stdout);
  // --지시문과 굽기전()의 걸림 수가 같다(두 관문이 같은 판정이다)
  const 수 = r.항목들.filter((x) => ['지시문', '연기'].includes(x.항목) && x.등급 === '걸림').length;
  assert.match(g.stdout, new RegExp(`지시문 검사: 걸림 ${수} `));
});

test('틀 2 — 대안 판은 _순서.json의 "컷"으로 컷에 잇고, 소리만 쓰는 판("방식": "목소리 판" · "소리만": true)은 컷표에 없어도 되고 사람 연기를 보지 않는다(--지시문 · 굽기전)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 편 = path.join(dir, '편'); fs.mkdirSync(편);
  쓰기(편, '컷표.json', JSON.stringify(틀읽기()));
  const pack = 꾸러미만들기2(편, [
    { id: 'C2b', 글: 지시문글(), 더: { 컷: ['C2'] } },
    { id: '수아-목소리', 글: 목소리글, 더: { 방식: '목소리 판' } },
    { id: 'C3-말', 글: 목소리글, 더: { 소리만: true } },
  ]);
  const r = 틀돌리기(null, ['--지시문', pack], 편);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => !['통과', '알림'].includes(x.등급))));
  assert.deepEqual(r.항목들.filter((x) => x.항목 === '지시문' && x.등급 === '알림').map((x) => `${x.컷}: ${x.글}`),
    ['수아-목소리: 소리만 쓰는 판 — 사람 연기 · 컷표 대조 건너뜀', 'C3-말: 소리만 쓰는 판 — 사람 연기 · 컷표 대조 건너뜀']);
  const g = 굽기전('함수', pack);
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.match(g.stdout, /· 수아-목소리: 소리만 쓰는 판 — 사람 연기 · 컷표 대조 건너뜀/);
  assert.match(g.stdout, /지시문 검사: 걸림 0 · 주의 0/);
  // 대안 판의 빛 문장도 그 컷 장면과 견준다 · "컷"도 "소리만"도 없는 낯선 판은 그대로 걸림 · 소리만이 아닌 판의 「keeps still」은 사람 정지다
  const 나쁜 = 꾸러미만들기2(편, [
    { id: 'C2b', 글: 지시문글({ 빛: 빛문장.replace('warm', 'cold') }), 더: { 컷: ['C2'] } },
    { id: 'C2c', 글: 지시문글() },
    { id: 'C1', 글: `${목소리글}\nLOOK: ${빛문장}\nIndoors: the air is clear and still, nothing falls or drifts anywhere.` },
  ], '나쁜');
  const r2 = 틀돌리기(null, ['--지시문', 나쁜], 편);
  assert.equal(r2.코드, 1);
  assert.match(걸림글(r2, '지시문').find((g2) => g2.startsWith('C2b')), /^C2b: \(빛\) 장면의 빛 문장이 표와 다르다/);
  assert.match(걸림글(r2, '지시문').find((g2) => g2.startsWith('C2c')), /^C2c: \(컷표\) 컷표에 없는 판 — .*"컷": \["<컷 이름>"\].*"소리만": true/);
  assert.ok(걸림글(r2, '연기').some((g2) => /^C1: 사람 정지 낱말 「keeps still」\(ACTION\)/.test(g2)), JSON.stringify(걸림글(r2, '연기')));
});

test('내기 도구 — 굽기전(): --걸림무시 "<판 id>,<판 id>: <까닭>"은 그 판의 걸림만 넘긴다(다른 판의 걸림이 남으면 멈춘다 · 없는 판 이름은 거절 · 컷표의 걸림은 「컷표」 · 「모두:」)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 나쁜 = 꾸러미만들기(dir, [{ id: 'C1', 글: 굳은글 }, { id: 'C2', 글: 지시문글() }, { id: 'C3', 글: 굳은글 }], '나쁜');
  const 결과 = (g) => JSON.parse(g.stdout.trim().split(/\r?\n/).pop().replace(/^결과: /, ''));
  const g = 굽기전('함수', 나쁜, '--무시', 'C1: 정지 컷');
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stderr, /멈춤: 지시문 걸림 4 — --걸림무시가 넘기지 않은 걸림이 남았다: C3\./);
  const g2 = 굽기전('함수', 나쁜, '--무시', 'C1, C3: 정지 컷 — 유호님 확인');
  assert.equal(g2.status, 0, g2.stdout + g2.stderr);
  assert.deepEqual(결과(g2), { C1: '정지 컷 — 유호님 확인', C3: '정지 컷 — 유호님 확인' });
  const g3 = 굽기전('함수', 나쁜, '--무시', 'C9: 오타');
  assert.equal(g3.status, 1);
  assert.match(g3.stderr, /--걸림무시는 "<판 id>,<판 id>: <까닭>".* 또는 "모두: <까닭>"으로 적는다 — 낼 판에 없는 이름: C9/);
  const g4 = 굽기전('함수', 나쁜, '--무시', '모두: 시험');
  assert.equal(g4.status, 0, g4.stdout + g4.stderr);
  assert.deepEqual(결과(g4), { C1: '시험', C3: '시험' });
  // 판 이름 사이는 쉼표 · 빈칸 · 가운뎃점 어느 것이든 읽는다(어긋난 꼴이 「모두 넘김」으로 떨어지지 않는다) · 까닭 속 쌍점 · 전각 쌍점
  for (const 값 of ['C1 · C3: 정지 컷', 'C1 C3: 정지 컷', 'C1,C3：정지 컷']) assert.deepEqual(결과(굽기전('함수', 나쁜, '--무시', 값)), { C1: '정지 컷', C3: '정지 컷' }, 값);
  assert.deepEqual(결과(굽기전('함수', 나쁜, '--무시', 'C1,C3: 정지 컷: 유호님 확인')), { C1: '정지 컷: 유호님 확인', C3: '정지 컷: 유호님 확인' });
  // 한 판만 적으면 다른 판의 걸림은 그대로 막는다 — 값 전체가 판 이름이거나(「C1」) 까닭이 비면(「C1:」) 거절
  for (const 값 of ['C1', 'C1:', 'C1 · C3']) {
    const 거절 = 굽기전('함수', 나쁜, '--무시', 값);
    assert.equal(거절.status, 1, 값);
    assert.match(거절.stderr, /--걸림무시는 "<판 id>,<판 id>: <까닭>"/, 값);
  }
  // 컷표 표 검사의 걸림은 「컷표」로 넘긴다 — 판만 적으면 표의 걸림이 남아 멈춘다
  const 편 = path.join(dir, '편'); fs.mkdirSync(편);
  const 나쁜표 = 틀읽기(); 나쁜표.한문장 = '';
  쓰기(편, '컷표.json', JSON.stringify(나쁜표));
  const 표꾸러미 = 꾸러미만들기(편, [{ id: 'C1', 글: 지시문글() }, { id: 'C2', 글: 지시문글() }]);
  const g5 = 굽기전('함수', 표꾸러미, '--무시', 'C1: 표는 내일');
  assert.equal(g5.status, 1);
  assert.match(g5.stderr, /넘기지 않은 걸림이 남았다: 컷표\./);
  const g6 = 굽기전('함수', 표꾸러미, '--무시', '컷표: 표는 내일 채운다');
  assert.equal(g6.status, 0, g6.stdout + g6.stderr);
  assert.deepEqual(결과(g6), { C1: '표는 내일 채운다', C2: '표는 내일 채운다' });
});

test('내기 도구 — 굽기전(): 검사기를 못 부르면 「모두:」일 때만 지나가고, 한 꾸러미에 같은 판 id가 둘이면 둘 다 검사해 걸림으로 알리며, 숫자 id · 지시문 파일 없는 판 · pv로 시작하는 보통 판에도 뜻대로 돈다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 결과 = (g) => JSON.parse(g.stdout.trim().split(/\r?\n/).pop().replace(/^결과: /, ''));
  const 나쁜 = 꾸러미만들기(dir, [{ id: 'C1', 글: 굳은글 }, { id: 'C2', 글: 지시문글() }, { id: 'C3', 글: 굳은글 }], '나쁜');
  // 검사기를 못 부를 때 — 무시가 없으면 멈추고, 판을 골라 넘긴 값으로도 멈춘다(고른 판 밖의 C2 · C3이 검사 없이 나가지 않게). 「모두:」만 지나간다(넷째 검수)
  const 없음 = 굽기전('함수', 나쁜, '--검사기없음');
  assert.equal(없음.status, 1, 없음.stdout + 없음.stderr);
  assert.match(없음.stderr, /멈춤: 검사기\(tools\/컷연속성검사\.py\)를 못 불러 지시문을 검사하지 못했다/);
  const 골라 = 굽기전('함수', 나쁜, '--검사기없음', '--무시', 'C1: 하나만');
  assert.equal(골라.status, 1, 골라.stdout + 골라.stderr);
  assert.match(골라.stderr, /멈춤: 검사기.*그래도 내야 하면 --걸림무시 "모두: <까닭>"/);
  assert.ok(!/결과:/.test(골라.stdout), 골라.stdout);
  const 모두 = 굽기전('함수', 나쁜, '--검사기없음', '--무시', '모두: 검사 도구 고치는 중');
  assert.equal(모두.status, 0, 모두.stdout + 모두.stderr);
  const 까닭 = '검사 도구 고치는 중 (검사기를 못 불러 검사 못 함)';
  assert.deepEqual(결과(모두), { C1: 까닭, C2: 까닭, C3: 까닭 });
  // 한 꾸러미에 같은 id의 판이 둘 — 둘째 판도 검사하고 겹친 id를 걸림으로 알린다(전에는 둘째 판이 검사 없이 지나갔다). --지시문도 둘째 판을 건다
  const 겹침 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글() }, { id: 'C1', 글: 굳은글 }], '겹침');
  const g = 굽기전('함수', 겹침);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ C1: 한 꾸러미에 같은 판 id가 둘이다\(001_C1 · 002_C1\)/);
  assert.match(g.stdout, /✗ C1: \(연기\) 사람 정지 낱말 「perfectly still」/);
  const r = 돌리기(['지시문', 겹침]);
  assert.ok(r.항목들.some((x) => x.항목 === '연기' && x.등급 === '걸림' && /「perfectly still」/.test(x.글)), '--지시문도 둘째 판을 건다');
  // 숫자 id — 죽지 않고, 그 id로 넘길 수 있다
  const 숫자 = 꾸러미만들기2(dir, [{ id: 'n7', 글: 굳은글, 더: { id: 7 } }, { id: 'n8', 글: 지시문글(), 더: { id: 8 } }], '숫자');
  const g2 = 굽기전('함수', 숫자);
  assert.equal(g2.status, 1, g2.stdout + g2.stderr);
  assert.match(g2.stdout, /✗ 7: \(연기\) 사람 정지 낱말/);
  assert.ok(!/Traceback|AttributeError/.test(g2.stderr), g2.stderr);
  const g3 = 굽기전('함수', 숫자, '--무시', '7: 숫자 id 시험');
  assert.equal(g3.status, 0, g3.stdout + g3.stderr);
  assert.deepEqual(결과(g3), { 7: '숫자 id 시험' });
  // 지시문 파일이 없는 판은 걸림이다(빈 파일과 따로)
  const 빠짐 = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글() }, { id: 'C2', 글: 지시문글() }], '빠짐');
  fs.rmSync(path.join(빠짐, '002_C2', '지시문.txt'));
  const g4 = 굽기전('함수', 빠짐);
  assert.equal(g4.status, 1, g4.stdout + g4.stderr);
  assert.match(g4.stdout, /✗ C2: 지시문\.txt가 없다/);
  // 폴더를 함께 쓰는 두 줄(소리만 판 + 그림 판)은 따로 본다 — 앞줄이 소리만이어도 뒷줄의 걸림을 건너뛰지 않는다(다섯째 검수). --지시문도 뒷줄을 건다
  const 함께 = 꾸러미만들기2(dir, [{ id: 'V1', 글: 굳은글, 더: { 소리만: true } }, { id: 'C1', 글: 굳은글, 더: { 폴더: '001_V1' } }], '함께');
  const g6 = 굽기전('함수', 함께);
  assert.equal(g6.status, 1, g6.stdout + g6.stderr);
  assert.match(g6.stdout, /· V1: 소리만 쓰는 판/);
  assert.match(g6.stdout, /✗ C1: \(연기\) 사람 정지 낱말 「perfectly still」/);
  const r6 = 돌리기(['지시문', 함께]);
  assert.ok(r6.항목들.some((x) => x.컷 === 'C1' && x.항목 === '연기' && x.등급 === '걸림'), '--지시문도 폴더를 함께 쓰는 뒷줄을 건다');
  // 프리비즈로 건너뛰는 판은 pv + 숫자 · 붙임표로 시작하는 id뿐이다 — 「pvc-01」 같은 보통 판은 그대로 검사한다
  const 프리 = 꾸러미만들기(dir, [{ id: 'pv5-08-1', 글: 굳은글 }, { id: 'pvc-01', 글: 굳은글 }], '프리');
  const g5 = 굽기전('함수', 프리);
  assert.equal(g5.status, 1, g5.stdout + g5.stderr);
  assert.match(g5.stdout, /· pv5-08-1: 프리비즈 판/);
  assert.match(g5.stdout, /✗ pvc-01: \(연기\) 사람 정지 낱말/);
  assert.ok(!/✗ pv5-08-1: /.test(g5.stdout), g5.stdout);
});

// ───────── 2026-11-12: 같은 시작 그림(50) · 되풀이 탈것 · 소품 한 줄(51) — 서울로 애니 보완 판 ─────────
// 왜: 전 컷을 다시 구운 판에서 같은 시작 그림으로 영상을 두 번 뽑은 컷이 두 군데(0:25 = 0:29 · 1:02 = 1:09) 있었고, 1970 버스가 컷마다 파랑 · 빨강이었다
//   (유호님 「버스 색이 달라 … 똑같은 장면이 반복되는부분이 몇장면 있어」). 컷표 검사는 통과했다 — 이 둘을 보는 칸이 없었다.
//   걸려야 할 옛 판 = 같은 시작 그림을 두 컷이 쓰는 표 · 버스 색이 지시문마다 다른 표, 지나가야 할 새 판 = 고친 표.
const 가짜그림 = (파일, 속) => fs.writeFileSync(파일, Buffer.from(`가짜 그림 ${속}`));

test('같은 시작 그림 — 옛 판(같은 그림에서 두 컷을 뽑음 · 이웃 컷의 그림을 이름만 바꿔 메움)은 걸리고 새 판(컷마다 다른 그림)은 지나간다, 칸이 비면 --그림 폴더의 컷 그림으로 견준다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 정지 = path.join(dir, '정지'); fs.mkdirSync(정지);
  for (const c of ['C1', 'C2', 'C3', 'C4']) 가짜그림(path.join(정지, `${c}.png`), c);
  가짜그림(path.join(정지, 'C4_메움.png'), 'C3');   // 이웃 컷 C3의 그림을 이름만 바꿔 둔 것
  // 옛 판: C2는 C1의 시작 그림에서 카메라만 달리 뽑았고, C4는 C3과 같은 파일(이름만 다름)
  const 옛 = 틀돌리기((s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C4').시작그림 = '정지/C4_메움.png'; }, [], dir);
  assert.equal(옛.코드, 1);
  const 걸림 = 걸림글(옛);
  assert.equal(걸림.length, 2, JSON.stringify(걸림));
  assert.match(걸림[0], /^C2: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 시작 그림 「정지\/C1\.png」\. 관객에겐 같은 장면이 되풀이된다/);
  assert.match(걸림[1], /^C4: 같은 시작 그림을 두 컷이 쓴다\(50\) — C3 컷과 같은 시작 그림 「정지\/C4_메움\.png」 = 「정지\/C3\.png」\(이름만 다른 같은 파일\)/);
  // 새 판: 컷마다 다른 그림(예시 틀 그대로)
  const 새 = 틀돌리기(null, [], dir);
  assert.equal(새.코드, 0, JSON.stringify(새.항목들.filter((x) => x.등급 !== '통과')));
  // 내기 도구의 굽기전처럼 편 폴더를 모르면(파일을 못 읽으면) 칸에 적힌 이름으로만 견준다 — 이름이 같은 C2는 걸리고, 이름만 다른 C4는 못 본다
  const 다른곳 = 임시();
  const 이름만 = 틀돌리기((s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C4').시작그림 = '정지/C4_메움.png'; }, [], 다른곳);
  assert.deepEqual(걸림글(이름만).map((g) => g.slice(0, 3)), ['C2:']);
  // 표의 칸이 비어도 --그림 폴더의 <컷>.png로 견준다 — C3.png가 C2.png와 같은 파일이다
  fs.copyFileSync(path.join(정지, 'C2.png'), path.join(정지, 'C3.png'));
  const 칸없음 = (s) => { for (const d of s.detail) delete d.시작그림; };
  const 그림만 = 틀돌리기(칸없음, ['--그림', 정지, '--항목', '틀'], dir);
  assert.equal(그림만.코드, 1);
  assert.deepEqual(걸림글(그림만).length, 1, JSON.stringify(걸림글(그림만)));
  assert.match(걸림글(그림만)[0], /^C3: 같은 시작 그림을 두 컷이 쓴다\(50\) — C2 컷과 같은 시작 그림 「C3\.png」 = 「C2\.png」\(이름만 다른 같은 파일\)/);
  // 칸도 비고 그림 폴더도 없으면 못 본 것이다 — 주의 한 줄로 알리고 끝 코드는 그대로(콘티 단계에는 시작 그림이 아직 없다)
  const 빈 = 틀돌리기(칸없음);
  assert.equal(빈.코드, 0, JSON.stringify(걸림글(빈)));
  const 주의 = 빈.항목들.filter((x) => x.항목 === '틀' && x.등급 === '주의').map((x) => `${x.컷}: ${x.글}`);
  assert.equal(주의.length, 1, JSON.stringify(주의));
  assert.match(주의[0], /^표: 「시작그림」 칸이 빈 컷 4개\(C1 · C2 · C3 · C4\).*· 50\)/);
});

test('같은 시작 그림 — 꾸러미(--지시문): 서로 다른 컷의 판이 같은 시작 그림 파일(1_시작.*)을 쓰면 걸림, 같은 컷의 대안 판 · 같은판을 밝힌 컷 · 다른 그림은 지나간다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 만들기 = (이름, 속들) => {
    const pack = 꾸러미만들기(dir, [{ id: 'C1', 글: 지시문글() }, { id: 'C1b', 글: 지시문글() }, { id: 'C2', 글: 지시문글() }], 이름);
    const 순서 = JSON.parse(fs.readFileSync(path.join(pack, '_순서.json'), 'utf8'));
    순서[1].컷 = ['C1'];   // C1b는 C1의 대안 판
    순서.forEach((x, i) => 가짜그림(path.join(pack, x.폴더, '1_시작.png'), 속들[i]));
    fs.writeFileSync(path.join(pack, '_순서.json'), JSON.stringify(순서), 'utf8');
    return pack;
  };
  const 시작줄 = (r) => r.항목들.filter((x) => x.항목 === '지시문' && x.글.startsWith('(시작 그림)')).map((x) => `${x.컷} ${x.등급}: ${x.글}`);
  // 옛 판: C2의 판이 C1과 같은 시작 그림에서 나간다(C1b는 C1의 대안 판이라 같은 그림이 맞다)
  const 옛 = 만들기('옛꾸러미', ['가', '가', '가']);
  const r = 틀돌리기(null, ['--지시문', 옛], dir);
  assert.equal(r.코드, 1);
  assert.equal(시작줄(r).length, 1, JSON.stringify(시작줄(r)));
  assert.match(시작줄(r)[0], /^C2 걸림: \(시작 그림\) 판 C1\(컷 C1\)와 시작 그림 파일이 같다\(1_시작\.png\).*\(50\)/);
  // 같은판을 밝힌 컷은 지나간다
  const r2 = 틀돌리기((s) => { 컷(s, 'C2').같은판 = '한 방을 둘로 자른 컷 — C1의 뒤 3초'; }, ['--지시문', 옛], dir);
  assert.deepEqual(시작줄(r2), []);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들.filter((x) => !['통과', '주의', '알림'].includes(x.등급))));
  // 새 판: 컷마다 다른 시작 그림
  const r3 = 틀돌리기(null, ['--지시문', 만들기('새꾸러미', ['가', '가', '나'])], dir);
  assert.deepEqual(시작줄(r3), []);
  assert.equal(r3.코드, 0, JSON.stringify(r3.항목들.filter((x) => !['통과', '주의', '알림'].includes(x.등급))));
});

test('되풀이 탈것 — 옛 판(버스 색을 그림 지시문마다 따로 적음)은 확인, 새 판(소품 한 줄 + 생김새 문장 그대로)은 통과, 표와 다른 색(vermilion bus)은 확인, 나온다고 적은 컷에 생김새 문장이 없으면 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 지시문들 = (이름, 표, 더 = {}, 소품뺄컷 = null) => {
    const p = path.join(dir, 이름); fs.mkdirSync(p);
    for (const d of 표.detail) 쓰기(p, `${d.cut}.txt`, 표대로그림글(표, d, { 소품: d.cut !== 소품뺄컷, 더: 더[d.cut] || [] }));
    return p;
  };
  const 그림줄 = (r, 컷이름) => r.항목들.filter((x) => x.항목 === '그림지시문' && x.컷 === 컷이름).map((x) => `${x.등급}: ${x.글}`);
  // 옛 판 — 표에 버스 줄이 없고 그림 지시문마다 색을 따로 적었다(서울로 11-12 지시문의 꼴 그대로)
  const 옛 = 지시문들('옛', 틀읽기(), {
    C1: ['Outside the window, one 1970s city bus (cream and cobalt blue, rounded roof, a row of square windows) drives past.'],
    C2: ['Outside the window, a cream-and-vermilion rounded 1970s felt city bus drives past under a saffron-yellow sky.'],
  });
  const r = 틀돌리기(null, ['--그림지시문', 옛], dir);
  assert.equal(r.코드, 2, JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과')));
  assert.equal(그림줄(r, '표').length, 1, JSON.stringify(그림줄(r, '표')));
  assert.match(그림줄(r, '표')[0], /^확인: 탈것 「bus」의 색이 그림 지시문마다 다르다\(51\) — C1 blue · cobalt · cream \/ C2 cream · vermilion\. 같은 탈것이면 맨 위 「소품」 표에 한 줄/);
  // 새 판 — 버스를 소품 표에 한 줄로 적고, 나오는 컷(C1 · C2)의 지시문에 생김새 문장을 그대로 썼다. 색 없이 부르는 「the bus」는 얼마든지 써도 된다
  const 새표 = 틀읽기(); 버스넣기(새표);
  const 새 = 지시문들('새', 새표, { C1: ['The bus is passing from left to right outside the window, under a saffron-yellow sky.'] });
  const r2 = 틀돌리기((s) => 버스넣기(s), ['--그림지시문', 새], dir);
  assert.equal(r2.코드, 0, JSON.stringify(r2.항목들.filter((x) => x.등급 !== '통과')));
  assert.deepEqual(r2.항목들.filter((x) => x.항목 === '그림지시문').map((x) => `${x.컷} ${x.등급}`), ['C1 통과', 'C2 통과', 'C3 통과', 'C4 통과']);
  // 표는 cream and cobalt-blue인데 지시문에 vermilion bus — 확인(끝 코드 2)
  const r3 = 틀돌리기((s) => 버스넣기(s), ['--그림지시문', 지시문들('다른색', 새표, { C2: ['The vermilion bus slows down outside the window.'] })], dir);
  assert.equal(r3.코드, 2, JSON.stringify(r3.항목들.filter((x) => x.등급 !== '통과')));
  assert.equal(그림줄(r3, 'C2').length, 2, JSON.stringify(그림줄(r3, 'C2')));
  assert.match(그림줄(r3, 'C2')[1], /^확인: 소품 「버스」에 표에 없는 색 「vermilion」 — 「vermilion bus」\(표의 색: blue · cobalt · cream\)\. 같은 버스이면 색을 따로 적지 않고 표의 생김새 줄만 쓴다\(51\)/);
  // 표에 나온다고 적은 컷(C2)의 지시문에 생김새 문장이 없다 — 인물 옷과 같은 대조(걸림). 표의 색 안에서 달리 쓴 것(cream and blue)은 색으로는 걸지 않는다
  const r4 = 틀돌리기((s) => 버스넣기(s), ['--그림지시문', 지시문들('빠짐', 새표, { C2: ['A cream and blue bus passes outside the window.'] }, 'C2')], dir);
  assert.equal(r4.코드, 1);
  assert.deepEqual(그림줄(r4, 'C2').length, 1, JSON.stringify(그림줄(r4, 'C2')));
  assert.match(그림줄(r4, 'C2')[0], /^걸림: 소품 「버스」의 생김새 문장이 글자 그대로 들어 있지 않다 — 이미지 지시문은 표의 장소 · 빛 · 인물 · 소품 줄을 그대로 쓴다\(G11 · 51\)/);
  // 표에는 화면밖인 컷(C3)의 지시문에 bus가 나온다 — 표와 지시문이 어긋났으니 확인
  const r5 = 틀돌리기((s) => 버스넣기(s), ['--그림지시문', 지시문들('화면밖', 새표, { C3: ['Through the door gap, a bus waits at the kerb.'] })], dir);
  assert.equal(r5.코드, 2);
  assert.match(그림줄(r5, 'C3')[1], /^확인: 지시문에 「bus」이\(가\) 나오는데 소품 「버스」의 생김새 문장이 없다/);
  // 표에 줄이 없는 탈것이 색 다툼 없이 두 컷에 나오면 주의만(끝 코드 0), 「bus stop」 · 「no buses」는 버스가 나온 것이 아니다
  const r6 = 틀돌리기(null, ['--그림지시문', 지시문들('주의만', 틀읽기(), {
    C1: ['A tram passes outside the window. A bus stop sign stands at the kerb.'], C2: ['The tram bell rings as the tram passes; there are no buses in this picture.'],
  })], dir);
  assert.equal(r6.코드, 0, JSON.stringify(r6.항목들.filter((x) => x.등급 !== '통과')));
  assert.deepEqual(그림줄(r6, '표').length, 1, JSON.stringify(그림줄(r6, '표')));
  assert.match(그림줄(r6, '표')[0], /^주의: 탈것 「tram」이\(가\) 그림 지시문 2컷\(C1 · C2\)에 나오는데 소품 표에 줄이 없다/);
});

test('되풀이 탈것 — 색은 그 이름씨에 붙은 것만 센다: 서울로 지시문 꼴의 버스 문장 아홉은 색이 읽히고, 같은 문장의 하늘 · 벽 · 택시 색과 「no … bus」 · 「bus stop」 · minibus는 세지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 문장 = [
    // 색이 읽혀야 하는 꼴(서울로 11-11~12 그림 지시문에서)
    ['One 1970s city bus (cream and cobalt blue, rounded roof, a row of square windows) fills the frame', ['blue', 'cobalt', 'cream']],
    ['a cream-and-vermilion rounded 1970s felt city bus drives past', ['cream', 'vermilion']],
    ['rounded 1970s felt buses (cream-and-blue, cream-and-vermilion) cross the overpass', ['blue', 'cream', 'vermilion']],
    ['a rounded 1970s felt city bus with a cream roof and cream window band and a cobalt-blue lower body with one thin cream stripe', ['blue', 'cobalt', 'cream']],
    ['A boxy 1990s felt city bus — vermilion red with one cream band, the same model as before', ['cream', 'red', 'vermilion']],
    ['(solid blue, solid red and solid green flat-fronted buses, small cars) with their tail lights on', ['blue', 'green', 'red']],
    ['one bus, cream and cobalt blue, rounded roof', ['blue', 'cobalt', 'cream']],
    ['the bus is painted green', ['green']],
    ['a bus in cream and blue livery', ['blue', 'cream']],
    // 세면 안 되는 꼴
    ['A warm saffron-yellow and orange morning sky above (no blue sky), the plain concrete side wall of the bridge below the bus.', []],
    ['there is no red or vermilion bus anywhere', []],
    ['the bus, red brick warehouses behind it', []],
    ['the bus in red light', []],
    ['the bus with a red-coated conductor leaning out', []],
    ['The bus is passing a yellow taxi.', []],
    ['two yellow taxis and the bus', []],
    ['A bus stop sign in yellow', []],
    ['a minibus in red', []],
  ];
  const 스크립트 = 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\npat = k.낱말정규식(["bus"])\nprint(json.dumps([sorted(k.붙은색들(t, pat)[0]) for t in json.load(sys.stdin)]))';
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 스크립트, path.dirname(도구)], { input: JSON.stringify(문장.map((x) => x[0])), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const 답 = JSON.parse(r.stdout);
  assert.deepEqual(문장.map(([글], i) => [글, 답[i]]).filter(([, 색], i) => JSON.stringify(색) !== JSON.stringify(문장[i][1])), []);
});

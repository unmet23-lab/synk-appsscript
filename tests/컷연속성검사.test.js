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
  // 11-18 경산 E2~E4: 창이 「snowy roofs」를 보여 준다는 빛 문장이 실내 눈으로 걸렸다 — 지붕은 창밖이다(rooftops만 받던 것을 roofs까지)
  ['a deep blue window at the right of the frame shows snowy roofs.', true, ['주의']],
];

test('지시문 낱말 — Astra · 아르곤 재현 문장 24개가 뜻대로 갈린다', { skip: !파이썬 && '파이썬 없음' }, () => {
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

test('지시문 낱말 — 켜진 불이 깜빡이면 걸림(점검표 61) · 닦는 컷에 닦인 결과가 없으면 주의(17)', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-13 서울로 애니: 「the blue deck lights twinkle」 한 줄에 난간 등 열한 개가 한꺼번에 두 번 꺼졌다 켜졌다(3.9초에 바뀜 73번 → 고친 판 1번),
  //   와이퍼 컷은 닦인 결과를 안 써서 시작 그림에 구운 물방울이 그대로 남았다(유호님 「와이퍼에 물기가 안지워지고 그냥 통과하거든」). 둘 다 다시 굽기 30크레딧 · 12분씩 들었다.
  const 재현 = [
    // [지시문, 원하는 등급]
    ['The blue deck lights twinkle along the railing as people stroll past.', ['걸림']],
    ['Street lamps flicker above the empty road.', ['걸림']],
    ['Neon signs blink in the rain.', ['걸림']],
    ['난간의 파란 등이 반짝인다.', ['걸림']],
    ['가로등이 깜빡이며 꺼졌다 켜진다.', ['걸림']],
    // 지나가야 하는 꼴 — 켜진 채로 둔다고 못 박았거나, 빛이 아닌 것이 반짝인다
    ['The blue railing lights come on over the first 1.2 s and then stay on; once lit, no lamp ever goes dark, blinks or dims.', []],
    ['Every lamp glows steadily at the same brightness until the end.', []],
    ['Snow glitters on the deck.', []],
    ['Her eyes shimmer with tears.', []],
    ['등은 끝까지 그대로 켜져 있다.', []],
    // 닦는 컷
    ['Close on the windshield from inside the bus. The wiper blade sweeps across the glass twice.', ['주의']],
    ['She wipes away the fog with her sleeve.', ['주의']],
    ['Each swing really wipes the glass, leaving a clean, clear fan-shaped band of glass right behind the blade.', []],
    ['The wiper sweeps and the pane goes crystal clear behind it.', []],
  ];
  const dir = 임시();
  const 파일 = 재현.map(([t], i) => 쓰기(dir, `w${String(i).padStart(2, '0')}.txt`, `ACTION: ${t}`));
  const r = 돌리기(['지시문', ...파일]);
  const 틀림 = [];
  재현.forEach(([t, want], i) => {
    const got = [...new Set(등급(r.항목들, '지시문', `w${String(i).padStart(2, '0')}`).filter((g) => g !== '통과'))].sort();
    if (JSON.stringify(got) !== JSON.stringify([...want].sort())) 틀림.push(`${t} → ${got.join('·') || '없음'} (원함 ${want.join('·') || '없음'})`);
  });
  assert.deepEqual(틀림, []);
});

test('지시문 낱말 — 한국어 실내 줄: 「공기는 맑다, 아무것도 떠다니거나 떨어지지 않는다」도 실내 한 줄로 받고, 그 줄이 없는 실내 지시문은 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-16 synkbrief 원생명단 동영상 13판은 이 한국어 줄을 넣었는데 「떠다니지」만 받던 규칙에 걸려 13판 모두 헛 주의가 났다
  const 앞 = '세로 영상. 이 사진에서 이어서 시작한다. 교실 안에서 아이가 손을 든다. ';
  const 재현 = [
    ['실내이고 공기는 맑다, 아무것도 떠다니거나 떨어지지 않는다.', false],
    ['아무것도 떨어지거나 날리지 않는다.', false],
    ['아무것도 떨어지지 않는다.', false],
    ['실내 공기가 맑고 고요하다.', false],
    ['선생님이 칠판 앞으로 걸어간다.', true],
  ];
  const dir = 임시();
  const 파일 = 재현.map(([t], i) => 쓰기(dir, `k${i}.txt`, 앞 + t));
  const r = 돌리기(['지시문', ...파일, '--실내', 재현.map((_, i) => `k${i}`).join(',')]);
  const 틀림 = [];
  재현.forEach(([t, 주의원함], i) => {
    const 있음 = r.항목들.some((x) => x.컷 === `k${i}` && x.등급 === '주의' && x.글.includes('같은 한 줄이 없다'));
    if (있음 !== 주의원함) 틀림.push(`${t} → 실내 줄 주의 ${있음 ? '있음' : '없음'}`);
  });
  assert.deepEqual(틀림, []);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 === '걸림')));
});

test('지시문 낱말 — 한국어: 「쪽지가 두 번 떨림」은 걸림, 「면접 또 떨어짐」 · 따옴표 안 「문 열게」는 아님', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const seq = { detail: [{ cut: 'A11', t: 0, dur: 1, keep: '두 번 노크 · 쪽지가 두 번 떨림' }, { cut: 'A5i', t: 1, dur: 1, line: '쪽지 「나 면접 또 떨어짐ㅋㅋ」' }, { cut: 'A12', t: 2, dur: 1, line: '파랑 「내일은 내가 문 열게」' }] };
  const r = 돌리기([쓰기(dir, '컷순서.json', JSON.stringify(seq)), '--항목', '지시문']);
  assert.deepEqual(등급(r.항목들, '지시문', 'A11'), ['주의']);
  assert.deepEqual(등급(r.항목들, '지시문', 'A5i'), []);
  assert.deepEqual(등급(r.항목들, '지시문', 'A12'), []);
});

// 11-13 B43 V9 「휴대폰이 자기 혼자 들썩이는거」 — 진동을 화면 줄에 쓰면 영상 모델이 폰째 튀게 그린다. 소리 줄 · 사람의 떨림 · 고친 글은 지나간다
const 폰옛 = ['세로 영상. 이 사진에서 이어서 시작한다. 카메라는 제자리에서 아주 천천히 다가간다.',
  '0~4초: 엎어 놓은 휴대폰이 손 밑에서 부르르 두 번 떨린다. 폰 가장자리로 새는 흰 빛이 천천히 밝아졌다 어두워졌다 한다.',
  '소리: 폰 진동 두 번, 조용한 밤 차 안 소리.'].join('\n');
const 폰새 = ['세로 영상. 이 사진에서 이어서 시작한다. 엎어 놓은 휴대폰은 콘솔에 납작하게 붙어 있고, 처음부터 끝까지 한 번도 들리거나 흔들리거나 미끄러지지 않는다. 손 말고는 아무것도 움직이지 않는다.',
  '0~1.5초: 폰 가장자리로 흰 빛이 고르게 새어 나온다. 폰을 덮은 손가락 끝에 천천히 힘이 들어가 폰을 꾹 누른다.',
  '소리: 손 밑에서 폰 진동 소리 두 번, 조용한 밤 차 안 소리.'].join('\n');
test('지시문 낱말 — 폰 진동: 화면 줄의 「휴대폰이 부르르 떨린다」 · 「the phone vibrates」는 걸림, 소리 줄 · 손의 떨림 · 고친 글은 아님', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 파일 = [['P1.txt', 폰옛], ['P2.txt', 폰새], ['P3.txt', 'ACTION: the phone on the desk vibrates twice and she stares at it.'],
    ['P4.txt', 'SOUND: the phone buzzes twice on the desk.'], ['P5.txt', 'ACTION: she holds the phone and her hands tremble slightly.'], ['P6.txt', 'ACTION: 이어폰 줄이 바람에 떨린다.']].map(([n, t]) => 쓰기(dir, n, t));
  const r = 돌리기(['지시문', ...파일]);
  const 폰 = (컷) => r.항목들.filter((x) => x.컷 === 컷 && x.항목 === '지시문' && x.등급 === '걸림' && /휴대폰이 진동/.test(x.글)).length;
  assert.equal(폰('P1'), 1, '옛 V9 화면 줄은 걸림');
  assert.equal(폰('P2'), 0, '고친 V9(폰은 납작 · 진동은 소리 줄)는 걸림 아님');
  assert.equal(폰('P3'), 1, '영어 「the phone vibrates」도 걸림');
  assert.equal(폰('P4'), 0, 'SOUND 줄은 화면 동작이 아니다');
  assert.equal(폰('P5'), 0, '떠는 것은 손(사람)이다');
  assert.equal(폰('P6'), 0, '이어폰은 휴대폰이 아니다');
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
  // T30 시늉 박자(29 · 11-20 경산 공모전 편 — 말 · 소품 없는 숟가락 시늉을 영상 모델이 입 가리기로 그렸다)
  ['T30 시늉에 맡긴 박자에 말도 소품도 없다', (s) => { 컷(s, 'C1').연기[1].무엇 = '빈 손을 숟가락처럼 오므려 떠먹는 시늉을 두 번 한다'; }, /^C1: 시늉에 뜻을 맡긴 박자 1\.6초 「빈 손을 숟가락처럼.*\(29 · T30\)/],
  ['T30 「허」 같은 감탄 소리는 말이 아니다', (s) => { 컷(s, 'C1').연기[1].무엇 = '빈 손을 숟가락처럼 오므려 떠먹는 시늉을 한다'; 컷(s, 'C1').소리 = '수아의 짧은 「허」 · 가스 불 탁'; }, /^C1: 시늉에 뜻을 맡긴 박자.*\(29 · T30\)/],
  ['T30 흉내 내는 대상으로만 나온 소품 이름은 받침이 아니다', (s) => { 컷(s, 'C3').연기[1].무엇 = '수아가 빈 손을 빈그릇처럼 오므려 내미는 흉내를 낸다'; }, /^C3: 시늉에 뜻을 맡긴 박자.*\(29 · T30\)/],
  ['T1 장면의 빛 칸이 비었다', (s) => { s.장면.부엌밤.빛 = ''; }, /장면 「부엌밤」의 빛 칸이 비었다.*\(51\)/],
  ['T1 컷이 표에 없는 장면을 쓴다', (s) => { 컷(s, 'C2').장면 = '거실밤'; }, /C2: 장면 「거실밤」이 장면 표에 없다.*\(51\)/],
  ['T2 인물 표에 없는 이름', (s) => { 컷(s, 'C1').인물 = ['수아', '민호']; }, /C1: 인물 「민호」가 인물 표에 없다.*12 · G11/],
  ['T2 인물 칸 자체가 없다', (s) => { delete 컷(s, 'C4').인물; }, /C4: 「인물」 칸이 없다.*\[\]/],
  ['T2 인물 기준 그림이 비었다', (s) => { s.인물.수아.기준그림 = ' '; }, /인물 「수아」의 기준그림 칸이 비었다/],
  ['T3 사람 컷에 연기 박자가 하나', (s) => { 컷(s, 'C2').연기 = [{ t: 0.8, 무엇: '고개가 문 쪽으로 돈다' }]; }, /C2: 사람 컷에 연기 박자.*\(26\)/],
  ['T3 초가 없는 박자는 박자가 아니다', (s) => { 컷(s, 'C3').연기 = [{ 무엇: '그릇을 잡는다' }, { t: '곧', 무엇: '당겨 받는다' }]; }, /C3: (?:사람 컷에 연기 박자.*0개|「연기 2번째 줄\.t」 칸은 수 꼴로 적는다 — 지금은 글이다)/, [/C3: 사람 컷에 연기 박자.*0개/, /C3: 「연기 2번째 줄\.t」 칸은 수 꼴로 적는다 — 지금은 글이다/]],   // 11-20 꼴 관문 — 수가 아닌 t는 꼴 걸림이고 빈칸으로 읽는다. 두 걸림이 다 있어야 한다
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
  // 11-11 서울로 끝 제목: 글꼴 이름 없이 「조판해 원근 합성」으로 적어 그대로 지나갔다(점검표 7 · 46) — 조판 · 얹 · 합성 · HTML도 글꼴로 친 것과 같다
  ['T9 장면 속 글자를 글꼴 이름 없이 조판해 합성(11-11 서울로 끝 제목)', (s) => { s.글자.push({ 글: '서울로', 종류: '장면속', 어디: 'C4 하늘', 만드는법: '서울남산체로 조판해 원근 합성' }); }, /\(장면속\) 만드는법 「서울남산체로 조판해 원근 합성」 — .*글꼴로 치지 않는다\(24 · 46 · 55\)/],
  ['T9 끝로고를 HTML 오버레이로 얹음', (s) => { s.글자[0].만드는법 = 'HTML 오버레이로 얹음'; }, /\(끝로고\) 만드는법 「HTML 오버레이로 얹음」 — .*글꼴로 치지 않는다/],
  ['T9 쉼표 뒤 딴 절의 「없이」는 합성의 부정이 아니다', (s) => { s.글자[0].만드는법 = '조판해 합성, 그림자 없이'; }, /\(끝로고\) 만드는법 「조판해 합성, 그림자 없이」 — .*글꼴로 치지 않는다/],
  ['T9 「그린스크린 합성」은 그린 글자가 아니다', (s) => { s.글자[0].만드는법 = '그린스크린 합성'; }, /\(끝로고\) 만드는법 「그린스크린 합성」 — .*글꼴로 치지 않는다/],
  // 11-16 GPT 검수 GA1 · GA2 — 굽기를 부정한 말은 구운 것이 아니고, 같은 절이라도 다른 것을 부정한 「없이」는 합성의 부정이 아니다
  ['T9 「굽지 않고 HTML로 합성」은 구운 것이 아니다', (s) => { s.글자[0].만드는법 = '장면에 굽지 않고 HTML로 합성'; }, /\(끝로고\) 만드는법 「장면에 굽지 않고 HTML로 합성」 — .*글꼴로 치지 않는다/],
  ['T9 「그린 글자가 아니라 조판해 얹음」', (s) => { s.글자[0].만드는법 = '그린 글자가 아니라 조판해 얹음'; }, /\(끝로고\) 만드는법 「그린 글자가 아니라 조판해 얹음」 — .*글꼴로 치지 않는다/],
  ['T9 「HTML로 합성해 그림자 없이 표시」의 없이는 그림자의 부정이다', (s) => { s.글자[0].만드는법 = 'HTML로 합성해 그림자 없이 표시'; }, /\(끝로고\) 만드는법 「HTML로 합성해 그림자 없이 표시」 — .*글꼴로 치지 않는다/],
  ['T9 「합성해 배경 없이 표시」의 없이는 배경의 부정이다(글자 수 창이면 샌다 — GA2 둘째 회차)', (s) => { s.글자[0].만드는법 = '합성해 배경 없이 표시'; }, /\(끝로고\) 만드는법 「합성해 배경 없이 표시」 — .*글꼴로 치지 않는다/],
  // 셋째 회차 GA1 뒤 설계: 굽는 말은 그 절에 부정이 하나라도 있거나 앞에 「안 · 못」이 있으면 구운 것으로 세지 않는다(애매하면 걸림)
  ['T9 「그려 넣는 대신 HTML로 합성」은 그린 것이 아니다(GA1 셋째 회차)', (s) => { s.글자[0].만드는법 = '그려 넣는 대신 HTML로 합성'; }, /\(끝로고\) 만드는법 「그려 넣는 대신 HTML로 합성」 — .*글꼴로 치지 않는다/],
  ['T9 「장면에 안 굽고 HTML로 합성」은 구운 것이 아니다', (s) => { s.글자[0].만드는법 = '장면에 안 굽고 HTML로 합성'; }, /\(끝로고\) 만드는법 「장면에 안 굽고 HTML로 합성」 — .*글꼴로 치지 않는다/],
  ['T9 「그린 글자 대신 HTML 오버레이」', (s) => { s.글자[0].만드는법 = '그린 글자 대신 HTML 오버레이'; }, /\(끝로고\) 만드는법 「그린 글자 대신 HTML 오버레이」 — .*글꼴로 치지 않는다/],
  // Fable 설계 검토(11-16): 「말고는 · 않으면」은 조건이라 부정이 아니고, 글꼴 말도 바로 붙은 부정만 센다(옛 10자 창), 「자막 도구」 · 「텍스트로」도 얹는 말이다
  ['T9 「합성 말고는 방법이 없음」은 합성한 것이다', (s) => { s.글자[0].만드는법 = '글자가 계속 깨져 합성 말고는 방법이 없음'; }, /\(끝로고\) 만드는법 「글자가 계속 깨져 합성 말고는 방법이 없음」 — .*글꼴로 치지 않는다/],
  ['T9 「합성하지 않으면 안 읽힘」은 합성한 것이다', (s) => { s.글자[0].만드는법 = '합성하지 않으면 안 읽힘'; }, /\(끝로고\) 만드는법 「합성하지 않으면 안 읽힘」 — .*글꼴로 치지 않는다/],
  ['T9 「SUIT로 쳐서 테두리 없이 넣음」(글꼴 말 뒤 딴 것의 없이)', (s) => { s.글자[0].만드는법 = 'SUIT로 쳐서 테두리 없이 넣음'; }, /\(끝로고\) 만드는법 「SUIT로 쳐서 테두리 없이 넣음」 — .*글꼴로 치지 않는다/],
  ['T9 「시안 합성본을 그대로 사용」의 「시안 」은 부정이 아니다(넷째 회차 GA1)', (s) => { s.글자[0].만드는법 = '시안 합성본을 그대로 사용'; }, /\(끝로고\) 만드는법 「시안 합성본을 그대로 사용」 — .*글꼴로 치지 않는다/],
  ['T9 「일반텍스트로 끝로고 입력」(붙여 쓴 텍스트로 — 다섯째 회차 GA1)', (s) => { s.글자[0].만드는법 = '일반텍스트로 끝로고 입력'; }, /\(끝로고\) 만드는법 「일반텍스트로 끝로고 입력」 — .*글꼴로 치지 않는다/],
  ['T9 강조 글자를 자막 도구로', (s) => { s.글자.push({ 글: '두 그릇', 종류: '강조', 어디: 'C4 가운데', 만드는법: '자막 도구' }); }, /「두 그릇」\(강조\) 만드는법 「자막 도구」 — .*글꼴로 치지 않는다/],
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
  ['T17 같은판에 true만 적으면 밝힌 것이 아니다(까닭을 글로)', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').같은판 = true; }, /C2: (?:같은 시작 그림을 두 컷이 쓴다\(50\)|「같은판」 칸은 글 꼴로 적는다 — 지금은 true이다)/, [/C2: 같은 시작 그림을 두 컷이 쓴다\(50\)/, /C2: 「같은판」 칸은 글 꼴로 적는다 — 지금은 true이다/]],   // 11-20 꼴 관문 — true는 꼴 걸림이고 빈칸으로 읽어 T17도 건다. 두 걸림이 다 있어야 한다
  ['T17 셋이 같은 그림이면 밝히지 않은 둘째부터 걸린다', (s) => { 컷(s, 'C2').시작그림 = '정지/C1.png'; 컷(s, 'C2').같은판 = '한 방을 둘로 자른 컷'; 컷(s, 'C4').시작그림 = '정지/C1.png'; }, /C4: 같은 시작 그림을 두 컷이 쓴다\(50\) — C1 컷과 같은 시작 그림/],
  // T18 되풀이해 나오는 탈것 · 소품 한 줄(11-12 서울로 애니 「16초 18초 버스 색이 달라」 · 점검표 51)
  ['T18 소품 줄의 생김새가 비었다', (s) => { s.소품.빈그릇.생김새 = ''; }, /소품 빈그릇: 소품 「빈그릇」의 생김새 칸이 비었다.*\(51\)/],
  ['T18 소품 줄에 지시문에서 부르는 낱말이 없다', (s) => { delete s.소품.빈그릇.낱말; }, /소품 빈그릇: 소품 「빈그릇」의 낱말 칸이 비었다.*\(51\)/],
  ['T18 소품 줄에 색 · 기준 그림이 없다', (s) => { s.소품.빈그릇.색 = ' '; delete s.소품.빈그릇.기준그림; }, /소품 「빈그릇」의 색 · 기준그림 칸이 비었다/],
  ['T18 세 컷에 나오는 소품인데 표에 줄이 없다', (s) => { delete s.소품; 컷(s, 'C2').소품.빈그릇 = '문틈에'; }, /소품 빈그릇: 소품 「빈그릇」 — 3컷\(C2 · C3 · C4\)에 나오는데 맨 위 「소품」 표에 줄이 없다.*51\)/],
  ['T18 두 컷에 나오는 탈것인데 표에 줄이 없다', (s) => { for (const d of s.detail) d.소품.버스 = '화면밖'; 컷(s, 'C1').소품.버스 = '창밖을 지남'; 컷(s, 'C2').소품.버스 = '창밖을 지남'; }, /소품 버스: 탈것 「버스」 — 2컷\(C1 · C2\)에 나오는데 맨 위 「소품」 표에 줄이 없다.*51\)/],
  // T20 사람과 탈것이 한 컷이면 인물 키(11-18 YOUTH UP 「잠깐」 유호님 「차 높이도 아이시선으로 강조해야하는부분도 크게 강조한것같지가않은데 ?」 · 점검표 63)
  ['T20 사람과 탈것이 한 컷인데 인물 줄에 키 칸이 없다(편 날짜 11-18 이후)', (s) => { 버스넣기(s); s.편.만든날 = '2026-11-18'; }, /인물 \S+: 사람과 탈것이 한 컷에 나오는데\(C1\(버스\) · C2\(버스\)\) 인물 「\S+」 줄에 「키」 칸이 없다.*\(63\)/],
  // T21 내레이션 · 대사 원고는 맥락 없는 눈의 줄마다 판정 기록이 있어야 한다(11-18 매경 정수리 유호님 「대사가 너무 쓰레기인데 ? "정수리, 평생 볼수 없는다" 이게 도대체 무슨뜻이야 ?」 · 점검표 64)
  ['T21 내레이션 원고가 있는데 원고시험 칸이 없다(편 날짜 11-18 이후)', (s) => { 원고넣기(s); s.편.만든날 = '2026-11-18'; }, /소리 원고: 내레이션 · 대사 원고 2줄에 「원고시험」 칸이 없다.*\(64\)/],
  ['T21 원고시험에서 「모름」으로 나온 줄이 있다', (s) => { 원고넣기(s, { 시험: true }); s.편.만든날 = '2026-11-18'; s.소리.원고시험.줄[1].판정 = '모름'; }, /소리 원고: 「두 번째 그릇\.」 — 맥락 없는 눈의 판정이 「모름」으로 나왔다.*\(64\)/],
  ['T21 원고를 고쳤는데 원고시험은 옛 글이다', (s) => { 원고넣기(s, { 시험: true }); s.편.만든날 = '2026-11-18'; s.소리.원고[0][2] = '물이 끓는다. 라면 차례다.'; }, /소리 원고: 「물이 끓는다\. 라면 차례다\.」 — 원고시험에 이 글 그대로의 판정이 없다.*\(64\)/],
  // T25 · T26(11-18 YOUTH UP 「잠깐」 유호님 「지금 차 거리가 긴데 갑자기 다음장면에서 차 거리가 엄청 좁아지거든?」 · 「자막이 너무 작은것같아」 · 점검표 63 · 4)
  ['T25 한 컷에 탈것이 둘인데 장면 줄에 차간격 칸이 없다(편 날짜 11-19 이후)', (s) => { 버스넣기(s); for (const d of s.detail) d.소품.택시 = d.cut === 'C1' ? '커브에' : '화면밖'; for (const n of Object.keys(s.인물)) s.인물[n].키 = '버스 창 아래 끝에 어깨가 온다'; s.편.만든날 = '2026-11-19'; }, /장면 \S+: 한 컷에 탈것이 둘 이상인데\(C1\(버스·택시\)\) 장면 「\S+」 줄에 「차간격」 칸이 없다.*\(63\)/],
  ['T26 말자막에 크기 칸이 없다(편 날짜 11-19 이후)', (s) => { s.글자.push({ 글: '라면 물이 끓는다', 종류: '말자막', 어디: 'C1', 만드는법: '내레이션 말자막' }); s.편.만든날 = '2026-11-19'; }, /글자 \d+: 말자막 「라면 물이 끓는다」에 「크기」 칸이 없다.*\(72 권장, 4\)/],
  ['T26 말자막이 48px로 작다', (s) => { s.글자.push({ 글: '라면 물이 끓는다', 종류: '말자막', 어디: 'C1', 만드는법: '내레이션 말자막', 크기: 48 }); s.편.만든날 = '2026-11-19'; }, /글자 \d+: 말자막 「라면 물이 끓는다」 크기 48px — 1080 폭에서 64px 아래는 휴대폰에서 작다/],
  // T27 두 사람 이상인 컷은 타당성 한 줄(11-19 공모전 편 지하철 컷 유호님 「자리가 이렇게 많은데 이렇게 이미지를 뽑은게 말이 안되잖아」 · 「타당성에대한 검수」 · 점검표 65)
  ['T27 두 사람이 한 화면인 컷에 타당성 칸이 없다(편 날짜 11-20 이후)', (s) => { delete 컷(s, 'C3').타당성; s.편.만든날 = '2026-11-20'; }, /C3: 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다.*65\)/],
  // 11-20 GPT 검수(영상타당성검사-20261120) GA1 — 빈 배열은 글이 아니다, GA2 — 시작 · 끝 그림에만 함께 나오는 사람도 센다
  ['T27 타당성 칸이 빈 배열이면 빈칸이다', (s) => { 컷(s, 'C3').타당성 = []; s.편.만든날 = '2026-11-20'; }, /C3: (?:두 사람 이상이 한 화면인데 「타당성」 칸이 비었다.*65\)|「타당성」 칸은 글 꼴로 적는다 — 지금은 목록이다)/, [/C3: 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다.*65\)/, /C3: 「타당성」 칸은 글 꼴로 적는다 — 지금은 목록이다/]],   // 11-20 꼴 관문 — 꼴 걸림. 두 걸림이 다 있어야 한다과 T27 걸림이 함께 난다(tests/컷표읽기.test.js가 둘 다 있는지 본다)
  ['T27 시작 그림에 두 사람이 나오면(그림인물) 타당성 칸을 본다', (s) => { 컷(s, 'C1').그림인물 = ['수아', '옆집']; s.편.만든날 = '2026-11-20'; }, /C1: 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다.*65\)/],
  ['T27 끝 그림에 두 사람이 나오면(끝그림인물) 타당성 칸을 본다', (s) => { 컷(s, 'C2').끝그림인물 = ['수아', '옆집']; s.편.만든날 = '2026-11-20'; }, /C2: 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다.*65\)/],
];
const 버스줄 = { 종류: '탈것', 낱말: ['bus'], 색: 'cream and cobalt-blue', 생김새: 'One rounded 1970s Seoul city bus: a cream roof and window band over a cobalt-blue lower body.', 기준그림: 'ref/소품_버스.jpg' };
// 버스가 C1 · C2의 창밖을 지나는 표 — 줄: 맨 위 「소품」 표에 버스 줄을 넣는다
const 버스넣기 = (s, { 줄 = true } = {}) => {
  if (줄) s.소품.버스 = { ...버스줄 };
  for (const d of s.detail) d.소품.버스 = ['C1', 'C2'].includes(d.cut) ? '창밖을 지남' : '화면밖';
};
// 내레이션 두 줄(C1 · C3)을 넣는 표 — 시험: 맥락 없는 눈이 두 줄 모두 「바로」로 판정한 원고시험 칸도 넣는다
const 원고넣기 = (s, { 시험 = false } = {}) => {
  s.소리.목소리 = '제3자 내레이션 한 사람 — 낮고 느린 다큐 말투'; s.소리.첫말초 = 0.6;
  s.소리.원고 = [['C1', 0.6, '라면 물이 끓기 시작했다.'], ['C3', 6.0, '두 번째 그릇.']];
  if (시험) s.소리.원고시험 = { 누가: '맥락 없는 서브에이전트', 날짜: '2026-11-18', 줄: s.소리.원고.map(([, , 글]) => ({ 글, 판정: '바로', 뜻: '들린 뜻' })) };
};
// 표의 줄을 그대로 옮긴 이미지 지시문(지시문 틀 순서) — 그 컷에 나오는 소품은 맨 위 「소품」 표의 생김새 문장을 PROPS에 그대로 쓴다. 더: 끝에 붙일 줄
const 색감표 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '영상양식', '색감이름.json'), 'utf8'));
const 색감줄 = (표) => 색감표.이름.find((x) => x.이름 === (표 && 표.색감));
const 표대로그림글 = (표, d, { 옷 = true, 소품 = true, 더 = [] } = {}) => [
  `SETTING: ${표.장면[d.장면].장소}`,
  `LIGHT: ${표.장면[d.장면].빛}`,
  ...(색감줄(표) ? [`GRADE: ${색감줄(표).뼈대}`] : []),
  ...(표.세트 ? [`PALETTE: ${표.세트}`] : []),
  ...d.인물.map((n) => `WHO: ${표.인물[n].묘사}${옷 ? ` ${표.인물[n].옷}` : ' A grey hoodie.'}`),
  `MOMENT: ${d.line}`,
  `FRAME: ${d.구도}${d.앵글 && d.앵글.렌즈 ? `, ${d.앵글.렌즈}mm lens` : ''}`,   // 렌즈 계획(11-25) — FRAME 줄에 컷표 「앵글.렌즈」 그대로
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
  깨뜨림.forEach(([이름, , 원함, 꼭 = []], i) => {
    const r = 결과들[i];
    const 걸림 = 걸림글(r);
    if (r.코드 !== 1 || !걸림.length || !걸림.every((g) => 원함.test(g))) 틀림.push(`${이름} → 코드 ${r.코드} · ${걸림.join(' / ') || '걸림 없음'}`);
    // 꼭: 저마다 맞는 걸림이 하나씩 있어야 하는 정규식들 — 꼴 걸림 하나만 남고 값 검사의 걸림이 사라져도 위 줄은 지나간다(11-21 GPT 검수 GA8)
    const 빠짐 = 꼭.filter((re) => !걸림.some((g) => re.test(g)));
    if (빠짐.length) 틀림.push(`${이름} → 있어야 할 걸림이 빠짐: ${빠짐.map(String).join(' · ')} — 나온 것: ${걸림.join(' / ')}`);
    const 다른 = r.항목들.filter((x) => x.항목 !== '틀' && x.등급 === '걸림');
    if (다른.length) 틀림.push(`${이름} → 다른 항목이 걸림: ${JSON.stringify(다른)}`);
  });
  assert.deepEqual(틀림, []);
});

// 걸면 안 되는 꼴 — 오탐을 고정한다
const 지나감 = [
  ['T30 손이 떨리는 비유는 시늉이 아니다', (s) => { 컷(s, 'C2').연기[1].무엇 = '입술이 살짝 벌어지고 손이 떨리는 것처럼 보인다'; }],
  ['T30 시늉 박자에 같은 컷의 대사가 있으면 지나간다', (s) => { 컷(s, 'C1').연기[1].무엇 = '빈 손을 숟가락처럼 오므려 떠먹는 시늉을 한다'; 컷(s, 'C1').소리 = '가스 불 탁 · 수아 「밥은 먹었어?」'; }],
  ['T30 시늉 박자에 화면에 든 진짜 소품이 나오면 지나간다', (s) => { 컷(s, 'C3').연기[0].무엇 = '옆집 손이 문틈으로 빈그릇을 내밀며 먹으라는 시늉을 한다'; }],
  ['T30 말 · 소품 없이 읽히는 몸짓은 「시늉까닭」을 적으면 주의만', (s) => { 컷(s, 'C2').연기[1].무엇 = '검지를 입술에 대고 쉿 하는 손짓을 한다'; 컷(s, 'C2').시늉까닭 = '누구나 아는 쉿 손가락 — 말 없이도 조용히로 읽힌다'; }],
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
  ['조판한 원고를 참고로 넣어 장면과 한 장으로 굽는 글자는 얹은 것이 아니다(점검표 46의 막는 법)', (s) => { s.글자.push({ 글: '서울로', 종류: '장면속', 어디: 'C4 하늘', 만드는법: '글꼴 윤곽으로 조판한 원고를 참고로 넣어 장면과 한 장으로 굽는다' }); }],
  ['합성하지 않는다는 말은 얹은 것이 아니다', (s) => { s.글자[0].만드는법 = '편집에서 합성하지 않음 — 나무 간판을 깎아 세워 찍는다'; }],
  ['「합성은 하지 않고」 · 「HTML 대신」도 부정이다', (s) => { s.글자[0].만드는법 = '합성은 하지 않고, HTML 대신 나무 간판을 깎아 세워 찍는다'; }],
  ['「HTML을 사용하지 않고」 · 「합성 작업은 하지 않는다」도 부정이다(GA1 둘째 회차)', (s) => { s.글자[0].만드는법 = 'HTML을 사용하지 않고 나무 간판을 깎아 세워 찍는다. 합성 작업은 하지 않는다'; }],
  ['「합성하는 대신 그린 글자」 · 「안 얹고 장면에 굽는다」는 얹지 않은 것이다', (s) => { s.글자[0].만드는법 = '합성하는 대신 그린 글자. 안 얹고 장면에 굽는다'; }],
  ['잇달아 온 얹는 말은 뒤 말의 부정을 물려받는다(「HTML 오버레이는 쓰지 않는다」) · 「기본 글꼴로 치지 않는다」', (s) => { s.글자[0].만드는법 = 'HTML 오버레이는 쓰지 않는다 — 기본 글꼴로 치지 않는다 — 나무 간판을 깎아 세워 찍는다'; }],
  ['「시안 한 장」 · 「잘못 구운」의 안 · 못은 굽는 말의 부정이 아니다', (s) => { s.글자[0].만드는법 = '잘못 구운 판은 버리고 조판한 원고를 참고로 넣어 장면과 한 장으로 굽고 시안 한 장을 고른다'; }],
  ['서울로 꼴: 「…으로 굽는다. 화면에 얹는 글자 없음」', (s) => { s.글자[0].만드는법 = '장면과 한 장으로 구움 — 글자 원고 그림을 참고로 넣는다. 영상은 그 그림을 시작 프레임으로 굽는다. 화면에 얹는 글자 없음'; }],
  ['정보 글자는 조판해 얹어도 걸지 않는다', (s) => { s.글자.push({ 글: '2026', 종류: '정보', 어디: '아래 가운데', 만드는법: 'HTML로 조판해 얹음' }); }],
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
  ['사람과 탈것이 한 컷이어도 인물 줄에 키가 있으면 된다(11-18 이후 편)', (s) => { 버스넣기(s); s.편.만든날 = '2026-11-18'; for (const n of Object.keys(s.인물)) s.인물[n].키 = '버스 창틀 아래 끝이 머리 높이에 온다'; }],
  ['앞선 편은 사람과 탈것이 한 컷이고 키 칸이 없어도 주의만(진행 중인 편의 판을 막지 않는다)', (s) => { 버스넣기(s); s.편.만든날 = '2026-11-17'; }],
  ['원고시험이 지금 원고 줄을 모두 「바로」로 덮으면 된다(11-18 이후 편)', (s) => { 원고넣기(s, { 시험: true }); s.편.만든날 = '2026-11-18'; }],
  ['앞선 편은 원고시험 칸이 없어도 주의만(진행 중인 편의 판을 막지 않는다)', (s) => { 원고넣기(s); s.편.만든날 = '2026-11-17'; }],
  ['한 컷에 탈것이 둘이어도 장면 줄에 차간격이 있으면 된다(11-19 이후 편)', (s) => { 버스넣기(s); for (const d of s.detail) d.소품.택시 = d.cut === 'C1' ? '커브에' : '화면밖'; for (const n of Object.keys(s.인물)) s.인물[n].키 = '버스 창 아래 끝에 어깨가 온다'; s.편.만든날 = '2026-11-19'; s.장면[컷(s, 'C1').장면].차간격 = 'about a third of a car length apart'; }],
  ['앞선 편은 탈것 둘인데 차간격 칸이 없어도 주의만(진행 중인 편의 판을 막지 않는다)', (s) => { 버스넣기(s); for (const d of s.detail) d.소품.택시 = d.cut === 'C1' ? '커브에' : '화면밖'; for (const n of Object.keys(s.인물)) s.인물[n].키 = '버스 창 아래 끝에 어깨가 온다'; s.편.만든날 = '2026-11-18'; }],
  ['말자막 크기가 72px이면 된다(11-19 이후 편)', (s) => { s.글자.push({ 글: '라면 물이 끓는다', 종류: '말자막', 어디: 'C1', 만드는법: '내레이션 말자막', 크기: 72 }); s.편.만든날 = '2026-11-19'; }],
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

// T19 글자 시안(11-16 · 점검표 7 · 22 · 24 · 46) — 편 날짜(편 폴더 이름 끝 _YYYYMMDD, 없으면 「편.만든날」)가 2026-11-17 이후인 컷표만 본다.
//   폴더: 임시 폴더 안에 만들 편 폴더(「PULSE_x_20261120/E01」처럼 위층 날짜도 된다, null이면 날짜 없는 임시 폴더) · 파일: 편 폴더 안에 만들 시안 파일
function 시안돌리기(고침, { 폴더 = '라면_20261120', 파일 = [], 더 = [] } = {}) {
  const 바깥 = 임시();
  const dir = 폴더 ? path.join(바깥, ...폴더.split('/')) : 바깥;
  fs.mkdirSync(dir, { recursive: true });
  // 파일마다 내용을 달리 쓴다 — 검사는 내용이 같은 그림을 하나로 센다
  for (const f of 파일) { const p = path.join(dir, ...f.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `png ${f}`); }
  return 틀돌리기(고침, 더, dir);
}
const 글자줄 = (r, 등급) => r.항목들.filter((x) => x.항목 === '틀' && x.컷 === '글자' && x.등급 === 등급).map((x) => x.글);
const 마감 = ['--영상', '최종.mp4', '--항목', '틀'];   // 영상관문판의 마감 실행처럼 --영상을 준다(--항목 틀이면 영상 파일은 열지 않는다)
const 틀시안 = ['시안/끝로고_A.png', '시안/끝로고_B.png'];   // 예시 틀의 끝로고 줄이 「시안」에 적은 두 파일

test('틀 2 — 글자 시안(T19): 시안 파일이 둘보다 적으면 표만 볼 때 주의 · --영상이면 걸림이고, 둘 있으면 지나가며, 「시안없음」 까닭은 --영상이어도 주의로 남는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 없음 = 시안돌리기(null);
  assert.equal(없음.코드, 0, JSON.stringify(걸림글(없음)));
  const 주의 = 글자줄(없음, '주의');
  assert.equal(주의.length, 1, JSON.stringify(주의));
  assert.match(주의[0], /^글자 「\(브랜드 이름\)」\(끝로고\) 「시안」에 있는 파일이 0개다\(없는 파일: 시안\/끝로고_A\.png · 시안\/끝로고_B\.png\) — 실제 장면 위에 얹은 시안을 둘 이상 만들어 그 그림 경로를 「시안」에 적는다/);
  assert.match(글자줄(시안돌리기(null, { 파일: [틀시안[0]] }), '주의').join('\n'), /있는 파일이 1개다\(없는 파일: 시안\/끝로고_B\.png\)/);
  assert.match(글자줄(시안돌리기((s) => { s.글자[0].시안 = [틀시안[0], `./${틀시안[0].replace('/', '\\')}`, 틀시안[0].toUpperCase()]; }, { 파일: [틀시안[0]] }), '주의').join('\n'),
    /있는 파일이 1개다/, '같은 그림을 이름만 바꿔 두 번 적어도 하나로 센다');
  // 11-16 GPT 검수 GA3 — 같은 파일을 상대 · 절대 경로로 적거나, 같은 그림을 다른 이름으로 복사해도 시안 하나다(--영상이면 걸림 그대로)
  const 두길 = 임시();
  const 두길판 = 틀돌리기((s) => { s.글자[0].시안 = [틀시안[0], path.join(두길, '라면_20261120', ...틀시안[0].split('/'))]; }, 마감,
    (() => { const d = path.join(두길, '라면_20261120'); fs.mkdirSync(path.join(d, '시안'), { recursive: true }); fs.writeFileSync(path.join(d, ...틀시안[0].split('/')), 'png A'); return d; })());
  assert.equal(두길판.코드, 1, '상대 · 절대 경로로 같은 파일을 두 번 적어도 시안 하나다');
  assert.match(걸림글(두길판).join('\n'), /있는 파일이 1개다\(내용이 같은 그림 1개는 하나로 셌다\)/);
  const 복사 = 틀돌리기(null, 마감, (() => {
    const d = path.join(임시(), '라면_20261120'); fs.mkdirSync(path.join(d, '시안'), { recursive: true });
    for (const f of 틀시안) fs.writeFileSync(path.join(d, ...f.split('/')), 'png 같은 그림'); return d;
  })());
  assert.equal(복사.코드, 1, '같은 그림을 이름만 바꿔 복사한 둘은 시안 하나다');
  assert.match(걸림글(복사).join('\n'), /있는 파일이 1개다\(내용이 같은 그림 1개는 하나로 셌다\)/);
  const 둘 = 시안돌리기(null, { 파일: 틀시안 });
  assert.equal(둘.코드, 0);
  assert.deepEqual(둘.항목들.filter((x) => ['걸림', '확인', '주의', '알림'].includes(x.등급)), [], '시안이 다 있으면 예시 틀처럼 깨끗하다');
  // --영상(편집 · 마감)이면 같은 줄이 걸림이다 — 걸림 글이 통과하는 법을 말한다
  const 걸린판 = 시안돌리기(null, { 더: 마감 });
  assert.equal(걸린판.코드, 1);
  assert.equal(걸림글(걸린판).length, 1, 걸림글(걸린판).join('\n'));
  assert.match(걸림글(걸린판)[0], /^글자: 글자 「\(브랜드 이름\)」\(끝로고\) 「시안」에 있는 파일이 0개다.*실제 장면 위에 얹은 시안을 둘 이상 만들어 그 그림 경로를 「시안」에 적는다/);
  const 지난판 = 시안돌리기(null, { 파일: 틀시안, 더: 마감 });
  assert.equal(지난판.코드, 0, 걸림글(지난판).join('\n'));
  // 「시안없음」에 까닭을 적으면 --영상이어도 주의(승인된 로고 파일을 그대로 쓰는 편)
  const 뺌 = 시안돌리기((s) => { delete s.글자[0].시안; s.글자[0].시안없음 = '승인된 회사 로고 파일을 그대로 쓴다'; }, { 더: 마감 });
  assert.equal(뺌.코드, 0, 걸림글(뺌).join('\n'));
  assert.match(글자줄(뺌, '주의').join('\n'), /「시안」에 있는 파일이 0개다 — 「시안없음」 까닭: 승인된 회사 로고 파일을 그대로 쓴다/);
  const 빈까닭 = 시안돌리기((s) => { s.글자[0].시안없음 = ' '; }, { 더: 마감 });
  assert.equal(빈까닭.코드, 1, '빈 「시안없음」은 까닭이 아니다');
  // 절대 경로도 받고, 강조 · 이름 · 장면속도 같은 규칙이며, 말자막 · 정보 줄에는 시안을 묻지 않는다
  const 밖 = 임시(); const 절대 = 쓰기(밖, '끝로고_C.png', 'png');
  const 섞음 = 시안돌리기((s) => {
    s.글자[0].시안 = [절대, 틀시안[1]];
    s.글자.push({ 글: '두 그릇', 종류: '강조', 어디: 'C4 가운데', 만드는법: '그린 글자', 시안: '시안/강조_A.png' });
    s.글자.push({ 글: '수아', 종류: '이름', 어디: 'C1 아래', 만드는법: '그린 글자' });
    s.글자.push({ 글: '라면', 종류: '장면속', 어디: 'C1 냄비 옆 봉지', 만드는법: '봉지 원고를 디자인해 장면과 한 장으로 굽는다' });
    s.글자.push({ 글: '(대사 자막)', 종류: '말자막', 어디: '아래 가운데', 만드는법: '회사 글꼴 SUIT로 침' });
    s.글자.push({ 글: '15초', 종류: '정보', 어디: '아래 가운데', 만드는법: '자막 도구' });
  }, { 파일: [틀시안[1], '시안/강조_A.png'] });
  const 섞음주의 = 글자줄(섞음, '주의');
  assert.equal(섞음주의.length, 3, JSON.stringify(섞음주의));
  assert.match(섞음주의.join('\n'), /「두 그릇」\(강조\) 「시안」에 있는 파일이 1개다/);
  assert.match(섞음주의.join('\n'), /「수아」\(이름\) 「시안」에 있는 파일이 0개다/);
  assert.match(섞음주의.join('\n'), /「라면」\(장면속\) 「시안」에 있는 파일이 0개다/);
  assert.ok(!섞음주의.some((g) => /끝로고|말자막|\(정보\)/.test(g)), JSON.stringify(섞음주의));
});

test('틀 2 — 글자 시안(T19)의 날짜 문: 2026-11-17 이후인 편만 보고(폴더 이름 · 위층 폴더 이름 · 「편.만든날」), 날짜를 못 읽거나 앞선 편은 --영상이어도 묻지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 시안주의 = (r) => 글자줄(r, '주의').filter((g) => g.includes('「시안」'));
  assert.equal(시안주의(시안돌리기(null, { 폴더: '라면_20261117' })).length, 1, '11-17 당일부터 본다');
  assert.equal(시안주의(시안돌리기(null, { 폴더: 'PULSE_웹드라마_20261120/E01' })).length, 1, '편 폴더 위층의 날짜도 읽는다(회차 폴더)');
  assert.equal(시안주의(시안돌리기((s) => { s.편.만든날 = '2026-11-20'; }, { 폴더: null })).length, 1, '날짜 없는 폴더(.tmp 공모)는 「편.만든날」');
  assert.equal(시안주의(시안돌리기((s) => { s.편.만든날 = '20261117'; }, { 폴더: null })).length, 1, '「편.만든날」은 YYYYMMDD도 받는다');
  const 앞선편 = 시안돌리기(null, { 폴더: '라면_20261116', 더: 마감 });
  assert.equal(앞선편.코드, 0, 걸림글(앞선편).join('\n'));
  assert.deepEqual(시안주의(앞선편), []);
  const 날짜없음 = 시안돌리기(null, { 폴더: null, 더: 마감 });
  assert.equal(날짜없음.코드, 0, 걸림글(날짜없음).join('\n'));
  assert.deepEqual(시안주의(날짜없음), [], '날짜를 못 읽는 컷표(이미 만든 편 · 시험 임시 폴더)는 묻지 않는다');
  assert.deepEqual(시안주의(시안돌리기((s) => { s.편.만든날 = '11월 20일'; }, { 폴더: null })), [], '못 읽는 만든날은 날짜가 없는 것과 같다');
  assert.deepEqual(시안주의(시안돌리기((s) => { s.편.만든날 = '2026-11-20'; }, { 폴더: '라면_20261110' })), [], '폴더 이름의 날짜가 먼저다');
});

test('틀 2 — 편 날짜가 2026-11-17 이후면 굽는 말이 마지막 얹는 말 뒤에 와야 구운 것으로 센다(「구운 그림 위에 조판해 합성」은 걸림), 날짜 없는 컷표는 이 순서를 보지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 끝로고법 = (법) => (s) => { s.글자[0].만드는법 = 법; };
  for (const 법 of ['구운 그림 위에 서울남산체로 조판해 원근 합성', '끝 컷은 그대로 굽고 제목은 서울남산체로 조판해 원근 합성']) {
    const 엄격 = 시안돌리기(끝로고법(법), { 파일: 틀시안 });
    assert.equal(엄격.코드, 1, `${법}: 날짜 있는 편은 걸림`);
    assert.match(걸림글(엄격).join('\n'), /\(끝로고\) 만드는법 「.*」 — .*글꼴로 치지 않는다\(24 · 46 · 55\)\. 장면에 굽는 글자면 참고 원고를 앞에/);
    assert.equal(시안돌리기(끝로고법(법), { 폴더: null }).코드, 0, `${법}: 날짜 없는 컷표(이미 만든 편)는 순서를 보지 않는다`);
  }
  for (const 법 of ['글꼴 윤곽으로 조판한 원고를 참고로 넣어 장면과 한 장으로 굽는다', '장면과 한 장으로 구움 — 글자 원고 그림을 참고로 넣는다. 영상은 그 그림을 시작 프레임으로 굽는다. 화면에 얹는 글자 없음']) {
    const r = 시안돌리기(끝로고법(법), { 파일: 틀시안 });
    assert.equal(r.코드, 0, `${법}: ${걸림글(r).join(' / ')}`);
  }
});

test('틀 2 — 정보 글을 조판 · 합성 · HTML로 화면에 얹는 줄은 주의 한 줄로 묶어 알리고(날짜 문 안 · --영상이어도 주의), 장면에 굽는 줄과 날짜 없는 편은 묻지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 정보줄 = (r) => 글자줄(r, '주의').filter((g) => g.startsWith('정보 글'));
  const 얹음 = (s) => {
    s.글자.push({ 글: '2026', 종류: '정보', 어디: '아래 가운데', 만드는법: 'HTML로 조판해 얹음' });
    s.글자.push({ 글: '서울로 7017', 종류: '정보', 어디: '아래 가운데', 만드는법: 'SUIT로 합성' });
    s.글자.push({ 글: '오전 7시', 종류: '정보', 어디: 'C1 벽시계', 만드는법: '벽시계 바늘을 그림 단계에서 장면과 한 장으로 굽는다' });
  };
  const r = 시안돌리기(얹음, { 파일: 틀시안, 더: 마감 });
  assert.equal(r.코드, 0, 걸림글(r).join('\n'));
  const 줄 = 정보줄(r);
  assert.equal(줄.length, 1, JSON.stringify(글자줄(r, '주의')));
  assert.match(줄[0], /^정보 글 2줄을 화면에 얹는다\(「2026」 외\) — 광고 · 공모 · 포트폴리오 작품이면.*앱 · 화면 시연처럼 일부러 얹는 편이면 그대로 둔다\(점검표 7 · 40/);
  assert.deepEqual(정보줄(시안돌리기((s) => { s.글자.push({ 글: '2026', 종류: '정보', 어디: '아래 가운데', 만드는법: '편집에서 합성하지 않고 말로 한다' }); }, { 파일: 틀시안 })), [], '얹지 않는다는 말');
  assert.deepEqual(정보줄(시안돌리기(얹음, { 폴더: null })), [], '날짜 없는 편');
  assert.deepEqual(정보줄(시안돌리기((s) => { s.글자.push({ 글: '15초', 종류: '정보', 어디: '아래 가운데', 만드는법: '자막 도구' }); }, { 파일: 틀시안 })), [], '정보 글은 자막 도구로 치는 것이 제자리다');
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

test('옛 틀 — 이웃한 두 컷이 같은 받은 영상을 잘라 붙이면 걸림(50), 사이에 다른 판을 끼운 되쓰기 · 같은판에 까닭을 적은 컷은 지나간다', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 2026-11-13 synkbrief B44 최종 확인 미흡 — V4 한 판을 전체 → 1.15 → 1.3배로, V7 한 판을 1.0 → 1.2 → 1.4배로 이은 점프컷이 옛 틀이라 걸림 0으로 지나갔다
  const dir = 임시();
  const 표 = (detail) => 쓰기(dir, `옛틀_${Math.random().toString(36).slice(2)}.json`, JSON.stringify({ detail, 소품: [], 사건: [], 소리사건: [] }));
  const 줄 = (cut, 영상, 더 = {}) => ({ cut, t: 0, dur: 1, 영상, ...더 });
  const 편집 = (r) => r.항목들.filter((x) => x.항목 === '편집');
  // B44 v12의 끝 10초 꼴(같은 V7 셋) — 둘째 · 셋째가 걸린다
  const r1 = 돌리기([표([줄('c09', 'V4'), 줄('c10', 'V7'), 줄('c11', 'V7'), 줄('c12', 'V7')])]);
  assert.equal(r1.코드, 1);
  assert.deepEqual(편집(r1).map((x) => [x.컷, x.등급]), [['c11', '걸림'], ['c12', '걸림']]);
  assert.match(편집(r1)[0].글, /앞 컷 c10과 같은 받은 영상 「V7」를 잇달아 잘라 붙였다\(50\).*같은판: "<까닭>"/);
  // 「판」 칸도 같은 받은 영상으로 본다
  assert.deepEqual(편집(돌리기([표([줄('A1', undefined, { 판: 'P1' }), 줄('A2', undefined, { 판: 'P1' })])])).map((x) => x.컷), ['A2']);
  // 지나가는 것: 사이에 인서트를 끼운 되쓰기(B44 첫머리 V1 → V2 → V1) · 같은판 까닭 · 이어찍기 · 같은 컷 이름의 토막 · 영상 칸이 빈 컷
  for (const detail of [
    [줄('c01', 'V1'), 줄('c02', 'V2'), 줄('c03', 'V1'), 줄('c04', 'V2'), 줄('c05', 'V1')],
    [줄('c10', 'V7'), 줄('c11', 'V7', { 같은판: '한 방을 둘로 자른 컷 — 사이에 위 표시만 바뀜' })],
    [줄('c10', 'V7'), 줄('c11', 'V7', { 이어찍기: true })],
    [줄('c10', 'V7'), 줄('c10', 'V7')],
    [줄('A1'), 줄('A2')],
  ]) {
    const r = 돌리기([표(detail)]);
    assert.deepEqual(편집(r), [], JSON.stringify(detail));
    assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 === '걸림')));
  }
  // 같은판 true만으로는 밝힌 것이 아니다
  assert.deepEqual(편집(돌리기([표([줄('c10', 'V7'), 줄('c11', 'V7', { 같은판: true })])])).map((x) => x.컷), ['c11']);
  // --항목에 틀이 없으면 이 줄도 돌지 않는다
  assert.deepEqual(편집(돌리기([표([줄('c10', 'V7'), 줄('c11', 'V7')]), '--항목', '소품,사건,소리'])), []);
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
  `LOOK: ${빛} ${색감줄(틀읽기()).영상뼈대} The light and colour stay exactly like this to the last frame. No new people, no new text.`,
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
글 = "LOOK: " + 빛 + " " + k.고른색감(seq)["영상뼈대"] + " The table is evenly lit."
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

test('틀 2 + --그림지시문 — 두 단계(그림단계 맨얼굴) 컷은 맨얼굴묘사로 견주고, <컷>_끝 · <컷>_가운데도 같은 규칙, _로 시작하는 공통 편집 지시문은 알림', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 「Still」(2026-11-15): 은색 칠 얼굴은 맨얼굴 판을 먼저 굽고 칠만 입히는 두 단계라, 1단계 지시문에는 칠 문장이 없다
  const dir = 임시();
  const 맨 = 'Sua is 28 years old - the same woman as in the reference, in this first pass with no stage make-up at all.';
  const 고침 = (s) => { s.인물.수아.맨얼굴묘사 = 맨; 컷(s, 'C1').그림단계 = '맨얼굴'; };
  const 표 = 틀읽기(); 고침(표);
  const 맨글 = (d) => 표대로그림글(표, d).replace(표.인물.수아.묘사, 맨);
  const 폴더 = path.join(dir, '두단계'); fs.mkdirSync(폴더);
  for (const d of 표.detail) 쓰기(폴더, `${d.cut}.txt`, d.cut === 'C1' ? 맨글(d) : 표대로그림글(표, d));
  쓰기(폴더, 'C1_끝.txt', 맨글(컷(표, 'C1')));
  쓰기(폴더, 'C2_가운데.txt', 표대로그림글(표, 컷(표, 'C2')));
  쓰기(폴더, 'C2_끝.txt', 표대로그림글(표, 컷(표, 'C2'), { 옷: false }));
  쓰기(폴더, '_칠입히기.txt', `Edit [IMG1]. Only change: ${표.인물.수아.묘사}`);
  const r = 틀돌리기(고침, ['--그림지시문', 폴더], dir);
  const 그림 = (이름) => r.항목들.filter((x) => x.항목 === '그림지시문' && x.컷 === 이름).map((x) => `${x.등급}: ${x.글}`);
  assert.deepEqual(그림('C1'), ['통과: 장소 · 빛 · 인물 줄이 표 그대로']);
  assert.deepEqual(그림('C1_끝'), ['통과: 장소 · 빛 · 인물 줄이 표 그대로']);
  assert.deepEqual(그림('C2_가운데'), ['통과: 장소 · 빛 · 인물 줄이 표 그대로']);
  assert.match(그림('C2_끝')[0], /^걸림: 인물 「수아」의 옷 문장이 글자 그대로 들어 있지 않다/);
  assert.match(그림('_칠입히기')[0], /^알림: 편 공통 지시문\(컷과 견주지 않는다\)/);
  assert.equal(r.코드, 1);
  // 맨얼굴 컷에 칠한 묘사를 그대로 넣으면 맨얼굴묘사가 빠졌다고 걸린다
  const 폴더2 = path.join(dir, '칠한채'); fs.mkdirSync(폴더2);
  for (const d of 표.detail) 쓰기(폴더2, `${d.cut}.txt`, 표대로그림글(표, d));
  const r2 = 틀돌리기(고침, ['--그림지시문', 폴더2], dir);
  assert.match(r2.항목들.find((x) => x.항목 === '그림지시문' && x.컷 === 'C1').글, /인물 「수아」의 맨얼굴묘사 문장이 글자 그대로 들어 있지 않다/);
  // 컷 도중에 들어오는 사람은 시작 그림에 없다 — 「그림인물」이 빈 목록이면 시작 그림은 그 사람 줄 없이 통과하고, 끝 그림은 「끝그림인물」(없으면 「인물」)로 본다
  const 고침3 = (s) => { 컷(s, 'C2').그림인물 = []; };
  const 표3 = 틀읽기(); 고침3(표3);
  const 폴더3 = path.join(dir, '들어옴'); fs.mkdirSync(폴더3);
  for (const d of 표3.detail) 쓰기(폴더3, `${d.cut}.txt`, d.cut === 'C2' ? 표대로그림글({ ...표3, 인물: {} }, { ...d, 인물: [] }) : 표대로그림글(표3, d));
  쓰기(폴더3, 'C2_끝.txt', 표대로그림글({ ...표3, 인물: {} }, { ...컷(표3, 'C2'), 인물: [] }));
  const r3 = 틀돌리기(고침3, ['--그림지시문', 폴더3], dir);
  const 그림3 = (이름) => r3.항목들.filter((x) => x.항목 === '그림지시문' && x.컷 === 이름).map((x) => x.등급);
  assert.deepEqual(그림3('C2'), ['통과']);
  assert.deepEqual(그림3('C2_끝'), ['걸림']);
  // 표의 장소 문장 속 소품 낱말(넓은 그림 기준)은 지시문을 쓴 사람의 말이 아니라 확인을 띄우지 않는다
  const 고침4 = (s) => { s.장면.부엌밤.장소 += ' Clean bowls are stacked on a shelf by the window.'; };
  const 표4 = 틀읽기(); 고침4(표4);
  const 폴더4 = path.join(dir, '장소낱말'); fs.mkdirSync(폴더4);
  for (const d of 표4.detail) 쓰기(폴더4, `${d.cut}.txt`, 표대로그림글(표4, d));
  쓰기(폴더4, 'C4_끝.txt', 표대로그림글(표4, 컷(표4, 'C4'), { 더: ['A second bowl appears beside it.'] }).replace(표4.소품.빈그릇.생김새, ''));
  const r4 = 틀돌리기(고침4, ['--그림지시문', 폴더4], dir);
  const 확인4 = r4.항목들.filter((x) => x.항목 === '그림지시문' && x.등급 === '확인').map((x) => x.컷);
  assert.deepEqual(확인4, [], JSON.stringify(r4.항목들.filter((x) => x.항목 === '그림지시문')));
  assert.match(r4.항목들.find((x) => x.항목 === '그림지시문' && x.컷 === 'C4_끝').글, /소품 「빈그릇」의 생김새/);
  // 컷 도중에 화면을 떠나는 소품은 「끝소품」에 적으면 끝 그림에서는 생김새를 요구하지 않는다
  const r5 = 틀돌리기((s) => { 고침4(s); 컷(s, 'C4').끝소품 = { 빈그릇: '화면밖' }; }, ['--그림지시문', 폴더4], dir);
  // 걸림은 없어지고, 화면 밖이라 적은 그릇을 지시문이 다시 부르면(A second bowl …) 확인이 남는다
  assert.deepEqual(r5.항목들.filter((x) => x.항목 === '그림지시문' && x.컷 === 'C4_끝').map((x) => x.등급), ['통과', '확인']);
});

test('틀 2 + --그림지시문 — 방향(점검표 43): 컷표에 걷기 · 들고 남 · 밀고 끄는 것이 있는데 그림 지시문에 가는 쪽이 없으면 걸림, 자리만 말하는 문장은 세지 않고, 물건마다 한 번 적히면 지나가고, 한 번도 안 적힌 물건은 확인, 부정문은 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 11-15 서울로 애니 네 지적(신발이 거꾸로 · 유모차 방향 · 거꾸로 걷는 사람)은 모두 시작 그림부터 반대쪽을 보고 있었고, 그림 글에 무엇이 어디를 보는지가 빠져 있었다
  const dir = 임시();
  const 걷기 = (s) => { 컷(s, 'C1').연기[0].무엇 = '수아가 유모차를 밀고 부엌으로 걸어 들어온다'; };
  let n = 0;
  const 돌림 = (더) => {
    const p = path.join(dir, `판${n++}`); fs.mkdirSync(p);
    const 표 = 틀읽기(); 걷기(표);
    for (const d of 표.detail) 쓰기(p, `${d.cut}.txt`, 표대로그림글(표, d, { 더: d.cut === 'C1' ? 더 : [] }));
    const r = 틀돌리기(걷기, ['--그림지시문', p], dir);
    return { r, 방향: r.항목들.filter((x) => x.항목 === '방향').map((x) => `${x.컷} ${x.등급}: ${x.글}`) };
  };
  // 옛 판 — 자리만 말한다(「at the left of the frame」 · 「near the frame's left edge」는 가는 쪽이 아니다): 걸림
  let { r, 방향 } = 돌림(['Sua stands at the left of the frame, one hand on the pram.']);
  assert.equal(방향.length, 1, JSON.stringify(방향));
  assert.match(방향[0], /^C1 걸림: 컷표에 「(밀고|걸어|들어오|유모차)」\(걷기 · 들고 남 · 탈것 · 밀고 끄는 물건\)이 있는데 그림 지시문에 어디를 보고 어느 쪽으로 가는지가 없다.*\(점검표 43\)$/);
  assert.equal(r.코드, 1);
  ({ 방향 } = 돌림(['Sua stands near the frame\'s left edge, one hand on the pram.']));   // GPT 방향규칙-20261115b GA1
  assert.match(방향[0] || '', /^C1 걸림: 컷표에 /, JSON.stringify(방향));
  // 참고 그림 목록(REFS)의 방향 말은 장면의 방향이 아니다 — 걸림(GPT 방향규칙-20261115b GA2)
  ({ 방향 } = 돌림(['REFS: [IMG1] Sua facing the camera.', 'Sua enters the kitchen holding a bowl.']));
  assert.match(방향[0] || '', /^C1 걸림: 컷표에 /, JSON.stringify(방향));
  // 보는 쪽 말 뒤의 「frame's left edge」는 방향이다
  ({ 방향 } = 돌림(['Sua walks toward the frame\'s left edge, pushing the pram ahead of her.']));
  assert.deepEqual(방향, []);
  // 새 판 — 사람과 유모차마다 가는 쪽: 지나간다(다른 컷은 컷표에 걷기가 없어 묻지 않는다)
  ({ r, 방향 } = 돌림(['Sua walks toward the left edge of the frame, facing the way she walks.', 'The kitchen is warm and quiet.',
    'She pushes the pram ahead of her: its hood faces the left edge of the frame, its four wheels on the floor.', 'The pram stops by the table.']));
  assert.deepEqual(방향, []);
  assert.equal(r.코드, 0, JSON.stringify(r.항목들.filter((x) => x.등급 !== '통과' && x.등급 !== '알림')));
  // 사람은 적었는데 유모차는 한 번도 안 적었다 — 확인(낱말로 짐작하는 판정이라)
  ({ r, 방향 } = 돌림(['Sua walks toward the left edge of the frame.', 'The kitchen is warm and quiet.', 'A navy pram stands by the door.']));
  assert.equal(방향.length, 1, JSON.stringify(방향));
  assert.match(방향[0], /^C1 확인: 걷는 사람 · 탈것 · 미는 물건 가운데 어디를 보고 어느 쪽으로 가는지가 한 번도 안 적힌 것: 「pram」 — 「A navy pram stands by the door\.」/);
  assert.equal(r.코드, 2);
  // 참고 그림 목록(REFS) · 금지(NOT) 줄의 이름, 「inside the van」 · 「bus stop」은 묻지 않는다. 「from left to right」는 방향이다
  ({ 방향 } = 돌림(['REFS: [IMG1] Sua with the pram.', 'Sua walks in from left to right.', 'The radio is playing.', 'Rain beads on the glass of a bus stop outside.',
    'The light is like the light inside the van.', 'NOT: no one else walks by; no pram.']));
  assert.deepEqual(방향, []);
  // 방향을 부정문으로 적으면 주의(나노바나나가 그림을 거절했다 · 현장 노트 gemini_사진 11-15)
  ({ 방향 } = 돌림(['Sua walks toward the camera.', 'Neither foot is turned around backwards on its leg.']));
  assert.equal(방향.length, 1, JSON.stringify(방향));
  assert.match(방향[0], /^C1 주의: 방향을 부정문으로 적었다 — 「Neither foot is turned around」.* · 점검표 43\)$/);
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

// 11-20 설계 검토(장면 3) — 내기 도구가 편 폴더를 안 넘겨, 「편.만든날」 없이 폴더 이름에만 날짜가 있는 편은 날짜 문이 달린 검사(T19~T29)가 모두 주의로 지나갔다
test('내기 도구 — 굽기전() + 컷표: 편 폴더 이름의 날짜를 읽어 명령줄 검사와 같은 등급을 낸다(「편.만든날」이 없어도 새 편의 빈 타당성 칸은 걸림, 앞선 편은 주의)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 짓기 = (폴더이름) => {
    const 편 = path.join(dir, 폴더이름); fs.mkdirSync(편);
    const 표 = 틀읽기(); delete 컷(표, 'C3').타당성;
    assert.equal(표.편.만든날, undefined, '틀에는 「편.만든날」이 없다 — 날짜는 폴더 이름에서만 읽힌다');
    return { 표경로: 쓰기(편, '컷표.json', JSON.stringify(표)), 꾸러미: 꾸러미만들기(편, [{ id: 'C1', 글: 지시문글() }]) };
  };
  const 새편 = 짓기('라면_20261120');
  const g = 굽기전('함수', 새편.꾸러미);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ 컷표 C3: \[틀\] 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다/);
  const 명령줄 = 돌리기([새편.표경로]);
  assert.equal((g.stdout.match(/✗ 컷표 (?!관문)/g) || []).length, 명령줄.항목들.filter((x) => x.등급 === '걸림').length, '굽기전의 컷표 걸림 수가 명령줄 검사와 같다');
  const 앞선편 = 짓기('라면_20261119');
  const g2 = 굽기전('함수', 앞선편.꾸러미);
  assert.equal(g2.status, 0, g2.stdout + g2.stderr);
  assert.match(g2.stdout, /~ 컷표 C3: \[틀\] 두 사람 이상이 한 화면인데 「타당성」 칸이 비었다/);
});

// 11-21 GPT 검수(영상컷표꼴관문-20261120 GA2 · GA7) — 꼴 관문이 칸을 지운 표를 판 대조에 넘기면 그 칸에 기대는 판 검사가 느슨해지고(--걸림무시 「컷표」로 넘기면 그대로 나갔다),
//   뼈대가 깨진 표는 판 대조에서 예외로 죽어 걸림을 찍지 못했다. 꼴이 틀린 표로는 내지 못한다 — 무시로도 못 넘긴다.
test('내기 도구 — 굽기전() + 컷표: 꼴이 틀린 칸 · 뼈대 탈이 있는 표는 걸림을 찍고 멈춘다(--걸림무시 「컷표」 · 「모두」로도 못 넘기고, 예외로 죽지 않는다)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시();
  const 짓기 = (이름, 고침, 연기) => {
    const 편 = path.join(dir, 이름); fs.mkdirSync(편);
    const 표 = 틀읽기(); 고침(표);
    쓰기(편, '컷표.json', JSON.stringify(표));
    return 꾸러미만들기(편, [{ id: 'C2', 글: 지시문글(연기 ? { 연기 } : {}) }]);
  };
  // 인물 목록에 글이 아닌 것이 섞였다 — 꼴 걸림. 글인 이름(수아)은 남아 사람 판의 박자 둘 기준을 그대로 본다
  const 섞임 = 짓기('섞임', (s) => { 컷(s, 'C2').인물 = ['수아', null]; }, 'at about 0.8 s she raises her eyebrows and turns her head.');
  const g = 굽기전('함수', 섞임);
  assert.equal(g.status, 1, g.stdout + g.stderr);
  assert.match(g.stdout, /✗ 컷표 C2: \[틀\] 「인물」 칸은 글 목록 꼴로 적는다 — 지금은 목록이다 — 글이 아닌 것이 들어 있다/);
  assert.match(g.stdout, /✗ C2: \(연기\) 사람 연기 박자가 1개뿐/, '읽을 수 있는 이름이 남아 사람 판 기준이 그대로다');
  assert.match(g.stderr, /멈춤: 컷표에 꼴이 틀린 칸이 있다/);
  for (const 무시 of ['컷표,C2: 내일 고친다', '모두: 내일 고친다']) {
    const g2 = 굽기전('함수', 섞임, '--무시', 무시);
    assert.equal(g2.status, 1, `${무시}: ${g2.stdout}${g2.stderr}`);
    assert.match(g2.stderr, /멈춤: 컷표에 꼴이 틀린 칸이 있다.*--걸림무시로 넘기지 못한다/, 무시);
    assert.ok(!/결과: /.test(g2.stdout), `${무시}: 넘긴 판이 없다`);
  }
  // 값이 빈 칸(꼴은 맞다)은 전처럼 까닭을 적어 넘길 수 있다
  const 빈칸 = 짓기('빈칸', (s) => { s.한문장 = ''; });
  assert.equal(굽기전('함수', 빈칸, '--무시', '모두: 내일 채운다').status, 0);
  // 뼈대 탈 — 컷 줄이 객체가 아니다. 판 대조에 넘기지 않고 걸림을 찍은 뒤 멈춘다
  for (const [이름, 고침, 줄] of [['줄이 글', (s) => { s.detail[0] = 'C1'; }, /✗ 컷표 표: \[틀\] detail 1번째 줄이 객체/], ['틀이 글', (s) => { s.틀 = '둘'; }, /✗ 컷표 표: \[틀\] 「틀」은 수로 적는다/]]) {
    const g3 = 굽기전('함수', 짓기(`깨짐-${이름}`, 고침), '--무시', '모두: 내일 고친다');
    assert.equal(g3.status, 1, `${이름}: ${g3.stdout}${g3.stderr}`);
    assert.match(g3.stdout, 줄, 이름);
    assert.match(g3.stderr, /멈춤: 컷표에 꼴이 틀린 칸이 있다/, 이름);
    assert.ok(!/Traceback|Error:/.test(g3.stderr), `${이름}: 예외로 죽지 않는다 — ${g3.stderr.slice(0, 300)}`);
  }
  // 「detail」: null은 칸이 없는 것과 같다 — 죽지 않고, 표에 없는 판으로 걸린다
  const g4 = 굽기전('함수', 짓기('널', (s) => { s.detail = null; }));
  assert.equal(g4.status, 1, g4.stdout + g4.stderr);
  assert.ok(!/Traceback/.test(g4.stderr), g4.stderr.slice(0, 300));
  assert.match(g4.stdout, /✗ C2: \(컷표\) 컷표에 없는 판/);
});

// 11-21 GPT 검수(GA5 · GA6) — 꼴이 틀려 지워진 시각 칸을 대괄호로 읽다 죽어, 이미 만든 꼴 걸림을 JSON으로 내지 못했다
test('명령줄 — 「detail」: null · 꼴이 틀린 시각 칸으로도 죽지 않고 판정을 낸다, 컷 줄의 시각을 못 읽는 표는 영상 · 받은 판을 재는 항목을 돌리지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const a = 틀돌리기((s) => { s.detail = null; });
  assert.ok(!/Traceback/.test(a.stderr), a.stderr.slice(0, 300));
  const b = 틀돌리기((s) => { 컷(s, 'C1').t = false; s.소리사건[0].t = true; });
  assert.equal(b.코드, 1);
  assert.ok(걸림글(b).some((x) => /^C1: 「t」 칸은 수 꼴로 적는다 — 지금은 false이다/.test(x)), JSON.stringify(걸림글(b)));
  assert.ok(걸림글(b, '사건').some((x) => /넓게=C1 — 이 컷의 「t」\(시작 시각\)를 읽을 수 없어/.test(x)), JSON.stringify(걸림글(b, '사건')));
  assert.ok(걸림글(b, '소리').some((x) => /^초인종: 소리 사건의 「t」\(소리가 나는 시각\)를 읽을 수 없다/.test(x)), JSON.stringify(걸림글(b, '소리')));
  // 받은 판을 재는 실행에서도 죽지 않는다 — 꼴 걸림은 그대로 나고, 매체 항목은 재는 자리마다 시각을 읽는다(미리 훑어 막지 않는다 — 11-21 GPT 다시 검수 GA1 · GA4)
  const 받음 = path.join(임시(), '받음'); fs.mkdirSync(받음);
  const c = 틀돌리기((s) => { 컷(s, 'C1').dur = false; }, ['--받음', 받음]);
  assert.equal(c.코드, 1);
  assert.ok(걸림글(c).some((x) => /^C1: 「dur」 칸은 수 꼴로 적는다 — 지금은 false이다/.test(x)), JSON.stringify(걸림글(c)));
  assert.ok(!걸림글(c).some((x) => /항목을 돌리지 않았다/.test(x)), '시각을 미리 훑어 막는 줄은 없다');
  // 뼈대가 깨진 표 · 맨 위가 목록인 표를 --받음과 함께 줘도 뼈대 걸림을 JSON으로 낸다
  const 뼈대 = (글) => { const dir = 임시(); return 돌리기([쓰기(dir, '컷표.json', 글), '--출력', path.join(dir, '검사'), '--받음', 받음]); };
  const d1 = 뼈대(JSON.stringify({ 틀: 2, detail: true }));
  assert.equal(d1.코드, 1); assert.ok(걸림글(d1).some((x) => /「detail」은 컷을 한 줄씩 적는 목록이다 — 지금은 true이다/.test(x)), JSON.stringify(d1.항목들));
  const d2 = 뼈대('[]');
  assert.equal(d2.코드, 1); assert.ok(걸림글(d2).some((x) => /컷표가 객체\(\{ … \}\)가 아니다 — 지금은 목록이다/.test(x)), JSON.stringify(d2.항목들));
  // 「dur」가 없는 표에 --항목 소리만 돌리면 소리 판정만 낸다(길이를 읽지 않는 항목에 새 걸림을 더하지 않는다)
  const e = 틀돌리기((s) => { for (const x of s.detail) delete x.dur; }, ['--받음', 받음, '--항목', '소리']);
  assert.deepEqual(e.항목들.filter((x) => x.등급 === '걸림'), [], JSON.stringify(e.항목들));
  assert.ok(e.항목들.some((x) => x.항목 === '소리' && x.등급 === '통과'));
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
  // 11-14 참고 카드 41행 — 남의 연기 견본의 끝 문장(표정 · 시선 · 자세가 주어이고 목적어 없이 끝나는 hold)
  'The snarl holds as hard breaths move through the nose.',
  'The revolted expression holds.',
  'her stare held until the cut.',
  'the pose holds to the last frame.',
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
  // 끝까지 남는 모습을 산 모습으로 쓴 끝 문장(지시문 틀 ACTION · 11-14) · 목적어를 받는 hold · 카메라가 얼굴에 머무는 말은 정지 말이 아니다
  'To the last frame the closed-lip smile stays, lips together, while she keeps breathing calmly and blinks once.',
  'her expression holds a hint of worry as she breathes out.',
  'the close-up of her face holds as she breathes.',
  'The warm cinematic look holds throughout the clip.',
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
const 맨글 = (연기) => ['@이미지 1 is the exact first frame of this video.', `ACTION: ${연기}`, 'CAMERA: static frame.', `LOOK: ${빛문장} ${색감줄(틀읽기()).영상뼈대} No new text.`,
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
    // 방향(점검표 43)은 이 시험의 몫이 아니라 두 판 모두 가는 쪽을 적어 둔다 — 색만 다르다
    C1: ['Outside the window, one 1970s city bus (cream and cobalt blue, rounded roof, a row of square windows) drives past from left to right.'],
    C2: ['Outside the window, a cream-and-vermilion rounded 1970s felt city bus drives past from left to right under a saffron-yellow sky.'],
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

test('대사 빠르기(11-18) — 옛 판(7번 1-5: 대사 15자에 말 빠르기 줄 없음)은 주의, 새 판(끝나는 초 · PACE 줄)과 짧은 말 · 목소리 판 · 따옴표 없는 판은 지나간다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 옛 = 'ONE SINGLE CONTINUOUS SHOT.\nACTION: At about 0.2 s Seojin looks at Ian. At about 0.3 s Seojin says, calm and firm, "우리 내년이면 칠 년이야. 이제 날 잡자.", her lips clearly forming the Korean words. At about 0.9 s she closes her mouth.\nSOUND: only Seojin\'s voice saying "우리 내년이면 칠 년이야. 이제 날 잡자."';
  const 새1 = 옛.replace('her lips clearly', 'the whole line finished by 2.2 s, her lips clearly');
  const 새2 = 옛 + '\nPACE: about seven syllables per second, in one breath, no pause between sentences.';
  const 짧은 = 옛.replaceAll('우리 내년이면 칠 년이야. 이제 날 잡자.', '하.');
  const 따옴표없음 = 'ACTION: At about 0.3 s Seojin pushes the tap lever down and the water stops.';
  const 글들 = [[옛, false], [새1, false], [새2, false], [짧은, false], [옛, true], [따옴표없음, false]];
  const 스크립트 = 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\nprint(json.dumps([[g for g, _ in k.굽기전검사(t, 소리만=s) if "(대사)" in _] for t, s in json.load(sys.stdin)]))';
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 스크립트, path.dirname(도구)], { input: JSON.stringify(글들), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [['주의'], [], [], [], [], []]);
});

// ───────── 색감(T22) · 최상급(T23) — 11-18 유호님 「이미지콘티 만들때 색보정같은걸 고를수있게」 · 「최상급과 겨룰만한지 검수도 추가하자」 ─────────
test('색감 T22 · 최상급 T23 — 표에 없는 색감은 걸림, 빈 칸은 편 날짜 11-19부터 걸림(앞은 주의), 어긋빛은 주의, 최상급이 둘보다 적으면 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 틀글 = (r, 항목 = '틀') => r.항목들.filter((x) => x.항목 === 항목 && x.등급 !== '통과').map((x) => `${x.등급} ${x.컷}: ${x.글}`);
  const 오타 = 틀돌리기((s) => { s.색감 = '아련함'; });
  // 이름 목록은 표에서 읽는다 — 11-25 「16mm」를 더하자 넷을 글자로 적은 기대가 깨졌다
  const 색감이름들 = 색감표.이름.map((x) => x.이름).join(' · ');
  assert.deepEqual(틀글(오타).length, 1); assert.ok(틀글(오타)[0].startsWith(`걸림 표: 색감 「아련함」이 색감 이름 표에 없다(「아련」?) — ${색감이름들} 가운데 하나로 적는다(51)`), 틀글(오타)[0]);
  assert.match(틀글(틀돌리기((s) => { s.색감 = ['아련', '팝']; }))[0], /^걸림 표: 「색감」 칸은 글 꼴로 적는다 — 지금은 목록이다/);   // 11-20 꼴 관문이 먼저 건다(목록은 글이 아니다)
  assert.match(틀글(틀돌리기((s) => { delete s.색감; }))[0], /^주의 표: 「색감」 칸이 비었다/, '날짜를 못 읽는 편은 주의');
  assert.match(틀글(틀돌리기((s) => { s.색감 = ''; s.편.만든날 = '2026-11-18'; }))[0], /^주의 표: 「색감」 칸이 비었다/);
  assert.match(틀글(틀돌리기((s) => { s.색감 = ''; s.편.만든날 = '2026-11-19'; }))[0], /^걸림 표: 「색감」 칸이 비었다/);
  const 어긋 = 틀돌리기((s) => { s.색감 = '시네마'; s.장면.부엌밤.빛이름 = ['High key', 'Rim light']; s.장면.부엌밤.빛 = 'Bright, airy high-key light from the front and above; a thin rim of light from behind separates every outline from the wall.'; });
  assert.equal(어긋.코드, 0); assert.match(틀글(어긋)[0], /^주의 장면 부엌밤: 장면 「부엌밤」의 빛 이름\(High key\)이 색감 「시네마」에 어긋난다/);
  const 최 = 틀돌리기((s) => { s.최상급 = [s.최상급[0], { 제목: '주소 없는 줄' }]; });
  assert.deepEqual(틀글(최).map((x) => x.slice(0, 40)), ['주의 표: 「최상급」에 같은 분야 실제 최상급 광고가 1편이다 — 둘 이']);
  assert.match(틀글(틀돌리기((s) => { delete s.최상급[1].까닭; }))[0], /^주의 표: 「최상급」 2번째 .*고른 까닭이 없다/);
});

test('색감 T22 — 이미지 지시문에 GRADE 뼈대가 없으면 걸림, 영상 지시문 LOOK에 영상뼈대가 없으면 걸림(크레딧내기와 같은 빛대조)', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시(); const 틀 = 틀읽기();
  const 그림 = path.join(dir, '그림'); fs.mkdirSync(그림);
  for (const d of 틀.detail) 쓰기(그림, `${d.cut}.txt`, d.cut === 'C2' ? 표대로그림글({ ...틀, 색감: '' }, d) : 표대로그림글(틀, d));
  const r = 틀돌리기(null, ['--그림지시문', 그림], dir);
  assert.equal(r.코드, 1);
  const 그림걸림 = r.항목들.filter((x) => x.항목 === '그림지시문' && x.등급 === '걸림').map((x) => `${x.컷}: ${x.글}`);
  assert.equal(그림걸림.length, 1); assert.match(그림걸림[0], /^C2: 색감 「아련」의 뼈대 문장이 글자 그대로 들어 있지 않다/);
  const 영상 = path.join(dir, '영상'); fs.mkdirSync(영상);
  쓰기(영상, 'C1.txt', 지시문글()); 쓰기(영상, 'C2.txt', 지시문글().replace(` ${색감줄(틀).영상뼈대}`, ''));
  const v = 틀돌리기(null, ['--지시문', path.join(영상, 'C1.txt'), path.join(영상, 'C2.txt')], dir);
  const 빛걸림 = v.항목들.filter((x) => x.항목 === '지시문' && x.등급 === '걸림' && x.글.startsWith('(빛)')).map((x) => `${x.컷}: ${x.글}`);
  assert.equal(빛걸림.length, 1, JSON.stringify(빛걸림)); assert.match(빛걸림[0], /^C2: \(빛\) 색감 「아련」의 영상뼈대 문장이 글자 그대로 들어 있지 않다/);
});

// 11-19 덧 — 「세트」(옷 · 벽 · 소품 색 한 문장)와 인물 「옷」: 유호님 「팝은 좋아보이는데 나머지는 좀 퀄리티가 떨어져보이네」(S58) · Seedream이 참고 사진 옷을 입힘(시드림시험)
test('색감 T22 — 「세트」 · 사람의 「옷」이 비면 편 날짜 11-20부터 걸림(앞은 주의), 이미지 지시문에 세트 문장이 없으면 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 틀글 = (r) => r.항목들.filter((x) => x.항목 === '틀' && x.등급 !== '통과').map((x) => `${x.등급} ${x.컷}: ${x.글}`);
  assert.deepEqual(틀글(틀돌리기((s) => { s.편.만든날 = '2026-11-20'; })).filter((x) => /「세트」|「옷」/.test(x)), [], '틀 그대로면 세트 · 옷 칸이 차 있다');
  const 앞 = 틀글(틀돌리기((s) => { delete s.세트; s.편.만든날 = '2026-11-19'; })).filter((x) => /「세트」/.test(x));
  assert.equal(앞.length, 1); assert.match(앞[0], /^주의 표: 「세트」 칸이 비었다 — 색감 「아련」에 맞춘 옷 · 벽 · 소품 색 두세 개를 .* 이 색감의 세트: 파스텔 두 색과 따뜻한 해/);
  assert.ok(틀글(틀돌리기((s) => { s.세트 = ''; s.편.만든날 = '2026-11-20'; })).some((x) => /^걸림 표: 「세트」 칸이 비었다/.test(x)));
  assert.ok(틀글(틀돌리기((s) => { s.세트 = ['peach', 'mint']; })).some((x) => /^걸림 표: 「세트」 칸은 글 꼴로 적는다 — 지금은 목록이다/.test(x)), '11-20 꼴 관문이 먼저 건다(목록은 글이 아니다)');
  const 옷 = 틀글(틀돌리기((s) => { s.인물.수아.옷 = ''; s.편.만든날 = '2026-11-20'; })).filter((x) => /「옷」/.test(x));
  assert.equal(옷.length, 1, JSON.stringify(옷)); assert.match(옷[0], /^걸림 인물 수아: 인물 「수아」의 「옷」 칸이 비었다 — 옷을 적지 않으면 Seedream이 참고 사진의 옷을 그대로 입힌다/);
  assert.ok(틀글(틀돌리기((s) => { s.인물.수아.옷 = ''; s.편.만든날 = '2026-11-19'; })).some((x) => /^주의 인물 수아: 인물 「수아」의 「옷」/.test(x)));
  const dir = 임시(); const 틀 = 틀읽기(); const 그림 = path.join(dir, '그림'); fs.mkdirSync(그림);
  for (const d of 틀.detail) 쓰기(그림, `${d.cut}.txt`, d.cut === 'C1' ? 표대로그림글({ ...틀, 세트: '' }, d) : 표대로그림글(틀, d));
  const r = 틀돌리기(null, ['--그림지시문', 그림], dir);
  const 그림걸림 = r.항목들.filter((x) => x.항목 === '그림지시문' && x.등급 === '걸림').map((x) => `${x.컷}: ${x.글}`);
  assert.equal(그림걸림.length, 1, JSON.stringify(그림걸림)); assert.match(그림걸림[0], /^C1: 「세트」\(PALETTE 줄\) 문장이 글자 그대로 들어 있지 않다/);
  // 11-21 GPT 검수 — PALETTE 줄을 다른 색으로 적고 표의 세트 문장을 NOTE에 남긴 지시문은 걸린다(세트 문장은 PALETTE 줄에서 찾는다)
  const 그림2 = path.join(dir, '그림2'); fs.mkdirSync(그림2);
  const 다른세트 = 'The picture holds to cold steel blue and black, with no other colours.';
  for (const d of 틀.detail) 쓰기(그림2, `${d.cut}.txt`, d.cut === 'C2' ? `${표대로그림글({ ...틀, 세트: 다른세트 }, d)}\nNOTE: ${틀.세트}` : 표대로그림글(틀, d));
  const r2 = 틀돌리기(null, ['--그림지시문', 그림2], dir);
  const 그림걸림2 = r2.항목들.filter((x) => x.항목 === '그림지시문' && x.등급 === '걸림').map((x) => `${x.컷}: ${x.글}`);
  assert.equal(그림걸림2.length, 1, JSON.stringify(그림걸림2)); assert.match(그림걸림2[0], /^C2: 「세트」\(PALETTE 줄\) 문장이 글자 그대로 들어 있지 않다/);
});

test('색감 값(--그림 · --받음) — 컷마다 값을 적고, 같은 장면에서 튀는 컷과 받은 영상이 시작 그림 색감에서 벗어난 컷은 확인', { skip: !(그림라이브러리 && ffmpeg) && '그림 라이브러리 · ffmpeg 없음' }, () => {
  const dir = 임시(); const 편 = path.join(dir, '편_20261119'); fs.mkdirSync(path.join(편, '정지'), { recursive: true }); fs.mkdirSync(path.join(편, '받음'));
  // 따뜻한 밤 셋 + 차갑고 밝은 한 컷(C3) — 시작 그림은 정지/<컷>.png(예시 표의 「시작그림」 자리)
  const 만들기 = String.raw`
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
def 판(바탕, 등):
    im = Image.new("RGB", (360, 640), 바탕); g = ImageDraw.Draw(im); g.ellipse((60, 120, 300, 360), fill=등); g.rectangle((0, 520, 360, 640), fill=(12, 10, 8)); return im
for c, 바탕, 등 in [("C1", (70, 45, 30), (240, 170, 90)), ("C2", (74, 48, 32), (236, 166, 88)), ("C3", (150, 175, 210), (235, 245, 255)), ("C4", (68, 44, 30), (242, 172, 92))]:
    판(바탕, 등).save(f"{d}/정지/{c}.png")
판((150, 175, 210), (235, 245, 255)).save(f"{d}/받음_C1.png")
`;
  assert.equal(spawnSync('python', ['-I', '-X', 'utf8', '-c', 만들기, 편], { encoding: 'utf8' }).status, 0);
  // 받은 C1은 시작 그림과 다른 색(차갑고 밝음), C2 · C4는 시작 그림 그대로
  const 영상만들기 = (그림파일, 밖) => spawnSync('ffmpeg', ['-v', 'error', '-loop', '1', '-i', 그림파일, '-t', '5', '-r', '12', '-pix_fmt', 'yuv420p', 밖, '-y']);
  영상만들기(path.join(편, '받음_C1.png'), path.join(편, '받음', 'C1.mp4'));
  for (const c of ['C2', 'C3', 'C4']) 영상만들기(path.join(편, '정지', `${c}.png`), path.join(편, '받음', `${c}.mp4`));
  const seq = 틀읽기(); const 표 = 쓰기(편, '컷표.json', JSON.stringify(seq));
  const 그림 = 돌리기([표, '--그림', path.join(편, '정지'), '--출력', path.join(dir, '검사1')]);
  const 색 = (r) => r.항목들.filter((x) => x.항목 === '색감');
  assert.equal(색(그림).filter((x) => x.등급 === '알림' && x.값 && '검정' in x.값).length, 5, '컷 넷 + 편 가운데값');
  assert.deepEqual(색(그림).filter((x) => x.등급 === '확인').map((x) => x.컷), ['C3'], JSON.stringify(색(그림)));
  assert.match(색(그림).find((x) => x.컷 === '편').글, /색감 「아련」 방향: 검정 높게/);
  const 받음 = 돌리기([표, '--받음', path.join(편, '받음'), '--출력', path.join(dir, '검사2')]);
  const 벗어남 = 색(받음).filter((x) => x.등급 === '확인' && /시작 그림/.test(x.글)).map((x) => x.컷);
  assert.deepEqual(벗어남, ['C1'], JSON.stringify(색(받음).filter((x) => x.등급 === '확인')));
});

// ───────── 감정흐름(T24) — 11-18 유호님 「스토리에 희노애락이 있고 기승전결이 있나 이것도 잘 파악해주고 있지 ?」 → 「넣어줘」 ─────────
test('감정흐름 T24 — 갈래가 넷 다 같거나 세기가 넷 다 같으면 걸림(한결 까닭이면 주의), 전이 기보다 약하거나 처음과 끝 감정이 같으면 주의, 빈 칸은 11-19부터 걸림', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 틀글 = (r) => r.항목들.filter((x) => x.항목 === '틀' && x.등급 !== '통과').map((x) => `${x.등급} ${x.컷}: ${x.글}`);
  const 같은갈래 = (s) => { for (const k of ['기', '승', '전', '결']) s.감정흐름[k].갈래 = '락'; };
  const 한결 = 틀돌리기(같은갈래);
  assert.equal(틀글(한결).length, 1); assert.match(틀글(한결)[0], /^걸림 표: 기 · 승 · 전 · 결의 감정 갈래가 모두 「락」이다 — 희노애락의 굴곡이 없다.*\(14\)/);
  assert.match(틀글(틀돌리기((s) => { 같은갈래(s); s.감정흐름.한결 = '끝까지 한 방향으로 쌓는 B급 웃김'; }))[0], /^주의 표: 감정 갈래가 모두 「락」이다 — 「한결」 까닭: 끝까지/);
  const 같은세기 = 틀돌리기((s) => { for (const k of ['기', '승', '전', '결']) s.감정흐름[k].세기 = 3; });
  assert.equal(틀글(같은세기).length, 1); assert.match(틀글(같은세기)[0], /^걸림 표: 기 · 승 · 전 · 결의 세기가 모두 3이다 — 넷이 같은 세기면 그리기 전에 다시 짠다/);
  assert.match(틀글(틀돌리기((s) => { s.감정흐름.전.세기 = 2; }))[0], /^주의 표: 전의 세기\(2\)가 기\(2\)보다 세지 않다/);
  assert.match(틀글(틀돌리기((s) => { s.감정흐름.결 = { ...s.감정흐름.기 }; s.감정흐름.결.세기 = 3; }))[0], /^주의 표: 처음과 끝의 감정이 같다\(「혼자라서 쓸쓸함」\)/);
  assert.match(틀글(틀돌리기((s) => { s.감정흐름.승.갈래 = '놀람'; }))[0], /^걸림 표: 「감정흐름\.승」의 갈래 「놀람」는 희 · 노 · 애 · 락 · 긴장 가운데 하나가 아니다/);
  assert.match(틀글(틀돌리기((s) => { s.감정흐름.전.세기 = 7; }))[0], /^걸림 표: 「감정흐름\.전」의 세기 「7」는 1~5의 수가 아니다/);
  assert.match(틀글(틀돌리기((s) => { delete s.감정흐름.결; }))[0], /^걸림 표: 「감정흐름」에 「결」가 없다/);
  assert.match(틀글(틀돌리기((s) => { delete s.감정흐름; }))[0], /^주의 표: 「감정흐름」 칸이 비었다/, '날짜를 못 읽는 편은 주의');
  assert.match(틀글(틀돌리기((s) => { delete s.감정흐름; s.편.만든날 = '2026-11-19'; }))[0], /^걸림 표: 「감정흐름」 칸이 비었다/);
});

// 컨셉 팩의 기승전결 모양(T24) — 11-24 유호님 「컨셉마다 전부 기승전결 적용해서 만드는거 적용 되어있어?」 → 「넣어줘」.
// 걸려야 할 판: 코믹인데 끝 반전(결)이 전보다 약함 · 결이 웃음 갈래가 아님 / 감동인데 전과 결의 갈래가 같음 · 결이 약함.
// 지나가야 할 판: 예시 틀 그대로 · 팩이 없는 컨셉 · 검사 조건이 없는 팩 · 굴곡부터 걸린 편(그것부터 고친다).
test('컨셉 팩 기승전결 모양(T24) — 팩의 「기승전결.검사」를 주의로 알리고, 굴곡부터 걸린 편 · 팩 없는 컨셉은 건드리지 않는다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 팩폴더 = 임시();
  const 모양 = { 기: '상황을 세운다', 승: '되풀이해 쌓는다', 전: '터지기 직전', 결: '반전 한 방' };
  쓰기(팩폴더, '코믹.json', JSON.stringify({ 컨셉: '코믹', 기승전결: { 모양, 검사: { 가장센: '결', 갈래: { 결: ['락', '희'] } } } }));
  쓰기(팩폴더, '감동.json', JSON.stringify({ 컨셉: '감동', 기승전결: { 모양: { ...모양, 결: '되받고 머문다' }, 검사: { 꺾임: ['전', '결'], 세기최소: { 결: 4 } } } }));
  쓰기(팩폴더, '멜로.json', JSON.stringify({ 컨셉: '멜로', 기승전결: { 모양 } }));
  쓰기(팩폴더, '스펙터클.json', JSON.stringify({ 컨셉: '스펙터클', 기승전결: { 모양, 검사: { 가장센: '전' } } }));
  쓰기(팩폴더, 'B급.json', JSON.stringify({ 컨셉: 'B급', 기승전결: { 모양, 검사: { 가장센: ['결'], 갈래: ['락'], 꺾임: [['전'], '결'], 세기최소: { 결: '4' }, 가장약한: '기' } } }));
  쓰기(팩폴더, '뮤직.json', '﻿' + JSON.stringify({ 컨셉: '뮤직', 기승전결: { 모양, 검사: { 가장센: '결' } } }));
  쓰기(팩폴더, '홍보.json', '{ 깨진');
  쓰기(팩폴더, '비주얼.json', JSON.stringify({ 컨셉: '비주얼', 기승전결: { 모양, 검사: '결' } }));
  const 옛 = process.env.SYNK_CONCEPT_PACK_DIR;
  process.env.SYNK_CONCEPT_PACK_DIR = 팩폴더;
  t.after(() => { if (옛 === undefined) delete process.env.SYNK_CONCEPT_PACK_DIR; else process.env.SYNK_CONCEPT_PACK_DIR = 옛; });
  const 팩글 = (고침) => 틀돌리기(고침).항목들.filter((x) => x.항목 === '틀' && x.등급 !== '통과').map((x) => `${x.등급} ${x.컷}: ${x.글}`);
  const 팩만 = (고침) => 팩글(고침).filter((x) => x.endsWith('(팩 기승전결)'));
  // 감동(예시 틀 그대로: 전 긴장4 → 결 희4)은 지나간다
  assert.deepEqual(팩만(), []);
  assert.deepEqual(팩만((s) => { s.감정흐름.결.갈래 = '긴장'; }).map((x) => x.replace(/\(.*$/, '')), ['주의 표: 컨셉 「감동」 팩의 기승전결에서 전에서 결로 갈래가 꺾인다']);
  assert.match(팩만((s) => { s.감정흐름.결.세기 = 3; })[0], /^주의 표: 컨셉 「감동」 팩의 기승전결에서 「결」은 되받고 머문다 — 결의 세기가 4보다 낮은 3이다\(팩 기승전결\)$/);
  // 코믹 — 결이 가장 세고 웃음 갈래여야 한다
  const 코믹 = (s) => { s.컨셉 = '코믹'; };
  assert.deepEqual(팩만(코믹), [], '전 4 · 결 4 — 결이 가장 세거나 같으면 지나간다');
  assert.match(팩만((s) => { 코믹(s); s.감정흐름.결.세기 = 3; })[0], /^주의 표: 컨셉 「코믹」 팩의 기승전결에서 「결」은 반전 한 방 — 지금 전\(4\)이 결\(3\)보다 세다\(팩 기승전결\)$/);
  assert.match(팩만((s) => { 코믹(s); s.감정흐름.결.갈래 = '애'; })[0], /결의 갈래가 락 · 희 가운데 하나가 아니라 「애」이다/);
  // 받침 없는 띠에는 「는 · 가」 — 「기(5)가 전(4)보다」
  assert.match(팩만((s) => { s.컨셉 = '스펙터클'; s.감정흐름.기.세기 = 5; })[0], /「전」은 터지기 직전 — 지금 기\(5\)가 전\(4\)보다 세다/);
  // 「한결」 까닭을 적은 편은 꺾임을 다시 묻지 않는다(굴곡 주의가 이미 말했다 — 11-24 Fable 설계 검토 P2-1)
  const 한결 = (s) => { for (const k of ['기', '승', '전', '결']) s.감정흐름[k].갈래 = '애'; s.감정흐름.한결 = '끝까지 그리움으로 가는 편'; };
  assert.deepEqual(팩만(한결), []);
  assert.match(팩만((s) => { 한결(s); s.감정흐름.결.세기 = 3; })[0], /결의 세기가 4보다 낮은 3이다/, '세기 조건은 그대로 본다');
  // 있는 팩을 못 읽거나 조건 꼴이 틀리면 검사를 죽이지 않고, 건너뛴 것을 주의로 남긴다(통과와 구별 — P2-2). BOM은 읽는다.
  const 틀린꼴 = 틀돌리기((s) => { s.컨셉 = 'B급'; s.감정흐름.결.세기 = 1; });
  assert.ok(틀린꼴.코드 !== null && !/Traceback/.test(틀린꼴.stderr), 틀린꼴.stderr);
  assert.deepEqual(틀린꼴.항목들.filter((x) => x.글.endsWith('(팩 기승전결)')).map((x) => x.글),
    ['컨셉 「B급」 팩의 기승전결 검사에서 꼴이 틀린 조건(가장약한 · 가장센 · 갈래 · 꺾임 · 세기최소)은 건너뛰었다 — 팩 JSON을 고친다(팩 기승전결)']);
  assert.match(팩만((s) => { s.컨셉 = '홍보'; })[0], /^주의 표: 컨셉 「홍보」 팩 파일을 읽지 못해 기승전결 모양을 보지 않았다/);
  assert.match(팩만((s) => { s.컨셉 = '비주얼'; })[0], /^주의 표: 컨셉 「비주얼」 팩의 기승전결 검사가 조건 표가 아니라 건너뛰었다/);
  assert.match(팩만((s) => { s.컨셉 = '뮤직'; s.감정흐름.결.세기 = 3; })[0], /지금 전\(4\)이 결\(3\)보다 세다/, 'BOM이 붙은 팩도 읽는다');
  // 굴곡부터 걸린 편은 그 걸림 하나만 — 컨셉 모양은 굴곡이 선 뒤에 본다
  const 굴곡 = 팩글((s) => { 코믹(s); for (const k of ['기', '승', '전', '결']) s.감정흐름[k].세기 = 3; });
  assert.equal(굴곡.length, 1); assert.match(굴곡[0], /^걸림 표: 기 · 승 · 전 · 결의 세기가 모두 3이다/);
  // 검사 조건이 없는 팩 · 팩이 없는 컨셉 · 이름 꼴이 아닌 컨셉은 아무것도 더하지 않는다
  assert.deepEqual(팩만((s) => { s.컨셉 = '멜로'; s.감정흐름.결.세기 = 1; }), []);
  assert.deepEqual(팩만((s) => { s.컨셉 = '스릴러'; s.감정흐름.결.세기 = 1; }), []);
  assert.deepEqual(팩만((s) => { s.컨셉 = '../감동'; s.감정흐름.결.세기 = 1; }), []);
});

// 컨셉 팩의 앵글 견줄 값(T29) — 11-24 유호님 「컨셉별로 카메라 엥글 사용법이 다 재각각일텐데 … 각 카메라감독이 잘 배치되어있는지」 → 「재서 넣어 줘」.
// 걸려야 할 판: 본보기가 가까운 컷 · 눈높이 밖 · 정면 밖을 많이 쓰는 컨셉인데 이 편은 그 절반에 못 미친다.
// 지나가야 할 판: 비율이 본보기의 절반을 넘는 편 · 본보기를 20컷 못 잰 팩 · 앵글을 적은 컷이 여섯이 안 되는 편 · 앵글 값이 없는 팩.
test('컨셉 팩 앵글 견줄 값(T29) — 본보기 비율이 30%를 넘는 묶음에서 이 편이 절반에 못 미치면 주의, 잰 컷이 적은 팩과 앵글이 적은 편은 보지 않는다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 팩폴더 = 임시();
  const 앵글 = { 잰컷: 40, 가까이: 50, 눈높이밖: 40, 정면밖: 60, 뻔한앵글: 10 };
  쓰기(팩폴더, '코믹.json', JSON.stringify({ 컨셉: '코믹', 앵글 }));
  쓰기(팩폴더, '멜로.json', JSON.stringify({ 컨셉: '멜로', 앵글: { ...앵글, 잰컷: 12 } }));
  쓰기(팩폴더, '스릴러.json', JSON.stringify({ 컨셉: '스릴러' }));
  const 옛 = process.env.SYNK_CONCEPT_PACK_DIR;
  process.env.SYNK_CONCEPT_PACK_DIR = 팩폴더;
  t.after(() => { if (옛 === undefined) delete process.env.SYNK_CONCEPT_PACK_DIR; else process.env.SYNK_CONCEPT_PACK_DIR = 옛; });
  // 예시 틀 네 컷을 여덟 컷으로 늘리고 앵글을 고친다
  const 여덟 = (컨셉, 앵글들) => (s) => {
    s.컨셉 = 컨셉;
    s.detail = [...s.detail, ...s.detail.map((d, i) => ({ ...JSON.parse(JSON.stringify(d)), cut: `C${i + 5}` }))];
    s.detail.forEach((d, i) => { const [크기, 높이, 방향] = 앵글들[i % 앵글들.length]; d.앵글 = { 크기, 높이, 방향, 까닭: '시험' }; });
  };
  const 앵글만 = (고침) => 틀돌리기(고침).항목들.filter((x) => x.글.endsWith('(팩 앵글)')).map((x) => `${x.등급} ${x.컷}: ${x.글}`);
  const 넓은 = [['넓게', '눈높이', '정면']];
  assert.deepEqual(앵글만(여덟('코믹', 넓은)), [
    '주의 표: 컨셉 「코믹」 본보기는 가까운 컷(극접 · 클로즈 · 가슴 위)이 50%인데 이 편은 0%(0/8컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)',
    '주의 표: 컨셉 「코믹」 본보기는 눈높이 밖 컷(로우 · 하이 · 위에서)이 40%인데 이 편은 0%(0/8컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)',
    '주의 표: 컨셉 「코믹」 본보기는 정면 밖 컷(비스듬히 · 옆 · 뒤 · 어깨 너머 · 시점 · 물건 너머)이 60%인데 이 편은 0%(0/8컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)',
  ]);
  // 절반을 넘으면 지나간다 — 가까이 3/8(38%) · 눈높이 밖 3/8 · 정면 밖 4/8
  const 섞은 = [['클로즈', '로우', '비스듬히'], ['넓게', '눈높이', '정면'], ['가슴 위', '하이', '옆'], ['전신', '눈높이', '정면'],
    ['극접', '위에서', '어깨 너머'], ['허리 위', '눈높이', '정면'], ['무릎 위', '눈높이', '뒤'], ['넓게', '눈높이', '정면']];
  assert.deepEqual(앵글만(여덟('코믹', 섞은)), []);
  // 본보기를 20컷 못 잰 팩 · 앵글 값이 없는 팩 · 팩이 없는 컨셉 · 컨셉이 없는 편은 보지 않는다
  assert.deepEqual(앵글만(여덟('멜로', 넓은)), []);
  assert.deepEqual(앵글만(여덟('스릴러', 넓은)), []);
  assert.deepEqual(앵글만(여덟('스펙터클', 넓은)), []);
  assert.deepEqual(앵글만(여덟('', 넓은)), []);
  // 앵글을 세 칸 다 적은 컷이 여섯이 안 되면 보지 않는다(예시 틀은 네 컷)
  assert.deepEqual(앵글만((s) => { s.컨셉 = '코믹'; for (const d of s.detail) d.앵글 = { 크기: '넓게', 높이: '눈높이', 방향: '정면', 까닭: '시험' }; }), []);
  // 만족하신 우리 편을 20컷 넘게 잰 「앵글.만족」이 있으면 본보기 대신 그 값과 견준다(11-24 「재서 올려 줘」)
  쓰기(팩폴더, '감동.json', JSON.stringify({ 컨셉: '감동', 앵글: { 잰컷: 40, 가까이: 10, 눈높이밖: 10, 정면밖: 10, 뻔한앵글: 0, 만족: { 잰컷: 30, 가까이: 60, 눈높이밖: 20, 정면밖: 50, 뻔한앵글: 5 } } }));
  assert.deepEqual(앵글만(여덟('감동', 넓은)), [
    '주의 표: 컨셉 「감동」 만족하신 편은 가까운 컷(극접 · 클로즈 · 가슴 위)이 60%인데 이 편은 0%(0/8컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)',
    '주의 표: 컨셉 「감동」 만족하신 편은 정면 밖 컷(비스듬히 · 옆 · 뒤 · 어깨 너머 · 시점 · 물건 너머)이 50%인데 이 편은 0%(0/8컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)',
  ]);
  쓰기(팩폴더, '감동.json', JSON.stringify({ 컨셉: '감동', 앵글: { 잰컷: 40, 가까이: 10, 눈높이밖: 10, 정면밖: 10, 뻔한앵글: 0, 만족: { 잰컷: 12, 가까이: 60, 눈높이밖: 20, 정면밖: 50, 뻔한앵글: 5 } } }));
  assert.deepEqual(앵글만(여덟('감동', 넓은)), [], '만족을 20컷 못 쟀으면 본보기(모두 30% 아래)와 견준다');
});

// ───────── 감정 자리(T28) · 이웃 컷의 앵글(T29) — 11-19 유호님 「너무 엥글이 와이드엥글이 대부분이고 감정표현이 (감정전달)이 너무너무 부족해」 ·
//   11-20 「계속 엥글이 똑같아 … 상황에맞춰서 다양한 엥글을 써줘야해」(점검표 33 · 50) ─────────
// 걸려야 할 옛 판: 감정 자리가 없는 편 · 감정 컷을 모두 가슴 위 · 눈높이 · 정면으로 바꾼 편 · 앵글 칸이 없는 편. 지나가야 할 새 판: 예시 틀 그대로 · 이어 찍은 컷 · 낱말 뒤에 풀이를 붙인 칸.
test('감정 자리 T28 · 앵글 T29(표) — 감정 자리가 없거나 이웃 컷의 크기 · 높이 · 방향이 모두 같으면 걸림(11-20부터, 앞선 편은 주의), 앵글 칸 · 까닭이 비거나 낱말 밖이면 걸림, 예시 틀과 이어 찍은 컷은 지나간다', { skip: !파이썬 && '파이썬 없음' }, async () => {
  const 새편 = (s) => { s.편.만든날 = '2026-11-20'; };
  const 자리없음 = (s) => { for (const d of s.detail) { delete d.감정자리; delete d.감정부위; } s.사건[0].압축 = true; };
  const 같은앵글 = (s) => { for (const c of ['C1', 'C2', 'C3']) Object.assign(컷(s, c).앵글, { 크기: '가슴 위', 높이: '눈높이', 방향: '정면' }); };
  const 앵글없음 = (s) => { for (const d of s.detail) delete d.앵글; };
  const 판 = {
    그대로: 새편,
    자리없음: (s) => { 새편(s); 자리없음(s); },
    자리없음_앞선편: (s) => { 자리없음(s); s.편.만든날 = '2026-11-19'; },
    사건의감정컷만: (s) => { 새편(s); for (const d of s.detail) { delete d.감정자리; delete d.감정부위; } },
    같은앵글: (s) => { 새편(s); 같은앵글(s); },
    같은앵글_앞선편: (s) => { 같은앵글(s); s.편.만든날 = '2026-11-19'; },
    같은앵글_날짜없음: 같은앵글,
    이어찍기: (s) => { 새편(s); Object.assign(컷(s, 'C2').앵글, { 크기: '허리 위', 높이: '눈높이', 방향: '비스듬히' }); 컷(s, 'C2').이어찍기 = true; },
    앵글없음: (s) => { 새편(s); 앵글없음(s); },
    앵글없음_앞선편: (s) => { 앵글없음(s); s.편.만든날 = '2026-11-19'; },
    낱말밖: (s) => { 새편(s); 컷(s, 'C1').앵글.크기 = '바스트'; },
    까닭없음: (s) => { 새편(s); 컷(s, 'C4').앵글.까닭 = ' '; },
    풀이붙임: (s) => { 새편(s); 컷(s, 'C1').앵글.방향 = '시점 — 문간에 선 사람의 눈'; 컷(s, 'C1').앵글.높이 = '하이(문틀 위)'; },
    두칸이어짐: (s) => { 새편(s); for (const [c, 크기] of [['C1', '허리 위'], ['C2', '클로즈'], ['C3', '극접']]) Object.assign(컷(s, c).앵글, { 크기, 높이: '눈높이', 방향: '정면' }); },
  };
  const 이름들 = Object.keys(판);
  const 결과들 = await 틀돌리기_여럿(이름들.map((k) => 판[k]));
  const r = Object.fromEntries(이름들.map((k, i) => [k, 결과들[i]]));
  const 줄 = (x, 등급) => x.항목들.filter((y) => y.항목 === '틀' && y.등급 === 등급 && /감정 자리|앵글|같은 두 칸/.test(y.글)).map((y) => `${y.컷}: ${y.글}`);
  // 지나가야 할 판
  for (const k of ['그대로', '사건의감정컷만', '이어찍기', '풀이붙임']) {
    assert.equal(r[k].코드, 0, `${k}: ${JSON.stringify(r[k].항목들.filter((y) => y.등급 === '걸림'))}`);
    assert.deepEqual([...줄(r[k], '걸림'), ...줄(r[k], '주의')], [], k);
  }
  // T28 — 감정 자리가 하나도 없다
  assert.equal(r.자리없음.코드, 1);
  assert.deepEqual(줄(r.자리없음, '걸림').length, 1);
  assert.match(줄(r.자리없음, '걸림')[0], /^표: 사람이 나오는 편인데 감정 자리가 하나도 없다.*가로 그림 25% · 세로 그림 35%부터.*\(33\)/);
  assert.equal(r.자리없음_앞선편.코드, 0); assert.equal(줄(r.자리없음_앞선편, '주의').length, 1); assert.deepEqual(줄(r.자리없음_앞선편, '걸림'), []);
  // T29 — 감정 컷을 모두 가슴 위 · 눈높이 · 정면으로(11-20 김천 꼴)
  const 같 = 줄(r.같은앵글, '걸림');
  assert.equal(r.같은앵글.코드, 1); assert.equal(같.length, 2, JSON.stringify(같));
  assert.match(같[0], /^C2: 앵글이 앞 컷 C1과 크기 · 높이 · 방향 모두 같다\(가슴 위 · 눈높이 · 정면\).*이어찍기: true\(50\)/);
  assert.match(같[1], /^C3: 앵글이 앞 컷 C2과 크기 · 높이 · 방향 모두 같다/);
  for (const k of ['같은앵글_앞선편', '같은앵글_날짜없음']) { assert.equal(r[k].코드, 0, k); assert.deepEqual(줄(r[k], '걸림'), [], k); assert.equal(줄(r[k], '주의').length, 2, k); }
  // T29 — 칸
  assert.equal(r.앵글없음.코드, 1); assert.equal(줄(r.앵글없음, '걸림').length, 1);
  assert.match(줄(r.앵글없음, '걸림')[0], /^표: 컷 4개\(C1 · C2 · C3 · C4\)에 「앵글」의 크기 · 높이 · 방향 칸이 없다.*크기: 극접 · 클로즈 · 가슴 위.*\(50\)/);
  assert.equal(r.앵글없음_앞선편.코드, 0); assert.equal(줄(r.앵글없음_앞선편, '주의').length, 1, '앞선 편은 이 한 줄만 주의');
  assert.match(줄(r.낱말밖, '걸림')[0], /^C1: 「앵글\.크기」의 「바스트」은 정한 낱말이 아니다 — 극접 · 클로즈 · 가슴 위 · 허리 위 · 무릎 위 · 전신 · 넓게 가운데 하나로 시작한다/);
  assert.match(줄(r.까닭없음, '걸림')[0], /^C4: 「앵글\.까닭」 칸이 비었다/);
  // 세 컷이 잇달아 같은 두 칸 — 주의만
  assert.equal(r.두칸이어짐.코드, 0); assert.deepEqual(줄(r.두칸이어짐, '걸림'), []);
  assert.match(줄(r.두칸이어짐, '주의')[0], /^표: 세 컷이 잇달아 같은 두 칸을 쓴다 — C1~C3\(높이 · 방향\)/);
});

// ───────── 뻔한 구도 비율(T29의 주의) — 11-19 유호님 「내가 원하는 느낌은 지금 엥글이 전혀 아니야. 클로즈업을 자주 활용해서 감정을 보여줬으면 좋겠어.
//   지금은 너무 뻔해 진짜 아니야」(점검표 33 · 제작 규칙 「감정은 가까운 컷과 여러 장치로」 3항) ─────────
// 걸려야 할 옛 판: 사람 컷 셋 가운데 둘이 허리 위 · 눈높이 · 정면. 지나가야 할 새 판: 예시 틀 그대로 · 그런 컷이 하나뿐 · 사람 없는 컷 · 편 날짜가 앞선 편.
test('앵글 T29(주의) — 사람 컷 가운데 허리 위 · 눈높이 · 정면이 3분의 1을 넘으면 주의만(11-20부터), 하나뿐 · 사람 없는 컷 · 앞선 편은 지나간다', { skip: !파이썬 && '파이썬 없음' }, async () => {
  const 새편 = (s) => { s.편.만든날 = '2026-11-20'; };
  const 뻔 = (s, 컷들) => { for (const c of 컷들) Object.assign(컷(s, c).앵글, { 크기: '허리 위', 높이: '눈높이', 방향: '정면' }); };
  const 판 = {
    그대로: 새편,
    둘: (s) => { 새편(s); 뻔(s, ['C1', 'C3']); },
    하나: (s) => { 새편(s); 뻔(s, ['C1']); },
    사람없는컷: (s) => { 새편(s); 뻔(s, ['C1', 'C4']); },   // C4는 사람 없는 컷이라 세지 않는다 — 사람 컷 셋 가운데 하나
    둘_앞선편: (s) => { 뻔(s, ['C1', 'C3']); s.편.만든날 = '2026-11-19'; },
    둘_날짜없음: (s) => { 뻔(s, ['C1', 'C3']); },
  };
  const 이름들 = Object.keys(판);
  const 결과들 = await 틀돌리기_여럿(이름들.map((k) => 판[k]));
  const r = Object.fromEntries(이름들.map((k, i) => [k, 결과들[i]]));
  const 줄 = (x, 등급) => x.항목들.filter((y) => y.항목 === '틀' && y.등급 === 등급 && /허리 위 · 눈높이 · 정면이다/.test(y.글)).map((y) => `${y.컷}: ${y.글}`);
  // 걸려야 할 판 — 주의만(끝 코드는 그대로 0)
  assert.equal(r.둘.코드, 0, JSON.stringify(r.둘.항목들.filter((y) => y.등급 === '걸림')));
  assert.deepEqual(줄(r.둘, '걸림'), []);
  assert.equal(줄(r.둘, '주의').length, 1, JSON.stringify(r.둘.항목들));
  assert.match(줄(r.둘, '주의')[0], /^표: 사람 컷 3개 가운데 2개\(C1 · C3\)가 허리 위 · 눈높이 · 정면이다 — 3분의 1을 넘는다\..*\(33 · 제작 규칙 「감정은 가까운 컷과 여러 장치로」\)$/);
  // 지나가야 할 판
  for (const k of ['그대로', '하나', '사람없는컷', '둘_앞선편', '둘_날짜없음']) assert.deepEqual([...줄(r[k], '걸림'), ...줄(r[k], '주의')], [], k);
});

test('감정 자리 T28(그림) — 얼굴 폭이 아래선(가로 25% · 세로 35%)에 못 미치면 걸림(앞선 편은 주의), 못 찾으면 확인(앞선 편은 알림), 손으로 보이는 자리는 재지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  // 판정 — 11-19 실측 꼴: 가로 편의 미디엄 클로즈 주문 컷 8.6% · 얼굴 클로즈 28%, 세로 편의 가슴 위 23% · 얼굴 클로즈 40%
  const 읽기 = String.raw`
import sys, json, importlib.util
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
틀 = json.load(open(sys.argv[2], encoding="utf-8"))
print(json.dumps({"판정": [m.감정자리판정(*x)[0] for x in json.loads(sys.argv[3])], "자리": sorted(m.감정자리컷(틀)), "선": m.감정자리아래선}, ensure_ascii=False))
`;
  const 물음 = [[8.6, false, true], [8.6, false, false], [28, false, true], [25, false, true], [23, true, true], [28, true, true], [40, true, true], [null, false, true], [null, true, false]];
  const 답 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 읽기, 도구, 틀경로, JSON.stringify(물음)], { encoding: 'utf8' });
  assert.equal(답.status, 0, 답.stderr);
  const 값 = JSON.parse(답.stdout);
  assert.deepEqual(값.판정, ['걸림', '주의', '통과', '통과', '걸림', '걸림', '통과', '확인', '알림']);
  assert.deepEqual(값.자리, ['C2', 'C3'], '사건의 감정 컷(C2)과 감정자리를 적은 컷(C2 · C3)');
  assert.deepEqual(값.선, { 가로: 25, 세로: 35 });
  // 도구 — 얼굴이 없는 한 색 그림. 그림 라이브러리가 없는 CI에서도 돌게 PNG를 여기서 짓는다(그때 도구는 「검출기를 못 불러 못 쟀다」를 같은 등급으로 낸다)
  const zlib = require('node:zlib');
  const 덩이 = (이름, 몸) => { const 앞 = Buffer.concat([Buffer.from(이름, 'ascii'), 몸]); const 길이 = Buffer.alloc(4); 길이.writeUInt32BE(몸.length); const 끝 = Buffer.alloc(4); 끝.writeUInt32BE(zlib.crc32(앞)); return Buffer.concat([길이, 앞, 끝]); };
  const 색판 = (w, h) => { const 머리 = Buffer.alloc(13); 머리.writeUInt32BE(w, 0); 머리.writeUInt32BE(h, 4); 머리[8] = 8; 머리[9] = 2; const 한줄 = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 60)]); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 덩이('IHDR', 머리), 덩이('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(한줄)))), 덩이('IEND', Buffer.alloc(0))]); };
  const 돌 = (폴더이름, 그림인자) => {
    const dir = 임시(); const 편 = path.join(dir, 폴더이름); fs.mkdirSync(path.join(편, '정지'), { recursive: true });
    for (const c of ['C1', 'C2', 'C3', 'C4']) fs.writeFileSync(path.join(편, '정지', `${c}.png`), 색판(90, 160));
    const r = 돌리기([쓰기(편, '컷표.json', JSON.stringify(틀읽기())), ...(그림인자 ? ['--그림', path.join(편, '정지')] : []), '--항목', '얼굴', '--출력', path.join(dir, '검사')]);
    return { 코드: r.코드, 줄: r.항목들.filter((x) => x.항목 === '얼굴') };
  };
  const 새 = 돌('라면_20261120', true); const 옛 = 돌('라면_20261119', true); const 표만 = 돌('라면_20261120', false);
  for (const x of [새, 표만]) { assert.equal(x.줄.length, 1, JSON.stringify(x.줄)); assert.equal(x.줄[0].등급, '확인'); assert.equal(x.코드, 2); }   // 감정 자리는 C2 · C3인데 C3은 손이라 재지 않는다. 표만 돌려도 시작그림 파일이 있으면 잰다
  assert.equal(옛.줄.length, 1); assert.equal(옛.줄[0].등급, '알림'); assert.equal(옛.코드, 0);
  assert.ok(['C2', '표'].includes(새.줄[0].컷), JSON.stringify(새.줄));
});

// ───────── T28 · T29 GPT 검수(영상감정앵글검사-20261120) 지적 GA1~GA7 · GA9 — 지적마다 고치기 전에 깨지는 판 ─────────
test('T28 · T29 검수 지적(표) — GA2 같은판은 바로 앞 컷과 판을 나눌 때만 예외, GA5 감정부위는 정한 낱말로만, GA6 빈 배열 · 빈 객체는 빈칸', { skip: !파이썬 && '파이썬 없음' }, async () => {
  const 새편 = (s) => { s.편.만든날 = '2026-11-20'; };
  const 판 = {
    // GA2 — C1과 C3만 같은 판(C3에 같은판 까닭), C2와 C3은 다른 판인데 앵글 세 칸이 같다
    떨어진같은판: (s) => { 새편(s); 컷(s, 'C3').판 = 'C1'; 컷(s, 'C3').같은판 = '한 방을 둘로 자른 컷 — C1의 뒤'; Object.assign(컷(s, 'C3').앵글, { 크기: '클로즈', 높이: '눈높이', 방향: '정면' }); },
    // 바로 앞 컷과 판을 나누면 예외 그대로
    바로앞같은판: (s) => { 새편(s); 컷(s, 'C3').판 = 'C2'; 컷(s, 'C3').같은판 = '한 방을 둘로 자른 컷 — C2의 뒤'; Object.assign(컷(s, 'C3').앵글, { 크기: '클로즈', 높이: '눈높이', 방향: '정면' }); },
    // GA5
    부위_풀이: (s) => { 새편(s); 컷(s, 'C3').감정부위 = '손 — 입가를 가린다'; },
    부위_낱말밖: (s) => { 새편(s); 컷(s, 'C3').감정부위 = '입가를 가린 손'; },
    // GA6
    자리_빈배열: (s) => { 새편(s); for (const d of s.detail) { delete d.감정자리; delete d.감정부위; } s.사건[0].압축 = true; 컷(s, 'C2').감정자리 = []; },
    자리_빈객체: (s) => { 새편(s); for (const d of s.detail) { delete d.감정자리; delete d.감정부위; } s.사건[0].압축 = true; 컷(s, 'C2').감정자리 = {}; },
    까닭_빈배열: (s) => { 새편(s); 컷(s, 'C4').앵글.까닭 = []; },
    까닭_빈객체: (s) => { 새편(s); 컷(s, 'C1').앵글.까닭 = { 까닭: ' ' }; },
  };
  const 이름들 = Object.keys(판);
  const 결과들 = await 틀돌리기_여럿(이름들.map((k) => 판[k]));
  const r = Object.fromEntries(이름들.map((k, i) => [k, 결과들[i]]));
  const 걸 = (x) => x.항목들.filter((y) => y.항목 === '틀' && y.등급 === '걸림').map((y) => `${y.컷}: ${y.글}`);
  assert.equal(r.떨어진같은판.코드, 1, 'GA2');
  assert.ok(걸(r.떨어진같은판).some((g) => /^C3: 앵글이 앞 컷 C2과 크기 · 높이 · 방향 모두 같다/.test(g)), JSON.stringify(걸(r.떨어진같은판)));
  assert.deepEqual(걸(r.바로앞같은판).filter((g) => /앵글이 앞 컷/.test(g)), [], 'GA2 — 바로 앞 컷과 한 판이면 그대로 예외');
  assert.deepEqual(걸(r.부위_풀이), [], 'GA5 — 낱말 뒤 풀이');
  assert.equal(r.부위_낱말밖.코드, 1, 'GA5');
  assert.match(걸(r.부위_낱말밖)[0], /^C3: 「감정부위」의 「입가를 가린 손」은 정한 낱말이 아니다 — 얼굴 · 눈 · 입\(얼굴 폭을 잰다\) \/ 손 · 숨 · 몸 · 어깨 · 발 · 등\(재지 않는다\)/);
  for (const k of ['자리_빈배열', '자리_빈객체']) { assert.equal(r[k].코드, 1, `GA6 ${k}`); assert.ok(걸(r[k]).some((g) => /^표: 사람이 나오는 편인데 감정 자리가 하나도 없다/.test(g)), `GA6 ${k}: ${JSON.stringify(걸(r[k]))}`); }
  assert.ok(걸(r.까닭_빈배열).some((g) => /^C4: 「앵글\.까닭」 칸이 비었다/.test(g)), `GA6: ${JSON.stringify(걸(r.까닭_빈배열))}`);   // 11-20 꼴 관문 — 꼴 걸림(「앵글.까닭」 칸은 글 꼴로 적는다)이 먼저 나오고, 빈칸으로 읽혀 「칸이 비었다」도 그대로 난다
  assert.ok(걸(r.까닭_빈객체).some((g) => /^C1: 「앵글\.까닭」 칸이 비었다/.test(g)), `GA6: ${JSON.stringify(걸(r.까닭_빈객체))}`);
});

test('T28 검수 지적(그림) — GA1 시작그림을 먼저 잰다, GA3 얼굴이 여럿이고 작은 얼굴이 있으면 확인, GA4 빈 창은 창이 아니다, GA5 손 풀이는 재지 않는다, GA7 --항목 얼굴을 밝히면 --받음과 함께도 잰다, GA9 잰 값은 소수 한 자리', { skip: !파이썬 && '파이썬 없음' }, () => {
  const dir = 임시(); const 편 = path.join(dir, '라면_20261120'); fs.mkdirSync(path.join(편, '정지'), { recursive: true }); fs.mkdirSync(path.join(편, '받음'));
  for (const n of ['C2.png', 'C2_승인.png', 'C3.png']) fs.writeFileSync(path.join(편, '정지', n), 'x');   // 고르기만 본다(재지 않는다)
  const 읽기 = String.raw`
import sys, json, copy, importlib.util
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
틀 = json.load(open(sys.argv[2], encoding="utf-8")); 편 = Path(sys.argv[3])
def 고른(고침, 그림=True):
    s = copy.deepcopy(틀); c = {d["cut"]: d for d in s["detail"]}; 고침(c)
    return {cut: p.name for cut, p in m.감정자리대상(s, 편 / "정지" if 그림 else None, 편)[0]}
def 승인(c): c["C2"]["시작그림"] = "정지/C2_승인.png"
def 창(v):
    def f(c): c["C2"]["창"] = v
    return f
def 부위(v):
    def f(c): c["C3"]["감정부위"] = v
    return f
print(json.dumps({
    "GA1": [고른(승인), 고른(승인, 그림=False), 고른(lambda c: None)],
    "GA4": [고른(창(None)), 고른(창({})), 고른(창("")), 고른(창({"세로": 0.62}))],
    "GA5": [고른(부위("손")), 고른(부위("손 — 입가를 가린다")), 고른(부위("입가를 가린 손")), 고른(부위("눈"))],
    "GA3": [m.감정자리판정(x, True, True) for x in ([40.0, 10.0], [40.0, 38.0], [10.0, 8.0], 40.0, None, [])],
    "GA3옛": m.감정자리판정([40.0, 10.0], True, False)[0],
    "GA9": [m.감정자리판정(179 / 720 * 100, False, True), m.감정자리판정(24.96, False, True)],
}, ensure_ascii=False))
`;
  const 답 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 읽기, 도구, 틀경로, 편], { encoding: 'utf8' });
  assert.equal(답.status, 0, 답.stderr);
  const 값 = JSON.parse(답.stdout);
  // GA1 — 컷표의 시작그림(관문이 여는 그림)이 --그림 폴더의 <컷>.png보다 먼저다
  assert.deepEqual(값.GA1, [{ C2: 'C2_승인.png' }, { C2: 'C2_승인.png' }, { C2: 'C2.png' }]);
  // GA4 — "창": null · {} · ""는 창이 없는 것, 값이 있는 창만 잘라 쓰는 컷이다
  assert.deepEqual(값.GA4, [{ C2: 'C2.png' }, { C2: 'C2.png' }, { C2: 'C2.png' }, {}]);
  // GA5 — 손(풀이를 붙여도)은 재지 않고, 정한 낱말이 아니면 잰다(표 검사가 건다), 눈은 얼굴이라 잰다
  assert.deepEqual(값.GA5, [{ C2: 'C2.png' }, { C2: 'C2.png' }, { C2: 'C2.png', C3: 'C3.png' }, { C2: 'C2.png', C3: 'C3.png' }]);
  // GA3 — 얼굴이 둘이고 하나가 아래선에 못 미치면 통과가 아니라 확인, 잰 폭을 모두 적는다
  assert.deepEqual(값.GA3.map((x) => x[0]), ['확인', '통과', '걸림', '통과', '확인', '확인']);
  assert.match(값.GA3[0][1], /얼굴이 2개 잡혔다\(40\.0% · 10\.0%\).*아래선 35%에 못 미치는 얼굴이 있다/);
  assert.match(값.GA3[2][1], /10\.0% · 8\.0%/);
  assert.equal(값.GA3옛, '알림');
  // GA9 — 24.86%는 「24.9%」로 적고 걸림. 24.96%도 걸림이고 「25.0%」로 올려 적지 않는다(다시1 GA3 — 잰 값 그대로 견주고, 적은 값이 판정과 어긋나지 않게 자릿수를 늘린다)
  assert.equal(값.GA9[0][0], '걸림'); assert.match(값.GA9[0][1], /얼굴 폭이 그림 폭의 24\.9%다/);
  assert.equal(값.GA9[1][0], '걸림'); assert.match(값.GA9[1][1], /얼굴 폭이 그림 폭의 24\.96%다/);
  // GA7 — --항목 얼굴을 밝히면 --받음이 있어도 잰다(밝히지 않은 기본 실행은 --받음 · --영상에서 재지 않는다)
  const zlib = require('node:zlib');
  const 덩이 = (이름, 몸) => { const 앞 = Buffer.concat([Buffer.from(이름, 'ascii'), 몸]); const 길이 = Buffer.alloc(4); 길이.writeUInt32BE(몸.length); const 끝 = Buffer.alloc(4); 끝.writeUInt32BE(zlib.crc32(앞)); return Buffer.concat([길이, 앞, 끝]); };
  const 머리 = Buffer.alloc(13); 머리.writeUInt32BE(90, 0); 머리.writeUInt32BE(160, 4); 머리[8] = 8; 머리[9] = 2;
  const 한줄 = Buffer.concat([Buffer.from([0]), Buffer.alloc(270, 60)]);
  fs.writeFileSync(path.join(편, '정지', 'C2.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 덩이('IHDR', 머리), 덩이('IDAT', zlib.deflateSync(Buffer.concat(Array(160).fill(한줄)))), 덩이('IEND', Buffer.alloc(0))]));
  const 표 = 쓰기(편, '컷표.json', JSON.stringify(틀읽기()));
  const r = 돌리기([표, '--그림', path.join(편, '정지'), '--받음', path.join(편, '받음'), '--항목', '얼굴', '--출력', path.join(dir, '검사')]);
  const 줄 = r.항목들.filter((x) => x.항목 === '얼굴');
  assert.equal(줄.length, 1, `GA7: ${JSON.stringify(r.항목들)}`); assert.equal(줄[0].등급, '확인'); assert.equal(r.코드, 2);
});

// ───────── T28 · T29 다시 검수(영상감정앵글검사-20261120-다시1) 지적 GA1~GA8 — 지적마다 고치기 전에 깨지는 판 ─────────
test('T28 · T29 다시 검수 지적 — 시작그림 경로는 관문 판 도구와 같게 푼다(절대 경로 · ~), 한 판은 첫 시작그림으로만, 토막마다 창을 본다, 못 읽는 창은 창이 아니다, 반올림해 넘기지 않는다, 사람 수보다 얼굴이 적으면 확인, 칸은 글로만', { skip: !파이썬 && '파이썬 없음' }, async () => {
  const dir = 임시(); const 편 = path.join(dir, '라면_20261120'); fs.mkdirSync(path.join(편, '정지'), { recursive: true });
  for (const n of ['C1.png', 'C2.png', 'C2_승인.png', 'C3.png', 'C3_끝.png']) fs.writeFileSync(path.join(편, '정지', n), n);
  const 읽기 = String.raw`
import sys, json, copy, os, importlib.util
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
틀 = json.load(open(sys.argv[2], encoding="utf-8")); 편 = Path(sys.argv[3]); 틀["편"]["만든날"] = "2026-11-20"
def 표(고침):
    s = copy.deepcopy(틀); c = {d["cut"]: d for d in s["detail"]}; 고침(c, s); return s
def 앵글걸림(고침): return [w for g, w, t in m.앵글검사(표(고침), 편) if g == "걸림" and "앵글이 앞 컷" in t]
def 고른(고침): return {cut: p.name for cut, p in m.감정자리대상(표(고침), 편 / "정지", 편)[0]}
같은 = {"크기": "클로즈", "높이": "눈높이", "방향": "정면"}
def ga1(c, s):   # C1과 C2가 같은 파일을 상대 · 절대 경로로 적고 C2에 같은판 까닭
    c["C2"]["시작그림"] = str(편 / "정지" / "C1.png"); c["C2"]["같은판"] = "한 방을 둘로 자른 컷"; c["C1"]["앵글"].update(같은); c["C2"]["앵글"].update(같은)
def ga5(c, s):   # C2와 C3의 첫 그림은 다르고 끝 그림만 같다
    c["C2"]["시작그림"] = ["정지/C2.png", "정지/C3_끝.png"]; c["C3"]["시작그림"] = ["정지/C3.png", "정지/C3_끝.png"]; c["C3"]["같은판"] = "끝 그림을 함께 쓴다"; c["C2"]["앵글"].update(같은); c["C3"]["앵글"].update(같은)
def ga2(c, s):   # 같은 C2의 첫 토막에만 창
    i = s["detail"].index(c["C2"]); 둘째 = copy.deepcopy(c["C2"]); c["C2"]["창"] = {"세로": 0.62}; s["detail"].insert(i + 1, 둘째)
def ga4(c, s):   # ~ 로 적은 시작그림은 홈 폴더에서 찾는다(편 폴더 아래가 아니다) — 없으면 --그림 폴더의 그림으로 넘어가지 않는다
    c["C2"]["시작그림"] = "~/synk-없는-폴더/C2_승인.png"
def ga7(v):
    def f(c, s): c["C2"]["창"] = v
    return f
def ga8a(c, s): c["C2"]["감정자리"] = ["수아 — 놀람"]; s["사건"][0]["압축"] = True; c["C3"].pop("감정자리"); c["C3"].pop("감정부위")
def ga8b(c, s): c["C1"]["앵글"]["까닭"] = {"사유": "수아의 눈높이"}
print(json.dumps({
    "GA1": 앵글걸림(ga1), "GA5": 앵글걸림(ga5),
    "GA2": 고른(ga2), "GA4": [고른(ga4), m.감정자리대상(표(ga4), 편 / "정지", 편)[1]],
    "GA7": [고른(ga7({"세로": None})), 고른(ga7({"모름": 1})), 고른(ga7({"세로": [0.4, 0.6], "배율": 1.2}))],
    "GA3": [m.감정자리판정(151 / 432 * 100, True, True), m.감정자리판정(35.0, True, True)],
    "GA6": [m.감정자리판정([40.0], True, True, 사람수=2), m.감정자리판정([40.0, 38.0], True, True, 사람수=2), m.감정자리판정([40.0], True, True, 사람수=1), m.감정자리판정([40.0], True, False, 사람수=2)],
    "GA8": [[t[:40] for g, w, t in m.감정자리검사(표(ga8a), 편) if g == "걸림"], [w for g, w, t in m.앵글검사(표(ga8b), 편) if g == "걸림" and "까닭" in t]],
}, ensure_ascii=False))
`;
  const 답 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 읽기, 도구, 틀경로, 편], { encoding: 'utf8' });
  assert.equal(답.status, 0, 답.stderr);
  const 값 = JSON.parse(답.stdout);
  // GA1 — 같은 파일을 상대 · 절대 경로로 달리 적어도 한 판이다(같은판 까닭이 있으면 이웃 비교를 뺀다)
  assert.deepEqual(값.GA1, [], 'GA1');
  // GA5 — 끝 그림만 같은 것은 한 판이 아니다(관문 판 도구는 목록의 첫 그림을 연다)
  assert.deepEqual(값.GA5, ['C3'], 'GA5');
  // GA2 — 첫 토막에 창이 있어도 창 없는 둘째 토막이 감정 자리면 잰다
  assert.deepEqual(값.GA2, { C2: 'C2.png' }, 'GA2');
  // GA4 — 시작그림 칸에 적힌 파일이 없으면 「그림 없음」이다(--그림 폴더의 다른 그림을 대신 재지 않는다 — 관문 판 도구와 같다)
  assert.deepEqual(값.GA4, [{}, ['C2']], 'GA4');
  // GA7 — 받은 뒤 검사가 못 읽는 창({"세로": null} · 모르는 칸)은 창이 아니라 잰다, 읽을 수 있는 창만 뺀다
  assert.deepEqual(값.GA7, [{ C2: 'C2.png' }, { C2: 'C2.png' }, {}], 'GA7');
  // GA3 — 34.954%는 35%에 못 미친다(35.0%로 올려 통과시키지 않는다), 적는 값도 35 아래로 보인다
  assert.equal(값.GA3[0][0], '걸림'); assert.match(값.GA3[0][1], /얼굴 폭이 그림 폭의 34\.95%다/); assert.equal(값.GA3[1][0], '통과');
  // GA6 — 컷표의 사람 수보다 잡힌 얼굴이 적으면 통과가 아니라 확인(감정을 맡은 얼굴이 안 잡혔을 수 있다), 앞선 편은 알림
  assert.deepEqual(값.GA6.map((x) => x[0]), ['확인', '통과', '통과', '알림']);
  assert.match(값.GA6[0][1], /사람은 2명인데 얼굴은 1개만 잡혔다\(40\.0%\)/);
  // GA8 — 감정자리와 앵글.까닭은 글이다(글이 든 배열 · 객체도 칸을 채운 것이 아니다)
  assert.match(값.GA8[0][0] || '', /^사람이 나오는 편인데 감정 자리가 하나도 없다/); assert.deepEqual(값.GA8[1], ['C1']);
});

// ───────── T28 — 다른 도구와 같은 풀이인지 그 도구의 원문과 견주고(시작그림 고르기 · 창 읽기), 감정 자리를 토막 단위로 본다 ─────────
test('T28 — 관문 판 도구 · 받은 뒤 검사의 원문과 견준다(시작그림 고르기 · 창 읽기), 감정 자리는 토막 단위, 글이 아닌 감정자리는 걸림, 얼굴 수가 사람 수와 다르면 확인', { skip: !파이썬 && '파이썬 없음' }, async () => {
  const dir = 임시(); const 편 = path.join(dir, '라면_20261120');
  for (const [폴더, 이름들] of [['정지', ['C1.png', 'C2.png', 'C2_승인.png', 'C3.png', 'C3_끝.png']], ['그림', ['C5_v1.png', 'C5_v2.png', 'C_6.png', 'C7.jpg', 'C7.png']]]) {
    fs.mkdirSync(path.join(편, 폴더), { recursive: true });
    for (const n of 이름들) fs.writeFileSync(path.join(편, 폴더, n), n);
  }
  const 읽기 = String.raw`
import sys, json, copy, os, re, ast, math, importlib.util
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
틀 = json.load(open(sys.argv[2], encoding="utf-8")); 편 = Path(sys.argv[3]); 틀["편"]["만든날"] = "2026-11-20"
def 떼기(파일, 이름들):   # 그 도구를 불러오지 않고(그림 라이브러리 없이도 돌게) 원문에서 함수만 떼어 돌린다
    마당 = {"Path": Path, "os": os, "re": re, "math": math}
    for 마디 in ast.parse(Path(파일).read_text(encoding="utf-8")).body:
        if (isinstance(마디, ast.FunctionDef) and 마디.name in 이름들) or (isinstance(마디, ast.Assign) and any(isinstance(x, ast.Name) and x.id in 이름들 for x in 마디.targets)):
            exec(compile(ast.Module([마디], []), str(파일), "exec"), 마당)
    return 마당
관문 = 떼기(sys.argv[4], {"시작그림찾기", "파일이름", "그림확장자"}); 받은뒤 = 떼기(sys.argv[5], {"창읽기"})
정지 = 편 / "정지"; 그림 = 편 / "그림"
os.utime(그림 / "C5_v1.png", (1e9, 1e9)); os.utime(그림 / "C5_v2.png", (1.5e9, 1.5e9))
경우 = [("C2", {"시작그림": "정지/C2_승인.png"}, 정지), ("C2", {"시작그림": str(정지 / "C1.png")}, 정지), ("C2", {"시작그림": "~/synk-없는-폴더/C2.png"}, 정지),
        ("C2", {"시작그림": ["정지/C3.png", "정지/C3_끝.png"]}, 정지), ("C2", {"시작그림": ["", " 정지/C3.png "]}, 정지), ("C2", {"시작그림": "정지/없는.png"}, 정지),
        ("C2", {}, 정지), ("C2", {"시작그림": 7}, 정지), ("C2", {"시작그림": ""}, 정지), ("C5", {}, 그림), ("C 6", {}, 그림), ("C7", {}, 그림), ("C9", {}, 그림),
        ("C2", {}, None), ("C2", {}, 편 / "없는폴더")]
열쇠 = lambda q: None if q is None else os.path.normcase(str(Path(q).resolve()))
둘 = [(관문["시작그림찾기"](폴더, 컷, 줄, 편)[0], m.감정자리그림(dict(줄, cut=컷), 폴더, 편)[0]) for 컷, 줄, 폴더 in 경우]
창들 = [None, {}, "", {"세로": 0.62}, {"세로": None}, {"모름": 1}, {"세로": [0.4, 0.6], "배율": 1.2}, {"배율": 0.5}, {"가로": True}, {"세로": "0.6"}, {"세로": [0.4]}, {"세로": 1.5},
       {"배율": [1, 2]}, {"배율": float("inf")}, [0.5], 0.62, {"가로": 0.1, "세로": 0.9, "배율": 3}, {"가로": [0, 1]}, {"배율": 1}, {"세로": [0.4, None]}, {"배율": [1, 0.5]}]
def 표(고침):
    s = copy.deepcopy(틀); c = {d["cut"]: d for d in s["detail"]}; 고침(c, s); return s
def 고른(고침): return {cut: q.name for cut, q in m.감정자리대상(표(고침), 정지, 편)[0]}
def 둘로(c, s, 첫, 둘째고침):   # C2를 두 토막으로 쓴다 — 토막마다 따로 고친다
    i = s["detail"].index(c["C2"]); 둘째 = copy.deepcopy(c["C2"]); 첫(c["C2"]); 둘째고침(둘째); s["detail"].insert(i + 1, 둘째)
창 = {"세로": 0.62}
def 자리뺌(d): d.pop("감정자리")
def 창줌(d): d["창"] = 창
def 자리빼고창(d): d.pop("감정자리"); d["창"] = 창
def h3a(c, s): s["사건"][0]["압축"] = True; 둘로(c, s, 자리뺌, 창줌)          # 감정 자리를 적은 둘째 토막만 창으로 잘라 쓴다(첫 토막은 감정 자리가 아니다)
def h3b(c, s): s["사건"][0]["감정"] = "C2#2"; 둘로(c, s, 자리뺌, 자리빼고창)    # 사건 표가 둘째 토막을 가리키고 그 토막만 창
def h3c(c, s): s["사건"][0]["감정"] = "C2#2"; 둘로(c, s, 자리빼고창, 자리뺌)    # 사건 표가 둘째 토막을 가리키고 첫 토막만 창
def h3d(c, s): 둘로(c, s, 창줌, lambda d: d.update(인물=d["인물"] + ["엄마"]))   # 첫 토막은 창, 재는 둘째 토막에 사람이 둘
def h3e(c, s): 둘로(c, s, lambda d: None, lambda d: d.update(감정부위="입가를 가린 손"))
def h3f(c, s): 둘로(c, s, lambda d: (d.pop("감정자리"), d.update(인물=[])), 자리뺌)   # 사건 표가 가리키는 첫 토막에 사람이 없다 — 그 컷의 사람 토막을 잰다
def h4(c, s): c["C2"]["감정자리"] = ["수아 — 놀람"]                             # 사건 표가 C2를 가리켜 감정 자리는 있다 — 그래도 칸은 글이어야 한다
print(json.dumps({
    "H1": [i for i, (a, b) in enumerate(둘) if 열쇠(a) != 열쇠(b)], "H1관문": [a.name if a else None for a, b in 둘],
    "H2": [i for i, v in enumerate(창들) if isinstance(받은뒤["창읽기"](v), dict) != m._창있음(v)], "H2수": sum(isinstance(받은뒤["창읽기"](v), dict) for v in 창들),
    "H3": [고른(h3a), 고른(h3b), 고른(h3c), m._감정잴토막(표(h3d))["C2"]["인물"], [w for g, w, t in m.감정자리검사(표(h3e), 편) if g == "걸림" and "정한 낱말이 아니다" in t], 고른(h3f)],
    "H4": [[w, t[:14]] for g, w, t in m.감정자리검사(표(h4), 편) if g == "걸림"],
    "H5": [m.감정자리판정(24.99996, False, True), m.감정자리판정(34.9999, True, True), m.감정자리판정(25.0, False, True)],
    "H6": [m.감정자리판정([40.0, 38.0], True, True, 사람수=1), m.감정자리판정([40.0, 38.0], True, True, 사람수=2), m.감정자리판정([40.0, 38.0], True, True)],
}, ensure_ascii=False))
`;
  const 도구폴더 = path.dirname(도구);
  const 답 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 읽기, 도구, 틀경로, 편, path.join(도구폴더, '영상관문판.py'), path.join(도구폴더, '받은뒤검사.py')], { encoding: 'utf8' });
  assert.equal(답.status, 0, 답.stderr);
  const 값 = JSON.parse(답.stdout);
  // 시작그림 고르기 — 굽기 전 관문의 판 도구(tools/영상관문판.py 시작그림찾기)가 여는 그림과 열다섯 경우 모두 같다(칸의 첫 장 · 절대 경로 · ~ · 없는 파일 · 칸이 빈 컷의 <컷>.png · 파일 이름으로 바꾼 컷 · 가장 새 판)
  assert.deepEqual(값.H1, [], `관문 판 도구와 다른 경우: ${값.H1}`);
  assert.deepEqual(값.H1관문, ['C2_승인.png', 'C1.png', null, 'C3.png', 'C3.png', null, 'C2.png', 'C2.png', 'C2.png', 'C5_v2.png', 'C_6.png', 'C7.png', null, null, null]);
  // 창 읽기 — 받은 뒤 검사(tools/받은뒤검사.py 창읽기)가 창으로 읽는 값만 T28도 창으로 본다
  assert.deepEqual(값.H2, [], `받은 뒤 검사와 다른 창: ${값.H2}`); assert.equal(값.H2수, 6);
  // 감정 자리는 토막 단위 — 감정 토막이 창으로 잘라 쓰면 재지 않고(다른 토막이 안 잘라도), 감정 토막이 안 자르면 잰다. 사건 표의 「C2#2」는 둘째 토막이다
  assert.deepEqual(값.H3.slice(0, 3), [{}, {}, { C2: 'C2.png' }]);
  assert.deepEqual(값.H3[3], ['수아', '엄마'], '사람 수는 재는 토막에서 센다');
  assert.deepEqual(값.H3[4], ['C2'], '둘째 감정 토막의 감정부위도 본다');
  assert.deepEqual(값.H3[5], { C2: 'C2.png' }, '가리킨 토막에 사람이 없으면 그 컷의 사람 토막을 잰다(조용히 빠지지 않는다)');
  // 글이 아닌 감정자리는 다른 감정 자리가 있어도 걸림
  assert.deepEqual(값.H4, [['C2', '「감정자리」는 글로 적는다']]);
  // 아래선에 아주 조금 못 미치는 값 — 걸림이고, 적은 값이 아래선으로 올라가 보이지 않는다
  assert.equal(값.H5[0][0], '걸림'); assert.match(값.H5[0][1], /얼굴 폭이 그림 폭의 24\.9%다/);
  assert.equal(값.H5[1][0], '걸림'); assert.match(값.H5[1][1], /얼굴 폭이 그림 폭의 34\.9999%다/); assert.equal(값.H5[2][0], '통과');
  // 잡힌 얼굴이 사람 수보다 많아도 확인(적을 때와 같다 — 어느 얼굴이 감정을 맡았는지 눈이 본다), 사람 수를 모르면 통과
  assert.deepEqual(값.H6.map((x) => x[0]), ['확인', '통과', '통과']);
  assert.match(값.H6[0][1], /사람은 1명인데 얼굴은 2개가 잡혔다\(40\.0% · 38\.0%\)/);
});

// T30 시늉 박자 — 영상 지시문(--지시문). 11-20 경산 공모전 편의 옛 판처럼 ACTION이 빈손 시늉에 뜻을 맡기고 SOUND에 감탄 소리만 있으면 걸림이다.
//   「as if reading」 · 「as if deciding」처럼 몸짓을 꾸미는 as if는 시늉이 아니다(기존 지시문 523개 실측).
test('지시문 시늉(T30) — 빈손 시늉 · 감탄 소리만이면 걸림, 같은 판의 대사 · 컷표의 대사가 있으면 지나가고, 몸짓을 꾸미는 as if는 시늉이 아니다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 판 = (ACTION, 소리 = 'SOUND: only her short, breathy "허" at about 1.0 s, over quiet kitchen tone.') => `@이미지 1 is the exact first frame of this video.\nACTION: ${ACTION}\n${소리}\n`;
  const 옛 = 'At about 0.4 s she sets the pot down and lets go of the handle. At about 1.6 s she cups her empty hand like a spoon and mimes scooping noodles into her mouth, twice, her eyes on the door as if to say "this".';
  const 시늉줄 = (r) => r.항목들.filter((x) => x.항목 === '지시문' && x.글.startsWith('(시늉)'));
  const 돌려 = (글, 고침) => { const dir = 임시(); const seq = 틀읽기(); if (고침) 고침(seq); return 돌리기([쓰기(dir, '컷표.json', JSON.stringify(seq)), '--지시문', 쓰기(dir, 'C1.txt', 글), '--출력', path.join(dir, '검사')]); };
  const 걸린 = 시늉줄(돌려(판(옛)));
  assert.deepEqual(걸린.map((x) => [x.컷, x.등급]), [['C1', '걸림']], JSON.stringify(걸린));
  assert.match(걸린[0].글, /^\(시늉\) ACTION이 시늉에 뜻을 맡겼다 「At about 1\.6 s she cups her empty hand like a spoon.*\(29 · T30\)/);
  assert.deepEqual(시늉줄(돌려(판(옛.replace('as if to say "this"', 'and asks "밥은 먹었어?"')))), [], 'ACTION 속 대사가 받친다');
  assert.deepEqual(시늉줄(돌려(판(옛, 'SOUND: her voice at 1.6 s — "밥은 먹었어?" — over quiet kitchen tone.'))), [], 'SOUND 칸의 대사가 받친다');
  assert.deepEqual(시늉줄(돌려(판(옛), (s) => { 컷(s, 'C1').소리 = '가스 불 탁 · 수아 「밥은 먹었어?」'; })), [], '컷표 그 컷의 대사가 받친다(말은 편집에서 얹는다)');
  assert.deepEqual(시늉줄(돌려(판('At about 0.4 s her eyes move down the note as if reading line by line; at about 1.6 s her hands shake like a leaf and she draws a breath as if deciding.'))), [], '몸짓을 꾸미는 as if · 손을 빗댄 말은 시늉이 아니다');
  const 까닭 = 시늉줄(돌려(판(옛), (s) => { 컷(s, 'C1').시늉까닭 = '누구나 아는 몸짓'; }));
  assert.deepEqual(까닭.map((x) => x.등급), ['주의']);
});

// ───────── T31 둘레 무리(26) — 11-21 공모전 편(제출 전이라 작품 내용은 적지 않는다) ─────────
// 왜: 둘레에 무리가 있는 장면을 720p로 다섯 번 구웠고 주인공 컷 세 판 모두 둘레 무리가 굳었다. 「둘레」 칸이 없었고(주인공 동작만 적음), 끝 그림을 「둘레는 같은 자리 그대로」로 구웠고,
//   끝 그림을 쓴 판은 첫 1.5~2초를 시작 그림 그대로 붙들었다. 11-22 GPT 검수 두 회차 뒤 설계를 다시 짰다 — 「둘레」는 박자 표, 지시문은 꼴(AROUND 줄 · 초 박자)로 본다.
//   걸려야 할 옛 판(빈 둘레 · 글 한 줄 · 한 무리 · 늦은 첫 박자 · 까닭 없는 끝 그림 · AROUND 줄 없는 지시문 · 초 박자 없는 AROUND · in unison)과
//   지나가야 할 새 판(박자 표 · 「없음: 까닭」 · 부정한 무리 낱말 · 무리마다 다른 초의 AROUND)을 고정한다.
//   11-22 Fable 설계 검토 뒤: 기계는 빠뜨림만 막고 글의 뜻은 풀지 않는다 — 선언한 한계(그림 짝 · AROUND의 뜻 · 박자 「무엇」의 뜻 · 무리 낱말 오탐)는 「이 입력은 지나간다」로 고정한다.
const 무리컷 = (s, 날짜 = '2026-11-21') => { s.편.만든날 = 날짜; 컷(s, 'C1').구도 = '허리 위 · 옆 45도 — 뒤로 시장 사람들이 오간다'; };
const 둘레표 = [{ t: 0.3, 누가: '앞쪽 손님', 무엇: '상자를 들어 옮긴다' }, { t: 0.8, 누가: '뒤쪽 행인', 무엇: '옆길로 빠져 걸어간다' }];
const T31줄 = (r) => r.항목들.filter((x) => x.항목 === '틀' && /T31/.test(x.글)).map((x) => [x.컷, x.등급, x.글]);
const T31등급 = (고침, dir) => T31줄(틀돌리기(고침, [], dir)).map((v) => v.slice(0, 2));

test('둘레 무리(T31) — 무리 낱말이 있는데 「둘레」가 비었거나 박자 표가 아니면 걸림(앞선 편은 주의) · 박자 표와 「없음: 까닭」은 지나간다 · 끝 그림은 「끝그림까닭」', { skip: !파이썬 && '파이썬 없음' }, () => {
  let x = T31줄(틀돌리기((s) => 무리컷(s)));
  assert.deepEqual(x.map((v) => v.slice(0, 2)), [['C1', '걸림']]);
  assert.match(x[0][2], /둘레에 무리 낱말이 있는데 「둘레」 칸이 비었다\(26 · T31\)/);
  assert.deepEqual(T31등급((s) => 무리컷(s, '2026-11-18')), [['C1', '주의']], '둘레부터(11-19) 앞선 편은 주의');
  const 표문제 = [
    ['뒤 사람들은 저마다 다른 박자로 오간다', /「둘레」는 박자 표로 적는다/],
    [[둘레표[0]], /t · 누가 · 무엇을 다 갖춘 것이 1개다/],
    [[둘레표[0], { ...둘레표[1], 누가: '앞쪽 손님' }], /「누가」가 하나뿐이다/],
    [둘레표.map((b) => ({ ...b, t: b.t + 1.2 })), /첫 박자가 1\.5초다/],
    [[둘레표[0], { t: 0.8, 누가: '뒤쪽 행인' }], /다 갖춘 것이 1개다/],
    ['없음:', /「둘레」는 박자 표로 적는다 — .*「없음: <까닭>」\(까닭까지\)/],
    [[{ ...둘레표[0], t: -0.2 }, { ...둘레표[1], t: 1.8 }], /t가 0보다 작다/],
  ];
  for (const [둘레, 글] of 표문제) {
    x = T31줄(틀돌리기((s) => { 무리컷(s); 컷(s, 'C1').둘레 = 둘레; }));
    assert.deepEqual(x.map((v) => v.slice(0, 2)), [['C1', '걸림']], JSON.stringify(둘레));
    assert.match(x[0][2], 글);
  }
  assert.deepEqual(T31등급((s) => { 무리컷(s); 컷(s, 'C1').둘레 = 둘레표; }), [], '박자 표');
  assert.deepEqual(T31등급((s) => { 무리컷(s); 컷(s, 'C1').둘레 = '없음: 뒤 시장은 문을 닫아 비었다'; }), [], '「없음: 까닭」');
  // 선언한 한계 — 박자 표 「무엇」의 뜻(몸짓인지 정지인지)은 풀지 않는다(굽기 전 관문 ⑩의 눈과 받은 뒤 둘레굳음이 본다)
  assert.deepEqual(T31등급((s) => { 무리컷(s); 컷(s, 'C1').둘레 = [둘레표[0], { ...둘레표[1], 무엇: '같은 자리에 서 있다' }]; }), [], '「무엇」의 뜻은 풀지 않는다(선언한 한계)');
  x = T31줄(틀돌리기((s) => { s.편.만든날 = '2026-11-21'; 컷(s, 'C1').둘레 = 둘레표; 컷(s, 'C1').끝그림 = '정지/C1_끝.png'; }));
  assert.deepEqual(x.map((v) => v.slice(0, 2)), [['C1', '걸림']], '「둘레」 박자 표만 있어도 무리 컷이다');
  assert.match(x[0][2], /「끝그림」을 쓴다\(26 · T31\) — 끝 그림을 쓴 무리 컷 두 판이 모두 첫 1\.5~2초를/);
  assert.deepEqual(T31등급((s) => { s.편.만든날 = '2026-11-21'; Object.assign(컷(s, 'C1'), { 둘레: 둘레표, 끝그림: '정지/C1_끝.png', 끝그림까닭: '480p 빠른 판으로 첫 2초를 먼저 잰다' }); }), []);
  // 무리 낱말 — 한국어는 뒤의 부정, 영어는 바로 앞의 부정만 뺀다(GPT 검수 11-22: 「without disturbing the crowd」는 무리다)
  for (const [구도, 무리] of [['무리 없이 한 번에 담는다', false], ['텅 빈 시장, 사람들이 없다', false], ['an empty plaza without crowds', false], ['a wall of hundreds of lanterns', false],
    ['hundreds of local people cross the square', true], ['the camera pans without disturbing the crowd', true], ['an empty plaza after the crowds have left', true]]) {
    assert.deepEqual(T31등급((s) => { s.편.만든날 = '2026-11-21'; 컷(s, 'C1').구도 = `허리 위 · 옆 45도 — ${구도}`; }), 무리 ? [['C1', '걸림']] : [], 구도);
  }
  // 선언한 한계 — 무리 낱말은 알림이다. 무리가 없는 컷에 걸리면 「없음: 까닭」으로 푼다
  assert.deepEqual(T31등급((s) => { s.편.만든날 = '2026-11-21'; 컷(s, 'C1').구도 = '허리 위 · 옆 45도 — an empty plaza after the crowds have left'; 컷(s, 'C1').둘레 = '없음: 무리가 떠난 빈 광장'; }), []);
});

test('지시문 둘레(T31) — 무리 컷의 판에 AROUND 줄이 없거나(BACKGROUND는 아니다) 초 박자가 둘보다 적거나 in unison이면 걸림, 무리마다 다른 초를 적으면 지나가고, 무리 없는 컷은 보지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 판 = (AROUND, 더 = '') => `@이미지 1 is the exact first frame of this video.\nACTION: at about 0.5 s she lifts the lid; at about 1.6 s she smiles at the steam.\n${더}${AROUND ? `AROUND: ${AROUND}\n` : ''}SOUND: market noise.\n`;
  const 둘레줄 = (r) => r.항목들.filter((x) => x.항목 === '지시문' && x.글.startsWith('(둘레)')).map((x) => [x.컷, x.등급, x.글]);
  const 돌려 = (글, 무리 = true) => { const dir = 임시(); const seq = 틀읽기(); if (무리) { 무리컷(seq); 컷(seq, 'C1').둘레 = 둘레표; } return 돌리기([쓰기(dir, '컷표.json', JSON.stringify(seq)), '--지시문', 쓰기(dir, 'C1.txt', 글), '--출력', path.join(dir, '검사')]); };
  const 걸림 = (글, 글꼴) => { const x = 둘레줄(돌려(글)); assert.deepEqual(x.map((v) => v.slice(0, 2)), [['C1', '걸림']], 글); assert.match(x[0][2], 글꼴); };
  걸림(판(null), /^\(둘레\) 둘레에 무리가 있는 컷인데 지시문에 AROUND 줄이 없다\(26 · T31\)/);
  걸림(판(null, 'BACKGROUND: weathered brick stalls in morning light.\n'), /AROUND 줄이 없다/);
  걸림(판('each one wears a red scarf.'), /AROUND 줄에 서로 다른 초 박자가 0개뿐이다/);
  걸림(판('at 0.3 s the front row steps forward; at 0.30 seconds the back row steps forward.'), /서로 다른 초 박자가 1개뿐이다/);
  걸림(판('at 0.3 s the front row steps forward; at .30 seconds the back row steps forward.'), /서로 다른 초 박자가 1개뿐이다/);
  걸림(판('at about 0.5 s the shoppers all turn in unison; at about 1.0 s they walk on.'), /한꺼번에 움직이게 적었다\(「in unison」/);
  assert.deepEqual(둘레줄(돌려(판('the shoppers keep moving from the first frame to the last, never in unison: at about 0.3 s one lifts a crate; at about 0.8 s another hurries past behind her.'))), []);
  assert.deepEqual(둘레줄(돌려(판('the vendors stack crates at 1 s while a cyclist swerves past at 2 s and the shoppers step aside at 3 s.'))), [], '정해 둔 말이 없어도 무리마다 다른 초면 지나간다');
  assert.deepEqual(둘레줄(돌려(판(null), false)), [], '무리 없는 컷');
  // 선언한 한계 — AROUND 줄은 있나 · 서로 다른 초가 둘 이상인가만 본다. 그 초에 무리가 서 있는지는 굽기 전 관문 ⑩의 눈과 받은 뒤 둘레굳음이 본다
  assert.deepEqual(둘레줄(돌려(판('from 0.3 s to 4.0 s each shopper wears a red scarf and stands still.'))), [], 'AROUND의 뜻은 풀지 않는다(선언한 한계)');
});

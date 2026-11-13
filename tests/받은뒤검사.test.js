'use strict';
// 받은 뒤 검사(tools/받은뒤검사.py · 2026-11-14) — 받은 판을 컷표의 쓰는 구간으로 재는 차례와 판정을 본다.
// 왜: 받은 뒤 검사는 사람이 기억해서 불렀고, 사람 굳음은 편마다 마지막 컷 전수 검수에서야 잡혔다. 이 시험은 작은 가짜 영상(ffmpeg 시험 그림)으로
//   ① 길이 · 비율 · 소리 줄기 ② 사람 굳음(걸림) · 얼굴 극접사(확인) · 못 잼(확인) ③ 다시 낸 판(__2)과 대안 판 잇기 ④ 내기 도구가 받은 직후 부르는 길 을 묶는다.
//   사람 움직임 값 자체(얼굴 모델 · rembg)는 무거워 여기서 재지 않는다 — 파일 이름으로 값을 내는 가짜 모듈(SYNK_MOTION_PY)을 끼워 차례와 판정만 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 도구 = path.join(뿌리, 'tools', '받은뒤검사.py');
const 틀경로 = path.join(뿌리, 'docs', '마케팅', '제작양식', '영상양식', '컷표_틀.json');
const 굽기폴더 = path.join(뿌리, 'docs', '마케팅', 'PULSE_포트폴리오_제작준비_20261012', '시댄스무제한');
const 있음 = (명령, 인자) => spawnSync(명령, 인자, { encoding: 'utf8' }).status === 0;
const 준비 = 있음('python', ['-I', '-X', 'utf8', '-c', 'import sys']) && 있음('ffmpeg', ['-version']) && 있음('ffprobe', ['-version']);
const 건너뜀 = { skip: !준비 && '파이썬 · ffmpeg · ffprobe 없음' };

// 가짜 사람 움직임 모듈 — 파일 이름으로 값을 낸다(굳음 · 가까움 · 조금), 부른 (파일, 시작 장, 장 수)를 옆 파일에 적는다
const 가짜모듈 = String.raw`
import json, os
FROZEN = 0.12
def pairs(path, a=0, k=None):
    with open(os.environ["SYNK_MOTION_LOG"], "a", encoding="utf-8") as f:
        f.write(json.dumps([os.path.basename(path), a, k], ensure_ascii=False) + "\n")
    name = os.path.basename(path)
    if "둘째굳음" in name:   # 뒤 구간(100번째 장부터)만 굳은 판 — 구간마다 따로 재는지 본다
        return [(1.0, 0.02, "얼굴") if a >= 100 else (0.2, 0.5, "얼굴")] * max(2, (k or 48) - 1)
    one = (1.0, 0.02, "얼굴") if "굳음" in name else (0.0, 0.3, "가까움") if "가까움" in name else (0.2, 0.1, "얼굴") if "조금" in name else (0.2, 0.5, "얼굴")
    return [one] * max(2, (k or 48) - 1)
def verdict(c, p):
    return "카메라만 · 사람 굳음" if (p < FROZEN and c > 3 * p and c > 0.15) else ("멈춘 화면" if p < FROZEN else "-")
def summary(ps):
    c, p = sum(x[0] for x in ps) / len(ps), sum(x[1] for x in ps) / len(ps)
    close = sum(x[2] == "가까움" for x in ps)
    return {"장": len(ps) + 1, "카메라": round(c, 3), "사람": round(p, 3), "판정": "가까움 · 눈으로 판정" if close > len(ps) / 2 else verdict(c, p)}
def windows(ps, fps=24, win=24, step=12):
    return [(round(w0 / fps, 2), ps[w0][0], ps[w0][1], verdict(ps[w0][0], ps[w0][1])) for w0 in range(0, max(1, len(ps) - win + 1), step)]
`;

function 영상(자리, { 초 = 5, 크기 = '270x480', fps = 24, 소리 = false, 소리초 = null } = {}) {
  const 인자 = ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=${크기}:r=${fps}:d=${초}`];
  if (소리) 인자.push('-f', 'lavfi', '-i', `sine=f=440:d=${소리초 || 초}:sample_rate=48000`);
  인자.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(소리 ? ['-c:a', 'aac', ...(소리초 ? [] : ['-shortest'])] : []), 자리);
  execFileSync('ffmpeg', 인자);
}
// 편 폴더: 예시 컷표(C1 0.5~4.0 · C2 0.5~3.5 · C3 0.4~3.9 · C4 0.5~5.5, 9:16) + 받음/ — 판들 = {이름: 영상 선택}
function 편만들기(t, 판들, { 순서 = null, 고침 = null } = {}) {
  const 편 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-got-'));
  t.after(() => fs.rmSync(편, { recursive: true, force: true }));
  const seq = JSON.parse(fs.readFileSync(틀경로, 'utf8'));
  if (고침) 고침(seq);
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(seq), 'utf8');
  fs.mkdirSync(path.join(편, '받음'));
  for (const [이름, 선택] of Object.entries(판들)) 영상(path.join(편, '받음', `${이름}.mp4`), 선택);
  if (순서) { fs.mkdirSync(path.join(편, '꾸러미')); fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify(순서), 'utf8'); }
  fs.writeFileSync(path.join(편, '가짜_사람움직임.py'), 가짜모듈, 'utf8');
  return 편;
}
function 돌리기(편, 더 = [], env = {}) {
  const r = spawnSync('python', ['-X', 'utf8', 도구, 편, '--연속성안함', ...더, '--json'], { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 300000,
    env: { ...process.env, SYNK_MOTION_PY: path.join(편, '가짜_사람움직임.py'), SYNK_MOTION_LOG: path.join(편, '부른것.jsonl'), ...env } });
  let 결과 = null;
  try { 결과 = JSON.parse(r.stdout); } catch (e) { /* 멈춤 글은 stderr */ }
  return { 코드: r.status, 결과, stdout: r.stdout, stderr: r.stderr };
}
const 부른것 = 편 => (fs.existsSync(path.join(편, '부른것.jsonl')) ? fs.readFileSync(path.join(편, '부른것.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const 줄 = (판, 순서, 더 = {}) => ({ 순서, id: 판, 폴더: `00${순서}_${판}`, 길이: 5, 비율: '9:16', 소리: '끔', 파일: [], '빠진 파일': [], ...더 });

test('살아 있는 사람 판은 통과 — 쓰는 구간(in~out)의 장만 재고, 기록을 받음 폴더에 남긴다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {} });
  const r = 돌리기(편, ['--판', 'C1']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  const f = r.결과.판.C1.파일[0];
  assert.deepEqual([f.파일, f.초, f.가로, f.세로, f.fps, f.소리, f.쓰는구간], ['C1.mp4', 5, 270, 480, 24, false, [[0.5, 4]]]);
  assert.deepEqual([f.사람.사람, f.사람.판정, f.걸림, f.확인], [0.5, '-', [], []]);
  assert.deepEqual(부른것(편), [['C1.mp4', 12, 84]], '0.5~4.0초 = 24fps의 12번째 장부터 84장');
  assert.deepEqual(r.결과.쓸판, { C1: 'C1.mp4' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(편, '받음', '_받은뒤검사.json'), 'utf8')).쓸판, { C1: 'C1.mp4' });
  // 판을 고르지 않으면 아직 안 받은 판을 「확인」으로 알린다
  const 전체 = 돌리기(편);
  assert.equal(전체.코드, 2);
  assert.deepEqual(전체.결과.아직없는판, ['C2', 'C3', 'C4']);
});

test('굳은 판은 걸림 · 다시 낼 판 — 다시 낸 판(__2)이 살아 있으면 그 파일을 쓸 판으로 고른다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C2: {} });
  fs.renameSync(path.join(편, '받음', 'C2.mp4'), path.join(편, '받음', '굳음.mp4'));   // 이름에 「굳음」이 든 파일을 C2 자리에 두려고 판 이름을 바꾼다
  const 순서 = [줄('굳음', 1, { 컷: ['C2'] })];
  fs.mkdirSync(path.join(편, '꾸러미')); fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify(순서), 'utf8');
  const r = 돌리기(편);
  assert.equal(r.코드, 1, r.stdout + r.stderr);
  assert.deepEqual(r.결과.다시낼판, ['굳음']);
  assert.match(r.결과.판.굳음.파일[0].걸림[0], /^카메라만 · 사람 굳음\(사람 0\.02 · 카메라 1\.0 — 문턱 0\.12\) — 숨기지 말고 연기 박자를 고친 지시문으로 다시 낸다/);
  assert.deepEqual(부른것(편)[0], ['굳음.mp4', 12, 72], '대안 판은 "컷"으로 이은 C2의 쓰는 구간(0.5~3.5초)으로 잰다');
  // 다시 낸 판이 살아 있으면 다시 낼 판에서 빠진다(굳은 첫 판은 걸림으로 남는다)
  영상(path.join(편, '받음', '굳음__2.mp4'));
  fs.renameSync(path.join(편, '받음', '굳음__2.mp4'), path.join(편, '받음', '살아남__2.mp4'));
  fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify([줄('굳음', 1, { 컷: ['C2'] }), 줄('살아남', 2, { 컷: ['C2'] })]), 'utf8');
  const r2 = 돌리기(편);
  assert.deepEqual(r2.결과.다시낼판, ['굳음']);
  assert.deepEqual(r2.결과.쓸판, { 살아남: '살아남__2.mp4' });
});

test('같은 판의 둘째 파일(__2)은 첫 파일과 함께 재고, 걸림 없는 것 가운데 사람 값이 큰 쪽을 쓸 판으로', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {}, 'C1__2': {} });
  fs.renameSync(path.join(편, '받음', 'C1.mp4'), path.join(편, '받음', 'C1조금.mp4'));
  fs.mkdirSync(path.join(편, '꾸러미'));
  fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify([줄('C1조금', 1, { 컷: ['C1'] }), 줄('C1', 2)]), 'utf8');
  const r = 돌리기(편, ['--판', 'C1,C1조금']);
  assert.deepEqual(r.결과.판.C1.파일.map(f => f.파일), ['C1__2.mp4']);
  assert.equal(r.결과.판.C1조금.파일[0].걸림.length, 1, '사람 0.1은 문턱 0.12 아래 — 멈춘 화면');
  assert.deepEqual(r.결과.쓸판, { C1: 'C1__2.mp4' });
});

test('길이가 쓰는 구간보다 짧거나 · 비율이 다르거나 · 소리 켬 판에 소리가 없으면 걸림(사람은 재지 않는다)', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: { 초: 3 }, C2: { 크기: '480x270' }, C3: {}, C4: { 초: 6, 소리: true } },
    { 순서: [줄('C1', 1), 줄('C2', 2), 줄('C3', 3, { 소리: '켬' }), 줄('C4', 4, { 소리: '켬' })] });
  const r = 돌리기(편);
  assert.equal(r.코드, 1, r.stdout + r.stderr);
  assert.match(r.결과.판.C1.파일[0].걸림[0], /^받은 판의 영상이 3\.0초인데 쓰는 구간이 4초까지다 — 편집에서 이 컷이 1\.0초 모자란다/);
  assert.match(r.결과.판.C2.파일[0].걸림[0], /^화면이 480×270로 「편\.비율」 9:16과 다르다/);
  assert.match(r.결과.판.C3.파일[0].걸림[0], /^소리 켬 판인데 받은 판에 소리 줄기가 없다/);
  assert.deepEqual(r.결과.판.C4.파일[0].걸림, [], '소리 줄기가 있고 6초라 5.5초까지 덮는다');
  assert.deepEqual(r.결과.다시낼판, ['C1', 'C2', 'C3']);
  assert.deepEqual(부른것(편), [], '걸린 판과 사람 없는 컷(C4 인물 [])은 사람 움직임을 재지 않는다');
});

test('얼굴 극접사는 확인, 사람 움직임 도구를 못 부르면 그 항목만 「못 잼」 확인 — 둘 다 끝 코드 2', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {} });
  fs.renameSync(path.join(편, '받음', 'C1.mp4'), path.join(편, '받음', '가까움.mp4'));
  fs.mkdirSync(path.join(편, '꾸러미'));
  fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify([줄('가까움', 1, { 컷: ['C1'] })]), 'utf8');
  const r = 돌리기(편);
  assert.equal(r.코드, 2, r.stdout + r.stderr);
  assert.match(r.결과.판.가까움.파일[0].확인[0], /^얼굴 극접사라 사람 값\(0\.3\)이 부풀 수 있다/);
  assert.deepEqual(r.결과.쓸판, { 가까움: '가까움.mp4' });
  const 못 = 돌리기(편, [], { SYNK_MOTION_PY: path.join(편, '없는_사람움직임.py') });
  assert.equal(못.코드, 2, 못.stdout + 못.stderr);
  assert.match(못.결과.판.가까움.파일[0].확인[0], /^사람 움직임을 못 쟀다 — 사람 움직임 도구를 못 불렀다\(FileNotFoundError/);
});

test('30fps 판은 장당 값을 fps/24로 고쳐 견준다 — 24fps에서 굳음인 0.1이 30fps에서는 0.125로 지나간다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: { fps: 30 } });
  fs.renameSync(path.join(편, '받음', 'C1.mp4'), path.join(편, '받음', '조금.mp4'));
  fs.mkdirSync(path.join(편, '꾸러미'));
  fs.writeFileSync(path.join(편, '꾸러미', '_순서.json'), JSON.stringify([줄('조금', 1, { 컷: ['C1'] })]), 'utf8');
  const r = 돌리기(편);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.deepEqual([r.결과.판.조금.파일[0].fps, r.결과.판.조금.파일[0].사람.사람, r.결과.판.조금.파일[0].사람.판정], [30, 0.125, '-']);
  assert.deepEqual(부른것(편), [['조금.mp4', 15, 105]], '0.5~4.0초 = 30fps의 15번째 장부터 105장');
});

test('옛 틀 컷표 · 모르는 판은 멈춘다, 소리만 쓰는 판은 재지 않는다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {}, V1: {} }, { 순서: [줄('C1', 1), 줄('V1', 2, { 소리만: true })] });
  const r = 돌리기(편);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.deepEqual(Object.keys(r.결과.판), ['C1']);
  assert.match(돌리기(편, ['--판', 'V1']).stderr, /--판의 V1은 꾸러미 · 컷표에 없다/);
  const 옛 = 편만들기(t, { C1: {} }, { 고침: (seq) => { delete seq.틀; } });
  const r2 = 돌리기(옛);
  assert.equal(r2.코드, 1);
  assert.match(r2.stderr, /컷표 틀 2에서만 돈다/);
});

test('내기 도구가 받은 직후 부르는 길 — 크레딧내기.받은뒤()가 그 판만 재어 표를 찍고, 못 돌려도 내기를 깨뜨리지 않는다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {}, C2: {} }, { 순서: [줄('C1', 1), 줄('C2', 2)] });
  const py = `
import os, sys
sys.path.insert(0, sys.argv[1])
import 크레딧내기, 드리미나내기
assert 드리미나내기.받은뒤 is 크레딧내기.받은뒤
편 = sys.argv[2]
r = 크레딧내기.받은뒤(os.path.join(편, "꾸러미"), os.path.join(편, "받음"), None, ["C1"], 더=["--연속성안함"])
print("끝코드", r)
print("없는컷표", 크레딧내기.받은뒤(os.path.join(편, "받음", "없는", "꾸러미"), os.path.join(편, "받음"), None, ["C1"]))
`;
  const r = spawnSync('python', ['-X', 'utf8', '-c', py, 굽기폴더, 편], { encoding: 'utf8', timeout: 300000,
    env: { ...process.env, SYNK_MOTION_PY: path.join(편, '가짜_사람움직임.py'), SYNK_MOTION_LOG: path.join(편, '부른것.jsonl') } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /받은 뒤 검사 — 편 .* · 이번에 잰 판 1개/);
  assert.match(r.stdout, /✓ C1\.mp4/);
  assert.ok(!/C2\.mp4/.test(r.stdout), '이번에 받은 판만 잰다');
  // 받은 파일은 있는데 한 번도 재지 않은 판(C2)은 조용히 통과로 두지 않는다 — 확인(2)
  assert.match(r.stdout, /받은 파일은 있는데 잰 값이 없는 판 1: C2/);
  assert.match(r.stdout, /끝코드 2/);
  assert.match(r.stdout, /없는컷표 None/, '컷표가 없는 편은 조용히 건너뛴다');
});
// ── 11-14 GPT 검수 뒤 — 굳은 판 · 짧은 판이 「통과」로 나가는 길 넷 ──────────────────────────────────────────
test('같은 컷이 둘째 토막으로 또 나오면 모든 구간으로 잰다 — 뒤 토막을 못 덮으면 걸림, 뒤 토막만 굳어도 걸림', 건너뜀, (t) => {
  const 두토막 = (seq) => { seq.detail.push({ ...seq.detail.find(d => d.cut === 'C1'), t: 20, in: 5, out: 9 }); };
  // 5초 판: 첫 토막(0.5~4.0)은 덮지만 둘째 토막(5~9초)이 모자란다
  const 짧은 = 편만들기(t, { C1: { 초: 5 } }, { 고침: 두토막 });
  const a = 돌리기(짧은, ['--판', 'C1']);
  assert.equal(a.코드, 1, a.stdout + a.stderr);
  assert.match(a.결과.판.C1.파일[0].걸림[0], /^받은 판의 영상이 5\.0초인데 쓰는 구간이 9초까지다/);
  // 10초 판: 두 구간을 따로 잰다 — 뒤 구간(120번째 장부터)만 굳은 판은 걸린다
  const 긴 = 편만들기(t, { C1: { 초: 10 } }, { 고침: 두토막 });
  fs.renameSync(path.join(긴, '받음', 'C1.mp4'), path.join(긴, '받음', '둘째굳음.mp4'));
  fs.mkdirSync(path.join(긴, '꾸러미'));
  fs.writeFileSync(path.join(긴, '꾸러미', '_순서.json'), JSON.stringify([줄('둘째굳음', 1, { 컷: ['C1'] })]), 'utf8');
  const b = 돌리기(긴);
  assert.equal(b.코드, 1, b.stdout + b.stderr);
  assert.deepEqual(부른것(긴), [['둘째굳음.mp4', 12, 84], ['둘째굳음.mp4', 120, 96]], '0.5~4.0초와 5~9초를 따로 잰다');
  const f = b.결과.판.둘째굳음.파일[0];
  assert.deepEqual(f.쓰는구간, [[0.5, 4], [5, 9]]);
  assert.match(f.걸림[0], /^5~9초 구간 — 카메라만 · 사람 굳음/);
  assert.equal(f.사람.사람, 0.02, '판의 값은 가장 굳은 구간의 값이다');
  assert.deepEqual(b.결과.다시낼판, ['둘째굳음']);
});

test('두 컷을 이은 판("컷": ["C1", "C4"])은 두 컷의 구간으로, 컷표에서 「판」으로 가리킨 컷의 구간으로도 잰다', 건너뜀, (t) => {
  // C1 0.5~4.0 · C4 0.5~5.5 — 5초 판은 C4의 5.5초를 못 덮는다
  const 편 = 편만들기(t, { X7: { 초: 5 } }, { 순서: [줄('X7', 1, { 컷: ['C1', 'C4'] })] });
  const r = 돌리기(편);
  assert.equal(r.코드, 1, r.stdout + r.stderr);
  assert.match(r.결과.판.X7.파일[0].걸림[0], /^받은 판의 영상이 5\.0초인데 쓰는 구간이 5\.5초까지다/);
  // C2가 C1의 판을 6~8초로 이어 쓴다 — C1 판이 5초면 모자란다
  const 이어 = 편만들기(t, { C1: { 초: 5 } }, { 고침: (seq) => Object.assign(seq.detail.find(d => d.cut === 'C2'), { 판: 'C1', 같은판: '한 방을 둘로 자른 컷', in: 6, out: 8 }) });
  const r2 = 돌리기(이어, ['--판', 'C1']);
  assert.equal(r2.코드, 1, r2.stdout + r2.stderr);
  assert.match(r2.결과.판.C1.파일[0].걸림[0], /^받은 판의 영상이 5\.0초인데 쓰는 구간이 8초까지다/);
});

test('어느 컷의 판인지 모르는 판(이름 오타 · 컷표에 없는 "컷") · in · out이 없는 컷의 판은 통과도 쓸 판도 아니다 — 확인', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1x: {}, C2b: {}, C3: {} }, { 순서: [줄('C1x', 1), 줄('C2b', 2, { 컷: ['C9'] }), 줄('C3', 3)],
    고침: (seq) => { delete seq.detail.find(d => d.cut === 'C3').out; } });
  const r = 돌리기(편);
  assert.equal(r.코드, 2, r.stdout + r.stderr);
  assert.match(r.결과.판.C1x.파일[0].확인[0], /^어느 컷의 판인지 모른다/);
  assert.match(r.결과.판.C2b.파일[0].확인.join('\n'), /어느 컷의 판인지 모른다[\s\S]*꾸러미가 이 판을 C9에 이었는데 컷표에 그 컷이 없다/);
  assert.match(r.결과.판.C3.파일[0].확인[0], /^컷표 C3의 in · out을 읽지 못해/);
  assert.deepEqual(r.결과.쓸판, {}, '못 잰 판을 쓸 판으로 뽑지 않는다');
  assert.deepEqual(r.결과.못잰판, ['C1x', 'C2b', 'C3']);
  assert.deepEqual(부른것(편), [], '구간을 모르는 판은 사람도 재지 않는다');
});

test('일부만 잰 회차(--판)도 끝 코드 · 다시 낼 판 · 걸림 수가 편 전체와 맞는다 — 앞 기록은 파일 · 구간이 그대로일 때만 쓴다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { 굳음: {}, C2: {} }, { 순서: [줄('굳음', 1, { 컷: ['C1'] }), 줄('C2', 2)] });
  const 전체 = 돌리기(편);
  assert.equal(전체.코드, 1);
  assert.deepEqual([전체.결과.다시낼판, 전체.결과.쓸판, 전체.결과.걸림수], [['굳음'], { C2: 'C2.mp4' }, 1]);
  // C2만 다시 잰 회차 — 굳음 판의 걸림이 그대로 남아 끝 코드 1 · 걸림 수 1
  const 일부 = 돌리기(편, ['--판', 'C2']);
  assert.equal(일부.코드, 1, '앞 회차의 다시 낼 판이 남았는데 통과로 끝났다');
  assert.deepEqual([일부.결과.다시낼판, 일부.결과.걸림수, 일부.결과.끝코드, 일부.결과.이번에잰판], [['굳음'], 1, 1, ['C2']]);
  const 글 = spawnSync('python', ['-X', 'utf8', 도구, 편, '--연속성안함', '--판', 'C2'], { encoding: 'utf8',
    env: { ...process.env, SYNK_MOTION_PY: path.join(편, '가짜_사람움직임.py'), SYNK_MOTION_LOG: path.join(편, '부른것.jsonl') } });
  assert.equal(글.status, 1);
  assert.match(글.stdout, /앞 회차 기록 그대로 1개/);
  assert.match(글.stdout, /다시 낼 판 1: 굳음\(앞 회차에서 남은 것: 굳음\)/);
  // 굳음 판의 파일이 바뀌었는데(다시 받음) 재지 않았으면 앞 기록을 쓰지 않는다 — 안 잰 판(확인)
  영상(path.join(편, '받음', '굳음.mp4'), { 초: 6 });
  const 바뀜 = 돌리기(편, ['--판', 'C2']);
  assert.equal(바뀜.코드, 2);
  assert.deepEqual([바뀜.결과.안잰판, 바뀜.결과.다시낼판, Object.keys(바뀜.결과.판)], [['굳음'], [], ['C2']]);
  // 쓰는 구간이 바뀌어도 앞 기록을 쓰지 않는다
  돌리기(편);
  const 표 = path.join(편, '컷표.json');
  const seq = JSON.parse(fs.readFileSync(표, 'utf8'));
  seq.detail.find(d => d.cut === 'C1').out = 4.5;
  fs.writeFileSync(표, JSON.stringify(seq), 'utf8');
  assert.deepEqual(돌리기(편, ['--판', 'C2']).결과.안잰판, ['굳음']);
  // 깨진 앞 기록 · 꼴이 다른 앞 기록은 버린다
  fs.writeFileSync(path.join(편, '받음', '_받은뒤검사.json'), JSON.stringify({ 판: { 굳음: { 파일: [{ 파일: '굳음.mp4' }] } } }), 'utf8');
  assert.deepEqual(돌리기(편, ['--판', 'C2']).결과.안잰판, ['굳음']);
});

test('길이는 영상 줄기로 잰다 — 소리 줄기만 길어 파일 길이가 5초인 2초 영상은 걸린다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C2: { 초: 2, 소리: true, 소리초: 5 } }, { 순서: [줄('C2', 1, { 소리: '켬' })] });
  const r = 돌리기(편);
  assert.equal(r.코드, 1, r.stdout + r.stderr);
  const f = r.결과.판.C2.파일[0];
  assert.ok(f.파일초 >= 4.9, `시험 영상의 파일 길이가 ${f.파일초}초다(소리 줄기가 5초여야 한다)`);
  assert.deepEqual([f.초, f.길이출처], [2, '영상 줄기']);
  assert.match(f.걸림[0], /^받은 판의 영상이 2\.0초인데 쓰는 구간이 3\.5초까지다/);
  assert.deepEqual(부른것(편), [], '모자란 판은 사람을 재지 않는다');
});
// ── 11-14 카본 재검수 뒤 ────────────────────────────────────────────────────────────────────────────
test('컷표 「판」에 다시 낸 파일 이름(C1__2)이 적혀도 그 구간으로 잰다 — 쓸 파일이 바뀌면 그 판을 가리킨 컷 모두에 고쳐 적으라고 알린다', 건너뜀, (t) => {
  // C2가 C1의 판을 6~8초로 이어 쓴다. 첫 판 C1.mp4는 3초(모자람), 다시 낸 C1__2.mp4는 10초
  const 이어 = (판값) => (seq) => Object.assign(seq.detail.find(d => d.cut === 'C2'), { 판: 판값, 같은판: '한 방을 둘로 자른 컷', in: 6, out: 8 });
  const 편 = 편만들기(t, { C1: { 초: 3 }, 'C1__2': { 초: 10 } }, { 고침: 이어('C1') });
  const r = 돌리기(편, ['--판', 'C1']);
  assert.equal(r.코드, 0, r.stdout + r.stderr);
  assert.deepEqual(r.결과.쓸판, { C1: 'C1__2.mp4' });
  assert.deepEqual(r.결과.이을것, ['C1: 쓸 판이 C1__2이면 컷표 그 컷에 "판": "C1__2"을 적는다', 'C2: 쓸 판이 C1__2이면 컷표 그 컷에 "판": "C1__2"을 적는다']);
  // 안내대로 두 컷에 "판": "C1__2"를 적은 뒤에도 C1 판은 6~8초 구간으로 잰다 — 5초짜리 다시 낸 판은 걸린다
  const 적은 = 편만들기(t, { C1: { 초: 3 }, 'C1__2': { 초: 5 } },
    { 고침: (seq) => { 이어('C1__2')(seq); seq.detail.find(d => d.cut === 'C1').판 = 'C1__2'; } });
  const r2 = 돌리기(적은, ['--판', 'C1']);
  assert.equal(r2.코드, 1, '「판」에 다시 낸 파일 이름을 적자 6~8초 구간이 빠져 짧은 판이 통과했다');
  const f = r2.결과.판.C1.파일.find(x => x.파일 === 'C1__2.mp4');
  assert.deepEqual(f.쓰는구간, [[0.5, 4], [6, 8]]);
  assert.match(f.걸림[0], /^받은 판의 영상이 5\.0초인데 쓰는 구간이 8초까지다/);
  // 다 적은 뒤 10초 판이면 통과하고 더 적을 것이 없다
  const 맞는 = 편만들기(t, { C1: { 초: 3 }, 'C1__2': { 초: 10 } },
    { 고침: (seq) => { 이어('C1__2')(seq); seq.detail.find(d => d.cut === 'C1').판 = 'C1__2'; } });
  const r3 = 돌리기(맞는, ['--판', 'C1']);
  assert.deepEqual([r3.코드, r3.결과.쓸판, r3.결과.이을것], [0, { C1: 'C1__2.mp4' }, []]);
});

test('대안 판을 이미 골라 적은 컷에는 원래 판으로 되돌리라고 권하지 않는다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C2: {}, C2b: {} }, { 순서: [줄('C2', 1), 줄('C2b', 2, { 컷: ['C2'] })], 고침: (seq) => { seq.detail.find(d => d.cut === 'C2').판 = 'C2b'; } });
  const r = 돌리기(편);
  assert.deepEqual([r.결과.쓸판, r.결과.이을것], [{ C2: 'C2.mp4', C2b: 'C2b.mp4' }, []]);
});

test('"컷"의 일부만 컷표에 없는 판("컷": ["C1", "C9"])도 못 잰 판이다 — 쓸 판으로 뽑지 않는다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { X7: {} }, { 순서: [줄('X7', 1, { 컷: ['C1', 'C9'] })] });
  const r = 돌리기(편);
  assert.equal(r.코드, 2, r.stdout + r.stderr);
  assert.deepEqual([r.결과.쓸판, r.결과.못잰판], [{}, ['X7']]);
  assert.match(r.결과.판.X7.파일[0].확인.join('\n'), /꾸러미가 이 판을 C9에 이었는데 컷표에 그 컷이 없다/);
});

test('잰 판이 하나도 없는 회차도 앞 기록을 고쳐 쓴다 — 무효가 된 옛 통과 기록(쓸판 · 끝코드 0)을 남기지 않는다', 건너뜀, (t) => {
  const 편 = 편만들기(t, { C1: {} });
  assert.equal(돌리기(편, ['--판', 'C1']).코드, 0);
  const 기록 = () => JSON.parse(fs.readFileSync(path.join(편, '받음', '_받은뒤검사.json'), 'utf8'));
  assert.deepEqual([기록().쓸판, 기록().끝코드], [{ C1: 'C1.mp4' }, 0]);
  영상(path.join(편, '받음', 'C1.mp4'), { 초: 6 });   // 다시 받아 파일이 바뀌었다
  const r = spawnSync('python', ['-X', 'utf8', 도구, 편, '--연속성안함', '--판', 'C2'], { encoding: 'utf8',
    env: { ...process.env, SYNK_MOTION_PY: path.join(편, '가짜_사람움직임.py'), SYNK_MOTION_LOG: path.join(편, '부른것.jsonl') } });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /받은 파일은 있는데 잰 값이 없는 판 1: C1/);
  assert.ok(!/받은 판이 없다/.test(r.stdout), '안 잰 판을 알린 바로 뒤에 「받은 판이 없다」고 찍었다');
  assert.deepEqual([기록().쓸판, 기록().안잰판, 기록().끝코드, 기록().아직없는판], [{}, ['C1'], 2, ['C2', 'C3', 'C4']]);
});
// ── 11-14 GPT 다시 검수 뒤 — 꾸러미 목록의 잘못된 줄을 조용히 버리지 않는다 ─────────────────────────────────
test('꾸러미 _순서.json의 id 없는 줄 · 겹친 id · 꾸러미에 없는데 컷 이름을 한 영상은 확인이다 — 아무것도 재지 않고 통과로 끝나지 않는다', 건너뜀, (t) => {
  // 유일한 줄에 id가 없다 → 판이 하나도 없어 예전에는 끝 코드 0이었다
  const 편 = 편만들기(t, { C1: {} }, { 순서: [{ 컷: ['C1'], 소리: '끔' }] });
  const r = 돌리기(편);
  assert.equal(r.코드, 2, r.stdout + r.stderr);
  assert.match(r.결과.꾸러미탈.join('\n'), /_순서\.json 1번째 줄에 판 id가 없다/);
  assert.deepEqual([r.결과.남는파일, r.결과.쓸판], [['C1.mp4'], {}]);
  const 글 = spawnSync('python', ['-X', 'utf8', 도구, 편, '--연속성안함'], { encoding: 'utf8',
    env: { ...process.env, SYNK_MOTION_PY: path.join(편, '가짜_사람움직임.py'), SYNK_MOTION_LOG: path.join(편, '부른것.jsonl') } });
  assert.equal(글.status, 2);
  assert.match(글.stdout, /어느 판에도 안 맞는 영상 1개는 재지 않았다: C1\.mp4/);
  assert.ok(!/받은 판이 없다|걸림 없음/.test(글.stdout), 글.stdout);
  // 같은 id가 두 번 — 뒤 줄(소리 켬)을 버린 것을 알린다
  const 겹침 = 편만들기(t, { C1: {} }, { 순서: [줄('C1', 1), 줄('C1', 2, { 소리: '켬' })] });
  const r2 = 돌리기(겹침);
  assert.equal(r2.코드, 2, r2.stdout + r2.stderr);
  assert.match(r2.결과.꾸러미탈.join('\n'), /판 id 「C1」가 두 번 나온다\(2번째 줄\)/);
  // 꾸러미가 비었는데(판 0개) 컷 이름을 한 다시 낸 파일이 있다
  const 빈 = 편만들기(t, { 'C2__2': {} }, { 순서: [] });
  const r3 = 돌리기(빈);
  assert.deepEqual([r3.코드, r3.결과.남는파일], [2, ['C2__2.mp4']]);
  // 컷 이름이 아닌 남는 파일(시험 판 · 옛 판)도 재지 않은 영상이다 — 통과(0)는 받음의 영상을 모두 쟀다는 뜻이다
  const 남는 = 편만들기(t, { C1: {}, 옛판: {} }, { 순서: [줄('C1', 1)] });
  const r4 = 돌리기(남는);
  assert.deepEqual([r4.코드, r4.결과.남는파일, r4.결과.쓸판], [2, ['옛판.mp4'], { C1: 'C1.mp4' }]);
  // 「인물」 칸이 목록이 아니게 깨진 줄은 사람이 있는 것으로 보고 잰다(사람 검사를 건너뛰지 않는다)
  const 깨진 = 편만들기(t, { C4: { 초: 6 } }, { 고침: (seq) => { seq.detail.find(d => d.cut === 'C4').인물 = '수아'; } });
  돌리기(깨진, ['--판', 'C4']);
  assert.deepEqual(부른것(깨진), [['C4.mp4', 12, 120]], 'C4 0.5~5.5초를 쟀다');
});

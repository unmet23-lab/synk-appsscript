'use strict';
// 최종본 검사(tools/최종본검사.py) — 만든 영상 하나로 컷 · 같은 판 잘라 키움 · 끝 소리를 실제로 잰다.
// 0~2초 시험 그림, 2~4초 같은 그림을 1.4배로 잘라 키움(같은 판 — 점검표 50), 4~6초 다른 그림. 소리 줄기는 3초에서 끝난다 —
// 영상보다 짧은 소리도 끝이 조용한 것으로 잰다(11-13 Fable 검수 5). 사람 움직임 모듈을 못 찾으면 그 항목만 「못잼」으로 내고 나머지는 낸다(검수 2).
// 사람 굳음 값 자체는 얼굴 모델 · rembg가 드는 무거운 잼이라 여기서는 재지 않는다 — B39 v10 실측(굳음 세 자리 4.42 · 21.42 · 54.42)은 도구 머리말에 적었다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const tool = path.join(__dirname, '..', 'tools', '최종본검사.py');
const py = process.env.SYNK_PYTHON || 'python';
// CI의 문법 검사 작업에는 ffmpeg · OpenCV가 없다 — 그때는 건너뛴다(tests/컷연속성검사.test.js와 같은 꼴)
const 그림라이브러리 = spawnSync(py, ['-I', '-X', 'utf8', '-c', 'import numpy, cv2'], { encoding: 'utf8' }).status === 0;
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0 && spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0;
const 없음 = !(그림라이브러리 && ffmpeg) && `${그림라이브러리 ? '' : 'numpy · cv2 '}${ffmpeg ? '' : 'ffmpeg '}없음`;
const lastJson = (out) => JSON.parse(out.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop());

function synthetic(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종본검사-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const video = path.join(dir, 'syn.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=24:d=4', '-f', 'lavfi', '-i', 'cellauto=s=540x960:r=24:rule=110', '-f', 'lavfi', '-i', 'sine=f=440:d=3:sample_rate=48000',
    '-filter_complex', '[0:v]split[a][b];[a]trim=0:2,setpts=PTS-STARTPTS[v1];[b]trim=2:4,setpts=PTS-STARTPTS,crop=iw/1.4:ih/1.4,scale=540:960,setsar=1[v2];'
      + '[1:v]trim=0:2,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[v3];[v1][v2][v3]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
  return video;
}

test('같은 그림을 잘라 키운 이음은 「같은판」, 다른 그림 이음은 걸지 않고, 소리가 먼저 끝나 끝이 조용하면 「끝소리」', { skip: 없음 }, (t) => {
  const video = synthetic(t);
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '같은판,되풀이,끝', '--json'], { encoding: 'utf8', timeout: 300000 });
  assert.equal(r.status, 1, r.stderr);
  const j = lastJson(r.stdout);
  assert.deepEqual(j.컷, [2, 4]);
  assert.equal(j.fps, 24);
  const same = j.걸림.filter((h) => h.항목 === '같은판');
  assert.deepEqual(same.map((h) => h.초), [2], '4초(다른 그림)는 걸지 않는다');
  assert.ok(Math.abs(same[0].값.배율 - 1.4) < 0.05, `배율 ${same[0].값.배율}`);
  assert.ok(!j.걸림.some((h) => h.항목 === '되풀이'));
  const end = j.걸림.find((h) => h.항목 === '끝소리');
  assert.ok(end && end.값.끝조용초 >= 2.5, `소리 3초 · 영상 6초 — ${JSON.stringify(end)}`);
  assert.equal(j.못잼, undefined);
});

test('사람 움직임 모듈을 못 찾으면 굳음만 「못잼」, 앞서 잰 같은판은 그대로 낸다', { skip: 없음 }, (t) => {
  const video = synthetic(t);
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '같은판,굳음', '--json'],
    { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_MOTION_PY: path.join(os.tmpdir(), '없는_사람움직임.py') } });
  assert.equal(r.status, 1, r.stderr);
  const j = lastJson(r.stdout);
  assert.deepEqual(j.걸림.map((h) => h.항목), ['같은판']);
  assert.deepEqual(j.못잼.map((m) => m.항목), ['굳음']);
});

// 조용구간(11-15 흠 장부 3단계): 24초 시험 그림에 사인파 — 큰 소리 사이 가운데 몇 초를 20dB 낮춘다. 무료체험(12.75초)처럼 11초면 걸리고,
// 통과한 영상통화연인(8.0초)처럼 8초면 지나간다. 조용구간만 걸리면 끝 코드는 0(끝 코드를 바꾸지 않는 걸림), 검사이력 줄에는 등급 「확인」.
function quietClip(t, quiet, { audio = 24 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종본검사-조용-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const video = path.join(dir, `quiet${quiet}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x568:r=24:d=24',
    '-f', 'lavfi', '-i', `aevalsrc=exprs='0.5*sin(2*PI*440*t)*if(between(t,5,${5 + quiet}),0.1,1)':s=48000:d=${audio}`,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
  return { dir, video };
}

test('조용구간 — 가운데 11초가 큰 소리보다 20dB 작으면 걸리고(끝 코드 0 · 이력 등급 확인), 8초면 지나간다', { skip: 없음 }, (t) => {
  const { dir, video } = quietClip(t, 11);
  // 편 폴더처럼 꾸며 검사이력 줄을 본다(임시 폴더 — 실제 편에는 줄을 남기지 않는다)
  fs.mkdirSync(path.join(dir, '게시'));
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), '{"브랜드":"synkbrief"}');
  const env = { ...process.env, SYNK_검사편: dir, SYNK_검사이력: '' };
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '조용,끝', '--json'], { encoding: 'utf8', timeout: 300000, env });
  assert.equal(r.status, 0, `조용구간만 걸리면 끝 코드 0 — ${r.stderr}`);
  const j = lastJson(r.stdout);
  const q = j.걸림.filter((h) => h.항목 === '조용구간');
  assert.equal(q.length, 1, JSON.stringify(j.걸림));
  assert.ok(Math.abs(q[0].초 - 5) <= 0.75 && Math.abs(q[0].끝초 - 16) <= 0.75, `자리 ${q[0].초}~${q[0].끝초}`);
  assert.ok(q[0].값.길이초 >= 10 && q[0].값.기준dB > q[0].값.평균dB + 15, JSON.stringify(q[0].값));
  assert.deepEqual(j.걸림.map((h) => h.항목), ['조용구간'], '끝소리는 걸리지 않는다(끝은 큰 소리)');
  assert.ok(j.알림.some((n) => n.항목 === '조용구간' && n.최장초 === q[0].값.길이초));
  const 줄 = fs.readFileSync(path.join(dir, '게시', '검사이력.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l)).pop();
  assert.deepEqual([줄.눈, 줄.결과, 줄.끝코드, 줄.걸림.map((g) => [g.규칙, g.등급])], ['최종본검사', '확인', 0, [['조용구간', '확인']]]);
  // 8초 — 통과한 편의 가장 긴 조용함과 같은 길이는 지나간다
  const pass = quietClip(t, 8);
  const p = spawnSync(py, ['-I', '-X', 'utf8', tool, pass.video, '--항목', '조용', '--json'], { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_검사이력: '끔' } });
  assert.equal(p.status, 0, p.stderr);
  const pj = lastJson(p.stdout);
  assert.deepEqual(pj.걸림, []);
  const note = pj.알림.find((n) => n.항목 === '조용구간');
  assert.ok(note && note.최장초 >= 7 && note.최장초 < 10, JSON.stringify(note));
});

test('조용구간과 다른 걸림이 함께면 끝 코드는 그대로 1 · 몸통이 10초보다 짧은 영상은 조용구간을 재지 않는다', { skip: 없음 }, (t) => {
  // 소리가 20초에 끝나는 24초 영상 — 끝 4초가 조용해 끝소리가 걸리고, 가운데 11초도 조용하다
  const { video } = quietClip(t, 11, { audio: 20 });
  const env = { ...process.env, SYNK_검사이력: '끔' };
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '끝,조용', '--json'], { encoding: 'utf8', timeout: 300000, env });
  assert.equal(r.status, 1, r.stderr);
  assert.deepEqual(lastJson(r.stdout).걸림.map((h) => h.항목), ['끝소리', '조용구간']);
  const short = synthetic(t);   // 6초 영상
  const s = spawnSync(py, ['-I', '-X', 'utf8', tool, short, '--항목', '끝,조용', '--json'], { encoding: 'utf8', timeout: 300000, env });
  assert.equal(s.status, 1, s.stderr);
  const sj = lastJson(s.stdout);
  assert.deepEqual(sj.걸림.map((h) => h.항목), ['끝소리']);
  assert.ok(!sj.알림.some((n) => n.항목 === '조용구간'), '짧은 영상은 조용구간 알림도 없다');
});

// ── 흐름(11-16 — 컷 안 탈것 · 배경 움직임, 영상 마감 관문이 「--항목 흐름」으로 부른다) ──
// 합성 영상(tests/_흐름합성.js): 고정된 무늬 바탕(640×360, 24fps) 위에 무늬 네모(차) · 무늬 원판(바퀴)을 움직인다. 셋 다 끝 코드를 바꾸지 않는 「확인」이다.
// 실제 편 대조(서울로 「다리가 기억하는 것」, 화면 너비 1000 기준 px/s):
//   ① 흐름갈림  11-14 판 C08 55.3~57.7초 가운데 띠 왼쪽 −8.0 · 오른쪽 +3.2 → 걸림. 고친 지금 판(11-15 라n 뒤)은 지나간다.
//   ② 멈췄다감  11-14 판 E03k 147.8~151.7초 위 띠 오른쪽 금빛 버스 — 가다가 약 1초 섰다가 다시 감 → 걸림.
//   ③ 제자리바퀴 라f 판(11-14 23:56) Q06 16.6~18.1초 파란 버스 바퀴 — 나머지 칸 흐름 90번째 값 0.2 → 걸림.
//              11-14 노란 택시 판 Q06은 배경이 초당 240px 넘게 흘러 지나간다(그 판의 「1픽셀」은 카메라가 따라가는 택시 몸통을 잰 값이었다).
//   11-14 판 53컷(컷표 경계를 --컷초로 더함)에서 걸린 것은 C08 · E03k와 S06k 셋이다. S06k는 사진 찍는 아이가 0.9초 굳었다가 다시 움직이는 자리로,
//   11-15 카본이 「굳음」으로 짚어 맞음 판정을 받았다. 그래서 나머지 50컷의 헛걸림은 0이다. 고친 지금 판(55덩이)에서는 S06k 하나만 걸린다.
//   라h(C08 · 바퀴 고침)는 E03k · S06k, 라m(E03k b판)도 E03k · S06k다 — 고친 흠은 그 판부터 빠지고 헛걸림은 다섯 판 모두 0이다.
//   문턱을 정하며 걸러 낸 헛걸림: 한 방향 몫 0.8이면 R03 와이퍼(0.82)가 ①에 걸려 0.85로 올렸다. 「감」을 한 창만 봐도 되면 차가 화면 밖으로
//   나간 Y15w가 ②에 걸려 두 창 잇달아로 바꿨다. 컷표 경계 없이 장 차이로만 컷을 나누면 천 닦기 전환 다섯 곳이 붙어 Q02+Y70이 ①에 걸린다.
//   카메라 위로 지나가는 버스(라f Q04, 세로 / 가로 1.4~1.8)는 「옆으로 감」 조건으로 ①에서 뺐다. ②의 멈춤을 「속도 15% 아래」로 두면 몸을 앞뒤로
//   흔드는 S04y와 느려진 실(지금 판 E04m)이 걸려 「크기 1.5px/s 아래」로 바꿨다. 퍼짐 조건을 ②에서 빼면 다가오는 버스(지금 판 Q04)가 걸리고,
//   바닥 없이 쓰면 퍼짐이 0.3%뿐인 라f E03k가 빠져, 두 퍼짐이 모두 1% 넘을 때만 ②를 뺀다.
const { 흐름영상 } = require('./_흐름합성.js');   // 받은 뒤 검사 시험과 함께 쓴다
const flowClip = (t, kind) => 흐름영상(t, kind, { py });
function flow(video) {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '흐름', '--json'],
    { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_검사이력: '끔' } });
  assert.equal(r.status, 0, `흐름 걸림은 끝 코드를 바꾸지 않는다 — ${r.stderr}`);
  const j = lastJson(r.stdout);
  assert.equal(j.못잼, undefined, JSON.stringify(j.못잼));
  return j;
}
const 흐름이름 = new Set(['흐름갈림', '멈췄다감', '제자리바퀴']);
const 흐름걸림 = (j) => j.걸림.filter((h) => 흐름이름.has(h.항목));

test('흐름 ① 같은 띠의 두 차가 반대로 가면 「흐름갈림」, 같은 방향이면 지나간다', { skip: 없음 }, (t) => {
  const j = flow(flowClip(t, '갈림'));
  const hit = 흐름걸림(j);
  assert.deepEqual(hit.map((h) => h.항목), ['흐름갈림'], JSON.stringify(hit));
  assert.equal(hit[0].값.띠, '가운데');
  assert.ok(hit[0].값.왼 < -2.5 && hit[0].값.오른 > 2.5, JSON.stringify(hit[0].값));
  assert.ok(j.알림.some((n) => n.항목 === '흐름' && n.칸.가운데왼 < 0 && n.칸.가운데오 > 0), JSON.stringify(j.알림));
  assert.deepEqual(흐름걸림(flow(flowClip(t, '같은방향'))), []);
});

test('흐름 ② 가다가 1.2초 섰다가 다시 가면 「멈췄다감」, 고르게 가거나 서 있다가 처음 출발하면 지나간다', { skip: 없음 }, (t) => {
  const hit = 흐름걸림(flow(flowClip(t, '멈춤')));
  assert.deepEqual(hit.map((h) => h.항목), ['멈췄다감'], JSON.stringify(hit));
  assert.equal(hit[0].값.칸, '위왼');
  assert.ok(hit[0].초 >= 1.0 && hit[0].초 <= 1.7 && hit[0].끝초 >= 2.2 && hit[0].끝초 <= 2.9, `멈춘 자리 ${hit[0].초}~${hit[0].끝초}(실제 1.3~2.5)`);
  assert.deepEqual(흐름걸림(flow(flowClip(t, '고른'))), []);
  assert.deepEqual(흐름걸림(flow(flowClip(t, '출발'))), []);
});

test('흐름 ③ 바퀴만 돌고 배경이 안 흐르면 「제자리바퀴」, 배경이 흐르면 지나간다', { skip: 없음 }, (t) => {
  const hit = 흐름걸림(flow(flowClip(t, '바퀴')));
  assert.deepEqual(hit.map((h) => h.항목), ['제자리바퀴'], JSON.stringify(hit));
  assert.ok(hit[0].값.바탕90 < 10, JSON.stringify(hit[0].값));
  assert.deepEqual(흐름걸림(flow(flowClip(t, '바퀴흐름'))), []);
});

test('흐름은 기본 항목이 아니다 — 올리기 전 검사 ⑳이 부르는 기본 항목에는 들지 않는다', () => {
  const src = fs.readFileSync(tool, 'utf8');
  const m = src.match(/^DEFAULT_ITEMS = "([^"]+)"/m);
  assert.ok(m, 'DEFAULT_ITEMS 줄');
  assert.deepEqual(m[1].split(','), ['굳음', '같은판', '되풀이', '끝', '화소', '조용']);
  for (const k of 흐름이름) assert.ok(new RegExp(`SOFT = \\{[^}]*"${k}"`).test(src), `${k}는 끝 코드를 바꾸지 않는다(SOFT)`);
  const gate = fs.readFileSync(path.join(__dirname, '..', 'tools', '영상관문판.py'), 'utf8');
  assert.ok(/최종본항목 = "[^"]*흐름/.test(gate), '마감 관문 판이 흐름을 붙여 부른다');
});

test('없는 파일은 끝 코드 2와 오류 한 줄', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, path.join(os.tmpdir(), '없는영상.mp4'), '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr || r.error?.message);
  assert.ok(JSON.parse(r.stdout).오류);
});

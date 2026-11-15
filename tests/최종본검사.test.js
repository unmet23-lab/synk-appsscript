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

test('없는 파일은 끝 코드 2와 오류 한 줄', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, path.join(os.tmpdir(), '없는영상.mp4'), '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr || r.error?.message);
  assert.ok(JSON.parse(r.stdout).오류);
});

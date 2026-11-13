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

test('같은 그림을 잘라 키운 이음은 「같은판」, 다른 그림 이음은 걸지 않고, 소리가 먼저 끝나 끝이 조용하면 「끝소리」', (t) => {
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

test('사람 움직임 모듈을 못 찾으면 굳음만 「못잼」, 앞서 잰 같은판은 그대로 낸다', (t) => {
  const video = synthetic(t);
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '같은판,굳음', '--json'],
    { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_MOTION_PY: path.join(os.tmpdir(), '없는_사람움직임.py') } });
  assert.equal(r.status, 1, r.stderr);
  const j = lastJson(r.stdout);
  assert.deepEqual(j.걸림.map((h) => h.항목), ['같은판']);
  assert.deepEqual(j.못잼.map((m) => m.항목), ['굳음']);
});

test('없는 파일은 끝 코드 2와 오류 한 줄', () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, path.join(os.tmpdir(), '없는영상.mp4'), '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr || r.error?.message);
  assert.ok(JSON.parse(r.stdout).오류);
});

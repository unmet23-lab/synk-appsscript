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

// ── 화면멈춤(11-16 흠 장부 「멈춘 화면」) — 화면 전체가 2초 넘게 그대로인 자리. 끝 코드를 바꾸지 않는 「확인」이다 ──
// 실측 고정 자료(tests/fixtures/화면멈춤_실측.json): 공용 작업본 최종본에서 잰 이웃 장 차이. 한도인수인계(최종 확인 「멈춘화면」)는 걸리고,
// 최종 확인을 통과했거나 멈춘 화면으로 안 걸린 편과 만족 사례는 지나간다. 문턱을 0.05 · 0.12로 바꿔도 판정이 같다.
test('화면멈춤 실측 — 한도인수인계 5.29~7.42초만 걸리고, 통과한 편 · 만족 사례는 지나간다(문턱 0.05~0.12에서 같음)', { skip: 그림라이브러리 ? false : 'numpy · cv2 없음' }, () => {
  const fixture = path.join(__dirname, 'fixtures', '화면멈춤_실측.json');
  const code = [
    'import importlib.util, json, sys',
    'spec = importlib.util.spec_from_file_location("최종본검사", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'd = json.load(open(sys.argv[2], encoding="utf-8"))["영상"]',
    'print(json.dumps({th: {k: [r for r in m.frozen_runs(v["dd"], 24.0, float(th)) if not r[2]][:1] for k, v in d.items()} for th in ("0.05", "0.08", "0.12")}, ensure_ascii=False))',
  ].join('\n');
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', code, tool, fixture], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  const 판정 = JSON.parse(fs.readFileSync(fixture, 'utf8')).영상;
  for (const [th, rows] of Object.entries(got)) {
    for (const [name, [first]] of Object.entries(rows)) {
      const longest = first ? first[1] - first[0] : 0;
      if (판정[name].판정 === '걸림') {
        assert.ok(longest > 2.0 && Math.abs(first[0] - 5.29) < 0.1 && Math.abs(first[1] - 7.42) < 0.1, `${th} ${name}: ${JSON.stringify(first)}`);
      } else {
        assert.ok(longest <= 1.5, `${th} ${name}: 가장 긴 멈춤 ${longest.toFixed(2)}초 — 지나가야 한다`);
      }
    }
  }
});

function frozenClip(t) {
  // 24fps 12초: 움직임 3초 → 같은 장 2.5초(걸림) → 움직임 2.5초 → 같은 장 1.5초(지나감) → 움직임 1초 → 끝 화면 같은 장 1.5초(끝이라 뺌)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종본검사-멈춤-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const video = path.join(dir, 'frozen.mp4');
  const seg = (k, a, b) => `[s${k}]trim=${a}:${b},setpts=PTS-STARTPTS[m${k}]`;
  const hold = (k, at, n) => `[h${k}]trim=start_frame=${at}:end_frame=${at + 1},setpts=PTS-STARTPTS,loop=loop=${n - 1}:size=1:start=0,setpts=N/24/TB[f${k}]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x568:r=24:d=12',
    '-filter_complex', ['[0:v]split=6[s1][h1][s2][h2][s3][h3]',
      seg(1, 0, 3), hold(1, 72, 60), seg(2, 3, 5.5), hold(2, 132, 36), seg(3, 5.5, 6.5), hold(3, 156, 36),
      '[m1][f1][m2][f2][m3][f3]concat=n=6:v=1:a=0,format=yuv420p[v]'].join(';'),
    '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '24', video]);
  return { dir, video };
}

test('화면멈춤 — 가운데 2.5초 같은 장은 걸리고(끝 코드 0 · 이력 등급 확인), 1.5초 · 끝 화면은 지나간다', { skip: 없음 }, (t) => {
  const { dir, video } = frozenClip(t);
  fs.mkdirSync(path.join(dir, '게시'));
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), '{"브랜드":"yuhobuilds"}');
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '멈춤', '--json'], { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_검사편: dir, SYNK_검사이력: '' } });
  assert.equal(r.status, 0, `화면멈춤만 걸리면 끝 코드 0 — ${r.stderr}`);
  const j = lastJson(r.stdout);
  assert.deepEqual(j.걸림.map((h) => h.항목), ['화면멈춤'], JSON.stringify(j.걸림));
  const h = j.걸림[0];
  assert.ok(Math.abs(h.초 - 3) <= 0.1 && Math.abs(h.끝초 - 5.5) <= 0.1 && h.값.길이초 > 2, `자리 ${h.초}~${h.끝초}`);
  assert.ok(j.알림.some((n) => n.항목 === '화면멈춤' && n.최장초 === h.값.길이초));
  const 줄 = fs.readFileSync(path.join(dir, '게시', '검사이력.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l)).pop();
  assert.deepEqual([줄.결과, 줄.끝코드, 줄.걸림.map((g) => [g.규칙, g.등급])], ['확인', 0, [['화면멈춤', '확인']]]);
  // 기본 항목에 들고, 「멈춤」을 빼면 재지 않는다
  assert.match(fs.readFileSync(tool, 'utf8'), /DEFAULT_ITEMS = "[^"]*멈춤/);
  const off = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '끝', '--json'], { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_검사이력: '끔' } });
  assert.ok(!lastJson(off.stdout).걸림.some((x) => x.항목 === '화면멈춤'));
});

// ── 말(11-16 흠 장부 「소리」) — silero VAD 말 시각으로 말 없는 자리 표 · 마지막 말 뒤 꼬리를 「알림」에 낸다. 걸림은 내지 않는다 ──
// 실측 고정 자료(tests/fixtures/말시각_실측.json): 공용 작업본 최종본 아홉 편의 VAD 말 확률(32ms)과 0.25초 칸 dB.
// 정답이 있는 편(yuhobuilds Remotion VO 놓은 자리)에서 말 없는 자리와 마지막 말 끝이 0.15초 안에 맞는다. 그리고 최종 확인이 짚은 자리보다
// 통과한 편의 자리가 더 길거나 깊어(길이 · 크기 · 꼬리 모두) 걸림 문턱을 두지 않았다는 것을 숫자로 묶어 둔다.
const 말자료 = () => {
  const fixture = path.join(__dirname, 'fixtures', '말시각_실측.json');
  const code = [
    'import importlib.util, json, sys',
    'spec = importlib.util.spec_from_file_location("최종본검사", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'd = json.load(open(sys.argv[2], encoding="utf-8"))["영상"]',
    'print(json.dumps({k: m.speech_table(m.speech_runs(v["probs"]), v["db"], v["길이"]) for k, v in d.items()}, ensure_ascii=False))',
  ].join('\n');
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', code, tool, fixture], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
};
const 가장긴 = (t) => t.말없는자리.reduce((x, r) => (r.길이초 > x.길이초 ? r : x), { 길이초: 0 });

test('말 실측 — 정답 편에서 말 없는 자리 · 마지막 말 끝이 0.15초 안에 맞는다', { skip: 그림라이브러리 ? false : 'numpy · cv2 없음' }, () => {
  const t = 말자료();
  const near = (rows, a, b) => rows.some((r) => Math.abs(r.초 - a) <= 0.15 && Math.abs(r.끝초 - b) <= 0.15);
  const w = t.yuhobuilds_윈도우깨짐다시_20261115;
  assert.ok(near(w.말없는자리, 2.79, 5.72) && near(w.말없는자리, 10.0, 12.52), JSON.stringify(w.말없는자리));
  assert.ok(Math.abs(w.꼬리.초 - 42.77) <= 0.15, `마지막 말 끝 ${w.꼬리.초}`);
  assert.ok(near(t.yuhobuilds_반짝73_20261115.말없는자리, 9.54, 11.32));
  const j = t.yuhobuilds_지적147_20261113;
  assert.ok(near(j.말없는자리, 3.51, 5.72) && near(j.말없는자리, 13.64, 15.72) && near(j.말없는자리, 29.52, 32.56), JSON.stringify(j.말없는자리));
  // 꼬리: 해설 뒤 4.4초(없는판결) · 끝 6초(원생명단)
  assert.ok(Math.abs(t.synkbrief_없는판결_20261111.꼬리.길이초 - 4.34) <= 0.15 && Math.abs(t.synkbrief_원생명단_20261115.꼬리.길이초 - 6.8) <= 0.15);
});

test('말 실측 — 통과한 편의 말 없는 자리 · 꼬리가 걸린 편보다 길거나 깊어 걸림 문턱이 없다', { skip: 그림라이브러리 ? false : 'numpy · cv2 없음' }, () => {
  const t = 말자료();
  // 말 없이 배경음만: 걸린 편의 가장 긴 자리(윈도우깨짐다시 2.98초 · 반짝73 1.82초)보다 통과한 지적147(3.11초) · 영상통화연인(4.23초)이 길다
  const 걸린 = Math.max(가장긴(t.yuhobuilds_윈도우깨짐다시_20261115).길이초, 가장긴(t.yuhobuilds_반짝73_20261115).길이초);
  assert.ok(가장긴(t.yuhobuilds_지적147_20261113).길이초 > 걸린 && 가장긴(t.synkbrief_영상통화연인_20261113).길이초 > 걸린);
  // 짧고 깊은 빈 소리: 필라테스예약 13.95~16.42초(말보다 13.2dB 작음)보다 통과한 영상통화연인 13.95~18.18초가 길고 깊다
  const p = t.synkbrief_필라테스예약_20261113.말없는자리.find((r) => Math.abs(r.초 - 13.95) <= 0.15);
  const v = t.synkbrief_영상통화연인_20261113.말없는자리.find((r) => Math.abs(r.초 - 13.95) <= 0.15);
  assert.ok(p && v && v.길이초 > p.길이초 && v.말보다 > p.말보다, JSON.stringify({ p, v }));
  // 꼬리: 게시 편 목소리되풀이(4.51초 · 말보다 14.9dB 작음)가 걸린 두 편(없는판결 4.34초 16.2dB · 원생명단 6.8초 12.4dB) 사이에 든다 — 길이 · 크기 어느 문턱도 가르지 못한다
  const [a, b, c] = [t.synkbrief_없는판결_20261111.꼬리, t.synkbrief_원생명단_20261115.꼬리, t.yuhobuilds_목소리되풀이_20261103.꼬리];
  assert.ok(c.길이초 > a.길이초 && c.길이초 < b.길이초 && c.말보다 < a.말보다 && c.말보다 > b.말보다, JSON.stringify({ a, b, c }));
});

test('말 — 기본 항목이 아니고 걸림을 내지 않으며, VAD를 못 쓰면 알림 한 줄로 건너뛴다(끝 코드 0 · 못잼 없음)', { skip: 없음 }, (t) => {
  const video = synthetic(t);
  assert.doesNotMatch(fs.readFileSync(tool, 'utf8'), /DEFAULT_ITEMS = "[^"]*말/);
  const env = { ...process.env, SYNK_검사이력: '끔', SYNK_말시각: '끔' };
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '말', '--json'], { encoding: 'utf8', timeout: 300000, env });
  assert.equal(r.status, 0, r.stderr);
  const j = lastJson(r.stdout);
  assert.deepEqual(j.걸림, []);
  assert.equal(j.못잼, undefined);
  assert.deepEqual(j.알림.filter((n) => n.항목 === '말'), [{ 항목: '말', 못잼: 'SYNK_말시각=끔' }]);
  // --json 없이 부르면(만드는 세션이 표를 보는 길) 말 줄도 찍는다(GPT 검수 GA1)
  const txt = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '말'], { encoding: 'utf8', timeout: 300000, env });
  assert.equal(txt.status, 0, txt.stderr);
  assert.match(txt.stdout, /걸림 없음/);
  assert.ok(txt.stdout.includes('[말 · 못 잼] SYNK_말시각=끔'), txt.stdout);
  // 「기본,말」은 기본 항목에 말을 더한다(최종 확인 묶음이 이렇게 부른다) — 끝소리가 같이 걸린다
  const b = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '기본,말', '--json'], { encoding: 'utf8', timeout: 300000, env: { ...env, SYNK_MOTION_PY: path.join(os.tmpdir(), '없는_사람움직임.py') } });
  const bj = lastJson(b.stdout);
  assert.ok(bj.걸림.some((h) => h.항목 === '끝소리') && bj.알림.some((n) => n.항목 === '말'), JSON.stringify(bj).slice(0, 400));
});

// 작은 줄(대사 한 줄만 작음) — 최종 확인 묶음이 받아쓰기 줄마다 크기를 재서 quiet_lines로 짚는다. 고정 자료(tests/fixtures/말줄크기_실측.json):
// 공용 작업본 최종본 50편을 묶음과 같은 셈(받아쓰기 낱말 시각 없음 · 줄 끝을 소리 길이로 자름 · VAD 말 범위)으로 잰 줄 크기.
// 필라테스예약 「되돌려 놔」(15.5dB 작음)만 걸리고 나머지는 11.2dB(무료체험 「됐다」) 아래다. 문턱 12~15dB에서 같다.
// 말 범위 거름이 없으면 받아쓰기가 말 없는 끝에서 지어낸 줄(없는판결 60.0초 「감사합니다.」 · 목소리되풀이 30.0초)이 걸린다.
test('작은 줄 실측 — 필라테스예약 24.1~26.1초 「되돌려 놔」만 걸리고 49편은 지나간다(문턱 12~15dB에서 같음), 말 범위 밖 지어낸 줄은 뺀다', { skip: 그림라이브러리 ? false : 'numpy · cv2 없음' }, () => {
  const fixture = path.join(__dirname, 'fixtures', '말줄크기_실측.json');
  const code = [
    'import importlib.util, json, sys',
    'spec = importlib.util.spec_from_file_location("최종본검사", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'd = json.load(open(sys.argv[2], encoding="utf-8"))["영상"]',
    'rows = lambda v: [{"초": a, "끝초": b, "dB": x} for a, b, x, _ in v["줄"]]',
    'span = lambda v: tuple(v["말범위"]) if v["말범위"] else None',
    'out = {th: {k: m.quiet_lines(rows(v), float(th), span(v))[1] for k, v in d.items()} for th in ("12", "13", "14", "15")}',
    'out["범위없이"] = {k: m.quiet_lines(rows(v))[1] for k, v in d.items()}',
    'print(json.dumps(out, ensure_ascii=False))',
  ].join('\n');
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', code, tool, fixture], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const { 범위없이, ...got } = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  const 걸린 = (all) => Object.entries(all).filter(([, low]) => low.length);
  for (const [th, all] of Object.entries(got)) {
    const hit = 걸린(all);
    assert.deepEqual(hit.map(([k]) => k), ['synkbrief_필라테스예약_20261113'], `${th}dB`);
    const [only] = hit[0][1];
    assert.deepEqual([only.초, only.끝초], [24.1, 26.1]);
    assert.ok(only.가운데보다 > 15 && only.가운데보다 < 16, JSON.stringify(only));
  }
  assert.deepEqual(걸린(범위없이).map(([k]) => k).sort((a, b) => a.localeCompare(b, 'ko')),
    ['synkbrief_없는판결_20261111', 'synkbrief_필라테스예약_20261113', 'yuhobuilds_목소리되풀이_20261103'], '말 범위 거름이 없으면 지어낸 끝 줄이 걸린다');
  assert.match(fs.readFileSync(tool, 'utf8'), /LINE_QUIET_DB = 13\.0/);
});

// faster-whisper(VAD 모델)가 있는 PC에서만: 사인파는 말이 아니다 — 말이 잡히지 않는다고 낸다
const VAD있음 = spawnSync(py, ['-I', '-X', 'utf8', '-c', 'from faster_whisper.vad import get_vad_model'], { encoding: 'utf8', timeout: 120000 }).status === 0;
test('말 — VAD가 있으면 사인파 영상에서 말이 잡히지 않는다', { skip: 없음 || (VAD있음 ? false : 'faster-whisper 없음') }, (t) => {
  const video = synthetic(t);
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--항목', '말', '--json'], { encoding: 'utf8', timeout: 300000, env: { ...process.env, SYNK_검사이력: '끔' } });
  assert.equal(r.status, 0, r.stderr);
  const n = lastJson(r.stdout).알림.find((x) => x.항목 === '말');
  assert.ok(n && !n.못잼 && n.말dB === null && n.꼬리 === null, JSON.stringify(n));
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
  assert.deepEqual(m[1].split(','), ['굳음', '같은판', '되풀이', '끝', '화소', '조용', '멈춤'], '11-16 화면멈춤(「멈춤」)은 기본 항목이다');
  assert.ok(!m[1].split(',').includes('흐름'));
  for (const k of 흐름이름) assert.ok(new RegExp(`SOFT = \\{[^}]*"${k}"`).test(src), `${k}는 끝 코드를 바꾸지 않는다(SOFT)`);
  const gate = fs.readFileSync(path.join(__dirname, '..', 'tools', '영상관문판.py'), 'utf8');
  assert.ok(/최종본항목 = "[^"]*흐름/.test(gate), '마감 관문 판이 흐름을 붙여 부른다');
});

test('없는 파일은 끝 코드 2와 오류 한 줄', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, path.join(os.tmpdir(), '없는영상.mp4'), '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr || r.error?.message);
  assert.ok(JSON.parse(r.stdout).오류);
});

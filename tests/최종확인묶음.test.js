'use strict';
// 최종 확인 묶음(tools/최종확인묶음.py) — 최종본 하나로 시트 · 1/8초 띠 · 컷 앞뒤 · 끝 3초 · 소리 숫자와 독립 검수 지시문을 만든다(11-15).
// 6초 시험 영상: 0~2초 시험 그림, 2~4초 같은 그림을 잘라 키움, 4~6초 다른 그림. 받아쓰기는 무거워 건너뛴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const tool = path.join(__dirname, '..', 'tools', '최종확인묶음.py');
const py = process.env.SYNK_PYTHON || 'python';
// CI의 문법 검사 작업에는 ffmpeg · OpenCV가 없다 — 그때는 건너뛴다(tests/최종본검사.test.js와 같은 꼴)
const 라이브러리 = spawnSync(py, ['-I', '-X', 'utf8', '-c', 'import numpy, cv2, PIL'], { encoding: 'utf8' }).status === 0;
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0 && spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0;
const 없음 = !(라이브러리 && ffmpeg) && `${라이브러리 ? '' : 'numpy · cv2 · PIL '}${ffmpeg ? '' : 'ffmpeg '}없음`;
// 얼굴 모델(YuNet · SFace)이 있는 PC에서만 얼굴 단계까지 돌았는지 본다 — 리눅스 CI에는 모델이 없어 그 단계만 「못 만듦」이다
const 얼굴모델 = ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx']
  .every((f) => fs.existsSync(path.join(os.homedir(), '.rembg', 'models', 'yunet', f)));

test('묶음 자료와 독립 검수 지시문을 만들고, 지시문에는 컷 경계 · 음량 · 기계 검사 걸림 · 채울 칸이 든다', { skip: 없음, timeout: 600000 }, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종확인묶음-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const video = path.join(dir, 'syn.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=24:d=4', '-f', 'lavfi', '-i', 'cellauto=s=540x960:r=24:rule=110', '-f', 'lavfi', '-i', 'sine=f=440:d=6:sample_rate=48000',
    '-filter_complex', '[0:v]split[a][b];[a]trim=0:2,setpts=PTS-STARTPTS[v1];[b]trim=2:4,setpts=PTS-STARTPTS,crop=iw/1.4:ih/1.4,scale=540:960,setsar=1[v2];'
      + '[1:v]trim=0:2,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[v3];[v1][v2][v3]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
  const out = path.join(dir, '묶음');
  // 승인 얼굴 그림도 한글 경로에 둔다 — 11-15까지 cv2.imread가 한글 경로(묶음 폴더 · 편 폴더)를 못 열어 얼굴 단계가 통째로 빠졌다
  const ref = path.join(dir, '승인얼굴.jpg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-frames:v', '1', ref]);
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, video, '--out', out, '--skip-stt', '--ref', ref], { encoding: 'utf8', timeout: 600000 });
  // 얼굴 모델이 없는 PC에서는 얼굴 단계만 「못 만듦」(끝 코드 2)이고 나머지는 만든다
  assert.ok([0, 2].includes(r.status), r.stderr);
  const last = JSON.parse(r.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop());
  assert.deepEqual(last.컷, [2, 4]);
  if (얼굴모델) {
    assert.ok(!last.못만듦.some((x) => x.startsWith('얼굴')), `한글 경로에서도 얼굴 단계가 돈다: ${last.못만듦.join(' / ')}`);
    const report = fs.readFileSync(path.join(out, 'report.txt'), 'utf8');
    assert.match(report, /얼굴 \d+개 · 무리 \d+/);
    assert.doesNotMatch(report, /승인 얼굴 그림을 못 읽음/, '한글 경로의 승인 얼굴 그림도 읽는다');
  }
  for (const f of ['sheet_0.jpg', 'm8_00.jpg', 'cuts_0.jpg', 'end.jpg', 'report.txt', '최종본검사.json', '독립검수_지시문.md']) {
    assert.ok(fs.existsSync(path.join(out, f)), `${f}가 있어야 한다`);
  }
  assert.equal(fs.readdirSync(path.join(out, 'z')).length, 3, '컷마다 가운데 한 장');
  const prompt = fs.readFileSync(path.join(out, '독립검수_지시문.md'), 'utf8');
  assert.match(prompt, /경계: 2\.00 4\.00초/);
  assert.match(prompt, /1초 음량 dB/);
  assert.match(prompt, /같은판/, '최종본 검사가 잡은 같은 판이 기계 검사 칸에 든다');
  assert.match(prompt, /\{\{원고/, '부르는 쪽이 채울 칸이 남아 있다');
  assert.match(prompt, /평소 속도로 한 번 볼 때 알아채나/);
  assert.doesNotMatch(prompt, /\{\{\{/);
  // 말 시각 절(11-16 흠 장부 「소리」) — VAD가 있는 PC는 사인파에서 말이 안 잡혔다고, 없는 CI는 못 쟀다고 한 줄을 낸다
  assert.match(prompt, /## 말 시각\(기계가 잰 것/);
  assert.match(prompt, /말이 잡히지 않았다|말 시각을 못 쟀다/);
  // 말 시각이 없으면 지어낸 받아쓰기 줄을 거를 수 없어 대사 줄 크기도 짚지 않는다고 적는다(GPT 검수 GA2)
  if (/말 시각을 못 쟀다/.test(prompt)) assert.match(prompt, /대사 줄 크기도 짚지 않았다/);
  const fc = JSON.parse(fs.readFileSync(path.join(out, '최종본검사.json'), 'utf8'));
  assert.ok(fc.알림.some((n) => n.항목 === '말'), '최종본 검사를 「기본,말」로 불렀다');
});

test('없는 파일은 끝 코드 2와 오류 한 줄', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, path.join(os.tmpdir(), '없는영상.mp4'), '--out', path.join(os.tmpdir(), '없는묶음')], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr);
  assert.ok(JSON.parse(r.stdout).오류);
});

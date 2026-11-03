// 음량 마감(tools/음량마감.mjs) — 작은 합성 영상으로 크기 맞춤·리미터·다시 맞춤·덮어쓰기 막기를 보고,
// 이 PC에 원본이 있으면 이미 끝난 회차(yuhobuilds 세션 공유 v14 확정본)를 같은 설정으로 다시 만들어 바이트까지 같은지 본다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finish, parseEbur128, nextGain, passes, DEFAULTS, main, sameFile, audioFilter } from '../tools/음량마감.mjs';
import { uploadAudioBitrateFloor } from '../tools/영상사전검사.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const dirs = [];
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const temp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-finish-test-')); dirs.push(d); return d; };
const md5 = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
const streamMd5 = (file, sel) => crypto.createHash('md5').update(execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', sel, '-c', 'copy', '-f', 'data', '-'], { maxBuffer: 1 << 28 })).digest('hex');

// 6초 합성 렌더: 작은 소리 위에 띄엄띄엄 큰 딸깍(효과음처럼 봉우리가 큰 믹스)
function syntheticRender(dir) {
  const file = path.join(dir, 'render.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x223344:s=320x240:r=30:d=6',
    '-f', 'lavfi', '-i', "aevalsrc='0.04*sin(2*PI*220*t)+0.9*sin(2*PI*1200*t)*lt(mod(t\\,1.5)\\,0.04)':s=48000:d=6",
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-shortest', file]);
  return file;
}

test('ebur128 요약 읽기·다시 맞춤·통과 판정', () => {
  const stderr = '[Parsed_ebur128_0 @ x] t: 1 ...\n  Integrated loudness:\n    I:         -20.3 LUFS\n  Loudness range:\n    LRA:         4.1 LU\n  Summary:\n\n  Integrated loudness:\n    I:         -17.0 LUFS\n    Threshold: -27.1 LUFS\n\n  Loudness range:\n    LRA:         2.3 LU\n\n  True peak:\n    Peak:       -1.5 dBFS\n';
  assert.deepEqual(parseEbur128(stderr), { I: -17, peak: -1.5, LRA: 2.3 });
  assert.throws(() => parseEbur128('no audio'), /음량을 읽지 못했습니다/);
  const o = { ...DEFAULTS };
  assert.equal(nextGain(2.5, -14.7, o), null, '0.3 안이면 한 번으로 끝');
  assert.equal(nextGain(2.5, -15.1, o), 3.1);
  assert.equal(nextGain(2.5, -15.1, { ...o, correct: 0 }), null, '--다시맞춤 0이면 한 번만');
  assert.equal(passes({ I: -14.7, peak: -1.1 }, o), false, '봉우리 −1.2 넘으면 통과 아님');
  assert.equal(passes({ I: -14.9, peak: -1.3 }, o), true);
  assert.equal(passes({ I: -14.1, peak: -1.3 }, { ...o, window: [-15, -14] }), true);
  assert.equal(sameFile('out/x.mp4', path.join('out', '.', 'x.mp4')), true);
  assert.equal(sameFile('out/x.mp4', 'out/y.mp4'), false);
  assert.equal(uploadAudioBitrateFloor({ width: 1080, height: 1920 }, 2), 320000);
  assert.equal(uploadAudioBitrateFloor({ width: 1920, height: 1080 }, 1), 128000);
  assert.equal(uploadAudioBitrateFloor({ width: 1920, height: 1079 }, 2), null);
});

test('합성 렌더: 영상은 그대로, 소리는 −14.5±0.5 LUFS·최대 −1.2 dBFS, 길이 그대로, 원본·완성본은 덮지 않는다', { skip: !hasFfmpeg && 'ffmpeg 없음', timeout: 120000 }, async () => {
  const dir = temp(), src = syntheticRender(dir), before = md5(src);
  const r = await finish(src, null, { phone: path.join(dir, 'phone.mp4') });
  assert.equal(r.out, path.join(dir, 'render_final.mp4'));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(Math.abs(r.after.I - -14.5) <= 0.5 && r.after.peak <= -1.2, JSON.stringify(r.after));
  assert.equal(streamMd5(src, '0:v:0'), streamMd5(r.out, '0:v:0'), '영상 스트림은 복사');
  assert.equal(r.duration.outVideo, r.duration.srcVideo);
  assert.ok(Math.abs(r.duration.outAudio - r.duration.srcAudio) < 0.03);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate', '-of', 'json', r.out]).toString()).streams[0];
  assert.deepEqual([probe.codec_name, probe.sample_rate], ['aac', '48000']);
  assert.ok(r.phone.underLimit && r.phone.peak <= -1.0, JSON.stringify(r.phone));
  assert.equal(r.bitrate.enforced, false, '작은 미리보기에는 올림용 최저 비트레이트가 없다');
  assert.ok(r.bitrate.actualBps > 0);
  assert.ok(r.passes.every(p => p.aacQuality === null));
  assert.equal(md5(src), before, '렌더 원본은 그대로');
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('.part')).length, 0);
  await assert.rejects(finish(src, r.out), /이미 있는 파일입니다/);
  await assert.rejects(finish(src, src, { overwrite: true }), /렌더 원본을 덮어쓸 수 없습니다/);
  await assert.rejects(finish(src, r.out, { phone: r.out, overwrite: true }), /서로 다른 출력/);
  if (process.platform === 'win32') await assert.rejects(finish(src, src.toUpperCase(), { overwrite: true }), /렌더 원본을 덮어쓸 수 없습니다/, '대소문자만 다른 이름도 원본');
  const link = path.join(dir, 'link.mp4');
  fs.linkSync(src, link);
  await assert.rejects(finish(src, link, { overwrite: true }), /렌더 원본을 덮어쓸 수 없습니다/, '하드 링크도 원본');
  await assert.rejects(finish(src, path.join(dir, 'out.wav')), /영상 확장자/);
  assert.equal(md5(src), before, '원본은 여전히 그대로');
  const again = await finish(src, r.out, { overwrite: true });
  assert.equal(md5(again.out), md5(r.out), '같은 설정이면 같은 파일');
  // 범위 밖이면 파일은 만들되 종료 코드 1
  const code = await main([src, path.join(dir, 'strict.mp4'), '--통과', '-5,-4', '--json']);
  assert.equal(code, 1);
  assert.ok(fs.existsSync(path.join(dir, 'strict.mp4')), '음량만 벗어난 새 출력은 기존 규약대로 남긴다');
});

function uploadFixture(dir, audio, seconds = 3) {
  const src = path.join(dir, '1080-render.mkv');
  execFileSync('ffmpeg', ['-v','error','-nostdin','-f','lavfi','-i','color=size=1080x1080:rate=4',
    '-f','lavfi','-i',audio,'-t',String(seconds),'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','pcm_s16le',src]);
  return src;
}

test('각 AAC 후보는 실패한 AAC 대신 렌더 원본에서 만들고, 실제 기준에 처음 닿은 후보에서 멈춘다', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const noise = 'anoisesrc=color=pink:sample_rate=48000:amplitude=0.19:duration=2.8:seed=';
  const dir = temp(), src = uploadFixture(dir, noise + '7[a];' + noise + '23[b];[a][b]amerge=inputs=2,apad=whole_dur=4', 4);
  const r = await finish(src, path.join(dir, 'master.mp4'), { correct: 0 });
  const reference = path.join(dir, 'audio.m4a'), rates = [];
  // AAC 판마다 실제 비트레이트가 다를 수 있다. 동일한 소스에서 직접 인코딩한 첫 통과 스트림과 비교한다.
  for (const args of [['-b:a','384k'], ['-aac_coder','twoloop','-q:a','3.5'], ['-aac_coder','fast','-q:a','8']]) {
    execFileSync('ffmpeg', ['-v','error','-nostdin','-y','-i',src,'-map','0:a:0','-af',audioFilter(r.gain,DEFAULTS.limit,DEFAULTS),'-c:a','aac',...args,'-ar','48000',reference]);
    const bps = Number(execFileSync('ffprobe', ['-v','error','-select_streams','a:0','-show_entries','stream=bit_rate','-of','csv=p=0',reference]));
    rates.push(bps);
    if (bps >= 320000) break;
  }
  assert.deepEqual(r.passes.map(p => p.bitrateBps), rates);
  assert.equal(r.bitrate.ok, rates.at(-1) >= 320000);
  assert.equal(r.written, r.bitrate.ok);
  if (r.written) {
    assert.equal(streamMd5(r.out, '0:a:0'), streamMd5(reference, '0:a:0'));
    assert.equal(streamMd5(r.out, '0:v:0'), streamMd5(src, '0:v:0'));
  }
});

test('낮은 AAC는 원본에서 두 번까지만 다시 시도하고 실패하면 기존 마스터와 휴대폰 판을 보존한다', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const dir = temp(), src = uploadFixture(dir, 'anullsrc=sample_rate=48000:channel_layout=stereo');
  const out = path.join(dir, 'master.mp4'), phone = path.join(dir, 'phone.mp4');
  fs.copyFileSync(src, out); fs.copyFileSync(src, phone);
  const saved = md5(src);
  const r = await finish(src, out, { phone, overwrite: true, correct: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.written, false);
  assert.deepEqual(r.passes.map(p => p.aacQuality), [null, 3.5, 8]);
  assert.equal(r.bitrate.minimumBps, 320000);
  assert.ok(r.bitrate.enforced && !r.bitrate.ok && r.passes.every(p => p.bitrateBps > 0 && p.bitrateBps < 320000));
  for (const p of [src, out, phone]) assert.equal(md5(p), saved);
  assert.equal(path.dirname(path.dirname(r.reviewPath)), dir);
  assert.notEqual(path.dirname(r.reviewPath), path.dirname(out));
  assert.equal(streamMd5(r.reviewPath, '0:v:0'), streamMd5(src, '0:v:0'));
  const newOut = path.join(dir, 'new.mp4');
  const cli = spawnSync(process.execPath, [path.join(REPO,'tools','음량마감.mjs'),src,newOut,'--다시맞춤','0','--json'], { encoding: 'utf8', windowsHide: true });
  assert.equal(cli.status, 1, cli.stderr);
  const fresh = JSON.parse(cli.stdout);
  assert.ok(!fresh.written && !fresh.bitrate.ok && fs.existsSync(fresh.reviewPath));
  assert.notEqual(path.dirname(fresh.reviewPath), dir);
  assert.equal(streamMd5(fresh.reviewPath, '0:v:0'), streamMd5(src, '0:v:0'));
  assert.equal(fs.existsSync(newOut), false);
  assert.ok(!fs.readdirSync(dir).some(p => p.includes('.part')));
});

test('하드링크 없는 볼륨도 새 출력만 복사하고 경합 중에 생긴 파일은 덮지 않는다', { skip: !hasFfmpeg, timeout: 120000 }, async t => {
  const dir = temp(), src = syntheticRender(dir), out = path.join(dir, 'master.mp4');
  let createCompetingOutput = false;
  t.mock.method(fs, 'linkSync', () => {
    if (createCompetingOutput) fs.writeFileSync(out, 'another publisher', { flag: 'wx' });
    throw Object.assign(Error('unsupported link'), { code: 'EISDIR' });
  });
  assert.ok((await finish(src, out)).ok);
  assert.equal(streamMd5(out, '0:v:0'), streamMd5(src, '0:v:0'));
  fs.unlinkSync(out);
  createCompetingOutput = true;
  await assert.rejects(finish(src, out), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(out, 'utf8'), 'another publisher');
});

test('1080 모노 MKV의 실제 비트레이트를 AAC 패킷으로 재고 명시한 저용량 설정은 그대로 둔다', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const dir = temp(), src = uploadFixture(dir, 'anoisesrc=sample_rate=48000:amplitude=0.17:color=pink:seed=17');
  const r = await finish(src, path.join(dir, 'master.mkv'));
  assert.equal(r.bitrate.minimumBps, 128000);
  assert.equal(r.bitrate.measurement, 'packets');
  assert.ok(r.written && r.ok && r.bitrate.enforced && r.bitrate.actualBps >= 128000, JSON.stringify(r));
  const packets = JSON.parse(execFileSync('ffprobe', ['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=size,pts_time,duration_time','-of','json',r.out])).packets;
  const bytes = packets.reduce((n,p) => n + Number(p.size), 0);
  const span = Number(packets.at(-1).pts_time) + Number(packets.at(-1).duration_time) - Number(packets[0].pts_time);
  assert.equal(r.bitrate.actualBps, Math.floor(8 * bytes / span));
  const small = await finish(src, path.join(dir, 'archive.mp4'), { bitrate: '96k' });
  assert.equal(small.bitrate.enforced, false);
  assert.ok(small.written && small.bitrate.actualBps < 128000 && small.passes.every(p => p.aacQuality === null));
});

// 렌더 파일은 git 밖이라 공용 작업본에만 있다 — 워크트리에서 돌면 그 작업본(git 공통 폴더의 부모)에서 찾는다.
const roots = [REPO];
try { roots.push(path.dirname(path.resolve(REPO, execFileSync('git', ['-C', REPO, 'rev-parse', '--git-common-dir']).toString().trim()))); } catch {}
const EPISODE = roots.map((r) => path.join(r, 'docs', '마케팅', 'yuhobuilds_세션공유_20261017', 'remotion', 'out'))
  .find((d) => fs.existsSync(path.join(d, 'full-a-v14.mp4')) && fs.existsSync(path.join(d, 'full-a-v14_final.mp4')));
const haveEpisode = !!EPISODE;
test('기존 회차 재현: 세션 공유 v14 확정본을 그 회차 설정으로 다시 만들면 바이트까지 같다', { skip: (!hasFfmpeg || !haveEpisode) && '이 PC에 렌더 원본·확정본이 없음(git 밖 파일)', timeout: 300000 }, async () => {
  const dir = temp();
  // 10-13~10-18 회차의 마감.mjs: 목표 −14로 한 번 올리고 리미터 0.84·attack 1, AAC 256k, 표본율은 원본
  const r = await finish(path.join(EPISODE, 'full-a-v14.mp4'), path.join(dir, 'v14_재현.mp4'), { target: -14, correct: 0, window: [-15, -14], bitrate: '256k', rate: 'source' });
  const published = path.join(EPISODE, 'full-a-v14_final.mp4');
  assert.equal(md5(r.out), md5(published));
  assert.equal(r.after.I, -14.1);
  assert.equal(r.duration.outVideo, 54.2);
});

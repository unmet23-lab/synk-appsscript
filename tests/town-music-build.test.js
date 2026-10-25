'use strict';
// 싱크타운 머무는 모드의 SYNK 음악 앱 파일 만들기(세로 조각 W7b, tools/town-music-build.mjs) — 원곡에 Suno 공식 내려받기본의
// 표지가 있어야 만들고, 음량을 맞춘 MP3와 검사기를 지나는 목록 항목을 남긴다. 합성한 시험 음으로만 돈다(실제 곡 없음).
// ffmpeg가 없는 곳(CI 등)에서는 건너뛴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { toolModule } = require('./lib/town.js');

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0 && spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0;
const tone = (file, comment) => {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4:sample_rate=48000', '-ac', '2'];
  if (comment) args.push('-metadata', `comment=${comment}`);
  assert.equal(spawnSync('ffmpeg', [...args, file]).status, 0, '시험 음을 만들었다');
};

test('Suno 표지가 있는 원곡에서 앱 파일과 목록 항목을 만든다 — 음량 맞춤·해시 이름·검사기 통과', { skip: !ffmpeg && 'ffmpeg 없음' }, async () => {
  const { buildTrack, TARGET_LUFS } = await toolModule('town-music-build'), { validateMusic } = await toolModule('town-data-build');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'town-music-')), original = path.join(dir, 'Quiet Test Light.wav'), list = path.join(dir, 'music.json'), folder = path.join(dir, 'music');
  try {
    tone(original, 'made with suno; created=2026-09-07T21:58:56Z; id=676b506d-b475-43e0-9d6f-d519f11623bd');
    fs.writeFileSync(list, JSON.stringify({ musicVer: 'town-music-1', tracks: [] }));
    const preview = buildTrack({ original, ledger: 4, title: '시험 곡', folder, list, write: false });
    assert.equal(preview.id, 'quiet-test-light'); assert.equal(preview.source.suno.id, '676b506d-b475-43e0-9d6f-d519f11623bd');
    assert.equal(fs.existsSync(folder), false, '미리 보기는 아무것도 쓰지 않는다');
    const track = buildTrack({ original, ledger: 4, title: '시험 곡', folder, list, regenerate: false });
    assert.match(track.file, /^assets\/music\/quiet-test-light-[0-9a-f]{8}\.mp3$/);
    assert.ok(fs.existsSync(path.join(folder, path.basename(track.file))));
    assert.ok(Math.abs(track.lufsTenths - TARGET_LUFS * 10) <= 15, `음량 ${track.lufsTenths / 10} LUFS`);
    assert.ok(track.peakTenths <= 0 && track.durationMs > 3500);
    const data = JSON.parse(fs.readFileSync(list, 'utf8'));
    assert.doesNotThrow(() => validateMusic(data)); assert.equal(data.tracks.length, 1);
    // 다시 만들면 같은 곡의 항목을 바꾸고(둘이 되지 않음) 옛 파일을 지운다.
    buildTrack({ original, ledger: 4, title: '시험 곡', folder, list, regenerate: false });
    assert.equal(JSON.parse(fs.readFileSync(list, 'utf8')).tracks.length, 1); assert.equal(fs.readdirSync(folder).length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Suno 표지가 없는 원곡은 만들지 않는다 — 권리를 확인할 수 없다', { skip: !ffmpeg && 'ffmpeg 없음' }, async () => {
  const { buildTrack } = await toolModule('town-music-build');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'town-music-')), original = path.join(dir, 'unknown.wav');
  try {
    tone(original, null);
    assert.throws(() => buildTrack({ original, ledger: 1, title: '출처 모름', folder: path.join(dir, 'music'), list: path.join(dir, 'music.json') }), /표지/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

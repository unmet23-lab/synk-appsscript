// 안내 음성(나레이션): 문장마다 파일이 있고 지금 문장으로 구워졌는지, 짧은지, 몽글의 말보다 조금 작은지, 게임이 읽는 목록에 제작 도구 이름이 없는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NARRATION, NARRATION_LINES, resultLine } from './narration.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'assets/narration/manifest.json'), 'utf8'));
const voice = JSON.parse(readFileSync(path.join(root, 'assets/voice/manifest.json'), 'utf8'));

test('안내 문장마다 파일이 있고, 확인 목록의 문장이 지금 문장과 같고, 판을 오래 붙잡지 않게 짧다', () => {
  const byId = new Map(manifest.lines.map((l) => [l.id, l]));
  assert.equal(new Set(NARRATION_LINES.map((x) => x.id)).size, NARRATION_LINES.length);
  assert.equal(NARRATION_LINES.length, 8);
  for (const n of NARRATION_LINES) {
    assert.equal(n.file, `assets/narration/${n.id}.mp3`);
    assert.ok(existsSync(path.join(root, n.file)), `${n.id} 파일`);
    assert.equal(byId.get(n.id)?.text, n.text, `${n.id}는 지금 문장으로 구웠다`);
    assert.ok(byId.get(n.id).durationSeconds <= 4.5, `${n.id} ${byId.get(n.id).durationSeconds}초`);
  }
  assert.equal(manifest.humanRecording, false);
});

test('안내 음성은 몽글의 말보다 조금 작다(통합 음량, 게임 소리 길의 순간 음량)', () => {
  const voiceI = -18.4;   // 몽글의 말 파일(loudnorm -18) 실측: ffmpeg ebur128 — f01·r06·w08 모두 -18.4 LUFS
  for (const l of manifest.lines) {
    assert.ok(l.integratedLufs <= voiceI - 1.5 && l.integratedLufs >= voiceI - 4, `${l.id} ${l.integratedLufs} LUFS`);
    assert.ok(l.peakDbfs <= -3, `${l.id} 꼭대기 ${l.peakDbfs}`);
  }
  // qa/sound.cjs가 게임과 같은 소리 길로 구워 잰 순간 음량(400ms)의 최대
  const r = JSON.parse(readFileSync(path.join(root, 'qa/sound-results.json'), 'utf8'));
  const loudestVoice = Math.min(r['voice-f01'].loudness_lufs_m, r['voice-r06'].loudness_lufs_m);
  for (const k of Object.keys(r).filter((k) => k.startsWith('narr-'))) assert.ok(r[k].loudness_lufs_m < loudestVoice, `${k} ${r[k].loudness_lufs_m} < 몽글 ${loudestVoice}`);
  assert.equal(r['intro-then-line'].loudness_lufs_m, r['voice-f01'].loudness_lufs_m, '시작 안내 뒤 몽글의 첫 말이 그 장면에서 가장 크다');
  for (const k of ['results', 'intro-then-line']) assert.equal(r[k].clipped_samples, 0);
  assert.ok(voice.lines.length >= 47);
});

test('게임이 읽는 목록과 확인 목록에는 제작 도구·목소리 이름이 없다(만든 설정은 *.source.json에만)', () => {
  const shipped = [readFileSync(path.join(root, 'narration.mjs'), 'utf8'), readFileSync(path.join(root, 'assets/narration/manifest.json'), 'utf8')];
  for (const text of shipped) for (const bad of [/neural/i, /edge[-_ ]?tts/i, /InJoon/i, /SunHi/i, /azure/i]) assert.ok(!bad.test(text), String(bad));
  const source = JSON.parse(readFileSync(path.join(root, 'assets/narration/intro.source.json'), 'utf8'));
  assert.ok(source.voice && source.voice !== JSON.parse(readFileSync(path.join(root, 'assets/voice/f01.source.json'), 'utf8')).voice, '몽글과 다른 목소리');
});

test('결과 안내는 별 수마다 하나, 화면에는 첫 문장이 제목이고 나머지가 그 아래 한 줄', () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => resultLine(s).id), ['result-0', 'result-1', 'result-2', 'result-3']);
  assert.deepEqual([resultLine(3).title, resultLine(3).say], ['완벽해요!', '모두 받아쳤어요.']);
  assert.deepEqual([resultLine(2).title, resultLine(2).say], ['아주 잘했어요!', '']);
  assert.deepEqual([resultLine(0).title, resultLine(0).say], ['괜찮아요.', '다시 해 볼까요?']);
  assert.equal(resultLine(9).id, 'result-3'); assert.equal(resultLine(-1).id, 'result-0');
  assert.equal(NARRATION.dailyIntro.text, '하루 도전이에요. 오늘은 모두 같은 열두 번이에요.');
});

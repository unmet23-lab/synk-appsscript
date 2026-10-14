'use strict';
// 제목은 벽시계가 아닌 실제 인코더의 출력 시각으로 바꾼다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function 초읽기(value) {
  const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(String(value));
  if (!m || +m[2] >= 60 || +m[3] >= 60) return null;
  const seconds = +m[1] * 3600 + +m[2] * 60 + +m[3];
  return Number.isFinite(seconds) ? seconds : null;
}
function 검증(manifest) {
  if (!manifest || !Number.isFinite(manifest.duration) || manifest.duration <= 0
    || !Array.isArray(manifest.tracks) || !manifest.tracks.length) throw Error('곡 시간표가 비어 있습니다');
  let prev = -1;
  for (const t of manifest.tracks) {
    if (!t || !Number.isFinite(t.start) || t.start <= prev || t.start >= manifest.duration || typeof t.title !== 'string' || !t.title.trim()) throw Error('곡 시간표의 제목/경계 오류');
    prev = t.start;
  }
  if (manifest.tracks[0].start !== 0) throw Error('첫 곡은 0초부터 시작해야 합니다');
  return manifest;
}
function 찾기(manifest, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const position = seconds % manifest.duration;
  let index = 0;
  for (let i = 1; i < manifest.tracks.length && manifest.tracks[i].start <= position; i++) index = i;
  return { ...manifest.tracks[index], index, cycle: Math.floor(seconds / manifest.duration), position };
}
function 시작({ playlist, progress, send, log = () => {} }) {
  if (!playlist) return null;
  const file = path.join(path.dirname(playlist), 'now-playing.json');
  if (!fs.existsSync(file)) return null;
  let manifest = 검증(JSON.parse(fs.readFileSync(file, 'utf8')));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(playlist)).digest('hex');
  if (sha !== manifest.playlistSha256) throw Error('소리 목록과 곡 시간표가 다릅니다');
  const 파일판 = () => { const s = fs.statSync(file); return s.mtimeMs + ':' + s.size; };
  let 판 = 파일판(), 다음확인 = 0;
  let last = '', busy = false;
  const tick = async () => {
    if (busy) return;
    if (Date.now() >= 다음확인) {
      다음확인 = Date.now() + 1000;
      try {
        const 새판 = 파일판();
        if (새판 !== 판) {
          판 = 새판;
          const next = 검증(JSON.parse(fs.readFileSync(file, 'utf8')));
          if (next.playlistSha256 !== sha || next.duration !== manifest.duration
            || next.tracks.length !== manifest.tracks.length
            || next.tracks.some((t, i) => t.start !== manifest.tracks[i].start)) {
            throw Error('재생 중에는 곡 제목만 바꿀 수 있습니다');
          }
          manifest = next;
        }
      } catch (e) { log('곡 제목 갱신 보류: ' + e.message); }
    }
    const seconds = 초읽기(progress.out_time);
    if (seconds === null) return;
    const track = 찾기(manifest, seconds);
    const key = track.cycle + ':' + track.index + ':' + track.title;
    if (key === last) return;
    busy = true;
    try {
      const result = await send({ 종류: '곡', 제목: track.title });
      // CDP 호출 성공과 페이지 안 실행 성공은 다르다. 실패한 제목은 다음 tick에 재시도한다.
      if (result?.exceptionDetails) throw Error('곡 제목의 브라우저 실행 실패');
      last = key;
      log(`현재 곡 ${track.index + 1}/${manifest.tracks.length}: ${track.title} · 출력 ${seconds.toFixed(2)}초`);
    } catch (e) { log('곡 제목 전송 재시도: ' + e.message); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 250);
  timer.unref?.();
  return timer;
}
module.exports = { 초읽기, 검증, 찾기, 시작 };

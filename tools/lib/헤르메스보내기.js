'use strict';
/* 헤르메스로 텔레그램 한 통 — tools/작업실예약.js(검토 링크·등록 실패)와 tools/예약큐.js(게시 큐 알림)가 쓴다(2026-10-22).
 *
 * 성공은 종료 코드가 아니라 `hermes send --json`이 찍은 결과로 판단한다. 10-22 첫 정기 실행(작업 스케줄러 → pythonw → node)에서
 * 헤르메스가 뜨며 플러그인을 40초쯤 불러온 뒤 11:22:18에 보내고 「sent」를 찍었는데, 끝나기 전에 60초 한도에 끊겨(종료 코드 없음)
 * 보낸 글을 실패로 쳤다. 그러면 중복 막기 기록이 남지 않아 30분 뒤 같은 글을 또 보낸다 — 검토 링크면 링크가 거듭 간다.
 * 그래서 한도를 3분으로 늘리고, 결과가 「보냈다」면 종료 코드가 0이 아니어도·끊겼어도 보낸 것으로 친다(까닭은 note로 남긴다).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 한도ms = 180000;

/** spawnSync 결과 → { ok, note } 또는 { ok: false, error }. */
function 결과(r) {
  const out = String(r.stdout || '').trim();
  let j = null;
  for (const line of [out, ...out.split(/\r?\n/).reverse()]) { try { j = JSON.parse(line); break; } catch { /* 다음 줄 */ } }
  // --json을 못 알아들은 판이 사람용으로 「sent」만 찍은 경우도 보낸 것으로 친다(다시 보내는 쪽이 더 나쁘다).
  const sent = (j && j.success === true) || (!j && /^sent\b/im.test(out));
  if (sent) {
    const 끝 = r.status === 0 ? '' : r.status != null ? `종료 ${r.status}` : r.error?.code || r.signal || '끝나기 전에 끊김';
    return { ok: true, note: 끝 ? `헤르메스가 보냈다고 했지만 ${끝} — 보낸 것으로 친다` : '' };
  }
  // 프로세스를 시작하지 못한 경우만 재전송이 안전하다. 시간 초과·응답 유실·CLI 오류는 전송 여부가 불확실하다.
  const notStarted = !r.pid && ['ENOENT', 'EACCES'].includes(r.error?.code) && !out && !String(r.stderr || '').trim();
  return { ok: false, error: String((j && j.error) || r.error?.message || r.stderr || out || `종료 ${r.status}`).trim().slice(0, 200),
    ...(notStarted ? { delivery: 'not-started' } : {}) };
}

/** 글 한 통을 보낸다. spawn은 시험용. */
function 보내기(exe, target, text, { spawn = spawnSync, timeout = 한도ms } = {}) {
  const file = path.join(os.tmpdir(), `synk-hermes-${process.pid}-${Date.now()}.txt`);
  try { fs.writeFileSync(file, text); }
  catch (error) {
    let detail = error.message || String(error);
    try { fs.rmSync(file, { force: true }); }
    catch (cleanup) { detail += ` (임시 파일 정리 실패: ${cleanup.message})`; }
    return { ok: false, error: detail.slice(0, 200), delivery: 'not-started' };
  }
  try { return 결과(spawn(exe, ['send', '--json', '-t', target, '-f', file], { encoding: 'utf8', windowsHide: true, timeout })); }
  finally { fs.rmSync(file, { force: true }); }
}

module.exports = { 보내기, 결과, 한도ms };

// 명령줄(11-16 참고 카드 시안 알림 · 앱 예약 세션이 쓴다): node tools/lib/헤르메스보내기.js --파일 <글.txt>
// 받는 곳은 유호님 개인 대화 하나로 고정한다. 결과 JSON을 찍고, 보냈으면 종료 0.
if (require.main === module) {
  const i = process.argv.indexOf('--파일');
  const 파일 = i > 0 ? process.argv[i + 1] : '';
  if (!파일 || !fs.existsSync(파일)) {
    console.error('쓰는 법: node tools/lib/헤르메스보내기.js --파일 <보낼 글.txt>');
    process.exit(2);
  }
  const 헤르메스 = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'hermes', 'bin', 'hermes.exe');
  const r = 보내기(헤르메스, 'telegram:6017495834', fs.readFileSync(파일, 'utf8'));
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}

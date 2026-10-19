#!/usr/bin/env node
'use strict';
/**
 * 텔레그램 승인 — 사람 없이 돌던 Claude가 자동 모드에 막혀 건너뛴 단계를, 유호님이 폰에서 텔레그램 한마디로
 * 이어 가게 하는 Claude Code 훅 쪽(2026-10-19). 답장을 받아 세션을 잇는 쪽은 헤르메스 플러그인
 * (tools/hermes-synk/plugin/__init__.py 「텔레그램 이어 가기」)이다.
 *
 *   1. PermissionDenied 훅 — 자동 모드가 막은 도구 호출을 세션별 기록에 남긴다(사람 없는 실행만).
 *   2. Stop 훅 — 그 세션에 막힌 일이 있으면 텔레그램으로 한 통 보낸다(hermes send).
 *      알림에는 「막힌 일」 한 줄(무엇을 어디에)과 유호님이 보낼 「이어갈 문장」을 쓰고 내부 번호는 넣지 않는다.
 *      두 줄은 Claude가 마지막 답 끝에 쓴 것을 읽는다. 앱 예약 작업처럼 없으면 Stop에서 한 번만 더 이어 쓰게 한다.
 *      헤르메스 작업은 결과 글이 그대로 남아야 해서 막지 않고(지시문에 두 줄을 쓰라고 적어 둔다), 없으면 도구 설명으로 짓는다.
 *   3. 유호님이 그 문장을 보내거나 알림에 답장하면, 헤르메스가 그 글을 한 글자도 보태지 않고 새 사용자 메시지로
 *      `claude -p --resume`에 넣는다. 자동 모드 판정 모델은 사용자 메시지만 동의로 읽는다. 예약 지시문·Claude의 말·
 *      헤르메스의 말은 동의가 아니다(현장 노트 docs/현장노트/AI_CLI.md 「Claude Code 자동 모드」).
 *
 * 사람 없는 실행 가리기: 실행기가 넣는 SYNK_UNATTENDED=<종류>:<이름>(헤르메스 hermes:<작업 ID> · 이어 가기 continue:…),
 * 또는 기록의 첫 사용자 메시지가 <scheduled-task …>로 시작하는 앱 예약 작업. 그 밖의 세션에서는 아무것도 하지 않는다.
 *
 *   node tools/텔레그램승인.js 훅              Claude Code 훅(표준입력 JSON). 늘 종료 0이고 도구 호출은 막지 않는다
 *   node tools/텔레그램승인.js 목록            남은 막힘 기록 보기
 *   node tools/텔레그램승인.js 켜기 [--실행]    ~/.claude/settings.json 에 두 훅만 더한다(autoMode 등 다른 칸은 그대로). 기본은 미리 보기
 *   node tools/텔레그램승인.js 끄기 [--실행]    두 훅만 뺀다
 *
 * 기록: %LOCALAPPDATA%\hermes\runtime\synk-approvals\<세션 ID>.json — 헤르메스 플러그인이 같은 폴더를 읽고 고친다.
 * 시험·재현용 환경 변수: SYNK_APPROVAL_DIR(기록 폴더), SYNK_TG_DRYRUN_DIR(텔레그램 대신 이 폴더에 알림 글을 쓴다).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const 로컬 = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const 헤르메스 = path.join(로컬, 'hermes', 'bin', 'hermes.exe');
const 텔레그램대상 = 'telegram:6017495834'; // 크레딧실행.js·팁 장부 알림과 같은 개인 대화
const 세션꼴 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 훅사건 = ['PermissionDenied', 'Stop'];

const 두줄요청 = [
  'SYNK 텔레그램 승인 훅: 이번 실행에서 자동 모드가 도구 호출을 막아 그 단계를 건너뛰었습니다. 사람이 없는 실행이라 유호님 휴대폰으로 알림을 보냅니다.',
  '막힌 단계를 다시 시도하거나 다른 길로 돌아가지 마세요. 방금 한 보고를 짧게 다시 쓰고, 맨 끝에 아래 두 줄을 이 꼴 그대로 붙이세요.',
  '막힌 일: (무엇을 어디에 하려다 막혔는지 한 줄. 작업 ID·해시·명령어 같은 내부 표기는 빼고 쉬운 말로)',
  '이어갈 문장: (유호님이 이어 가라고 보낼 짧은 한국어 명령문 한 줄. 할 행동과 그 대상을 이름 대어 적는다)',
].join('\n');

const 보관함 = (환경 = process.env) => 환경.SYNK_APPROVAL_DIR || path.join(로컬, 'hermes', 'runtime', 'synk-approvals');
const 잠깐 = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const 지금 = () => new Date().toISOString();

function 가리기(글) {
  return String(글 ?? '')
    .replace(/\b(?:sk-|sk-ant-|ghp_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_-]{8,}/g, '[숨김]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [숨김]')
    .replace(/((?:api[_ -]?key|(?:access|refresh|auth)?[_ -]?token|password|secret|비밀번호|토큰)\s*[:=]\s*)\S+/gi, '$1[숨김]');
}

/** 알림에 넣을 글에서 내부 번호(세션·작업 ID, 해시, 긴 숫자)와 제어 문자를 빼고 한 줄로 줄인다. */
function 다듬기(글, 한도 = 160) {
  let s = 가리기(글)
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\bsynk-[0-9a-f]{12}\b/gi, '')
    .replace(/\btoolu_[A-Za-z0-9]+/g, '')
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,64}\b/gi, '')
    .replace(/\b\d{8,}\b/g, '')
    .replace(/\(\s*[,·]?\s*\)|\[\s*\]|「\s*」/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([(\[「])\s+|\s+([)\]」])/g, '$1$2')
    .trim();
  s = s.replace(/^[\s"'`「『“‘*]+|[\s"'`」』”’*]+$/g, '').trim();
  return s.length > 한도 ? s.slice(0, 한도 - 1) + '…' : s;
}

function 쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 2) + '\n');
  for (let i = 0; ; i++) {
    try { fs.renameSync(임시, 파일); return; } catch (e) {
      if (i >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) { fs.rmSync(임시, { force: true }); throw e; }
      잠깐(40 * (i + 1)); // 헤르메스가 같은 파일을 읽는 그 순간이면 Windows가 잠깐 거절한다
    }
  }
}

function 읽기(파일) {
  try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return null; }
}

/** 같은 세션 기록을 동시에 고치지 않게 잡는다(같은 차례에 병렬 도구 호출이 둘 다 막힐 수 있다). */
function 잠그고(파일, 일) {
  const 잠금 = 파일 + '.lock';
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(잠금, String(process.pid), { flag: 'wx' }); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 나이 = 0;
      try { 나이 = Date.now() - fs.statSync(잠금).mtimeMs; } catch { continue; }
      if (나이 > 90 * 1000) { fs.rmSync(잠금, { force: true }); continue; } // 주인이 죽고 남은 잠금
      if (i > 150) throw new Error('기록 잠금을 얻지 못했다');
      잠깐(100);
    }
  }
  try { return 일(); } finally { fs.rmSync(잠금, { force: true }); }
}

function 첫사용자글(기록경로) {
  let 글 = '';
  try {
    const fd = fs.openSync(기록경로, 'r');
    try {
      const 버퍼 = Buffer.alloc(256 * 1024);
      글 = 버퍼.subarray(0, fs.readSync(fd, 버퍼, 0, 버퍼.length, 0)).toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return null; }
  for (const 줄 of 글.split('\n')) {
    let j;
    try { j = JSON.parse(줄); } catch { continue; }
    if (j?.type !== 'user' || !j.message) continue;
    const c = j.message.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((x) => x?.type === 'text')?.text ?? '') : '';
    if (t) return t;
  }
  return null;
}

/** 사람 없는 실행이면 {kind, name}, 아니면 null. */
function 출처찾기(입력, 환경 = process.env) {
  const 표 = String(환경.SYNK_UNATTENDED || '').trim();
  if (표) {
    const i = 표.indexOf(':');
    const kind = (i < 0 ? 표 : 표.slice(0, i)).trim();
    const name = (i < 0 ? '' : 표.slice(i + 1)).trim().slice(0, 80);
    if (/^[a-z][a-z-]{1,30}$/.test(kind)) return { kind, name };
  }
  // 앱 예약 작업: 첫 사용자 메시지가 <scheduled-task name="…" file="…"> 로 시작한다(10-19 실제 기록에서 확인).
  const 첫글 = 첫사용자글(입력.transcript_path);
  const m = 첫글 && /^\s*<scheduled-task\s+name="([^"]{1,120})"/.exec(첫글);
  return m ? { kind: 'scheduled-task', name: m[1] } : null;
}

function 기록파일(세션, 환경) { return path.join(보관함(환경), `${세션}.json`); }

function 막힘남기기(입력, 환경, 때 = 지금()) {
  const 세션 = String(입력.session_id || '');
  const 경로 = String(입력.transcript_path || '');
  if (!세션꼴.test(세션) || !path.isAbsolute(경로) || path.basename(경로).toLowerCase() !== `${세션}.jsonl`.toLowerCase()) return null;
  const 출처 = 출처찾기(입력, 환경);
  if (!출처) return null;
  const 파일 = 기록파일(세션, 환경);
  return 잠그고(파일, () => {
    let 기록 = 읽기(파일);
    if (!기록 || 기록.session_id !== 세션) {
      기록 = { version: 1, session_id: 세션, created_at: 때, state: 'recording', denials: [], history: [] };
    } else if (기록.state !== 'recording') {
      // 알린 뒤(또는 이어 간 뒤) 같은 세션이 또 막혔다 — 지난 알림은 내력으로 옮기고 새로 모은다.
      기록.history = [...(기록.history || []), { at: 때, state: 기록.state, notice: 기록.notice ?? null, continued: 기록.continued ?? null, denials: 기록.denials ?? [] }].slice(-10);
      Object.assign(기록, { state: 'recording', denials: [] });
      delete 기록.notice; delete 기록.asked_at; delete 기록.continued;
    }
    const 도구입력 = 입력.tool_input && typeof 입력.tool_input === 'object' ? 입력.tool_input : {};
    const 명령 = typeof 도구입력.command === 'string' ? 도구입력.command : JSON.stringify(도구입력);
    if (!기록.denials.some((d) => d.tool_use_id && d.tool_use_id === 입력.tool_use_id)) {
      기록.denials.push({
        at: 때, tool_name: String(입력.tool_name || ''), tool_use_id: String(입력.tool_use_id || ''),
        description: 다듬기(도구입력.description || '', 160), command: 가리기(명령).slice(0, 300), reason: String(입력.reason || '').slice(0, 160),
      });
    }
    Object.assign(기록, {
      transcript_path: 경로, cwd: String(입력.cwd || ''), source: 출처, updated_at: 때,
      claude_pid: Number(환경.CLAUDE_PID) || 기록.claude_pid || null,
      // 사람이 보는지(앱 예약 작업에서 이 값이 0인지는 아직 실측 전이라 기록만 한다)
      attended: 환경.CLAUDE_CODE_SESSION_ATTENDED ?? 기록.attended ?? null,
      entrypoint: 환경.CLAUDE_CODE_ENTRYPOINT ?? 기록.entrypoint ?? null,
    });
    쓰기(파일, 기록);
    return 기록;
  });
}

/** Claude가 마지막 답 끝에 쓴 「막힌 일: …」「이어갈 문장: …」 두 줄을 읽는다(마지막 것). */
function 두줄읽기(글) {
  const s = String(글 || '');
  const 뽑기 = (이름) => {
    const re = new RegExp(`^[\\s>*\\-•]*(?:\\*\\*)?${이름}(?:\\*\\*)?\\s*[:：]\\s*(.+)$`, 'gm');
    let 값 = null;
    for (let m = re.exec(s); m; m = re.exec(s)) 값 = m[1];
    return 값 ? 다듬기(값, 이름.startsWith('막힌') ? 160 : 120) || null : null;
  };
  return { what: 뽑기('막힌\\s*일'), sentence: 뽑기('이어갈\\s*문장') };
}

/** 두 줄이 없을 때: 흔한 꼴(git push)은 문장을 지어 주고, 아니면 Claude가 쓴 도구 설명으로 「막힌 일」만 쓴다. */
function 대신짓기(기록) {
  const d = 기록.denials[기록.denials.length - 1] || {};
  const m = /\bgit\b(?:\s+-C\s+\S+)?\s+push\b([^\n;&|]*)/.exec(d.command || '');
  if (m) {
    const 강제 = /(?:^|\s)(?:--force(?:-with-lease)?|-f)(?:\s|$|=)/.test(m[1]);
    const 낱말 = m[1].trim().split(/\s+/).filter((w) => w && !w.startsWith('-'));
    const 대상 = 다듬기([낱말[0] || 'origin', 낱말[1] || ''].join(' ').trim(), 80);
    return { what: `${대상}에 ${강제 ? '강제 ' : ''}push`, sentence: `${대상}에 ${강제 ? '강제 ' : ''}push해` };
  }
  return { what: d.description || `${d.tool_name || '도구'} 실행`, sentence: null };
}

function 출처말(출처 = {}) {
  if (출처.kind === 'scheduled-task') return '예약 작업';
  if (출처.kind === 'hermes') return '휴대폰에서 맡긴 작업';
  if (출처.kind === 'continue') return '이어 가던 작업';
  if (출처.kind === 'credit-job' && 출처.name) return `예약 작업 「${다듬기(출처.name, 40)}」`;
  return '사람 없이 돌던 작업';
}

function 알림만들기(기록, 두줄 = {}) {
  const 대신 = 대신짓기(기록);
  const what = 두줄.what || 대신.what;
  const sentence = 두줄.sentence || 대신.sentence;
  const 줄 = [`자동 모드가 ${출처말(기록.source)}의 한 단계를 막아 그 단계만 건너뛰었어요.`, `막힌 일: ${what}`];
  if (sentence) 줄.push('이어 가려면 아래 문장을 그대로 보내 주세요(이 알림에 답장해도 돼요).', sentence);
  else 줄.push('이어 가려면 이 알림에 답장으로 할 일과 그 대상을 함께 적어 보내 주세요.');
  줄.push('건너뛴 채로 두려면 이 알림에 「취소」라고 답장해 주세요.');
  return { what, sentence, text: 줄.join('\n') };
}

function 보내기(글, 환경 = process.env) {
  if (환경.SYNK_TG_DRYRUN_DIR) {
    fs.mkdirSync(환경.SYNK_TG_DRYRUN_DIR, { recursive: true });
    const message_id = `dryrun-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    fs.writeFileSync(path.join(환경.SYNK_TG_DRYRUN_DIR, `${message_id}.txt`), 글);
    return { ok: true, message_id, method: 'dryrun' };
  }
  const 임시 = path.join(os.tmpdir(), `synk-tg-approval-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(임시, 글, 'utf8');
  try {
    const r = spawnSync(헤르메스, ['send', '--json', '-t', 텔레그램대상, '-f', 임시], { encoding: 'utf8', windowsHide: true, timeout: 45000 });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* 아래에서 실패로 남긴다 */ }
    if (r.status === 0 && j?.success === true && j.message_id) return { ok: true, message_id: String(j.message_id), method: 'hermes' };
    return { ok: false, method: 'hermes', error: 가리기(r.error?.message || j?.error || r.stderr || r.stdout || `종료 ${r.status}`).slice(0, 300) };
  } finally { fs.rmSync(임시, { force: true }); }
}

/** Stop: 막힌 일이 있으면 두 줄을 받아(없으면 한 번 요청) 알림을 한 통 보낸다. 표준출력으로 낼 글을 돌려준다. */
function 멈춤처리(입력, 환경, { 보내는일 = 보내기, 때 = 지금() } = {}) {
  const 세션 = String(입력.session_id || '');
  if (!세션꼴.test(세션)) return '';
  const 파일 = 기록파일(세션, 환경);
  if (!fs.existsSync(파일)) return ''; // 대부분의 세션은 여기서 끝난다(사람이 보는 세션 포함)
  return 잠그고(파일, () => {
    const 기록 = 읽기(파일);
    if (!기록 || 기록.state !== 'recording' || !기록.denials?.length) return '';
    const 두줄 = 두줄읽기(입력.last_assistant_message);
    if (!두줄.what && !입력.stop_hook_active && !기록.asked_at && 기록.source?.kind !== 'hermes') {
      기록.asked_at = 때;
      쓰기(파일, 기록);
      // 오류가 아닌 안내로 한 차례만 더 잇는다(공식 Stop additionalContext · stop_hook_active로 되풀이가 막힌다).
      return JSON.stringify({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: 두줄요청 } });
    }
    const 알림 = 알림만들기(기록, 두줄);
    let 결과;
    try { 결과 = 보내는일(알림.text, 환경); } catch (e) { 결과 = { ok: false, method: 'error', error: 가리기(e.message).slice(0, 300) }; }
    기록.notice = { what: 알림.what, sentence: 알림.sentence, text: 알림.text, sent_at: 때, message_id: 결과.message_id ?? null, method: 결과.method, error: 결과.error ?? null };
    기록.state = 결과.ok ? 'notified' : 'notify_failed';
    기록.updated_at = 때;
    쓰기(파일, 기록);
    return '';
  });
}

function 훅처리(입력, 환경 = process.env, 옵션 = {}) {
  if (!입력 || typeof 입력 !== 'object') return '';
  if (입력.hook_event_name === 'PermissionDenied') { 막힘남기기(입력, 환경, 옵션.때); return ''; }
  if (입력.hook_event_name === 'Stop') return 멈춤처리(입력, 환경, 옵션);
  return '';
}

/* ── 켜기·끄기: ~/.claude/settings.json 의 hooks 에 두 줄만 더하고 뺀다 ───────────────────────── */

function 훅항목(노드 = process.execPath, 도구 = __filename) {
  return { type: 'command', command: 노드.replace(/\\/g, '/'), args: [도구.replace(/\\/g, '/'), '훅'], timeout: 60 };
}

const 우리훅인가 = (h) => [h?.command, ...(Array.isArray(h?.args) ? h.args : [])].some((x) => /텔레그램승인\.js/.test(String(x ?? '')));

/** 크레딧 전용 설정 폴더에 옮길 때처럼, 우리 두 훅만 골라낸다(다른 훅은 옮기지 않는다). */
function 승인훅만(훅들) {
  if (!훅들 || typeof 훅들 !== 'object') return null;
  const 결과 = {};
  for (const 사건 of 훅사건) {
    const 묶음 = (Array.isArray(훅들[사건]) ? 훅들[사건] : [])
      .map((m) => ({ ...m, hooks: (m.hooks || []).filter(우리훅인가) }))
      .filter((m) => m.hooks.length);
    if (묶음.length) 결과[사건] = 묶음;
  }
  return Object.keys(결과).length ? 결과 : null;
}

function 켜기계획(설정, 항목 = 훅항목()) {
  const 새 = structuredClone(설정 || {});
  새.hooks = 새.hooks && typeof 새.hooks === 'object' ? 새.hooks : {};
  for (const 사건 of 훅사건) {
    const 묶음 = Array.isArray(새.hooks[사건]) ? 새.hooks[사건] : (새.hooks[사건] = []);
    if (!묶음.some((m) => (m.hooks || []).some(우리훅인가))) 묶음.push({ hooks: [{ ...항목 }] });
  }
  return 새;
}

function 끄기계획(설정) {
  const 새 = structuredClone(설정 || {});
  if (!새.hooks || typeof 새.hooks !== 'object') return 새;
  for (const 사건 of 훅사건) {
    if (!Array.isArray(새.hooks[사건])) continue;
    const 남김 = 새.hooks[사건].map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !우리훅인가(h)) })).filter((m) => m.hooks.length);
    if (남김.length) 새.hooks[사건] = 남김; else delete 새.hooks[사건];
  }
  return 새;
}

/** hooks 말고는 한 칸도 달라지지 않았는지(특히 autoMode) 본다. */
function hooks말고같은가(옛, 새) {
  const 빼기 = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k !== 'hooks'));
  return JSON.stringify(빼기(옛)) === JSON.stringify(빼기(새));
}

function 설정바꾸기(동작, { 실행 = false, 설정파일 = path.join(os.homedir(), '.claude', 'settings.json'), 항목 = 훅항목() } = {}) {
  const 원문 = fs.readFileSync(설정파일, 'utf8');
  const 옛 = JSON.parse(원문);
  const 새 = 동작 === '켜기' ? 켜기계획(옛, 항목) : 끄기계획(옛);
  if (!hooks말고같은가(옛, 새)) throw new Error('hooks 밖의 칸이 달라져 멈췄다(autoMode 등은 손대지 않는다)');
  const 바뀜 = JSON.stringify(옛.hooks ?? null) !== JSON.stringify(새.hooks ?? null);
  const 요약 = { 동작, 설정파일, 바뀜, 실행, PermissionDenied: !!승인훅만(새.hooks)?.PermissionDenied, Stop: !!승인훅만(새.hooks)?.Stop };
  if (!실행 || !바뀜) return 요약;
  const 들여쓰기 = /\n( +)"/.exec(원문)?.[1]?.length || 2;
  const 시각 = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const 백업 = `${설정파일}.bak-${시각}-텔레그램승인`;
  fs.copyFileSync(설정파일, 백업);
  const 임시 = `${설정파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(새, null, 들여쓰기) + (원문.endsWith('\n') ? '\n' : ''));
  const 다시 = JSON.parse(fs.readFileSync(임시, 'utf8'));
  if (!hooks말고같은가(옛, 다시)) { fs.rmSync(임시, { force: true }); throw new Error('쓴 결과를 다시 읽으니 hooks 밖이 달라 멈췄다'); }
  fs.renameSync(임시, 설정파일);
  return { ...요약, 백업 };
}

function 목록(환경 = process.env) {
  const 방 = 보관함(환경);
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(방).filter((n) => /\.json$/.test(n)); } catch { return []; }
  return 이름들.map((n) => 읽기(path.join(방, n))).filter((r) => r?.session_id)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((r) => ({ 세션: r.session_id, 상태: r.state, 출처: 출처말(r.source), 막힌일: r.notice?.what ?? r.denials?.at(-1)?.description ?? null,
      이어갈문장: r.notice?.sentence ?? null, 알림: r.notice?.sent_at ?? null, 작업폴더: r.cwd }));
}

function 오류남기기(e, 환경 = process.env) {
  try {
    fs.mkdirSync(보관함(환경), { recursive: true });
    fs.appendFileSync(path.join(보관함(환경), '훅오류.log'), `${지금()} ${가리기(e?.stack || e).slice(0, 600)}\n`);
  } catch { /* 훅은 어떤 경우에도 Claude를 멈추지 않는다 */ }
}

module.exports = { 훅처리, 막힘남기기, 멈춤처리, 출처찾기, 두줄읽기, 대신짓기, 알림만들기, 다듬기, 보내기, 훅항목, 우리훅인가, 승인훅만, 켜기계획, 끄기계획, hooks말고같은가, 설정바꾸기, 목록, 보관함, 두줄요청 };

if (require.main === module) {
  const [명령, ...나머지] = process.argv.slice(2);
  if (명령 === '훅') {
    let 글 = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { 글 += d; });
    process.stdin.on('end', () => {
      try {
        const 출력 = 훅처리(JSON.parse(글));
        if (출력) process.stdout.write(출력);
      } catch (e) { 오류남기기(e); }
      process.exitCode = 0;
    });
  } else if (명령 === '목록') {
    console.log(JSON.stringify(목록(), null, 2));
  } else if (명령 === '켜기' || 명령 === '끄기') {
    try {
      console.log(JSON.stringify(설정바꾸기(명령, { 실행: 나머지.includes('--실행') }), null, 2));
      if (!나머지.includes('--실행')) console.log('미리 보기다. 바꾸려면 --실행 을 붙인다.');
    } catch (e) { console.error(e.message); process.exitCode = 1; }
  } else {
    console.error('사용: node tools/텔레그램승인.js 훅 | 목록 | 켜기 [--실행] | 끄기 [--실행]');
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
'use strict';
/**
 * 압축 뒤 영상 입구 — Claude Code SessionStart 훅(matcher "compact")이 부른다(11-13).
 *
 * 왜: 영상 세션은 문맥이 자주 압축되는데(11-10~13 영상 세션 21개에서 58번), 압축 뒤 영상 규칙 한 장(synk-video 스킬)을 다시 부른 문맥은 0/58이었다
 *   (tools/영상세션재기.js). AGENTS의 「압축 뒤 또 부른다」는 글만으로는 지켜지지 않았다. 11-13 유호님 「실수한것들이나 검수에서 지적받은부분들 …
 *   반영되고있어 ?」 → 「응, 고쳐」. 그래서 압축이 끝난 바로 그 자리에 하네스가 한 장을 문맥에 넣는다 — 세션이 기억할 필요가 없다.
 *
 * 하는 일: 훅 입력(stdin JSON — source · cwd · transcript_path)을 읽어, SYNK 작업본에서 압축(source "compact")이 났고 그 세션이 기록 끝 24MB 안에서
 *   영상 일을 한 도구를 불렀으면(어시스턴트 tool_use의 명령 · 파일 경로에 편 폴더 · 영상 도구 이름, 또는 synk-video 스킬 부름)
 *   .claude/skills/synk-video/SKILL.md 본문을 additionalContext로 내보낸다. 아니면 아무것도 내지 않는다.
 *   늘 끝 코드 0 — 이 훅 때문에 세션이 멈추지 않는다.
 * 등록: ~/.claude/settings.json hooks.SessionStart [{ matcher: "compact", hooks: [{ type: "command", command: "node <운영 사본>/tools/압축뒤입구.js" }] }]
 *   (텔레그램 승인 훅처럼 운영 사본 파일을 돌린다 — 관문·자동화 한 장). 시험: node --test tests/압축뒤입구.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

const MARK = '〔압축 뒤 영상 입구〕';
const TAIL_BYTES = 24 * 1024 * 1024;   // 세션 기록 끝 24MB만 본다(압축 직전까지의 일)
// 영상 일의 증거는 이 세션이 실제로 부른 도구의 입력(명령 · 파일 경로)에서만 찾는다 — 기록에는 스킬 목록 · 메모 같은 주입 글이 늘 들어 있어
// 그 글의 「synk-video · 시댄스」로 판정하면 거의 모든 세션이 걸린다(11-13 Fable 검수 1 — 세션 60개 가운데 59개)
const VIDEO = /synkbrief_|yuhobuilds_|PULSE_포트폴리오|크레딧내기|드리미나내기|사람움직임[.]py|컷연속성검사|최종본검사|꾸러미점검|편집전점검|컷순서[.]json|컷표[.]json|영상지시문|이미지지시문|remotion[\\/]|_master[.]mp4|최종[.]mp4/;
const BIG_LINE = 300 * 1024;            // 그림이 든 줄 — 도구 입력은 여기에 없다

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function synkRoot(cwd) {
  let dir = path.resolve(cwd || '.');
  for (let i = 0; i < 8; i++) {
    const skill = path.join(dir, '.claude', 'skills', 'synk-video', 'SKILL.md');
    if (fs.existsSync(skill) && fs.existsSync(path.join(dir, 'AGENTS.md'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

function tail(file, bytes = TAIL_BYTES) {
  try {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    try {
      const n = Math.min(size, bytes);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, size - n);
      return buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

function skillBody(root) {
  const text = fs.readFileSync(path.join(root, '.claude', 'skills', 'synk-video', 'SKILL.md'), 'utf8');
  return text.replace(/^---[\s\S]*?\n---\r?\n/, '').trim();   // 머리말(이름 · 설명)은 빼고 본문만
}

// 세션 기록(JSONL 끝 부분)에 영상 일을 한 도구 부름이 있나 — 어시스턴트 tool_use의 입력과 synk-video 스킬 부름만 본다
function didVideoWork(log) {
  for (const line of String(log || '').split('\n')) {
    if (!line || line[0] !== '{' || line.length > BIG_LINE || line.includes(MARK)) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }   // 끝 24MB의 첫 줄은 잘려 있을 수 있다
    if (o.type !== 'assistant' || o.isSidechain || !Array.isArray(o.message?.content)) continue;
    for (const b of o.message.content) {
      if (!b || b.type !== 'tool_use' || !b.input) continue;
      if (b.name === 'Skill' && /synk-video/.test(String(b.input.skill || ''))) return true;
      const said = [b.input.command, b.input.file_path, b.input.path, b.input.pattern].filter((v) => typeof v === 'string').join('\n');
      if (VIDEO.test(said)) return true;
    }
  }
  return false;
}

// 입력 → 내보낼 글(없으면 null)
function contextFor(input, { readTail = tail } = {}) {
  if (!input || input.source !== 'compact') return null;
  const root = synkRoot(input.cwd);
  if (!root) return null;
  const log = input.transcript_path ? readTail(input.transcript_path) : '';
  if (!didVideoWork(log)) return null;
  return `${MARK} 문맥이 방금 압축됐다. 이 세션은 영상 일을 하고 있었으니 압축 앞에 읽은 영상 규칙은 이제 문맥에 없다 — 아래가 synk-video 스킬 한 장 그대로다(tools/압축뒤입구.js가 넣음). `
    + '굽기 · 편집 · 검수를 이어 가기 전에 이 한 장의 단계 표에서 지금 단계를 찾고, 지시문을 쓰기 전이면 지시문 틀도 다시 연다.\n\n' + skillBody(root);
}

function main() {
  let input = null;
  try { input = JSON.parse(readStdin() || 'null'); } catch { input = null; }
  let text = null;
  try { text = contextFor(input); } catch { text = null; }
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { contextFor, didVideoWork, synkRoot, MARK, VIDEO };

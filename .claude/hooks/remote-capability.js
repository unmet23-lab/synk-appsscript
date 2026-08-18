#!/usr/bin/env node
/**
 * 원격능력 — SessionStart 훅. 「이 세션에서 «안» 되는 것」만 알린다.
 *
 * 왜 있나 (2026-08-18 · 유호 지시 「원격 걸림돌 전부 체크」):
 *   08-15~17 로컬 세션 21건에서 브라우저·메일이 잘 돌았는데, 08-18 클라우드 세션에서
 *   갑자기 안 됐다. 원인은 고장이 아니라 «기계가 다르다»였다 — `claude-in-chrome` 은
 *   유호님 PC 크롬 확장에 붙는 로컬 MCP 라 클라우드 VM 에서는 닿을 길이 없다.
 *   그런데 그 사실이 **아무 데도 안 보여서**, 유호님이 「보내줘」라고 하신 «뒤에야»
 *   내가 실측하고 「못 합니다」를 답했다. 그 왕복을 세션 «시작»으로 옮긴다.
 *
 * 설계 원칙:
 *   ① 정상(로컬)일 때는 **한 줄도 안 찍는다** — 매 세션 상주 비용은 세션 수만큼 곱해진다.
 *   ② 판별을 단정하지 않고 **실측값을 함께 찍는다**(대가: 판별이 틀려도 근거가 보여 사람이 가른다).
 *   ③ 처방은 **따를 수 있는 것**만 — 「노트북에서 열어라」는 유호님이 실제로 할 수 있다(F103).
 *
 * 틀릴 때의 모습(대가):
 *   ⓐ 로컬인데 HOST_SESSION_ID 가 빈 판 → 헛경고 1회(근거가 같이 찍히므로 사람이 바로 안다)
 *   ⓑ 클라우드인데 커넥터로 메일이 붙은 판 → 「메일 없음」이 거짓이 된다.
 *      그래서 메일 줄은 «커넥터 미설치»가 아니라 «로컬 MCP 0» 이라는 잰 값만 말한다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function mcpCount() {
  // ~/.claude.json 의 이 프로젝트 항목에 등록된 로컬 MCP 서버 수.
  // 못 읽으면 null — 「0」과 「모름」을 섞지 않는다(F207 · 미실행은 통과와 같은 모양이다).
  const raw = read(path.join(os.homedir(), '.claude.json'));
  if (!raw) return null;
  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  const here = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const buckets = [];
  if (d.mcpServers && typeof d.mcpServers === 'object') buckets.push(d.mcpServers);
  const proj = (d.projects || {})[here];
  if (proj && proj.mcpServers && typeof proj.mcpServers === 'object') buckets.push(proj.mcpServers);
  if (!buckets.length) return 0;
  return buckets.reduce((n, b) => n + Object.keys(b).length, 0);
}

const hostSid = (process.env.CLAUDE_CODE_HOST_SESSION_ID || '').trim();
const servers = mcpCount();

// 클라우드 판정 = 호스트 세션 지문이 없다. 이건 보드 지문의 원천이기도 해서(CLAUDE.md 세션 규약),
// 비어 있으면 «보드 선언 자체가 불가»라는 별개 결함과도 같은 뿌리다.
const noFingerprint = hostSid === '';
const noLocalMcp = servers === 0;

// 로컬이고 MCP 도 «재서» 있으면 조용히 나간다.
// ⚠ servers === null(못 쟀다)을 여기서 빼면 「모름」이 「정상」과 같은 모양이 된다(F207).
if (!noFingerprint && !noLocalMcp && servers !== null) process.exit(0);

const lines = [];
lines.push('🛰 **원격 능력 — 이 세션에서 «안» 되는 것**');

if (noFingerprint) {
  lines.push('   · **브라우저(`claude-in-chrome`)가 없다** → Gmail 발송·라이브 화면 확인·좌표 클릭 전부 불가.');
  lines.push('     크롬 확장은 **유호님 PC 에 붙는다** — 이 세션은 다른 기계라 켜셔도 안 닿는다.');
  lines.push('   · **보드 지문을 못 만든다**(`CLAUDE_CODE_HOST_SESSION_ID` 빈 값) → 세션 규약의 보드 선언 불가.');
  lines.push('     그래서 인계는 **커밋 메시지와 PR** 로만 남는다.');
}
if (noLocalMcp) {
  lines.push(`   · **로컬 MCP 서버 0개**(잰 값) — Notion·Canva 등 이 저장소가 쓰던 도구가 안 붙는다.`);
} else if (servers === null) {
  lines.push('   · 로컬 MCP 수를 **못 쟀다**(`~/.claude.json` 미독) — 0 이 아니라 «모름»이다.');
}

lines.push('   → **메일·라이브가 필요한 일은 노트북에서 Claude Code 를 열어 시킨다.**');
lines.push('     claude.ai 커넥터로 **Gmail** 을 붙이면 이 세션에서도 메일이 열린다(설치는 유호님 계정 몫).');
lines.push('   ✅ 여기서도 되는 것: 저장소 읽기·편집·커밋·push·PR · 웹 조회(WebFetch/WebSearch) · 파일 생성·전달');

process.stdout.write(lines.join('\n') + '\n');

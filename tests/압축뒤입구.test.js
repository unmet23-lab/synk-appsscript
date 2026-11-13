'use strict';
// 압축 뒤 영상 입구(tools/압축뒤입구.js, SessionStart 훅 matcher "compact") — 영상 일을 하던 SYNK 세션이 압축된 바로 그 자리에만
// synk-video 한 장을 넣고, 그 밖(첫 시작 · 다른 저장소 · 영상 일 없는 세션 · 깨진 입력)에는 아무것도 내지 않는지. 끝 코드는 늘 0.
// 영상 일은 어시스턴트가 부른 도구의 입력에서만 찾는다 — 기록에 늘 들어 있는 스킬 목록 · 메모 주입 글로는 판정하지 않는다(11-13 Fable 검수 1).
// tools/영상세션재기.js가 이 주입을 「압축 뒤 스킬 다시 부름」으로 세는지도 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { contextFor, didVideoWork, MARK } = require('../tools/압축뒤입구.js');

const repo = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(repo, '.claude', 'skills', 'synk-video', 'SKILL.md'), 'utf8');
const j = (o) => JSON.stringify(o) + '\n';
const bash = (command) => j({ type: 'assistant', timestamp: '2026-11-13T10:00:00.000Z', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
// 실제 기록처럼 스킬 목록 · 메모가 든 주입(첨부) 줄 — 「synk-video」 · 「시댄스」 · 「최종.mp4」 · 편 폴더 이름이 다 들어 있다
const listing = j({ type: 'attachment', attachment: { type: 'skill_listing', content: '- synk-video: AI 광고 영상 … 시댄스 Seedance … yuhobuilds_떨어뜨린영상_20261111/최종.mp4' } })
  + j({ type: 'user', message: { content: '메모: 포트폴리오 영상은 시댄스 · synkbrief_없는판결_20261111' } });

function log(t, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '압축뒤입구-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 's.jsonl');
  fs.writeFileSync(file, text);
  return file;
}

test('영상 도구를 부른 SYNK 세션이 압축되면 synk-video 한 장 본문을 넣는다', (t) => {
  const transcript = log(t, listing + bash('python -I -X utf8 tools/최종본검사.py docs/마케팅/synkbrief_없는판결_20261111/게시/b39_master.mp4'));
  const text = contextFor({ source: 'compact', cwd: path.join(repo, 'tools'), transcript_path: transcript });
  assert.ok(text && text.startsWith(MARK));
  const body = skill.replace(/^---[\s\S]*?\n---\r?\n/, '').trim();
  assert.ok(text.endsWith(body), '머리말을 뺀 한 장 본문 그대로');
  assert.ok(!/^name:/m.test(text.slice(0, 400)), '머리말(name · description)은 넣지 않는다');
  // synk-video 스킬을 부른 것도 영상 일이다
  assert.equal(didVideoWork(j({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'synk-video' } }] } })), true);
});

test('스킬 목록 · 메모 주입만 있는 세션 · 첫 시작 · 다시 열기 · 다른 저장소에는 아무것도 내지 않는다', (t) => {
  const plain = log(t, listing + bash('node tools/결정.js --추가 "…"'));
  const video = log(t, bash('node tools/올리기전검사.js docs/마케팅/yuhobuilds_떨어뜨린영상_20261111'));
  assert.equal(contextFor({ source: 'compact', cwd: repo, transcript_path: plain }), null, '주입 글의 영상 낱말로는 판정하지 않는다');
  assert.equal(contextFor({ source: 'startup', cwd: repo, transcript_path: video }), null);
  assert.equal(contextFor({ source: 'resume', cwd: repo, transcript_path: video }), null);
  assert.equal(contextFor({ source: 'compact', cwd: os.tmpdir(), transcript_path: video }), null);
  assert.equal(contextFor({ source: 'compact', cwd: repo }), null);
  assert.equal(contextFor(null), null);
  // 앞 압축에서 넣은 한 장(MARK가 든 줄)은 영상 일의 증거가 아니다 · 잘린 첫 줄 · 깨진 줄은 건너뛴다
  const marked = j({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: `echo "${MARK} yuhobuilds_x 최종.mp4"` } }] } });
  assert.equal(didVideoWork('{"type":"assi' + '\n' + marked + '{깨짐\n'), false);
});

test('훅으로 부르면 SessionStart 꼴 JSON을 내고, 깨진 입력에도 끝 코드 0', (t) => {
  const transcript = log(t, bash('npx remotion render remotion/src/index.ts'));
  const tool = path.join(repo, 'tools', '압축뒤입구.js');
  const ok = spawnSync(process.execPath, [tool], { input: JSON.stringify({ source: 'compact', cwd: repo, transcript_path: transcript }), encoding: 'utf8' });
  assert.equal(ok.status, 0);
  const out = JSON.parse(ok.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.ok(out.hookSpecificOutput.additionalContext.startsWith(MARK));
  const broken = spawnSync(process.execPath, [tool], { input: '{깨짐', encoding: 'utf8' });
  assert.equal(broken.status, 0);
  assert.equal(broken.stdout, '');
});

test('영상세션재기는 압축 뒤 훅이 넣은 한 장을 「압축 뒤 스킬 다시 부름」으로 센다', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '영상세션재기-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dir = path.join(home, '.claude', 'projects', 'C--x-SYNK-appsscript');
  fs.mkdirSync(dir, { recursive: true });
  const at = (m) => `2026-11-13T10:${String(m).padStart(2, '0')}:00.000Z`;
  fs.writeFileSync(path.join(dir, 'aaaa1111-0000.jsonl'),
    j({ type: 'user', timestamp: at(0), message: { content: '시작' } })
    + j({ type: 'user', timestamp: at(1), message: { content: 'This session is being continued from a previous conversation that ran out of context.' } })
    + j({ type: 'attachment', timestamp: at(2), attachment: { type: 'hook_additional_context', content: [`${MARK} 문맥이 방금 압축됐다`] } })
    + j({ type: 'assistant', timestamp: at(3), message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'python 크레딧내기.py --실행' } }] } }));
  const r = spawnSync(process.execPath, [path.join(repo, 'tools', '영상세션재기.js'), '--부터', '2026-11-12', '--까지', '2026-11-15', '--json'],
    { encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home } });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.합.압축, 1);
  assert.equal(out.합.압축뒤스킬, 1);
  assert.equal(out.합.제출_규칙, 1, '그 문맥의 굽기 제출은 규칙이 있던 제출로 센다');
});

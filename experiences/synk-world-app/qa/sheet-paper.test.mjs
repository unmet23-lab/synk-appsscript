// WORLD 학생 레슨 시트 종이 겉(유호님 11-23 「종이」 · 「학생 시트만」)의 경계와 닫는 길을 못박는다(Fable world-sheet-paper-20261123 F1 · F2 · F5).
// · 종이는 여섯 시트(레슨 소개 · 이야기 · 문제 · 배우기 · 놀이 · 로그인)에만 붙는다. 결과 · 복습 요약 · 카페 · 게임 · 옷장은 밤 겉 그대로다.
// · 놀이 목록은 판 종류를 비워 둔다 — 열린 채 창으로 돌아오면 계정 진도를 다시 읽어야 한다(app-shell refreshTutorAccount).
// · 이야기 장면을 닫는 중에 멈춘 타자는 배울 말 판을 열지 않고, 날던 글자를 거둔다.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const home = read('brand-opening/home.mjs');
const life = read('synk-world-app/life-ui.mjs');
const shell = read('synk-world-app/app-shell.mjs');

function paperRule() {
  const line = home.split('\n').find(l => l.includes("panel.classList.toggle('is-paper'"));
  assert.ok(line, 'openPanel이 is-paper를 정한다');
  const m = line.match(/paper\|\|\/(.+)\/\.test\(type\)/);
  assert.ok(m, '종이는 paper 선택지 또는 판 종류 정규식으로 정한다');
  const re = new RegExp(m[1]);
  return ({ type = '', paper = false }) => paper || re.test(type);
}

test('종이 겉은 학생 시트 여섯에만 붙는다', () => {
  const isPaper = paperRule();
  for (const type of ['life-library', 'life-lesson', 'life-story', 'life-question', 'world-signin']) assert.equal(isPaper({ type }), true, type);
  assert.equal(isPaper({ paper: true }), true, '놀이 목록');
  for (const type of ['', 'life-complete', 'life-review', 'life-review-complete', 'life-cafe', 'life-cafe-complete', 'life-recovery', 'game', 'wardrobe', 'world-wardrobe', 'world-town', 'world-reward', 'settings', 'memory', 'play'])
    assert.equal(isPaper({ type }), false, type || '(빈 종류)');
});

test('놀이 목록은 판 종류 없이 종이로 열려 계정 진도 다시 읽기를 막지 않는다', () => {
  const play = home.slice(home.indexOf('function showPlay('));
  const call = play.slice(0, play.indexOf('\n}\n')).match(/openPanel\(t\('play\.title'\)[\s\S]*?,(\{[^{}]*\})\);/);
  assert.ok(call, 'showPlay가 openPanel을 부른다');
  assert.match(call[1], /paper:true/);
  assert.doesNotMatch(call[1], /type:/);
  // 열린 판 종류가 없을 때만 다시 읽는다 — 놀이 목록이 종류를 가지면 다른 기기 진도로 바뀐 잠김이 그대로 남는다.
  assert.match(shell, /life\.refresh\(\{rebuild:\(\)=>!home\.openPanel\(\)\}\)/);
  assert.match(home, /openPanel:\(\)=>panelKind/);
  // 종이 놀이 목록의 겉은 판 종류 꼬리표(play-panel)가 아니라 is-paper로 고른다.
  assert.doesNotMatch(read('brand-opening/home.css'), /\.play-panel\.is-paper/);
});

test('이야기 장면을 닫는 중에는 배울 말 판을 열지 않고 날던 글자를 거둔다', () => {
  const dispose = life.match(/home\.attachPanelResource\(\{dispose\(\)\{([\s\S]*?)\}\}\);/);
  assert.ok(dispose, 'paint가 판 자원을 단다');
  const body = dispose[1].slice(dispose[1].indexOf('if(!rendering){'));
  const at = s => { const i = body.indexOf(s); assert.ok(i >= 0, s); return i; };
  // 타자를 멈추면(story.stop) onLine이 불린다 — 그 전에 shown을 내리고 날기 차례를 넘긴다.
  assert.ok(at('shown=false') < at('story.stop()'), 'shown을 먼저 내린다');
  assert.ok(at('flight++') < at('story.stop()'), '날기 차례를 먼저 넘긴다');
  assert.ok(at(".life-ghost')") < at('story.stop()'), '날던 글자를 거둔다');
  const show = life.slice(life.indexOf('function showLearn('));
  const guard = show.split('\n').find(l => l.trim().startsWith('if(rendering'));
  assert.match(guard, /rendering\|\|!shown\|\|/, '그리는 중 · 닫는 중에는 열지 않는다');
});

test('종이 시트에 영문 대문자 꼬리표를 두지 않는다', () => {
  assert.doesNotMatch(home, /<p class="eyebrow">MORE<\/p>/);
  assert.doesNotMatch(life, /<p class="life-section-label">LESSONS<\/p>/);
});

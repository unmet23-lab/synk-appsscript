'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 출처, 기준읽기, 기준글 } = require('../tools/영상기준.js');

function git(뿌리, 인자, 날 = '2020-01-02') {
  return execFileSync('git', ['-c', 'user.name=시험', '-c', 'user.email=test@example.invalid',
    '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...인자], {
    cwd: 뿌리, encoding: 'utf8', windowsHide: true, stdio: 'pipe',
    env: { ...process.env, GIT_AUTHOR_DATE: 날 + 'T12:00:00Z', GIT_COMMITTER_DATE: 날 + 'T12:00:00Z' },
  }).trim();
}

function 저장소(t) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'video-criteria-'));
  t.after(() => fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 }));
  const 공용 = path.join(임시, 'main'), 옛본 = path.join(임시, 'old');
  fs.mkdirSync(공용);
  git(공용, ['init', '-b', 'master']);
  const 행 = [1, 2, 3, 4, 5, 26].map(n => `| ${n} | 항목${n} | 첫 지적 | 확인 | 고침 |`);
  const 표 = path.join(공용, 출처.점검표);
  const 원본 = {
    제작규칙: '제작 원문', 제작절차: '제작 절차', 스킬: '## 열두 원칙 — 번호\n1. **행동을 봅니다.** 근거\n## 다음\n',
    점검표: ['## 점검표', ...행].join('\n') + '\n',
    흠갈래: '{"줄":[],"항목":{}}', 모음: '{"지적":[]}',
    LAB교훈: '{"교훈":[{"id":"L01","단계":["원본"],"할것":"글자 폭 확인"}]}',
    만족사례: '## 분야별 찾기\n| 분야 | 사례 |\n|---|---|\n| 연기 | S01 |\n## 사례\n### S01 · 연기\n- **좋았던 범위:** 표정\n- **방법:** 가까이 본다\n',
  };
  for (const [이름, 내용] of Object.entries(원본)) {
    const p = path.join(공용, 출처[이름]); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 내용);
  }
  git(공용, ['add', '.']); git(공용, ['commit', '-m', '시작']);
  git(공용, ['worktree', 'add', '--detach', 옛본, 'HEAD']);
  const 편 = path.join(옛본, '오래된 편'); fs.mkdirSync(편);
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify({ 가까운사례: 'S01 — 연기' }));
  const 읽기 = () => 기준읽기(편, { 작업본: 옛본, 편이력: false });
  return { 공용, 옛본, 표, 원본, 읽기 };
}

test('오래된 작업본에서 기존 1번 지적 한 줄을 보완하면 새 편과 재개의 근거·기준판이 즉시 바뀐다', t => {
  const { 공용, 옛본, 원본, 표, 읽기 } = 저장소(t);
  const 전 = 읽기();
  fs.writeFileSync(표, 원본.점검표.replace('항목1 | 첫 지적', '항목1 | 색이 또 흐립니다'));
  const 후 = 읽기();
  assert.equal(후.공용작업본, 공용);
  assert.notEqual(후.기준판, 전.기준판);
  assert.notEqual(후.피드백판, 전.피드백판);
  assert.deepEqual([후.최근지적[0].번호, 후.최근지적[0].말씀], [1, '색이 또 흐립니다']);
  assert.match(기준글(후), /색이 또 흐립니다/);
  assert.match(기준글(후), /좋았던 범위.*표정/);
  const 신규 = 기준읽기('그래픽', { 작업본: 옛본, 편이력: false });
  assert.equal(신규.피드백판, 후.피드백판);
  assert.equal(신규.최근지적[0].말씀, '색이 또 흐립니다');
  git(공용, ['commit', '-am', '지적 한 번 반영'], '2020-01-03');
  assert.equal(읽기().최근지적[0].번호, 1, '커밋 뒤에도 기존 번호가 앞에 온다');
  assert.equal(읽기().기준판, 후.기준판, 'Git 커밋만으로 작품 기준을 바꾸지 않는다');
  assert.equal(fs.readFileSync(path.join(옛본, 출처.점검표), 'utf8'), 원본.점검표);
});

test('공용본보다 먼저 받은 원격 지적은 곧바로 읽고, 양쪽 지적이 겹치면 명시적으로 재시도한다', t => {
  const { 공용, 옛본, 표, 읽기, 원본 } = 저장소(t);
  const 전 = 읽기();
  const 원격표 = path.join(옛본, 출처.점검표);
  fs.writeFileSync(원격표, 원본.점검표.replace('항목26 | 첫 지적', '항목26 | 손이 멈추는 버릇'));
  git(옛본, ['commit', '-am', '최신 번호 26'], '2020-01-03');
  git(공용, ['update-ref', 'refs/remotes/origin/master', git(옛본, ['rev-parse', 'HEAD'])]);
  const 후 = 읽기();
  assert.deepEqual(후.원격원문, ['점검표']);
  assert.equal(후.최근지적[0].번호, 26);
  assert.notEqual(후.피드백판, 전.피드백판);
  fs.writeFileSync(표, 원본.점검표.replace('항목26 | 첫 지적', '항목26 | 별도 보완'));
  assert.throws(읽기, /공용 수정과 받은 원격 기준/);
  fs.writeFileSync(표, fs.readFileSync(원격표));
  assert.equal(읽기().기준판, 후.기준판);
});

test('승인 사례와 지적을 읽지 못한 상태를 빈 결과로 성공 처리하지 않는다', t => {
  const { 공용, 표, 읽기, 원본 } = 저장소(t);
  fs.writeFileSync(표, 원본.점검표.replace('항목26 | 첫 지적 | 확인 | 고침', '항목26 | 중간 칸 없음'));
  assert.throws(읽기, /다섯 칸/);
  fs.writeFileSync(표, 원본.점검표);
  fs.writeFileSync(path.join(공용, 출처.만족사례), 원본.만족사례.replace('### S01', '### S02'));
  assert.throws(읽기, /S01.*찾지 못했습니다/);
  fs.unlinkSync(표);
  assert.throws(읽기, /ENOENT/);
});

test('편의 가까운사례가 바뀌면 다시 확인하고, LAB에서 나온 교훈은 LAB의 기준판만 바꾼다', t => {
  const { 공용, 옛본, 읽기, 원본 } = 저장소(t);
  const LAB = () => 기준읽기('LAB', { 작업본: 옛본, 편이력: false }).기준판;
  const 원래편 = 읽기().기준판, 원래LAB = LAB();
  fs.writeFileSync(path.join(공용, 출처.LAB교훈), 원본.LAB교훈.replace('글자 폭 확인', '말풍선까지 한 줄 폭으로'));
  assert.notEqual(LAB(), 원래LAB);
  assert.equal(읽기().기준판, 원래편);
  const 사례 = 원본.만족사례 + '\n### S02 · 소리\n- **좋았던 범위:** 음량\n';
  fs.writeFileSync(path.join(공용, 출처.만족사례), 사례);
  assert.equal(읽기().기준판, 원래편, '선택하지 않은 별도 사례가 추가됐다');
  fs.writeFileSync(path.join(옛본, '오래된 편', '컷표.json'), JSON.stringify({ 가까운사례: 'S02 — 목소리' }));
  const 새사례 = 읽기();
  assert.notEqual(새사례.기준판, 원래편);
  assert.match(기준글(새사례), /좋았던 범위.*음량/);
  fs.writeFileSync(path.join(공용, 출처.흠갈래), '{"줄":[{"번호":1,"올린검사":[{"검사":"색"}]}]}');
  assert.notEqual(읽기().기준판, 새사례.기준판);
});

test('컷순서만 있는 편에서 LAB을 지정해도 승인 사례를 편 경로에서 읽고, S01에서 S02로 바꾸면 기준과 검수 대상이 바뀐다', t => {
  const { 공용, 옛본, 원본 } = 저장소(t);
  const 편 = path.join(옛본, '오래된 편');
  const 표 = path.join(편, '컷순서.json');
  fs.renameSync(path.join(편, '컷표.json'), 표);
  fs.writeFileSync(path.join(공용, 출처.만족사례), 원본.만족사례 + '\n### S02 · 소리\n- **좋았던 범위:** 음량\n');
  const LAB = { 작업본: 옛본, 종류: 'LAB' };
  const 전 = 기준읽기(편, LAB);
  assert.equal(전.길, 'LAB');
  assert.equal(전.이력.길, 'LAB');
  assert.equal(전.만족사례.선택[0].id, 'S01');
  assert.match(기준글(전), /제작 방식 LAB/);
  assert.match(기준글(전), /좋았던 범위.*표정/);
  fs.writeFileSync(표, JSON.stringify({ 가까운사례: 'S02 — 목소리' }));
  const 후 = 기준읽기(편, LAB);
  assert.equal(후.만족사례.선택[0].id, 'S02');
  assert.match(기준글(후), /좋았던 범위.*음량/);
  assert.notEqual(후.기준판, 전.기준판);
  assert.equal(기준읽기(표, LAB).기준판, 후.기준판, '컷순서 파일을 직접 줄 때도 같다');
});

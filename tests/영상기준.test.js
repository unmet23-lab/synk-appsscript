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
  const 지정표 = path.join(편, '이번주문.json');
  fs.writeFileSync(지정표, '{}');
  fs.writeFileSync(표, 'broken legacy JSON');
  assert.deepEqual(기준읽기(지정표, LAB).만족사례.선택, [], '명시한 표만 읽는다');
  fs.writeFileSync(path.join(편, '컷표.json'), '{}');
  assert.deepEqual(기준읽기(편, LAB).만족사례.선택, [], '현행 표가 있으면 옛 표로 물러나지 않는다');
});

test('최근 지적은 말씀 칸의 가장 늦은 날로 고른다 — 표 전체를 한 커밋에서 다시 써도 모든 줄이 「최근」이 되지 않는다(11-23 점검표 압축)', t => {
  const { 공용, 표, 읽기 } = 저장소(t);
  const 행 = { 1: '11-04 「가」', 2: '11-05 「나」 11-20 「다」', 3: '11-20 「라」', 4: '10-28 「마」', 5: '(심사에서 나옴) 11-08 바', 26: '11-07 「사」 11-23 「아」' };
  const 쓰기 = 바꿈 => fs.writeFileSync(표, ['## 점검표', ...Object.entries({ ...행, ...바꿈 }).map(([n, 말씀]) => `| ${n} | 항목${n} | ${말씀} | 확인 | 고침 |`)].join('\n') + '\n');
  쓰기({});
  git(공용, ['commit', '-am', '표 전체를 한 번에 다시 씀'], '2026-11-23');
  const 한꺼번에 = 읽기();
  assert.deepEqual(한꺼번에.최근지적.map(x => x.번호), [26, 3, 2], '가장 늦은 말씀(11-23) 하나와 그다음 날들만 앞에 온다');
  쓰기({ 1: '11-04 「가」 11-24 「새 말씀」' });
  assert.equal(읽기().최근지적[0].번호, 1, '아직 커밋하지 않은 새 말씀이 맨 앞에 온다');
  쓰기({ 3: '12-28 「연말」', 4: '01-03 「새해」' });
  git(공용, ['commit', '-am', '해를 넘긴 말씀'], '2027-01-05');
  assert.equal(읽기().최근지적[0].번호, 4, '해가 없는 01-03은 고친 해(2027)로, 12-28은 그 앞 해로 읽는다');
});

// 컨셉 팩(2026-11-24) — 컷표 「컨셉」에 이름을 적은 편만 그 팩을 읽는다. 설계 docs/마케팅/제작양식/영상양식/컨셉팩_설계_20261124.md
const { 팩자리 } = require('../tools/영상기준.js');
function 팩시험(t) {
  const 저 = 저장소(t);
  const 행 = { 1: '11-04 「가」', 2: '11-05 「나」', 3: '11-20 「다」', 4: '10-28 「라」', 5: '11-08 「마」', 26: '11-23 「바」' };
  fs.writeFileSync(저.표, ['## 점검표', ...Object.entries(행).map(([n, 말씀]) => `| ${n} | 항목${n} | ${말씀} | 확인${n} | 고침${n} |`)].join('\n') + '\n');
  const 편표 = path.join(저.옛본, '오래된 편', '컷표.json');
  const 편쓰기 = 컨셉 => fs.writeFileSync(편표, JSON.stringify({ 가까운사례: 'S01 — 연기', ...(컨셉 === undefined ? {} : { 컨셉 }) }));
  const 팩 = (덧 = {}) => ({ 팩: 1, 컨셉: '코믹', 컨셉감독: { 무엇으로이기나: '웃김', 먼저볼공통줄: { 줄: [4] } },
    작가: [{ 번: '코믹-작가-1', 기준: '되풀이하다 뒤집는다', 근거: 'S55' }],
    촬영감독: [{ 번: '코믹-촬영-1', 기준: '표정이 웃음인 판은 6~8초 한 샷', 근거: 'S44', 공통과다름: 26 }], ...덧 });
  const 팩쓰기 = (값, 뿌리 = 저.공용) => {
    const p = path.join(뿌리, 팩자리, '코믹.json'); fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof 값 === 'string' ? 값 : JSON.stringify(값));
  };
  return { ...저, 편쓰기, 팩, 팩쓰기 };
}

test('컨셉이 없는 편은 팩 파일이 생겨도 출력과 기준판이 그대로다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  편쓰기();
  const 전 = 읽기();
  팩쓰기(팩());
  const 후 = 읽기();
  assert.equal(후.기준판, 전.기준판);
  assert.equal(기준글(후), 기준글(전));
  assert.equal('팩' in 후, false);
});

test('컨셉 팩이 있으면 팩 줄을 보이고, 공통과 다른 줄은 점검표 질문을 팩 문장으로 바꾸고, 먼저 볼 줄을 최근 지적에 더한다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  편쓰기();
  const 없음 = 읽기();
  assert.deepEqual(없음.최근지적.map(x => x.번호), [26, 3, 5]);
  팩쓰기(팩());
  편쓰기('코믹');
  const 후 = 읽기();
  assert.equal(후.팩.컨셉, '코믹');
  assert.notEqual(후.기준판, 없음.기준판, '팩을 읽는 편은 기준판이 바뀐다');
  const 글 = 기준글(후);
  assert.match(글, /컨셉 팩 「코믹」 웃김/);
  assert.match(글, /코믹-촬영-1 {2}표정이 웃음인 판은 6~8초 한 샷 {2}\(점검표 #26 대신\)/);
  assert.match(글, /코믹-작가-1 {2}되풀이하다 뒤집는다/);
  assert.match(글, /먼저 볼 점검표 줄 {2}#4/);
  assert.match(글, /^컨셉팩 {2}.*코믹\.json$/m);
  const 줄26 = 후.최근지적.find(x => x.번호 === 26);
  assert.match(줄26.확인, /팩 줄을 기준으로 본다\(코믹-촬영-1\)\. 표정이 웃음인 판은/);
  assert.equal(후.점검표.find(x => x.번호 === 26).확인, 줄26.확인, '종전 지적 목록도 같은 문장이다');
  assert.equal(후.점검표.find(x => x.번호 === 3).확인, '확인3', '팩이 다루지 않는 줄은 그대로다');
  assert.deepEqual(후.최근지적.map(x => x.번호), [26, 3, 5, 4]);
  assert.equal(후.최근지적.at(-1).먼저볼, '코믹');
  팩쓰기(팩({ 작가: [{ 번: '코믹-작가-1', 기준: '끝에 반전 한 번', 근거: 'S19' }] }));
  assert.notEqual(읽기().기준판, 후.기준판, '팩을 고치면 그 컨셉 편의 기준판이 바뀐다');
});

test('팩이 없는 컨셉과 이름 꼴이 아닌 컨셉은 멈추지 않고 공통 기준만 쓴다', t => {
  const { 공용, 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  편쓰기();
  const 없음 = 읽기();
  팩쓰기(팩());
  편쓰기('감동');
  const 감동 = 읽기();
  assert.equal(감동.팩.없음, true);
  assert.equal(감동.기준판, 없음.기준판, '팩이 없으면 기준이 같으니 기준판도 같다');
  assert.match(기준글(감동), /컨셉 「감동」의 팩이 아직 없습니다\. 공통 기준만 적용합니다\./);
  assert.deepEqual(감동.최근지적.map(x => x.확인), 없음.최근지적.map(x => x.확인));
  fs.writeFileSync(path.join(공용, 팩자리, '..', '밖.json'), JSON.stringify(팩({ 컨셉: '밖' })));
  편쓰기('../밖');
  const 밖 = 읽기();
  assert.equal(밖.팩.없음, true);
  assert.match(밖.팩.까닭, /글자와 숫자/);
  편쓰기('');
  assert.equal('팩' in 읽기(), false, '빈 컨셉은 컨셉이 없는 것과 같다');
});

test('깨진 팩은 빈 결과로 넘기지 않는다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  편쓰기('코믹');
  팩쓰기('{ 깨진');
  assert.throws(읽기, /컨셉 팩 .*코믹\.json을 읽을 수 없습니다/);
  팩쓰기(팩({ 컨셉: '감동' }));
  assert.throws(읽기, /파일 이름과 다릅니다/);
  팩쓰기(팩({ 촬영감독: [{ 번: '코믹-촬영-1', 기준: '한 샷', 공통과다름: 99 }] }));
  assert.throws(읽기, /점검표에 없는 번호 99/);
  팩쓰기(팩({ 작가: { 번: '코믹-작가-1' } }));
  assert.throws(읽기, /줄 목록이어야/);
  팩쓰기(팩({ 작가: [{ 번: '코믹-작가-1', 기준: ' ' }] }));
  assert.throws(읽기, /「번」과 「기준」/);
});

// 11-24 유호님 「컨셉마다 전부 기승전결 적용해서 만드는거 적용 되어있어?」 → 「넣어줘」
test('팩의 기승전결 모양을 한 줄로 보이고, 검사가 있는 팩은 T24가 본다고 알리며, 빈 띠가 있는 모양은 멈춘다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  const 모양 = { 기: '버릇을 세운다', 승: '되풀이해 쌓는다', 전: '터지기 직전', 결: '반전 한 방' };
  편쓰기('코믹');
  팩쓰기(팩());
  assert.doesNotMatch(기준글(읽기()), /기승전결/, '모양이 없는 팩은 그 줄을 쓰지 않는다');
  팩쓰기(팩({ 기승전결: { 모양, 검사: { 가장센: '결' }, 근거: 'S55' } }));
  const 후 = 읽기();
  assert.deepEqual(후.팩.모양, { ...모양, 검사: true });
  assert.match(기준글(후), /^ {2}기승전결 {2}기 버릇을 세운다 → 승 되풀이해 쌓는다 → 전 터지기 직전 → 결 반전 한 방 {2}\(컷 연속성 검사 T24가 감정흐름으로 본다\)$/m);
  팩쓰기(팩({ 기승전결: { 모양, 근거: '바깥 본보기' } }));
  assert.match(기준글(읽기()), /^ {2}기승전결 {2}기 버릇을 세운다 → .* → 결 반전 한 방$/m, '검사가 없는 팩은 모양만');
  팩쓰기(팩({ 기승전결: { 모양: { ...모양, 결: ' ' } } }));
  assert.throws(읽기, /기승전결\.모양은 기 · 승 · 전 · 결마다 한 문장/);
  팩쓰기(팩({ 기승전결: '반전' }));
  assert.throws(읽기, /기승전결\.모양은/);
});

// 11-24 유호님 「컨셉별로 카메라 엥글 사용법이 다 재각각일텐데 … 각 카메라감독이 잘 배치되어있는지」 → 「재서 넣어 줘」
test('팩의 앵글 견줄 값을 한 줄로 보이고, 20컷이 안 되면 참고만이라고 알리며, 꼴이 틀리면 멈춘다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  const 앵글 = { 잰컷: 69, 가까이: 38, 눈높이밖: 25, 정면밖: 55, 뻔한앵글: 12, 크기: { 클로즈: 20 }, 근거: '본보기 둘' };
  편쓰기('코믹');
  팩쓰기(팩());
  assert.doesNotMatch(기준글(읽기()), /촬영 견줄 값/, '앵글이 없는 팩은 그 줄을 쓰지 않는다');
  팩쓰기(팩({ 앵글 }));
  const 후 = 읽기();
  assert.deepEqual(후.팩.앵글, { 잰컷: 69, 가까이: 38, 눈높이밖: 25, 정면밖: 55, 뻔한앵글: 12 });
  assert.match(기준글(후), /^ {2}촬영 견줄 값 {2}가까운 컷 38% · 눈높이 밖 25% · 정면 밖 55% · 사람 컷의 허리 위 · 눈높이 · 정면 12% {2}\(본보기 69컷 — 컷 연속성 검사 T29가 견준다\)$/m);
  팩쓰기(팩({ 앵글: { ...앵글, 잰컷: 3 } }));
  assert.match(기준글(읽기()), /\(본보기 3컷 — 컷이 적어 참고만 한다\)$/m);
  팩쓰기(팩({ 앵글: { ...앵글, 정면밖: 120 } }));
  assert.throws(읽기, /앵글\(과 앵글\.만족\)은 잰컷\(수\)과 가까이 · 눈높이밖 · 정면밖 · 뻔한앵글\(0~100\)/);
  팩쓰기(팩({ 앵글: { ...앵글, 잰컷: '69' } }));
  assert.throws(읽기, /앵글\(과 앵글\.만족\)은 잰컷/);
  // 만족하신 우리 편의 앵글(11-24 「재서 올려 줘」) — 20컷 넘게 쟀으면 검사는 그 값과 견주고 본보기는 참고로 남는다
  const 만족 = { 잰컷: 41, 가까이: 52, 눈높이밖: 10, 정면밖: 45, 뻔한앵글: 20, 근거: 'S44 · S55' };
  팩쓰기(팩({ 앵글: { ...앵글, 만족 } }));
  const 만족후 = 읽기();
  assert.deepEqual(만족후.팩.앵글.만족, { 잰컷: 41, 가까이: 52, 눈높이밖: 10, 정면밖: 45, 뻔한앵글: 20 });
  assert.match(기준글(만족후), /^ {2}만족하신 편의 앵글 {2}가까운 컷 52% · 눈높이 밖 10% · 정면 밖 45% · 사람 컷의 허리 위 · 눈높이 · 정면 20% {2}\(41컷 — 컷 연속성 검사 T29가 견준다\)$/m);
  assert.match(기준글(만족후), /^ {2}촬영 견줄 값 {2}.*\(본보기 69컷 — 참고\)$/m);
  팩쓰기(팩({ 앵글: { ...앵글, 만족: { ...만족, 잰컷: 8 } } }));
  const 적음 = 기준글(읽기());
  assert.match(적음, /\(8컷 — 컷이 적어 참고만 한다\)$/m);
  assert.match(적음, /\(본보기 69컷 — 컷 연속성 검사 T29가 견준다\)$/m);
  팩쓰기(팩({ 앵글: { ...앵글, 만족: { ...만족, 가까이: -1 } } }));
  assert.throws(읽기, /앵글\(과 앵글\.만족\)은/);
});

test('공용본에 아직 없는 팩도 받은 원격에 있으면 그 팩을 읽는다', t => {
  const { 공용, 옛본, 읽기, 편쓰기, 팩, 팩쓰기 } = 팩시험(t);
  git(공용, ['add', '.']); git(공용, ['commit', '-m', '점검표 날짜'], '2020-01-03');
  git(옛본, ['checkout', '--detach', git(공용, ['rev-parse', 'HEAD'])]);
  편쓰기('코믹');
  팩쓰기(팩(), 옛본);
  git(옛본, ['add', 팩자리]); git(옛본, ['commit', '-m', '코믹 팩'], '2020-01-04');
  git(공용, ['update-ref', 'refs/remotes/origin/master', git(옛본, ['rev-parse', 'HEAD'])]);
  assert.equal(fs.existsSync(path.join(공용, 팩자리, '코믹.json')), false);
  const 후 = 읽기();
  assert.equal(후.팩.컨셉, '코믹');
  assert.ok(후.원격원문.includes('컨셉팩'));
  assert.match(기준글(후), /^컨셉팩 {2}git show [0-9a-f]+:docs\/마케팅\/제작양식\/영상양식\/컨셉팩\/코믹\.json$/m);
});

// 11-25 유호님 「카메라감독한테 몇미리(렌즈mm) 이것도 설정하는게 있어야」 → 「지금 해 줘」
test('팩이 있는 편은 렌즈 계획의 그 컨셉 줄을 보이고, 렌즈 계획이 바뀌어도 기준판은 그대로다', t => {
  const { 읽기, 편쓰기, 팩, 팩쓰기, 공용 } = 팩시험(t);
  편쓰기('코믹');
  팩쓰기(팩());
  const 전 = 읽기();
  assert.doesNotMatch(기준글(전), /렌즈 출발 묶음/, '렌즈 계획이 없으면 그 줄을 쓰지 않는다');
  const 쓰기 = 글 => fs.writeFileSync(path.join(공용, 'docs', '마케팅', '제작양식', '영상양식', '렌즈_계획.md'), 글);
  쓰기(['# 렌즈', '', '## 컨셉마다 출발 묶음', '', '| 컨셉 | 출발 묶음 | 까닭 |', '|---|---|---|',
    '| 코믹 | 24 · 35 · 50 | 몸 개그는 넓게 |', '| 감동 | 35 · 85 | 얼굴은 85 |', '', '## 고르는 법', '', '| 코믹 | 99 | 다른 절의 줄 |', ''].join('\n'));
  const 후 = 읽기();
  assert.deepEqual(후.팩.렌즈, { 묶음: '24 · 35 · 50', 까닭: '몸 개그는 넓게' });
  assert.match(기준글(후), /^ {2}렌즈 출발 묶음 {2}24 · 35 · 50mm — 몸 개그는 넓게 {2}\(docs\/마케팅\/제작양식\/영상양식\/렌즈_계획\.md/m);
  assert.equal(후.기준판, 전.기준판, '출발값이라 첫 컷 확인을 다시 받지 않는다');
  쓰기('## 컨셉마다 출발 묶음\n\n| 감동 | 35 · 85 | 얼굴은 85 |\n');
  assert.equal(읽기().팩.렌즈, undefined, '그 컨셉 줄이 없으면 보이지 않는다');
});

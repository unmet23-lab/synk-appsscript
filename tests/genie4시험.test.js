'use strict';

// Genie 4 열리면 시험 — 가짜 쪽·가짜 claude·가짜 키만 쓴다. 실제 네트워크·키 폴더·텔레그램은 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 작업원본 = require('../tools/크레딧작업/genie4시험.js');
const 실행기 = require('../tools/크레딧실행.js');

const 시간 = 3600 * 1000;
const 때 = (일, 시 = 9) => new Date(Date.UTC(2026, 9, 일, 시, 0, 0)); // 2026년 10월 그날(넘치면 11월)
const 답 = (o) => ({ 글: JSON.stringify(o) });

const 발표글 = '<item><title>We’re announcing Genie 4, our new world model</title><link>https://blog.google/x/introducing-genie-4/</link><guid>https://blog.google/x/introducing-genie-4/</guid><description>Today, we’re announcing Genie 4…</description></item>';
const 딴글 = '<item><title>Gemini in Chrome</title><guid>https://blog.google/x/chrome/</guid><description>New features</description></item>';
const 새글 = '<item><title><![CDATA[Genie 4 is now available in Project Genie]]></title><guid isPermaLink="true">https://blog.google/x/genie-4-project-genie/</guid></item>';
const rss = (...항목) => `<?xml version="1.0"?><rss><channel>${항목.join('')}</channel></rss>`;

// 10-30에 읽은 네 쪽의 꼴 — 제품 쪽에는 「Genie 4」가 없고 블로그에는 10-27 발표 글이 있다.
function 가짜쪽(덮개 = {}) {
  const 쪽 = {
    'https://labs.google/projectgenie': '<html><body><h1>Project Genie</h1><a href="https://deepmind.google/blog/genie-4-a-new-generation/">Learn more about Genie</a></body></html>',
    'https://gemini.google/subscriptions/': '<div>혁신적인 Genie 3 세계 모델을 사용해 실시간으로 대화형 세계를 만들고 탐험하세요.</div>',
    'https://blog.google/rss/': rss(발표글, 딴글),
    'https://deepmind.google/blog/rss.xml': rss('<item><title>Genie 4: A new generation of world simulation</title><guid>https://deepmind.google/blog/genie-4/</guid></item>'),
    ...덮개,
  };
  return async (주소) => {
    const 글 = 쪽[주소];
    if (글 === undefined || 글 instanceof Error) throw 글 || new Error('없는 쪽');
    return { ok: true, status: 200, text: async () => 글 };
  };
}

function 판(덮개쪽) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-genie4-'));
  const 알림 = [];
  return {
    방, 알림,
    ctx: (지금, fetch = 가짜쪽(덮개쪽)) => ({ 방, 지금, fetch, 알림: (s) => 알림.push(s) }),
    상태: () => JSON.parse(fs.readFileSync(path.join(방, '상태.json'), 'utf8')),
    지우기: () => fs.rmSync(방, { recursive: true, force: true }),
  };
}

test('신호: 제품 쪽은 「Genie 4」 글자만(주소 속 genie-4는 세지 않음), RSS는 Genie 글마다 guid로', () => {
  const { 쪽신호, rss신호 } = 작업원본;
  assert.deepEqual(쪽신호('labs', '<a href="https://deepmind.google/blog/genie-4-x/">Learn more about Genie</a>'), []);
  assert.deepEqual(쪽신호('plans', '<div>혁신적인 Genie 3 세계 모델</div>'), []);
  assert.deepEqual(쪽신호('labs', '<p>Now powered by <b>Genie 4</b></p>'), ['labs:genie4']);
  assert.deepEqual(쪽신호('plans', '<span>Genie</span>\n  <span>4</span>'), ['plans:genie4'], '태그 사이에 끊긴 글자');
  assert.deepEqual(쪽신호('labs', 'Genie&nbsp;4'), ['labs:genie4']);
  assert.deepEqual(rss신호('blog', rss(발표글, 딴글, 새글)),
    ['blog:https://blog.google/x/introducing-genie-4/', 'blog:https://blog.google/x/genie-4-project-genie/']);
});

test('처음 읽을 때 있던 블로그 글은 기준으로 접고(AI 0), 새 Genie 글이 뜨면 띄운다 — 띄운 회차가 못 끝나면 12시간·24시간 뒤', async () => {
  const t = 판();
  try {
    let r = await 작업원본.사전확인(t.ctx(때(30)));
    assert.deepEqual([r.할일, r.이유], [false, '새 신호 없음']);
    assert.equal(t.상태().본신호.length, 2);
    assert.equal((await 작업원본.사전확인(t.ctx(때(30, 12)))).할일, false, '같은 글로는 다시 띄우지 않는다');
    const 새쪽 = 가짜쪽({ 'https://blog.google/rss/': rss(새글, 발표글, 딴글) });
    r = await 작업원본.사전확인(t.ctx(때(31), 새쪽));
    assert.deepEqual([r.할일, r.까닭, r.번째], [true, '새 신호', 1]);
    assert.deepEqual(r.새신호, ['blog:https://blog.google/x/genie-4-project-genie/']);
    assert.equal(t.상태().진행중, 때(31).toISOString());
    assert.equal(t.상태().다음, new Date(+때(31) + 12 * 시간).toISOString());
    // 그 회차가 사후까지 못 갔다 — 3시간 뒤에는 쉬고, 12시간 뒤 다시 띄우며 다음 쉼은 24시간
    r = await 작업원본.사전확인(t.ctx(new Date(+때(31) + 3 * 시간), 새쪽));
    assert.equal(r.할일, false);
    assert.equal(t.상태().AI실패, 1);
    r = await 작업원본.사전확인(t.ctx(new Date(+때(31) + 12 * 시간), 새쪽));
    assert.deepEqual([r.할일, r.까닭, r.새신호.length], [true, '다시 확인', 0]);
    assert.equal(t.상태().다음, new Date(+때(31) + 36 * 시간).toISOString());
    assert.equal(t.알림.length, 0);
  } finally { t.지우기(); }
});

test('제품 쪽에 처음부터 「Genie 4」가 있으면 첫 회차에 바로 띄운다', async () => {
  const t = 판({ 'https://labs.google/projectgenie': '<h1>Project Genie</h1><p>Now with Genie 4 — sound and live edits</p>' });
  try {
    const r = await 작업원본.사전확인(t.ctx(때(30)));
    assert.equal(r.할일, true);
    assert.deepEqual(r.새신호, ['labs:genie4']);
  } finally { t.지우기(); }
});

test('사후: 안 열렸지만 구글이 열기 시작했으면 이틀마다(알림 처음 한 번), 막히면 하루 뒤(까닭이 바뀔 때만 알림), 마치면 끝', async () => {
  const t = 판({ 'https://labs.google/projectgenie': '<p>Genie 4</p>' });
  try {
    let 자료 = await 작업원본.사전확인(t.ctx(때(30)));
    let r = await 작업원본.사후(답({ 결과: '안열림', 본것: '소리 없음 · 글 지시 칸 없음', 퍼지는중: true }), 자료, t.ctx(때(30)));
    assert.equal(r.다음, new Date(+때(30) + 48 * 시간).toISOString());
    assert.equal(t.알림.length, 1);
    assert.match(t.알림[0], /아직 안 보여요\(소리 없음 · 글 지시 칸 없음\)/);
    assert.equal((await 작업원본.사전확인(t.ctx(때(31)))).할일, false, '이틀이 안 됐다');
    자료 = await 작업원본.사전확인(t.ctx(때(32, 10)));
    assert.deepEqual([자료.할일, 자료.까닭, 자료.번째], [true, '다시 확인', 2]);
    await 작업원본.사후(답({ 결과: '안열림', 퍼지는중: true }), 자료, t.ctx(때(32, 10)));
    assert.equal(t.알림.length, 1, '안 열림 알림은 처음 한 번');

    자료 = await 작업원본.사전확인(t.ctx(때(34, 11)));
    await 작업원본.사후(답({ 결과: '막힘', 까닭: 'Project Genie 새 약관 동의 창', 유호님할일: '동의를 눌러 주시면 이어서 할게요' }), 자료, t.ctx(때(34, 11)));
    assert.equal(t.알림.length, 2);
    assert.match(t.알림[1], /새 약관 동의 창\n동의를 눌러 주시면/);
    assert.equal(t.상태().다음, new Date(+때(34, 11) + 24 * 시간).toISOString());
    자료 = await 작업원본.사전확인(t.ctx(때(35, 12)));
    await 작업원본.사후(답({ 결과: '막힘', 까닭: 'Project Genie 새 약관 동의 창' }), 자료, t.ctx(때(35, 12)));
    assert.equal(t.알림.length, 2, '같은 까닭의 막힘은 다시 알리지 않는다');

    자료 = await 작업원본.사전확인(t.ctx(때(36, 13)));
    await 작업원본.사후(답({ 결과: '시험끝', 커밋: 'abc1234', 텔레그램: '[Genie 4] 시험 끝 — 한국어 대사 오류율 18%' }), 자료, t.ctx(때(36, 13)));
    assert.match(t.알림[2], /^\[Genie 4\] 시험 끝 — 한국어 대사 오류율 18%\n결과: https:\/\/github\.com\/unmet23-lab\/synk-appsscript\/blob\/master\/experiences\/synk-world-app\/qa\/genie4-world-model-20261030\/시험\.md$/);
    const 뒤 = await 작업원본.사전확인(t.ctx(때(40)));
    assert.equal(뒤.할일, false);
    assert.match(뒤.이유, /^시험 끝/);
  } finally { t.지우기(); }
});

test('사후: 구글이 아직 안 열었으면(엉뚱한 Genie 글) 다시 보지 않고, 다시 보기는 한 달(15번)에서 멈추며 한 번 알린다', async () => {
  const t = 판({ 'https://labs.google/projectgenie': '<p>Genie 4</p>' });
  try {
    const 자료 = await 작업원본.사전확인(t.ctx(때(30)));
    const r = await 작업원본.사후({ 글: '{"결과":"안열림","본것":"소리 없음","퍼지는중":false}' }, 자료, t.ctx(때(30)));
    assert.equal(r.다음, null);
    assert.equal(t.알림.length, 0);
    assert.equal((await 작업원본.사전확인(t.ctx(때(35)))).할일, false, '새 신호가 뜰 때까지 기다린다');

    fs.writeFileSync(path.join(t.방, '상태.json'), JSON.stringify({ ...t.상태(), 진행중: 때(36).toISOString(), 다시확인: 15, 안열림알림: 때(1).toISOString() }));
    await 작업원본.사후(답({ 결과: '안열림', 퍼지는중: true }), { 시작: 때(36).toISOString() }, t.ctx(때(36)));
    assert.equal(t.상태().다음, null);
    assert.equal(t.알림.length, 1);
    assert.match(t.알림[0], /한 달 동안 이틀마다 봤는데/);
  } finally { t.지우기(); }
});

test('공개 쪽 넷을 하나도 못 읽으면 AI를 띄우지 않고, 하루(8번) 이어지면 한 번만 알린다', async () => {
  const t = 판();
  try {
    const 다막힘 = async () => { throw new Error('offline'); };
    for (let i = 0; i < 9; i++) assert.equal((await 작업원본.사전확인(t.ctx(new Date(+때(30) + i * 3 * 시간), 다막힘))).할일, false);
    assert.equal(t.알림.length, 1);
    assert.match(t.알림[0], /하루째 하나도 못 읽고/);
    await 작업원본.사전확인(t.ctx(때(32)));
    assert.equal(t.상태().읽기실패, 0);
    const 하나만 = 가짜쪽({ 'https://labs.google/projectgenie': new Error('503') });
    const r = await 작업원본.사전확인(t.ctx(때(32, 12), 하나만));
    assert.equal(r.이유, '새 신호 없음', '한 쪽만 못 읽으면 나머지로 본다');
  } finally { t.지우기(); }
});

test('상태 파일이 깨졌으면 시험을 다시 돌리지 않게 멈춘다', async () => {
  const t = 판();
  try {
    fs.writeFileSync(path.join(t.방, '상태.json'), '{"끝":"2026-11-01');
    await assert.rejects(작업원본.사전확인(t.ctx(때(30))), SyntaxError);
  } finally { t.지우기(); }
});

test('사후: 마지막 답이 JSON이 아니면 이번 회차가 쓴 결과 파일을 보고, 지난 회차 파일이면 막힘으로 남긴다', async () => {
  const t = 판({ 'https://labs.google/projectgenie': '<p>Genie 4</p>' });
  const 작업폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-genie4-work-'));
  try {
    const 작업 = { ...작업원본, 작업폴더 };
    const 파일 = path.join(작업폴더, 'output', 'genie4시험', '결과.json');
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.writeFileSync(파일, JSON.stringify({ 결과: '안열림', 퍼지는중: false }));
    fs.utimesSync(파일, 때(29), 때(29));
    let 자료 = await 작업.사전확인(t.ctx(때(30)));
    let r = await 작업.사후({ 글: '끝났습니다.' }, 자료, t.ctx(때(30)));
    assert.equal(r.결과, '막힘');
    assert.match(t.알림[0], /마지막 답을 읽지 못했어요/);

    자료 = await 작업.사전확인(t.ctx(때(31, 10)));
    fs.writeFileSync(파일, JSON.stringify({ 결과: '시험끝', 커밋: '못 올림: 공개 검사', 텔레그램: '[Genie 4] 끝' }));
    fs.utimesSync(파일, 때(31, 11), 때(31, 11));
    r = await 작업.사후({ 글: '' }, 자료, t.ctx(때(31, 11)));
    assert.equal(r.결과, '시험끝');
    assert.match(t.알림[1], /^\[Genie 4\] 끝\n결과는 공용 작업본 experiences\/synk-world-app\/qa\/genie4-world-model-20261030\/시험\.md에 있어요\(올리기: 못 올림: 공개 검사\)\.$/);
  } finally { t.지우기(); fs.rmSync(작업폴더, { recursive: true, force: true }); }
});

test('실행기와 맞물림: 새 신호면 시험 문서를 가리키는 지시문으로 claude를 한 번 띄우고(자동 모드 · 브라우저 허락 · git 쓰기 막음) 사후가 상태를 닫는다', async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-genie4-run-'));
  const 이전 = { ...process.env };
  const 이전fetch = globalThis.fetch;
  try {
    fs.writeFileSync(path.join(방, 'k.txt'), 'sk-ant-test-bbbb');
    fs.writeFileSync(path.join(방, '목록.json'), JSON.stringify({ 키: [{ 이름: 'K', 키파일: 'k.txt', 갱신일: 20 }] }));
    fs.writeFileSync(path.join(방, 'claude.js'), `let i='';process.stdin.on('data',d=>i+=d).on('end',()=>{
require('fs').writeFileSync(process.env.FAKE_MARK,JSON.stringify({args:process.argv.slice(2),input:i}));
console.log(JSON.stringify({type:'result',is_error:false,result:'{"결과":"안열림","본것":"소리 없음","퍼지는중":false}',total_cost_usd:0.1,num_turns:5}));});`);
    Object.assign(process.env, { SYNK_CLAUDE_KEYS: path.join(방, '목록.json'), SYNK_CLAUDE_KEY_STATE: path.join(방, '키상태.json'),
      SYNK_CLAUDE_KEY_LEDGER: path.join(방, '기록.jsonl'), FAKE_MARK: path.join(방, '실행.json'), SYNK_CREDIT_NO_TELEGRAM: '1' });
    globalThis.fetch = 가짜쪽({ 'https://labs.google/projectgenie': '<p>Genie 4</p>' });
    const 확인200 = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ usage: { input_tokens: 8, output_tokens: 1 } }) });
    const 알림 = [];
    const r = await 실행기.작업돌리기('genie4시험', { 작업: 작업원본, 방: path.join(방, 'out'), 알림: (s) => 알림.push(s),
      실행파일: process.execPath, 앞인자: [path.join(방, 'claude.js')], 설정폴더: path.join(방, 'cfg'), fetch: 확인200, 지금: 때(30) });
    assert.equal(r.상태, '끝');
    const 실행 = JSON.parse(fs.readFileSync(path.join(방, '실행.json'), 'utf8'));
    assert.equal(실행.args[실행.args.indexOf('--permission-mode') + 1], 'auto');
    const 설정 = JSON.parse(실행.args[실행.args.indexOf('--settings') + 1]);
    assert.ok(설정.permissions.allow.includes('Bash(ego-browser:*)'));
    assert.ok(설정.permissions.deny.includes('Bash(git push:*)'));
    assert.match(실행.input, /experiences\/synk-world-app\/qa\/genie4-world-model-20261030\/시험\.md/);
    assert.match(실행.input, /새 신호: labs:genie4/);
    const 상태 = JSON.parse(fs.readFileSync(path.join(방, 'out', '상태.json'), 'utf8'));
    assert.deepEqual([상태.진행중, 상태.다음, 상태.계정확인], [null, null, 1]);
    assert.equal(알림.length, 0);
  } finally {
    globalThis.fetch = 이전fetch;
    for (const k of Object.keys(process.env)) if (!(k in 이전)) delete process.env[k];
    Object.assign(process.env, 이전);
    fs.rmSync(방, { recursive: true, force: true });
  }
});

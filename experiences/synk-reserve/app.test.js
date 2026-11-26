// node --test experiences/synk-reserve/app.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const C = require('./src/copy.js');
const A = require('./src/app.js');
const T4 = require('../lab-topik4/src/copy.js');

const FORM_PAGE_OPTIONS = {
  // 홈페이지 문의 구글 폼(2026-10-23 현행 분류)의 최종 선택지 글. experiences/lab-topik4/app.test.js · ub-korea/app.test.js와 같은 목록.
  type: ['LAB · 한국어 교육', 'SHIFT · 학교·기업·기관 AI 강의', 'SHIFT · AI 강사·진로 강사 에이전시', 'SHIFT · AI 업무 자동화', 'PATH · 유학·취업 연계', 'PULSE · 제작 협업·작품 이용·광고', '출시 소식 문의'],
  consent: ['위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.'],
};

test('폼 고정 값은 구글 폼 선택지 글과 같고, 질문 번호는 같은 폼을 쓰는 쪽과 같다', () => {
  assert.ok(FORM_PAGE_OPTIONS.type.includes(C.FORM.typeValue));
  assert.ok(FORM_PAGE_OPTIONS.consent.includes(C.FORM.consentValue));
  // 화면 동의 글은 이 쪽의 목적(출시 안내)을 밝히고, 기록은 폼의 고정 선택지 글이다.
  assert.match(C.ko.consent, /출시 안내를 위한 개인정보 수집·이용에 동의합니다/);
  assert.ok(!/문의 답변/.test(C.ko.consent));
  for (const k of ['action', 'email', 'type', 'body', 'consent', 'consentValue']) assert.equal(C.FORM[k], T4.FORM[k], k);
});

test('아래 단락(11-26 「다」): 학생증 · 휴대폰 다섯 대 · 꿈 무대의 글이 세 언어로 다 있고 그림 · 영상 파일이 있다', () => {
  const webp = f => { assert.ok(fs.existsSync(f), path.relative(__dirname, f)); const b = fs.readFileSync(f); assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', `${path.basename(f)}는 webp`); };
  // 소리 없는 짧은 영상 — 휴대폰 한 대가 쪽 무게를 키우지 않게 하나에 700KB 아래. mp4는 저장소 규칙(.gitignore *.mp4)으로 git에 없다:
  // 공용 작업본에 있을 때만 재고, 없는 사본은 빌드가 공개본에서 꺼낸다(build.mjs). 첫 장면 그림(.webp)은 git에 있어 늘 본다.
  const mp4 = f => { if (!fs.existsSync(f)) return; const b = fs.readFileSync(f); assert.equal(b.toString('ascii', 4, 8), 'ftyp', `${path.basename(f)}는 mp4`); assert.ok(b.length < 700 * 1024, `${path.relative(__dirname, f)} ${b.length}바이트`); };
  // VP8X · VP8 · VP8L 머리에서 가로 · 세로를 읽는다.
  const webpSize = f => {
    const b = fs.readFileSync(f), k = b.toString('ascii', 12, 16);
    if (k === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    throw new Error(`${path.basename(f)}: 모르는 webp 머리 ${k}`);
  };
  assert.deepEqual(C.DREAMS, ['idol', 'actor']);
  for (const d of C.DREAMS) {
    const card = path.join(__dirname, 'src/img', `card-${d}.webp`), stage = path.join(__dirname, 'src/img', `stage-${d}.webp`);
    webp(card); webp(stage);
    assert.deepEqual(webpSize(card), [1320, 832], `card-${d}.webp 크기 = img 크기 속성`);
    assert.deepEqual(webpSize(stage), [900, 1599], `stage-${d}.webp 크기 = img 크기 속성`);
  }
  assert.equal(C.PHONES.length, 5);
  const ids = new Set();
  for (const p of C.PHONES) {
    assert.match(p.id, /^[a-z]+$/);
    assert.ok(!ids.has(p.id), `휴대폰 이름 겹침: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.clip || p.still, `${p.id}: 영상이나 캡처`);
    for (const l of C.LANGS) {
      for (const f of ['p', 's']) assert.ok(typeof p[l][f] === 'string' && p[l][f].trim(), `${p.id}.${l}.${f}`);
      if (p.ko.sActor) assert.ok(p[l].sActor, `${p.id}.${l}.sActor`);
      if (p.still) { webp(path.join(__dirname, 'src/shots', l, `${p.id}.webp`)); continue; }
      for (const name of p.one ? [p.id] : C.DREAMS.map(d => `${p.id}-${d}`)) {
        mp4(path.join(__dirname, 'src/clips', l, `${name}.mp4`));
        webp(path.join(__dirname, 'src/clips', l, `${name}.webp`));
      }
    }
  }
  // 캡처도 언어마다 그 언어 화면이다 — 한국어 한 장을 세 언어에 돌려 쓰지 않는다(Fable reserve-da F3).
  for (const p of C.PHONES.filter(x => x.still)) {
    const prints = C.LANGS.map(l => fs.readFileSync(path.join(__dirname, 'src/shots', l, `${p.id}.webp`)).toString('base64'));
    assert.equal(new Set(prints).size, C.LANGS.length, `${p.id}: 세 언어 캡처가 서로 다르다`);
  }
  // 원천 그림은 지금 쪽이 부르는 것만 둔다(11-24 판 그림 14장은 11-26 유호님 허락으로 지웠다).
  assert.deepEqual(fs.readdirSync(path.join(__dirname, 'src/img')).sort(), C.DREAMS.flatMap(d => [`card-${d}.webp`, `stage-${d}.webp`]).sort());
  for (const l of C.LANGS) { const dir = path.join(__dirname, 'src/shots', l); assert.deepEqual((fs.existsSync(dir) ? fs.readdirSync(dir) : []).sort(), C.PHONES.filter(p => p.still).map(p => `${p.id}.webp`).sort(), `src/shots/${l}`); }
  // 아직 앱에 없는 일(soonS)은 「곧 열려요」를 단다 — 학생증 얼굴로 대사하는 내 영상(11-26 유호님). 동아리 퀴즈 자리는 1화 대사 진행(scene)이다.
  assert.ok(C.PHONES.find(p => p.id === 'card').soonS);
  assert.deepEqual(C.PHONES.map(p => p.id), ['trace', 'card', 'talk', 'scene', 'fans']);
  for (const l of C.LANGS) assert.ok(C[l].soon, `${l}.soon`);
  for (const k of ['stageIdol', 'stageActor', 'stageBodyIdol', 'stageBodyActor', 'stageFree', 'soon', 'cardAltIdol', 'cardAltActor']) for (const l of C.LANGS) assert.ok(C[l][k], `${l}.${k}`);
  // 꿈 무대(승급 오디션 · 티저 · 촬영장)는 아직 안 열렸다 — 「곧 열려요」를 단다.
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  assert.match(html, /<section class="rs-stage"[^>]*>\s*<div class="rs-stage-say">\s*<span class="rs-soon" data-t="soon">곧 열려요<\/span>/);
  // 첫 화면과 폼은 11-23 판 그대로(머리 글 「SYNK 사전예약」, 마을 그림). 11-26: 첫 화면 곁에 아래로 내리라는 표시가 있고 학생증 단락으로 간다.
  assert.match(html, /<h1 id="h1" data-t="h1">SYNK 사전예약<\/h1>/);
  assert.match(html, /src="\/assets\/v11\/town-road\.webp"/);
  assert.equal(C.ko.tag, '2027년 2월 정식 출시');
  assert.match(html, /<div class="rs-top">\s*<section class="rs-hero"[\s\S]*<\/section>\s*<div class="rs-cue-rail"><a class="rs-cue" href="#me">/);
  assert.match(html, /<section class="rs-me" id="me"[\s\S]*<section class="rs-phones"[\s\S]*id="phones"[\s\S]*<section class="rs-stage"[\s\S]*<\/section>\s*<\/main>/);
  // 학생증 틀은 첫 화면 사전예약 칸(.rs-card)과 다른 이름이다 — 꿈을 바꿔도 칸이 뒤집히지 않게(카본 reserve-da A1).
  assert.match(html, /<div class="rs-idcard">/);
  // 휴대폰 목록은 넘길 수 있을 때만 app.js가 Tab 자리를 단다 — 넓은 화면에 빈 Tab 자리를 두지 않는다(Fable reserve-da2 FA2).
  assert.match(html, /<ol id="phones" aria-labelledby="phones-title"><\/ol>/);
  const css = fs.readFileSync(path.join(__dirname, 'src/reserve.css'), 'utf8');
  assert.ok(!/data-my-dream[^{]*\.rs-card\b/.test(css), '꿈 선택이 .rs-card를 건드리지 않는다');
  // 꿈 무대는 스크립트 전에도 제목과 대체 글이 있다(카본 reserve-da A3).
  assert.match(html, /<h2 id="stage-title" class="rs-stage-big">[^<]+<\/h2>/);
  assert.match(html, /<img class="rs-stage-pic"[^>]* alt="[^"]+"/);
  // 발은 synk.im 홈처럼 링크 줄과 큰 synk.
  assert.match(html, /<footer class="rs-foot">[\s\S]*<div class="rs-wm" aria-hidden="true">synk<\/div>\s*<\/footer>/);
});

test('세 언어의 글 키가 같고 빈 글이 없다', () => {
  const keys = Object.keys(C.ko).sort();
  for (const l of C.LANGS) {
    assert.deepEqual(Object.keys(C[l]).sort(), keys, l);
    for (const [k, v] of Object.entries(C[l])) assert.ok(typeof v === 'string' && v.trim(), `${l}.${k}`);
  }
  for (const o of C.INTERESTS) for (const l of C.LANGS) assert.ok(o[l], `${o.id}.${l}`);
});

test('화면 언어: ?lang → 기기 언어(몽골어 · 한국어) → 영어', () => {
  assert.equal(A.pickLang('?lang=mn', ['ko-KR']), 'mn');
  assert.equal(A.pickLang('?lang=en', ['mn']), 'en');
  assert.equal(A.pickLang('?lang=es', ['ko']), 'ko');
  assert.equal(A.pickLang('', ['en-US', 'mn-MN']), 'mn');
  assert.equal(A.pickLang('', ['ko-KR', 'en']), 'ko');
  assert.equal(A.pickLang('', ['ru-RU']), 'en');
  assert.equal(A.pickLang('', []), 'en');
});

test('들어온 곳: 짧은 영소문자 이름만, 아니면 direct', () => {
  assert.equal(A.fromKey('?from=bar-try-entry-check'), 'bar-try-entry-check');
  assert.equal(A.fromKey('?from=Topik4-Univ-QR'), 'topik4-univ-qr');
  assert.equal(A.fromKey('?from=<script>'), 'direct');
  assert.equal(A.fromKey('?from=' + 'a'.repeat(41)), 'direct');
  assert.equal(A.fromKey(''), 'direct');
});

test('해 보기 단추는 1회용 체험으로 간다(11-25 유호님 「1회성으로 플레이할수있게」): 언어와 들어온 곳을 이어 주고 WORLD 앱으로 바로 보내지 않는다', async () => {
  assert.equal(A.playUrl('ko', 'direct'), '/reserve/play/?lang=ko');
  assert.equal(A.playUrl('mn', 'synk-mn'), '/reserve/play/?lang=mn&from=synk-mn');
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  assert.equal((html.match(/data-world href="\/reserve\/play\/\?lang=ko"/g) || []).length, 3);
  assert.ok(!/href="\/world\//.test(html), '로그인이 이어지는 /world/로 보내는 링크가 없다');
  const P = await import(pathToFileURL(path.join(__dirname, 'src/play/play.mjs')).href);
  for (const [q, navs] of [['?lang=mn', ['ko-KR']], ['?lang=es', ['ko']], ['', ['en-US', 'mn-MN']], ['', ['ru-RU']], ['', []]]) assert.equal(P.pickLang(q, navs), A.pickLang(q, navs), q);
  // 돌아가는 주소: 들어온 곳이 있으면 그대로, 없으면 이 체험에서 왔다고 적는다.
  assert.equal(P.reserveUrl('?lang=ko&from=synk-mn', 'ko'), '/reserve/?from=synk-mn&lang=ko');
  assert.equal(P.reserveUrl('?lang=ko', 'mn'), '/reserve/?from=play-ep1&lang=mn');
  assert.equal(P.reserveUrl('?from=<script>', 'en'), '/reserve/?from=play-ep1&lang=en');
});

test('1회용 체험은 로그인을 읽지 않고 이 기기에 저장하지 않는다', async () => {
  const src = fs.readFileSync(path.join(__dirname, 'src/play/play.mjs'), 'utf8');
  for (const word of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'app-shell', 'seoul-entry.mjs\'', 'world-account', 'supabase']) assert.ok(!src.includes(word), word);
  assert.match(src, /save\(\) \{\}/, '틀이 넘기는 저장은 버린다');
  assert.match(src, /api\.start\(\{ at: 'title', arrival: null \}\)/, '늘 처음부터');
  assert.ok(!/SYNKLearningHost|SYNKFrontClub|SYNKPlayHost/.test(src), '계정 기록 통로를 두지 않는다');
  assert.match(src, /dramaEnabled: false/, '1화는 받아쓰기 서버를 부르지 않는 손님 통로');
});

test('1회용 체험의 부모 통로는 두 틀이 부르는 것을 모두 갖추고 계정 기능만 뺀다 — 앱의 통로가 바뀌면 여기서 걸린다', () => {
  const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
  const play = read('synk-reserve/src/play/play.mjs');
  const block = play.slice(play.indexOf('window.SYNKSeoulHost = Object.freeze({'), play.indexOf('const waiting'));
  const has = (text, name) => new RegExp(`(^|[\\s,{])${name}\\s*(\\(|:|,)`, 'm').test(text);
  const account = ['photo', 'openPhoto'];
  // 이야기 틀이 부르는 통로 칸
  const asked = [...new Set([...read('seoul-arrival/app.mjs').matchAll(/HOST\??\.([A-Za-z]+)/g)].map(m => m[1]))];
  assert.ok(asked.length >= 8);
  for (const name of asked) assert.equal(has(block, name), !account.includes(name), `HOST.${name}`);
  // 앱 host에 있는 칸 = 이 쪽의 칸 + 계정 기능
  const entry = read('synk-world-app/seoul-entry.mjs');
  const app = entry.slice(entry.indexOf('const host=Object.freeze({'), entry.indexOf('function installHost'));
  for (const name of ['ready', 'reduced', 'insets', 'save', 'prepareEpisode', 'openEpisode', 'front', 'leave', ...account]) assert.ok(has(app, name), `앱 host.${name}`);
  // 두 틀이 부모에서 찾는 통로 이름 — 새 이름이 생기면 이 쪽에도 둘지 정한다(앞 셋은 계정 기록 · 동아리장 · 오늘 한 장이라 두지 않는다)
  const hooks = new Set();
  for (const rel of ['seoul-arrival/app.mjs', 'seoul-arrival/club-call.mjs', 'drama/pilot/pilot.mjs', 'drama/pilot/learning-entry.cjs', 'drama/pilot/today/gather.mjs', 'drama/pilot/today/screen.mjs'])
    for (const m of read(rel).matchAll(/parent\.(SYNK[A-Za-z]+)/g)) hooks.add(m[1]);
  assert.deepEqual([...hooks].sort(), ['SYNKDramaHost', 'SYNKFrontClub', 'SYNKLearningHost', 'SYNKSeoulHost', 'SYNKTodayHost']);
  // 1화의 손님 통로는 앱의 손님 통로와 같은 꼴
  const flat = text => text.replace(/\s+/g, '');
  const guest = "Object.freeze({status:async()=>({ok:true,guest:true,dramaEnabled:false}),take:async()=>({ok:true,status:'off'})})";
  assert.ok(flat(read('synk-world-app/app-shell.mjs')).includes(guest), '앱 손님 통로');
  assert.ok(flat(play).includes(guest), '체험 손님 통로');
  assert.match(read('synk-world-app/seoul-watch.mjs'), /export const EPISODE=[\s\S]*export function watchEpisode\(/);
});

test('1회용 체험의 글은 앱의 1화 끝 글과 같다', async () => {
  for (const [name, value] of Object.entries({ location: { search: '', hostname: 'synk.im' } })) if (!(name in globalThis)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  const { seoulText } = await import(pathToFileURL(path.join(__dirname, '../synk-world-app/seoul-entry.mjs')).href);
  const P = await import(pathToFileURL(path.join(__dirname, 'src/play/play.mjs')).href);
  for (const key of ['dramaTitle', 'trialEnd', 'trialMore', 'reserve', 'toCrowd', 'failed']) for (const l of P.LANGS) assert.equal(P.TEXT[key][l], seoulText(key, l), `${key}.${l}`);
  for (const [key, row] of Object.entries(P.TEXT)) for (const l of P.LANGS) assert.ok(typeof row[l] === 'string' && row[l].trim(), `${key}.${l}`);
});

test('이메일 미리 보기', () => {
  for (const ok of ['a@b.co', 'name.last+tag@example.mn']) assert.ok(A.validEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a@@b.co', '.a@b.co', 'a..b@c.co', 'a@-b.co', 'a b@c.co', 'a@b.c', '홍길동@example.com', 'kimㅎ@example.com', 'аbc@example.com']) assert.ok(!A.validEmail(bad), bad);
  assert.deepEqual(A.validate({ email: 'a@b.co', consent: true }), {});
  assert.deepEqual(A.validate({ email: 'x', consent: false }), { email: 'errEmail', consent: 'errConsent' });
});

test('문의 내용: 표식 · 관심 · 들어온 곳 줄(받는 쪽 약속)', () => {
  assert.equal(A.buildBody({ interests: ['job', 'korean', 'nope'], from: 'synk-mn', lang: 'mn' }),
    '[SYNK 사전예약]\n관심: 한국어 · 취업\n들어온 곳: synk-mn · 화면 언어 몽골어');
  assert.equal(A.buildBody({ interests: [], from: '', lang: 'en' }),
    '[SYNK 사전예약]\n관심: (안 고름)\n들어온 곳: direct · 화면 언어 영어');
  const again = A.buildBody({ email: 'right@example.com', prevEmail: 'wrnog@example.com', interests: ['study'], from: 'friend', lang: 'ko', resubmit: true }).split('\n');
  assert.equal(again[1], '관심: 유학');
  assert.equal(again[3], '다시 등록: 앞서 wrnog@example.com로 보낸 사전예약을 고쳐 다시 보냄(앞 등록은 버림)', '앞 응답과 짝지을 수 있게 앞 이메일을 적는다');
  assert.match(A.buildBody({ email: 'a@b.co', prevEmail: 'A@B.co', interests: [], lang: 'ko', resubmit: true }), /다시 등록: 앞서 같은 이메일로/);
  const p = A.buildPayload({ email: ' a@b.co ', interests: [], from: 'direct', lang: 'ko' });
  assert.equal(p.get('emailAddress'), 'a@b.co');
  assert.equal(p.get(C.FORM.type), '출시 소식 문의');
  assert.equal(p.get(C.FORM.consent), C.FORM.consentValue);
});

test('회사 서버가 이 문의를 「SYNK 사전예약」으로 세고 답장 할 일을 만들지 않는다', async () => {
  const mod = path.join(__dirname, '../../docs/마케팅/온라인마케팅지도/engagement/company/website-inquiry-registration.mjs');
  const { websiteInquiryRegistration } = await import(pathToFileURL(mod).href);
  for (const lang of C.LANGS) {
    const message = A.buildBody({ interests: ['korean'], from: 'bar-world', lang });
    const r = websiteInquiryRegistration({ type: C.FORM.typeValue, message });
    assert.ok(r, `${lang}: 등록으로 읽혀야 한다`);
    assert.equal(r.productId, 'app-reserve');
    assert.equal(r.waitlistOnly, true, lang);
    assert.equal(r.source, 'bar-world');
  }
  const again = websiteInquiryRegistration({ type: C.FORM.typeValue, message: A.buildBody({ interests: [], from: 'direct', lang: 'ko', resubmit: true }) });
  assert.equal(again.resubmitted, true);
});

test('친구에게 보낼 주소: from=friend, 언어 유지, 안내 띠(notice) 빠짐', () => {
  assert.equal(A.shareUrl('https://synk.im/reserve/?from=topik4-x&lang=mn&notice=topik4#signup', 'mn'), 'https://synk.im/reserve/?from=friend&lang=mn');
});

test('철수한 /lab/topik4/: 들어온 곳에 topik4-를 붙여 사전예약으로 넘긴다', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/lab-topik4.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const go = search => {
    let to = '';
    vm.runInNewContext(code, { URLSearchParams, location: { search, replace: u => { to = u; } } });
    return to;
  };
  assert.equal(go('?from=univ-shinhan-qr&lang=mn'), '/reserve/?from=topik4-univ-shinhan-qr&lang=mn&notice=topik4');
  assert.equal(go(''), '/reserve/?from=lab-topik4&notice=topik4');
  assert.equal(go('?from=Bad%20Value&lang=ru'), '/reserve/?from=lab-topik4&notice=topik4');
  const long = go('?from=' + 'a'.repeat(30) + '-' + 'b'.repeat(9));
  assert.ok(new URLSearchParams(long.split('?')[1]).get('from').length <= 40);
  assert.match(new URLSearchParams(long.split('?')[1]).get('from'), /^[a-z0-9][a-z0-9-]{0,39}$/);
  assert.match(html, /http-equiv="refresh" content="3; url=\/reserve\/\?from=lab-topik4&amp;notice=topik4"/);
});

test('출시 안내 띠: 링크가 /reserve/로 가고 들어온 곳을 bar-<경로>로 적는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../launch-notice/launch-notice.js'), 'utf8');
  const fromCode = src.match(/const fromKey = \(\) => \{([\s\S]*?)\n  \};/)[1];
  const key = pathname => new Function('location', fromCode)({ pathname });
  assert.equal(key('/try/entry-check/'), 'bar-try-entry-check');
  assert.equal(key('/world/'), 'bar-world');
  assert.equal(key('/'), 'bar-home');
  assert.equal(key('/path/interview/film/rehearsal.html'), 'bar-path-interview-film-rehearsal-html');
  assert.ok(key('/' + 'x'.repeat(80) + '/').length <= 40);
  assert.match(src, /link\.href = '\/reserve\/\?lang=' \+ RESERVE_LANG\[l\] \+ '&from=' \+ fromKey\(\);/);
  for (const l of ['ko', 'en', 'mn', 'es']) assert.match(src, new RegExp(`${l}: \\{ body: '[^']+', cta: '[^']+'`), l);
  // 데스크톱 앱 창은 /reserve/ 이동을 막으므로 그 창에서는 링크를 숨긴다.
  assert.match(src, /window\.synkDesktop \|\| window\.synkProduct/);
  assert.match(src, /link\.hidden = inDesktopApp\(\) \|\| hasOwnSignup\(\);/);
  // 자기 등록 폼이 있는 /ub/에서는 링크를 숨긴다.
  const own = new Function('location', 'return (' + src.match(/const hasOwnSignup = (\(\) => [^;]+);/)[1] + ')();');
  assert.equal(own({ pathname: '/ub/' }), true);
  assert.equal(own({ pathname: '/try/entry-check/' }), false);
});

test('폼은 스크립트가 붙기 전에 보내져도 이메일을 주소에 싣지 않는다(method=post)', () => {
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  assert.match(html, /<form id="form" method="post" action="#"/);
});

test('개인정보 안내가 실제로 보내는 항목(들어온 링크 · 화면 언어 · 앞 이메일)과 Google Forms 보관을 밝힌다', () => {
  assert.match(C.ko.privacy, /들어온 링크 표시와 화면 언어/);
  assert.match(C.ko.privacy, /앞서 적은 이메일/);
  assert.match(C.ko.privacy, /Google Forms로 접수·보관/);
  assert.match(C.ko.privacy, /동의하지 않으면/);
  assert.match(C.en.privacy, /which link brought you/);
  assert.match(C.en.privacy, /Google Forms/);
  assert.match(C.mn.privacy, /орж ирсэн холбоос/);
  assert.match(C.mn.privacy, /Google Forms/);
  const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
  assert.ok(html.includes(C.ko.privacy), '자바스크립트 없이 보이는 한국어 안내도 같다');
});

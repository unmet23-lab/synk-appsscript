'use strict';

// 공개 쪽 읽기 — 남이 적어 준 주소를 이 PC가 읽을 때 안쪽 망으로 새지 않는지, 크기 · 시간 · 형식 한계를 지키는지.
// 바깥 망은 쓰지 않는다: 이 PC의 임시 서버(127.0.0.1)에만 붙고, 그러려고 시험용 자리(lookup · 주소허용 · 포트허용)를 갈아 끼운다.
// 갈아 끼우지 않은 기본 규칙은 그 서버조차 열지 않는다는 것도 함께 본다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');

const { 읽기, 주소정리, 이름풀기, 공인주소인가, 글로, 이름표, 거절, 압축풀기 } = require('../tools/lib/공개쪽읽기.js');

let 서버, 포트;
const 열린응답 = new Set();
const 주소표 = { 'inner.example.com': '10.0.0.5', 'mixed.example.com': ['8.8.8.8', '127.0.0.1'] };
// 가짜 DNS: 표에 없으면 이 PC(127.0.0.1)로 푼다. 부른 이름을 적는다.
function 가짜풀이() {
  const 부름 = [];
  const lookup = (이름, 옵션, 돌려줌) => {
    부름.push(이름);
    const 값 = 주소표[이름] || '127.0.0.1';
    돌려줌(null, (Array.isArray(값) ? 값 : [값]).map((address) => ({ address, family: 4 })));
  };
  return { 부름, lookup };
}
const 시험선택 = (더 = {}) => ({ ...가짜풀이(), 주소허용: (주소) => 주소 === '127.0.0.1', 포트허용: (값) => 값 === 포트, ...더 });
const 곳 = (길, 이름 = 'shop.example.com') => `http://${이름}:${포트}${길}`;

before(async () => {
  서버 = http.createServer((req, res) => {
    const 길 = req.url.split('?')[0];
    const 넘김 = (갈곳) => { res.writeHead(302, { location: 갈곳 }); res.end(); };
    if (길 === '/ok') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<title>가게</title><p>안녕하세요</p>'); }
    if (길 === '/r1') return 넘김(`http://other.example.com:${포트}/ok`);
    if (길 === '/rel') return 넘김('/ok');
    if (길 === '/to-inner') return 넘김(`http://inner.example.com:${포트}/ok`);
    if (길 === '/to-ip') return 넘김(`http://127.0.0.1:${포트}/ok`);
    if (길 === '/to-meta') return 넘김('http://169.254.169.254/latest/meta-data/');
    if (길 === '/to-file') return 넘김('file:///c:/windows/win.ini');
    if (길 === '/to-port') return 넘김('http://shop.example.com:1/ok');
    if (길 === '/loop') return 넘김('/loop');
    if (길 === '/nowhere') { res.writeHead(302); return res.end(); }
    if (길 === '/big') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('a'.repeat(200000)); }
    if (길 === '/gz') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' }); return res.end(zlib.gzipSync('<p>눌러 보낸 글</p>')); }
    if (길 === '/bomb') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }); return res.end(zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024, 0x61))); }
    if (길 === '/brokengz') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }); return res.end(Buffer.from('gzip이 아닌 글')); }
    if (길 === '/odd') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'zstd' }); return res.end('x'); }
    if (길 === '/png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47])); }
    if (길 === '/403') { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('막힘'); }
    if (길 === '/404') { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('없음'); }
    if (길 === '/slow') { 열린응답.add(res); return undefined; }
    if (길 === '/drip') {
      res.writeHead(200, { 'content-type': 'text/html' });
      열린응답.add(res);
      const 타이머 = setInterval(() => { if (res.destroyed) clearInterval(타이머); else res.write('방울 '); }, 50);
      res.on('close', () => clearInterval(타이머));
      return undefined;
    }
    if (길 === '/euckr') {
      res.writeHead(200, { 'content-type': 'text/html' });
      // 「한글」의 EUC-KR 바이트
      return res.end(Buffer.concat([Buffer.from('<meta charset="euc-kr"><title>'), Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]), Buffer.from('</title>')]));
    }
    if (길 === '/headers') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(req.headers)); }
    res.writeHead(500); return res.end();
  });
  await new Promise((resolve) => 서버.listen(0, '127.0.0.1', resolve));
  포트 = 서버.address().port;
});
after(async () => {
  for (const res of 열린응답) res.destroy();
  서버.closeAllConnections?.();
  await new Promise((resolve) => 서버.close(resolve));
});

test('공인 주소만 받는다 — 사설 · 루프백 · 링크 로컬 · 통신사 NAT · IPv4를 품은 IPv6은 아니다', () => {
  for (const 주소 of ['8.8.8.8', '1.1.1.1', '223.130.200.104', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(공인주소인가(주소), true, 주소);
  for (const 주소 of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '127.255.255.254', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', '2001:db8::1', '2002:7f00:1::', '2001::1', 'ff02::1', '', 'shop.example.com', '999.1.1.1']) assert.equal(공인주소인가(주소), false, 주소);
});

test('주소 규칙 — http · https, 기본 포트, 이름으로 된 바깥 주소만', () => {
  assert.equal(주소정리('shop.co.kr/p/1').href, 'https://shop.co.kr/p/1', '스킴이 없으면 https');
  assert.equal(주소정리(' HTTPS://Shop.Co.Kr/a?b=1#c ').href, 'https://shop.co.kr/a?b=1', '조각(#)은 지운다');
  assert.equal(주소정리('http://shop.example.com.').hostname, 'shop.example.com.');
  const 막힘 = {
    '': /비었다/, 'ftp://shop.co.kr/a': /http · https/, 'file:///c:/windows/win.ini': /http · https/, 'javascript:alert(1)': /http · https/, 'data:text/html,hi': /http · https/,
    'http://user:pw@shop.co.kr/': /자격/, 'http://shop.co.kr:8080/': /포트/, 'https://shop.co.kr:22/': /포트/,
    'http://127.0.0.1/': /숫자 주소/, 'http://2130706433/': /숫자 주소/, 'http://0x7f.1/': /숫자 주소/, 'http://127.1/': /숫자 주소/, 'http://017700000001/': /숫자 주소/, 'http://１２７.0.0.1/': /숫자 주소/,
    'http://[::1]/': /숫자 주소/, 'http://[::ffff:127.0.0.1]/': /숫자 주소/, 'http://169.254.169.254/latest/meta-data/': /숫자 주소/,
    'http://localhost/': /안쪽 이름/, 'http://localhost./': /안쪽 이름/, 'http://router/': /안쪽 이름/, 'http://db.internal/': /안쪽 이름/, 'http://nas.local/': /안쪽 이름/, 'http://app.localhost/': /안쪽 이름/, 'http://printer.lan/': /안쪽 이름/,
    'http://shop.co.kr/a b': /공백/, 'http://shop.co.kr/\nhost: evil': /공백/, ['http://shop.co.kr/' + 'a'.repeat(2100)]: /너무 길다/,
  };
  for (const [글, 무늬] of Object.entries(막힘)) assert.throws(() => 주소정리(글), (오류) => 오류 instanceof 거절 && 무늬.test(오류.message), 글);
  assert.throws(() => 주소정리('http://shop.co.kr/a\tb'), 거절);
  assert.throws(() => 주소정리(null), 거절);
});

test('이름 풀기 — 나온 주소가 하나라도 안쪽이면 받지 않는다', async () => {
  const 풀이 = (값) => (이름, 옵션, 돌려줌) => 돌려줌(null, 값);
  assert.deepEqual(await 이름풀기('a.example.com', { lookup: 풀이([{ address: '8.8.8.8', family: 4 }]) }), [{ address: '8.8.8.8', family: 4 }]);
  await assert.rejects(이름풀기('a.example.com', { lookup: 풀이([{ address: '8.8.8.8', family: 4 }, { address: '192.168.0.10', family: 4 }]) }), /안쪽 주소로 풀리는 이름/);
  await assert.rejects(이름풀기('a.example.com', { lookup: 풀이([{ address: '::1', family: 6 }]) }), /안쪽 주소로 풀리는 이름/);
  await assert.rejects(이름풀기('a.example.com', { lookup: 풀이([]) }), /풀지 못했다/);
  await assert.rejects(이름풀기('a.example.com', { lookup: 풀이([{ address: 'not-an-ip', family: 4 }]) }), /풀지 못했다/);
  await assert.rejects(이름풀기('a.example.com', { lookup: (이름, 옵션, 돌려줌) => 돌려줌(new Error('ENOTFOUND')) }), /풀지 못했다/);
});

test('기본 규칙은 이 PC의 서버를 열지 않는다(시험용 자리를 갈아 끼우지 않으면)', async () => {
  let 붙음 = 0;
  const 걸음 = async () => { 붙음 += 1; return { 상태: 200, 머리: { 'content-type': 'text/html' }, 몸: Buffer.from('x'), 잘림: false }; };
  assert.match((await 읽기(`http://127.0.0.1:${포트}/ok`, { 걸음 })).까닭, /포트/);
  assert.match((await 읽기('http://127.0.0.1/ok', { 걸음 })).까닭, /숫자 주소/);
  assert.match((await 읽기('http://localhost/ok', { 걸음 })).까닭, /안쪽 이름/);
  // 이름은 바깥 꼴인데 안쪽 주소로 풀리는 경우(DNS로 안쪽을 가리키게 한 주소) — 붙기 전에 막힌다.
  const r = await 읽기('https://shop.example.com/', { 걸음, lookup: (이름, 옵션, 돌려줌) => 돌려줌(null, [{ address: '192.168.0.10', family: 4 }]) });
  assert.deepEqual([r.됨, r.까닭], [false, '안쪽 주소로 풀리는 이름이다']);
  assert.equal((await 읽기('https://mixed.example.com/', { 걸음, lookup: 가짜풀이().lookup })).까닭, '안쪽 주소로 풀리는 이름이다');
  assert.equal(붙음, 0, '규칙 밖 주소에는 한 번도 붙지 않는다');
});

test('글 쪽을 읽는다 — 확인한 주소로만 붙고, 쿠키 · 리퍼러 · 우리 이름을 보내지 않는다', async () => {
  const 선택 = 시험선택();
  const r = await 읽기(곳('/ok'), 선택);
  assert.deepEqual([r.됨, r.상태, r.형식, r.문자셋, r.잘림, r.넘김], [true, 200, 'text/html', 'utf-8', false, 0]);
  assert.match(r.글, /<title>가게<\/title><p>안녕하세요<\/p>/);
  assert.deepEqual(선택.부름, ['shop.example.com'], '이름은 걸음마다 한 번만 푼다(붙을 때 다시 묻지 않는다)');
  const 머리 = JSON.parse((await 읽기(곳('/headers'), 시험선택())).글);
  assert.equal(머리['user-agent'], 이름표);
  for (const 키 of ['cookie', 'referer', 'authorization', 'origin', 'from']) assert.equal(머리[키], undefined, 키);
  assert.doesNotMatch(JSON.stringify(머리), /synk|pulse|gmail/i);
});

test('넘김은 걸음마다 처음부터 다시 검사한다 — 안쪽 이름 · 숫자 주소 · 파일 · 다른 포트로는 가지 않는다', async () => {
  const 선택 = 시험선택();
  const 통과 = await 읽기(곳('/r1'), 선택);
  assert.deepEqual([통과.됨, 통과.넘김, 통과.끝주소], [true, 1, 곳('/ok', 'other.example.com')]);
  assert.deepEqual(선택.부름, ['shop.example.com', 'other.example.com']);
  assert.equal((await 읽기(곳('/rel'), 시험선택())).됨, true, '상대 주소 넘김');
  const 기대 = { '/to-inner': /안쪽 주소로 풀리는 이름/, '/to-ip': /숫자 주소/, '/to-meta': /숫자 주소/, '/to-file': /http · https/, '/to-port': /포트/, '/loop': /넘김이 5번을 넘는다/, '/nowhere': /갈 곳이 없다/ };
  for (const [길, 무늬] of Object.entries(기대)) {
    const r = await 읽기(곳(길), 시험선택());
    assert.equal(r.됨, false, 길);
    assert.match(r.까닭, 무늬, 길);
    assert.equal(r.글, undefined, 길);
  }
});

test('크기 · 형식 · 압축 한계', async () => {
  const 큰 = await 읽기(곳('/big'), 시험선택({ 최대바이트: 10000 }));
  assert.deepEqual([큰.됨, 큰.바이트, 큰.잘림], [true, 10000, true]);
  const 눌림 = await 읽기(곳('/gz'), 시험선택());
  assert.match(눌림.글, /눌러 보낸 글/);
  // 작게 눌러 보낸 5MB — 풀린 크기로 센다.
  const 폭탄 = await 읽기(곳('/bomb'), 시험선택({ 최대바이트: 20000 }));
  assert.deepEqual([폭탄.됨, 폭탄.바이트, 폭탄.잘림], [true, 20000, true]);
  assert.equal((await 읽기(곳('/brokengz'), 시험선택())).됨, false);
  assert.match((await 읽기(곳('/odd'), 시험선택())).까닭, /모르는 압축/);
  assert.match((await 읽기(곳('/png'), 시험선택())).까닭, /글이 아닌 형식이다\(image\/png\)/);
  assert.match((await 읽기(곳('/403'), 시험선택())).까닭, /자동 읽기를 막았다\(403\)/);
  assert.match((await 읽기(곳('/404'), 시험선택())).까닭, /없거나 오류다\(404\)/);
});

test('시간 한계 — 답이 없거나 끝없이 흘려보내는 서버에서도 정한 시간 안에 끝난다', async () => {
  let 시작 = Date.now();
  const 느림 = await 읽기(곳('/slow'), 시험선택({ 시한: 300, 전체시한: 5000 }));
  assert.deepEqual([느림.됨, 느림.까닭], [false, '시간 안에 답이 오지 않았다']);
  assert.ok(Date.now() - 시작 < 3000);
  시작 = Date.now();
  const 방울 = await 읽기(곳('/drip'), 시험선택({ 시한: 5000, 전체시한: 600 }));
  assert.ok(Date.now() - 시작 < 3000, '전체 시한에서 끊는다');
  // 받은 데까지만 잘린 글로 돌려주거나, 못 읽음으로 끝난다 — 어느 쪽이든 매달리지 않는다.
  if (방울.됨) assert.equal(방울.잘림, true); else assert.match(방울.까닭, /시간|끊겼다/);
});

test('전체 시한은 이름 풀기(DNS)를 기다리는 시간에도 적용된다', async () => {
  let 붙음 = 0;
  const 걸음 = async () => { 붙음 += 1; return { 상태: 200, 머리: { 'content-type': 'text/html' }, 몸: Buffer.from('x'), 잘림: false }; };
  // 답이 0.6초 뒤에야 오는 DNS — 전체 시한 0.05초에서 끊고, 늦게 온 답으로 붙지 않는다.
  const 느린풀이 = (이름, 옵션, 돌려줌) => { setTimeout(() => 돌려줌(null, [{ address: '8.8.8.8', family: 4 }]), 600); };
  const 시작 = Date.now();
  const r = await 읽기('https://slow-dns.example.com/', { lookup: 느린풀이, 걸음, 전체시한: 50 });
  const 걸린 = Date.now() - 시작;
  assert.deepEqual([r.됨, r.까닭], [false, '시간 안에 끝나지 않았다']);
  assert.ok(걸린 < 400, `${걸린}ms`);
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(붙음, 0);
});

test('크기 한도에 닿으면 압축 풀기도 함께 닫는다 — 작게 눌러 보낸 큰 답을 한도 뒤에 계속 풀지 않는다', async () => {
  const 진짜 = 압축풀기.gzip;
  const 만든것 = [];
  압축풀기.gzip = () => { const 풀기 = 진짜(); 만든것.push(풀기); return 풀기; };
  try {
    const 폭탄 = await 읽기(곳('/bomb'), 시험선택({ 최대바이트: 20000 }));
    assert.deepEqual([폭탄.됨, 폭탄.바이트, 폭탄.잘림], [true, 20000, true]);
    assert.equal(만든것.length, 1);
    assert.equal(만든것[0].destroyed, true, '한도에 닿은 그 자리에서 닫혔다');
    // 다 읽은 답은 끝까지 풀고 스스로 닫힌다(잘리지 않는다).
    const 보통 = await 읽기(곳('/gz'), 시험선택());
    assert.deepEqual([보통.잘림, /눌러 보낸 글/.test(보통.글)], [false, true]);
  } finally { 압축풀기.gzip = 진짜; }
});

test('문자셋 — 머리에 없으면 쪽의 meta charset을 본다(EUC-KR 쇼핑몰)', async () => {
  const r = await 읽기(곳('/euckr'), 시험선택());
  assert.equal(r.문자셋, 'euc-kr');
  assert.match(r.글, /<title>한글<\/title>/);
  assert.equal(글로(Buffer.from('가나다'), '', 'text/plain').글, '가나다');
  assert.equal(글로(Buffer.from('가나다'), 'no-such-charset', 'text/html').문자셋, 'utf-8', '모르는 이름이면 UTF-8');
});

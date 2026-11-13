'use strict';
/* 공개 쪽 읽기 — 남이 적어 준 주소(PULSE 의뢰서의 제품 페이지 · 참고 광고)를 이 PC에서 한 번, 안전하게 읽는다(2026-11-13).
 *
 * 왜: 손님이 적은 주소는 믿을 수 없는 입력이다. 그대로 열면 이 PC와 같은 망의 안쪽 주소(localhost의 개발 서버 · 공유기 · 사설 대역)를
 *   대신 읽어 주는 통로가 된다. 그래서 「누구나 열 수 있는 공개 웹 쪽」만, 정한 크기 · 시간 안에서 읽는다.
 *
 *   const { 읽기 } = require('./lib/공개쪽읽기.js');
 *   const r = await 읽기('https://shop.example.com/p/1');
 *   // 됐으면 { 됨: true, 주소, 끝주소, 상태, 형식, 문자셋, 바이트, 잘림, 넘김, 글 }, 아니면 { 됨: false, 주소, 까닭[, 상태] }
 *
 * 지키는 것:
 *   · http · https만, 기본 포트(80 · 443)만, 자격(user:pass@)이 든 주소 · 숫자 주소(IP) · 점 없는 이름 · 안쪽 이름(.local · .internal …)은 열지 않는다.
 *   · 이름을 DNS로 풀어 나온 주소가 「모두」 공인 주소일 때만, 그때 확인한 그 주소로 붙는다(붙을 때 다시 풀지 않는다 — 확인한 뒤 바꿔치기 막기).
 *   · 넘김(3xx)은 자동으로 따라가지 않고 다섯 번까지 한 걸음씩, 걸음마다 위 검사를 처음부터 다시 한다.
 *   · 글(HTML · JSON · 텍스트)만 받는다. 풀린 뒤 3MB까지만 읽고(넘으면 앞부분만 · 잘림 표시), 한 걸음 15초 · 전체 40초에서 끊는다.
 *   · 쿠키 · 로그인 · 리퍼러를 보내지 않고, 우리 이름 · 프로젝트를 헤더에 넣지 않는다. 막는 사이트(403 · 로봇 확인)는 「못 읽음」으로 끝낸다 — 돌아가지 않는다.
 * 예상되는 실패(막힘 · 없는 쪽 · 시간 넘김 · 규칙 밖 주소)는 던지지 않고 { 됨: false, 까닭 }으로 돌려준다.
 * 시험: node --test tests/공개쪽읽기.test.js
 */
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const zlib = require('node:zlib');

const 기본값 = { 시한: 15000, 전체시한: 40000, 최대바이트: 3 * 1024 * 1024, 최대넘김: 5 };
// 미리 보기를 만드는 자동 요청임을 숨기지 않는다(브라우저인 척하지 않는다).
const 이름표 = 'Mozilla/5.0 (compatible; link-preview-fetch/1.0)';
const 받는형식 = ['text/html', 'application/xhtml+xml', 'application/json', 'text/plain'];
const 안쪽이름 = /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|private|test|invalid|example|onion|arpa)$/;

// 공인이 아닌 IPv4 대역(이 망 · 사설 · 통신사 NAT · 루프백 · 링크 로컬 · 문서용 · 시험용 · 멀티캐스트 · 예약).
const 안쪽4 = new net.BlockList();
for (const [주소, 길이] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) 안쪽4.addSubnet(주소, 길이, 'ipv4');
// IPv6은 전역 유니캐스트(2000::/3)만 받고, 그 안의 특수 대역(프로토콜 할당 · Teredo · 문서용 · 6to4)은 뺀다.
// ::1 · fc00::/7 · fe80::/10 · IPv4를 품은 ::ffff:0:0/96 · 64:ff9b::/96은 2000::/3 밖이라 함께 걸러진다.
const 전역6 = new net.BlockList(); 전역6.addSubnet('2000::', 3, 'ipv6');
const 특수6 = new net.BlockList();
for (const [주소, 길이] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) 특수6.addSubnet(주소, 길이, 'ipv6');

function 공인주소인가(주소) {
  try {
    const 종류 = net.isIP(String(주소));
    if (종류 === 4) return !안쪽4.check(주소, 'ipv4');
    if (종류 === 6) return 전역6.check(주소, 'ipv6') && !특수6.check(주소, 'ipv6');
  } catch { /* 읽지 못한 주소는 공인이 아닌 것으로 본다 */ }
  return false;
}

class 거절 extends Error {}

/** 글 → URL. 규칙 밖이면 거절을 던진다(읽기가 받아 { 됨: false }로 바꾼다). 포트허용은 시험용이다. */
function 주소정리(글, { 포트허용 = null } = {}) {
  const raw = String(글 ?? '').trim();
  if (!raw) throw new 거절('주소가 비었다');
  if (raw.length > 2000) throw new 거절('주소가 너무 길다');
  if (/[\u0000- \u007f]/.test(raw)) throw new 거절('주소에 공백 · 제어 문자가 있다');
  const 후보 = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let u;
  try { u = new URL(후보); } catch { throw new 거절('주소 꼴이 아니다'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new 거절('http · https 주소가 아니다');
  if (u.username || u.password) throw new 거절('자격(user:pass@)이 든 주소다');
  if (u.port && !(포트허용 && 포트허용(Number(u.port), u.protocol))) throw new 거절('포트를 적은 주소다');
  const 이름 = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!이름) throw new 거절('주소에 이름이 없다');
  if (이름.startsWith('[') || net.isIP(이름)) throw new 거절('숫자 주소(IP)다');
  if (!이름.includes('.') || 안쪽이름.test(이름)) throw new 거절('안쪽 이름이다');
  u.hash = '';
  return u;
}

/** 이름을 풀어 모두 공인 주소인지 본다 → [{address, family}] */
async function 이름풀기(이름, { lookup = dns.lookup, 주소허용 = 공인주소인가 } = {}) {
  const 목록 = await new Promise((resolve, reject) => {
    lookup(이름, { all: true, verbatim: true }, (오류, 주소들) => (오류 ? reject(오류) : resolve(주소들)));
  }).catch(() => { throw new 거절('이름을 주소로 풀지 못했다'); });
  const 꼴 = (Array.isArray(목록) ? 목록 : []).filter((a) => a && net.isIP(String(a.address))).slice(0, 8).map((a) => ({ address: String(a.address), family: net.isIP(String(a.address)) }));
  if (!꼴.length) throw new 거절('이름을 주소로 풀지 못했다');
  if (!꼴.every((a) => 주소허용(a.address))) throw new 거절('안쪽 주소로 풀리는 이름이다');
  return 꼴;
}

// 확인한 주소로만 붙게 하는 lookup — 붙을 때 DNS를 다시 묻지 않는다.
const 고정lookup = (목록) => (이름, 옵션, 돌려줌) => {
  const cb = typeof 옵션 === 'function' ? 옵션 : 돌려줌;
  if (옵션 && typeof 옵션 === 'object' && 옵션.all) return cb(null, 목록.map((a) => ({ address: a.address, family: a.family })));
  return cb(null, 목록[0].address, 목록[0].family);
};

function 형식읽기(머리) {
  const 값 = String(머리 || '').toLowerCase();
  const 형식 = 값.split(';')[0].trim();
  const 문자 = /charset\s*=\s*["']?([a-z0-9._:-]+)/.exec(값);
  return { 형식, 문자셋: 문자 ? 문자[1] : '' };
}

// 압축 풀기 흐름을 만드는 곳(시험이 한도에서 닫히는지 보려고 감싸는 자리 — 입력으로는 닿지 않는다).
const 압축풀기 = { gzip: () => zlib.createGunzip(), deflate: () => zlib.createInflate(), br: () => zlib.createBrotliDecompress() };

/** 한 걸음: 확인한 주소로 GET 한 번. 넘김은 따라가지 않는다. → { 상태, 머리, 몸(Buffer), 잘림 } */
function 한걸음(u, 주소들, { 시한, 최대바이트, signal }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    let 끝 = false;
    const 마침 = (fn, 값) => { if (!끝) { 끝 = true; fn(값); } };
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: `${u.pathname}${u.search}`, method: 'GET',
      lookup: 고정lookup(주소들), agent: false, timeout: 시한, signal,
      headers: { 'user-agent': 이름표, accept: 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8', 'accept-language': 'ko,en;q=0.8', 'accept-encoding': 'gzip, deflate, br' },
    });
    req.on('timeout', () => req.destroy(new 거절('시간 안에 답이 오지 않았다')));
    req.on('error', (오류) => 마침(reject, 오류));
    req.on('response', (res) => {
      const 상태 = res.statusCode || 0;
      const 그만 = (값) => { res.destroy(); 마침(resolve, 값); };
      if (상태 >= 300 && 상태 < 400) return 그만({ 상태, 머리: res.headers, 몸: Buffer.alloc(0), 잘림: false });
      const { 형식 } = 형식읽기(res.headers['content-type']);
      if (상태 < 200 || 상태 >= 300 || !받는형식.includes(형식)) return 그만({ 상태, 머리: res.headers, 몸: Buffer.alloc(0), 잘림: false });
      const 압축 = String(res.headers['content-encoding'] || '').toLowerCase().trim();
      let 흐름 = res;
      if (압축 === 'gzip' || 압축 === 'x-gzip') 흐름 = res.pipe(압축풀기.gzip());
      else if (압축 === 'deflate') 흐름 = res.pipe(압축풀기.deflate());
      else if (압축 === 'br') 흐름 = res.pipe(압축풀기.br());
      else if (압축 && 압축 !== 'identity') return 그만({ 상태: 0, 머리: res.headers, 몸: Buffer.alloc(0), 잘림: false, 까닭: `모르는 압축(${압축.slice(0, 20)})` });
      const 조각 = []; let 크기 = 0;
      // 끝낼 때는 응답과 압축 풀기를 함께 닫는다 — 응답만 닫으면 이미 받은 눌린 글을 한도 뒤에도 계속 푼다(작게 눌러 보낸 큰 답).
      const 닫기 = () => { if (흐름 !== res) { try { res.unpipe(흐름); } catch { /* 이미 떨어졌다 */ } 흐름.destroy(); } res.destroy(); };
      const 받은데까지 = () => { 닫기(); 마침(resolve, { 상태, 머리: res.headers, 몸: Buffer.concat(조각), 잘림: true }); };
      const 못읽음 = (오류) => { 닫기(); 마침(reject, 오류); };
      if (signal) signal.addEventListener('abort', 닫기, { once: true });
      흐름.on('data', (c) => {
        if (끝) return;
        const 남은 = 최대바이트 - 크기;
        if (c.length >= 남은) { 조각.push(c.subarray(0, 남은)); 크기 += 남은; return 받은데까지(); }
        조각.push(c); 크기 += c.length;
      });
      흐름.on('end', () => { if (signal) signal.removeEventListener('abort', 닫기); 마침(resolve, { 상태, 머리: res.headers, 몸: Buffer.concat(조각), 잘림: false }); });
      // 풀다가 깨지면(끊긴 압축) 받은 데까지만 쓴다.
      흐름.on('error', (오류) => { if (!끝) (크기 ? 받은데까지() : 못읽음(오류)); });
      res.on('error', (오류) => { if (!끝) (크기 ? 받은데까지() : 못읽음(오류)); });
      // 몸을 다 받기 전에 연결이 닫혔는데 오류 신호가 없을 때 — 매달려 있지 않게 받은 데까지로 끝낸다.
      res.on('close', () => { if (!끝 && !res.complete) (크기 ? 받은데까지() : 못읽음(new 거절('읽는 중에 끊겼다'))); });
      return undefined;
    });
    req.end();
  });
}

/** 바이트 → 글. 머리의 charset → BOM → <meta charset> 차례로 보고, 모르면 UTF-8. 한국 쇼핑몰의 EUC-KR 쪽을 읽으려는 것이다. */
function 글로(몸, 문자셋머리, 형식) {
  let 문자셋 = 문자셋머리;
  if (!문자셋 && 몸.length >= 3 && 몸[0] === 0xef && 몸[1] === 0xbb && 몸[2] === 0xbf) 문자셋 = 'utf-8';
  if (!문자셋 && (형식 === 'text/html' || 형식 === 'application/xhtml+xml')) {
    const 앞 = 몸.subarray(0, 4096).toString('latin1');
    const 찾음 = /<meta[^>]{0,200}charset\s*=\s*["']?\s*([a-z0-9._:-]+)/i.exec(앞);
    if (찾음) 문자셋 = 찾음[1].toLowerCase();
  }
  for (const 이름 of [문자셋, 'utf-8']) {
    if (!이름) continue;
    try { return { 글: new TextDecoder(이름, { fatal: false }).decode(몸), 문자셋: 이름 }; } catch { /* 모르는 이름 — 다음으로 */ }
  }
  return { 글: 몸.toString('utf8'), 문자셋: 'utf-8' };
}

const 오류글 = (오류) => {
  if (오류 instanceof 거절) return 오류.message;
  const 코드 = String(오류?.code || 오류?.name || '');
  if (/ABORT|TIMEOUT|ETIMEDOUT/i.test(코드)) return '시간 안에 끝나지 않았다';
  if (/CERT|SSL|TLS|ERR_TLS|SELF_SIGNED|ALTNAME/i.test(코드)) return '인증서가 맞지 않는다';
  if (/ECONNREFUSED|ECONNRESET|EPIPE|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN/i.test(코드)) return '연결하지 못했다';
  return '읽는 중에 끊겼다';
};

/**
 * 주소 하나를 읽는다. 선택: 시한 · 전체시한 · 최대바이트 · 최대넘김. lookup · 주소허용 · 포트허용 · 걸음은 시험이 갈아 끼우는 자리다
 * (손님 입력이나 명령줄로는 닿지 않는다 — 운영 코드는 주지 않는다).
 */
async function 읽기(주소글, 선택 = {}) {
  const 옵션 = { ...기본값, ...선택 };
  const 걸음 = 옵션.걸음 || 한걸음;
  const 처음 = String(주소글 ?? '').trim().slice(0, 2000);
  const signal = AbortSignal.timeout(옵션.전체시한);
  // 이름 풀기(DNS)는 끊을 수 없어서, 전체 시한이 지나면 기다리지 않고 버린다(늦게 온 답은 쓰지 않는다).
  const 시한안에 = (약속) => new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new 거절('시간 안에 끝나지 않았다'));
    const 끊김 = () => reject(new 거절('시간 안에 끝나지 않았다'));
    signal.addEventListener('abort', 끊김, { once: true });
    return 약속.then(resolve, reject).finally(() => signal.removeEventListener('abort', 끊김));
  });
  let 지금글 = 처음, 끝주소 = '';
  try {
    for (let 넘김 = 0; ; 넘김++) {
      const u = 주소정리(지금글, { 포트허용: 옵션.포트허용 });
      const 주소들 = await 시한안에(이름풀기(u.hostname.replace(/\.$/, ''), { lookup: 옵션.lookup, 주소허용: 옵션.주소허용 }));
      끝주소 = u.href;
      const r = await 걸음(u, 주소들, { 시한: 옵션.시한, 최대바이트: 옵션.최대바이트, signal });
      if (r.까닭) return { 됨: false, 주소: 처음, 끝주소, 까닭: r.까닭 };
      if (r.상태 >= 300 && r.상태 < 400) {
        const 갈곳 = String(r.머리?.location || '').trim();
        if (!갈곳) return { 됨: false, 주소: 처음, 끝주소, 상태: r.상태, 까닭: `넘김(${r.상태})인데 갈 곳이 없다` };
        if (넘김 >= 옵션.최대넘김) return { 됨: false, 주소: 처음, 끝주소, 상태: r.상태, 까닭: `넘김이 ${옵션.최대넘김}번을 넘는다` };
        try { 지금글 = new URL(갈곳, u).href; } catch { return { 됨: false, 주소: 처음, 끝주소, 상태: r.상태, 까닭: '넘김의 갈 곳이 주소 꼴이 아니다' }; }
        continue;
      }
      const { 형식, 문자셋 } = 형식읽기(r.머리?.['content-type']);
      if (r.상태 < 200 || r.상태 >= 300) {
        const 막힘 = [401, 403, 429, 503].includes(r.상태);
        return { 됨: false, 주소: 처음, 끝주소, 상태: r.상태, 까닭: 막힘 ? `사이트가 자동 읽기를 막았다(${r.상태})` : `쪽이 없거나 오류다(${r.상태})` };
      }
      if (!받는형식.includes(형식)) return { 됨: false, 주소: 처음, 끝주소, 상태: r.상태, 까닭: `글이 아닌 형식이다(${형식.slice(0, 40) || '모름'})` };
      const 풀림 = 글로(r.몸, 문자셋, 형식);
      return { 됨: true, 주소: 처음, 끝주소, 상태: r.상태, 형식, 문자셋: 풀림.문자셋, 바이트: r.몸.length, 잘림: !!r.잘림, 넘김, 글: 풀림.글 };
    }
  } catch (오류) {
    return { 됨: false, 주소: 처음, ...(끝주소 ? { 끝주소 } : {}), 까닭: signal.aborted ? '시간 안에 끝나지 않았다' : 오류글(오류) };
  }
}

module.exports = { 읽기, 주소정리, 이름풀기, 공인주소인가, 글로, 형식읽기, 한걸음, 거절, 기본값, 이름표, 압축풀기 };

// SYNK PULSE 메일 중계 — founder@synk.im 소유 Apps Script 웹 앱(실행: 배포한 사람 · 액세스: 모든 사용자).
// 회사 서버가 RSA(2048, PKCS#1 v1.5, SHA-256)로 서명한 요청만 받고, 같은 열쇠의 메일은 한 번만 보낸다.
// 이 스크립트에는 비밀값이 없다 — 스크립트 속성 SERVER_KEY_N에 서버 공개 열쇠의 n(16진)만 둔다.
// 저장소 판과 배포 판은 RELAY_VERSION으로 맞춰 본다(회사 서버의 연결 확인이 다르면 멈춘다).
var RELAY_VERSION = 1;
var SENDER_NAME = 'SYNK PULSE';
var REPLY_TO = 'hello@synk.im';
var SUBJECT_HEAD = '〔SYNK PULSE〕';
var DAILY_CAP = 200;
var SKEW_MS = 10 * 60 * 1000;
var KEEP_MS = 7 * 24 * 3600 * 1000;
var LOCK_MS = 20000;
var SIGNED_TAG = 'pulse-mail/v1';
// SHA-256 DigestInfo(RFC 8017 9.2 주 1).
var DIGEST_INFO = [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20];

function doPost(e) {
  var answer;
  try {
    answer = relayHandle_(e && e.postData ? e.postData.contents : '', Date.now());
  } catch (err) {
    answer = {ok: false, status: 'failed', code: 'relay_error'};
  }
  answer.version = RELAY_VERSION;
  return ContentService.createTextOutput(JSON.stringify(answer)).setMimeType(ContentService.MimeType.JSON);
}

function relayHandle_(raw, now) {
  var req;
  try { req = JSON.parse(raw || ''); } catch (err) { return {ok: false, status: 'rejected', code: 'format'}; }
  if (!req || typeof req !== 'object' || req.v !== 1 || ['send', 'ping', 'status'].indexOf(req.op) < 0) return {ok: false, status: 'rejected', code: 'format'};
  var props = PropertiesService.getScriptProperties();
  var n = String(props.getProperty('SERVER_KEY_N') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{512}$/.test(n)) return {ok: false, status: 'rejected', code: 'no_key'};
  if (typeof req.ts !== 'number' || !isFinite(req.ts) || Math.floor(req.ts) !== req.ts || Math.abs(now - req.ts) > SKEW_MS) return {ok: false, status: 'rejected', code: 'clock'};
  var ping = req.op === 'ping';
  var probe = req.op === 'status';
  var key = ping ? '' : req.key, to = ping || probe ? '' : req.to, subject = ping || probe ? '' : req.subject, body = ping || probe ? '' : req.body;
  if ([key, to, subject, body].some(function (value) { return typeof value !== 'string'; })) return {ok: false, status: 'rejected', code: 'format'};
  var message = JSON.stringify([SIGNED_TAG, req.op, key, req.ts, to, subject, body]);
  if (typeof req.sig !== 'string' || !relayVerify_(message, req.sig, n)) return {ok: false, status: 'rejected', code: 'signature'};
  if (ping) return {ok: true, status: 'ok', remaining: MailApp.getRemainingDailyQuota()};
  // 서버가 「보냈는지 모름」 줄을 한 번 되묻는다 — 보내지 않고 열쇠만 읽는다.
  if (probe) {
    if (!/^[a-z0-9:_-]{8,160}$/.test(key)) return {ok: false, status: 'rejected', code: 'key'};
    var mark = props.getProperty('k:' + key);
    return {ok: true, status: 'checked', state: !mark ? 'none' : mark.indexOf('sent:') === 0 ? 'sent' : 'sending'};
  }
  var bad = relayCheck_(key, to, subject, body);
  if (bad) return {ok: false, status: 'rejected', code: bad};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_MS)) return {ok: false, status: 'busy', code: 'lock'};
  try {
    relayPrune_(props, now);
    var slot = 'k:' + key, seen = props.getProperty(slot);
    if (seen && seen.indexOf('sent:') === 0) return {ok: true, status: 'duplicate'};
    // 보내다 끊긴 열쇠(실행이 죽음)는 보냈는지 모른다 — 다시 보내지 않는다.
    if (seen) return {ok: false, status: 'unknown', code: 'interrupted'};
    var day = 'd:' + Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyyMMdd');
    var count = Number(props.getProperty(day) || 0);
    if (count >= DAILY_CAP || MailApp.getRemainingDailyQuota() < 1) return {ok: false, status: 'busy', code: 'cap'};
    props.setProperty(slot, 'sending:' + now);
    try {
      MailApp.sendEmail({to: to, subject: subject, body: body, name: SENDER_NAME, replyTo: REPLY_TO});
    } catch (err) {
      props.deleteProperty(slot);
      return {ok: false, status: 'failed', code: 'send'};
    }
    props.setProperty(slot, 'sent:' + now);
    props.setProperty(day, String(count + 1));
    return {ok: true, status: 'sent'};
  } finally {
    lock.releaseLock();
  }
}

function relayCheck_(key, to, subject, body) {
  if (!/^[a-z0-9:_-]{8,160}$/.test(key)) return 'key';
  if (to.length > 254 || !/^[^\s@,;<>"'()\[\]\\]+@[^\s@,;<>"'()\[\]\\]+\.[^\s@,;<>"'()\[\]\\]+$/.test(to)) return 'to';
  if (subject.indexOf(SUBJECT_HEAD) !== 0 || subject.length > 150 || /[\u0000-\u001f\u007f]/.test(subject)) return 'subject';
  if (!body || body.length > 4000 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(body)) return 'body';
  return '';
}

// 오래된 열쇠 · 날짜 칸을 몇 개씩 지운다(스크립트 속성 500KB 한도 안에 둔다).
function relayPrune_(props, now) {
  var all = props.getProperties(), removed = 0, today = Number(Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyyMMdd'));
  for (var name in all) {
    if (removed >= 50) break;
    var value = String(all[name]);
    if (name.indexOf('k:') === 0) {
      var at = Number(value.slice(value.indexOf(':') + 1));
      if (isFinite(at) && now - at > KEEP_MS) { props.deleteProperty(name); removed++; }
    } else if (name.indexOf('d:') === 0 && Number(name.slice(2)) < today - 7) {
      props.deleteProperty(name); removed++;
    }
  }
}

// RSASSA-PKCS1-v1_5 확인(e = 65537). Apps Script에는 확인 함수가 없어 BigInt로 거듭제곱한다.
function relayVerify_(message, sigB64, nHex) {
  var k = nHex.length / 2, sig;
  try { sig = Utilities.base64Decode(sigB64); } catch (err) { return false; }
  if (sig.length !== k) return false;
  var n = BigInt('0x' + nHex), s = relayBig_(sig);
  if (s >= n) return false;
  var em = relayBytes_(relayModPow_(s, BigInt(65537), n), k);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message, Utilities.Charset.UTF_8);
  var expected = [0x00, 0x01], fill = k - 3 - DIGEST_INFO.length - digest.length;
  if (fill < 8) return false;
  for (var i = 0; i < fill; i++) expected.push(0xff);
  expected.push(0x00);
  expected = expected.concat(DIGEST_INFO, digest.map(function (b) { return b & 0xff; }));
  var diff = 0;
  for (var j = 0; j < k; j++) diff |= (em[j] ^ expected[j]);
  return diff === 0;
}

function relayModPow_(base, exp, mod) {
  var result = BigInt(1), zero = BigInt(0), one = BigInt(1), two = BigInt(2);
  base %= mod;
  while (exp > zero) {
    if (exp % two === one) result = (result * base) % mod;
    exp /= two;
    base = (base * base) % mod;
  }
  return result;
}

function relayBig_(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) hex += ('0' + (bytes[i] & 0xff).toString(16)).slice(-2);
  return BigInt('0x' + (hex || '0'));
}

function relayBytes_(value, k) {
  var hex = value.toString(16);
  while (hex.length < k * 2) hex = '0' + hex;
  var out = [];
  for (var i = 0; i < k; i++) out.push(parseInt(hex.substr(i * 2, 2), 16));
  return out;
}

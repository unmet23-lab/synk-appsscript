'use strict';
// WORLD 학습 알림 2단(앱을 닫아도 받기)의 서비스 워커 — 공개본 /world/world-push-sw.js(범위 /world/). 설계 qa/push-reminders-20261022/설계.md §3-2.
// 페이지·학습 기록·계정 토큰을 저장하지 않고 가져오기(fetch)를 가로채지 않는다(Care 워커와 같다).
// 푸시 몸통은 {type, kind, lang, token}뿐이다. 잠금 화면 글은 아래 세 문장 표에서 고른다 — brand-opening/world-strings.mjs의 reminder.push.*와
// 같아야 한다(qa/world-push.test.mjs가 대조한다). 일의 종류·약점·급수·점수·이름·남은 수는 쓰지 않는다.
const TEXT = {
  title: { ko: 'SYNK WORLD', en: 'SYNK WORLD', mn: 'SYNK WORLD' },
  review: { ko: '다시 만날 표현이 돌아왔어요.', en: 'Expressions are back for review.', mn: 'Давтах хэллэгүүд дахин гарч ирлээ.' },
  plan: { ko: '이번 주 연습이 준비돼 있어요.', en: 'This week’s practice is ready.', mn: 'Энэ долоо хоногийн дасгал бэлэн байна.' },
  exam: { ko: '알려 준 날이 다가와요. 준비한 연습이 있어요.', en: 'The day you told us about is coming up. Practice is ready for you.', mn: 'Таны хэлсэн өдөр ойртож байна. Танд зориулсан дасгал бэлэн байна.' },
};
const KINDS = ['review', 'plan', 'exam'], LANGS = ['ko', 'en', 'mn'];
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// 받은 푸시는 늘 알림을 띄운다(띄우지 않으면 브라우저가 대신 「백그라운드에서 업데이트됨」을 띄우거나 권한을 거둔다). 모양이 틀리면 이번 주 연습 문장으로.
self.addEventListener('push', event => {
  let payload = null;
  try { payload = event.data ? event.data.json() : null; } catch { payload = null; }
  const ours = payload && payload.type === 'synk-world-reminder';
  const kind = ours && KINDS.includes(payload.kind) ? payload.kind : 'plan';
  const lang = ours && LANGS.includes(payload.lang) ? payload.lang : 'ko';
  const token = ours && typeof payload.token === 'string' && TOKEN.test(payload.token) ? payload.token : null;
  event.waitUntil(self.registration.showNotification(TEXT.title[lang], {
    body: TEXT[kind][lang], lang, tag: 'synk-world-reminder', renotify: false,
    icon: new URL('world-icon-192.png', self.registration.scope).href, data: { kind, token },
  }));
});

// 누름: ① 서버에 「누름」을 알리고(일회용 토큰 — 같은 폴더의 공개 설정에서 함수 주소·공개 키를 읽는다, 로그인 없이)
// ② 열린 WORLD 창이 있으면 그 창에 알리고 앞으로, 없으면 새 창(주소의 ack로 앱이 한 번 더 알린다 — 여기서 못 알렸을 때).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {}, kind = KINDS.includes(data.kind) ? data.kind : 'plan', token = typeof data.token === 'string' && TOKEN.test(data.token) ? data.token : null;
  const scope = new URL(self.registration.scope);
  const target = new URL('./', scope);
  target.searchParams.set('reminder', kind); target.searchParams.set('opening', 'off');
  if (token) target.searchParams.set('ack', token);
  event.waitUntil((async () => {
    if (token) {
      try {
        const config = await (await fetch(new URL('world-config.json', scope).href, { credentials: 'omit', cache: 'no-store' })).json();
        const base = config && config.account && config.account.supabaseUrl, key = config && config.account && config.account.supabasePublishableKey;
        if (typeof base === 'string' && /^https:\/\/[a-z0-9.-]+$/.test(base) && typeof key === 'string' && key) {
          await fetch(`${base}/functions/v1/world-push/api`, { method: 'POST', credentials: 'omit', cache: 'no-store', keepalive: true,
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-SYNK-Product': 'world', 'X-SYNK-Contract': '1' },
            body: JSON.stringify({ action: 'opened', token }) });
        }
      } catch { /* 앱이 주소의 ack로 다시 알린다 */ }
    }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(client => { try { const url = new URL(client.url); return url.origin === scope.origin && url.pathname.startsWith(scope.pathname); } catch { return false; } });
    if (open) { open.postMessage({ type: 'synk-world-reminder-open', kind, token }); return open.focus(); }
    return self.clients.openWindow(target.href);
  })());
});

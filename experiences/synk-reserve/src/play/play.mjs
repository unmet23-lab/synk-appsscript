// 사전예약 쪽의 1회용 체험(11-25 유호님 「지금 플레이하면 로그인 정보가 계속 이어지는데 1회성으로 플레이할수있게 바꿔줘」).
// 원본: SYNK-appsscript/experiences/synk-reserve/src/play/play.mjs
// · WORLD 앱(계정 · 손님 기록)을 거치지 않고 서울행 틀(world/seoul-arrival/)과 1화 틀(world/drama/)을 바로 연다. 로그인을 읽지 않고 이 기기에 아무것도 저장하지 않는다 —
//   틀이 넘기는 저장은 버리고, 열 때마다 타이틀부터 시작한다. 이 파일은 저장소 · 쿠키를 부르지 않는다(시험이 본다).
// · 부모 통로의 꼴은 앱의 experiences/synk-world-app/seoul-entry.mjs host와 같다. 1화는 손님 판(받아쓰기 서버를 부르지 않는 통로)이고, 끝은 앱과 같은 seoul-watch.mjs로 안다.
// · 내 사진(제2의 나) · 동아리장 알림 · 우리 동네는 계정 기능이라 통로를 두지 않는다. 이야기를 나가면 사전예약 쪽으로 돌아간다.

export const LANGS = Object.freeze(['ko', 'en', 'mn']);
// 1화 끝 띠와 실패 안내의 글은 앱(seoul-entry.mjs TEXT)과 같다 — 시험이 글자를 대조한다.
export const TEXT = Object.freeze({
  title: { ko: '서울행 · SYNK WORLD', en: 'The trip to Seoul · SYNK WORLD', mn: '«Сөүл рүү хийх аялал» · SYNK WORLD' },
  dramaTitle: { ko: '1화 · 개강 첫날', en: 'Episode 1 · First day of class', mn: '1-р анги · Хичээлийн эхний өдөр' },
  trialEnd: { ko: '체험은 여기까지예요', en: 'This is where the trial ends', mn: 'Туршилтын хэсэг үүгээр дууслаа' },
  trialMore: { ko: '더 많은 이야기는 2027년 2월에 열려요. 사전예약하면 가장 먼저 알려 드려요.', en: 'More episodes open in February 2027. Pre-register and we’ll tell you first.', mn: 'Дараагийн ангиуд 2027 оны 2‑р сард гарна. Урьдчилан бүртгүүлбэл танд хамгийн түрүүнд мэдэгдэнэ.' },
  reserve: { ko: '사전예약하기', en: 'Pre-register', mn: 'Урьдчилан бүртгүүлэх' },
  toCrowd: { ko: '내 팬 보기', en: 'See my fans', mn: 'Фэнүүдээ харах' },
  failed: { ko: '잠시 뒤 다시 열어 주세요.', en: 'Please try again in a moment.', mn: 'Түр хүлээгээд дахин нээнэ үү.' },
  close: { ko: '닫기', en: 'Close', mn: 'Хаах' },
});

/** 화면 언어: ?lang이 먼저, 없으면 기기 언어(몽골어 · 한국어), 아니면 영어 — 사전예약 쪽 pickLang과 같은 규칙. */
export function pickLang(search, navLangs) {
  const q = new URLSearchParams(search || '').get('lang');
  if (LANGS.includes(q)) return q;
  for (const raw of navLangs || []) {
    const x = String(raw || '').toLowerCase();
    if (x === 'mn' || x.startsWith('mn-')) return 'mn';
    if (x === 'ko' || x.startsWith('ko-')) return 'ko';
  }
  return 'en';
}

/** 들어온 곳: 사전예약 쪽에서 받은 ?from을 그대로 이어 준다. 없으면 이 체험에서 왔다고 적는다. */
export function fromKey(search) {
  const raw = String(new URLSearchParams(search || '').get('from') || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw) && raw !== 'direct' ? raw : 'play-ep1';
}

/** 사전예약 쪽으로 가는 주소. */
export function reserveUrl(search, lang) {
  return `/reserve/?${new URLSearchParams({ from: fromKey(search), lang })}`;
}

if (typeof document !== 'undefined') start();

function start() {
  const $ = sel => document.querySelector(sel);
  const lang = pickLang(location.search, navigator.languages || [navigator.language]);
  const t = key => TEXT[key][lang];
  const reserve = reserveUrl(location.search, lang);
  const FRAME_WAIT_MS = 15000;
  // 1화 끝을 아는 모듈. 공개된 1화 틀과 같은 공개본에서 받아야 꼬리표가 어긋나지 않는다. 못 받으면 1화는 그대로 하고 끝 띠만 없다.
  const watching = import('/world/seoul-watch.mjs').catch(() => null);

  document.documentElement.lang = lang;
  document.title = t('title');
  $('#play-title').textContent = t('title');
  $('#ep-title').textContent = t('dramaTitle');
  $('#ep-close').setAttribute('aria-label', t('close'));

  // 뒤로 가기로 되살아난 화면은 앞 이야기가 남아 있다 — 다시 받아 처음부터 시작한다.
  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  function insets() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.append(probe);
    const c = getComputedStyle(probe), out = { sat: parseFloat(c.paddingTop) || 0, sab: parseFloat(c.paddingBottom) || 0 };
    probe.remove();
    return out;
  }

  let story = null, api = null;

  /* ── 1화 ── 전체 화면 판 안에서 연다. 닫으면 이야기로 돌아간다 */
  const ep = $('#ep'), body = $('#ep-body');
  function openEpisode({ onScene = () => {} } = {}) {
    return new Promise(resolve => {
      let lines = null, watcher = null, finished = false;
      const frame = document.createElement('iframe');
      frame.className = 'pl-drama';
      frame.title = t('dramaTitle');
      frame.setAttribute('allow', 'autoplay; fullscreen; microphone');
      frame.allowFullscreen = true;
      // 받아쓰기(외부 AI) 없이 녹음을 들어 보고 스스로 확인하는 손님 통로. 틀보다 먼저 둔다 — 틀이 처음 읽을 때 있어야 한다.
      const dramaHost = Object.freeze({ status: async () => ({ ok: true, guest: true, dramaEnabled: false }), take: async () => ({ ok: true, status: 'off' }) });
      window.SYNKDramaHost = dramaHost;
      const done = () => {
        if (finished) return;
        finished = true;
        ep.removeEventListener('close', done);
        watcher?.dispose();
        if (window.SYNKDramaHost === dramaHost) delete window.SYNKDramaHost;
        body.replaceChildren();
        try { story?.contentWindow?.focus(); } catch { /* 틀이 없으면 둔다 */ }
        resolve(lines ? { status: 'wrap', lines } : { status: 'closed' });
      };
      ep.addEventListener('close', done);
      frame.src = `/world/drama/?lang=${lang}`;
      body.replaceChildren(frame);
      ep.showModal();
      frame.focus({ preventScroll: true });   // 판을 열자마자 닫기 단추에 초점 테두리가 서지 않게 — 첫 초점은 1화다
      void watching.then(mod => {
        if (!mod || finished) return;
        watcher = mod.watchEpisode(frame, {
          onScene,
          onWrap(read) {
            lines = read;
            try { onScene({ id: `${mod.EPISODE}.wrap`, lines: read.n }); } catch { /* 이야기 틀이 사라졌으면 둔다 */ }
            showEnd();
          },
        });
      });
    });
  }
  $('#ep-close').addEventListener('click', () => ep.close());

  // 오늘 기록 아래 띠: 체험 끝 안내와 사전예약(새 탭 — 이야기는 이 탭에서 이어진다), 내 팬 보기. 1화 틀을 가리지 않고 그만큼 줄인다.
  function showEnd() {
    if (body.querySelector('.pl-end')) return;
    const band = document.createElement('div');
    band.className = 'pl-end';
    const say = document.createElement('div'), head = document.createElement('strong'), more = document.createElement('span');
    say.className = 'pl-end-say';
    head.textContent = t('trialEnd');
    more.textContent = t('trialMore');
    say.append(head, more);
    const row = document.createElement('div'), go = document.createElement('a'), fans = document.createElement('button');
    row.className = 'pl-end-row';
    go.className = 'pl-btn';
    go.href = reserve;
    go.target = '_blank';
    go.rel = 'noopener';
    go.textContent = t('reserve');
    fans.type = 'button';
    fans.className = 'pl-btn line';
    fans.textContent = t('toCrowd');
    fans.addEventListener('click', () => { try { api?.wake(); } catch { /* 소리를 못 깨워도 간다 */ } ep.close(); });
    row.append(go, fans);
    band.append(say, row);
    body.append(band);
  }

  /* ── 부모 통로 ── 저장은 버린다. 나가면 사전예약 쪽이다 */
  window.SYNKSeoulHost = Object.freeze({
    ready(frameApi) {
      if (api) return;
      api = frameApi;
      clearTimeout(waiting);
      try { api.setLang(lang); } catch { /* 틀 언어는 주소의 ?lang으로도 정해진다 */ }
      api.start({ at: 'title', arrival: null });
      $('#fail').hidden = true;
      story.classList.add('on');
      story.focus();
    },
    reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    insets,
    save() {},
    prepareEpisode: () => ({ status: 'ok' }),
    openEpisode,
    // 참이면 내 길 끝 단추가 「오늘은 여기까지 · 오늘 마무리하기」다 — 이 체험에는 우리 동네가 없다.
    front: () => true,
    leave() { location.assign(reserve); },
  });

  const waiting = setTimeout(() => {
    const box = $('#fail');
    box.querySelector('p').textContent = t('failed');
    const a = box.querySelector('a');
    a.href = reserve;
    a.textContent = t('reserve');
    box.hidden = false;
  }, FRAME_WAIT_MS);

  story = document.createElement('iframe');
  story.className = 'pl-story';
  story.title = t('title');
  story.setAttribute('allow', 'autoplay; fullscreen');
  story.src = `/world/seoul-arrival/?lang=${lang}`;
  $('#play').append(story);
}

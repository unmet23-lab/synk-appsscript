(() => {
  const EN = document.documentElement.lang === 'en';
  const $ = s => document.querySelector(s);
  const P = '/assets/founder-v1/';
  const T = EN ? {
    now: t => `Seoul now ${t}`,
    count: (n, co) => `${n} cards today · on top: ${co}`,
    front: t => `Up now: ${t}`,
    nth: (i, t) => `Card ${i}: ${t}`,
    daily: 'Daily', twice: 'Twice a day',
  } : {
    now: t => `지금 서울 ${t}`,
    count: (n, co) => `오늘 ${n}장 중 맨 앞: ${co}`,
    front: t => `지금 할 일: ${t}`,
    nth: (i, t) => `${i}번째: ${t}`,
    daily: '매일', twice: '하루 두 번',
  };
  const DAY = [
    ['05:30', '회사 서버와 앱의 자료를 백업합니다.', 'Backs up the company server and app data.', 0, '#1B1A17'],
    ['06:00', '검사를 마친 고침을 묶어 회사 서버에 올립니다.', 'Bundles fixes that passed their checks and ships them to the company server.', 1, '#1B1A17'],
    ['07:00', '며칠 뒤 올릴 SNS 편을 기획부터 영상까지 만듭니다.', 'Makes the social posts going out in a few days, from the plan to the finished video.', 1, '#F96859'],
    ['09:10', '몽골어로 만든 편을 다른 나라 말 판본으로 옮깁니다.', 'Turns posts made in Mongolian into versions for other languages.', 1, '#F96859'],
    ['10:40', '유학 앱에서 접수 마감이 다가온 대학을 찾아 팀에 알립니다.', 'Finds universities in the study abroad app whose application deadlines are close, and alerts the team.', 0, '#526956'],
    ['14:00', '계정마다 오늘 편을 검사하고 올립니다.', 'Checks today’s post for each account and publishes it.', 0, '#F96859'],
    ['18:30', '지난 하루 메일에서 공모와 심사 결과, 계정 경고를 골라 보고합니다.', 'Goes through the last day’s email and reports contest results, review decisions and account warnings.', 0, '#1B1A17'],
    ['19:30', '잘된 영상과 댓글을 읽고 다음 기획 후보를 고릅니다.', 'Reads the videos and comments that did well and shortlists what to make next.', 0, '#99295D'],
    ['21:00', '스레드에 오늘 글을 올립니다.', 'Posts today’s update on Threads.', 0, '#3D6BC9'],
  ].map(([t, ko, en, twice, c]) => ({ t, w: EN ? en : ko, k: twice ? T.twice : T.daily, c }));
  const CARDS = [
    { co: 'PULSE', c: '#99295D', hot: true, img: 'card-pulse.webp',
      ko: ['고객 편집본', '고객이 기다려요', '카페 봄날 광고, 2차 편집본 확인', 'PULSE 광고 · 카페 봄날 사장님 · 오늘', '오늘', '사장님께 보내기'],
      en: ['Client cut', 'The client is waiting', 'Cafe Bomnal ad: review the second cut', 'PULSE ads · Cafe Bomnal owner · Today', 'Today', 'Send to the owner'] },
    { co: 'LAB', c: '#F96859', img: 'card-lab-1.webp',
      ko: ['메신저 할 일', '동료가 답을 기다려요', '몽골 유튜브 오후 1시 게시물 자막 확인', 'LAB 한국어 · 오늘', '오늘', '수락하기'],
      en: ['Message task', 'A teammate is waiting', 'Check captions on the 1 p.m. Mongolian YouTube post', 'LAB Korean · Today', 'Today', 'Accept'] },
    { co: 'LAB', c: '#F96859', img: 'card-lab-2.webp',
      ko: ['SNS 승인', '게시 전에 승인이 필요해요', '릴스 「뜨거워!」 내일 아침 게시', 'LAB 릴스 · 내일 07:00', '내일 07:00', '승인하기'],
      en: ['Post approval', 'Needs approval before it goes out', 'Reel “It’s hot!” goes out tomorrow morning', 'LAB Reels · Tomorrow 07:00', 'Tomorrow 07:00', 'Approve'] },
    { co: 'SHIFT', c: '#3D6BC9', img: '',
      ko: ['강의 자료', '확인 날짜가 지났어요', '중소기업 AI 업무 자동화 강의 자료 확인', 'SHIFT AI 강의 · 11.24', '11.24', '확인했어요'],
      en: ['Lecture slides', 'Past the review date', 'Check the slides for the small-business AI lecture', 'SHIFT AI lectures · Nov 24', 'Nov 24', 'Mark as reviewed'] },
    { co: 'PATH', c: '#526956', img: '',
      ko: ['상담', '오늘 15:00', '신입생 체류 서류 안내 상담', 'PATH 유학 · 오늘 15:00', '오늘 15:00', '상담 열기'],
      en: ['Consultation', 'Today 15:00', 'Residence paperwork session for new students', 'PATH study abroad · Today 15:00', 'Today 15:00', 'Open session'] },
  ].map(x => { const [kind, why, title, who, d, act] = EN ? x.en : x.ko; return { ...x, kind, why, title, who, d, act }; });
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 머리: 휴대폰 메뉴와 먹 띠 위의 색
  const nav = $('.nav'), menu = $('.menu-btn'), band = $('.band');
  const setMenu = open => { nav.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); };
  menu.addEventListener('click', () => { const open = !nav.classList.contains('open'); setMenu(open); if (open) nav.querySelector('ul a').focus(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menu.focus(); } });
  addEventListener('click', e => { if (nav.classList.contains('open') && !nav.contains(e.target)) setMenu(false); });
  const tone = () => { const b = band.getBoundingClientRect(); document.body.dataset.tone = b.top <= 30 && b.bottom > 30 ? 'dark' : 'light'; };
  addEventListener('scroll', tone, { passive: true }); tone();

  // 하루: 처음에는 서울의 지금 시각에 가장 가까운 지난 일을 고른다
  const ul = $('#times'), clock = $('#clock'), what = $('#what'), how = $('#how'), now = $('#now');
  const btns = DAY.map((d, i) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="t">${d.t}</span><span class="w">${esc(d.w)}</span><span class="k">${d.k}</span>`;
    b.addEventListener('click', () => pick(i)); li.append(b); ul.append(li); return b;
  });
  function pick(i) { const d = DAY[i]; btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); clock.textContent = d.t; what.textContent = d.w; how.style.setProperty('--c', d.c); how.querySelector('span').textContent = d.k; }
  const seoul = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const hm = seoul.match(/(\d{1,2}):(\d{2})/), cur = hm ? hm[1].padStart(2, '0') + ':' + hm[2] : '07:00';
  now.textContent = T.now(cur);
  let start = DAY.length - 1; DAY.forEach((d, i) => { if (d.t <= cur) start = i; }); pick(start);

  // 직원 앱 카드 더미: 누르면 그 카드가 앞으로. 키보드와 보조기기는 「다음 장」 단추 하나로 넘기고 맨 앞 장 이름을 읽는다
  const deck = $('#deck'), cnt = $('#cnt');
  let order = CARDS.map((_, i) => i);
  const toFront = i => { if (order[0] !== i) { order = [i, ...order.filter(k => k !== i)]; lay(); } };
  const els = CARDS.map((x, i) => {
    const el = document.createElement('article'); el.className = 'card'; el.style.setProperty('--c', x.c);
    el.innerHTML = `<div class="hd"><span class="n"></span><span class="chip"><i></i>${x.co}</span><span class="tt">${esc(x.title)}</span><span class="d">${esc(x.d)}</span></div>
  <div class="bd"><div class="pic">${x.img ? `<img src="${P}${x.img}" alt="" decoding="async">` : ''}</div><div class="tx"><span class="flag ${x.hot ? '' : 'calm'}"><i></i>${esc(x.kind)} · ${esc(x.why)}</span><h3>${esc(x.title)}</h3><p class="who">${esc(x.who)}</p><span class="act">${esc(x.act)}</span></div></div>`;
    el.addEventListener('click', () => toFront(i));
    deck.append(el); return el;
  });
  function lay() {
    const narrow = matchMedia('(max-width:900px)').matches, step = narrow ? 40 : 50, base = (CARDS.length - 1) * step;
    order.forEach((idx, pos) => {
      const el = els[idx]; el.classList.toggle('front', pos === 0); el.style.zIndex = String(10 - pos);
      el.style.setProperty('--top', (base - pos * step) + 'px'); el.style.transform = `scale(${1 - pos * 0.035})`;
      el.querySelector('.n').textContent = String(pos + 1).padStart(2, '0');
      el.setAttribute('aria-label', pos === 0 ? T.front(CARDS[idx].title) : T.nth(pos + 1, CARDS[idx].title));
    });
    // 보이는 줄은 짧게, 맨 앞 카드 제목은 읽기 프로그램만 읽는다. 크기만 바뀐 때는 다시 넣지 않는다
    const top = CARDS[order[0]], seen = T.count(CARDS.length, top.co);
    if (cnt.dataset.top !== String(order[0])) { cnt.dataset.top = String(order[0]); cnt.textContent = seen; const vh = document.createElement('span'); vh.className = 'vh'; vh.textContent = ', ' + top.title; cnt.append(vh); }
  }
  $('#nextCard').addEventListener('click', () => { order = [...order.slice(1), order[0]]; lay(); });
  addEventListener('resize', lay); lay();

  // 솔리오: 눈만 움직인다
  const orb = $('#orb'), eyes = orb.querySelector('.eyes'), still = matchMedia('(prefers-reduced-motion:reduce)');
  addEventListener('pointermove', e => {
    if (still.matches) return;
    const o = orb.getBoundingClientRect(), dx = e.clientX - (o.left + o.width * .47), dy = e.clientY - (o.top + o.height * .5), k = Math.hypot(dx, dy) || 1;
    eyes.style.setProperty('--ex', (dx / k * 9).toFixed(1) + 'px'); eyes.style.setProperty('--ey', (dy / k * 6).toFixed(1) + 'px');
  }, { passive: true });
  setInterval(() => { if (still.matches || document.hidden) return; orb.classList.add('blink'); setTimeout(() => orb.classList.remove('blink'), 140); }, 4200);
})();

// SYNK ID 로그인 시안 — 세 갈래가 함께 쓰는 장면 데이터와 폼 조각 (2026-11-11)
// 글은 공개본(index.html · src/portal.mjs · src/google-auth.mjs) 문구를 그대로 쓰고, 제목 · 안내 한 줄만 새 뼈대에 맞춰 줄였다.
// 계정 값(이름 · 이메일 · 날짜)은 예시다 — 실제 화면은 서버와 이 기기의 「지난번 로그인」이 준 값만 그린다.
(function () {
  const EX = { email: 'yuna.kim@example.com', masked: 'yu***@example.com', name: '김유나', initial: '김', joined: '2026년 10월 1일', seen: '11월 11일 오후 8:19' };
  const SCENES = [
    { id: 'first', name: '로그인 첫 방문', mode: 'login' },
    { id: 'email', name: '이메일을 고름', mode: 'login', open: true },
    { id: 'wrong', name: '틀린 비밀번호', mode: 'login', open: true, filled: true, error: '이메일 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요. Google로 가입했다면 「Google로 로그인」을 눌러 주세요.' },
    { id: 'back-email', name: '다시 옴 · 이메일', mode: 'login', recent: 'email', open: true, prefill: true },
    { id: 'back-google', name: '다시 옴 · Google', mode: 'login', recent: 'google' },
    { id: 'signup', name: '가입 · 방법 고르기', mode: 'signup' },
    { id: 'signup-email', name: '가입 · 이메일', mode: 'signup', open: true },
    { id: 'recover', name: '비밀번호를 잊었어요', mode: 'recover' },
    { id: 'reset', name: '새 비밀번호', mode: 'reset' },
    { id: 'no-google', name: 'Google을 못 쓸 때', mode: 'login', noGoogle: true, open: true },
    { id: 'onboarding', name: 'Google 첫 가입 마무리', mode: 'onboarding' },
    { id: 'consent', name: '앱 연결 · 이 PC 앱', mode: 'consent' },
    { id: 'restart', name: '앱 연결 다시 시작', mode: 'restart' },
    { id: 'account', name: '내 SYNK 계정', mode: 'account' },
  ];
  const way = s => s.recent === 'google' ? 'Google' : '이메일';
  // h = 한 줄 제목(A · B), lead = 회색 안내, two = 두 줄 큰 제목(C: 첫 줄 검정 · 둘째 줄 회색)
  function copy(s) {
    if (s.mode === 'login' && s.recent) return { h: '다시 오셨네요.', lead: `이 기기에서 지난번에 ${way(s)}로 로그인했어요 · ${EX.masked}`, two: ['다시 오셨네요.', `지난번엔 ${way(s)}로.`], recent: true };
    if (s.mode === 'login' && s.noGoogle) return { h: '이메일로 로그인해요.', lead: '이메일과 비밀번호로 로그인해요. 처음이면 아래 「가입하기」를 눌러 주세요.', two: ['이메일로 로그인', '지금은 이메일만 돼요.'] };
    return ({
      login: { h: 'SYNK ID로 로그인', lead: '가입할 때 쓴 방법 그대로 골라 주세요.', two: ['SYNK ID로 로그인', '가입한 방법 그대로.'] },
      signup: { h: 'SYNK ID 만들기', lead: 'Google로 가입하면 비밀번호를 따로 만들지 않아요. 이메일로 가입하면 비밀번호(8자 이상)를 직접 정해요.', two: ['SYNK ID 만들기', '방법 하나만 고르면 돼요.'] },
      recover: { h: '비밀번호를 다시 정해요.', lead: '가입한 이메일로 새 비밀번호를 정하는 링크를 보내 드려요. Google로 가입했다면 비밀번호가 필요 없어요 — 아래 「로그인하기」로 돌아가 「Google로 로그인」을 눌러 주세요.', two: ['비밀번호를', '다시 정해요.'] },
      reset: { h: '새 비밀번호를 정해 주세요.', lead: `${EX.email} 계정의 새 비밀번호예요. 저장하면 이 브라우저를 뺀 다른 기기와 앱에서는 로그아웃돼요.`, two: ['새 비밀번호를', '정해 주세요.'] },
      onboarding: { h: '가입을 마무리해요.', lead: '휴대폰을 인증하고 기본 정보를 입력해 주세요. 아이디와 비밀번호는 따로 만들지 않아요.', two: ['가입을', '마무리해요.'] },
      consent: { h: 'SYNK Workspace에 연결할까요?', lead: '', two: ['SYNK Workspace에', '연결할까요?'] },
      restart: { h: '로그인은 돼 있어요. 앱 연결만 다시 시작해 주세요.', lead: '앱과 이어 주던 요청이 만료됐거나 이미 사용됐어요. SYNK ID 로그인은 그대로라 새로 가입하지 않아도 돼요.', two: ['로그인은 돼 있어요.', '앱 연결만 다시 해요.'] },
      account: { h: '내 SYNK 계정', lead: '이름·로그인 방법·로그인한 곳을 여기서 보고 바꿔요.', two: [`${EX.name} 님의`, 'SYNK 계정'] },
    })[s.mode];
  }
  const WORDMARK = '<svg class="wordmark" viewBox="0 0 560 328" role="img" aria-label="싱ㅋ"><path d="M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z"/><path d="M222 8h58v172h-58Z"/><path fill-rule="evenodd" d="M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z"/><path d="M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"/></svg>';
  const G = '<svg class="g-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const ICON = {
    mail: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.3" y="4.3" width="15.4" height="11.4" rx="2.2"/><path d="m3.4 6.2 6.6 5 6.6-5"/></svg>',
    alert: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6"/><path d="M10 6.2v4.6M10 13.6v.1"/></svg>',
    check: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.6 3.6L15.5 6.5"/></svg>',
    arrow: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"/></svg>',
    down: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 8 4.5 4.5L14.5 8"/></svg>',
    up: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 12.5 4.5-4.5 4.5 4.5"/></svg>',
    pc: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="10" rx="1.6"/><path d="M7 16.5h6M10 13.5v3"/></svg>',
  };
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const label = (s, w) => s.mode === 'signup' ? `${w}로 가입` : `${w}로 로그인`;
  const googleNote = '<p class="fine">Google로 하면 이메일과 기본 프로필만 받고, Google 비밀번호는 받지 않아요. <a href="#">Google 가입 정보 안내</a></p>';
  const switchRow = s => s.mode === 'login' ? '<p class="switch">처음이세요? <button class="link" type="button">가입하기</button></p>'
    : s.mode === 'signup' ? '<p class="switch">이미 계정이 있나요? <button class="link" type="button">로그인하기</button></p>'
      : s.mode === 'recover' ? '<p class="switch">비밀번호가 생각났나요? <button class="link" type="button">로그인하기</button></p>' : '';
  const recentForget = '<button class="link small" type="button">이 기기에서 지우기</button>';
  // 이메일 칸들 — 고르면 단추 쌍 아래로 열린다. submitWide=false면 단추가 제 폭(C)
  function fields(s, { submitWide = true } = {}) {
    const email = s.prefill || s.filled ? EX.email : '';
    const parts = [];
    if (s.mode !== 'reset') parts.push(`<div class="field"><label class="label" for="em-${s.id}">이메일</label><div class="input"><input id="em-${s.id}" type="email" value="${esc(email)}" autocomplete="username"></div></div>`);
    if (s.mode !== 'recover') {
      const pw = s.mode === 'reset' ? '새 비밀번호' : '비밀번호';
      const forgot = s.mode === 'login' ? '<button class="link small" type="button">비밀번호를 잊었어요</button>' : '';
      parts.push(`<div class="field"><div class="field-top"><label class="label" for="pw-${s.id}">${pw}${s.mode === 'signup' || s.mode === 'reset' ? ' <span class="opt">8자 이상</span>' : ''}</label>${forgot}</div><div class="input${s.error ? ' bad' : ''}"><input id="pw-${s.id}" type="password" value="${s.filled ? 'example-pass' : ''}"><button class="peek" type="button" aria-pressed="false">보기</button></div></div>`);
    }
    if (s.mode === 'reset') parts.push(`<div class="field"><label class="label" for="pw2-${s.id}">새 비밀번호 확인</label><div class="input"><input id="pw2-${s.id}" type="password"><button class="peek" type="button" aria-pressed="false">보기</button></div></div>`);
    if (s.mode === 'signup') parts.push(`<div class="consents">
      <label class="check"><input type="checkbox"><span>만 14세 이상이에요 <span class="opt">(필수)</span></span></label>
      <label class="check"><input type="checkbox"><span>학습 기록을 계정에 저장할게요 <span class="opt">(선택)</span><span class="fine block">선택하면 연습 기록·도움 방식·화면 설정·게임 난도를 계정에 저장해요. 언제든 저장을 끄거나 삭제를 요청할 수 있어요.</span></span></label>
      <details class="more"><summary>학습 기록 저장 안내</summary><p class="fine">저장하면 연습 기록, 직접 고른 도움 방식과 화면 설정, 게임마다 맞춰진 난도가 계정에 남아 어느 기기와 SYNK 앱에서든 이어져요. 나이·성별이나 성격은 짐작해 저장하지 않아요. 계정 화면에서 언제든 끄고, 내려받고, 삭제를 요청할 수 있어요.</p></details>
      <p class="fine">가입하면 이메일과 비밀번호(암호화해 보관)를 로그인과 SYNK 서비스 제공에 쓰고, 계정 삭제 요청을 처리할 때까지 보관해요. 자세한 내용은 <a href="#">개인정보 처리 안내</a>에 있어요.</p></div>`);
    if (s.error) parts.push(`<p class="say err" role="alert">${ICON.alert}<span>${esc(s.error)}</span></p>`);
    const submit = { login: '로그인', signup: '가입하기', recover: '재설정 메일 보내기', reset: '새 비밀번호 저장' }[s.mode];
    parts.push(`<button class="pill pill-solid${submitWide ? ' wide' : ''} submit" type="button">${submit}</button>`);
    return `<div class="fields">${parts.join('')}</div>`;
  }
  // 단추 한 쌍(A · B)
  function pair(s) {
    const gBadge = s.recent === 'google' ? '<span class="badge">최근 사용</span>' : '', eBadge = s.recent === 'email' ? '<span class="badge">최근 사용</span>' : '';
    return `<div class="pair" role="group" aria-label="${s.mode === 'signup' ? '가입 방법' : '로그인 방법'}">
      <button class="method" type="button"${s.noGoogle ? ' disabled' : ''}>${G}<span>${label(s, 'Google')}</span>${gBadge}</button>
      <button class="method" type="button" aria-expanded="${!!s.open}">${ICON.mail}<span>${label(s, '이메일')}</span>${eBadge}</button>
      ${s.noGoogle ? '<p class="fine">지금은 Google 로그인을 쓸 수 없어요. 이메일로 로그인해 주세요.</p>' : ''}
    </div>`;
  }
  // 로그인 · 가입 · 비밀번호 칸 본문(A · B)
  function authBody(s) {
    const out = [];
    if (s.mode === 'login' || s.mode === 'signup') out.push(pair(s));
    if (s.open || s.mode === 'recover' || s.mode === 'reset') out.push(fields(s));
    if ((s.mode === 'login' || s.mode === 'signup') && !s.noGoogle) out.push(googleNote);
    const sw = switchRow(s);if (sw) out.push(sw);
    return out.join('');
  }
  // 줄 목록 본문(C) — 두 방법이 같은 꼴의 줄 둘, 이메일 줄을 누르면 그 줄 아래로 칸이 열린다
  function rowsBody(s) {
    const out = [];
    if (s.mode === 'login' || s.mode === 'signup') {
      const gBadge = s.recent === 'google' ? '<span class="badge">최근 사용</span>' : '', eBadge = s.recent === 'email' ? '<span class="badge">최근 사용</span>' : '';
      out.push(`<ul class="mrows" role="group" aria-label="${s.mode === 'signup' ? '가입 방법' : '로그인 방법'}">
        <li><button class="mrow" type="button"${s.noGoogle ? ' disabled' : ''}><span class="mrow-mark">${G}</span><span class="mrow-name">${label(s, 'Google')}</span>${gBadge}<span class="mrow-end">${s.noGoogle ? '<span class="fine">지금은 쓸 수 없어요</span>' : ICON.arrow}</span></button></li>
        <li class="${s.open ? 'is-open' : ''}"><button class="mrow" type="button" aria-expanded="${!!s.open}"><span class="mrow-mark">${ICON.mail}</span><span class="mrow-name">${label(s, '이메일')}</span>${eBadge}<span class="mrow-end">${s.open ? ICON.up : ICON.down}</span></button>${s.open ? `<div class="mrow-body">${fields(s, { submitWide: false })}</div>` : ''}</li>
      </ul>`);
    } else if (s.mode === 'recover' || s.mode === 'reset') out.push(`<div class="solo">${fields(s, { submitWide: false })}</div>`);
    const notes = [];
    if ((s.mode === 'login' || s.mode === 'signup') && !s.noGoogle) notes.push(googleNote);
    const sw = switchRow(s);if (sw) notes.push(sw.replace('class="switch"', 'class="switch left"'));
    if (notes.length) out.push(`<div class="notes">${notes.join('')}</div>`);
    return out.join('');
  }
  // Google 첫 가입 마무리 — index.html #google-onboarding 의 칸 그대로
  function onboarding({ submitWide = true } = {}) {
    return `<div class="fields onboard">
      <label class="check"><input type="checkbox"><span>개인정보 수집·이용 안내를 확인했어요 <span class="opt">(필수)</span><span class="fine block">휴대폰 번호·국가·나이·성별을 계정 관리와 SYNK 서비스 제공을 위해 보관하며, 계정 삭제 요청을 처리할 때까지 유지해요. 성별은 응답하지 않아도 돼요. 번호를 보내기 전에 <a href="#">개인정보 처리 안내</a>를 확인해 주세요.</span></span></label>
      <fieldset class="field"><legend class="label">휴대폰 번호 인증</legend>
        <div class="row-input"><div class="input"><input type="tel" placeholder="+821012345678" aria-label="휴대폰 번호"></div><button class="pill pill-line" type="button">인증번호 받기</button></div>
        <p class="fine">국제번호로 입력해 주세요. 한국 번호 010-1234-5678은 +821012345678이에요.</p>
        <div class="row-input"><div class="input"><input type="text" inputmode="numeric" placeholder="6자리 인증번호" aria-label="문자로 받은 인증번호"></div><button class="pill pill-line" type="button">인증번호 확인</button></div>
        <p class="say info">국가번호를 포함한 휴대폰 번호로 인증번호를 보내 주세요.</p>
      </fieldset>
      <div class="two-col">
        <div class="field"><label class="label" for="ob-country">국가</label><div class="input"><select id="ob-country"><option>국가 선택</option></select></div></div>
        <div class="field"><label class="label" for="ob-age">나이 <span class="opt">(만 나이)</span></label><div class="input"><input id="ob-age" type="number" placeholder="만 14세 이상"></div></div>
      </div>
      <p class="fine">SYNK 계정은 만 14세부터 만들 수 있어요. 생년월일은 받지 않아요.</p>
      <div class="field"><label class="label" for="ob-gender">성별</label><div class="input"><select id="ob-gender"><option>성별 선택</option></select></div></div>
      <label class="check"><input type="checkbox"><span>학습 기록을 계정에 저장할게요 <span class="opt">(선택)</span><span class="fine block">선택하면 연습 기록·도움 방식·화면 설정·게임 난도를 계정에 저장해요. 언제든 저장을 끄거나 삭제를 요청할 수 있어요.</span></span></label>
      <div class="acts"><button class="pill pill-solid${submitWide ? ' wide' : ''}" type="button">가입 완료</button><button class="pill pill-line${submitWide ? ' wide' : ''}" type="button">나중에 하기</button></div>
      <p class="fine">나중에 하기를 누르면 이 브라우저에서 로그아웃해요. Google 인증 계정은 가입을 이어갈 수 있도록 남아 있어요. 입력·인증한 휴대폰 번호도 함께 남아 있어요. 삭제하려면 <a href="#">가입 대기 정보 삭제 요청</a>을 보내 주세요.</p>
    </div>`;
  }
  // 앱 연결(이 PC 앱) — 계정을 보이고 「연결하기」를 기다린다
  function consent({ wide = false } = {}) {
    return `<div class="consent">
      <div class="who"><span class="avatar sm">${EX.initial}</span><div class="r-main"><span class="r-k">로그인한 계정</span><span class="r-v">${EX.email}</span></div></div>
      <p class="say info">${ICON.pc}<span>이 PC에서 방금 SYNK 앱을 열었거나 로그인을 시작했을 때만 「연결하기」를 눌러 주세요. 그런 적이 없다면 「취소」를 눌러 주세요.</span></p>
      <div class="give"><p class="label">이 앱에 넘기는 것</p><ul class="rows tight"><li><span class="r-v plain">계정을 구분하는 정보</span></li><li><span class="r-v plain">이메일 주소</span></li><li><span class="r-v plain">기본 프로필</span></li></ul>
      <p class="fine">「학습 기록 연결」은 계정 화면에서 따로 정해요. 돌아갈 곳: <span class="url">http://127.0.0.1:43999/synk/oauth/messenger/callback</span></p></div>
      <div class="acts${wide ? ' stack' : ''}"><button class="pill pill-solid${wide ? ' wide' : ''}" type="button">연결하기</button><button class="pill pill-line${wide ? ' wide' : ''}" type="button">취소</button></div>
    </div>`;
  }
  function restart({ wide = false } = {}) {
    return `<div class="restart">
      <p class="lead">사용하던 앱으로 돌아가 거기서 로그인을 다시 시작해 주세요. 계정은 아래 「내 SYNK 계정 보기」에서 볼 수 있어요.</p>
      <p class="fine" lang="en">You are signed in. The app request expired or was already used. No new sign-up needed: go back to your app and sign in again there.</p>
      <div class="acts"><a class="pill pill-solid${wide ? ' wide' : ''}" href="#">내 SYNK 계정 보기 <span lang="en">· My SYNK account</span></a></div>
    </div>`;
  }
  // 내 SYNK 계정 — 위쪽 세 묶음(프로필 · 로그인과 보안 · 로그인한 곳) + 나머지 묶음 이름
  function account({ head = true } = {}) {
    return `<div class="account">
      ${head ? `<div class="me"><span class="avatar">${EX.initial}</span><div class="r-main"><span class="h22">${EX.name}</span><span class="fine">${EX.email}</span></div><button class="pill pill-line me-out" type="button">로그아웃</button></div>` : ''}
      <ul class="rows">
        <li><div class="r-main"><span class="r-k">이름</span><span class="r-v">${EX.name}</span></div><button class="link r-act" type="button">바꾸기</button></li>
        <li><div class="r-main"><span class="r-k">가입한 날</span><span class="r-v plain">${EX.joined}</span></div></li>
        <li><div class="r-main"><span class="r-k">소속</span><span class="r-v plain">학교·회사와 연결된 소속이 없어요.</span></div></li>
      </ul>
      <section><h2 class="h22">로그인과 보안</h2><p class="fine">로그인 이메일·로그인 방법·비밀번호를 여기서 보고 바꿔요.</p>
      <ul class="rows">
        <li><div class="r-main"><span class="r-k">로그인 이메일</span><span class="r-v">${EX.email}</span></div><button class="link r-act" type="button">이메일 바꾸기</button></li>
        <li><div class="r-main"><span class="r-k">로그인 방법</span><span class="r-v plain">이메일·비밀번호</span></div><button class="pill pill-line r-act g" type="button">${G}<span>Google 계정 연결</span></button></li>
        <li><div class="r-main"><span class="r-k">비밀번호</span><span class="fine">바꾸면 이 브라우저를 뺀 다른 기기와 앱(PC 앱·WORLD 포함)에서는 로그아웃돼요.</span></div><button class="link r-act" type="button">비밀번호 바꾸기</button></li>
      </ul></section>
      <section><h2 class="h22">로그인한 곳</h2><p class="fine">이 계정으로 로그인해 있는 SYNK 앱이에요. 모르는 곳이 있으면 로그아웃시키고 비밀번호를 바꿔 주세요.</p>
      <ul class="rows">
        <li><div class="r-main"><span class="r-v">SYNK 플랫폼<span class="here">이 브라우저</span></span><span class="fine">${EX.seen}에 사용</span></div><button class="link r-act" type="button">로그아웃</button></li>
      </ul><p><button class="link small" type="button">모든 SYNK 앱에서 로그아웃</button></p></section>
      <section class="later"><h2 class="h22">학습 기록</h2><h2 class="h22">마을 기록</h2><h2 class="h22">내 데이터와 계정 삭제</h2><p class="fine">같은 줄 목록으로 이어져요.</p></section>
    </div>`;
  }
  const footLinks = '<nav class="foot" aria-label="SYNK 링크"><a href="#">SYNK 홈</a><a href="#">개인정보 처리 안내</a><a href="#">문의 hello@synk.im</a></nav>';
  // #장면 → 장면 데이터. 비교 쪽 iframe 이 a.html#wrong 처럼 부른다.
  function current() { const id = decodeURIComponent(location.hash.slice(1)) || 'first';return SCENES.find(s => s.id === id) || SCENES[0]; }
  window.SYNKMOCK = { EX, SCENES, copy, WORDMARK, G, ICON, esc, pair, fields, authBody, rowsBody, onboarding, consent, restart, account, recentForget, footLinks, current };
})();

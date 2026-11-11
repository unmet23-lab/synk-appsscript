// SYNK ID 로그인 시안 — 세 갈래가 함께 쓰는 장면 데이터와 화면 조각 (2026-11-11, 2판)
// 마크업은 공개본 experiences/synk-account/index.html 의 짜임 그대로다 — 요소 id · 클래스 · 부모 관계 · DOM 순서
// (label 안의 #email, .field-row 안의 #password, 칸 뒤의 #forgot-row, .actions 안의 #approve …). 그래서 시안의 CSS가 곧 구현의 CSS다.
// 옮긴 것은 둘뿐: #google-privacy-note 를 단추 쌍 바로 아래로(Google 안내가 이메일 제출 단추 밑에 있던 것), 영문 꼬리표 자리의 「SYNK ID」 회색 머리.
// 글은 공개본(index.html · src/portal.mjs · src/google-auth.mjs) 문구다. 줄인 곳: 로그인 안내 둘째 문장, 다시 온 사람의 안내 한 줄.
// 계정 값(이름 · 이메일 · 날짜)은 예시다 — 실제 화면은 서버와 이 기기의 「지난번 로그인」이 준 값만 그린다.
(function () {
  const EX = { email: 'yuna.kim@example.com', masked: 'yu***@example.com', name: '김유나', joined: '2026년 10월 1일', seen: '11월 11일 오후 8:19' };
  const SCENES = [
    { id: 'first', name: '로그인 첫 방문', mode: 'login' },
    { id: 'email', name: '이메일을 고름', mode: 'login', open: true },
    { id: 'wrong', name: '틀린 비밀번호', mode: 'login', open: true, filled: true, error: '이메일 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요. Google로 가입했다면 「Google로 로그인」을 눌러 주세요.' },
    { id: 'back-email', name: '다시 옴 · 이메일', mode: 'login', recent: 'email', open: true, prefill: true },
    { id: 'back-google', name: '다시 옴 · Google', mode: 'login', recent: 'google' },
    { id: 'signup', name: '가입 · 방법 고르기', mode: 'signup' },
    { id: 'signup-email', name: '가입 · 이메일', mode: 'signup', open: true },
    { id: 'sent', name: '가입 메일 보냄', mode: 'signup', open: true, prefill: true, checked: true, sent: '가입 확인 메일을 요청했어요. 메일함에서 메일을 열고 안에 있는 단추를 눌러 주세요. 안 보이면 스팸함도 보고, 그래도 없으면 아래 단추로 다시 보내 주세요.' },
    { id: 'recover', name: '비밀번호를 잊었어요', mode: 'recover' },
    { id: 'reset', name: '새 비밀번호', mode: 'reset' },
    { id: 'no-google', name: 'Google을 못 쓸 때', mode: 'login', noGoogle: true, open: true },
    { id: 'onboarding', name: 'Google 첫 가입 마무리', mode: 'onboarding' },
    { id: 'consent', name: '앱 연결 · 이 PC 앱', mode: 'consent' },
    { id: 'restart', name: '앱 연결 다시 시작', mode: 'restart' },
    { id: 'account', name: '내 SYNK 계정', mode: 'account' },
  ];
  const way = s => s.recent === 'google' ? 'Google' : '이메일';
  // h = #auth-heading(공개본 제목 그대로), copy = #auth-copy(A · B의 회색 안내), two = C의 회색 둘째 줄(#auth-copy 자리), help = C에서 칸 옆으로 내려가는 긴 안내
  function head(s) {
    const RECOVER = '가입한 이메일로 새 비밀번호를 정하는 링크를 보내 드려요. Google로 가입했다면 비밀번호가 필요 없어요 — 아래 「로그인하기」로 돌아가 「Google로 로그인」을 눌러 주세요.';
    if (s.mode === 'login' && s.recent) return { h: '다시 오셨네요.', copy: '', two: `지난번엔 ${way(s)}로.` };
    if (s.mode === 'login' && s.noGoogle) return { h: '이메일로 로그인해요.', copy: '이메일과 비밀번호로 로그인해요. 처음이면 아래 「가입하기」를 눌러 주세요.', two: '이메일과 비밀번호로.' };
    return ({
      login: { h: '로그인 방법을 골라 주세요.', copy: '가입할 때 쓴 방법 그대로 로그인해요.', two: '가입할 때 쓴 방법 그대로.' },
      signup: { h: '가입 방법을 골라 주세요.', copy: 'Google로 가입하면 비밀번호를 따로 만들지 않아요. 이메일로 가입하면 비밀번호(8자 이상)를 직접 정해요.', two: '하나만 고르면 돼요.' },
      recover: { h: '비밀번호를 다시 정해요.', copy: RECOVER, two: '메일로 링크를 보내 드려요.', help: 'Google로 가입했다면 비밀번호가 필요 없어요 — 아래 「로그인하기」로 돌아가 「Google로 로그인」을 눌러 주세요.' },
      reset: { h: '새 비밀번호를 정해 주세요.', copy: `${EX.email} 계정의 새 비밀번호예요. 저장하면 이 브라우저를 뺀 다른 기기와 앱에서는 로그아웃돼요.`, two: '다른 기기에서는 로그아웃돼요.', help: `${EX.email} 계정의 새 비밀번호예요.` },
      onboarding: { h: '가입을 마무리해요.', copy: '휴대폰을 인증하고 기본 정보를 입력해 주세요. 아이디와 비밀번호는 따로 만들지 않아요.', two: '기본 정보만 더 알려 주세요.' },
      account: { h: '내 SYNK 계정', copy: '이름·로그인 방법·로그인한 곳을 여기서 보고 바꿔요.', two: '여기서 보고 바꿔요.' },
    })[s.mode] || {};
  }
  const WORDMARK = '<svg class="wordmark" viewBox="0 0 560 328" role="img" aria-label="싱ㅋ"><path d="M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z"/><path d="M222 8h58v172h-58Z"/><path fill-rule="evenodd" d="M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z"/><path d="M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"/></svg>';
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const word = (s, w) => s.mode === 'signup' ? `${w}로 가입` : `${w}로 로그인`;
  const privacy = '<a href="#">개인정보 처리 안내</a>';

  // 로그인 · 가입 · 비밀번호 단계의 폼 — index.html #auth-form 과 같은 짜임 · 같은 차례
  function authForm(s, { help = '' } = {}) {
    const choosing = s.mode === 'login' || s.mode === 'signup', open = s.open || !choosing;
    const email = s.prefill || s.filled ? EX.email : '';
    const badge = m => `<span class="recent-badge"${s.recent === m ? '' : ' hidden'}>최근 사용</span>`;
    const submit = { login: '로그인', signup: '가입하기', recover: '재설정 메일 보내기', reset: '새 비밀번호 저장' }[s.mode];
    const sw = { login: ['처음이세요?', '가입하기'], signup: ['이미 계정이 있나요?', '로그인하기'], recover: ['비밀번호가 생각났나요?', '로그인하기'] }[s.mode];
    // 지난번 로그인 한 줄: 이메일이면 바로 아래 칸에 주소가 채워지므로 가린 주소를 되풀이하지 않는다
    const recent = s.recent ? `<div id="recent-login" class="recent-login"><p id="recent-login-text"><span class="rl-say">이 기기에서 지난번에 ${way(s)}로 로그인했어요</span>${s.recent === 'google' ? ` <span class="nw rl-who"><span class="rl-dot">· </span>${EX.masked}</span>` : ''}</p><button id="recent-login-forget" class="link-button" type="button">이 기기에서 지우기</button></div>` : '';
    const pair = choosing ? `<div id="method-choices" class="method-choices" role="group" aria-label="${s.mode === 'signup' ? '가입 방법' : '로그인 방법'}">
      <button id="google-login" class="method-btn" type="button"${s.noGoogle ? ' disabled data-off' : ''}><span class="method-mark google-mark" aria-hidden="true"></span><span id="google-login-label" class="method-label">${word(s, 'Google')}</span>${badge('google')}</button>
      <button id="email-method" class="method-btn" type="button" aria-expanded="${!!s.open}" aria-controls="email-fields"><span class="method-mark email-mark" aria-hidden="true"></span><span id="email-method-label" class="method-label">${word(s, '이메일')}</span>${badge('email')}</button>
      <p id="google-availability" class="small method-status" role="status">${s.noGoogle ? '지금은 Google 로그인을 쓸 수 없어요. 이메일로 로그인해 주세요.' : ''}</p>
    </div>` : '';
    const note = choosing && !s.noGoogle ? '<p id="google-privacy-note" class="small google-privacy-note">Google로 하면 이메일과 기본 프로필만 받고, Google 비밀번호는 받지 않아요. <a href="#">Google 가입 정보 안내</a></p>' : '';
    const fields = open ? `<div id="email-fields" class="email-fields">
      ${s.mode === 'reset' ? '' : `<label>이메일<input id="email" type="email" inputmode="email" autocomplete="username" value="${esc(email)}"></label>`}
      ${help ? `<p class="small field-help">${esc(help)}</p>` : ''}
      ${s.mode === 'recover' ? '' : `<div id="password-label" class="field-row"><label id="password-label-text" for="password">${s.mode === 'reset' ? '새 비밀번호' : '비밀번호'}${s.mode === 'signup' || s.mode === 'reset' ? ' <span class="muted">(8자 이상)</span>' : ''}</label><span class="password-field"><input id="password" type="password" value="${s.filled ? 'example-pass' : ''}"${s.error ? ' aria-invalid="true"' : ''}><button id="password-toggle" class="password-toggle" type="button" aria-pressed="false" aria-label="비밀번호 보기">보기</button></span></div>`}
      ${s.mode === 'login' ? '<p id="forgot-row" class="forgot-row"><button class="link-button" type="button" data-view="recover">비밀번호를 잊었어요</button></p>' : ''}
      ${s.mode === 'reset' ? '<div id="password-confirm-label" class="field-row"><label for="password-confirm">새 비밀번호 확인</label><span class="password-field"><input id="password-confirm" type="password"><button id="password-confirm-toggle" class="password-toggle" type="button" aria-pressed="false" aria-label="새 비밀번호 확인 보기">보기</button></span></div>' : ''}
      ${s.mode === 'signup' ? `<div id="signup-choices" class="signup-choices">
        <label class="toggle"><input id="signup-age" type="checkbox"${s.checked ? ' checked' : ''}><span>만 14세 이상이에요 <span class="muted">(필수)</span></span></label>
        <label class="toggle"><input id="signup-learning" type="checkbox"><span>학습 기록을 계정에 저장할게요 <span class="muted">(선택)</span></span></label>
        <p id="learning-summary" class="small">선택하면 연습 기록·도움 방식·화면 설정·게임 난도를 계정에 저장해요. 언제든 저장을 끄거나 삭제를 요청할 수 있어요.</p>
        <details class="signup-details"><summary>학습 기록 저장 안내</summary><p class="small">저장하면 연습 기록, 직접 고른 도움 방식과 화면 설정, 게임마다 맞춰진 난도가 계정에 남아 어느 기기와 SYNK 앱에서든 이어져요. 나이·성별이나 성격은 짐작해 저장하지 않아요. 계정 화면에서 언제든 끄고, 내려받고, 삭제를 요청할 수 있어요.</p></details>
        <p class="small signup-privacy">가입하면 이메일과 비밀번호(암호화해 보관)를 로그인과 SYNK 서비스 제공에 쓰고, 계정 삭제 요청을 처리할 때까지 보관해요. 자세한 내용은 ${privacy}에 있어요.</p>
      </div>` : ''}
      ${s.error ? `<p class="notice error" data-kind="error">${esc(s.error)}</p>` : ''}
      ${s.sent ? `<p class="notice" data-kind="success">${esc(s.sent)}</p>` : ''}
      <button id="auth-submit" class="sb-btn" type="submit">${submit}</button>
      ${s.sent ? '<button id="resend-confirm" class="sb-btn soft resend-confirm" type="button">확인 메일 다시 받기</button>' : ''}
    </div>` : '';
    const switchRow = sw ? `<p id="switch-row" class="switch-row"><span id="switch-copy">${sw[0]}</span><button class="link-button" type="button">${sw[1]}</button></p>` : '';
    return `<form id="auth-form" class="auth-card" onsubmit="return false">${recent}${pair}${note}${fields}${switchRow}</form>`;
  }
  // Google 첫 가입 마무리 — #google-onboarding-form 그대로(보이는 이름표 둘도 공개본처럼 칸 위에)
  function onboardingForm() {
    return `<form id="google-onboarding-form" class="auth-card google-onboarding-card" onsubmit="return false">
      <div class="signup-choices google-signup-choices">
        <label class="toggle"><input id="google-privacy" type="checkbox"><span>개인정보 수집·이용 안내를 확인했어요 <span class="muted">(필수)</span></span></label>
        <p id="google-privacy-summary" class="small signup-privacy">휴대폰 번호·국가·나이·성별을 계정 관리와 SYNK 서비스 제공을 위해 보관하며, 계정 삭제 요청을 처리할 때까지 유지해요. 성별은 응답하지 않아도 돼요. 번호를 보내기 전에 ${privacy}를 확인해 주세요.</p>
      </div>
      <fieldset id="google-phone-fields" class="google-phone-fields">
        <legend>휴대폰 번호 인증</legend>
        <label class="google-field-label" for="google-phone">휴대폰 번호</label>
        <div class="google-phone-row"><input id="google-phone" type="tel" inputmode="tel" placeholder="+821012345678"><button id="google-phone-send" class="sb-btn soft" type="button">인증번호 받기</button></div>
        <p id="google-phone-help" class="small field-help">국제번호로 입력해 주세요. 한국 번호 010-1234-5678은 +821012345678이에요.</p>
        <label class="google-field-label" for="google-phone-code">문자로 받은 인증번호</label>
        <div class="google-phone-row"><input id="google-phone-code" type="text" inputmode="numeric" placeholder="6자리 인증번호"><button id="google-phone-verify" class="sb-btn soft" type="button">인증번호 확인</button></div>
        <p id="google-phone-status" class="small" role="status">국가번호를 포함한 휴대폰 번호로 인증번호를 보내 주세요.</p>
      </fieldset>
      <label>국가<select id="google-country"><option value="">국가 선택</option></select></label>
      <label>나이 <span class="muted">(만 나이)</span><input id="google-age" type="number" inputmode="numeric" placeholder="만 14세 이상"></label>
      <p id="google-age-help" class="small field-help">SYNK 계정은 만 14세부터 만들 수 있어요. 생년월일은 받지 않아요.</p>
      <label>성별<select id="google-gender"><option value="">성별 선택</option></select></label>
      <div class="signup-choices google-signup-choices">
        <label class="toggle"><input id="google-learning" type="checkbox"><span>학습 기록을 계정에 저장할게요 <span class="muted">(선택)</span></span></label>
        <p id="google-learning-summary" class="small">선택하면 연습 기록·도움 방식·화면 설정·게임 난도를 계정에 저장해요. 언제든 저장을 끄거나 삭제를 요청할 수 있어요.</p>
      </div>
      <button id="google-complete" class="sb-btn" type="submit">가입 완료</button>
      <div class="text-actions google-cancel-actions"><button id="google-cancel" class="sb-btn soft" type="button">나중에 하기</button></div>
      <p id="google-cancel-note" class="small">나중에 하기를 누르면 이 브라우저에서 로그아웃해요. Google 인증 계정은 가입을 이어갈 수 있도록 남아 있어요. 입력·인증한 휴대폰 번호도 함께 남아 있어요. 삭제하려면 <a href="#">가입 대기 정보 삭제 요청</a>을 보내 주세요.</p>
    </form>`;
  }
  // 앱 연결(이 PC 앱) — #consent 그대로. 「이 PC에서 방금 …했을 때만」은 이 화면에서 가장 무거운 한 줄이라 검은 글로 단추 바로 위에 한 번만.
  function consent({ title = true } = {}) {
    return `<section id="consent" class="consent">
      ${title ? '<h2><span id="consent-name">SYNK Workspace</span>에 연결할까요?</h2>' : ''}
      <p id="consent-account">로그인한 계정: ${EX.email}</p>
      <div class="consent-give"><p class="consent-lead">아래 정보를 이 앱에 넘겨요.</p><ul id="scopes"><li>계정을 구분하는 정보</li><li>이메일 주소</li><li>기본 프로필</li></ul>
      <p class="small">「학습 기록 연결」은 계정 화면에서 따로 정해요. 돌아갈 곳: <span id="consent-destination">http://127.0.0.1:43999/synk/oauth/messenger/callback</span></p></div>
      <p id="consent-native" class="consent-native">이 PC에서 방금 SYNK 앱을 열었거나 로그인을 시작했을 때만 「연결하기」를 눌러 주세요. 그런 적이 없다면 「취소」를 눌러 주세요.</p>
      <div class="actions"><button id="approve" class="sb-btn" type="button">연결하기</button><button id="deny" class="sb-btn soft" type="button">취소</button></div>
    </section>`;
  }
  // 앱 연결 다시 시작 — 할 일은 앱으로 돌아가는 것이라 「내 SYNK 계정 보기」는 곁길(선 알약)
  function restart({ title = true } = {}) {
    return `<section id="connection-restart" class="consent">
      ${title ? '<h2 id="connection-restart-heading">로그인은 돼 있어요. 앱 연결만 다시 시작해 주세요.</h2>' : ''}
      <p>앱과 이어 주던 요청이 만료됐거나 이미 사용됐어요. SYNK ID 로그인은 그대로라 새로 가입하지 않아도 돼요.</p>
      <p id="connection-restart-next" class="consent-native">사용하던 앱으로 돌아가 거기서 로그인을 다시 시작해 주세요.</p>
      <p id="connection-restart-en" class="small" lang="en">You are signed in. The app request expired or was already used. No new sign-up needed: go back to your app and sign in again there.</p>
      <div class="actions"><a id="connection-restart-home" class="sb-btn soft" href="#">내 SYNK 계정 보기 <span lang="en">· My SYNK account</span></a></div>
    </section>`;
  }
  // 내 SYNK 계정 — 위쪽 세 묶음의 미리 보기. 나머지(학습 기록 · 마을 기록 · 내 데이터와 계정 삭제 · 줄 안에서 열리는 폼)는 고르신 갈래로 끝까지 그려 다시 검수받는다.
  function account() {
    return `<div class="account">
      <ul class="rows">
        <li><div class="r-main"><span class="r-k">이름</span><span class="r-v">${EX.name}</span></div><button class="link-button" type="button">바꾸기</button></li>
        <li><div class="r-main"><span class="r-k">가입한 날</span><span class="r-v plain">${EX.joined}</span></div></li>
        <li><div class="r-main"><span class="r-k">소속</span><span class="r-v plain">학교·회사와 연결된 소속이 없어요.</span></div></li>
      </ul>
      <section id="account-security" class="account-security"><div class="security-head"><h2 id="account-security-heading">로그인과 보안</h2><p class="small">로그인 이메일·로그인 방법·비밀번호를 여기서 보고 바꿔요.</p></div>
      <ul class="rows">
        <li><div class="r-main"><span class="r-k">로그인 이메일</span><span class="r-v">${EX.email}</span></div><button id="email-form-toggle" class="link-button" type="button">이메일 바꾸기</button></li>
        <li><div class="r-main"><span class="r-k">로그인 방법</span><span class="r-v plain">이메일·비밀번호</span></div><button id="google-link" class="sb-btn soft compact" type="button"><span class="method-mark google-mark" aria-hidden="true"></span><span>Google 계정 연결</span></button></li>
        <li><div class="r-main"><span class="r-k">비밀번호</span><span class="small">바꾸면 이 브라우저를 뺀 다른 기기와 앱(PC 앱·WORLD 포함)에서는 로그아웃돼요.</span></div><button id="password-form-toggle" class="link-button" type="button">비밀번호 바꾸기</button></li>
      </ul></section>
      <section class="account-sessions"><div class="security-head"><h2>로그인한 곳</h2><p class="small">이 계정으로 로그인해 있는 SYNK 앱이에요. 모르는 곳이 있으면 로그아웃시키고 비밀번호를 바꿔 주세요.</p></div>
      <ul class="rows">
        <li><div class="r-main"><span class="r-v">SYNK 플랫폼<span class="here">이 브라우저</span></span><span class="small">${EX.seen}에 사용</span></div><button class="link-button" type="button">로그아웃</button></li>
      </ul><p><button class="link-button" type="button">모든 SYNK 앱에서 로그아웃</button></p></section>
      <p class="small mock-note">시안에서는 여기까지 — 학습 기록 · 마을 기록 · 내 데이터와 계정 삭제는 고르신 갈래로 이어 그려요.</p>
    </div>`;
  }
  const footLinks = '<p class="footer-links"><a href="#">SYNK 홈</a><a href="#">개인정보 처리 안내</a><a href="#">문의 hello@synk.im</a></p>';
  // 한 장면의 본문(머리 글은 갈래가 따로 그린다)
  function body(s, opt = {}) {
    if (['login', 'signup', 'recover', 'reset'].includes(s.mode)) return authForm(s, opt);
    if (s.mode === 'onboarding') return onboardingForm();
    if (s.mode === 'consent') return consent(opt);
    if (s.mode === 'restart') return restart(opt);
    return account();
  }
  // #장면 → 장면 데이터. 비교 쪽 iframe 이 a.html#wrong 처럼 부른다.
  function current() { const id = decodeURIComponent(location.hash.slice(1)) || 'first';return SCENES.find(s => s.id === id) || SCENES[0]; }
  window.SYNKMOCK = { EX, SCENES, head, WORDMARK, esc, body, authForm, onboardingForm, consent, restart, account, footLinks, current };
})();

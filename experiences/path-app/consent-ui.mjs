// PATH 「내 조건을 계정에 저장할까요?」 동의 화면과 둘레 알림. 상태를 받아 HTML 글을 내는 순수 함수만 둔다.
// 결: 시안 2판(.sx). 몽골 학생과 보호자가 함께 읽도록 한국어 · 영어 화면 아래에 몽골어 문장을 늘 함께 둔다(현지어 대조를 거친 문장).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const ON = svg('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
export const PRIVACY_URL = 'https://synk.im/privacy/#synk-id';

// 항목: [머리, 한국어, 영어, 몽골어]
const ITEMS = [
  ['what', '저장하는 것', 'What is saved', 'Хадгалах зүйл',
    '한국어 급수, 고등학교 성적(백분위), 준비한 돈, 학력, 비교에 담은 과정, 내 길에 넣은 날, 끈 채널, 고른 과정, 「준비했어요」 표시',
    'Korean level, high school grades (percentile), money you have prepared, education, programs in compare, dates added to My path, channels you turned off, the program you picked, and your “Ready” marks',
    'Солонгос хэлний түвшин, ахлах сургуулийн дүн (хувиар), бэлтгэсэн мөнгө, боловсрол, харьцуулахаар нэмсэн хөтөлбөр, «Миний зам»-д нэмсэн өдрүүд, унтраасан суваг, сонгосон хөтөлбөр, «Бэлэн болсон» тэмдэг'],
  ['why', '쓰는 곳', 'What it is for', 'Хэрэглэх зорилго',
    '내 길과 대학 맞춤을 다른 기기에서도 이어서 보여 줘요. 나만 봐요. 지금은 담당자가 보지 않아요.',
    'To show My path and school matches on your other devices too. Only you can see it. No staff member sees it for now.',
    '«Миний зам» болон их сургуулийн тохируулгыг өөр төхөөрөмж дээр ч үргэлжлүүлэн харуулна. Зөвхөн та харна. Одоогоор ажилтан харахгүй.'],
  ['where', '저장하는 곳', 'Where it is stored', 'Хадгалах газар',
    'SYNK 계정 데이터베이스(Supabase, Inc.)의 싱가포르 서버예요. 정보가 몽골 밖으로 옮겨져요. 바꿀 때마다 암호화된 연결로 보내요.',
    'Servers in Singapore for the SYNK account database (Supabase, Inc.). Your information leaves Mongolia. Each change is sent over an encrypted connection.',
    'SYNK бүртгэлийн мэдээллийн сангийн (Supabase, Inc.) Сингапур дахь сервер. Мэдээллийг Монголоос гадагш дамжуулна. Өөрчлөх бүрд шифрлэгдсэн холболтоор илгээнэ.'],
  ['keep', '보관', 'How long', 'Хадгалах хугацаа',
    '내가 지우거나 계정을 삭제할 때까지 보관해요. 내 정보에서 언제든 지울 수 있고, 지우면 동의를 거두는 것이에요.',
    'Until you delete it or delete your account. You can delete it at any time on the Profile page, and deleting it withdraws your consent.',
    'Та өөрөө устгах эсвэл бүртгэлээ устгах хүртэл хадгална. «Миний мэдээлэл» хэсгээс хүссэн үедээ устгаж болно. Устгавал зөвшөөрлөө цуцалсан гэсэн үг.'],
  ['no', '거부', 'Saying no', 'Татгалзах',
    '저장하지 않아도 돼요. 그러면 지금처럼 이 탭에만 두고, 탭을 닫으면 사라져요.',
    'You do not have to save it. Then it stays in this tab only, as now, and disappears when you close the tab.',
    'Хадгалахгүй байж болно. Тэгвэл одоогийнх шиг зөвхөн энэ табд үлдэж, табыг хаахад устна.'],
  ['ask', '문의', 'Questions', 'Холбоо барих', 'SYNK · hello@synk.im', 'SYNK · hello@synk.im', 'SYNK · hello@synk.im']
];
const MINOR_NOTE = ['만 18세 미만이면 보호자가 이 내용을 함께 읽고 동의해야 해요. SYNK는 보호자를 따로 확인하지 않아요.',
  'If you are under 18, a parent or guardian must read this with you and agree. SYNK does not check this separately.',
  'Хэрэв 18 нас хүрээгүй бол асран хамгаалагч тань энэ мэдээллийг хамт уншиж, зөвшөөрөх ёстой. SYNK асран хамгаалагчийг тусад нь шалгахгүй.'];

/** 동의 화면. view: { lang, minor: null|true|false, guardian, busy, error } */
export function renderStudyConsent(view) {
  const en = view.lang === 'en', L = (ko, e) => (en ? e : ko);
  const minor = view.minor === true || view.minor === false ? view.minor : null, guardian = view.guardian === true;
  const ready = minor === false || (minor === true && guardian);
  const rows = ITEMS.map(([id, hk, he, , tk, te]) => `<div class="sx-consent-row"><dt>${esc(en ? he : hk)}</dt><dd>${esc(en ? te : tk)}${id === 'ask' ? ` · <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">${L('개인정보처리방침', 'Privacy policy')}<span class="sr-only"> (${L('새 탭에서 열림', 'opens in new tab')})</span></a>` : ''}</dd></div>`).join('');
  const mn = `<details class="sx-past sx-consent-mn" lang="mn" data-fold="consent-mn"><summary>Монгол хэлээр унших</summary><h2 class="sx-h">Миний нөхцөлийг бүртгэлдээ хадгалах уу?</h2><dl class="sx-consent">${ITEMS.map(([, , , hm, , , tm]) => `<div class="sx-consent-row"><dt>${esc(hm)}</dt><dd>${esc(tm)}</dd></div>`).join('')}</dl><p class="sx-fine">${esc(MINOR_NOTE[2])}</p></details>`;
  const age = (id, ko, e, mnText) => `<button type="button" class="sx-btn2 sx-consent-age" aria-pressed="${(id === 'minor') === minor && minor !== null}" data-action="consentAge" data-id="${id}"><span class="sx-consent-main"><span class="sx-on">${ON}</span>${esc(L(ko, e))}</span><small lang="mn">${esc(mnText)}</small></button>`;
  const guardianBox = minor === true
    ? `<button type="button" class="sx-consent-guardian" role="checkbox" aria-checked="${guardian}" data-action="consentGuardian"><span class="sx-consent-box">${ON}</span><span class="sx-consent-text"><span>${esc(L('보호자가 이 내용을 함께 읽고 동의했어요', 'A parent or guardian read this with me and agreed'))}</span><small lang="mn">Асран хамгаалагч маань энэ мэдээллийг хамт уншиж, зөвшөөрсөн</small></span></button>` : '';
  const error = view.error ? `<p class="sx-store is-warn" role="alert">${esc(view.error)}</p>` : '';
  const why = minor === null ? [L('나이를 고르면 저장할 수 있어요.', 'Choose your age to save.'), 'Насаа сонговол хадгалах боломжтой.']
    : minor === true && !guardian ? [L('보호자 확인을 누르면 저장할 수 있어요.', 'Tick the guardian check to save.'), 'Асран хамгаалагчийн зөвшөөрлийн нүдийг чагталбал хадгалах боломжтой.'] : null;
  const whyLine = why ? `<p class="sx-fine sx-consent-why" id="sx-consent-why">${esc(why[0])} <span lang="mn">${esc(why[1])}</span></p>` : '';
  return `<div class="sx">
<button type="button" class="sx-back" data-action="consentRefuse">${BACK}${L('돌아가기', 'Back')}</button>
<header class="sx-head"><p class="sx-kicker">${L('계정에 저장', 'Save to account')}</p><h1 class="sx-title page-title" tabindex="-1">${L('내 조건을 계정에 저장할까요?', 'Save your conditions to your account?')}</h1></header>
<dl class="sx-consent">${rows}</dl>
${mn}
<fieldset class="sx-consent-ages"><legend class="sx-h">${L('나이', 'Age')}</legend><p class="sx-fine">${esc(L(MINOR_NOTE[0], MINOR_NOTE[1]))}</p><div class="sx-row2">${age('adult', '만 18세 이상이에요', 'I am 18 or older', 'Би 18 нас хүрсэн')}${age('minor', '만 18세 미만이에요', 'I am under 18', 'Би 18 нас хүрээгүй')}</div>${guardianBox}</fieldset>
${error}
${whyLine}
<div class="sx-row2 sx-consent-actions"><button type="button" class="sx-cta" data-action="consentSave"${why ? ' aria-describedby="sx-consent-why"' : ''}${ready && !view.busy ? '' : ' disabled aria-disabled="true"'}><span class="sx-consent-main">${view.busy ? L('저장하는 중…', 'Saving…') : L('계정에 저장', 'Save to account')}</span><small lang="mn">Бүртгэлдээ хадгалах</small></button><button type="button" class="sx-btn2 line" data-action="consentRefuse"><span class="sx-consent-main">${L('이 탭에만 두기', 'Keep in this tab only')}</span><small lang="mn">Зөвхөн энэ табд үлдээх</small></button></div>
</div>`;
}

/**
 * 학습 화면 위 알림. view: { lang, ask, choice, deleted, blocked, pending, signedIn }
 *   ask: 동의를 한 번 묻는다(누른 동작은 이미 탭에 반영됐다). choice: 계정과 이 탭이 다르다. deleted: 다른 곳에서 지워졌다.
 *   blocked: 동의한 계정을 지금 쓸 수 없다(고침을 막는다). pending: 아직 계정에 올라가지 않았다.
 */
export function renderStudyNotices(view) {
  const en = view.lang === 'en', L = (ko, e) => (en ? e : ko);
  const out = [];
  if (view.blocked) out.push(`<div class="notice error" role="alert"><p>${L('계정에 저장한 조건을 지금 불러오지 못했어요. 연결을 확인하고 「다시 시도」를 눌러 주세요. 그동안은 조건을 고칠 수 없어요.', 'Your saved conditions could not be loaded right now. Check your connection and press Retry. Until then, conditions cannot be changed.')}</p><div class="actions"><button type="button" class="secondary" data-action="studyAccountRetry">${L('다시 시도', 'Retry')}</button></div></div>`);
  if (view.drafts) out.push(`<div class="notice" role="status"><p>${L('이 탭에 계정에 올라가지 않은 조건 변경이 남아 있는데, 그사이 계정 쪽도 바뀌었어요. 어느 쪽을 쓸까요?', 'This tab has condition changes that never reached your account, and your account changed in the meantime. Which should we use?')}</p><div class="actions"><button type="button" class="secondary" data-action="studyDraftAccount">${L('계정 것 쓰기', 'Use the account')}</button><button type="button" class="secondary" data-action="studyDraftPick">${L('남은 변경 쓰기', 'Use the unsent changes')}</button></div></div>`);
  if (view.choice) out.push(`<div class="notice" role="status"><p>${L('이 탭에서 넣은 조건이 계정에 저장된 것과 달라요. 어느 쪽을 쓸까요?', 'The conditions in this tab differ from the ones saved to your account. Which should we use?')}</p><div class="actions"><button type="button" class="secondary" data-action="studyUseAccount">${L('계정 것 쓰기', 'Use the account')}</button><button type="button" class="secondary" data-action="studyUseTab">${L('이 탭 것으로 바꾸기', 'Replace with this tab')}</button></div></div>`);
  if (view.deleted) out.push(`<div class="notice" role="status"><p>${L('계정의 유학 준비 자료가 다른 곳에서 지워졌어요. 이제 넣는 조건은 이 탭에만 남아요.', 'Your study data was deleted from your account elsewhere. Conditions you add now stay in this tab only.')}</p><div class="actions"><button type="button" class="secondary" data-action="studyNoticeClose">${L('알겠어요', 'OK')}</button></div></div>`);
  if (view.ask) out.push(`<div class="notice" role="status"><p>${L('이 조건을 계정에 저장하면 다른 기기에서도 이어서 볼 수 있어요. 저장하기 전에 무엇을 어디에 두는지 읽어 주세요.', 'If you save these conditions to your account, you can continue on other devices. Before saving, please read what is stored and where.')}</p><div class="actions"><button type="button" class="secondary" data-action="studyConsentOpen">${L('읽고 정하기', 'Read and decide')}</button><button type="button" class="secondary" data-action="consentRefuse">${L('이 탭에만 두기', 'Keep in this tab only')}</button></div></div>`);
  if (view.pending) out.push(`<div class="notice" role="status"><p>${L('아직 계정에 올라가지 않은 변경이 있어요. 연결이 돌아오면 다시 보내요.', 'Some changes are not in your account yet. They are sent again when your connection is back.')}</p><div class="actions"><button type="button" class="secondary" data-action="studyAccountRetry">${L('지금 다시 보내기', 'Send again now')}</button></div></div>`);
  return out.join('');
}

/**
 * 내 정보의 「유학 준비 자료」 칸. view: { lang, phase, consent, store, errorCode }
 *   store: 'account' | 'tab' | 'blocked'(이 탭에서 동의를 확인했는데 지금 계정을 못 씀) | 'wait'(불러오는 중)
 */
const NETWORK_CODES = new Set(['NETWORK', 'OFFLINE', 'ACCOUNT_UNAVAILABLE']);
export function renderStudyAccountSettings(view) {
  const en = view.lang === 'en', L = (ko, e) => (en ? e : ko);
  const box = (body) => `<section class="settings-group"><h2>${L('유학 준비 자료', 'Study data')}</h2>${body}</section>`;
  const retry = `<button type="button" class="btn-line" data-action="studyAccountRetry">${L('다시 시도', 'Retry')}</button>`;
  if (view.phase === 'consented') {
    const when = view.consent?.at ? new Date(view.consent.at) : null;
    const at = when && !Number.isNaN(when.getTime()) ? `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}` : '';
    return box(`<p>${L(`「내 조건」 · 「다가오는 날」 · 고른 과정 · 서류 표시를 계정에 저장하고 있어요(동의 ${esc(at)}). 다른 기기에서도 보여요.`, `Your conditions, upcoming dates, the program you picked and your marks are saved to your account (consent ${esc(at)}). They show on your other devices too.`)}</p><button type="button" class="btn-line danger" data-action="studyAccountDelete">${L('계정의 유학 준비 자료 지우기', 'Delete study data from account')}</button>`);
  }
  if (view.phase === 'choose') return box(`<p>${L('이 탭에 계정에 올라가지 않은 조건 변경이 남아 있어요. 고르기 전에는 조건을 고칠 수 없어요.', 'This tab has condition changes that never reached your account. You cannot change conditions until you choose.')}</p><div class="actions"><button type="button" class="btn-line" data-action="studyDraftAccount">${L('계정 것 쓰기', 'Use the account')}</button><button type="button" class="btn-line" data-action="studyDraftPick">${L('남은 변경 쓰기', 'Use the unsent changes')}</button></div>`);
  if (view.store === 'wait') return box(`<p class="meta">${L('계정에 저장한 조건을 불러오는 중이에요.', 'Loading the conditions saved to your account.')}</p>`);
  if (view.store === 'blocked') return box(`<p>${L('계정에 저장한 조건을 지금 불러오지 못했어요. 그동안은 조건을 고칠 수 없어요.', 'Your saved conditions could not be loaded right now. Until then, conditions cannot be changed.')}</p>${retry}`);
  if (view.phase === 'none') return box(`<p>${L('계정에 저장하면 다른 기기에서도 이어서 볼 수 있어요.', 'Save them to your account to continue on other devices.')}</p><button type="button" class="btn-line" data-action="studyConsentOpen">${L('계정에 저장하기', 'Save to account')}</button>`);
  if (view.phase === 'paused' && NETWORK_CODES.has(view.errorCode)) return box(`<p>${L('계정에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.', 'Could not reach your account. Check your connection and try again.')}</p>${retry}`);
  // 서버가 계정 저장을 아직 열지 않았거나 쉬는 중이면 칸을 두지 않는다. 위 「저장 방식」이 이 탭에 둔다고 알린다.
  if (view.phase === 'paused') return '';
  if (view.phase === 'error') return box(`<p>${L('계정 상태를 확인하지 못했어요.', 'Could not check your account.')}</p>${retry}`);
  return '';
}

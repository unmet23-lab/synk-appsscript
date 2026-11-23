// PATH 「서류 번역 초안」 쪽. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소, 네트워크를 쓰지 않는다).
// 결: 시안 2판(.sx). 공개 CSP(style-src 'self')라 인라인 스타일을 쓰지 않는다.
// 몽골 학생과 보호자가 읽도록 동의 · 초안 표시 · 안내 · 걸린 줄의 까닭에 몽골어 문장을 함께 둔다(현지어 대조를 거친 문장).
// 모델이 낸 글(초안 · 역번역)은 모두 esc()를 거치고, 「초안」 표시와 안내는 모델 글과 섞이지 않는 자리에 둔다.
import { MAX_TOTAL_CHARS } from './translate-shape.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
const ON = svg('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
export const PRIVACY_URL = 'https://synk.im/privacy/#synk-id';

// [한국어, 영어, 몽골어]
const M = {
  kicker: ['번역 초안', 'Translation draft', 'Орчуулгын төсөл'],
  lead: ['몽골어 서류의 글을 붙여 넣으면 한국어 초안을 만들어요. 초안은 번역자가 원문과 대조해 고치는 출발점이에요. 그대로 내는 번역본이 아니에요.',
    'Paste the text of a Mongolian document and get a Korean draft. The draft is a starting point that a translator checks against the original and corrects. It is not a translation you can submit as it is.',
    'Монгол баримтын бичвэрийг буулгавал солонгос хэлний төсөл гаргана. Төсөл бол орчуулагч эх хувьтай тулгаж засах эхлэл юм. Шууд өгөх орчуулга биш.'],
  kind: ['서류 종류', 'Document', 'Баримтын төрөл'],
  grad: ['졸업증명서', 'Graduation certificate', 'Төгссөний гэрчилгээ'],
  transcript: ['성적증명서', 'Transcript', 'Дүнгийн хуудас'],
  rules: ['이 서류를 내는 곳의 번역 규칙', 'Translation rules where you submit this', 'Энэ баримтыг өгөх газрын орчуулгын журам'],
  howTitle: ['글을 가져오는 법', 'How to get the text', 'Бичвэрийг яаж авах вэ'],
  how1: ['E-Mongolia에서 받은 PDF는 글을 복사해 붙여 넣어요.', 'For a PDF from E-Mongolia, copy the text and paste it.', 'E-Mongolia-аас авсан PDF бол бичвэрийг хуулж буулгана.'],
  how2: ['종이 서류는 휴대폰 카메라의 글자 복사로 가져와요. 붙여 넣은 뒤 숫자와 이름이 원문과 같은지 먼저 보세요.', 'For a paper document, use your phone camera’s copy-text feature. After pasting, first check that numbers and names match the original.', 'Цаасан баримтыг утасны камерын бичвэр хуулах функцээр авна. Буулгасны дараа тоо, нэр эх хувьтай ижил эсэхийг эхлээд шалгана уу.'],
  textLabel: ['서류의 글(몽골어)', 'Document text (Mongolian)', 'Баримтын бичвэр (монгол хэлээр)'],
  consentTitle: ['보내기 전에 확인해 주세요', 'Before you send', 'Илгээхээсээ өмнө шалгана уу'],
  what: ['보내는 것', 'What is sent', 'Илгээх зүйл'],
  whatText: ['붙여 넣은 서류의 글이에요. 이름과 생년월일도 함께 가요. 등록번호는 보내기 전에 가려요.', 'The text you paste, including names and dates of birth. Registration numbers are hidden before sending.', 'Таны буулгасан баримтын бичвэр. Нэр, төрсөн огноо ч хамт илгээгдэнэ. Регистрийн дугаарыг илгээхээс өмнө нууна.'],
  who: ['받는 곳', 'Who receives it', 'Хүлээн авах газар'],
  whoText: ['한국어 초안은 Anthropic(미국)의 Claude가, 다시 몽골어로 옮겨 견주는 일은 Google(미국)의 Gemini가 해요. 글은 SYNK 서버(Supabase, 싱가포르)를 거쳐 가요. 정보가 몽골 밖으로 옮겨져요.',
    'Claude by Anthropic (USA) writes the Korean draft, and Gemini by Google (USA) translates it back into Mongolian for the check. The text passes through the SYNK server (Supabase, Singapore). Your information leaves Mongolia.',
    'Солонгос хэлний төслийг Anthropic (АНУ)-ийн Claude, буцаан монгол хэл рүү орчуулж тулгах ажлыг Google (АНУ)-ийн Gemini хийнэ. Бичвэр SYNK-ийн серверээр (Supabase, Сингапур) дамжина. Мэдээллийг Монголоос гадагш дамжуулна.'],
  keep: ['저장', 'Storage', 'Хадгалалт'],
  keepText: ['SYNK는 보낸 글과 초안을 저장하지 않아요. 두 회사는 악용을 막으려고 각자 정한 기간 동안 보관할 수 있고, AI 학습에는 쓰지 않아요. SYNK에는 요청한 시각, 결과 상태, 이 동의만 남아요.',
    'SYNK does not store the text or the draft. The two companies may keep it for the period each sets to prevent misuse, and do not use it to train AI. SYNK keeps only the request time, the result status and this consent.',
    'SYNK илгээсэн бичвэр болон төслийг хадгалахгүй. Хоёр компани урвуулан ашиглахаас сэргийлэх зорилгоор өөрсдийн тогтоосон хугацаанд хадгалж болох ба хиймэл оюуныг сургахад ашиглахгүй. SYNK-д зөвхөн хүсэлт илгээсэн цаг, үр дүнгийн төлөв, энэ зөвшөөрөл үлдэнэ.'],
  no: ['거부', 'Saying no', 'Татгалзах'],
  noText: ['보내지 않아도 돼요. 그러면 이 기능은 쓸 수 없고, 서류를 번역자에게 바로 맡기면 돼요.', 'You do not have to send it. Then you cannot use this feature, and you can give the document straight to a translator.', 'Илгээхгүй байж болно. Тэгвэл энэ үйлчилгээг ашиглах боломжгүй бөгөөд баримтаа орчуулагчид шууд өгч болно.'],
  ask: ['문의', 'Questions', 'Холбоо барих'],
  age: ['나이', 'Age', 'Нас'],
  adult: ['만 18세 이상', '18 or older', '18 ба түүнээс дээш настай'],
  teen: ['만 14~17세', '14 to 17', '14–17 настай'],
  under14: ['만 14세 미만', 'Under 14', '14 нас хүрээгүй'],
  under14Note: ['만 14세 미만은 이 기능을 쓸 수 없어요.', 'This feature is not available if you are under 14.', '14 нас хүрээгүй бол энэ үйлчилгээг ашиглах боломжгүй.'],
  guardian: ['보호자가 이 내용을 함께 읽고 동의했어요', 'A parent or guardian read this with me and agreed', 'Асран хамгаалагч маань энэ мэдээллийг надтай хамт уншиж, зөвшөөрсөн'],
  agree: ['위 내용을 읽었고, 이 글을 보내는 데 동의해요', 'I have read the above and agree to send this text', 'Дээрх мэдээллийг уншсан бөгөөд энэ бичвэрийг илгээхийг зөвшөөрч байна'],
  send: ['한국어 초안 만들기', 'Make a Korean draft', 'Солонгос төсөл гаргах'],
  quota: ['하루 10장까지 만들 수 있어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.', 'You can make up to 10 a day. The count resets at 08:00 Ulaanbaatar time (09:00 Seoul).', 'Өдөрт 10 хүртэл гаргаж болно. Улаанбаатарын цагаар 08:00-д (Сөүлийн 09:00) дахин сэргэнэ.'],
  waiting: ['한국어로 옮기는 중이에요. 1분쯤 걸려요. 이 화면을 열어 두세요.', 'Translating into Korean. This takes about a minute. Keep this screen open.', 'Солонгос хэл рүү орчуулж байна. Нэг минут орчим болно. Энэ дэлгэцийг нээлттэй байлгана уу.'],
  checking: ['다시 몽골어로 옮겨 원문과 견주는 중이에요.', 'Translating back into Mongolian to compare with the original.', 'Эх хувьтай тулгахын тулд буцаан монгол хэл рүү орчуулж байна.'],
  band: ['번역 초안 — 번역본이 아니에요', 'Translation draft — not a translation for submission', 'Орчуулгын төсөл — албан ёсны орчуулга биш'],
  notice1: ['번역자가 원문과 대조해 고치고 번역자 확인서를 붙여 내요. 대학에 따라 번역 공증을 요구해요.', 'A translator must check it against the original, correct it and attach a translator confirmation form. Some universities require a notarized translation.', 'Орчуулагч эх хувьтай тулгаж засаад, орчуулагчийн баталгааг хавсаргаж өгнө. Зарим их сургууль нотариатаар баталгаажуулсан орчуулга шаарддаг.'],
  notice3: ['비자 서류의 공식 접수는 본인이 KVAC에 하거나 등록 행정사에게 맡겨요.', 'For the visa, you file the official documents yourself at KVAC or through a registered administrative agent.', 'Визийн бичиг баримтыг өөрөө KVAC-д эсвэл эрх бүхий төлөөлөгчөөр дамжуулан албан ёсоор өгнө.'],
  checkNote: ['대조는 뜻이 크게 달라진 곳만 찾아요. 이름, 학교 이름, 숫자는 직접 보세요.', 'The check only finds lines whose meaning changed a lot. Check names, school names and numbers yourself.', 'Тулгалт зөвхөн утга нь их өөрчлөгдсөн мөрийг олно. Нэр, сургуулийн нэр, тоог өөрөө шалгана уу.'],
  notCompared: ['자동 대조를 하지 못했어요. 원문과 다시 옮긴 몽골어를 직접 견줘 보세요.', 'The automatic check did not run. Compare the original and the back-translation yourself.', 'Автомат тулгалт хийгдсэнгүй. Эх хувь болон буцаан орчуулгыг өөрөө тулгана уу.'],
  noBack: ['다시 옮겨 견주지 못했어요. 초안은 그대로 쓸 수 있어요.', 'The back-translation check did not finish. You can still use the draft.', 'Буцаан орчуулж тулгаж чадсангүй. Төслийг хэвээр ашиглаж болно.'],
  source: ['원문', 'Original', 'Эх хувь'],
  draft: ['한국어 초안', 'Korean draft', 'Солонгос төсөл'],
  back: ['다시 옮긴 몽골어', 'Back-translation', 'Буцаан орчуулга'],
  onlyFlagged: ['확인할 줄만 보기', 'Show only lines to check', 'Шалгах мөрийг л харуулах'],
  copy: ['초안 복사', 'Copy draft', 'Төсөл хуулах'],
  download: ['초안 내려받기(.txt)', 'Download draft (.txt)', 'Төсөл татах (.txt)'],
  recheck: ['다시 견주기', 'Check again', 'Дахин тулгах'],
  edit: ['글 고치기', 'Edit the text', 'Бичвэр засах'],
  fresh: ['새로 만들기', 'Start over', 'Шинээр эхлэх'],
  signIn: ['SYNK ID로 로그인하면 번역 초안을 만들 수 있어요.', 'Sign in with your SYNK ID to make a translation draft.', 'SYNK ID-аар нэвтэрвэл орчуулгын төсөл гаргаж болно.'],
  fine: ['이 초안은 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.', 'This draft does not promise admission or a visa. The university and immigration office make the final decision.', 'Энэ төсөл элсэлт, визийг баталгаажуулахгүй. Эцсийн шийдвэрийг их сургууль, цагаачлалын байгууллага гаргана.'],
};
export const REASON_TEXT = {
  id: ['등록번호를 원문에서 직접 옮기세요.', 'Copy the registration number from the original yourself.', 'Регистрийн дугаарыг эх хувиас өөрөө хуулж бичнэ үү.'],
  numbers: ['숫자가 원문과 달라요. 원문과 맞춰 보세요.', 'The numbers differ from the original. Compare them.', 'Тоо эх хувиас өөр байна. Эх хувьтай тулгана уу.'],
  name: ['이름은 여권의 영문 철자로 맞추세요.', 'Match names to the English spelling in the passport.', 'Нэрийг паспорт дээрх латин үсгийн бичлэгтэй тааруулна уу.'],
  term: ['학교 이름이나 용어는 번역자가 대학이 쓰는 말로 고쳐야 해요.', 'A translator should fix school names and terms to the words the university uses.', 'Сургуулийн нэр, нэр томьёог орчуулагч их сургуулийн хэрэглэдэг үгээр засах хэрэгтэй.'],
  meaning: ['다시 옮긴 글의 뜻이 원문과 달라요.', 'The back-translation means something different from the original.', 'Буцаан орчуулсан бичвэрийн утга эх хувиас өөр байна.'],
  missing: ['원문의 내용이 빠졌을 수 있어요.', 'Part of the original may be missing.', 'Эх хувийн агуулга орхигдсон байж магадгүй.'],
  added: ['원문에 없는 내용이 들어갔을 수 있어요.', 'Something not in the original may have been added.', 'Эх хувьд байхгүй агуулга нэмэгдсэн байж магадгүй.'],
  changed: ['용어가 바뀌었을 수 있어요.', 'A term may have changed.', 'Нэр томьёо өөрчлөгдсөн байж магадгүй.'],
  unsure: ['자동 대조가 판단하지 못했어요. 직접 견줘 보세요.', 'The automatic check could not decide. Compare it yourself.', 'Автомат тулгалт шийдэж чадсангүй. Өөрөө тулгана уу.'],
};
export const ERROR_TEXT = {
  empty: ['서류의 글을 붙여 넣어 주세요.', 'Paste the document text.', 'Баримтын бичвэрийг буулгана уу.'],
  short: ['글이 너무 짧아요. 서류의 글을 모두 붙여 넣어 주세요.', 'The text is too short. Paste the whole document.', 'Бичвэр хэт богино байна. Баримтын бичвэрийг бүтнээр нь буулгана уу.'],
  lines: ['줄이 너무 많아요. 80줄까지 한 번에 옮길 수 있어요. 나눠서 만들어 주세요.', 'Too many lines. Up to 80 lines at a time. Split the text.', 'Мөр хэт олон байна. Нэг удаад 80 мөр хүртэл орчуулна. Хувааж оруулна уу.'],
  line: ['300자가 넘는 줄이 있어요. 줄을 나눠 주세요.', 'A line is longer than 300 characters. Split it.', '300 тэмдэгтээс урт мөр байна. Мөрийг хуваана уу.'],
  total: [`글이 너무 길어요. ${MAX_TOTAL_CHARS.toLocaleString('en-US')}자까지 한 번에 옮길 수 있어요. 나눠서 만들어 주세요.`, `The text is too long. Up to ${MAX_TOTAL_CHARS.toLocaleString('en-US')} characters at a time. Split it.`, `Бичвэр хэт урт байна. Нэг удаад ${MAX_TOTAL_CHARS} тэмдэгт хүртэл орчуулна. Хувааж оруулна уу.`],
  language: ['몽골어 서류의 글을 붙여 넣어 주세요.', 'Paste the text of a Mongolian document.', 'Монгол баримтын бичвэрийг буулгана уу.'],
  limit: ['오늘 만들 수 있는 10장을 다 썼어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.', 'You have used today’s 10. The count resets at 08:00 Ulaanbaatar time (09:00 Seoul).', 'Өнөөдрийн 10-ыг ашиглаж дууслаа. Улаанбаатарын цагаар 08:00-д (Сөүлийн 09:00) дахин сэргэнэ.'],
  busy: ['같은 요청을 처리하고 있어요. 잠시 뒤에 다시 확인해 주세요.', 'This request is still being processed. Check again in a moment.', 'Ижил хүсэлтийг боловсруулж байна. Хэсэг хүлээгээд дахин шалгана уу.'],
  done_before: ['이 요청은 이미 끝났어요. 초안은 저장하지 않아 다시 보여 드리지 못해요. 다시 만들면 오늘 한 장을 더 써요.', 'This request already finished. Drafts are not stored, so it cannot be shown again. Making it again uses one more of today’s 10.', 'Энэ хүсэлт аль хэдийн дууссан. Төслийг хадгалдаггүй тул дахин харуулах боломжгүй. Дахин гаргавал өнөөдрийн нэгийг нэмж ашиглана.'],
  unavailable: ['번역 초안은 잠시 쉬어요. 조금 뒤에 다시 해 주세요.', 'Translation drafts are paused for now. Try again a little later.', 'Орчуулгын төсөл түр зогссон байна. Хэсэг хугацааны дараа дахин оролдоно уу.'],
  refused: ['이 글은 옮기지 못했어요. 서류의 글이 맞는지 확인해 주세요.', 'This text could not be translated. Check that it is the document text.', 'Энэ бичвэрийг орчуулж чадсангүй. Баримтын бичвэр мөн эсэхийг шалгана уу.'],
  lost: ['결과를 받지 못했어요. 오늘 한 장이 쓰였을 수 있어요. 다시 만들면 한 장을 더 써요.', 'The result did not arrive. One of today’s 10 may have been used. Making it again uses one more.', 'Үр дүн ирсэнгүй. Өнөөдрийн нэгийг ашигласан байж магадгүй. Дахин гаргавал нэгийг нэмж ашиглана.'],
  account: ['계정이 바뀌어 초안을 지웠어요.', 'Your account changed, so the draft was cleared.', 'Бүртгэл өөрчлөгдсөн тул төслийг устгалаа.'],
};
const pick3 = (en, a) => (en ? a[1] : a[0]);
const mnLine = (a) => `<span class="sx-mn" lang="mn">${esc(a[2])}</span>`;
/** 화면 글(한국어나 영어)과 몽골어를 함께. */
const both = (en, a, tag = 'p', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''}><span>${esc(pick3(en, a))}</span>${mnLine(a)}</${tag}>`;
export const reasonKeys = (row) => row.reasons.flatMap((r) => (r === 'differs' ? [row.reason === 'term' ? 'changed' : row.reason === 'missing' || row.reason === 'added' ? row.reason : 'meaning'] : [r]));

/**
 * 번역 초안 쪽.
 * view: { lang, signedIn, docName: {ko,en}, rules: [{ko,en}], tr: {
 *   kind, text, age: null|'adult'|'teen'|'under14', guardian, agree, phase: 'edit'|'sending'|'draft', error, remaining,
 *   rows: [draftRows 줄] | null, check: 'idle'|'checking'|'done'|'failed', compared, onlyFlagged, notice } }
 */
export function renderTranslate(view) {
  const en = view.lang === 'en', L = (ko, e) => (en ? e : ko), P = (a) => pick3(en, a);
  const tr = view.tr || {};
  const back = `<button type="button" class="sx-back" data-action="trLeave">${BACK}${L('내 길', 'My path')}</button>`;
  const head = `<header class="sx-head"><p class="sx-kicker">${esc(P(M.kicker))}</p><h1 class="sx-title page-title" tabindex="-1">${esc(en ? view.docName?.en : view.docName?.ko)}</h1>${both(en, M.lead, 'p', 'sx-lead')}</header>`;
  if (!view.signedIn) {
    return `<div class="sx sx-tr">${back}${head}${both(en, M.signIn, 'p', 'sx-note is-box')}<button type="button" class="sx-cta" data-action="accountSignIn">${L('SYNK ID로 로그인', 'Sign in with SYNK ID')}</button></div>`;
  }
  const busy = tr.phase === 'sending';
  const notice = tr.notice ? `<p class="sx-store is-warn" role="status"><span>${esc(P(ERROR_TEXT[tr.notice] || ERROR_TEXT.unavailable))}</span>${mnLine(ERROR_TEXT[tr.notice] || ERROR_TEXT.unavailable)}</p>` : '';
  const rules = (view.rules || []).length ? `<section class="sx-tr-rules" aria-labelledby="sx-tr-rules-h"><h2 class="sx-h" id="sx-tr-rules-h">${esc(P(M.rules))}</h2><ul class="sx-rules">${view.rules.map((r) => `<li>${esc(en ? r.en : r.ko)}</li>`).join('')}</ul></section>` : '';
  if (tr.phase === 'draft' && Array.isArray(tr.rows)) return `<div class="sx sx-tr">${back}${head}${notice}${renderDraft(tr, en, rules)}${both(en, M.fine, 'p', 'sx-fine')}</div>`;

  const kinds = ['grad', 'transcript'].map((k) => `<label class="sx-choice"><input type="radio" id="tr-kind-${k}" name="tr-kind" value="${k}" data-action="trKind"${tr.kind === k ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${esc(P(M[k]))}</span></label>`).join('');
  const err = tr.error ? `<p class="sx-err" id="tr-err" role="alert"><span>${esc(P(ERROR_TEXT[tr.error] || ERROR_TEXT.unavailable))}</span>${mnLine(ERROR_TEXT[tr.error] || ERROR_TEXT.unavailable)}</p>` : '';
  const ages = ['adult', 'teen', 'under14'].map((a) => `<label class="sx-choice"><input type="radio" id="tr-age-${a}" name="tr-age" value="${a}" data-action="trAge"${tr.age === a ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${esc(P(M[a]))}<span class="sx-mn" lang="mn">${esc(M[a][2])}</span></span></label>`).join('');
  const item = (k, t) => `<div class="sx-tr-item"><dt>${esc(P(M[k]))}</dt><dd><span>${esc(P(M[t]))}</span>${mnLine(M[t])}</dd></div>`;
  const ready = tr.age === 'adult' || (tr.age === 'teen' && tr.guardian);
  const canSend = !busy && ready && tr.agree === true && String(tr.text || '').trim().length > 0;
  const consent = `<section class="sx-card sx-tr-consent" aria-labelledby="sx-tr-consent-h"><h2 class="sx-h" id="sx-tr-consent-h">${esc(P(M.consentTitle))}<span class="sx-mn" lang="mn">${esc(M.consentTitle[2])}</span></h2>
<dl class="sx-tr-items">${item('what', 'whatText')}${item('who', 'whoText')}${item('keep', 'keepText')}${item('no', 'noText')}<div class="sx-tr-item"><dt>${esc(P(M.ask))}</dt><dd>SYNK · hello@synk.im · <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">${L('개인정보 처리방침', 'Privacy policy')}<span class="sr-only"> (${L('새 탭에서 열림', 'opens in new tab')})</span></a></dd></div></dl>
<fieldset class="sx-tr-age"><legend>${esc(P(M.age))}</legend>${ages}</fieldset>
${tr.age === 'under14' ? both(en, M.under14Note, 'p', 'sx-store is-warn') : ''}
${tr.age === 'teen' ? `<label class="sx-check"><input type="checkbox" id="tr-guardian" data-action="trGuardian"${tr.guardian ? ' checked' : ''}${busy ? ' disabled' : ''}><span><span>${esc(P(M.guardian))}</span>${mnLine(M.guardian)}</span></label>` : ''}
${tr.age && tr.age !== 'under14' ? `<label class="sx-check"><input type="checkbox" id="tr-agree" data-action="trAgree"${tr.agree ? ' checked' : ''}${busy ? ' disabled' : ''}><span><span>${esc(P(M.agree))}</span>${mnLine(M.agree)}</span></label>` : ''}</section>`;
  return `<div class="sx sx-tr">${back}${head}${notice}
<fieldset class="sx-tr-kind"><legend>${esc(P(M.kind))}</legend>${kinds}</fieldset>
${rules}
<section class="sx-tr-how" aria-labelledby="sx-tr-how-h"><h2 class="sx-h" id="sx-tr-how-h">${esc(P(M.howTitle))}</h2>${both(en, M.how1, 'p', 'sx-fine')}${both(en, M.how2, 'p', 'sx-fine')}</section>
<div class="sx-field"><label for="tr-text">${esc(P(M.textLabel))}</label><textarea id="tr-text" class="sx-tr-text" lang="mn" rows="10" spellcheck="false" autocomplete="off" data-action="trText"${tr.error ? ' aria-invalid="true" aria-describedby="tr-err tr-count"' : ' aria-describedby="tr-count"'}${busy ? ' readonly' : ''}>${esc(tr.text || '')}</textarea><p class="sx-fine" id="tr-count">${esc(countText(tr.text, en))}</p>${err}</div>
${consent}
<button type="button" class="sx-cta" data-action="trSend"${canSend ? '' : ' disabled'}>${esc(P(M.send))}</button>
${busy ? `<p class="sx-note is-box" role="status"><span>${esc(P(M.waiting))}</span>${mnLine(M.waiting)}</p>` : ''}
${both(en, M.quota, 'p', 'sx-fine')}${tr.remaining !== null && tr.remaining !== undefined ? `<p class="sx-fine">${L(`오늘 남은 장: ${tr.remaining}`, `Left today: ${tr.remaining}`)}</p>` : ''}
${both(en, M.fine, 'p', 'sx-fine')}</div>`;
}

export function countText(text, en) {
  const lines = String(text || '').split(/\r\n?|\n/).filter((l) => l.trim()).length, n = [...String(text || '')].length;
  return en ? `${lines} lines · ${n.toLocaleString('en-US')} / ${MAX_TOTAL_CHARS.toLocaleString('en-US')} characters` : `${lines}줄 · ${n.toLocaleString('ko-KR')} / ${MAX_TOTAL_CHARS.toLocaleString('ko-KR')}자`;
}

function renderDraft(tr, en, rules) {
  const P = (a) => pick3(en, a), L = (ko, e) => (en ? e : ko);
  const rows = tr.rows;
  const flagged = rows.filter((r) => reasonKeys(r).length).length;
  const meaning = rows.filter((r) => r.verdict === 'differs' || r.verdict === 'unsure').length;
  const band = `<div class="sx-tr-band" role="note"><b>${esc(P(M.band))}</b><span class="sx-mn" lang="mn">${esc(M.band[2])}</span></div>`;
  const notices = `<ul class="sx-tr-notices">${[M.notice1, M.notice3].map((a) => `<li><span>${esc(P(a))}</span>${mnLine(a)}</li>`).join('')}</ul>`;
  let checkLine = '';
  if (tr.check === 'checking') checkLine = `<p class="sx-note" role="status"><span>${esc(P(M.checking))}</span>${mnLine(M.checking)}</p>`;
  else if (tr.check === 'failed') checkLine = `<div class="sx-note is-box" role="status">${both(en, M.noBack)}<button type="button" class="sx-btn2 sm" data-action="trRecheck">${esc(P(M.recheck))}</button></div>`;
  else if (tr.check === 'done') {
    const summary = L(meaning ? `뜻이 달라 보이는 줄 ${meaning}곳` : '뜻이 크게 달라진 줄은 찾지 못했어요', meaning ? `${meaning} line${meaning === 1 ? '' : 's'} may differ in meaning` : 'No line with a large change in meaning was found');
    checkLine = `<div class="sx-note" role="status">${tr.compared ? `<p><b>${esc(summary)}</b></p>` : both(en, M.notCompared)}${both(en, M.checkNote)}</div>`;
  }
  const list = rows.filter((r) => !tr.onlyFlagged || reasonKeys(r).length).map((r) => {
    const keys = reasonKeys(r);
    const reasons = keys.length ? `<ul class="sx-tr-why">${keys.map((k) => `<li><span>${esc(P(REASON_TEXT[k]))}</span>${mnLine(REASON_TEXT[k])}</li>`).join('')}</ul>` : '';
    return `<li class="sx-tr-row${keys.length ? ' is-flag' : ''}"><p class="sx-tr-n">${r.i + 1}</p><dl><div><dt>${esc(P(M.source))}</dt><dd lang="mn">${esc(r.source)}</dd></div><div><dt>${esc(P(M.draft))}</dt><dd lang="ko">${esc(r.ko)}</dd></div>${r.back !== null ? `<div><dt>${esc(P(M.back))}</dt><dd lang="mn">${esc(r.back)}</dd></div>` : ''}</dl>${reasons}</li>`;
  }).join('');
  const tools = `<div class="sx-row2"><button type="button" class="sx-btn2" data-action="trCopy">${esc(P(M.copy))}</button><button type="button" class="sx-btn2" data-action="trDownload">${esc(P(M.download))}</button></div>
<div class="sx-row2"><button type="button" class="sx-btn2 line" data-action="trEdit">${esc(P(M.edit))}</button><button type="button" class="sx-btn2 line" data-action="trFresh">${esc(P(M.fresh))}</button></div>`;
  const toggle = `<button type="button" class="sx-btn2 sm" aria-pressed="${tr.onlyFlagged === true}" data-action="trFlagged"><span class="sx-on">${ON}</span>${esc(P(M.onlyFlagged))} (${flagged})</button>`;
  return `<section class="sx-tr-draft" aria-labelledby="sx-tr-draft-h"><h2 class="sx-h sr-only" id="sx-tr-draft-h">${esc(P(M.draft))}</h2>${band}${notices}${rules}${checkLine}${toggle}
<ol class="sx-tr-rows">${list}</ol>${tools}${tr.remaining !== null && tr.remaining !== undefined ? `<p class="sx-fine">${L(`오늘 남은 장: ${tr.remaining}`, `Left today: ${tr.remaining}`)}</p>` : ''}</section>`;
}

/** 내려받기 · 복사할 글. 첫 줄과 끝 줄에 「번역 초안」을 한국어와 몽골어로, 확인할 줄에는 까닭을 단다. */
export function draftText(rows, docName) {
  const head = ['[번역 초안 — 번역본이 아닙니다. 번역자가 원문과 대조해 고쳐야 합니다.]', '[Орчуулгын төсөл — албан ёсны орчуулга биш. Орчуулагч эх хувьтай тулгаж засах ёстой.]'];
  const body = rows.flatMap((r) => {
    const keys = reasonKeys(r);
    return [`${r.i + 1}. ${r.ko}`, `   원문: ${r.source}`, ...(keys.length ? [`   확인 필요: ${keys.map((k) => REASON_TEXT[k][0]).join(' ')}`] : [])];
  });
  return [...head, `${docName?.ko || ''}`.trim(), '', ...body, '', ...head].join('\n') + '\n';
}

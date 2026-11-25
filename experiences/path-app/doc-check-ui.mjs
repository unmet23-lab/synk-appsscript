// PATH 「서류 점검」 쪽. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소, 네트워크를 쓰지 않는다).
// 결: 시안 2판(.sx)과 번역 초안 쪽. 공개 CSP(style-src 'self')라 인라인 스타일을 쓰지 않는다.
// 조건은 요강 글(docs-data.mjs) 그대로다. AI는 글에서 줄만 찾는다. 통과 · 점수 · 맞고 틀림을 말하지 않는다.
import { MAX_TOTAL_CHARS } from './translate-shape.mjs';
import { docCheckItems, docCheckKind, selfChecks } from './doc-check.mjs';
import { isStalePost } from './channel-data.mjs';
import { CONSENT_TEXT as C, countText, PRIVACY_URL_EN } from './translate-ui.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BACK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>';

const PRIVACY_URL = 'https://synk.im/privacy/#path-assist';

// [한국어, 영어, 몽골어]
const M = {
  kicker: ['서류 점검', 'Document check', 'Баримт шалгах'],
  lead: ['요강에 적힌 조건을 하나씩 보며 이 서류를 스스로 확인해요.', 'Go through the conditions in the guide and check this document yourself.', 'Элсэлтийн зааварт бичсэн нөхцөлийг нэг нэгээр нь үзэж, энэ баримтаа өөрөө шалгана.'],
  band: ['대학이나 비자신청센터(KVAC)의 확인이 아니에요. 마지막 판단은 대학이 해요.', 'This is not a check by the university or the visa center (KVAC). The university makes the final decision.', 'Энэ бол их сургууль, визийн төв (KVAC)-ийн баталгаажуулалт биш. Эцсийн шийдвэрийг их сургууль гаргана.'],
  own: ['이 서류의 조건', 'Conditions for this document', 'Энэ баримтын нөхцөл'],
  rules: ['이 과정의 모든 서류에 적용되는 규칙', 'Rules for every document of this program', 'Энэ хөтөлбөрийн бүх баримтад хамаарах журам'],
  marks: ['확인한 줄을 눌러 두세요. 표시는 이 화면에만 있고, 나가면 사라져요.', 'Tap each line you have checked. Marks stay on this screen only and disappear when you leave.', 'Шалгасан мөрөө дарж тэмдэглэнэ. Тэмдэглэгээ зөвхөн энэ дэлгэцэд байх ба гарахад арилна.'],
  findTitle: ['서류의 글에서 찾아보기', 'Find it in the text', 'Баримтын бичвэрээс хайх'],
  findLead: ['서류의 글을 붙여 넣으면 아래 내용이 어느 줄에 있는지 AI(Claude)가 찾아요. 맞는지 틀리는지는 판단하지 않아요.', 'Paste the document text and AI (Claude) finds the lines that contain the items below. It does not judge whether they are correct.', 'Баримтын бичвэрийг буулгавал доорх агуулга аль мөрөнд байгааг хиймэл оюун (Claude) олно. Зөв, буруу эсэхийг дүгнэхгүй.'],
  textLabel: ['서류의 글', 'Document text', 'Баримтын бичвэр'],
  whoText: ['Anthropic(미국)의 Claude가 글에서 내용을 찾아요. 글은 SYNK 서버(Supabase, 싱가포르)를 거쳐 가요. 정보가 몽골 밖으로 옮겨져요.',
    'Claude by Anthropic (USA) looks for the items in the text. The text passes through the SYNK server (Supabase, Singapore). Your information leaves Mongolia.',
    'Бичвэрээс агуулга хайх ажлыг Anthropic (АНУ)-ийн Claude хийнэ. Бичвэр SYNK-ийн серверээр (Supabase, Сингапур) дамжина. Мэдээллийг Монголоос гадагш дамжуулна.'],
  keepText: ['SYNK는 보낸 글과 찾은 결과를 저장하지 않아요. Anthropic은 악용을 막으려고 정한 기간 동안 보관할 수 있고, AI 학습에는 쓰지 않아요. SYNK에는 요청한 시각, 결과 상태, 이 동의만 남아요.',
    'SYNK does not store the text or the result. Anthropic may keep it for the period it sets to prevent misuse, and does not use it to train AI. SYNK keeps only the request time, the result status and this consent.',
    'SYNK нь таны илгээсэн бичвэр, олсон үр дүнг хадгалахгүй. Anthropic нь үйлчилгээг зүй бусаар ашиглахаас сэргийлэх зорилгоор өөрийн тогтоосон хугацаанд хадгалж болох боловч хиймэл оюуныг сургахад ашиглахгүй. SYNK-д зөвхөн хүсэлт илгээсэн цаг, үр дүнгийн төлөв, энэ зөвшөөрөл үлдэнэ.'],
  noText: ['보내지 않아도 돼요. 그러면 글에서 찾기는 쓸 수 없고, 위의 조건을 직접 보며 확인하면 돼요.', 'You do not have to send it. Then you cannot use this search, and you can check the conditions above yourself.', 'Илгээхгүй байж болно. Тэгвэл бичвэрээс хайх үйлчилгээг ашиглах боломжгүй ч дээрх нөхцөлийг өөрөө шалгаж болно.'],
  send: ['글에서 찾기', 'Find in the text', 'Бичвэрээс хайх'],
  quota: ['하루 10번까지 찾을 수 있어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.', 'You can search up to 10 times a day. The count resets at 08:00 Ulaanbaatar time (09:00 Seoul).', 'Өдөрт 10 удаа хүртэл хайж болно. Улаанбаатарын цагаар 08:00-д (Сөүлийн цагаар 09:00) дахин шинэчлэгдэнэ.'],
  waiting: ['글에서 찾는 중이에요. 이 화면을 열어 두세요.', 'Looking through the text. Keep this screen open.', 'Бичвэрээс хайж байна. Энэ дэлгэцийг нээлттэй байлгана уу.'],
  resultTitle: ['글에서 찾은 줄', 'Lines found in the text', 'Бичвэрээс олдсон мөр'],
  resultNote: ['AI가 줄을 놓치거나 다른 줄을 고를 수 있어요. 종이 서류와 맞춰 보세요.', 'AI can miss a line or pick a different one. Compare with the paper document.', 'Хиймэл оюун мөр алгасаж эсвэл өөр мөр сонгож болзошгүй. Цаасан баримттайгаа тулгана уу.'],
  found: ['글에 이 내용이 보여요', 'The text shows this', 'Бичвэрт энэ агуулга харагдаж байна'],
  missing: ['붙여 넣은 글에서 못 찾았어요. 서류에 없다는 뜻이 아니에요. 종이를 직접 보세요.', 'Not found in the pasted text. That does not mean the document lacks it. Look at the paper yourself.', 'Буулгасан бичвэрээс олдсонгүй. Баримтад байхгүй гэсэн үг биш. Цаасан баримтаа өөрөө харна уу.'],
  edit: ['글 고치기', 'Edit the text', 'Бичвэр засах'],
  fresh: ['글 지우기', 'Clear the text', 'Бичвэр устгах'],
  signIn: ['SYNK ID로 로그인하면 글에서 찾기를 쓸 수 있어요. 위의 조건은 로그인하지 않아도 볼 수 있어요.', 'Sign in with your SYNK ID to search the text. You can see the conditions above without signing in.', 'SYNK ID-аар нэвтэрвэл бичвэрээс хайж болно. Дээрх баримтын нөхцөлийг нэвтрэхгүйгээр үзэж болно.'],
};
/** 칸 이름의 몽골어. 한국어와 영어는 doc-check.mjs에 있다(서버와 같은 파일). */
const ITEM_MN = {
  'grad.title': 'Төгссөний гэрчилгээ (эсвэл төгсөх тухай тодорхойлолт) гэсэн гарчиг',
  'grad.done': 'Төгссөн эсвэл төгсөх тухай тэмдэглэл, төгссөн (төгсөх) огноо',
  'transcript.title': 'Дүнгийн хуудас гэсэн гарчиг',
  'transcript.g10': '10 дугаар ангийн дүн',
  'transcript.g11': '11 дүгээр ангийн дүн',
  'transcript.g12': '12 дугаар ангийн дүн',
  'transcript.marks': 'Хичээл, дүн бичсэн мөр',
  school: 'Сурсан сургуулийн нэр',
  issuer: 'Олгосон байгууллага, олгосон огноо, гэрчилгээний дугаар',
};
export const itemMn = (docId, key) => ITEM_MN[`${docCheckKind(docId)}.${key}`] || ITEM_MN[key] || '';
export const DC_ERROR_TEXT = {
  empty: ['서류의 글을 붙여 넣어 주세요.', 'Paste the document text.', 'Баримтын бичвэрийг буулгана уу.'],
  short: ['글이 너무 짧아요. 서류의 글을 모두 붙여 넣어 주세요.', 'The text is too short. Paste the whole document.', 'Бичвэр хэт богино байна. Баримтын бичвэрийг бүтнээр нь буулгана уу.'],
  lines: ['줄이 너무 많아요. 80줄까지 한 번에 찾을 수 있어요. 나눠서 찾아 주세요.', 'Too many lines. Up to 80 lines at a time. Split the text.', 'Мөр хэт олон байна. Нэг удаад дээд тал нь 80 мөр оруулж болно. Хувааж оруулна уу.'],
  line: ['300자가 넘는 줄이 있어요. 줄을 나눠 주세요.', 'A line is longer than 300 characters. Split it.', '300 тэмдэгтээс урт мөр байна. Мөрийг хуваана уу.'],
  total: [`글이 너무 길어요. ${MAX_TOTAL_CHARS.toLocaleString('en-US')}자까지 한 번에 찾을 수 있어요. 나눠서 찾아 주세요.`, `The text is too long. Up to ${MAX_TOTAL_CHARS.toLocaleString('en-US')} characters at a time. Split it.`, `Бичвэр хэт урт байна. Нэг удаад дээд тал нь ${MAX_TOTAL_CHARS} тэмдэгт оруулж болно. Хувааж оруулна уу.`],
  limit: ['오늘은 글에서 찾기를 더 쓸 수 없어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.', 'No more searches today. The count resets at 08:00 Ulaanbaatar time (09:00 Seoul).', 'Өнөөдөр бичвэрээс дахин хайх боломжгүй. Улаанбаатарын цагаар 08:00-д (Сөүлийн цагаар 09:00) дахин шинэчлэгдэнэ.'],
  busy: ['같은 요청을 처리하고 있어요. 잠시 뒤에 다시 확인해 주세요.', 'This request is still being processed. Check again in a moment.', 'Ижил хүсэлтийг боловсруулж байна. Хэсэг хүлээгээд дахин шалгана уу.'],
  done_before: ['이 요청은 이미 끝났어요. 결과는 저장하지 않아 다시 보여 드리지 못해요. 다시 찾으면 오늘 한 번을 더 써요.', 'This request already finished. Results are not stored, so it cannot be shown again. Searching again uses one more of today’s 10.', 'Энэ хүсэлт аль хэдийн дууссан. Үр дүн хадгалагддаггүй тул дахин харуулах боломжгүй. Дахин хайвал өнөөдрийн эрхээс нэгийг ашиглана.'],
  unavailable: ['글에서 찾기는 잠시 쉬어요. 위의 조건은 그대로 볼 수 있어요.', 'Searching the text is paused for now. You can still see the conditions above.', 'Бичвэрээс хайх үйлчилгээ түр зогссон байна. Дээрх баримтын нөхцөлийг үзэж болно.'],
  refused: ['이 글에서는 찾지 못했어요. 서류의 글이 맞는지 확인해 주세요.', 'This text could not be searched. Check that it is the document text.', 'Энэ бичвэрээс хайж чадсангүй. Баримтын бичвэр мөн эсэхийг шалгана уу.'],
  lost: ['결과를 받지 못했어요. 오늘 한 번이 쓰였을 수 있어요.', 'The result did not arrive. One of today’s 10 may have been used.', 'Үр дүн ирсэнгүй. Өнөөдрийн нэг удаагийн эрхийг ашигласан байж магадгүй.'],
  account: ['계정이 바뀌어 붙여 넣은 글을 지웠어요.', 'Your account changed, so the pasted text was cleared.', 'Бүртгэл солигдсон тул буулгасан бичвэр устгагдлаа.'],
};
const pick3 = (en, a) => (en ? a[1] : a[0]);
const mnLine = (t) => `<span class="sx-mn" lang="mn">${esc(t)}</span>`;
const both = (en, a, tag = 'p', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''}><span>${esc(pick3(en, a))}</span>${mnLine(a[2])}</${tag}>`;

/** 보낼 수 있는가: 만 18세 이상이거나, 14~17세가 보호자 확인을 했고, 동의했고, 글이 있다. */
/** 확인한 줄의 표시. 한국어와 영어는 문장 수가 달라 언어마다 따로 기억한다(옮기면 안 본 줄이 본 것으로 보인다). */
export const dcMarkKey = (lang, i) => `${lang === 'en' ? 'en' : 'ko'}:${i}`;
export const dcCanSend = (dc) => dc.phase !== 'sending' && (dc.age === 'adult' || (dc.age === 'teen' && dc.guardian === true)) && dc.agree === true && String(dc.text || '').trim().length > 0;

/**
 * 서류 점검 쪽.
 * view: { lang, signedIn, now, doc, src(과정 묶음: source · checkedAt · term · status · ask · rules · unclear), programName: {ko,en},
 *   dc: { text, age, guardian, agree, phase: 'edit'|'sending'|'done', error, notice, remaining, rows, marks: Set(dcMarkKey) } }
 */
export function renderDocCheck(view) {
  const en = view.lang === 'en', L = (ko, e) => (en ? e : ko), P = (a) => pick3(en, a), pick = (o) => (o ? (en ? o.en : o.ko) : '');
  const { doc, src } = view, dc = view.dc || {};
  const line = (label, o) => (o ? `<p class="sx-doc-line"><b>${label}</b> ${esc(pick(o))}</p>` : '');
  const head = `<button type="button" class="sx-back" data-action="dcLeave">${BACK}${L('내 길', 'My path')}</button>
<header class="sx-head"><p class="sx-kicker">${esc(P(M.kicker))} · ${esc(pick(view.programName))}</p><h1 class="sx-title page-title" id="dc-title" tabindex="-1">${esc(pick(doc.name))}</h1>${both(en, M.lead, 'p', 'sx-lead')}${doc.only ? line(L('해당자', 'Who'), doc.only.cond) : ''}${line(L('구하는 곳', 'Where to get it'), doc.from)}</header>`;
  const band = `<div class="sx-tr-band" role="note"><b>${esc(P(M.band))}</b>${mnLine(M.band[2])}</div>`;
  const source = `<p class="sx-src"><b>${L('출처', 'Source')}</b> <a href="${esc(src.source.url)}" target="_blank" rel="noopener noreferrer">${esc(pick(src.source.title))}<span class="sr-only"> (${L('새 탭에서 열림', 'opens in new tab')})</span></a> · ${L('확인', 'checked')} ${esc(src.checkedAt)}${src.term ? ` · ${esc(pick(src.term))}` : ''}</p>
${src.status ? `<p class="sx-note is-box">${esc(pick(src.status))}</p>` : ''}${isStalePost({ checkedAt: src.checkedAt }, view.now) ? `<p class="sx-note is-box">${L('확인한 지 90일이 지났어요. 서류는 원문에서 다시 확인하세요.', 'This was checked more than 90 days ago. Check the documents in the original.')}</p>` : ''}${line(L('물을 곳', 'Ask'), src.ask)}`;
  const { own, rules } = selfChecks(doc, src.rules, pick);
  const marked = (i) => dc.marks?.has?.(dcMarkKey(view.lang, i)) === true;
  const markLine = (text, i) => `<li><label class="sx-check"><input type="checkbox" id="dc-m-${i}" data-action="dcMark" data-value="${i}"${marked(i) ? ' checked' : ''}><span>${esc(text)}</span></label></li>`;
  const list = (title, items, from, id) => (items.length ? `<section aria-labelledby="${id}"><h2 class="sx-h" id="${id}">${esc(P(title))}</h2><ul class="sx-dc-list">${items.map((t, i) => markLine(t, from + i)).join('')}</ul></section>` : '');
  const checks = own.length || rules.length ? `${both(en, M.marks, 'p', 'sx-fine')}${list(M.own, own, 0, 'sx-dc-own')}${list(M.rules, rules, own.length, 'sx-dc-rules')}` : '';
  // 요강이 두 가지로 읽히는 곳은 점검 줄로 만들지 않는다. 글과 문의 안내만 보인다.
  const unclear = [doc.unclear, ...(src.unclear || [])].filter(Boolean);
  const unclearBox = unclear.length ? `<div class="sx-unclear"><p><b>${L('요강에서 두 가지로 읽혀요', 'The guide can be read two ways')}</b></p>${unclear.map((u) => `<p>${esc(pick(u))}</p>`).join('')}<p>${L('대학에 먼저 물어보세요.', 'Ask the university first.')}</p></div>` : '';
  return `<div class="sx sx-tr sx-dc">${head}${band}${source}${checks}${unclearBox}${docCheckItems(doc.id) ? renderFind(view, dc, { en, L, P, pick, band }) : ''}</div>`;
}

function renderFind(view, dc, { en, L, P, pick, band }) {
  const id = view.doc.id, items = docCheckItems(id);
  const left = Number.isInteger(dc.remaining) && dc.remaining > 0 ? both(en, [`오늘 ${dc.remaining}번 더 찾을 수 있어요.`, `${dc.remaining} left today.`, `Өнөөдөр дахиад ${dc.remaining} удаа хайж болно.`], 'p', 'sx-fine') : '';
  if (view.signedIn && dc.phase === 'done' && Array.isArray(dc.rows)) {
    const rows = dc.rows.map((r) => `<li class="sx-dc-row"><p class="sx-dc-label">${esc(pick(r.label))}</p>${mnLine(itemMn(id, r.key))}${r.lines.length ? `${both(en, M.found, 'p', 'sx-fine')}<ul class="sx-dc-quote">${r.lines.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : both(en, M.missing, 'p', 'sx-fine')}</li>`).join('');
    return `<section class="sx-dc-find" aria-labelledby="dc-result"><h2 class="sx-h" id="dc-result" tabindex="-1">${esc(P(M.resultTitle))}</h2>${band}${both(en, M.resultNote, 'p', 'sx-fine')}<ul class="sx-dc-rows">${rows}</ul><div class="sx-row2"><button type="button" class="sx-btn2" data-action="dcEdit">${esc(P(M.edit))}</button><button type="button" class="sx-btn2 line" data-action="dcFresh">${esc(P(M.fresh))}</button></div>${left}</section>`;
  }
  const what = `<ul class="sx-rules">${items.map((it) => `<li><span>${esc(pick(it.label))}</span>${mnLine(itemMn(id, it.key))}</li>`).join('')}</ul>`;
  const wrap = (body) => `<section class="sx-dc-find" aria-labelledby="sx-dc-find"><h2 class="sx-h" id="sx-dc-find">${esc(P(M.findTitle))}</h2>${both(en, M.findLead, 'p', 'sx-lead')}${what}${body}</section>`;
  if (!view.signedIn) return wrap(`${both(en, M.signIn, 'p', 'sx-note is-box')}<button type="button" class="sx-cta" data-action="accountSignIn">${L('SYNK ID로 로그인', 'Sign in with SYNK ID')}</button>`);
  const busy = dc.phase === 'sending', dis = busy ? ' disabled' : '';
  const errText = (k) => DC_ERROR_TEXT[k] || DC_ERROR_TEXT.unavailable;
  const err = dc.error ? `<p class="sx-err" id="dc-err" role="alert"><span>${esc(P(errText(dc.error)))}</span>${mnLine(errText(dc.error)[2])}</p>` : '';
  const notice = dc.notice ? `<p class="sx-store is-warn" role="status"><span>${esc(P(errText(dc.notice)))}</span>${mnLine(errText(dc.notice)[2])}</p>` : '';
  const item = (k, t) => `<div class="sx-tr-item"><dt>${esc(P(C[k]))}</dt><dd><span>${esc(P(t))}</span>${mnLine(t[2])}</dd></div>`;
  const ages = ['adult', 'teen', 'under14'].map((a) => `<label class="sx-choice"><input type="radio" id="dc-age-${a}" name="dc-age" value="${a}" data-action="dcAge"${dc.age === a ? ' checked' : ''}${dis}><span>${esc(P(C[a]))}${mnLine(C[a][2])}</span></label>`).join('');
  const check = (elId, action, on, t) => `<label class="sx-check"><input type="checkbox" id="${elId}" data-action="${action}"${on ? ' checked' : ''}${dis}><span><span>${esc(P(t))}</span>${mnLine(t[2])}</span></label>`;
  const consent = `<section class="sx-card sx-tr-consent" aria-labelledby="sx-dc-consent-h"><h3 class="sx-h" id="sx-dc-consent-h">${esc(P(C.consentTitle))}${mnLine(C.consentTitle[2])}</h3>
<dl class="sx-tr-items">${item('what', C.whatText)}${item('who', M.whoText)}${item('keep', M.keepText)}${item('no', M.noText)}<div class="sx-tr-item"><dt>${esc(P(C.ask))}</dt><dd>SYNK · hello@synk.im · <a href="${en ? PRIVACY_URL_EN : PRIVACY_URL}" target="_blank" rel="noopener noreferrer">${L('개인정보 처리방침', 'Privacy policy')}<span class="sr-only"> (${L('새 탭에서 열림', 'opens in new tab')})</span></a></dd></div></dl>
<fieldset class="sx-tr-age"><legend>${esc(P(C.age))}</legend>${ages}</fieldset>
${dc.age === 'under14' ? both(en, C.under14Note, 'p', 'sx-store is-warn') : ''}${dc.age === 'teen' ? check('dc-guardian', 'dcGuardian', dc.guardian, C.guardian) : ''}${dc.age && dc.age !== 'under14' ? check('dc-agree', 'dcAgree', dc.agree, C.agree) : ''}</section>`;
  return wrap(`<div class="sx-tr-how">${both(en, C.how1, 'p', 'sx-fine')}${both(en, C.how2, 'p', 'sx-fine')}</div>
<div class="sx-field"><label for="dc-text">${esc(P(M.textLabel))}</label><textarea id="dc-text" class="sx-tr-text" rows="8" spellcheck="false" autocomplete="off" data-action="dcText"${dc.error ? ' aria-invalid="true" aria-describedby="dc-err dc-count"' : ' aria-describedby="dc-count"'}${busy ? ' readonly' : ''}>${esc(dc.text || '')}</textarea><p class="sx-fine" id="dc-count">${esc(countText(dc.text, en))}</p>${err}</div>
${consent}
<button type="button" class="sx-cta" data-action="dcSend"${dcCanSend(dc) ? '' : ' disabled'}>${esc(P(M.send))}</button>
${busy ? `<p class="sx-note is-box" id="dc-wait" tabindex="-1" role="status"><span>${esc(P(M.waiting))}</span>${mnLine(M.waiting[2])}</p>` : notice}
${both(en, M.quota, 'p', 'sx-fine')}${left}`);
}

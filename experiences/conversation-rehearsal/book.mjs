import { SCENARIOS, REVIEWS, DIRECTIONS, MAX_SESSIONS, validateArchive, getTurn, practiceDetails } from './domain.mjs';
import { BOOK_FONT_CSS, BOOK_FONT_LICENSE } from '../member-book-assets.mjs';

export const BOOK_FILENAME = 'synk-rehearsal-book.html';
export const BOOK_MIME = 'text/html';
export const MAX_BOOK_BYTES = 2 * 1024 * 1024;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const date = value => new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value));

// Keep a short turn and its final reflection on one sheet. This is a soft print
// break preference: a turn taller than a sheet can still fragment at text lines.
// No fixed height or hidden overflow is used, so long original answers survive.
export const BOOK_STYLES = `
.growth-book{color:#202837;font-family:SUIT,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:16px;line-height:1.8;word-break:keep-all;overflow-wrap:anywhere}
.growth-book *{box-sizing:border-box}
.growth-book .book-cover{padding:48px 40px;border-top:5px solid #24448c;background:#f5f7fc}
.growth-book .book-label{font-family:InterTight,'Inter Tight',SUIT,sans-serif;font-size:12px;letter-spacing:.12em;color:#24448c;font-weight:700;margin:0 0 16px}
.growth-book h2{font-size:34px;line-height:1.35;letter-spacing:-.035em;margin:0 0 24px}
.growth-book h3{font-size:24px;line-height:1.5;margin:8px 0 20px}
.growth-book h4{font-size:19px;line-height:1.5;margin:0 0 16px}
.growth-book p{margin:0 0 16px}
.growth-book .book-note{font-size:13px;color:#586372}
.growth-book .book-session{padding:40px 0;border-bottom:1px solid #ccd3df}
.growth-book .book-meta{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px 16px;margin:0 0 32px}
.growth-book dt{color:#586372;font-size:13px}
.growth-book dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.growth-book .book-turn{padding:28px 0;border-top:1px solid #e0e4eb}
.growth-book .book-role{font-size:12px;color:#24448c;font-weight:700;margin:20px 0 6px}
.growth-book .book-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 12px;orphans:3;widows:3}
.growth-book .book-prompt{border-left:3px solid #cad5eb;padding-left:16px}
.growth-book .book-feeling{font-size:13px;color:#586372;margin:0 0 20px}
.growth-book .book-keepsake{padding:24px 0;border-top:2px solid #24448c}
.growth-book .book-empty{color:#69717e;font-size:14px}
@media(max-width:480px){.growth-book{font-size:15px}.growth-book .book-cover{padding:28px 20px}.growth-book h2{font-size:29px}.growth-book h3{font-size:22px}.growth-book .book-meta{grid-template-columns:1fr;gap:0}.growth-book dd{margin:0 0 16px}}
@page{size:A4;margin:18mm 17mm}
@media print{.growth-book{font-size:10.5pt;color:#111}.growth-book .book-cover{background:none;padding:24mm 0 12mm;border-top:2pt solid #24448c}.growth-book h2{font-size:30pt}.growth-book h3{font-size:20pt}.growth-book h4{font-size:13pt}.growth-book .book-session{break-before:page;padding:0;border:0}.growth-book .book-turn{padding:5mm 0;page-break-inside:avoid;break-inside:avoid-page}.growth-book .book-keepsake{padding:5mm 0;page-break-inside:avoid;break-inside:avoid-page}.growth-book h2,.growth-book h3,.growth-book h4,.growth-book .book-role,.growth-book dt{break-after:avoid}.growth-book .book-meta{display:block}.growth-book dd{margin:0 0 3mm}.growth-book .book-note,.growth-book .book-feeling,.growth-book .book-role,.growth-book dt{font-size:9pt;color:#333}.growth-book .book-text{break-inside:auto}.growth-book .book-cover,.growth-book .book-turn,.growth-book .book-session{overflow:visible}}
`;

function completeSessions(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) throw new TypeError('대화를 한 번 끝내면 나의 성장 작품집을 만들 수 있어요.');
  const valid = validateArchive({ schema:1, savedAt:'2026-10-06T00:00:00.000Z', sessions }).sessions;
  return valid.sort((a,b) => Date.parse(a.at) - Date.parse(b.at));
}

function passage(label, value, extra = '') {
  return `<p class="book-role">${label}</p>${value ? `<p class="book-text ${extra}">${escape(value)}</p>` : '<p class="book-empty">아직 남기지 않았어요.</p>'}`;
}

export function bookContent(sessions) {
  const sorted = completeSessions(sessions);
  return `<article class="growth-book" aria-label="내 성장 작품집"><header class="book-cover"><p class="book-label">SYNK FOR YOU / MY REHEARSAL BOOK</p><h2>내 성장 작품집</h2><p>처음 꺼낸 말부터,<br>다시 써 본 내 문장까지.</p><p>${sorted.length}회의 대화 연습 · ${escape(date(sorted[0].at))}${sorted.length > 1 ? ` — ${escape(date(sorted.at(-1).at))}` : ''}</p><p class="book-note">내가 직접 쓴 답과 고른 느낌을 모았어요. 연습 기록이며 실제 대화 성과나 실력 평가를 뜻하지 않습니다.</p></header>${sorted.map((session,index) => {
    const scenario = SCENARIOS[session.scenario];
    return `<section class="book-session"><p class="book-label">REHEARSAL ${String(index + 1).padStart(2,'0')}</p><h3>${escape(scenario.name)}</h3><dl class="book-meta"><dt>연습 시작</dt><dd><time datetime="${escape(session.at)}">${escape(date(session.at))} · 한국 시간</time></dd><dt>대화 상대</dt><dd>${escape(session.counterpart)}</dd><dt>내 목표</dt><dd>${escape(session.goal)}</dd>${session.practice ? `<dt>고른 연습</dt><dd>${escape(practiceDetails(session).label)}</dd>` : ''}<dt>고른 연습 방향</dt><dd>${escape(DIRECTIONS[session.focus])}</dd></dl>${session.turns.map((turn,turnIndex) => `<section class="book-turn"><h4>${turnIndex + 1}. ${escape(getTurn(session,turnIndex).title)}</h4>${passage('상대의 말 · 연습용 대사',getTurn(session,turnIndex).prompt,'book-prompt')}${passage('처음 적은 말',turn.answer)}<p class="book-feeling">내가 고른 느낌: ${escape(REVIEWS[turn.review])}</p>${turn.retry ? `${passage('다시 적은 말',turn.retry)}<p class="book-feeling">다시 말한 뒤 내가 고른 느낌: ${escape(REVIEWS[turn.retryReview])}</p>` : '<p class="book-note">이 대화는 아직 다시 쓰지 않았어요.</p>'}</section>`).join('')}<section class="book-keepsake"><h4>실제 대화에 가져갈 내 문장</h4>${passage('내 첫 문장',session.firstSentence)}${passage('기억할 한 가지',session.takeaway)}</section></section>`;
  }).join('')}<p class="book-note">현재 보관 중인 완료 기록 ${sorted.length}회 · 최대 ${MAX_SESSIONS}회. 처음 쓴 답과 가장 최근에 다시 쓴 답을 담았습니다. 날짜는 연습을 시작한 시각이며 다시 쓴 시각은 별도로 기록하지 않습니다.</p></article>`;
}

export function createBook(sessions) {
  const content = bookContent(sessions);
  const html = `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>내 성장 작품집 · SYNK</title><style>${BOOK_FONT_CSS}html{background:#fff}body{margin:0 auto;padding:32px;max-width:860px}.font-license{margin-top:40px;font:12px/1.6 sans-serif;color:#596170}.font-license pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:480px){body{padding:18px}}@media print{body{max-width:none;padding:0;margin:0}.font-license{display:none}}${BOOK_STYLES}</style></head><body>${content}<details class="font-license"><summary>포함된 글꼴의 라이선스</summary><pre>${escape(BOOK_FONT_LICENSE)}</pre></details></body></html>`;
  if (new TextEncoder().encode(html).length > MAX_BOOK_BYTES) throw new RangeError('작품집 파일이 2MiB를 넘었어요. JSON으로 기록을 보관해 주세요.');
  return html;
}

'use strict';
/* 게시글(캡션·제목·첫 댓글·고정 댓글·블로그 원고) 규칙 검사(2026-10-21). 글을 바꾸지 않고 걸린 곳만 돌려준다.
 *
 * 근거: 제작 방식 v2 §2-4 「게시 캡션 첫 125자」(인스타 피드가 「더 보기」 전에 보여 주는 길이 — 해시태그·링크·인사로 쓰지 않는다),
 * 07시 예약 작업 지시문 「인스타는 캡션과 첫 댓글 합쳐 해시태그 5개」·「시청자에게 보일 글에 내부 번호·상대 날짜·AI 도구 이름을
 * 쓰지 않는다」(도구 이름은 LAB만 — synkbrief·yuhobuilds는 AI 도구 쓰는 법이 내용이라 제작 도구 이름만 본다), 결정 표 10-02
 * 「어떤 AI로 만들었는지 쓰지 않는다」, Fable 완성본 검수 10-21 P1(티스토리 글의 옛 숫자) → 영상·게시글·블로그의 숫자 대조.
 * 각 항목은 { level: '고칠 것'|'확인할 것', code, message }다. 플랫폼 한도(인스타 2,200자·해시태그 30개, 유튜브 제목 100자·
 * 설명 5,000바이트·제목의 < >)는 서버·API가 거절하는 값이라 「고칠 것」이다.
 */

const FIX = '고칠 것';
const LOOK = '확인할 것';
const FIRST = 125;

const URL = /\bhttps?:\/\/[^\s)>\]」』"']+|\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:im|com|net|org|kr|me|io|co|ly|gg|app|dev|page)(?:\/[^\s)>\]」』"']*)?/gi;
// 숫자만인 「#5」(퀴즈 번호)는 해시태그가 아니다.
const HASHTAG = /(?:^|[^\p{L}\p{N}_&#])#(?=[\p{N}_]*\p{L})([\p{L}\p{N}_]+)/gu;
const GREETING = /^\s*(안녕하세요|안녕|반가워요|반갑습니다|여러분 안녕|hello\b|hi\b|hey\b|сайн байна уу|сайн уу|大家好|你好|မင်္ဂလာပါ)/i;

// 상대 날짜: 게시일은 승인 뒤에 정해지므로 「어제·오늘」은 틀린 말이 된다(메모 10-12, 지시문 「날짜를 쓴다」).
const RELATIVE = {
  // 낱말 가운데(「제작일」의 작일, 「지원금일」의 금일)와 다른 낱말(오늘날·그제야·내일배움카드)은 빼려고 앞은 한글이 아니어야 하고 금일·작일·명일은 보지 않는다.
  ko: /(?<![가-힣])(그저께|그제(?!서야|야)|어제|오늘(?!날)|내일(?!배움)|모레|이번\s?주|지난\s?주|다음\s?주|이번\s?달|지난\s?달|다음\s?달|방금)/g,
  en: /\b(yesterday|today|tonight|tomorrow|this week|last week|next week|this month|last month|next month|just now)\b/gi,
  mn: /(өнөөдөр|өчигдөр|маргааш|уржигдар|нөгөөдөр|энэ долоо хоног|өнгөрсөн долоо хоног|ирэх долоо хоног)/gi,
  zh: /(今天|昨天|明天|前天|后天|本周|上周|下周|这周|刚刚)/g,
  my: /(ယနေ့|မနေ့က|မနက်ဖြန်|ဒီနေ့)/g,
};

// 내부 번호: 판 번호(v6·v4b), 자료 번호(D0008), 저장소 경로, 내부 용어. 장부 사례(S17)·검수 등급(P1)·코드 파일 이름은
// 실제 낱말(갤럭시 S23 등)과 겹칠 수 있어 확인만. 「내영상.mp4」처럼 따라 하는 법에 든 파일 이름은 보지 않는다.
const INTERNAL_STRONG = [
  [/(?<![\p{L}\p{N}])v\d{1,2}[a-d]?(?![\p{L}\p{N}])/giu, '판 번호'],
  [/(?<![\p{L}\p{N}])D\d{4}(?![\p{L}\p{N}])/gu, '자료 번호'],
  [/(?<![\p{L}\p{N}])(?:docs|tools|remotion|\.tmp)\/[^\s]+/g, '저장소 경로'],
  [/(준비\.json|게시결과|편 폴더|결정 표|트랙 §|만족 사례|장부 S\d)/g, '내부 용어'],
];
const INTERNAL_WEAK = [
  [/(?<![\p{L}\p{N}])S\d{1,2}(?![\p{L}\p{N}])/gu, '장부 사례 번호 같음'],
  [/(?<![\p{L}\p{N}])P[0-3](?![\p{L}\p{N}])/gu, '검수 등급 같음'],
  [/[\p{L}\p{N}_-]+\.(?:json|mjs|cjs|tsx)(?![\p{L}\p{N}])/giu, '코드 파일 이름 같음'],
];

// 만든 도구 이름(어떤 AI로 만들었는지). 모든 브랜드에서 쓰지 않는다. LAB은 일반 AI 이름도 쓰지 않는다(지시문).
const MAKER_TOOLS = /(suno|수노|typecast|타입캐스트|higgsfield|힉스필드|nano\s?banana|나노\s?바나나|seedance|시댄스|kling|클링|\bveo\s?\d|remotion|리모션|hyperframes|하이퍼프레임|elevenlabs|일레븐랩스|midjourney|미드저니|gpt[\s-]?image|gpt\s?이미지|gemini\s?tts|wan\s?\d\.\d|stable diffusion|flux)/gi;
const AI_NAMES = /(chat\s?gpt|챗\s?gpt|챗지피티|\bgpt[\s-]?\d|\bclaude\b|클로드|\bgemini\b|제미나이|\bcopilot\b|코파일럿|perplexity|퍼플렉시티|\bgrok\b)/gi;

function list(re, text) {
  return [...String(text || '').matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].map((m) => m[0]);
}

function hashtags(text) {
  return [...String(text || '').matchAll(HASHTAG)].map((m) => '#' + m[1]);
}

function urls(text) {
  return [...new Set(list(URL, text).map((u) => u.replace(/[.,!?…·]+$/, '')))]
    .filter((u) => !/^[\d.]+$/.test(u));
}

// 글 하나(where = '캡션' 등)에 대한 공통 검사. 블로그·링크드인 원고(article)는 만든 과정을 풀어 쓰는 글이라 도구 이름을 확인만 한다.
function checkText(text, { where, brand, language, platform, article = false }) {
  const out = [];
  const add = (level, code, message) => out.push({ level, code, where, message });
  const t = String(text || '');
  for (const [lang, re] of Object.entries(RELATIVE)) {
    // 한국어 학습 편(LAB)의 다른 언어판은 한국어 낱말이 교재 내용일 수 있어 그 판의 언어만 본다.
    if (lang === 'ko' && brand === 'LAB' && language && language !== 'ko') continue;
    if (lang !== 'ko' && language && lang !== language && !(lang === 'en' && brand !== 'LAB')) continue;
    const hit = [...new Set(list(re, t).map((x) => x.toLowerCase()))];
    if (hit.length) add(FIX, 'relative-date', `상대 날짜 「${hit.join('·')}」 — 게시일은 승인 뒤에 정해지니 날짜나 날짜와 상관없는 말로`);
  }
  for (const [re, name] of INTERNAL_STRONG) {
    const hit = [...new Set(list(re, t))];
    if (hit.length) add(article ? LOOK : FIX, 'internal-code', `${name} 「${hit.slice(0, 3).join('·')}」 — 시청자에게 보이는 글에 내부 번호·용어를 쓰지 않는다`);
  }
  for (const [re, name] of INTERNAL_WEAK) {
    const hit = [...new Set(list(re, t))];
    if (hit.length) add(LOOK, 'internal-code-maybe', `「${hit.slice(0, 3).join('·')}」(${name}) — 내부 번호면 뺀다`);
  }
  const makers = [...new Set(list(MAKER_TOOLS, t).map((x) => x.trim()))];
  if (makers.length) add(article ? LOOK : FIX, 'maker-tool', `만든 도구 이름 「${makers.join('·')}」 — 어떤 AI로 만들었는지 쓰지 않는다(결정 표 10-02)${article ? '. 도구 쓰는 법이 글의 내용이면 둔다' : ''}`);
  if (brand === 'LAB' && !article) {
    const names = [...new Set(list(AI_NAMES, t).map((x) => x.trim()))];
    if (names.length) add(FIX, 'ai-name', `AI 도구 이름 「${names.join('·')}」 — LAB 글에는 쓰지 않는다(07시 LAB 지시문)`);
  }
  if (platform === 'youtube' && where === '제목' && /[<>]/.test(t)) add(FIX, 'title-angle', '유튜브 제목에 < > 는 쓸 수 없다(업로드가 거절된다)');
  return out;
}

// 판 하나의 글 묶음 검사. texts = { title, caption, firstComment, pinnedComment }.
function checkPlate(texts, { brand, language, platform }) {
  const out = [];
  const ctx = { brand, language, platform };
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const caption = texts.caption || '';
  if (!caption.trim()) add(FIX, 'no-caption', platform === 'youtube' ? '설명' : '캡션', '게시글이 없다(판의 원고.json·게시글 파일에서 찾지 못함)');
  else {
    const head = [...caption.trim()].slice(0, FIRST).join('');
    const tags = hashtags(head), links = urls(head);
    if (tags.length) add(FIX, 'first125-hashtag', '캡션', `첫 ${FIRST}자 안에 해시태그 ${tags.slice(0, 3).join(' ')} — 첫 ${FIRST}자는 훅 자리(v2 §2-4)`);
    if (links.length) add(FIX, 'first125-link', '캡션', `첫 ${FIRST}자 안에 링크 ${links[0]} — 첫 ${FIRST}자는 훅 자리(v2 §2-4)`);
    if (GREETING.test(head)) add(FIX, 'first125-greeting', '캡션', `인사로 시작한다(「${head.slice(0, 12)}…」) — 첫 줄에 이 편이 주는 것을 둔다(v2 §2-4)`);
  }
  if (platform === 'instagram' || platform === 'facebook') {
    const n = hashtags(caption).length + hashtags(texts.firstComment).length;
    if (platform === 'instagram' && n > 5) add(FIX, 'hashtag-count', '캡션+첫 댓글', `해시태그 ${n}개 — 인스타는 캡션과 첫 댓글 합쳐 5개(07시 지시문)`);
    if ([...caption].length > 2200) add(FIX, 'caption-length', '캡션', `캡션 ${[...caption].length}자 — 인스타 한도 2,200자`);
    if (hashtags(caption).length > 30) add(FIX, 'hashtag-limit', '캡션', '해시태그 30개 넘음 — 인스타가 거절한다');
  }
  if (platform === 'youtube') {
    const title = texts.title || '';
    if (!title.trim()) add(FIX, 'no-title', '제목', '유튜브 제목이 없다');
    else if ([...title].length > 100) add(FIX, 'title-length', '제목', `제목 ${[...title].length}자 — 유튜브 한도 100자`);
    if (Buffer.byteLength(caption, 'utf8') > 5000) add(FIX, 'description-length', '설명', `설명 ${Buffer.byteLength(caption, 'utf8')}바이트 — 유튜브 한도 5,000바이트`);
    out.push(...checkText(title, { ...ctx, where: '제목' }));
  }
  out.push(...checkText(caption, { ...ctx, where: platform === 'youtube' ? '설명' : '캡션' }));
  if (texts.firstComment) out.push(...checkText(texts.firstComment, { ...ctx, where: '첫 댓글' }));
  if (texts.pinnedComment) out.push(...checkText(texts.pinnedComment, { ...ctx, where: '고정 댓글' }));
  return out;
}

// ── 숫자 대조 ──
// 「24초」·「2.5초」·「6%」·「15%」처럼 단위가 붙은 수를 모은다. 한국어 숫자말(「이십사 초」·「이 점 오 초」)도 아라비아 숫자로 바꾼다.
// 주장이 되는 잰 값의 단위만 센다. 날짜(년·월·일)·순서(번·단계)·개수(개·가지)는 글 짜임에 흔해 대조에서 뺀다.
const UNITS = '초|분|시간|개월|퍼센트|%|배|명|원|달러|픽셀|px|LUFS|Mbps|MB|GB|fps|프레임';
// 한국어는 단위 뒤에 조사가 붙는다(「270픽셀로」·「24초가」·「3초간」) — 조사·접미사만 받고 다른 낱말(「1분기」·「1원칙」·「2분할」)은 뺀다.
const AFTER_UNIT = '(?=$|[^가-힣A-Za-z]|[가이를을는은로으에의도만와과씩쯤부까간째])';
const NUMBER = new RegExp(`(\\d+(?:[.,]\\d+)*)\\s?(${UNITS})${AFTER_UNIT}`, 'gu');
const DIGIT = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
const SCALE = { 십: 10, 백: 100, 천: 1000 };

function sinoToNumber(word) {
  let total = 0, digit = null, seen = false;
  for (const ch of word) {
    if (ch in DIGIT) { digit = DIGIT[ch]; seen = true; } else if (ch in SCALE) { total += (digit ?? 1) * SCALE[ch]; digit = null; seen = true; } else return null;
  }
  return seen ? total + (digit ?? 0) : null;
}

function spelledNumbers(text) {
  // 나레이션 대본은 수와 단위 사이를 띄운다(「사십이 초」·「육 퍼센트」) — 띄움을 요구해 「구분」(구+분)·「이분」 같은 낱말을 뺀다. 「이십사 초가」처럼 조사는 붙어도 된다.
  const re = new RegExp(`(?<![가-힣])([영공일이삼사오육륙칠팔구십백천]+)(?:\\s?점\\s?([영공일이삼사오육륙칠팔구]+))?\\s+(초|분|시간|퍼센트|배|프로)${AFTER_UNIT}`, 'g');
  const out = [];
  for (const m of String(text || '').matchAll(re)) {
    const whole = sinoToNumber(m[1]);
    if (whole == null) continue;
    const frac = m[2] ? [...m[2]].map((c) => DIGIT[c]).join('') : '';
    const unit = m[3] === '퍼센트' || m[3] === '프로' ? '%' : m[3];
    out.push(`${whole}${frac ? '.' + frac : ''}${unit}`);
  }
  return out;
}

const SAME_UNIT = { 퍼센트: '%', 픽셀: 'px' };

function numbers(text) {
  const out = [];
  for (const m of String(text || '').matchAll(NUMBER)) {
    const unit = SAME_UNIT[m[2]] || m[2];
    out.push(`${m[1].replace(/,(?=\d{3}\b)/g, '')}${unit}`);
  }
  return [...new Set([...out, ...spelledNumbers(text)])];
}

// 블로그·링크드인·게시글에만 있고 영상(화면 글·나레이션)과 다른 게시글 어디에도 없는 수를 찾는다. 수가 다를 뿐 맞을 수도 있어 「확인할 것」.
function compareNumbers(docs, reference) {
  const known = new Set(reference.flatMap((x) => numbers(x)));
  const out = [];
  for (const doc of docs) {
    const missing = numbers(doc.text).filter((n) => !known.has(n));
    if (missing.length) out.push({ level: LOOK, code: 'number-mismatch', where: doc.name,
      message: `영상·게시글에 없는 수 ${missing.slice(0, 8).join(' · ')}${missing.length > 8 ? ` 외 ${missing.length - 8}` : ''} — 옛 숫자가 남았는지 본다(Fable 10-21 P1)` });
  }
  return out;
}

module.exports = { FIX, LOOK, checkPlate, checkText, hashtags, urls, numbers, spelledNumbers, compareNumbers, sinoToNumber };

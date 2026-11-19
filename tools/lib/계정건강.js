'use strict';
/* 계정 건강 진단(2026-11-19) — 계정 하나의 팔로워 기록과 게시물 숫자를 받아 건강 상태, 까닭, 처방을 낸다. AI를 부르지 않는다.
 *
 * 유호님 11-19: 「조회수는 낮은데 팔로워가 비정상적으로 높은 계정 = 건강하지 못한계정」,
 *              「조회수는 낮은데 공유랑,댓글 등 반응이 좋은 계정 = 건강한계정」,
 *              「이런거 세밀하게 판단해서 계정에대해 솔루션 주는 기능」.
 *
 * 조회수의 크기는 점수에 넣지 않는다. 신호 일곱을 따로 재고(닿음 · 깊이 · 남김 · 흐름 · 쏠림 · 꾸준함 · 붙잡음), 신호의 짝으로 유형을 정한다.
 * 재지 못한 신호는 「모름」이고 0이 아니다. 모르는 신호는 점수에서 빠지고, 화면에는 왜 모르는지를 적는다.
 * 기준 숫자와 출처, 설계는 docs/디자인/솔리오_계정건강_20261119/README.md에 있다. 기준을 바꾸면 그 문서의 표도 같이 고친다.
 * 파일, 네트워크, 시계를 쓰지 않는다(now를 받는다). 의존이 없어 솔리오 PC 앱으로 그대로 옮길 수 있다.
 *
 * 받는 꼴:
 *   { key, name, platform, followers:[{date:'YYYY-MM-DD', n, views?}], posts:[{ id, title, publishedAt,
 *       points:{ '24h':{views,likes,comments,shares,saves,reach}, '72h':{…}, '7d':{…} }, screen:{ stayedToWatchPct, … } }] }
 * 돌려주는 꼴: 진단() 아래 주석.
 */

const DAY = 864e5;
const 상태이름 = Object.freeze({ 건강: '건강함', 주의: '지켜볼 것', 나쁨: '건강하지 않음', 이름: '판단 이름' });

/** 기준 숫자. 「좋음」 이상이면 좋음, 「나쁨」 아래면 나쁨, 그 사이는 보통이다. */
const 기준 = Object.freeze({
  창일수: 28,          // 최근으로 보는 기간
  팔로워묵음: 10,      // 팔로워를 마지막으로 잰 지 이 날수가 넘으면 그 값으로 판정하지 않는다(11-19 설계 검토 P1)
  표본편수: 5,          // 이보다 적으면 판단하지 않는다
  표본조회: 300,        // 본 편들의 조회 합이 이보다 적으면 비율을 내지 않는다
  // 한 편의 조회(가운데 값) ÷ 팔로워. 계정이 클수록 이 비율은 낮아지므로 크기별로 본다.
  // 좋음은 같은 크기 계정의 평균쯤, 나쁨은 그 3분의 1 아래다(Socialinsider 릴스 · 틱톡 규모별 평균, README 「기준 숫자」)
  닿음: { 팔로워최소: 100, 구간: [{ 까지: 5000, 나쁨: 0.05, 좋음: 0.2 }, { 까지: 50000, 나쁨: 0.03, 좋음: 0.1 }, { 까지: Infinity, 나쁨: 0.015, 좋음: 0.06 }] },
  껍데기팔로워: 500,    // 닿음이 나쁠 때 「팔로워만 큰 계정」으로 부르는 팔로워 수
  깊이: {
    // 조회 1,000번마다의 반응에서, 그 플랫폼의 가운데 값을 「선」으로 둔다(11-19 세 번째로 잼, 출처는 README 「기준 숫자」).
    // 틱톡 · 릴스 · 쇼츠의 좋아요 · 댓글 · 공유와 틱톡의 저장은 영상 150만 편의 가운데 값(viral.app, 2025-10~2026-08)이다.
    // 릴스의 저장은 Socialinsider 릴스 평균과 Dash Social의 「저장은 공유의 절반쯤」에서 1.5로 잡았다.
    // 쇼츠의 좋아요는 두 조사(9.3과 20.8)의 사이, 쇼츠의 공유는 공개된 수가 없어 틱톡 값을 빌렸다. 페이스북은 릴스 값을, 그 밖은 틱톡 값을 빌렸다.
    선: {
      tiktok: { shares: 1.5, saves: 4, comments: 0.7, likes: 47 },
      instagram: { shares: 2.4, saves: 1.5, comments: 0.4, likes: 18 },
      facebook: { shares: 2.4, saves: 1.5, comments: 0.4, likes: 18 },
      youtube: { shares: 1.5, saves: 4, comments: 0.6, likes: 15 },
      기본: { shares: 1.5, saves: 4, comments: 0.7, likes: 47 },
    },
    // 반응마다 선의 몇 배인지를 내고(위는 3배에서 자른다) 무게로 평균한다. 보내기가 가장 무겁고 좋아요가 가장 가볍다.
    // 좋아요는 3배여도 혼자서는 「좋음」에 닿지 못하고, 저장이나 공유 하나가 아주 높으면 닿는다
    무게: { shares: 3, saves: 2, comments: 2, likes: 1 }, 덮개: 3,
    한편빼기: 6,          // 편이 이만큼 넘으면 가장 잘된 한 편을 뺀 값도 내고, 둘 가운데 낮은 쪽으로 판정한다
    좋음: 1, 나쁨: 0.3,   // 평균한 값이 선(1)을 넘으면 좋음, 선의 30% 아래면 나쁨
    기대반응: 5,          // 선만큼 반응했을 때 공유 · 저장 · 댓글이 이만큼은 나올 조회가 쌓여야 판정한다
    좋아요만: 0.5,        // 좋아요는 선을 넘는데 나머지가 선의 이 비율 아래면 「좋아요만 받는」
  },
  남김: { 조회최소: 2000, 나쁨: 0.5, 좋음: 3, 수상함: 100, 수상한수: 100 }, // 조회 1,000번마다 늘어난 팔로워
  흐름: { 편수: 3, 조회최소: 30, 나쁨: 0.6, 좋음: 1.3 },            // 최근 편 가운데 값 ÷ 그 앞 편 가운데 값(같은 나이)
  쏠림: { 나쁨몫: 0.5, 나쁨배수: 10, 좋음배수: 4 },     // 가장 잘된 편이 조회 합에서 차지하는 몫, 가운데 값의 몇 배인지
  꾸준함: { 멈춤: 21, 나쁨: 14, 좋음편수: 3, 좋음기간: 14 },
  // 플랫폼 화면에서만 나오는 값. 있는 것 가운데 위에서부터 하나를 쓴다. 좋음은 조사된 평균쯤이고, 플랫폼이 공식으로 낸 기준은 없다.
  //   넘기지 않고 본 비율(쇼츠): 쇼츠 5,400편 분석에서 잘된 편이 70~90%, 60% 아래는 드물게 성공
  //   3초 넘게 본 비율(릴스): 릴스 977만 편의 3초 안 넘김이 평균 60~65%라 남는 쪽은 35~40%(Socialinsider 2026 상반기). 처음 값 60은 통념이었다
  //   평균 시청 비율(쇼츠): 브랜드 630곳 평균 86%(Dash Social 2025)   끝까지 본 비율(틱톡): 브랜드 970곳 평균 10%(같은 곳)
  붙잡음: {
    stayedToWatchPct: { 이름: '넘기지 않고 본 비율', 나쁨: 55, 좋음: 70, 첫장면: true },
    earlyRetention3sPct: { 이름: '3초 넘게 본 비율', 나쁨: 25, 좋음: 40, 첫장면: true },
    averageViewPct: { 이름: '평균 시청 비율', 나쁨: 50, 좋음: 80 },
    completionRatePct: { 이름: '끝까지 본 비율', 나쁨: 5, 좋음: 10 },
  },
  막힘: { 앞편수: 5, 앞가운데: 200, 연속: 3, 비율: 0.2 },
  // 신호의 무게. 플랫폼이 공식으로 밝힌 신호를 그 플랫폼에서 더 무겁게 본다: 인스타그램은 보내기(반응),
  // 유튜브 쇼츠는 시청함 대 넘김(붙잡음), 틱톡은 끝까지 보기(붙잡음)와 반응
  무게: { 깊이: 3, 닿음: 2, 흐름: 2, 남김: 2, 붙잡음: 2, 쏠림: 1, 꾸준함: 1 },
  플랫폼무게: { youtube: { 깊이: 2, 붙잡음: 3 }, tiktok: { 붙잡음: 3 } },
  아는무게: 4,          // 잰 신호의 무게 합이 이보다 작으면 상태를 말하지 않는다
  점수: { 건강: 0.3, 나쁨: -0.3 },
});

const num = n => typeof n === 'number' && Number.isFinite(n);
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const sum = a => a.reduce((s, x) => s + x, 0);
function median(a) {
  const s = a.filter(num).sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
/** 한 자리까지만 보이는 비율 글(0.6배, 12배) */
const times = r => (r >= 10 ? fmt(r) : (Math.round(r * 10) / 10).toLocaleString('ko-KR')) + '배';
const one = n => (n >= 10 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString('ko-KR'));
const pct = r => Math.round(r * 100) + '%';
const grade = (v, { 나쁨, 좋음 }) => (v >= 좋음 ? '좋음' : v < 나쁨 ? '나쁨' : '보통');

/** 게시물 하나의 가장 익은 값. 7일 값이 72시간 값을, 72시간 값이 24시간 값을 덮고, 화면에서 읽은 값을 더한다 */
function 게시물값(post) {
  const out = {};
  for (const point of ['24h', '72h', '7d']) for (const [k, v] of Object.entries(post.points?.[point] || {})) if (num(v)) out[k] = v;
  for (const [k, v] of Object.entries(post.screen || {})) if (num(v)) out[k] = v;
  return out;
}
const when = p => Date.parse(p.publishedAt);

/**
 * 내가 편마다 다는 고정 댓글은 본 사람의 반응이 아니다. 계정에 ownComments(편마다 내가 다는 댓글 수)가 있으면 그만큼,
 * 없으면 댓글이 달린 편이 절반을 넘고 그 가운데 70% 넘게가 꼭 하나일 때 하나씩 뺀다(11-19 우리 유튜브 세 계정: 23편 가운데 21편이 꼭 하나).
 */
function 자기댓글(all, given) {
  if (num(given)) return Math.max(0, given);
  const c = all.map(p => p.v.comments).filter(num), has = c.filter(x => x >= 1);
  return c.length >= 기준.표본편수 && has.length >= c.length * 0.5 && has.filter(x => x === 1).length >= has.length * 0.7 ? 1 : 0;
}

function 본편들(posts, now, ownComments) {
  let all = (posts || []).filter(p => Number.isFinite(when(p)) && when(p) <= now)
    .map(p => ({ ...p, v: 게시물값(p), t: when(p) })).filter(p => num(p.v.views)).sort((a, b) => a.t - b.t);
  // 형식(format)이 적혀 있으면 가장 많은 형식의 편끼리만 견준다. 쇼츠와 긴 영상, 릴스와 사진은 숫자의 뜻이 다르다
  const count = {}; for (const p of all) if (p.format) count[p.format] = (count[p.format] || 0) + 1;
  const main = Object.keys(count).sort((a, b) => count[b] - count[a])[0], before = all.length;
  if (main) all = all.filter(p => !p.format || p.format === main);
  all.뺀편 = before - all.length;
  const own = 자기댓글(all, ownComments);
  if (own) for (const p of all) if (num(p.v.comments)) p.v.comments = Math.max(0, p.v.comments - own);
  all.own = own;
  const recent = all.filter(p => now - p.t <= 기준.창일수 * DAY);
  // 최근 28일에 다섯 편이 안 되면 90일 안의 마지막 열 편으로 본다(뜸한 계정도 반응의 질은 잴 수 있다)
  const seen = recent.length >= 기준.표본편수 ? recent : all.filter(p => now - p.t <= 90 * DAY).slice(-10);
  return { all, seen };
}

function 팔로워기록(followers) {
  return (followers || []).filter(f => num(f.n) && Number.isFinite(Date.parse(f.date)))
    .map(f => ({ t: Date.parse(f.date), n: f.n, views: num(f.views) ? f.views : null })).sort((a, b) => a.t - b.t);
}

/* ── 신호 일곱. 각각 { 키, 이름, 판정:'좋음'|'보통'|'나쁨'|'모름', 값, 글 }을 돌려준다 ── */

/** 한국 날짜의 「M월 D일」 */
const 월일 = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
/** 마지막으로 잰 팔로워 값이 오래됐는가. 오래된 값으로 판정하면 숫자가 바뀌지 않았는데 판정만 남는다 */
const 묵은팔로워 = (fol, now) => { const last = fol.at(-1); return !!last && now - last.t > 기준.팔로워묵음 * DAY; };
const 묵음글 = fol => `팔로워 수를 ${월일(fol.at(-1).t)}에 마지막으로 쟀습니다. 다시 재면 판정합니다.`;

function 닿음(seen, fol, now = Date.now()) {
  const base = { 키: '닿음', 이름: '팔로워에게 닿는가' };
  const last = fol.at(-1);
  if (!last) return { ...base, 판정: '모름', 값: '', 글: '팔로워 수를 잰 적이 없습니다.' };
  if (묵은팔로워(fol, now)) return { ...base, 판정: '모름', 값: '', 글: 묵음글(fol) };
  if (last.n < 기준.닿음.팔로워최소) return { ...base, 판정: '모름', 값: `팔로워 ${fmt(last.n)}명`, 글: `팔로워가 ${기준.닿음.팔로워최소}명 아래라 팔로워 대비로는 보지 않습니다. 이 크기에서는 조회 대부분이 팔로워 밖에서 옵니다.` };
  const mid = median(seen.map(p => p.v.views)), r = mid / last.n;
  const rule = 기준.닿음.구간.find(g => last.n < g.까지), 판정 = grade(r, rule);
  const 글 = 판정 === '나쁨' ? `팔로워는 ${fmt(last.n)}명인데 한 편을 보는 사람은 ${fmt(mid)}명꼴입니다. 팔로워 대부분이 이 계정의 편을 보지 않습니다.`
    : r >= 1 ? `한 편의 조회가 팔로워 수의 ${times(r)}입니다. 팔로워 밖의 사람에게 퍼지고 있습니다.`
      : `한 편을 팔로워의 ${pct(r)}쯤이 봅니다.`;
  return { ...base, 판정, 값: `팔로워의 ${r >= 1 ? times(r) : pct(r)}`, 글, 비율: r, 팔로워: last.n, 가운데조회: mid, 좋음선: rule.좋음 };
}

const 플랫폼이름 = { instagram: '인스타그램', tiktok: '틱톡', youtube: '유튜브', facebook: '페이스북' };
const 무게 = platform => ({ ...기준.무게, ...(기준.플랫폼무게[platform] || {}) });

function 깊이(seen, platform, own = 0) {
  const base = { 키: '깊이', 이름: '본 사람이 반응하는가' };
  const views = sum(seen.map(p => p.v.views));
  if (views < 기준.표본조회) return { ...base, 판정: '모름', 값: '', 글: `조회 합이 ${fmt(views)}번이라 비율을 내기에 적습니다.` };
  const rule = 기준.깊이, line = rule.선[platform] || rule.선.기본;
  const NAME = { shares: '공유', saves: '저장', comments: '댓글', likes: '좋아요' };
  const VERB = { shares: ['보내', '보냅니다'], saves: ['저장하', '저장합니다'], comments: ['말을 걸', '말을 겁니다'] };
  // 그 반응을 잰 편만 모아서, 그 편들의 조회로 나눈다
  const rates = posts => {
    const out = {};
    for (const key of Object.keys(NAME)) {
      const with_ = posts.filter(p => num(p.v[key])), v = sum(with_.map(p => p.v.views));
      if (with_.length && v >= 기준.표본조회) out[key] = sum(with_.map(p => p.v[key])) / v * 1000;
    }
    return out;
  };
  const rate = rates(seen), missing = Object.keys(NAME).filter(k => k !== 'likes' && rate[k] == null).map(k => NAME[k]);
  const deep = Object.keys(rate).filter(k => k !== 'likes');
  if (!deep.length) return { ...base, 판정: '모름', 값: '', 글: '공유, 저장, 댓글을 잰 값이 없습니다.', 좋아요: rate.likes ?? null };
  // 선만큼 반응했을 때 나올 공유 · 저장 · 댓글이 다섯이 안 되는 조회로는 좋고 나쁨을 가르지 않는다
  const need = Math.ceil(rule.기대반응 / sum(deep.map(k => line[k])) * 1000 / 100) * 100;
  const shown = Object.keys(rate).map(k => `${NAME[k]} ${one(rate[k])}`).join(' · ');
  if (views < need) return { ...base, 판정: '모름', 값: '', 글: `조회 1,000번마다 ${shown}번입니다. 조회 합이 ${fmt(views)}번이라 좋고 나쁨을 가르기에 적습니다(${fmt(need)}번부터 가릅니다).`, 좋아요: rate.likes ?? null };
  const index = (r, keys) => sum(keys.map(k => rule.무게[k] * Math.min(r[k] / line[k], rule.덮개))) / sum(keys.map(k => rule.무게[k]));
  const whole = index(rate, Object.keys(rate)), deepIndex = index(rate, deep);
  // 한 편이 반응을 다 만든 계정을 「좋음」으로 부르지 않게, 가장 잘된 편을 뺀 값이 더 낮으면 그것으로 판정한다
  let all = whole, 한편뺌 = false;
  if (seen.length >= rule.한편빼기) {
    const top = seen.reduce((a, b) => (b.v.views > a.v.views ? b : a)), r = rates(seen.filter(p => p !== top)), keys = Object.keys(rate).filter(k => r[k] != null);
    const band = v => (v >= rule.좋음 ? 2 : v < rule.나쁨 ? 0 : 1);
    if (keys.some(k => k !== 'likes') && index(r, keys) < whole) { all = index(r, keys); 한편뺌 = band(all) !== band(whole); } // 판정이 바뀔 때만 화면에 말한다
  }
  const 판정 = all >= rule.좋음 ? '좋음' : all < rule.나쁨 ? '나쁨' : '보통';
  const 좋아요만 = 판정 !== '좋음' && rate.likes != null && rate.likes >= line.likes && deepIndex < rule.좋아요만;
  // 선을 넘은 반응만 말한다: 「보내고 저장합니다」
  const strong = deep.filter(k => rate[k] >= line[k]).map(k => VERB[k]);
  const did = strong.length ? strong.map((w, i) => (i < strong.length - 1 ? w[0] + '고' : w[1])).join(' ') : '반응합니다';
  const 요약 = `조회 1,000번마다 ${shown}번입니다.` + (좋아요만 ? ' 좋아요는 누르는데 보내거나 말을 걸지 않습니다.' : 판정 === '좋음' ? ` 본 사람이 ${did}.` : 판정 === '나쁨' ? ' 보고 지나갑니다.' : '');
  // 화면에서는 선을 「평균」이라고 부른다(조사된 가운데 값이다). 처음 읽는 사람이 아는 말이어야 한다
  const where = 플랫폼이름[platform] ? `${플랫폼이름[platform]}의 평균은` : '다른 계정들의 평균은';
  const 글 = 요약 + ` ${where} ${Object.keys(rate).map(k => `${NAME[k]} ${line[k]}`).join(' · ')}번입니다.` + (한편뺌 ? ` 가장 잘된 한 편을 빼면 평균의 ${Math.floor(all * 100)}%로 내려가 그 값으로 판정했습니다.` : '') + (missing.length ? ` 재지 못해 뺀 반응: ${missing.join(', ')}.` : '')
    + (own ? ` 편마다 ${own}개씩 달린 댓글은 내가 단 고정 댓글로 보고 뺐습니다.` : '');
  return { ...base, 판정, 값: `평균의 ${Math.floor(all * 100)}%`, 글, 요약, 한일: did, 지수: all, 전체지수: whole, 한편뺌, 깊은지수: deepIndex, 비율: rate, 선: line, 좋아요: rate.likes ?? null, 좋아요만, 못잰것: missing };
}

function 남김(all, seen, fol, now) {
  const base = { 키: '남김', 이름: '본 사람이 팔로워로 남는가' };
  const last = fol.at(-1), first = fol.find(f => last && last.t - f.t >= 6 * DAY && now - f.t <= (기준.창일수 + 7) * DAY) || null;
  // 게시물마다 팔로우를 잰 값이 있으면 그것이 가장 정확하다
  const withFollows = seen.filter(p => num(p.v.follows)), fv = sum(withFollows.map(p => p.v.views));
  let gain, views, span;
  if (withFollows.length >= 3 && fv >= 기준.남김.조회최소) { gain = sum(withFollows.map(p => p.v.follows)); views = fv; span = `${withFollows.length}편에서`; }
  else if (묵은팔로워(fol, now)) return { ...base, 판정: '모름', 값: '', 글: 묵음글(fol) };
  else if (first) {
    gain = last.n - first.n;
    views = num(last.views) && num(first.views) && last.views >= first.views ? last.views - first.views
      : sum(all.filter(p => p.t >= first.t && p.t <= last.t + DAY).map(p => p.v.views));
    span = `${Math.round((last.t - first.t) / DAY)}일 동안`;
  } else return { ...base, 판정: '모름', 값: '', 글: '팔로워 수를 7일 넘게 사이를 두고 두 번 재면 보입니다.' };
  if (gain >= 기준.남김.수상한수 && (views <= 0 || gain / views * 1000 >= 기준.남김.수상함)) {
    return { ...base, 판정: '나쁨', 값: `+${fmt(gain)}명`, 수상함: true, 늘어난: gain, 조회: views,
      글: `${span} 조회는 ${fmt(views)}번인데 팔로워가 ${fmt(gain)}명 늘었습니다. 편을 보지 않고 따라온 팔로워일 수 있습니다(이벤트, 맞팔, 구매). 이런 팔로워는 다음 편을 보지 않습니다.` };
  }
  if (views < 기준.남김.조회최소) return { ...base, 판정: '모름', 값: gain ? `${gain > 0 ? '+' : ''}${fmt(gain)}명` : '', 글: `${span} 조회가 ${fmt(views)}번이라 비율을 내기에 적습니다.` };
  const per = gain / views * 1000, 판정 = grade(per, 기준.남김);
  const 글 = `${span} 조회 ${fmt(views)}번에 팔로워가 ${gain >= 0 ? fmt(gain) + '명 늘었습니다' : fmt(-gain) + '명 줄었습니다'}.`
    + (판정 === '나쁨' ? ' 보기만 하고 따라오지 않습니다.' : 판정 === '좋음' ? ' 본 사람이 따라옵니다.' : '');
  return { ...base, 판정, 값: `1,000번에 ${one(Math.max(per, 0))}명`, 글, 비율: per, 늘어난: gain, 조회: views };
}

/** 같은 나이의 조회. 72시간 값을 가진 편이 여섯 넘으면 그것으로, 아니면 24시간 값으로 견준다 */
function 같은나이(all) {
  for (const point of ['72h', '24h']) {
    const rows = all.filter(p => num(p.points?.[point]?.views)).map(p => ({ p, views: p.points[point].views }));
    if (rows.length >= 기준.흐름.편수 * 2) return { point, rows };
  }
  return null;
}

function 흐름(all) {
  const base = { 키: '흐름', 이름: '오르는가 내리는가' };
  const same = 같은나이(all);
  if (!same) return { ...base, 판정: '모름', 값: '', 글: `같은 나이에 잰 편이 ${기준.흐름.편수 * 2}편 넘게 쌓이면 보입니다.` };
  const n = Math.min(5, Math.floor(same.rows.length / 2));
  const recent = median(same.rows.slice(-n).map(r => r.views)), before = median(same.rows.slice(-2 * n, -n).map(r => r.views));
  const age = same.point === '72h' ? '올린 지 사흘째' : '올린 지 하루째';
  if (Math.max(recent, before) < 기준.흐름.조회최소) return { ...base, 판정: '모름', 값: '', 글: `최근 ${n}편이 ${fmt(recent)}번, 그 앞 ${n}편이 ${fmt(before)}번이라 견주기에 적습니다.` };
  if (!before) return { ...base, 판정: '좋음', 값: `0 → ${fmt(recent)}`, 글: `최근 ${n}편의 ${age} 조회가 ${fmt(recent)}번이고, 그 앞 ${n}편은 0번이었습니다. 오르고 있습니다.` };
  const r = recent / before, 판정 = grade(r, 기준.흐름);
  const 글 = `최근 ${n}편의 ${age} 조회는 ${fmt(recent)}번, 그 앞 ${n}편은 ${fmt(before)}번입니다.`
    + (판정 === '나쁨' ? ' 식고 있습니다.' : 판정 === '좋음' ? ' 오르고 있습니다.' : ' 비슷합니다.');
  return { ...base, 판정, 값: `그 앞의 ${times(r)}`, 글, 비율: r, 최근: recent, 앞: before, 편수: n };
}

function 쏠림(seen) {
  const base = { 키: '쏠림', 이름: '한 편에 기대는가' };
  const views = seen.map(p => p.v.views), total = sum(views), mid = median(views);
  if (seen.length < 기준.표본편수 || total < 기준.표본조회) return { ...base, 판정: '모름', 값: '', 글: '편이 더 쌓이면 보입니다.' };
  const top = seen.reduce((a, b) => (b.v.views > a.v.views ? b : a)), share = top.v.views / total, mult = mid > 0 ? top.v.views / mid : Infinity;
  const 판정 = share >= 기준.쏠림.나쁨몫 && mult >= 기준.쏠림.나쁨배수 ? '나쁨' : mult <= 기준.쏠림.좋음배수 ? '좋음' : '보통';
  const name = top.title ? `가장 잘된 편(「${top.title}」)` : '가장 잘된 편';
  const 글 = 판정 === '나쁨' ? `조회의 ${pct(share)}가 ${name}에서 나왔습니다. 보통 편은 ${fmt(mid)}번입니다. 그 한 편이 다시 나올지는 아직 모릅니다.`
    : 판정 === '좋음' ? `${name}이 보통 편의 ${times(mult)}입니다. 편마다 고르게 나옵니다.`
      : `${name}이 보통 편의 ${times(mult)}이고 조회의 ${pct(share)}를 차지합니다.`;
  return { ...base, 판정, 값: `한 편이 ${pct(share)}`, 글, 몫: share, 배수: mult, 잘된편: top.title || null };
}

function 꾸준함(all, now) {
  const base = { 키: '꾸준함', 이름: '꾸준히 올리는가' };
  if (!all.length) return { ...base, 판정: '모름', 값: '', 글: '올린 편이 없습니다.' };
  const since = Math.floor((now - all.at(-1).t) / DAY), lately = all.filter(p => now - p.t <= 기준.꾸준함.좋음기간 * DAY).length;
  const 판정 = since > 기준.꾸준함.나쁨 ? '나쁨' : lately >= 기준.꾸준함.좋음편수 ? '좋음' : '보통';
  const 글 = since > 기준.꾸준함.나쁨 ? `마지막으로 올린 지 ${since}일이 지났습니다.` : `지난 ${기준.꾸준함.좋음기간}일 동안 ${lately}편을 올렸습니다.`;
  return { ...base, 판정, 값: since > 기준.꾸준함.나쁨 ? `${since}일 쉼` : `2주에 ${lately}편`, 글, 쉰날: since, 최근편수: lately };
}

function 붙잡음(seen) {
  const base = { 키: '붙잡음', 이름: '처음에 붙잡는가' };
  for (const [key, rule] of Object.entries(기준.붙잡음)) {
    const rows = seen.filter(p => num(p.v[key]));
    if (rows.length < 3) continue;
    const vals = rows.map(p => p.v[key]).sort((a, b) => a - b), mid = median(vals), 판정 = grade(mid, rule);
    // 이 계정의 편 절반이 드는 띠. 고정된 선만 보이면 거의 모든 계정이 나쁨으로 보이므로, 내 편끼리의 자리도 함께 말한다
    const band = vals.length >= 6 ? [vals[Math.floor(vals.length * 0.25)], vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.75))]] : null;
    const 글 = `${rule.이름}이 ${rows.length}편에서 보통 ${Math.round(mid)}%입니다.`
      + (band && Math.round(band[1]) > Math.round(band[0]) ? ` 편에 따라 ${Math.round(band[0])}%에서 ${Math.round(band[1])}% 사이를 오갑니다.` : '')
      + (판정 === '나쁨' ? (rule.첫장면 ? ' 첫 장면에서 놓칩니다.' : ' 보다가 나갑니다.') : 판정 === '좋음' ? (rule.첫장면 ? ' 첫 장면이 붙잡습니다.' : ' 끝까지 붙잡습니다.') : '');
    return { ...base, 이름: rule.첫장면 ? base.이름 : '끝까지 붙잡는가', 판정, 값: `${Math.round(mid)}%`, 글, 지표: key, 가운데: mid, 띠: band, 첫장면: !!rule.첫장면 };
  }
  return { ...base, 판정: '모름', 값: '', 글: '넘기지 않고 본 비율은 플랫폼의 통계 화면에만 나옵니다. 세 편 넘게 읽어 넣으면 보입니다.' };
}

/** 앞에는 평소대로 나오다가 마지막 편들이 잇달아 아주 적게 나오면 막힌 것을 의심한다 */
function 막힘(all) {
  const same = 같은나이(all), { 앞편수, 앞가운데, 연속, 비율 } = 기준.막힘;
  if (!same || same.rows.length < 앞편수 + 연속) return null;
  const tail = same.rows.slice(-연속), before = median(same.rows.slice(0, -연속).slice(-10).map(r => r.views));
  if (!(before >= 앞가운데) || !tail.every(r => r.views <= before * 비율)) return null;
  return { 앞: before, 뒤: median(tail.map(r => r.views)), 연속 };
}

/* ── 유형과 처방 ── */

const 처방글 = {
  닿음: s => `팔로워 수를 늘리는 일(이벤트, 맞팔, 구매)은 멈춥니다. 지금 팔로워가 처음 따라온 주제로 세 편을 올리고, 한 편의 조회가 팔로워의 ${pct(s.좋음선)}를 넘는지 봅니다. 플랫폼은 팔로워 수가 아니라 본 사람의 반응으로 다음 노출을 정합니다.`,
  // 평균에서 가장 먼 반응 하나를 짚어, 그 반응을 부르는 장치를 처방한다
  깊이: (s, ctx) => {
    const HOW = {
      shares: ['공유', '다음 세 편에는 친구에게 보낼 까닭을 한 가지씩 넣습니다. 「이거 너 얘기야」 하고 보낼 만한 한 장면이나, 보는 사람이 바로 써먹을 한 줄입니다.'],
      saves: ['저장', '다음 세 편에는 저장할 까닭을 한 가지씩 넣습니다. 다시 볼 목록, 순서, 표처럼 한 번 보고 외울 수 없는 것입니다.'],
      comments: ['댓글', '다음 세 편은 한 낱말로 답할 수 있는 물음으로 끝냅니다. 둘 가운데 하나를 고르게 하면 가장 쉽습니다. 달린 댓글에는 그날 답합니다.'],
    };
    const weak = 약한반응(s);
    if (!weak) return '다음 세 편에는 보낼 까닭이나 저장할 까닭을 한 가지씩 넣습니다.';
    // 그 반응이 가장 많이 나온 이 계정의 편을 본보기로 짚는다
    const model = 본보기(ctx?.seen, weak, 1)[0], WHY = { shares: '보내게', saves: '저장하게', comments: '말을 걸게' };
    if (model && model.value >= 2) HOW[weak][1] += ` 이 계정에서 ${HOW[weak][0]}${weak === 'shares' ? '가' : '이'} 가장 많이 나온 편은 「${model.title}」(${fmt(model.value)}번)입니다. 그 편의 무엇이 ${WHY[weak]} 했는지 보고 다음 편에 넣습니다.`;
    return `${s.좋아요만 ? '좋아요는 받는데 보내거나 말을 걸지 않습니다. ' : ''}${HOW[weak][0]}${weak === 'shares' ? '가' : '이'} 평균의 ${pct(s.비율[weak] / s.선[weak])}입니다. ${HOW[weak][1]}`;
  },
  남김: s => (s.수상함 ? '팔로워를 늘리는 이벤트나 맞팔을 멈추고, 늘어난 팔로워가 다음 편을 보는지 2주 동안 봅니다.' : '끝 장면에서 다음 편을 예고하고, 프로필 첫 줄에 이 계정을 따라오면 무엇을 받는지 한 문장으로 적습니다. 같은 틀의 편을 이어 올려 따라올 까닭을 만듭니다.'),
  흐름: (s, ctx) => `최근 편이 그 앞보다 덜 나옵니다. ${ctx.best ? `가장 잘된 「${ctx.best}」의 주제와 첫 장면으로 돌아가 두 편을 만들고` : '가장 잘된 편의 주제와 첫 장면으로 돌아가 두 편을 만들고'}, 최근에 바꾼 것(주제, 길이, 올리는 시각)을 하나씩 되돌려 봅니다.`,
  쏠림: s => `${s.잘된편 ? `「${s.잘된편}」` : '잘된 한 편'}의 주제와 첫 2초를 그대로 두고 두 편을 더 만듭니다. 다시 되면 그것이 이 계정의 틀입니다.`,
  꾸준함: s => (s.쉰날 > 기준.꾸준함.나쁨 ? `${s.쉰날}일을 쉬었습니다. 일주일에 두 편부터 다시 올립니다. 쉬는 동안의 숫자로는 계정을 판단하지 않습니다.` : '일주일에 두 편 넘게 올려 견줄 편을 쌓습니다.'),
  // 이 계정에서 그 비율이 가장 높았던 편 둘을 본보기로 짚는다. 「뻔한 조언」이 되지 않게, 따라 할 것이 그 사람의 편 안에 있어야 한다
  붙잡음: (s, ctx) => {
    const top = 본보기(ctx?.seen, s.지표, 2).filter(m => m.value > s.가운데 + 5);
    const model = top.length ? ` 이 계정에서 가장 잘 붙잡은 편은 ${top.map(m => `「${m.title}」(${Math.round(m.value)}%)`).join(', ')}입니다. ${top.length > 1 ? '그 편들' : '그 편'}의 ${s.첫장면 ? '첫 2초를' : '길이와 흐름을'} 다음 편의 틀로 씁니다.` : '';
    return s.첫장면
      ? `${ctx?.soft ? '' : '첫 장면에서 넘깁니다. '}첫 2초에 결과나 가장 센 장면을 먼저 보이고, 인사와 로고는 뒤로 보냅니다.${model}`
      : `${ctx?.soft ? '' : '보다가 나갑니다. '}편을 지금의 3분의 2 길이로 줄이고, 가운데에 다음 장면을 볼 까닭(물음, 반전 예고)을 하나 넣습니다.${model}`;
  },
};
/** 이 계정에서 그 숫자가 가장 높았던 편들. 조회가 아주 적은 편은 우연이 커서 뺀다 */
function 본보기(seen, key, n) {
  const floor = Math.max(50, (median((seen || []).map(p => p.v.views)) || 0) * 0.3);
  return (seen || []).filter(p => p.title && num(p.v[key]) && p.v.views >= floor).sort((a, b) => b.v[key] - a.v[key]).slice(0, n).map(p => ({ title: p.title, value: p.v[key] }));
}
const 유지글 = {
  깊이: '본 사람의 반응이 이 계정의 힘입니다. 주제와 말투를 바꾸지 않습니다.',
  닿음: '팔로워 밖으로 퍼지고 있습니다. 지금 올리는 틀을 유지합니다.',
  남김: '본 사람이 따라옵니다. 끝 장면과 프로필을 그대로 둡니다.',
  흐름: '오르는 중입니다. 지금 간격으로 계속 올립니다.',
  붙잡음: '끝까지 붙잡습니다. 지금 편의 첫 장면과 길이를 다음 편에도 씁니다.',
};

/* ── 사용자 눈의 세부 분석(11-19 유호님 「더 디테일하게 사용자입장에서 뭐가 문제인지 분석해줬으면 좋겠어」) ──
   조회 1,000번이 어디서 줄어드는지, 잘된 편과 안 된 편이 무엇이 다른지, 무엇을 잘하고 있는지, 다음 목표가 무엇인지를 낸다.
   말하는 순서는 잘하고 있는 것이 먼저다(같은 날 「지금처럼 긍정적인 방향으로 해주는게맞고」). */

const 반응이름 = { shares: '공유', saves: '저장', comments: '댓글' };
const midOf = (posts, key) => { const a = posts.filter(p => num(p.v[key])).map(p => p.v[key]); return a.length >= 3 ? median(a) : null; };
/** 무게를 곱한 모자람이 가장 큰 반응 */
function 약한반응(s) {
  if (!s.비율) return null;
  // 공유가 선의 절반 아래면 공유부터다. 세 플랫폼 모두 보내기를 낯선 사람에게 퍼지는 신호로 밝혔다
  if (s.비율.shares != null && s.비율.shares < s.선.shares * 0.5) return 'shares';
  const lack = k => 기준.깊이.무게[k] * (1 - Math.min(s.비율[k] / s.선[k], 1));
  return Object.keys(반응이름).filter(k => s.비율[k] != null).sort((a, b) => lack(b) - lack(a))[0] || null;
}

/** 1,000번에 한 명이 안 되면 「0.1명」 대신 몇 번 보여야 한 명인지로 말한다 */
const 몇명 = n => (n >= 1 ? `${one(n)}명이` : n > 0 ? `${fmt(Math.round(1000 / n / 100) * 100)}번 보여야 한 명이` : '아직 아무도');

/** 조회 1,000번이 가는 길. 단계마다 { 키, 이름, 명, 글, 판정, 신호 }이고 재지 못한 단계는 없다 */
function 길(S, seen) {
  const steps = [], B = 기준.붙잡음;
  const firstKey = ['stayedToWatchPct', 'earlyRetention3sPct'].find(k => midOf(seen, k) != null);
  if (firstKey) {
    const v = midOf(seen, firstKey);
    steps.push({ 키: '첫장면', 이름: '첫 장면', 명: v * 10, 글: `${fmt(v * 10)}명이 ${firstKey === 'stayedToWatchPct' ? '넘기지 않고 봅니다' : '3초 넘게 봅니다'}`, 판정: grade(v, B[firstKey]), 신호: '붙잡음' });
  }
  const end = midOf(seen, 'completionRatePct'), avp = midOf(seen, 'averageViewPct');
  if (end != null) steps.push({ 키: '끝까지', 이름: '끝까지', 명: end * 10, 글: `${fmt(end * 10)}명이 끝까지 봅니다`, 판정: grade(end, B.completionRatePct), 신호: '붙잡음' });
  else if (avp != null) steps.push({ 키: '끝까지', 이름: '보는 길이', 명: null, 큰: `${Math.round(avp)}%`, 글: `본 사람은 평균해서 편의 ${Math.round(avp)}%를 봅니다`, 판정: grade(avp, B.averageViewPct), 신호: '붙잡음' });
  if (S.깊이.비율) {
    // 셋째 말은 아무도 하지 않았을 때 쓴다(「아직 아무도 … 댓글을 달지 않습니다」)
    const ACT = { shares: ['보내', '보냅니다', '보내지 않습니다'], saves: ['저장하', '저장합니다', '저장하지 않습니다'], comments: ['댓글을 달', '댓글을 답니다', '댓글을 달지 않습니다'] };
    const keys = Object.keys(ACT).filter(k => S.깊이.비율[k] != null);
    if (keys.length) {
      const n = sum(keys.map(k => S.깊이.비율[k]));
      steps.push({ 키: '반응', 이름: '반응', 명: n, 글: `${몇명(n)} ${keys.map((k, i) => (i < keys.length - 1 ? ACT[k][0] + '거나' : ACT[k][n > 0 ? 1 : 2])).join(' ')}`, 판정: S.깊이.판정, 신호: '깊이' });
    }
  }
  if (num(S.남김.비율) && !S.남김.수상함) {
    const n = Math.max(S.남김.비율, 0);
    steps.push({ 키: '팔로우', 이름: '팔로우', 명: n, 글: `${몇명(n)} ${n > 0 ? '팔로우합니다' : '팔로우하지 않습니다'}`, 판정: S.남김.판정, 신호: '남김' });
  }
  return steps;
}

/** 길에서 가장 먼저 나쁜 단계. 앞에서 떠난 사람은 뒤의 숫자에 들 수 없으므로 앞 단계부터 고친다 */
function 새는곳(steps) {
  if (!steps.length) return { 단계: null, 신호: null, 글: '' };
  const leak = steps.find(s => s.판정 === '나쁨');
  if (!leak) {
    // 새는 곳이 없으면 더 올릴 수 있는 곳(가장 앞의 보통 단계)을 짚는다
    const next = steps.find(s => s.판정 === '보통');
    const WHAT = { 첫장면: '첫 장면에서 남는 사람', 끝까지: '끝까지 보는 사람', 반응: '반응', 팔로우: '팔로우' };
    return { 단계: null, 신호: null, 올릴곳: next ? WHAT[next.키] : null, 올릴신호: next ? next.신호 : null,
      글: next ? `크게 새는 곳은 없습니다. 다음으로 올릴 것은 ${WHAT[next.키]}입니다.` : '잰 단계마다 평균을 넘습니다. 새는 곳이 없습니다.' };
  }
  const later = steps.indexOf(leak) < steps.length - 1;
  const 글 = leak.키 === '첫장면' ? `가장 먼저 새는 곳은 첫 장면입니다. 조회 1,000번 가운데 ${fmt(1000 - leak.명)}번은 첫 장면에서 넘어갑니다.${later ? ` 그 뒤의 숫자는 남은 ${fmt(leak.명)}명에게서만 나옵니다.` : ''}`
    : leak.키 === '끝까지' ? `가장 먼저 새는 곳은 끝까지 보기입니다. ${leak.명 != null ? `1,000명 가운데 ${fmt(leak.명)}명만 끝까지 봅니다.` : '보기 시작한 사람이 일찍 나갑니다.'}`
      : leak.키 === '반응' ? '보는 데까지는 오는데 반응으로 이어지지 않습니다. 가장 먼저 새는 곳은 반응입니다.'
        : '반응까지는 오는데 팔로우로 이어지지 않습니다. 가장 먼저 새는 곳은 팔로우입니다.';
  return { 단계: leak.키, 신호: leak.신호, 글 };
}

/** 잘된 편과 안 된 편을 같은 나이의 조회로 가르고, 두 묶음의 숫자가 어디서 다른지 본다 */
function 대조(all, seen) {
  const same = 같은나이(all), inSeen = new Set(seen);
  const rows = same ? same.rows.filter(r => inSeen.has(r.p)) : [];
  if (rows.length < 6) return null;
  const n = rows.length >= 9 ? 3 : 2, sorted = [...rows].sort((a, b) => b.views - a.views);
  const top = sorted.slice(0, n).map(r => r.p), low = sorted.slice(-n).map(r => r.p);
  const tv = median(sorted.slice(0, n).map(r => r.views)), lv = median(sorted.slice(-n).map(r => r.views));
  const names = ps => { const t = ps.map(p => p.title).filter(Boolean); return t.length ? `(${t.map(x => `「${x}」`).join(', ')}${t.length < ps.length ? ' 등' : ''})` : ''; };
  const age = same.point === '72h' ? '올린 지 사흘째에' : '올린 지 하루째에';
  const head = `잘된 ${n}편${names(top)}은 ${age} ${fmt(tv)}번, 안 된 ${n}편${names(low)}은 ${fmt(lv)}번입니다.`;
  const out = { 잘된: top.map(p => p.title || null), 안된: low.map(p => p.title || null), 잘된조회: tv, 안된조회: lv, 차이: null };
  if (!(tv >= Math.max(lv, 1) * 2)) return { ...out, 글: `${head} 편마다 조회가 비슷해 두 묶음을 가를 만큼 차이가 나지 않습니다.` };
  const two = key => { const a = top.filter(p => num(p.v[key])).map(p => p.v[key]), b = low.filter(p => num(p.v[key])).map(p => p.v[key]); return a.length >= 2 && b.length >= 2 ? [median(a), median(b)] : null; };
  // 첫 장면 → 보는 길이 → 반응 순으로, 처음 눈에 띄게 다른 것을 말한다
  for (const key of ['stayedToWatchPct', 'earlyRetention3sPct', 'completionRatePct', 'averageViewPct']) {
    const v = two(key); if (!v || Math.abs(v[0] - v[1]) < 10) continue;
    const nm = 기준.붙잡음[key].이름, first = 기준.붙잡음[key].첫장면;
    const 글 = v[0] > v[1] ? `${head} 잘된 편은 ${nm}이 ${Math.round(v[0])}%이고 안 된 편은 ${Math.round(v[1])}%입니다. 조회의 차이가 ${first ? '첫 장면' : '끝까지 붙잡는 힘'}에서 납니다.`
      : `${head} ${nm}은 잘된 편이 ${Math.round(v[0])}%로 안 된 편(${Math.round(v[1])}%)보다 낮습니다. 넓게 퍼질수록 관심이 덜한 사람에게도 보이기 때문이라, ${first ? '첫 장면' : '길이'}의 탓으로 보지 않습니다.`;
    return { ...out, 차이: { 지표: key, 잘된: v[0], 안된: v[1] }, 글 };
  }
  const deep = ps => { const keys = Object.keys(반응이름), w = ps.filter(p => keys.some(k => num(p.v[k]))), V = sum(w.map(p => p.v.views)); return V >= 기준.표본조회 ? sum(w.map(p => sum(keys.map(k => p.v[k] || 0)))) / V * 1000 : null; };
  const d = [deep(top), deep(low)];
  if (d[0] != null && d[1] != null && Math.abs(d[0] - d[1]) >= 1 && Math.max(d[0], d[1]) >= Math.min(d[0], d[1]) * 1.5) {
    const 글 = d[0] > d[1] ? `${head} 조회 1,000번마다 공유, 저장, 댓글이 잘된 편은 ${one(d[0])}번, 안 된 편은 ${one(d[1])}번입니다. 반응이 나온 편이 더 멀리 갔습니다.`
      : `${head} 조회 1,000번마다 공유, 저장, 댓글은 안 된 편이 ${one(d[1])}번으로 잘된 편(${one(d[0])}번)보다 많습니다. 적게 보였지만 본 사람에게는 더 맞았던 편입니다.`;
    return { ...out, 차이: { 지표: '반응', 잘된: d[0], 안된: d[1] }, 글 };
  }
  return { ...out, 글: `${head} 첫 장면과 반응의 숫자는 두 묶음이 비슷합니다. 차이는 주제에서 나는 것으로 보입니다. 두 묶음의 제목을 견줘 보세요.` };
}

/** 반응이 몇 편에서 나왔는지. 한두 편에 몰렸는지, 편마다 나오는지를 본다 */
function 고름(seen) {
  const parts = [];
  for (const [k, nm] of Object.entries(반응이름)) {
    const w = seen.filter(p => num(p.v[k])); if (w.length < 5) continue;
    parts.push(`${nm}${k === 'shares' ? '가' : '이'} 나온 편은 ${w.length}편 가운데 ${w.filter(p => p.v[k] > 0).length}편`);
  }
  return parts.length ? `${parts.join(', ')}입니다.` : '';
}

/** 편에 갈래(group)가 붙어 있으면 갈래마다의 조회를 견준다. 갈래는 쓰는 사람이 붙인 이름이다(시리즈, 주제) */
function 갈래(all, seen) {
  const same = 같은나이(all), inSeen = new Set(seen), g = {};
  for (const r of same ? same.rows : []) if (inSeen.has(r.p) && r.p.group) (g[r.p.group] ??= []).push(r.views);
  const list = Object.entries(g).filter(([, a]) => a.length >= 3).map(([k, a]) => ({ k, mid: median(a), n: a.length })).sort((a, b) => b.mid - a.mid);
  if (list.length < 2 || !(list[0].mid >= Math.max(list.at(-1).mid, 1) * 1.5)) return '';
  return `갈래로 나누면 ${list.map(x => `「${x.k}」 ${x.n}편은 한 편에 ${fmt(x.mid)}번`).join(', ')}입니다. 「${list[0].k}」 편이 가장 잘 나옵니다.`;
}

/** 잘하고 있는 것. 좋은 신호를 무게 순으로 셋까지, 없으면 선에 가장 가까운 반응을 말한다 */
function 강점(S, order, all, said = null) {
  return [강점신호(S, order.filter(k => k !== said), !!said), 최근잘된편(all)].filter(Boolean).join(' ');
}
/** 최근 다섯 편 가운데 이 계정의 보통 편보다 눈에 띄게 잘된 편. 인스타그램의 「최근 평균보다 잘되고 있어요」 알림처럼 칭찬과 숫자와 다음 행동을 함께 말한다 */
function 최근잘된편(all) {
  const same = 같은나이(all || []); if (!same || same.rows.length < 6) return '';
  const typical = median(same.rows.map(r => r.views)), top = same.rows.slice(-5).reduce((a, b) => (b.views > a.views ? b : a));
  if (!(typical > 0) || top.views < typical * 1.2 || !top.p.title) return '';
  const r = top.views / typical;
  return `최근 편 가운데 「${top.p.title}」${r >= 2 ? `은(는) 이 계정의 보통 편의 ${times(r)}` : `은(는) 이 계정의 보통 편보다 ${pct(r - 1)} 더`} 나왔습니다. 이런 편을 더 만듭니다.`.replace('은(는)', ' 편이');
}
function 강점신호(S, order, saidOne = false) {
  if (saidOne && !order.some(k => S[k].판정 === '좋음')) return ''; // 좋은 숫자는 결론이 이미 말했다
  const WORD = { 깊이: `본 사람이 ${S.깊이.한일 || '반응합니다'}`, 닿음: S.닿음.비율 >= 1 ? '팔로워 밖의 사람에게 퍼집니다' : '팔로워가 편을 챙겨 봅니다', 남김: '본 사람이 팔로워로 남습니다',
    흐름: '조회가 오르고 있습니다', 붙잡음: S.붙잡음.첫장면 ? '첫 장면이 붙잡습니다' : '끝까지 붙잡습니다', 쏠림: '한 편에 기대지 않고 편마다 고르게 나옵니다', 꾸준함: '꾸준히 올립니다' };
  const good = order.filter(k => S[k].판정 === '좋음');
  if (good.length) return good.slice(0, 3).map(k => WORD[k]).join('. ') + '.';
  const r = S.깊이.비율, near = r && Object.keys(반응이름).filter(k => r[k] != null).sort((a, b) => r[b] / S.깊이.선[b] - r[a] / S.깊이.선[a])[0];
  return near && r[near] > 0 ? `아직 평균을 넘은 숫자는 없습니다. 평균에 가장 가까운 것은 ${반응이름[near]}입니다(평균의 ${pct(r[near] / S.깊이.선[near])}).` : '';
}

/** 다음 목표. 맨 앞 할 일의 신호에서, 나쁨이면 나쁨을 벗어나는 숫자를, 보통이면 선을 목표로 준다 */
function 목표(S, lead) {
  if (lead === '붙잡음' && num(S.붙잡음.가운데)) {
    const rule = 기준.붙잡음[S.붙잡음.지표], now = Math.round(S.붙잡음.가운데), line = S.붙잡음.가운데 < rule.나쁨 ? rule.나쁨 : rule.좋음;
    // 선이 멀면 이 계정의 잘된 편들이 이미 내는 숫자(위 25%)를 먼저 목표로 준다. 닿을 수 있는 목표여야 한다
    const own = S.붙잡음.띠 ? Math.round(S.붙잡음.띠[1]) : null;
    if (own != null && own > now + 2 && own < line) return `다음 세 편의 목표는 ${rule.이름} ${own}%입니다(지금 ${now}%). 이 계정의 잘된 편들이 이미 내는 숫자입니다. 그다음은 ${line}%입니다.`;
    return `다음 세 편의 목표는 ${rule.이름} ${line}%입니다(지금 ${now}%).`;
  }
  if (lead === '깊이') {
    const k = 약한반응(S.깊이); if (!k) return '';
    const now = S.깊이.비율[k], line = S.깊이.선[k], to = now < line * 기준.깊이.나쁨 ? line * 기준.깊이.나쁨 : line;
    return `다음 세 편의 목표는 조회 1,000번마다 ${반응이름[k]} ${one(to)}번입니다(지금 ${one(now)}번).`;
  }
  if (lead === '남김' && num(S.남김.비율) && !S.남김.수상함) {
    const now = Math.max(S.남김.비율, 0), to = now < 기준.남김.나쁨 ? 기준.남김.나쁨 : 기준.남김.좋음;
    return `다음 2주의 목표는 조회 1,000번마다 팔로워 ${to}명입니다(지금 ${one(now)}명).`;
  }
  if (lead === '닿음' && num(S.닿음.비율)) return `다음 세 편의 목표는 한 편의 조회가 팔로워의 ${pct(S.닿음.좋음선)}를 넘는 것입니다(지금 ${pct(S.닿음.비율)}).`;
  if (lead === '흐름' && num(S.흐름.앞) && S.흐름.판정 === '나쁨') return `다음 세 편의 목표는 그 앞 편들의 조회 ${fmt(S.흐름.앞)}번입니다(지금 ${fmt(S.흐름.최근)}번).`;
  return '';
}

/**
 * 계정 하나를 진단한다.
 * @returns {{ key, name, platform, 상태, 유형, 결론, 신호:[…], 처방:[글], 점수:number|null, 편수, 팔로워:number|null, 조회가운데:number|null, 막힘 }}
 */
function 진단(account, now = Date.now()) {
  const { all, seen } = 본편들(account.posts, now, account.ownComments), fol = 팔로워기록(account.followers);
  const head = { key: account.key, name: account.name || account.key, platform: account.platform || '', 편수: seen.length, 팔로워: fol.at(-1)?.n ?? null, 팔로워잰때: fol.at(-1)?.t ?? null, 조회가운데: median(seen.map(p => p.v.views)) };
  const steady = 꾸준함(all, now);
  if (seen.length < 기준.표본편수) {
    const stopped = steady.쉰날 > 기준.꾸준함.멈춤;
    return { ...head, 상태: 상태이름.이름, 유형: stopped ? '멈춘 계정' : '아직 이른 계정', 점수: null, 막힘: null, 신호: [steady],
      결론: stopped ? `마지막으로 올린 지 ${steady.쉰날}일이 지났고, 볼 편이 ${seen.length}편뿐입니다.` : `숫자를 잰 편이 ${seen.length}편입니다. ${기준.표본편수}편이 쌓이면 진단합니다.`,
      처방: [stopped ? 처방글.꾸준함(steady) : `올린 지 하루가 지난 편이 ${기준.표본편수}편 쌓일 때까지는 조회수로 판단하지 않습니다. 같은 틀로 계속 올립니다.`] };
  }
  const S = { 닿음: 닿음(seen, fol, now), 깊이: 깊이(seen, head.platform, all.own), 남김: 남김(all, seen, fol, now), 흐름: 흐름(all), 쏠림: 쏠림(seen), 꾸준함: steady, 붙잡음: 붙잡음(seen) };
  const W = 무게(head.platform);
  const blocked = 막힘(all), views = sum(seen.map(p => p.v.views));
  if (views < 기준.표본조회) {
    return { ...head, 상태: 상태이름.이름, 유형: '아직 노출이 시작되지 않은 계정', 점수: null, 막힘: null, 신호: [steady],
      결론: `${seen.length}편을 올렸는데 조회 합이 ${fmt(views)}번입니다. 반응을 잴 만큼 본 사람이 없습니다.`,
      처방: ['편이 좋고 나쁜지를 따질 때가 아니라 노출이 시작되지 않은 것입니다. 플랫폼의 계정 상태 화면에 제한이 있는지 보고, 프로필(이름, 소개, 사진, 나라와 말)을 채웁니다. 제한이 없으면 같은 틀로 열 편까지 올린 뒤 다시 봅니다.'] };
  }
  let score = 0, weight = 0;
  for (const [k, s] of Object.entries(S)) if (s.판정 !== '모름') { weight += W[k]; score += W[k] * (s.판정 === '좋음' ? 1 : s.판정 === '나쁨' ? -1 : 0); }
  const 점수 = weight >= 기준.아는무게 ? score / weight : null;
  let 상태 = 점수 == null ? 상태이름.이름 : 점수 >= 기준.점수.건강 ? 상태이름.건강 : 점수 <= 기준.점수.나쁨 ? 상태이름.나쁨 : 상태이름.주의;
  const is = (k, v) => S[k].판정 === v, worse = to => { if (상태 === 상태이름.건강 || to === 상태이름.나쁨) 상태 = to; };
  const best = S.쏠림.잘된편 || seen.reduce((a, b) => (b.v.views > a.v.views ? b : a)).title || null;
  let 유형, 결론, 말한 = null; // 말한: 결론이 이미 말한 좋은 신호. 「잘하고 있는 것」에서 되풀이하지 않는다
  if (blocked) {
    유형 = '갑자기 닿지 않게 된 계정'; 상태 = 상태이름.나쁨;
    결론 = `평소 ${fmt(blocked.앞)}번 나오던 조회가 마지막 ${blocked.연속}편에서 ${fmt(blocked.뒤)}번으로 떨어졌습니다. 편의 문제보다 계정이 막혔을 수 있습니다.`;
  } else if (is('닿음', '나쁨') && S.닿음.팔로워 >= 기준.껍데기팔로워) {
    유형 = '팔로워만 큰 계정'; 상태 = is('깊이', '좋음') ? 상태이름.주의 : 상태이름.나쁨;
    결론 = S.닿음.글 + (is('깊이', '좋음') ? ' 그래도 본 사람의 반응은 좋습니다.' : '');
  } else if (S.남김.수상함) {
    유형 = '팔로워가 조회보다 빨리 느는 계정'; worse(상태이름.주의);
    결론 = S.남김.글;
  } else if (steady.쉰날 > 기준.꾸준함.멈춤) {
    유형 = '멈춘 계정'; worse(상태이름.주의);
    결론 = `마지막으로 올린 지 ${steady.쉰날}일이 지났습니다. 아래 숫자는 쉬기 전의 편으로 잰 것입니다.`;
  } else if (is('쏠림', '나쁨')) {
    유형 = '한 편에 기대는 계정'; worse(상태이름.주의);
    결론 = S.쏠림.글;
  } else if (is('깊이', '좋음') && !is('흐름', '나쁨')) {
    const growing = is('흐름', '좋음') || is('남김', '좋음');
    유형 = growing ? '반응이 진하고 자라는 계정' : '반응이 진한 계정'; 말한 = '깊이';
    if (상태 === 상태이름.나쁨) 상태 = 상태이름.주의;
    // 반응은 좋은데 다른 신호가 걸려 「건강함」이 아니면, 걸리는 것을 결론에서 말한다
    const BUT = { 붙잡음: S.붙잡음.첫장면 ? '첫 장면에서 넘기는 사람이 많습니다' : '끝까지 보는 사람이 적습니다', 남김: '본 사람이 팔로워로 남지 않습니다', 닿음: '팔로워에게는 잘 닿지 않습니다', 꾸준함: '올리는 간격이 뜹니다' };
    const but = Object.keys(BUT).filter(k => is(k, '나쁨')).map(k => BUT[k]);
    결론 = `한 편의 조회는 ${fmt(head.조회가운데)}번쯤입니다. ${S.깊이.요약} `
      + (상태 !== 상태이름.건강 && but.length ? `다만 ${but[0]}.` : growing ? '반응이 좋은 채로 자라고 있습니다.' : '조회수의 크기와 상관없이 건강한 계정입니다.');
  } else if (is('붙잡음', '나쁨')) {
    // 길의 앞 단계가 먼저다. 붙잡지 못해 떠난 사람은 반응도 팔로우도 할 수 없으므로, 반응이 적어도 여기를 유형으로 부른다
    유형 = S.붙잡음.첫장면 ? '첫 장면에서 놓치는 계정' : '끝까지 붙잡지 못하는 계정'; worse(is('깊이', '나쁨') && is('남김', '나쁨') ? 상태이름.나쁨 : 상태이름.주의);
    결론 = `${S.붙잡음.글} ${is('깊이', '나쁨') ? '남아서 본 사람의 반응도 적지만, 붙잡는 것부터 고칩니다.' : is('깊이', '모름') ? '' : '남아서 본 사람의 반응은 나쁘지 않습니다.'}`.trim();
  } else if (S.깊이.좋아요만) {
    유형 = '좋아요만 받는 계정'; worse(is('깊이', '나쁨') && is('남김', '나쁨') ? 상태이름.나쁨 : 상태이름.주의);
    결론 = `한 편의 조회는 ${fmt(head.조회가운데)}번쯤입니다. ${S.깊이.요약}`;
  } else if (is('깊이', '나쁨')) {
    유형 = '보고 지나가는 계정'; worse(is('남김', '나쁨') ? 상태이름.나쁨 : 상태이름.주의);
    결론 = `한 편의 조회는 ${fmt(head.조회가운데)}번쯤입니다. ${S.깊이.요약}`;
  } else if (is('남김', '나쁨')) {
    // 길의 마지막 단계. 보고 반응까지는 하는데 따라오지 않는다
    유형 = '팔로우로 이어지지 않는 계정'; worse(상태이름.주의);
    결론 = S.남김.글;
  } else if (is('흐름', '나쁨')) {
    유형 = '식어 가는 계정'; worse(상태이름.주의);
    결론 = S.흐름.글;
  } else if (is('흐름', '좋음')) {
    유형 = '자라는 계정'; 말한 = '흐름';
    결론 = S.흐름.글;
  } else {
    유형 = '고른 계정';
    // 가장 무거운 좋은 숫자를 결론으로 말한다. 「나쁜 것이 없다」만으로는 무엇이 좋은지 알 수 없다
    const g = Object.keys(S).sort((a, b) => W[b] - W[a]).find(k => is(k, '좋음') && k !== '꾸준함' && k !== '쏠림');
    if (g) 말한 = g;
    결론 = g ? `${S[g].글} 눈에 띄게 나쁜 숫자는 없습니다.` : 상태 === 상태이름.건강 ? '눈에 띄게 나쁜 숫자가 없고 편마다 고르게 나옵니다.' : '크게 나쁜 숫자는 없지만 평균을 뚜렷하게 넘는 숫자도 아직 없습니다.';
  }
  // 처방: 나쁜 신호를 무게 순으로 셋까지. 좋은 신호가 있으면 지킬 것 하나를 끝에 붙인다
  const order = Object.keys(S).sort((a, b) => W[b] - W[a]);
  const 처방 = [];
  if (blocked) 처방.push('플랫폼 앱의 계정 상태 화면을 엽니다(인스타그램은 설정의 「계정 상태」, 틱톡은 「계정 확인」). 제한이나 경고가 있으면 그 편을 지우거나 이의를 냅니다. 없으면 일주일 동안 평소 틀로 두 편만 올리고 조회가 돌아오는지 봅니다.');
  // 유형을 정한 신호의 처방이 맨 앞이다
  const lead = { '팔로워만 큰 계정': '닿음', '팔로워가 조회보다 빨리 느는 계정': '남김', '멈춘 계정': '꾸준함', '한 편에 기대는 계정': '쏠림', '식어 가는 계정': '흐름',
    '좋아요만 받는 계정': '깊이', '보고 지나가는 계정': '깊이', '팔로우로 이어지지 않는 계정': '남김', '첫 장면에서 놓치는 계정': '붙잡음', '끝까지 붙잡지 못하는 계정': '붙잡음' }[유형];
  const act = k => S[k].판정 === '나쁨' || (k === '깊이' && S.깊이.좋아요만);
  for (const k of [lead, ...order.filter(k => k !== lead)]) if (k && act(k) && 처방.length < 3) 처방.push(처방글[k](S[k], { best, seen }));
  // 잘된 편과 안 된 편의 차이가 숫자로 드러났으면, 그 신호가 나쁨이 아니어도 그것을 할 일로 준다. 이 계정의 편이 알려 준 것이다
  const cmp = 대조(all, seen), gap = cmp?.차이 && cmp.차이.잘된 > cmp.차이.안된 ? cmp.차이 : null;
  if (gap && 처방.length < 3) {
    const sig = gap.지표 === '반응' ? '깊이' : '붙잡음';
    if (!act(sig) && S[sig].판정 !== '모름' && (sig === '깊이' || S.붙잡음.지표 === gap.지표)) {
      const what = sig === '깊이' ? '반응이 나온' : S.붙잡음.첫장면 ? '첫 장면이 붙잡은' : '끝까지 붙잡은';
      처방.push(`이 계정에서는 ${what} 편이 멀리 갔습니다. ${처방글[sig](S[sig], { best, seen, soft: true })}`);
    }
  }
  const keep = order.find(k => S[k].판정 === '좋음' && 유지글[k]);
  if (keep && 처방.length < 3) 처방.push(유지글[keep]);
  const steps = 길(S, seen), leak = 새는곳(steps);
  // 고칠 것이 없는 계정에는 더 올릴 수 있는 곳의 할 일을 하나 준다. 건강한 계정도 다음에 무엇을 할지 알아야 한다
  const grow = !blocked && !order.some(k => act(k)) && leak.올릴신호 && S[leak.올릴신호].판정 === '보통' ? leak.올릴신호 : null;
  if (grow && 처방.length < 3) 처방.push(`더 올릴 수 있는 곳은 ${leak.올릴곳}입니다. ${처방글[grow](S[grow], { best, seen, soft: true })}`);
  if (!처방.length) 처방.push('지금 틀로 계속 올리고 2주 뒤에 다시 봅니다.');
  const 세부 = { 강점: 강점(S, order, all, 말한), 뺀편: all.뺀편 || 0, 길: steps, 새는곳: leak, 고름: 고름(seen), 대조: cmp, 갈래: 갈래(all, seen),
    목표: blocked ? '' : 목표(S, lead && act(lead) ? lead : order.find(k => act(k)) || grow) };
  return { ...head, 상태, 유형, 결론, 점수, 막힘: blocked, 신호: order.map(k => S[k]), 처방, 세부 };
}

/* ── 솔리오 방의 꼴. 방문자 분석(desktop/renderer/site-visits-model.mjs)과 같은 { say, then, when, scope, rows } ── */

const 순서 = [상태이름.나쁨, 상태이름.주의, 상태이름.건강, 상태이름.이름];
const 낱수 = n => (['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][n] || `${n}개`);

/** 이름이 많으면 앞의 열둘만 적고 나머지는 수로 말한다. 앱은 긴 글을 중간에서 자른다 */
const 이름묶음 = (names, max = 12) => (names.length > max ? `${names.slice(0, max).join(' · ')} 외 ${names.length - max}개` : names.join(' · '));

/**
 * 솔리오 방의 꼴. PC 앱에 설치된 판이 이 꼴을 읽는다(desktop/renderer/sns-health-model.mjs) — 줄 꼴의 이름, 칸의 차례,
 * 길의 단계 열쇠(이름 · 명 · 큰 · 글 · 판정 · 샘)를 바꾸면 옛 앱에서 그 줄이 말없이 빠진다. 바꾸기 전에
 * desktop/tests/fixtures/sns-health-summary-v1.json과 tests/계정건강.test.js의 계약 시험을 본다.
 */
function 방(list, { now = Date.now(), 모은때 = '' } = {}) {
  const sorted = [...list].sort((a, b) => 순서.indexOf(a.상태) - 순서.indexOf(b.상태) || (b.조회가운데 || 0) - (a.조회가운데 || 0));
  const count = s => sorted.filter(d => d.상태 === s).length;
  const judged = sorted.filter(d => d.상태 !== 상태이름.이름), bad = count(상태이름.나쁨), watch = count(상태이름.주의), good = count(상태이름.건강);
  // 받침이 있으면 앞의 것, 없으면 뒤의 것(하나가 · 둘이 · 11개가)
  const josa = (word, a, b) => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? a : b);
  const N = 낱수(judged.length), G = 낱수(good), B = 낱수(bad), W = 낱수(watch);
  // 건강한 계정부터 말한다(11-19 유호님 「긍정적인 방향으로」)
  const say = !judged.length ? '아직 진단할 만큼 숫자가 쌓인 계정이 없습니다.'
    : good === judged.length ? `진단한 계정 ${N}${josa(N, '이', '가')} 모두 건강합니다.`
      : good ? `진단한 계정 ${N} 가운데 ${G}${josa(G, '이', '가')} 건강합니다.`
        : `진단한 계정 ${N} 가운데 아직 건강한 계정은 없습니다.`;
  const first = sorted.find(d => d.상태 === 상태이름.나쁨) || sorted.find(d => d.상태 === 상태이름.주의);
  const then = first ? `${bad ? `${B}${josa(B, '은', '는')} 건강하지 않습니다. ` : watch ? `${W}${josa(W, '은', '는')} 지켜봅니다. ` : ''}${first.name}부터 봅니다. ${first.유형}입니다.`
    : good ? '조회수의 크기가 아니라 본 사람의 반응으로 판단했습니다.' : '';
  const early = sorted.filter(d => d.상태 === 상태이름.이름);
  const rows = judged.map(d => ({
    key: d.key, nm: d.name, mid: d.유형, val: d.상태,
    when: [d.팔로워 != null ? `팔로워 ${fmt(d.팔로워)}` : '', d.조회가운데 != null ? `한 편 ${fmt(d.조회가운데)}번` : ''].filter(Boolean).join(' · '),
    now: d.상태 === 상태이름.나쁨 ? 1 : 0, unread: d.상태 === 상태이름.이름 ? 1 : 0,
    // 안쪽의 순서: 결론 → 잘하고 있는 것 → 조회 1,000번이 가는 길 → 잘된 편과 안 된 편 → 신호 → 할 일과 목표
    more: [['say', d.결론],
      ...(d.세부?.강점 ? [['good', '잘하고 있는 것', d.세부.강점]] : []),
      ...(d.세부?.길.length ? [['head', '조회 1,000번이 가는 길'], ['flow', d.세부.길.map(s => ({ 이름: s.이름, 명: s.명, 큰: s.큰 || null, 글: s.글, 판정: s.판정, 샘: s.키 === d.세부.새는곳.단계 })), [d.세부.새는곳.글, d.세부.고름].filter(Boolean).join(' ')]] : []),
      ...(d.세부?.대조 ? [['head', '잘된 편과 안 된 편'], ['text', [d.세부.대조.글, d.세부.갈래].filter(Boolean).join(' ')]] : []),
      ['head', '숫자로 본 일곱 가지'],
      ...d.신호.filter(s => s.판정 !== '모름').map(s => ['row', s.이름, s.글, s.판정, s.값, s.판정 === '나쁨' ? 1 : 0]),
      ...d.처방.map((p, i) => ['do', d.처방.length > 1 ? `할 일 ${i + 1}` : '할 일', p]),
      ...(d.세부?.목표 ? [['goal', '다음 목표', d.세부.목표]] : []),
      ...(d.신호.some(s => s.판정 === '모름') ? [['note', '재지 못한 것: ' + d.신호.filter(s => s.판정 === '모름').map(s => `${s.이름}(${s.글})`).join(' ')]] : []),
      ...(d.세부?.뺀편 ? [['note', `형식이 다른 ${d.세부.뺀편}편은 숫자의 뜻이 달라 견주지 않았습니다.`]] : [])],
  }));
  // 아직 판단하지 않는 계정은 한 줄로 묶고, 안쪽에 유형마다 이름을 적는다
  if (early.length) {
    const kinds = [...new Set(early.map(d => d.유형))];
    rows.push({ key: 'early', nm: '아직 이른 계정', mid: '숫자가 더 쌓이면 진단합니다.', val: `${early.length}개`, when: '', now: 0, unread: 1,
      more: [['say', '조회수만으로는 판단하지 않습니다. 올린 지 하루가 지난 편이 다섯 넘게 쌓이고, 그 조회 합이 300번을 넘으면 진단합니다.'],
        ...kinds.map(k => { const of = early.filter(d => d.유형 === k); return ['row', k, 이름묶음(of.map(d => d.name)), `${of.length}개`, '', 0]; }),
        ...kinds.map(k => ['do', k, early.find(d => d.유형 === k).처방[0]])] });
  }
  return { say, then, when: 모은때, scope: `진단 ${judged.length} · 아직 이른 계정 ${early.length}`, rows };
}

module.exports = { 진단, 방, 기준, 상태이름, 게시물값, median };

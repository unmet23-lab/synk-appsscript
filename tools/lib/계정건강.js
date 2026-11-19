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
  표본편수: 5,          // 이보다 적으면 판단하지 않는다
  표본조회: 300,        // 본 편들의 조회 합이 이보다 적으면 비율을 내지 않는다
  // 한 편의 조회(가운데 값) ÷ 팔로워. 계정이 클수록 이 비율은 낮아지므로 크기별로 본다.
  // 좋음은 같은 크기 계정의 평균쯤, 나쁨은 그 3분의 1 아래다(Socialinsider 릴스 · 틱톡 규모별 평균, README 「기준 숫자」)
  닿음: { 팔로워최소: 100, 구간: [{ 까지: 5000, 나쁨: 0.05, 좋음: 0.2 }, { 까지: 50000, 나쁨: 0.03, 좋음: 0.1 }, { 까지: Infinity, 나쁨: 0.015, 좋음: 0.06 }] },
  껍데기팔로워: 500,    // 닿음이 나쁠 때 「팔로워만 큰 계정」으로 부르는 팔로워 수
  깊이: {               // 조회 1,000번마다. 잰 반응만 더하고 기준도 잰 것만 더한다. 나쁨은 좋음의 30%
    좋음: { comments: 2, shares: 5, saves: 3 }, 나쁨비율: 0.3,
    좋아요: { 나쁨: 10, 좋음: 40 },
  },
  남김: { 조회최소: 2000, 나쁨: 0.5, 좋음: 3, 수상함: 100, 수상한수: 100 }, // 조회 1,000번마다 늘어난 팔로워
  흐름: { 편수: 3, 조회최소: 30, 나쁨: 0.6, 좋음: 1.3 },            // 최근 편 가운데 값 ÷ 그 앞 편 가운데 값(같은 나이)
  쏠림: { 나쁨몫: 0.5, 나쁨배수: 10, 좋음배수: 4 },     // 가장 잘된 편이 조회 합에서 차지하는 몫, 가운데 값의 몇 배인지
  꾸준함: { 멈춤: 21, 나쁨: 14, 좋음편수: 3, 좋음기간: 14 },
  붙잡음: {             // 플랫폼 화면에서만 나오는 값. 있는 것 가운데 위에서부터 하나를 쓴다
    stayedToWatchPct: { 이름: '넘기지 않고 본 비율', 나쁨: 55, 좋음: 70, 첫장면: true },
    earlyRetention3sPct: { 이름: '3초 넘게 본 비율', 나쁨: 40, 좋음: 60, 첫장면: true },
    averageViewPct: { 이름: '평균 시청 비율', 나쁨: 50, 좋음: 80 },
    completionRatePct: { 이름: '끝까지 본 비율', 나쁨: 10, 좋음: 30 },
  },
  막힘: { 앞편수: 5, 앞가운데: 200, 연속: 3, 비율: 0.2 },
  무게: { 깊이: 3, 닿음: 2, 흐름: 2, 남김: 2, 붙잡음: 2, 쏠림: 1, 꾸준함: 1 },
  아는무게: 4,          // 잰 신호의 무게 합이 이보다 작으면 상태를 말하지 않는다
  점수: { 건강: 0.25, 나쁨: -0.3 },
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

function 본편들(posts, now) {
  const all = (posts || []).filter(p => Number.isFinite(when(p)) && when(p) <= now)
    .map(p => ({ ...p, v: 게시물값(p), t: when(p) })).filter(p => num(p.v.views)).sort((a, b) => a.t - b.t);
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

function 닿음(seen, fol) {
  const base = { 키: '닿음', 이름: '팔로워에게 닿는가' };
  const last = fol.at(-1);
  if (!last) return { ...base, 판정: '모름', 값: '', 글: '팔로워 수를 잰 적이 없습니다.' };
  if (last.n < 기준.닿음.팔로워최소) return { ...base, 판정: '모름', 값: `팔로워 ${fmt(last.n)}명`, 글: `팔로워가 ${기준.닿음.팔로워최소}명 아래라 팔로워 대비로는 보지 않습니다. 이 크기에서는 조회 대부분이 팔로워 밖에서 옵니다.` };
  const mid = median(seen.map(p => p.v.views)), r = mid / last.n;
  const rule = 기준.닿음.구간.find(g => last.n < g.까지), 판정 = grade(r, rule);
  const 글 = 판정 === '나쁨' ? `팔로워는 ${fmt(last.n)}명인데 한 편을 보는 사람은 ${fmt(mid)}명꼴입니다. 팔로워 대부분이 이 계정의 편을 보지 않습니다.`
    : r >= 1 ? `한 편의 조회가 팔로워 수의 ${times(r)}입니다. 팔로워 밖의 사람에게 퍼지고 있습니다.`
      : `한 편을 팔로워의 ${pct(r)}쯤이 봅니다.`;
  return { ...base, 판정, 값: `팔로워의 ${r >= 1 ? times(r) : pct(r)}`, 글, 비율: r, 팔로워: last.n, 가운데조회: mid, 좋음선: rule.좋음 };
}

function 깊이(seen) {
  const base = { 키: '깊이', 이름: '본 사람이 반응하는가' };
  const views = sum(seen.map(p => p.v.views));
  if (views < 기준.표본조회) return { ...base, 판정: '모름', 값: '', 글: `조회 합이 ${fmt(views)}번이라 비율을 내기에 적습니다.` };
  const NAME = { shares: '공유', saves: '저장', comments: '댓글' };
  const VERB = { comments: ['말을 걸', '말을 겁니다'], shares: ['보내', '보냅니다'], saves: ['저장하', '저장합니다'] };
  let got = 0, good = 0; const parts = [], missing = [], strong = [];
  for (const key of Object.keys(NAME)) {
    // 그 반응을 잰 편만 모아서, 그 편들의 조회로 나눈다
    const with_ = seen.filter(p => num(p.v[key])), v = sum(with_.map(p => p.v.views));
    if (!with_.length || v < 기준.표본조회) { missing.push(NAME[key]); continue; }
    const per = sum(with_.map(p => p.v[key])) / v * 1000;
    got += per; good += 기준.깊이.좋음[key]; parts.push(`${NAME[key]} ${one(per)}`);
    if (per >= 기준.깊이.좋음[key]) strong.push(VERB[key]);
  }
  const liked = seen.filter(p => num(p.v.likes)), lv = sum(liked.map(p => p.v.views));
  const likes = liked.length && lv >= 기준.표본조회 ? sum(liked.map(p => p.v.likes)) / lv * 1000 : null;
  if (!parts.length) return { ...base, 판정: '모름', 값: '', 글: '댓글, 공유, 저장을 잰 값이 없습니다.', 좋아요: likes };
  const 판정 = got >= good ? '좋음' : got < good * 기준.깊이.나쁨비율 ? '나쁨' : '보통';
  const 좋아요만 = 판정 === '나쁨' && likes != null && likes >= 기준.깊이.좋아요.좋음;
  // 기준을 넘은 반응만 말한다: 「보내고 저장합니다」
  const did = strong.length ? strong.map((w, i) => (i < strong.length - 1 ? w[0] + '고' : w[1])).join(' ') : '반응합니다';
  const 요약 = `조회 1,000번마다 ${parts.join(' · ')}번입니다.` + (판정 === '좋음' ? ` 본 사람이 ${did}.` : 판정 === '나쁨' ? (좋아요만 ? ' 좋아요만 누르고 지나갑니다.' : ' 보고 지나갑니다.') : '');
  const 글 = 요약 + (likes == null ? '' : ` 좋아요는 ${one(likes)}번입니다.`) + (missing.length ? ` 재지 못해 뺀 반응: ${missing.join(', ')}.` : '');
  return { ...base, 판정, 값: `1,000번에 ${one(got)}번`, 글, 요약, 깊은반응: got, 좋음선: good, 좋아요: likes, 좋아요만, 못잰것: missing };
}

function 남김(all, seen, fol, now) {
  const base = { 키: '남김', 이름: '본 사람이 팔로워로 남는가' };
  const last = fol.at(-1), first = fol.find(f => last && last.t - f.t >= 6 * DAY && now - f.t <= (기준.창일수 + 7) * DAY) || null;
  // 게시물마다 팔로우를 잰 값이 있으면 그것이 가장 정확하다
  const withFollows = seen.filter(p => num(p.v.follows)), fv = sum(withFollows.map(p => p.v.views));
  let gain, views, span;
  if (withFollows.length >= 3 && fv >= 기준.남김.조회최소) { gain = sum(withFollows.map(p => p.v.follows)); views = fv; span = `${withFollows.length}편에서`; }
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
    const mid = median(rows.map(p => p.v[key])), 판정 = grade(mid, rule);
    const 글 = `${rule.이름}이 ${rows.length}편의 가운데 값으로 ${Math.round(mid)}%입니다.`
      + (판정 === '나쁨' ? (rule.첫장면 ? ' 첫 장면에서 놓칩니다.' : ' 보다가 나갑니다.') : 판정 === '좋음' ? (rule.첫장면 ? ' 첫 장면이 붙잡습니다.' : ' 끝까지 붙잡습니다.') : '');
    return { ...base, 이름: rule.첫장면 ? base.이름 : '끝까지 붙잡는가', 판정, 값: `${Math.round(mid)}%`, 글, 지표: key, 가운데: mid, 첫장면: !!rule.첫장면 };
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
  깊이: s => (s.좋아요만 ? '좋아요는 받는데 보내거나 저장하지 않습니다. ' : '') + '다음 세 편에는 보낼 까닭이나 저장할 까닭을 한 가지씩 넣습니다. 친구에게 보낼 만한 한 장면, 다시 볼 목록이나 순서, 댓글로 답할 물음 가운데 하나입니다.',
  남김: s => (s.수상함 ? '팔로워를 늘리는 이벤트나 맞팔을 멈추고, 늘어난 팔로워가 다음 편을 보는지 2주 동안 봅니다.' : '끝 장면에서 다음 편을 예고하고, 프로필 첫 줄에 이 계정을 따라오면 무엇을 받는지 한 문장으로 적습니다. 같은 틀의 편을 이어 올려 따라올 까닭을 만듭니다.'),
  흐름: (s, ctx) => `최근 편이 그 앞보다 덜 나옵니다. ${ctx.best ? `가장 잘된 「${ctx.best}」의 주제와 첫 장면으로 돌아가 두 편을 만들고` : '가장 잘된 편의 주제와 첫 장면으로 돌아가 두 편을 만들고'}, 최근에 바꾼 것(주제, 길이, 올리는 시각)을 하나씩 되돌려 봅니다.`,
  쏠림: s => `${s.잘된편 ? `「${s.잘된편}」` : '잘된 한 편'}의 주제와 첫 2초를 그대로 두고 두 편을 더 만듭니다. 다시 되면 그것이 이 계정의 틀입니다.`,
  꾸준함: s => (s.쉰날 > 기준.꾸준함.나쁨 ? `${s.쉰날}일을 쉬었습니다. 일주일에 두 편부터 다시 올립니다. 쉬는 동안의 숫자로는 계정을 판단하지 않습니다.` : '일주일에 두 편 넘게 올려 견줄 편을 쌓습니다.'),
  붙잡음: s => (s.첫장면 ? '첫 장면에서 넘깁니다. 첫 2초에 결과나 가장 센 장면을 먼저 보이고, 인사와 로고는 뒤로 보냅니다. 다음 세 편에서 이 비율이 오르는지 봅니다.'
    : '보다가 나갑니다. 편을 지금의 3분의 2 길이로 줄이고, 가운데에 다음 장면을 볼 까닭(물음, 반전 예고)을 하나 넣습니다. 다음 세 편에서 이 비율이 오르는지 봅니다.'),
};
const 유지글 = {
  깊이: '본 사람의 반응이 이 계정의 힘입니다. 주제와 말투를 바꾸지 않습니다.',
  닿음: '팔로워 밖으로 퍼지고 있습니다. 지금 올리는 틀을 유지합니다.',
  남김: '본 사람이 따라옵니다. 끝 장면과 프로필을 그대로 둡니다.',
  흐름: '오르는 중입니다. 지금 간격으로 계속 올립니다.',
  붙잡음: '끝까지 붙잡습니다. 지금 편의 첫 장면과 길이를 다음 편에도 씁니다.',
};

/**
 * 계정 하나를 진단한다.
 * @returns {{ key, name, platform, 상태, 유형, 결론, 신호:[…], 처방:[글], 점수:number|null, 편수, 팔로워:number|null, 조회가운데:number|null, 막힘 }}
 */
function 진단(account, now = Date.now()) {
  const { all, seen } = 본편들(account.posts, now), fol = 팔로워기록(account.followers);
  const head = { key: account.key, name: account.name || account.key, platform: account.platform || '', 편수: seen.length, 팔로워: fol.at(-1)?.n ?? null, 조회가운데: median(seen.map(p => p.v.views)) };
  const steady = 꾸준함(all, now);
  if (seen.length < 기준.표본편수) {
    const stopped = steady.쉰날 > 기준.꾸준함.멈춤;
    return { ...head, 상태: 상태이름.이름, 유형: stopped ? '멈춘 계정' : '아직 이른 계정', 점수: null, 막힘: null, 신호: [steady],
      결론: stopped ? `마지막으로 올린 지 ${steady.쉰날}일이 지났고, 볼 편이 ${seen.length}편뿐입니다.` : `숫자를 잰 편이 ${seen.length}편입니다. ${기준.표본편수}편이 쌓이면 진단합니다.`,
      처방: [stopped ? 처방글.꾸준함(steady) : `올린 지 하루가 지난 편이 ${기준.표본편수}편 쌓일 때까지는 조회수로 판단하지 않습니다. 같은 틀로 계속 올립니다.`] };
  }
  const S = { 닿음: 닿음(seen, fol), 깊이: 깊이(seen), 남김: 남김(all, seen, fol, now), 흐름: 흐름(all), 쏠림: 쏠림(seen), 꾸준함: steady, 붙잡음: 붙잡음(seen) };
  const blocked = 막힘(all), views = sum(seen.map(p => p.v.views));
  if (views < 기준.표본조회) {
    return { ...head, 상태: 상태이름.이름, 유형: '아직 노출이 시작되지 않은 계정', 점수: null, 막힘: null, 신호: [steady],
      결론: `${seen.length}편을 올렸는데 조회 합이 ${fmt(views)}번입니다. 반응을 잴 만큼 본 사람이 없습니다.`,
      처방: ['편이 좋고 나쁜지를 따질 때가 아니라 노출이 시작되지 않은 것입니다. 플랫폼의 계정 상태 화면에 제한이 있는지 보고, 프로필(이름, 소개, 사진, 나라와 말)을 채웁니다. 제한이 없으면 같은 틀로 열 편까지 올린 뒤 다시 봅니다.'] };
  }
  let score = 0, weight = 0;
  for (const [k, s] of Object.entries(S)) if (s.판정 !== '모름') { weight += 기준.무게[k]; score += 기준.무게[k] * (s.판정 === '좋음' ? 1 : s.판정 === '나쁨' ? -1 : 0); }
  const 점수 = weight >= 기준.아는무게 ? score / weight : null;
  let 상태 = 점수 == null ? 상태이름.이름 : 점수 >= 기준.점수.건강 ? 상태이름.건강 : 점수 <= 기준.점수.나쁨 ? 상태이름.나쁨 : 상태이름.주의;
  const is = (k, v) => S[k].판정 === v, worse = to => { if (상태 === 상태이름.건강 || to === 상태이름.나쁨) 상태 = to; };
  const best = S.쏠림.잘된편 || seen.reduce((a, b) => (b.v.views > a.v.views ? b : a)).title || null;
  let 유형, 결론;
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
    유형 = growing ? '반응이 진하고 자라는 계정' : '반응이 진한 계정';
    if (상태 === 상태이름.나쁨) 상태 = 상태이름.주의;
    결론 = `한 편의 조회는 ${fmt(head.조회가운데)}번쯤입니다. ${S.깊이.요약} ${growing ? '반응이 좋은 채로 자라고 있습니다.' : '조회수의 크기와 상관없이 건강한 계정입니다.'}`;
  } else if (is('깊이', '나쁨') && (S.닿음.비율 >= 1 || is('닿음', '모름'))) {
    유형 = S.깊이.좋아요만 ? '좋아요만 받는 계정' : '보고 지나가는 계정'; worse(is('남김', '나쁨') ? 상태이름.나쁨 : 상태이름.주의);
    결론 = `한 편의 조회는 ${fmt(head.조회가운데)}번쯤입니다. ${S.깊이.요약}`;
  } else if (is('흐름', '나쁨')) {
    유형 = '식어 가는 계정'; worse(상태이름.주의);
    결론 = S.흐름.글;
  } else if (is('흐름', '좋음')) {
    유형 = '자라는 계정';
    결론 = S.흐름.글;
  } else {
    유형 = '고른 계정';
    결론 = 상태 === 상태이름.건강 ? '눈에 띄게 나쁜 신호가 없고 편마다 고르게 나옵니다.' : '크게 나쁜 신호는 없지만 뚜렷하게 좋은 신호도 아직 없습니다.';
  }
  // 처방: 나쁜 신호를 무게 순으로 셋까지. 좋은 신호가 있으면 지킬 것 하나를 끝에 붙인다
  const order = Object.keys(S).sort((a, b) => 기준.무게[b] - 기준.무게[a]);
  const 처방 = [];
  if (blocked) 처방.push('플랫폼 앱의 계정 상태 화면을 엽니다(인스타그램은 설정의 「계정 상태」, 틱톡은 「계정 확인」). 제한이나 경고가 있으면 그 편을 지우거나 이의를 냅니다. 없으면 일주일 동안 평소 틀로 두 편만 올리고 조회가 돌아오는지 봅니다.');
  // 유형을 정한 신호의 처방이 맨 앞이다
  const lead = { '팔로워만 큰 계정': '닿음', '팔로워가 조회보다 빨리 느는 계정': '남김', '멈춘 계정': '꾸준함', '한 편에 기대는 계정': '쏠림', '식어 가는 계정': '흐름' }[유형];
  for (const k of [lead, ...order.filter(k => k !== lead)]) if (k && S[k].판정 === '나쁨' && 처방.length < 3) 처방.push(처방글[k](S[k], { best }));
  const keep = order.find(k => S[k].판정 === '좋음' && 유지글[k]);
  if (keep && 처방.length < 3) 처방.push(유지글[keep]);
  if (!처방.length) 처방.push('지금 틀로 계속 올리고 2주 뒤에 다시 봅니다.');
  return { ...head, 상태, 유형, 결론, 점수, 막힘: blocked, 신호: order.map(k => S[k]), 처방 };
}

/* ── 솔리오 방의 꼴. 방문자 분석(desktop/renderer/site-visits-model.mjs)과 같은 { say, then, when, scope, rows } ── */

const 순서 = [상태이름.나쁨, 상태이름.주의, 상태이름.건강, 상태이름.이름];
const 낱수 = n => (['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][n] || `${n}개`);

function 방(list, { now = Date.now(), 모은때 = '' } = {}) {
  const sorted = [...list].sort((a, b) => 순서.indexOf(a.상태) - 순서.indexOf(b.상태) || (b.조회가운데 || 0) - (a.조회가운데 || 0));
  const count = s => sorted.filter(d => d.상태 === s).length;
  const judged = sorted.filter(d => d.상태 !== 상태이름.이름), bad = count(상태이름.나쁨), watch = count(상태이름.주의), good = count(상태이름.건강);
  const say = !judged.length ? '아직 진단할 만큼 숫자가 쌓인 계정이 없습니다.'
    : bad ? `계정 ${낱수(judged.length)} 가운데 ${낱수(bad)}${bad === 1 ? '가' : '이'} 건강하지 않습니다.`
      : watch ? `건강하지 않은 계정은 없고, ${낱수(watch)}${/[나섯]$/.test(낱수(watch)) ? '를' : '을'} 지켜봐야 합니다.`
        : `진단한 계정 ${낱수(judged.length)}${judged.length === 1 ? '가' : '이'} 모두 건강합니다.`;
  const first = sorted.find(d => d.상태 === 상태이름.나쁨) || sorted.find(d => d.상태 === 상태이름.주의);
  const then = first ? `${first.name}부터 봅니다. ${first.유형}입니다.` : good ? '조회수의 크기가 아니라 본 사람의 반응으로 판단했습니다.' : '';
  const early = sorted.filter(d => d.상태 === 상태이름.이름);
  const rows = judged.map(d => ({
    key: d.key, nm: d.name, mid: d.유형, val: d.상태,
    when: [d.팔로워 != null ? `팔로워 ${fmt(d.팔로워)}` : '', d.조회가운데 != null ? `한 편 ${fmt(d.조회가운데)}번` : ''].filter(Boolean).join(' · '),
    now: d.상태 === 상태이름.나쁨 ? 1 : 0, unread: d.상태 === 상태이름.이름 ? 1 : 0,
    more: [['say', d.결론],
      ...d.신호.filter(s => s.판정 !== '모름').map(s => ['row', s.이름, s.글, s.판정, s.값]),
      ...d.처방.map((p, i) => ['do', d.처방.length > 1 ? `할 일 ${i + 1}` : '할 일', p]),
      ...(d.신호.some(s => s.판정 === '모름') ? [['note', '재지 못한 것: ' + d.신호.filter(s => s.판정 === '모름').map(s => `${s.이름}(${s.글})`).join(' ')]] : [])],
  }));
  // 아직 판단하지 않는 계정은 한 줄로 묶고, 안쪽에 유형마다 이름을 적는다
  if (early.length) {
    const kinds = [...new Set(early.map(d => d.유형))];
    rows.push({ key: 'early', nm: '아직 이른 계정', mid: '숫자가 더 쌓이면 진단합니다.', val: `${early.length}개`, when: '', now: 0, unread: 1,
      more: [['say', '조회수만으로는 판단하지 않습니다. 올린 지 하루가 지난 편이 다섯 넘게 쌓이고, 그 조회 합이 300번을 넘으면 진단합니다.'],
        ...kinds.map(k => { const of = early.filter(d => d.유형 === k); return ['row', k, of.map(d => d.name).join(' · '), `${of.length}개`, '']; }),
        ...kinds.map(k => ['do', k, early.find(d => d.유형 === k).처방[0]])] });
  }
  return { say, then, when: 모은때, scope: `진단 ${judged.length} · 아직 이름 ${early.length}`, rows };
}

module.exports = { 진단, 방, 기준, 상태이름, 게시물값, median };

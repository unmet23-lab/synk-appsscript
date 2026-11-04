// 오늘 만난 사람(설계 1-1절): 칸마다 다른 승객, 판마다 만남 1~2번. 시계에는 닿지 않는다 — 선물 · 도감 · 결과 사진이 보상이다.
// 발화 속 낱말이 답을 가르는 만남(직장인 · 여행객)만 듣기 근거다. 나머지는 장면만 봐도 고를 수 있어 재미(social)로만 남긴다.
// 말 · 대답 · 반응을 바꾸면 문항 판을 올리고 검수를 다시 탄다. 목소리 줄은 모두 이 표에서 나온다.
import { LINES, sayStation, 이에요 } from './lines.mjs';
import { rng } from './journeys.mjs';

const slug = (s) => ({ 충정로: 'chungjeongno', 시청: 'cityhall', 아현: 'ahyeon', 이대: 'ewha', 을지로입구: 'euljiro1', 을지로3가: 'euljiro3', 을지로4가: 'euljiro4', 종각: 'jonggak', 종로3가: 'jongno3', 종로5가: 'jongno5', 동대문: 'dongdaemun', 청량리: 'cheongnyangni', 명동: 'myeongdong', 인천공항: 'airport' })[s];

const line = (voice, role, text, say = text) => ({ voice, role, text, say });

export const CARS = Object.freeze({
  calm: { name: '한산한 칸', closed: 'car-calm', right: 'car-calm-right', left: 'car-calm-left' },
  rush: { name: '붐비는 칸', closed: 'car-rush', right: 'car-rush-right', left: 'car-rush-left' },
  concert: { name: '콘서트 칸', closed: 'car-concert', right: 'car-concert-right', left: 'car-concert-left' },
  hike: { name: '등산객 칸', closed: 'car-hike', right: 'car-hike-right', left: 'car-hike-left' },
});

export const PEOPLE = Object.freeze({
  worker: { name: '깜빡 잠든 직장인', car: 'rush', when: 'between', photo: 'person-worker', react: 'person-worker-react', memo: '「아이고, 감사합니다!」 하고 뛰어 내렸어요', gift: null },
  traveler: { name: '길 묻는 여행객', car: null, when: 'between', photo: 'person-traveler', react: 'person-traveler-react', memo: '내가 길을 알려 줬어요', gift: '여행 스티커' },
  fan: { name: '콘서트 가는 또래', car: 'concert', when: 'between', photo: 'person-fan', react: 'person-fan-react', memo: '「다음엔 같이 가요!」', gift: '응원봉 스티커' },
  grandma: { name: '귤 주시는 할머니', car: 'calm', when: 'between', photo: 'person-grandma', react: 'person-grandma-react', memo: '「밥은 먹고 다니지?」', gift: '귤 한 개' },
  hiker: { name: '문 앞의 등산객', car: 'hike', when: 'door', photo: 'person-hiker', react: 'person-hiker-react', memo: '「어이쿠, 미안해요!」', gift: null },
  freshman: { name: '뛰는 신입생', car: null, when: 'exit', photo: 'person-freshman', react: 'person-freshman-react', memo: '같이 뛰었어요', gift: null },
});

function socialScene(id) {
  const scenes = {
    fan: { ask: line('p-fan-ask', 'fan', '혹시 오늘 콘서트 가요?'), replies: [
      { id: 'school', text: '아니요, 학교 가요', reaction: line('p-fan-school', 'fan', '아쉽다! 다음엔 같이 가요!'), gift: true },
      { id: 'yes', text: '네, 가요!', reaction: line('p-fan-yes', 'fan', '진짜요? 자리 어디예요?') },
      { id: 'what', text: '무슨 콘서트요?', reaction: line('p-fan-what', 'fan', '몰라요? 오늘 난리 났어요!') } ] },
    grandma: { ask: line('p-grandma-ask', 'grandma', '아이고, 다리가 아프네.'), replies: [
      { id: 'sit', text: '여기 앉으세요', reaction: line('p-grandma-sit', 'grandma', '고마워, 학생. 밥은 먹고 다니지?'), gift: true },
      { id: 'next', text: '다음 역이에요', reaction: line('p-grandma-next', 'grandma', '그래, 고마워요.') },
      { id: 'me', text: '저도 아파요', reaction: line('p-grandma-me', 'grandma', '아이고, 젊은 사람이!') } ] },
    hiker: { ask: line('p-hiker-ask', 'hiker', '학생, 내려요?'), replies: [
      { id: 'yes', text: '네, 잠시만요', reaction: line('p-hiker-yes', 'hiker', '어이쿠, 미안해요!') },
      { id: 'no', text: '아니요, 타요', reaction: line('p-hiker-no', 'hiker', '응? 문 열렸는데?') },
      { id: 'hi', text: '안녕하세요', reaction: line('p-hiker-hi', 'hiker', '허허, 안녕!') } ] },
    freshman: { ask: line('p-freshman-ask', 'freshman', '혹시 OT 가요? 저도요!', '혹시 오티 가요? 저도요!'), replies: [
      { id: 'together', text: '네, 같이 가요', reaction: line('p-freshman-together', 'freshman', '좋아요! 뛰어요!'), gift: true },
      { id: 'first', text: '먼저 갈게요', reaction: line('p-freshman-first', 'freshman', '네! 이따 봐요!') },
      { id: 'hi', text: '안녕하세요', reaction: line('p-freshman-hi', 'freshman', '안녕하세요! 뛰어요!') } ] },
  };
  return scenes[id];
}
const shuffled = (r, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 다음 역 안내(실제 안내 꼴, 합쇼체) — 직장인 만남의 새 자극. */
export const nextStationLine = (station) => line(`next-${slug(station)}`, 'announcer', `다음 역은 ${station}입니다.`, `다음 역은 ${sayStation(station)}입니다.`);

// 다음 역의 오답: 같은 노선에서 길이가 가까운 역 둘(길이로 찍지 못하게). 판마다 같아 검수한 보기 그대로 나간다 — 자리만 섞는다.
const workerRoute = (on, next) => LINES[on].order.filter((n) => slug(n) && !['서울역', '시청'].includes(n) || n === next);
function workerScene(r, nextStation, on) {
  const others = workerRoute(on, nextStation).filter((s) => s !== nextStation).map((s, i) => [Math.abs(s.length - nextStation.length), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 2).map((x) => x[2]);
  const reply = (s, ok) => ({ id: slug(s), text: 이에요(s), right: ok, reaction: ok ? line('p-worker-thanks', 'worker', '아이고, 감사합니다!') : line('p-worker-huh', 'worker', '어? 아닌 것 같은데…') });
  return { lead: nextStationLine(nextStation), ask: line('p-worker-ask', 'worker', '어… 다음이 어디예요?'), replies: shuffled(r, [reply(nextStation, true), ...others.map((s) => reply(s, false))]), answer: slug(nextStation),
    item: { id: `meet.worker.${slug(nextStation)}`, family: `meet.worker.${slug(nextStation)}`, skillId: 'ko.listening.detail', difficulty: 1 } };
}
/** 방면 안내(실제 안내 꼴, 합쇼체) — 여행객 만남의 근거. */
export const directionLine = (place) => line(`lead-dir-${slug(place)}`, 'announcer', `이 열차는 ${place} 방면으로 갑니다. 명동이나 인천공항에 가실 분은 다른 노선을 이용해 주시기 바랍니다.`, `이 열차는 ${sayStation(place)} 방면으로 갑니다. 명동이나 인천공항에 가실 분은 다른 노선을 이용해 주시기 바랍니다.`);
function travelerScene(r, direction, asked = null) {
  // 묻는 곳 변형: 방금 안내한 방면이면 「네」, 아니면 「아니요」(명동 · 인천공항은 이 구간에 없다).
  const pool = [direction, '명동', '인천공항'];
  const place = asked || pool[Math.floor(r() * pool.length)], yes = place === direction;
  const replies = [
    { id: 'yes', text: `네, ${place}에 가요`, right: yes, reaction: yes ? line('p-traveler-thanks', 'traveler', '고마워요!') : line('p-traveler-huh', 'traveler', '아… 그래요? 다시 볼게요.') },
    { id: 'no', text: `아니요, ${place}에 안 가요`, right: !yes, reaction: yes ? line('p-traveler-huh', 'traveler', '아… 그래요? 다시 볼게요.') : line('p-traveler-thanks', 'traveler', '고마워요!') },
    { id: 'other', text: `네, ${yes ? '명동' : direction}에 가요`, right: false, reaction: line('p-traveler-first', 'traveler', '네? 어디라고요?') },
  ];
  return { lead: directionLine(direction), ask: line(`p-traveler-ask-${slug(place)}`, 'traveler', `저기요, 이 열차 ${place}에 가요?`, `저기요, 이 열차 ${sayStation(place)}에 가요?`), replies: shuffled(r, replies), answer: yes ? 'yes' : 'no',
    item: { id: `meet.traveler.${slug(direction)}.${slug(place)}`, family: `meet.traveler.${slug(place)}`, skillId: yes ? 'ko.listening.detail' : 'ko.listening.negation', difficulty: yes ? 1 : 2 } };
}

/**
 * 이번 판의 칸과 만남. available: 사진이 있는 칸 · 사람 목록. seen: 이미 만난 사람(처음 만나는 사람을 앞세운다).
 * 돌려줌 { cars: [앞 구간 칸, 뒤 구간 칸], meetings: [{ person, after(결정 번호), scene }] }.
 */
export function planDay(journey, { seed = journey.seed, available = {}, seen = [] } = {}) {
  const r = rng((seed ^ 0x5bd1e995) >>> 0);
  const carPool = (available.cars || Object.keys(CARS)).slice();
  const firstCar = carPool[Math.floor(r() * carPool.length)];
  const rest = carPool.filter((c) => c !== firstCar);
  const cars = [firstCar, rest.length ? rest[Math.floor(r() * rest.length)] : firstCar];
  const people = available.people || Object.keys(PEOPLE);
  const d = journey.decisions, stops = d.filter((x) => x.kind === 'stop').length;
  const want = stops >= 4 ? 2 : 1;
  // 만남 자리: 그 열차의 칸에 사는 사람만. between은 「그대로」 뒤(안내와 겹치지 않음, 다음 역이 있는 곳), door는 내릴 역, exit는 출구 뒤.
  const slots = [];
  d.forEach((x, i) => {
    if (x.kind === 'stop' && !x.target) {
      const next = d[i + 1];
      if (next?.kind === 'stop') for (const id of people) { const p = PEOPLE[id]; if (p.when === 'between' && (!p.car || p.car === cars[x.leg])) slots.push({ id, after: i, next: next.station, line: x.line, leg: x.leg }); }
    }
    if (x.kind === 'stop' && x.target) for (const id of people) { const p = PEOPLE[id]; if (p.when === 'door' && p.car === cars[x.leg]) slots.push({ id, after: i, line: x.line }); }
    if (x.kind === 'exit') for (const id of people) if (PEOPLE[id].when === 'exit') slots.push({ id, after: i });
  });
  const fresh = shuffled(r, slots).sort((a, b) => Number(seen.includes(a.id)) - Number(seen.includes(b.id)));
  const meetings = [], usedPeople = new Set(), usedAfter = new Set();
  for (const s of fresh) {
    if (meetings.length >= want) break;
    if (usedPeople.has(s.id) || usedAfter.has(s.after)) continue;
    usedPeople.add(s.id); usedAfter.add(s.after);
    let scene;
    if (s.id === 'worker') scene = workerScene(r, s.next, s.line);
    else if (s.id === 'traveler') scene = travelerScene(r, s.line === 1 ? '청량리' : s.leg === 0 ? '시청' : '을지로3가');
    else scene = { ...socialScene(s.id), replies: shuffled(r, socialScene(s.id).replies), answer: null, item: null };
    meetings.push({ person: s.id, after: s.after, scene });
  }
  meetings.sort((a, b) => a.after - b.after);
  return { cars, meetings };
}

// 직장인 만남이 나올 수 있는 다음 역과 그 노선(「그대로」 뒤에 다음 역이 있는 자리).
const WORKER_NEXT = Object.freeze([['아현', 2], ['충정로', 2], ['시청', 2], ['을지로입구', 2], ['을지로3가', 2], ['종로3가', 1], ['종로5가', 1], ['동대문', 1]]);
/** 근거로 세는 만남의 변형 전체(문항 검수의 원본). */
export function allMeetingItems() {
  const out = [], fake = rng(11);
  for (const [s, on] of WORKER_NEXT) {
    const w = workerScene(fake, s, on);
    out.push({ ...w, explanation: `방금 안내에서 「다음 역은 ${s}입니다」라고 했어요.` });
  }
  for (const direction of ['시청', '청량리', '을지로3가']) {
    out.push({ ...travelerScene(fake, direction, direction), explanation: `방금 안내에서 「${direction} 방면으로 갑니다」라고 했어요. 「네, ${direction}에 가요」로 대답해요. 명동은 다른 노선을 이용하라고 했어요.` });
    for (const place of ['명동', '인천공항']) out.push({ ...travelerScene(fake, direction, place), explanation: `방금 안내에서 「명동이나 인천공항에 가실 분은 다른 노선을 이용해 주시기 바랍니다」라고 했어요. ${place}에 가지 않으니 「아니요」로 대답해요.` });
  }
  return out;
}

/** 원고 전체(중복 없음) — 목소리 굽기 · 검수 · 시험이 읽는다. */
export function allPeopleLines() {
  const out = new Map(), add = (l) => { if (l && !out.has(l.voice)) out.set(l.voice, l); };
  for (const id of ['fan', 'grandma', 'hiker', 'freshman']) { const s = socialScene(id); add(s.ask); s.replies.forEach((x) => add(x.reaction)); }
  const fake = rng(7);
  for (const [s, on] of WORKER_NEXT) { const w = workerScene(fake, s, on); add(w.lead); add(w.ask); w.replies.forEach((x) => add(x.reaction)); }
  for (const place of ['시청', '청량리', '을지로3가']) add(directionLine(place));
  for (const place of ['시청', '청량리', '을지로3가', '명동', '인천공항']) add(line(`p-traveler-ask-${slug(place)}`, 'traveler', `저기요, 이 열차 ${place}에 가요?`, `저기요, 이 열차 ${sayStation(place)}에 가요?`));
  add(line('p-traveler-thanks', 'traveler', '고마워요!')); add(line('p-traveler-huh', 'traveler', '아… 그래요? 다시 볼게요.')); add(line('p-traveler-first', 'traveler', '네? 어디라고요?'));
  return [...out.values()];
}

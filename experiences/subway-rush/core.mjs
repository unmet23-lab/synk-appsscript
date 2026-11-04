// 환승 러시 판의 규칙(설계 1절) — 화면 없는 순수 모듈.
// · 안내가 끝나기 전에는 고를 수 없다. 손짓(choose) 없이는 답이 아니다. 고를 시간 제한은 없다.
// · 시계는 구간을 지날 때와 오답 · 빠른 환승으로만 움직인다. 듣는 동안 · 고르는 동안 · 도움 동안은 멈춘다(빨리 찍기를 보상하지 않는다).
// · 틀려도 늘 도착한다. 오답 뒤에는 쪽지 · 우회 컷을 지나 맞는 길로 잇고, 같은 자리를 다시 고르게 하지 않는다.
export const START_MINUTES = 8 * 60 + 41;
export const SCHOOL_MINUTES = 9 * 60;
export const LEG_MINUTES = Object.freeze({ stop: 2, fork: 1, exit: 1, board: 1, gate: 1 });
export const WRONG_MINUTES = 3;
export const STREAK_BONUS_AT = Object.freeze([3, 5]);
export const STREAK_BONUS = 1;

/** 시작 난도. 주소로 정한 판(level=busy, 시험 · 다시 보기) > 학생이 고른 난도 > 앱이 넘긴 시험 목표 급(3급 이상이면 바쁜 아침). 능력 판단이 아니라 어디서 시작할지만 정한다. */
export const startLevel = ({ forced = null, saved = null, grade = null } = {}) => forced === 'busy' ? 'busy' : saved === 'busy' || saved === 'basic' ? saved : Number(grade) >= 3 ? 'busy' : 'basic';

export const clockText = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

export class SubwayRun {
  constructor(journey) {
    this.journey = journey;
    this.index = 0;
    this.minutes = START_MINUTES;
    this.streak = 0; this.bestStreak = 0;
    this.heard = false;     // 지금 결정의 안내를 끝까지 들었는가
    this.finished = false;
    this.results = [];
    this.helps = new Set();
    this.notices = [];
  }
  get current() { return this.finished ? null : this.journey.decisions[this.index] || null; }
  get canChoose() { return !!this.current && this.heard; }
  get total() { return this.journey.decisions.length; }
  /** 안내를 끝까지 들었다. 소리가 끊겼으면 ok=false — 그 결정은 평가하지 않는다. */
  hearingDone(ok = true) { this.heard = true; if (!ok) this.audioFailed = true; }
  help(kind) { if (this.current) this.helps.add(kind); }
  /** 손짓 하나. 안내가 끝나기 전이면 null(아무 일도 없다). */
  choose(optionId) {
    const d = this.current;
    if (!d || !this.heard) return null;
    const option = d.options.find((o) => o.id === optionId);
    if (!option) throw new Error('보기에 없는 칸이에요.');
    const correct = optionId === d.answer;
    const assessable = d.assessable && !this.audioFailed;
    const helped = this.helps.size > 0;
    let bonus = 0, streakHit = 0;
    if (correct) {
      // 찍어도 맞는 칸(환승 말 없는 역의 그대로)은 연속에 세지 않는다.
      if (d.assessable) { this.streak += 1; this.bestStreak = Math.max(this.bestStreak, this.streak); if (STREAK_BONUS_AT.includes(this.streak)) { bonus = STREAK_BONUS; streakHit = this.streak; } }
      this.minutes += LEG_MINUTES[d.kind] - bonus;
    } else {
      this.streak = 0;
      this.minutes += LEG_MINUTES[d.kind] + WRONG_MINUTES;
    }
    const result = { id: d.id, kind: d.kind, station: d.station, chosen: optionId, answer: d.answer, correct, assessable, helped: [...this.helps], bonus, streakHit, cause: causeOf(d, optionId) };
    this.results.push(result);
    this.index += 1; this.heard = false; this.audioFailed = false; this.helps = new Set();
    if (this.index >= this.total) { this.minutes += LEG_MINUTES.gate; this.finished = true; }
    return result;
  }
  /** 결과 화면 값. 맞힌 수는 근거로 세는 결정만 분모로 둔다 — 찍어도 맞는 칸과 소리가 끊긴 문항은 뺀다(r.assessable). */
  summary() {
    const counted = this.results.filter((r) => r.assessable);
    const right = counted.filter((r) => r.correct).length;
    const stations = this.results.filter((r) => r.correct && r.kind !== 'exit').map((r) => r.station);
    return { arrive: this.minutes, arriveText: clockText(this.minutes), onTime: this.minutes <= SCHOOL_MINUTES, right, total: counted.length, bestStreak: this.bestStreak, stations: [...new Set(stations)], wrongs: this.results.filter((r) => !r.correct) };
  }
}

/** 틀린 까닭(기록 분석 칸 · 쪽지 고르기). 능력은 하나, 원인은 여기서만 갈린다(설계 3절). */
function causeOf(d, chosen) {
  if (chosen === d.answer) return null;
  if (d.kind === 'board') return 'wrong-train';
  if (d.kind !== 'stop') return 'other-sign';
  if (d.target) return chosen === 'stay' ? 'missed-station' : 'wrong-door';
  return 'got-off-early';
}

/** 쪽지에서 형광펜을 칠 말. 안내 글에서 짚어 줄 낱말. */
export function highlightFor(d, cause) {
  if (d.kind === 'stop') {
    if (cause === 'wrong-door') return d.side === 'left' ? '왼쪽' : '오른쪽';
    if (d.id?.startsWith('busy.short')) return '까지만 운행합니다';
    return d.station;
  }
  return (d.line_.key || [])[0] || '';
}

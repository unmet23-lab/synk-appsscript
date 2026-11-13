// 「오늘」(깃발 ?today=1 뒤) — 기록을 모으는 곳(얇은 한 겹). 줄마다 제 기록에서 읽는다:
//  · 드라마: 계정 학습 호스트(SYNKLearningHost)의 계정 기록에서 drama-s1 사건(드라마 묶음 엔진으로 연 읽기 손잡이 — 쓰지 않는다).
//  · C 차례: 드라마 기록기(createRecorder)의 delayedDue — 지금 첫 화면 C 카드와 같은 판단(Atlas 지연 관측 d7).
//  · 입장 검사: 그 게임 묶음 엔진(SynkLearning)으로 연 손잡이에 그 게임의 재방문 맞춤(shiftPlan — 입구가 보이는 문장 그대로)을 묻는다.
//    열린 근무지 · 연수 여부는 그 게임 진도(synk.entry-check.v1 — WORLD 놀이 계정 기록, 없으면 이 기기)에서 읽는다.
// 계정 호스트가 없으면(로그인 전 · 이PC 시범) 아무것도 읽지 않는다 — 화면은 지금 첫 화면으로 간다.

export function findLearningHost(win = window) {
 if (win.SYNKLearningHost) return win.SYNKLearningHost;
 try { if (win.parent !== win && win.parent.location.origin === win.location.origin) return win.parent.SYNKLearningHost || null; } catch { /* 다른 출처 */ }
 return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 계정 기록 전체(모든 게임이 같이 쓰는 log). 기록이 덜 모였으면 잠시 기다린다. */
export async function readEvents({ host, D }) {
 const g = host.createGame({ gameId: 'drama-s1' }, D.engine.createGame, D.engine.createLearningSync);
 try {
  for (let i = 0; i < 10; i++) {
   try { const ev = g.events(); if (Array.isArray(ev)) return ev; } catch { /* 잠금을 받는 중 */ }
   await wait(150);
  }
  return [];
 } finally { try { g.dispose?.(); } catch { /* 읽기 손잡이 */ } }
}

/** C 차례: true | false | null(모름). 모르면 잠시 다시 묻는다. */
export async function readDelayed({ trail, lesson }) {
 const C = lesson?.delayed;
 if (!C || !trail?.delayedDue) return false;
 for (let i = 0; i < 8; i++) {
  const due = trail.delayedDue({ lineId: C.id, skillId: C.skill });
  if (due !== null) return due;
  await wait(250);
 }
 return null;
}

function readPlay(key, win = window) {
 try {
  let w = win;
  for (let i = 0; i < 6; i++) {
   if (w.SYNKPlayHost) {
    const raw = w.SYNKPlayHost.snapshot?.()?.state?.records?.[key];
    if (raw == null) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
   }
   if (w.parent === w) break;
   w = w.parent;
  }
 } catch { /* 다른 출처 · 읽기 실패 */ }
 try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function loadScript(src) {
 return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

/** 입장 검사 재방문 맞춤(그 게임 문장 그대로) | null. base: 드라마 틀에서 본 입장 검사 폴더(WORLD · 대역 모두 형제 폴더). */
export async function readEntry({ host, base = '../entry-check/' }) {
 const progress = readPlay('synk.entry-check.v1');
 if (!progress?.tutorial || !(progress.plays > 0)) return null;
 // 문서 주소 기준(이 모듈 주소 기준이면 drama/today/ 아래를 찾는다).
 const root = new URL(base, document.baseURI).href;
 if (!window.SynkLearning) await loadScript(`${root}atlas-learning.js`);
 const E = window.SynkLearning;
 if (!E?.engine) return null;
 const [L, C, core] = await Promise.all([import(`${root}learning.mjs`), import(`${root}content.mjs`), import(`${root}core.mjs`)]);
 const coach = host.createGame({ gameId: 'entry-check' }, E.engine.createGame, E.engine.createLearningSync);
 try {
  const ids = C.VENUES.filter((v) => core.unlocked(progress, v.id)).map((v) => v.id);
  for (let i = 0; i < 8; i++) {
   let complete = false;
   try { const s = coach.summary(); complete = s?.storage?.available === true && s.evidenceComplete === true; } catch { complete = false; }
   if (complete) break;
   await wait(250);
  }
  const plan = L.shiftPlan(coach, ids, progress);
  if (!plan) return null;
  // 이름은 입장 검사가 WORLD에서 보이는 이름(캠퍼스 판 world-content.mjs)으로 — LAB 이름(별빛 도서관)이 아니라 그 게임 입구와 같은 이름(중앙도서관).
  const W = await import(`${root}world-content.mjs`).catch(() => null);
  const v = C.VENUES.find((x) => x.id === plan.target.venueId);
  const name = W?.WORLD_VENUES?.[v?.id]?.name || v?.name;
  return { patternId: plan.patternId, why: plan.why, next: plan.next, misses: plan.misses, seen: plan.seen, evidenceIds: plan.evidenceIds,
   targetId: plan.target.id, itemKey: plan.target.meta.itemKey, venue: v ? { id: v.id, day: v.day, name } : null };
 } catch { return null; }
 finally { try { coach.dispose?.(); } catch { /* 읽기 손잡이 */ } }
}

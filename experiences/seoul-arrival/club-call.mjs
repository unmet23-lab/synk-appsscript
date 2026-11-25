// 서울행 내 길(1화 전)의 동아리장 알림(2026-11-24, 유호님 11-23 「나중에하기를 빼고 알람같은거? 휴대폰 알람같은게 온 아이콘」).
// 앞면 다리(world-front-entry.mjs)가 부모 창에 둔 SYNKFrontClub이 「아직 동아리장을 안 만났다」고 할 때만 띄운다.
// 누르면 「답하기」를 남기고 내 길을 떠난다 — 앞면이 처음 만남(experiences/world-front/club.mjs)으로 연다. 알림 꼴은 앞면과 같은 파일이다.
import {mountNote} from '../world-front/club.mjs';

// 부모가 옛 판이면(공개 전에 연 앱 — note · dropped · drop이 없다) 앞 판처럼 기기 열쇠로 하루 한 번만 내린다
const OLD = {key: 'synk.world.club.drop', day: () => { const d = new Date(Date.now() - 4 * 3600e3); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
  dropped: () => localStorage.getItem(OLD.key) === OLD.day(), drop: () => localStorage.setItem(OLD.key, OLD.day())};
const club = () => { try { return window.parent !== window ? window.parent.SYNKFrontClub || null : null; } catch { return null; } };
// 알림을 띄울 수 있나(그러면 내 길의 「오늘은 여기까지」를 뺀다)
export const clubWanted = () => { try { return !!club()?.needed?.(); } catch { return false; } };
// 서울행 소리 이름으로(앞면 club.mjs가 부르는 이름 → 서울행 FELT)
const FELT = {tap: 'tap', paper: 'page', switch: 'tick', flick: 'nudge', chime880: 'chime', chime1320: 'ok'};
export function clubCall({lang = 'ko', felt = () => {}, calm = () => false, leave}) {
  const c = club(); if (!c?.needed?.()) return null;
  // 알림 글과 「오늘 이미 내려왔나」는 부모(앞면 다리)가 주인마다 안다 — 앞면 알림과 같은 줄이다
  const own = typeof c.drop === 'function' && typeof c.dropped === 'function' ? c : OLD;
  let dropped = false; try { dropped = !!own.dropped(); } catch {}
  let what = null; try { what = c.note?.() || null; } catch {}
  const note = mountNote({state: {lang, note: {...(what || {from: 'club', who: 'head', kind: 'club', code: 'club.hello', slots: {}}), read: false}},
    sfx: k => { if (FELT[k]) felt(FELT[k]); }, calm, docked: dropped,
    onDrop: () => { try { own.drop(); } catch {} },
    onOpen: () => { try { c.ask(); } catch {} leave(); }});
  // 1화를 시작하면 알림을 걷는다(내 길을 다시 그리면 다시 띄운다)
  document.querySelector('#startEp')?.addEventListener('click', () => note?.dispose(), {once: true});
  return note;
}

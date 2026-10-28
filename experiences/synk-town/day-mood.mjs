/** Mood lines by a resident's name (vertical slice design §7-3, W4): when the player is within a resident's
 * near radius and the plan's current segment for that resident changed its mind, a small picture and one line
 * hang over the name label (under it only when the top of the scene has no room) — not a speech bubble, and
 * nothing asks for an answer. The line's level is one
 * function (lineLevel) the learning adapter (W9) will plug into; 「무슨 뜻이에요?」 shows that line alone one level
 * down with its picture larger and changes no ladder state (§13-1). The state behind it never shows (G2).
 * Screen-only module: the server's plan decides which line (segment.mood), the screen only draws it.
 * W5b: the same cards carry what a resident says while it solves a small need card or talks with its pair (the caller's
 * lineAt resolves it — town/data/lines cards·pairs), two cards never cover each other or the walking HUD, a line read out
 * once is read again on a new life day, and a card shown long enough is reported as seen (§20-2 line: keys).
 */
import * as generated from './town/data.gen.mjs';
import { WALK_NEAR_RADIUS } from './walk.mjs';

// Read through the namespace: for up to the cache's ten minutes after a publish a browser may still hold the
// generated data from before the mood lines existed. Then no line shows and the town still opens — a named import
// would instead stop the whole town from loading.
const LINE_BY_ID = new Map([...(generated.MOOD_LINES || []), ...(generated.TOWN_LINES || [])].map(line => [line.id, line]));
/** How long a card stays in sight before its line counts as seen (§20-2 「끝까지 보였을 때」). */
export const SEEN_MS = 1200;
const LEVELS = ['L1', 'L2', 'L3', 'L4'];
/** The level a one-line text shows at (§13-1 「장면이 아닌 한 줄」): the reading seat's stable level. W4 has no ladder yet → L2. */
export function lineLevel({ ladder } = {}) { return LEVELS.includes(ladder?.reading?.stable) ? ladder.reading.stable : 'L2'; }
/** One level down for 「무슨 뜻이에요?」 — L1 stays L1. */
export const easier = level => LEVELS[Math.max(0, LEVELS.indexOf(level) - 1)];

// Small line pictures (24×24, currentColor) — one per icon name the lines checker allows (MOOD_ICONS).
const G = (...parts) => parts.join('');
export const ICONS = Object.freeze({
  rain: G('<path d="M7 15a4 4 0 0 1 .5-8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7H7z"/>', '<path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>'),
  guests: G('<circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/>', '<path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M14.5 19.5a4.5 4.5 0 0 1 6.5-3.9"/>'),
  seat: '<path d="M8 3v10h9v7M8 13v7M8 9h9"/>',
  menu: G('<rect x="5" y="3" width="14" height="18" rx="2"/>', '<path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'),
  leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7"/>',
  steam: G('<path d="M5 11h11v3a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-3zM16 12h1.5a2.5 2.5 0 0 1 0 5H16"/>', '<path d="M8 4c1 1.2-1 2.3 0 3.5M11.5 4c1 1.2-1 2.3 0 3.5"/>'),
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0H3zM12 12v6a2 2 0 0 0 4 0"/>',
  cups: '<path d="M3 10h7v4a3.5 3.5 0 0 1-7 0v-4zM14 10h7v4a3.5 3.5 0 0 1-7 0v-4zM2 21h20"/>',
  together: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  cold: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2"/>',
  orders: '<path d="M4 8l8-4 8 4v8l-8 4-8-4V8zM4 8l8 4 8-4M12 12v8"/>',
  quiet: G('<path d="M4 6h16v10H9l-4 3v-3H4z"/>', '<path d="M9 11h6"/>'),
  plane: '<path d="M3 15h18v3H3zM6 15l2-6h7l3 6M11 9V6h3"/>',
  cup: '<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M4 21h14"/>',
  wobble: '<path d="M5 16l14-4M7 20l1-4M17 16l1 4M6 9c1-1 2 1 3 0M15 6c1-1 2 1 3 0"/>',
  tired: '<path d="M4 11c2.5 3.5 13.5 3.5 16 0M7 14l-1.5 2.2M12 15.2v2.6M17 14l1.5 2.2"/>',
  puddle: G('<ellipse cx="12" cy="17.5" rx="8" ry="3"/>', '<path d="M12 4c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6z"/>'),
  moon: '<path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z"/>',
  sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>',
  board: G('<rect x="4" y="4" width="16" height="11" rx="1.5"/>', '<path d="M8 21l3-6M16 21l-3-6"/>'),
  flower: G('<circle cx="12" cy="9" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="16" cy="9" r="2"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="9" r="2"/>', '<path d="M12 15v6"/>'),
  pages: '<path d="M7 3h8l4 4v14H7zM15 3v4h4M4 6v15h12"/>',
  sun: G('<circle cx="12" cy="12" r="4"/>', '<path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
});
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.sparkle}</svg>`;
/** Cards that would cover each other (two residents side by side — a pair scene) move apart: each later one goes
 * above the one it meets, or below when the top has no room. Rects are { x, y, w, h } in the layer's px. */
export function separate(rects, { gutter = 16, height = Infinity, gap = 6, avoid = [] } = {}) {
  const out = [], hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const r of rects) {
    const next = { ...r };
    for (let i = 0; i < 6; i++) {
      const block = [...out, ...avoid].find(o => hit(next, o));
      if (!block) break;
      const up = block.y - gap - next.h, down = block.y + block.h + gap;
      next.y = up >= gutter ? up : Math.min(down, Math.max(gutter, height - next.h - gutter));
    }
    out.push(next);
  }
  return out;
}

/** The mood line the plan gives a resident at server time t: its current segment's line, or null. */
export function moodAt(segments, npc, t) {
  const seg = segments.find(s => s.npc === npc && s.startMs <= t && t < s.endMs);
  return seg?.mood && LINE_BY_ID.has(seg.mood) ? seg.mood : null;
}

/** Metres past the near radius before a shown card goes, so walking along the edge does not make it blink. */
const LEAVE_MARGIN = 0.25;
/** CSS px between a card and the centre of the name label (the label is about 18px tall). */
const LABEL_GAP = 14;

/** The cards over a scene. update() runs each frame with { segments, t, rows, player, labelAt, names, blocked }:
 * rows are the residents as drawn (live ones only carry a line), player is { x, z }, labelAt(id) → { x, y } on the
 * scene (or null off screen), blocked hides every card (a dialog, the nearby panel, the text alternative).
 * W5b (all optional): lineAt(npc) → { id, icon, seen } picks the resident's line (else its mood line), skip names
 * residents whose card another layer draws (an offer), day is the life day (a new one reads lines out again), avoid
 * lists rects the cards keep off ({ x, y, w, h } in the layer's px — the walking HUD), onSeen(keys) hears each line's
 * seen keys once it has been in sight SEEN_MS. */
export function createMoodLines(container, live, { getLadder = () => null } = {}) {
  // An entry page from before the mood lines (a cached day.html) has no layer: nothing to draw, and the frame loop
  // that calls update() must keep running.
  if (!container) return { update: () => [] };
  const cards = new Map(), eased = new Set(), announced = new Set(), reported = new WeakSet();
  let announcedDay = null;
  const textOf = id => { const line = LINE_BY_ID.get(id), level = lineLevel({ ladder: getLadder() }); return line.levels[eased.has(id) ? easier(level) : level] ?? line.levels.L1; };
  const say = (npc, id, names) => { if (live) live.textContent = `${names[npc] || npc}: ${textOf(id)}`; };
  function card(npc, id, names, icon) {
    const line = LINE_BY_ID.get(id), el = document.createElement('div');
    el.className = 'mood-card'; el.dataset.npc = npc; el.dataset.line = id; el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${names[npc] || npc}${line.kind && line.kind !== 'mood' ? '의 말' : '의 마음'}`);
    el.innerHTML = `<span class="mood-icon">${svg(icon || line.icon)}</span><p class="mood-text"></p><button type="button" class="mood-help" aria-expanded="false">무슨 뜻이에요?</button>`;
    // The line changes in place, so a screen reader hears the version now shown.
    el.querySelector('.mood-help').addEventListener('click', () => { if (eased.has(id)) eased.delete(id); else eased.add(id); paint(el, id); say(npc, id, names); });
    container.append(el);
    return el;
  }
  function paint(el, id) {
    const down = eased.has(id), text = textOf(id);
    const p = el.querySelector('.mood-text'); if (p.textContent !== text) p.textContent = text;
    el.classList.toggle('is-eased', down);
    const help = el.querySelector('.mood-help'); help.setAttribute('aria-expanded', String(down)); help.textContent = down ? '원래 말로' : '무슨 뜻이에요?';
  }
  // A card that goes (walked away, or the next segment brings another line) takes its 「무슨 뜻이에요?」 with it, and
  // keyboard focus on its button goes back to the scene instead of falling to the page.
  function drop(npc, el) {
    if (el.contains(document.activeElement)) container.closest?.('[tabindex]')?.focus?.();
    el.remove(); cards.delete(npc); eased.delete(el.dataset.line);
  }
  function update({ segments = [], t = null, rows = [], player = null, labelAt = () => null, names = {}, blocked = false,
    lineAt = null, skip = [], day = null, avoid = [], onSeen = null, now = globalThis.performance?.now?.() ?? Date.now() }) {
    // A line read out on one life day is read out again on the next (the W4 screen review's follow-up).
    if (day !== announcedDay) { announcedDay = day; announced.clear(); }
    const want = new Map();
    if (!blocked && t !== null && player) {
      for (const row of rows) {
        if (!row.live || row.asleep || row.held || skip.includes(row.id)) continue;
        const picked = lineAt ? lineAt(row.id) : null, id = picked?.id && LINE_BY_ID.has(picked.id) ? picked.id : moodAt(segments, row.id, t);
        const reach = WALK_NEAR_RADIUS + (cards.get(row.id)?.dataset.line === id ? LEAVE_MARGIN : 0);
        if (!id || Math.hypot(row.x - player.x, row.z - player.z) > reach) continue;
        // One showing of one happening counts once, however often the player walks in and out of reach (§20-2).
        const mine = picked?.id === id ? picked : { seen: [`line:${id}`], occurrence: `${row.id}:${segments.find(s => s.npc === row.id && s.startMs <= t && t < s.endMs)?.startMs ?? t}` };
        want.set(row.id, { id, icon: mine.icon ?? null, seen: mine.seen, occurrence: mine.occurrence ?? id });
      }
    }
    for (const [npc, el] of cards) if (want.get(npc)?.id !== el.dataset.line) drop(npc, el);
    if (!want.size) return [];
    const box = container.getBoundingClientRect(), gutter = 16, placed = [];
    for (const [npc, line] of want) {
      let el = cards.get(npc);
      if (!el) { el = card(npc, line.id, names, line.icon); el.shownAt = null; cards.set(npc, el); paint(el, line.id); }
      const at = labelAt(npc);
      if (!at) { el.hidden = true; el.shownAt = null; continue; }
      el.hidden = false;
      // Over the name, so the resident and the player stay in sight; under it only when the top of the scene has no
      // room. Kept inside the scene with a 16px gutter (narrow screens).
      const w = el.offsetWidth, h = el.offsetHeight, x = Math.max(gutter, Math.min(box.width - w - gutter, at.x - w / 2));
      const over = at.y - LABEL_GAP - h, y = over >= gutter ? over : at.y + LABEL_GAP;
      placed.push({ el, npc, line, rect: { x, y, w, h } });
    }
    // Two cards side by side (a pair scene) and the walking HUD never cover one another. avoid may be a function: the
    // HUD is measured only on frames that place a card.
    const rects = separate(placed.map(p => p.rect), { gutter, height: box.height, avoid: placed.length ? (typeof avoid === 'function' ? avoid() : avoid) : [] });
    placed.forEach(({ el, npc, line }, i) => {
      el.style.transform = `translate(${Math.round(rects[i].x)}px, ${Math.round(rects[i].y)}px)`;
      if (!announced.has(line.id)) { announced.add(line.id); say(npc, line.id, names); }
      el.shownAt ??= now;
      if (onSeen && now - el.shownAt >= SEEN_MS && !reported.has(el)) { reported.add(el); onSeen(line.seen || [`line:${line.id}`], line.occurrence); }
    });
    return [...want.entries()].map(([npc, line]) => ({ npc, id: line.id, eased: eased.has(line.id) }));
  }
  return { update };
}

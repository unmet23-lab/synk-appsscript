// 시안 확인 세 벌이 함께 쓰는 상태. 실제 앱에서는 feedback · approve 액션과 프로젝트 자료가 이 자리에 온다. 화면 세 벌은 그리는 법만 다르다.
import { REVIEW } from './copy.mjs';

export function createReview() {
  const s = {
    version: 'v2', compare: false, t: 0, playing: false, duration: REVIEW.duration,
    drafts: [], sent: REVIEW.notes.map((n) => ({ ...n })), justSent: false, approved: false,
  };
  const subs = new Set();
  const emit = (what) => subs.forEach((fn) => fn(what, s));
  const current = () => REVIEW.versions.find((v) => v.id === s.version);
  const scene = (t) => REVIEW.scenes.find((x) => t >= x.from && t < x.to) || REVIEW.scenes.at(-1);
  return {
    s, current, scene, on: (fn) => { subs.add(fn); return () => subs.delete(fn); }, emit,
    setVersion(id) { s.version = id; emit('version'); },
    setCompare(on) { s.compare = on; emit('compare'); },
    addDraft(at, text) { const clean = text.trim(); if (!clean) return false; s.drafts.push({ id: Date.now() + Math.random(), at, text: clean, version: s.version }); s.drafts.sort((a, b) => a.at - b.at); s.justSent = false; emit('notes'); return true; },
    removeDraft(id) { s.drafts = s.drafts.filter((d) => d.id !== id); emit('notes'); },
    send() { if (!s.drafts.length) return; s.sent.push(...s.drafts.map((d) => ({ who: '나', mine: true, version: d.version, at: d.at, text: d.text }))); s.drafts = []; s.justSent = true; emit('notes'); },
    approve() { if (s.drafts.length) return; s.approved = true; s.justSent = false; emit('approved'); },
    notesFor(id) { return s.sent.filter((n) => n.version === id); },
  };
}

// 영상 하나를 상태에 잇는다. 나란히 보기의 둘째 영상은 follower로 받아 첫째를 따라간다.
export function bindFilm(review, video, { follower = null } = {}) {
  const s = review.s;
  const tick = () => { s.t = video.currentTime || 0; review.emit('time'); if (!video.paused) raf = requestAnimationFrame(tick); };
  let raf = 0;
  video.addEventListener('play', () => { s.playing = true; review.emit('play'); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); follower?.play().catch(() => {}); });
  video.addEventListener('pause', () => { s.playing = false; review.emit('play'); cancelAnimationFrame(raf); s.t = video.currentTime; review.emit('time'); follower?.pause(); });
  video.addEventListener('seeked', () => { s.t = video.currentTime; review.emit('time'); });
  video.addEventListener('timeupdate', () => { if (video.paused) { s.t = video.currentTime; review.emit('time'); } });
  video.addEventListener('loadedmetadata', () => { s.duration = video.duration || s.duration; review.emit('time'); });
  const api = {
    toggle() { if (video.paused) { if (video.ended) video.currentTime = 0; return video.play().catch(() => { video.muted = true; return video.play().catch(() => {}); }); } video.pause(); return null; },
    seek(t) { const v = Math.max(0, Math.min(t, (video.duration || s.duration) - 0.03)); video.currentTime = v; if (follower) follower.currentTime = v; s.t = v; review.emit('time'); },
    load(src, at = null) { const t = at ?? video.currentTime; const was = !video.paused; video.src = src; s.t = t; review.emit('time'); video.addEventListener('loadedmetadata', () => { video.currentTime = t; if (was) video.play().catch(() => {}); }, { once: true }); },
  };
  if (follower) video.addEventListener('timeupdate', () => { if (Math.abs(follower.currentTime - video.currentTime) > 0.18) follower.currentTime = video.currentTime; });
  return api;
}

// 키보드: 스페이스 재생 · 좌우 1초 · Esc는 각 화면이.
export function bindKeys(api, review, { typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') } = {}) {
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (e.key === ' ') { e.preventDefault(); api.toggle(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); api.seek(review.s.t - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); api.seek(review.s.t + 1); }
  });
}

// 끌어서 시간 옮기기. el의 가로 위치가 곧 시간이다.
export function scrubber(el, { duration, onSeek, onHover, onLeave }) {
  let down = false;
  const at = (e) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration(); };
  el.addEventListener('pointerdown', (e) => { down = true; el.setPointerCapture?.(e.pointerId); onSeek(at(e)); });
  el.addEventListener('pointermove', (e) => { if (down) onSeek(at(e)); else onHover?.(at(e), e); });
  el.addEventListener('pointerup', () => { down = false; });
  el.addEventListener('pointercancel', () => { down = false; });
  el.addEventListener('pointerleave', () => { if (!down) onLeave?.(); });
}

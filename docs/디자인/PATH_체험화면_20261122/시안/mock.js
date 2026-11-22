// 시안 공통: 머리 막대 그림자, 시안 안내 알약(화면 옮기기 · 판 바꾸기), 짧은 효과음.
(() => {
  const bar = document.querySelector('.bar');
  if (bar) { const on = () => bar.classList.toggle('scrolled', scrollY > 4); addEventListener('scroll', on, { passive: true }); on(); }

  const here = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  const params = new URLSearchParams(location.search);
  const pan = params.get('판') === 'B' ? 'B' : 'A';
  const hasPan = document.body.dataset.pans === 'AB';
  const note = document.createElement('nav'); note.className = 'mock-note'; note.setAttribute('aria-label', '시안 안내');
  const pages = [['index.html', '시안 목록'], ['입구.html', '입구'], ['직업.html', '직업'], ['체험.html', '체험'], ['면접.html', '면접']];
  for (const [file, label] of pages) { const a = document.createElement('a'); a.href = `./${file}${hasPan && file === here ? '' : ''}`; a.textContent = label; if (file === here) a.className = 'on'; note.append(a); }
  if (hasPan) {
    const sw = document.createElement('a'); sw.href = `?판=${pan === 'A' ? 'B' : 'A'}`; sw.textContent = pan === 'A' ? 'B판 보기' : 'A판 보기'; sw.style.cssText = 'background:#F5C445;color:#14171c;margin-left:4px'; note.append(sw);
  }
  if (params.get('찍기') !== '1') document.body.append(note);

  // 효과음 — 고를 때 「톡」, 장면을 마칠 때 두 음. 소리는 작게, 누른 뒤에만.
  let ctx;
  const tone = (freq, at, dur, gain = .05) => {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq;
    const t = ctx.currentTime + at; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
  };
  window.mockSound = {
    tap() { try { tone(880, 0, .09, .035); } catch {} },
    done() { try { tone(660, 0, .18); tone(990, .12, .32); } catch {} },
    turn() { try { tone(520, 0, .12, .03); } catch {} },
  };
  window.mockPan = pan;
})();

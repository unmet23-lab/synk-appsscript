/* SYNK SNS 키트 모션 — HyperFrames(GSAP) 프리셋 · SynkMotion
 * 원문: docs/디자인/SNS키트/README.md §9 (2026-10-01)
 *
 * 쓰는 법(HyperFrames 컴포지션 안):
 *   GSAP(CDN 3.14.2)와 assets/synk-kit/motion.js 를 script 태그로 불러온 뒤
 *   ⚠ 이 파일에는 script 닫는 태그 문자열을 쓰지 않는다. 컴파일러가 이 파일을 페이지에 끼워 넣을 때 거기서 스크립트가 끊긴다.
 *   const tl = gsap.timeline({ paused: true });
 *   const M = SynkMotion;
 *   M.stitch(tl, '#s1', 0.1); M.lines(tl, '#s1 .k-title', 0.3); M.mark(tl, '#s1 .k-mark', 0.8);
 *   M.patch(tl, '#s1', '#s2', 3.3, { root: '#root' });
 *   window.__timelines['main'] = tl;   // 맨 마지막에 등록
 *
 * 지키는 것(HyperFrames 결정성 규칙):
 *   - 모든 트윈은 fromTo(시작 상태를 적는다). 되감기·임의 시점 찍기에서도 같은 화면이 나온다.
 *   - Math.random·Date.now·무한 반복 없음. 측정은 만들 때 한 번(getComputedStyle의 --r 기울기만 읽는다).
 *   - 마스코트(data-mascot)는 흔들거나 떠다니게 하지 않는다. 스티커처럼 한 번 붙는 것과 표정 바꾸기(컷)만.
 *   - 움직임마다 이유가 있다: 등장(무엇이 새로 왔나), 강조(어디를 보나), 전환(장면이 바뀐다).
 * 이름 옆 괄호는 hyperframes-animation 규칙 이름이다(같은 원리를 펠트·실땀 재질로 옮겼다).
 */
(function (g) {
  'use strict';
  const D = { fast: 0.26, base: 0.42, slow: 0.62 };
  const all = (x) => {
    if (!x) return [];
    if (typeof x === 'string') return Array.from(document.querySelectorAll(x));
    if (x instanceof Element) return [x];
    return Array.from(x);
  };
  const one = (x) => all(x)[0];
  const tilt = (el) => parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0;

  const M = { D };
  // 장면 쌓기 순서: 전환마다 새 장면을 지금까지보다 위에 올린다(고정 값이면 실땀 뒤 아치처럼 새 장면이 밑에 깔린다, 2026-10-01).
  // 전환 부품(덮개·실땀 줄)은 9000대라 장면보다 늘 위다
  let Z = 10;
  const lift = (tl, el, t) => tl.set(el, { opacity: 1, zIndex: ++Z }, t);

  /* ── 등장 ───────────────────────────────────────────── */

  // 줄 단위로 올라온다(waterfall-entry). 제목 안의 .ln 블록이 한 줄이다. 없으면 요소 하나를 줄로 본다
  M.lines = (tl, sel, t, o = {}) => {
    const st = o.stagger ?? 0.09, dur = o.dur ?? D.base, y = o.y ?? 56;
    all(sel).forEach((el, k) => {
      const ls = el.querySelectorAll('.ln').length ? Array.from(el.querySelectorAll('.ln')) : [el];
      ls.forEach((ln, i) => tl.fromTo(ln, { y, opacity: 0 }, { y: 0, opacity: 1, duration: dur, ease: 'power3.out' }, t + (k * ls.length + i) * st));
    });
    return t + dur + st * 2;
  };

  // 낱말 하나씩(키네틱 자막). 만들 때 글자를 낱말 단위 <span class="w">로 나눈다. 강조(.k-mark)는 통째로 한 낱말
  // o.times: 낱말마다 실제 시작 시각(초, 절대값) 배열. 음성 타이밍이 있으면 고른 간격 대신 이 값을 쓴다
  M.words = (tl, sel, t, o = {}) => {
    const st = o.stagger ?? 0.055, dur = o.dur ?? 0.32, times = o.times;
    let n = 0;
    all(sel).forEach((el) => {
      const walk = (node) => {
        Array.from(node.childNodes).forEach((c) => {
          if (c.nodeType === 3 && c.textContent.trim()) {
            const frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const w = document.createElement('span'); w.className = 'w'; w.textContent = part;
              w.style.display = 'inline-block'; frag.appendChild(w);
            });
            c.replaceWith(frag);
          } else if (c.nodeType === 1 && !c.classList.contains('k-mark')) walk(c);
          else if (c.nodeType === 1) { c.classList.add('w'); c.style.display = 'inline-block'; }
        });
      };
      walk(el);
      el.querySelectorAll('.w').forEach((w) => {
        const at = times && times[n] != null ? times[n] : t + n * st;
        tl.fromTo(w, { y: 28, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: dur, ease: 'power3.out' }, at);
        n += 1;
      });
    });
    return times && times.length ? times[times.length - 1] + dur : t + dur + n * st;
  };

  // 첫 프레임부터 보이는 제목(kinetic-beat-slam). 0초 화면에도 읽히고, 크게 시작해 제자리로 앉는다.
  // 왼쪽 끝을 축으로 키우므로 제목 상자는 글자 폭만큼(width:fit-content) 둔다. 판 폭 전체면 0초에 오른쪽 단추 자리(160)를 넘는다
  M.slam = (tl, sel, t, o = {}) => {
    all(sel).forEach((el) => tl.fromTo(el, { scale: o.from ?? 1.08, opacity: 1, transformOrigin: '0% 50%' }, { scale: 1, opacity: 1, duration: o.dur ?? 0.45, ease: 'power3.out' }, t));
    return t + (o.dur ?? 0.45);
  };

  // 흐린 줄·라벨·발이 조용히 나타난다
  M.fade = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => tl.fromTo(el, { opacity: 0, y: o.y ?? 12 }, { opacity: 1, y: 0, duration: o.dur ?? 0.3, ease: 'power2.out' }, t + i * (o.stagger ?? 0.06)));
    return t + (o.dur ?? 0.3);
  };

  // 형광펜 긋기(css-marker-patterns · highlight). 흰 종이는 형광펜, 색 면은 크레용 밑줄이 왼쪽부터
  M.mark = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => tl.fromTo(el, { '--mk': 0 }, { '--mk': 1, duration: o.dur ?? 0.36, ease: 'power2.inOut' }, t + i * 0.12));
    return t + (o.dur ?? 0.36);
  };

  // 스티커 붙이기(spring-pop-entrance의 장난스러운 예외). 크게 들렸다가 톡 붙고, 기울기는 원래 값으로
  M.sticker = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => {
      const r = tilt(el);
      tl.fromTo(el, { scale: 1.45, rotation: r + 14, opacity: 0 },
        { scale: 1, rotation: r, opacity: 1, duration: o.dur ?? 0.34, ease: 'back.out(1.7)' }, t + i * (o.stagger ?? 0.12));
    });
    return t + (o.dur ?? 0.34);
  };

  // 칩·단추가 펠트 두께로 눌리며 생긴다(press-release-spring)
  M.press = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => tl.fromTo(el, { scale: 0.6, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: o.dur ?? 0.3, ease: 'back.out(1.4)' }, t + i * (o.stagger ?? 0.07)));
    return t + (o.dur ?? 0.3) + all(sel).length * (o.stagger ?? 0.07);
  };

  // 사진을 위에서 내려놓는다. 인화지처럼 살짝 돌며 원래 기울기에 앉는다
  M.photo = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => {
      const r = tilt(el);
      tl.fromTo(el, { y: o.y ?? -110, rotation: r - 9, opacity: 0, scale: 1.04 },
        { y: 0, rotation: r, opacity: 1, scale: 1, duration: o.dur ?? 0.5, ease: 'power3.out' }, t + i * (o.stagger ?? 0.16));
    });
    return t + (o.dur ?? 0.5) + all(sel).length * (o.stagger ?? 0.16);
  };

  // 종이테이프를 왼쪽부터 붙인다
  M.tape = (tl, sel, t, o = {}) => {
    all(sel).forEach((el, i) => {
      const r = tilt(el);
      tl.fromTo(el, { scaleX: 0, rotation: r, transformOrigin: '0% 50%' }, { scaleX: 1, rotation: r, duration: o.dur ?? 0.22, ease: 'power2.out' }, t + i * 0.1);
    });
    return t + (o.dur ?? 0.22);
  };

  // 크레용 손그림(svg-path-draw를 마스크로). 손으로 긋듯 끊어지는 단계로
  M.crayon = (tl, sel, t, o = {}) => {
    all(sel).forEach((el) => tl.fromTo(el, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: o.dur ?? 0.5, ease: 'steps(9)' }, t));
    return t + (o.dur ?? 0.5);
  };

  // 실땀 박기: 네 모서리 실땀(.k-corners)이 왼쪽 위부터 바느질하듯 나타난다. 스톱모션 단계
  M.stitch = (tl, sel, t, o = {}) => {
    all(sel).forEach((el) => tl.fromTo(el, { '--st': 0 }, { '--st': 1, duration: o.dur ?? 0.6, ease: 'steps(10)' }, t));
    return t + (o.dur ?? 0.6);
  };

  // 카메라 초점(depth-of-field-blur + 모서리 조이기). 실제 화면·사진이 '진짜'인 순간
  M.focus = (tl, sel, t, o = {}) => {
    const vf = one(sel); if (!vf) return t;
    const shot = vf.querySelector('.k-shot');
    tl.fromTo(vf, { '--vfo': '48px', opacity: 0 }, { '--vfo': '0px', opacity: 1, duration: o.dur ?? 0.45, ease: 'power3.out' }, t);
    if (shot) tl.fromTo(shot, { filter: 'blur(14px)', scale: 1.07 }, { filter: 'blur(0px)', scale: 1, duration: (o.dur ?? 0.45) + 0.15, ease: 'power2.out' }, t + 0.05);
    const stamp = vf.querySelector('.k-stamp');
    if (stamp) M.sticker(tl, stamp, t + 0.45);
    return t + 0.8;
  };

  // 숫자 세기(counting-dynamic-scale). 결과 숫자 하나에만
  M.count = (tl, sel, t, to, o = {}) => {
    const el = one(sel); if (!el) return t;
    const p = { v: o.from ?? 0 };
    tl.fromTo(p, { v: o.from ?? 0 }, { v: to, duration: o.dur ?? 0.8, ease: 'power2.out', onUpdate: () => { el.textContent = (o.fmt || ((v) => Math.round(v)))(p.v); } }, t);
    return t + (o.dur ?? 0.8);
  };

  // 컨페티 한 번(particle-burst를 멈추는 판으로). 좋은 결과·발표 장면 하나에만
  M.confetti = (tl, sel, t) => {
    all(sel).forEach((el, i) => tl.fromTo(el, { scale: 0.3, y: 40, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, t + i * 0.08));
    return t + 0.5;
  };

  // 펀치인(박자 컷의 확대). 제목이나 본문 묶음에 쓴다(판 전체 높이 감싸개에 쓰면 위쪽이 머리줄을 친다). 컷 순간 확 커졌다가 제자리(1.0)로 돌아온다. 기본 1.04배(9:16 안전 영역 좌우 65 안에 머무는 값)
  M.punch = (tl, sel, t, o = {}) => {
    all(sel).forEach((el) => tl.fromTo(el, { scale: o.from ?? 1.0 }, { scale: o.to ?? 1.04, duration: 0.08, ease: 'power4.out', immediateRender: false }, t)
      .fromTo(el, { scale: o.to ?? 1.04 }, { scale: o.rest ?? 1.0, duration: 0.7, ease: 'power2.out', immediateRender: false }, t + 0.08));
    return t + 0.78;
  };

  // 키네틱 자막 한 줄: 낱말이 차례로 튀어나오고, out 시각에 사라진다. o.times로 낱말별 실제 시각을 줄 수 있다.
  // 덮개·종이 전환은 자막 띠까지 덮으므로 나가는 장면의 자막은 전환 시작(t) 전에 끝낸다
  M.caption = (tl, sel, t, out, o = {}) => {
    const end = M.words(tl, sel, t, { stagger: o.stagger ?? 0.07, dur: 0.26, times: o.times });
    if (out != null) tl.fromTo(one(sel), { opacity: 1 }, { opacity: 0, duration: 0.12, immediateRender: false }, out);
    return end;
  };

  /* ── 장면 전환 ───────────────────────────────────────────
   * 장면은 화면 전체를 덮는 .k-scene 이다. 첫 장면 말고는 CSS로 opacity:0 에서 시작한다.
   * 한 영상에서 같은 전환만 반복하지 않는다. 기본 넷: 펠트 덮개 · 실땀 와이프 · 아치 열기 · 종이 밀어 올리기 */

  // 펠트 덮개(css-cover staggered blocks를 세로로). 사업 색 면과 흰 종이 두 장이 아래에서 올라와 덮고 지나간다
  M.patch = (tl, from, to, t, o = {}) => {
    const root = one(o.root || '#root');
    const H = o.h ?? 1920;
    const mk = (id, bg) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div'); el.id = id;
        el.style.cssText = `position:absolute;left:-20px;right:-20px;top:0;height:${H + 40}px;z-index:9000;border-radius:64px;background:${bg};pointer-events:none;opacity:0`;
        root.appendChild(el);
      }
      return el;
    };
    const a = mk(`k-patch-a-${Math.round(t * 100)}`, o.color || 'var(--field)');
    const b = mk(`k-patch-b-${Math.round(t * 100)}`, o.second || '#fff');
    a.classList.add('k-field', 'k-corners'); a.style.overflow = 'hidden'; a.style.setProperty('--corner-inset', '60px');
    tl.fromTo(a, { y: H + 60, opacity: 1 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.inOut' }, t);
    tl.fromTo(b, { y: H + 60, opacity: 1 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.inOut' }, t + 0.07);
    tl.set(one(from), { opacity: 0 }, t + 0.36);
    lift(tl, one(to), t + 0.36);
    tl.to(b, { y: -H - 60, duration: 0.32, ease: 'power3.inOut' }, t + 0.38);
    tl.to(a, { y: -H - 60, duration: 0.32, ease: 'power3.inOut' }, t + 0.44);
    return t + 0.76;
  };

  // 실땀 와이프: 새 장면이 왼쪽부터 열리고, 그 경계를 실땀 한 줄이 따라간다(꿰매며 넘긴다)
  // 실 무늬는 kit.css의 .k-seam이 그린다. 인라인 스타일에 var(--thread-paper)를 쓰면 실 사진 경로가 문서 기준으로 풀려
  // 렌더에서 /assets/thread-*.webp 404로 실이 사라졌다(snapshot은 kit.css를 문서에 끼워 넣어 멀쩡해 보인다, 2026-10-13)
  M.seam = (tl, from, to, t, o = {}) => {
    const root = one(o.root || '#root');
    const W = o.w ?? 1080, H = o.h ?? 1920;
    const id = `k-seam-${Math.round(t * 100)}`;
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement('div'); s.id = id; s.className = 'k-seam';
      s.style.cssText = `position:absolute;top:-40px;left:0;width:44px;height:${H + 80}px;z-index:9001;pointer-events:none;opacity:0`;
      root.appendChild(s);
    }
    const dur = o.dur ?? 0.62;
    lift(tl, one(to), t);
    tl.fromTo(one(to), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, ease: 'power2.inOut' }, t);
    // 기다리는 줄도 화면 밖(x -30)에 보이게 둔다. 숨기면 실 사진을 처음 그리는 때가 찍는 순서마다 달라져
    // 같은 시각의 .k-stitch가 다르게 찍혔다. 대신 왼쪽 끝 0~7px에 그림자가 줄 하나당 1~2단계 남는다(2026-10-13 시험)
    tl.fromTo(s, { x: -30, opacity: 1 }, { x: W - 10, opacity: 1, duration: dur, ease: 'power2.inOut' }, t);
    tl.set(s, { opacity: 0 }, t + dur);
    tl.set(one(from), { opacity: 0 }, t + dur);
    return t + dur;
  };

  // 아치 열기(css-radial circle iris를 펠트 아치 모양으로). 새 장면이 가운데 아치 창에서 화면 전체로 열린다
  M.arch = (tl, from, to, t, o = {}) => {
    const dur = o.dur ?? 0.66;
    lift(tl, one(to), t);
    tl.fromTo(one(to), { clipPath: 'inset(44% 34% 28% 34% round 400px 400px 40px 40px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', duration: dur, ease: 'power3.inOut' }, t);
    tl.fromTo(one(from), { scale: 1, filter: 'brightness(1)' }, { scale: 0.92, filter: 'brightness(0.45)', duration: dur, ease: 'power3.inOut', immediateRender: false }, t);
    tl.set(one(from), { opacity: 0 }, t + dur);
    return t + dur;
  };

  // 종이 밀어 올리기(css-push vertical push). 새 종이가 살짝 기운 채 올라와 앉는다.
  // 옛 장면은 제자리에서 조금 어두워진다(옛 장면을 밀어 올리면 기운 새 종이 옆으로 검은 바탕 쐐기가 보였다, 2026-10-01).
  // 흰 종이끼리도 경계가 보이게 새 종이 위 가장자리에 그림자를 주고, 앉으면 지운다
  M.paper = (tl, from, to, t, o = {}) => {
    const H = o.h ?? 1920, dur = o.dur ?? 0.58;
    lift(tl, one(to), t);
    tl.fromTo(one(to), { y: H, rotation: 4, boxShadow: '0 -26px 60px rgba(0,0,0,.32)' },
      { y: 0, rotation: 0, boxShadow: '0 -26px 60px rgba(0,0,0,.32)', duration: dur, ease: 'power3.inOut' }, t);
    tl.set(one(to), { boxShadow: 'none' }, t + dur);
    tl.fromTo(one(from), { filter: 'brightness(1)' }, { filter: 'brightness(0.72)', duration: dur, ease: 'power2.in', immediateRender: false }, t);
    tl.set(one(from), { opacity: 0 }, t + dur);
    return t + dur;
  };

  // 박자 컷: 바로 바뀌고 새 장면 안쪽이 펀치인
  M.cut = (tl, from, to, t, o = {}) => {
    tl.set(one(from), { opacity: 0 }, t);
    lift(tl, one(to), t);
    if (o.inner) M.punch(tl, o.inner, t, o.punch || {});
    return t;
  };

  g.SynkMotion = M;
})(typeof window !== 'undefined' ? window : globalThis);

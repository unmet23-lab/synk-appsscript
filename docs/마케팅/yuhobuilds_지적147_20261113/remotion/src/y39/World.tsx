// 쪽지 세계 — 종이 279장이 프레임의 함수로 벽 → 더미 → 질문 카드로 바뀐다(CSS 애니메이션 없음).
// 벽의 147장 = 지적 하나씩, 더미에서 더해지는 132장 = 같은 말을 또 한 것. 더미 높이 = 되풀이 횟수(data.ts).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN, IN_OUT, mix, mixColor, prog } from '../lib/motion';
import { GROUPS, PAPERS, rnd } from './data';

export const WALL_BG = '#ECE8DF';
export const INK = '#15140F';
export const NOTE = '#F5C445';
export const NOTE_HI = '#FAD968';
export const PALE = '#D3CEC2';

export const WALL = { cols: 12, px: 84, py: 88, x0: 78, y0: 650, size: 76 };
export const PILE = { x0: 72, pitch: 49, w: 40, h: 21, lp: 26, base: 1668 };
export const CARD = { x0: 180, y0: 800, px: 180, py: 200, size: 150, cols: 5 };

// 기획 묶음이 왼쪽으로 모인 뒤의 자리
const MERGED: number[] = (() => {
  const plan = GROUPS.map((g, i) => (g.plan ? i : -1)).filter((i) => i >= 0);
  const rest = GROUPS.map((g, i) => (g.plan ? -1 : i)).filter((i) => i >= 0);
  const slot: number[] = [];
  [...plan, ...rest].forEach((g, s) => {
    slot[g] = s + (s >= plan.length ? 0.6 : 0);
  });
  return slot;
})();

export const pileX = (g: number, mergeP = 0) => PILE.x0 + mix(g, MERGED[g], mergeP) * PILE.pitch;
export const pileY = (level: number) => PILE.base - (level + 0.5) * PILE.lp;

export type TL = { enter: number; sort: number; sortLen: number; rep: number; repLen: number; last: number; pale: number; merge: number; collapse: number; cards: number };
export const NEVER = 1e9;

/** 더미 g에 지금 올라가 있는 장 수(숫자 표시용). */
const sortAt = (p: { i: number; g: number; level: number }, tl: TL) => tl.sort + (0.7 * (p.level / GROUPS[p.g].distinct) + 0.3 * rnd(p.i, 2)) * (tl.sortLen - 20);
const repAt = (p: { i: number; g: number; level: number }, tl: TL) => {
  const gr = GROUPS[p.g];
  return tl.rep + ((p.level - gr.distinct) / Math.max(1, gr.rep - gr.distinct)) * (tl.repLen - 6);
};

export const countIn = (g: number, f: number, tl: TL) => {
  let n = 0;
  for (const p of PAPERS) {
    if (p.g !== g) continue;
    if (p.distinct) n += f >= sortAt(p, tl) + 16 ? 1 : 0;
    else if (p.last) n += f >= tl.last ? 1 : 0;
    else n += f >= repAt(p, tl) + 3 ? 1 : 0;
  }
  return n;
};

export const World: React.FC<{ tl: TL; mark?: number }> = ({ tl, mark = 0 }) => {
  const f = useCurrentFrame();
  const paleP = prog(f, tl.pale, 10);
  const mergeP = prog(f, tl.merge, 22, IN_OUT);
  const colP = prog(f, tl.collapse, 18, IN_OUT);
  return (
    <AbsoluteFill>
      {PAPERS.map((p) => {
        const gr = GROUPS[p.g];
        const col = p.wall % WALL.cols;
        const row = Math.floor(p.wall / WALL.cols);
        const wx = WALL.x0 + col * WALL.px + (rnd(p.i, 7) - 0.5) * 12;
        const wy = WALL.y0 + row * WALL.py + (rnd(p.i, 8) - 0.5) * 12;
        const wr = (rnd(p.i, 9) - 0.5) * 11;
        const px = pileX(p.g, mergeP) + (rnd(p.i, 10) - 0.5) * 5;
        // 기획 더미는 모일 때 살짝 들려 넘어간다(다른 더미를 뚫고 지나가지 않게)
        const py0 = pileY(p.level) - (gr.plan && p.g !== 0 ? Math.sin(Math.PI * mergeP) * 240 : 0);
        const pr = (rnd(p.i, 11) - 0.5) * 5;
        let x = px;
        let y = py0;
        let w = PILE.w;
        let h = PILE.h;
        let rot = pr;
        let o = 1;
        let scr = 0;
        let sc = 1;
        if (p.distinct) {
          const t = prog(f, sortAt(p, tl), 20, IN_OUT);
          const e = prog(f, tl.enter + row * 1.5 + col * 0.35 - 12, 7);
          x = mix(wx, px, t);
          y = mix(wy, py0, t) - Math.sin(Math.PI * t) * 110;
          w = mix(WALL.size, PILE.w, t);
          h = mix(WALL.size, PILE.h, t);
          rot = mix(wr, pr, t) + Math.sin(Math.PI * t) * (rnd(p.i, 12) - 0.5) * 60;
          o = e;
          sc = 1 + 0.22 * (1 - e);
          scr = 1 - prog(f, sortAt(p, tl), 8);
        } else if (p.last) {
          const t = prog(f, tl.last - 24, 24, IN);
          // 11-13 최종 확인 「떨어지는 포스트잇이 제목을 가림」 — 머리 글 아래 높이에서, 더미 바로 위로만 떨어진다
          x = px + (1 - t) * 40;
          y = mix(py0 - 60, py0, t);
          w = mix(WALL.size * 1.4, PILE.w, t * t);
          h = mix(WALL.size * 1.4, PILE.h, t * t);
          rot = mix(-26, pr, t);
          o = f >= tl.last - 24 ? 1 : 0;
          scr = 1 - t;
        } else {
          const t = prog(f, repAt(p, tl), 6);
          y = py0 - (1 - t) * 34;
          o = t;
        }
        // 맨 위 장이 내려앉을 때 가장 높은 더미가 한 번 눌린다
        if (p.g === 0) {
          const d = f - tl.last;
          if (d >= 0 && d < 7) y += 12 * Math.sin((Math.PI * d) / 7) * (0.4 + 0.6 * (p.level / 38));
        }
        // 더미가 눌려 한 장씩만 남고 → 질문 카드
        let color = gr.plan ? NOTE : mixColor(NOTE, PALE, paleP);
        let q = 0;
        if (colP > 0) {
          y = mix(y, pileY(0), colP);
          if (p.level > 0) o *= 1 - prog(f, tl.collapse + 8, 10);
          else {
            const k = prog(f, tl.cards + p.g * 1.3, 16, IN_OUT);
            const slot = p.g;
            x = mix(x, CARD.x0 + (slot % CARD.cols) * CARD.px, k);
            y = mix(y, CARD.y0 + Math.floor(slot / CARD.cols) * CARD.py, k);
            w = mix(w, CARD.size, k);
            h = mix(h, CARD.size, k);
            rot = mix(rot, (rnd(p.i, 14) - 0.5) * 6, k);
            color = mixColor(color, NOTE_HI, k);
            q = prog(f, tl.cards + p.g * 1.3 + 9, 7);
            sc *= 1 - 0.12 * Math.sin(Math.PI * k);
          }
        }
        // 질문 카드가 깔린 동안 카드들이 천천히 숨쉰다(멈춘 화면이 되지 않게)
        if (q > 0) {
          const live = Math.max(0, f - tl.cards - 30);
          y += Math.sin(live / 11 + p.g * 0.9) * 7;
          rot += Math.sin(live / 14 + p.g) * 2.2;
        }
        if (o <= 0.001) return null;
        const big = w > 52;
        const hot = mark > 0 && p.g === 0;
        return (
          <div
            key={p.i}
            style={{
              position: 'absolute',
              left: x - w / 2,
              top: y - h / 2,
              width: w,
              height: h,
              opacity: o,
              transform: `rotate(${rot}deg) scale(${sc})`,
              background: q > 0 ? color : `linear-gradient(165deg, ${mixColor(NOTE_HI, color, color === NOTE ? 0 : 1)} 0%, ${color} 70%)`,
              borderRadius: big ? 3 : 2,
              boxShadow: big ? '0 7px 12px rgba(70,50,0,0.24), 0 1px 0 rgba(255,255,255,0.5) inset' : `0 2px 3px rgba(60,45,0,0.3)${hot ? `, 0 0 0 ${1.5 * mark}px ${INK}` : ''}`,
              overflow: 'hidden',
            }}
          >
            {scr > 0.02 && big ? (
              <div style={{ position: 'absolute', left: '14%', right: '12%', top: '24%', opacity: scr * 0.5 }}>
                {[0, 1, 2].map((k) => (
                  <div key={k} style={{ height: 4, borderRadius: 2, background: INK, marginBottom: 9, width: `${48 + rnd(p.i, 20 + k) * 50}%` }} />
                ))}
              </div>
            ) : null}
            {q > 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 900, fontSize: 84, color: INK, opacity: q }}>?</div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

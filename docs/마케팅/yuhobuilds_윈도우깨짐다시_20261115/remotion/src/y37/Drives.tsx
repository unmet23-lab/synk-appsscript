// 두 드라이브 판 — 위 1TB · 아래 2TB, 칸 하나가 같은 용량. 짝(같은 파일 두 벌)이 함께 켜지고, 클릭 뒤 한 벌만 빠진 다음 남은 칸이 내려앉는다.
// 전부 프레임의 함수(캔버스) — 어느 프레임을 뽑아도 같다.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { COLS, C_DEL, C_DEL_IDX, C_N, C_ROWS, C_USED0, D_KEPT_IDX, D_N, D_ROWS, D_USED0, PAIRS } from './data';

export const BUTTER = '#F5C445';
export const PANEL_X = 90;
export const PANEL_W = 900;
export const PITCH = PANEL_W / COLS;
export const C_TOP = 690;
export const D_TOP = 1110;

export type DriveBeat = {
  scan: readonly [number, number]; // 짝이 켜지는 구간
  del: number; // 클릭 뒤 빠지기 시작
  delLen: number;
  settle: number; // 남은 칸이 내려앉기 시작
  settleLen: number;
  keep: number; // 남길 옛 판 테두리
  keepOff?: number; // 남길 옛 판 테두리를 거두는 프레임
  pulse?: number; // 끝: 비운 자리를 밝은 띠가 한 번 훑는 프레임
};

/** 앞 이야기(편 전체에서만): 깨짐 → 통째 백업(1TB → 2TB) → 되살림(2TB → 1TB) → 무거운 자료 옮김(1TB 덩이 → 2TB 앞쪽). */
export type DriveStory = {
  broken: number;
  copy: number;
  copyLen: number;
  restore: number;
  restoreLen: number;
  move: number;
  moveLen: number;
  /** 판 속 이름표 · 바로가기 선(r3 — 이해 시험 s · h · G 「어느 칸이 백업이고 복구인지 · 바로가기가 어디인지」) */
  backupTag?: readonly [number, number];
  movedTag?: readonly [number, number];
  links?: readonly [number, number];
  oldCopy?: readonly [number, number];
  /** 11-15 다시: 예전 자리를 「여는」 한 동작 — 이 프레임에 1TB 옛 자리를 누르고, 빛이 점선을 따라 2TB 옮긴 자리로 간다(사후 최종 확인 P1 「점선이 무엇을 잇는지 안 읽힘」). */
  jump?: number;
};

/** 바로가기 동작이 쓰는 두 자리(캔버스 좌표) — 1TB 첫 옛 사본 덩이의 첫 칸, 2TB 옮긴 자리의 첫 칸. Film이 커서를 같은 자리에 둔다. */
export const shortcutSpots = () => {
  const [sx, sy] = pos(C_TOP, linkCell(RUNS[0]));
  const runLen = (RUNS[1] ?? C_DEL) - RUNS[0];
  const [tx, ty] = pos(D_TOP, Math.floor(runLen / 2)); // 옮긴 덩이의 가운데 — 「새 2TB」 이름표와 겹치지 않게
  return { from: [sx + PITCH / 2, sy + PITCH / 2] as const, to: [tx + PITCH / 2, ty + PITCH / 2] as const, runLen };
};

const span = (f: number, w?: readonly [number, number]) => (w ? clamp01((f - w[0]) / 8) * clamp01((w[1] - f) / 8) : 0);
/** 1TB 옛 사본 덩이의 시작 차례(C_DEL_IDX가 덩이로 이어진 자리). */
const RUNS: number[] = C_DEL_IDX.reduce<number[]>((a, v, k) => (k === 0 || v !== C_DEL_IDX[k - 1] + 1 ? [...a, k] : a), []);
/** 11-15 다시(사실 검수 6): 바로가기는 원래 경로에 따로 남는 작은 표식이라, 옛 사본 덩이 바로 앞의 지워지지 않는 1TB 칸에 붙인다. */
const linkCell = (runStart: number) => {
  const roles = ROLES();
  let i = C_DEL_IDX[runStart] - 1;
  while (i > 0 && roles.c[i].kind !== 'normal') i--;
  return Math.max(0, i);
};
let rolesCache: ReturnType<typeof buildRoles> | null = null;
const ROLES = () => (rolesCache ??= buildRoles());

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t;
const hash = (i: number) => {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

type Role = { kind: 'normal' | 'del' | 'twin' | 'kept'; rank: number };

function buildRoles() {
  const c: Role[] = Array.from({ length: C_USED0 }, () => ({ kind: 'normal', rank: -1 }));
  const d: Role[] = Array.from({ length: D_USED0 }, () => ({ kind: 'normal', rank: -1 }));
  PAIRS.forEach((p, k) => {
    const [side, delIdx, twinIdx] = p;
    if (side === 0) {
      c[delIdx] = { kind: 'del', rank: k };
      d[twinIdx] = { kind: 'twin', rank: k };
    } else {
      d[delIdx] = { kind: 'del', rank: k };
      c[twinIdx] = { kind: 'twin', rank: k };
    }
  });
  for (const i of D_KEPT_IDX) d[i] = { kind: 'kept', rank: -1 };
  // 내려앉은 뒤 자리: 남는 칸의 차례
  const newPos = (roles: Role[]) => {
    let n = 0;
    return roles.map((r) => (r.kind === 'del' ? -1 : n++));
  };
  return { c, d, cNew: newPos(c), dNew: newPos(d) };
}

const pos = (top: number, i: number) => [PANEL_X + (i % COLS) * PITCH, top + Math.floor(i / COLS) * PITCH] as const;

export const Drives: React.FC<{ beat: DriveBeat; story?: DriveStory; dim?: number; showKept?: boolean }> = ({ beat, story, dim = 0, showKept = false }) => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const roles = useMemo(buildRoles, []);
  const N = PAIRS.length;

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const x = cv.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, 1080, 1920);
    const size = PITCH - 2.6;
    const scanP = clamp01((f - beat.scan[0]) / (beat.scan[1] - beat.scan[0]));
    const settleP = ease(clamp01((f - beat.settle) / beat.settleLen));

    const panel = (top: number, rows: number, total: number) => {
      // 빈 칸(용량)은 옅은 테두리
      x.fillStyle = '#0F1114';
      x.fillRect(PANEL_X - 10, top - 10, PANEL_W + 20, rows * PITCH + 20);
      x.strokeStyle = 'rgba(255,255,255,0.10)';
      x.lineWidth = 1;
      for (let i = 0; i < total; i++) {
        const [px, py] = pos(top, i);
        x.strokeRect(px + 1.3, py + 1.3, size, size);
      }
    };
    panel(C_TOP, C_ROWS, C_N);
    panel(D_TOP, D_ROWS, D_N);
    // 비운 용량: 내려앉은 뒤 비워진 칸(지우기 전 쓰던 칸 수 → 지운 뒤 칸 수 사이)은 빈 칸 그대로 두고 버터 테두리만 —
    // 11-15 다시: 사후 최종 확인 P1 「끝 카드의 1TB가 버터로 칠해져 거의 꽉 차 보임」 → 칠하지 않고 빈 칸 꼴(여유 숫자도 버터).
    if (settleP > 0) {
      // 칸 하나하나는 빈 칸 그대로(옅은 버터 기운만), 비운 영역 전체의 바깥선만 굵은 버터 — 「여기가 비었다」로 읽히게.
      const glow = (top: number, from: number, to: number) => {
        const inR = (j: number) => j >= from && j < to;
        const q = clamp01(settleP * 1.4);
        if (q <= 0) return;
        for (let i = from; i < to; i++) {
          const [px, py] = pos(top, i);
          x.globalAlpha = q * 0.13 * (1 - dim * 0.7);
          x.fillStyle = BUTTER;
          x.fillRect(px + 1.3, py + 1.3, size, size);
          if (beat.pulse !== undefined && f >= beat.pulse && f < beat.pulse + 40) {
            const cx = ((f - beat.pulse) / 40) * (COLS + 12) - 6;
            const b = clamp01(1 - Math.abs((i % COLS) - cx) / 5);
            if (b > 0) {
              x.globalAlpha = b * 0.35 * (1 - dim * 0.7);
              x.fillRect(px + 1.3, py + 1.3, size, size);
            }
          }
        }
        x.globalAlpha = q * (1 - dim * 0.7);
        x.strokeStyle = BUTTER;
        x.lineWidth = 3.2;
        x.beginPath();
        for (let i = from; i < to; i++) {
          const [px, py] = pos(top, i);
          const col = i % COLS;
          if (!inR(i - COLS)) { x.moveTo(px, py); x.lineTo(px + PITCH, py); }
          if (!inR(i + COLS)) { x.moveTo(px, py + PITCH); x.lineTo(px + PITCH, py + PITCH); }
          if (col === 0 || !inR(i - 1)) { x.moveTo(px, py); x.lineTo(px, py + PITCH); }
          if (col === COLS - 1 || !inR(i + 1)) { x.moveTo(px + PITCH, py); x.lineTo(px + PITCH, py + PITCH); }
        }
        x.stroke();
        x.globalAlpha = 1;
      };
      glow(C_TOP, roles.c.length - roles.c.filter((r) => r.kind === 'del').length, roles.c.length);
      glow(D_TOP, roles.d.length - roles.d.filter((r) => r.kind === 'del').length, roles.d.length);
    }

    const draw = (top: number, list: Role[], newPos: number[]) => {
      list.forEach((r, i) => {
        const [ox, oy] = pos(top, i);
        let px = ox;
        let py = oy;
        let alpha = 1;
        const shade = 0.82 + 0.18 * hash(i * 7 + top);
        let col: [number, number, number] = [217 * shade, 213 * shade, 205 * shade];
        let lit = 0;
        if (r.rank >= 0) {
          const at = r.rank / N;
          lit = clamp01((scanP - at) * N / 40 + (scanP > at ? 0.5 : 0));
          if (scanP <= at) lit = 0;
        }
        if (r.kind === 'del' && lit > 0) col = [col[0] + (245 - col[0]) * lit, col[1] + (196 - col[1]) * lit, col[2] + (69 - col[2]) * lit];
        // 「남김」 박자(11-15 다시 — 사후 최종 확인 P1 「색이 넷으로 섞이고 노랑이 클릭 전에 사라짐」):
        // 지울 칸은 노랑 그대로 두고(클릭 순간에 빔), 남길 옛 판은 회색 그대로 흰 테두리만 — 색은 회색 · 노랑 · 흰 테 셋.
        if (r.kind === 'twin' && r.rank >= 0 && scanP > r.rank / N) {
          // 짝이 켜지는 순간 남는 쪽은 하얗게 한 번 번쩍였다 제 색으로 — 「같은 것이 저기에도 있다」
          const flash = clamp01(1 - (scanP - r.rank / N) * N / 90);
          col = [col[0] + (255 - col[0]) * flash, col[1] + (255 - col[1]) * flash, col[2] + (255 - col[2]) * flash];
        }
        if (story) {
          const isC = top === C_TOP;
          const rowT = Math.floor(i / COLS) / (isC ? C_ROWS : D_ROWS);
          if (isC) {
            const back = story.restore + rowT * story.restoreLen * 0.8 + hash(i + 5) * story.restoreLen * 0.2;
            if (f >= story.broken && f < back) {
              const g = f - story.broken;
              if (g < 14) {
                // 깨지는 순간: 줄마다 옆으로 찢기고 깜빡이다
                const band = Math.floor(i / COLS / 3);
                px += (hash(band * 31 + f) - 0.5) * 70 * (1 - g / 14);
                alpha = hash(i * 13 + f) > 0.35 + g / 30 ? 1 : 0.2;
                col = hash(band + f * 3) > 0.7 ? [255, 255, 255] : col;
              } else {
                const dead = hash(i * 29 + 7) < 0.14;
                col = dead ? [24, 25, 28] : [col[0] * 0.42, col[1] * 0.42, col[2] * 0.44];
                // 11-15 다시(사후 최종 확인 P2 「첫 5초 2.9초 멈춤」): 깨진 판의 줄 몇 개가 0.13초마다 번갈아 끊겼다 켜진다
                const band = Math.floor(i / COLS);
                const flick = hash(band * 53 + Math.floor(g / 4) * 977) > 0.82;
                if (flick) {
                  px += (hash(band * 17 + Math.floor(g / 4)) - 0.5) * 22;
                  alpha = 0.55;
                }
              }
            } else if (f >= back && f < back + 8) {
              const q = (f - back) / 8;
              col = [col[0] + (255 - col[0]) * (1 - q), col[1] + (255 - col[1]) * (1 - q), col[2] + (255 - col[2]) * (1 - q)];
            }
            // 「옮기기 전 사본」: 1TB에 남은 옛 사본 덩이가 숨 쉬듯 밝아진다
            const oc = span(f, story.oldCopy);
            if (oc > 0 && r.kind === 'del') {
              const q = oc * (0.55 + 0.45 * Math.sin((f - (story.oldCopy?.[0] ?? 0)) / 4));
              col = [col[0] + (255 - col[0]) * q, col[1] + (255 - col[1]) * q * 0.95, col[2] + (255 - col[2]) * q * 0.7];
            }
            // 옮기는 동안 옮겨 가는 덩이(옛 사본)가 하얗게 한 번
            if (r.kind === 'del' && f >= story.move && f < story.move + story.moveLen + 10) {
              const k = C_DEL_IDX.indexOf(i);
              const at = story.move + (k / C_DEL) * story.moveLen;
              const q = clamp01(1 - Math.abs(f - at) / 8);
              col = [col[0] + (255 - col[0]) * q, col[1] + (255 - col[1]) * q, col[2] + (255 - col[2]) * q];
            }
          } else {
            const moved = i < C_DEL;
            const src = moved ? C_DEL_IDX[i] : (i * 7919) % C_USED0;
            const start = moved ? story.move + (i / C_DEL) * story.moveLen : story.copy + rowT * story.copyLen * 0.85 + hash(i + 9) * story.copyLen * 0.15;
            if (f < start) return;
            const q = clamp01((f - start) / (moved ? 18 : 12));
            if (q < 1) {
              const [sx, sy] = pos(C_TOP, src);
              const e = ease(q);
              px = sx + (ox - sx) * e;
              py = sy + (oy - sy) * e;
              col = [255, 255, 255];
              alpha = 0.5 + 0.5 * q;
            }
          }
        }
        if (r.kind === 'del' && f >= beat.del) {
          const delay = (r.rank / N) * beat.delLen * 0.55 + hash(i + 3) * beat.delLen * 0.15;
          const q = clamp01((f - beat.del - delay) / (beat.delLen * 0.3));
          if (q >= 1) return;
          py += easeIn(q) * 260;
          px += (hash(i + 11) - 0.5) * 40 * q;
          alpha = 1 - q;
          col = [255, 236 - 40 * q, 160 - 90 * q];
        }
        if (r.kind === 'twin' && f >= beat.del) {
          const back = clamp01((f - beat.del - (r.rank / N) * beat.delLen * 0.55) / 10);
          col = [col[0] + (217 * shade - col[0]) * back, col[1] + (213 * shade - col[1]) * back, col[2] + (205 * shade - col[2]) * back];
        }
        if (settleP > 0 && newPos[i] >= 0 && newPos[i] !== i) {
          const [nx, ny] = pos(top, newPos[i]);
          const rows = top === C_TOP ? C_ROWS : D_ROWS;
          const tIn = clamp01(settleP * 1.3 - (Math.floor(newPos[i] / COLS) / rows) * 0.3);
          const fill = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
          x.fillStyle = fill;
          x.globalAlpha = alpha * (1 - tIn) * (1 - dim * 0.7);
          x.fillRect(px + 1.3, py + 1.3, size, size);
          x.globalAlpha = alpha * tIn * (1 - dim * 0.7);
          x.fillRect(nx + 1.3, ny + 1.3, size, size);
          x.globalAlpha = 1;
          return;
        }
        x.globalAlpha = alpha * (1 - dim * 0.7);
        x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        x.fillRect(px + 1.3, py + 1.3, size, size);
        if (showKept && r.kind === 'kept' && f >= beat.keep) {
          const k = clamp01((f - beat.keep) / 8) * (beat.keepOff === undefined ? 1 : clamp01((beat.keepOff - f) / 8));
          x.globalAlpha = k * (1 - dim * 0.7);
          x.strokeStyle = '#FFFFFF';
          x.lineWidth = 3;
          x.strokeRect(px - 0.2, py - 0.2, size + 3, size + 3);
        }
        x.globalAlpha = 1;
      });
    };
    draw(C_TOP, roles.c, roles.cNew);
    draw(D_TOP, roles.d, roles.dNew);
    if (story) {
      const tag = (text: string, px: number, py: number, a: number) => {
        if (a <= 0) return;
        x.globalAlpha = a * (1 - dim * 0.7);
        x.font = "800 40px 'SUIT'";
        const w = x.measureText(text).width;
        const bx0 = px - 20;
        const by0 = py - 44;
        const bw = w + 40;
        const bh = 60;
        x.fillStyle = 'rgba(10,11,14,0.94)';
        x.beginPath();
        x.roundRect(bx0, by0, bw, bh, 30);
        x.fill();
        x.fillStyle = '#FFFFFF';
        x.fillText(text, px, py);
        x.globalAlpha = 1;
      };
      // 바로가기 선: 1TB 옛 자리 → 2TB 옮긴 자리. 11-15 다시: 「여는」 동작(jump) 동안 다른 선은 옅어지고 첫 선 하나만 굵게,
      // 빛 한 점이 그 선을 따라 2TB로 가고 끝에 화살촉 — 도착하면 2TB 옮긴 자리 덩이가 하얗게 켜진다.
      const la = span(f, story.links);
      const jt = story.jump !== undefined ? f - story.jump : -1;
      const focus = jt >= 0 ? clamp01(jt / 6) : 0;
      if (la > 0) {
        x.globalAlpha = la * 0.9 * (1 - 0.88 * focus);
        for (const [w, c] of [[8, '#0A0B0E'], [3, '#FFFFFF']] as const) {
          x.strokeStyle = c;
          x.lineWidth = w;
          x.setLineDash(c === '#FFFFFF' ? [12, 9] : []);
          for (const k of RUNS) {
            if (focus > 0 && k === RUNS[0]) continue;
            const [sx, sy] = pos(C_TOP, linkCell(k));
            const [tx, ty] = pos(D_TOP, k);
            x.beginPath();
            x.moveTo(sx + PITCH / 2, sy + PITCH / 2);
            x.lineTo(tx + PITCH / 2, ty + PITCH / 2);
            x.stroke();
          }
        }
        x.setLineDash([]);
        x.globalAlpha = 1;
      }
      if (la > 0 && focus > 0) {
        const s = shortcutSpots();
        const [ax, ay] = s.from;
        const [bx2, by2] = s.to;
        const travel = ease(clamp01((jt - 4) / 18)); // 0.13초 뒤 출발, 0.6초에 도착
        x.globalAlpha = la;
        // 굵은 길(검은 테 + 흰 점선)
        for (const [w, c] of [[14, '#0A0B0E'], [5, '#FFFFFF']] as const) {
          x.strokeStyle = c;
          x.lineWidth = w;
          x.setLineDash(c === '#FFFFFF' ? [16, 10] : []);
          x.beginPath();
          x.moveTo(ax, ay);
          x.lineTo(bx2, by2);
          x.stroke();
        }
        x.setLineDash([]);
        // 화살촉(2TB 쪽)
        const ang = Math.atan2(by2 - ay, bx2 - ax);
        x.fillStyle = '#FFFFFF';
        x.beginPath();
        x.moveTo(bx2, by2);
        x.lineTo(bx2 - 30 * Math.cos(ang - 0.42), by2 - 30 * Math.sin(ang - 0.42));
        x.lineTo(bx2 - 30 * Math.cos(ang + 0.42), by2 - 30 * Math.sin(ang + 0.42));
        x.closePath();
        x.fill();
        // 연 자리 고리(1TB)
        x.strokeStyle = '#FFFFFF';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(ax, ay, 16 + 10 * clamp01(jt / 8), 0, Math.PI * 2);
        x.stroke();
        // 길을 따라 가는 빛
        if (travel > 0 && travel < 1) {
          const px2 = ax + (bx2 - ax) * travel;
          const py2 = ay + (by2 - ay) * travel;
          const g2 = x.createRadialGradient(px2, py2, 0, px2, py2, 34);
          g2.addColorStop(0, 'rgba(255,255,255,1)');
          g2.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g2;
          x.beginPath();
          x.arc(px2, py2, 34, 0, Math.PI * 2);
          x.fill();
        }
        // 도착: 2TB 옮긴 자리 덩이가 하얗게 켜졌다 잦아든다
        const arrive = clamp01((jt - 22) / 4) * clamp01(1 - (jt - 26) / 30);
        if (arrive > 0) {
          for (let i = 0; i < s.runLen; i++) {
            const [cx2, cy2] = pos(D_TOP, i);
            x.globalAlpha = la * arrive;
            x.fillStyle = '#FFFFFF';
            x.fillRect(cx2 + 1.3, cy2 + 1.3, size, size);
          }
        }
        x.globalAlpha = 1;
      }
      const [bx, by] = pos(D_TOP, 334 + 90 + COLS * 2);
      tag('백업', bx + 12, by + 46, span(f, story.backupTag));
      tag('옮긴 자료', PANEL_X + 300, D_TOP + 96, span(f, story.movedTag));
      const [ox, oy] = pos(C_TOP, linkCell(RUNS[0]));
      // 바로가기 칸: 흰 테 작은 표식(지워지지 않는 칸)
      if (la > 0) {
        x.globalAlpha = la * (1 - dim * 0.7);
        x.strokeStyle = '#FFFFFF';
        x.lineWidth = 3;
        for (const k of RUNS) {
          const [lx, ly] = pos(C_TOP, linkCell(k));
          x.strokeRect(lx - 1, ly - 1, PITCH + 2, PITCH + 2);
        }
        x.globalAlpha = 1;
      }
      tag('바로가기', Math.min(ox + 12, PANEL_X + PANEL_W - 230), oy - 26, la); // 11-15 다시: 고리 위 — 누르는 커서가 이름표를 가리지 않게
      const [qx, qy] = pos(C_TOP, C_DEL_IDX[RUNS[Math.min(2, RUNS.length - 1)]]);
      tag('옮기기 전 사본', Math.min(qx + 12, PANEL_X + PANEL_W - 340), qy + 46, span(f, story.oldCopy));
    }
  }, [f, beat, story, dim, roles, N, showKept]);

  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }} />;
};

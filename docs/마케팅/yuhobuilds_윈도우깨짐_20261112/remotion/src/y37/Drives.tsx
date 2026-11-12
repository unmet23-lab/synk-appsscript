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
export const D_TOP = 1080;

export type DriveBeat = {
  scan: readonly [number, number]; // 짝이 켜지는 구간
  del: number; // 클릭 뒤 빠지기 시작
  delLen: number;
  settle: number; // 남은 칸이 내려앉기 시작
  settleLen: number;
  keep: number; // 남길 옛 판 테두리
  keepOff?: number; // 남길 옛 판 테두리를 거두는 프레임
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
};

const span = (f: number, w?: readonly [number, number]) => (w ? clamp01((f - w[0]) / 8) * clamp01((w[1] - f) / 8) : 0);
/** 1TB 옛 사본 덩이의 시작 차례(C_DEL_IDX가 덩이로 이어진 자리). */
const RUNS: number[] = C_DEL_IDX.reduce<number[]>((a, v, k) => (k === 0 || v !== C_DEL_IDX[k - 1] + 1 ? [...a, k] : a), []);

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
    // 비운 자리: 내려앉은 뒤 비워진 칸(지우기 전 쓰던 칸 수 → 지운 뒤 칸 수 사이)이 버터로 물든다
    if (settleP > 0) {
      const glow = (top: number, from: number, to: number) => {
        for (let i = from; i < to; i++) {
          const [px, py] = pos(top, i);
          const q = clamp01(settleP * 1.6 - ((i - from) / Math.max(1, to - from)) * 0.6);
          if (q <= 0) continue;
          x.globalAlpha = q * 0.85 * (1 - dim * 0.7);
          x.fillStyle = BUTTER;
          x.fillRect(px + 1.3, py + 1.3, size, size);
        }
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
        // 「남김」 박자: 지울 칸은 가라앉고 남길 옛 판만 하얗게 선다
        const keepOn = showKept && f >= beat.keep && (beat.keepOff === undefined || f < beat.keepOff + 8) ? clamp01((f - beat.keep) / 8) * (beat.keepOff === undefined ? 1 : clamp01((beat.keepOff + 8 - f) / 8)) : 0;
        if (keepOn > 0 && r.kind === 'del') col = [col[0] * (1 - 0.55 * keepOn), col[1] * (1 - 0.55 * keepOn), col[2] * (1 - 0.55 * keepOn)];
        if (keepOn > 0 && r.kind === 'kept') col = [col[0] + (255 - col[0]) * keepOn, col[1] + (255 - col[1]) * keepOn, col[2] + (255 - col[2]) * keepOn];
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
                alpha = 0.13;
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
        if (settleP > 0 && newPos[i] >= 0) {
          const [nx, ny] = pos(top, newPos[i]);
          px = ox + (nx - ox) * settleP;
          py = oy + (ny - oy) * settleP;
        }
        x.globalAlpha = alpha * (1 - dim * 0.7);
        x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        x.fillRect(px + 1.3, py + 1.3, size, size);
        if (showKept && r.kind === 'kept' && f >= beat.keep) {
          const k = clamp01((f - beat.keep) / 8) * (beat.keepOff === undefined ? 1 : clamp01((beat.keepOff - f) / 8));
          x.globalAlpha = k * (1 - dim * 0.7);
          x.strokeStyle = '#FFFFFF';
          x.lineWidth = 2.4;
          x.strokeRect(px + 0.2, py + 0.2, size + 2.2, size + 2.2);
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
        x.font = "900 50px 'SUIT'";
        x.lineJoin = 'round';
        x.lineWidth = 10;
        x.strokeStyle = 'rgba(255,255,255,0.95)';
        x.strokeText(text, px, py);
        x.fillStyle = '#0A0B0E';
        x.fillText(text, px, py);
        x.globalAlpha = 1;
      };
      // 바로가기 선: 1TB 옛 자리 → 2TB 옮긴 자리
      const la = span(f, story.links);
      if (la > 0) {
        x.globalAlpha = la * 0.75;
        x.strokeStyle = '#FFFFFF';
        x.lineWidth = 2.5;
        x.setLineDash([10, 8]);
        for (const k of RUNS) {
          const [sx, sy] = pos(C_TOP, C_DEL_IDX[k]);
          const [tx, ty] = pos(D_TOP, k);
          x.beginPath();
          x.moveTo(sx + PITCH / 2, sy + PITCH / 2);
          x.lineTo(tx + PITCH / 2, ty + PITCH / 2);
          x.stroke();
        }
        x.setLineDash([]);
        x.globalAlpha = 1;
      }
      const [bx, by] = pos(D_TOP, 334 + 90 + COLS * 2);
      tag('백업', bx + 12, by + 46, span(f, story.backupTag));
      tag('옮긴 자료', PANEL_X + 300, D_TOP + 50, span(f, story.movedTag));
      const [ox, oy] = pos(C_TOP, C_DEL_IDX[RUNS[0]]);
      tag('바로가기', Math.min(ox + 12, PANEL_X + PANEL_W - 230), oy + 46, la);
      const [qx, qy] = pos(C_TOP, C_DEL_IDX[RUNS[Math.min(2, RUNS.length - 1)]]);
      if (showKept) {
        const [kx, ky] = pos(D_TOP, D_KEPT_IDX[Math.floor(D_KEPT_IDX.length * 0.45)]);
        tag('남김', Math.min(kx + 12, PANEL_X + PANEL_W - 120), ky - 12, span(f, [beat.keep, beat.keepOff ?? beat.keep + 60]));
      }
      tag('옮기기 전 사본', Math.min(qx + 12, PANEL_X + PANEL_W - 340), qy + 46, span(f, story.oldCopy));
    }
  }, [f, beat, story, dim, roles, N, showKept]);

  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }} />;
};

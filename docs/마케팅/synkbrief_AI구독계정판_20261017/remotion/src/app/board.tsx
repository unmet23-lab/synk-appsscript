// 앱이 그린 계정판 HTML(scripts/board-html.mjs → boards.json)을 영상에 얹는 부품.
// 글·숫자는 손대지 않고, 영상에서 바꾸는 것은 고리를 그린 정도·크레용 동그라미·보이는 정도(불투명도)뿐이다.
import { evolvePath } from '@remotion/paths';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import { BOARD_TOKENS, C } from '../theme';
import boards from './boards.json';

export type BoardKey = keyof typeof boards;
const ART = staticFile('app/benefit-subscriptions.webp');

/** 앱 HTML 한 판. 휴대폰 폭 배치(ms-phone: 앱 @media max-width:760px의 포스터 규칙)를 붙인다. */
export const boardHtml = (key: BoardKey): string => (boards as Record<string, string>)[key].replace('__ART__', ART).replace('<div class="member-subs', '<div class="member-subs ms-phone');

/** 고리 그리기: 앱 고리(ms-arc, 10-18 밤부터 쓴 만큼 찬다)를 p(0~1)만큼만 그린다. ps가 배열이면 i번째 고리에 ps[i]. 0이면 고리 바닥만.
 * 번호는 고리(svg.ms-ring)마다 매긴다 — 0%라 호가 없는 고리도 번호 하나를 써서 다음 줄 고리가 앞당겨지지 않는다(v5 Fable). */
export function drawArcs(html: string, ps: number | number[]): string {
  let i = 0;
  return html.replace(/<svg class="ms-ring"[\s\S]*?<\/svg>/g, (ring) => {
    const p = Array.isArray(ps) ? (ps[i] ?? 1) : ps;
    i += 1;
    return ring.replace(/<circle class="ms-arc"([^>]*)\/>/g, (m, attrs: string) => {
      if (p >= 1) return m;
      if (p <= 0.001) return '';
      if (attrs.includes('data-full')) return `<circle class="ms-arc"${attrs} style="opacity:${p.toFixed(3)}"/>`;
      return m.replace(/stroke-dashoffset="([\d.]+)"/, (_, off: string) => `stroke-dashoffset="${(100 - (100 - Number(off)) * p).toFixed(2)}"`);
    });
  });
}

const RING = 'M 30 60 C 30 15, 330 5, 380 50 C 420 95, 120 125, 40 95 C 10 85, 20 40, 60 30';
/** 크레용 동그라미(v5 급한 것 장면과 같은 붓): match가 처음 맞는 자리를 감싸 그 위에 p만큼 두른다.
 * match는 글 조각(정확히 같은 HTML) 또는 정규식(요소 하나 전체가 맞게). 못 찾으면 멈춘다(조용히 빠지지 않게). */
export function ringAround(html: string, match: string | RegExp, p: number, id: string, pad: { x: number; y: number } = { x: 22, y: 14 }): string {
  let at: number;
  let piece: string;
  if (typeof match === 'string') {
    at = html.indexOf(match);
    piece = match;
  } else {
    const m = match.exec(html);
    at = m ? m.index : -1;
    piece = m ? m[0] : '';
  }
  if (at < 0) throw new Error(`크레용 동그라미 자리를 못 찾음: ${String(match)}`);
  let svg = '';
  if (p > 0) {
    const ev = evolvePath(Math.min(1, p), RING);
    svg = `<svg viewBox="0 0 420 130" preserveAspectRatio="none" style="position:absolute;left:-${pad.x}px;top:-${pad.y}px;width:calc(100% + ${2 * pad.x}px);height:calc(100% + ${2 * pad.y}px);overflow:visible;pointer-events:none"><defs><filter id="rough-${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter></defs><path d="${RING}" fill="none" stroke="${C.crayon}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ev.strokeDasharray}" stroke-dashoffset="${ev.strokeDashoffset}" style="filter:url(#rough-${id})"/></svg>`;
  }
  return `${html.slice(0, at)}<span class="mt-mark" style="position:relative;display:inline-block">${piece}${svg}</span>${html.slice(at + piece.length)}`;
}

/** 계정판 한 판: 앱 토큰을 깔고 폭·줌(zoom: 키운 만큼 자리도 커져 떠 있는 판이 내용을 자르지 않는다)을 준다.
 * css는 장면 전용 규칙(cls 아래로 한정). 앱 화면을 자르는(감추는) 데만 쓰고 앱에 없는 글·상태는 넣지 않는다. */
export const AppBoard: React.FC<{ html: string; width: number; scale: number; cls: string; css?: string; style?: React.CSSProperties }> = ({ html, width, scale, cls, css, style }) => (
  <div className={cls} style={{ ...(BOARD_TOKENS as React.CSSProperties), width, zoom: scale, ...style }}>
    {css ? <style>{css}</style> : null}
    <div dangerouslySetInnerHTML={{ __html: html }} />
  </div>
);

export type Box = { x: number; y: number; w: number; h: number };
/** 자리 재기: 같은 판을 화면 밖에 카메라 변형 없이 한 벌 더 그려, 고른 요소의 자리를 판 왼쪽 위 기준 화면 px(줌 포함)로 잰다.
 * 서체가 다 실린 뒤 한 번만 재고 그동안 렌더를 기다리게 한다(프레임마다 같은 값). */
export function useBoardBoxes(html: string, width: number, scale: number, cls: string, css: string | undefined, selectors: string[]): [Record<string, Box> | null, React.ReactNode] {
  const ref = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Record<string, Box> | null>(null);
  const [handle] = useState(() => delayRender('계정판 자리 재기'));
  useLayoutEffect(() => {
    let done = false;
    document.fonts.ready.then(() => {
      if (done) return;
      const root = ref.current;
      if (!root) return;
      const base = root.getBoundingClientRect();
      const out: Record<string, Box> = {};
      for (const s of selectors) {
        const el = root.querySelector(s);
        if (!el) throw new Error(`자리를 잴 요소를 못 찾음: ${s}`);
        const r = el.getBoundingClientRect();
        out[s] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      }
      setBoxes(out);
      continueRender(handle);
    });
    return () => {
      done = true;
    };
    // 판·폭·줌·규칙이 같으면 다시 재지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, width, scale, css]);
  const probe = (
    <div aria-hidden="true" style={{ position: 'absolute', left: -30000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      <div ref={ref}>
        <AppBoard html={html} width={width} scale={scale} cls={cls} css={css} />
      </div>
    </div>
  );
  return [boxes, probe];
}

/** 차례로 나타나기: n번째 요소(nth-child)의 불투명도·자리를 프레임마다 정하는 장면 규칙. */
export const staggerCss = (selector: string, ps: number[], dy = 16) =>
  ps.map((p, i) => `${selector}:nth-child(${i + 1}){opacity:${Math.max(0, Math.min(1, p)).toFixed(3)};translate:0 ${((1 - Math.max(0, Math.min(1, p))) * dy).toFixed(1)}px}`).join('\n');

import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {ASSET, theme} from './theme';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
export const rise = (frame: number, delay = 0, amount = 28) => interpolate(frame, [delay, delay + 24], [amount, 0], {...clamp, easing: ease});
export const appear = (frame: number, delay = 0) => interpolate(frame, [delay, delay + 18], [0, 1], clamp);
export const progress = (frame: number, start: number, end: number) => interpolate(frame, [start, Math.max(start + 1, end)], [0, 1], {...clamp, easing: ease});

export const Page: React.FC<React.PropsWithChildren<{dark?: boolean; chapter: string; tag?: string}>> = ({children, dark = false, chapter, tag}) => (
  <AbsoluteFill style={{background: dark ? theme.black : theme.paper, color: dark ? theme.paper : theme.black, fontFamily: theme.font, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 88, right: 114, top: 152, display: 'flex', justifyContent: 'space-between', fontSize: 27, fontWeight: 600, letterSpacing: '.03em', opacity: .64}}>
      <span>yuhobuilds</span><span>첫 앱을 만들던 6월 / 01</span>
    </div>
    {children}
    {tag ? <div style={{position: 'absolute', left: 88, right: 114, top: 1355, fontSize: 29, lineHeight: 1.35, fontWeight: 500, opacity: .64}}>{tag}</div> : null}
    <div style={{position: 'absolute', left: 88, right: 114, top: 1760, display: 'flex', justifyContent: 'space-between', fontSize: 27, fontWeight: 500, opacity: .56}}><span>@yuhobuilds</span><span>{chapter}</span></div>
  </AbsoluteFill>
);

export const Title: React.FC<React.PropsWithChildren<{top?: number; size?: number; delay?: number; width?: number}>> = ({children, top = 282, size = 92, delay = 0, width = 878}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', left: 88, top, width, fontSize: size, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1.16, whiteSpace: 'pre-line', wordBreak: 'keep-all', opacity: appear(f, delay), translate: `0 ${rise(f, delay)}px`}}>{children}</div>;
};

export const Sub: React.FC<React.PropsWithChildren<{top: number; size?: number; delay?: number; style?: React.CSSProperties}>> = ({children, top, size = 46, delay = 12, style}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', left: 88, right: 114, top, fontSize: size, lineHeight: 1.4, letterSpacing: '-.025em', whiteSpace: 'pre-line', wordBreak: 'keep-all', opacity: appear(f, delay), translate: `0 ${rise(f, delay, 16)}px`, ...style}}>{children}</div>;
};

export const Felt: React.FC<{dark?: boolean; style?: React.CSSProperties}> = ({dark = false, style}) => dark ? <Img src={staticFile(ASSET + 'felt-dark.webp')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style}}/> : <div style={{position: 'absolute', inset: 0, background: theme.paper, ...style}}/>;

export const Glass: React.FC<React.PropsWithChildren<{dark?: boolean; style?: React.CSSProperties}>> = ({children, dark = false, style}) => (
  <div style={{position: 'absolute', overflow: 'hidden', borderRadius: 34, background: dark ? `linear-gradient(135deg, ${theme.light(.12)}, ${theme.light(.035)})` : `linear-gradient(135deg, ${theme.light(.96)}, ${theme.light(.65)})`, border: `2px solid ${dark ? theme.light(.22) : theme.shadow(.12)}`, boxShadow: `inset 0 2px 1px ${theme.light(.85)}, inset -2px -2px 3px ${theme.shadow(.1)}, 0 24px 55px ${theme.shadow(dark ? .2 : .1)}`, ...style}}>{children}</div>
);

export const Arrow: React.FC<{x: number; y: number; length?: number; dark?: boolean; vertical?: boolean; value?: number}> = ({x, y, length = 130, dark = false, vertical = false, value = 1}) => <svg viewBox={`0 0 ${length + 20} 30`} width={length + 20} height={30} style={{position: 'absolute', left: x, top: y, rotate: vertical ? '90deg' : '0deg', transformOrigin: '15px 15px', opacity: value}}><path d={`M4 15 H${length} M${length - 12} 4 L${length} 15 L${length - 12} 26`} fill="none" stroke={dark ? theme.paper : theme.black} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export const BrowserFrame: React.FC<React.PropsWithChildren<{label?: string; dark?: boolean; style?: React.CSSProperties}>> = ({children, label = '작업 화면', dark = false, style}) => <div style={{position: 'absolute', width: 804, height: 472, borderRadius: 26, overflow: 'hidden', background: dark ? theme.black : theme.paper, color: dark ? theme.paper : theme.black, border: `2px solid ${dark ? theme.light(.26) : theme.shadow(.18)}`, boxShadow: `0 24px 50px ${theme.shadow(.09)}`, ...style}}>
  <div style={{height: 66, borderBottom: `1px solid ${dark ? theme.light(.17) : theme.shadow(.12)}`, display: 'flex', gap: 9, alignItems: 'center', padding: '0 24px'}}>{[0, 1, 2].map(i => <i key={i} style={{height: 9, width: 9, borderRadius: '50%', background: dark ? theme.light(.5) : theme.shadow(.3)}}/>)}<span style={{marginLeft: 20, fontSize: 25, opacity: .6}}>{label}</span></div>
  {children}
</div>;

export const Person: React.FC<{x: number; y: number; label: string; dark?: boolean; scale?: number; opacity?: number}> = ({x, y, label, dark = false, scale = 1, opacity = 1}) => <div style={{position: 'absolute', left: x, top: y, width: 190, textAlign: 'center', scale, opacity, transformOrigin: 'center center'}}><svg viewBox="0 0 140 150" width="140" height="150"><circle cx="70" cy="39" r="24" fill={dark ? theme.paper : theme.black}/><path d="M22 140V115C22 80 118 80 118 115V140Z" fill={dark ? theme.paper : theme.black}/></svg><div style={{fontSize: 43, fontWeight: 600, marginTop: 16, color: dark ? theme.paper : theme.black}}>{label}</div></div>;

export const Cursor: React.FC<{x: number; y: number; dark?: boolean; opacity?: number}> = ({x, y, dark = false, opacity = 1}) => <svg width="45" height="58" viewBox="0 0 45 58" style={{position: 'absolute', left: x, top: y, opacity, filter: `drop-shadow(0 3px 3px ${theme.shadow(.18)})`}}><path d="M4 3V44L15 33L24 52L34 47L24 29L40 26Z" fill={dark ? theme.paper : theme.black} stroke={dark ? theme.black : theme.paper} strokeWidth="3"/></svg>;

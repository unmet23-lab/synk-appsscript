import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from './theme';
import {assetFiles} from './types';

export const file = (key: string) => {
  if (!assetFiles[key]) throw new Error(`Unknown approved asset: ${key}`);
  return staticFile(`계정별20260909/${assetFiles[key]}`);
};

export const Entrance: React.FC<{children: React.ReactNode; delay?: number; style?: React.CSSProperties}> = ({children, delay = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - Math.round(delay * fps), fps, config: theme.spring, durationInFrames: Math.round(0.3 * fps)});
  return <div style={{...style, opacity: p, translate: `0 ${18 * (1 - p)}px`, scale: String(0.99 + 0.01 * p)}}>{children}</div>;
};

export const Artifact: React.FC<{asset: string; width?: number; height?: number; document?: boolean; duration: number}> = ({asset, width = 820, height = 550, document = false, duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <div style={{width, height, position: 'relative', overflow: 'hidden', borderRadius: document ? 8 : 40,
    boxShadow: document ? `0 22px 42px ${theme.shadow(0.14)}` : undefined,
    background: document ? theme.paper : undefined}}>
    <Img src={file(asset)} style={{width: '100%', height: '100%', objectFit: 'contain',
      scale: interpolate(frame, [0, Math.max(1, duration * fps - 1)], document ? [1, 1.013] : [1, 1.035], {
        easing: theme.ease.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      translate: `0 ${Math.sin(frame / fps * 0.7) * (document ? 0.2 : 1.1)}px`}} />
  </div>;
};

export const Background: React.FC = () => <AbsoluteFill style={{background: theme.paper}}>
  <Img src={file('stitch')} style={{position: 'absolute', width: 380, height: 54, objectFit: 'contain', left: 100, top: 174, opacity: 0.7}} />
</AbsoluteFill>;

export const Finish: React.FC = () => <AbsoluteFill style={{pointerEvents: 'none'}}>
  <AbsoluteFill style={{background: theme.light(0.018)}} />
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, boxShadow: `0 -20px 100px ${theme.shadow(0.025)}`}} />
</AbsoluteFill>;

export const Progress: React.FC<{count: number; index: number; label: string}> = ({count, index, label}) => <div
  style={{position: 'absolute', top: 1472, left: theme.safe.left, width: theme.safe.width, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: theme.muted}}>
  <span style={{fontSize: 24, fontWeight: 500, letterSpacing: 1}}>{label}</span>
  <div style={{display: 'flex', gap: 12}}>{Array.from({length: count}, (_, i) => <div key={i} style={{height: 4, width: i === index ? 44 : 18, background: theme.ink, opacity: i === index ? 0.8 : 0.14}} />)}</div>
</div>;

export const Headline: React.FC<{text: string; size?: number}> = ({text, size = 82}) => <div data-critical="headline" style={{fontSize: size, fontWeight: theme.headingWeight, lineHeight: 1.15, letterSpacing: theme.tracking, whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word'}}>{text}</div>;

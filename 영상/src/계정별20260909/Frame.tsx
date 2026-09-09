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
  return <div style={{width, height, position: 'relative', overflow: document ? 'hidden' : 'visible', borderRadius: document ? 4 : 0,
    boxShadow: document ? `0 14px 32px ${theme.shadow(0.10)}` : undefined,
    background: document ? theme.paper : undefined}}>
    <Img src={file(asset)} style={{width: '100%', height: '100%', objectFit: 'contain',
      scale: interpolate(frame, [0, 0.8 * fps, Math.max(0.9 * fps, duration * fps - 1)], [0.985, 1, 1], {
        easing: theme.ease.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      translate: `0 ${interpolate(frame, [0, 0.8 * fps], [6, 0], {easing: theme.ease.out, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px`}} />
  </div>;
};

export const Background: React.FC = () => <AbsoluteFill style={{background: theme.paper}} />;

// Align to the s/n letter body, not the tall k or the descending y bounding box.
// The division's actual letter height is 58px; source padding is kept intact.
export const BrandLockup: React.FC<{brand?: string}> = ({brand = 'SYNK'}) => {
  const division = brand.toLowerCase();
  const sizes: Record<string, {width: number; height: number}> = {
    lab: {width: 1951 * 58 / 775, height: 823 * 58 / 775},
    shift: {width: 1936 * 58 / 552, height: 600 * 58 / 552},
    pulse: {width: 1987 * 58 / 529, height: 577 * 58 / 529},
  };
  return <div data-critical="brand-lockup" style={{position: 'absolute', left: theme.safe.left, top: theme.safe.top, width: 530, height: 120}}>
    <Img src={file('brand-synk')} style={{position: 'absolute', left: 0, top: 0, width: 248, height: 248 * 1301 / 2820, objectFit: 'contain'}} />
    {sizes[division] && <Img src={file(`brand-${division}`)} style={{position: 'absolute', left: 274, top: 27, ...sizes[division], objectFit: 'contain'}} />}
  </div>;
};

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

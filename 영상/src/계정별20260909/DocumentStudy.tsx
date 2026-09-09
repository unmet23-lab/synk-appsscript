import React from 'react';
import {Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {file} from './Frame';
import {theme} from './theme';

type Crop = {x: number; y: number; width: number; height: number};
type Focus = 'title' | 'body' | 'object';
const crops: Record<Focus, Crop> = {
  title: {x: 0.034, y: 0.267, width: 0.47, height: 0.19},
  body: {x: 0.034, y: 0.482, width: 0.46, height: 0.13},
  object: {x: 0.575, y: 0.235, width: 0.37, height: 0.53},
};

// Only a viewport onto the approved page. No reconstructed text, replacement
// mockup, invented UI, or new copy appears in this study.
export const DocumentStudy: React.FC<{asset: string; focuses: Focus[]; duration: number}> = ({asset, focuses, duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const focusStart = 1.7;
  const slot = Math.max(1, (duration - focusStart - 0.5) / Math.max(1, focuses.length));
  const index = Math.min(focuses.length - 1, Math.max(0, Math.floor((seconds - focusStart) / slot)));
  const focus = focuses[index];
  const crop = focus && (asset === 'pulsepage' && focus === 'object'
    ? {x: 0.58, y: 0.13, width: 0.42, height: 0.70}
    : asset === 'shiftpage' && focus === 'object'
      ? {x: 0.60, y: 0.28, width: 0.365, height: 0.56} : crops[focus]);
  const reveal = focuses.length ? interpolate(frame, [focusStart * fps, (focusStart + 0.3) * fps], [0, 1], {
    easing: theme.ease.out, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  const change = interpolate(frame, [(focusStart + Math.max(0, index) * slot) * fps, (focusStart + Math.max(0, index) * slot + 0.3) * fps], [0, 1], {
    easing: theme.ease.out, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = crop ? Math.min(760 / (3840 * crop.width), 408 / (2400 * crop.height)) : 1;
  const width = crop ? 3840 * crop.width * scale : 0;
  const height = crop ? 2400 * crop.height * scale : 0;
  return <div style={{width: 820, height: 512, position: 'relative', background: theme.paper,
    boxShadow: `0 14px 32px ${theme.shadow(0.085)}`, overflow: 'hidden', borderRadius: 4}}>
    <Img src={file(asset)} style={{width: 820, height: 512, objectFit: 'contain', opacity: 1 - reveal,
      scale: interpolate(frame, [0, 0.4 * fps], [0.995, 1], {easing: theme.ease.out, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} />
    {crop && <div style={{position: 'absolute', inset: 0, background: theme.paper, opacity: reveal}}>
      <div style={{position: 'absolute', width, height, left: (820 - width) / 2, top: (512 - height) / 2, overflow: 'hidden',
        opacity: change, translate: `0 ${8 * (1 - change)}px`, scale: String(0.99 + 0.01 * change)}}>
        <Img src={file(asset)} style={{position: 'absolute', width: 3840 * scale, height: 2400 * scale,
          left: -3840 * crop.x * scale, top: -2400 * crop.y * scale, maxWidth: 'none'}} />
      </div>
      <div style={{position: 'absolute', bottom: 20, left: 30, right: 30, display: 'flex', gap: 8}}>{focuses.map((_, i) =>
        <div key={i} style={{height: 2, flex: 1, background: theme.ink, opacity: i === index ? 0.5 : 0.1}} />)}</div>
    </div>}
  </div>;
};

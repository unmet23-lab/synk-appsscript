import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Artifact, BrandLockup, Entrance, Headline, Progress} from './Frame';
import {DocumentStudy} from './DocumentStudy';
import {theme} from './theme';
import type {ContentItem, Scene} from './types';

export const ContentScene: React.FC<{scene: Scene; item: ContentItem; index: number}> = ({scene, item, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = useRef<HTMLDivElement>(null);
  const isLab = item.id === '03-lab-tiktok';
  const isPersonal = item.id.includes('yuhobuilds');
  const isDocument = /page$/.test(scene.asset || '');
  const lines = scene.lines || [];
  const labOptions = lines.flatMap(line => line.split(' · '));
  const duration = scene.duration;
  const label = isLab ? 'SYNK LAB · @synk.mn' : isPersonal ? 'YUHO BUILDS · 제작 노트' : 'SYNK BRIEF · 실무 도구';
  const accent = isLab ? theme.coral : theme.lapis;
  const headingSize = scene.title.length > 30 ? 68 : scene.title.length > 19 ? 76 : 86;
  const documentFocus: Array<'title' | 'body' | 'object'> =
    item.id === '04-yuhobuilds-youtube' ? (index === 1 ? ['title'] : index === 2 ? ['body'] : index === 3 ? ['object'] : []) :
    item.id === '06-yuhobuilds-tiktok' && index === 1 ? ['title', 'body', 'object'] :
    item.id === '05-yuhobuilds-instagram' ? ['object'] : [];

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || frame < Math.round(fps * 0.8)) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-critical]')) {
      const rect = el.getBoundingClientRect();
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2 || rect.right > 935 || rect.bottom > 1532) {
        throw new Error(`Critical text overflow: ${item.id} scene ${index + 1} ${el.dataset.critical}`);
      }
    }
  }, [frame, fps, index, item.id]);

  return <AbsoluteFill ref={ref} style={{fontFamily: theme.fonts.body, color: theme.ink,
    opacity: interpolate(frame, [Math.max(0, duration * fps - 0.2 * fps), duration * fps - 1], [1, 0], {
      easing: theme.ease.in, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    translate: `0 ${interpolate(frame, [Math.max(0, duration * fps - 0.2 * fps), duration * fps - 1], [0, -8], {easing: theme.ease.in, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px`}}>
    <Entrance><BrandLockup brand={item.brand} /></Entrance>
    <div style={{position: 'absolute', top: 415, left: theme.safe.left, width: theme.safe.width}}>
      <Entrance delay={0.08}><div data-critical="eyebrow" style={{fontSize: 27, lineHeight: 1.35, fontWeight: 600, color: accent, marginBottom: 28}}>{scene.eyebrow || label}</div></Entrance>
      <Entrance delay={0.1}><Headline text={scene.title} size={headingSize} /></Entrance>
    </div>

    {isLab ? <>
      <div style={{position: 'absolute', top: scene.kr ? 620 : labOptions.length ? 645 : 735, left: theme.safe.left, width: theme.safe.width}}>
        {scene.kr && <Entrance delay={0.35}><div data-critical="korean" style={{fontFamily: theme.fonts.korean, fontSize: 76, lineHeight: 1.28, fontWeight: 800, whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>{scene.kr}</div></Entrance>}
        {scene.mn && <Entrance delay={0.5}><div data-critical="mongolian" style={{fontFamily: theme.fonts.latin, fontSize: 41, lineHeight: 1.32, fontWeight: 500, marginTop: 30, whiteSpace: 'pre-line'}}>{scene.mn}</div></Entrance>}
        {scene.body && <Entrance delay={0.65}><div data-critical="body" style={{fontSize: 37, lineHeight: 1.4, marginTop: 28, whiteSpace: 'pre-line'}}>{scene.body}</div></Entrance>}
      </div>
      {scene.asset && <Entrance delay={0.6} style={{position: 'absolute', top: labOptions.length ? 1070 : 920, left: labOptions.length ? 310 : 160}}><Artifact asset={scene.asset} width={labOptions.length ? 400 : 700} height={labOptions.length ? 350 : 480} duration={duration} /></Entrance>}
      {labOptions.length > 0 && <div style={{position: 'absolute', top: 765, left: theme.safe.left, width: theme.safe.width}}>{labOptions.map((line, i) => <Entrance key={line} delay={0.45 + i * 0.13}><div data-critical={`line-${i}`} style={{fontSize: 46, lineHeight: 1.35, marginBottom: 19}}>{line}</div></Entrance>)}</div>}
    </> : isDocument ? <>
      <Entrance delay={0.25} style={{position: 'absolute', top: 730, left: theme.safe.left}}><DocumentStudy asset={scene.asset!} duration={duration} focuses={documentFocus} /></Entrance>
      <div style={{position: 'absolute', top: 1282, left: theme.safe.left, width: theme.safe.width}}>
        {scene.body && <Entrance delay={0.5}><div data-critical="body" style={{fontSize: 37, lineHeight: 1.43, whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>{scene.body}</div></Entrance>}
        {lines.map((line, i) => <Entrance key={line} delay={0.65 + i * 0.13}><div data-critical={`line-${i}`} style={{fontSize: 32, lineHeight: 1.35, marginTop: 16}}>{line}</div></Entrance>)}
      </div>
    </> : <>
      <div style={{position: 'absolute', top: 710, left: theme.safe.left, width: theme.safe.width}}>
        {scene.body && <Entrance delay={0.3}><div data-critical="body" style={{fontSize: 42, lineHeight: 1.38, whiteSpace: 'pre-line', wordBreak: 'keep-all', marginBottom: 36}}>{scene.body}</div></Entrance>}
        {lines.map((line, i) => <Entrance key={line} delay={0.5 + i * 0.16}>
          <div data-critical={`line-${i}`} style={{display: 'flex', gap: 22, alignItems: 'flex-start', paddingTop: 21, paddingBottom: 24, borderTop: `2px solid ${theme.stitch}`, fontSize: lines.length > 3 ? 35 : 40, lineHeight: 1.32, whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>
            <span style={{fontFamily: theme.fonts.latin, color: theme.muted, fontSize: 26, marginTop: 5}}>{String(i + 1).padStart(2, '0')}</span><span>{line}</span>
          </div>
        </Entrance>)}
      </div>
      {scene.asset && <Entrance delay={0.7} style={{position: 'absolute', top: lines.length ? 1130 : 920, left: lines.length ? 365 : 140}}><Artifact asset={scene.asset} width={lines.length ? 290 : 740} height={lines.length ? 270 : 480} duration={duration} /></Entrance>}
    </>}
    <Progress count={item.scenes.length} index={index} label={label} />
  </AbsoluteFill>;
};

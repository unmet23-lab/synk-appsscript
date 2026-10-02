import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {VideoProps, SceneProps, Visual} from './types';
import {theme, darkVisuals} from './theme';
import {SceneHook} from './SceneHook';
import {ScenePayment} from './ScenePayment';
import {SceneSetting} from './SceneSetting';
import {SceneTranslation} from './SceneTranslation';
import {SceneInquiries} from './SceneInquiries';
import {ScenePurpose} from './ScenePurpose';
import {SceneTools} from './SceneTools';
import {SceneConfusion} from './SceneConfusion';
import {SceneScreenshots} from './SceneScreenshots';
import {SceneLoop} from './SceneLoop';
import {SceneHours} from './SceneHours';
import {SceneJoke} from './SceneJoke';
import {SceneLesson} from './SceneLesson';
import {ScenePrompt} from './ScenePrompt';
import {SceneAction} from './SceneAction';
import {SceneEnding} from './SceneEnding';

const components: Record<Visual, React.FC<SceneProps>> = {hook: SceneHook, payment: ScenePayment, setting: SceneSetting, translation: SceneTranslation, inquiries: SceneInquiries, purpose: ScenePurpose, tools: SceneTools, confusion: SceneConfusion, screenshots: SceneScreenshots, loop: SceneLoop, hours: SceneHours, joke: SceneJoke, lesson: SceneLesson, prompt: ScenePrompt, action: SceneAction, ending: SceneEnding};

/** Caption timestamps are on the complete video timeline, including audioStartFrame. */
export const Video: React.FC<VideoProps> = ({timing, captions}) => {
  const f = useCurrentFrame();
  const ms = f / timing.fps * 1000;
  const scene = timing.scenes.find(s => f >= s.start && f < s.start + s.duration);
  const dark = darkVisuals.has(scene?.visual ?? 'hook');
  const caption = captions.find(c => ms >= c.startMs && ms < c.endMs);
  return <AbsoluteFill style={{background: theme.black}}>
    {timing.scenes.map((s, index) => {const Component = components[s.visual]; return <Sequence key={s.id} from={s.start} durationInFrames={s.duration} name={`${String(index + 1).padStart(2, '0')} · ${s.visual}`}><Component scene={s} index={index} total={timing.scenes.length}/></Sequence>;})}
    {timing.audioFile ? <Sequence from={timing.audioStartFrame} name="남성 내레이션"><Audio src={staticFile(timing.audioFile)}/></Sequence> : null}
    {caption ? <div data-caption="true" style={{position: 'absolute', left: 88, right: 130, top: 1480, fontFamily: theme.font, fontSize: 52, lineHeight: 1.42, fontWeight: 600, letterSpacing: '-.025em', whiteSpace: 'pre-line', wordBreak: 'keep-all', color: dark ? theme.paper : theme.black}}>{caption.text}</div> : null}
  </AbsoluteFill>;
};

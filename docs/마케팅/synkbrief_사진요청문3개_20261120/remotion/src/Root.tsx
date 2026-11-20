import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL, SceneRoom, SCENE_TOTAL } from './Film';
import { FPS } from './timeline';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 @synkbrief 릴스 — 계정 개편 시험 편이라 인스타 판만) */}
    <Composition id="photo3" component={Film} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 판 — 빈 방이 채워지는 장면(장면/장면_v1.mp4) */}
    <Composition id="scene-room" component={SceneRoom} durationInFrames={SCENE_TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);

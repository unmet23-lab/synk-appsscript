import { Composition } from 'remotion';
import './lib/fonts';
import { Film, Scene } from './Film';
import { FPS, SCENE_DUR, TOTAL } from './timeline';

// 판 하나 — 끝 말이 캡션 · 고정 댓글을 가리키지 않아 인스타 · 유튜브 · 틱톡이 같은 영상을 쓴다.
// scene = 한 장면 심사용(얼굴 가까이 사진 → 같은 자리에서 색연필 그림 → 받은 카드, 글 · 말 없이)
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="dogcard" component={Film} durationInFrames={Math.round(TOTAL * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="scene" component={Scene} durationInFrames={Math.round(SCENE_DUR * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);

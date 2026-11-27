import { Composition } from 'remotion';
import './lib/fonts';
import { Film, Scene } from './Film';
import { FPS, SCENE_DUR, TOTAL } from './timeline';

// 판 하나 — 끝 말이 캡션 · 고정 댓글을 가리키지 않아 인스타 · 유튜브 · 틱톡이 같은 영상을 쓴다.
// scene = 한 장면 심사용(공부 쪽 → 퀴즈 카드 → 눌러서 틀림 · 정답, 글 · 말 없이)
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="quiz" component={Film} durationInFrames={Math.round(TOTAL * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="scene" component={Scene} durationInFrames={Math.round(SCENE_DUR * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);

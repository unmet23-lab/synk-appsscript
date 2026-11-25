import { Composition } from 'remotion';
import './lib/fonts';
import { Film, Scene } from './Film';
import { FPS, SCENE_DUR, totalOf, type Variant } from './timeline';

// 판 둘 — 끝 줄만 다르다(인스타 · 틱톡: 아래 글 · 유튜브: 고정 댓글).
// scene = 한 장면 심사용(보낸 글 → 답 속 지도 → 날짜를 바꾼 지도, 글 · 말 없이)
const VARIANTS: { id: string; v: Variant }[] = [
  { id: 'travel', v: 'ig' },
  { id: 'travel-yt', v: 'yt' },
];

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map(({ id, v }) => (
      <Composition key={id} id={id} component={Film} defaultProps={{ v }} durationInFrames={Math.round(totalOf(v) * FPS)} fps={FPS} width={1080} height={1920} />
    ))}
    <Composition id="scene" component={Scene} durationInFrames={Math.round(SCENE_DUR * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);

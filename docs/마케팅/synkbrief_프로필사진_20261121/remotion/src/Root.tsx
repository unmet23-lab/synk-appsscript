import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './Film';
import { FPS, totalOf, type Variant } from './timeline';

// 판 셋 — 끝 줄만 다르다(인스타: 댓글 낱말 → DM · 유튜브: 고정 댓글 · 틱톡: 아래 글)
const VARIANTS: { id: string; v: Variant }[] = [
  { id: 'profile', v: 'ig' },
  { id: 'profile-yt', v: 'yt' },
  { id: 'profile-tt', v: 'tt' },
];

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map(({ id, v }) => (
      <Composition key={id} id={id} component={Film} defaultProps={{ v }} durationInFrames={Math.round(totalOf(v) * FPS)} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);

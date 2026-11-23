import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './Film';
import { FPS, S, totalOf, type Variant } from './timeline';

// 판 둘 — 끝 줄만 다르다(인스타 · 틱톡: 아래 글 · 유튜브: 고정 댓글). scene = 한 장면 심사용(훅 + 민감정보 카드, 글 · 말 없이)
const VARIANTS: { id: string; v: Variant }[] = [
  { id: 'privacy', v: 'ig' },
  { id: 'privacy-yt', v: 'yt' },
];

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map(({ id, v }) => (
      <Composition key={id} id={id} component={Film} defaultProps={{ v, bare: false }} durationInFrames={Math.round(totalOf(v) * FPS)} fps={FPS} width={1080} height={1920} />
    ))}
    <Composition id="scene" component={Film} defaultProps={{ v: 'ig' as Variant, bare: true }} durationInFrames={Math.round((S.table - 0.6) * FPS)} fps={FPS} width={1080} height={1920} />
  </>
);

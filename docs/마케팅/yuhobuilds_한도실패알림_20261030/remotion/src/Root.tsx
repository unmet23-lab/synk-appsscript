import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, LimitFilm } from './y23/Film';
import { TOTAL } from './y23/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y23(10-30, 한 판이 모든 계정): 원본 Sf8Gu31kEfA 뼈대 — npx remotion render src/index.ts main out/y23_r1.mp4 */}
    <Composition id="main" component={LimitFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

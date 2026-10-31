import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, SeasonFilm } from './y28/Film';
import { TOTAL } from './y28/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y28(10-31, 한 판이 모든 계정): 원본 VMwrKqlumr4 뼈대 — npx remotion render src/index.ts main out/y28_r1.mp4 */}
    <Composition id="main" component={SeasonFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

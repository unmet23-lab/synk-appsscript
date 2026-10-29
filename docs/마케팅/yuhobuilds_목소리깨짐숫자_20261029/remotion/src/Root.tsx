import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, VoiceFilm } from './y22/Film';
import { TOTAL } from './y22/time';
import { CoverStillV2, VoiceFilmV2 } from './y22v2/Film';
import { TOTAL as TOTAL2 } from './y22v2/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y22(10-29 오마주판, 한 판이 모든 계정): 원본 StXGGNlNLOk 뼈대 — npx remotion render src/index.ts main out/y22_r1.mp4 */}
    <Composition id="main" component={VoiceFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* v2(10-30 다시 만든 판): npx remotion render src/index.ts v2 out/y22v2_r1.mp4 */}
    <Composition id="v2" component={VoiceFilmV2} durationInFrames={TOTAL2} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="cover2" component={CoverStillV2} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

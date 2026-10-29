import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, VoiceFilm } from './y22/Film';
import { TOTAL } from './y22/time';
import { CoverStillV2, VoiceFilmV2 } from './y22v2/Film';
import { TOTAL as TOTAL2 } from './y22v2/time';
import { CoverStillV3, VoiceFilmV3 } from './y22v3/Film';
import { TOTAL as TOTAL3 } from './y22v3/time';
import { CoverStillV4, VoiceFilmV4 } from './y22v4/Film';
import { TOTAL as TOTAL4 } from './y22v4/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y22(10-29 오마주판, 한 판이 모든 계정): 원본 StXGGNlNLOk 뼈대 — npx remotion render src/index.ts main out/y22_r1.mp4 */}
    <Composition id="main" component={VoiceFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* v2(10-30 다시 만든 판): npx remotion render src/index.ts v2 out/y22v2_r1.mp4 */}
    <Composition id="v2" component={VoiceFilmV2} durationInFrames={TOTAL2} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="cover2" component={CoverStillV2} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* v3(10-30 첫머리 귀 시험판): npx remotion render src/index.ts v3 out/y22v3_r1.mp4 */}
    <Composition id="v3" component={VoiceFilmV3} durationInFrames={TOTAL3} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="cover3" component={CoverStillV3} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* v4(10-30 「turn」 반 빠르기판): npx remotion render src/index.ts v4 out/y22v4_r1.mp4 */}
    <Composition id="v4" component={VoiceFilmV4} durationInFrames={TOTAL4} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="cover4" component={CoverStillV4} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, CameraFilm } from './y24/Film';
import { TOTAL } from './y24/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Y24(10-30, 한 판이 모든 계정): 원본 wS9rrwRImTg 뼈대 — npx remotion render src/index.ts main out/y24_r1.mp4 */}
    <Composition id="main" component={CameraFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

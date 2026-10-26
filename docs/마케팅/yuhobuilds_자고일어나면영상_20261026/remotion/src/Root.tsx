import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, MorningFilm } from './y9/Film';
import { TIMING } from './y9/time';
import { CoverStill2, OneLineFilm } from './y9v2/Film';
import { TIMING as TIMING2 } from './y9v2/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 — 끝 말이 모든 판(인스타 · 유튜브 · 틱톡)에 같아 하나 */}
    <Composition id="main" component={MorningFilm} durationInFrames={TIMING.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    {/* 표지(따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* v2(10-27 다시 살림) — 같은 부탁, 한 줄 차이. 끝 말이 모든 판에 같아 하나 */}
    <Composition id="v2" component={OneLineFilm} durationInFrames={TIMING2.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    {/* v2 표지: npx remotion still src/index.ts cover2 out/cover2.png */}
    <Composition id="cover2" component={CoverStill2} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

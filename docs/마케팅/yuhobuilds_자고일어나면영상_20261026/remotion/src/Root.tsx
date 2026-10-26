import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, MorningFilm } from './y9/Film';
import { TIMING } from './y9/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 — 끝 말이 모든 판(인스타 · 유튜브 · 틱톡)에 같아 하나 */}
    <Composition id="main" component={MorningFilm} durationInFrames={TIMING.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    {/* 표지(따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

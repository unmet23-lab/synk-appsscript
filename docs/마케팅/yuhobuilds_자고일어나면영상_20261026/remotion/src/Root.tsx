import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, MorningFilm } from './y9/Film';
import { TIMING } from './y9/time';
import { CoverStill2, OneLineFilm } from './y9v2/Film';
import { TIMING as TIMING2 } from './y9v2/time';
import { CoverStill3, OneLineFilm3 } from './y9v3/Film';
import { TIMING as TIMING3 } from './y9v3/time';

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
    {/* v3(10-27 새 꼴로 다시) — 0초 전후 두 답 → 한 줄 크게 → 승인 → 끝. 끝 말만 판마다: v3(인스타 · 틱톡 · X · 링크드인) · v3yt(유튜브) */}
    <Composition id="v3" component={OneLineFilm3} durationInFrames={TIMING3.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    <Composition id="v3yt" component={OneLineFilm3} durationInFrames={TIMING3.yt.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'yt' as const, bgm: true }} />
    {/* v3 표지: npx remotion still src/index.ts cover3 out/cover3.png */}
    <Composition id="cover3" component={CoverStill3} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

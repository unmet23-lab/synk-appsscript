import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, ReviewFilm } from './y19/Film';
import { TIMING } from './y19/time';
import { CoverStillV2, ReviewFilmV2 } from './y19v2/Film';
import { TOTAL } from './y19v2/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 0초 전후 두 답 → 한 줄 크게 → 다른 빈칸 → 끝. 끝 말만 판마다: main(인스타 · 틱톡 · X · 링크드인) · yt(유튜브) */}
    <Composition id="main" component={ReviewFilm} durationInFrames={TIMING.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    <Composition id="yt" component={ReviewFilm} durationInFrames={TIMING.yt.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'yt' as const, bgm: true }} />
    {/* v2(10-29 오마주판, 한 판이 모든 계정): 원본 Ls0r557jclc 뼈대 — npx remotion render src/index.ts v2 out/y19v2_r1.mp4 */}
    <Composition id="v2" component={ReviewFilmV2} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="cover2" component={CoverStillV2} durationInFrames={1} fps={30} width={1080} height={1920} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

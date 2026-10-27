import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, ReviewFilm } from './y19/Film';
import { TIMING } from './y19/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 0초 전후 두 답 → 한 줄 크게 → 다른 빈칸 → 끝. 끝 말만 판마다: main(인스타 · 틱톡 · X · 링크드인) · yt(유튜브) */}
    <Composition id="main" component={ReviewFilm} durationInFrames={TIMING.main.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const, bgm: true }} />
    <Composition id="yt" component={ReviewFilm} durationInFrames={TIMING.yt.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'yt' as const, bgm: true }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

import { Composition } from 'remotion';
import './lib/fonts';
import { CoverStill, HomageFilm } from './y21/Film';
import { total } from './y21/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 원본 14칸 박자 그대로 · 끝 말만 판마다: main(인스타 키워드 DM) · yt(고정 댓글) · tt(틱톡 · X · 링크드인 설명) */}
    <Composition id="main" component={HomageFilm} durationInFrames={total('main')} fps={30} width={1080} height={1920} defaultProps={{ cut: 'main' as const }} />
    <Composition id="yt" component={HomageFilm} durationInFrames={total('yt')} fps={30} width={1080} height={1920} defaultProps={{ cut: 'yt' as const }} />
    <Composition id="tt" component={HomageFilm} durationInFrames={total('tt')} fps={30} width={1080} height={1920} defaultProps={{ cut: 'tt' as const }} />
    {/* 표지: npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={CoverStill} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

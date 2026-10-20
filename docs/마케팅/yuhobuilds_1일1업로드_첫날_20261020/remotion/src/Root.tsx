import { Composition } from 'remotion';
import './lib/fonts';
import { Cover } from './day1/Cover';
import { Day1Film } from './day1/Film';
import { TOTAL } from './day1/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(인스타·유튜브 같은 판) — 만족 사례 S22 문법, 1일 1업로드 첫날 */}
    <Composition id="day1" component={Day1Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="day1-no-music" component={Day1Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: false }} />
    {/* 표지(S22처럼 따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

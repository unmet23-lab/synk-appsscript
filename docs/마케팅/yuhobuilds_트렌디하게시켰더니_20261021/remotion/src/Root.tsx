import { Composition } from 'remotion';
import './lib/fonts';
import { Cover } from './p1/Cover';
import { TrendyFilm } from './p1/Film';
import { TOTAL } from './p1/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(인스타·유튜브 같은 판) — S22·10-20 v8 문법 */}
    <Composition id="trendy" component={TrendyFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지(S22처럼 따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

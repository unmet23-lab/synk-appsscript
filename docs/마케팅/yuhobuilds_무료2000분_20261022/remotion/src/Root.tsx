import { Composition } from 'remotion';
import './lib/fonts';
import { Cover } from './p4/Cover';
import { MinutesFilm } from './p4/Film';
import { TOTAL } from './p4/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(인스타·유튜브 같은 판) — 같은 날 첫째 편과 같은 문법 */}
    <Composition id="minutes" component={MinutesFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지(따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

import { Composition } from 'remotion';
import './lib/fonts';
import { Cover } from './p3/Cover';
import { SessionFilm } from './p3/Film';
import { TOTAL } from './p3/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(인스타·유튜브 같은 판) — 10-21 두 편과 같은 문법 */}
    <Composition id="session" component={SessionFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {/* 표지(따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

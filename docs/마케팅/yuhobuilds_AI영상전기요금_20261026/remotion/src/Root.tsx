import { Composition } from 'remotion';
import './lib/fonts';
import { Cover } from './y7/Cover';
import { PowerFilm } from './y7/Film';
import { TIMING } from './y7/time';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 — 끝 말만 판마다 다르다: ig(댓글 「전기」 → DM) · yt(고정 댓글) */}
    <Composition id="ig" component={PowerFilm} durationInFrames={TIMING.ig.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'ig' as const, bgm: true }} />
    <Composition id="yt" component={PowerFilm} durationInFrames={TIMING.yt.total} fps={30} width={1080} height={1920} defaultProps={{ cut: 'yt' as const, bgm: true }} />
    {/* 표지(따로 짠 한 장): npx remotion still src/index.ts cover out/cover.png */}
    <Composition id="cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);

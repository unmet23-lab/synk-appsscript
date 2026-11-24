import { Composition } from 'remotion';
import './lib/fonts';
import { Film, Scene, SCENE_FROM, SCENE_TO, TOTAL } from './skill/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편(인스타 · 댓글 키워드 DM): npx remotion render src/index.ts main out/m1.mp4 */}
    <Composition id="main" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, ending: 'dm' as const }} />
    {/* 키워드 DM이 없는 판(유튜브 · 링크드인 · 스레드 · 티스토리): 끝 말 「게시글에 다 적어 뒀어요」. */}
    <Composition id="post" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: true, ending: 'post' as const }} />
    {/* 음악만(음악층 검사) */}
    <Composition id="musiconly" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ bgm: true, voice: false }} />
    {/* 핵심 장면만(장면 심사 · 제목 없이) */}
    <Composition id="scene" component={Scene} durationInFrames={Math.round((SCENE_TO - SCENE_FROM) * 30)} fps={30} width={1080} height={1920} />
  </>
);

import { AbsoluteFill, Audio, Composition, Img, Sequence, staticFile } from 'remotion';
import './lib/fonts';
import { Boss, Card, Film, Hl, Reveal, TOTAL, V1 } from './Film';
import { KO } from './lib/fonts';

// 장면 심사용 — 핵심 장면만(제작 절차 「한 장면 먼저」 ①): 제목 · 이름표 · 자막 없이 그 장면의 소리째(5.7초).
// 사장님이 갈라 본 하얀 속살(V1) → 리뷰에 올라온 분홍 속살 사진 → 받은 파일 그대로 물으니 제미나이 「AI 도구로 편집된 기록」 →
// 분홍 속살이 녹아 원래 다 익은 치킨으로(원본 리꼬 셋째 칸 「먹던 음식 → 먹기 전으로」 자리).
const SCENE_LEN = 171;
const SceneOnly: React.FC = () => (
  <AbsoluteFill style={{ background: '#111' }}>
    <Sequence from={0} durationInFrames={42}>
      <Boss start={V1.tear - 0.3} crops={[[0, 2.6, 640, 470]]} vol={0.6} />
    </Sequence>
    <Sequence from={42} durationInFrames={27}>
      <Img src={staticFile('img/가짜.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, transformOrigin: '540px 1150px', scale: '1.12' }} />
    </Sequence>
    <Sequence from={69} durationInFrames={48}>
      <AbsoluteFill style={{ background: '#111' }}>
        <div style={{ position: 'absolute', left: 44, right: 44, top: 560 }}>
          <Card head="「이 사진, AI로 만든 거야?」">
            네, 이 이미지 파일에는 생성형 AI로 제작되고 <Hl on={0.3}>AI 도구로 편집되었음을 나타내는</Hl> 검증 가능한 기록이 포함되어 있습니다.
          </Card>
        </div>
      </AbsoluteFill>
    </Sequence>
    <Sequence from={117}>
      <Reveal stampAt={0.6} />
    </Sequence>
    <Sequence from={69}>
      <Audio src={staticFile('vo/v05.wav')} />
    </Sequence>
    <Sequence from={117} durationInFrames={40}>
      <Audio src={staticFile('sfx/swish.wav')} volume={0.35} />
    </Sequence>
    <Audio src={staticFile('bgm.mp3')} volume={0.12} />
  </AbsoluteFill>
);
void KO;

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 · 유튜브 · 틱톡 같은 영상 — 끝 말이 캡션 · DM · 고정 댓글을 가리키지 않는다) */}
    <Composition id="b20" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="scene" component={SceneOnly} durationInFrames={SCENE_LEN} fps={30} width={1080} height={1920} />
  </>
);

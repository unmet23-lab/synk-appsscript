// 본편 — 책상 위 판 하나가 장면마다 바뀌고, 아래 띠에 몽골어 자막.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { prog } from '../lib/motion';
import { Desk, Sub, TopBar } from './parts';
import { SCENE_VIEW, TOP } from './scenes';
import { cues, lineTime, SCENES, VO_DUR } from './time';

/** bgm: 배경음 파일(public/music/…) — 없으면 목소리만. 목소리보다 약 20dB 아래. */
export type FilmProps = { shot?: string; bgm?: string; bgmVolume?: number };

export const Film: React.FC<FilmProps> = ({ shot, bgm, bgmVolume = 0.09 }) => {
  const g = useCurrentFrame();
  const id = Object.keys(SCENES).find((k) => g >= SCENES[k].from && g < SCENES[k].to) ?? '11';
  const View = SCENE_VIEW[id];
  // 지금 시각을 품은 큐를 먼저 고르고(같은 줄의 둘째 큐가 앞 큐 꼬리에 가리지 않게), 없을 때만 막 끝난 큐를 잠깐 남긴다.
  const now = cues.findIndex((c) => g >= c.from && g < c.to);
  const tailIdx = now >= 0 ? -1 : cues.findIndex((c) => g >= c.to && g < c.to + 8);
  const idx = now >= 0 ? now : tailIdx;
  const cue = idx >= 0 ? cues[idx] : null;
  const joined = idx > 0 && !!cue && cues[idx - 1].to >= cue.from - 1; // 바로 앞 큐에서 이어지면 바꿔 끼우기만
  const subO = !cue ? 0 : now >= 0 ? (joined ? 1 : prog(g, cue.from - 2, 5)) : 1 - prog(g, cue.to + 2, 5);
  const [ko, mn] = TOP[id];
  return (
    <AbsoluteFill>
      <Desk />
      {ko ? <TopBar no={id} ko={ko} mn={mn} /> : null}
      <View g={g} shot={shot} />
      <Sub text={cue?.text ?? null} o={subO} />
      {Object.keys(VO_DUR).map((id) => (
        <Sequence key={id} from={lineTime[id].from} durationInFrames={Math.ceil(VO_DUR[id] * 30) + 6}>
          <Audio src={staticFile(`vo/${id}.wav`)} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile(bgm)} loop volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

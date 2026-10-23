// 본편 — 책상 위 판 하나가 장면마다 바뀌고, 아래 띠에 몽골어 자막.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { prog } from '../lib/motion';
import { Desk, Sub, TopBar } from './parts';
import { SCENE_VIEW, TOP } from './scenes';
import { cues, lineTime, SCENES } from './time';
import { VO_DUR } from './vo.generated';

/** bgm: 배경음 파일(public/music/…) — 없으면 목소리만. 목소리보다 약 20dB 아래. */
export type FilmProps = { shot?: string; bgm?: string; bgmVolume?: number };

export const Film: React.FC<FilmProps> = ({ shot, bgm, bgmVolume = 0.09 }) => {
  const g = useCurrentFrame();
  const id = Object.keys(SCENES).find((k) => g >= SCENES[k].from && g < SCENES[k].to) ?? '11';
  const View = SCENE_VIEW[id];
  const cue = cues.find((c) => g >= c.from - 2 && g < c.to + 6) ?? null;
  const subO = cue ? Math.min(prog(g, cue.from - 2, 5), 1 - prog(g, cue.to + 2, 4)) : 0;
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

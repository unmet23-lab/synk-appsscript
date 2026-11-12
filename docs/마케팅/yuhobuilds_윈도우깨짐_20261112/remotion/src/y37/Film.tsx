// Y37 본편 — 원본 qp_2Qe4grTc(43.6초 · 17칸)의 컷 초를 그대로 따른다. 숫자는 11-07 실제 기록(data.ts REAL · 복원 결과).
// 무대는 처음부터 끝까지 두 드라이브 판 하나 — 깨짐 → 통째 백업 → 되살림 → 옮김 → 같은 파일 두 벌 → 클릭 → 비운 자리 → 저장할 한 장.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, prog } from '../lib/motion';
import { BUTTER, Drives } from './Drives';
import { Cursor, DriveLabels } from './Hero';
import { REAL } from './data';

export const FPS = 30;
const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(43.6);

// 원본 컷 초(오마주.json) — 우리 칸이 바뀌는 자리
export const CUT = [0, 3.4, 5.5, 7.2, 9.6, 12.3, 14.4, 17.7, 19.4, 21.9, 22.1, 25.7, 27.1, 31.1, 31.4, 33.9, 36.5, 40.2];

export const VO: { id: string; at: number; dur: number }[] = [
  { id: 'V1', at: 0.25, dur: 2.588 },
  { id: 'V2', at: 5.75, dur: 3.558 },
  { id: 'V3', at: 14.5, dur: 3.108 },
  { id: 'V4', at: 22.0, dur: 3.165 },
  { id: 'V5', at: 26.0, dur: 4.188 },
  { id: 'V6', at: 31.5, dur: 1.829 },
  { id: 'V7', at: 34.0, dur: 1.629 },
];

const STORY = { broken: F(2.1), copy: F(7.2), copyLen: F(2.2), restore: F(9.6), restoreLen: F(1.9), move: F(15.0), moveLen: F(3.4) };
const BEAT = { scan: [F(27.1), F(30.6)] as const, keep: F(31.45), keepOff: F(35.2), del: F(35.6), delLen: F(1.0), settle: F(36.75), settleLen: F(0.8) };
const CLICK = F(35.5);
const CARD = F(40.2);

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남(화면 결 ③). 버터는 한 곳만. */
const Head: React.FC<{ from: number; to: number; lines: React.ReactNode[]; size?: number; top?: number }> = ({ from, to, lines, size = 92, top = 290 }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 5, 5);
  return (
    <div style={{ position: 'absolute', left: 74, right: 74, top, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.5, color: '#FFFFFF' }}>
      {lines.map((l, i) => {
        const p = prog(f, from + i * 4, 10);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

/** 단계 머리(원본의 「3위 · 2위 · 1위」 자리) — 판 위에 작은 숫자 + 한 줄. */
const Step: React.FC<{ from: number; to: number; n: string; text: string }> = ({ from, to, n, text }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const p = prog(f, from, 8);
  const out = 1 - prog(f, to - 4, 4);
  return (
    <div style={{ position: 'absolute', left: 74, right: 74, top: 300, fontFamily: KO, color: '#FFFFFF', opacity: p * out, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontWeight: 900, fontSize: 64, color: BUTTER, letterSpacing: -1 }}>{n}</div>
      <div style={{ fontWeight: 800, fontSize: 92, letterSpacing: -2.5, lineHeight: 1.1 }}>{text}</div>
    </div>
  );
};

/** 실제 복원 결과 기록 두 줄(복원결과_20261107.md) — 숫자는 고정폭. */
const Record: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  const out = 1 - prog(f, to - 5, 5);
  const row = (i: number, a: React.ReactNode, b: React.ReactNode) => {
    const p = prog(f, from + i * 6, 10);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.28)', opacity: p * out, transform: `translateY(${(1 - p) * 20}px)` }}>
        <span style={{ fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.75)' }}>{a}</span>
        <span style={{ fontWeight: 800, fontSize: 60, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', letterSpacing: -1.5 }}>{b}</span>
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 74, right: 74, top: 300, fontFamily: KO }}>
      <div style={{ fontWeight: 700, fontSize: 36, color: 'rgba(255,255,255,0.6)', marginBottom: 8, opacity: out }}>11월 7일 복원 기록</div>
      {row(0, '되살린 문서', '1,796,647개')}
      {row(1, '용량', '315.7GB')}
      {row(2, '잃은 파일', <B>0개</B>)}
    </div>
  );
};

/** 끝 — 저장할 한 장(도구 이름 없이 그대로 따라 할 세 단계). 판은 어둡게 뒤에 남는다. */
const SaveCard: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const line = (i: number, n: string, a: React.ReactNode) => {
    const p = prog(f, from + 6 + i * 5, 10);
    return (
      <div style={{ display: 'flex', gap: 30, padding: '30px 0', borderTop: '1px solid rgba(255,255,255,0.3)', opacity: p, transform: `translateY(${(1 - p) * 22}px)` }}>
        <span style={{ fontWeight: 900, fontSize: 58, color: BUTTER, width: 40, flex: 'none' }}>{n}</span>
        <span style={{ fontWeight: 700, fontSize: 54, lineHeight: 1.22, letterSpacing: -1.2, color: '#FFFFFF' }}>{a}</span>
      </div>
    );
  };
  const p0 = prog(f, from, 10);
  return (
    <div style={{ position: 'absolute', left: 74, right: 74, top: 300, fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 84, lineHeight: 1.14, letterSpacing: -2.5, color: '#FFFFFF', opacity: p0, transform: `translateY(${(1 - p0) * 28}px)`, marginBottom: 34 }}>
        드라이브 정리할 때,
        <br />
        저장해 두세요
      </div>
      {line(0, '1', '옮긴 뒤, 원래 자리엔 바로가기')}
      {line(1, '2', <>지울 건 「두 곳에 똑같은 파일」만</>)}
      {line(2, '3', '다른 건 남기고, 클릭은 내가')}
    </div>
  );
};

export const Film: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, TOTAL], [1, 1.05], clamp);
  // 원본 박자 자리마다 판이 한 번 살짝 당겨진다(1.035배 → 제자리)
  const kick = CUT.slice(1).reduce((a, c) => {
    const d = f - F(c);
    return d >= 0 && d < 10 ? Math.max(a, 1 - d / 10) : a;
  }, 0);
  const settle = interpolate(f, [BEAT.settle, BEAT.settle + BEAT.settleLen], [0, 1], clamp);
  const cardDim = Math.max(prog(f, CARD, 12), f >= F(12.3) && f < F(14.4) ? Math.min(prog(f, F(12.3), 6), 1 - prog(f, F(14.4) - 6, 6)) : 0);
  const flash = (at: number) => Math.max(0, 1 - Math.abs(f - F(at)) / 3);
  const enter = prog(f, F(34.2), F(0.8));
  const cx = interpolate(enter, [0, 1], [1060, 600]);
  const cy = interpolate(enter, [0, 1], [1520, 900]);
  const press = f >= CLICK && f < CLICK + 5 ? 1 : 0;
  const cursorOut = 1 - prog(f, BEAT.del + F(0.7), F(0.3));
  // 2TB 판은 0.3초에 아래에서 올라와 붙는다(새 SSD)
  const dIn = prog(f, F(0.3), F(0.9));
  const scanP = interpolate(f, [BEAT.scan[0], BEAT.scan[1]], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: '#0A0B0E' }}>
      <AbsoluteFill style={{ transform: `scale(${push * (1 + 0.035 * kick * kick)})`, transformOrigin: '50% 55%' }}>
        <AbsoluteFill style={{ opacity: 1 - 0.86 * cardDim }}>
          <Drives beat={BEAT} story={STORY} showKept />
          <DriveLabels settle={settle} />
        </AbsoluteFill>
        {/* 새 2TB가 붙기 전 — 아래 판을 덮는다 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 880, height: 820, background: '#0A0B0E', transform: `translateY(${dIn * 900}px)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#FFFFFF', opacity: Math.max(flash(21.95), flash(31.2)) * 0.55 }} />

      <Head from={0} to={F(3.4)} lines={['새 SSD를 달다가', <B key="b">윈도우가 깨졌다</B>]} />
      <Head from={F(3.4)} to={F(5.5)} lines={[<>잃은 파일 <B key="z">0</B></>, '비운 자리 701.9GB']} />
      <Step from={F(5.5)} to={F(9.6)} n="1" text="통째로 백업" />
      <Head from={F(9.6)} to={F(12.3)} lines={['다시 깔고', <>되살림</>]} />
      <Record from={F(12.3)} to={F(14.4)} />
      <Step from={F(14.4)} to={F(17.7)} n="2" text="무거운 건 2TB로" />
      <Head from={F(17.7)} to={F(21.9)} lines={['원래 자리엔', '바로가기']} />
      <Head from={F(22.1)} to={F(25.7)} lines={['옮기기 전 사본이', <>그대로 — <B key="f">여유 78.7GB</B></>]} />
      <Step from={F(25.7)} to={F(27.1)} n="3" text="같은 파일 두 벌만" />
      {f >= F(27.1) && f < F(31.1) ? (
        <div style={{ position: 'absolute', left: 74, top: 290, fontFamily: KO }}>
          <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: '#FFFFFF' }}>두 곳에 똑같은 파일</div>
          <div style={{ fontWeight: 900, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: BUTTER, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(Math.round(REAL.total * scanP * 10) / 10)}
            <span style={{ fontSize: 70, letterSpacing: -1, marginLeft: 8 }}>GB</span>
          </div>
        </div>
      ) : null}
      <Head from={F(31.4)} to={F(33.9)} lines={['내용이 다른 79.5GB는', '남김']} />
      <Head from={F(33.9)} to={F(36.75)} lines={['지우는 클릭은', <B key="m">내가</B>]} />
      {f >= F(36.75) && f < CARD ? (
        <div style={{ position: 'absolute', left: 74, top: 290, fontFamily: KO }}>
          <div style={{ fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: '#FFFFFF', opacity: prog(f, F(36.75), 6) }}>비운 자리</div>
          <div style={{ fontWeight: 900, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: BUTTER, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(REAL.total)}
            <span style={{ fontSize: 70, letterSpacing: -1, marginLeft: 8 }}>GB</span>
          </div>
        </div>
      ) : null}
      <SaveCard from={CARD} />
      {f >= F(34.2) && f < BEAT.del + F(1.1) ? <Cursor x={cx} y={cy} press={press} o={cursorOut} /> : null}

      {bgm ? <Audio src={staticFile('bgm.wav')} volume={(t) => interpolate(t, [0, F(0.3)], [0.18, 0.3], clamp)} /> : null}
      {VO.map((v) => (
        <Sequence key={v.id} from={F(v.at)}>
          <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1} />
        </Sequence>
      ))}
      <Sequence from={STORY.broken}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.9} />
      </Sequence>
      <Sequence from={BEAT.scan[0]} durationInFrames={BEAT.scan[1] - BEAT.scan[0]}>
        {Array.from({ length: 12 }, (_, i) => (
          <Sequence key={i} from={i * 8}>
            <Audio src={staticFile('sfx/tick2.wav')} volume={0.3 + 0.03 * i} />
          </Sequence>
        ))}
      </Sequence>
      <Sequence from={CLICK}>
        <Audio src={staticFile('sfx/tok.wav')} volume={1} />
      </Sequence>
      <Sequence from={BEAT.del + 2}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={BEAT.settle + F(0.6)}>
        <Audio src={staticFile('sfx/thud.wav')} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
};

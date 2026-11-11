// LAB 21:00 노래 가사판(2026-11-11, 리듬 한국어 준비안 「라」 줄). 화면 문법은 한글 노래 「첫 인사」 틀 —
// 음절마다 칸 하나, 끊어 부를 땐 한 박에 한 칸, 다 부르면 모두 켜지고 뜻 알약(소리 뒤), 쉼 마디에 「?」가 박마다 톡
// (가이드 §3 「낱말 노래 틀」, 공용 작업본 .tmp/hangul-mascot-video-20261006/greeting/work/index_v1.html).
// 언어판 장치는 퀴즈 은행 틀(언어 프로필 · fitBox · LOC 글꼴)을 그대로 쓴다. 진행자는 stage.mode — mongle(장면 속 몽글을 장면과
// 한 장으로 구운 그림) · plain(글자와 낱말 그림만) — 첫 시안 두 판을 보시고 유호님이 고르신다.
// 화면에 AI 도구 이름 · 계정 이름을 쓰지 않는다. 안전 영역: 위 269 · 아래(1920−672) · 왼쪽 65 · 오른쪽 160(SNS 키트).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { KO, LOC } from './fonts';
import { fitBox, profileFor } from './lang';
import { SONG, type Part, type SongDoc } from './songDoc';

const W = 1080;
const H = 1920;
const CORAL = '#FF6F61';
const INK = '#2B211C';
const CREAM = '#FFF8EE';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const hop = (t: number, at: number, amp = 0.16) => {
  const d = t - at;
  if (d < 0 || d > 0.22) return 1;
  return 1 + amp * Math.sin((d / 0.22) * Math.PI);
};

type TileState = { mode: 'ghost' | 'on' | 'done' | 'ask'; scale: number };

function tileStates(doc: SongDoc, t: number): { tiles: TileState[]; part: Part | undefined } {
  const n = doc.syl.length;
  const part = doc.parts.find((p) => t >= p.t && t < p.end) ?? doc.parts[doc.parts.length - 1];
  const sung = doc.parts.filter((p) => p.kind === 'chop' || p.kind === 'whole' || p.kind === 'real').some((p) => p.t <= t);
  const tiles: TileState[] = Array.from({ length: n }, () => ({ mode: sung ? 'done' : 'ghost', scale: 1 }));
  if (!part) return { tiles, part };
  if (part.kind === 'chop') {
    part.at.forEach((a, i) => {
      if (i >= n) return;
      if (t >= a) tiles[i] = { mode: 'on', scale: hop(t, a) };
      const next = part.at[i + 1];
      if (next !== undefined && t >= next) tiles[i] = { mode: 'done', scale: 1 };
    });
    // 끊어 부르는 줄에서 아직 안 부른 칸은 흐리게(처음 줄이면) — 이미 한 번 부른 낱말이면 done 그대로
  }
  if (part.kind === 'whole' || part.kind === 'real') {
    const last = [...part.at].reverse().find((a) => t >= a);
    if (last !== undefined) {
      for (let i = 0; i < n; i++) tiles[i] = { mode: 'on', scale: hop(t, last + 0.03 * i, part.kind === 'real' ? 0.1 : 0.14) };
    }
  }
  if (part.kind === 'rest') {
    const beat = 60 / doc.bpm;
    const k = Math.floor((t - doc.first) / beat);
    const beatAt = doc.first + k * beat;
    for (let i = 0; i < n; i++) tiles[i] = { mode: 'ask', scale: hop(t, Math.max(beatAt, part.t), 0.12) };
  }
  return { tiles, part };
}

const Card: React.FC<{ text: string; lang: string; top: number; size: [number, number]; width?: number; tone?: 'white' | 'coral' }> = ({ text, lang, top, size, width = 900, tone = 'white' }) => {
  const prof = profileFor(lang);
  const box = fitBox(text, prof, width - 80, size[0], size[1], 3);
  return (
    <div style={{ position: 'absolute', top, left: (W - width) / 2 - 40, width, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: tone === 'white' ? 'rgba(255,255,255,0.96)' : CORAL, color: tone === 'white' ? INK : '#fff', borderRadius: 40, padding: '30px 40px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)', fontFamily: LOC, fontWeight: 800, fontSize: box.size, lineHeight: 1.18, textAlign: 'center' }}>
        {box.lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};

export const Song: React.FC<{ doc?: SongDoc }> = ({ doc = SONG }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const loc = doc.loc;
  const prof = profileFor(loc.lang);
  const { tiles, part } = tileStates(doc, t);
  const n = doc.syl.length;
  const size = n <= 3 ? 230 : n === 4 ? 200 : 170;
  const gap = 26;
  const rowW = n * size + (n - 1) * gap;
  const mongle = doc.stage.mode === 'mongle';
  const rowTop = mongle ? 1010 : 975; // 칸 · 읽기 · 뜻 알약이 앱 글자 선(아래 1428px) 안에 들게
  const firstWhole = doc.parts.find((p) => p.kind === 'whole');
  const endPart = doc.parts.find((p) => p.kind === 'end');
  const showMean = firstWhole && t >= firstWhole.at[0] + 0.25 && !(endPart && t >= endPart.t);
  const count = doc.parts.find((p) => p.kind === 'count');
  const inCount = count && t >= count.t && t < count.end;
  const zoom = interpolate(t, [0, doc.duration], [1.0, 1.03], clamp);
  // 박마다 숨쉬기 — 그림 · 다 부른 칸이 박에 맞춰 살짝 뛴다(가만히 있는 화면이 「맹하다」 — 옛 한글 노래는 인형 · 몽글이 박마다 움직였다)
  const beatLen = 60 / doc.bpm;
  const sinceBeat = (((t - doc.first) % beatLen) + beatLen) % beatLen;
  const breath = 1 + 0.018 * Math.max(0, 1 - sinceBeat / 0.18);
  const inEnd = !!(endPart && t >= endPart.t);
  const readSize = fitBox(loc.read.reduce((a, b) => (b.length > a.length ? b : a), ''), prof, size + 30, 50, 30, 1).size;
  return (
    <AbsoluteFill style={{ background: doc.stage.bg ?? '#F4EADB', overflow: 'hidden', ['--loc-font' as string]: prof.font }}>
      <Audio src={staticFile(doc.audio)} />
      {mongle && doc.stage.img ? (
        <Img src={staticFile(doc.stage.img)} style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover', objectPosition: doc.stage.focus ?? '10% 40%', transformOrigin: '25% 30%', transform: `scale(${zoom})` }} />
      ) : null}
      {!mongle ? (
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          <defs>
            <radialGradient id="warm" cx="50%" cy="35%" r="75%"><stop offset="0%" stopColor="#FFF6EA" /><stop offset="100%" stopColor="#EAD8C2" /></radialGradient>
            <filter id="felt"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer></filter>
          </defs>
          <rect width={W} height={H} fill="url(#warm)" />
          <rect width={W} height={H} filter="url(#felt)" />
        </svg>
      ) : null}
      {!mongle && doc.stage.pic ? (
        <div style={{ position: 'absolute', top: 285, left: (W - 80 - 600) / 2, width: 600, height: 600, borderRadius: 56, overflow: 'hidden', boxShadow: '0 18px 44px rgba(60,40,30,0.22)',
          opacity: inEnd ? interpolate(t, [endPart!.t, endPart!.t + 0.25], [1, 0.28], clamp) : 1,
          transform: `scale(${breath * hop(t, firstWhole ? firstWhole.at[0] : 99, 0.05) * interpolate(t, [0, 0.4], [0.92, 1], clamp)})` }}>
          <Img src={staticFile(doc.stage.pic)} style={{ width: 600, height: 600, objectFit: 'cover' }} />
        </div>
      ) : null}
      {/* 카운트인 동안 다리 글 · 박 점 넷 */}
      {inCount ? <Card text={loc.bridge} lang={loc.lang} top={rowTop} size={[76, 50]} /> : null}
      {inCount ? (
        <div style={{ position: 'absolute', top: rowTop - 50, left: 0, width: W - 80, display: 'flex', justifyContent: 'center', gap: 22 }}>
          {[0, 1, 2, 3].map((k) => {
            const at = count!.t + (k + 1) * (count!.end - count!.t) / 4.4;
            return <div key={k} style={{ width: 22, height: 22, borderRadius: 11, background: t >= at ? CORAL : 'rgba(255,255,255,0.7)', transform: `scale(${hop(t, at, 0.4)})` }} />;
          })}
        </div>
      ) : null}
      {/* 음절 칸 */}
      {!inCount && !(mongle && inEnd) ? (
        <div style={{ position: 'absolute', top: rowTop, left: (W - 80 - rowW) / 2, width: rowW, display: 'flex', gap }}>
          {tiles.map((s, i) => {
            const on = s.mode === 'on';
            const ask = s.mode === 'ask';
            return (
              <div key={i} style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: size, height: size, borderRadius: 40, background: on ? CORAL : CREAM, border: `8px solid ${on ? CORAL : ask ? '#E9B7A6' : '#F2C8BC'}`,
                  boxShadow: on ? '0 14px 30px rgba(255,111,97,0.45)' : '0 8px 20px rgba(60,40,30,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: `scale(${s.mode === 'done' ? breath : s.scale})`, fontFamily: KO, fontWeight: 900, fontSize: size * 0.62, color: on ? '#fff' : ask ? CORAL : INK, opacity: s.mode === 'ghost' ? 0.55 : 1 }}>
                  <span style={{ opacity: s.mode === 'ghost' ? 0.35 : 1 }}>{ask ? '?' : doc.syl[i]}</span>
                </div>
                <div style={{ fontFamily: LOC, fontWeight: 700, fontSize: readSize, color: mongle ? '#fff' : '#6B5B53', textShadow: mongle ? '0 2px 8px rgba(0,0,0,0.55)' : 'none',
                  opacity: ask || s.mode === 'ghost' ? 0 : 1, whiteSpace: 'nowrap' }}>{loc.read[i] ?? ''}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      {/* 뜻 알약 */}
      {showMean && part?.kind !== 'rest' ? (
        <div style={{ position: 'absolute', top: rowTop + size + 92, left: 0, width: W - 80, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#fff', color: CORAL, borderRadius: 999, padding: '18px 44px', fontFamily: LOC, fontWeight: 800,
            fontSize: fitBox(loc.mean, prof, 760, 64, 40, 1).size, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', opacity: interpolate(t, [firstWhole!.at[0] + 0.25, firstWhole!.at[0] + 0.45], [0, 1], clamp) }}>
            = {loc.mean}
          </div>
        </div>
      ) : null}
      {/* 네 차례 딱지 */}
      {part?.kind === 'rest' ? (
        <div style={{ position: 'absolute', top: rowTop - 140, left: 0, width: W - 80, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: INK, color: '#fff', borderRadius: 999, padding: '16px 40px', fontFamily: LOC, fontWeight: 800,
            fontSize: fitBox(part.mode === 'clap' ? loc.clap : loc.say, prof, 760, 56, 36, 1).size }}>
            {part.mode === 'clap' ? loc.clap : loc.say}
          </div>
        </div>
      ) : null}
      {part?.kind === 'real' ? (
        <div style={{ position: 'absolute', top: rowTop - 120, left: 0, width: W - 80, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#FFD25E', color: INK, borderRadius: 999, padding: '12px 34px', fontFamily: LOC, fontWeight: 800, fontSize: fitBox(loc.real, prof, 600, 48, 32, 1).size }}>{loc.real}</div>
        </div>
      ) : null}
      {/* 끝 물음 */}
      {inEnd ? <Card text={loc.end} lang={loc.lang} top={mongle ? rowTop : 470} size={[70, 46]} tone="coral" /> : null}
    </AbsoluteFill>
  );
};

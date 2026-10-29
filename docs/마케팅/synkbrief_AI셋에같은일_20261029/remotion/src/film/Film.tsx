// 본편 — 「같은 리뷰 답글, AI 둘에 똑같이」(synkbrief B2 · 오마주 원본 CarterPCs). 원본의 짜임(위 가운데 AI 이름표 · 노래방식 자막 ·
// AI마다 한 구간 · 마지막에 한 마디 반전 · 끝 카드 없이 칼컷)을 따르고, 화면은 우리가 10-29 03:06~03:08 실제로 받은 답(../../시안/)이다.
// 실제 화면은 처음에 그대로 보이고(제작 절차 「화면」), 답글 세 제목 · 둘째 답글만 실제 글 그대로 크게 다시 짠다(「synkbrief · yuhobuilds 편」 3).
// v2(이해 시험 v1 3 · 3점): 강조 색 노랑 → 민트(지난 편과 같아 보임), 작은 띠 대신 제목 셋을 크게, 검은 끝 카드를 뺐다.
// v3(v2 재미 3 · 3, 「같아 보임」 하나): 입력창 · 좌우 비교 무대를 빼고(말풍선에서 시작 · 거슬러 올라감 · 도장에 다가가 칼컷), 채널 이름은 구석에.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CLIPS, clipEnd, f, FPS, T, TOTAL } from './time';
import { VO } from './vo';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = Easing.inOut(Easing.cubic);
const MASTER = 0.8; // 합친 소리가 0 dBFS를 넘지 않게(현장 노트 영상 「Remotion은 소리를 16비트로 더해…」)
const MINT = '#5eead4';
const MINT_BG = 'rgba(94,234,212,.30)';
const RED = '#ff453a';
const ACC = '#3d6bc9'; // SYNK 브리핑 색 한 점(키트 brief)
const END = TOTAL / FPS;

// ── 실제 화면 한 장을 「카메라」로 본다: 그림 속 (fx, fy)를 화면 (cx, cy)에 k배로 ──
type Key = { t: number; fx: number; fy: number; k: number; cx?: number; cy?: number };
const at = (keys: Key[], sec: number, p: 'fx' | 'fy' | 'k' | 'cx' | 'cy', dflt: number) => {
  if (keys.length === 1) return (keys[0][p] as number | undefined) ?? dflt;
  return interpolate(sec, keys.map((k) => k.t), keys.map((k) => (k[p] as number | undefined) ?? dflt), { ...clamp, easing: ease });
};
const Shot: React.FC<{ src: string; w: number; h: number; keys: Key[]; crop?: [number, number]; frame?: string; opacity?: number; children?: React.ReactNode }> = ({ src, w, h, keys, crop, frame, opacity = 1, children }) => {
  const sec = useCurrentFrame() / FPS;
  const k = at(keys, sec, 'k', 1), fx = at(keys, sec, 'fx', w / 2), fy = at(keys, sec, 'fy', h / 2);
  const cx = at(keys, sec, 'cx', 540), cy = at(keys, sec, 'cy', 960);
  const [y0, y1] = crop || [0, h];
  return (
    <div style={{ position: 'absolute', left: cx - fx * k, top: cy - fy * k + y0 * k, width: w * k, height: (y1 - y0) * k, overflow: 'hidden', opacity,
      borderRadius: frame ? 18 : 0, boxShadow: frame ? `0 0 0 4px ${frame}, 0 18px 60px rgba(0,0,0,.6)` : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: -y0 * k, width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <Img src={staticFile(`screen/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
        {children}
      </div>
    </div>
  );
};

// 그림 속 자리에 그은 형광(왼쪽부터 0.3초에 찬다)
const Mark: React.FC<{ x: number; y: number; w: number; h: number; from: number; to?: number; color?: string }> = ({ x, y, w, h, from, to = 999, color = MINT_BG }) => {
  const sec = useCurrentFrame() / FPS;
  if (sec < from || sec > to) return null;
  const p = interpolate(sec, [from, from + 0.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: 'absolute', left: x, top: y, width: w * p, height: h, background: color, borderBottom: `6px solid ${MINT}`, borderRadius: 6 }} />;
};

// ── 위 가운데 AI 이름표(원본의 흰 이름표) + SYNK 브리핑 이름표 ──
const TopCard: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  if (sec < T.card || sec >= T.end1) return null;
  const name = sec < T.gptCard ? 'Gemini' : sec < T.gemCard ? 'ChatGPT' : 'Gemini';
  const since = sec - (sec >= T.gemCard ? T.gemCard : sec >= T.gptCard ? T.gptCard : T.card);
  const drop = interpolate(since, [0, 0.13], [-26, 0], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const op = interpolate(sec - T.card, [0, 0.1], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 300 + drop, display: 'flex', justifyContent: 'center', opacity: op }}>
      <div style={{ position: 'relative', background: '#fff', borderRadius: 22, padding: '20px 54px 22px', boxShadow: '0 10px 34px rgba(0,0,0,.45)' }}>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 64, color: '#1d1e21', letterSpacing: -1, lineHeight: 1 }}>{name}</div>
      </div>
    </div>
  );
};

// 채널 이름은 왼쪽 위 구석에 작게(v3 — 이름표에 붙인 「SYNK 브리핑 실험」을 시험관 넷이 다 「무슨 실험?」으로 읽었다)
const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 278, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.72 }}>
    <div style={{ width: 14, height: 14, borderRadius: 7, background: ACC }} />
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 26, color: '#fff' }}>SYNK 브리핑</div>
  </div>
);

// ── 노래방식 자막(원본처럼 한 번에 몇 낱말, 지금 낱말은 민트) — AI 답 읽기는 따옴표 ──
type Chunk = { from: number; to: number; ai: boolean; words: { w: string; t: number; e: number }[] };
const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (const c of CLIPS) {
    const a = c.cutFrom || 0, b = c.cutTo ?? 999;
    const ws = VO[c.id].words.filter((w) => w.t >= a - 0.01 && w.t < b).map((w) => ({ w: w.w, t: c.at + w.t - a, e: c.at + Math.min(w.e, b) - a }));
    let cur: Chunk['words'] = [];
    const flush = () => { if (cur.length) out.push({ from: cur[0].t - 0.06, to: 0, ai: !c.id.startsWith('v'), words: cur }); cur = []; };
    for (const w of ws) {
      cur.push(w);
      const n = cur.map((x) => x.w).join('').length;
      if (n >= 13 || /[.?]$/.test(w.w)) flush();
    }
    flush();
    const last = out[out.length - 1];
    if (last) last.to = clipEnd(c) + 0.3;
  }
  out.forEach((ch, i) => { const nx = out[i + 1]; const lastE = ch.words[ch.words.length - 1].e; ch.to = nx ? Math.min(ch.to || lastE + 0.5, nx.from) : ch.to || lastE + 0.3; });
  return out;
})();
const OUTLINE = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => `${Math.round(Math.cos((d * Math.PI) / 180) * 6)}px ${Math.round(Math.sin((d * Math.PI) / 180) * 6)}px 0 #000`).join(', ') + ', 0 6px 14px rgba(0,0,0,.7)';
const Caption: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  const ch = CHUNKS.find((c) => sec >= c.from && sec < c.to);
  if (!ch) return null;
  // 덩이는 원본처럼 한 번에 바뀐다 — 0.2초 들고 나기는 박자 수를 줄이지 못하고 0.6초 이름표 박자만 흐렸다(v2c, 오마주.json 「다르게」 칸 수)
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 470, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 66, lineHeight: 1.18, color: '#fff', textShadow: OUTLINE, wordBreak: 'keep-all' }}>
        {ch.ai ? '“' : ''}
        {ch.words.map((w, i) => (
          <span key={i} style={{ color: sec >= w.t - 0.02 && sec < (ch.words[i + 1]?.t ?? ch.to) ? MINT : '#fff' }}>{(i ? ' ' : '') + w.w}</span>
        ))}
        {ch.ai ? '”' : ''}
      </div>
    </div>
  );
};

// ── 답글 세 제목을 실제 글 그대로 크게(작은 띠는 v1 시험에서 안 읽혔다) ──
const TITLES = ['진중하고 정중한 기본형 (가장 추천)', '배달 기사 호출 문제 안내 + 재주문 약속형', '간결하고 깔끔한 사과형'];
const Titles: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  const outP = interpolate(sec, [T.pick, T.pick + 0.2], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: 'absolute', left: 64, right: 64, top: 690, transform: `translateY(${outP * -40}px) scale(${1 - outP * 0.12})`, transformOrigin: '50% 0' }}>
      <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 38, color: '#c4c7cc', marginBottom: 16 }}>Gemini가 준 답글 제목</div>
      {/* 빈 칸 셋이 먼저 서고(「어느 답글에 있는지 보이세요?」) 빠른 세 박에 실제 제목이 하나씩 찬다 */}
      {[T.b1, T.b2, T.b3].map((t, i) => {
        const p = interpolate(sec, [t, t + 0.12], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, minHeight: 92, background: p > 0 ? '#16171a' : 'transparent', borderRadius: 22, padding: '26px 28px', marginBottom: 18,
            boxShadow: p > 0 ? '0 0 0 2px rgba(255,255,255,.14)' : 'none', border: p > 0 ? 'none' : '3px dashed rgba(255,255,255,.28)' }}>
            <div style={{ flex: '0 0 auto', width: 84, height: 84, borderRadius: 42, background: p > 0 ? MINT : 'rgba(255,255,255,.12)', color: '#0b0c0e', fontFamily: EN, fontWeight: 800, fontSize: 54, lineHeight: '84px', textAlign: 'center' }}>{i + 1}</div>
            <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 44, lineHeight: 1.3, color: '#e8eaed', wordBreak: 'keep-all', opacity: p, transform: `translateX(${(1 - p) * 80}px)` }}>{TITLES[i]}</div>
          </div>
        );
      })}
      {sec >= T.pick ? (
        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: KO, fontWeight: 900, fontSize: 92, color: '#fff', textShadow: OUTLINE, opacity: interpolate(sec, [T.pick, T.pick + 0.15], [0, 1], clamp) }}>
          답글 <span style={{ color: MINT }}>3개</span>
        </div>
      ) : null}
    </div>
  );
};

// ── 둘째 답글을 실제 글 그대로 크게(「크게 다시 짜기」) ──
const BigReply: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  // 반전에 다가가고, 끝 두 박(원본의 정적 끝 · 칼컷 한 줄)에 지어 넣은 줄 · 도장으로 한 번씩 더 바짝(v3 — 좌우 비교 끝 화면을 뺐다)
  const zoom = interpolate(sec, [T.twist, T.twist + 0.22, T.end1, T.end1 + 0.16, T.end2, T.end2 + 0.14], [1, 1.13, 1.13, 1.32, 1.32, 1.62], { ...clamp, easing: Easing.out(Easing.cubic) });
  const origin = interpolate(sec, [T.end2, T.end2 + 0.14], [62, 74], clamp);
  const sweep = interpolate(sec, [T.twist, T.twist + 0.35], [0, 100], clamp);
  const st = interpolate(sec, [T.stamp, T.stamp + 0.12], [1.5, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const dim = interpolate(sec, [T.twist, T.twist + 0.22], [1, 0.38], clamp);
  return (
    <AbsoluteFill style={{ background: '#0b0c0e' }}>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 660, transform: `scale(${zoom})`, transformOrigin: `82% ${origin}%` }}>
        <div style={{ background: '#16171a', borderRadius: 28, padding: '34px 40px 40px', boxShadow: '0 0 0 2px rgba(255,255,255,.12)' }}>
          <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 26, color: '#9aa0a6', marginBottom: 14 }}>Gemini 답 그대로 · 둘째 답글 일부</div>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 36, color: '#e8eaed', marginBottom: 20, opacity: dim }}>옵션 2. 배달 기사 호출 문제 안내 + 재주문 약속형</div>
          <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 42, lineHeight: 1.45, color: '#e8eaed', fontStyle: 'italic', wordBreak: 'keep-all', opacity: dim }}>안녕하세요 고객님, [상호명]입니다. …</div>
          <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 48, lineHeight: 1.42, color: '#fff', fontStyle: 'italic', wordBreak: 'keep-all', marginTop: 18 }}>
            <span style={{ backgroundImage: `linear-gradient(90deg, ${MINT_BG} ${sweep}%, transparent ${sweep}%)`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '0 4px' }}>
              주방에서는 조리를 제때 마쳤으나, 배달 라이더 배차가 지연되면서 도착까지 너무 오랜 시간이 소요된 것으로 파악됩니다.
            </span>
          </div>
          <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 42, color: '#e8eaed', fontStyle: 'italic', marginTop: 12, opacity: dim }}>…</div>
        </div>
        {sec >= T.stamp ? (
          <div style={{ position: 'absolute', right: 20, top: 480, transform: `rotate(-5deg) scale(${st})`, border: `7px solid ${RED}`, borderRadius: 14, padding: '10px 24px', background: 'rgba(11,12,14,.88)',
            fontFamily: KO, fontWeight: 900, fontSize: 64, color: RED, whiteSpace: 'nowrap' }}>제가 안 한 말</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── 장면 ──
const GEM = { src: 'gem.jpg', w: 1080, h: 4300 };
const GPT = { src: 'gpt.jpg', w: 1080, h: 3042 };
const S = (from: number, to: number) => ({ from, to });
// 장면은 절대 시각으로 켜고 끈다 — Sequence 안에서는 useCurrentFrame이 장면 처음부터 다시 세어져 다가가기 · 형광 시각이 어긋난다(v1)
const Span: React.FC<{ from: number; to: number; children?: React.ReactNode }> = ({ from, to, children }) => {
  const sec = useCurrentFrame() / FPS;
  return sec >= from && sec < to ? <>{children}</> : null;
};
const clipAt = (id: string) => CLIPS.find((x) => x.id === id)!.at;

export const Film: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#0b0c0e' }}>
      {/* 0 · 실제 Gemini 답 화면 위의 부탁 말풍선에 다가가 크게(v3 — 입력창에서 시작하는 무대가 지난 편과 같아 보였다) */}
      <Span {...S(0, T.answer)}>
        <Shot {...GEM} keys={[{ t: 0, fx: 582, fy: 432, k: 1.35, cy: 1000 }, { t: T.answer, fx: 582, fy: 432, k: 1.42, cy: 1000 }]} />
      </Span>
      {/* 1.9 · 실제 답 화면 그대로(말풍선은 자막 아래로) → 「세 가지 버전」에 다가감 */}
      <Span {...S(T.answer, T.opt1)}>
        <Shot {...GEM} keys={[{ t: T.answer, fx: 540, fy: 860, k: 1, cy: 1200 }, { t: T.three, fx: 540, fy: 860, k: 1, cy: 1200 }, { t: T.three + 0.2, fx: 400, fy: 880, k: 1.3, cy: 1000 }]}>
          <Mark x={200} y={850} w={330} h={62} from={T.three} />
        </Shot>
      </Span>
      {/* 답글 1 · 2 · 3(실제 화면을 내려 봄) */}
      <Span {...S(T.opt1, T.opt2)}>
        <Shot {...GEM} keys={[{ t: T.opt1, fx: 540, fy: 950, k: 1.12, cy: 1000 }, { t: T.opt2, fx: 540, fy: 1350, k: 1.12, cy: 1000 }]}>
          <Mark x={334} y={1058} w={164} h={56} from={clipAt('g02') + 0.68} />
        </Shot>
      </Span>
      <Span {...S(T.opt2, T.opt3)}>
        <Shot {...GEM} keys={[{ t: T.opt2, fx: 470, fy: 2300, k: 1.4, cy: 1000 }, { t: T.opt3, fx: 470, fy: 2350, k: 1.4, cy: 1000 }]} />
      </Span>
      <Span {...S(T.opt3, T.strip)}>
        <Shot {...GEM} keys={[{ t: T.opt3, fx: 540, fy: 3480, k: 0.9, cy: 1060 }, { t: T.strip, fx: 540, fy: 3520, k: 0.9, cy: 1060 }]} />
      </Span>
      {/* 답글 제목 빈 칸 셋 → 실제 제목이 하나씩 → 「답글 3개」(v3 — 안 읽히던 긴 띠를 뺐다) */}
      <Span {...S(T.strip, T.gptAsk)}>
        <Titles />
      </Span>
      {/* ChatGPT — 실제 답 화면 위의 같은 부탁 말풍선 → 답 화면 */}
      <Span {...S(T.gptAsk, T.gptAns)}>
        <Shot {...GPT} keys={[{ t: T.gptAsk, fx: 690, fy: 365, k: 1.3, cy: 1000 }, { t: T.gptAns, fx: 690, fy: 365, k: 1.36, cy: 1000 }]} />
      </Span>
      <Span {...S(T.gptAns, T.side)}>
        <Shot {...GPT} keys={[{ t: T.gptAns, fx: 540, fy: 1160, k: 1, cy: 1030 }, { t: T.gptZoom, fx: 540, fy: 1160, k: 1, cy: 1030 }, { t: T.gptZoom + 0.6, fx: 540, fy: 1150, k: 1.1, cy: 1040 }]}>
          {sec >= clipAt('v04') + 0.25 ? (
            <div style={{ opacity: interpolate(sec, [clipAt('v04') + 0.25, clipAt('v04') + 0.6], [0, 1], clamp) }}>
              <div style={{ position: 'absolute', left: 30, top: 652, width: 1020, height: 1018, borderRadius: 40, border: `9px solid ${MINT}` }} />
              <div style={{ position: 'absolute', left: 874 - 50, top: 728 - 50, width: 100, height: 100, borderRadius: 50, border: `7px solid ${MINT}` }} />
            </div>
          ) : null}
          {[[795, 990], [1030, 1225], [1265, 1460], [1500, 1630]].map(([y0, y1], i) => (
            <Mark key={y0} x={60} y={y0} w={960} h={y1 - y0} from={T.gptZoom + 0.9 + i * 0.35} color="rgba(94,234,212,.16)" />
          ))}
        </Shot>
      </Span>
      {/* 다시 Gemini — 실제 답 화면을 셋째 답글에서 둘째 답글로 거슬러 올라가 테(v3 — 좌우 비교는 지난 편과 같아 보였다) */}
      <Span {...S(T.side, T.opt2big)}>
        <Shot {...GEM} keys={[{ t: T.side, fx: 540, fy: 3420, k: 0.62, cy: 1040 }, { t: T.gemCard, fx: 540, fy: 2570, k: 0.62, cy: 1040 }]}>
          {sec >= T.gemCard ? <div style={{ position: 'absolute', left: 14, top: 2056, width: 1052, height: 1024, border: `14px solid ${MINT}`, borderRadius: 36 }} /> : null}
        </Shot>
      </Span>
      {/* 둘째 답글을 크게 → 반전 → 도장 → 끝까지 바짝 다가가 칼컷(끝 카드 없음) */}
      <Span {...S(T.opt2big, END + 1)}>
        <BigReply />
      </Span>

      {/* 위 어둠(이름표 · 자막 자리) */}
      <AbsoluteFill style={{ background: sec < T.end1 ? 'linear-gradient(180deg, rgba(0,0,0,.92) 0px, rgba(0,0,0,.86) 420px, rgba(0,0,0,0) 640px)' : 'linear-gradient(180deg, rgba(0,0,0,.94) 0px, rgba(0,0,0,.92) 620px, rgba(0,0,0,0) 760px)', pointerEvents: 'none' }} />
      <TopCard />
      <Brand />
      <Caption />

      {/* 소리: 배경음(목소리 아래) + 줄(한 마디만 쓰는 AI 낭독은 끝 3프레임을 내린다) */}
      <Audio src={staticFile('bgm.mp3')} volume={(x) => MASTER * bgmLevel(x / FPS)} />
      {CLIPS.map((c) => {
        const n = f(clipEnd(c) - c.at);
        return (
          <Sequence key={c.id} from={f(c.at)} durationInFrames={Math.max(1, n + (c.cutTo ? 0 : 3))} layout="none">
            <Audio src={staticFile(`vo/${c.id}.wav`)} trimBefore={c.cutFrom ? Math.round(c.cutFrom * FPS) : undefined} volume={(x) => MASTER * (c.cutTo ? interpolate(x, [n - 3, n], [1, 0], clamp) : 1)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// 배경음: 말하는 동안 낮게, 쉬는 틈에 조금 올림, 끝에서 칼컷(마지막 4프레임만 내림)
function bgmLevel(sec: number) {
  const gap = Math.min(...CLIPS.map((c) => (sec < c.at ? c.at - sec : sec > clipEnd(c) ? sec - clipEnd(c) : 0)));
  const base = interpolate(gap, [0.1, 0.4], [0.22, 0.42], clamp);
  const fadeIn = interpolate(sec, [0, 0.3], [0.6, 1], clamp);
  const out = interpolate(sec, [END - 0.14, END], [1, 0], clamp);
  return base * fadeIn * out;
}

// 끝 7.2초(v6 · v6d):
//   ㄱ(0~3.3초) 그림 붙은 복습 줄 셋(글자 그대로 장면 + 「관용구 = 뜻」)이 1초 안에 쌓이고 → 끝 질문(한국어 한 줄 + 「= 뜻」) + 점수 칸(한국어 목소리가 묻는다)
//   ㄴ(끝 3.9초) 복습 줄이 물러나고 끝 장면 한 장(그 편의 하루를 받아치는 새 장면 — episode.end.art)이 들어온다. 판은 그대로 아래로 내려가 끝까지 남는다.
//   v6d: 끝 장면을 4.5초 → 3.3초로 당겼다(v6a 볼 이유 심사 「복습이 가장 약한 자리 — 1~2초로 줄이고 첫 장면을 받아치는 새 장면으로 끝내라」).
//       곡의 마지막 두 타격에 한국어 응원 말(목소리) → 로고. 정지 카드가 아니라 장면으로 끝난다(제작 절차 「한 장면 먼저」 ③).
// v6a 볼 이유 심사: 「30~36초 복습을 6초 동안 한 줄씩 늘어놓는다 · 끝 장면이 첫 그림을 다시 쓴다」 → 복습은 1초 안에 다 쌓고, 끝은 새 장면으로.
// 올리기 전 검사 ② · ③: 복습 · 점수 화면이 2.5초 멈춰 있었고 끝 장면이 1.3초였다 → 끝 장면을 2.7초로 당기고 그 장면은 떠다닌다.
// 끝 질문 판(질문 · 점수 칸 · 댓글 부탁 줄)은 끝까지 남아 읽을 틈이 길다(v6b sonnet: 말풍선 표시만으로는 「점수 칸이 누르는 단추인지」 몰랐다 — 글 줄을 되살렸다).
// v5까지: 글만 있는 복습 줄 + 「글자 그대로가 아니라, 진짜 뜻은:」 제목 + 응원 그림 카드 — 글자 검사 「3.4초에 148자」, 볼 이유 심사 「끝도 정리에 그친다」.
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, clamp, EASE_OUT } from './anim';
import { shotsOf, type Episode } from './episode';
import { KO } from './fonts';
import { fitBox, type LangProfile } from './lang';
import { emOf, SAFE, titleLines, W } from './Question';
import { Scene } from './Scene';
import { E } from './timeline';
import { K, plate, stitch, type } from './theme';
import type { Ui } from './ui';

const TOP = 352;
const ease = (f: number, a: number, len: number) => interpolate(f, [a, a + len], [0, 1], { ...clamp, easing: EASE_OUT });
const rise = (p: number, dist = 28): React.CSSProperties => ({ opacity: Math.min(1, p * 1.7), translate: `0 ${(1 - p) * dist}px` });

/** v6f 끝(end.tags가 있을 때): 세 관용구가 한 사건으로 터지는 장면 한 장이 처음부터 끝까지 크게 서고, 그 위에 이름표 셋(「관용구 = 뜻」)이
 *  박마다 그 사건의 자리에 붙는다 — 복습 줄(글자 그대로 그림 셋)을 따로 늘어놓지 않는다.
 *  까닭(v6d): 볼 이유 심사 셋 모두 「둘 다 아님 — 갈등이 없어 여운까지 못 간다 · 세 토막이 따로 논다 · 요약 + 환호가 새것 없이 5초」,
 *  haiku 답 1이 세 편 모두 한 관용구만(「오늘 배운 셋」이 한 장에 묶여 읽히지 않았다). 맨 위 제목은 「글자 그대로가 아니라 — 진짜 뜻은:」(v4 글, 세 겹 거침). */
const TagEnd: React.FC<{ ep: Episode; lang: string; ui: Ui; prof: LangProfile }> = ({ ep, lang, ui, prof }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const epLoc = ep.loc[lang];
  const tags = ep.end.tags ?? [];
  const askKoSize = Math.min(58, Math.floor((W - 64) / emOf(ep.end.askKo)));
  const ask = fitBox(`= ${epLoc.ask}`, prof, W - 64, 42, 30, 2);
  const comment = fitBox(ui.comment, prof, W - 64 - 190, 42, 30, 1); // 오른쪽에 「?/3」 칸
  const qH = askKoSize * 1.15 + ask.lines.length * ask.size * 1.15 + 10;
  // v6f: 점수 칸 넷(0/3~3/3) 대신 큰 「?/3」 하나 + 댓글 부탁 줄 — 칸 넷을 「누르는 단추인지 · 고르라는 건지」(v6b · v6d · v6f1 sonnet · haiku 같이)
  const plateH = 16 + qH + 10 + Math.max(84, comment.size * 1.2) + 16;
  const lowTop = Math.round(SAFE.b - 62 - 12 - plateH);
  const title = fitBox(ui.recapTitle, prof, 830, 46, 32, 1);
  const titleH = Math.round(title.size * 1.25);
  const cardTop = TOP + titleH + 12;
  // 처음 1.8초는 장면이 화면 폭 가득(1080 × 4:3) — 점수 판이 오르면(E.ask) 폭 855 칸으로 줄어든다. 이름표는 줄어든 뒤의 자리에 처음부터 서고(안전 영역 안),
  // 실 끝의 점만 장면을 따라간다.
  const fin = { x: SAFE.l, w: W, h: lowTop - 20 - cardTop };
  const big = { x: 0, w: 1080, h: Math.min(810, SAFE.b - 10 - cardTop) };
  const shrink = ease(f, E.ask - 3, 10);
  const cx = big.x + (fin.x - big.x) * shrink, cw = big.w + (fin.w - big.w) * shrink, ch = big.h + (fin.h - big.h) * shrink;
  const cardH = fin.h;
  // 점(dot)은 끝 그림(4:3) 안의 %다 — Scene과 같은 셈으로 칸 안 자리를 찾는다(칸이 줄어도 그림 속 같은 곳을 가리킨다)
  const imgPt = (d: [number, number]) => {
    const iw = Math.max(cw, ch * (4 / 3)), ih = iw * 0.75;
    const fy = ep.end.focus?.[1] ?? 50;
    const top = Math.min(0, Math.max(ch - ih, ch / 2 - (ih * fy) / 100));
    return [cx + (cw - iw) / 2 + (iw * d[0]) / 100, cardTop + top + (ih * d[1]) / 100];
  };
  const sceneIn = spring({ frame: f + 2, fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
  const cheerIn = spring({ frame: f - E.cheer, fps, config: { damping: 9, stiffness: 190, mass: 0.6 } });
  const cheerOn = f >= E.cheer - 1;
  // 응원 말은 맨 위 제목 자리 한 줄(한국어 + 뜻) — 장면 위 큰 판이 이름표를 덮지 않게
  const cheerFit = fitBox(epLoc.cheer, prof, 360, 40, 28, 1);
  const cheerSize = Math.min(64, Math.floor(380 / emOf(ep.end.cheerKo)));
  return (
    <AbsoluteFill>
      {/* 맨 위: 「글자 그대로가 아니라 — 진짜 뜻은:」 — 응원 말이 오면 물러난다 */}
      <div style={{ position: 'absolute', left: SAFE.l, width: W, top: TOP, display: 'flex', justifyContent: 'center', opacity: Math.min(1, ease(f, 0, 6) * 1.7) }}>{/* 끝까지 남는다 — 마지막 칸(시험관이 보는 끝 장면)에도 「글자 그대로가 아니라 — 진짜 뜻은:」 */}
        <span style={{ ...type(title.size, { font: 'loc', weight: 800, color: K.butter }), whiteSpace: 'nowrap' }}>{title.lines[0]}</span>
      </div>
      {/* 한 사건 장면 */}
      <div style={{ scale: `${0.92 + 0.08 * sceneIn}`, transformOrigin: `540px ${cardTop + ch / 2}px` }}>
        <Scene shots={[{ src: ep.end.art, focus: ep.end.focus }]} moves={ep.end.moves} t={f} fps={fps} x={cx} y={cardTop} w={cw} h={ch} beat2={1} pull={false} radius={36 * shrink} />
      </div>
      {/* 이름표 셋 — 가리키는 자리(dot)에 점 하나, 이름표(box 가운데)까지 실 한 가닥 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {tags.map((t, i) => {
          const p = ease(f, E.recap[i] - 1, 7);
          if (p <= 0) return null;
          const [dx, dy] = imgPt(t.dot);
          const bx = SAFE.l + (W * t.box[0]) / 100, by = cardTop + (cardH * t.box[1]) / 100;
          return (
            <g key={i} opacity={Math.min(1, p * 1.7)}>
              <line x1={bx} y1={by} x2={bx + (dx - bx) * p} y2={by + (dy - by) * p} stroke={K.paper} strokeWidth={5} strokeDasharray="10 8" strokeLinecap="round" />
              <circle cx={dx} cy={dy} r={13 * p} fill={K.butter} stroke={K.navy} strokeWidth={5} />
            </g>
          );
        })}
      </svg>
      {tags.map((t, i) => {
        const q = ep.questions[i];
        const pop = spring({ frame: f - E.recap[i], fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
        if (f < E.recap[i] - 1) return null;
        const recap = fitBox(`= ${q.loc[lang].recap}`, prof, 400, 34, 28, 2);
        const ko = titleLines(q.idiom); // 긴 관용구(「사공이 많으면 / 배가 산으로 간다」)는 두 줄
        const koSize = Math.min(46, Math.floor(400 / Math.max(...ko.map(emOf))));
        const bx = SAFE.l + (W * t.box[0]) / 100, by = cardTop + (cardH * t.box[1]) / 100;
        return (
          <div key={i} style={{ position: 'absolute', left: bx, top: by, translate: '-50% -50%', ...plate(K.paper, 22, 6), padding: '8px 20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', scale: `${Math.max(0, pop)}`, rotate: `${i % 2 ? 2 : -2}deg` }}>
            {ko.map((l, k) => <span key={`k${k}`} style={{ whiteSpace: 'nowrap', ...type(koSize, { weight: 900, color: K.navy, line: 1.12 }) }}>{l}</span>)}
            {recap.lines.map((l, k) => (
              <span key={k} style={{ whiteSpace: 'nowrap', ...type(recap.size, { font: 'loc', weight: 800, color: K.coral, line: 1.14 }) }}>{l}</span>
            ))}
          </div>
        );
      })}
      <Burst at={E.recap[2] + 2} x={540} y={cardTop + cardH / 2} colors={[K.coral, K.butter, K.meadow, K.cream]} seed="end" count={22} spread={520} dur={30} />
      {/* 응원 말(곡의 마지막 두 타격) — 장면 위 판(cheerBy면 그 인물의 말풍선) */}
      {cheerOn ? (
        <div style={{ position: 'absolute', left: SAFE.l + 40, width: W - 80, top: cardTop + fin.h - 108, height: 88, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, ...plate('rgba(20, 28, 64, 0.86)', 30, 0), scale: `${0.7 + 0.3 * cheerIn}` }}>
          {/* 장면 아래쪽 안에 한 줄(맨 위 제목은 끝까지 남긴다). cheerBy: 끝 장면 속 그 인물의 말 — 위로 난 꼬리가 장면 가로 cheerBy%를 가리킨다 */}
          {ep.end.cheerBy !== undefined ? <div style={{ position: 'absolute', left: `${((ep.end.cheerBy * W) / 100 - 40) / (W - 80) * 100}%`, top: -22, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderBottom: '24px solid rgba(20, 28, 64, 0.86)', translate: '-50% 0' }} /> : null}
          <span style={{ ...type(cheerSize, { weight: 900, color: K.butter, line: 1.1 }), whiteSpace: 'nowrap', rotate: '-3deg' }}>{ep.end.cheerKo}</span>
          <span style={{ ...type(cheerFit.size, { font: 'loc', weight: 800, line: 1.2 }), whiteSpace: 'nowrap', ...rise(ease(f, E.cheer + 2, 7), 16) }}>{epLoc.cheer}</span>
        </div>
      ) : null}
      {/* 끝 질문 + 점수 칸 — 장면 아래에서 떠서 끝까지 */}
      {f >= E.ask ? (
        <div style={{ position: 'absolute', left: SAFE.l, top: lowTop, width: W, height: plateH, boxSizing: 'border-box', overflow: 'hidden', ...plate(K.paper, 34, 8), padding: '16px 32px 16px', ...rise(ease(f, E.ask, 9), 34) }}>
          <div style={{ height: qH, overflow: 'hidden' }}>
            <div style={{ ...type(askKoSize, { weight: 900, color: K.navy, line: 1.15 }), whiteSpace: 'nowrap' }}>{ep.end.askKo}</div>
            {ask.lines.map((l, k) => (
              <div key={k} style={{ ...type(ask.size, { font: 'loc', weight: 800, color: K.coral, line: 1.15 }), whiteSpace: 'nowrap' }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginTop: 10 }}>
            <div style={{ ...type(comment.size, { font: 'loc', weight: 800, color: K.navy, line: 1.2 }), whiteSpace: 'nowrap', opacity: ease(f, E.ask + 6, 8) }}>{ui.comment}</div>
            {(() => {
              const sIn = spring({ frame: f - (E.ask + 8), fps, config: { damping: 10, stiffness: 190, mass: 0.6 } });
              const w = f - (E.ask + 24);
              const hop = w >= 0 && w % 40 < 10 ? Math.sin((Math.PI * (w % 40)) / 10) : 0;
              return (
                <div style={{ ...plate(K.butter, 22, 0), border: '3px dashed rgba(27, 42, 90, 0.4)', boxSizing: 'border-box', width: 168, height: 84, flex: '0 0 168px', display: 'grid', placeItems: 'center', scale: `${sIn * (1 + 0.07 * hop)}`, translate: `0 ${-8 * hop}px` }}>
                  <span style={{ font: `800 50px 'Inter Tight', sans-serif`, color: K.navy }}>?/3</span>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
      {f >= E.logo ? (
        <div style={{ position: 'absolute', left: SAFE.l, width: W, top: lowTop + plateH + 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, ...rise(ease(f, E.logo, 7), 18) }}>
          <div style={{ ...plate(K.white, 18, 5), padding: '8px 16px' }}>
            <Img src={staticFile('img/logo-lab.webp')} style={{ height: 46, width: 'auto', display: 'block' }} />
          </div>
          <span style={{ font: `700 36px 'Inter Tight', ${KO}`, color: K.cream }}>{epLoc.handle}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const End: React.FC<{ ep: Episode; lang: string; ui: Ui; prof: LangProfile }> = ({ ep, lang, ui, prof }) => {
  if (ep.end.tags?.length) return <TagEnd ep={ep} lang={lang} ui={ui} prof={prof} />;
  return <ListEnd ep={ep} lang={lang} ui={ui} prof={prof} />;
};

const ListEnd: React.FC<{ ep: Episode; lang: string; ui: Ui; prof: LangProfile }> = ({ ep, lang, ui, prof }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const epLoc = ep.loc[lang];
  const swap = ease(f, E.scene - 3, 7); // 복습 줄이 물러나고 끝 장면으로
  const ROW = { h: 212, gap: 12, pic: 272 };
  const textW = W - ROW.pic - 28;
  // v6d: 끝 질문은 한국어 한 줄(목소리가 읽는 그 말) + 그 아래 「= 뜻」 — v6a · v6c 그록이 두 번 「몇 개 맞혔어요?」가 무슨 말인지 몰랐다
  //   (들리는 한국어와 화면의 몽골어가 이어지지 않았다). 질문은 끝까지 남는다(끝 장면에서 접지 않는다 — 접으면 1초 남짓에 사라졌다).
  const askKoSize = Math.min(58, Math.floor((W - 64) / emOf(ep.end.askKo)));
  const ask = fitBox(`= ${epLoc.ask}`, prof, W - 64, 42, 30, 2);
  const comment = fitBox(ui.comment, prof, W - 64, 42, 30, 1); // v6e: 36 → 42 · 점수 칸 위로(v6d sonnet 「누르는 칸인지 댓글에 쓰라는 건지」 · haiku 「작은 글자」)
  const qH = askKoSize * 1.15 + ask.lines.length * ask.size * 1.15 + 10; // 질문 두 줄(한국어 · 뜻)
  const plateH = 16 + qH + 80 + 10 + comment.size * 1.2 + 16; // 질문 + 점수 칸 + 댓글 부탁 줄
  const askTop = Math.round(TOP + 3 * ROW.h + 2 * ROW.gap + 18);
  const lowTop = Math.round(SAFE.b - 62 - 12 - plateH); // 끝 장면에서 판이 내려앉는 자리(그 아래 로고)
  // 끝 장면으로 넘어갈 때 판이 아래로 내려간다 — 화면 구성이 그대로면 한 구성 4.75초로 걸렸다(올리기 전 검사 ⑬)
  const plateTop = askTop + (lowTop - askTop) * swap;
  const cheerSize = Math.min(96, Math.floor(820 / emOf(ep.end.cheerKo)));
  const cheerFit = fitBox(epLoc.cheer, prof, 800, 42, 32, 1);
  const cardTop = Math.round(TOP + cheerSize * 1.12 + cheerFit.size * 1.3 + 14);
  const cardH = lowTop - 22 - cardTop;
  const cheerIn = spring({ frame: f - E.cheer, fps, config: { damping: 9, stiffness: 190, mass: 0.6 } });
  const sceneIn = spring({ frame: f - (E.scene - 2), fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });

  return (
    <AbsoluteFill>
      {/* ㄱ 복습 줄 셋 */}
      {swap < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - swap, translate: `0 ${-18 * swap}px` }}>
          {ep.questions.map((q, i) => {
            const p = ease(f, E.recap[i] - 3, 9); // 끝 첫 프레임이 비어 보이지 않게 세 프레임 먼저 오른다
            if (f < E.recap[i] - 3) return null;
            const shot = shotsOf(q.art.literal, q.art.focus)[0];
            const recap = fitBox(`= ${q.loc[lang].recap}`, prof, textW, 50, 32, 2);
            const koSize = Math.min(64, Math.floor(textW / emOf(q.idiom)));
            const pop = 1 + 0.06 * Math.exp(-(f - E.recap[i]) / 4);
            return (
              <div key={i} style={{ position: 'absolute', left: SAFE.l, top: TOP + i * (ROW.h + ROW.gap), width: W, height: ROW.h, display: 'flex', alignItems: 'center', gap: 28, ...rise(p, 34) }}>
                <div style={{ position: 'relative', width: ROW.pic, height: ROW.h - 8, flex: `0 0 ${ROW.pic}px`, borderRadius: 26, overflow: 'hidden', boxShadow: '0 8px 0 rgba(13, 20, 48, 0.26)', scale: `${pop}` }}>
                  {/* 복습 그림도 멈춰 있지 않게 천천히 다가간다 */}
                  <Img src={staticFile(shot.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${shot.focus?.[0] ?? 50}% ${shot.focus?.[1] ?? 50}%`, scale: `${1.02 + 0.12 * Math.min(1, Math.max(0, f - E.recap[i]) / 110)}`, transformOrigin: `${shot.focus?.[0] ?? 50}% ${shot.focus?.[1] ?? 50}%` }} />
                  <div style={stitch(8, 'rgba(255, 246, 220, 0.8)', 18)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ whiteSpace: 'nowrap', ...type(koSize, { weight: 900 }) }}>{q.idiom}</span>
                  {recap.lines.map((l, k) => (
                    <span key={k} style={{ whiteSpace: 'nowrap', ...type(recap.size, { font: 'loc', weight: 800, color: K.butter }) }}>{l}</span>
                  ))}
                </div>
              </div>
            );
          })}
          <Burst at={E.recap[2] + 2} x={492} y={640} colors={[K.coral, K.butter, K.meadow, K.cream]} seed="end" count={26} spread={560} dur={34} />
        </AbsoluteFill>
      ) : null}

      {/* ㄴ 끝 장면: 한국어 응원 말(마지막 두 타격) + 장면 한 장 */}
      {f >= E.scene - 3 ? (
        <AbsoluteFill style={{ opacity: swap }}>
          <div style={{ scale: `${0.9 + 0.1 * sceneIn}`, transformOrigin: `492px ${cardTop + cardH / 2}px` }}>
            <Scene shots={[{ src: ep.end.art, focus: ep.end.focus }]} moves={ep.end.moves} t={f - E.scene} fps={fps} x={SAFE.l} y={cardTop} w={W} h={cardH} beat2={1} pull={false} />
          </div>
          {f >= E.cheer - 1 ? (
            <div style={{ position: 'absolute', left: SAFE.l, width: W, top: TOP - 4, display: 'flex', flexDirection: 'column', alignItems: 'center', ...(ep.end.cheerBy !== undefined ? { left: SAFE.l + 60, width: W - 120, top: TOP - 14, ...plate('rgba(20, 28, 64, 0.82)', 40, 0), padding: '10px 0 14px' } : {}) }}>
              {/* v6e: cheerBy — 응원 말이 끝 장면 속 인물(ㅂ셋 편은 바가지를 씌운 여우)의 말이다. 꼬리가 그 인물을 가리킨다(v6d opus 「처진 몽글 위에 최고예요! — 감정이 어긋난다」 → 여우가 또 띄워 주는 말로 받아친다) */}
              {ep.end.cheerBy !== undefined ? <div style={{ position: 'absolute', left: `${ep.end.cheerBy}%`, bottom: -22, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '24px solid rgba(20, 28, 64, 0.82)', translate: '-50% 0' }} /> : null}
              <span style={{ ...type(cheerSize, { weight: 900, color: K.butter, line: 1.12 }), whiteSpace: 'nowrap', scale: `${0.6 + 0.4 * cheerIn}`, rotate: '-3deg' }}>{ep.end.cheerKo}</span>
              <span style={{ ...type(cheerFit.size, { font: 'loc', weight: 800, line: 1.3 }), whiteSpace: 'nowrap', ...rise(ease(f, E.cheer + 2, 7), 16) }}>{epLoc.cheer}</span>
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* 끝 질문 + 점수 칸 — ㄱ에서 떠서 끝까지 남는다 */}
      {f >= E.ask ? (
        <div style={{ position: 'absolute', left: SAFE.l, top: plateTop, width: W, height: plateH, boxSizing: 'border-box', overflow: 'hidden', ...plate(K.paper, 34, 8), padding: '16px 32px 16px', ...rise(ease(f, E.ask, 9), 34) }}>
          <div style={{ height: qH, overflow: 'hidden' }}>
            <div style={{ ...type(askKoSize, { weight: 900, color: K.navy, line: 1.15 }), whiteSpace: 'nowrap' }}>{ep.end.askKo}</div>
            {ask.lines.map((l, k) => (
              <div key={k} style={{ ...type(ask.size, { font: 'loc', weight: 800, color: K.coral, line: 1.15 }), whiteSpace: 'nowrap' }}>{l}</div>
            ))}
          </div>
          {/* v6e: 댓글 부탁 줄을 점수 칸 위로 — 「점수 칸이 누르는 단추인지 댓글에 쓰라는 건지」(v6b · v6d sonnet) */}
          <div style={{ marginBottom: 10, ...type(comment.size, { font: 'loc', weight: 800, color: K.navy, line: 1.2 }), whiteSpace: 'nowrap', opacity: ease(f, E.ask + 6, 8) }}>{ui.comment}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {[0, 1, 2, 3].map((n) => {
              const s = spring({ frame: f - (E.ask + 5 + n * 4), fps, config: { damping: 10, stiffness: 190, mass: 0.6 } });
              // 점수 칸이 차례로 통통 뛴다(몇 개 맞혔는지 골라 보라는 물결)
              const w = f - (E.ask + 24) - n * 7;
              const hop = w >= 0 && w % 40 < 10 ? Math.sin((Math.PI * (w % 40)) / 10) : 0;
              return (
                <div key={n} style={{ ...plate(n === 3 ? K.butter : K.sky, 22, 0), border: '3px dashed rgba(27, 42, 90, 0.35)', boxSizing: 'border-box', width: 150, height: 80, display: 'grid', placeItems: 'center', scale: `${s * (1 + 0.07 * hop)}`, translate: `0 ${-8 * hop}px` }}>
                  <span style={{ font: `800 44px 'Inter Tight', sans-serif`, color: K.navy }}>{n}/3</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 로고 — 마지막 타격 */}
      {f >= E.logo ? (
        <div style={{ position: 'absolute', left: SAFE.l, width: W, top: lowTop + plateH + 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, ...rise(ease(f, E.logo, 7), 18) }}>
          <div style={{ ...plate(K.white, 18, 5), padding: '8px 16px' }}>
            <Img src={staticFile('img/logo-lab.webp')} style={{ height: 46, width: 'auto', display: 'block' }} />
          </div>
          <span style={{ font: `700 36px 'Inter Tight', ${KO}`, color: K.cream }}>{epLoc.handle}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

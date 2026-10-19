// 1막(00~07, 0~939프레임): (A판) 누르자마자 목록이 빔 → 되감아 이번엔 그대로 → 계정마다 따로인 폴더 → 링크 꼼수 → 저장 거부 → 거절 1,086번 → 세션 21개 → 되살림.
// 판 하나(메인 판)가 사이드바 → 지금 계정 폴더 → 로그 창 → 세션 줄 자리로 끊기지 않고 변한다. 머리글·결과 줄은 카메라 밖.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, IN, IN_OUT, mix, OUT, prog, stagger } from '../lib/motion';
import { Cursor, Odometer } from '../film/parts';
import { FIRST_REFUSAL, FOLDERS, LINK_DATE, LOADED_54, LOG_FIRST, LOG_LAST, LOG_MASKED, RANGE, REFUSALS, ROWS, SESSIONS_ROOT, TRANSCRIPTS, UNSAVED, type LogLine } from './data';
import {
  AVATARS,
  BOX_E_LOG,
  BOX_LOG,
  BOX_ROWS,
  BOX_SIDE,
  BUTTER,
  Cam,
  cardBox,
  chipSwap,
  DIM,
  FolderCard,
  ChainGlyph,
  Headline,
  INK,
  lerpBox,
  LogRow,
  LogTitle,
  PAPER,
  Shell,
  SIDE_ROWS,
  SIDE_ROWS_AFTER,
  SideChip,
  SideHeader,
  SideRows,
  StripOut,
  SubLine,
  Swap,
  TOP,
  UI_INK,
  type Box,
} from './kit';
import { A1, A2, A3, A4, A5, B, B_GREY_END, R, S, wd, Z } from './time';

type V = 'A' | 'E';

// ───────────────── 메인 판 ─────────────────

const mainBox = (f: number, v: V): Box => {
  let b = v === 'E' && f < S.s02 + 12 ? lerpBox(BOX_E_LOG, BOX_SIDE, prog(f, S.s02, 12, OUT)) : BOX_SIDE;
  b = lerpBox(b, cardBox(1), prog(f, S.s03, 14, OUT));
  b = lerpBox(b, BOX_LOG05, prog(f, A5.log, 15, OUT)); // 05: 머리글 바로 밑
  b = lerpBox(b, BOX_LOG, prog(f, B.log - 6, 12, OUT)); // 06: 숫자 자리를 내주며 내려간다
  b = lerpBox(b, BOX_ROWS, prog(f, B.fold, 14, OUT));
  return b;
};

const BOX_LOG05: Box = { ...BOX_LOG, y: 650 };

const hoverAround = (f: number, c: number) => prog(f, c - 11, 6, OUT) * (1 - prog(f, c + 12, 8, OUT));

/** E판 02 사이드바 안쪽: 한도가 차고, 다시 들어온 커서가 칩을 누르자마자 목록이 빈다. */
const Sidebar: React.FC<{ f: number }> = ({ f }) => {
  const drain = (i: number) => prog(f, stagger(A2.drain, i, SIDE_ROWS.length, 21), 9, IN);
  const meterShow = prog(f, S.s02, 8, OUT);
  const meter = prog(f, A2.fill, 16, IN_OUT) * (1 - 0.94 * prog(f, A2.click + 2, 8, OUT));
  const label = f < A2.click + 3 ? '계정 1' : '계정 2';
  const [x0, y0] = bezier([760, 300], [520, 560], [176, 606], prog(f, 114, A2.click - 116, OUT));
  const away = prog(f, A2.click + 9, 18, IN_OUT);
  const opacity = f >= 112 ? prog(f, 112, 6, OUT) * (1 - prog(f, A2.click + 30, 12, IN)) : 0;
  return (
    <>
      <SideHeader meter={meter} meterShow={meterShow} />
      <SideRows rows={SIDE_ROWS} drain={drain} />
      <SideChip label={label} avatar={AVATARS[label]} hover={hoverAround(f, A2.click)} swapBlur={chipSwap(f, A2.click)} />
      {opacity > 0 ? (
        <Cursor x={mix(x0, 520, away)} y={mix(y0, 380, away)} press={pressAt(f, A2.click)} ring={interpolate(f, [A2.click - 2, A2.click + 12], [0, 1], clamp)} opacity={opacity} />
      ) : null}
    </>
  );
};

const blinkAt = (f: number, c: number) => prog(f, c, 3, OUT) * (1 - prog(f, c + 3, 6, IN_OUT));
const pressAt = (f: number, c: number) => prog(f, c - 3, 3, OUT) * (1 - prog(f, c + 1, 4, OUT));

/**
 * A판 00·01 사이드바(10-18 「사라짐 → 그대로」). 판 하나가 끊기지 않고 이어진다.
 * 00 훅(시험판 S22의 01A 그대로): 커서가 계정 칩을 누르자마자 목록이 위에서부터 빠져 텅 빈다.
 * 01 그대로: 6박에 되감겨 빠진 줄이 마지막 줄부터 거꾸로 돌아오고 칩도 계정 1로 돌아간다.
 *    이번엔 5시간 한도 막대가 찬 뒤 칩을 두 번 눌러도 목록이 그대로이고(막대만 새 계정이라 6%), 「그대로」에 맨 윗줄이 버터.
 */
const SidebarA: React.FC<{ f: number }> = ({ f }) => {
  const rows = SIDE_ROWS_AFTER;
  const n = rows.length;
  const drain = (i: number) => prog(f, stagger(A1.drain, i, n, 21), 9, IN) * (1 - prog(f, stagger(Z.rew + 1, n - 1 - i, n, 8), 7, OUT));
  const label = f < A1.click + 3 ? '계정 1' : f < Z.rew + 3 ? '계정 2' : f < Z.click1 + 3 ? '계정 1' : f < Z.click2 + 3 ? '계정 2' : '계정 3';
  const meter = prog(f, Z.fill - 6, 14, IN_OUT) * (1 - 0.94 * prog(f, Z.click1 + 2, 8, OUT));
  // 커서: 00은 칩으로 가서 누르고 비켜나 사라진다. 01은 막대가 찬 뒤 다시 들어와 두 번 누른다(사이에 살짝 들림).
  let cx: number;
  let cy: number;
  let opacity: number;
  if (f < Z.rew) {
    const [x0, y0] = bezier([600, 330], [400, 650], [176, 606], prog(f, 1, 23, OUT));
    const away = prog(f, A1.click + 9, 18, IN_OUT);
    cx = mix(x0, 470, away);
    cy = mix(y0, 420, away);
    opacity = 1 - prog(f, A1.empty - 14, 12, IN);
  } else {
    const [x0, y0] = bezier([760, 300], [520, 560], [176, 606], prog(f, Z.fill - 4, Z.click1 - Z.fill, OUT));
    const lift = prog(f, Z.click1 + 3, 4, IN_OUT) * (1 - prog(f, Z.click2 - 7, 4, IN_OUT));
    const away = prog(f, Z.click2 + 9, 18, IN_OUT);
    cx = mix(mix(x0, 192, lift), 500, away);
    cy = mix(mix(y0, 584, lift), 400, away);
    opacity = prog(f, Z.fill - 4, 6, OUT) * (1 - prog(f, Z.click2 + 30, 12, IN));
  }
  const ring = (c: number) => interpolate(f, [c - 2, c + 12], [0, 1], clamp);
  const rings = f < Z.rew ? ring(A1.click) : f < Z.click2 - 2 ? ring(Z.click1) : ring(Z.click2);
  return (
    <>
      {/* 막대는 되감기 중이 아니라 「5시간」(110)이라는 말에 붙어 나타난다(Fable 5차 L1) */}
      <SideHeader meter={meter} meterShow={prog(f, wd('sum2', 1) - 4, 8, OUT)} fullColor="#2B2A26" />
      <SideRows rows={rows} drain={drain} dim={blinkAt(f, Z.click1 + 2) + blinkAt(f, Z.click2 + 2)} newGlow={prog(f, Z.accent, 6, OUT)} />
      <SideChip
        label={label}
        avatar={AVATARS[label]}
        hover={Math.max(hoverAround(f, A1.click), hoverAround(f, Z.click1), hoverAround(f, Z.click2))}
        swapBlur={chipSwap(f, A1.click) + chipSwap(f, Z.rew) + chipSwap(f, Z.click1) + chipSwap(f, Z.click2)}
      />
      {opacity > 0 ? <Cursor x={cx} y={cy} press={Math.max(pressAt(f, A1.click), pressAt(f, Z.click1), pressAt(f, Z.click2))} ring={rings > 0 && rings < 1 ? rings : 0} opacity={opacity} /> : null}
    </>
  );
};

/** 경로는 구분자(\)에서만 줄을 바꾼다(claude-code-sessions의 하이픈에서 끊기지 않게 마디마다 nowrap). */
const atSep = (s: string) =>
  s.split('\\').map((seg, i, a) => (
    <React.Fragment key={i}>
      <span style={{ whiteSpace: /\s/.test(seg) ? 'normal' : 'nowrap' }}>
        {seg}
        {i < a.length - 1 ? '\\' : ''}
      </span>
      {i < a.length - 1 ? '​' : null}
    </React.Fragment>
  ));

/** 05 로그 창: 목록은 읽혔고(Loaded 54), 13초 뒤 첫 저장이 거부됐다. 긴 줄은 창 폭에서 줄을 바꾼다(글자는 그대로, 경로 앞은 10b처럼 줄임). */
const LogS05: React.FC<{ f: number }> = ({ f }) => {
  const a1 = prog(f, A5.log + 7, 8, OUT); // 창이 자리 잡자마자 첫 줄(빈 창으로 오래 두지 않는다)
  const a2 = prog(f, A5.log + 17, 8, OUT);
  const a3 = prog(f, A5.err + 16, 8, OUT);
  const mark = prog(f, A5.mark, 8, OUT);
  // 창은 오른쪽 화면 밖으로 이어지니 글 폭은 화면 안(86~1046)까지만
  const text: React.CSSProperties = { position: 'absolute', left: 30, width: 960, fontFamily: MONO, fontSize: 28, lineHeight: '40px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'anywhere' };
  return (
    <>
      <LogTitle />
      <div style={{ ...text, top: 86, opacity: a1, filter: a1 < 0.99 ? `blur(${6 * (1 - a1)}px)` : undefined }}>
        <span style={{ color: '#6E6C66' }}>{LOADED_54.time} </span>
        <span style={{ color: '#B6B3AB' }}>{atSep(LOADED_54.text)}</span>
      </div>
      <div style={{ ...text, top: 180, fontFamily: KO, fontSize: 26, color: DIM, opacity: a2 }}>⋯ 13초 뒤</div>
      <div style={{ ...text, top: 228, opacity: a3, filter: a3 < 0.99 ? `blur(${6 * (1 - a3)}px)` : undefined }}>
        <span style={{ color: '#6E6C66' }}>{FIRST_REFUSAL.time} </span>
        <span style={{ color: DIM }}>{FIRST_REFUSAL.text}</span>
        <span
          style={{
            color: INK,
            backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '0 100%',
            backgroundSize: `${mark * 100}% 3px`,
            paddingBottom: 2,
            whiteSpace: 'nowrap', // 강조 낱말은 한 줄에(밑줄이 둘로 끊기지 않게)
          }}
        >
          {FIRST_REFUSAL.mark}
        </span>
        <span style={{ color: '#5E5C57' }}>{atSep(FIRST_REFUSAL.tail)}</span>
      </div>
    </>
  );
};

// 06 거절 줄 흐름(시험판과 같은 짜임). 첫 줄 → 처음 넷 또박또박 → 가운데 1,079줄은 시각·ID를 가린 채 빠르게 → 끝 셋 착지.
const LOG_STREAM: LogLine[] = [...LOG_FIRST, ...Array.from({ length: 40 }, () => LOG_MASKED), ...LOG_LAST];
const LOG_FROM = B.log - 6;
const FAST_END = B.land - 5;
const ease = (f: number) => IN_OUT(Math.min(1, (f - B.log - 8) / (FAST_END - B.log - 8)));
const appended = (f: number) => {
  if (f < LOG_FROM) return 0;
  if (f < B.log) return (f - LOG_FROM) / (B.log - LOG_FROM);
  if (f < B.log + 8) return 1 + (3 * (f - B.log)) / 8;
  if (f < FAST_END) return 4 + 40 * ease(f);
  return 44 + 3 * prog(f, FAST_END, 5, OUT);
};
const refusals = (f: number) => {
  if (f < LOG_FROM) return 0;
  if (f < B.log) return (f - LOG_FROM) / (B.log - LOG_FROM);
  if (f < B.log + 8) return 1 + (3 * (f - B.log)) / 8;
  if (f < FAST_END) return 4 + (REFUSALS - 7) * ease(f);
  return REFUSALS - 3 + 3 * prog(f, FAST_END, 5, OUT);
};

const LogS06: React.FC<{ f: number }> = ({ f }) => {
  const n = appended(f);
  const blur = Math.min(9, (n - appended(f - 1)) * 3.2);
  const fold = prog(f, B.land + 3, 8, OUT);
  const focus = prog(f, B.focus, 8, OUT);
  return (
    <>
      <LogTitle />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 66, bottom: 0, overflow: 'hidden' }}>
        {fold < 1 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - fold, filter: fold > 0.01 ? `blur(${8 * fold}px)` : undefined }}>
            {LOG_STREAM.map((l, i) => {
              const row = 10 - (n - 1 - i);
              if (row < -1.2 || row > 11.2 || i >= Math.ceil(n)) return null;
              return <LogRow key={i} l={l} top={6 + row * 36} opacity={0.35 + 0.65 * Math.min(1, n - i)} blur={blur} />;
            })}
          </div>
        ) : null}
        {fold > 0 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: fold, filter: fold < 0.99 ? `blur(${8 * (1 - fold)}px)` : undefined }}>
            {LOG_FIRST.map((l, r) => (
              <LogRow key={`a${r}`} l={l} top={58 + r * 36} opacity={1 - 0.5 * focus} />
            ))}
            <div style={{ position: 'absolute', left: 30, top: 58 + 4 * 36, fontFamily: MONO, fontSize: 20, lineHeight: '36px', color: DIM, opacity: 1 - 0.5 * focus }}>
              ··· {(REFUSALS - LOG_FIRST.length - LOG_LAST.length).toLocaleString('en-US')}줄 ···
            </div>
            {LOG_LAST.map((l, r) => (
              <LogRow key={`z${r}`} l={l} top={58 + (5 + r) * 36} timeColor={focus > 0 ? `rgba(244,242,236,${0.45 + 0.55 * focus})` : '#6E6C66'} bg={focus} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};

/** 06 둘째 박 ~ 07: 세션 줄 21개 → 한 줄씩 흐려짐 → 대화 원문에서 되살림. */
const Rows21: React.FC<{ f: number }> = ({ f }) => {
  const W = 308;
  const H = 66;
  return (
    <>
      {Array.from({ length: UNSAVED }, (_, k) => {
        const p = prog(f, stagger(B.fold, k, UNSAVED, 6), 9, OUT);
        const q = prog(f, stagger(B.grey, k, UNSAVED, B_GREY_END - B.grey, 0.85), 7, OUT);
        const back = prog(f, stagger(R.back, k, UNSAVED, 14, 0.85), 8, OUT);
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: (k % 3) * (W + 14),
              top: Math.floor(k / 3) * (H + 14),
              width: W,
              height: H,
              borderRadius: 16,
              background: PAPER,
              opacity: p * (1 - 0.82 * q * (1 - back)),
              transform: `translateY(${(1 - p) * 14}px)`,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', left: 20, top: 27, width: 11, height: 11, borderRadius: 6, background: '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 44, top: 16, fontFamily: KO, fontWeight: 560, fontSize: 23, color: '#2B2A26', filter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              {ROWS[(k * 2 + 1) % ROWS.length].title}
            </div>
          </div>
        );
      })}
    </>
  );
};

const MainPanel: React.FC<{ v: V }> = ({ v }) => {
  const f = useCurrentFrame();
  if (v === 'E' && f < S.s02) return null;
  const box = mainBox(f, v);
  const settle = v === 'A' ? prog(f, 0, 31, OUT) : 1;
  const rise = prog(f, A5.log + 1, 9, OUT); // 어두운 로그 창이 아래에서 덮는다
  const eReveal = v === 'E' ? 1 - prog(f, S.s02, 12, OUT) : 0; // E판: 로그 창이 위에서부터 걷히며 밝은 사이드바
  const dark = v === 'E' && f < S.s02 + 12 ? eReveal : rise;
  const darkFade = prog(f, B.fold + 2, 10, IN_OUT);
  const current = prog(f, S.s03 + 10, 8, OUT) * (1 - prog(f, S.s04, 8, OUT));
  // E판: 사이드바 내용은 걷히는 종이와 같은 자리까지만 보인다(빈 흰 판이 번쩍이지 않게)
  const sideClip = v === 'E' && eReveal > 0 ? `inset(0 0 ${eReveal * 100}% 0)` : undefined;
  return (
    <Shell
      box={box}
      paper={rise < 1 ? 1 : 0} // 밝은 판은 어두운 창이 다 덮을 때까지 그대로 둔다(같이 흐리면 회색이 비친다)
      dark={dark}
      darkOpacity={1 - darkFade}
      ry={mix(-12, 0, settle)}
      rx={mix(5, 0, settle)}
      outline={current > 0 ? `inset 0 0 0 3px rgba(245,196,69,${current})` : undefined}
      over={f >= B.fold ? <Rows21 f={f} /> : null}
    >
      {f < S.s03 + 8 ? (
        <Swap outP={prog(f, S.s03, 6, IN)}>
          {v === 'A' ? (
            <SidebarA f={f} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, clipPath: sideClip }}>
              <Sidebar f={f} />
            </div>
          )}
        </Swap>
      ) : null}
      {f >= S.s03 && f < A5.log + 8 ? (
        <Swap inP={prog(f, S.s03 + 4, 8, OUT)} outP={prog(f, A5.log, 6, IN)}>
          <FolderCard id={FOLDERS[1].id} rows={prog(f, A5.rows, 8, OUT)} pointer={prog(f, A4.link1, 8, OUT) * (1 - prog(f, A5.rows, 8, OUT))} target={FOLDERS[0].id} />
          {f >= A4.link1 ? <ChainGlyph left={262} top={26} color={UI_INK} /> : null}
          <Pressed p={pressed(f, A4.link1)} />
        </Swap>
      ) : null}
      {f >= A5.log + 4 && f < S.s06 + 10 ? (
        <Swap inP={prog(f, A5.log + 5, 6, OUT)} outP={prog(f, S.s06 + 4, 6, IN)}>
          <LogS05 f={f} />
        </Swap>
      ) : null}
      {f >= S.s06 + 4 && f < B.fold + 4 ? (
        <Swap inP={prog(f, S.s06 + 4, 8, OUT)} outP={prog(f, B.fold, 4, IN)}>
          <LogS06 f={f} />
        </Swap>
      ) : null}
    </Shell>
  );
};

// ───────────────── 옆 폴더 둘 · 대화 원문 · 링크 선 ─────────────────

/** 04 「전부」: 링크가 될 두 폴더가 계정 칩 hover처럼 살짝 짙어졌다가, 제 선이 그어질 때 풀린다. */
const pressed = (f: number, release: number) => prog(f, A4.all, 6, OUT) * (1 - prog(f, release, 8, IN_OUT));
const Pressed: React.FC<{ p: number }> = ({ p }) => (p > 0 ? <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)', opacity: p }} /> : null);

const SideCards: React.FC = () => {
  const f = useCurrentFrame();
  // 가운데 폴더 밑에서 갈라져 나왔다가, 가운데 판이 움직이기 전에 다시 그 밑으로 모여 사라진다(흐리게 빼면 회색이 비친다)
  if (f < A3.cards || f >= A5.log - 1) return null;
  const spread = prog(f, A3.cards, 12, OUT) * (1 - prog(f, A5.log - 12, 10, IN_OUT));
  const home = prog(f, A4.home, 8, OUT);
  return (
    <AbsoluteFill>
      <Shell box={lerpBox(cardBox(1), cardBox(0), spread)} paper={1} outline={home > 0 ? `inset 0 0 0 ${3 * home}px ${UI_INK}` : undefined}>
        <FolderCard id={FOLDERS[0].id} rows={1} seed={1} />
      </Shell>
      <Shell box={lerpBox(cardBox(1), cardBox(2), spread)} paper={1}>
        <FolderCard id={FOLDERS[2].id} rows={1} seed={3} pointer={prog(f, A4.link2, 8, OUT)} target={FOLDERS[0].id} />
        {f >= A4.link2 ? <ChainGlyph left={262} top={26} color={UI_INK} /> : null}
        <Pressed p={pressed(f, A4.link2)} />
      </Shell>
    </AbsoluteFill>
  );
};

const Transcripts: React.FC = () => {
  const f = useCurrentFrame();
  const inP = prog(f, A3.source, 12, OUT);
  const outP = prog(f, S.s04, 10, IN);
  if (inP <= 0 || outP >= 1) return null;
  return (
    <AbsoluteFill style={{ opacity: inP * (1 - outP), transform: `translateY(${40 * (1 - inP) + 60 * outP}px)` }}>
      <Shell box={{ x: 64, y: 1086, w: 952, h: 170, r: 22 }} dark={1}>
        <div style={{ position: 'absolute', left: 30, top: 24, fontFamily: MONO, fontSize: 24, color: INK }}>{TRANSCRIPTS}</div>
        <div style={{ position: 'absolute', right: 30, top: 22, fontFamily: KO, fontWeight: 600, fontSize: 26, color: DIM }}>대화 원문</div>
        {[0, 1].map((r) => (
          <div key={r} style={{ position: 'absolute', left: 30, top: 80 + r * 36, fontFamily: MONO, fontSize: 20, color: '#77756F', whiteSpace: 'nowrap' }}>
            ········.jsonl&nbsp;&nbsp;&nbsp;&nbsp;········.jsonl&nbsp;&nbsp;&nbsp;&nbsp;········.jsonl&nbsp;&nbsp;&nbsp;&nbsp;········.jsonl
          </div>
        ))}
      </Shell>
    </AbsoluteFill>
  );
};

/** 04 링크 선 두 개(2번·3번 폴더 → 1번 본거지). 05에서 로그 창이 올라오며 사라진다. */
export const LinkArcs: React.FC<{ draw1: number; draw2: number; opacity: number; fall?: [number, number] }> = ({ draw1, draw2, opacity, fall = [0, 0] }) => {
  if (opacity <= 0) return null;
  const arcs = [
    { d: 'M 540 1050 C 540 1130, 218 1130, 218 1060', p: draw1, fall: fall[0], rot: -5 },
    { d: 'M 862 1050 C 862 1196, 218 1196, 218 1060', p: draw2, fall: fall[1], rot: 6 },
  ];
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity, overflow: 'visible' }}>
      {arcs.map((a, i) =>
        a.p > 0 && a.fall < 1 ? (
          <g key={i} style={{ transform: `translateY(${70 * a.fall}px) rotate(${a.rot * a.fall}deg)`, transformOrigin: '540px 1120px', opacity: 1 - a.fall, filter: a.fall > 0.01 ? `blur(${6 * a.fall}px)` : undefined }}>
            <path d={a.d} pathLength={1} fill="none" stroke={BUTTER} strokeWidth={5} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - a.p} />
            {a.p > 0.96 ? <polygon points="218,1050 207,1070 229,1070" fill={BUTTER} /> : null}
          </g>
        ) : null,
      )}
    </svg>
  );
};

const LinksS04: React.FC = () => {
  const f = useCurrentFrame();
  // 폴더가 모이기 직전에 선이 그어진 길을 거꾸로 되감는다
  const back = 1 - prog(f, A5.log - 13, 6, IN);
  return <LinkArcs draw1={prog(f, A4.link1, 10, IN_OUT) * back} draw2={prog(f, A4.link2, 10, IN_OUT) * back} opacity={prog(f, A4.link1 - 1, 2, OUT)} />;
};

// ───────────────── 카메라 ─────────────────

const CamOne: React.FC<{ v: V; children: React.ReactNode }> = ({ v, children }) => {
  const f = useCurrentFrame();
  const push = mix(1, 1.03, prog(f, 0, S.s08, IN_OUT));
  // A판: 00은 칩을 누를 때(시험판 그대로), 01은 두 번 누르는 동안 칩 쪽으로. 01은 머리글이 세 줄이라 기준점을 올려 판이 머리글에 닿지 않게.
  const chip = v === 'A' ? (f < Z.rew ? prog(f, 14, 14, OUT) * (1 - prog(f, A1.click + 10, 16, IN_OUT)) : prog(f, Z.click1 - 14, 12, OUT) * (1 - prog(f, Z.click2 + 12, 16, IN_OUT))) : 0;
  const drop = prog(f, A2.drop - 1, 12, OUT) * (1 - prog(f, A2.drop + 30, 16, IN_OUT));
  const trick = prog(f, A4.trick - 1, 12, OUT) * (1 - prog(f, wd('t1', 3), 14, IN_OUT)); // 「꼼수를」 폴더 셋으로
  const tail = prog(f, B.focus - 1, 14, OUT) * (1 - prog(f, B.fold, 10, IN_OUT));
  const lean = prog(f, R.lean, 12, OUT) * (1 - prog(f, R.done, 10, IN_OUT)); // 「있어서」 흐려진 줄로
  return (
    <Cam s={push} ox={540} oy={980}>
      <Cam s={1 + 0.12 * chip} ox={250} oy={v === 'A' && f >= Z.rew ? 960 : 1220}>
        <Cam s={1 + 0.07 * drop} ox={540} oy={960}>
          <Cam s={(1 + 0.06 * trick) * (1 + 0.06 * tail) * (1 + 0.05 * lean)} ox={540} oy={trick > 0 ? 850 : tail > 0 ? 1120 : 900}>
            {children}
          </Cam>
        </Cam>
      </Cam>
    </Cam>
  );
};

// ───────────────── 머리글(카메라 밖) ─────────────────

const HeadsOne: React.FC<{ v: V }> = ({ v }) => {
  const f = useCurrentFrame();
  const n = refusals(f);
  return (
    <>
      {/* A판 00 훅(시험판 S22 그대로): 0프레임부터 두 줄이 다 보이고, 목록이 빠질 때 「다 사라졌어요」가 버터. 되감기 직전에 빠진다. */}
      {v === 'A' && f < Z.rew + 8 ? (
        <Headline
          lines={[
            [{ t: 'Claude', at: -30 }, { t: '계정', at: -30 }, { t: '바꿨더니,', at: -30 }],
            [{ t: '세션이', at: -30 }, { t: '다', at: -30, accent: A1.accent }, { t: '사라졌어요', at: -30, accent: A1.accent }],
          ]}
          out={Z.rew - 4}
        />
      ) : null}
      {/* A판 01 그대로: 낱말이 말과 같은 프레임에 들어오고, 칩을 두 번 눌러도 목록이 그대로일 때 「그대로」가 버터 */}
      {v === 'A' && f >= Z.rew && f < S.s03 + 8 ? (
        <Headline
          lines={[
            [{ t: '지금은', at: wd('sum2', 0) }, { t: '5시간', at: wd('sum2', 1) }, { t: '한도', at: wd('sum2', 3) }, { t: '차서', at: wd('sum2', 4) }],
            [{ t: '계정을', at: wd('sum2', 5) }, { t: '바꿔도,', at: wd('sum2', 6) }],
            [{ t: '세션이', at: wd('sum2', 7) }, { t: '그대로', at: wd('sum2', 8), accent: Z.accent }, { t: '이어져요', at: wd('sum2', 9) }],
          ]}
          out={S.s03 - 4}
          top={TOP - 56} // 세 줄이라 사이드바와 닿지 않게 조금 위로
        />
      ) : null}
      {v === 'E' && f >= S.s02 - 4 && f < A2.drain + 4 ? (
        <Headline
          lines={[
            [{ t: '5시간', at: v === 'E' ? S.s02 + 2 : wd('s1', 0) }, { t: '한도가', at: wd('s1', 2) }, { t: '차면,', at: wd('s1', 3) }],
            [{ t: '계정을', at: wd('s1', 4) }, { t: '바꿔', at: wd('s1', 5) }, { t: '쓰는데,', at: wd('s1', 6) }],
          ]}
          out={A2.drain - 9}
        />
      ) : null}
      {v === 'E' && f >= A2.drain - 4 && f < S.s03 + 8 ? (
        <Headline
          lines={[
            [{ t: '바꾸자마자', at: wd('s1', 7) }, { t: '세션', at: wd('s1', 8) }, { t: '목록이', at: wd('s1', 9) }],
            [{ t: '비어', at: wd('s1', 10) }, { t: '보이더라고요', at: wd('s1', 11) }],
          ]}
          out={S.s03 - 4}
        />
      ) : null}
      {f >= S.s03 - 4 && f < wd('c1', 4) ? (
        <Headline lines={[[{ t: '대화가', at: wd('c1', 0) }, { t: '지워진', at: wd('c1', 1) }, { t: '건', at: wd('c1', 2) }], [{ t: '아니었어요', at: wd('c1', 3) }]]} out={wd('c1', 4) - 8} />
      ) : null}
      {f >= wd('c1', 4) - 8 && f < S.s04 + 8 ? (
        <Headline
          lines={[
            [{ t: '앱이', at: wd('c1', 4) }, { t: '목록을', at: wd('c1', 5) }, { t: '계정마다', at: wd('c1', 6) }],
            [{ t: '따로', at: wd('c1', 7) }, { t: '들고', at: wd('c1', 8) }, { t: '있었던', at: wd('c1', 9) }, { t: '거죠', at: wd('c1', 10) }],
          ]}
          out={S.s04 - 4}
        />
      ) : null}
      {f >= S.s04 - 4 && f < wd('t1', 3) ? <Headline lines={[[{ t: '그래서', at: wd('t1', 0) }, { t: '꼼수를', at: wd('t1', 1) }, { t: '썼죠', at: wd('t1', 2) }]]} out={wd('t1', 3) - 8} /> : null}
      {f >= wd('t1', 3) - 8 && f < wd('t1', 9) ? (
        <Headline
          lines={[
            [{ t: '계정', at: wd('t1', 3) }, { t: '폴더가', at: wd('t1', 4) }, { t: '전부', at: wd('t1', 5) }],
            [{ t: '한', at: wd('t1', 6) }, { t: '폴더를', at: wd('t1', 7) }, { t: '가리키게,', at: wd('t1', 8) }],
          ]}
          out={wd('t1', 9) - 8}
        />
      ) : null}
      {f >= wd('t1', 9) - 8 && f < S.s05 + 8 ? (
        <Headline lines={[[{ t: '링크를', at: wd('t1', 9) }, { t: '걸었어요', at: wd('t1', 10) }]]} out={S.s05 - 4} />
      ) : null}
      {f >= S.s05 - 4 && f < wd('t2', 2) ? <Headline lines={[[{ t: '목록은', at: wd('t2', 0) }, { t: '보였는데,', at: wd('t2', 1) }]]} out={wd('t2', 2) - 8} /> : null}
      {f >= wd('t2', 2) - 8 && f < S.s06 + 8 ? (
        <Headline
          lines={[
            [{ t: '앱이', at: wd('t2', 2) }, { t: '링크를', at: wd('t2', 3) }, { t: '알아채고', at: wd('t2', 4) }],
            [{ t: '저장을', at: wd('t2', 5) }, { t: '거부했어요', at: wd('t2', 6) }],
          ]}
          out={S.s06 - 4}
        />
      ) : null}
      {f >= S.s03 && f < A5.log + 10 ? (
        <div style={{ position: 'absolute', left: 72, top: 600, fontFamily: MONO, fontSize: 26, color: DIM, opacity: prog(f, A3.cards, 8, OUT) * (1 - prog(f, A5.log - 8, 8, IN)) }}>{SESSIONS_ROOT}</div>
      ) : null}
      {f >= A4.link2 && f < A5.log + 10 ? (
        <div style={{ position: 'absolute', left: 72, top: 1214, fontFamily: MONO, fontSize: 24, color: DIM, opacity: prog(f, A4.link2 + 4, 8, OUT) * (1 - prog(f, A5.log - 8, 8, IN)) }}>{LINK_DATE}</div>
      ) : null}

      {/* 06 첫 박: 같은 거절 1,086번(A판) · 시각 띠(E판) */}
      {f >= S.s06 - 4 && f < B.fold + 12 ? (
        <>
          <Headline lines={[[{ t: '로그엔', at: wd('t3', 0) }, { t: '같은', at: wd('t3', 1) }, { t: '거절이', at: wd('t3', 2) }]]} out={B.fold - 4} />
          {v === 'A' ? (
            <>
              <div style={{ position: 'absolute', left: 62, top: TOP + 106, display: 'flex', alignItems: 'flex-end' }}>
                <WordBox at={B.log - 3} out={B.fold - 3}>
                  <Odometer value={n} prev={refusals(f - 1)} digits={4} size={280} color={BUTTER} dim="#1A1917" comma />
                </WordBox>
                <WordBox at={B.log} out={B.fold - 2} style={{ fontFamily: KO, fontWeight: 720, fontSize: 112, color: INK, marginLeft: 14, paddingBottom: 30 }}>
                  번
                </WordBox>
              </div>
              <SubLine at={B.range} out={B.fold - 6} top={TOP + 390} style={{ fontFamily: MONO, fontSize: 34, color: '#B9B6AE' }}>
                {RANGE}
              </SubLine>
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', left: 66, top: TOP + 118, fontFamily: EN, fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: BUTTER, letterSpacing: '-0.02em' }}>
                <div>
                  <WordBox at={B.log - 3} out={B.fold - 3}>
                    10:37:47 ~
                  </WordBox>
                </div>
                <div>
                  <WordBox at={B.log + 3} out={B.fold - 2}>
                    12:41:23
                  </WordBox>
                </div>
              </div>
              <SubLine at={B.range} out={B.fold - 6} top={TOP + 440} style={{ fontFamily: KO, fontWeight: 600, fontSize: 34, color: '#B9B6AE' }}>
                두 시간 · 저장할 때마다 한 번 · {Math.round(n).toLocaleString('en-US')}번
              </SubLine>
            </>
          )}
        </>
      ) : null}

      {/* 06 둘째 박 · 07 */}
      {f >= B.fold && f < S.s08 ? (
        <Headline
          lines={[
            [{ t: '두', at: wd('t3', 9) }, { t: '시간,', at: wd('t3', 10) }, { t: '세션', at: wd('t3', 11) }, { t: `${UNSAVED}개가`, at: wd('t3', 12) }],
            [{ t: '저장이', at: wd('t3', 14) }, { t: '안', at: wd('t3', 15) }, { t: '됐어요', at: wd('t3', 16) }],
          ]}
          out={S.s07 - 4}
        />
      ) : null}
      {f >= B.stamp - 2 && f < R.source + 10 ? (
        <SubLine at={B.stamp} out={S.s07 + 3} top={1222} style={{ fontFamily: KO, fontWeight: 740, fontSize: 56, letterSpacing: '-0.03em', color: BUTTER }}>
          저장 안 됨 · {UNSAVED}개
        </SubLine>
      ) : null}
      {f >= S.s07 - 4 && f < wd('r1', 5) ? (
        <Headline
          lines={[
            [{ t: '다행히', at: wd('r1', 0) }, { t: '대화', at: wd('r1', 1) }, { t: '원문이', at: wd('r1', 2) }],
            [{ t: '남아', at: wd('r1', 3) }, { t: '있어서,', at: wd('r1', 4) }],
          ]}
          out={wd('r1', 5) - 8}
        />
      ) : null}
      {f >= wd('r1', 5) - 8 ? <Headline lines={[[{ t: '기록을', at: wd('r1', 5) }, { t: '되살렸어요', at: wd('r1', 6) }]]} /> : null}
      {f >= R.source - 2 && f < R.done + 10 ? (
        <SubLine at={R.source} out={R.done - 8} top={1232} style={{ fontFamily: MONO, fontSize: 30, color: '#B9B6AE' }}>
          {TRANSCRIPTS} · 대화 원문 그대로
        </SubLine>
      ) : null}
      {f >= R.done - 2 ? (
        <SubLine at={R.done} top={1222} style={{ fontFamily: KO, fontWeight: 740, fontSize: 56, letterSpacing: '-0.03em', color: BUTTER }}>
          되살림 · {UNSAVED}개
        </SubLine>
      ) : null}
    </>
  );
};

/** 마스크 낱말과 같은 등장(글자 대신 숫자 바퀴·큰 시각 같은 덩어리를 넣을 때). */
const WordBox: React.FC<{ at: number; out?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, out, children, style }) => {
  const f = useCurrentFrame();
  const pin = prog(f, at, 11, OUT);
  const pout = out === undefined ? 0 : prog(f, out, 6, IN);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '0.06em 0.02em 0.1em', margin: '-0.06em -0.02em -0.1em' }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - pin) * 112 - pout * 112}%)`, ...style }}>{children}</span>
    </span>
  );
};

export const ActOne: React.FC<{ v: V }> = ({ v }) => (
  <StripOut at={S.s08}>
    <CamOne v={v}>
      <Transcripts />
      <SideCards />
      <LinksS04 />
      <MainPanel v={v} />
    </CamOne>
    <HeadsOne v={v} />
  </StripOut>
);

// ───────────────── E판 훅(0~119, E판 프레임) ─────────────────

const E_STREAM: LogLine[] = [...LOG_FIRST, ...Array.from({ length: 40 }, () => LOG_MASKED), ...LOG_LAST];
export const EHook: React.FC<{ until: number; wdE: (i: number) => number }> = ({ until, wdE }) => {
  const f = useCurrentFrame();
  if (f >= until + 2) return null;
  const n = f < 72 ? 11 + 36 * IN_OUT(Math.min(1, f / 72)) : 47;
  const blur = Math.min(9, (n - (f - 1 < 72 ? 11 + 36 * IN_OUT(Math.max(0, Math.min(1, (f - 1) / 72))) : 47)) * 3.2);
  const rows = 14;
  const out = until - 4;
  // 넘겨주기 전에 줄을 먼저 비운다(빈 창이 밝은 사이드바로 걷히는 한 동작으로 이어지게)
  const clear = prog(f, until - 11, 8, IN);
  return (
    <>
      <Shell box={BOX_E_LOG} dark={1}>
        <LogTitle />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 66, bottom: 0, overflow: 'hidden', opacity: 1 - clear, filter: clear > 0.01 ? `blur(${8 * clear}px)` : undefined }}>
          {E_STREAM.map((l, i) => {
            const row = rows - 1 - (n - 1 - i);
            if (row < -1.2 || row > rows + 0.2 || i >= Math.ceil(n)) return null;
            return <LogRow key={i} l={l} top={6 + row * 36} opacity={0.4 + 0.6 * Math.min(1, n - i)} blur={blur} />;
          })}
        </div>
      </Shell>
      <Headline
        lines={[
          [{ t: 'Claude', at: -30 }, { t: '앱한테', at: -30 }],
          [{ t: '1,086번', at: -30, accent: 74 }, { t: '거절당했어요', at: -30 }],
        ]}
        out={out}
      />
      <SubLine at={wdE(5)} out={out + 2} top={TOP + 214} style={{ fontFamily: KO, fontWeight: 640, fontSize: 52, letterSpacing: '-0.03em', color: '#B9B6AE' }}>
        제 꼼수 때문에요
      </SubLine>
    </>
  );
};

export { refusals };

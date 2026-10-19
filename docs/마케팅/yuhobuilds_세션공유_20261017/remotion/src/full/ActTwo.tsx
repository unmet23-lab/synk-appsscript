// 2막(08~10b, 939~1335프레임): 링크를 걷고 진짜 폴더 25곳 → 한 곳이 바뀌면 1~2초에 전부 → 어느 계정이든 같은 목록 → 계정 넷 모두 76.
// 1막에서 위로 넘겨 들어오고(한 장으로 이어진 넘김), 3막으로 다시 위로 넘긴다. 08 → 09는 지금 계정 줄로 붙었다가 박에 하드 컷.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { KO, MONO } from '../lib/fonts';
import { bezier, clamp, IN, IN_OUT, mix, OUT, prog } from '../lib/motion';
import { Cursor } from '../film/parts';
import { LinkArcs } from './ActOne';
import { FOLDERS, HERE, LINK_DATE, LOADED_76, PLACES, RECORD, SESSIONS_ROOT, STATUS_HEAD, STATUS_ROWS, STATUS_TAIL } from './data';
import {
  AVATARS,
  BOX_SIDE,
  BOX_STATUS,
  BUTTER,
  Cam,
  cardBox,
  ChainGlyph,
  chipSwap,
  DIM,
  dist,
  FolderCard,
  Headline,
  HX,
  HY,
  INK,
  LEFT,
  lerpBox,
  LogTitle,
  Shell,
  SIDE_ROWS_AFTER,
  SideChip,
  SideHeader,
  SideRows,
  StripIn,
  StripOut,
  SubLine,
  Swap,
  TH,
  Tile,
  TOP,
  TS,
  TW,
  UI_INK,
  VIEWPORT,
  type Box,
} from './kit';
import { C, C_RIPPLE_END, D, M, S, wd } from './time';

// ───────────────── 08 ─────────────────

const UNION: Box = { x: 64, y: 650, w: 952, h: 400, r: 22 };
const MERGE_LEN = 8;

/** 08 첫 박: 04의 폴더 셋과 링크 선 → 「다 걷어내고」 선이 끊겨 떨어지고 목록이 돌아온다. */
const Folders08: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= M.merge + MERGE_LEN) return null; // 상태 창이 위에서 다 덮은 뒤 내린다(흐리게 빼면 회색이 비친다)
  const free1 = prog(f, M.snap + 6, 10, OUT);
  const free2 = prog(f, M.snap + 12, 10, OUT);
  return (
    <AbsoluteFill>
      <Shell box={cardBox(0)} paper={1} outline={`inset 0 0 0 3px ${UI_INK}`}>
        <FolderCard id={FOLDERS[0].id} rows={1} seed={1} />
      </Shell>
      <Shell box={cardBox(1)} paper={1}>
        <FolderCard id={FOLDERS[1].id} rows={free1} pointer={1 - free1} target={FOLDERS[0].id} />
        {free1 < 1 ? <div style={{ opacity: 1 - free1 }}><ChainGlyph left={262} top={26} /></div> : null}
      </Shell>
      <Shell box={cardBox(2)} paper={1}>
        <FolderCard id={FOLDERS[2].id} rows={free2} seed={3} pointer={1 - free2} target={FOLDERS[0].id} />
        {free2 < 1 ? <div style={{ opacity: 1 - free2 }}><ChainGlyph left={262} top={26} /></div> : null}
      </Shell>
      <LinkArcs draw1={1} draw2={1} opacity={1} fall={[prog(f, M.snap, 12, IN), prog(f, M.snap + 6, 12, IN)]} />
    </AbsoluteFill>
  );
};

/** 08 둘째 박: 공개판 --status의 짝 폴더 25곳. 드럼이 빠지는 박에 폴더 셋이 상태 창으로 모이고, 다시 터지는 박에 파일 수 칸이 한꺼번에 켜진다. */
const Status08: React.FC = () => {
  const f = useCurrentFrame();
  if (f < M.merge || f >= S.s09) return null; // 09로 하드 컷
  const grow = prog(f, M.merge, 12, OUT);
  // 드럼이 빠지는 박에 어두운 창이 위에서 셔터처럼 내려와 폴더 셋을 덮는다
  return (
    <Shell box={lerpBox(UNION, BOX_STATUS, grow)} dark={prog(f, M.merge, MERGE_LEN, OUT)} darkFrom="top">
      <div style={{ position: 'absolute', left: 30, top: 22, fontFamily: MONO, fontSize: 22, color: INK, opacity: prog(f, M.merge + 6, 8, OUT), whiteSpace: 'nowrap' }}>{STATUS_HEAD}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 62, height: 1, background: '#2A2926' }} />
      {/* ★ 줄(지금 계정)에 붙을 때 그 줄이 밝아져, 박에 이어지는 09의 흰 칸과 한 줄로 잇는다 */}
      <div style={{ position: 'absolute', left: 16, right: 16, top: 76 + STATUS_ROWS.findIndex((r) => r.here) * 24.5 - 2, height: 28, borderRadius: 7, background: 'rgba(244,242,236,0.12)', opacity: prog(f, M.punch, 6, OUT) }} />
      {STATUS_ROWS.map((r, i) => {
        const at = M.rows + Math.floor(i / 5) * 6 + (i % 5);
        const a = prog(f, at, 6, OUT);
        if (a <= 0) return null;
        const lit = prog(f, M.same + Math.round(i * 0.25), 6, OUT);
        return (
          <div key={i} style={{ position: 'absolute', left: 30, top: 76 + i * 24.5, fontFamily: MONO, fontSize: 20, lineHeight: '24px', whiteSpace: 'nowrap', opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}>
            <span style={{ color: r.here ? INK : '#77756F' }}>{r.here ? '★ ' : '  '}</span>
            <span style={{ color: r.here ? INK : '#B6B3AB' }}>{r.id}</span>
            <span style={{ color: DIM }}>  {STATUS_TAIL.sessions}, </span>
            <span style={{ color: lit > 0 ? `rgba(245,196,69,${0.35 + 0.65 * lit})` : INK }}>{STATUS_TAIL.files}</span>
          </div>
        );
      })}
    </Shell>
  );
};

// ───────────────── 09 · 10a 칸 격자 ─────────────────

const arrive = (j: number) => (j === HERE ? C.add : C.ripple + 4 + Math.round(dist(j) * 8));
const tileScale = (f: number) =>
  f < D.zoom
    ? mix(5.6, 1, prog(f, C.back, 16, IN_OUT)) * mix(1, 1.03, prog(f, C.back + 16, D.zoom - C.back - 16, IN_OUT))
    : mix(1.03, 5.6, prog(f, D.zoom, 15, IN_OUT));

/** 5.6배로 붙은 지금 계정 칸이 화면에서 차지하는 자리(D.swap에 사이드바가 바로 이 자리에서 자란다). */
const TILE_RECT: Box = { x: HX - 6 - (TW / 2 - 6) * 5.6, y: HY - (TH / 2) * 5.6, w: TW * 5.6, h: TH * 5.6, r: 7 * TS * 5.6 };

const Grid: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.s09 || f >= D.swap + 8) return null;
  const s = tileScale(f);
  // 사이드바 종이가 칸을 다 덮은 뒤에 내린다(흐리게 빼면 회색이 비친다)
  return (
    <AbsoluteFill style={{ WebkitMaskImage: VIEWPORT, maskImage: VIEWPORT, opacity: 1 - prog(f, D.swap + 4, 4, IN) }}>
      <Cam s={s} ox={HX - 6} oy={HY}>
        {PLACES.map((_, j) => (
          <Tile key={j} j={j} f={f} arrive={arrive(j)} />
        ))}
      </Cam>
    </AbsoluteFill>
  );
};

const Record09: React.FC = () => {
  const f = useCurrentFrame();
  if (f < C.ripple || f >= S.s10a + 4) return null;
  const typed = Math.floor(interpolate(f, [C.ripple + 4, C_RIPPLE_END + 6], [0, RECORD.length], clamp));
  const caret = typed < RECORD.length;
  const out = prog(f, S.s10a - 4, 6, IN);
  return (
    <div style={{ position: 'absolute', left: LEFT, top: TOP + 228, fontFamily: MONO, fontSize: 30, whiteSpace: 'nowrap', opacity: 1 - out, transform: `translateY(${-16 * out}px)` }}>
      <span style={{ color: DIM }}>{RECORD.slice(0, Math.min(typed, 21))}</span>
      <span style={{ color: INK }}>{typed > 21 ? RECORD.slice(21, typed) : ''}</span>
      {caret ? <span style={{ display: 'inline-block', width: 16, height: 34, marginLeft: 3, background: INK, verticalAlign: '-6px' }} /> : null}
    </div>
  );
};

// ───────────────── 10a · 10b 사이드바 → 로그 창 ─────────────────

const blink = (f: number, c: number) => prog(f, c, 3, OUT) * (1 - prog(f, c + 3, 6, IN_OUT));
const hoverAround = (f: number, c: number) => prog(f, c - 11, 6, OUT) * (1 - prog(f, c + 12, 8, OUT));

const BOX_LOG10: Box = { x: 56, y: 650, w: 1110, h: 380, r: 26 }; // 10b: 머리글 바로 밑, 줄 넷과 맺음 줄만큼

const Side10: React.FC = () => {
  const f = useCurrentFrame();
  if (f < D.swap) return null;
  const label = f < D.click1 + 3 ? '계정 3' : f < D.click2 + 3 ? '계정 1' : '계정 2';
  const go = prog(f, D.swap + 2, D.click1 - D.swap - 4, OUT);
  const [x0, y0] = bezier([620, 340], [420, 640], [176, 606], go);
  const bob = prog(f, D.click1 + 6, 10, IN_OUT) * (1 - prog(f, D.click2 - 12, 10, IN_OUT));
  const cx = mix(x0, 236, bob);
  const cy = mix(y0, 560, bob);
  const press = Math.max(prog(f, D.click1 - 3, 3, OUT) * (1 - prog(f, D.click1 + 1, 4, OUT)), prog(f, D.click2 - 3, 3, OUT) * (1 - prog(f, D.click2 + 1, 4, OUT)));
  const ring = Math.max(f < D.click2 - 4 ? interpolate(f, [D.click1 - 2, D.click1 + 12], [0, 1], clamp) : 0, interpolate(f, [D.click2 - 2, D.click2 + 12], [0, 1], clamp));
  const cursorO = prog(f, D.swap, 6, OUT) * (1 - prog(f, D.dark - 6, 6, IN));
  const dark = prog(f, D.dark + 1, 9, OUT);
  // 칸과 같은 자리·같은 종이에서 사이드바로 자란다(빈 흰 판·모양 점프 없이)
  const grow = prog(f, D.swap, 8, OUT);
  const box = lerpBox(lerpBox(TILE_RECT, BOX_SIDE, grow), BOX_LOG10, prog(f, D.dark, 15, OUT));
  return (
    <Shell box={box} paper={dark < 1 ? 1 : 0} dark={dark}>
      <Swap inP={prog(f, D.swap - 1, 6, OUT)} outP={prog(f, D.dark, 6, IN)}>
        <SideHeader />
        <SideRows rows={SIDE_ROWS_AFTER} dim={blink(f, D.click1 + 2) + blink(f, D.click2 + 2)} />
        <SideChip label={label} avatar={AVATARS[label]} hover={Math.max(hoverAround(f, D.click1), hoverAround(f, D.click2))} swapBlur={chipSwap(f, D.click1) + chipSwap(f, D.click2)} />
        {cursorO > 0 ? <Cursor x={cx} y={cy} press={press} ring={ring > 0 && ring < 1 ? ring : 0} opacity={cursorO} /> : null}
      </Swap>
      {f >= D.dark + 3 ? (
        <Swap inP={prog(f, D.dark + 4, 6, OUT)}>
          <LogTitle />
          {LOADED_76.map((l, i) => {
            const a = prog(f, D.lines[i], 6, OUT);
            return (
              <div key={i} style={{ position: 'absolute', left: 30, top: 86 + i * 46, fontFamily: MONO, fontSize: 22, lineHeight: '36px', whiteSpace: 'nowrap', opacity: a, filter: a < 0.99 ? `blur(${6 * (1 - a)}px)` : undefined }}>
                <span style={{ color: '#6E6C66' }}>{l.time} </span>
                <span style={{ color: '#B6B3AB' }}>[info] Loaded </span>
                <span style={{ color: BUTTER }}>76</span>
                <span style={{ color: '#B6B3AB' }}> persisted sessions from …\{l.path} …</span>
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: 30, top: 86 + 4 * 46 + 10, fontFamily: KO, fontWeight: 600, fontSize: 27, color: DIM, opacity: prog(f, D.lines[3] + 2, 8, OUT) }}>다른 계정 넷 · 모두 세션 76개</div>
        </Swap>
      ) : null}
    </Shell>
  );
};

// ───────────────── 카메라·머리글 ─────────────────

const CamTwo: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const on = f < S.s09;
  const push = on ? mix(1, 1.02, prog(f, S.s08, S.s09 - S.s08, IN_OUT)) : 1;
  const punch = on ? prog(f, M.punch, 8, IN) : 0;
  // ★ 줄(상태 창 넷째 줄)로 붙은 뒤 박에 09 칸으로 하드 컷
  return (
    <Cam s={push} ox={540} oy={960}>
      <Cam s={1 + 0.12 * punch} ox={300} oy={761}>
        {children}
      </Cam>
    </Cam>
  );
};

const HeadsTwo: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {f < M.merge + 4 ? (
        <Headline
          lines={[
            [{ t: '결국', at: wd('m1', 0) }, { t: '링크는', at: wd('m1', 1) }],
            [{ t: '다', at: wd('m1', 2) }, { t: '걷어내고,', at: wd('m1', 3) }],
          ]}
          out={M.merge - 6}
        />
      ) : null}
      {f >= M.merge - 6 && f < S.s09 ? (
        <Headline
          lines={[
            [{ t: '계정마다', at: wd('m1', 4) }, { t: '있는', at: wd('m1', 5) }, { t: '폴더를', at: wd('m1', 6) }],
            [{ t: '전부', at: wd('m1', 7) }, { t: '진짜', at: wd('m1', 8) }, { t: '폴더로', at: wd('m1', 9) }, { t: '뒀어요', at: wd('m1', 10) }],
          ]}
          out={S.s09 - 6}
        />
      ) : null}
      {/* 짝 폴더 수는 말로 하지 않으니(원고), 화면에서 읽히는 한 줄로 둔다 */}
      {f >= M.same - 2 && f < S.s09 ? (
        <SubLine at={M.same} out={S.s09 - 6} top={TOP + 228} style={{ fontFamily: MONO, fontSize: 34, color: '#B9B6AE' }}>
          25곳 모두 · {STATUS_TAIL.sessions} · {STATUS_TAIL.files}
        </SubLine>
      ) : null}
      {f < M.merge + 8 ? (
        <>
          <div style={{ position: 'absolute', left: 72, top: 600, fontFamily: MONO, fontSize: 26, color: DIM, opacity: 1 - prog(f, M.merge - 4, 8, IN) }}>{SESSIONS_ROOT}</div>
          <div style={{ position: 'absolute', left: 72, top: 1214, fontFamily: MONO, fontSize: 24, color: DIM, opacity: 1 - prog(f, M.snap, 10, IN) }}>{LINK_DATE}</div>
        </>
      ) : null}
      {f >= S.s09 && f < S.s10a + 8 ? (
        <Headline
          lines={[
            [{ t: '한', at: S.s09 }, { t: '곳이', at: wd('m2', 2) }, { t: '바뀌면,', at: wd('m2', 3) }],
            [{ t: '1~2초', at: wd('m2', 4) }, { t: '안에', at: wd('m2', 6) }, { t: '전부', at: wd('m2', 8) }, { t: '똑같이', at: wd('m2', 9) }],
          ]}
          out={S.s10a - 4}
        />
      ) : null}
      <Record09 />
      {f >= S.s10a ? (
        <Headline
          lines={[
            [{ t: '어느', at: wd('e1', 1) }, { t: '계정으로', at: wd('e1', 2) }, { t: '들어가도,', at: wd('e1', 3) }],
            [{ t: '같은', at: wd('e1', 4) }, { t: '목록이', at: wd('e1', 5) }, { t: '떠요', at: wd('e1', 6) }],
          ]}
        />
      ) : null}
    </>
  );
};

export const ActTwo: React.FC = () => (
  <StripIn at={S.s08}>
    <StripOut at={S.s11}>
      <CamTwo>
        <Folders08 />
        <Status08 />
      </CamTwo>
      <Grid />
      <Side10 />
      <HeadsTwo />
    </StripOut>
  </StripIn>
);

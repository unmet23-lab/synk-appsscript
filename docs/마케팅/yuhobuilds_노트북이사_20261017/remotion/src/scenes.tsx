// 장면 열 개. 내용·숫자는 기획.md 사실 대조 표와 실제 기록(받기 로그·인계·도구 결과) 그대로다.
// 시각은 모두 낱말 시각(clock().T)에 붙는다. 장면마다 첫 요소 하나(판·사진·틀)는 0프레임부터 있어 전환에 실려 함께 착지하고,
// 라벨·제목·자막은 착지(land) 뒤에 나온다(10-17 Fable 검수 「빈 착지」). 숫자는 처음부터 실제 값이고 불투명도·크기만 움직인다.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT, lerp, punch, ramp, settle } from './lib/anim';
import { Captions, Chip, Circle, Head, Label, Lines, Mark, Paper, Screen, Stamp } from './lib/cine';
import { clock, fr, LOG, RES, SCENE_SEGS, SceneId, seqStart, VO } from './t';
import { C, F, L } from './theme';

type Hook = 'A' | 'C';

/** 장면의 말자막(skip은 화면 글자가 곧 그 말이라 자막을 겹치지 않는 대사). 착지 전에는 띄우지 않는다. */
const SceneCaps: React.FC<{ s: SceneId; skip?: string[]; hook?: Hook }> = ({ s, skip = [], hook = 'A' }) => {
  const k = clock(s, hook);
  const all = Object.keys(VO.segs);
  const mine = SCENE_SEGS[s].filter((id) => !skip.includes(id));
  const t0 = seqStart(s);
  const segs = mine.map((id) => {
    const g = k.seg(id);
    return { cap: g.cap, tokens: g.tokens.map((t) => fr(t) - t0), end: fr(g.end) - t0 };
  });
  const nextStart = mine.map((id) => {
    const i = all.indexOf(id);
    return i < all.length - 1 ? fr(VO.segs[all[i + 1]].start) - t0 : 1e9;
  });
  return <Captions segs={segs} nextStart={nextStart} leave={k.len - 13} from={k.land} />;
};

/** 큰 숫자 하나: 실제 값 그대로, 나타날 때 불투명도·크기만 */
const BigNum: React.FC<{ n: string; unit: string; size: number; unitSize: number; at: number; style?: React.CSSProperties }> = ({ n, unit, size, unitSize, at, style }) => {
  const f = useCurrentFrame();
  const p = settle(f, at, 15);
  return (
    <div style={{ position: 'absolute', display: 'flex', alignItems: 'baseline', gap: 10, color: C.onField, opacity: Math.min(1, p * 1.6), scale: String(lerp(1.12, 1, p)), transformOrigin: '0% 70%', ...style }}>
      <span style={{ font: `800 ${size}px/0.9 ${F.en}`, letterSpacing: '-.055em' }}>{n}</span>
      <span style={{ font: `800 ${unitSize}px/1 ${F.ko}`, letterSpacing: '-.04em' }}>{unit}</span>
    </div>
  );
};

const AiTag: React.FC = () => (
  <span style={{ position: 'absolute', right: 22, bottom: 22, padding: '8px 14px', borderRadius: 10, background: 'rgba(10,10,10,.78)', color: '#fff', font: `650 30px/1.2 ${F.ko}`, letterSpacing: '-.01em' }}>AI 이미지</span>
);

/* ── 1 훅 ─────────────────────────────────────────────────────────────── */
export const S1: React.FC<{ hook: Hook }> = ({ hook }) => {
  const f = useCurrentFrame();
  const k = clock('s1', hook);
  const push = 1 + 0.03 * interpolate(f, [0, k.len], [0, 1], clamp);
  if (hook === 'C') {
    const mk = ramp(f, k.T('h1', 6) - 2, 10);
    const tilt = settle(f, 0, 9);
    return (
      <div style={{ position: 'absolute', inset: 0, scale: String(push), transformOrigin: '50% 45%' }}>
        <Head left="yuhobuilds" right="노트북 이사 · 10.15–10.17" />
        <Lines visibleAtZero at={0} size={84} top={L.TOP} lines={['외장 SSD 없이', '노트북 이사,', <>AI한테 <Mark p={mk}>통째로</Mark></>, '맡겨 봤어요']} />
        <div style={{ position: 'absolute', left: 150, top: 900, width: 720, height: 300, padding: 14, background: '#fff', borderRadius: 8, boxShadow: '0 40px 70px -30px rgba(0,0,0,.9)', rotate: `${lerp(-5, -2, tilt)}deg`, scale: String(punch(f, k.T('h1', 8), 1.03)) }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 3 }}>
            <Img src={staticFile('media/laptops.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 47%' }} />
            <AiTag />
          </div>
        </div>
      </div>
    );
  }
  const mk = ramp(f, 9, 10);
  const tilt = settle(f, 0, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, scale: String(push), transformOrigin: '50% 45%' }}>
      <Head left="yuhobuilds" right="노트북 이사 · 10.15–10.17" />
      <Lines visibleAtZero at={0} size={88} top={L.TOP} lines={['노트북 이사를 AI한테', '맡겼더니,', <><Mark p={mk}>107GB</Mark>를 두고 왔어요</>]} />
      <div style={{ position: 'absolute', inset: 0, perspective: 1400 }}>
        <Screen
          bar={['받기_log.txt · 새 노트북', '10.17']}
          style={{ left: L.X, top: 830, width: L.IN, transformOrigin: '50% 0%', rotate: `x ${lerp(16, 0, tilt)}deg`, translate: `0 ${lerp(30, 0, tilt)}px`, scale: String(punch(f, k.T('h1', 2), 1.025)) }}
        >
          <div style={{ padding: '22px 28px 26px', font: `500 26px/1.5 ${F.mono}`, color: C.screenDim }}>
            <div>10-17 09:19:55</div>
            <div style={{ margin: '6px 0 8px', font: `500 40px/1.3 ${F.mono}`, color: '#fff' }}>
              두고 간 것 <span style={{ padding: '0 8px', borderRadius: 8, background: C.butter, color: C.ink }}>632,845개 107.4GB</span>
            </div>
            <div>— 목록 두고감_목록.tsv.zst</div>
            <div style={{ fontSize: 24 }}>(옛 노트북에 2주 있고, 10-03 백업분은 Drive에도 있다)</div>
          </div>
        </Screen>
      </div>
      <Circle at={k.T('h1', 4) - 2} x={292} y={930} w={500} h={108} />
    </div>
  );
};

/* ── 2 옮길 것 ────────────────────────────────────────────────────────── */
export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s2');
  const line = ramp(f, k.T('s1', 4) - 6, 8);
  const strike = ramp(f, k.T('s1', 8), 7);
  return (
    <>
      {/* 첫 요소: 두 노트북 사진(AI 이미지) — 전환에 실려 함께 착지 */}
      <div style={{ position: 'absolute', left: 596, top: 540, width: 300, height: 380, padding: 12, background: '#fff', borderRadius: 6, boxShadow: '0 40px 70px -30px rgba(0,0,0,.9)', rotate: '3deg' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 3 }}>
          <Img src={staticFile('media/laptops.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 52%' }} />
          <AiTag />
        </div>
      </div>
      <Label text="옛 노트북 → 새 노트북 · 옮길 것" at={k.land + 2} top={L.TOP} />
      <div style={{ position: 'absolute', inset: 0, scale: String(punch(f, k.T('s1', 2) + 6, 1.03)), transformOrigin: '20% 40%' }}>
        <BigNum n="160" unit="GB" size={220} unitSize={88} at={k.T('s1', 2) - 8} style={{ left: L.X, top: 560 }} />
      </div>
      <p style={{ position: 'absolute', left: L.X, top: 820, margin: 0, font: `700 54px/1.2 ${F.ko}`, letterSpacing: '-.035em', color: '#fff', opacity: line, translate: `0 ${(1 - line) * 16}px` }}>
        파일 <span style={{ font: `800 60px/1 ${F.en}`, color: C.butter }}>96</span>만 개
      </p>
      <div style={{ position: 'absolute', left: L.X, top: 1000, display: 'flex', alignItems: 'center', gap: 22 }}>
        <Chip at={k.T('s1', 6) - 2} style={{ position: 'relative', color: C.onField2 }}>
          외장 SSD
          <span style={{ position: 'absolute', left: 16, right: 16, top: '50%', height: 4, borderRadius: 2, background: C.butter, transformOrigin: '0 50%', scale: `${strike} 1` }} />
        </Chip>
        {f >= k.T('s1', 9) - 2 ? <span style={{ font: `800 44px/1 ${F.en}`, color: C.butter, opacity: ramp(f, k.T('s1', 9) - 2, 5) }}>→</span> : null}
        <Chip at={k.T('s1', 9)} fill>
          구글 드라이브로
        </Chip>
      </div>
      <SceneCaps s="s2" />
    </>
  );
};

/* ── 3 함정 1: 원드라이브 ─────────────────────────────────────────────── */
export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s3');
  const num = settle(f, k.T('p1', 2) - 3, 14);
  const mk = ramp(f, k.T('p1', 5), 10);
  const fill1 = ramp(f, k.T('p2', 1) - 3, 18);
  const fill2 = ramp(f, k.T('p2', 6) - 3, 22);
  const rec = ramp(f, k.T('p2', 2), 8);
  const BOX = Math.round((L.IN * 5) / 11.25);
  return (
    <>
      <p style={{ position: 'absolute', right: L.R, top: 262, margin: 0, font: `800 250px/0.86 ${F.en}`, letterSpacing: '-.06em', color: C.butter, opacity: num, scale: String(lerp(1.4, 1, num)), transformOrigin: '100% 0%' }}>01</p>
      <Label text="함정 1 · 원드라이브" at={k.land + 2} top={L.TOP} />
      <Lines at={k.land + 4} size={78} top={L.TOP + 48} lines={['바탕화면은', <><Mark p={mk}>백업되는 줄</Mark> 알았다</>]} />
      {/* 첫 요소: 빈 용량 막대 둘 — 전환에 실려 함께 착지하고, 말에 맞춰 채워진다 */}
      <div style={{ position: 'absolute', left: L.X, top: 740, width: L.IN, scale: String(punch(f, k.T('p2', 4), 1.03)) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, font: `700 38px/1.2 ${F.ko}`, letterSpacing: '-.03em', color: '#fff' }}>
          <span>원드라이브 무료</span>
          <span style={{ font: `500 30px/1 ${F.mono}`, color: C.onField2 }}>5GB</span>
        </div>
        <div style={{ position: 'relative', height: 64, borderRadius: 16, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.4)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: C.butter, transformOrigin: '0 50%', scale: `${fill1} 1` }} />
          {f >= k.T('p2', 4) - 1 ? (
            <span style={{ position: 'absolute', right: 14, top: 10, padding: '8px 16px', borderRadius: 10, background: C.ink, color: C.butter, font: `700 32px/1.1 ${F.ko}`, opacity: ramp(f, k.T('p2', 4) - 1, 5) }}>꽉 참 · 10.05부터</span>
          ) : null}
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 900, width: L.IN }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, font: `700 38px/1.2 ${F.ko}`, letterSpacing: '-.03em', color: '#fff' }}>
          <span>바탕화면</span>
          <span style={{ font: `500 30px/1 ${F.mono}`, color: C.onField2 }}>11.25GB · 1,515개</span>
        </div>
        <div style={{ position: 'relative', height: 64 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.18)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'repeating-linear-gradient(135deg,#e8ebf0 0 14px,#9aa1ad 14px 28px)', transformOrigin: '0 50%', scale: `${fill2} 1` }} />
          <div style={{ position: 'absolute', left: -6, top: -8, width: BOX + 12, bottom: -8, borderRadius: 20, border: `4px dashed ${C.butter}` }} />
          <span style={{ position: 'absolute', left: 4, top: 80, font: `500 26px/1 ${F.mono}`, color: C.butter }}>무료 5GB 자리</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: BOX + 60, top: 1036 }}>
        <Chip at={k.T('p2', 8) - 1} fill>
          이 노트북에만 있었다
        </Chip>
      </div>
      <p style={{ position: 'absolute', left: L.X, right: L.R, top: 1112, margin: 0, font: `500 27px/1.42 ${F.mono}`, color: C.onField3, opacity: rec }}>
        <b style={{ fontWeight: 500, color: '#fff' }}>인계 기록 10-16</b> · OneDrive(…, 무료 5GB)가 10-05부터 가득 차서 올라가지 않았다(10-16 확인)
      </p>
      <SceneCaps s="s3" />
    </>
  );
};

/* ── 4 결정 ───────────────────────────────────────────────────────────── */
export const S4: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s4');
  const mk = ramp(f, k.T('d1', 6) - 2, 10);
  const who = ramp(f, k.land + 14, 8);
  return (
    <>
      {/* 첫 요소: 큰 따옴표 — 전환에 실려 함께 착지 */}
      <p style={{ position: 'absolute', left: L.X - 6, top: 470, margin: 0, font: `800 230px/1 ${F.en}`, color: C.butter }}>“</p>
      <Label text="그래서 정한 것 · 10.16 아침" at={k.land + 2} top={L.TOP + 10} left={L.X + 170} />
      <div style={{ position: 'absolute', inset: 0, scale: String(punch(f, k.T('d1', 7), 1.03)), transformOrigin: '30% 50%' }}>
        <Lines at={k.land} size={98} top={650} lh={1.16} lines={['앞으로의 작업에', <>필요 없는 건 <Mark p={mk}>두고,</Mark></>, '새 노트북은 가볍게']} />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1030, display: 'flex', alignItems: 'center', gap: 18, opacity: who, font: `650 34px/1.3 ${F.ko}`, color: '#fff' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: '50%', background: C.butter, color: C.ink, font: `800 30px/1 ${F.ko}` }}>유</span>
        <span>
          유호 <span style={{ font: `500 26px/1 ${F.mono}`, color: C.onField2, marginLeft: 8 }}>인계 기록 원문</span>
        </span>
      </div>
      <SceneCaps s="s4" />
    </>
  );
};

/* ── 5 함정 2: 첫 규칙 ────────────────────────────────────────────────── */
const RULES = ['암호화 키', '장부', '스크립트', 'git 추적 파일'];
export const S5: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s5');
  const num = settle(f, k.T('f1', 2) - 3, 14);
  const mk = ramp(f, k.T('f1', 7), 10);
  const why = ramp(f, k.T('f2', 1) - 2, 8);
  return (
    <>
      <p style={{ position: 'absolute', right: L.R, top: 262, margin: 0, font: `800 250px/0.86 ${F.en}`, letterSpacing: '-.06em', color: C.butter, opacity: num, scale: String(lerp(1.4, 1, num)), transformOrigin: '100% 0%' }}>02</p>
      <Label text="함정 2 · 첫 규칙" at={k.land + 2} top={L.TOP} />
      <Lines at={k.land + 4} size={72} top={L.TOP + 48} lines={['AI가 짠 규칙을', <><Mark p={mk}>다른 AI</Mark>가 검수했더니</>]} />
      {/* 첫 요소: 첫 규칙 종이 — 전환에 실려 함께 착지하고, 「두고 감」 표시는 말에 맞춰 붙는다 */}
      <Paper style={{ left: L.X, top: 730, width: L.IN, scale: String(punch(f, k.T('f2', 4), 1.03)) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 28px', background: C.ink, color: C.onField2, font: `500 26px/1.2 ${F.mono}` }}>
          <span>1차 규칙 · 두고 갈 것</span>
          <span>10.16</span>
        </div>
        <div style={{ padding: '6px 30px 12px' }}>
          {RULES.map((r, i) => {
            const at = k.T('f1', 5) + i * 4;
            return (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 76, borderBottom: i < RULES.length - 1 ? `2px solid ${C.paperLine}` : undefined, font: `700 42px/1 ${F.ko}`, letterSpacing: '-.03em' }}>
                <span>{r}</span>
                <span style={{ padding: '8px 16px', borderRadius: 10, background: '#f1f2f4', color: C.muted, font: `650 28px/1 ${F.ko}`, opacity: ramp(f, at, 5), scale: String(lerp(0.8, 1, ramp(f, at, 6))) }}>두고 감</span>
              </div>
            );
          })}
        </div>
      </Paper>
      <Stamp at={k.T('f1', 9)} rot={-6} style={{ left: 600, top: 690, padding: '14px 22px', borderRadius: 14, background: C.butter, color: C.ink, boxShadow: '0 16px 30px -16px rgba(0,0,0,.8)' }}>
        <div style={{ font: `800 42px/1 ${F.ko}`, letterSpacing: '-.03em' }}>검수 ✕</div>
        <div style={{ marginTop: 8, font: `500 24px/1 ${F.mono}` }}>10.16 08:06</div>
      </Stamp>
      <Circle at={k.T('f2', 4) - 2} x={L.X + 6} y={790} w={300} h={96} />
      <p style={{ position: 'absolute', left: L.X, right: L.R, top: 1132, margin: 0, font: `600 32px/1.35 ${F.ko}`, color: C.onField2, opacity: why }}>
        이유: 10-03 백업 목록 전체를 <b style={{ color: C.butter, fontWeight: 700 }}>「Drive에 있음」</b>으로 봤다
      </p>
      <SceneCaps s="s5" />
    </>
  );
};

/* ── 6 두 번째 규칙: 절대 빼지 않을 2.7만 개 ──────────────────────────── */
export const S6: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s6');
  const mk = ramp(f, k.T('k1', 3), 10);
  return (
    <>
      <Label text="두 번째 규칙 · 10.16 09:17" at={k.land + 2} top={L.TOP} />
      <Lines at={k.land + 4} size={80} top={L.TOP + 48} lines={[<><Mark p={mk}>절대 빼지 않을</Mark> 파일</>]} />
      <div style={{ position: 'absolute', inset: 0, scale: String(punch(f, k.T('k1', 9), 1.04)), transformOrigin: '20% 45%' }}>
        <BigNum n="2.7" unit="만 개" size={280} unitSize={110} at={k.T('k1', 7) - 4} style={{ left: L.X, top: 660 }} />
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 960 }}>
        <Chip at={k.T('k1', 10) - 1} style={{ font: `500 32px/1 ${F.mono}`, letterSpacing: 0 }}>
          1차-지킴.txt.zst
        </Chip>
      </div>
      {/* 첫 요소: 올리기 스크립트의 주석(원문 앞부분) — 전환에 실려 함께 착지 */}
      <Screen style={{ left: L.X, top: 1050, width: L.IN }}>
        <div style={{ padding: '20px 28px', font: `500 30px/1.5 ${F.mono}`, color: '#e8ebf0' }}>
          <div>
            <span style={{ color: C.butter }}>#</span> 가져가는 저장소 3곳의 git 추적 파일은
          </div>
          <div>
            <span style={{ color: C.butter }}>#</span> 어떤 규칙으로도 빼지 않는다(…)
          </div>
        </div>
      </Screen>
      <SceneCaps s="s6" />
    </>
  );
};

/* ── 7 받기 로그: 원문이 올라오고, 결과 줄은 말에 맞춰 낱말마다 밝아진다 ── */
export const S7: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s7');
  const before = LOG.slice(0, -1);
  const lastLine = LOG[LOG.length - 1];
  const span = Math.max(18, k.T('r1', 7) - k.land - 6);
  const lastIn = settle(f, k.T('r1', 8), 16);
  const zoom = settle(f, k.ST('r2'), 9);
  const split = (l: string) => {
    const m = l.match(/^(\d\d-\d\d \d\d:\d\d:\d\d) (.*)$/);
    return m ? [m[1], m[2]] : ['', l];
  };
  const [lt, lb] = split(lastLine);
  // 결과 줄 「핵심 상태: 핵심이 옛 노트북의 마지막 상태와 같다. 새 노트북에서 일해도 된다.」 — 대사 r2 낱말 여섯이 「핵심이 … 같다.」에 하나씩 대응
  const spoken = '핵심이 옛 노트북의 마지막 상태와 같다.';
  const at = lb.indexOf(spoken);
  const head = at >= 0 ? lb.slice(0, at) : '';
  const tail = at >= 0 ? lb.slice(at + spoken.length) : lb;
  const words = spoken.split(' ');
  const lit = (i: number) => interpolate(f, [k.T('r2', i) - 1, k.T('r2', i) + 4], [0.42, 1], clamp);
  const tailLit = interpolate(f, [k.EN('r2') - 2, k.EN('r2') + 6], [0.42, 1], clamp);
  return (
    <>
      <Label text="받기_log.txt 발췌 · 새 노트북" at={k.land + 2} top={L.TOP} />
      <div style={{ position: 'absolute', left: L.X, top: 528, display: 'flex', gap: 14 }}>
        <Chip at={k.T('r1', 0)}>하루 반</Chip>
        <Chip at={k.T('r1', 3) - 2}>
          조각&nbsp;<b style={{ font: `800 34px/1 ${F.en}`, color: C.butter }}>39</b>개
        </Chip>
        <Chip at={k.T('r1', 6) - 1}>
          다시 받기&nbsp;<b style={{ color: C.butter }}>7</b>번 · 실패&nbsp;<b style={{ color: C.butter }}>0</b>
        </Chip>
      </div>
      {/* 첫 요소: 받기 로그 판과 첫 줄 — 전환에 실려 함께 착지 */}
      <div style={{ position: 'absolute', inset: 0, scale: String(lerp(1, 1.1, zoom)), transformOrigin: '50% 1010px' }}>
        <Screen bar={['~/SYNK이전_로그/받기_log.txt', '10.17']} style={{ left: L.X, top: 630, width: L.IN, height: 530 }}>
          <div style={{ position: 'relative', height: 470, padding: '0 28px' }}>
            <div style={{ position: 'absolute', left: 28, right: 28, bottom: 24 }}>
              {before.map((l, i) => {
                const p = i === 0 ? 1 : ramp(f, k.land + 4 + Math.round((span * i) / before.length), 6);
                const [t, b] = split(l);
                return (
                  <p key={i} style={{ margin: '0 0 12px', font: `500 28px/1.45 ${F.mono}`, color: '#c9ced8', opacity: p, translate: `0 ${(1 - p) * 16}px` }}>
                    <span style={{ color: '#7d8595' }}>{t}</span> {b}
                  </p>
                );
              })}
              <p style={{ margin: 0, padding: '14px 16px', borderRadius: 12, background: C.butter, color: C.ink, font: `700 38px/1.32 ${F.mono}`, opacity: lastIn, translate: `0 ${(1 - lastIn) * 24}px` }}>
                <span style={{ color: '#5a4a14' }}>{lt}</span> {head}
                {words.map((w, i) => (
                  <span key={i} style={{ opacity: lit(i) }}>
                    {w}
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                ))}
                <span style={{ opacity: tailLit }}>{tail}</span>
              </p>
            </div>
          </div>
        </Screen>
      </div>
      <Stamp at={k.ST('r2') + 9} rot={-3} style={{ right: L.R, top: 1186, padding: '8px 16px', borderRadius: 10, font: `500 28px/1.2 ${F.mono}`, color: '#fff', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.6)' }}>
        10.17 09:43:40
      </Stamp>
      <SceneCaps s="s7" skip={['r2']} />
    </>
  );
};

/* ── 8 깨달음 ─────────────────────────────────────────────────────────── */
export const S8: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s8');
  const mk = ramp(f, k.T('t1', 5), 12);
  const b = settle(f, k.T('t1', 4) - 3, 14);
  return (
    <>
      <Label text="AI한테 이사를 맡길 때" at={k.land + 2} top={L.TOP} />
      <Lines at={k.land + 4} size={76} top={L.TOP + 48} lines={['옮길 것보다', <><Mark p={mk}>두고 가면 안 될 것</Mark>부터</>]} />
      {/* 첫 요소: 「다 옮겨 줘」 카드 — 전환에 실려 함께 착지 */}
      <Paper style={{ left: L.X, top: 760, width: 400, height: 330, padding: '30px 30px', boxSizing: 'border-box', background: '#e9ebef', color: C.muted }}>
        <div style={{ font: `500 26px/1 ${F.mono}`, marginBottom: 20 }}>보통 하는 말</div>
        <div style={{ font: `800 48px/1.22 ${F.ko}`, letterSpacing: '-.04em' }}>“다 옮겨 줘”</div>
      </Paper>
      <Stamp at={k.T('t1', 3)} rot={0} style={{ left: 330, top: 950, width: 130, height: 130, borderRadius: '50%', background: C.ink, color: C.butter, display: 'grid', placeItems: 'center', font: `900 86px/1 ${F.ko}`, boxShadow: '0 0 0 8px #e9ebef' }}>
        ✕
      </Stamp>
      <Paper style={{ left: 520, top: 760, width: 400, height: 330, padding: '30px 30px', boxSizing: 'border-box', background: '#fff8e1', boxShadow: `0 0 0 4px ${C.butter},0 40px 70px -30px rgba(0,0,0,.9)`, opacity: Math.min(1, b * 2), translate: `0 ${lerp(50, 0, b)}px`, scale: String(punch(f, k.T('t1', 10), 1.05)) }}>
        <div style={{ font: `500 26px/1 ${F.mono}`, marginBottom: 20, color: C.muted }}>먼저 할 말</div>
        <div style={{ font: `800 46px/1.22 ${F.ko}`, letterSpacing: '-.04em' }}>“이건 절대 빼지 마”</div>
        <div style={{ marginTop: 22, display: 'grid', gap: 10, font: `650 32px/1.2 ${F.ko}` }}>
          {['키·로그인 파일', '장부·기록', '작업 중인 파일'].map((x) => (
            <div key={x}>
              <span style={{ color: '#d9a419' }}>■</span> {x}
            </div>
          ))}
        </div>
      </Paper>
      <SceneCaps s="s8" />
    </>
  );
};

/* ── 9 같은 PDF → 질문 셋으로 사람마다 다른 목록(결과 제목은 맞춤 도구가 실제로 낸 글) ── */
const COLS = [L.X, 376, 668];
export const S9: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s9');
  const swap = k.T('c2', 3) - 4;
  const aOut = 1 - ramp(f, swap, 6);
  const bIn = ramp(f, swap + 3, 8);
  const mkA = ramp(f, k.T('c1', 3), 10);
  const mkB = ramp(f, k.T('c2', 4), 10);
  const flip0 = k.T('c2', 4) + 2;
  const x = f >= k.ST('c2') ? interpolate(f, [k.ST('c2'), k.ST('c2') + 7, flip0 - 6, flip0], [0, 1, 1, 0], clamp) : 0;
  const eq = ramp(f, k.T('c1', 4) - 3, 6) * (1 - ramp(f, flip0 - 6, 6));
  return (
    <>
      <div style={{ opacity: aOut, translate: `0 ${(1 - aOut) * -24}px` }}>
        <Label text="보통 나눠 주는 것" at={k.land + 2} top={L.TOP} />
        <Lines at={k.land + 4} size={66} top={L.TOP + 48} lines={['이사 체크리스트,', <><Mark p={mkA}>PDF는 누구한테나</Mark> 똑같죠</>]} />
      </div>
      {f >= swap + 3 ? (
        <div style={{ opacity: bIn }}>
          <Label text="질문 3개에 답하면" at={swap + 3} top={L.TOP} />
          <Lines at={swap + 5} size={66} top={L.TOP + 48} lines={[<><Mark p={mkB}>내 컴퓨터</Mark>에 맞는</>, '이사 목록']} />
        </div>
      ) : null}
      {/* 첫 요소: 세 사람의 같은 PDF — 전환에 실려 함께 착지 */}
      {RES.people.map((p, i) => {
        const flip = flip0 + i * 3;
        const out = interpolate(f, [flip, flip + 5], [0, 90], { ...clamp, easing: (t) => t * t });
        const inn = interpolate(f, [flip + 5, flip + 13], [-90, 0], { ...clamp, easing: EASE_OUT });
        const dim = f >= k.ST('c2') && f < flip ? 0.35 : 1;
        return (
          <div key={i} style={{ position: 'absolute', left: COLS[i], top: 720, width: 252, perspective: 900, scale: String(punch(f, k.T('c2', 7), 1.04)) }}>
            <span style={{ display: 'inline-flex', padding: '10px 18px', borderRadius: 999, boxShadow: 'inset 0 0 0 2.5px rgba(255,255,255,.7)', color: '#fff', font: `700 28px/1 ${F.ko}`, whiteSpace: 'nowrap' }}>{p.who}</span>
            {f < flip + 5 ? (
              <div style={{ position: 'absolute', left: 0, top: 70, width: 252, height: 380, boxSizing: 'border-box', padding: '26px 22px', borderRadius: 24, background: '#f4f1ea', color: C.ink, boxShadow: '0 24px 40px -24px rgba(0,0,0,.9)', opacity: dim, rotate: `y ${out}deg` }}>
                <b style={{ display: 'inline-block', padding: '7px 12px 8px', borderRadius: 8, background: C.ink, color: '#fff', font: `800 26px/1 ${F.en}` }}>PDF</b>
                <p style={{ margin: '16px 0 20px', font: `500 26px/1.25 ${F.mono}`, color: '#5d6168' }}>PC 이사 체크리스트.pdf</p>
                {[96, 84, 92, 70, 88, 60].map((w, j) => (
                  <i key={j} style={{ display: 'block', width: `${w}%`, height: 14, margin: '0 0 15px', borderRadius: 7, background: '#d9d6ce' }} />
                ))}
              </div>
            ) : (
              <div style={{ position: 'absolute', left: 0, top: 70, width: 252, height: 380, boxSizing: 'border-box', padding: '22px 18px', borderRadius: 24, background: C.ink, color: '#fff', boxShadow: `0 0 0 4px ${C.butter},0 24px 40px -24px rgba(0,0,0,.9)`, rotate: `y ${inn}deg` }}>
                <small style={{ display: 'block', marginBottom: 14, font: `500 26px/1.2 ${F.mono}`, color: C.butter }}>내 이사 목록</small>
                <h4 style={{ margin: 0, font: `800 37px/1.28 ${F.ko}`, letterSpacing: '-.045em', wordBreak: 'keep-all' }}>{p.title}</h4>
              </div>
            )}
          </div>
        );
      })}
      {[0, 1].map((i) => (
        <span key={i} style={{ position: 'absolute', left: [336, 628][i], top: 900, width: 40, textAlign: 'center', font: `900 56px/1 ${F.ko}`, color: C.butter, opacity: eq }}>=</span>
      ))}
      {x > 0 ? (
        <span style={{ position: 'absolute', left: 392, top: 800, width: 220, height: 220, borderRadius: '50%', background: C.butter, color: C.ink, display: 'grid', placeItems: 'center', font: `900 150px/1 ${F.ko}`, boxShadow: `0 0 0 10px ${C.field}`, opacity: x, scale: String(lerp(1.6, 1, Math.min(1, x * 1.2))) }}>✕</span>
      ) : null}
      <SceneCaps s="s9" />
    </>
  );
};

/* ── 10 끝: 프로필 링크 → synk.im/builds/move ─────────────────────────── */
export const S10: React.FC = () => {
  const f = useCurrentFrame();
  const k = clock('s10');
  const url = settle(f, k.land, 14);
  const face = settle(f, k.land + 6, 12);
  const scroll = interpolate(f, [k.land + 18, k.land + 78], [0, -300], { ...clamp, easing: EASE_OUT });
  const foot = ramp(f, k.EN('c3') + 15, 10);
  return (
    <>
      <Head left="yuhobuilds" right="실화 · 2026.10.17" at={k.land} />
      <Label text="내 컴퓨터에 맞는 이사 목록" at={k.land + 2} top={L.TOP} />
      <p style={{ position: 'absolute', left: L.X, top: L.TOP + 50, margin: 0, font: `800 80px/1 ${F.en}`, letterSpacing: '-.035em', color: '#fff', opacity: url, translate: `0 ${lerp(30, 0, url)}px` }}>
        synk.im/builds/<span style={{ color: C.butter }}>move</span>
      </p>
      <div style={{ position: 'absolute', left: L.X, top: 640, display: 'flex', gap: 14 }}>
        <Chip at={k.T('c3', 0) - 2} fill>
          질문 3개
        </Chip>
        <Chip at={k.T('c3', 0) + 2}>로그인 없음</Chip>
        <Chip at={k.T('c3', 1)} style={{ scale: String(punch(f, k.T('c3', 2), 1.08)) }}>
          프로필 링크 ↗
        </Chip>
      </div>
      {/* 첫 요소: 맞춤 도구 첫 화면(실제 캡처) — 전환에 실려 함께 착지 */}
      <Screen style={{ left: L.X, top: 750, width: 500, height: 420 }}>
        <div style={{ position: 'absolute', inset: 30, borderRadius: 16, overflow: 'hidden', background: C.screen }}>
          <Img src={staticFile('media/01_start.webp')} style={{ display: 'block', width: '100%', translate: `0 ${scroll}px` }} />
        </div>
      </Screen>
      <div style={{ position: 'absolute', left: 626, top: 764, width: 270, height: 330, borderRadius: '999px 999px 36px 36px', overflow: 'hidden', boxShadow: '0 0 0 10px #fff,0 30px 50px -20px rgba(0,0,0,.75)', opacity: Math.min(1, face * 2), translate: `0 ${lerp(-60, 0, face)}px` }}>
        <Img src={staticFile('media/yuho_model_cut.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
      </div>
      <p style={{ position: 'absolute', left: 626, top: 1112, width: 270, margin: 0, textAlign: 'center', font: `650 30px/1.2 ${F.ko}`, color: C.onField2, opacity: face }}>SYNK를 만드는 유호</p>
      <div style={{ position: 'absolute', left: L.X, right: L.R + 4, top: 1250, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: foot }}>
        <Img src={staticFile('kit/logo-synk-paper.webp')} style={{ height: 46 }} />
        <span style={{ font: `600 30px/1 ${F.en}`, color: C.onField2 }}>@yuhobuilds</span>
      </div>
      <SceneCaps s="s10" />
    </>
  );
};

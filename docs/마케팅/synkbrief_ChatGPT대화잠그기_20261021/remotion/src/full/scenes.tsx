// 「ChatGPT 대화 잠그기」 v4 다섯 장면(10-23 알아듣기 판). 한 문장: 「ChatGPT 대화, PIN으로 잠가 숨길 수 있어요 — PIN 잊으면 다 지워져요」.
// 상황(화면 공유 중 대화 제목이 보임) → 잠그는 법(점 세 개 → 대화 잠그기 → PIN 4자리) → 경고(잊고 재설정하면 전부 삭제 · 만들 때 적어 두기, 약 10초)
// → 다시 볼 때(잠긴 대화 폴더 · PIN) → 끝(나머지는 캡션 · 고정 댓글). 화면 글은 말과 같은 것만 크게 쓴다.
// ChatGPT 앱 화면은 녹화하지 않는다(PIN 잠금은 계정 보안 설정이라 유호님 계정에서 켜지 않는다) — 사이드바·메뉴는 SYNK 키트로 그린 예시 그림이고
// 대화 제목은 지어낸 예시다. 메뉴 이름은 OpenAI 도움말 원문(영문) 「Lock chat」·「Projects > Locked chats」에 뜻을 붙였다(기획.md 「정보 품질」).
// 메뉴의 다른 항목은 확인하지 않아 글 없는 회색 줄로만 그린다.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp } from '../lib/anim';
import { C, F, L } from '../theme';
import { CursorArc, HeadF, Lines, MarkF, settle } from '../v5/cine';
import { ease, fadeUp, QChip } from './parts';
import { at, seq, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836
const HEAD = 'synkbrief 기초';
const IN = 2;
const SHADOW = '0 30px 60px -30px rgba(4,12,36,.7)';

type K = Parameters<typeof seq>[0];
const wordIn = (k: K, id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};
const bob = (f: number, phase = 0, amp = 6) => Math.sin((f + phase) / 22) * amp;

/** 자물쇠(열림 0 → 잠김 1) */
const Lock: React.FC<{ size?: number; closed?: number; color?: string }> = ({ size = 40, closed = 1, color = C.ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none', overflow: 'visible' }}>
    <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" transform={`translate(0 ${-3 * (1 - closed)})`} />
    <rect x="4.5" y="11" width="15" height="10" rx="2.6" fill={color} />
    <circle cx="12" cy="16" r="1.6" fill="#fff" />
  </svg>
);

/** 예시 그림 표(짧게) */
const Tag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <span style={{ padding: '6px 12px', borderRadius: 8, background: '#e9ecf1', font: `700 24px/1 ${F.ko}`, color: C.muted, whiteSpace: 'nowrap', ...style }}>예시 그림</span>
);

/** PIN 네 칸: 하나씩 채워진다 */
const PinDots: React.FC<{ f: number; at0: number; size?: number; gap?: number; color?: string }> = ({ f, at0, size = 44, gap = 22, color = '#fff' }) => (
  <div style={{ display: 'flex', gap }}>
    {[0, 1, 2, 3].map((i) => {
      const s = settle(f, at0 + i * 4, 20);
      return <span key={i} style={{ width: size, height: size, borderRadius: '50%', border: `4px solid ${color}`, background: s > 0.5 ? color : 'transparent', scale: String(0.85 + 0.15 * s) }} />;
    })}
  </div>
);

// 지어낸 예시 대화 제목(실제 사람의 대화가 아님)
const CHATS = ['이직 고민 상담', '건강검진 결과 묻기', '깜짝 선물 아이디어', '엑셀 함수 질문'];

// ── 1 훅 · 상황 ───────────────────────────────────────────────────────
// 0프레임부터 제목 셋째 줄까지 다 보인다(첫 2초에 한 문장 앞 절반). 노트북 그림: 「화면 공유 중」, 「곤란한」에 첫 대화가 빨갛게,
// 「잠가서」에 자물쇠가 걸리고 그 줄이 목록에서 사라진다.
export const hookT = () => ({
  glow: wordIn('hook', 'v11', '곤란한', 1),
  lock: wordIn('hook', 'v11', '잠가서', 6) + 2,
});
export const Hook1: React.FC = () => {
  const f = useCurrentFrame();
  const t = hookT();
  const glow = ease(f, t.glow, 8);
  const locked = ease(f, t.lock, 8);
  const gone = ease(f, t.lock + 12, 14);
  const rowH = 64;
  const gap = 10;
  return (
    <>
      <HeadF left={HEAD} right="ChatGPT 새 기능" />
      <Lines visibleAtZero at={0} size={80} top={L.TOP} lines={['남이 보면 곤란한', 'ChatGPT 대화,', <MarkF key="m" p={ramp(f, t.lock, 12)}>PIN으로 잠가 숨겨요</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 840 + bob(f, 0, 4), width: CW }}>
        <div style={{ height: 450, borderRadius: '28px 28px 10px 10px', background: C.ink, padding: 16, boxSizing: 'border-box', boxShadow: SHADOW }}>
          <div style={{ height: '100%', borderRadius: 14, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 58, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#f4f5f7', borderBottom: '1px solid #e3e6eb' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, background: C.crayon, color: '#fff', font: `800 30px/1 ${F.ko}` }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: '#fff', opacity: 0.6 + 0.4 * Math.abs(Math.sin(f / 9)) }} />
                화면 공유 중
              </span>
              <Tag />
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              <div style={{ width: 340, flex: 'none', padding: '14px 16px', boxSizing: 'border-box', background: '#f4f5f7', borderRight: '1px solid #e3e6eb' }}>
                <div style={{ font: `700 24px/1 ${F.ko}`, color: C.muted, marginBottom: 12 }}>대화 목록</div>
                <div style={{ position: 'relative', height: CHATS.length * (rowH + gap) }}>
                  {CHATS.map((c, i) => {
                    const first = i === 0;
                    const y = i * (rowH + gap) - (first ? 0 : gone * (rowH + gap));
                    return (
                      <div
                        key={c}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: y,
                          height: rowH,
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '0 14px',
                          borderRadius: 12,
                          background: first ? `rgba(249,104,89,${0.2 * glow})` : '#fff',
                          boxShadow: first && glow > 0.05 ? `0 0 0 ${3 * glow}px ${C.crayon}` : 'none',
                          font: `${first ? 800 : 700} ${first ? 30 : 27}px/1.1 ${F.ko}`,
                          letterSpacing: '-.03em',
                          color: first ? C.ink : C.muted,
                          opacity: first ? 1 - gone : 1,
                          translate: first ? `${-gone * 60}px 0` : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c}
                        {first ? (
                          <span style={{ marginLeft: 'auto', opacity: locked, scale: String(0.5 + 0.5 * locked) }}>
                            <Lock size={30} closed={locked} />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, padding: '26px 26px', boxSizing: 'border-box' }}>
                <div style={{ font: `800 30px/1.1 ${F.ko}`, color: C.ink }}>주간 회의</div>
                {[0.92, 0.7, 0.82, 0.55].map((w, i) => (
                  <div key={i} style={{ marginTop: i === 0 ? 22 : 14, height: 18, width: `${w * 100}%`, borderRadius: 9, background: '#e7eaef' }} />
                ))}
                <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-end', gap: 14, height: 100 }}>
                  {[0.45, 0.7, 0.55, 0.9].map((h, i) => (
                    <div key={i} style={{ width: 46, height: `${h * 100}%`, borderRadius: '8px 8px 0 0', background: i === 3 ? C.accSoft : '#e7eaef' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ width: CW + 40, marginLeft: -20, height: 24, borderRadius: '0 0 18px 18px', background: '#2a2d36' }} />
      </div>
    </>
  );
};

// ── 2 잠그는 법 ───────────────────────────────────────────────────────
// 「점」에 대화 옆 ••• → 「잠그기,」에 메뉴의 Lock chat(대화 잠그기) → 「숫자」에 PIN 네 칸 → 「잠겨요.」에 그 줄이 목록에서 빠진다.
// 아래 칩 셋이 말과 같은 순서로 켜진다.
export const howT = () => ({
  dots: wordIn('how', 'v12', '점', 11),
  menu: wordIn('how', 'v12', '잠그기,', 12.5),
  pin: wordIn('how', 'v12', '숫자', 14.5),
  locked: wordIn('how', 'v12', '넣으면', 16), // 잠김 시작 — 줄이 폴더 칩으로 날아가 「잠겨요」에 닿는다
});
export const How2: React.FC = () => {
  const f = useCurrentFrame();
  const t = howT();
  const P = { x: L.X, y: 660, w: CW, h: 520, pad: 22 };
  const rowTop = P.y + P.pad + 52; // 패널 안 첫 줄 위
  const rowH = 74;
  const rowGap = 12;
  const btn = { x: P.x + P.w - P.pad - 14 - 68, y: rowTop + (rowH - 50) / 2, w: 68, h: 50 };
  const dotsOn = ease(f, t.dots, 8);
  // 최종 시험(10-23) 「메뉴가 PIN 팝업에 가려 대화 잠그기가 어딘지 안 보임」 → 메뉴는 잠길 때까지 열어 두고 PIN 칸은 왼쪽 아래에 띄운다(세 단계가 한 화면에).
  const menuIn = ease(f, t.dots + 6, 10) * (1 - ease(f, t.locked - 2, 6));
  const lockOn = ease(f, t.menu, 8);
  const pinIn = ease(f, t.pin, 10) * (1 - ease(f, t.locked - 2, 6));
  const gone = ease(f, t.locked + 2, 16);
  const FOLDER_TOP = 430; // 패널 안 「잠긴 대화」 칩 위(패널 위 기준)
  const menu = { x: P.x + P.w - P.pad - 420, y: rowTop + rowH + 8, w: 420 };
  const lockItemY = menu.y + 12 + 2 * 54 + 38;
  const step = (a: number, b: number) => f >= a && f < b;
  return (
    <>
      <HeadF left={HEAD} right="ChatGPT" />
      <Lines at={IN} size={84} top={L.TOP} lines={['잠그는 법']} />
      <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, boxSizing: 'border-box', padding: P.pad, borderRadius: 28, background: '#fff', color: C.ink, boxShadow: SHADOW, ...fadeUp(f, IN, 26) }}>
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: `700 26px/1 ${F.ko}`, color: C.muted }}>대화 목록</span>
          <Tag />
        </div>
        {/* 잠긴 대화 폴더 칩: 잠근 줄이 여기로 빨려 들어간다 — 최종 시험(10-23) 「목록에서 말없이 사라져 지워졌나 싶었음」(숨김이지 삭제가 아님을 보이게) */}
        <div style={{ position: 'absolute', left: P.pad, top: FOLDER_TOP, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderRadius: 14, background: C.ink, color: '#fff', font: `800 30px/1 ${F.ko}`, opacity: ease(f, t.locked - 4, 8), scale: String(1 + 0.1 * Math.max(0, 1 - Math.abs(f - (t.locked + 18)) / 6)), transformOrigin: '0 50%' }}>
          <Lock size={30} color="#fff" closed={ease(f, t.locked + 16, 6)} />
          잠긴 대화
        </div>
        {/* 두 줄만 — 최종 시험(10-23) 「PIN 칸이 깜짝 선물 아이디어 칸에 겹쳐 어느 대화를 잠그는지 헷갈림」 */}
        {CHATS.slice(0, 2).map((c, i) => {
          const first = i === 0;
          const y = 52 + i * (rowH + rowGap) - (first ? 0 : gone * (rowH + rowGap));
          return (
            <div
              key={c}
              style={{
                position: 'absolute',
                left: P.pad,
                right: P.pad,
                top: P.pad + y,
                height: rowH,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                padding: '0 22px',
                borderRadius: 16,
                background: first ? C.accSoft : '#f4f5f7',
                font: `${first ? 800 : 700} ${first ? 35 : 30}px/1 ${F.ko}`,
                letterSpacing: '-.03em',
                color: first ? C.ink : C.muted,
                opacity: first ? 1 - ease(f, t.locked + 16, 5) : 1,
                translate: first ? `0 ${gone * (FOLDER_TOP - P.pad - 52)}px` : undefined,
                scale: first ? String(1 - 0.6 * gone) : undefined,
                transformOrigin: '0 50%',
                zIndex: first ? 2 : 1,
              }}
            >
              {c}
              {first && gone > 0.02 ? (
                <span style={{ marginLeft: 16 }}>
                  <Lock size={34} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* 대화 옆 ••• */}
      <div
        style={{
          position: 'absolute',
          left: btn.x,
          top: btn.y,
          width: btn.w,
          height: btn.h,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: dotsOn > 0.5 ? C.mark : '#fff',
          boxShadow: dotsOn > 0.05 ? `0 0 0 ${5 * dotsOn}px ${C.mark}` : 'inset 0 0 0 2px #cfd5de',
          font: `900 30px/1 ${F.ko}`,
          letterSpacing: '.04em',
          color: C.ink,
          opacity: (1 - gone) * interpolate(f, [IN + 4, IN + 12], [0, 1], clamp),
        }}
      >
        •••
      </div>
      {/* 메뉴: 확인하지 않은 항목은 글 없는 회색 줄, Lock chat만 글 */}
      <div style={{ position: 'absolute', left: menu.x, top: menu.y, width: menu.w, boxSizing: 'border-box', padding: 12, borderRadius: 20, background: '#fff', color: C.ink, boxShadow: '0 0 0 2px #dfe3e9,0 26px 50px -20px rgba(4,12,36,.6)', opacity: menuIn, translate: `0 ${(1 - menuIn) * -16}px`, scale: String(0.94 + 0.06 * menuIn), transformOrigin: '100% 0' }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ height: 54, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <span style={{ height: 16, width: `${[58, 44][i]}%`, borderRadius: 8, background: '#e7eaef' }} />
          </div>
        ))}
        <div style={{ height: 76, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', borderRadius: 14, background: lockOn > 0.5 ? C.mark : 'transparent', boxShadow: lockOn > 0.05 ? `0 0 0 ${4 * lockOn}px ${C.mark}` : 'none' }}>
          <span style={{ font: `850 38px/1 ${F.ko}`, letterSpacing: '-.02em' }}>Lock chat</span>
          <span style={{ font: `750 28px/1 ${F.ko}`, color: C.muted }}>대화 잠그기</span>
        </div>
        <div style={{ height: 54, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <span style={{ height: 16, width: '50%', borderRadius: 8, background: '#e7eaef' }} />
        </div>
      </div>
      {/* PIN 네 칸 */}
      <div style={{ position: 'absolute', left: P.x + P.pad, top: 900, width: 360, height: 250, boxSizing: 'border-box', borderRadius: 28, background: C.ink, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, boxShadow: '0 40px 80px -30px rgba(0,0,0,.7)', opacity: pinIn, scale: String(0.92 + 0.08 * pinIn) }}>
        <span style={{ font: `800 34px/1 ${F.ko}` }}>숫자 4자리 PIN</span>
        <PinDots f={f} at0={t.pin + 4} size={40} gap={16} />
      </div>
      <CursorArc from={[720, 1160]} to={[btn.x + btn.w / 2, btn.y + btn.h / 2 + 4]} start={t.dots - 16} arrive={t.dots - 2} click={t.dots} leave={t.menu - 12} />
      <CursorArc from={[btn.x + btn.w / 2, btn.y + btn.h / 2 + 4]} to={[menu.x + 112, lockItemY + 26]} start={t.menu - 12} arrive={t.menu - 2} click={t.menu} leave={t.pin - 2} />
      <div style={{ position: 'absolute', left: L.X, top: 1220, width: CW, display: 'flex', gap: 10 }}>
        <QChip n="①" label="점 세 개" at={t.dots} on={step(t.dots, t.menu)} size={32} />
        <QChip n="②" label="대화 잠그기" at={t.menu} on={step(t.menu, t.pin)} size={32} />
        <QChip n="③" label="PIN 4자리" at={t.pin} on={f >= t.pin} size={32} />
      </div>
    </>
  );
};

// ── 3 경고 ───────────────────────────────────────────────────────────
// 「재설정하면,」에 제목 밑줄 → 「전부」에 잠긴 대화 줄마다 빨간 줄 → 「지워지고」에 줄이 떨어져 사라지고 「전부 지워져요」 → 「되살릴」에 「되살릴 수 없어요」
// → 「핀은」에 노란 줄 「PIN은 만들 때 바로 적어 두세요」.
export const warnT = () => ({
  reset: wordIn('warn', 'v13', '재설정하면,', 21),
  all: wordIn('warn', 'v13', '전부', 22.5),
  del: wordIn('warn', 'v13', '지워지고', 23),
  no: wordIn('warn', 'v13', '되살릴', 24),
  note: wordIn('warn', 'v13', '핀은', 26),
});
export const Warn3: React.FC = () => {
  const f = useCurrentFrame();
  const t = warnT();
  const shake = f >= t.del && f < t.del + 10 ? Math.sin((f - t.del) * 2.4) * 8 * (1 - (f - t.del) / 10) : 0;
  return (
    <>
      <HeadF left={HEAD} right="ChatGPT" />
      <Lines at={IN} size={84} top={L.TOP} lines={['단, PIN을 잊어서', <MarkF key="m" p={ramp(f, t.reset, 12)}>재설정하면</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X + shake, top: 770 + bob(f, 3, 3), width: CW, height: 400, boxSizing: 'border-box', padding: '28px 30px', borderRadius: 30, background: '#fff', color: C.ink, boxShadow: `0 0 0 6px ${C.crayon},${SHADOW}`, ...fadeUp(f, IN, 26) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, font: `800 34px/1 ${F.ko}` }}>
          <Lock size={38} />
          잠긴 대화
        </div>
        <div style={{ position: 'relative', marginTop: 22, height: 270 }}>
          {/* 앞에서 잠근 「이직 고민 상담」 + 그 밖에 잠가 둔 대화(글 없는 회색 줄) — 이해 시험 2차(10-23) 「잠근 건 하나인데 셋이라 헷갈림」 */}
          {[CHATS[0], null, null].map((c, i) => {
            const cut = ease(f, t.all + i * 3, 8);
            const fall = ease(f, t.del + i * 3, 12);
            return (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 82, height: 70, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', borderRadius: 14, background: '#f4f5f7', font: `750 30px/1 ${F.ko}`, color: C.ink, opacity: 1 - fall, translate: `0 ${fall * 40}px`, rotate: `${fall * (i - 1) * 4}deg` }}>
                <Lock size={26} color={c ? C.ink : '#b9c0cb'} />
                <span style={{ position: 'relative', display: 'inline-block', minWidth: c ? undefined : [300, 230][i - 1] }}>
                  {c ?? <span style={{ display: 'block', height: 16, borderRadius: 8, background: '#dfe3e9' }} />}
                  <span style={{ position: 'absolute', left: -6, top: '50%', height: 6, marginTop: -3, width: `calc(${cut * 100}% + 12px)`, background: C.crayon, borderRadius: 3, opacity: cut > 0.01 ? 1 : 0 }} />
                </span>
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center' }}>
            {/* 최종 시험(10-23) 「큰 빨간 전부 지워져요가 내 대화 전부로 읽힐 뻔」 → 무엇이 지워지는지 같이 */}
            <div style={{ font: `900 66px/1.1 ${F.ko}`, letterSpacing: '-.045em', color: C.crayon, whiteSpace: 'nowrap', ...fadeUp(f, t.del + 8, 24) }}>잠긴 대화 전부 지워져요</div>
            <div style={{ marginTop: 18, font: `800 44px/1.2 ${F.ko}`, letterSpacing: '-.03em', color: C.ink, ...fadeUp(f, t.no, 20) }}>되살릴 수 없어요</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1218, width: CW, boxSizing: 'border-box', padding: '24px 28px', borderRadius: 24, background: C.markField, color: C.ink, font: `850 40px/1.25 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -24px rgba(4,12,36,.6)', ...fadeUp(f, t.note - 4, 22) }}>
        PIN은 만들 때 바로 적어 두세요
      </div>
    </>
  );
};

// ── 4 다시 볼 때 ─────────────────────────────────────────────────────
// 사이드바 그림: Projects(프로젝트) 묶음 아래로 들여 쓴 Locked chats(잠긴 대화) — 「프로젝트」에 묶음 머리 노란 테, 「폴더에서」에 잠긴 대화 노란 테,
// 「핀을」에 PIN 네 칸, 「넣어요.」 뒤 잠긴 대화가 다시 보인다. 이해 시험 1차(10-23) 「프로젝트 안인지 따로인지 헷갈림」을 고친 판.
export const openT = () => ({
  proj: wordIn('open', 'v14', '프로젝트', 34),
  folder: wordIn('open', 'v14', '폴더에서', 36),
  pin: wordIn('open', 'v14', '핀을', 37),
  show: wordIn('open', 'v14', '넣어요.', 37.5) + 4,
});
export const Open4: React.FC = () => {
  const f = useCurrentFrame();
  const t = openT();
  const projOn = ease(f, t.proj, 8) * (1 - ease(f, t.folder, 6));
  const ring = ease(f, t.folder, 8);
  const pinIn = ease(f, t.pin - 4, 6) * (1 - ease(f, t.show, 6));
  const open = ease(f, t.show, 10);
  const indent = 64;
  return (
    <>
      <HeadF left={HEAD} right="ChatGPT" />
      <Lines at={IN} size={80} top={L.TOP} lines={['다시 볼 때는', '프로젝트 안의', <MarkF key="m" p={ramp(f, t.folder, 12)}>잠긴 대화 폴더</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 850 + bob(f, 7, 4), width: CW, height: 470, boxSizing: 'border-box', padding: '20px 24px', borderRadius: 28, background: '#fff', color: C.ink, boxShadow: SHADOW, ...fadeUp(f, IN, 26) }}>
        <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, font: `800 30px/1 ${F.ko}`, color: C.ink }}>
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ flex: 'none' }}>
              <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            왼쪽 메뉴
          </span>
          <Tag />
        </div>
        <div style={{ marginTop: 12, height: 70, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRadius: 16, background: projOn > 0.5 ? C.mark : '#f4f5f7', boxShadow: projOn > 0.05 ? `0 0 0 ${5 * projOn}px ${C.mark}` : 'none' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" style={{ flex: 'none' }}>
            <path d="M6 9l6 6 6-6" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ font: `850 34px/1 ${F.ko}`, letterSpacing: '-.02em' }}>Projects</span>
          <span style={{ font: `750 28px/1 ${F.ko}`, color: C.muted }}>프로젝트</span>
        </div>
        <div style={{ position: 'relative', marginLeft: indent, marginTop: 10 }}>
          <span style={{ position: 'absolute', left: -indent / 2 - 2, top: -6, bottom: 40, width: 4, borderRadius: 2, background: '#dfe3e9' }} />
          <div style={{ height: 62, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRadius: 14, background: '#f4f5f7' }}>
            <span style={{ width: 30, height: 24, borderRadius: 5, background: '#dfe3e9' }} />
            <span style={{ height: 16, width: '46%', borderRadius: 8, background: '#e2e6ec' }} />
          </div>
          <div style={{ marginTop: 10, height: 80, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRadius: 16, background: ring > 0.5 ? C.accSoft : '#f4f5f7', boxShadow: ring > 0.05 ? `0 0 0 ${6 * ring}px ${C.mark}` : 'none' }}>
            <Lock size={36} closed={1 - open} />
            <span style={{ font: `850 34px/1 ${F.ko}`, letterSpacing: '-.02em' }}>Locked chats</span>
            <span style={{ marginLeft: 'auto', font: `750 28px/1 ${F.ko}`, color: C.muted }}>잠긴 대화</span>
          </div>
          <div style={{ position: 'relative', marginTop: 12, height: 150 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120, borderRadius: 20, background: C.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, opacity: pinIn, scale: String(0.94 + 0.06 * pinIn) }}>
              <span style={{ font: `800 34px/1 ${F.ko}` }}>PIN</span>
              <PinDots f={f} at0={t.pin - 2} size={40} gap={20} />
            </div>
            {CHATS.slice(0, 2).map((c, i) => {
              const sh = ease(f, t.show + i * 4, 10);
              return (
                <div key={c} style={{ position: 'absolute', left: 0, right: 0, top: i * 72, height: 62, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 20px', borderRadius: 14, background: i === 0 ? C.accSoft : '#f4f5f7', font: `${i === 0 ? 800 : 700} ${i === 0 ? 30 : 27}px/1 ${F.ko}`, letterSpacing: '-.03em', color: i === 0 ? C.ink : C.muted, opacity: sh, translate: `0 ${(1 - sh) * -20}px` }}>
                  {c}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

// ── 5 끝 ─────────────────────────────────────────────────────────────
// A(인스타) 「캡션에」 · B(유튜브) 「고정 댓글에」 — 말과 같은 글만(이해 시험 1차: 「나머지 알아 둘 것」이 뭔지 모름 → 캡션에 있는 것을 이름으로).
// 끝 줄은 이 장면이 밀려 들어오기 시작할 때(착지 12프레임 전) 먼저 시작한다 — 끝 화면을 6초 안으로.
export const End5: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 18);
  const ff = Math.min(f, still);
  const id = variant === 'A' ? 'a15' : 'b15';
  const where = variant === 'A' ? wordIn('end', id, '캡션에', 47, variant) : wordIn('end', id, '고정', 47, variant);
  const arrow = settle(ff, where + 4, 16);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <Lines at={IN} size={76} top={L.TOP} lines={['어디서 되는지,', '언제 다시 잠기는지는', <MarkF key="m" p={ramp(ff, where, 12)}>{variant === 'A' ? '캡션에' : '고정 댓글에'}</MarkF>, '정리해 뒀어요']} />
      <div style={{ position: 'absolute', left: L.X, top: 930, width: CW, display: 'flex', opacity: interpolate(arrow, [0, 0.4], [0, 1], clamp), translate: `0 ${(1 - arrow) * -30 + Math.sin(ff / 7) * 10}px` }}>
        <svg width="110" height="140" viewBox="0 0 24 30" style={{ overflow: 'visible' }}>
          <path d="M12 2v22M3 16l9 10 9-10" fill="none" stroke={C.markField} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1250, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, IN + 6) }}>
        <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 44, display: 'block' }} />
        </span>
        <span style={{ font: `600 26px/1.2 ${F.ko}`, color: C.onField2 }}>출처 · OpenAI 도움말</span>
      </div>
    </>
  );
};

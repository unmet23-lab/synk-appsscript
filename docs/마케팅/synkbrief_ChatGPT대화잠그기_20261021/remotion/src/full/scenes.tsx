// 「ChatGPT 대화 잠그기」 여덟 장면. 장면마다 착지 박(time.ts B)에 내려앉고, 글은 마스크로 올라오며, 강조는 크레용 밑줄·형광펜.
// ChatGPT 앱 화면은 녹화하지 않는다 — 사이드바는 SYNK 키트로 그린 그림(대화 제목은 지어낸 예시, 「예시」 도장),
// 메뉴 이름·조건은 OpenAI 도움말 「Using locked chats in ChatGPT」와 릴리스 노트(2026-10-20) 문구 그대로(기획.md 「정보 품질」).
// 10-21 Fable 콘티 검수 반영: 휴대폰 다시 잠김은 「잠긴 대화를 나가거나 앱을 내려 두고 1분」, 잠근 직후 다른 화면 새로고침(05),
// B의 정답은 「잠금과 상관없어요 — 모델 개선 설정이 정해요」, 셋째 카드에 「이미 기억한 메모리」, 메뉴는 영문 + 뜻 괄호.
import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, ramp, Ring } from '../lib/anim';
import { C, F, L } from '../theme';
import { HeadF, Lines, MarkF, settle } from '../v5/cine';
import { ease, fadeUp, Mark, QChip, Stamp, Verdict } from './parts';
import { at, CUT, seq, TOTAL } from './time';
import { wordFrame } from './vo-time';

const CW = L.W - L.X - L.R; // 836
const HEAD = 'synkbrief 기초';
const IN = 2;
const SRC = 'OpenAI 도움말·릴리스 노트 · 2026.10.20';
const MENU_NOTE = '메뉴 이름은 OpenAI 도움말 표기 · 한국어 화면은 조금 다를 수 있어요';

type K = Parameters<typeof seq>[0];
const wordIn = (k: K, id: string, word: string, fallbackBeat: number, variant: 'A' | 'B' = 'A') => {
  const abs = wordFrame(variant, id, word);
  return abs === null ? at(k, fallbackBeat) : abs - seq(k).from;
};
const bob = (f: number, phase = 0, amp = 6) => Math.sin((f + phase) / 22) * amp;

/** 자물쇠(열림 0 → 잠김 1) */
const Lock: React.FC<{ size?: number; closed?: number; color?: string }> = ({ size = 40, closed = 1, color = C.ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none', overflow: 'visible' }}>
    <path d={`M7 11V8a5 5 0 0 1 10 0v${3 - 0 * closed}`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" transform={`translate(0 ${-3 * (1 - closed)})`} />
    <rect x="4.5" y="11" width="15" height="10" rx="2.6" fill={color} />
    <circle cx="12" cy="16" r="1.6" fill="#fff" />
  </svg>
);

// 지어낸 예시 대화 제목(실제 사람의 대화가 아님)
const CHATS = ['이직 고민 상담', '건강검진 결과 묻기', '깜짝 선물 아이디어', '엑셀 함수 질문'];

/** SYNK 그림 사이드바: 흰 판에 대화 목록. lockAt부터 첫 줄이 아래 「Locked chats」 폴더로 빨려 들어간다. */
const Sidebar: React.FC<{ x: number; y: number; w: number; f: number; lockAt: number; showFolderAt?: number; dimRows?: number }> = ({ x, y, w, f, lockAt, showFolderAt, dimRows = 0 }) => {
  const p = ease(f, lockAt, 18);
  const rowH = 74;
  const folderY = 26 + 52 + CHATS.length * rowH + 22;
  const fShow = ease(f, showFolderAt ?? lockAt - 6, 12);
  const shut = ease(f, lockAt + 14, 8);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, boxSizing: 'border-box', padding: '26px 24px 24px', borderRadius: 28, background: '#fff', color: C.ink, boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', font: `700 24px/1 ${F.ko}`, color: C.muted, height: 40 }}>
        <span>기록</span>
        <span style={{ padding: '7px 12px', borderRadius: 8, background: '#f1f3f6', font: `700 25px/1 ${F.ko}`, color: C.ink }}>예시 그림 · 실제 앱 화면 아님</span>
      </div>
      <div style={{ position: 'relative', height: CHATS.length * rowH + 12 }}>
        {CHATS.map((t, i) => {
          const isLock = i === 0;
          const ty = isLock ? p * (folderY - 52 - 0) : -p * rowH * (i > 0 ? 1 : 0);
          return (
            <div
              key={t}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 12 + i * rowH,
                height: rowH - 10,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 18px',
                background: isLock ? `rgba(197,214,245,${0.9 - 0.5 * p})` : '#f6f7f9',
                font: `700 30px/1 ${F.ko}`,
                letterSpacing: '-.03em',
                translate: `0 ${ty}px`,
                scale: isLock ? String(1 - 0.18 * p) : '1',
                opacity: isLock ? 1 - shut : 1 - dimRows * 0.5,
                zIndex: isLock ? 2 : 1,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, background: C.acc, opacity: 0.5 }} />
              {t}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 16, background: C.ink, color: '#fff', opacity: fShow, translate: `0 ${(1 - fShow) * 20}px` }}>
        <Lock size={34} closed={shut} color="#fff" />
        <span style={{ font: `750 28px/1.1 ${F.ko}` }}>Projects › Locked chats</span>
        <span style={{ marginLeft: 'auto', font: `600 22px/1 ${F.ko}`, color: 'rgba(255,255,255,.7)' }}>잠긴 대화</span>
      </div>
    </div>
  );
};

/** PIN 네 칸: 하나씩 채워진다 */
const PinDots: React.FC<{ f: number; at0: number; size?: number; gap?: number }> = ({ f, at0, size = 44, gap = 22 }) => (
  <div style={{ display: 'flex', gap }}>
    {[0, 1, 2, 3].map((i) => {
      const s = settle(f, at0 + i * 4, 20);
      return <span key={i} style={{ width: size, height: size, borderRadius: '50%', border: '4px solid #fff', background: s > 0.5 ? '#fff' : 'transparent', scale: String(0.85 + 0.15 * s) }} />;
    })}
  </div>
);

// ── 01 훅 ─────────────────────────────────────────────────────────────
// A(인스타 · 결과): 0프레임부터 제목 + 사이드바, 「잠가」에 첫 줄이 잠긴 대화 폴더로. 「법이랑」·「셋」에 칩 둘.
// B(유튜브 · 맞혀 보기): 같은 사이드바 + O · X 칩(정답은 06에서).
export const hookT = (variant: 'A' | 'B') => {
  const id = variant === 'A' ? 'a01' : 'b01';
  return {
    lock: variant === 'A' ? wordIn('hook', id, '잠가', 2, variant) : wordIn('hook', id, '잠그면,', 1.5, variant),
    c1: wordIn('hook', id, '잠그는', 5, variant),
    c2: variant === 'A' ? wordIn('hook', id, '잠가도', 7, variant) : wordIn('hook', id, '빠질까요?', 4, variant),
  };
};
export const Hook01: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const t = hookT(variant);
  const title =
    variant === 'A'
      ? ['ChatGPT 대화,', <MarkF key="m" p={ramp(f, t.lock, 12)}>이제 잠가 둘 수 있어요</MarkF>]
      : ['대화를 잠그면,', <MarkF key="m" p={ramp(f, t.c2, 12)}>학습에서도 빠질까?</MarkF>];
  return (
    <>
      <HeadF left={HEAD} right="ChatGPT · 2026.10.20 새 기능" />
      <Lines visibleAtZero at={0} size={84} top={L.TOP} lines={title} />
      <Sidebar x={L.X} y={760 + bob(f, 0, 4)} w={CW} f={f} lockAt={t.lock + 4} showFolderAt={-20} />
      <div style={{ position: 'absolute', left: L.X, top: 1310, width: CW, display: 'flex', gap: 14 }}>
        {variant === 'A' ? (
          <>
            <QChip n="①" label="잠그는 법" at={t.c1} size={30} />
            <QChip n="②" label="잠가도 안 바뀌는 셋" at={t.c2} size={30} />
          </>
        ) : (
          <>
            {['O', 'X'].map((o, i) => (
              <span key={o} style={{ display: 'inline-grid', placeItems: 'center', width: 110, height: 110, borderRadius: '50%', background: '#fff', color: C.field, font: `900 64px/1 ${F.ko}`, boxShadow: '0 16px 30px -16px rgba(0,0,0,.5)', scale: String(settle(f, t.c2 + i * 4, 18)), rotate: `${Math.sin((f + i * 20) / 10) * 5}deg` }}>
                {o}
              </span>
            ))}
            <span style={{ alignSelf: 'center', font: `700 30px/1.3 ${F.ko}`, color: '#fff', ...fadeUp(f, t.c1, 14) }}>정답은 잠그는 법 다음에</span>
          </>
        )}
      </div>
    </>
  );
};

// ── 02 무엇이 달라지나 ─────────────────────────────────────────────────
// 「기록」·「고정」·「검색」 칸에 차례로 취소선(목소리 낱말마다), 「폴더에만」에 폴더 강조, 「핀」에 PIN 네 칸.
export const whatT = () => ({
  a: wordIn('what', 'v02', '기록,', 12),
  b: wordIn('what', 'v02', '고정,', 12.5),
  c: wordIn('what', 'v02', '검색에서', 13),
  folder: wordIn('what', 'v02', '폴더에만', 15),
  pin: wordIn('what', 'v02', '네', 18),
});
export const What02: React.FC = () => {
  const f = useCurrentFrame();
  const t = whatT();
  const spots = [
    { label: '기록', at: t.a },
    { label: '고정', at: t.b },
    { label: '검색', at: t.c },
  ];
  return (
    <>
      <HeadF left={HEAD} right={SRC} />
      <Lines at={IN} size={80} top={L.TOP} lines={['잠근 대화는', <MarkF key="m" p={ramp(f, t.folder, 12)}>잠긴 대화 폴더에만</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 760, width: CW, display: 'flex', gap: 16 }}>
        {spots.map((s, i) => {
          const cut = ease(f, s.at, 10);
          return (
            <div key={s.label} style={{ flex: 1, padding: '24px 20px', borderRadius: 24, background: '#fff', color: C.ink, textAlign: 'center', boxShadow: '0 24px 44px -26px rgba(4,12,36,.7)', marginTop: bob(f, i * 15, 4), ...fadeUp(f, IN + i * 3, 24) }}>
              <div style={{ font: `650 24px/1.2 ${F.ko}`, color: C.muted }}>보통 보이는 곳</div>
              <div style={{ position: 'relative', display: 'inline-block', marginTop: 10, font: `850 46px/1.1 ${F.ko}`, letterSpacing: '-.03em', color: cut > 0.5 ? C.muted : C.ink }}>
                {s.label}
                <span style={{ position: 'absolute', left: -6, top: '52%', height: 6, width: `calc(${cut * 100}% + 12px)`, background: C.crayon, borderRadius: 3 }} />
              </div>
              <div style={{ marginTop: 10, font: `700 24px/1.2 ${F.ko}`, color: C.crayon, opacity: cut }}>안 보여요</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1000, width: CW, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 18, padding: '24px 26px', borderRadius: 24, background: C.ink, color: '#fff', boxShadow: f >= t.folder ? `0 0 0 6px ${C.mark}` : 'none', ...fadeUp(f, t.folder - 6, 24) }}>
        <Lock size={46} closed={ease(f, t.folder, 10)} color="#fff" />
        <div>
          <div style={{ font: `800 34px/1.15 ${F.ko}` }}>Projects › Locked chats</div>
          <div style={{ marginTop: 6, font: `600 24px/1.2 ${F.ko}`, color: 'rgba(255,255,255,.72)' }}>프로젝트 › 잠긴 대화</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1170, display: 'flex', alignItems: 'center', gap: 26, ...fadeUp(f, t.pin - 6, 20) }}>
        <PinDots f={f} at0={t.pin} />
        <span style={{ font: `750 32px/1.25 ${F.ko}`, color: '#fff' }}>
          열 때는 <b style={{ color: C.markField }}>숫자 4자리 PIN</b>
          <br />
          <span style={{ font: `600 25px/1.3 ${F.ko}`, color: C.onField2 }}>지원 휴대폰은 Face ID · Touch ID · 기기 잠금도</span>
        </span>
      </div>
    </>
  );
};

// ── 03 잠그는 법 ──────────────────────────────────────────────────────
// 단계 카드 셋이 목소리 「점」·「잠그기,」·「처음이면」에 하나씩 켜진다.
export const howT = () => ({ a: wordIn('how', 'v03', '점', 23.5), b: wordIn('how', 'v03', '잠그기,', 25), c: wordIn('how', 'v03', '처음이면', 27.5) });
export const How03: React.FC = () => {
  const f = useCurrentFrame();
  const t = howT();
  const steps = [
    { n: '1', big: '•••', small: '대화 옆 「더보기」 메뉴', at: t.a },
    { n: '2', big: 'Lock chat', small: '「대화 잠그기」 → 한 번 더 Lock chat으로 확인', at: t.b },
    { n: '3', big: 'PIN 4자리', small: '처음이면 만들기 — 두 번 입력', at: t.c },
  ];
  return (
    <>
      <HeadF left={HEAD} right="잠그는 법" />
      <Lines at={IN} size={84} top={L.TOP} lines={['잠그는 법,', <MarkF key="m" p={ramp(f, t.b, 12)}>세 번 누르고 PIN</MarkF>]} />
      {steps.map((s, i) => {
        const on = settle(f, s.at - 2, 16);
        return (
          <div
            key={s.n}
            style={{
              position: 'absolute',
              left: L.X,
              top: 760 + i * 172 + bob(f, i * 11, 3),
              width: CW,
              height: 152,
              boxSizing: 'border-box',
              padding: '0 28px',
              borderRadius: 26,
              background: '#fff',
              color: C.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              boxShadow: on > 0.5 ? `0 0 0 6px ${C.mark},0 26px 50px -28px rgba(4,12,36,.7)` : '0 26px 50px -28px rgba(4,12,36,.7)',
              opacity: interpolate(on, [0, 0.4], [0.25, 1], clamp),
              translate: `${(1 - on) * 50}px 0`,
            }}
          >
            <span style={{ flex: 'none', width: 70, height: 70, borderRadius: '50%', background: C.field, color: '#fff', display: 'grid', placeItems: 'center', font: `900 40px/1 ${F.ko}` }}>{s.n}</span>
            <div>
              <div style={{ font: `850 46px/1.1 ${F.ko}`, letterSpacing: '-.03em' }}>{s.big}</div>
              <div style={{ marginTop: 8, font: `600 26px/1.25 ${F.ko}`, color: C.muted }}>{s.small}</div>
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: L.X, top: 760 + 3 * 172 + 4, width: CW, font: `600 26px/1.35 ${F.ko}`, color: C.onField2, wordBreak: 'keep-all', ...fadeUp(f, t.a + 6, 12) }}>{MENU_NOTE}</div>
    </>
  );
};

// ── 04 다시 잠김 ──────────────────────────────────────────────────────
// 휴대폰 판: 1분 고리가 줄어들고 끝에 자물쇠(목소리 「일」에 시작). 웹 판: 「새로고침」·「닫으면」에 자물쇠.
export const relockT = () => ({ phone: wordIn('relock', 'v04', '나가거나', 34), min: wordIn('relock', 'v04', '일', 36), web: wordIn('relock', 'v04', '새로고침하거나', 38), close: wordIn('relock', 'v04', '닫으면', 39) });
export const Relock04: React.FC = () => {
  const f = useCurrentFrame();
  const t = relockT();
  const w = Math.floor((CW - 20) / 2);
  const ringP = interpolate(f, [t.min, t.min + 40], [1, 0], clamp);
  const phoneLock = ease(f, t.min + 40, 8);
  const webLock = ease(f, t.close + 6, 8);
  return (
    <>
      <HeadF left={HEAD} right={SRC} />
      <Lines at={IN} size={84} top={L.TOP} lines={['잠긴 대화를 나가면,', <MarkF key="m" p={ramp(f, wordIn('relock', 'v04', '다시', 40), 12)}>다시 잠겨요</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 760 + bob(f, 0, 4), width: w, height: 470, boxSizing: 'border-box', padding: 26, borderRadius: 28, background: '#fff', color: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)', ...fadeUp(f, IN, 26) }}>
        <div style={{ font: `800 34px/1.1 ${F.ko}` }}>휴대폰</div>
        <div style={{ position: 'relative', marginTop: 22, width: 190, height: 190, display: 'grid', placeItems: 'center' }}>
          <Ring size={190} stroke={14} progress={ringP} color={C.acc} track={C.hair} style={{ position: 'absolute', inset: 0 }} />
          {phoneLock > 0.05 ? (
            <div style={{ scale: String(0.6 + 0.4 * phoneLock), opacity: phoneLock }}>
              <Lock size={80} closed={phoneLock} />
            </div>
          ) : (
            <span style={{ font: `850 48px/1 ${F.mono}`, color: C.ink }}>{`0:${String(Math.ceil(ringP * 60)).padStart(2, '0')}`.replace('0:60', '1:00')}</span>
          )}
        </div>
        <div style={{ marginTop: 22, font: `650 25px/1.35 ${F.ko}`, color: C.muted, textAlign: 'center', ...fadeUp(f, t.phone, 12) }}>잠긴 대화를 나가거나<br />앱을 내려 두고 1분</div>
      </div>
      <div style={{ position: 'absolute', left: L.X + w + 20, top: 760 + bob(f, 13, 4), width: w, height: 470, boxSizing: 'border-box', padding: 26, borderRadius: 28, background: '#fff', color: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 30px 60px -30px rgba(4,12,36,.7)', ...fadeUp(f, t.web - 8, 26) }}>
        <div style={{ font: `800 34px/1.1 ${F.ko}` }}>웹</div>
        <div style={{ marginTop: 22, width: 230, height: 190, display: 'grid', placeItems: 'center', borderRadius: 18, background: '#f1f3f6', position: 'relative' }}>
          <svg width="96" height="96" viewBox="0 0 24 24" style={{ rotate: `${ease(f, t.web, 20) * 360}deg`, opacity: 1 - webLock }}>
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke={C.acc} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ position: 'absolute', opacity: webLock, scale: String(0.6 + 0.4 * webLock) }}>
            <Lock size={80} closed={webLock} />
          </div>
        </div>
        <div style={{ marginTop: 22, font: `650 25px/1.35 ${F.ko}`, color: C.muted, textAlign: 'center' }}>새로고침하거나<br />탭을 닫으면</div>
      </div>
    </>
  );
};

// ── 05 잠근 직후, 다른 화면 ────────────────────────────────────────────
// 열어 둔 다른 화면(노트북 그림)에 제목이 흐리게 남아 있다가 「새로고침하세요」에 사라진다.
export const refreshT = () => ({ other: wordIn('refresh', 'v05', '다른', 48), go: wordIn('refresh', 'v05', '새로고침.', 49), remain: wordIn('refresh', 'v05', '제목이', 51) });
export const Refresh05: React.FC = () => {
  const f = useCurrentFrame();
  const t = refreshT();
  const gone = ease(f, t.go + 8, 14);
  return (
    <>
      <HeadF left={HEAD} right={SRC} />
      <Lines at={IN} size={80} top={L.TOP} lines={['잠근 직후엔,', <MarkF key="m" p={ramp(f, t.go, 12)}>다른 화면도 새로고침</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 770 + bob(f, 5, 4), width: CW, ...fadeUp(f, IN, 26) }}>
        <div style={{ height: 420, borderRadius: '28px 28px 10px 10px', background: C.ink, padding: 18, boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, background: '#fff', display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 300, padding: '20px 16px', background: '#f4f5f7', boxSizing: 'border-box' }}>
              <div style={{ font: `700 20px/1 ${F.ko}`, color: C.muted, marginBottom: 14 }}>기록(다른 탭)</div>
              <div style={{ padding: '14px 14px', borderRadius: 12, background: `rgba(249,104,89,${0.18 * (1 - gone)})`, font: `750 24px/1.1 ${F.ko}`, color: C.ink, opacity: 1 - gone, boxShadow: f >= t.other && gone < 0.5 ? `0 0 0 3px ${C.crayon}` : 'none' }}>
                이직 고민 상담
              </div>
              {CHATS.slice(1).map((c) => (
                <div key={c} style={{ marginTop: 10, padding: '14px 14px', borderRadius: 12, background: '#fff', font: `700 22px/1.1 ${F.ko}`, color: C.muted, translate: `0 ${-gone * 58}px` }}>
                  {c}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <svg width="120" height="120" viewBox="0 0 24 24" style={{ rotate: `${ease(f, t.go, 22) * 360}deg` }}>
                <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke={C.acc} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div style={{ margin: '0 auto', width: CW + 40, marginLeft: -20, height: 26, borderRadius: '0 0 18px 18px', background: '#2a2d36' }} />
        <Stamp size={26} style={{ right: 24, top: 26, padding: '8px 12px' }}>
          예시 그림 · 실제 앱 화면 아님
        </Stamp>
      </div>
      <Verdict x={L.X} y={1268} w={CW} lead="잠근 직후, 열려 있던 화면엔" result="제목이 잠깐 남을 수 있어요" at={t.remain} ok={false} />
    </>
  );
};

// ── 06 잠가도 안 바뀌는 셋 ─────────────────────────────────────────────
// 「잠금은 숨기기」 → ✕ 카드 셋이 목소리 「암호화」·「보관」·「모델」에. B는 훅 질문의 답 도장.
export const mythT = () => ({ hide: wordIn('myth', 'v06', '숨기기예요.', 58), a: wordIn('myth', 'v06', '암호화', 60), b: wordIn('myth', 'v06', '보관', 62), c: wordIn('myth', 'v06', '모델', 63.5), mem: wordIn('myth', 'v06', '이미', 65) });
export const Myth06: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const t = mythT();
  const cards = [
    { big: '암호화 금고가 아니에요', small: 'end-to-end 암호화·따로 잠긴 보관함을 만들지 않아요', at: t.a },
    { big: '보관 기간 그대로', small: 'OpenAI가 대화를 보관하는 기간은 바뀌지 않아요', at: t.b },
    { big: '모델 개선 설정 · 이미 기억한 메모리 그대로', small: 'Improve the model for everyone(모델 개선) 설정을 따라요', at: t.c },
  ];
  return (
    <>
      <HeadF left={HEAD} right={SRC} />
      <Lines at={IN} size={84} top={L.TOP} lines={['잠금은', <MarkF key="m" p={ramp(f, t.hide, 12)}>숨기기예요</MarkF>]} />
      {cards.map((c, i) => {
        const s = settle(f, c.at - 4, 16);
        return (
          <div
            key={c.big}
            style={{
              position: 'absolute',
              left: L.X,
              top: 750 + i * 168 + bob(f, i * 9, 3),
              width: CW,
              height: 150,
              boxSizing: 'border-box',
              padding: '0 26px',
              borderRadius: 26,
              background: '#fff',
              color: C.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              boxShadow: '0 26px 50px -28px rgba(4,12,36,.7)',
              opacity: interpolate(s, [0, 0.4], [0.15, 1], clamp),
              translate: `${(1 - s) * 60}px 0`,
            }}
          >
            <Mark ok={false} at={c.at + 2} size={60} style={{ position: 'relative', flex: 'none' }} />
            <div>
              <div style={{ font: `850 ${i === 2 ? 36 : 42}px/1.15 ${F.ko}`, letterSpacing: '-.035em' }}>{c.big}</div>
              <div style={{ marginTop: 6, font: `600 24px/1.3 ${F.ko}`, color: C.muted }}>{c.small}</div>
            </div>
          </div>
        );
      })}
      {variant === 'B' ? (
        <div style={{ position: 'absolute', left: L.X, top: 1268, width: CW, boxSizing: 'border-box', padding: '18px 24px', borderRadius: 22, background: C.markField, color: C.ink, font: `800 32px/1.3 ${F.ko}`, letterSpacing: '-.03em', ...fadeUp(f, t.c + 8, 20) }}>
          학습에서도 빠질까? → ✕ 잠금과 상관없어요. 「모델 개선」 설정이 정해요
        </div>
      ) : (
        <div style={{ position: 'absolute', left: L.X, top: 1268, width: CW, font: `700 30px/1.3 ${F.ko}`, color: C.markField, ...fadeUp(f, t.c + 8, 16) }}>숨기는 거지, 지우거나 빼는 게 아니에요</div>
      )}
    </>
  );
};

// ── 07 경고 ───────────────────────────────────────────────────────────
// 빨간 판: 「재설정하면」에 → 「전부 삭제 · 되살릴 수 없음」, 「적어」에 노란 줄. 작은 글: PIN 바꾸기는 안 지워짐.
export const warnT = () => ({ reset: wordIn('warn', 'v07', '재설정하면,', 73), del: wordIn('warn', 'v07', '잠긴', 74.5), no: wordIn('warn', 'v07', '되살릴', 76), note: wordIn('warn', 'v07', '만들', 78) });
export const Warn07: React.FC = () => {
  const f = useCurrentFrame();
  const t = warnT();
  const shake = f >= t.del && f < t.del + 10 ? Math.sin((f - t.del) * 2.4) * 8 * (1 - (f - t.del) / 10) : 0;
  return (
    <>
      <HeadF left={HEAD} right={SRC} />
      <Lines at={IN} size={84} top={L.TOP} lines={['제일 중요한 것,', <MarkF key="m" p={ramp(f, t.reset, 12)}>PIN 재설정</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X + shake, top: 760 + bob(f, 3, 3), width: CW, boxSizing: 'border-box', padding: '32px 34px', borderRadius: 30, background: '#fff', color: C.ink, boxShadow: `0 0 0 6px ${C.crayon},0 30px 60px -30px rgba(4,12,36,.7)`, ...fadeUp(f, IN, 26) }}>
        <div style={{ font: `700 32px/1.3 ${F.ko}`, color: C.muted }}>PIN을 잊어서 재설정하면 <span style={{ color: C.crayon, opacity: interpolate(f, [IN + 6, IN + 12], [0, 1], clamp) }}>→</span></div>
        <div style={{ marginTop: 16, font: `900 58px/1.15 ${F.ko}`, letterSpacing: '-.04em', color: C.crayon, opacity: interpolate(f, [t.del - 2, t.del + 4], [0, 1], clamp) }}>잠긴 대화 전부 삭제</div>
        <div style={{ marginTop: 10, font: `800 40px/1.2 ${F.ko}`, letterSpacing: '-.03em', opacity: interpolate(f, [t.no - 2, t.no + 4], [0, 1], clamp) }}>되살릴 수 없어요</div>
        <div style={{ marginTop: 14, font: `700 28px/1.35 ${F.ko}`, color: C.muted, opacity: interpolate(f, [t.no + 6, t.no + 14], [0, 1], clamp) }}>고객 지원도 못 살려요</div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1150, width: CW, boxSizing: 'border-box', padding: '20px 26px', borderRadius: 22, background: C.markField, color: C.ink, font: `800 34px/1.3 ${F.ko}`, letterSpacing: '-.03em', ...fadeUp(f, t.note - 4, 20) }}>
        PIN은 만들 때 바로 적어 두기<span style={{ font: `650 24px/1.3 ${F.ko}` }}> · 비밀번호 관리 앱 등</span>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1262, width: CW, font: `650 26px/1.4 ${F.ko}`, color: C.onField2, wordBreak: 'keep-all', ...fadeUp(f, t.note - 2, 14) }}>
        PIN 바꾸기·잊기만으론 안 지워져요 — 잊고 재설정할 때
      </div>
    </>
  );
};

// ── 08 끝 ─────────────────────────────────────────────────────────────
export const End08: React.FC<{ variant: 'A' | 'B' }> = ({ variant }) => {
  const f = useCurrentFrame();
  const local = (abs: number) => abs - seq('end').from;
  const still = local(TOTAL - 18);
  const ff = Math.min(f, still);
  const press = interpolate(ff, [local(CUT) - 1, local(CUT) + 1, local(CUT) + 7], [1, 0.95, 1], clamp);
  const q = wordIn('end', 'v08', '여러분', 90);
  return (
    <>
      <HeadF left={HEAD} right="@synkbrief" />
      <Lines at={IN} size={80} top={L.TOP} lines={['무료 계정도', <MarkF key="m" p={ramp(ff, wordIn('end', 'v08', '차례로', 86), 12)}>차례로 열리는 중</MarkF>]} />
      <div style={{ position: 'absolute', left: L.X, top: 760, width: CW, display: 'flex', flexWrap: 'wrap', gap: 12, ...fadeUp(ff, IN + 2, 20) }}>
        {['Free', 'Go', 'Plus', 'Pro'].map((p, i) => (
          <span key={p} style={{ padding: '14px 22px', borderRadius: 16, background: '#fff', color: C.ink, font: `800 32px/1 ${F.ko}`, translate: `0 ${bob(ff, i * 10, 3)}px` }}>
            {p}
          </span>
        ))}
        <span style={{ alignSelf: 'center', font: `650 26px/1.3 ${F.ko}`, color: C.onField2 }}>· 메뉴에 없으면 아직 차례 전</span>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 880, width: CW, font: `750 40px/1.3 ${F.ko}`, color: '#fff', ...fadeUp(ff, wordIn('end', 'v08', '정리는', 88), 16) }}>
        정리는 <b style={{ color: C.markField }}>{variant === 'A' ? '캡션에' : '고정 댓글에'}</b>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1000, ...fadeUp(ff, q - 4) }}>
        <div style={{ display: 'inline-block', padding: '22px 34px', borderRadius: 999, background: '#fff', color: C.ink, font: `800 44px/1.1 ${F.ko}`, letterSpacing: '-.035em', boxShadow: '0 22px 44px -22px rgba(4,12,36,.6)', scale: String(press), transformOrigin: '50% 50%' }}>
          여러분 메뉴에도 떴어요?
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.X, top: 1116, font: `600 32px/1.3 ${F.ko}`, color: C.onField, ...fadeUp(ff, q + 14) }}>
        댓글로 <b style={{ color: C.markField }}>떴다 O · 아직 X</b>
      </div>
      <div style={{ position: 'absolute', left: L.X, right: L.R, top: 1290, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...fadeUp(ff, IN + 6) }}>
        <span style={{ display: 'inline-flex', padding: '12px 18px', borderRadius: 16, background: '#fff' }}>
          <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, display: 'block' }} />
        </span>
        <span style={{ font: `500 24px/1.2 ${F.ko}`, color: C.onField2 }}>{SRC} 기준</span>
      </div>
    </>
  );
};

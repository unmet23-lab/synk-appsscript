// 시안 A 「확인서」 — 앱이 매시간 보호 확인서 한 장을 찍어 준다.
// 뼈대: 왼쪽 흰 면 = 지금 무슨 일인지 한 문장 + 할 일, 오른쪽 회색 책상 = 그 증거(종이 한 장).
// 흐름 화면도 같은 뼈대 — 고를 것 · 대조할 것은 늘 종이에 찍혀 나온다.
// 포인트 색은 한 화면에 한 자리(도장 하나, 또는 그래프 막대 하나). 숫자 · 글이 든 종이는 기울이지 않는다(뒷장만 기운다).
import { D, NOTIFY, DRAWER, SCREENS, TELEMETRY, josa } from './copy.mjs';
import { ICON, MARK } from './shell.mjs';

export const name = '업무 백업 0.7.0 · 시안 A 확인서';

export const css = `
:root{
  --paper:#fff;--table:#ededee;--ink:#0b0b0c;--ink-2:#4a4a50;--ink-3:#5f5f66;--ink-4:#8a8a91;
  --line:#e2e2e6;--rule:#cdcdd3;--fill:#f4f4f5;
  --ok:#7db45a;--ok-ink:#3f6b2e;--warn:#f5c445;--warn-ink:#7e5a10;--bad:#f96859;--bad-ink:#ae322a;
  --sans:"SYNK Sans",system-ui,"Segoe UI","Malgun Gothic",sans-serif;
  --num:"Inter Tight","SYNK Sans",system-ui,sans-serif;
  --ease:cubic-bezier(.16,1,.3,1);
  --zz:9px;
}
body{background:var(--paper);color:var(--ink)}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:6px}

/* ── 뼈대: 펼친 두 쪽 ─────────────────────────── */
.sp{display:grid;grid-template-columns:minmax(560px,46fr) 54fr;grid-template-rows:auto 1fr;min-height:100vh;position:relative}
.top{grid-column:1/-1;grid-row:1;display:flex;align-items:center;justify-content:space-between;height:72px;padding:0 40px;position:relative;z-index:3}
.top::after{content:"";position:absolute;inset:0 0 0 max(560px,46%);background:var(--table);z-index:-1}
.brand{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:700}
.brand .mark{height:17px}
.brand .bar{width:1px;height:16px;background:var(--rule)}
.top-r{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-3)}
.tbtn{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 15px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink);background:var(--paper);box-shadow:inset 0 0 0 1px #c6c6cc}
.tbtn:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.flowname{display:flex;align-items:center;gap:14px;font-size:15px;font-weight:700}
.flowname .step{font-family:var(--num);font-weight:500;color:var(--ink-3);font-size:15px}
.seg4{display:inline-flex;gap:4px}
.seg4 i{width:18px;height:3px;border-radius:2px;background:var(--rule)}
.seg4 i.on{background:var(--ink)}

.l{grid-column:1;grid-row:1/-1;display:flex;flex-direction:column;justify-content:center;gap:40px;padding:120px 56px 96px 72px;position:relative}
.r{grid-column:2;grid-row:1/-1;background:var(--table);display:grid;place-items:center;padding:104px 48px 64px;position:relative;overflow:hidden}
.foot{position:absolute;left:72px;right:56px;bottom:32px;font-size:13px;color:var(--ink-3)}
/* 넓은 창 — 오른쪽 종이가 창보다 길어도(다시 깔 것 목록 · 복구 코드) 왼쪽 글과 할 일은 창 안에 붙어 있게 한다 */
@media (min-width:901px){
  .l{position:sticky;top:0;align-self:start;min-height:100vh}
}
/* 실제 앱 창(기본 1080 × 820)처럼 낮은 창 — 위아래 여백과 제목을 줄여 주 행동이 첫 화면에 들게 한다 */
@media (min-width:901px) and (max-height:860px){
  .l{padding-top:92px;padding-bottom:64px;gap:28px}
  .l:has(>.foot){padding-bottom:100px}
  .kick{margin-bottom:12px}
  h1{font-size:48px}
  h1.m{font-size:38px}
  .sub{margin-top:14px;font-size:18px}
}

.kick{font-size:15px;font-weight:600;color:var(--ink-3);margin-bottom:18px}
h1{font-size:56px;line-height:1.14;font-weight:600;letter-spacing:-.01em}
h1 .soft{color:var(--ink-4)}
h1.m{font-size:44px;line-height:1.18}
.sub{margin-top:20px;font-size:20px;line-height:1.55;color:var(--ink-2);max-width:30em}
.sub b{color:var(--ink);font-weight:600}
.notes{display:grid;gap:12px;max-width:33em}
.note{position:relative;padding-left:17px;font-size:15px;line-height:1.55;color:var(--ink-2)}
.note::before{content:"";position:absolute;left:0;top:10px;width:5px;height:5px;border-radius:50%;background:var(--ink-4)}
.note b{color:var(--ink);font-weight:600}
.fine{font-size:13px;line-height:1.55;color:var(--ink-3);max-width:33em}
.box{border-top:1px solid var(--ink);padding-top:16px;max-width:33em;font-size:15px;line-height:1.55;color:var(--ink-2)}
.box b{display:block;color:var(--ink);font-weight:600;margin-bottom:2px}

.act{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px}
.act .hint{flex-basis:100%;font-size:13px;color:var(--ink-3);margin-top:2px}
.act .alt{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:6px;font-size:15px;color:var(--ink-3)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 26px;border-radius:999px;font-size:15px;font-weight:600;white-space:nowrap;transition:transform .2s var(--ease),background .2s,box-shadow .2s}
.btn:active{transform:scale(.97)}
.btn-solid{background:var(--ink);color:#fff}
.btn-solid:hover{background:#2b2b2f}
.btn-line{box-shadow:inset 0 0 0 1px #c6c6cc;color:var(--ink)}
.btn-line:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.lnk{display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:var(--ink);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px;text-decoration-color:#b5b5bb}
.lnk:hover{text-decoration-color:currentColor}
.lnk .la{width:24px}
.pbar{height:4px;background:#e3e3e7;border-radius:2px;max-width:420px;margin-top:22px;overflow:hidden}
.pbar i{display:block;height:100%;background:var(--ink);border-radius:2px}

/* ── 종이: 확인서(톱니 아래 끝) · 낱장 ─────────── */
.stage{position:relative;display:grid;place-items:center;width:100%}
.stack{position:relative;filter:drop-shadow(0 1px 0 rgba(0,0,0,.05)) drop-shadow(0 22px 24px rgba(0,0,0,.12));animation:print .7s var(--ease) both}
.zz{-webkit-mask:linear-gradient(#000 0 0) top/100% calc(100% - var(--zz)) no-repeat,conic-gradient(from -45deg at 50% 100%,#000 90deg,#0000 0) bottom/calc(var(--zz)*2) var(--zz) repeat-x;mask:linear-gradient(#000 0 0) top/100% calc(100% - var(--zz)) no-repeat,conic-gradient(from -45deg at 50% 100%,#000 90deg,#0000 0) bottom/calc(var(--zz)*2) var(--zz) repeat-x}
.ghost{position:absolute;inset:0;background:#f8f8f9}
.ghost.g1{transform:translate(12px,-14px) rotate(2.8deg);background:#f6f6f7}
.ghost.g2{transform:translate(-10px,-26px) rotate(-3.6deg);background:#f2f2f3}
.rc{position:relative;width:392px;background:#fff;padding:28px 32px 40px;font-size:15px}
.rc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.rc-h h2{font-size:22px;line-height:1.3;font-weight:700}
.rc-h .mark{height:14px;margin-top:6px;color:var(--ink)}
.rc-s{font-size:13px;color:var(--ink-3);margin-top:4px}
.hr{height:0;border-top:1.5px dashed var(--rule);margin:16px 0}
.row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;line-height:1.5;padding:3px 0}
.row>span:first-child{color:var(--ink-3)}
.row>b{font-weight:600;text-align:right}
.row.sm{font-size:13px;padding:2px 0 2px 14px}
.row.sm>span:first-child{color:var(--ink-2)}
.row.sm>b{font-weight:500}
.row.sm>b.x{font-weight:700;color:var(--ink)}
.row.tot{border-top:1px solid var(--line);margin-top:8px;padding-top:9px}
.row.tot>span:first-child{color:var(--ink)}
.row .bad{color:var(--bad-ink)}
.pf-k{color:var(--ink-3)}
.pf-d{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:22px;font-weight:700;line-height:1.3;margin-top:2px}
.pf-d em{font-style:normal;font-size:15px;font-weight:600}
.pf-t{font-size:13px;line-height:1.6;color:var(--ink-2);margin-top:8px;max-width:26em}
.rc-e{font-size:13px;color:var(--ink-3)}
.rc-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:18px}
.stamp{display:block;flex:none;width:104px;height:104px;margin:-12px -10px -10px 0;transform:rotate(-14deg);opacity:.9;mix-blend-mode:multiply;animation:stamp .5s .45s var(--ease) both}
.stamp.ok{color:var(--ok-ink)}.stamp.warn{color:var(--warn-ink)}.stamp.bad{color:var(--bad-ink)}
.stamp.off{color:var(--ink-3);opacity:1;mix-blend-mode:normal}
.stamp.off circle[stroke]{stroke-dasharray:3 4}
.stamp text{fill:currentColor;font-family:var(--sans)}
.stamp .n{font-family:var(--num)}
.slot{flex:none;width:88px;height:88px;border-radius:50%;border:1.5px dashed var(--rule);margin:-8px -2px -6px 0}
.sheet{position:relative;width:min(560px,100%);background:#fff;padding:34px 36px 36px;box-shadow:0 1px 0 rgba(0,0,0,.05),0 22px 40px -18px rgba(0,0,0,.22);animation:print .7s var(--ease) both}
.sheet.wide{width:min(620px,100%)}
.sheet h2{font-size:22px;font-weight:700;line-height:1.3}
.sheet .meta{font-size:13px;color:var(--ink-3);margin-top:4px}
@keyframes print{from{opacity:0;transform:translateY(26px)}to{opacity:1}}
@keyframes stamp{0%{opacity:0;transform:rotate(-14deg) scale(1.35)}60%{opacity:.95;transform:rotate(-14deg) scale(.96)}100%{opacity:.9;transform:rotate(-14deg) scale(1)}}

/* 지금 찍히는 장(예약 백업 도는 중) — 뒤에 지난 장의 머리만 보인다 */
.stack.run{padding-top:56px}
.slip{position:absolute;top:0;left:12px;right:-12px;height:180px;background:#f6f6f7;padding:16px 26px;display:flex;align-items:baseline;justify-content:space-between;gap:12px;transform:rotate(1.6deg)}
.slip b{font-size:15px;font-weight:700}
.slip span{font-size:13px;color:var(--ink-3)}
.pbar.in{max-width:none;margin:8px 0 10px}

/* 낱장 안의 줄 */
.li{display:grid;grid-template-columns:28px 1fr auto;align-items:start;gap:4px 14px;padding:14px 0;border-top:1px solid var(--line)}
.li:first-of-type{border-top:0}
.li .nm{font-size:17px;font-weight:600;line-height:1.4}
.li .ds{grid-column:2;font-size:13px;color:var(--ink-3);line-height:1.5}
.li .vl{grid-row:span 2;font-size:15px;font-weight:600;text-align:right;line-height:1.4;white-space:nowrap}
.li .vl small{display:block;font-size:13px;font-weight:400;color:var(--ink-3)}
.cb{width:22px;height:22px;border-radius:6px;background:var(--ink);color:#fff;display:grid;place-items:center;margin-top:1px}
.cb .ic{width:16px;height:16px;stroke-width:2.2}
.cb.off{background:#fff;box-shadow:inset 0 0 0 1.5px #b9b9bf}
.od{margin-top:18px;padding:14px 16px;background:var(--fill);font-size:13px;line-height:1.55;color:var(--ink-2)}
.od b{color:var(--ink)}
.quota{margin-top:22px}
.quota-h{display:flex;justify-content:space-between;font-size:13px;color:var(--ink-3);margin-bottom:8px}
.quota-h b{color:var(--ink);font-weight:600}
.hatch{height:14px;background:var(--fill);border:1px solid #c9c9cf;position:relative}
.hatch i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--ink) 0 1.4px,transparent 1.4px 5px);border-right:2px solid var(--ink)}

/* 보호 범위 낱장(첫 시작 2) */
.sheet.scope .rc-h .mark{height:14px}
.frs{margin-top:12px}
.fr{display:grid;grid-template-columns:22px minmax(0,1fr) 112px 78px;gap:14px;align-items:center;padding:13px 0;border-top:1px solid var(--line)}
.fr:first-child{border-top:0}
.fr .tick{color:var(--ink);display:grid}
.fr .tick .ic{width:20px;height:20px;stroke-width:2.2}
.fr .nm{font-size:17px;font-weight:600;line-height:1.35}
.fr .ds{font-size:13px;color:var(--ink-3);overflow-wrap:anywhere}
.fr .sz{text-align:right;font-size:13px;color:var(--ink-3);line-height:1.4}
.fr .sz b{display:block;font-size:15px;font-weight:600;color:var(--ink)}
.share{display:block;height:8px;border:1px solid #c9c9cf;position:relative;background:var(--fill)}
.share i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--ink) 0 1.2px,transparent 1.2px 4.5px);border-right:2px solid var(--ink)}
.addrow{display:flex;align-items:center;gap:10px;width:100%;margin-top:6px;padding:11px 14px;border:1.5px dashed var(--rule);border-radius:8px;font-size:15px;font-weight:600;color:var(--ink)}
.addrow span{font-family:var(--num);font-size:20px;line-height:1;font-weight:400}
.addrow:hover{border-color:var(--ink)}

/* 고르는 종이 둘(옮겨 오기 1) — 고른 장이 들려 있다 */
.opts{display:grid;gap:18px;width:min(540px,100%)}
.opt{position:relative;display:block;background:#fff;padding:22px 26px 20px;box-shadow:0 1px 0 rgba(0,0,0,.05),0 14px 28px -18px rgba(0,0,0,.25);transition:box-shadow .3s}
.opt.on{box-shadow:0 0 0 2px var(--ink)}
.opt .oh{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.opt h3{font-size:22px;font-weight:700;line-height:1.3}
.opt .pick{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;box-shadow:inset 0 0 0 1.5px #b9b9bf;align-self:center}
.opt.on .pick{background:var(--ink);color:#fff;box-shadow:none}
.opt .pick .ic{width:15px;height:15px;stroke-width:2.4}
.opt p{font-size:15px;line-height:1.55;color:var(--ink-2);margin-top:6px}
.map{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:5px 10px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);font-size:13px;line-height:1.45;color:var(--ink-2)}
.map i{font-style:normal;color:var(--ink-3)}
.map span:nth-child(3n){color:var(--ink);font-weight:500}

/* 단계(분실 신고 · 첫 백업 · 되돌리기) */
.st{display:grid;grid-template-columns:34px 1fr;gap:4px 14px;padding:16px 0;border-top:1px solid var(--line)}
.st:first-of-type{border-top:0;padding-top:6px}
.st .k{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--num);font-size:13px;font-weight:600;box-shadow:inset 0 0 0 1.5px #b9b9bf;color:var(--ink-2)}
.st.done .k{background:var(--ink);color:#fff;box-shadow:none}
.st.now .k{box-shadow:inset 0 0 0 1.5px var(--ink);color:var(--ink)}
.st .k .ic{width:16px;height:16px;stroke-width:2.2}
.st h3{font-size:17px;font-weight:600;line-height:1.45}
.st p{grid-column:2;font-size:13px;line-height:1.55;color:var(--ink-3)}
.lk{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:6px}
.st .lk{grid-column:2}
.lk .lnk{font-size:13px;gap:6px}
.lk .ic{width:15px;height:15px}

/* 되살리기 찾기 */
.find{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-radius:999px;box-shadow:inset 0 0 0 1px #c6c6cc;margin:18px 0 6px}
.find .ic{color:var(--ink-3)}
.find span{font-size:15px}
.find em{margin-left:auto;font-style:normal;font-size:13px;color:var(--ink-3)}
.fl{display:grid;grid-template-columns:28px 1fr auto;gap:2px 14px;align-items:start;padding:13px 0;border-top:1px solid var(--line)}
.fl:first-of-type{border-top:0}
.fl .nm{font-size:15px;font-weight:600;line-height:1.45}
.fl .ds{grid-column:2;font-size:13px;color:var(--ink-3)}
.fl .vl{font-family:var(--num);font-size:13px;color:var(--ink-2);text-align:right;white-space:nowrap;line-height:1.7;grid-row:span 2}
.fl .vl span{display:block}
.selbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding-top:14px;border-top:1.5px solid var(--ink);font-size:15px}
.selbar b{font-weight:600}
.selbar span+span{font-size:13px;color:var(--ink-3)}
.selbar{flex-wrap:wrap;row-gap:6px}
.selbar>span:first-child{white-space:nowrap}
.selbar .lnk{font-size:13px;margin-left:12px;white-space:nowrap}
.selbar span+span b{color:var(--ink);font-weight:600}

/* 되돌리기 그래프(빗금 막대 · 0부터 세는 양) */
.chart{margin-top:34px}
.bars{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));align-items:end;gap:5px;height:190px;border-bottom:1px solid var(--ink);position:relative}
.bars .b{position:relative;background:repeating-linear-gradient(-45deg,#9a9aa0 0 1.2px,transparent 1.2px 4.5px);border-top:1.5px solid #6f6f76;min-height:2px}
.bars .b.hot{background:repeating-linear-gradient(-45deg,var(--bad-ink) 0 1.4px,transparent 1.4px 4.5px);border-top:2px solid var(--bad-ink)}
.bars .b.z{background:none;border-top:1.5px solid #c9c9cf}
.bars .v{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);font-family:var(--num);font-size:13px;font-weight:600;color:var(--bad-ink);white-space:nowrap}
.bars .v.side{bottom:auto;top:-2px;left:calc(100% + 5px);transform:none}
.bars .pick{position:absolute;top:-6px;bottom:-8px;width:0;border-left:2px solid var(--ink)}
.bars .pick span{position:absolute;top:40%;right:8px;font-size:13px;font-weight:700;white-space:nowrap}
.ticks{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));gap:5px;margin-top:8px;font-family:var(--num);font-size:13px;color:var(--ink-3)}
.ticks span{visibility:hidden;justify-self:center;white-space:nowrap}
.ticks span.s{visibility:visible}
.ticks span.d{visibility:visible;justify-self:start;color:var(--ink);font-weight:600}
.ticks span.e{justify-self:end}
.legend{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:16px;font-size:13px;color:var(--ink-3);line-height:1.55}
.legend b{color:var(--ink);font-weight:600;white-space:nowrap}
.why{font-size:13px;line-height:1.55;color:var(--ink-3);margin-top:6px}

/* 복구 코드 종이 */
.code{width:min(540px,100%);background:#fff;padding:40px 44px 36px;box-shadow:0 1px 0 rgba(0,0,0,.05),0 26px 44px -20px rgba(0,0,0,.24);animation:print .7s var(--ease) both;position:relative}
.code .ttl{display:flex;justify-content:space-between;align-items:flex-start}
.code .ttl h2{font-size:22px;font-weight:700}
.code .ttl .mark{height:16px}
.code .meta{font-size:13px;color:var(--ink-3);margin-top:6px;line-height:1.6}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 0;margin:26px 0 22px;padding:22px 0;border-top:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink)}
.cg span{font-family:var(--num);font-size:20px;font-weight:600;letter-spacing:.12em;text-align:center}
/* 복구 코드는 화면에 늘 드러내지 않는다(화면 공유 · 어깨 너머) — 인쇄 · USB 저장 때만 글자를 싣고, 화면은 가린 견본 + 줄 번호 */
.cg{grid-template-columns:22px repeat(4,1fr)}
.cg i{font-style:normal;font-family:var(--num);font-size:11px;font-weight:500;color:var(--ink-3);align-self:center}
.cg.hide span{filter:blur(5px);user-select:none}
.cg-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:22px;font-size:13px;color:var(--ink-3)}
.cg-h .lnk{font-size:13px;white-space:nowrap}
.cg-h+.cg{margin-top:10px}
/* 고르는 종이 아래 남은 공간 한 줄 · 낱장 머리의 인쇄 */
.room{font-size:13px;color:var(--ink-2);margin-top:-4px}
.sh-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.sh-h .lnk{font-size:13px;gap:6px}
.sh-h .ic{width:16px;height:16px}
.code .use{font-size:13px;line-height:1.6;color:var(--ink-2)}
.code .use b{color:var(--ink)}
.code .cut{margin-top:22px;border-top:1.5px dashed var(--rule);padding-top:10px;font-size:13px;color:var(--ink-3)}

/* 알림 판 */
.toasts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;width:100%;max-width:760px}
.tw{display:flex;flex-direction:column;gap:8px}
.toast{background:#fbfbfb;border-radius:8px;padding:12px 14px 14px;box-shadow:0 0 0 1px rgba(0,0,0,.07),0 8px 20px -8px rgba(0,0,0,.18);font-family:"Segoe UI Variable","Segoe UI","SYNK Sans",sans-serif}
.toast .app{display:flex;align-items:center;gap:8px;font-size:12px;color:#5c5c62;margin-bottom:8px}
.toast .app i{width:16px;height:16px;border-radius:4px;background:var(--ink);display:grid;place-items:center}
.toast .app i svg{width:10px;height:auto;fill:#fff}
.toast h4{margin:0;font-size:14px;font-weight:600;line-height:1.4;color:#1b1b1f}
.toast p{font-size:13px;line-height:1.45;color:#45454b;margin-top:2px}
.toast .tb{margin-top:10px;height:32px;border-radius:4px;background:#ececee;display:grid;place-items:center;font-size:13px;font-weight:600;color:#1b1b1f}
.tw .when{font-size:13px;color:var(--ink-3);padding-left:2px}
.tw .when b{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:1px;background:#a3a3a9}
.tw .when b.ok{background:var(--ok)}.tw .when b.warn{background:var(--warn)}.tw .when b.bad{background:var(--bad)}

/* 설정 서랍 */
.dim{position:fixed;inset:0;background:rgba(10,10,12,.32);z-index:5}
.drawer{position:fixed;top:0;right:0;bottom:0;width:520px;background:#fff;z-index:6;overflow:auto;padding:28px 36px 40px;box-shadow:-30px 0 60px -30px rgba(0,0,0,.35);animation:slide .5s var(--ease) both}
@keyframes slide{from{transform:translateX(40px);opacity:0}}
.drawer .dh{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.drawer .dh h2{font-size:34px;font-weight:600}
.drawer .who{font-size:13px;color:var(--ink-3);margin-bottom:28px}
.dg{margin-top:26px}
.dg h3{font-size:13px;font-weight:600;color:var(--ink-3);padding-bottom:8px;border-bottom:1px solid var(--ink)}
.dr{display:grid;grid-template-columns:1fr auto;gap:2px 16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.dr .nm{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.dr .nm i{width:7px;height:7px;border-radius:50%;background:var(--warn)}
.dr .vl{grid-column:1;font-size:13px;color:var(--ink-3);line-height:1.5}
.dr .lnk{grid-row:1/3;grid-column:2;font-size:13px}

/* 웹(메일 링크) */
.web{position:relative;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#fff}
.web .wl{padding:56px 72px;display:flex;flex-direction:column;justify-content:center;gap:32px}
.web .wr{background:var(--table);display:grid;place-items:center;padding:48px}
.web .wtop{position:absolute;top:28px;left:72px;display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}
.dev{width:min(400px,100%)}
.dev .rc{width:100%}

/* ── 좁은 창(390) ─────────────────────────── */
@media (max-width:900px){
  .sp{grid-template-columns:1fr;grid-template-rows:auto}
  .top{grid-row:auto;height:60px;padding:0 16px 0 20px;background:#fff}
  .top::after{display:none}
  .top-r .acct{display:none}
  .flowname{gap:10px;font-size:15px}
  .l{grid-column:1;grid-row:auto;padding:22px 20px 28px;gap:22px;justify-content:flex-start}
  .r{grid-column:1;grid-row:auto;padding:28px 16px 48px}
  .ghost{display:none}
  .home .rc .row.sm,.home .rc .row.fd{display:none}
  .home .rc .row.tot{border-top:0;margin-top:0;padding-top:3px}
  .flow .l>.foot{order:15;padding:0 20px 16px}
  .fr{grid-template-columns:22px minmax(0,1fr) auto;gap:6px 12px}
  .fr .share{grid-column:2/-1;grid-row:2}
  .foot{position:static;padding:0;font-size:13px}
  h1{font-size:34px;line-height:1.2;letter-spacing:0}
  h1.m{font-size:30px}
  .sub{font-size:17px;margin-top:14px}
  .kick{margin-bottom:12px}
  .flow .l{display:contents}
  .flow .l>.lt{padding:22px 20px 0}
  .flow .l>.lx{padding:14px 20px 8px}
  .flow .act{position:sticky;bottom:0;z-index:4;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);margin:0;padding:12px 20px 16px;border-top:1px solid var(--line);order:20}
  .flow .act .btn{flex:1 1 100%}
  .flow .act .alt{font-size:13px}
  .flow .r{order:10}
  .rc{width:min(360px,calc(100vw - 48px));padding:26px 24px 38px}
  .stamp{width:94px;height:94px}
  .ghost.g1{transform:translate(6px,-10px) rotate(2deg)}
  .ghost.g2{transform:translate(-4px,-18px) rotate(-2.4deg)}
  .slip{left:6px;right:-6px}
  .sheet,.code{padding:26px 22px 26px}
  .opts{gap:16px}
  .opt{padding:20px 20px 18px}
  .opt h3{font-size:19px}
  .cg span{font-size:16px;letter-spacing:.08em}
  .toasts{grid-template-columns:1fr}
  .drawer{width:100%;padding:20px 20px 32px}
  .drawer .dh h2{font-size:28px}
  .web{grid-template-columns:1fr}
  .web .wl{padding:84px 20px 28px;gap:26px}
  .web .wtop{left:20px;top:24px}
  .web .wr{padding:32px 16px 48px}
  .fl{grid-template-columns:28px 1fr}
  .fl .vl{grid-column:2;grid-row:auto;text-align:left;white-space:normal;line-height:1.5}
  .fl .vl span{display:inline}
  .fl .vl span+span::before{content:" · "}
  .selbar{flex-direction:column;align-items:flex-start;gap:4px}
  .bars{gap:2px;height:150px}
  .ticks{gap:2px}
  .ticks span.s{visibility:hidden}
  .legend{flex-direction:column;gap:6px}
}
/* 휴대폰 폭 — 흐름 이름은 한 줄(넘치면 말줄임), 「1 / 4」 숫자는 빼고 네 칸 줄만(Fable F11) */
@media (max-width:480px){
  .flowname{min-width:0}
  .flowname>span:not([class]){white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .flowname .step{display:none}
  .seg4{flex:none}
}
body.is-full .flow .act{position:static}
`;

/* ── 조각 ─────────────────────────────────────── */
let stampN = 0;
// 도장: 위 호 · 아래 호에 글(글자 사이는 그대로), 가운데 한 낱말 + 날짜
const stamp = (word, tone = 'ok', date = '11.13', ring = ['업무 백업', '보호 확인']) => {
  const n = ++stampN;
  return `
<svg class="stamp ${tone}" viewBox="0 0 120 120" aria-hidden="true">
  <defs><path id="st${n}a" d="M17 60A43 43 0 0 1 103 60"/><path id="st${n}b" d="M8 60A52 52 0 0 0 112 60"/>
    <filter id="ink${n}" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${n * 7}" result="g"/><feDisplacementMap in="SourceGraphic" in2="g" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${n * 13}" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.68" result="a"/><feComposite in="d" in2="a" operator="in"/></filter></defs>
  <g filter="url(#ink${n})">
  <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" stroke-width="2.6"/>
  <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="9.5" cy="60" r="1.8" fill="currentColor"/><circle cx="110.5" cy="60" r="1.8" fill="currentColor"/>
  <text font-size="11" font-weight="700" letter-spacing="1.6"><textPath href="#st${n}a" startOffset="50%" text-anchor="middle">${ring[0]}</textPath></text>
  <text font-size="11" font-weight="700" letter-spacing="1.6"><textPath href="#st${n}b" startOffset="50%" text-anchor="middle">${ring[1]}</textPath></text>
  <text x="60" y="${date ? 63 : 67}" text-anchor="middle" font-size="${word.length > 2 ? 16 : 20}" font-weight="800">${word}</text>
  ${date ? `<text class="n" x="60" y="79" text-anchor="middle" font-size="10.5" font-weight="600">${date}</text>` : ''}
  </g>
</svg>`;
};

const row = (k, v, cls = '') => `<div class="row ${cls}"><span>${k}</span><b class="num">${v}</b></div>`;
const pp = (w, pair) => josa(w, pair).slice(w.length); // 조사만
const paren = (s) => s.replace(/ ([월화수목금토일])$/, '($1)'); // '11월 17일 화' → '11월 17일(화)'
const notes = (list) => `<div class="notes">${list.map((t) => `<p class="note">${t}</p>`).join('')}</div>`;
// 기본 화면의 할 일 — 늘 쓰는 「파일 되살리기」는 채운 알약, 드문 「새 PC로 옮겨 오기」는 밑줄 글자.
// 백업하는 이 PC에서는 옮겨 오기를 돌리지 않으므로(설계 4.6) 「새 PC에서 할 일」 안내(move-0)를 연다
const ACT = `<button class="btn btn-solid" type="button">파일 되살리기</button><a class="lnk" href="#move-0">새 PC로 옮겨 오기 ${ICON.rarr}</a>`;

function top({ flow, step, total, right = true, back = true, extra = '' } = {}) {
  if (!flow) {
    return `<header class="top"><div class="brand">${MARK}<span class="bar"></span><span>${D.app}</span></div>
      <div class="top-r">${extra}${right ? '<button class="tbtn" type="button">설정</button>' : ''}</div></header>`;
  }
  return `<header class="top">
    <div class="flowname">${back ? '<button class="tbtn" type="button">뒤로</button>' : ''}<span>${flow}</span>${step ? `<span class="step">${step} / ${total}</span><span class="seg4" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>
    ${right ? '<div class="top-r"><button class="tbtn" type="button">닫기</button></div>' : ''}</header>`;
}

// 펼친 두 쪽. home이면 좁은 창에서 할 일이 종이보다 먼저, 흐름이면 아래 붙는 막대.
function sp({ cls = 'home', head, kick, h1, h1Cls = '', sub, more = '', act = '', foot = '', right }) {
  return `<div class="sp ${cls}">${head}
  <div class="l">
    <div class="lt">${kick ? `<p class="kick">${kick}</p>` : ''}<h1 class="${h1Cls}">${h1}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    ${more ? `<div class="lx">${more}</div>` : ''}
    ${act ? `<div class="act">${act}</div>` : ''}
    ${foot ? `<p class="foot">${foot}</p>` : ''}
  </div>
  <div class="r"><div class="stage">${right}</div></div>
</div>`;
}

function receipt({ title = '보호 확인서', sub = `${D.device} · ${D.todayDots}`, body, st = '', end = '', ghosts = true, cls = '' }) {
  return `<div class="stack ${cls}">
    ${ghosts ? '<div class="ghost g2"></div><div class="ghost g1"></div>' : ''}
    <article class="rc" aria-label="${title}">
      <div class="rc-h"><h2>${title}</h2>${MARK}</div>
      <p class="rc-s num">${sub}</p>
      ${body}
      ${end || st ? `<div class="rc-foot">${end ? `<p class="rc-e">${end}</p>` : '<span></span>'}${st}</div>` : ''}
    </article></div>`;
}

// 기본 화면의 확인서 — 상태 도장은 늘 끝에, 되살려 본 줄에는 결과(모두 같음)만
// 도장 낱말은 넷으로 고정(Fable F6 — 「확인」 도장은 「확인함 · 이상 없음」으로 읽힌다): 안전 · 주의 · 경고 · 옮김.
// 테두리 글은 9.5px라 안 읽히므로 늘 「업무 백업 · 보호 확인」이고, 뜻은 확인서 줄에 둔다(F16)
const HOME_STAMP = {
  ok: () => stamp('안전'),
  partial: () => stamp('안전'),
  missing: () => stamp('주의', 'warn'),
  mass: () => stamp('경고', 'bad'),
  moved: () => stamp('옮김', 'warn'),
};
function homeReceipt(state = 'ok') {
  const m = D.mass;
  const ms = D.missing;
  const head = state === 'moved'
    ? row('마지막 확인', D.last.ko) + row('이어 받은 기기', `${D.moved.to} · ${D.moved.timeKo}`)
    : row('마지막 확인', state === 'missing' ? `${D.last.ko} · 세 곳` : D.last.ko) + row('다음 확인', D.next.ko);
  const folders = D.folders.map((f) => {
    if (state === 'missing' && f.name === ms.name) return `<div class="row sm"><span>${f.name}</span><b class="x">찾을 수 없음</b></div>`;
    if (state === 'mass' && f.name === m.folder) return `<div class="row sm"><span>${f.name}</span><b class="num x">${m.docLeft}개 · −${m.count}</b></div>`;
    return row(f.name, `${f.files}개`, 'sm');
  }).join('');
  const total = state === 'missing' ? `${ms.restFiles}개 · ${ms.restSize}` : state === 'mass' ? `${m.totalNow}개 · ${m.sizeNow}` : `${D.total.files}개 · ${D.total.size}`;
  const extra = {
    partial: row('쓰는 중이라 앞 판으로', `${D.partial.count}개 · ${D.partial.keptKo}`),
    missing: row('붙들어 둔 판', ms.keptKo),
    mass: row('지우기 전 판', `${m.totalBefore}개 · 붙들어 둠`),
  }[state];
  return receipt({
    st: HOME_STAMP[state](),
    end: state === 'moved' ? '이 PC의 마지막 확인서' : '매시간 새로 찍힙니다',
    body: `
    <div class="hr"></div>
    ${head}
    <div class="hr"></div>
    ${row('지키는 폴더', D.total.folders, 'fd')}
    ${folders}
    ${row(state === 'missing' ? '세 곳 합계' : '네 곳 합계', total, 'tot')}
    ${extra ? `<div class="hr"></div>${extra}` : ''}
    <div class="hr"></div>
    <div class="pf"><p class="pf-k">${state === 'moved' ? '이 PC에서 마지막으로 되살려 본 날' : '되살려 본 날'}</p><p class="pf-d"><span>${D.proof.ko}</span><em>모두 같음</em></p></div>
    <p class="pf-t">폴더마다 무작위로 고른 파일 ${D.proof.files}개(${D.proof.size})를 실제로 되살려 원본과 견줬습니다.${state === 'moved' ? '' : ` 다음은 <span class="keep">${paren(D.proof.nextKo)}</span>입니다.`}</p>`,
  });
}

// 예약 백업이 도는 동안 — 지금 찍히는 장 하나에만 진행 숫자, 뒤에는 지난 장의 머리만
function runReceipt() {
  const r = D.run;
  return `<div class="stack run">
    <div class="slip" aria-hidden="true"><b>보호 확인서</b><span class="num">${D.last.ko} · 안전</span></div>
    <article class="rc" aria-label="찍히는 중인 확인서">
      <div class="rc-h"><h2>보호 확인서</h2>${MARK}</div>
      <p class="rc-s num">${D.device} · ${D.todayDots}</p>
      <div class="hr"></div>
      ${row('확인 시작', r.startKo)}
      ${row(`${r.kind} · ${r.stage}`, `${r.pct}%`)}
      <div class="pbar in" role="progressbar" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.pct}%"></i></div>
      ${row('바뀐 파일', `${r.changed}개`)}
      ${row('올린 양', `${r.done} / ${r.all}`)}
      <div class="hr"></div>
      ${row('다음 확인', D.nextRun.ko)}
      <div class="rc-foot"><p class="rc-e">끝나면 이 장이 마저 찍힙니다</p><span class="slot" aria-hidden="true"></span></div>
    </article></div>`;
}

/* ── 화면 ─────────────────────────────────────── */
const S = {};

S.home = () => sp({
  head: top(),
  kick: `${D.device} · 매시간 저절로 지키는 중`,
  h1: '안전합니다.',
  sub: '매시간 저절로 확인하고, 일주일에 한 번은 파일을 실제로 되살려 원본과 같은지 봅니다.',
  act: ACT,
  right: homeReceipt('ok'),
});

S['home-run'] = () => sp({
  head: top(),
  kick: `${D.device} · ${D.run.kind} 도는 중`,
  h1: '지금 백업하고 있습니다.',
  sub: `창을 닫아도 계속됩니다. 끝나기 전까지 가장 최근 판은 오늘 <b class="num">${D.last.ko}</b> 판입니다.`,
  act: `${ACT}<span class="hint">파일 되살리기는 지금 누르면 ${josa(D.run.kind, '이/가')} 끝나는 대로 이어서 엽니다.</span>`,
  right: runReceipt(),
});

S['home-partial'] = () => sp({
  head: top(),
  kick: `${D.device} · 매시간 저절로 지키는 중`,
  h1: '안전합니다.',
  sub: `${josa(D.partial.program, '이/가')} 쓰는 중인 파일 ${D.partial.count}개만 <b class="num">${D.partial.keptKo}</b> 판으로 지키고, 나머지는 모두 최신 판입니다.`,
  more: `<a class="lnk" href="#partial">어떤 파일인지 보기 ${ICON.rarr}</a>`,
  act: ACT,
  right: homeReceipt('partial'),
});

S['home-missing'] = () => sp({
  head: top(),
  kick: `${D.device} · 확인이 필요합니다`,
  h1: '폴더 하나를 찾을 수 없습니다.', h1Cls: 'm',
  sub: `「${D.missing.name}」(<span class="num">${D.missing.path}</span>)${pp(D.missing.name, '이/가')} 없어 그 폴더만 빼고 백업했습니다. 나머지 세 곳은 <b class="num">${D.last.ko}</b>에 지켰습니다.`,
  more: `<div class="box"><b>마지막 판은 붙들어 둡니다</b>그 폴더가 든 마지막 판(${D.missing.keptKo})은 지워지지 않게 붙들어 둡니다. 폴더가 다시 보이면 저절로 이어서 지킵니다.</div>`,
  act: `<button class="btn btn-solid" type="button">다시 고르기</button><button class="btn btn-line" type="button">목록에서 빼기</button><span class="hint">빼면 그 폴더의 백업은 30일 뒤 지워집니다.</span>`,
  right: homeReceipt('missing'),
});

S['home-mass'] = () => sp({
  head: top(),
  kick: `${D.device} · 확인이 필요합니다`,
  h1: '많은 파일이 한꺼번에 지워졌습니다.', h1Cls: 'm',
  sub: `${D.mass.whenKo} 「${D.mass.folder}」에서 <b class="num">${D.mass.count}개</b>가 사라졌습니다. 확인하기 전까지 이전 판을 지우지 않습니다.`,
  more: `${notes([
    '직접 지웠거나, 폴더를 옮기거나 이름을 바꿨다면 「내가 한 일이 맞음」을 누르세요.',
    '모르는 일이면 지워지기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.',
  ])}<a class="lnk" href="#home-mass" style="margin-top:14px">지워진 ${D.mass.count}개 보기 ${ICON.rarr}</a>`,
  act: `<button class="btn btn-solid" type="button">지워지기 전으로 되살리기</button><button class="btn btn-line" type="button">내가 한 일이 맞음</button>`,
  right: homeReceipt('mass'),
});

S['home-moved'] = () => sp({
  head: top(),
  kick: `${D.device} · 백업을 쉬는 중`,
  h1: `백업이 「${D.moved.to}」${pp(D.moved.to, '으로/로')}<br>옮겨졌습니다.`, h1Cls: 'm',
  sub: `여기서 고친 파일은 백업되지 않습니다. 오늘 <b class="num">${D.last.ko}</b>까지의 판은 그대로라 파일 되살리기는 계속 쓸 수 있습니다.`,
  act: `<button class="btn btn-solid" type="button">파일 되살리기</button><button class="btn btn-line" type="button">이 PC로 다시 백업</button><span class="hint">다시 백업하면 「${D.moved.to}」${pp(D.moved.to, '은/는')} 백업을 멈추고, 그 PC와 메일로 알립니다.</span>`,
  right: homeReceipt('moved'),
});

S['start-1'] = () => sp({
  cls: 'home start',
  head: top({ right: false }),
  kick: '설정할 것이 없습니다',
  h1: '업무 자료를<br><span class="soft">매시간 저절로 지킵니다.</span>',
  sub: 'Google 계정으로 시작하면 이 PC의 문서 · 바탕화면 · 사진과 찾아낸 작업 폴더를 암호화해 클라우드에 올립니다.',
  act: `<button class="btn btn-solid" type="button">${ICON.google}Google로 시작</button><span class="hint">브라우저가 열리면 계정을 고르고 「계속」을 누르세요.</span><p class="alt"><span>Google 계정에 들어갈 수 없나요?</span><a class="lnk" href="#start-1">복구 코드로 되살리기</a></p>`,
  more: notes([
    '<b>SYNK도 백업 내용을 열 수 없습니다.</b> 여는 열쇠는 내 Google 계정에만 맡깁니다.',
    '그래서 Google 계정에 들어갈 수 있는 사람은 백업도 열 수 있습니다. <b>Google 2단계 인증을 켜 두세요.</b>',
  ]),
  foot: TELEMETRY,
  right: receipt({
    title: '보호 확인서', sub: '첫 백업이 끝나면 여기에 찍힙니다', ghosts: false,
    st: stamp('아직', 'off', ''),
    body: `<div class="hr"></div>
      ${row('마지막 확인', '<span style="color:var(--ink-3)" aria-hidden="true">— —</span>')}
      ${row('다음 확인', '<span style="color:var(--ink-3)">매시간</span>')}
      <div class="hr"></div>
      ${row('지키는 폴더', '<span style="color:var(--ink-3)" aria-hidden="true">— —</span>')}
      ${row('합계', '<span style="color:var(--ink-3)" aria-hidden="true">— —</span>', 'tot')}
      <div class="hr"></div>
      <p class="pf-k">되살려 본 날</p>
      <p class="pf-t" style="margin-top:4px">일주일에 한 번, 파일을 실제로 되살려 원본과 같은지 봅니다.</p>
      <div class="hr"></div>
      <p class="pf-t" style="margin:0">사고가 나도 29일 안이면 그 시각으로 되돌립니다.</p>`,
  }),
});

S['start-2'] = () => {
  const total = parseFloat(D.total.size);
  return sp({
    cls: 'flow',
    head: top({ right: false }),
    kick: `${D.device} · 보호 범위`,
    h1: '이 폴더를 지킵니다.',
    sub: '앱이 골라 둔 그대로 두면 됩니다. 「보호 시작」을 누르면 목록의 폴더를 암호화해 올리기 시작합니다.',
    act: '<button class="btn btn-solid" type="button">보호 시작</button>',
    foot: TELEMETRY,
    right: `<section class="sheet scope" aria-label="보호 범위">
      <div class="rc-h"><h2>보호 범위</h2>${MARK}</div><p class="meta num">예상 ${D.total.files}개 · ${D.total.size}</p>
      <div class="frs">${D.folders.map((f) => `<div class="fr"><span class="tick">${ICON.check}</span><div><p class="nm">${f.name}</p><p class="ds num">${f.found ? '찾아낸 작업 폴더 · ' : ''}${f.path}</p></div><span class="share" aria-hidden="true"><i style="width:${((parseFloat(f.size) / total) * 100).toFixed(1)}%"></i></span><p class="sz num"><b>${f.size}</b>${f.files}개</p></div>`).join('')}</div>
      <button class="addrow" type="button"><span aria-hidden="true">+</span>다른 폴더 더하기</button>
      <p class="od">OneDrive에만 있는 파일 <b class="num">${D.onedriveOnly}</b>개는 OneDrive가 지킵니다. 이 백업에는 담지 않습니다.</p>
      <div class="quota"><div class="quota-h"><span>지키는 양</span><span><b class="num">${D.total.size}</b> / <span class="num">${D.cap}</span>까지</span></div><div class="hatch"><i style="width:${D.capPct}%"></i></div></div>
    </section>`,
  });
};

S['start-3'] = () => sp({
  cls: 'flow',
  head: top({ right: false }),
  kick: `${D.device} · 첫 백업`,
  h1: '첫 백업 중입니다.',
  sub: '창을 닫아도 됩니다. 끝나면 알려 드립니다.',
  more: `<div class="pbar" role="progressbar" aria-valuenow="31" aria-valuemin="0" aria-valuemax="100"><i style="width:31%"></i></div>${notes([
    '전원이 연결돼 있는 동안은 절전 모드로 들어가지 않습니다.',
    '첫 백업 뒤로는 매시간 바뀐 것만 올립니다. 꺼져 있어 놓친 시간은 로그인 · 깨어난 뒤에 채웁니다.',
  ]).replace('class="notes"', 'class="notes" style="margin-top:24px"')}`,
  act: '<button class="btn btn-line" type="button">창 닫기</button>',
  right: receipt({
    title: '보호 확인서', sub: `${D.device} · 첫 장`, ghosts: false, end: '끝나면 이 장이 마저 찍힙니다',
    st: '<span class="slot" aria-hidden="true"></span>',
    body: `<div class="hr"></div>
    <div class="steps">
      <div class="st done"><span class="k">${ICON.check}</span><h3>내 클라우드 자리 만들기</h3></div>
      <div class="st done"><span class="k">${ICON.check}</span><h3>복구 정보를 내 Google 계정에 맡기기</h3><p>맡긴 뒤 다시 받아 열리는지까지 봤습니다.</p></div>
      <div class="st done"><span class="k">${ICON.check}</span><h3>매시간 저절로 돌게 등록하기</h3><p>창을 닫아도 매시간 뒤에서 조용히 돕니다.</p></div>
      <div class="st now"><span class="k num">4</span><h3>첫 백업 · 올리는 중 <span class="num">31%</span></h3><p class="num">5.7GB / ${D.total.size} · 약 17분 남음</p></div>
    </div>`,
  }),
});

S.restore = () => sp({
  cls: 'flow',
  head: top({ flow: '파일 되살리기' }),
  kick: `가장 최근 판 · 오늘 ${D.last.ko}`,
  h1: '무엇을 되살릴까요?',
  sub: '고른 파일은 지키는 폴더 밖의 새 폴더에 되살립니다. 원래 파일은 그대로 두고, 되살린 뒤 백업과 같은지 하나하나 확인합니다.',
  // 화면 · 상품은 「최신 하나」(결정 11-12 — 내부 24시간은 약속이 아니고 「지난 판 고르기」는 유료 구간 후보). 꺼낼 수 있는 것은 붙들어 둔 판뿐(설계 4.2 · 4.4), 링크는 붙들어 둔 판이 있을 때만 보인다(Fable 다시 확인 R1)
  more: `${notes(['붙들어 둔 판(찾을 수 없는 폴더 · 한꺼번에 지워지기 전)이 있으면 그 판에서도 꺼낼 수 있습니다.'])}<a class="lnk" href="#restore" style="margin-top:14px">붙들어 둔 판에서 꺼내기 ${ICON.rarr}</a>`,
  act: `<button class="btn btn-solid" type="button">고른 3개 되살리기</button><button class="btn btn-line" type="button">전체 ${D.total.files}개 되살리기</button>`,
  right: `<section class="sheet wide" aria-label="찾기">
    <h2>찾기</h2><p class="meta num">${D.total.files}개 가운데 · 오늘 ${D.last.ko} 판</p>
    <div class="find">${ICON.search}<span>견적</span><em class="num">5개 찾음</em></div>
    ${[
      ['견적서_1112_최종.pdf', '문서 › 견적', '1.2MB', '11월 12일', true],
      ['견적서_1112_최종.hwp', '문서 › 견적', '88KB', '11월 12일', true],
      ['견적 참고 사진.jpg', '사진 › 현장', '4.8MB', '11월 9일', true],
      ['견적 양식.xlsx', '문서 › 양식', '46KB', '10월 2일', false],
      ['2026 견적 모음.zip', '프로젝트 › 보관', '212MB', '9월 30일', false],
    ].map(([n, w, s, d, on]) => `<div class="fl"><span class="cb ${on ? '' : 'off'}">${on ? ICON.check : ''}</span><span class="nm">${n}</span><span class="vl"><span>${s}</span><span>${d}</span></span><span class="ds">${w}</span></div>`).join('')}
    <div class="selbar"><span><b class="num">3개</b> 고름 · <span class="num">6.1MB</span></span><span>놓을 자리 <b>${D.restoreTo}</b><a class="lnk" href="#restore">자리 바꾸기</a></span></div>
  </section>`,
});

// 쓰는 중인 파일 — 관리자 계정(4시간마다 따로 읽음) · 표준 사용자 계정(닫았을 때 새로 담김)
function partialScreen(std) {
  const p = D.partial;
  const kept = std ? p.stdKeptKo : p.keptKo;
  return sp({
    cls: 'flow',
    head: top({ flow: '쓰는 중인 파일' }),
    kick: `${D.device} · ${std ? '표준 사용자 계정' : '관리자 계정'}`,
    h1: `파일 ${p.count}개는<br><span class="soft">${kept} 판으로 지킵니다.</span>`, h1Cls: 'm',
    sub: `${josa(p.program, '이/가')} 열어 두고 고치는 중이라 ${std ? '그 뒤 확인 때' : `${D.last.ko} 확인 때`} 읽지 못했습니다. 나머지 <b class="num">${p.rest}개</b>는 ${D.last.ko} 판입니다.`,
    more: notes(std ? [
      '이 계정은 표준 사용자라, 켜진 프로그램이 쥔 파일은 그 프로그램을 닫았을 때 새로 담깁니다.',
      `퇴근할 때 ${josa(p.program, '을/를')} 닫아 두면 다음 확인 때 오늘 판으로 바뀝니다.`,
      `되살릴 때 이 ${p.count}개는 ${kept} 판에서 가져옵니다.`,
    ] : [
      `관리자 계정이라 4시간마다 이 파일만 따로 읽어 새로 담습니다. 다음은 ${p.nextFill}입니다.`,
      `${josa(p.program, '을/를')} 닫으면 다음 확인 때 바로 새로 담깁니다.`,
      `되살릴 때 이 ${p.count}개는 ${kept} 판에서 가져옵니다.`,
    ]),
    act: '<button class="btn btn-line" type="button">돌아가기</button>',
    right: receipt({
      title: '쓰는 중인 파일', ghosts: false,
      body: `<div class="hr"></div>
      ${p.files.map((f) => `<div class="row" style="align-items:flex-start;padding:8px 0"><span style="color:var(--ink);font-weight:600">${f.name}<br><span style="font-size:13px;color:var(--ink-3);font-weight:400">${f.where} · ${p.program}</span></span><b class="num">${f.size}</b></div>`).join('')}
      <div class="hr"></div>
      ${row('지키는 판', `오늘 ${kept}`)}
      ${std ? row('새로 담기는 때', `${josa(p.program, '을/를')} 닫은 뒤 첫 확인`) : row('다음 따로 읽기', p.nextFill)}
      <div style="height:6px"></div>`,
    }),
  });
}
S.partial = () => partialScreen(false);
S['partial-std'] = () => partialScreen(true);

// 고르는 종이 한 장 — 제목 · 한 줄 · 어디가 어디로 가는지
const opt = (on, h, p, map) => `<div class="opt${on ? ' on' : ''}" role="radio" aria-checked="${on}"><div class="oh"><h3>${h}</h3><span class="pick" aria-hidden="true">${on ? ICON.check : ''}</span></div>
    <p>${p}</p><div class="map">${map.map(([a, b]) => `<span>${a}</span><i aria-hidden="true">→</i><span class="num">${b}</span>`).join('')}</div></div>`;

// 백업하는 이 PC(옛 PC)에서 「새 PC로 옮겨 오기」를 누르면 — 옮겨 오기는 새 PC에서 하고, 이 PC는 새 PC가 이어 받을 때까지 지킨다(설계 2.3 · 4.6)
S['move-0'] = () => sp({
  cls: 'flow',
  head: top({ flow: '새 PC로 옮겨 오기' }),
  kick: `${D.device} · 새 PC로 옮기기 전에`,
  h1: '새 PC에서<br><span class="soft">세 걸음이면 됩니다.</span>', h1Cls: 'm',
  sub: '새 PC에 업무 백업을 깔고 같은 Google 계정으로 시작하면, 이 PC의 마지막 판을 찾아 옮겨 옵니다.',
  // 열어 둔 프로그램이 쥔 파일은 닫아야 담기고(설계 4.2), 지키는 폴더 밖 · 공동인증서는 백업에 없다 — 옛 PC를 정리하기 전에 알린다(카본 2차 3)
  more: notes([
    '옮기기 직전에 열어 둔 프로그램(Outlook 등)을 모두 닫고 「지금 한 번 더 백업」을 누르면, 방금 고친 파일까지 갑니다.',
    '지키는 네 곳 밖의 자료와 공동인증서는 백업에 없습니다. 옛 PC를 정리하기 전에 직접 옮기세요.',
    '새 PC가 이어 받기 전까지 이 PC는 지금처럼 매시간 지킵니다.',
  ]),
  // 복구 코드에는 읽기 열쇠만 있어 파일만 옮겨 온다 — 이어서 백업하려면 Google 로그인(개통)이 든다(설계 4.5 · 4.8 · 카본 2차 2)
  act: '<button class="btn btn-solid" type="button">지금 한 번 더 백업</button><p class="alt"><span>Google 계정에 들어갈 수 없나요?</span><a class="lnk" href="#code">복구 코드 만들기</a></p><span class="hint">복구 코드로는 새 PC에 파일만 옮겨 옵니다. 이어서 백업하려면 Google 로그인이 필요합니다.</span>',
  right: `<section class="sheet" aria-label="새 PC에서 할 일">
    <h2>새 PC에서 할 일</h2><p class="meta">이 PC는 그대로 두고, 새 PC에서 합니다</p>
    <div class="steps" style="margin-top:16px">
      <div class="st"><span class="k num">1</span><h3>업무 백업 깔기</h3><p>처음 받은 곳에서 설치 파일을 다시 받아 새 PC에서 엽니다.</p></div>
      <div class="st"><span class="k num">2</span><h3>같은 Google 계정으로 시작</h3><p class="num">${D.account}</p></div>
      <div class="st"><span class="k num">3</span><h3>「이 PC로 옮겨 오기」 누르기</h3><p>놓을 자리 · 원본과 대조 · 다시 깔 프로그램까지 앱이 차례로 안내합니다.</p></div>
    </div>
    <div class="hr"></div>
    ${row('옮겨 올 것', `${D.total.files}개 · ${D.total.size}`)}
    ${row('다시 깔 프로그램', `${D.programs.length}개 찾아 둠`)}
  </section>`,
});

S['move-1'] = () => sp({
  cls: 'flow',
  head: top({ flow: '새 PC로 옮겨 오기', step: 1, total: 4 }),
  kick: `${D.newDevice} · 같은 Google 계정`,
  h1: '어디에 놓을까요?',
  sub: `「${D.move.from}」의 백업을 찾았습니다. 마지막 확인은 ${D.move.fromLast}, <span class="num keep">${D.total.files}개 · ${D.total.size}</span>입니다.`,
  more: notes([
    '이미 있는 파일은 덮어쓰지 않습니다. 내용이 다르면 「(복구본)」을 붙여 나란히 둡니다.',
    `약 <b class="num">${D.move.waitMin}분</b> 걸립니다(지난 백업에서 잰 회선 속도로 어림했고, 시작하면 다시 셉니다). 끊겨도 멈춘 곳부터 잇습니다.`,
  ]),
  act: '<button class="btn btn-solid" type="button">이 자리로 옮겨 오기</button><p class="alt"><span>파일이 이 PC에 그대로 남아 있나요?</span><a class="lnk" href="#move-1">되살리지 않고 이어서 백업</a></p><span class="hint">Windows를 새로 깔아 파일이 비었거나 일부만 남았으면 누르지 마세요. 「이 자리로 옮겨 오기」로 채웁니다.</span>',
  right: `<div class="opts" role="radiogroup" aria-label="놓을 자리">
    ${opt(true, '원래 자리', '이 PC의 문서 · 바탕화면 · 사진은 OneDrive 밖이라 그대로 놓습니다.', [['문서', '이 PC의 문서'], ['바탕화면', '이 PC의 바탕화면'], ['사진', '이 PC의 사진'], ['D:\\Projects', 'D:\\Projects']])}
    ${opt(false, 'OneDrive 밖 새 폴더', '문서 폴더가 OneDrive 안이면 권합니다. 옮겨 올 양이 OneDrive 남은 공간을 넘으면 동기화가 멈출 수 있습니다.', [['폴더 네 곳', D.move.newFolder]])}
    <p class="room num">이 PC 남은 공간 ${D.move.room} · 옮겨 올 것 ${D.total.size}</p>
  </div>`,
});

S['move-2'] = () => sp({
  cls: 'flow',
  head: top({ flow: '새 PC로 옮겨 오기', step: 2, total: 4, back: false }),
  kick: `${D.newDevice} · 옮겨 오는 중`,
  h1: '옮겨 오고 있습니다.',
  sub: `<b class="num">${D.move.pct}%</b> · <span class="num">${D.move.doneSize} / ${D.total.size}</span> · 남은 시간 약 <span class="num">${D.move.leftMin}</span>분`,
  more: `<div class="pbar" style="margin-top:0" role="progressbar" aria-valuenow="${D.move.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${D.move.pct}%"></i></div>${notes([
    '받은 파일은 하나씩 원본과 같은지 확인한 뒤 자리에 놓습니다.',
    '끊겨도 처음부터가 아니라 멈춘 곳부터 이어서 합니다.',
    '전원이 연결돼 있는 동안 절전 모드로 들어가지 않습니다.',
  ]).replace('class="notes"', 'class="notes" style="margin-top:26px"')}`,
  act: `<button class="btn btn-line" type="button">${ICON.pause}잠시 멈추기</button>`,
  right: receipt({
    title: '옮겨 오기 장부', sub: `${D.move.from} → ${D.newDevice} · ${D.todayDots}`, ghosts: false, end: '대조를 마친 파일만 적힙니다',
    body: `<div class="hr"></div>
    ${row('문서', '5,117 / 5,310')}
    <div class="pbar" style="margin:6px 0 10px;max-width:none;height:3px"><i style="width:96%"></i></div>
    ${row('바탕화면', '<span style="color:var(--ink-3)">기다림 · 420</span>')}
    ${row('사진', '<span style="color:var(--ink-3)">기다림 · 4,880</span>')}
    ${row('프로젝트', '<span style="color:var(--ink-3)">기다림 · 1,870</span>')}
    ${row('대조 끝', `${D.move.doneFiles} / ${D.total.files}`, 'tot')}`,
  }),
});

S['move-3'] = () => sp({
  cls: 'flow',
  head: top({ flow: '새 PC로 옮겨 오기', step: 3, total: 4, back: false }),
  kick: `${D.newDevice} · 대조 끝`,
  h1: '다 옮겨 왔습니다.',
  sub: `받은 파일은 모두 ${D.move.fromLast} 백업과 한 바이트도 다르지 않습니다.`,
  more: notes([
    `「(복구본)」 <b class="num">${D.move.sideBySide}</b>개는 이 PC에 같은 이름의 다른 파일이 있어 나란히 두었습니다.`,
    `저절로 실행되는 자리의 파일 <b class="num">${D.move.autorun}</b>개는 원래 자리 대신 「따로 둔 폴더」에 놓았습니다. 옛 PC에 나쁜 프로그램이 있었다면 새 PC에서 저절로 실행되지 않게 하려는 것입니다.`,
  ]),
  act: `<button class="btn btn-solid" type="button">다음 · 백업 켜기</button><a class="lnk" href="#move-3">나란히 둔 ${D.move.sideBySide}개 보기</a><span class="hint">아직 이 PC는 백업하지 않습니다. 다음 화면에서 옛 노트북 연결을 끊고 자동 백업을 켭니다.</span>`,
  right: receipt({
    title: '옮겨 오기 확인서', sub: `${D.move.from} → ${D.newDevice} · ${D.todayDots}`, ghosts: false,
    st: stamp('대조 끝', 'ok'),
    body: `<div class="hr"></div>
    ${row('되살림', `${D.move.restored}개`)}
    ${row('이미 있던 같은 파일', `${D.move.same}개`)}
    ${row('「(복구본)」으로 나란히', `${D.move.sideBySide}개`)}
    ${row('건너뜀', `${D.move.skipped}개`)}
    ${D.move.skippedList.map((s) => `<div class="row sm"><span>${s}</span><b>연결 폴더</b></div>`).join('')}
    <p class="pf-t" style="margin:4px 0 2px 14px">${D.move.skippedWhy}</p>
    ${row('합계', `${D.total.files}개`, 'tot')}
    <div class="hr"></div>
    <p class="pf-k">따로 둔 자동 실행 파일 ${D.move.autorun}개</p>
    ${D.move.autorunList.map(([w, n]) => `<div class="row sm"><span>${w}</span><b>${n}</b></div>`).join('')}
    <p class="pf-t" style="margin:4px 0 0 14px">놓은 곳: ${D.move.autorunTo}</p>
    <div class="lk" style="margin:6px 0 0 14px"><a class="lnk" href="#move-3">폴더 열기 ${ICON.rarr}</a></div>
    <div class="hr"></div>
    <p class="pf-k">옛 노트북 백업이 남아 있는 까닭</p>
    <p class="pf-t" style="margin-top:4px">건너뛴 것이 있어 바로 정리하지 않습니다. 필요 없으면 설정 › 내 기기에서 「나머지는 필요 없음」을 누르세요.</p>`,
  }),
});

S['move-4'] = () => sp({
  cls: 'flow',
  head: top({ flow: '새 PC로 옮겨 오기', step: 4, total: 4 }),
  kick: `${D.newDevice} · 마지막 걸음`,
  h1: '옛 노트북 연결을<br><span class="soft">끊고 이어서 백업합니다.</span>', h1Cls: 'm',
  sub: '끊으면 이 PC가 같은 백업에 이어서 매시간 올립니다. 백업하는 기기는 한 번에 하나라, 옛 노트북은 그때부터 백업하지 않습니다.',
  more: notes([
    '이 목록은 앱이 대신 깔지 않습니다. 보며 하나씩 깔고 로그인하세요. 인쇄해 두어도 됩니다.',
    '<span class="num">winget</span> 줄은 PowerShell에 붙여 넣으면 깔립니다.',
  ]),
  act: '<button class="btn btn-solid" type="button">끊고 이 PC로 이어서 백업</button><a class="lnk" href="#move-4">끊지 않고 이 PC는 백업하지 않기</a>',
  right: `<section class="sheet wide" aria-label="다시 깔 것">
    <div class="sh-h"><h2>다시 깔 프로그램</h2><a class="lnk" href="#move-4">${ICON.print}인쇄</a></div><p class="meta">옛 노트북에서 찾은 것 · <span class="num">${D.programs.length}</span>개</p>
    <div style="margin-top:10px">${D.programs.map((p) => `<div class="fl"><span class="cb off"></span><span class="nm">${p.name}</span><span class="vl">${p.id ? `winget install ${p.id}` : '공식 사이트에서'}</span></div>`).join('')}</div>
    <h2 style="margin-top:30px">다시 로그인할 곳</h2>
    <div style="margin-top:6px">${D.relogin.map((r) => `<div class="fl" style="grid-template-columns:28px 1fr"><span class="cb off"></span><span class="nm">${r.what}</span><span class="ds">${r.how}</span></div>`).join('')}</div>
  </section>`,
});

S['undo-1'] = () => {
  const max = 3412;
  const T = D.undoTicks;
  const bars = D.undoHours.map(([, v], i) => {
    const hot = v > 1000;
    const hgt = v === 0 ? 0 : Math.max(1.4, (v / max) * 100);
    return `<div class="b ${hot ? 'hot' : ''} ${v === 0 ? 'z' : ''}" style="height:${hgt}%">${hot ? `<span class="v num${i === 8 ? ' side' : ''}">${v.toLocaleString('en-US')}</span>` : ''}${i === 7 ? '<span class="pick" style="left:-4px"><span>오후 2:59</span></span>' : ''}</div>`;
  }).join('');
  const last = D.undoHours.length - 1;
  const ticks = D.undoHours.map(([h], i) => `<span class="${T.day[i] ? 'd' : T.show.includes(i) ? 's' : ''}${i === last ? ' e' : ''}">${T.day[i] || T.label[i] || h}</span>`).join('');
  return sp({
    cls: 'flow',
    head: top({ flow: '사고가 났을 때 되돌리기', step: 1, total: 3 }),
    kick: '백업이 바뀌었습니다',
    h1: '언제로 되돌릴까요?',
    sub: `${D.undo.detectKo}부터 지워진 백업 묶음이 한꺼번에 늘었습니다. 그 직전인 <b class="num">${D.undo.pickKo}</b>${pp(D.undo.pickKo, '을/를')} 골라 두었습니다.`,
    more: `<div class="box"><b>되돌릴 수 있는 날이 ${D.undo.daysLeft}일 남았습니다</b>지워진 묶음은 30일째부터 사라지기 시작해, 하루 여유를 두고 <span class="keep">${D.undo.until}</span>까지 되돌릴 수 있습니다.</div>`,
    act: '<button class="btn btn-solid" type="button">이 시각으로 미리 보기</button><a class="lnk" href="#undo-1">다른 시각 고르기</a>',
    right: `<section class="sheet wide" aria-label="시간마다 숨겨진 백업 묶음">
      <h2>시간마다 숨겨진 백업 묶음</h2><p class="meta">11월 12일 오전 8시 ~ 13일 오전 8시 · SYNK 서버가 센 수</p>
      <p class="why">백업은 작은 묶음으로 나눠 올리고, 지워진 묶음은 30일 동안 숨겨 둡니다.</p>
      <div class="chart"><div class="bars">${bars}</div><div class="ticks">${ticks}</div></div>
      <div class="legend"><span>평소에는 지난 판을 정리하며 한 시간에 수십 개씩 숨겨집니다.</span><b class="num">오후 3시~5시: ${D.undo.spike}개</b></div>
    </section>`,
  });
};

S['undo-2'] = () => sp({
  cls: 'flow',
  head: top({ flow: '사고가 났을 때 되돌리기', step: 2, total: 3 }),
  kick: '미리 보기',
  // 제목은 고른 시각 T, 종이는 그 시각의 가장 최근 판(설계 2.5 「그 시각의 완료본」) — 둘을 섞어 쓰지 않는다(카본 2차 5)
  h1: `${D.undo.pickShortKo}로<br><span class="soft">되돌립니다.</span>`, h1Cls: 'm',
  sub: '클라우드 백업만 그 시각으로 되돌리고, 이 PC의 파일은 그대로 둡니다.',
  more: `<div class="steps" style="max-width:33em">
    <div class="st"><span class="k num">1</span><h3>이 계정의 모든 기기 연결을 새 것으로 바꿉니다</h3><p>이 PC만 새 연결을 받습니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다. 전에 받은 복구 코드도 쓸 수 없게 되어, 끝나면 새로 만듭니다.</p></div>
    <div class="st"><span class="k num">2</span><h3>그 시각의 백업을 다시 보이게 합니다</h3><p>지우는 것은 없습니다. 도중에 끊겨도 다시 누르면 이어서 합니다.</p></div>
    <div class="st"><span class="k num">3</span><h3>확인을 마칠 때까지 자동 백업과 정리를 멈춥니다</h3><p>요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.</p></div>
  </div>`,
  act: `<button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 되돌리기</button><span class="hint">누르면 Google 로그인을 한 번 더 합니다.</span>`,
  right: receipt({
    title: '그 시각의 가장 최근 판', sub: `${D.undo.versionKo} 판`, ghosts: false,
    body: `<div class="hr"></div>
    ${D.folders.map((f, i) => row(f.name, `${D.undo.byFolder[i]}개`, 'sm')).join('')}
    ${row('합계', `${D.undo.files}개 · ${D.undo.size}`, 'tot')}
    <div class="hr"></div>
    ${row('지금 상태의 백업', '<span class="bad">열 수 없음</span>')}
    <p class="pf-t" style="margin:6px 0 0">숨겨진 묶음이 많아 지금 상태로는 열리지 않습니다.</p>
    <div class="hr"></div>
    <p class="pf-k">이 PC가 감염됐을 수 있으면</p>
    <p class="pf-t" style="margin-top:4px">먼저 치료하거나 깨끗한 다른 PC에서 되돌리세요. 같은 사용자 권한의 프로그램은 새 Google 로그인도 읽습니다. 그다음 Google에서 이 PC를 로그아웃하고 「업무 백업」 접근을 지운 뒤 다시 로그인하세요.</p>
    <div class="lk" style="margin:8px 0 6px"><a class="lnk" href="#undo-2">Google 기기 관리 ${ICON.ext}</a><a class="lnk" href="#undo-2">연결된 앱 ${ICON.ext}</a></div>`,
  }),
});

S['undo-3'] = () => sp({
  cls: 'flow',
  head: top({ flow: '사고가 났을 때 되돌리기', step: 3, total: 3, back: false }),
  kick: '되돌렸습니다 · 자동 백업 멈춤',
  h1: `${D.undo.pickShortKo}로<br><span class="soft">되돌렸습니다.</span>`, h1Cls: 'm',
  sub: '자동 백업과 정리를 멈춰 두었습니다. 먼저 필요한 파일을 새 폴더로 꺼내 확인하세요.',
  more: notes([
    '<b>파일 꺼내기</b>는 되돌린 판에서 필요한 파일을 새 폴더로 꺼냅니다. 이 PC의 파일은 건드리지 않습니다.',
    '<b>여기서부터 계속</b>은 이 PC의 지금 파일로 다시 매시간 백업합니다. 지키는 폴더에 망가진 파일이 남아 있으면, 꺼낸 파일로 바꿔 놓은 뒤에 누르세요.',
    `<b>되돌리기 취소</b>는 되돌리기 직전(${D.undo.cancelKo})으로 다시 돌립니다.`,
  ]),
  act: '<button class="btn btn-solid" type="button">파일 꺼내기</button><button class="btn btn-line" type="button">여기서부터 계속</button><a class="lnk" href="#undo-3">되돌리기 취소</a>',
  right: receipt({
    title: '되돌리기 확인서', ghosts: false,
    st: stamp('되돌림', 'warn'),
    body: `<div class="hr"></div>
    ${row('되돌린 시각', D.undo.pickShortKo)}
    ${row('그때 가장 최근 판', `${D.undo.versionKo} · ${D.undo.files}개`)}
    ${row('이 PC의 파일', '그대로')}
    ${row('기기 연결', '새로 바꿈 · 이 PC만')}
    ${row('알림', '모든 기기 · 메일')}
    ${row('자동 백업', '고를 때까지 멈춤')}
    <div class="hr"></div>
    <p class="pf-k">다음 할 일</p>
    <p class="pf-t" style="margin-top:4px">새 복구 코드를 만들어 두세요. 전에 받은 코드는 이제 쓸 수 없습니다. 이 PC가 감염됐을 수 있으면 치료한 뒤에 만드세요.</p>
    <div class="lk" style="margin:8px 0 6px"><a class="lnk" href="#code">새 복구 코드 만들기 ${ICON.rarr}</a></div>`,
  }),
});

S.lost = () => sp({
  cls: 'flow',
  head: top({ flow: '분실 신고', step: 1, total: 2 }),
  kick: `${D.newDevice}에서`,
  h1: `「${D.device}」${pp(D.device, '을/를')}<br><span class="soft">분실 신고합니다.</span>`, h1Cls: 'm',
  sub: '신고하는 즉시 그 노트북의 백업 연결을 끊습니다. 백업은 지워지지 않고, 잃어버린 노트북 안의 파일은 이 앱이 지울 수 없습니다.',
  more: '<div class="box"><b>신고한 뒤에는</b>새 기기를 이을 때까지 SYNK 서버를 거쳐야 백업을 열 수 있고, 전에 받은 복구 코드는 쓸 수 없습니다.</div>',
  act: `<button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 분실 신고</button><a class="lnk" href="#drawer">취소</a>`,
  right: `<section class="sheet" aria-label="분실 신고 순서">
    <h2>분실 신고 순서</h2><p class="meta">끝까지 하면 잃어버린 노트북은 백업을 읽지도 올리지도 못합니다</p>
    <div class="steps" style="margin-top:16px">
      <div class="st now"><span class="k num">1</span><h3>Google로 확인</h3><p>본인인지 Google 로그인으로 한 번 더 확인합니다.</p></div>
      <div class="st"><span class="k num">2</span><h3>그 노트북의 백업 연결 끊기</h3><p>SYNK 서버가 바로 합니다.</p></div>
      <div class="st"><span class="k num">3</span><h3>Google 계정에서 그 노트북을 로그아웃하고 「업무 백업」 접근 지우기</h3><p>잃어버린 노트북에 남은 Google 로그인으로 복구 정보를 계속 읽을 수 있어서입니다. 신고한 뒤 다음 화면에서 합니다.</p></div>
      <div class="st"><span class="k num">4</span><h3>이 PC에서 다시 로그인</h3><p>새 복구 정보를 맡기고, 새 복구 코드를 만듭니다.</p></div>
    </div>
  </section>`,
});

// 신고 직후 — 남은 Google 걸음(설계 2.4의 3 · 4). 「업무 백업」 접근을 지우면 이 PC의 Google 토큰도 끊기고, 앱은 그것으로 3이 끝났음을 안다
S['lost-2'] = () => sp({
  cls: 'flow',
  head: top({ flow: '분실 신고', step: 2, total: 2, back: false }),
  kick: `${D.newDevice} · 신고 끝, 남은 걸음 둘`,
  h1: 'Google에서도<br><span class="soft">그 노트북을 내보내세요.</span>', h1Cls: 'm',
  sub: '백업 연결은 끊었습니다. 그 노트북에 남은 Google 로그인도 끊어야 합니다.',
  more: `<div class="steps" style="max-width:33em">
    <div class="st now"><span class="k num">1</span><h3>Google 기기 관리에서 「${D.device}」 로그아웃</h3><p>훔쳐 갔을 수 있으면 Google 비밀번호도 바꾸세요.</p><div class="lk"><a class="lnk" href="#lost-2">Google 기기 관리 열기 ${ICON.ext}</a></div></div>
    <div class="st now"><span class="k num">2</span><h3>연결된 앱에서 「업무 백업」 접근 지우기</h3><p>1번을 마친 뒤에 지웁니다. 이 PC도 함께 로그아웃됩니다.</p><div class="lk"><a class="lnk" href="#lost-2">연결된 앱 열기 ${ICON.ext}</a></div></div>
  </div>`,
  // 앱은 2번(이 PC의 Google 토큰이 끊김)만 알아챈다 — 1번은 알 수 없어 확인을 받고, 그 전에는 새 복구 정보를 맡기지 않는다(카본 2차 1 · 설계 2.4의 3 · 4)
  act: `<button class="btn btn-solid" type="button">두 걸음을 마쳤습니다 · 다시 로그인</button><span class="hint">2번은 앱이 알아채지만 1번은 알 수 없어 여기서 확인을 받습니다. 누르기 전에는 새 복구 정보를 맡기지 않습니다.</span>`,
  right: receipt({
    title: '분실 신고 확인서', ghosts: false,
    st: stamp('신고', 'warn'),
    body: `<div class="hr"></div>
    ${row('신고한 때', D.lost.ko)}
    ${row('신고한 곳', D.newDevice)}
    <div class="hr"></div>
    ${row('백업 연결', '끊음')}
    ${row('전에 받은 복구 코드', '쓸 수 없음')}
    ${row('백업', '그대로')}
    <div class="hr"></div>
    ${row('Google에서 로그아웃', '기다림')}
    ${row('「업무 백업」 접근 지우기', '기다림')}
    ${row('새 복구 코드', '그다음')}`,
  }),
});

S.code = () => sp({
  cls: 'flow',
  head: top({ flow: '복구 코드' }),
  kick: '되찾는 길 · 첫 주 안에 한 번',
  h1: '복구 코드를<br><span class="soft">한 장 만들어 두세요.</span>', h1Cls: 'm',
  sub: 'Google 계정에 들어갈 수 없을 때 이 종이 한 장으로 백업을 엽니다.',
  more: '<div class="box"><b>이 종이를 가진 사람은 백업을 열 수 있습니다</b>금고나 서랍처럼 PC와 떨어진 곳에 두세요. 백업하는 폴더나 OneDrive 폴더 안에는 저장할 수 없습니다.</div>',
  act: `<button class="btn btn-solid" type="button">${ICON.print}인쇄</button><button class="btn btn-line" type="button">${ICON.usb}USB에 저장</button><a class="lnk" href="#home">다음에 하기</a><span class="hint">건너뛰면 설정 › 복구 코드에서 언제든 만들 수 있습니다.</span>`,
  right: `<article class="code" aria-label="복구 코드 견본">
    <div class="ttl"><h2>업무 백업 · 복구 코드</h2>${MARK}</div>
    <p class="meta">만든 날 <span class="num">2026. 11. 13.</span> · ${D.device} · ${D.account}</p>
    <div class="cg-h"><span>가려 둠 · 인쇄하거나 USB에 저장할 때만 글자가 나옵니다</span><a class="lnk" href="#code">글자 보기</a></div>
    <div class="cg hide">${Array.from({ length: Math.ceil(D.codeGroups.length / 4) }, (_, r) => `<i>${r + 1}</i>${D.codeGroups.slice(r * 4, r * 4 + 4).map((g) => `<span>${g}</span>`).join('')}`).join('')}</div>
    <p class="use">새 PC에서 업무 백업을 깔고 첫 화면의 <b>「복구 코드로 되살리기」</b>를 누른 뒤, USB에 저장한 파일을 열거나 이 글자를 그대로 넣으세요. Google 계정 없이 열립니다.</p>
    <p class="cut">분실 신고나 사고 되돌리기를 하면 이 코드는 쓸 수 없게 되고, 새 코드를 다시 권해 드립니다.</p>
  </article>`,
});

S.web = () => `<div class="web">
  <div class="wl">
    <div class="wtop">${MARK}<span>${D.app}</span></div>
    <div><p class="kick">새 기기 연결</p><h1 class="m">이 계정에<br>새 기기가 연결됐습니다.</h1>
      <p class="sub">내가 한 일이 아니면 바로 끊으세요. 끊으면 SYNK 서버가 그 기기의 백업 연결을 지우고, 전에 받은 복구 코드도 쓸 수 없게 합니다.</p></div>
    <div class="act"><button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 끊기</button>
      <span class="hint">내가 연결한 기기가 맞다면 아무것도 하지 않고 이 창을 닫으세요. 이 링크만으로는 끊지 않고, 계정 주인인지 Google 로그인으로 확인합니다.</span></div>
    <div class="box"><b>끊은 뒤 Google에서도 내보내세요</b>그 기기를 이은 사람은 내 Google 계정에 들어간 사람입니다. Google 비밀번호를 바꾸고, 그 기기를 로그아웃한 뒤 「업무 백업」 접근을 지우세요. 그대로 두면 새로 맡길 복구 정보까지 읽을 수 있습니다. 「${D.device}」${pp(D.device, '은/는')} 다시 로그인한 뒤 새 복구 코드를 권합니다.
      <div class="lk" style="margin-top:10px"><a class="lnk" href="#web">Google 기기 관리 ${ICON.ext}</a><a class="lnk" href="#web">연결된 앱 ${ICON.ext}</a></div></div>
    <a class="lnk" href="#lost">기기를 잃어버렸나요? 분실 신고 ${ICON.rarr}</a>
  </div>
  <div class="wr"><div class="dev">${receipt({
    title: '새로 연결된 기기', sub: D.joined.dotsKo, ghosts: false,
    st: stamp('주의', 'warn'),
    body: `<div class="hr"></div>${row('기기 이름', D.newDevice)}${row('Windows', '11')}${row('연결한 계정', D.account)}<div class="hr"></div><p class="pf-t" style="margin:0">이 계정의 다른 기기 「${D.device}」에도 같은 알림을 보냈습니다.</p>`,
  })}</div></div>
</div>`;

S.notify = () => sp({
  cls: 'flow',
  head: top({ flow: '알림 문구', back: false, right: false }),
  kick: 'Windows 알림 · 열두 가지',
  h1: '문제 하나에<br><span class="soft">할 일 하나.</span>',
  sub: '문제가 없으면 알리지 않습니다. 같은 문제는 하루 한 번만 띄우고, 해결되면 다시 알리지 않습니다.',
  more: notes([
    '알림을 누르면 그 문제를 다루는 화면이 열립니다. 바로 시작하는 단추는 업데이트 「설치」 하나이고, 그때도 관리자 확인 창이 먼저 뜹니다.',
    'PC가 꺼져 있어 사흘 넘게 소식이 없으면 SYNK 서버가 메일로 알립니다. 「백업을 못 함」이 아니라 「소식이 없음」이라고 씁니다.',
  ]),
  right: `<div class="toasts">${NOTIFY.map((n) => `<div class="tw"><div class="toast"><div class="app"><i>${MARK}</i>업무 백업</div><h4>${n.title}</h4><p>${n.body}</p>${n.act ? `<div class="tb">${n.act}</div>` : ''}</div><p class="when"><b class="${n.tone}"></b>${n.when}</p></div>`).join('')}</div>`,
});

S.drawer = () => `${S.home()}<div class="dim"></div><aside class="drawer" aria-label="설정">
  <div class="dh"><h2>설정</h2><button class="tbtn" type="button">닫기</button></div>
  <p class="who">${D.account} · ${D.device} · <span class="num">${D.version}</span></p>
  ${DRAWER.map((g) => `<section class="dg"><h3>${g.group}</h3>${g.rows.map((r) => `<div class="dr"><span class="nm">${r.name}${r.nudge ? '<i aria-label="권함"></i>' : ''}</span><span class="vl">${r.value}</span>${r.act ? `<a class="lnk" href="#${r.to || 'drawer'}">${r.act}</a>` : ''}</div>`).join('')}</section>`).join('')}
</aside>`;

export const screens = SCREENS.filter(([id]) => S[id]).map(([id]) => ({ id, html: S[id]() }));

// 시안 B 「눈금」 — 앱은 조용한 계기다. 주인공은 지난 7일의 시간 눈금(한 칸 = 한 시간의 확인)과 큰 숫자 하나.
// 뼈대: 위에서 아래로 띠를 쌓는다 — 상태 한 줄 · 읽음값(큰 숫자) · 할 일 건반 둘 · 눈금.
// 흐름 화면도 같은 뼈대 — 단계 눈금 · 제목(결정을 돕는 숫자가 있을 때만 큰 숫자) · 자료 판 · 바닥에 붙는 결정 막대.
// 포인트 색은 한 화면에 한 자리(상태 한 줄 + 같은 뜻의 눈금 칸까지). 큰 숫자 · 띠 · 꼬리표는 잉크.
import { D, NOTIFY, DRAWER, SCREENS, WEEK, TELEMETRY, josa } from './copy.mjs';
import { ICON, MARK } from './shell.mjs';

export const name = '업무 백업 0.7.0 · 시안 B 눈금';

export const css = `
:root{
  --bg:#0e0e0f;--panel:#161617;--panel-2:#1c1c1e;--line:rgba(255,255,255,.09);--line-2:rgba(255,255,255,.17);
  --ink:#f2f2f3;--ink-2:#c6c6cb;--ink-3:#9c9ca3;--ink-4:#5c5c63;--tick:#e6e6e9;
  --ok:#7db45a;--warn:#f5c445;--bad:#f96859;
  --sans:"SYNK Sans",system-ui,"Segoe UI","Malgun Gothic",sans-serif;
  --num:"Inter Tight","SYNK Sans",system-ui,sans-serif;
  --ease:cubic-bezier(.16,1,.3,1);
  color-scheme:dark;
}
body{background:var(--bg);color:var(--ink)}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:6px}
.w{max-width:1440px;margin:0 auto;padding:0 48px}

/* 위 막대 */
.top{display:flex;align-items:center;justify-content:space-between;height:72px}
.brand{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:700}
.brand .mark{height:17px}
.brand .bar{width:1px;height:16px;background:var(--line-2)}
.top-r{display:flex;align-items:center;gap:14px;font-size:13px;color:var(--ink-3)}
.tbtn{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 15px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)}
.tbtn:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.flowname{display:flex;align-items:center;gap:14px;font-size:15px;font-weight:700}

/* 단계 눈금(흐름) */
.segs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;margin:4px 0 0}
.seg{font-size:13px;color:var(--ink-3);padding-top:10px;border-top:2px solid var(--line-2)}
.seg b{font-family:var(--num);font-weight:500;margin-right:8px}
.seg.done{border-top-color:var(--ink-2);color:var(--ink-2)}
.seg.on{border-top-color:var(--ink);color:var(--ink);font-weight:600}

/* 상태 한 줄 — 이 화면의 포인트 색 자리 */
.stat{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:17px;font-weight:600}
.stat i{width:10px;height:10px;border-radius:50%;background:var(--ink-3);flex:none}
.stat.ok{color:var(--ok)}.stat.ok i{background:var(--ok);box-shadow:0 0 0 5px rgba(125,180,90,.16)}
.stat.warn{color:var(--warn)}.stat.warn i{background:var(--warn);box-shadow:0 0 0 5px rgba(245,196,69,.16)}
.stat.bad{color:var(--bad)}.stat.bad i{background:var(--bad);box-shadow:0 0 0 5px rgba(249,104,89,.16)}
.stat.run i{background:var(--ink);animation:blink 1.6s ease-in-out infinite}
.stat span{color:var(--ink-3);font-weight:400}
@keyframes blink{50%{opacity:.25}}

/* 기본 화면 — 읽음값 하나 + 오른쪽 세 줄, 위아래 선이 맞는다 */
.hm{padding-bottom:48px}
.hero{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:48px;align-items:stretch;padding:44px 0 44px}
.hl{display:flex;flex-direction:column;gap:30px}
.rdg{margin-top:auto}
.cap{font-size:15px;color:var(--ink-3)}
.cap b{color:var(--ink);font-weight:600}
.big{font-family:var(--num);font-weight:500;font-size:168px;line-height:.8;letter-spacing:-.045em;font-variant-numeric:tabular-nums;margin-top:18px;white-space:nowrap}
.big small{font-size:.26em;font-weight:500;letter-spacing:0;margin:0 .2em 0 .05em;color:var(--ink-3)}
.big small:last-child{margin-right:0}
.ro{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2)}
.ro>div{display:grid;grid-template-columns:132px minmax(0,1fr);gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.ro>div:last-child{border-bottom:0}
.ro dt{font-size:13px;color:var(--ink-3)}
.ro dd{font-size:22px;font-weight:600;line-height:1.3}
.ro dd small{display:block;font-size:13px;font-weight:400;color:var(--ink-3);margin-top:4px}
.band{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px 40px;align-items:center;padding:20px 0 22px;border-top:2px solid var(--ink);border-bottom:1px solid var(--line);margin-bottom:8px}
.band h3{font-size:17px;font-weight:600;line-height:1.5}
.band p{font-size:15px;color:var(--ink-2);line-height:1.6;margin-top:4px;max-width:46em}
.band .bb{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
@media (min-width:901px){
  .hm.bd{padding-bottom:24px}
  .hm.bd .hero{padding:28px 0 28px}
  .hm.bd .hl{gap:22px}
  .hm.bd .big{font-size:132px}
  .hm.bd .rl{margin-top:26px}
  .hm.bd .hrs{height:96px}
  .hm.bd .t.p,.hm.bd .t.q,.hm.bd .t.b{height:80px}
  .hm.bd .flag{bottom:88px}
  .hm.bd .keys{margin-top:24px}
  .hm.bd .key{min-height:104px}
}

/* 할 일 건반 둘 — 위 읽음값과 같은 7:5로 나뉜다 */
.keys{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:48px;margin-top:36px}
.key{position:relative;display:block;min-height:124px;padding:22px 24px 24px;border-radius:6px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line-2);transition:background .2s,transform .2s var(--ease)}
.key:hover{background:var(--panel-2)}
.key:active{transform:scale(.99)}
.key h3{font-size:22px;font-weight:600;line-height:1.3}
.key p{font-size:15px;color:var(--ink-3);margin-top:4px;padding-right:64px}
.key .la{position:absolute;right:24px;bottom:26px;width:40px;height:14px}
.key.main{background:var(--ink);color:#0b0b0c;box-shadow:none}
.key.main p{color:#4a4a50}
.key.main:hover{background:#fff}
.khint{font-size:13px;color:var(--ink-3);margin-top:12px}

/* 시간 눈금 */
.rl{margin-top:44px}
.rl-h{display:flex;justify-content:space-between;align-items:baseline;gap:24px;margin-bottom:14px;font-size:13px;color:var(--ink-3)}
.rl-h b{color:var(--ink-2);font-weight:600;font-size:15px}
.lg{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
.lg span{display:inline-flex;align-items:center;gap:7px}
.lg i{display:inline-block;width:2px;height:12px;background:var(--tick);border-radius:1px}
.lg i.s{height:6px;background:var(--ink-3)}
.lg i.o{width:3px;height:3px;border-radius:50%;background:var(--ink-4)}
.lg i.p{width:3px;height:14px;background:var(--ok)}
.lg i.q{width:3px;height:14px;background:var(--ink)}
.lg i.x{background:linear-gradient(var(--tick) 0 35%,transparent 35% 62%,var(--tick) 62%)}
.lg i.b{width:3px;height:14px;background:var(--bad)}
.lg i.r{width:3px;height:12px;background:repeating-linear-gradient(var(--ink) 0 3px,transparent 3px 6px)}
.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.day{position:relative;border-left:1px solid var(--line)}
.day:last-child{border-right:1px solid var(--line)}
.hrs{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));align-items:end;height:124px;padding:0 3px;position:relative}
.t{justify-self:center;width:2px;border-radius:1px;transform-origin:bottom;animation:grow .5s var(--ease) both}
.t.c{height:60px;background:var(--tick)}
.t.s{height:18px;background:var(--ink-3)}
.t.o{width:3px;height:3px;border-radius:50%;background:var(--ink-4)}
.t.n{height:0}
.t.p{width:3px;height:100px;background:var(--ok)}
.t.q{width:3px;height:100px;background:var(--ink)}
.t.x{height:60px;background:linear-gradient(var(--tick) 0 35%,transparent 35% 62%,var(--tick) 62%)}
.t.b{width:3px;height:100px;background:var(--bad)}
.t.r{width:3px;height:60px;background:repeating-linear-gradient(var(--ink) 0 3px,transparent 3px 6px)}
@keyframes grow{from{transform:scaleY(0)}}
.lab{font-size:13px;color:var(--ink-3);padding:10px 0 0 8px;border-top:1px solid var(--line-2)}
.lab b{font-family:var(--num);font-weight:500;margin-left:5px}
.day.today .lab{color:var(--ink)}
.sc{position:relative;height:20px;margin:2px 3px 0}
.sc span{position:absolute;top:0;transform:translateX(-50%);font-family:var(--num);font-size:13px;color:var(--ink-3)}
.flag{position:absolute;bottom:108px;transform:translateX(-50%);font-size:13px;font-weight:600;white-space:nowrap;color:var(--ink-2)}
.flag.l{transform:translateX(calc(-100% - 6px))}
.nowm{position:absolute;top:-6px;bottom:0;width:0;border-left:1px dashed var(--ink-2)}
.nowm span{position:absolute;top:-24px;left:0;transform:translateX(-50%);font-size:13px;font-weight:600;white-space:nowrap}
.rl-f{display:flex;justify-content:flex-end;margin-top:10px;font-size:13px;color:var(--ink-3)}

/* 단추 */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 26px;border-radius:999px;font-size:15px;font-weight:600;white-space:nowrap;transition:transform .2s var(--ease),background .2s,box-shadow .2s}
.btn:active{transform:scale(.97)}
.btn-solid{background:var(--ink);color:#0b0b0c}
.btn-solid:hover{background:#fff}
.btn-line{box-shadow:inset 0 0 0 1px var(--line-2);color:var(--ink)}
.btn-line:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.lnk{display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:var(--ink);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px;text-decoration-color:var(--ink-4)}
.lnk:hover{text-decoration-color:currentColor}
.lnk .la{width:24px}
.hint{font-size:13px;color:var(--ink-3)}

/* 흐름 화면 — 판이 짧아도 결정 막대는 창 바닥에 */
.fw{min-height:100vh;display:flex;flex-direction:column}
.fw>.w{width:100%}
.pad{padding-bottom:32px}
.fhead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px 56px;align-items:end;padding:44px 0 34px}
.kick{font-size:15px;font-weight:600;color:var(--ink-3);margin-bottom:14px}
h1{font-size:48px;line-height:1.16;font-weight:600;letter-spacing:-.01em}
h1 .soft{color:var(--ink-3)}
.fsub{margin-top:14px;font-size:17px;line-height:1.6;color:var(--ink-2);max-width:40em}
.fsub b{color:var(--ink);font-weight:600}
.rd{text-align:right}
.rd .v{font-family:var(--num);font-weight:500;font-size:88px;line-height:.9;letter-spacing:-.035em;font-variant-numeric:tabular-nums;white-space:nowrap}
.rd .v small{font-size:.4em;letter-spacing:0;margin-left:.06em;color:var(--ink-3)}
.rd .v.ok{color:var(--ok)}
.rd .k{font-size:13px;color:var(--ink-3);margin-top:12px}
.pn{background:var(--panel);border:1px solid var(--line);padding:26px 28px}
.pn+.pn{margin-top:16px}
.pn-h{display:flex;justify-content:space-between;align-items:baseline;gap:16px;font-size:13px;color:var(--ink-3);padding-bottom:12px;border-bottom:1px solid var(--line-2);margin-bottom:4px}
.pn-h b{font-size:15px;font-weight:600;color:var(--ink)}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cols>.pn+.pn{margin-top:0}
.tr{display:grid;grid-template-columns:28px minmax(0,1.4fr) minmax(0,1.6fr) 110px 90px;gap:16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.tr:last-child{border-bottom:0}
.tr .nm{font-size:15px;font-weight:600}
.tr .ds{font-family:var(--num);font-size:13px;color:var(--ink-3);overflow-wrap:anywhere}
.tr .n{font-family:var(--num);font-size:15px;text-align:right;color:var(--ink-2)}
.tr .n b{color:var(--ink);font-weight:600}
.cb{width:22px;height:22px;border-radius:4px;background:var(--ink);color:#0b0b0c;display:grid;place-items:center;flex:none}
.cb .ic{width:16px;height:16px;stroke-width:2.2}
.cb.off{background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink-4)}
.kv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--line);font-size:15px}
.kv:last-child{border-bottom:0}
.kv>span{color:var(--ink-3)}
.kv>b{font-family:var(--num);font-weight:600;text-align:right}
.kv.tot{border-top:1px solid var(--line-2);border-bottom:0}
.kv.tot>span{color:var(--ink)}
.kv.sub{padding:6px 0 6px 16px;font-size:13px;border-bottom:0}
.kv.sub>b{font-weight:500;color:var(--ink-2)}
.kv .bad{color:var(--bad)}
.notes{display:grid;gap:10px}
.note{position:relative;padding-left:17px;font-size:15px;line-height:1.6;color:var(--ink-2)}
.note::before{content:"";position:absolute;left:0;top:10px;width:5px;height:5px;border-radius:50%;background:var(--ink-4)}
.note b{color:var(--ink);font-weight:600}
.bar{height:4px;background:var(--line-2);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--ink)}
.fbar{position:sticky;bottom:0;z-index:4;margin-top:auto;background:rgba(14,14,15,.92);backdrop-filter:blur(12px);border-top:1px solid var(--line-2)}
.fbar .w{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:88px}
.fbar .fb{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
.fbar .hint{max-width:46em;font-size:13px;line-height:1.55}
.fbar .alt{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;font-size:13px;color:var(--ink-3)}
.fbar .alt .lnk{font-size:13px}

/* 보호 범위(첫 시작 2) — 폴더마다 차지하는 몫을 빗금으로 */
.cols-scope{grid-template-columns:minmax(0,1fr) minmax(0,380px);align-items:start}
.fr{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(0,200px) 92px;gap:20px;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}
.fr:last-child{border-bottom:0}
.fr .nm{font-size:17px;font-weight:600;line-height:1.4}
.fr .ds{font-family:var(--num);font-size:13px;color:var(--ink-3);overflow-wrap:anywhere}
.fr .sz{text-align:right;line-height:1.35}
.fr .sz b{display:block;font-family:var(--num);font-size:17px;font-weight:600}
.fr .sz span{font-family:var(--num);font-size:13px;color:var(--ink-3)}
.share{height:10px;border:1px solid var(--line-2);position:relative}
.share i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--ink-2) 0 1.2px,transparent 1.2px 4.5px);border-right:2px solid var(--ink)}
.side{display:grid;gap:20px}
.qh{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--ink-3);margin-bottom:8px}
.qh b{color:var(--ink);font-weight:600;font-family:var(--num);font-size:22px}
.hatch{height:16px;border:1px solid var(--line-2);position:relative;background:var(--panel-2)}
.hatch i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--ink-2) 0 1.4px,transparent 1.4px 5px);border-right:2px solid var(--ink)}
.side p{font-size:15px;line-height:1.6;color:var(--ink-2)}
.side p.fine{font-size:13px;color:var(--ink-3);padding-top:16px;border-top:1px solid var(--line)}

/* 고르기 둘(옮겨 오기 1) — 불이 들어온 쪽이 고른 자리 */
.ch{position:relative;display:block;min-height:100%;padding:30px 28px 26px;border-radius:6px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line-2);transition:box-shadow .2s,background .2s}
.ch::before{content:"";position:absolute;left:28px;top:0;width:40px;height:4px;border-radius:0 0 2px 2px;background:var(--line-2)}
.ch.on{background:var(--panel-2);box-shadow:inset 0 0 0 1.5px var(--ink)}
.ch.on::before{background:var(--ink)}
.ch .ck{font-size:13px;color:var(--ink-3);margin-bottom:10px}
.ch.on .ck{color:var(--ink);font-weight:600}
.ch h3{font-size:22px;font-weight:600;line-height:1.3}
.ch .pth{font-family:var(--num);font-size:13px;color:var(--ink-3);margin-top:4px}
.ch .why{font-size:15px;line-height:1.6;color:var(--ink-2);margin-top:12px}
.spec{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line-2);margin-top:28px}
.spec>div{padding:14px 20px 0 0}
.spec>div+div{padding-left:20px;border-left:1px solid var(--line)}
.spec dt{font-size:13px;color:var(--ink-3)}
.spec dd{font-size:15px;line-height:1.55;color:var(--ink);margin-top:4px}

/* 진행 줄(옮겨 오기 2) */
.pg{display:grid;grid-template-columns:120px minmax(0,1fr) 150px;gap:20px;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}
.pg:last-child{border-bottom:0}
.pg .nm{font-size:17px;font-weight:600}
.pg .n{font-family:var(--num);font-size:15px;text-align:right;color:var(--ink-2)}
.pg .bar i.wait{background:none}

/* 결과 빗금 막대(옮겨 오기 3) */
.stk{display:flex;height:22px;margin:18px 0 6px;border:1px solid var(--line-2)}
.stk i{display:block;height:100%}
.stk .a{background:repeating-linear-gradient(-45deg,var(--ink-2) 0 1.4px,transparent 1.4px 5px)}
.stk .b{background:var(--ink-4)}
.stk .c{background:var(--ink-2)}
.stk .d{background:var(--ink-3)}

/* 단계 넷(분실 신고 · 첫 백업) · 세 걸음(되돌리기) */
.st4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}
.st4>div{padding:6px 22px 4px 0}
.st4>div+div{padding-left:22px;border-left:1px solid var(--line)}
.st4 .k{font-family:var(--num);font-size:13px;color:var(--ink-3);display:flex;align-items:center;gap:8px;margin-bottom:10px}
.st4 .k i{width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--ink-3)}
.st4 .k i.f{background:var(--ink);box-shadow:none}
.st4 .now .k{color:var(--ink)}.st4 .now .k i{background:var(--ink);box-shadow:none}
.st4 h3{font-size:17px;font-weight:600;line-height:1.45}
.st4 p{font-size:13px;line-height:1.6;color:var(--ink-3);margin-top:6px}
.lk{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px}
.lk .lnk{font-size:13px;gap:6px}
.lk .ic{width:15px;height:15px}
.st1{display:grid}
.st1>div{padding:12px 0;border-top:1px solid var(--line)}
.st1>div:first-child{border-top:0}
.st1 .k{font-family:var(--num);font-size:13px;color:var(--ink-3);margin-bottom:4px}
.st1 h3{font-size:17px;font-weight:600;line-height:1.45}
.st1 p{font-size:13px;line-height:1.6;color:var(--ink-3);margin-top:4px}

/* 되돌리기 그래프(빗금 막대) */
.why{font-size:13px;color:var(--ink-3);margin-top:12px}
.bars{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));align-items:end;gap:8px;height:230px;border-bottom:1px solid var(--ink-2);position:relative;margin-top:30px}
.bars .b{position:relative;background:repeating-linear-gradient(-45deg,var(--ink-3) 0 1.2px,transparent 1.2px 4.5px);border-top:1.5px solid var(--ink-2);min-height:2px}
.bars .b.hot{background:repeating-linear-gradient(-45deg,var(--bad) 0 1.6px,transparent 1.6px 5px);border-top:2px solid var(--bad)}
.bars .b.z{background:none;border-top:1.5px solid var(--ink-4)}
.bars .v{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);font-family:var(--num);font-size:15px;font-weight:600;color:var(--bad);white-space:nowrap}
.bars .v.side{bottom:auto;top:-2px;left:calc(100% + 6px);transform:none}
.bars .pick{position:absolute;top:-6px;bottom:-10px;width:0;border-left:2px solid var(--ink)}
.bars .pick span{position:absolute;top:38%;right:10px;font-size:13px;font-weight:700;white-space:nowrap}
.ticks{display:grid;grid-template-columns:repeat(25,minmax(0,1fr));gap:8px;margin-top:10px;font-family:var(--num);font-size:13px;color:var(--ink-3)}
.ticks span{visibility:hidden;text-align:center;white-space:nowrap}
.ticks span.s{visibility:visible}
.ticks span.d{visibility:visible;text-align:left;color:var(--ink);font-weight:600}
.hero-start{padding-bottom:44px}
.h-start{font-size:64px;line-height:1.1}
.cols-code{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);align-items:start}

/* 복구 코드 — 인쇄할 흰 종이 한 장 */
.paper{background:#fff;color:#0b0b0c;padding:38px 44px 34px;max-width:620px}
.paper .ttl{display:flex;justify-content:space-between;align-items:flex-start}
.paper h2{font-size:22px;font-weight:700}
.paper .mark{height:16px}
.paper .meta{font-size:13px;color:#5f5f66;margin-top:6px}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 0;margin:24px 0 20px;padding:20px 0;border-top:1.5px solid #0b0b0c;border-bottom:1.5px solid #0b0b0c}
.cg span{font-family:var(--num);font-size:20px;font-weight:600;letter-spacing:.12em;text-align:center}
.paper .use{font-size:13px;line-height:1.6;color:#45454b}
.paper .use b{color:#0b0b0c}

/* 알림(Windows 어두운 판) */
.toasts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.tw{display:flex;flex-direction:column;gap:8px}
.toast{background:#2b2b2d;border-radius:8px;padding:12px 14px 14px;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 10px 24px -10px rgba(0,0,0,.6);font-family:"Segoe UI Variable","Segoe UI","SYNK Sans",sans-serif}
.toast .app{display:flex;align-items:center;gap:8px;font-size:12px;color:#c9c9ce;margin-bottom:8px}
.toast .app i{width:16px;height:16px;border-radius:4px;background:#f2f2f3;display:grid;place-items:center}
.toast .app i svg{width:10px;height:auto;fill:#0b0b0c}
.toast h4{margin:0;font-size:14px;font-weight:600;line-height:1.4;color:#fff}
.toast p{font-size:13px;line-height:1.45;color:#d2d2d6;margin-top:2px}
.toast .tb{margin-top:10px;height:32px;border-radius:4px;background:#3a3a3d;display:grid;place-items:center;font-size:13px;font-weight:600;color:#fff}
.tw .when{font-size:13px;color:var(--ink-3);padding-left:2px}
.tw .when b{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:1px;background:var(--ink-3)}
.tw .when b.ok{background:var(--ok)}.tw .when b.warn{background:var(--warn)}.tw .when b.bad{background:var(--bad)}

/* 설정 서랍 — 뒤 화면과 갈리게 한 단 밝은 판 */
.dim{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:5}
.drawer{position:fixed;top:0;right:0;bottom:0;width:540px;background:#1f1f22;border-left:1px solid rgba(255,255,255,.22);box-shadow:-40px 0 80px -20px rgba(0,0,0,.8);z-index:6;overflow:auto;padding:24px 36px 40px;animation:slide .5s var(--ease) both}
@keyframes slide{from{transform:translateX(40px);opacity:0}}
.drawer .dh{display:flex;align-items:center;justify-content:space-between}
.drawer .dh h2{font-size:34px;font-weight:600}
.drawer .who{font-size:13px;color:var(--ink-3);margin:6px 0 10px}
.dg{margin-top:24px}
.dg h3{font-size:13px;font-weight:600;color:var(--ink-3);padding-bottom:8px;border-bottom:1px solid var(--line-2)}
.dr{display:grid;grid-template-columns:1fr auto;gap:2px 16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.dr .nm{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.dr .nm i{width:7px;height:7px;border-radius:50%;background:var(--warn)}
.dr .vl{grid-column:1;font-size:13px;color:var(--ink-3);line-height:1.5}
.dr .lnk{grid-row:1/3;grid-column:2;font-size:13px}

/* 웹(메일 링크) */
.web .w{max-width:760px}
.web .card{border:1px solid var(--line-2);background:var(--panel);padding:8px 24px;margin:30px 0 28px}

/* ── 좁은 창(390) ─────────────────────────── */
@media (max-width:900px){
  .w{padding:0 20px}
  .top{height:60px}
  .top-r .acct{display:none}
  .hm{display:flex;flex-direction:column;padding-bottom:32px}
  .hm>.band{order:1}
  .hm>.keys{order:2}
  .hm>.khint{order:3}
  .hm>.rl{order:4}
  .hm>.hint{order:5}
  .hero{grid-template-columns:1fr;gap:24px;padding:24px 0 8px}
  .hl{gap:22px}
  .big{font-size:96px;margin-top:12px}
  .cap{font-size:15px}
  .ro>div{grid-template-columns:104px minmax(0,1fr);padding:12px 0}
  .ro dd{font-size:17px}
  .rl{display:flex;flex-direction:column;margin-top:36px}
  .rl>.rl-f{order:1;margin:0 0 14px;justify-content:flex-start}
  .rl>.days{order:2}
  .rl-h{flex-direction:column;align-items:flex-start;gap:8px}
  .lg{gap:6px 14px}
  .days{grid-template-columns:1fr}
  .day{display:grid;grid-template-columns:56px minmax(0,1fr);align-items:end;border-left:0;border-top:1px solid var(--line)}
  .day:last-child{border-right:0;border-bottom:1px solid var(--line)}
  .day .lab{grid-column:1;grid-row:1;border-top:0;padding:0 0 6px;font-size:13px;white-space:nowrap}
  .day .lab b{margin-left:3px}
  .day .lab .td{display:none}
  .hrs{grid-column:2;grid-row:1;height:40px;padding:0}
  .sc{grid-column:2;grid-row:2;margin:4px 0 6px}
  .t.c,.t.x,.t.r{height:20px}
  .t.s{height:7px}
  .t.p,.t.q,.t.b{height:32px}
  .flag{display:none}
  .nowm{top:2px}
  .nowm span{display:none}
  .keys{grid-template-columns:1fr;gap:12px;margin-top:20px}
  .key{min-height:0;padding:18px 20px 20px}
  .key h3{font-size:19px}
  .key .la{bottom:22px;right:20px}
  .band{grid-template-columns:1fr}
  .band .bb{justify-content:stretch}
  .band .bb .btn{flex:1 1 100%}
  .segs .seg span{display:none}
  .seg.on span{display:inline}
  .fhead{grid-template-columns:1fr;padding:26px 0 24px;gap:20px}
  h1{font-size:30px;line-height:1.24;letter-spacing:0}
  .fsub{font-size:15px}
  .rd{text-align:left}
  .rd .v{font-size:64px}
  .pn{padding:18px 16px}
  .cols,.cols-scope{grid-template-columns:1fr}
  .tr{grid-template-columns:28px minmax(0,1fr) auto;gap:4px 12px}
  .tr .ds{grid-column:2;grid-row:2}
  .tr .n{grid-column:3;grid-row:1/3}
  .tr .n+.n{display:none}
  .fr{grid-template-columns:28px minmax(0,1fr) auto;gap:6px 12px}
  .fr .share{grid-column:2/-1;grid-row:2}
  .fbar .w{flex-direction:column;align-items:stretch;gap:10px;padding:12px 20px 16px;min-height:0}
  .fbar .fb{flex-direction:column-reverse;align-items:stretch}
  .fbar .btn{width:100%}
  .fbar .fb .lnk{align-self:center;padding:6px 0}
  .ch{padding:26px 18px 20px}
  .ch::before{left:18px}
  .ch h3{font-size:19px}
  .spec{grid-template-columns:1fr}
  .spec>div,.spec>div+div{padding:12px 0;border-left:0;border-top:1px solid var(--line)}
  .spec>div:first-child{border-top:0}
  .pg{grid-template-columns:1fr auto;gap:8px 12px}
  .pg .bar{grid-column:1/-1;grid-row:2}
  .st4{grid-template-columns:1fr}
  .st4>div,.st4>div+div{padding:14px 0;border-left:0;border-top:1px solid var(--line)}
  .st4>div:first-child{border-top:0;padding-top:4px}
  .bars{gap:2px;height:170px}
  .bars .v{font-size:13px}
  .ticks{gap:2px}
  .ticks span.s{visibility:hidden}
  .paper{padding:26px 20px 24px}
  .cols-code{grid-template-columns:1fr}
  .h-start{font-size:38px;line-height:1.18}
  .cg span{font-size:16px;letter-spacing:.08em}
  .toasts{grid-template-columns:1fr}
  .drawer{width:100%;padding:16px 20px 32px;border-left:0}
  .drawer .dh h2{font-size:28px}
}
body.is-full .fbar{position:static}
`;

/* ── 조각 ─────────────────────────────────────── */
const pp = (w, pair) => josa(w, pair).slice(w.length); // 조사만
const notes = (list) => `<div class="notes">${list.map((t) => `<p class="note">${t}</p>`).join('')}</div>`;
// 큰 숫자는 시계가 아니라 기록으로 읽히게 — 「14시 02분」, 단위는 작고 회색
const clock = (t) => { const [h, m] = t.split(':'); return `${h}<small>시</small>${m}<small>분</small>`; };

function top({ flow, back = true, right = true, acct = D.device } = {}) {
  if (!flow) return `<header class="top"><div class="brand">${MARK}<span class="bar"></span><span>${D.app}</span></div><div class="top-r">${acct ? `<span class="acct">${acct}</span>` : ''}${right ? '<button class="tbtn" type="button">설정</button>' : ''}</div></header>`;
  return `<header class="top"><div class="flowname">${back ? '<button class="tbtn" type="button">뒤로</button>' : ''}<span>${flow}</span></div>${right ? '<div class="top-r"><button class="tbtn" type="button">닫기</button></div>' : ''}</header>`;
}
const segs = (names, cur) => `<div class="segs" aria-label="${cur} / ${names.length} 단계">${names.map((n, i) => `<div class="seg ${i + 1 < cur ? 'done' : i + 1 === cur ? 'on' : ''}"><b>${i + 1}</b><span>${n}</span></div>`).join('')}</div>`;
const MOVE = ['자리 고르기', '옮겨 오기', '결과', '다시 깔 것'];
const UNDO = ['시각', '미리 보기', '되돌린 뒤 고르기'];

function fhead({ kick, h1, sub, v, vTone = '', k }) {
  return `<div class="fhead"><div>${kick ? `<p class="kick">${kick}</p>` : ''}<h1>${h1}</h1>${sub ? `<p class="fsub">${sub}</p>` : ''}</div>
    ${v ? `<div class="rd"><p class="v ${vTone}">${v}</p>${k ? `<p class="k">${k}</p>` : ''}</div>` : ''}</div>`;
}
const fbar = (hint, btns) => `<div class="fbar"><div class="w"><div class="hint">${hint || ''}</div><div class="fb">${btns}</div></div></div>`;
const flow = (inner, bar = '') => `<div class="fw"><div class="w pad">${inner}</div>${bar}</div>`;
const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span>${k}</span><b>${v}</b></div>`;

// 시간 눈금: WEEK(copy.mjs) + 상태별 덧칠. 되살려 본 칸은 「안전」일 때만 초록(상태 색과 같은 뜻), 아니면 잉크.
function ruler(mode = 'ok', head = '<b>지난 7일</b> · 한 칸이 한 시간의 확인입니다') {
  const days = WEEK.map((d) => ({ ...d, hours: [...d.hours] }));
  const today = days[6];
  if (mode === 'run') today.hours[15] = 'r';
  if (mode === 'partial') [10, 11, 12, 14].forEach((h) => { today.hours[h] = 'x'; });
  if (mode === 'mass') today.hours[11] = 'b';
  if (mode === 'empty') days.forEach((d) => d.hours.fill('o'));
  const green = ['ok', 'run', 'partial'].includes(mode);
  if (!green) days.forEach((d) => { d.hours = d.hours.map((t) => (t === 'p' ? 'q' : t)); });
  const nowAt = { run: 15.4, moved: 15.7 }[mode] ?? 14.6;
  const pos = (h) => `left:${((h + 0.5) / 24) * 100}%`;
  return `<section class="rl" aria-label="지난 7일 확인 기록">
    <div class="rl-h"><span>${head}</span></div>
    <div class="days">${days.map((d) => {
      const pi = d.hours.findIndex((t) => t === 'p' || t === 'q');
      const bi = d.hours.indexOf('b');
      return `<div class="day ${d.today ? 'today' : ''}">
      <div class="hrs">${d.hours.map((t) => `<i class="t ${t}"></i>`).join('')}
        ${pi >= 0 ? `<span class="flag" style="${pos(pi)}">되살려 봄 · 모두 같음</span>` : ''}
        ${bi >= 0 ? `<span class="flag l" style="${pos(bi)}">${D.mass.count}개 지워짐</span>` : ''}
        ${d.today && mode !== 'empty' ? `<span class="nowm" style="left:${(nowAt / 24) * 100}%"><span>지금</span></span>` : ''}
      </div>
      <p class="lab">${d.dow}<b>${d.d}</b>${d.today ? '<span class="td"> · 오늘</span>' : ''}</p>
      ${d.today ? '<p class="sc" aria-hidden="true"><span style="left:25%">6시</span><span style="left:50%">12시</span><span style="left:75%">18시</span></p>' : ''}</div>`;
    }).join('')}</div>
    <div class="rl-f"><span class="lg"><span><i></i>지킴</span>${mode === 'partial' ? '<span><i class="x"></i>쓰는 중인 파일만 앞 판</span>' : ''}${mode === 'run' ? '<span><i class="r"></i>지금 도는 중</span>' : ''}<span><i class="s"></i>쉼(배터리 · 절전 · 휴대폰 데이터)</span><span><i class="o"></i>꺼져 있거나 잠듦</span><span><i class="${green ? 'p' : 'q'}"></i>되살려 봄</span>${mode === 'mass' ? '<span><i class="b"></i>한꺼번에 지워짐</span>' : ''}</span></div>
  </section>`;
}

// 할 일 건반 둘 — 채운 건반(주 행동) 하나 + 선 건반 하나
function keys(second = { h: '새 PC로 옮겨 오기', p: '이 계정의 백업을 다른 PC에 그대로', href: '#move-1' }) {
  return `<div class="keys">
    <a class="key main" href="#restore"><h3>파일 되살리기</h3><p>가장 최근 판 · 오늘 <span class="num">${D.last.h24}</span></p>${ICON.rarr}</a>
    <a class="key" href="${second.href}"><h3>${second.h}</h3><p>${second.p}</p>${ICON.rarr}</a>
  </div>`;
}

const ro = (rows) => `<dl class="ro">${rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v}${s ? `<small>${s}</small>` : ''}</dd></div>`).join('')}</dl>`;
const NEXT = ['다음 확인', `<span class="num">${D.next.h24}</span> 무렵`, '매시간 · 로그인 직후 · 깨어난 직후'];
const PROOF = ['되살려 본 날', `<span class="num">${D.proof.dots}</span>`, `무작위 파일 ${D.proof.files}개(${D.proof.size}), <span class="keep">모두 원본과 같음</span>`];
const KEEP = ['지키는 것', `<span class="num">${D.total.files}</span>개 · <span class="num">${D.total.size}</span>`, '폴더 네 곳'];

function home({ stat, cap, big, rows, band = '', mode = 'ok', k = keys(), hint = '' }) {
  return `<div class="w hm${band ? ' bd' : ''}">${top()}
    <section class="hero"><div class="hl">${stat}<div class="rdg"><p class="cap">${cap}</p><p class="big">${big}</p></div></div>${ro(rows)}</section>
    ${band}
    ${ruler(mode)}
    ${k}
    ${hint ? `<p class="khint">${hint}</p>` : ''}
  </div>`;
}

/* ── 화면 ─────────────────────────────────────── */
const S = {};

S.home = () => home({
  stat: '<p class="stat ok"><i></i>안전함<span>· 매시간 저절로 확인</span></p>',
  cap: `마지막 확인 · <b>오늘</b> · ${D.device}`,
  big: clock(D.last.h24),
  rows: [NEXT, PROOF, KEEP],
});

S['home-run'] = () => home({
  stat: `<p class="stat run"><i></i>${D.run.kind} · ${D.run.stage}<span>· 창을 닫아도 계속됩니다</span></p>`,
  cap: `바뀐 파일 ${D.run.changed}개 · <b class="num">${D.run.done} / ${D.run.all}</b> · <span class="num">${D.run.startKo.replace('오후 3:02', '15:02')}</span> 시작`,
  big: `${D.run.pct}<small>%</small>`,
  rows: [['다음 확인', `<span class="num">${D.nextRun.h24}</span> 무렵`, '지금 도는 회차가 끝난 뒤'], ['마지막 확인', `<span class="num">${D.last.h24}</span>`, '그동안 되살리는 판'], PROOF],
  mode: 'run',
  hint: `지금 누르면 ${josa(D.run.kind, '이/가')} 끝나는 대로 이어서 엽니다.`,
});

S['home-partial'] = () => home({
  stat: `<p class="stat ok"><i></i>안전함<span>· 쓰는 중인 파일 ${D.partial.count}개는 ${D.partial.keptH24} 판으로</span></p>`,
  cap: `마지막 확인 · <b>오늘</b> · <a class="lnk" href="#partial" style="font-size:15px">쓰는 중인 파일 보기 ${ICON.rarr}</a>`,
  big: clock(D.last.h24),
  rows: [NEXT, PROOF, ['지키는 것', `<span class="num">${D.total.files}</span>개 · <span class="num">${D.total.size}</span>`, `${D.partial.count}개는 <span class="num">${D.partial.keptH24}</span> 판 · ${D.partial.program}`]],
  mode: 'partial',
});

S['home-missing'] = () => home({
  stat: '<p class="stat warn"><i></i>확인 필요<span>· 폴더 하나를 찾을 수 없음</span></p>',
  cap: '마지막 확인 · <b>오늘</b> · 나머지 세 곳',
  big: clock(D.last.h24),
  rows: [NEXT, PROOF, ['지키는 것', `<span class="num">${D.missing.restFiles}</span>개 · 세 곳`, `「${D.missing.name}」${pp(D.missing.name, '은/는')} 찾을 수 없음`]],
  mode: 'missing',
  band: `<div class="band"><div><h3>「${D.missing.name}」(<span class="num">${D.missing.path}</span>)${pp(D.missing.name, '을/를')} 찾을 수 없어 그 폴더만 빼고 백업했습니다.</h3><p>그 폴더가 든 마지막 판(<span class="num">${D.missing.keptDots}</span>)은 지워지지 않게 붙들어 둡니다. 드라이브를 다시 꽂으면 저절로 이어서 지킵니다. 목록에서 빼면 그 폴더의 백업은 30일 뒤 지워집니다.</p></div>
    <div class="bb"><button class="btn btn-line" type="button">목록에서 빼기</button><button class="btn btn-solid" type="button">다시 고르기</button></div></div>`,
});

S['home-mass'] = () => home({
  stat: '<p class="stat bad"><i></i>옛 판 정리 멈춤<span>· 많은 파일이 한꺼번에 지워짐</span></p>',
  cap: `「${D.mass.folder}」에서 지워진 파일 · <b>${D.mass.whenKo}</b>`,
  big: `${D.mass.count}<small>개</small>`,
  rows: [NEXT, PROOF, ['지키는 것', `<span class="num">${D.mass.totalNow}</span>개 · <span class="num">${D.mass.sizeNow}</span>`, `지우기 전 판 <span class="num">${D.mass.totalBefore}</span>개는 붙들어 둠`]],
  mode: 'mass',
  band: `<div class="band"><div><h3>확인하기 전까지 이전 판을 지우지 않습니다.</h3><p>직접 지웠거나, 폴더를 옮기거나 이름을 바꿨다면 「내가 한 일이 맞음」을 누르세요. 모르는 일이면 지워지기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.</p></div>
    <div class="bb"><button class="btn btn-line" type="button">내가 한 일이 맞음</button><button class="btn btn-solid" type="button">지워지기 전으로 되살리기</button></div></div>`,
});

S['home-moved'] = () => home({
  stat: `<p class="stat warn"><i></i>백업 쉼<span>· 「${D.moved.to}」${pp(D.moved.to, '으로/로')} 옮겨짐</span></p>`,
  cap: '이 PC의 마지막 확인 · <b>오늘</b>',
  big: clock(D.last.h24),
  rows: [['이어 받은 기기', D.moved.to, `오늘 <span class="num">${D.moved.h24}</span>부터 그 PC가 백업`], PROOF, KEEP],
  mode: 'moved',
  band: `<div class="band"><div><h3>여기서 고친 파일은 백업되지 않습니다.</h3><p>이 PC의 백업은 「${D.moved.to}」${pp(D.moved.to, '으로/로')} 옮겨졌습니다. 오늘 <span class="num">${D.last.h24}</span>까지의 판은 그대로라 파일 되살리기는 계속 쓸 수 있습니다.</p></div></div>`,
  k: keys({ h: '이 PC로 다시 백업', p: `「${D.moved.to}」${pp(D.moved.to, '은/는')} 백업을 멈추고, 그 PC와 메일로 알립니다`, href: '#home' }),
});

S['start-1'] = () => `<div class="w hm">${top({ right: false, acct: '' })}
  <section class="hero hero-start"><div class="hl">
    <p class="stat"><i></i>설정할 것이 없습니다</p>
    <div><h1 class="h-start">업무 자료를<br><span class="soft">매시간 저절로 지킵니다.</span></h1>
    <p class="fsub" style="margin-top:20px">Google 계정으로 시작하면 이 PC의 문서 · 바탕화면 · 사진과 찾아낸 작업 폴더를 암호화해 클라우드에 올립니다.</p>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px;margin-top:30px"><button class="btn btn-solid" type="button">${ICON.google}Google로 시작</button><span class="hint">브라우저가 열리면 계정을 고르고 「계속」을 누르세요.</span></div></div>
  </div>
  <div style="align-self:end">${notes([
    '<b>SYNK도 백업 내용을 열 수 없습니다.</b> 여는 열쇠는 내 Google 계정에만 맡깁니다.',
    '그래서 Google 계정에 들어갈 수 있는 사람은 백업도 열 수 있습니다. <b>Google 2단계 인증을 켜 두세요.</b>',
  ])}</div></section>
  ${ruler('empty', '<b>첫 백업이 끝나면</b> 여기에 한 시간마다 한 칸씩 쌓입니다')}
  <p class="hint" style="margin-top:28px">${TELEMETRY}</p>
</div>`;

S['start-2'] = () => {
  const total = parseFloat(D.total.size);
  return flow(`${top({ acct: '', right: false })}
  ${fhead({ kick: `${D.device} · 보호 범위`, h1: '이 폴더를 지킵니다.', sub: '고른 그대로 두면 됩니다. 「보호 시작」을 누르면 목록의 폴더를 암호화해 올리기 시작합니다.' })}
  <div class="cols cols-scope">
    <section class="pn"><div class="pn-h"><b>보호 범위</b><span class="num">예상 ${D.total.files}개 · ${D.total.size}</span></div>
      ${D.folders.map((f) => `<div class="fr"><span class="cb">${ICON.check}</span><div><p class="nm">${f.name}</p><p class="ds">${f.found ? '찾아낸 작업 폴더 · ' : ''}${f.path}</p></div><div class="share" aria-hidden="true"><i style="width:${((parseFloat(f.size) / total) * 100).toFixed(1)}%"></i></div><p class="sz"><b>${f.size}</b><span>${f.files}개</span></p></div>`).join('')}
    </section>
    <section class="pn side">
      <div><p class="qh"><span>지키는 양</span><span><b>${D.total.size}</b> / <span class="num">${D.cap}</span>까지</span></p><div class="hatch"><i style="width:${D.capPct}%"></i></div></div>
      <p>OneDrive에만 있는 파일 <b class="num">${D.onedriveOnly}</b>개는 OneDrive가 지킵니다. 이 백업에는 담지 않습니다.</p>
      <p class="fine">${TELEMETRY}</p>
    </section>
  </div>`, fbar('', '<button class="btn btn-line" type="button">다른 폴더 더하기</button><button class="btn btn-solid" type="button">보호 시작</button>'));
};

S['start-3'] = () => flow(`${top({ right: false, acct: '' })}
  ${fhead({ kick: `${D.device} · 첫 백업`, h1: '첫 백업을 하고 있습니다.', sub: '창을 닫아도 됩니다. 끝나면 알려 드립니다.', v: '31<small>%</small>', k: `5.7GB / ${D.total.size}` })}
  <section class="pn"><div class="pn-h"><b>준비</b><span>앱이 혼자 합니다</span></div>
    <div class="st4">
      <div><p class="k"><i class="f"></i>끝</p><h3>내 클라우드 자리 만들기</h3></div>
      <div><p class="k"><i class="f"></i>끝</p><h3>복구 정보를 내 Google 계정에 맡기기</h3><p>맡긴 뒤 다시 받아 열리는지까지 봤습니다.</p></div>
      <div><p class="k"><i class="f"></i>끝</p><h3>매시간 저절로 돌게 등록하기</h3><p>앱을 닫아도 Windows가 띄웁니다.</p></div>
      <div class="now"><p class="k"><i></i><span class="num">31%</span></p><h3>첫 백업 · 올리는 중</h3><div class="bar" style="margin-top:12px"><i style="width:31%"></i></div></div>
    </div></section>
  <section class="pn">${notes(['전원이 연결돼 있는 동안은 절전 모드로 들어가지 않습니다.', '첫 백업 뒤로는 매시간 · 로그인 직후 · 깨어난 직후에 바뀐 것만 올립니다.'])}</section>`, fbar('', '<button class="btn btn-line" type="button">창 닫기</button>'));

S.restore = () => flow(`${top({ flow: '파일 되살리기' })}
  ${fhead({ kick: `가장 최근 판 · 오늘 <span class="num">${D.last.h24}</span>`, h1: '무엇을 되살릴까요?', sub: '고른 파일은 새 폴더에 되살립니다. 원래 파일은 그대로 두고, 되살린 뒤 백업과 같은지 하나하나 확인합니다.' })}
  <section class="pn"><div class="pn-h" style="border:0;padding:0;margin:0 0 6px">
    <span style="display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;flex:1;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line-2);color:var(--ink)">${ICON.search}<span style="font-size:15px">견적</span><span style="margin-left:auto;font-size:13px;color:var(--ink-3)">5개 찾음</span></span></div>
    ${[
      ['견적서_1112_최종.pdf', '문서 › 견적', '1.2MB', '11. 12.', true],
      ['견적서_1112_최종.hwp', '문서 › 견적', '88KB', '11. 12.', true],
      ['견적 참고 사진.jpg', '사진 › 현장', '4.8MB', '11. 9.', true],
      ['견적 양식.xlsx', '문서 › 양식', '46KB', '10. 2.', false],
      ['2026 견적 모음.zip', '프로젝트 › 보관', '212MB', '9. 30.', false],
    ].map(([n, w, s, d, on]) => `<div class="tr"><span class="cb ${on ? '' : 'off'}">${on ? ICON.check : ''}</span><span class="nm">${n}</span><span class="ds">${w}</span><span class="n">${d}</span><span class="n"><b>${s}</b></span></div>`).join('')}
  </section>`, fbar(`<b style="color:var(--ink);font-size:15px">3개 · 6.1MB 고름</b> · 새 폴더: 문서 › 되살린 파일`, '<button class="btn btn-line" type="button">전부 되살리기</button><button class="btn btn-solid" type="button">고른 3개 되살리기</button>'));

// 쓰는 중인 파일 — 관리자 계정(4시간마다 따로 읽음) · 표준 사용자 계정(닫았을 때 새로 담김)
function partialScreen(std) {
  const p = D.partial;
  const kept = std ? p.stdKeptH24 : p.keptH24;
  return flow(`${top({ flow: '쓰는 중인 파일' })}
  ${fhead({ kick: `부분 보호 안내 · ${std ? '표준 사용자 계정' : '관리자 계정'}`, h1: `파일 ${p.count}개는 <span class="soft"><span class="num">${kept}</span> 판으로 지킵니다.</span>`, sub: `${josa(p.program, '이/가')} 열어 두고 고치는 중이라 ${std ? '그 뒤 확인 때' : `<span class="num">${D.last.h24}</span> 확인 때`} 읽지 못했습니다. 나머지 <b class="num">${p.rest}개</b>는 <span class="num">${D.last.h24}</span> 판입니다.` })}
  <div class="cols">
    <section class="pn"><div class="pn-h"><b>쓰는 중인 파일</b><span>${p.program}</span></div>
      ${p.files.map((f) => kv(`<span style="color:var(--ink);font-weight:600">${f.name}</span><br><span style="font-size:13px">${f.where}</span>`, f.size)).join('')}
      ${kv('지키는 판', `오늘 ${kept}`, 'tot')}</section>
    <section class="pn"><div class="pn-h"><b>새로 담기는 때</b><span>${std ? '표준 사용자 계정' : '관리자 계정'}</span></div>
      <div style="padding-top:12px">${notes(std ? [
        '이 계정은 표준 사용자라, 켜진 프로그램이 쥔 파일은 그 프로그램을 닫았을 때 새로 담깁니다.',
        `퇴근할 때 ${josa(p.program, '을/를')} 닫아 두면 다음 확인 때 오늘 판으로 바뀝니다.`,
        `되살릴 때 이 ${p.count}개는 <span class="num">${kept}</span> 판에서 가져옵니다.`,
      ] : [
        `4시간마다 이 파일만 따로 읽어 새로 담습니다. 다음은 <b>${p.nextFill}</b>입니다.`,
        `${josa(p.program, '을/를')} 닫으면 다음 확인 때 바로 새로 담깁니다.`,
        `되살릴 때 이 ${p.count}개는 <span class="num">${kept}</span> 판에서 가져옵니다.`,
      ])}</div></section>
  </div>`, fbar('', '<button class="btn btn-line" type="button">돌아가기</button>'));
}
S.partial = () => partialScreen(false);
S['partial-std'] = () => partialScreen(true);

S['move-1'] = () => flow(`${top({ flow: '새 PC로 옮겨 오기' })}${segs(MOVE, 1)}
  ${fhead({ kick: `${D.newDevice} · 같은 Google 계정`, h1: '어디에 놓을까요?', sub: `「${D.move.from}」의 백업을 찾았습니다. 마지막 확인은 오늘 <span class="num">${D.last.h24}</span>, <span class="num keep">${D.total.files}개 · ${D.total.size}</span>입니다.` })}
  <div class="cols" role="radiogroup" aria-label="놓을 자리">
    <div class="ch on" role="radio" aria-checked="true"><p class="ck">고른 자리</p><h3>원래 자리</h3><p class="pth">문서 · 바탕화면 · 사진 → 이 PC의 같은 폴더 · D:\\Projects → 같은 경로</p><p class="why">이 PC의 문서 · 바탕화면 · 사진은 OneDrive 밖이라 그대로 놓습니다.</p></div>
    <div class="ch" role="radio" aria-checked="false"><p class="ck">고르기</p><h3>OneDrive 밖 새 폴더</h3><p class="pth">${D.move.newFolder}</p><p class="why">OneDrive와 섞지 않고 따로 받아 둡니다. 문서 폴더가 OneDrive 안에 있는 PC에 권합니다.</p></div>
  </div>
  <dl class="spec">
    <div><dt>이미 있는 파일</dt><dd>덮어쓰지 않고, 다르면 「(복구본)」으로 나란히</dd></div>
    <div><dt>걸리는 시간</dt><dd>약 <span class="num">${D.move.waitMin}</span>분(옛 노트북의 회선 속도로 어림)</dd></div>
    <div><dt>끊기면</dt><dd>멈춘 곳부터 이어 받음</dd></div>
  </dl>`,
  fbar(`<p class="alt"><span>같은 PC를 다시 깔았나요?</span><a class="lnk" href="#move-1">되살리지 않고 이어서 백업</a></p>`, '<button class="btn btn-solid" type="button">이 자리로 옮겨 오기</button>'));

S['move-2'] = () => flow(`${top({ flow: '새 PC로 옮겨 오기', back: false })}${segs(MOVE, 2)}
  ${fhead({ kick: `${D.newDevice} · 옮겨 오는 중`, h1: '옮겨 오고 있습니다.', sub: `<span class="num">${D.move.doneSize} / ${D.total.size}</span> · 남은 시간 약 <b class="num">${D.move.leftMin}분</b>`, v: `${D.move.pct}<small>%</small>`, k: `대조 끝 ${D.move.doneFiles} / ${D.total.files}` })}
  <section class="pn"><div class="pn-h"><b>폴더마다</b><span>대조를 마친 파일만 셉니다</span></div>
    <div class="pg"><span class="nm">문서</span><div class="bar"><i style="width:96%"></i></div><span class="n num">5,117 / 5,310</span></div>
    <div class="pg"><span class="nm">바탕화면</span><div class="bar"><i class="wait"></i></div><span class="n num">기다림 · 420</span></div>
    <div class="pg"><span class="nm">사진</span><div class="bar"><i class="wait"></i></div><span class="n num">기다림 · 4,880</span></div>
    <div class="pg"><span class="nm">프로젝트</span><div class="bar"><i class="wait"></i></div><span class="n num">기다림 · 1,870</span></div></section>
  <section class="pn">${notes(['받은 파일은 하나씩 원본과 같은지 확인한 뒤 자리에 놓습니다.', '끊겨도 처음부터가 아니라 멈춘 곳부터 이어서 합니다. 전원이 연결돼 있는 동안 절전 모드로 들어가지 않습니다.'])}</section>`,
  fbar('', `<button class="btn btn-line" type="button">${ICON.pause}잠시 멈추기</button>`));

S['move-3'] = () => {
  const tot = 12480;
  const pct = (x) => ((x / tot) * 100).toFixed(2);
  const n = (s) => parseInt(s.replace(/,/g, ''), 10);
  return flow(`${top({ flow: '새 PC로 옮겨 오기', back: false })}${segs(MOVE, 3)}
  ${fhead({ kick: `${D.newDevice} · 대조 끝`, h1: '다 옮겨 왔습니다.', sub: '받은 파일은 모두 원본과 한 바이트도 다르지 않습니다.', v: '0', vTone: 'ok', k: '원본과 다른 파일' })}
  <div class="cols">
    <section class="pn"><div class="pn-h"><b>결과</b><span class="num">합계 ${D.total.files}개</span></div>
      <div class="stk" aria-hidden="true"><i class="a" style="width:${pct(n(D.move.restored))}%"></i><i class="b" style="width:${pct(n(D.move.same))}%"></i><i class="c" style="width:max(3px,${pct(n(D.move.sideBySide))}%)"></i><i class="d" style="width:max(3px,${pct(n(D.move.skipped))}%)"></i></div>
      ${kv('되살림', `${D.move.restored}개`)}${kv('이미 있던 같은 파일 · 그대로 둠', `${D.move.same}개`)}${kv('「(복구본)」으로 나란히', `${D.move.sideBySide}개`)}${kv('건너뜀', `${D.move.skipped}개`)}
      ${D.move.skippedList.map((s) => kv(s, '연결 폴더', 'sub')).join('')}
      <p class="hint" style="padding:4px 0 0 16px">${D.move.skippedWhy}</p></section>
    <section class="pn"><div class="pn-h"><b>알아 둘 것</b></div>
      <div style="padding-top:12px">${notes([
        `저절로 실행되는 자리의 파일 <b class="num">${D.move.autorun}</b>개는 원래 자리 대신 「따로 둔 폴더」에 놓았습니다. 옛 PC에 나쁜 프로그램이 있었다면 새 PC에서 저절로 실행되지 않게 하려는 것입니다.`,
        '건너뛴 것이 있어 옛 노트북 백업은 바로 정리하지 않습니다. 필요 없으면 설정 › 내 기기에서 「나머지는 필요 없음」을 누르세요.',
      ])}</div></section>
  </div>`, fbar(`<a class="lnk" href="#move-3" style="font-size:13px">나란히 둔 ${D.move.sideBySide}개 보기</a>`, '<button class="btn btn-solid" type="button">다시 깔 프로그램 보기</button>'));
};

S['move-4'] = () => flow(`${top({ flow: '새 PC로 옮겨 오기' })}${segs(MOVE, 4)}
  ${fhead({ kick: `${D.newDevice} · 마지막 걸음`, h1: '옛 노트북 연결을 끊고<br><span class="soft">이어서 백업합니다.</span>', sub: '끊으면 이 PC가 같은 백업에 이어서 매시간 올립니다. 백업하는 기기는 한 번에 하나라, 옛 노트북은 그때부터 백업하지 않습니다.' })}
  <div class="cols">
    <section class="pn"><div class="pn-h"><b>다시 깔 프로그램</b><span>옛 노트북에서 찾은 것 · ${D.programs.length}개</span></div>
      ${D.programs.map((p) => kv(`<span style="color:var(--ink);font-weight:600">${p.name}</span>`, p.id ? `<span style="font-weight:400;font-size:13px;color:var(--ink-2)">winget install ${p.id}</span>` : '<span style="font-weight:400;font-size:13px;color:var(--ink-3)">공식 사이트에서</span>')).join('')}
      <p class="hint" style="padding-top:10px"><span class="num">winget</span> 줄은 PowerShell에 붙여 넣으면 깔립니다.</p></section>
    <section class="pn"><div class="pn-h"><b>다시 로그인할 곳</b><span>앱이 대신 하지 않습니다</span></div>
      ${D.relogin.map((r) => `<div class="tr" style="grid-template-columns:28px minmax(0,1fr)"><span class="cb off"></span><span><span class="nm" style="display:block">${r.what}</span><span class="ds" style="font-family:var(--sans)">${r.how}</span></span></div>`).join('')}</section>
  </div>`, fbar('<a class="lnk" href="#move-4" style="font-size:13px">끊지 않고 이 PC는 백업하지 않기</a>', '<button class="btn btn-solid" type="button">끊고 이 PC로 이어서 백업</button>'));

S['undo-1'] = () => {
  const max = 3412;
  const T = D.undoTicks;
  const bars = D.undoHours.map(([, v], i) => {
    const hot = v > 1000;
    const h = v === 0 ? 0 : Math.max(0.9, (v / max) * 100);
    return `<div class="b ${hot ? 'hot' : ''} ${v === 0 ? 'z' : ''}" style="height:${h}%">${hot ? `<span class="v${i === 8 ? ' side' : ''}">${v.toLocaleString('en-US')}</span>` : ''}${i === 7 ? `<span class="pick" style="left:-5px"><span>${D.undo.pickH24}</span></span>` : ''}</div>`;
  }).join('');
  const ticks = D.undoHours.map(([h], i) => `<span class="${T.day[i] ? 'd' : T.show.includes(i) ? 's' : ''}">${T.day[i] || h}</span>`).join('');
  return flow(`${top({ flow: '사고가 났을 때 되돌리기' })}${segs(UNDO, 1)}
  ${fhead({ kick: '백업이 바뀌었습니다', h1: '언제로 되돌릴까요?', sub: `11월 12일 15시 무렵부터 지워진 백업 묶음이 한꺼번에 늘었습니다. 그 직전인 <b class="num">${D.undo.pickH24}</b>${pp(D.undo.pickH24, '을/를')} 골라 두었습니다.`, v: `${D.undo.daysLeft}<small>일</small>`, k: `되돌릴 수 있는 날 · <span class="keep">${D.undo.untilH24}</span>까지` })}
  <section class="pn"><div class="pn-h"><b>시간마다 숨겨진 백업 묶음</b><span>11월 12일 8시 ~ 13일 8시 · SYNK 서버가 센 수</span></div>
    <p class="why">백업은 작은 묶음으로 나눠 올리고, 지워진 묶음은 30일 동안 숨겨 둡니다.</p>
    <div class="bars">${bars}</div><div class="ticks">${ticks}</div>
    <p class="hint" style="margin-top:16px">평소에는 지난 판을 정리하며 한 시간에 수십 개씩 숨겨집니다. 15시~17시에만 <b style="color:var(--ink)" class="num">${D.undo.spike}개</b>가 숨겨졌습니다.</p></section>`,
  fbar('<a class="lnk" href="#undo-1" style="font-size:13px">다른 시각 고르기</a>', '<button class="btn btn-solid" type="button">이 시각으로 미리 보기</button>'));
};

S['undo-2'] = () => flow(`${top({ flow: '사고가 났을 때 되돌리기' })}${segs(UNDO, 2)}
  ${fhead({ kick: '미리 보기', h1: `${D.undo.versionKo} 판으로<br><span class="soft">돌아갑니다.</span>`, sub: '되돌리는 것은 클라우드 백업입니다. 이 PC의 파일은 바뀌지 않고, 필요한 파일은 다음 화면에서 새 폴더로 꺼냅니다.', v: D.undo.files, k: `그 시각의 판 · ${D.undo.size}` })}
  <div class="cols">
    <section class="pn"><div class="pn-h"><b>되돌리면</b><span>지우는 것은 없습니다</span></div>
      <div class="st1">
        <div><p class="k">1</p><h3>이 계정의 모든 기기 연결을 새 것으로 바꿉니다</h3><p>이 PC만 새 연결을 받습니다. 누가 연결 열쇠를 가져갔을 수도 있어서입니다.</p></div>
        <div><p class="k">2</p><h3>그 시각의 백업을 다시 보이게 합니다</h3><p>도중에 끊겨도 다시 누르면 이어서 합니다.</p></div>
        <div><p class="k">3</p><h3>확인을 마칠 때까지 자동 백업과 정리를 멈춥니다</h3><p>요청과 실행은 이 계정의 모든 기기와 메일로 알립니다.</p></div>
      </div></section>
    <section class="pn"><div class="pn-h"><b>되돌릴 판</b><span class="num">${D.undo.versionH24}</span></div>
      ${D.folders.map((f, i) => kv(f.name, `${D.undo.byFolder[i]}개`)).join('')}${kv('합계', `${D.undo.files}개 · ${D.undo.size}`, 'tot')}
      ${kv('지금 상태의 백업', '<span class="bad">열 수 없음</span>')}
      <p class="hint" style="margin-top:6px;line-height:1.6">숨겨진 묶음이 많아 지금 상태로는 열리지 않습니다. 이 PC가 감염됐을 수 있으면 Google에서 이 PC를 로그아웃하고 「업무 백업」 접근을 지운 뒤 다시 로그인하세요.</p>
      <div class="lk"><a class="lnk" href="#undo-2">Google 기기 관리 ${ICON.ext}</a><a class="lnk" href="#undo-2">연결된 앱 ${ICON.ext}</a></div></section>
  </div>`, fbar('누르면 Google 로그인을 한 번 더 합니다.', `<a class="lnk" href="#undo-1" style="font-size:13px">시각 다시 고르기</a><button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 되돌리기</button>`));

S['undo-3'] = () => flow(`${top({ flow: '사고가 났을 때 되돌리기', back: false })}${segs(UNDO, 3)}
  ${fhead({ kick: '되돌렸습니다', h1: `${D.undo.versionKo}로<br><span class="soft">되돌렸습니다.</span>`, sub: '자동 백업과 정리를 멈춰 두었습니다. 먼저 필요한 파일을 새 폴더로 꺼내 확인하세요.' })}
  <div class="cols">
    <section class="pn"><div class="pn-h"><b>그다음 고를 것</b></div>
      <div style="padding-top:12px">${notes([
        '<b>파일 꺼내기</b>는 되돌린 판에서 필요한 파일을 새 폴더로 꺼냅니다. 이 PC의 파일은 건드리지 않습니다.',
        '<b>여기서부터 계속</b>은 이 PC의 지금 파일로 이어 백업합니다. 망가진 파일이 남아 있으면 먼저 꺼내세요.',
        `<b>되돌리기 취소</b>는 되돌리기 직전(${D.undo.cancelKo})으로 다시 돌립니다.`,
      ])}</div></section>
    <section class="pn"><div class="pn-h"><b>한 일</b><span>지운 것 없음</span></div>
      ${kv('되돌린 판', D.undo.versionH24)}${kv('파일', `${D.undo.files}개`)}${kv('이 PC의 파일', '그대로')}${kv('기기 연결', '새로 바꿈 · 이 PC만')}${kv('알림', '모든 기기 · 메일')}
      <p class="hint" style="margin-top:10px;line-height:1.6">새 복구 코드를 만들어 두세요. 전에 받은 코드는 이제 쓸 수 없습니다.</p></section>
  </div>`, fbar('', '<a class="lnk" href="#undo-3" style="font-size:13px">되돌리기 취소</a><button class="btn btn-line" type="button">여기서부터 계속</button><button class="btn btn-solid" type="button">파일 꺼내기</button>'));

S.lost = () => flow(`${top({ flow: '분실 신고' })}
  ${fhead({ kick: `${D.newDevice}에서`, h1: `「${D.device}」${pp(D.device, '을/를')}<br><span class="soft">분실 신고합니다.</span>`, sub: '신고하는 즉시 그 노트북의 백업 연결을 끊습니다. 파일과 백업은 지워지지 않습니다.' })}
  <section class="pn"><div class="pn-h"><b>분실 신고 순서</b><span>끝까지 하면 잃어버린 노트북은 백업을 읽지도 올리지도 못합니다</span></div>
    <div class="st4" style="padding-top:14px">
      <div class="now"><p class="k"><i></i>1</p><h3>Google로 확인</h3><p>본인인지 Google 로그인으로 한 번 더 확인합니다.</p></div>
      <div><p class="k"><i></i>2</p><h3>그 노트북의 백업 연결 끊기</h3><p>SYNK 서버가 바로 합니다.</p></div>
      <div><p class="k"><i></i>3</p><h3>Google 계정에서 그 노트북 로그아웃 · 「업무 백업」 접근 지우기</h3><p>잃어버린 노트북에 남은 Google 로그인으로 복구 정보를 계속 읽을 수 있어서입니다.</p><div class="lk"><a class="lnk" href="#lost">Google 기기 관리 ${ICON.ext}</a><a class="lnk" href="#lost">연결된 앱 ${ICON.ext}</a></div></div>
      <div><p class="k"><i></i>4</p><h3>이 PC에서 다시 로그인</h3><p>새 복구 정보를 맡기고, 새 복구 코드를 만듭니다.</p></div>
    </div></section>
  <section class="pn"><p style="font-size:15px;line-height:1.6;color:var(--ink-2)"><b style="color:var(--ink)">신고한 뒤에는</b> 새 기기를 이을 때까지 SYNK 서버를 거쳐야 백업을 열 수 있고, 전에 받은 복구 코드는 쓸 수 없습니다.</p></section>`,
  fbar('', `<a class="lnk" href="#drawer" style="font-size:13px">취소</a><button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 분실 신고</button>`));

S.code = () => flow(`${top({ flow: '복구 코드' })}
  ${fhead({ kick: '되찾는 길 · 첫 주 안에 한 번', h1: '복구 코드를<br><span class="soft">한 장 만들어 두세요.</span>', sub: 'Google 계정에 들어갈 수 없을 때 이 종이 한 장으로 백업을 엽니다. 이 종이를 가진 사람은 백업을 열 수 있으니, 금고나 서랍처럼 PC와 떨어진 곳에 두세요.' })}
  <div class="cols cols-code">
    <article class="paper" aria-label="복구 코드 견본"><div class="ttl"><h2>업무 백업 · 복구 코드</h2>${MARK}</div>
      <p class="meta">만든 날 <span class="num">2026. 11. 13.</span> · ${D.device} · ${D.account}</p>
      <div class="cg">${D.codeGroups.map((g) => `<span>${g}</span>`).join('')}</div>
      <p class="use">새 PC에서 업무 백업을 깔고 <b>「복구 코드로 되살리기」</b>를 누른 뒤 이 글자를 그대로 넣으세요. Google 계정 없이 열립니다.</p></article>
    <section class="pn"><div class="pn-h"><b>둘 곳</b></div>
      <div style="padding-top:12px">${notes([
        '인쇄하거나 USB에 담습니다. 백업하는 폴더나 OneDrive 폴더 안에는 저장할 수 없습니다.',
        '분실 신고나 사고 되돌리기를 하면 이 코드는 쓸 수 없게 되고, 새 코드를 다시 권해 드립니다.',
        '건너뛰면 설정 › 복구 코드에서 언제든 만들 수 있습니다.',
      ])}</div></section>
  </div>`, fbar('', `<a class="lnk" href="#home" style="font-size:13px">다음에 하기</a><button class="btn btn-line" type="button">${ICON.usb}USB에 저장</button><button class="btn btn-solid" type="button">${ICON.print}인쇄</button>`));

S.web = () => `<div class="web"><div class="w">
  <header class="top"><div class="brand">${MARK}<span class="bar"></span><span>${D.app}</span></div></header>
  <div style="padding:48px 0 40px">
    <p class="stat warn"><i></i>새 기기 연결</p>
    <h1 style="margin-top:22px">이 계정에<br>새 기기가 연결됐습니다.</h1>
    <p class="fsub">내가 한 일이 아니면 바로 끊으세요. 끊으면 그 기기는 백업을 읽지도 올리지도 못합니다.</p>
    <div class="card">${kv('기기 이름', D.newDevice)}${kv('연결한 때', `<span class="num">${D.joined.dots}</span>`)}${kv('Windows', '11')}${kv('알림을 함께 받은 기기', D.device)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px"><button class="btn btn-solid" type="button">${ICON.google}Google로 확인하고 끊기</button><button class="btn btn-line" type="button">내가 한 일이 맞음</button></div>
    <p class="hint" style="margin-top:14px">이 링크만으로는 끊지 않습니다. 계정 주인인지 Google 로그인으로 확인합니다.</p>
    <div style="margin-top:26px">${notes(['그 기기를 이은 사람은 내 Google 계정에 들어간 사람입니다. 내가 한 일이 아니면 <b>Google 비밀번호도 바꾸세요.</b>'])}</div>
    <p style="margin-top:30px"><a class="lnk" href="#lost">기기를 잃어버렸나요? 분실 신고 ${ICON.rarr}</a></p>
  </div></div></div>`;

S.notify = () => flow(`${top({ flow: '알림 문구', back: false, right: false })}
  ${fhead({ kick: 'Windows 알림 · 열두 가지', h1: '문제 하나에 <span class="soft">할 일 하나.</span>', sub: '문제가 없으면 알리지 않습니다. 같은 문제는 하루 한 번만 띄우고, 해결되면 다시 알리지 않습니다. 알림을 누르면 그 문제를 다루는 화면이 열리고, 누르자마자 무언가를 실행하는 알림은 없습니다.' })}
  <div class="toasts">${NOTIFY.map((n) => `<div class="tw"><div class="toast"><div class="app"><i>${MARK}</i>업무 백업</div><h4>${n.title}</h4><p>${n.body}</p>${n.act ? `<div class="tb">${n.act}</div>` : ''}</div><p class="when"><b class="${n.tone}"></b>${n.when}</p></div>`).join('')}</div>
  <p class="hint" style="margin-top:22px">PC가 꺼져 있어 사흘 넘게 소식이 없으면 SYNK 서버가 메일로 알립니다. 「백업을 못 함」이 아니라 「소식이 없음」이라고 씁니다.</p>`);

S.drawer = () => `${S.home()}<div class="dim"></div><aside class="drawer" aria-label="설정">
  <div class="dh"><h2>설정</h2><button class="tbtn" type="button">닫기</button></div>
  <p class="who">${D.account} · ${D.device} · <span class="num">${D.version}</span></p>
  ${DRAWER.map((g) => `<section class="dg"><h3>${g.group}</h3>${g.rows.map((r) => `<div class="dr"><span class="nm">${r.name}${r.nudge ? '<i aria-label="권함"></i>' : ''}</span><span class="vl">${r.value}</span>${r.act ? `<a class="lnk" href="#${r.to || 'drawer'}">${r.act}</a>` : ''}</div>`).join('')}</section>`).join('')}
</aside>`;

// B는 11-13 고를 때 판의 기록이다 — 그 뒤 A에만 더한 화면(move-0 · lost-2)은 원고에 없어 굽지 않는다
export const screens = SCREENS.filter(([id]) => S[id]).map(([id]) => ({ id, html: S[id]() }));

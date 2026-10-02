'use strict';
// Loom의 명시적 첫 게시물 지면. 기존 지면과 기본값에는 영향을 주지 않는다.
module.exports = function firstEdition(t) {
  const c=t.색;
  return `
.first-edition{margin:0;background:${c.Paper};color:${c.Ink};font-family:'Inter Tight','SUIT Variable',sans-serif;-webkit-font-smoothing:antialiased}
.first-edition *{box-sizing:border-box}.first-edition a{color:inherit;text-underline-offset:.22em}
.first-edition h1,.first-edition h2,.first-edition h3{font-synthesis:none;text-wrap:balance;word-break:keep-all;overflow-wrap:break-word}
.first-edition p,.first-edition li{word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}
.first-edition .first-art{width:1080px;height:1350px;position:relative;overflow:hidden;background:${c.Paper};color:${c.Ink};--accent:${c['Coral 3']};isolation:isolate}
.first-edition .first-art[data-brand=SHIFT]{--accent:${c['Lapis Deep']}}
.first-edition .first-art[data-brand=SYNK]{--accent:${c.Ink}}
.first-edition .first-art[data-brand=PULSE]{--accent:${c['Pop Deep']}}
.first-edition .art-logo{position:absolute;left:80px;top:50px;width:310px;height:100px;object-fit:contain;object-position:left center;z-index:3}
.first-edition .art-label{position:absolute;top:90px;right:80px;font-size:23px;letter-spacing:.07em;font-weight:600;color:${c['Deep Wool']};margin:0}
.first-edition .art-copy{position:absolute;left:80px;right:80px;top:220px;z-index:2}
.first-edition .art-kicker{font-size:28px;line-height:1.4;font-weight:600;color:var(--accent);margin:0 0 30px}
.first-edition .art-title{font-size:86px;line-height:1.1;font-weight:800;letter-spacing:-.045em;white-space:pre-line;margin:0;max-width:900px}
.first-edition .art-body{font-size:40px;line-height:1.5;white-space:pre-line;color:${c['Deep Wool']};margin:32px 0 0;max-width:880px}
.first-edition .art-primary{font-size:62px;font-weight:750;letter-spacing:-.03em;line-height:1.32;white-space:pre-line;margin:44px 0 0;color:var(--accent)}
.first-edition .art-secondary{font-size:38px;line-height:1.5;white-space:pre-line;margin:20px 0 0}
.first-edition .art-items{list-style:none;margin:40px 0 0;padding:0;display:grid;gap:28px}
.first-edition .art-items li{font-size:40px;line-height:1.4;padding:22px 0 0;border-top:2px solid ${c.Oat};white-space:pre-line}
.first-edition .art-items strong{font-size:25px;display:block;font-weight:600;letter-spacing:.02em;color:var(--accent);margin-bottom:12px}
.first-edition .art-note{font-size:28px;line-height:1.5;white-space:pre-line;margin:30px 0 0;color:${c['Deep Wool']}}
.first-edition .art-image{position:absolute;bottom:110px;right:70px;width:580px;height:560px;object-fit:contain;z-index:1}
.first-edition .art-foot{position:absolute;left:80px;right:80px;bottom:48px;display:flex;align-items:center;justify-content:space-between;gap:30px;font-size:22px;line-height:1.4;color:${c['Deep Wool']};z-index:3}
.first-edition .art-foot span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}
.first-edition .first-art[data-layout=cover] .art-image{width:640px;height:570px;right:60px}
.first-edition .first-art[data-layout=example] .art-title,.first-edition .first-art[data-layout=choices] .art-title{font-size:70px}
.first-edition .first-art[data-layout=example] .art-image,.first-edition .first-art[data-layout=choices] .art-image{width:245px;height:245px;bottom:115px}
.first-edition .first-art[data-layout=statement] .art-copy{top:265px}
.first-edition .first-art[data-layout=statement] .art-title{font-size:100px;line-height:1.18}
.first-edition .first-art[data-layout=statement] .art-image{width:360px;height:360px}
.first-edition .first-art[data-layout=closing] .art-image{width:410px;height:390px}
.first-edition .first-art[data-shape=wide]{width:1920px;height:1080px}
.first-edition .first-art[data-shape=wide] .art-logo{left:100px;top:54px;width:360px;height:125px}
.first-edition .first-art[data-shape=wide] .art-label{right:100px;top:105px}
.first-edition .first-art[data-shape=wide] .art-copy{left:100px;right:auto;top:280px;width:1050px}
.first-edition .first-art[data-shape=wide] .art-title{font-size:126px;max-width:1040px}
.first-edition .first-art[data-shape=wide] .art-body{font-size:46px;max-width:1020px}
.first-edition .first-art[data-shape=wide] .art-image{right:70px;bottom:135px;width:650px;height:650px}
.first-edition .first-art[data-shape=wide] .art-foot{left:100px;right:100px;bottom:55px;font-size:27px}
.first-edition .first-art[data-shape=pin]{width:1000px;height:1500px}
.first-edition .first-art[data-shape=pin] .art-copy{right:70px;left:70px}.first-edition .first-art[data-shape=pin] .art-title{font-size:88px}
.first-edition .first-art[data-shape=square]{width:1080px;height:1080px}
.first-edition .first-art[data-shape=letterhead]{width:1200px;height:800px}
.first-edition .first-art[data-shape=letterhead] .art-copy{top:195px;left:80px;right:80px}
.first-edition .first-art[data-shape=letterhead] .art-kicker{margin-bottom:22px;font-size:24px}
.first-edition .first-art[data-shape=letterhead] .art-title{font-size:74px;line-height:1.1}
.first-edition .first-art[data-shape=letterhead] .art-items{grid-template-columns:1fr 1fr;gap:40px;margin-top:34px}
.first-edition .first-art[data-shape=letterhead] .art-items li{font-size:30px;padding-top:18px}
.first-edition .first-art[data-shape=letterhead] .art-note{font-size:24px;margin-top:22px}
.first-edition .first-art[data-shape=letterhead] .art-foot{bottom:28px;font-size:20px}
.first-edition .first-art[data-shape=letterhead] .art-image{display:none}
.first-edition .first-art[data-shape=vertical]{width:1080px;height:1920px}
.first-edition .first-art[data-shape=vertical] .art-copy{top:320px}
.first-edition .first-art[data-shape=vertical] .art-image{width:840px;height:820px;right:100px;bottom:190px}
.first-edition .first-art[data-shape=vertical] .art-foot{bottom:95px}
.first-edition .first-art[data-shape=square] .art-title{font-size:82px}.first-edition .first-art[data-shape=square] .art-image{width:350px;height:340px}
.first-edition .sheet{max-width:1420px;margin:auto;padding:54px 48px}
.first-edition .masthead{padding:10px 0 58px;border-bottom:1px solid ${c.Stone}}
.first-edition .web-logo{width:230px;max-width:70vw;height:92px;object-fit:contain;object-position:left;margin-bottom:18px}
.first-edition .masthead h1{font-size:clamp(46px,6.6vw,90px);line-height:1.06;letter-spacing:-.055em;margin:24px 0}
.first-edition .masthead p{max-width:810px;font-size:20px;line-height:1.75}
.first-edition .eyebrow{font-size:13px;letter-spacing:.08em;font-weight:600;color:${c['Deep Wool']}}
.first-edition .nav,.first-edition .actions{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0}
.first-edition button,.first-edition .button{font:inherit;font-size:15px;min-height:46px;display:inline-flex;justify-content:center;align-items:center;padding:12px 18px;border:1px solid ${c.Stone};border-radius:8px;color:${c.Ink};background:${c.Paper};text-decoration:none;cursor:pointer}
.first-edition button[aria-pressed=true]{background:${c.Ink};color:${c.Paper}}
.first-edition button:active,.first-edition .button:active{transform:scale(.96)}
.first-edition :focus-visible{outline:3px solid ${c['Lapis Deep']};outline-offset:4px}
.first-edition .brand-section{margin:50px 0 70px}.first-edition .brand-section>h2{font-size:36px;letter-spacing:-.035em;margin:0 0 14px}
.first-edition .brand-section>p{font-size:18px;line-height:1.6;max-width:880px}
.first-edition .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px 28px;margin-top:32px}
.first-edition .entry{min-width:0;border-bottom:1px solid ${c.Stone};padding-bottom:25px}
.first-edition .entry img{display:block;width:100%;aspect-ratio:4/5;object-fit:contain;background:${c.Paper}}
.first-edition .entry h3{font-size:25px;line-height:1.35;letter-spacing:-.025em;margin:16px 0 12px}
.first-edition .entry p{font-size:16px;line-height:1.65;margin:8px 0}.first-edition .entry .meta{font-size:13px;color:${c['Deep Wool']}}
.first-edition .reader{max-width:880px;margin:auto;padding:48px 30px 100px;font-size:19px;line-height:1.8}
.first-edition .reader h1{font-size:46px;line-height:1.22;letter-spacing:-.035em}.first-edition .reader h2{font-size:28px;margin-top:50px}
.first-edition .reader img{max-width:100%;height:auto}.first-edition .reader figure{margin:30px 0}.first-edition figcaption{font-size:14px;color:${c['Deep Wool']}}
.first-edition video{width:100%;max-height:75vh;background:${c.Ink};display:block;margin:24px 0}
.first-edition .copy-text{white-space:pre-wrap;background:${c.Oat};padding:24px;border-radius:10px;line-height:1.85;overflow-wrap:anywhere}
.first-edition .state{border-left:3px solid ${c.Stone};padding:8px 18px;font-size:15px;color:${c['Deep Wool']}}
.first-edition table{border-collapse:collapse;font-size:15px;line-height:1.6;width:100%}.first-edition th,.first-edition td{border-bottom:1px solid ${c.Stone};text-align:left;vertical-align:top;padding:15px 12px}
.first-edition .table-scroll{overflow-x:auto}.first-edition .table-scroll table{min-width:850px}
.first-edition textarea{font:inherit;line-height:1.7;color:${c.Ink};background:${c.Paper};border:1px solid ${c.Stone};border-radius:8px;width:100%;min-height:350px;padding:20px}
.first-edition .worksheet-label{display:block;font-weight:650;margin:28px 0 10px}
.first-edition .worksheet-input{font:inherit;font-size:21px;line-height:1.5;color:${c.Ink};background:${c.Paper};border:1px solid ${c.Stone};border-radius:8px;width:100%;padding:14px 16px;min-height:84px;resize:vertical;word-break:keep-all}
.first-edition .live-result{font-size:30px;line-height:1.5;font-weight:700;background:${c.Oat};padding:24px;margin:28px 0;border-radius:10px;word-break:keep-all;overflow-wrap:break-word}
.first-edition .proof-view{max-width:1000px;padding:40px 50px;font-size:26px}.first-edition .proof-view h1{font-size:52px}.first-edition .proof-view .worksheet-input{font-size:30px}.first-edition .proof-view .live-result{font-size:37px}
.first-edition pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:${c.Oat};padding:20px}
.first-edition .print-page{break-after:page}.first-edition .print-page:last-child{break-after:auto}
@media(max-width:1050px){.first-edition .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.first-edition .sheet{padding:26px 22px}.first-edition .grid{grid-template-columns:1fr}.first-edition .reader{padding:28px 22px 70px}.first-edition .reader h1{font-size:36px}.first-edition .masthead{padding-bottom:30px}.first-edition .proof-view{font-size:18px}.first-edition .proof-view .worksheet-input{font-size:19px}.first-edition .proof-view .live-result{font-size:25px;padding:19px}}
@media(prefers-reduced-motion:reduce){.first-edition *{transition:none!important;scroll-behavior:auto!important}}
@media print{.first-edition .no-print{display:none}.first-edition .reader{padding:0;max-width:none}.first-edition .print-page{width:100%;height:auto}.first-edition .first-art{break-after:page}.first-edition .first-art:last-child{break-after:auto}}
`;
};

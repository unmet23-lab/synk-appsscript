'use strict';
// GD3: 판정을 확인하는 중에 하던 복습 판이 있으면 허브 포스터는 「이어 하기」, 복습 화면에도 이어 하기 단추(이미 있는 문구만).  node edit-gd3.cjs <폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'life-ui.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };
rep(` const reviewPoster=(s,why='')=>({kind:'review',html:`,
` // 하던 복습 판(답하지 않은 문항이 남음)이 있는가. 판정을 확인하는 중에는 돌아온 수가 0이어도 하던 판은 이어 할 수 있다 — startReview가 하던 판을
 // 그대로 연다. 그때 허브 포스터는 「이어 하기」로 그 판을 열고(「0개가 돌아왔어요」로 막히지 않는다), 복습 화면에도 이어 하기 단추를 둔다(검수 s3d GD3).
 const resumableReview=()=>{try{const run=getProgress().exportSnapshot().activeReview;return !!run&&Array.isArray(run.ids)&&run.ids.some(id=>!run.answers?.[id]);}catch{return false;}};
 const resumePoster=(why='')=>({kind:'review',html:\`<section class="life-poster life-now" aria-label="\${t('life.upNext')}">\${print('review')}<small class="life-poster-label">CONTINUE · REVIEW</small><strong class="life-poster-word">\${t('plan.resumeReview')}</strong><span class="life-poster-sub">\${whyLine(why)}</span><button class="felt-button" data-life-review-start>\${t('life.continue')} <span aria-hidden="true">→</span></button></section>\`});
 const reviewPoster=(s,why='')=>!backCount(s)&&resumableReview()?resumePoster(why):({kind:'review',html:`);
rep(`checking=s.dueState==='checking';`, `checking=s.dueState==='checking',resume=!s.dueCount&&resumableReview();`);
rep("<div class=\"life-actions\">${s.dueCount?`<button class=\"felt-button\" data-life-review-start>${t('life.reviewStart')} <span aria-hidden=\"true\">→</span></button>",
    "<div class=\"life-actions\">${s.dueCount||resume?`<button class=\"felt-button\" data-life-review-start>${t(resume?'life.continue':'life.reviewStart')} <span aria-hidden=\"true\">→</span></button>");
fs.writeFileSync(file, s);
console.log('GD3 고침');

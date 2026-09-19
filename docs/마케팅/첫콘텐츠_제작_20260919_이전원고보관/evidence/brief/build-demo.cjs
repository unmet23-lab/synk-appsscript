/* Original SYNK demonstration. The before layout is deliberately broken. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../../../..');
const fontRoot = path.join(root, 'docs/브랜드_폰트');
const font = (name) => pathToFileURL(path.join(fontRoot, name)).href;
const poppler = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin';
const phrase = '제목과 표, 마지막 안내까지 읽은 뒤 모든 링크가 실제로 열리는지 확인합니다.';
function html(fixed) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>PDF 검수 시연 - ${fixed ? '수정 후' : '수정 전'}</title>
<style>
@font-face{font-family:SUIT;src:url('${font('SUIT/SUIT-Variable.woff2')}');font-weight:100 900}
@font-face{font-family:Inter;src:url('${font('InterTight/InterTight-Medium.ttf')}');font-weight:500}
@font-face{font-family:Mono;src:url('${font('DM_Mono/DMMono-Medium.ttf')}');font-weight:500}
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Inter,SUIT,sans-serif;font-weight:500}
.page{width:794px;min-height:1122px;padding:66px 66px 44px;position:relative}.kicker{font-family:Mono;font-size:13px;letter-spacing:2px;margin:0 0 38px}.label{display:inline-block;font-size:14px;font-weight:600;margin-bottom:24px;padding:8px 0;border-bottom:2px solid #000}h1{font-family:SUIT;font-size:44px;line-height:1.16;letter-spacing:-1.7px;font-weight:800;margin:0 0 24px}.intro{font-size:19px;line-height:1.65;max-width:590px;margin:0 0 44px}.table{border-top:2px solid #000;border-bottom:2px solid #000}.row{display:grid;grid-template-columns:94px 1fr 64px;gap:20px;padding:25px 0;border-bottom:1px solid #c8c8c8;font-size:19px;line-height:1.65}.row:last-child{border-bottom:0}.row.head{padding:13px 0;font-size:15px;font-weight:800}.cell{min-width:0}.bodycopy{${fixed ? 'white-space:normal;word-break:keep-all;overflow-wrap:anywhere' : 'white-space:nowrap;overflow:hidden'}}.check{font-size:17px}.note{margin-top:35px;font-size:17px;line-height:1.75}.small{font-size:13px;color:#444;line-height:1.8}.footer{position:absolute;bottom:43px;left:66px;right:66px;display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #bbb;padding-top:13px}.caption{font-size:14px;font-weight:600;margin-top:25px}.notice{padding:18px 0 0;font-size:14px;line-height:1.75}
</style><body><main class="page"><p class="kicker">PDF REVIEW / DEMO 01</p><div class="label">${fixed ? '수정 후 · 줄바꿈 적용' : '수정 전 · 재현용 배치 오류'}</div><h1>자료를 공유하기 전,<br>마지막으로 확인할 것</h1><p class="intro">파일이 열리는 것부터, 마지막 문장이 끝까지 보이는 것까지. 공유할 사람의 화면에서 한 번 더 살펴봅니다.</p><div class="table"><div class="row head"><div>단계</div><div>할 일</div><div>확인</div></div><div class="row"><div>01 준비</div><div class="cell bodycopy">공유할 파일과 원본을 함께 준비합니다.</div><div class="check">□</div></div><div class="row"><div>02 검수</div><div class="cell bodycopy">${phrase}</div><div class="check">□</div></div><div class="row"><div>03 전달</div><div class="cell bodycopy">파일 이름과 최종 수정 날짜를 확인합니다.</div><div class="check">□</div></div></div><p class="caption">설명용 가상 문서 · 실제 고객 자료 아님</p><p class="note">이 예시는 같은 문장을 두 가지 배치로 내보냅니다.<br>수정 전에는 긴 문장이 셀 너비에서 잘리도록 설정했고,<br>수정 후에는 줄바꿈과 행 높이를 내용에 맞췄습니다.</p><p class="notice">확인할 부분<br><strong>글자 잘림 · 표의 줄바꿈 · 페이지 끝 · 링크 동작</strong></p><p class="small">본문의 사실성과 링크 동작은 화면 검수와 별도로 확인합니다.</p><footer class="footer"><span>설명용 PDF 검수 샘플</span><span>2026.09.19 · 1 / 1</span></footer></main></body></html>`;
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({viewport:{width:794,height:1123},deviceScaleFactor:1});
  const manifest = {createdAt:new Date().toISOString(),purpose:'Explicitly synthetic PDF clipping demonstration',artifacts:[]};
  for (const [name,fixed] of [['before',false],['after',true]]) {
    const htmlPath=path.join(__dirname,`demo-${name}.html`);
    fs.writeFileSync(htmlPath,html(fixed));
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(()=>document.fonts.ready);
    const loaded=await page.evaluate(()=>({SUIT:document.fonts.check('800 44px SUIT'),Inter:document.fonts.check('500 19px Inter')}));
    if(!loaded.SUIT||!loaded.Inter) throw new Error('Font missing');
    await page.pdf({path:path.join(__dirname,`demo-${name}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});
    execFileSync(path.join(poppler,'pdftoppm.exe'),['-r','150','-png','-singlefile',path.join(__dirname,`demo-${name}.pdf`),path.join(__dirname,`demo-${name}`)]);
    const extracted=execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-X','utf8','-c','import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))',path.join(__dirname,`demo-${name}.pdf`)],{encoding:'utf8'});
    fs.writeFileSync(path.join(__dirname,`demo-${name}.txt`),extracted);
    manifest.artifacts.push({name,fixed,fontLoaded:loaded,completeSentenceExtracted:extracted.replace(/\s/g,'').includes(phrase.replace(/\s/g,'')),pdfSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,`demo-${name}.pdf`))).digest('hex')});
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname,'demo-run.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

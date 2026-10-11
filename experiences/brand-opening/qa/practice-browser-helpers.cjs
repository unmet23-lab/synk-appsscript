const actions={left:'left',right:'right',middle:'right',jump:'jump',slide:'slide',listen:'left',beat:'left','beat-x':'right','beat-left':'left','beat-right':'right','hold-left':'left','hold-right':'right',choose:'hello',next:'next'};
async function finishPractice(page,{input='touch',onStep=async()=>{},onSuccess=async()=>{},launch=true}={}){
 await page.locator('.tutor-practice[open]').waitFor();
 while(await page.locator('.tutor-practice[open]').count()){
  let state=await page.evaluate(()=>window.__synkGameTutor.metrics().practice);
  if(state.phase==='complete'){if(launch)await page.locator('.practice-primary').click();return;}
  if(state.phase==='demo'&&await page.locator('.practice-primary').isVisible())await page.locator('.practice-primary').click();
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice?.phase==='try',null,{timeout:30000});
  state=await page.evaluate(()=>window.__synkGameTutor.metrics().practice);await onStep(state);
  const game=state.game,action=game==='hangul'&&state.step==='listen'?'a':actions[state.step];
  if(state.cueInMs!==null)await page.waitForFunction(()=>{const t=window.__synkGameTutor.metrics().practice;return t.cueInMs>=-30&&t.cueInMs<=170;});
  const keys=game==='runner'?{left:'ArrowLeft',right:'ArrowRight',jump:'Space',slide:'ArrowDown'}:{left:'f',right:'j'};
  if(state.step==='stay'){await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.phase==='success');}
  else if(state.step.startsWith('hold-')){await page.keyboard.down(keys[action]);await page.waitForTimeout(1350);await page.keyboard.up(keys[action]);}
  else if(input==='keyboard'&&keys[action])await page.keyboard.press(keys[action]);
  else await page.locator(`[data-practice-input="${action}"]`).tap();
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice?.phase==='success');
  await onSuccess(state);
  await page.locator('.practice-primary').click();
 }
}
module.exports={finishPractice};

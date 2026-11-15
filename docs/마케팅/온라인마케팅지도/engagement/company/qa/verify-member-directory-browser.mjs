import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createAdminBrowserFixture} from './admin-workspace-fixture.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=resolve(process.env.ADMIN_DIRECTORY_QA_OUT||'.tmp/admin-directory-browser');
const fixture=await createAdminBrowserFixture();
let browser;
const checks=[],errors=[];
try {
  await mkdir(output,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  const context=await browser.newContext({viewport:{width:1440,height:980}});
  await context.addCookies([{name:'synk_company_session',value:fixture.cookieFor(fixture.admin),url:fixture.base}]);
  fixture.app.store.put('customerWorkspaces','qa-brand',{name:'합성 스튜디오',status:'active',members:[
    {synkUserId:'11111111-1111-4111-8111-111111111111',displayName:'합성 고객',role:'member'}]});
  const page=await context.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(fixture.base+'/?tab=admin');
  const area=page.locator('[data-directory-body]'), form=area.locator('form'), results=area.locator('[data-directory-results]');
  const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:950});
    await results.locator('tbody').waitFor();
    check('fit viewport '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:join(output,'workspace-'+width+'.png')});
  }
  const joinedId='7834ca16-fec5-4612-bb0c-7cb021ae6376';
  fixture.app.store.put('users',joinedId,{...fixture.app.store.get('users',fixture.dual.id),id:joinedId,name:'방금 합류 시험',email:'new@example.test'});
  await form.locator('[name=q]').fill(joinedId);
  await form.locator('[name=q]').press('Enter');
  await results.getByText('1명',{exact:true}).waitFor();
  await results.locator('[data-directory-staff-id]').click();
  await page.locator('[data-directory-staff]:visible .admin-name-btn[data-admin-member="'+joinedId+'"]').waitFor();
  checks.push('employee ID opens employee actions');
  await page.getByRole('button',{name:'Workspace 회원',exact:true}).click();
  check('return preserves search',await form.locator('[name=q]').inputValue()===joinedId);
  await form.locator('[name=q]').fill('');
  await form.locator('[name=type]').selectOption('customer');
  await results.getByText('합성 고객',{exact:true}).waitFor();
  check('only customers',await results.locator('tbody tr').count()===1);
  await page.getByRole('button',{name:'전체 SYNK ID',exact:true}).click();
  await results.getByRole('alert').waitFor();
  check('password session cannot read central directory',!(await results.innerText()).includes('합성 고객'));
  // Only the central service response is simulated here. HTTP authorization and
  // directory pagination run separately against the real route and a test database.
  await page.route('**/api/admin/member-directory/synk',async route=>{
    const {page:n,q}=route.request().postDataJSON();
    await route.fulfill({json:{total:q?0:26,page:n,pageSize:25,rows:q?[]:[
      {id:'22222222-2222-4222-8222-222222222222',name:n===1?'중앙 합성 회원':'다음 회원',loginId:'qa@example.test',status:'active',createdAt:'2026-01-01T00:00:00Z'}]}});
  });
  await results.getByRole('button',{name:'다시 시도'}).click();
  await results.getByText('중앙 합성 회원',{exact:true}).waitFor();
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:950});
    check('central viewport '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:join(output,'synk-'+width+'.png')});
  }
  await results.getByRole('button',{name:'다음',exact:true}).click();
  await results.getByText('다음 회원',{exact:true}).waitFor();
  check('page focus stays in results',await results.locator('.directory-total:focus').count()===1);
  await form.locator('[name=q]').fill('검색 결과 없음');await form.getByRole('button',{name:'검색',exact:true}).click();
  await results.getByText('조건에 맞는 회원이 없습니다.').waitFor();
  check('central paging, empty and error recovery',errors.length===0);
  await page.locator('.admin-head [data-action=invite]').click();
  await page.locator('[data-form=invite]').waitFor();
  checks.push('existing invite form opens from both directories');
  await writeFile(join(output,'result.json'),JSON.stringify({synthetic:true,checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,errors:errors.length}));
} finally {try{await browser?.close();}finally{await fixture.close();}}

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { EMAIL, HELP_LINKS } = require('./subscription-common.cjs');

// Executed only when the user requests a reading, in its own ordinary signed-in browser tabs.
// Only visible account and benefit labels leave those tabs. No cookies or network interception.
async function inspectPages(options) {
  if (options?.service === 'gemini') return { ok:false, code:'USAGE_DISABLED' };
  if (options?.kind !== 'api' || !['claude','gpt'].includes(options.service)) return { ok:false, code:'INVALID_CREDIT_CHECK' };
  const space = await taskSpace(options.spaceName);
  let page;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const failure = code => ({ ok:false, code });
  const host = options.service === 'claude' ? 'claude.ai' : 'chatgpt.com';
  // The document can redirect between navigation and evaluation. Test its origin in the
  // same evaluation, before reading any DOM. Only fixed functions from this module run.
  function evaluate(fn, argument) {
    const value = argument === undefined ? '' : JSON.stringify(argument);
    return page.evaluate('location.origin === ' + JSON.stringify('https://' + host) + ' ? (' + fn.toString() + ')(' + value + ') : null');
  }
  async function locationIsOfficial() {
    const url = new URL(await page.url());
    return url.protocol === 'https:' && url.hostname === host;
  }
  async function visit(url) {
    try { await page.goto(url, { waitUntil:'domcontentloaded', timeout:18000 }); }
    catch (error) { if (!/timed out.*navigation committed/i.test(String(error?.message))) throw error; }
    return locationIsOfficial();
  }
  // Poll only known, rendered controls after navigation. An unrecognized page remains unverified.
  async function read(fn, argument) {
    for (let i = 0; i < 24; i++) {
      const result = await evaluate(fn, argument);
      if (result != null && result !== false) return result;
      await pause(400);
    }
    return null;
  }
  async function providerIdentity(claude, billingDocument) {
    if (claude) {
      await page.click('[role="dialog"] [data-testid="dialog-close"]', {label:'같은 결제 문서에서 계정 확인'});
    } else {
      await page.click('button[aria-label="계정"],button[aria-label="Account"]', {label:'같은 결제 문서에서 계정 확인'});
    }
    if (claude) {
      const menu = await read(() => !!document.querySelector('button[data-testid="user-menu-button"]'));
      if (!menu) return null;
      await page.click('button[data-testid="user-menu-button"]', { label:'로그인한 계정 확인' });
    }
    const found = await read(() => {
      const visible = e => !!e.getClientRects().length;
      const containers = location.hostname === 'claude.ai'
        ? [...document.querySelectorAll('[role=menu]')].filter(visible)
        : location.pathname === '/settings/account' || /^#\/?settings\/account(?:[/?]|$)/i.test(location.hash) ? [...document.querySelectorAll('[role=dialog],main')].filter(visible) : [];
      for (const e of containers) {
        const lines = (e.innerText || '').split('\n').map(s => s.trim());
        const emailLabel = /^(?:The email address linked to your account|계정에 연결된 이메일 주소|계정 이메일|Email address|이메일 주소|이메일)$/i;
        const candidates = location.hostname === 'claude.ai' ? lines : lines.filter((s,i) => i > 0 && emailLabel.test(lines[i-1]));
        const addresses = [...new Set(candidates.filter(s => /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(s)).map(s => s.toLowerCase()))];
        const profile = location.hostname === 'claude.ai' ? document.querySelector('button[data-testid="user-menu-button"]')?.innerText.trim() :
          document.querySelector('button[aria-label^="Profile for "],button[aria-label$="님의 프로필"]')?.getAttribute('aria-label');
        if (addresses.length === 1) return {email:addresses[0], profile:profile || null, documentTime:performance.timeOrigin};
      }
      return null;
    });
    return found?.documentTime === billingDocument ? found : null;
  }
  try {
    page = (await space.pages())[0];
    const claude = options.service === 'claude';
    if (!await visit(options.url)) return failure('CREDIT_SIGN_IN');
    const membership = () => {
      if (location.pathname !== '/settings/billing' && !/^#\/?settings\/billing(?:[/?]|$)/i.test(location.hash)) return null;
      const scope = location.hostname === 'claude.ai' ? document.querySelector('[role="dialog"],main[aria-label="Billing"],main[aria-label="결제"]') : document.body;
      if (!scope?.innerText) return null;
      const lines = scope.innerText.split('\n').map(line => line.trim()).filter(Boolean);
      if (location.hostname === 'claude.ai') {
        const sharedPlan = /^(?:Claude for (?:Teams?|Enterprise)|(?:Claude )?(?:Teams?|Enterprise)(?: (?:annual|monthly))? (?:plan|subscription)|(?:팀|엔터프라이즈)(?: 연간| 월간)? (?:요금제|구독))$/i;
        if (lines.some(line=>sharedPlan.test(line))) return null;
      }
      const heading = lines.findIndex(line => /^(API 크레딧|API 구독 혜택|API credits|API subscription benefits?)$/i.test(line));
      if (heading < 0) return null;
      const section = lines.slice(heading,heading+15), text = section.join('\n');
      const negative = /(?:\bnot\b|n['’]t\b)[^.!?\n]{0,55}\b(?:connected|linked|member|part)\b[^.!?\n]{0,80}\b(?:API|Console) organization\b/i;
      const notMember = section.some(line => negative.test(line)) ||
        (/아직 API 조직에 소속되어 있지 않|API 조직.{0,28}연결되어 있지 않|not (?:yet )?(?:connected|linked) to an API organization|not (?:yet )?(?:a member of|part of) an API organization/i.test(text) &&
         /조직 연결|연결하기|조직 만들기|connect (?:an? |your )?(?:API )?organization|create (?:an? )?organization/i.test(text));
      const member = (section.some(line => /^(연결됨|Connected|Linked)$/i.test(line)) && /월간 크레딧|monthly credits/i.test(text)) ||
        section.some(line => /^API 조직.{1,145}에 연결되어 있습니다[.!]?$/.test(line) ||
          /^(?:(?:you are|your (?:account|subscription) is) (?:currently )?)?(?:linked|connected) to (?:the |your |an? )?API organization(?:[ .:“‘"'].{0,120})?$/i.test(line));
      if (notMember === member) return null;
      const email = lines.findIndex(s => /^(?:결제 이메일|billing email(?: address)?)$/i.test(s));
      const billingEmail = email >= 0 && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(lines[email+1]) ? lines[email+1].toLowerCase() : null;
      const profile = location.hostname === 'claude.ai' ? document.querySelector('button[data-testid="user-menu-button"]')?.innerText.trim() :
        document.querySelector('button[aria-label^="Profile for "],button[aria-label$="님의 프로필"]')?.getAttribute('aria-label');
      const ownerLabel = lines.findIndex(s => /^(?:Account email|Signed in as|계정 이메일|로그인한 계정)$/i.test(s));
      const address = ownerLabel >= 0 && lines[ownerLabel + 1];
      const owner = address && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(address) ? address.toLowerCase() :
        (profile?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0].toLowerCase() || null);
      if (location.hostname === 'chatgpt.com' && !billingEmail && !owner) return null;
      if (!profile && !billingEmail && !owner) return null;
      const organizationLabel = section.findIndex(line=>/^(?:API 조직|API organization|Console organization|콘솔 조직)$/i.test(line));
      const named = section.find(line=>/^API 조직.{1,145}에 연결되어 있습니다[.!]?$|(?:linked|connected) to (?:the |your |an? )?API organization\b/i.test(line));
      const organization = named || (organizationLabel >= 0 ? section[organizationLabel+1] || null : null);
      return {status:member ? 'linked' : 'unlinked', documentTime:performance.timeOrigin, billingEmail, owner, profile, organization};
    };
    const bill = await read(membership);
    if (!await locationIsOfficial() || !bill) return failure('CREDIT_SOURCE_UNKNOWN');
    const { status, documentTime } = bill;
    const billingUrl = await page.url();
    const identity = await providerIdentity(claude,documentTime);
    if (identity?.email !== options.email) return failure(identity ? 'CREDIT_WRONG_ACCOUNT' : 'CREDIT_SIGN_IN');
    function sameProfile(evidence) {
      if (!evidence || (evidence.profile && identity.profile && evidence.profile !== identity.profile)) return false;
      if (evidence.owner) return evidence.owner === identity.email;
      if (!claude) return evidence.billingEmail === identity.email;
      return !!evidence.profile && evidence.profile === identity.profile;
    }
    if (!sameProfile(bill)) return failure('CREDIT_SOURCE_UNKNOWN');
    if (claude) {
      const route = new URL(billingUrl);
      const opened = await evaluate(target => {
        if (target.pathname !== '/settings/billing' && !/^#\/?settings\/billing(?:[/?]|$)/i.test(target.hash)) return false;
        location.hash = target.hash || '#settings/billing';
        return true;
      },{pathname:route.pathname,hash:route.hash});
      if (!opened) return failure('CREDIT_SOURCE_UNKNOWN');
    } else {
      await page.click('button[aria-label="결제"],button[aria-label="Billing"]',{label:'같은 계정의 결제 혜택 다시 대조'});
    }
    const stable = await read(membership);
    if (!sameProfile(stable) || stable.status !== status || stable.documentTime !== documentTime || stable.organization !== bill.organization ||
        stable.owner !== bill.owner || stable.billingEmail !== bill.billingEmail) return failure('CREDIT_SOURCE_UNKNOWN');
    const finalIdentity = await providerIdentity(claude,documentTime);
    if (!finalIdentity || finalIdentity.email !== identity.email) return failure('CREDIT_WRONG_ACCOUNT');
    if (identity.profile && finalIdentity.profile && identity.profile !== finalIdentity.profile) return failure('CREDIT_SOURCE_UNKNOWN');
    return { ok:true, account:identity.email, status };
  } catch { return failure('CREDIT_SOURCE_UNKNOWN'); }
  finally { try { await space.finish({ keep:[] }); } catch {} }
}

const urls = { claude:HELP_LINKS['claude-benefit-settings'], gpt:HELP_LINKS['gpt-benefit-settings'] };

async function readCreditPortal({ runtime, home, platform }, row, input) {
  if (row?.service === 'gemini') return {ok:false,code:'USAGE_DISABLED'};
  if (input?.kind !== 'api') return {ok:false,code:'INVALID_CREDIT_CHECK'};
  if (!row || !EMAIL.test(row.email || '') || !Object.hasOwn(urls,row.service)) return {ok:false,code:'CREDIT_SOURCE_UNKNOWN'};
  const binary = platform === 'win32' ? 'ego-browser.exe' : 'ego-browser';
  const executable = [path.join(home,'.local','share','ego','active_version_dir',binary),path.join(home,'.local','bin',binary)].find(candidate => fs.existsSync(candidate));
  if (!executable) return {ok:false,code:'CREDIT_BROWSER_UNAVAILABLE'};
  const options = { service:row.service, kind:input.kind, email:row.email.toLowerCase(), from:input.from, to:input.to, url:urls[row.service], spaceName:'Solio 구독 혜택 ' + require('node:crypto').randomUUID() };
  const prefix = 'SOLIO_CREDIT_RESULT ';
  const program = 'const runCredit = ' + inspectPages.toString() + '; const result = await runCredit(' + JSON.stringify(options) + '); console.log(' + JSON.stringify(prefix) + ' + JSON.stringify(result));';
  let directory, script;
  try {
    directory = fs.mkdtempSync(path.join(os.tmpdir(),'solio-credit-read-'));
    script = path.join(directory,'read.mjs');
    fs.writeFileSync(script,program,{encoding:'utf8',mode:0o600,flag:'wx'});
    const command = 'await import(' + JSON.stringify(pathToFileURL(script).href) + ')';
    const response = await runtime.rawRun(executable, ['nodejs','-e',command], { env:runtime.childEnv(), timeout:240000 });
    if (response.code !== 0) return {ok:false,code:'CREDIT_SOURCE_UNKNOWN'};
    const lines = (response.out+'\n'+response.err).split(/\r?\n/).filter(line => line.startsWith(prefix));
    if (lines.length !== 1) return {ok:false,code:'CREDIT_SOURCE_UNKNOWN'};
    const receipt = JSON.parse(lines[0].slice(prefix.length));
    if (!receipt.ok) return {ok:false, code:['CREDIT_WRONG_ACCOUNT','CREDIT_SIGN_IN','CREDIT_SOURCE_UNKNOWN'].includes(receipt.code) ? receipt.code : 'CREDIT_SOURCE_UNKNOWN'};
    return receipt.account === options.email ? receipt : {ok:false,code:'CREDIT_WRONG_ACCOUNT'};
  } catch { return {ok:false,code:'CREDIT_SOURCE_UNKNOWN'}; }
  finally {
    if (script) try { fs.unlinkSync(script); } catch {}
    if (directory) try { fs.rmdirSync(directory); } catch {}
  }
}

module.exports = { readCreditPortal, inspectPages };

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { EMAIL, HELP_LINKS } = require('./subscription-common.cjs');

// Executed only when the user requests a reading, in its own ordinary signed-in browser tabs.
// Only visible account and benefit labels leave those tabs. No cookies or network interception.
async function inspectPages(options) {
  // 맞는 짝(Claude · GPT의 혜택 확인, Gemini의 혜택 확인 · Flow)이 아니면 브라우저를 준비하기 전에 거절한다(GPT solio-subs-agy-be-20261126 B7)
  if (!(['claude','gpt'].includes(options?.service) && options.kind === 'api') && !(options?.service === 'gemini' && ['api','flow'].includes(options.kind))) return { ok:false, code:'INVALID_CREDIT_CHECK' };
  const space = await taskSpace(options.spaceName);
  let page;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const failure = code => ({ ok:false, code });
  const host = options.service === 'claude' ? 'claude.ai' : options.service === 'gpt' ? 'chatgpt.com' : options.kind === 'flow' ? 'one.google.com' : 'me.developers.google.com';
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
    if (options.service === 'claude' || options.service === 'gpt') {
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
    }
    const url = new URL(options.url);
    url.searchParams.set('authuser', options.email);
    if (!await visit(url.href)) return failure('CREDIT_SIGN_IN');
    const googleIdentity = () => {
      const label = [...document.querySelectorAll('[aria-label]')].filter(e => e.getClientRects().length).map(e => e.getAttribute('aria-label') || '').find(s => /Google (?:계정|Account)/i.test(s));
      return label?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase() || null;
    };
    const identity = await read(googleIdentity);
    if (identity !== options.email) return failure(identity ? 'CREDIT_WRONG_ACCOUNT' : 'CREDIT_SIGN_IN');
    if (options.kind === 'api') {
      const cloudBenefit = today => {
        const month = today.slice(0,7);
        const monthly = [...document.querySelectorAll('billing-account-card')].filter(card =>
          (card.getClientRects().length || card.querySelector('h2,h3,h4')?.getClientRects().length) &&
          /(?:월간|\bmonthly\b)[^\n]{0,120}Cloud (?:크레딧|credits?)(?:\s|$)/i.test(card.innerText));
        function period(card) {
          const label = card.innerText.trim().split('\n')[0].trim();
          const kr = label.match(/^(\d{1,2})월\s*['’]?(\d{4}|\d{2})$/);
          const en = label.match(/^([a-z]{3,9})\s*['’]?(\d{4}|\d{2})$/i);
          const names = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
          const n = kr ? Number(kr[1]) : en ? names.indexOf(en[1].slice(0,3).toLowerCase()) + 1 : 0;
          if (!n) return null;
          const year = (kr || en)[2];
          return (year.length === 2 ? '20'+year : year) + '-' + String(n).padStart(2,'0');
        }
        const grants = monthly.map(card => {
          const issued = period(card);
          const lines = card.innerText.split('\n').map(s => s.trim()).filter(Boolean);
          const expires = lines.find(s => /^(?:만료일|Expires?(?: on)?|Expiration date)\s*[:：]/i.test(s));
          const date = expires?.replace(/^[^:：]+[:：]\s*/,'');
          const kr = date?.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
          const timestamp = date && Date.parse(date+' UTC');
          const expiry = kr ? kr[1]+'-'+kr[2].padStart(2,'0')+'-'+kr[3].padStart(2,'0') :
            Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0,10) : null;
          if (!issued || issued > month || (expiry && expiry < today) || (issued < month && !expiry)) return null;
          const hasBalance = lines.some(s => /^(?:잔액|(?:remaining )?balance)\s*[:：]\s*[^\n]*\d/i.test(s));
          const label = lines.findIndex(s => /^(?:결제 계정|billing account)$/i.test(s));
          const account = label >= 0 && lines[label + 1];
          const action = /^(?:결제 계정 선택|청구 계정 선택|크레딧 적용|적용(?:하기)?|select (?:a |your )?billing account|apply(?: (?:these |your )?credits?)?)$/i;
          const controls = [...card.querySelectorAll('button,[role="button"]')].filter(e=>e.getClientRects().length);
          const pending = controls.some(e => action.test((e.innerText || e.getAttribute('aria-label') || '').trim())) ||
            lines.some(s => action.test(s) || /(?:billing account|결제 계정 사용)\s+(?:Apply|적용(?:하기)?)$/i.test(s));
          const linked = hasBalance && account && !/^(?:잔액|balance|항상 이 결제|always use)/i.test(account);
          if (issued < month) {
            const automatic = [...card.querySelectorAll('input[type="checkbox"],[role="checkbox"],[role="switch"]')].some(e => {
              const name = e.getAttribute?.('aria-label') || e.labels?.[0]?.innerText || e.closest?.('label')?.innerText || '';
              return /always use this billing account|항상 이 결제 계정 사용/i.test(name) && (e.checked === true || e.getAttribute?.('aria-checked') === 'true');
            });
            if (!automatic || !linked || pending) return null;
          }
          return {issued,expiry,status:pending ? 'unlinked' : linked ? 'linked' : null};
        }).filter(Boolean);
        if (!grants.length) return null;
        const newest = grants.reduce((p,g) => g.issued > p ? g.issued : p,'');
        const current = grants.filter(g=>g.issued===newest);
        const status = current.some(g=>g.status==='linked') ? 'linked' : current.every(g=>g.status==='unlinked') ? 'unlinked' : null;
        if (!status) return null;
        const label=[...document.querySelectorAll('[aria-label]')].find(e=>e.getClientRects().length && /Google (?:계정|Account)/i.test(e.getAttribute('aria-label') || ''))?.getAttribute('aria-label');
        const account=label?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
        // The observation concerns the signed-in user's applied grant. A billing resource ID
        // and its display name both attest to an assignment, and neither is stored.
        return {status,account,grants:current.map(g=>JSON.stringify([g.issued,g.expiry,g.status])).sort()};
      };
      const applied = await read(cloudBenefit, options.to || '');
      if (applied) {
        if (applied.account !== identity) return failure('CREDIT_WRONG_ACCOUNT');
        await pause(1200);
        const next = await read(cloudBenefit,options.to);
        if (next?.account && next.account !== identity) return failure('CREDIT_WRONG_ACCOUNT');
        if (!next || next.account !== identity || next.status !== applied.status || next.grants.length !== applied.grants.length ||
            !next.grants.every((g,index)=>g===applied.grants[index])) return failure('CREDIT_SOURCE_UNKNOWN');
      }
      if (await read(googleIdentity) !== identity) return failure('CREDIT_WRONG_ACCOUNT');
      return applied && await locationIsOfficial() ? { ok:true, account:identity, status:applied.status } : failure('CREDIT_SOURCE_UNKNOWN');
    }
    // Sum only the consecutive visible statement pages that cover the requested interval.
    // An incomplete page, different wallet or unsupported date format must never produce a total.
    const readStatement = rememberRows => {
        const loading = [...document.querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(e =>
          e.getClientRects().length && (e.getAttribute?.('aria-busy') === 'true' || e.getAttribute?.('role') === 'progressbar'));
        if (loading) return null;
        const lines = document.body.innerText.split('\n').map(line => line.trim()).filter(Boolean);
        const idx = lines.findIndex(s => /^(Google Flow 크레딧|Google Flow credits)$/i.test(s));
        const balance = lines[idx + 1];
        let pagination;
        for (const line of lines) {
          const kr = line.match(/^([\d,]+) 중 ([\d,]+)[–-]([\d,]+)$/);
          const en = line.match(/^([\d,]+)[–-]([\d,]+) of ([\d,]+)$/i);
          if (kr || en) { pagination = kr ? kr.slice(1) : [en[3],en[1],en[2]]; break; }
        }
        if (idx < 0 || !/^[\d,]+$/.test(balance)) return null;
        const emptyText = /^(?:최근 활동 없음|표시할 활동이 없습니다\.?|No recent activity|No activity yet|No transactions yet)\.?$/i;
        const zeroRange = pagination && pagination.every(n => Number(n.replace(/,/g,'')) === 0);
        // A page-wide placeholder appears before the ledger loads. Only a settled activity
        // region or an explicit zero total can attest to an empty statement.
        if (!pagination || zeroRange) {
          const regions = [...document.querySelectorAll('section,[role="region"],[role="table"],table')].filter(e=>e.getClientRects().length);
          const name = /^(?:내 최근 활동|최근 활동|활동 내역|Recent activity|My recent activity|Transaction history)$/i;
          const activity = regions.find(e=>name.test((e.getAttribute('aria-label')||'').trim()) ||
            [...e.querySelectorAll('h1,h2,h3,h4,caption')].some(h=>name.test(h.innerText.trim())));
          if (!zeroRange && !activity?.innerText.split('\n').some(s=>emptyText.test(s.trim()))) return null;
          pagination = ['0','0','0'];
        }
        const entries = [];
        for (const line of lines.filter(s => s.includes('\t'))) {
          const [date, category, value] = line.split('\t');
          const kr = date.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
          const en = date.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/);
          if (!kr && !en) continue;
          const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
          const day = kr ? kr.slice(1) : [en[3],String(months.indexOf(en[1].slice(0,3).toLowerCase())+1),en[2]];
          if (Number(day[1])<1 || Number(day[1])>12) return null;
          if (!/^[+−-]?[\d,]+$/.test(value || '') || !category) return null;
          const flow = /^(?:Google Flow(?: 크레딧| credits?)?|구글 플로우(?: 크레딧)?)$/i.test(category);
          if (!flow && !/^(?:AI 크레딧|AI credits?|(?:Google )?(?:Antigravity|Gemini(?: Apps)?|안티그래비티|제미나이))$/i.test(category)) return null;
          entries.push([day[0] + '-' + day[1].padStart(2,'0') + '-' + day[2].padStart(2,'0'), flow, Number(value.replace(/,/g,'').replace('−','-'))]);
        }
        const account = [...document.querySelectorAll('[aria-label]')].filter(e => e.getClientRects().length).map(e => e.getAttribute('aria-label') || '').find(s => /Google (?:계정|Account)/i.test(s))?.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
        const fingerprint = lines.filter(line => line.includes('\t')).join('\n');
        const rows = [...document.querySelectorAll('table tbody tr')].filter(row => row.getClientRects().length &&
          /^(?:\d{4}\.\s*\d{1,2}\.|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})/.test(row.cells?.[0]?.innerText?.trim() || ''));
        const marker = Symbol.for('solio.flow.previous.transactionRows');
        const previous = globalThis[marker];
        const completeRows = rows.length > 0 && rows.length === entries.length;
        const replacedRows = !!previous && completeRows && rows.every(row => !previous.has(row));
        if (rememberRows) globalThis[marker] = completeRows ? new WeakSet(rows) : null;
        return { account, fingerprint, replacedRows, wallet:Number(balance.replace(/,/g,'')), offsets:pagination.map(n => Number(n.replace(/,/g,''))), entries };
    };
    const deadline = Date.now() + 175000;
    let cursor = 0, total = null, previousDay = '9999-12-31', used = 0, wallet = null, previousRows = null;
    for (let iteration = 0; iteration < 160; iteration++) {
      if (Date.now() >= deadline) return failure('CREDIT_SOURCE_UNKNOWN');
      let statement = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        const view = await evaluate(readStatement);
        if (cursor === 0 && view?.offsets.every(n => n === 0) && !view.entries.length && view.account === options.email) {
          await pause(1400);
          const again = await evaluate(readStatement);
          if (again?.offsets.every(n => n === 0) && !again.entries.length && again.account === view.account && again.wallet === view.wallet)
            return {ok:true,account:identity,from:options.from,to:options.to,used:0,wallet:view.wallet};
        }
        if (view && view.offsets[1] === cursor + 1 && view.entries.length === view.offsets[2] - view.offsets[1] + 1) {
          if (previousRows !== null && view.fingerprint === previousRows) {
            // Identical text belongs to a new page only once Google renders new row nodes.
            if (!view.replacedRows) { await pause(250); continue; }
            await pause(1400);
            const again = await evaluate(readStatement);
            if (!again?.replacedRows || again.account !== view.account || again.wallet !== view.wallet || again.fingerprint !== view.fingerprint ||
                !again.offsets.every((value,index) => value === view.offsets[index])) continue;
          }
          statement = view; break;
        }
        await pause(250);
      }
      if (!statement || !await locationIsOfficial() || statement.account !== options.email) return failure('CREDIT_SOURCE_UNKNOWN');
      const [count, first, last] = statement.offsets;
      if (total === null) { total = count; wallet = statement.wallet; }
      if (count !== total || statement.wallet !== wallet || first !== cursor + 1 || last < first || statement.entries.length !== last - first + 1) return failure('CREDIT_SOURCE_UNKNOWN');
      for (const [day, flow, amount] of statement.entries) {
        if (day > previousDay) return failure('CREDIT_SOURCE_UNKNOWN');
        previousDay = day;
        if (flow && amount < 0 && day >= options.from && day <= options.to) used -= amount;
      }
      if (previousDay < options.from || last === total) {
        const end=await evaluate(readStatement);
        if (!end || end.account !== identity || end.wallet !== wallet || end.fingerprint !== statement.fingerprint ||
            !end.offsets.every((value,index)=>value===statement.offsets[index])) return failure('CREDIT_SOURCE_UNKNOWN');
        return { ok:true, account:identity, from:options.from, to:options.to, used, wallet };
      }
      const before = await evaluate(readStatement,true);
      if (!before || before.account !== statement.account || before.wallet !== wallet || before.fingerprint !== statement.fingerprint ||
          !before.offsets.every((value,index)=>value===statement.offsets[index])) return failure('CREDIT_SOURCE_UNKNOWN');
      cursor = last;
      previousRows = statement.fingerprint;
      const next = 'button[aria-label="다음 페이지로 이동"],button[aria-label="Go to next page"],button[aria-label="Next page"]';
      await page.click(next, { label:'다음 크레딧 내역 확인' });
    }
    return failure('CREDIT_SOURCE_UNKNOWN');
  } catch { return failure('CREDIT_SOURCE_UNKNOWN'); }
  finally { try { await space.finish({ keep:[] }); } catch {} }
}

const urls = { claude:HELP_LINKS['claude-benefit-settings'], gpt:HELP_LINKS['gpt-benefit-settings'], gemini:HELP_LINKS['gemini-dev-benefits'] };

async function readCreditPortal({ runtime, home, platform }, row, input) {
  // Flow 활동 읽기는 환급을 빼지 않는 흠을 고칠 때까지 켜지 않는다(GPT solio-subs-agy-be-20261126 A5 · A9). inspectPages의 flow 갈래는 시험만 부른다
  if (input?.kind !== 'api') return {ok:false,code:'INVALID_CREDIT_CHECK'};
  if (!EMAIL.test(row.email || '') || !Object.hasOwn(urls,row.service)) return {ok:false,code:'CREDIT_SOURCE_UNKNOWN'};
  const binary = platform === 'win32' ? 'ego-browser.exe' : 'ego-browser';
  const executable = [path.join(home,'.local','share','ego','active_version_dir',binary),path.join(home,'.local','bin',binary)].find(candidate => fs.existsSync(candidate));
  if (!executable) return {ok:false,code:'CREDIT_BROWSER_UNAVAILABLE'};
  const options = { service:row.service, kind:input.kind, email:row.email.toLowerCase(), from:input.from, to:input.to, url:input.kind === 'flow' ? HELP_LINKS['flow-activity'] : urls[row.service], spaceName:'Solio 구독 혜택 ' + require('node:crypto').randomUUID() };
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

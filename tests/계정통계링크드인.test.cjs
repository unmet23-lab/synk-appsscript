'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { verifiedOwner } = require('../tools/계정통계예약/verified-owner.cjs');

for (const personal of [true, false]) {
  test(`LinkedIn ${personal ? '개인' : '회사'} 통계가 늦게 표시되면 실제 숫자와 기간을 기다린다`, async () => {
    const entry = personal ? 'https://www.linkedin.com/in/test/' : 'https://www.linkedin.com/company/123/';
    const reports = [];
    let currentUrl = entry;
    let settled = false;
    const chart = 'X axis displaying Time. Data ranges from 2026-11-08 00:00 to 2026-11-14 00:00';
    function evaluate(fn, arg) {
      const location = new URL(currentUrl);
      const owner = '/analytics/creator/content/';
      const links = [{ pathname: '/in/test/edit/intro/' }];
      if (settled) links.push({ pathname: owner });
      const text = !settled ? '페이지 노출' : personal ? '누적\n7\n노출수\nUTC\n참여\n댓글\n0\n저장수\n0' :
        '2026년 11월 8일 - 2026년 11월 14일\n하이라이트\n0\n노출\n0\n댓글\n통계';
      const document = { links,querySelector: () => ({ innerText: text }),
        querySelectorAll: () => settled ? [{ getAttribute: () => '', textContent: chart }] : [] };
      return vm.runInNewContext('('+fn.toString()+')(arg)', { document,location,arg });
    }
    const page = { evaluate, url: async () => currentUrl,
      goto: async url => { currentUrl = url; settled = false; },
      waitForFunction: async (fn, arg) => {
        if (!evaluate(fn,arg)) settled = true;
        assert.ok(evaluate(fn,arg));
      } };
    const reason = await verifiedOwner({ account: {
      id:'example',platform:'linkedin',publicUrl:entry,externalId:personal ? null : '123',handle:'example'
    },profile:{profileId:'assigned'},setStage: async () => {} }, {
      pageJob: async (_ctx,_name,fn,args) => { currentUrl = args.entry; return fn(page,args); },
      storeBatch: async (_ctx,_name,_evidence,envelope) => reports.push(envelope)
    });
    assert.equal(reason,'limited');
    const row=reports[0].observations[0];
    assert.deepEqual(row.period,{start:'2026-11-08',end:'2026-11-14'});
    assert.deepEqual(row.metrics,personal ? {impressions:7,comments:0,saves:0} : {impressions:0,comments:0});
  });
}


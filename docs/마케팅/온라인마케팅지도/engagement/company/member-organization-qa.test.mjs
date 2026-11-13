import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationDeadline,finishOrganizationQa} from './qa/member-organization-support.mjs';

test('held organization requests expire with the missing request name',async()=>{
  await assert.rejects(organizationDeadline(new Promise(()=>{}),'delayed save canonical GET',10),/delayed save canonical GET/);
  assert.equal(await organizationDeadline(Promise.resolve('ready'),'ready response',10),'ready');
});

test('report write failure cannot prevent browser, server or temporary fixture cleanup',async()=>{
  const calls=[],writeError=new Error('report write failed'),browserError=new Error('browser close failed');
  await assert.rejects(finishOrganizationQa({
    writeReport:async()=>{calls.push('report');throw writeError;},
    closeBrowser:async()=>{calls.push('browser');throw browserError;},
    stopApp:async()=>{calls.push('server');},
    removeDirectory:async()=>{calls.push('fixture');}
  }),error=>error===writeError);
  assert.deepEqual(calls,['report','browser','server','fixture']);
});

test('QA assertion failure is preserved when reporting and cleanup also fail',async()=>{
  const original=new Error('original failed assertion'),calls=[];
  await assert.rejects(finishOrganizationQa({failure:original,
    writeReport:async()=>{calls.push('report');throw new Error('report');},
    closeBrowser:async()=>{calls.push('browser');},
    stopApp:async()=>{calls.push('server');throw new Error('stop');},
    removeDirectory:async()=>{calls.push('fixture');}
  }),error=>error===original);
  assert.deepEqual(calls,['report','browser','server','fixture']);
});

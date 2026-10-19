'use strict';
// Install only the two approved server heartbeat conditions. --check is read-only.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const policy = require('../모델정책.js');
const PROJECT = 'synk-bake-unmet27';
const CHANNEL = `projects/${PROJECT}/notificationChannels/14855206170551846292`;

async function main() {
  if (process.argv.slice(2).some(x => x !== '--check')) throw Error('ARGUMENT_INVALID');
  if (policy.벌텍스프로젝트() !== PROJECT) throw Error('PROJECT_MISMATCH');
  const desired = JSON.parse(fs.readFileSync(path.join(__dirname, 'absence-policy.json'), 'utf8'));
  assert.deepEqual(desired.notificationChannels, [CHANNEL]);
  assert.equal(desired.conditions.length, 2);
  const token = await policy.벌텍스토큰();
  async function req(endpoint, method = 'GET', body) {
    const response = await fetch(`https://monitoring.googleapis.com/v3/${endpoint}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw Error(`MONITORING_HTTP_${response.status}`);
    return response.json();
  }
  const channel = await req(CHANNEL);
  if (channel.type !== 'email' || channel.enabled === false || !channel.labels?.email_address) {
    throw Error('APPROVED_CHANNEL_UNAVAILABLE');
  }
  const policies = [];
  let page;
  do {
    const result = await req(`projects/${PROJECT}/alertPolicies${page ? `?pageToken=${encodeURIComponent(page)}` : ''}`);
    policies.push(...(result.alertPolicies || []));
    page = result.nextPageToken;
  } while (page);
  const found = policies.filter(x => x.displayName === desired.displayName);
  if (found.length > 1) throw Error('POLICY_DUPLICATE');
  let result = found[0];
  let operation = 'read';
  if (!process.argv.includes('--check')) {
    if (result) {
      // Retain condition identities; unrelated policies and recipients are untouched.
      const conditions = desired.conditions.map(condition => {
        const matches = result.conditions.filter(x => x.displayName === condition.displayName);
        if (matches.length !== 1) throw Error('CONDITION_IDENTITY_CHANGED');
        return {...condition, name: matches[0].name};
      });
      const update = {...desired, conditions, name: result.name};
      // Reinstalling unchanged settings must not reset the absence timer.
      let same = true;
      for (const key of Object.keys(desired)) {
        try { assert.deepEqual(result[key], update[key]); } catch { same = false; }
      }
      if (same) operation = 'unchanged';
      else {
        result = await req(`${result.name}?updateMask=displayName,enabled,combiner,userLabels,documentation,conditions,notificationChannels,alertStrategy`, 'PATCH', update);
        operation = 'updated';
      }
    } else {
      result = await req(`projects/${PROJECT}/alertPolicies`, 'POST', desired);
      operation = 'created';
    }
  }
  if (!result) throw Error('POLICY_MISSING');
  const verified = await req(result.name);
  assert.equal(verified.enabled, true);
  assert.equal(verified.combiner, 'OR');
  assert.deepEqual(verified.notificationChannels, [CHANNEL]);
  assert.equal(verified.conditions.length, 2);
  if (verified.validity && verified.validity.code) throw Error('POLICY_INVALID');
  const evidence = [];
  const mutationTime = verified.mutationRecord?.mutateTime || verified.creationRecord?.mutateTime;
  for (const condition of desired.conditions) {
    const remote = verified.conditions.filter(x => x.displayName === condition.displayName);
    assert.equal(remote.length, 1);
    assert.deepEqual(remote[0].conditionAbsent, condition.conditionAbsent);
    const query = new URLSearchParams({
      filter: condition.conditionAbsent.filter,
      'interval.startTime': new Date(Date.now() - 2 * 3600000).toISOString(),
      'interval.endTime': new Date().toISOString(),
      view: 'FULL', pageSize: '1000',
    });
    const data = await req(`projects/${PROJECT}/timeSeries?${query}`);
    const series = data.timeSeries || [];
    if (data.nextPageToken) throw Error('UNEXPECTED_HEARTBEAT_CARDINALITY');
    const positive = series.flatMap(x => x.points || []).filter(x => Number(x.value?.int64Value || 0) > 0);
    const afterMutation = positive.filter(x => Date.parse(x.interval.endTime) > Date.parse(mutationTime || '9999-01-01'));
    evidence.push({condition: remote[0].name, displayName: condition.displayName,
      matchedSeries: series.length, positivePoints: positive.length,
      latestPositiveAt: positive.map(x => x.interval.endTime).sort().at(-1) || null,
      positivePointsAfterPolicyMutation: afterMutation.length,
      absenceTimerPrimed: afterMutation.length > 0});
  }
  console.log(JSON.stringify({policy: verified.name, displayName: verified.displayName,
    enabled: verified.enabled, checkedAt: new Date().toISOString(), mutationTime,
    readOnly: process.argv.includes('--check'), operation, channel: CHANNEL, existingEmailChannel: true,
    customMetricsCreated: 0, iamChanges: 0, newRecipients: 0,
    absenceSeconds: 2700, alignmentSeconds: 600, conditions: evidence,
    allConditionsPrimed: evidence.every(x => x.absenceTimerPrimed),
    actualAbsenceIncidentTested: false}, null, 2));
  if (process.argv.includes('--check') && !evidence.every(x => x.absenceTimerPrimed)) process.exitCode = 2;
}
main().catch(error => {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'ABSENCE_MONITORING_FAILED');
  process.exitCode = 1;
});

'use strict';

// 기존 계정에 기록한 요금제와 크레딧만 관리한다.
const spec = Object.freeze({ label: 'Gemini', kind: 'weekly', manualOnly: true });
const policy = Object.freeze({
  editable: ['plan', 'apiCredit', 'flowCredit', 'flowCreditUntil'],
  planChoices: ['plus', 'pro', 'ultra', 'ultra_5x', 'ultra_20x', 'family'],
});

module.exports = { spec, policy };

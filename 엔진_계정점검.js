// [v9.343] 소유자 연결·자동화 점검. API 합성 요청과 읽기 전용 운영 집계를 분리한다.
// 활성 사용자·실행 계정·기존 ADMIN_EMAIL 세 값이 일치할 때만 허용한다.
// executionApi MYSELF / webapp USER_DEPLOYING 계약을 유지한다. 인수로 권한·프롬프트·모델을 받지 않는다.
function automationOwnerAllowed_() {
  try {
    const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    const effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    const admin = String(ADMIN_EMAIL || '').trim().toLowerCase();
    return !!active && !!effective && !!admin && active === effective && effective === admin;
  } catch (e) { return false; }
}

// 읽기 전용 운영 점검. 트리거·헤더·고정 진행키만 읽으며 학생 행/키/API/메일은 다루지 않는다.
function automationHealthCheck() {
  if (!automationOwnerAllowed_()) return { ok: false, stage: 'access' };
  const result = { ok: false, stage: 'metadata', triggers: null, batches: {}, monthly: null };
  let props;
  try {
    props = PropertiesService.getScriptProperties();
    result.rehearsalPresent = props.getProperty('배치리허설_만료') !== null;
    let ss = null;
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { /* 실행 API에는 활성 컨테이너가 없다. */ }
    if (!ss) {
      // 기존 엔진 ID만 읽는다. 점검 중 속성을 저장하거나 ID/원문 오류를 출력하지 않는다.
      const id = props.getProperty('ENGINE_SS_ID');
      if (typeof id !== 'string' || !id || /[^A-Za-z0-9_-]/.test(id)) return result;
      ss = SpreadsheetApp.openById(id);
    }
    if (!ss) return result;
    const pf = ss.getSheetByName('profiles');
    const columns = pf ? pf.getLastColumn() : 0;
    const textbookOn = columns > 0 && pf.getRange(1, 1, 1, columns).getValues()[0].some(h => String(h) === '목소리폼URL');
    const expected = triggerManifest_(textbookOn);
    const installed = ScriptApp.getProjectTriggers();
    const counts = {};
    expected.forEach(name => { counts[name] = 0; });
    let otherCount = 0;
    let wrongTypeCount = 0;
    installed.forEach(trigger => {
      const name = trigger.getHandlerFunction();
      if (!Object.prototype.hasOwnProperty.call(counts, name)) { otherCount++; return; }
      counts[name]++;
      const requiredType = name === 'onConsultEdit' || name === 'onHwFeedbackEdit' ? 'ON_EDIT' : 'CLOCK';
      if (String(trigger.getEventType()) !== requiredType) wrongTypeCount++;
    });
    const missing = expected.filter(name => counts[name] === 0);
    const duplicates = expected.filter(name => counts[name] > 1);
    result.triggers = { expectedCount: expected.length, actualCount: installed.length, counts: counts,
      missing: missing, duplicates: duplicates, wrongTypeCount: wrongTypeCount, otherCount: otherCount, textbookOn: textbookOn };
    ['morningJobs', 'nightJobs', 'parentSweep'].forEach(name => {
      const raw = props.getProperty('배치진행_' + name);
      if (raw === null) { result.batches[name] = { status: 'not_observed' }; return; }
      try {
        const summary = 배치상태요약_(JSON.parse(raw));
        const allowed = ['running', 'waiting', 'complete', 'partial', 'uncertain', 'date_changed', 'plan_changed'];
        const safe = { status: allowed.indexOf(summary.status) >= 0 ? summary.status : 'invalid_state' };
        ['next', 'total'].forEach(k => { if (Number.isSafeInteger(summary[k]) && summary[k] >= 0) safe[k] = summary[k]; });
        safe.failureCount = Array.isArray(summary.failures) ? summary.failures.length : 0;
        if (Number.isSafeInteger(summary.updatedAt) && summary.updatedAt >= 0) safe.revision = summary.updatedAt;
        ['date', 'startedAt', 'updatedAt'].forEach(k => {
          if (k !== 'date' && Number.isSafeInteger(summary[k]) && summary[k] >= 0 && summary[k] <= 253402300799999)
            safe[k] = new Date(summary[k]).toISOString();
          else if (typeof summary[k] === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(summary[k])) safe[k] = summary[k];
        });
        result.batches[name] = safe;
      } catch (e) { result.batches[name] = { status: 'invalid_state' }; }
    });
    try {
      const monthly = monthlyDeliveryHealth_(ss);
      const statuses = ['pending', 'sending', 'sent', 'uncertain', 'legacy_unknown'];
      const counts = {};
      statuses.forEach(k => {
        const n = monthly.cards.counts[k];
        if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid_count');
        counts[k] = n;
      });
      if (!/^\d{4}-\d{2}$/.test(monthly.cards.month) || !/^\d{4}-\d{2}$/.test(monthly.report.month)) throw new Error('invalid_month');
      result.monthly = { cards: { month: monthly.cards.month, counts: counts },
        report: { month: monthly.report.month, status: statuses.concat(['missing']).indexOf(monthly.report.status) >= 0 ? monthly.report.status : 'invalid_state' } };
    } catch (e) { result.monthly = { status: 'unavailable' }; }
    const batchFailure = Object.keys(result.batches).some(name => ['partial', 'uncertain', 'date_changed', 'plan_changed', 'invalid_state'].indexOf(result.batches[name].status) >= 0);
    const monthlyFailure = result.monthly.status === 'unavailable' || ['uncertain', 'invalid_state'].indexOf(result.monthly.report.status) >= 0 || result.monthly.cards.counts.uncertain > 0;
    result.ok = missing.length === 0 && duplicates.length === 0 && wrongTypeCount === 0 && !result.rehearsalPresent && !batchFailure && !monthlyFailure;
    result.observationComplete = Object.keys(result.batches).every(name => result.batches[name].status !== 'not_observed');
    result.stage = 'read_only';
    return result;
  } catch (e) { return result; }
}

function aiConnectionCheck() {
  if (!automationOwnerAllowed_()) return { ok: false, stage: 'access' };

  let key;
  try {
    const props = PropertiesService.getScriptProperties();
    // isRehearsal_는 만료 속성을 삭제할 수 있어 호출하지 않는다. 존재만 해도 보수적으로 중지한다.
    if (props.getProperty('배치리허설_만료') !== null) return { ok: false, stage: 'rehearsal' };
    key = props.getProperty('CLAUDE_API_KEY');
    if (!key) return { ok: false, stage: 'missing_key' };
  } catch (e) { return { ok: false, stage: 'properties' }; }

  const marker = 'SYNK_ANTHROPIC_OK';
  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: false,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: AI_FEEDBACK_MODEL, max_tokens: 128, thinking: { type: 'disabled' },
        system: 'Return only the final answer.',
        messages: [{ role: 'user', content: 'Return exactly ' + marker + ' and nothing else.' }]
      })
    });
    const httpStatus = res.getResponseCode();
    if (httpStatus !== 200) return { ok: false, stage: 'provider', httpStatus: httpStatus };
    const body = JSON.parse(res.getContentText());
    const text = (Array.isArray(body.content) ? body.content : [])
      .filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('').trim();
    const usage = {};
    ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].forEach(k => {
      const n = body.usage && body.usage[k];
      if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) usage[k] = n;
    });
    const model = typeof body.model === 'string' && /^claude-[a-z0-9.-]{1,100}$/.test(body.model) ? body.model : null;
    // 원문 응답·오류 본문·키·사용자 이메일은 절대 반환하지 않는다.
    return { ok: text === marker, stage: 'response', httpStatus: httpStatus, model: model, usage: usage };
  } catch (e) { return { ok: false, stage: 'provider_exception' }; }
}

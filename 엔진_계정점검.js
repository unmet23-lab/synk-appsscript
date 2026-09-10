// 소유자 연결 점검. 고정 합성 요청만 실행하며 학생 데이터·메일·저장소를 읽거나 쓰지 않는다.
// 활성 사용자·실행 계정·기존 ADMIN_EMAIL 세 값이 일치할 때만 허용한다.
// executionApi MYSELF / webapp USER_DEPLOYING 계약을 유지한다. 인수로 권한·프롬프트·모델을 받지 않는다.
function aiConnectionCheck() {
  try {
    const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    const effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    const admin = String(ADMIN_EMAIL || '').trim().toLowerCase();
    if (!active || !effective || !admin || active !== effective || effective !== admin) return { ok: false, stage: 'access' };
  } catch (e) { return { ok: false, stage: 'access' }; }

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

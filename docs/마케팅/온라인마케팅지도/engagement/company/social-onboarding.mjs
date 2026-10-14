const rows = value => Array.isArray(value) ? value : [];
const step = (id, title, status, detail, view, action, actionLabel, extra = {}) => ({id, title, status, detail, view, action, actionLabel, ...extra});

// Read only. Derive progress from the current authorized workspace; never turn
// opening a setup screen or saving a credential into proof of publication.
export function socialOnboarding(data, {origin = '', now = Date.now()} = {}) {
  const channels = rows(data.channels).filter(c => c.active !== false);
  const provider = data.connectionHealth?.postiz || data.connectionHealth || {};
  const meta = data.inboxHealth || {};
  const runtime = data.runtime || {};
  const age = now - Date.parse(runtime.lastSuccessAt || '');
  let local = true;
  try { local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch {}
  const running = runtime.enabled === true && Number.isFinite(age) && age >= 0 && age <= Math.max(120000, (runtime.intervalMs || 15000) * 4) && !runtime.lastErrorAt;
  const server = {status: local ? 'local' : running ? 'observed' : runtime.enabled ? 'checking' : 'disabled', title: '예약 실행 서버', detail: local ? '현재는 이 컴퓨터의 개발 서버입니다. 상시 운영 서버의 실행은 별도로 확인해야 합니다.' : running ? '이 서버의 최근 예약 실행을 확인했습니다. 앞으로의 연속 가동을 보장하는 표시는 아닙니다.' : runtime.enabled ? '예약 실행이 켜져 있지만 최근 정상 실행을 아직 확인하지 못했습니다.' : '이 서버의 예약 실행이 꺼져 있습니다. 관리자에게 운영 설정 확인을 요청하세요.', lastSuccessAt: runtime.lastSuccessAt || null};
  return {server, channels: channels.map(channel => {
    const cap = channel.capability || {}, health = rows(provider.channels).find(c => c.channelId === channel.id);
    const currentHealth = provider.api?.state === 'connected' && provider.api?.stale === false && health?.state === 'listed' && health?.stale === false;
    const linked = cap.mode === 'automatic' && cap.canPublish === true;
    const native = ['instagram', 'facebook'].includes(channel.platform), reply = rows(meta.channels).find(c => c.channelId === channel.id);
    const collection = rows(data.inboxProvider?.channels).find(c => c.channelId === channel.id);
    const commentReady = reply?.state === 'connected' && reply?.stale === false && reply?.canReply === true && collection?.enabled === true && collection?.available === true;
    const links = rows(data.tracking?.links).filter(l => l.channelId === channel.id && l.active);
    const observed = links.filter(l => l.stats?.siteEventsSeen), verified = links.filter(l => l.stats?.serverEventsSeen);
    const jobs = rows(data.jobs).filter(j => j.channelId === channel.id), published = jobs.filter(j => j.status === 'published' && j.publicationUrl && j.publishedAt);
    const checked = published.filter(j => j.publicVerifiedAt);
    const scheduled = jobs.filter(j => j.status === 'scheduled');
    const posts = rows(data.posts).filter(p => rows(p.variants).some(v => v.channelId === channel.id));
    const configured = data.provider?.configured === true;
    const steps = [
      step('connection', '발행 서비스 연결', configured ? 'configured' : 'pending', configured ? 'Postiz 설정이 저장되어 있습니다. 아래에서 이 SNS 계정의 연결 상태를 따로 확인합니다.' : '관리자가 Postiz API 연결을 설정하고 연결된 SNS 프로필을 가져오세요.', 'settings', 'view', '발행 연결 설정'),
      step('publishing', '이 계정의 게시 연결 확인', linked && currentHealth ? 'checked' : linked ? 'checking' : 'pending', linked && currentHealth ? '현재 API와 연결 프로필을 확인했습니다. 실제 게시 성공은 마지막 단계에서 확인합니다.' : cap.reason || '회사 계정과 실제 SNS 프로필을 대응하고 최신 연결 상태를 확인하세요.', 'accounts', 'view', '계정 연결 확인'),
      step('comments', '댓글 읽기·답장 권한', !native ? 'unsupported' : commentReady ? 'checked' : 'pending', !native ? '현재 댓글 연결은 Instagram과 Facebook Page에서 제공합니다. 이 단계 없이 게시할 수 있습니다.' : commentReady ? '현재 Meta 계정과 답장 권한을 확인했고 댓글 수집이 켜져 있습니다.' : reply?.message || collection?.reason || '게시 연결과 별도로 댓글 권한을 연결하고 수집을 켜세요.', 'inbox', 'view', '댓글 연결 확인', {optional: true}),
      step('measurement', '사이트 반응 측정', verified.length ? 'observed' : observed.length ? 'partial' : links.length ? 'checking' : 'pending', verified.length ? '이 계정의 추적 링크에서 서버 확인 사건을 받았습니다. 가입·상담별 실제 수치는 성과에서 확인하세요.' : observed.length ? '사이트의 브라우저 기록을 받았습니다. 서버가 확인한 완료 기록은 아직 없습니다.' : links.length ? '추적 링크는 있지만 사이트 방문·완료 기록은 아직 받지 못했습니다.' : '허용 사이트를 등록하고 게시물에 새 추적 링크를 넣으세요. 가입·상담은 실제 완료 지점에 연결해야 합니다.', observed.length ? 'results' : 'settings', 'view', observed.length ? '측정 결과 보기' : '사이트 측정 설정', {optional: true}),
      step('publication', '첫 예약과 공개 결과 확인', checked.length ? 'observed' : published.length ? 'partial' : scheduled.length ? 'scheduled' : 'pending', checked.length ? '게시 주소와 공개 확인 기록이 있습니다. 자동 게시와 수동 마무리는 예약 기록에서 구분할 수 있습니다.' : published.length ? '게시 주소가 기록되었습니다. SNS 원문을 열어 실제 공개 상태를 확인하세요.' : scheduled.length ? '예약이 저장되어 있습니다. 게시된 뒤 주소·시각과 실제 공개 결과까지 확인하세요.' : posts.length ? '저장한 원고를 검토·승인하고 게시 시각을 예약하세요.' : '실제로 사용할 원고를 작성한 뒤 검토·승인·예약 순서로 진행하세요.', jobs.length ? 'queue' : 'compose', 'view', jobs.length ? '예약·게시 결과 보기' : '첫 게시물 작성'),
    ];
    return {channelId: channel.id, steps, nextStepId: steps.find(s => !s.optional && !['configured','checked','observed'].includes(s.status))?.id || null};
  }), empty: channels.length === 0};
}

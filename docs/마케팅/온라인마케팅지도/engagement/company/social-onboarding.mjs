const rows = value => Array.isArray(value) ? value : [];
const step = (id, title, status, detail, view, action, actionLabel, extra = {}) => ({id, title, status, detail, view, action, actionLabel, ...extra});

// Read only. Derive progress from the current authorized workspace; never turn
// opening a setup screen or saving a credential into proof of publication.
export function socialOnboarding(data, {origin = '', now = Date.now()} = {}) {
  const channels = rows(data.channels).filter(c => c.active !== false);
  const direct = data.provider?.mode === 'direct' || data.provider?.provider === 'direct';
  const provider = (direct ? data.connectionHealth : data.connectionHealth?.postiz || data.connectionHealth) || {};
  const meta = data.inboxHealth || {};
  const runtime = data.runtime || {};
  const age = now - Date.parse(runtime.lastSuccessAt || '');
  let local = true;
  try { local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch {}
  const running = runtime.enabled === true && Number.isFinite(age) && age >= 0 && age <= Math.max(120000, (runtime.intervalMs || 15000) * 4) && !runtime.lastErrorAt;
  const server = {status: local ? 'local' : running ? 'observed' : runtime.enabled ? 'checking' : 'disabled', title: '예약 실행 서버', detail: local ? '지금은 이 컴퓨터의 개발 서버예요. 상시 운영 서버가 돌아가는지는 따로 확인해야 해요.' : running ? '이 서버의 최근 예약 실행을 확인했어요. 앞으로도 계속 돌아간다는 뜻은 아니에요.' : runtime.enabled ? '예약 실행은 켜져 있지만, 최근에 제대로 실행됐는지는 아직 확인하지 못했어요.' : '이 서버는 예약 실행이 꺼져 있어요. 관리자에게 운영 설정을 확인해 달라고 요청하세요.', lastSuccessAt: runtime.lastSuccessAt || null};
  return {server, channels: channels.map(channel => {
    const cap = channel.capability || {}, health = rows(provider.channels).find(c => c.channelId === channel.id);
    const directConnection = rows(data.provider?.channels).find(c => c.channelId === channel.id);
    const healthAge = now - Date.parse(health?.checkedAt || '');
    const currentHealth = direct ? health?.state === 'connected' && health?.stale !== true && Number.isFinite(healthAge) && healthAge >= 0 && healthAge <= 30 * 60000 : provider.api?.state === 'connected' && provider.api?.stale === false && health?.state === 'listed' && health?.stale === false;
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
    const configured = direct ? directConnection?.connected === true : data.provider?.configured === true;
    const supported = directConnection?.supported === true;
    const steps = [
      direct ? step('connection', '이 계정의 게시 권한 연결', !supported ? 'unsupported' : configured ? 'configured' : 'pending', !supported ? '이 SNS는 앱에서 직접 마무리해요. 원고 승인과 예약 관리는 계속 사용할 수 있어요.' : configured ? '이 계정의 게시 권한이 연결돼 있어요. 자동 게시 켜기와 최신 연결 상태는 다음 단계에서 확인해요.' : directConnection?.reason || '회사 SNS 계정으로 로그인해 게시 권한을 허용하세요. 권한 연결만으로 자동 게시가 켜지지는 않아요.', 'accounts', 'view', '게시 권한 연결 확인') : step('connection', '발행 서비스 연결', configured ? 'configured' : 'pending', configured ? 'Postiz 설정은 저장돼 있어요. 이 SNS 계정의 연결 상태는 아래 단계에서 따로 확인해요.' : '관리자가 Postiz API 연결을 설정하고 연결된 SNS 프로필을 가져와야 해요.', 'settings', 'view', '발행 연결 설정'),
      direct ? step('publishing', '자동 게시 켜기와 연결 점검', !supported ? 'unsupported' : linked && directConnection?.enabled === true && currentHealth ? 'checked' : directConnection?.enabled === true ? 'checking' : 'pending', !supported ? '예약 시각에 게시 문구와 파일을 확인하고 SNS 앱에서 마무리하세요.' : linked && directConnection?.enabled === true && currentHealth ? '자동 게시가 켜져 있고 최근 계정 연결을 확인했어요. 실제 게시 결과는 마지막 단계에서 확인해요.' : directConnection?.enabled === true ? '자동 게시 설정은 켜져 있어요. 현재 게시 권한과 계정 상태를 다시 점검하세요.' : '계정 관리에서 권한을 확인하고 이 계정의 자동 게시를 켜세요.', 'accounts', 'view', '자동 게시 설정 확인') : step('publishing', '이 계정의 게시 연결 확인', linked && currentHealth ? 'checked' : linked ? 'checking' : 'pending', linked && currentHealth ? 'API와 연결 프로필을 확인했어요. 실제로 게시됐는지는 마지막 단계에서 확인해요.' : cap.reason || '회사 계정에 맞는 실제 SNS 프로필을 연결하고 최신 상태를 확인하세요.', 'accounts', 'view', '계정 연결 확인'),
      step('comments', '댓글 읽기·답장 권한', !native ? 'unsupported' : commentReady ? 'checked' : 'pending', !native ? '댓글 연결은 지금 Instagram과 Facebook Page에서만 쓸 수 있어요. 이 단계 없이도 게시할 수 있어요.' : commentReady ? 'Meta 계정과 답장 권한을 확인했고 댓글 수집도 켜져 있어요.' : reply?.message || collection?.reason || '게시 연결과 따로 댓글 권한을 연결하고 수집을 켜세요.', 'inbox', 'view', '댓글 연결 확인', {optional: true}),
      step('measurement', '사이트 반응 측정', verified.length ? 'observed' : observed.length ? 'partial' : links.length ? 'checking' : 'pending', verified.length ? '이 계정의 추적 링크에서 서버가 확인한 기록을 받았어요. 가입·상담별 수치는 성과에서 확인하세요.' : observed.length ? '사이트에서 브라우저 기록은 받았어요. 서버가 확인한 완료 기록은 아직 없어요.' : links.length ? '추적 링크는 있지만 사이트 방문·완료 기록은 아직 받지 못했어요.' : '허용 사이트를 등록하고 게시물에 새 추적 링크를 넣으세요. 가입·상담 기록은 실제로 완료되는 지점에 연결해야 해요.', observed.length ? 'results' : 'settings', 'view', observed.length ? '측정 결과 보기' : '사이트 측정 설정', {optional: true}),
      step('publication', '첫 예약과 공개 결과 확인', checked.length ? 'observed' : published.length ? 'partial' : scheduled.length ? 'scheduled' : 'pending', checked.length ? '게시 주소와 공개 확인 기록이 있어요. 자동 게시인지 수동 마무리인지는 예약 기록에서 볼 수 있어요.' : published.length ? '게시 주소가 기록됐어요. SNS에서 원문을 열어 실제로 공개됐는지 확인하세요.' : scheduled.length ? '예약이 저장돼 있어요. 게시된 뒤에는 주소·시각과 실제 공개 결과까지 확인하세요.' : posts.length ? '저장한 원고를 검토·승인하고 게시 시각을 예약하세요.' : '실제로 사용할 원고를 작성한 뒤 검토·승인·예약 순서로 진행하세요.', jobs.length ? 'queue' : 'compose', 'view', jobs.length ? '예약·게시 결과 보기' : '첫 게시물 작성'),
    ];
    return {channelId: channel.id, steps, nextStepId: steps.find(s => !s.optional && !['configured','checked','observed','unsupported'].includes(s.status))?.id || null};
  }), empty: channels.length === 0};
}

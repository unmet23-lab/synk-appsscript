import { NOT_HANDLED } from './request-router.mjs';

// Viewer-safe mutations belong to the feature that defines their HTTP paths.
export const personalVoiceMutation = (p, method) => (method === 'PATCH' && p === '/api/voice/preferences') || (method === 'POST' && (/^\/api\/voice\/invitations\/[0-9a-f-]+\/(accept|reject|cancel)$/.test(p) || /^\/api\/voice\/[0-9a-f-]+\/(heartbeat|leave|resume|usage|encryption\/(?:key|ack)|share\/(?:start|stop))$/.test(p) || /^\/api\/channels\/[^/]+\/voice\/join$/.test(p)));


// Owns the voice HTTP contract; authentication stays in the request context.
export function createVoiceRoutes({ assert, integration, publicVoicePermissions, rateLimit, requestId, requireChannel, voiceInvitationVisible, voicePermissionCheck, voiceRecipientCheck, voiceService, voiceState }) {
  return function handle(context) {
    const { method, p, readBody, req, respond, revalidate } = context;
    if (method === 'GET' && p === '/api/voice') return respond(200, voiceService.capabilities());
    if (method === 'GET' && p === '/api/voice/current') { return (async () => {
      await voiceService.sweep(); revalidate(); const result = voiceService.current(context.user.id, context.auth.token);
      if (result.admission) { try { requireChannel(context.user.id, result.admission.channelId); } catch { return respond(200, { admission: null }); } }
      return respond(200, result);
    
    })(); }
    if (method === 'GET' && p === '/api/voice/usage') { return (async () => {
      assert(context.auth.identity ? context.auth.identity.role === 'admin' && context.auth.identity.canManage && context.auth.identity.canWrite : context.user.role === 'owner', 403, '전체 통화 사용량은 관리자만 볼 수 있어요.');
      return respond(200, await voiceService.usage());
    
    })(); }
    if (p === '/api/voice/preferences' && ['GET', 'PATCH'].includes(method)) { return (async () => {
      const preferences = method === 'PATCH' ? voiceService.updatePreferences(context.user.id, await readBody()) : voiceService.preferences(context.user.id);
      return respond(200, { preferences });
    
    })(); }
    if (p === '/api/voice/invitations' && method === 'GET') return respond(200, { items: voiceService.invitations(context.user.id) });
    const voiceInvitation = /^\/api\/voice\/invitations\/([^/]+)(?:\/(accept|reject|cancel))?$/.exec(p);
    if (voiceInvitation && method === 'GET' && !voiceInvitation[2]) return respond(200, { invitation: voiceService.invitation(requestId(voiceInvitation[1], '통화 초대'), context.user.id) });
    if (voiceInvitation && method === 'POST' && voiceInvitation[2]) { return (async () => {
      const body = await readBody(), id = requestId(voiceInvitation[1], '통화 초대');
      if (voiceInvitation[2] === 'accept') {
        assert(Object.keys(body).every(key => ['requestId', 'client'].includes(key)) && Object.hasOwn(body, 'requestId'), 400, '통화 수락 요청이 맞지 않아요. 새로고침한 뒤 다시 수락해 주세요.');
        const invitation = voiceService.invitation(id, context.user.id), check = voicePermissionCheck(req, context.auth, invitation.channelId);
        const result = await voiceService.acceptInvitation({ id, userId: context.user.id, token: context.auth.token, requestId: body.requestId, client: body.client, check });
        revalidate(); check(); return respond(200, { ...result, permissions: publicVoicePermissions(context.auth, requireChannel(context.user.id, invitation.channelId)) });
      }
      assert(Object.keys(body).length === 0, 400, '통화 초대 응답이 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
      return respond(200, voiceService.respondInvitation({ id, userId: context.user.id, action: voiceInvitation[2] }));
    
    })(); }
    const voiceChannel = /^\/api\/channels\/([^/]+)\/voice(?:\/(join|policy|audit|invitations))?$/.exec(p);
    if (voiceChannel && method === 'GET' && !voiceChannel[2]) { return (async () => {
      requireChannel(context.user.id, voiceChannel[1]);
      await voiceService.sweep(); revalidate(); requireChannel(context.user.id, voiceChannel[1]);
      return respond(200, voiceState(context.auth, voiceChannel[1]));
    
    })(); }
    if (voiceChannel?.[2] === 'join' && method === 'POST') { return (async () => {
      const body = await readBody();
      assert(Object.keys(body).every(key => ['requestId', 'client'].includes(key)) && Object.hasOwn(body, 'requestId'), 400, '통화 참가 요청이 맞지 않아요. 새로고침한 뒤 다시 참가해 주세요.');
      const check = voicePermissionCheck(req, context.auth, voiceChannel[1]);
      rateLimit(req, `voice:${context.user.id}`);
      const result = await voiceService.join({ channelId: voiceChannel[1], userId: context.user.id, token: context.auth.token, requestId: body.requestId, client: body.client, check });
      revalidate(); check();
      return respond(200, { ...result, permissions: publicVoicePermissions(context.auth, requireChannel(context.user.id, voiceChannel[1])) });
    
    })(); }
    if (voiceChannel?.[2] === 'invitations' && method === 'POST') { return (async () => {
      const body = await readBody(), channelId = voiceChannel[1];
      assert(Object.keys(body).length === 2 && Object.hasOwn(body, 'requestId') && Object.hasOwn(body, 'recipientId'), 400, '부를 동료 정보가 맞지 않아요. 새로고침한 뒤 다시 불러 주세요.');
      const recipientId = requestId(body.recipientId, '초대할 동료'), check = voicePermissionCheck(req, context.auth, channelId);
      assert(voiceInvitationVisible(recipientId, channelId), 404, '이 동료는 지금 이 대화방에 없어요. 다른 동료를 불러 주세요.');
      const result = await voiceService.invite({ channelId, userId: context.user.id, recipientId, token: context.auth.token, requestId: body.requestId, check, recipientCheck: voiceRecipientCheck(channelId, recipientId) });
      // The invitation lives 45 seconds: ask the company server to send device notifications now, not on its timer.
      if (result.created && result.invitation.state === 'pending') integration?.wakeDeviceNotifications?.();
      return respond(result.created ? 201 : 200, result);
    
    })(); }
    if (voiceChannel?.[2] === 'policy' && method === 'PATCH') { return (async () => {
      const body = await readBody(), channelId = voiceChannel[1];
      const check = () => { revalidate(); return publicVoicePermissions(context.auth, requireChannel(context.user.id, channelId)); };
      await voiceService.updatePolicy({ channelId, actorId: context.user.id, input: body, check });
      revalidate(); return respond(200, voiceState(context.auth, channelId));
    
    })(); }
    if (voiceChannel?.[2] === 'audit' && method === 'GET') {
      assert(publicVoicePermissions(context.auth, requireChannel(context.user.id, voiceChannel[1])).canModerate, 403, '이 대화방의 통화 기록은 방 관리자만 볼 수 있어요.');
      return respond(200, { items: voiceService.audit(voiceChannel[1]) });
    }
    const voiceMedia = /^\/api\/voice\/([^/]+)\/(encryption\/(key|ack)|share\/(start|stop))$/.exec(p);
    if (voiceMedia && method === 'POST') { return (async () => {
      if (voiceMedia[2].startsWith('encryption/') && integration) {
        const keyOrigin = new URL(integration.origin);
        assert(keyOrigin.protocol === 'https:' || keyOrigin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(keyOrigin.hostname), 403, '암호화 키는 보안 연결(HTTPS)에서만 받을 수 있어요.');
      }
      const body = await readBody(), id = requestId(voiceMedia[1], '통화 참가'), input = { id, userId: context.user.id, token: context.auth.token };
      if (voiceMedia[2] === 'encryption/key') {
        assert(Object.keys(body).length === 0, 400, '암호화 키 요청이 맞지 않아요. 새로고침한 뒤 다시 참가해 주세요.');
        return respond(200, await voiceService.encryptionKey(input));
      }
      if (voiceMedia[2] === 'encryption/ack') return respond(200, await voiceService.acknowledgeEncryption({ ...input, input: body }));
      if (voiceMedia[2] === 'share/start') return respond(200, await voiceService.startShare({ ...input, input: body }));
      assert(Object.keys(body).length === 0, 400, '화면 공유 끝내기 요청이 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
      return respond(200, await voiceService.stopShare(input));
    
    })(); }
    const voiceAdmission = /^\/api\/voice\/([^/]+)\/(heartbeat|leave|resume|usage)$/.exec(p);
    if (voiceAdmission && method === 'POST') { return (async () => {
      assert(voiceService.capabilities().enabled, 503, '아직 통화 기능이 꺼져 있어요. 관리자에게 켜 달라고 해 주세요.');
      const body = await readBody();
      const id = requestId(voiceAdmission[1], '통화 참가');
      if (voiceAdmission[2] === 'usage') return respond(200, await voiceService.reportUsage({ id, userId: context.user.id, token: context.auth.token, input: body }));
      assert(Object.keys(body).length === 0, 400, '통화 연결 요청이 맞지 않아요. 새로고침한 뒤 다시 연결해 주세요.');
      const result = await voiceService[voiceAdmission[2]]({ id, userId: context.user.id, token: context.auth.token });
      if (voiceAdmission[2] === 'resume') { revalidate(); result.permissions = publicVoicePermissions(context.auth, requireChannel(context.user.id, result.call.channelId)); }
      return respond(200, result);
    
    })(); }
    return NOT_HANDLED;
  };
}

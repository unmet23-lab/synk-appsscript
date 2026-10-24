import { NOT_HANDLED } from './request-router.mjs';

// Owns the channels HTTP contract; authentication stays in the request context.
export function createChannelsRoutes({ CHANNEL_CATEGORIES, TEAM_CHANNEL_DESCRIPTION, activeDownloads, all, assert, bridge, canManageChannel, canRestoreProject, channelMembers, channelShape, channelsFor, createChannel, managedProject, members, now, one, projectChannel, projectManager, publish, requireChannel, run, selectedMemberIds, selectedProject, textField, transaction, verifyProjectHistoryAudience }) {
  return function handle(context) {
    const { method, p, readBody, respond } = context;
    if (method === 'GET' && p === '/api/channels') return respond(200, { channels: channelsFor(context.user.id) });
    if (method === 'GET' && p === '/api/channels/deleted') {
      const rows = all('SELECT c.* FROM channels c WHERE c.deleted_at IS NOT NULL AND (c.archived_by_leave=? OR EXISTS(SELECT 1 FROM memberships m WHERE m.channel_id=c.id AND m.user_id=?)) ORDER BY c.deleted_at DESC,c.id', context.user.id, context.user.id).filter(channel => canRestoreProject(channel, context.user.id));
      return respond(200, { channels: rows.map(channel => channelShape(channel, context.user.id)) });
    }
    const projectLeave = p.match(/^\/api\/channels\/([^/]+)\/leave$/);
    if (method === 'POST' && projectLeave) { return (async () => {
      await readBody();
      const channelId = projectLeave[1];
      // Repeating one's own completed departure is safe, without exposing a room to outsiders.
      if (!one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, context.user.id) && one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channelId, context.user.id)) return respond(200, { ok: true, newManagerId: null, archived: one('SELECT archived_by_leave FROM channels WHERE id=?', channelId)?.archived_by_leave === context.user.id });
      const channel = requireChannel(context.user.id, channelId);
      assert(projectChannel(channel), 403, '프로젝트 대화방에서만 나갈 수 있어요.');
      const result = transaction(() => {
        run('INSERT INTO channel_departures(channel_id,user_id,left_at) VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO UPDATE SET left_at=excluded.left_at,rejoined_at=NULL,revision=channel_departures.revision+1', channelId, context.user.id, now());
        run('DELETE FROM memberships WHERE channel_id=? AND user_id=?', channelId, context.user.id);
        const newManagerId = projectManager(channel);
        run('UPDATE channels SET creator_id=? WHERE id=?', newManagerId, channelId);
        const archived = channelMembers(channelId).length === 0;
        if (archived) run('UPDATE channels SET deleted_at=?,deleted_by=?,archived_by_leave=?,lifecycle_version=lifecycle_version+1 WHERE id=?', now(), context.user.id, context.user.id, channelId);
        return { newManagerId, archived };
      });
      for (const download of activeDownloads) if (download.channelId === channelId && download.userId === context.user.id) { download.stream.destroy(); download.res.destroy(); }
      publish('channel', channelId);
      publish('channel', null, context.user.id);
      return respond(200, { ok: true, ...result });
    
    })(); }
    const projectLifecycle = p.match(/^\/api\/channels\/([^/]+)(\/restore)?$/);
    if (projectLifecycle && ((method === 'DELETE' && !projectLifecycle[2]) || (method === 'POST' && projectLifecycle[2]))) { return (async () => {
      if (method === 'POST') await readBody();
      const channel = one('SELECT c.* FROM channels c WHERE c.id=? AND (EXISTS(SELECT 1 FROM memberships m WHERE m.channel_id=c.id AND m.user_id=?) OR (?=1 AND c.archived_by_leave=?))', projectLifecycle[1], context.user.id, method === 'POST' ? 1 : 0, context.user.id);
      assert(channel, 404, '대화방을 찾지 못했어요. 대화 목록을 새로 불러와 주세요.');
      assert(method === 'POST' ? canRestoreProject(channel, context.user.id) : managedProject(channel, context.user.id), 403, '대화방 삭제와 복원은 이 방을 만든 크루나 관리자만 할 수 있어요.');
      if (method === 'DELETE') {
        if (!channel.deleted_at) {
          run('UPDATE channels SET deleted_at=?,deleted_by=?,lifecycle_version=lifecycle_version+1 WHERE id=? AND deleted_at IS NULL', now(), context.user.id, channel.id);
          for (const download of activeDownloads) if (download.channelId === channel.id) { download.stream.destroy(); download.res.destroy(); }
          publish('channel', channel.id);
        }
        return respond(200, { ok: true });
      }
      if (channel.deleted_at) {
        transaction(() => {
          if (channel.scope === 'public') {
            const activeIds = members().filter(member => (channel.archived_by_leave === context.user.id && member.id === context.user.id) || !one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channel.id, member.id)).map(member => member.id);
            // A public restoration admits current crew, including people who joined while it was deleted.
            verifyProjectHistoryAudience(channel, context.user.id, activeIds, 'restore');
            for (const id of activeIds) run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, id);
          }
          if (channel.archived_by_leave === context.user.id) {
            if (channel.scope !== 'public') verifyProjectHistoryAudience(channel, context.user.id, [...new Set([...channelMembers(channel.id).map(member => member.id), context.user.id])], 'restore');
            run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, context.user.id);
            run('UPDATE channel_departures SET rejoined_at=? WHERE channel_id=? AND user_id=?', now(), channel.id, context.user.id);
          }
          run('UPDATE channels SET deleted_at=NULL,deleted_by=NULL,archived_by_leave=NULL,lifecycle_version=lifecycle_version+1 WHERE id=?', channel.id);
          run('UPDATE channels SET creator_id=? WHERE id=?', projectManager(one('SELECT * FROM channels WHERE id=?', channel.id)), channel.id);
        });
        publish('channel', channel.id);
      }
      return respond(200, { channel: channelShape(one('SELECT * FROM channels WHERE id=?', channel.id), context.user.id) });
    
    })(); }
    const teamChannel = p.match(/^\/api\/teams\/([^/]+)\/channel$/);
    if (method === 'POST' && teamChannel) { return (async () => {
      await readBody();
      const teamId = teamChannel[1];
      assert(bridge?.inTeam(teamId, context.user.id), 404, '들어갈 수 있는 팀을 찾지 못했어요. 대화 목록을 새로 불러와 주세요.');
      const team = bridge.teamsFor(context.user.id).find(team => team.id === teamId);
      const existing = one("SELECT * FROM channels WHERE scope='team' AND team_id=?", teamId);
      const channel = existing || transaction(() => createChannel(team.name, TEAM_CHANNEL_DESCRIPTION, 'channel', bridge.teamMembers(teamId), null, 'team', context.user.id, teamId));
      if (!existing) publish('channel', channel.id);
      return respond(existing ? 200 : 201, { channel: channelShape(channel, context.user.id) });
    
    })(); }
    if (method === 'POST' && p === '/api/channels') { return (async () => {
      const body = await readBody();
      assert(body.systemKey === undefined, 400, '기본 대화방은 직접 만들 수 없어요.');
      assert(body.teamId === undefined, 400, '팀 대화방은 대화 목록에서 우리 팀을 눌러 열어 주세요.');
      const name = textField(body.name, '대화방 이름', 40, 1);
      const description = textField(body.description ?? '', '설명', 200);
      const category = body.category ?? 'generic';
      assert(CHANNEL_CATEGORIES.has(category), 400, '대화방 종류를 일반·팀·프로젝트 가운데에서 골라 주세요.');
      const scope = body.scope ?? (category === 'project' ? 'private' : 'public');
      assert(scope === 'public' || (scope === 'private' && category === 'project'), 400, '고른 크루만 들어오는 대화방은 프로젝트로 만들어 주세요.');
      assert(scope === 'private' || body.memberIds === undefined, 400, '공개 대화방에는 모든 크루가 저절로 들어와요. 크루를 고르려면 프로젝트를 ‘고른 크루만 참여’로 만들어 주세요.');
      const memberIds = scope === 'private' ? [...new Set([context.user.id, ...selectedMemberIds(body.memberIds ?? [])])] : members().map(m => m.id);
      const channel = transaction(() => createChannel(name, description, 'channel', memberIds, null, category, context.user.id, null, scope));
      publish('channel', channel.id);
      return respond(201, { channel: channelShape(channel, context.user.id) });
    
    })(); }
    const participants = p.match(/^\/api\/channels\/([^/]+)\/members$/);
    if (participants && (method === 'GET' || method === 'POST')) { return (async () => {
      // Recheck after the body has arrived; an earlier membership must not authorize a delayed request.
      const body = method === 'POST' ? await readBody() : null;
      const channel = requireChannel(context.user.id, participants[1]);
      if (method === 'GET') return respond(200, { channel: channelShape(channel, context.user.id), members: channelMembers(channel.id) });
      assert(channel.scope !== 'public' || projectChannel(channel), 409, '이 대화방에는 이미 모든 크루가 들어와 있어요. 고른 크루만 초대하려면 새 프로젝트 대화방을 만들어 주세요.');
      assert(projectChannel(channel) && canManageChannel(channel, context.user.id), 403, '크루 초대는 이 방을 만든 크루나 관리자만 할 수 있어요.');
      const ids = selectedMemberIds(body.memberIds);
      const currentIds = channelMembers(channel.id).map(member => member.id);
      const addedIds = ids.filter(id => !currentIds.includes(id));
      if (channel.scope === 'public') assert(addedIds.length && addedIds.every(id => one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channel.id, id)), 409, '이 대화방에는 이미 모든 크루가 들어와 있어요. 나간 크루만 다시 초대할 수 있어요.');
      if (addedIds.length) transaction(() => {
        verifyProjectHistoryAudience(channel, context.user.id, [...currentIds, ...addedIds]);
        for (const id of addedIds) {
          run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, id);
          run('UPDATE channel_departures SET rejoined_at=? WHERE channel_id=? AND user_id=?', now(), channel.id, id);
        }
      });
      if (addedIds.length) publish('channel', channel.id);
      return respond(200, { channel: channelShape(channel, context.user.id), members: channelMembers(channel.id), addedIds });
    
    })(); }
    if (method === 'PATCH' && /^\/api\/channels\/[^/]+$/.test(p)) { return (async () => {
      const body = await readBody();
      const channel = requireChannel(context.user.id, p.split('/')[3]);
      assert(!channel.system_key && body.systemKey === undefined, 403, '기본 대화방의 이름과 설정은 바꿀 수 없어요.');
      assert(canManageChannel(channel, context.user.id), 403, '대화방 정보는 이 방을 만든 크루나 관리자만 바꿀 수 있어요.');
      assert((body.scope === undefined || body.scope === channel.scope) && body.teamId === undefined && body.memberIds === undefined, 400, '만든 대화방의 참여 범위는 바꿀 수 없어요. 크루를 더하려면 ‘크루 초대’를 써 주세요.');
      const name = body.name === undefined ? channel.name : textField(body.name, '대화방 이름', 40, 1);
      const description = body.description === undefined ? channel.description : textField(body.description, '설명', 200);
      const category = body.category === undefined ? channel.category : body.category;
      assert(CHANNEL_CATEGORIES.has(category), 400, '대화방 종류를 일반·팀·프로젝트 가운데에서 골라 주세요.');
      assert(!selectedProject(channel) || category === 'project', 400, '고른 크루만 들어오는 프로젝트는 종류를 바꿀 수 없어요.');
      run('UPDATE channels SET name=?,description=?,category=? WHERE id=?', name, description, category, channel.id);
      publish('channel', channel.id);
      return respond(200, { channel: channelShape(one('SELECT * FROM channels WHERE id=?', channel.id), context.user.id) });
    
    })(); }
    if (method === 'POST' && p === '/api/dms') { return (async () => {
      const body = await readBody();
      assert(typeof body.userId === 'string' && members().some(member => member.id === body.userId), 404, '이 크루를 찾지 못했어요. 크루 목록을 새로 불러와 주세요.');
      if (body.userId === context.user.id) {
        const self = one('SELECT * FROM channels WHERE pair_key=?', `self:${context.user.id}`);
        return respond(200, { channel: channelShape(self, context.user.id) });
      }
      const pair = [context.user.id, body.userId].sort().join(':');
      const existing = one('SELECT * FROM channels WHERE pair_key=?', pair);
      const channel = existing || transaction(() => createChannel('개인 대화', '두 사람만 볼 수 있는 대화', 'dm', [context.user.id, body.userId], pair));
      if (!existing) publish('channel', channel.id);
      return respond(existing ? 200 : 201, { channel: channelShape(channel, context.user.id) });
    
    })(); }
    return NOT_HANDLED;
  };
}

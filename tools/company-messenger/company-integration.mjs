import { randomBytes, randomUUID } from 'node:crypto';

// A bridge stores identifiers only. Company remains the authority for credentials and employment.
export function createCompanyIdentityBridge({ db, listUsers, listTeams = () => [], identityLinks = [], ensurePublicChannels = () => {} }) {
  db.exec('CREATE TABLE IF NOT EXISTS company_identity_links (company_user_id TEXT PRIMARY KEY, messenger_user_id TEXT NOT NULL UNIQUE REFERENCES users(id), created_at TEXT NOT NULL)');
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const withTransaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  withTransaction(() => {
    if (!Array.isArray(identityLinks)) throw new Error('메신저 계정 연결 목록 형식을 확인해 주세요.');
    const companyUsers = listUsers();
    for (const link of identityLinks) {
      if (!link || typeof link.companyUserId !== 'string' || typeof link.messengerUserId !== 'string') throw new Error('메신저 계정 연결 식별자를 확인해 주세요.');
      if (!companyUsers.some(user => user.id === link.companyUserId) || !one('SELECT id FROM users WHERE id=?', link.messengerUserId)) throw new Error('연결할 기존 회사 계정과 메신저 계정을 찾을 수 없습니다.');
      const prior = one('SELECT * FROM company_identity_links WHERE company_user_id=? OR messenger_user_id=?', link.companyUserId, link.messengerUserId);
      if (prior && (prior.company_user_id !== link.companyUserId || prior.messenger_user_id !== link.messengerUserId)) throw new Error('이미 다른 계정에 연결되어 있습니다. 기존 연결은 자동 변경하지 않습니다.');
      run('INSERT OR IGNORE INTO company_identity_links VALUES(?,?,?)', link.companyUserId, link.messengerUserId, new Date().toISOString());
    }
  });
  let syncedRoster = null, revision = 0, currentRoster = [], currentTeams = [], profiles = new Map();
  function sync() {
    const roster = listUsers().filter(user => user.active !== false && ['admin', 'manager', 'member', 'viewer'].includes(user.role));
    const teams = listTeams().filter(team => team.active !== false);
    const signature = JSON.stringify([roster.map(user => [user.id, user.name, user.role, user.teamId || null]).sort((a, b) => a[0].localeCompare(b[0])), teams.map(team => [team.id, team.name]).sort((a, b) => a[0].localeCompare(b[0]))]);
    if (signature === syncedRoster) return roster;
    const result = withTransaction(() => {
      for (const user of roster) {
        let link = one('SELECT * FROM company_identity_links WHERE company_user_id=?', user.id);
        if (!link) {
          const userId = randomUUID(), createdAt = new Date().toISOString();
          // An unguessable credential is never issued. This identity can only enter through company auth.
          run('INSERT INTO users(id,username,name,role,password,created_at) VALUES(?,?,?,?,?,?)', userId, `company.${randomBytes(10).toString('hex')}`, user.name, user.role === 'admin' ? 'owner' : 'member', `${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`, createdAt);
          run('INSERT INTO company_identity_links VALUES(?,?,?)', user.id, userId, createdAt);
          const selfId = randomUUID();
          run("INSERT INTO channels(id,name,description,kind,pair_key,created_at,scope) VALUES(?,?,?,'self',?,?,'private')", selfId, '나에게', '메모와 파일을 나만 볼 수 있는 공간', `self:${userId}`, createdAt);
          run('INSERT INTO memberships(channel_id,user_id) VALUES(?,?)', selfId, userId);
          link = { messenger_user_id: userId };
        }
        run('UPDATE users SET name=?,role=? WHERE id=?', user.name, user.role === 'admin' ? 'owner' : 'member', link.messenger_user_id);
        run("INSERT OR IGNORE INTO memberships(channel_id,user_id) SELECT id,? FROM channels WHERE kind='channel' AND scope='public' AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM channel_departures d WHERE d.channel_id=channels.id AND d.user_id=? AND d.rejoined_at IS NULL)", link.messenger_user_id, link.messenger_user_id);
      }
      for (const channel of db.prepare("SELECT * FROM channels WHERE scope='team'").all()) {
        const team = teams.find(team => team.id === channel.team_id);
        const permitted = team ? roster.filter(user => user.teamId === team.id).map(user => one('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?', user.id).messenger_user_id) : [];
        const allowed = new Set(permitted);
        for (const member of db.prepare('SELECT user_id FROM memberships WHERE channel_id=?').all(channel.id)) if (!allowed.has(member.user_id)) run('DELETE FROM memberships WHERE channel_id=? AND user_id=?', channel.id, member.user_id);
        for (const userId of permitted) run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, userId);
        if (team && channel.name !== team.name) run('UPDATE channels SET name=? WHERE id=?', team.name, channel.id);
      }
      // Leaving the company revokes selected-project invitations. Reactivation requires a fresh invitation.
      // Public legacy projects, team rooms, private DMs and personal notes keep their separate policies.
      const activeIds = new Set(roster.map(user => one('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?', user.id).messenger_user_id));
      for (const membership of db.prepare("SELECT m.channel_id,m.user_id FROM memberships m JOIN channels c ON c.id=m.channel_id WHERE c.kind='channel' AND c.scope='private'").all()) {
        if (!activeIds.has(membership.user_id)) run('DELETE FROM memberships WHERE channel_id=? AND user_id=?', membership.channel_id, membership.user_id);
      }
      ensurePublicChannels(roster.map(user => one('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?', user.id).messenger_user_id));
      return roster;
    });
    syncedRoster = signature;
    currentRoster = roster;
    currentTeams = teams;
    profiles = new Map(roster.map(user => {
      const linked = resolve(user.id);
      const team = teams.find(team => team.id === user.teamId);
      return [linked.id, { companyRole: user.role, teamId: team?.id || null, teamName: team?.name || null }];
    }));
    revision++;
    return result;
  }
  function resolve(companyUserId) {
    const link = one('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?', companyUserId);
    return link ? one('SELECT * FROM users WHERE id=?', link.messenger_user_id) : null;
  }
  function members() {
    return currentRoster.map(user => resolve(user.id)).filter(Boolean);
  }
  function teamMembers(teamId) { return currentTeams.some(team => team.id === teamId) ? [...profiles].filter(([, profile]) => profile.teamId === teamId).map(([id]) => id) : []; }
  function inTeam(teamId, userId) { return Boolean(teamId && profiles.get(userId)?.teamId === teamId && currentTeams.some(team => team.id === teamId)); }
  function teamsFor(userId) {
    return currentTeams.map(team => {
      const memberIds = teamMembers(team.id), canOpen = inTeam(team.id, userId);
      return { id: team.id, name: team.name, memberIds, memberCount: memberIds.length, canOpen, channelId: canOpen ? one("SELECT id FROM channels WHERE scope='team' AND team_id=?", team.id)?.id || null : null };
    });
  }
  return { sync, resolve, members, teamMembers, inTeam, teamsFor, companyUserId: userId => one('SELECT company_user_id FROM company_identity_links WHERE messenger_user_id=?', userId)?.company_user_id || null, profile: userId => profiles.get(userId) || { teamId: null, teamName: null, companyRole: null }, accessKey: userId => JSON.stringify(profiles.get(userId) ? [profiles.get(userId).teamId, profiles.get(userId).companyRole] : null), get revision() { return revision; } };
}

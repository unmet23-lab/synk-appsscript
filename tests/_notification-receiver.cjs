'use strict';
// Telegram의 계정+대상+random_id 중복 제거 계약을 영속 SQLite로 모의한다.
const { DatabaseSync } = require('node:sqlite');
module.exports = file => {
  const open = () => {
    const db = new DatabaseSync(file);
    db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS received (id INTEGER PRIMARY KEY, random_id TEXT UNIQUE, body TEXT, bot TEXT, target TEXT)');
    return db;
  };
  const receive = async (body, delivery) => {
    const db = open();
    try {
      db.prepare('INSERT OR IGNORE INTO received(random_id,body,bot,target) VALUES(?,?,?,?)').run(delivery.randomId, body, delivery.botId, delivery.target);
      const row = db.prepare('SELECT * FROM received WHERE random_id=?').get(delivery.randomId);
      if (row.body !== body || row.bot !== delivery.botId || row.target !== delivery.target) throw Error('ID_REUSED_WITH_DIFFERENT_MESSAGE');
      return { messageId: String(row.id) };
    } finally { db.close(); }
  };
  receive.rows = () => { const db = open(); try { return db.prepare('SELECT * FROM received ORDER BY id').all(); } finally { db.close(); } };
  return receive;
};

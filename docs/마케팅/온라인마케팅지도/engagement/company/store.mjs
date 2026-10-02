import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from 'node:crypto';

export const now = () => new Date().toISOString();
export const hash = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('비밀번호는 12~256자로 입력해 주세요.');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password,salt,64).toString('hex');
}
export function passwordMatches(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt,key] = (stored || '00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');
  const actual = scryptSync(password,salt,64);
  return key?.length === 128 && timingSafeEqual(actual,Buffer.from(key,'hex'));
}
export function publicUser(user) {
  if (!user) return null;
  const {passwordHash:_,...safe} = user;
  return safe;
}
export class Store {
  #statements=new Map();
  #statement(sql){let prepared=this.#statements.get(sql);if(!prepared){prepared=this.db.prepare(sql);this.#statements.set(sql,prepared);}return prepared;}
  constructor(directory) {
    mkdirSync(directory,{recursive:true,mode:0o700});
    this.directory=directory;
    const keyFile=join(directory,'encryption.key');
    if (!existsSync(keyFile)) writeFileSync(keyFile,randomBytes(32),{flag:'wx',mode:0o600});
    this.key=readFileSync(keyFile);
    if(this.key.length!==32) throw new Error('암호화 키 파일을 확인해 주세요.');
    this.db=new DatabaseSync(join(directory,'company.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, ciphertext TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, purpose TEXT NOT NULL, userId TEXT, body TEXT NOT NULL, expiresAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS token_expiry ON tokens(expiresAt);`);
    if(!this.get('settings','company'))this.put('settings','company',{companyName:'SYNK',enabled:true,hourKst:9});
    this.#statement('DELETE FROM tokens WHERE expiresAt < ?').run(now());
  }
  get(kind,id) { const row=this.#statement('SELECT body FROM documents WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(row.body):null; }
  all(kind) { return this.#statement('SELECT body FROM documents WHERE kind=? ORDER BY rowid').all(kind).map(x=>JSON.parse(x.body)); }
  put(kind,id,body) { this.#statement('INSERT INTO documents(kind,id,body) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,id,JSON.stringify(body));return body; }
  remove(kind,id) {this.#statement('DELETE FROM documents WHERE kind=? AND id=?').run(kind,id);}
  transaction(fn) {this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  encrypt(value) {const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
  decrypt(value) {const data=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',this.key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString());}
  setSecret(id,value) {this.#statement('INSERT INTO credentials VALUES (?,?) ON CONFLICT(id) DO UPDATE SET ciphertext=excluded.ciphertext').run(id,this.encrypt(value));}
  secret(id) {const row=this.#statement('SELECT ciphertext FROM credentials WHERE id=?').get(id);return row?this.decrypt(row.ciphertext):null;}
  deleteSecret(id) {this.#statement('DELETE FROM credentials WHERE id=?').run(id);}
  mint(purpose,userId,body={},minutes=30) {const value=token();this.#statement('INSERT INTO tokens VALUES (?,?,?,?,?)').run(hash(value),purpose,userId,JSON.stringify(body),new Date(Date.now()+minutes*60000).toISOString());return value;}
  readToken(value,purpose) {if(typeof value!=='string'||value.length>200)return null;const row=this.#statement('SELECT * FROM tokens WHERE hash=? AND purpose=? AND expiresAt>?').get(hash(value),purpose,now());return row?{...row,body:JSON.parse(row.body)}:null;}
  consume(value,purpose) {return this.transaction(()=>{const row=this.readToken(value,purpose);if(row)this.#statement('DELETE FROM tokens WHERE hash=?').run(hash(value));return row;});}
  revokeUser(userId) {this.#statement('DELETE FROM tokens WHERE userId=?').run(userId);}
  createUser({email,name,role='member',password,teamId=null}) {
    email=String(email||'').trim().toLowerCase();name=String(name||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>80)throw new Error('이름과 이메일을 확인해 주세요.');
    if(this.all('users').some(u=>u.email===email))throw new Error('이미 등록된 이메일입니다.');
    if(!['admin','manager','member','viewer'].includes(role))throw new Error('크루 역할을 확인해 주세요.');
    const id=randomUUID();
    return this.put('users',id,{id,email,name,role,teamId,active:true,passwordHash:password?passwordHash(password):null,createdAt:now()});
  }
  close(){this.#statements.clear();this.db.close();}
}

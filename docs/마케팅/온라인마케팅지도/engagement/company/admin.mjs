import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Store, now } from './store.mjs';

const [command,target]=process.argv.slice(2);
if(!['setup','reset-link'].includes(command)||command==='reset-link'&&!target)throw new Error('사용법: node admin.mjs setup | node admin.mjs reset-link <로그인 이메일>');
const origin=new URL(process.env.SYNK_COMPANY_ORIGIN||'http://127.0.0.1:4191');
if(origin.origin!==origin.href.replace(/\/$/,'')||!['http:','https:'].includes(origin.protocol))throw new Error('SYNK_COMPANY_ORIGIN에 회사 웹주소를 입력해 주세요.');
const store=new Store(process.env.SYNK_COMPANY_DATA||join(dirname(fileURLToPath(import.meta.url)),'data'));
try{
  if(command==='setup'){
    if(store.all('users').length)throw new Error('관리자가 이미 있습니다. 기존 관리자 계정으로 로그인하세요.');
    const value=store.mint('setup',null,{},30);
    console.log('30분 동안 한 번 사용할 수 있는 관리자 설정 링크입니다. 본인 브라우저에서 열어 주세요.');
    console.log(origin.origin+'/#setup='+value);
  }else{
    // The last way back for an account no one in the workspace can reset, an administrator included (2026-10-23).
    // Whoever can run this already holds the server. It writes the same SQLite file as the running server (WAL, busy timeout).
    const email=String(target).trim().toLowerCase(),user=store.all('users').find(row=>row.email===email);
    if(!user)throw new Error('그 로그인 이메일의 계정이 없습니다.');
    if(user.active===false)throw new Error('이용을 멈춘 계정입니다. 먼저 이용을 다시 허용해 주세요.');
    // The expiry is read inside the write: the running server may replace this link right after it commits.
    const {value,expiresAt}=store.transaction(()=>{
      store.revokeTokens(user.id,'password-reset');
      const value=store.mint('password-reset',user.id,{issuedBy:null,via:'operator'},30),expiresAt=store.readToken(value,'password-reset').expiresAt,id=randomUUID();
      store.put('audit',id,{id,userId:null,by:'operator',action:'password-reset-link',subject:user.id,expiresAt,at:now()});
      return {value,expiresAt};
    });
    console.log(`${user.name}(${user.email}) 계정의 비밀번호 재설정 링크입니다. 30분 동안 한 번 쓸 수 있어요(${expiresAt}까지). 그 사람에게만 전해 주세요.`);
    console.log(origin.origin+'/#reset='+value);
  }
}finally{store.close();}

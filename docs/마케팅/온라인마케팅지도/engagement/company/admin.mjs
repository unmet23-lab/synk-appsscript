import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';

if(process.argv[2]!=='setup')throw new Error('사용법: node admin.mjs setup');
const origin=new URL(process.env.SYNK_COMPANY_ORIGIN||'http://127.0.0.1:4191');
if(origin.origin!==origin.href.replace(/\/$/,'')||!['http:','https:'].includes(origin.protocol))throw new Error('SYNK_COMPANY_ORIGIN에 회사 웹주소를 입력해 주세요.');
const store=new Store(process.env.SYNK_COMPANY_DATA||join(dirname(fileURLToPath(import.meta.url)),'data'));
try{
  if(store.all('users').length)throw new Error('관리자가 이미 있습니다. 기존 관리자 계정으로 로그인하세요.');
  const value=store.mint('setup',null,{},30);
  console.log('30분 동안 한 번 사용할 수 있는 관리자 설정 링크입니다. 본인 브라우저에서 열어 주세요.');
  console.log(origin.origin+'/#setup='+value);
}finally{store.close();}

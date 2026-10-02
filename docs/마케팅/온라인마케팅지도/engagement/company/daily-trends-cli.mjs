import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { createDailyTrendsService } from './daily-trends-service.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const flags=new Set(process.argv.slice(2));
if([...flags].some(value=>!['--scheduled','--collect','--status'].includes(value))||flags.size!==1)throw new Error('사용법: node daily-trends-cli.mjs --scheduled | --collect | --status');
const directory=resolve(process.env.SYNK_COMPANY_DATA||join(here,'data'));
if(!existsSync(join(directory,'company.sqlite'))||!existsSync(join(directory,'encryption.key')))throw new Error('기존 회사 데이터와 암호화 키를 찾을 수 없습니다. 새 데이터는 만들지 않았습니다.');
const store=new Store(directory),service=createDailyTrendsService({store});
try{
  const before=service.state();
  if(flags.has('--scheduled'))await service.tick();
  if(flags.has('--collect'))await service.collect({force:true,trigger:'cli'});
  const state=service.state(),snapshot=state.snapshot,changed=before.lastAttempt?.id!==state.lastAttempt?.id||before.lastAttempt?.status!==state.lastAttempt?.status;
  console.log(JSON.stringify({date:state.date,changed,running:state.running,settings:state.settings,nextRunAt:state.nextRunAt,collectedAt:snapshot?.collectedAt||null,itemCount:snapshot?.items.length||0,status:state.lastAttempt?.status||'not_collected',sources:(snapshot?.sources||[]).map(source=>({id:source.id,status:source.status,count:source.count,retained:Boolean(source.retained)}))}));
  if(changed&&state.lastAttempt?.status==='error')process.exitCode=1;
}finally{await service.stop();store.close();}

import { createServer } from '../server.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Fixed public boundary; this process never accepts account tokens or account data.
export function productionOptions(env=process.env){
  if(env.SYNK_SPACESHIP_PUBLIC!=='1')throw new Error('Explicit public API mode is required.');
  const maxRooms=Number(env.SYNK_SPACESHIP_MAX_ROOMS??50);
  if(!Number.isSafeInteger(maxRooms)||maxRooms<1||maxRooms>50)throw new Error('Public room limit must be between 1 and 50.');
  return {publicMode:true,serveStatic:false,allowedHosts:['workspace.synk.im'],allowedOrigins:['https://synk.im'],trustedProxyIps:['172.30.77.3'],maxRooms,maxRoomsPerAddress:12,maxRateEntries:2048};
}

export function startPublicServer(env=process.env){
  const server=createServer(productionOptions(env));
  server.listen(4318,'0.0.0.0',()=>process.stdout.write('SYNK spaceship API listening on internal port 4318\n'));
  let stopping=false;
  const stop=()=>{
    if(stopping)return;stopping=true;server.closeGame();
    server.close(()=>process.exit(0));
    setTimeout(()=>{server.closeAllConnections();process.exit(0);},5000).unref();
  };
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)startPublicServer();

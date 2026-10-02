// Executed in the guarded deployment script before touching the active playlist.
const serverJoinTests=[];
if(p.phase==='trial'){
 const incoming=p.files[0].incoming;
 assert.equal(fs.readFileSync(incoming).subarray(8,12).toString('hex'),'12001200');
 const probe=file=>JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{encoding:'utf8'}));
 const checked=args=>{
  const r=cp.spawnSync('ffmpeg',['-hide_banner','-v','warning','-xerror',...args,'-f','null','/dev/null'],{encoding:'utf8',timeout:90000});
  assert.equal(r.status,0,r.stderr);assert.equal(r.stderr.trim(),'');
 };
 checked(['-i',incoming]);
 for(const [name,left,right] of [
  ['old19-to-new3',root+'소리/'+p.initial.files[1].name,incoming],
  ['new3-to-first',incoming,root+'소리/'+p.initial.files[0].name]
 ]){
  const list='/tmp/synk-citypop3-'+name+'.ffconcat',duration=Number(probe(left).format.duration);
  const nl=String.fromCharCode(10),q=String.fromCharCode(39);
  fs.writeFileSync(list,'ffconcat version 1.0'+nl+'file '+q+left+q+nl+'duration '+duration+nl+'file '+q+right+q+nl+'duration '+probe(right).format.duration+nl);
  checked(['-f','concat','-safe','0','-i',list,'-ss',String(duration-8),'-t','30','-af','asetpts=N/SR/TB','-c:a','aac','-ar','44100','-ac','2']);
  serverJoinTests.push({name,decodedSeconds:30,errors:0});
 }
}

'use strict';
// Two explicitly requested backgrounds only. Existing artwork and live radio are not edited.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const scenes={
 '11':{source:'docs/라디오/무대/dream_water.png',sha:'3086e9afb1124b7b9c6940619194cb8a4d00d3eb6b03a21a320cb8a21c4a47c0',prompt:'A single locked-off tripod shot, an extremely calm seamless living miniature. Only the water moves: delicate broad ripples travel slowly across the lavender mirror surface, gently carrying the reflected warm light and coherent reflections. A faint wispy mist drifts almost imperceptibly along the far water. The arches, small door, floating wool spheres, sun, horizon and camera remain precisely still in the same positions and shapes. Preserve the original dry wool fibers, pastel palette, composition and stable soft exposure. Quiet continuous fluid motion with no splashes, no pulsing, no zoom, no new objects and no characters. Return smoothly to the starting water arrangement at the end.'},
 '13':{source:'docs/라디오/무대/dream_field.png',sha:'c3d6fb508a9244ca34e83de4631f5c1757b1f21b6045b06112dc469b71b10b1a',prompt:'A single locked-off tripod shot, a quiet seamless living wool miniature at sunset. A few existing firefly lights drift very slowly in small graceful arcs above the meadow, their warm glow gently brightening and dimming at different times. The thin high clouds drift barely perceptibly. All trees, foreground stems, flowers, terrain, horizon, sun and the camera stay firmly still; their wool fibers remain stable rather than shaking or boiling. Preserve the exact composition, shapes, warm pastel light and tactile dry felt. Restrained, peaceful motion for long listening, with steady exposure, no gusts, no waving landscape, no zoom and no new characters. End in the starting arrangement for a smooth loop.'}
};
const id=process.argv[2],scene=scenes[id];if(!scene)throw new Error('Use 11 or 13');
const source=path.join(root,scene.source),sha=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
if(sha!==scene.sha)throw new Error('Approved source changed');
const record=path.join(__dirname,`${id}_생성기록.json`);
if(fs.existsSync(record))throw new Error('Existing generation record: inspect instead of spending twice');
const args=['generate','create','seedance_2_0','--prompt',scene.prompt,'--start-image',source,'--end-image',source,'--duration','12','--resolution','1080p','--aspect_ratio','16:9','--bitrate_mode','high','--mode','std','--generate_audio','false','--wait','--wait-timeout','20m','--json'];
const state={scene:id,started:new Date().toISOString(),source:scene.source,sourceSha256:sha,model:'seedance_2_0',duration:12,resolution:'1080p',audio:false,prompt:scene.prompt,startAndEndSameImage:true,status:'submitted'};
fs.writeFileSync(record,JSON.stringify(state,null,2));
const p=spawn('higgsfield',args,{cwd:root,windowsHide:true});let stdout='',stderr='';
p.stdout.on('data',d=>{stdout+=d;});p.stderr.on('data',d=>{stderr+=d;process.stdout.write(String(d).replace(/https?:\/\/\S+/g,'[generation URL]'));});
p.on('error',e=>{state.status='cli_error';state.error=e.message;fs.writeFileSync(record,JSON.stringify(state,null,2));process.exitCode=1;});
p.on('close',code=>{state.finished=new Date().toISOString();state.exitCode=code;state.status=code===0?'returned_needs_media_verification':'needs_review';try{state.result=JSON.parse(stdout);}catch{state.output=stdout;}state.log=stderr.replace(/https?:\/\/\S+/g,'[generation URL]');fs.writeFileSync(record,JSON.stringify(state,null,2));console.log(JSON.stringify({scene:id,status:state.status,record}));if(code!==0)process.exitCode=1;});

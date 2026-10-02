const fs=require('node:fs');const crypto=require('node:crypto');
const scenes=JSON.parse(fs.readFileSync('scenes.json'));const old=JSON.parse(fs.readFileSync('../video-v16/scenes.json'));
const differences=scenes.flatMap((s,i)=>s.id!==old[i].id||s.start!==old[i].start||s.duration!==old[i].duration?[s.id]:[]);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={scenes:scenes.length,timingDifferences:differences,voiceUnchanged:sha('audio/narration.wav')===sha('../video-v16/audio/narration.wav'),musicUnchanged:sha('.media/audio/bgm/bgm_001.wav')===sha('../video-v16/.media/audio/bgm/bgm_001.wav'),previousVersionPreserved:fs.existsSync('../video-v16/synkbrief-meeting-v16.mp4')};fs.writeFileSync('verification/continuity.json',JSON.stringify(result,null,2));console.log(result);

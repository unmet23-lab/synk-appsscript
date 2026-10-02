'use strict';
const fs=require('node:fs'),path=require('node:path');
const {base,hash,put,run,generate}=require('./revise-01-voice.cjs');
async function main(){
 const mode=process.argv[2];if(!['reference','clean'].includes(mode))throw Error('Use reference or clean');
 const native=fs.readFileSync(path.join(base,'fresh-sample-ef72fbe587ace1c2.source'));
 const referenceFile='B-original-native-stereo.wav';if(!fs.existsSync(path.join(base,referenceFile)))put(path.join(base,referenceFile),native);
 const voiceDirection='A Korean-native young adult female voice, naturally bright, fresh and lightly smiling. Friendly conversational warmth and a rounded, rich midrange. Keep the light energy alive through every final 요, with softly lifted questions and a buoyant affirmative. Do not make it childish, shrill, breathy, theatrical or like a loud ad announcer. 좋아요, 같이 들어요 flows together with only a short easy breath. Natural 6-second delivery.';
 const quality='Record a pristine premium-studio dry voice take, as if through an excellent condenser microphone and transparent preamp in a treated vocal booth. Intimate clear full-bodied vocal presence, natural low-mid warmth, detailed smooth consonants and clean airy upper harmonics. No thin or boxy telephone sound, no metallic ringing, no watery vocoder or digital warble, no grainy codec artifacts, no harsh sibilance or distortion, no background hiss, room echo, music, effects or extra words. Natural uncompressed vocal dynamics; clean transparent sound rather than aggressive loudness.';
 const profile={model:'seed_audio',sampleRate:48000,...(mode==='reference'?{referenceFile,referenceSha256:hash(native)}:{}),instruction:mode==='clean'?'Pristine dry studio recording of a bright, smiling Korean-native young adult woman. Natural cheerful conversation, rich rounded vocal body, clear detailed consonants, smooth airy highs, premium condenser microphone quality. Light fresh energy continues through every 요; gentle inviting questions and a buoyant friendly answer. No heavy falling endings, exaggerated acting, whisper, child voice, distortion, metallic artifacts, reverb, hiss, music, effects or extra words. Comfortable natural pace, about 6 seconds.':('Use the reference only for the female voice identity and cheerful character. Re-record it with clean full-band studio fidelity, do not copy its noisy or limited texture. '+voiceDirection+' '+quality)};
 const r=await generate(mode==='reference'?'B studio re-recording':'Original bright studio female','같이 들을까요? 이 노래는 어때요? 좋아요. 같이 들어요.','studio-'+mode,profile);
 const src=path.join(base,r.file),sample=path.join(base,'studio-'+mode+'.wav');
 await run('ffmpeg',['-y','-v','error','-i',src,'-af','loudnorm=I=-23:TP=-6:LRA=7','-ar','48000','-c:a','pcm_s24le',sample]);
 const raw=path.join(base,r.file.replace('.wav','.source'));
 const nativeProbe=JSON.parse(await run('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels,bits_per_sample','-of','json',raw]));
 put(path.join(base,'studio-'+mode+'-delivery.json'),JSON.stringify({sourceRecord:r,nativeProbe,sample:path.basename(sample),sha256:hash(fs.readFileSync(sample)),processing:'loudness-matched -23 LUFS WAV; 24-bit delivery is not a claim of 24-bit generated detail',humanListening:false},null,2));
 console.log(JSON.stringify({sample,nativeProbe,duration:r.duration}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

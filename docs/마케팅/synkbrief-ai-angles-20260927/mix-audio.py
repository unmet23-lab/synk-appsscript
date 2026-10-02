"""Mix retained narration, SYNK-owned Suno bed and bundled licensed SFX.

No dynamic time stretch. Music remains quiet, narration ducks it, true peak <= -1.5 dBTP.
"""
import json,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[2]
AUDIO=ROOT/'assets/audio'
TIMING=json.loads((ROOT/'audio-timing.json').read_text(encoding='utf-8'))
DURATION=TIMING['duration']
def run(args):
    r=subprocess.run(args,check=True,capture_output=True,text=True,encoding='utf-8',errors='replace')
    return r.stdout,r.stderr
def measure(file):
    _,s=run(['ffmpeg','-v','info','-i',str(file),'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'])
    return json.loads(s[s.rfind('{'):s.rfind('}')+1])
source=REPO/'docs/홍보물/BGM/시티팝_147.wav'
bed=AUDIO/'music-bed.wav'
# 25 seconds avoids the intro and leaves more than enough tail in this retained instrumental.
run(['ffmpeg','-y','-v','error','-i',str(source),'-af',f'atrim=start=25:duration={DURATION},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=6500,volume=0.14,afade=t=in:d=0.25,afade=t=out:st={DURATION-1}:d=1','-ar','48000','-ac','2','-c:a','pcm_s16le',str(bed)])
sfroot=Path('C:/Users/q1212/.agents/skills/media-use/audio/assets/sfx')
cues=[{'name':'pop','time':0.30,'gain':0.11},{'name':'click-soft','time':10.0,'gain':0.14},{'name':'whoosh-short','time':25.4333,'gain':0.11},{'name':'chime','time':46.1,'gain':0.06}]
inputs=['-i',str(AUDIO/'narration.wav'),'-i',str(bed)]
chains=['[0:a]highpass=f=70,asplit=2[voice][key]','[1:a][key]sidechaincompress=threshold=0.015:ratio=3:attack=12:release=200[bed]']
labels=['[voice]','[bed]']
for n,cue in enumerate(cues,2):
    file=AUDIO/(cue['name']+'.mp3')
    shutil.copy2(sfroot/file.name,file)
    inputs+=['-i',str(file)]
    chains.append(f'[{n}:a]volume={cue["gain"]},adelay={round(cue["time"]*1000)}:all=1[s{n}]')
    labels.append(f'[s{n}]')
chains.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0[mix]')
premix=AUDIO/'premix.wav'
run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(chains),'-map','[mix]','-ar','48000','-ac','2','-c:a','pcm_s16le',str(premix)])
m=measure(premix)
gain=min(-16-float(m['input_i']),-1.5-float(m['input_tp']))
master=AUDIO/'master.wav'
run(['ffmpeg','-y','-v','error','-i',str(premix),'-af',f'volume={gain}dB','-ar','48000','-ac','2','-c:a','pcm_s16le',str(master)])
final=measure(master)
report={'duration':DURATION,'premix':m,'final':final,'constantGainDb':gain,'voice':'Edge ko-KR-SunHiNeural','sourceBgm':'docs/홍보물/BGM/시티팝_147.wav','bgmStart':25,'bgmGain':0.14,'duckedUnderNarration':True,'sfxSource':'media-use bundled library','sfxCues':cues,'directListeningVerified':False}
(ROOT/'verification').mkdir(exist_ok=True)
(ROOT/'verification/audio-mix.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'duration':DURATION,'LUFS':final['input_i'],'truePeak':final['input_tp'],'master':str(master)},ensure_ascii=False))

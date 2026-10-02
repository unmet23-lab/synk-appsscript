from pathlib import Path
import importlib.util

base=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('comparison',base/'compare-spaces.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
reference=base/'실험'/'qwen-fresh-sparkle'/'raw.wav'
for key,voice_only in [('a-natural-identity',True),('a-natural-context',False)]:
    module.SPECS[key]=('Qwen/Qwen3-TTS','/generate_voice_clone',{
        'ref_audio':module.handle_file(str(reference)),
        'ref_text':'' if voice_only else module.TEXT,
        'target_text':module.TEXT,
        'language':'Korean',
        'use_xvector_only':voice_only,
        'model_size':'1.7B'
    })
    module.REFERENCES[key]=reference
module.SPECS['a-natural-conversation']=('Qwen/Qwen3-TTS','/generate_voice_design',{
    'text':module.TEXT,'language':'Korean',
    'voice_description':'밝고 맑은 중고음의 한국인 성인 여성. 가까운 사람에게 웃으며 이야기하는 자연스러운 대화체. 음색은 산뜻하고 울림은 충분하다. 문장의 뜻에 따라 말끝을 편안하게 맺고, 자음과 모음을 부드럽게 연결한다.'
})
module.SPECS['a-natural-flow']=('Qwen/Qwen3-TTS','/generate_voice_design',{
    'text':module.TEXT,'language':'Korean',
    'voice_description':'A bright young adult Korean female voice, clear and lightly smiling, with a smooth full tone. She speaks in quick, easy everyday conversation, with natural Korean intonation and connected, flowing pronunciation.'
})
module.SPECS['a-confucius4']=('https://confucius4-tts.youdao.com/gradio/','/_preset_gradio_predict',{
    'text':module.TEXT,'language':'ko','voice_name':'请录制音频',
    'recorded_audio':module.handle_file(str(reference))
})
module.REFERENCES['a-confucius4']=reference
if __name__=='__main__':
    module.main()

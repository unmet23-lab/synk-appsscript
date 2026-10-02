from pathlib import Path
import importlib.util
import sys

base=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('comparison',base/'compare-spaces.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
text=module.TEXT
directions={
 'qwen-fresh-sparkle': 'A native Korean woman in her twenties with a bright, fresh and naturally smiling voice. Clear, lightly sparkling upper-mid pitch with a full, smooth vocal body. She sounds like an engaging real person sharing something she likes. Lively varied conversational intonation, easy forward momentum and light buoyant sentence endings. Intimate, clean high-fidelity studio microphone sound.',
 'qwen-fresh-sunshine': 'Native Korean female voice, young adult. A sunny, refreshing, clear voice with rich resonance and relaxed confidence. She speaks with a smile you can hear, energetic but comfortable, like a warm lively conversation. Crisp Korean consonants, rounded vowels, playful tiny rises and falls, and a light smile continuing through the last word. Dry close studio sound.',
}
for key,direction in directions.items():
 module.SPECS[key]=('Qwen/Qwen3-TTS','/generate_voice_design',{'text':text,'language':'Korean','voice_description':direction})
module.SPECS['qwen-sohee-sparkle']=('Qwen/Qwen3-TTS','/generate_custom_voice',{'text':text,'language':'Korean','speaker':'Sohee','instruct':'입가에 미소를 띤 채, 산뜻하고 생기 있게 대화하듯 말해 주세요. 듣는 사람에게 좋은 것을 발견해서 알려주는 느낌이에요. 편안한 중고음으로 자연스럽게 높낮이를 살리고, 마지막 어미까지 밝은 에너지를 유지해 주세요. 또렷하고 풍부한 목소리로, 문장 사이는 짧고 자연스럽게 이어 주세요.','model_size':'1.7B'})
reference=base/'실험'/'qwen-fresh-sparkle'/'raw.wav'
module.SPECS['moss8-fresh-sparkle']=('OpenMOSS-Team/MOSS-TTS-v1.5','/run_inference',{'text':text,'reference_audio':module.handle_file(str(reference)),'mode_with_reference':'Clone','duration_control_enabled':False,'duration_tokens':1,'language_tag':'Korean','temperature':1.7,'top_p':.8,'top_k':25,'repetition_penalty':1.0,'max_new_tokens':4096})
module.REFERENCES={'moss8-fresh-sparkle':reference}
for key,original,field in [('moss-nano-fresh','moss-nano','prompt_audio_path'),('chatterbox-fresh','chatterbox-v3','audio_prompt_path_input')]:
 space,api,params=module.SPECS[original]
 module.SPECS[key]=(space,api,{**params,field:module.handle_file(str(reference))})
 module.REFERENCES[key]=reference
if __name__=='__main__':
 module.main()

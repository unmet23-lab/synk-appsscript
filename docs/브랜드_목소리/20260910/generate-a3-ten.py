"""Ten new auditions in the user's preferred A3 direction; preserve all earlier files."""
from pathlib import Path
import importlib.util
import json
import sys

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('comparison', BASE / 'compare-spaces.py')
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)

PROMPTS = [
    ('01', 'A3와 같은 연출', 'A bright young adult Korean female voice, clear and lightly smiling, with a smooth full tone. She speaks in quick, easy everyday conversation, with natural Korean intonation and connected, flowing pronunciation.'),
    ('02', '편안한 미소', 'A bright young adult Korean female voice with a clear, rounded tone and a relaxed smile. She talks to a friend in easy, lively Korean, linking words smoothly and letting each sentence follow its meaning.'),
    ('03', '풍부하고 맑은 울림', 'A bright young adult Korean female voice with a clear, full-bodied, smooth tone. Her delivery is fresh and lightly smiling, like a quick everyday conversation, with naturally connected Korean pronunciation.'),
    ('04', '가볍고 또렷한 대화', 'A clear young adult Korean female voice with a light smile and a smooth, rounded tone. She speaks in brisk, relaxed conversation with fluid Korean articulation and easy, expressive sentence endings.'),
    ('05', '밝고 담백한 표현', 'A bright young adult Korean female voice with a fresh, clear, smooth tone. She speaks casually and confidently to one listener, with a small smile, an easy conversational rhythm and natural Korean phrasing.'),
    ('06', '따뜻한 상큼함', 'A bright young adult Korean female voice, clear and gently warm, with a smooth full tone. She speaks in lively everyday Korean, smiling lightly, connecting syllables naturally and finishing each thought with relaxed confidence.'),
    ('07', '유연한 말끝', 'A bright young adult Korean female voice with a clear, rounded tone and a hint of a smile. Her Korean sounds like spontaneous conversation: fluid, lightly expressive and brisk, with sentence endings shaped by the meaning.'),
    ('08', '친근한 진행', 'A fresh, clear young adult Korean female voice with a smooth, full tone. She invites a friend to try something together, speaking in easy, lively Korean with a light smile and naturally flowing pronunciation.'),
]

CANDIDATES = []
for number, label, prompt in PROMPTS:
    key = 'a3-ten-' + number
    comparison.SPECS[key] = ('Qwen/Qwen3-TTS', '/generate_voice_design', {
        'text': comparison.TEXT, 'language': 'Korean', 'voice_description': prompt
    })
    CANDIDATES.append({'number': number, 'key': key, 'direction': label, 'method': 'voice_design', 'prompt': prompt})

reference = BASE / '실험' / 'a-natural-flow' / 'raw.wav'
# A first take included an unrequested laugh; retain it and generate a separate replacement.
comparison.SPECS['a3-ten-01-r2'] = comparison.SPECS['a3-ten-01']
for number, label, voice_only in [('09', 'A3 음색 참조', True), ('10', 'A3 음성과 대본 참조', False)]:
    key = 'a3-ten-' + number
    comparison.SPECS[key] = ('Qwen/Qwen3-TTS', '/generate_voice_clone', {
        'ref_audio': comparison.handle_file(str(reference)),
        'ref_text': '' if voice_only else comparison.TEXT,
        'target_text': comparison.TEXT, 'language': 'Korean',
        'use_xvector_only': voice_only, 'model_size': '1.7B'
    })
    comparison.REFERENCES[key] = reference
    CANDIDATES.append({'number': number, 'key': key, 'direction': label, 'method': 'speaker_features' if voice_only else 'audio_and_transcript', 'reference': str(reference)})

# The first speaker-only take had an uncertain word in automatic transcription.
comparison.SPECS['a3-ten-09-r2'] = comparison.SPECS['a3-ten-09']
comparison.REFERENCES['a3-ten-09-r2'] = reference

if __name__ == '__main__':
    (BASE / 'a3-ten-recipes.json').write_text(json.dumps({
        'text': comparison.TEXT,
        'reference': 'a-natural-flow',
        'referenceRawSha256': '86371ee78632a9ac4a6612509651d46211ce6386f2008c0d6199a27ea19d149b',
        'userPreference': 'A3 is preferred; prepare about ten with more attention to sound quality and naturalness.',
        'labelsDescribeIntentNotVerifiedListening': True,
        'candidates': CANDIDATES
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    if len(sys.argv) == 1:
        sys.argv.extend(item['key'] for item in CANDIDATES)
    comparison.main()

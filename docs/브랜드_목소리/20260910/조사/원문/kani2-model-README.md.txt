---
license: other
license_name: lfm1.0
license_link: https://www.liquid.ai/lfm-license
datasets:
- laion/Emolia
language:
- en
pipeline_tag: text-to-speech
library_name: transformers
base_model:
- nineninesix/kani-tts-2-pt
---

<p>
  <img src="public/logo.png" alt="Logo" width="100%">
</p>


# KaniTTS2-en

[![](https://dcbadge.limes.pink/api/server/https://discord.gg/NzP3rjB4SB?style=flat)](https://discord.gg/NzP3rjB4SB)


Text-to-Speech Model with Frame-level Position Encodings, optimized for Realtime Conversations

## Overview

KaniTTS2 uses a two-stage pipeline combining a LLM with an FSQ audio codec.

**Key Specifications:**
- **Model Size:** 400M parameters
- **Sample Rate:** 22kHz
- **Languages:** English

## Audio Examples

Speaker| Audio |
|---|---|
| 🇺🇸 Frank from Boston| <audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/dY1rnw3WD9nRi22VhBHBt.wav"></audio> |
| 🇺🇸 Jermaine from Oakland| <audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/1KOzr73IbN-ezKXyMXa3X.wav"></audio> |
| 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Rory from Glasgow | <audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/_0bvsIRKOXVoyYHJKyKmn.wav"></audio> |
| 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Baddy from Liverpool| <audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/RcUTqFrbT7QQ4d5jN17t6.wav"></audio>|
| 🇺🇸 Chelsea from New York|<audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/N1uNknoPBtkJXvVQZzOAd.wav"></audio>|
| 🇺🇸 Andrew from San Francisco|<audio controls src="https://cdn-uploads.huggingface.co/production/uploads/64fab67bd268b2f1ad8a826b/veJyKqzr11KLOXnbSadga.wav"></audio>|


## Installation

```bash
pip install kani-tts-2
pip install -U "transformers==4.56.0"
```

## Quickstart

```python
from kani_tts import KaniTTS

# Initialize model
model = KaniTTS('repo/model')

# Generate speech
audio, text = model("Hello, world!")

# Save to file
model.save_audio(audio, "output.wav")
```

## Voice Cloning

```python
from kani_tts import KaniTTS, SpeakerEmbedder

# Initialize models
model = KaniTTS('repo/model')
embedder = SpeakerEmbedder()

# Extract speaker embedding from reference audio
speaker_embedding = embedder.embed_audio_file("reference_voice.wav")

# Generate speech with cloned voice
audio, text = model(
    "This is a cloned voice speaking!",
    speaker_emb=speaker_embedding
)
model.save_audio(audio, "cloned_voice.wav")
```

For more examples including language tags, generation parameters, and the full API reference, see the [kani-tts-2 package](https://github.com/nineninesix-ai/kani-tts-2).

## Performance

**Nvidia RTX 5080 Benchmarks:**
- **RTF:** ~0.2 (using custom executor)
- **Memory:** 3GB GPU VRAM

**Pretraining:**
- **Dataset:** ~10k hours
- **Hardware:** 8x H100 GPUs, 6 hours training.


## Use Cases

- **Conversational AI:** Real-time speech for chatbots and virtual assistants
- **Research:** Fine-tuning for specific voices, accents, or emotions

## Limitations

- Performance degrades with inputs exceeding ~40sec
- May inherit biases from training data in prosody or pronunciation
- Optimized primarily for English; other languages may require continual pretraining

## Optimization Tips

- **Multilingual Performance:** Continually pretrain on target language datasets and fine-tune NanoCodec
- **Batch Processing:** Use batches of 8-16 for high-throughput scenarios
- **Hardware:** Optimized for NVIDIA Blackwell architecture GPUs

## Resources

**Models:** [Pretrained Model](https://huggingface.co/nineninesix/kani-tts-2-pt), [English Model](https://huggingface.co/nineninesix/kani-tts-2-en)

**Github:** [kani-tts-2 package](https://github.com/nineninesix-ai/kani-tts-2).

**Pretraining Framework**
Train your own TTS model on your language or accent from scratch using this open-source pretraining framework: [KaniTTS2-Pretrain](https://github.com/nineninesix-ai/kani-tts-2-pretrain).

**Example Dataset**: https://huggingface.co/datasets/nineninesix/kanitts2-es-nano-codec-speaker-emb-dataset

**Openai compatible streaming API example:** https://github.com/nineninesix-ai/kani-tts-2-openai-server

**Links:** [Website](https://www.nineninesix.ai/), [Discord](https://discord.gg/NzP3rjB4SB)


## vLLM Integration

Coming soon.

## Tech Report

Coming soon.

## Acknowledgments

Built on top of [LiquidAI LFM2 350M](https://huggingface.co/LiquidAI/LFM2-350M) as the backbone and [Nvidia NanoCodec](https://huggingface.co/nvidia/nemo-nano-codec-22khz-0.6kbps-12.5fps) for audio processing.

Training data provided by the [LAION](https://huggingface.co/laion) team through the Emilia and EmoNet-Voice datasets.

Speaker embeddings extracted using [Orange/Speaker-wavLM-tbr](https://huggingface.co/Orange/Speaker-wavLM-tbr).
## Citation

```bibtex

@article{liquidai2025lfm2,
 title={LFM2 Technical Report},
 author={Liquid AI},
 journal={arXiv preprint arXiv:2511.23404},
 year={2025}
}

@inproceedings{emilialarge,
  author={He, Haorui and Shang, Zengqiang and Wang, Chaoren and Li, Xuyuan and Gu, Yicheng and Hua, Hua and Liu, Liwei and Yang, Chen and Li, Jiaqi and Shi, Peiyang and Wang, Yuancheng and Chen, Kai and Zhang, Pengyuan and Wu, Zhizheng},
  title={Emilia: A Large-Scale, Extensive, Multilingual, and Diverse Dataset for Speech Generation},
  booktitle={arXiv:2501.15907},
  year={2025}
}

@article{emonet_voice_2025,
  author={Schuhmann, Christoph and Kaczmarczyk, Robert and Rabby, Gollam and Friedrich, Felix and Kraus, Maurice and Nadi, Kourosh and Nguyen, Huu and Kersting, Kristian and Auer, Sören},
  title={EmoNet-Voice: A Fine-Grained, Expert-Verified Benchmark for Speech Emotion Detection},
  journal={arXiv preprint arXiv:2506.09827},
  year={2025}
}

@inproceedings{gengembre24_interspeech,
  title     = {Disentangling prosody and timbre embeddings via voice conversion},
  author    = {Nicolas Gengembre and Olivier {Le Blouch} and Cédric Gendrot},
  year      = {2024},
  booktitle = {Interspeech 2024},
  pages     = {2765--2769},
  doi       = {10.21437/Interspeech.2024-207},
  issn      = {2958-1796},
}
```

## Responsible Use

**Prohibited activities include:**
- Illegal content or harmful, threatening, defamatory, or obscene material
- Hate speech, harassment, or incitement of violence
- Generating false or misleading information
- Impersonating individuals without consent
- Malicious activities such as spamming, phishing, or fraud

By using this model, you agree to comply with these restrictions and all applicable laws.

If you use this code in your research, please cite:

```bibtex
@software{kani_tts_2,
  author = {Nineninesix},
  title = {KaniTTS2: Text-to-Speech Model with Frame-level Position Encoding},
  year = {2026},
  publisher = {Hugging Face},
  howpublished = {\url{https://github.com/nineninesix-ai/kani-tts-2}},
  note = {Open-source TTS model}
}
```

## Contact
Have a question, feedback, or need support? Please fill out our [contact form](https://airtable.com/appX2G2TpoRk4M5Bf/pagO2xbIOjiwulPcP/form) and we'll get back to you as soon as possible.
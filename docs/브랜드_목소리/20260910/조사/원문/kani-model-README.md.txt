---
license: other
license_name: lfm1.0
license_link: https://www.liquid.ai/lfm-license
language:
- en
- de
- ar
- zh
- es
- ko
pipeline_tag: text-to-speech
library_name: transformers
base_model:
- nineninesix/kani-tts-450m-0.2-pt
---


<p>
  <img src="https://www.nineninesix.ai/kitty.png" alt="Logo" width="200" height="200">
</p>


# KaniTTS

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)


A high-speed, high-fidelity Text-to-Speech model optimized for real-time conversational AI applications.

## Overview

KaniTTS uses a two-stage pipeline combining a large language model with an efficient audio codec for exceptional speed and audio quality. The architecture generates compressed token representations through a backbone LLM, then rapidly synthesizes waveforms via neural audio codec, achieving extremely low latency.

**Key Specifications:**
- **Model Size:** 370M parameters
- **Sample Rate:** 22kHz
- **Languages:** English, German, Chinese, Korean, Arabic, Spanish
- **License:** Apache 2.0

## Performance

**Nvidia RTX 5080 Benchmarks:**
- **Latency:** ~1 second to generate 15 seconds of audio
- **Memory:** 2GB GPU VRAM
- **Quality Metrics:** MOS 4.3/5 (naturalness), WER <5% (accuracy)

**Pretraining:**
- **Dataset:** ~80k hours from LibriTTS, Common Voice, and Emilia
- **Hardware:** 8x H100 GPUs, 45 hours training time on [Lambda AI](https://lambda.ai/)

**Voices Datasets**
- [https://huggingface.co/datasets/nytopop/expresso-conversational](https://huggingface.co/datasets/nytopop/expresso-conversational)
- [https://huggingface.co/datasets/shb777/gemini-flash-2.0-speech](https://huggingface.co/datasets/shb777/gemini-flash-2.0-speech)
- [https://huggingface.co/datasets/jazza234234/david-dataset](https://huggingface.co/datasets/jazza234234/david-dataset)
- [https://huggingface.co/datasets/reach-vb/jenny_tts_dataset](https://huggingface.co/datasets/reach-vb/jenny_tts_dataset)
- [https://huggingface.co/datasets/MBZUAI/ArVoice](https://huggingface.co/datasets/MBZUAI/ArVoice)
- [https://huggingface.co/datasets/Thorsten-Voice/TV-44kHz-Full](https://huggingface.co/datasets/Thorsten-Voice/TV-44kHz-Full)
- [https://huggingface.co/datasets/SinclairSchneider/german_voice_cb](https://huggingface.co/datasets/SinclairSchneider/german_voice_cb)
- [https://huggingface.co/datasets/Bingsu/KSS_Dataset](https://huggingface.co/datasets/Bingsu/KSS_Dataset)
- [https://huggingface.co/datasets/ciempiess/ciempiess_fem](https://huggingface.co/datasets/ciempiess/ciempiess_fem)
- [https://huggingface.co/datasets/TingChen-ppmc/Shanghai_Dialect_TTS_openai](https://huggingface.co/datasets/TingChen-ppmc/Shanghai_Dialect_TTS_openai)
- [https://huggingface.co/datasets/boniromou/zh-yue-tts-dataset](https://huggingface.co/datasets/boniromou/zh-yue-tts-dataset)
- [https://huggingface.co/datasets/zeeshanparvez/andrew-v3](https://huggingface.co/datasets/zeeshanparvez/andrew-v3)

**Voices:**
- `david` — David, English (British)
- `puck` — Puck, English (Gemini)
- `kore` — Kore, English (Gemini)
- `andrew` — Andrew, English
- `jenny` — Jenny, English (Irish)
- `simon` — Simon, English
- `katie` — Katie, English
- `seulgi` — Seulgi, Korean
- `bert` — Bert, German
- `thorsten` — Thorsten, German (Hessisch)
- `maria` — Maria, Spanish
- `mei` — Mei, Chinese (Cantonese)
- `ming` — Ming, Chinese (Shanghai OpenAI)
- `karim` — Karim, Arabic
- `nur` — Nur, Arabic


## Quickstart: Install from PyPI & Run Inference

It’s a lightweight so you can install, load a model, and speak in minutes.
Designed for quick starts and simple workflows—no heavy setup, just pip install and run.
[More detailes...](https://pypi.org/project/kani-tts/)

### Install

```bash
pip install kani-tts
pip install -U "transformers==4.57.1" # for LFM2 !!!
```
## Quick Start

```python
from kani_tts import KaniTTS

model = KaniTTS('nineninesix/kani-tts-370m')

# Generate audio from text
audio, text = model("Hello, world!")

# Save to file (requires soundfile)
model.save_audio(audio, "output.wav")
```

### Working with Multi-Speaker Models

This model support multiple speakers. You can check if your model supports speakers and select a specific voice:

```python
from kani_tts import KaniTTS

model = KaniTTS('nineninesix/kani-tts-370m')

# Check if model supports multiple speakers
print(f"Model type: {model.status}")  # 'singlspeaker' or 'multispeaker'

# Display available speakers (pretty formatted)
model.show_speakers()

# Or access the speaker list directly
print(model.speaker_list)  # ['andrew', 'katie', ...]

# Generate audio with a specific speaker
audio, text = model("Hello, world!", speaker_id="andrew")
```

### Custom Configuration

```python
from kani_tts import KaniTTS

model = KaniTTS(
    'nineninesix/kani-tts-370m',
    temperature=0.7,           # Control randomness (default: 1.0)
    top_p=0.9,                 # Nucleus sampling (default: 0.95)
    max_new_tokens=2000,       # Max audio length (default: 1200)
    repetition_penalty=1.2,    # Prevent repetition (default: 1.1)
    suppress_logs=True,        # Suppress library logs (default: True)
    show_info=True,            # Show model info on init (default: True)
)

audio, text = model("Your text here")
```

### Playing Audio in Jupyter Notebooks

You can listen to generated audio directly in Jupyter notebooks or IPython:

```python
from kani_tts import KaniTTS
from IPython.display import Audio as aplay

model = KaniTTS('nineninesix/kani-tts-370m')
audio, text = model("Hello, world!")

# Play audio in notebook
aplay(audio, rate=model.sample_rate)
```

---



## Audio Examples

| Text | Audio |
|---|---|
| I do believe Marsellus Wallace, MY husband, YOUR boss, told you to take me out and do WHATEVER I WANTED. | <audio controls><source src="https://github.com/nineninesix-ai/kani-tts/raw/refs/heads/main/public/mia.wav" type="audio/mpeg"></audio> |
| What do we say to the god of death? Not today! | <audio controls><source src="https://github.com/nineninesix-ai/kani-tts/raw/refs/heads/main/public/arya.wav" type="audio/wav"></audio> |
| What do you call a lawyer with an IQ of 60? Your honor | <audio controls><source src="https://github.com/nineninesix-ai/kani-tts/raw/refs/heads/main/public/saul.wav" type="audio/wav"></audio> |
| You mean, let me understand this cause, you know maybe it's me, it's a little fucked up maybe, but I'm funny how, I mean funny like I'm a clown, I amuse you? | <audio controls><source src="https://github.com/nineninesix-ai/kani-tts/raw/refs/heads/main/public/tommy.wav" type="audio/wav"></audio> |

## Use Cases

- **Conversational AI:** Real-time speech for chatbots and virtual assistants
- **Edge/Server Deployment:** Resource-efficient inference on affordable hardware
- **Accessibility:** Screen readers and language learning applications
- **Research:** Fine-tuning for specific voices, accents, or emotions

## Limitations

- Performance degrades with inputs exceeding 2000 tokens
- Limited expressivity without fine-tuning for specific emotions
- May inherit biases from training data in prosody or pronunciation
- Optimized primarily for English; other languages may require additional training

## Optimization Tips

- **Multilingual Performance:** Continually pretrain on target language datasets and fine-tune NanoCodec
- **Batch Processing:** Use batches of 8-16 for high-throughput scenarios
- **Hardware:** Optimized for NVIDIA Blackwell architecture GPUs

## Resources

**Models:**
- [Pretrained Model](https://huggingface.co/nineninesix/kani-tts-450m-0.2-pt)
- [Fine-tuned Model](https://huggingface.co/nineninesix/kani-tts-370m)
- [HuggingFace Space](https://huggingface.co/spaces/nineninesix/KaniTTS)

**Examples:**
- [Inference Example](https://colab.research.google.com/drive/1mvzGs7jtAMSUz8wvNlL5uFmgFEyAPjDh?usp=sharing)
- [Fine-tuning-code](https://github.com/nineninesix-ai/KaniTTS-Finetune-pipeline)
- [Example Dataset](https://huggingface.co/datasets/nineninesix/expresso-conversational-en-nano-codec-dataset)
- [GitHub Repository](https://github.com/nineninesix-ai/kani-tts)

**Links:**
- [Website](https://www.nineninesix.ai/)
- [Contact Form](https://airtable.com/appX2G2TpoRk4M5Bf/pagO2xbIOjiwulPcP/form)

## Acknowledgments

Built on top of [LiquidAI LFM2 350M](https://huggingface.co/LiquidAI/LFM2-350M) as the backbone and [Nvidia NanoCodec](https://huggingface.co/nvidia/nemo-nano-codec-22khz-0.6kbps-12.5fps) for audio processing.

## Responsible Use

**Prohibited activities include:**
- Illegal content or harmful, threatening, defamatory, or obscene material
- Hate speech, harassment, or incitement of violence
- Generating false or misleading information
- Impersonating individuals without consent
- Malicious activities such as spamming, phishing, or fraud

By using this model, you agree to comply with these restrictions and all applicable laws.

## Contact
Have a question, feedback, or need support? Please fill out our [contact form](https://airtable.com/appX2G2TpoRk4M5Bf/pagO2xbIOjiwulPcP/form) and we'll get back to you as soon as possible.


## Citation
```
@misc {sb_2025,
	author       = { SB },
	title        = { gemini-flash-2.0-speech },
	year         = 2025,
	url          = { https://huggingface.co/datasets/shb777/gemini-flash-2.0-speech },
	doi          = { 10.57967/hf/4237 },
	publisher    = { Hugging Face }
}
```

```
@misc{toyin2025arvoicemultispeakerdatasetarabic,
      title={ArVoice: A Multi-Speaker Dataset for Arabic Speech Synthesis}, 
      author={Hawau Olamide Toyin and Rufael Marew and Humaid Alblooshi and Samar M. Magdy and Hanan Aldarmaki},
      year={2025},
      eprint={2505.20506},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2505.20506}, 
}
```

```
@misc {thorsten_müller_2024,
    author       = { {Thorsten Müller} },
    title        = { TV-44kHz-Full (Revision ff427ec) },
    year         = 2024,
    url          = { https://huggingface.co/datasets/Thorsten-Voice/TV-44kHz-Full },
    doi          = { 10.57967/hf/3290 },
    publisher    = { Hugging Face }
}
```

```
@misc{carlosmenaciempiessfem2019,
      title={CIEMPIESS FEM CORPUS: Audio and Transcripts of Female Speakers in Spanish.}, 
      ldc_catalog_no={LDC2019S07},
      DOI={https://doi.org/10.35111/xdx5-n815},
      author={Hernandez Mena, Carlos Daniel},
      journal={Linguistic Data Consortium, Philadelphia},
      year={2019},
      url={https://catalog.ldc.upenn.edu/LDC2019S07},
}

```
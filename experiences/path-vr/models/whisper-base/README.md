# Whisper Base local inference assets

Pinned ONNX export: https://huggingface.co/onnx-community/whisper-base/tree/1846881b6b3a3024392c1eea3ad983695bc23925 . Base model: openai/whisper-base (multilingual, including Korean). revision.txt records that exact export revision.

Selected precision: encoder_model_quantized.onnx and decoder_model_merged_quantized.onnx are both q8. This selection balances the recognition results from a small local synthetic Korean interview comparison and CPU inference cost. It does not establish general recognition accuracy or Quest headset performance. The fp32 encoder, alternate weights and Whisper Tiny are excluded from the public package.

All seven model/configuration files were verified against that Hugging Face revision: SHA-256 for LFS blobs, Git blob SHA-1 for ordinary JSON files. PROVENANCE.json includes a SHA-256 for every packaged asset. The original Whisper MIT license and pinned ONNX model card are included. No human audio, synthetic benchmark WAV, browser harness or test output belongs in this folder.

Model/configuration download: 79664191 bytes. Runtime integration, public deployment, actual microphone accuracy and Quest memory/frame-time validation are separate checks.

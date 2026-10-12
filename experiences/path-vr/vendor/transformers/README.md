# Transformers.js 3.8.1 browser runtime

The three runtime files are copied byte-for-byte from the same @huggingface/transformers 3.8.1 npm dist directory. Its ONNX Runtime dependency is 1.22.0-dev.20250409-89f8206ba4 (commit 89f8206ba4f1c22c39e0297fb55272e8ce8cd7d0). Do not mix the JavaScript and WASM with a different build.

Runtime and model code are intended to run in a dedicated local Web Worker. On a host without cross-origin isolation, configure WASM numThreads=1; the threaded filename does not imply that multiple threads are enabled. No CDN, model inference endpoint, or audio upload is needed when all paths point to the packaged same-origin assets. Actual initialization, memory use and Quest performance require application verification.

Official license texts are included as LICENSE-TRANSFORMERS.txt (Apache-2.0) and LICENSE-ONNXRUNTIME.txt (MIT). Existing embedded third-party notices in the upstream bundles are preserved. PROVENANCE.json records exact file SHA-256 hashes and upstream sources. No source maps, Node runtime, benchmark audio or fixtures are packaged here.

#!/bin/bash
set -euo pipefail
# Official, pinned SDK sources. Needed for Chromium 151+ Mac SwiftShader loading.
# This bundles the loader; it does not enable a software GPU or weaken a sandbox.
test "$(uname -s)" = Darwin
test ! -e native-libs/x64
mkdir -p native-libs/x64
headers=6802bb4733b63ed5efd3adb308a6c885ef180ea1
loader=fa218055ff4948b159f31d43f800c808a13d51df
git clone --quiet https://github.com/KhronosGroup/Vulkan-Headers.git native-libs/headers
git -C native-libs/headers checkout --quiet "$headers"
git clone --quiet https://github.com/KhronosGroup/Vulkan-Loader.git native-libs/loader
git -C native-libs/loader checkout --quiet "$loader"
cmake -S native-libs/headers -B native-libs/headers-build -DCMAKE_INSTALL_PREFIX="$PWD/native-libs/install"
cmake --install native-libs/headers-build
cmake -S native-libs/loader -B native-libs/loader-build -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=x86_64 -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 -DVULKAN_HEADERS_INSTALL_DIR="$PWD/native-libs/install" -DBUILD_TESTS=OFF
cmake --build native-libs/loader-build --parallel 3
cp -L native-libs/loader-build/loader/libvulkan.dylib native-libs/x64/libvulkan.dylib
install_name_tool -id @rpath/libvulkan.dylib native-libs/x64/libvulkan.dylib
test "$(lipo -archs native-libs/x64/libvulkan.dylib)" = x86_64
cp native-libs/loader/LICENSE.txt native-libs/x64/Vulkan-Loader-LICENSE.txt
cp -R native-libs/loader/LICENSES native-libs/x64/LICENSES
node -e 'const fs=require("fs"),crypto=require("crypto");const p="native-libs/x64/";fs.writeFileSync(p+"provenance.json",JSON.stringify({headersCommit:process.argv[1],loaderCommit:process.argv[2],arch:"x64",minimumSystemVersion:"13.0",sha256:crypto.createHash("sha256").update(fs.readFileSync(p+"libvulkan.dylib")).digest("hex")},null,2)+"\n")' "$headers" "$loader"

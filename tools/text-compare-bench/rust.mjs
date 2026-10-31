import { readFile } from 'node:fs/promises';
import { MAX_CHARACTERS, LIMIT_MESSAGE, prepare, result } from './compare.mjs';

export const wasmUrl = new URL('./rust/target/wasm32-unknown-unknown/release/synk_text_compare_experiment.wasm', import.meta.url);

export async function createRustComparison() {
  const { instance } = await WebAssembly.instantiate(await readFile(wasmUrl), {});
  const { memory, input_ptr: inputPointer, compare } = instance.exports;
  const pointer = inputPointer();
  function distance(a, b) {
    if (!(a instanceof Uint32Array) || !(b instanceof Uint32Array)) throw new TypeError('Uint32Array required');
    if (a.length > MAX_CHARACTERS || b.length > MAX_CHARACTERS) throw new Error(LIMIT_MESSAGE);
    // Recreate views: Rust's row allocation may grow/detach WASM memory.
    new Uint32Array(memory.buffer, pointer, a.length).set(a);
    new Uint32Array(memory.buffer, pointer + MAX_CHARACTERS * 4, b.length).set(b);
    const value = compare(a.length, b.length);
    if (value === 0xffffffff) throw new Error(LIMIT_MESSAGE);
    return value;
  }
  return {
    distance,
    compareText(expected, observed) {
      const { a, b } = prepare(expected, observed);
      return result(a, b, distance(a, b));
    },
  };
}

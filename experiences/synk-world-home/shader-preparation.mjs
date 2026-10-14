function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException('Shader preparation cancelled', 'AbortError');
}

/** Yield to input/paint without leaving a timer behind when the owner closes. */
export function yieldForShaderPreparation({ signal, delayMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError(signal)); return; }
    let timer;
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(abortError(signal)); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.max(0, delayMs));
  });
}

/** Split preparation work into short tasks without retaining GL state at a yield. */
export async function runShaderPreparationTasks(tasks, { signal, budgetMs = 8, now = () => performance.now() } = {}) {
  let started = now();
  for (let i = 0; i < tasks.length; i++) {
    if (signal?.aborted) throw abortError(signal);
    tasks[i]();
    if (i + 1 < tasks.length && now() - started >= budgetMs) {
      await yieldForShaderPreparation({ signal });
      started = now();
    }
  }
  if (signal?.aborted) throw abortError(signal);
}

/**
 * Wait for programs already queued by renderer.compile(). Three r180's
 * compileAsync() polls mutable material properties and cannot be cancelled.
 * Snapshot the program handles instead, and stop all polling before disposal.
 */
export async function waitForShaderPrograms(renderer, { signal, timeoutMs = 20000, pollMs = 16 } = {}) {
  if (signal?.aborted) throw abortError(signal);
  const gl = renderer.getContext();
  if (gl.isContextLost()) throw new Error('SHADER_CONTEXT_LOST');
  const extension = renderer.extensions.get('KHR_parallel_shader_compile');
  const programs = [...new Set(renderer.info.programs || [])].filter(program => program.program).map(wrapper => ({ wrapper, handle: wrapper.program }));
  const count = programs.length;
  if (!extension) {
    await yieldForShaderPreparation({ signal });
    if (gl.isContextLost()) throw new Error('SHADER_CONTEXT_LOST');
    return { parallel: false, programs: count };
  }
  return new Promise((resolve, reject) => {
    let timer, deadline, settled = false;
    const cleanup = () => {
      clearTimeout(timer); clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      renderer.domElement?.removeEventListener('webglcontextlost', contextLost);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve({ parallel: true, programs: count });
    };
    const abort = () => finish(abortError(signal));
    const contextLost = () => finish(new Error('SHADER_CONTEXT_LOST'));
    const check = () => {
      if (settled) return;
      if (signal?.aborted) { abort(); return; }
      if (gl.isContextLost()) { contextLost(); return; }
      try {
        for (let i = programs.length - 1; i >= 0; i--) {
          const { wrapper, handle } = programs[i];
          if (wrapper.program !== handle) { finish(new Error('SHADER_PROGRAM_DISPOSED')); return; }
          if (gl.getProgramParameter(handle, extension.COMPLETION_STATUS_KHR)) programs.splice(i, 1);
        }
        if (!programs.length) finish();
        else timer = setTimeout(check, Math.max(1, pollMs));
      } catch (error) { finish(error); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    renderer.domElement?.addEventListener('webglcontextlost', contextLost, { once: true });
    deadline = setTimeout(() => finish(new Error('SHADER_PREPARATION_TIMEOUT')), Math.max(1, timeoutMs));
    check();
  });
}

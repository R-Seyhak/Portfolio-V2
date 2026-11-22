import { READY } from './avatar.config';

/**
 * Calls back once the GPU has really finished the commands issued so far.
 * A draw call returns long before shaders and textures are done, so "the frame
 * was drawn" can be true seconds before anything reaches the screen.
 * Returns a function that cancels the wait.
 */
export function whenGpuIdle(gl: WebGL2RenderingContext, done: () => void) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) {
    done();
    return () => undefined;
  }
  gl.flush();

  const startedAt = performance.now();
  let frame = 0;
  const finish = () => {
    gl.deleteSync(sync);
    done();
  };
  const poll = () => {
    const status = gl.clientWaitSync(sync, 0, 0);
    const settled =
      status === gl.ALREADY_SIGNALED ||
      status === gl.CONDITION_SATISFIED ||
      status === gl.WAIT_FAILED;
    if (settled || performance.now() - startedAt > READY.gpuTimeoutMs) finish();
    else frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);

  return () => {
    cancelAnimationFrame(frame);
    gl.deleteSync(sync);
  };
}

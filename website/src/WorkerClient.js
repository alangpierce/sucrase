import Worker from "./Worker.worker.js";

const CANCELLED_MESSAGE = "SUCRASE JOB CANCELLED";
const TIMEOUT_MESSAGE = "SUCRASE JOB TIMED OUT";

let worker;

// Used to coordinate communication with the worker. This is non-null any time
// there is an active call, and it is nulled out on completion. Only one request
// may be active at any time.
let nextResolve = null;
let nextReject = null;

let timeoutTimer = null;

// The pending config to be processed next. Set to null when processed.
let nextConfig = null;
// Function to be called when the config is set.
let notifyConfig = null;

// Callback function to update the main app state. Just forwards the object to
// setState in the App component.
let updateStateFn = null;
// Callback function to persist the compressed code to the URL. Compression is
// slow enough that it's useful to do in a web worker.
let handleCompressedCodeFn = null;

function initWorker() {
  worker = new Worker();
  worker.addEventListener("message", ({data}) => {
    nextResolve(data);
    finishEndMessage();
  });
}

initWorker();

function finishEndMessage() {
  nextResolve = null;
  nextReject = null;
  clearTimeout(timeoutTimer);
}

function sendMessage(message) {
  if (nextConfig) {
    throw new Error(CANCELLED_MESSAGE);
  }
  worker.postMessage(message);
  if (nextResolve || nextReject) {
    throw new Error("Cannot send message when a message is already in progress!");
  }
  timeoutTimer = setTimeout(() => {
    worker.terminate();
    initWorker();
    nextReject(new Error(TIMEOUT_MESSAGE));
    finishEndMessage();
  }, 10000);
  return new Promise((resolve, reject) => {
    nextResolve = resolve;
    nextReject = reject;
  });
}

async function setConfig(config) {
  await sendMessage({type: "SET_CONFIG", config});
}

async function runSucrase() {
  return await sendMessage({type: "RUN_SUCRASE"});
}

async function runBabel() {
  return await sendMessage({type: "RUN_BABEL"});
}

async function runTypeScript() {
  return await sendMessage({type: "RUN_TYPESCRIPT"});
}

async function compressCode() {
  return await sendMessage({type: "COMPRESS_CODE"});
}

async function getTokens() {
  return await sendMessage({type: "GET_TOKENS"});
}

async function profileSucrase() {
  return await sendMessage({type: "PROFILE_SUCRASE"});
}

async function profileBabel() {
  return await sendMessage({type: "PROFILE_BABEL"});
}

async function profileTypeScript() {
  return await sendMessage({type: "PROFILE_TYPESCRIPT"});
}

/**
 * Consume a pending config, blocking until one shows up.
 */
async function waitForConfig() {
  if (nextConfig) {
    const config = nextConfig;
    nextConfig = null;
    return config;
  } else {
    const waitPromise = new Promise((resolve) => {
      notifyConfig = resolve;
    });
    await waitPromise;
    notifyConfig = null;
    const config = nextConfig;
    if (config == null) {
      throw new Error("Unexpected missing config after notify.");
    }
    nextConfig = null;
    return config;
  }
}

const NUM_TRIALS = 10;
const NUM_WARMUP_RUNS = 2;

async function profile(asyncFn) {
  for (let i = 0; i < NUM_WARMUP_RUNS; i++) {
    const time = await asyncFn();
    if (time == null) {
      return null;
    }
  }
  let total = 0;
  for (let i = 0; i < NUM_TRIALS; i++) {
    const time = await asyncFn();
    if (time == null) {
      return null;
    }
    total += time;
  }
  return total / NUM_TRIALS;
}

async function workerLoop() {
  while (true) {
    const config = await waitForConfig();
    try {
      await setConfig(config);
      const sucraseCode = await runSucrase();
      const babelCode = config.compareWithBabel ? await runBabel() : "";
      const typeScriptCode = config.compareWithTypeScript ? await runTypeScript() : "";
      const tokensStr = config.showTokens ? await getTokens() : "";
      updateStateFn({sucraseCode, babelCode, typeScriptCode, tokensStr});

      const compressedCode = await compressCode();
      handleCompressedCodeFn(compressedCode);

      const sucraseTimeMs = await profile(profileSucrase);
      const babelTimeMs = config.compareWithBabel ? await profile(profileBabel) : null;
      const typeScriptTimeMs = config.compareWithTypeScript
        ? await profile(profileTypeScript)
        : null;
      updateStateFn({sucraseTimeMs, babelTimeMs, typeScriptTimeMs});
    } catch (e) {
      if (e.message !== CANCELLED_MESSAGE && e.message !== TIMEOUT_MESSAGE) {
        throw e;
      }
      if (e.message === TIMEOUT_MESSAGE) {
        updateStateFn({
          sucraseCode: "Operation timed out after 10 seconds.",
          babelCode: "Operation timed out after 10 seconds.",
          typeScriptCode: "Operation timed out after 10 seconds.",
        });
      }
      // On cancellation, fall through and try the new config.
    }
  }
}

export function updateConfig(config) {
  nextConfig = config;
  if (notifyConfig) {
    notifyConfig();
  }
}

export function subscribe({updateState, handleCompressedCode}) {
  updateStateFn = updateState;
  handleCompressedCodeFn = handleCompressedCode;
}

workerLoop();

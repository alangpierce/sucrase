import {Message, WorkerConfig, WorkerMessage} from "./WorkerProtocol";

const CANCELLED_MESSAGE = "SUCRASE JOB CANCELLED";
const TIMEOUT_MESSAGE = "SUCRASE JOB TIMED OUT";

let worker: Worker;

// Used to coordinate communication with the worker. This is non-null any time
// there is an active call, and it is nulled out on completion. Only one request
// may be active at any time.
let nextResolve: ((value: unknown) => void) | null = null;
let nextReject: ((e: Error) => void) | null = null;

let timeoutTimer: number | null = null;

// The pending config to be processed next. Set to null when processed.
let nextConfig: WorkerConfig | null = null;
// Function to be called when the config is set.
let notifyConfig: (() => void) | null = null;

type UpdateStateFunc = (values: {
  sucraseCode?: string;
  babelCode?: string;
  typeScriptCode?: string;
  tokensStr?: string;
  sucraseTimeMs?: number | null;
  babelTimeMs?: number | null;
  typeScriptTimeMs?: number | null;
  babelLoaded?: boolean;
  typeScriptLoaded?: boolean;
}) => void;

// Callback function to update the main app state. Just forwards the object to
// setState in the App component.
let updateStateFn: UpdateStateFunc | null = null;

type HandleCompressedCodeFunc = (compressedCode: string) => void;

// Callback function to persist the compressed code to the URL. Compression is
// slow enough that it's useful to do in a web worker.
let handleCompressedCodeFn: HandleCompressedCodeFunc | null = null;

function initWorker(): void {
  worker = new Worker("./Worker.worker", {type: "module"});
  worker.addEventListener("message", ({data}: {data: WorkerMessage}) => {
    if (data.type === "RESPONSE") {
      if (!nextResolve) {
        throw new Error("Expected nextResolve to be set.");
      }
      nextResolve(data.response);
      finishEndMessage();
    } else if (data.type === "BABEL_LOADED") {
      if (updateStateFn) {
        updateStateFn({babelLoaded: true});
      }
    } else if (data.type === "TYPESCRIPT_LOADED") {
      if (updateStateFn) {
        updateStateFn({typeScriptLoaded: true});
      }
    }
  });
}

initWorker();

function finishEndMessage(): void {
  nextResolve = null;
  nextReject = null;
  if (timeoutTimer != null) {
    window.clearTimeout(timeoutTimer);
  }
}

function sendMessage(message: Message): Promise<unknown> {
  if (nextConfig) {
    throw new Error(CANCELLED_MESSAGE);
  }
  worker.postMessage(message);
  if (nextResolve || nextReject) {
    throw new Error("Cannot send message when a message is already in progress!");
  }
  timeoutTimer = window.setTimeout(() => {
    worker.terminate();
    initWorker();
    if (!nextReject) {
      throw new Error("Expected nextReject to be set!");
    }
    nextReject(new Error(TIMEOUT_MESSAGE));
    finishEndMessage();
  }, 10000);
  return new Promise((resolve, reject) => {
    nextResolve = resolve;
    nextReject = reject;
  });
}

async function setConfig(config: WorkerConfig): Promise<void> {
  await sendMessage({type: "SET_CONFIG", config});
}

async function runSucrase(): Promise<string> {
  return (await sendMessage({type: "RUN_SUCRASE"})) as string;
}

async function runBabel(): Promise<string> {
  return (await sendMessage({type: "RUN_BABEL"})) as string;
}

async function runTypeScript(): Promise<string> {
  return (await sendMessage({type: "RUN_TYPESCRIPT"})) as string;
}

async function compressCode(): Promise<string> {
  return (await sendMessage({type: "COMPRESS_CODE"})) as string;
}

async function getTokens(): Promise<string> {
  return (await sendMessage({type: "GET_TOKENS"})) as string;
}

async function profileSucrase(): Promise<number> {
  return (await sendMessage({type: "PROFILE_SUCRASE"})) as number;
}

async function profileBabel(): Promise<number> {
  return (await sendMessage({type: "PROFILE_BABEL"})) as number;
}

async function profileTypeScript(): Promise<number> {
  return (await sendMessage({type: "PROFILE_TYPESCRIPT"})) as number;
}

/**
 * Consume a pending config, blocking until one shows up.
 */
async function waitForConfig(): Promise<WorkerConfig> {
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

async function profile(asyncFn: () => Promise<number | null>): Promise<number | null> {
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

async function workerLoop(): Promise<void> {
  while (true) {
    const config = await waitForConfig();
    if (!updateStateFn || !handleCompressedCodeFn) {
      throw new Error("Expected update callbacks to be set before config is set.");
    }

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

export function updateConfig(config: WorkerConfig): void {
  nextConfig = config;
  if (notifyConfig) {
    notifyConfig();
  }
}

export function subscribe({
  updateState,
  handleCompressedCode,
}: {
  updateState: UpdateStateFunc;
  handleCompressedCode: HandleCompressedCodeFunc;
}): void {
  updateStateFn = updateState;
  handleCompressedCodeFn = handleCompressedCode;
}

// tslint:disable-next-line no-floating-promises
workerLoop();

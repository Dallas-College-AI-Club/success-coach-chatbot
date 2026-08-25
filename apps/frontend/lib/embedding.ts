import {
  env as transformersEnv,
  FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";

// transformers.js caches the downloaded MiniLM weights under its own package
// directory (node_modules/@huggingface/transformers/.cache/). That path is
// READ-ONLY inside a Vercel serverless function, so the first search_knowledge
// call fails there while working fine locally. /tmp is the one writable
// location a function gets. Guarded on VERCEL so local dev keeps the
// package-local cache and does not re-download on every run.
if (process.env.VERCEL) {
  transformersEnv.cacheDir = "/tmp/transformers-cache";
}

const globalExtractor = globalThis as unknown as {
  __extractorPromise?: Promise<FeatureExtractionPipeline>;
  __extractorFailedAt?: number;
};

/** After a failed load, don't re-attempt for this long: the load is seconds
 *  of work (module init + weight download + ONNX session), and the measured
 *  failure mode (missing native binary) is permanent for the deployment — so
 *  without a cooldown every search retries the full load, up to twice per
 *  turn, for the life of the process. */
const RETRY_COOLDOWN_MS = 30_000;

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  // Dynamic import, not top-level: transformers.js drags in the native
  // onnxruntime binding, and a top-level import puts that load on EVERY
  // /api/chat request's module graph — measured live on Vercel
  // (2026-08-21), a missing libonnxruntime.so.1 500'd the whole route,
  // including turns that never touch search. Loaded lazily, a broken
  // runtime surfaces as searchKnowledge's { found: false } fallback and
  // the rest of the chat keeps working.
  const { env, pipeline } = await import("@huggingface/transformers");

  // transformers.js caches the downloaded MiniLM weights under its own
  // package directory (node_modules/@huggingface/transformers/.cache/).
  // That path is READ-ONLY inside a Vercel serverless function, so the
  // first search_knowledge call fails there while working fine locally.
  // /tmp is the one writable location a function gets. Guarded on VERCEL
  // so local dev keeps the package-local cache and does not re-download
  // on every run.
  if (process.env.VERCEL) {
    env.cacheDir = "/tmp/transformers-cache";
  }

  return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "int8",
  });
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (
    globalExtractor.__extractorFailedAt !== undefined &&
    Date.now() - globalExtractor.__extractorFailedAt < RETRY_COOLDOWN_MS
  ) {
    return Promise.reject(
      new Error("embedding model load failed recently; retry pending"),
    );
  }
  // A failed load must not poison the cache: HMR keeps this global alive in
  // dev, and in prod a transient error would otherwise disable search for
  // the process lifetime. Concurrent callers still share one in-flight load
  // — the promise is assigned before any await.
  globalExtractor.__extractorPromise ??= loadExtractor().then(
    (extractor) => {
      globalExtractor.__extractorFailedAt = undefined;
      return extractor;
    },
    (err) => {
      globalExtractor.__extractorPromise = undefined;
      globalExtractor.__extractorFailedAt = Date.now();
      throw err;
    },
  );
  return globalExtractor.__extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

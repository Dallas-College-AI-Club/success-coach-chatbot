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
};

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!globalExtractor.__extractorPromise) {
    globalExtractor.__extractorPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        dtype: "int8",
      },
    );
  }
  return globalExtractor.__extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

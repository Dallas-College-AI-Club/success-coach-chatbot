// Pure implementation of the local MiniLM embedder — no "server-only" guard,
// so CLI scripts (scripts/probe-search.mts) can import it under plain tsx
// without tripping the react-server condition check.
//
// Production consumers (chat route, tools) MUST import from ./embedding
// instead — that wrapper adds the server-only guard so an accidental client
// import fails at build time. Mirrors the names.ts / searchKnowledge.ts
// split the team already uses for the DB-touching tools.

import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

// Singleton across warm serverless container lifetime: the ~30MB ONNX weight
// download happens once per container on the first call to getExtractor(),
// then every subsequent embedText() call is sub-100ms. The pipeline() call
// is what triggers the weight download — the top-level static import above
// just resolves the ~200KB JS module.
//
// Static import (rather than dynamic) because tsx transpiles this file to a
// data: URL for CLI runs, breaking bare-specifier resolution for import()
// at runtime. Bundle-size protection comes from next.config's
// serverExternalPackages instead, which tells Next to load transformers
// from node_modules at runtime rather than inlining native bindings.
const globalExtractor = globalThis as unknown as {
  __extractorPromise?: Promise<FeatureExtractionPipeline>;
};

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!globalExtractor.__extractorPromise) {
    globalExtractor.__extractorPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "int8" },
    );
  }
  return globalExtractor.__extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

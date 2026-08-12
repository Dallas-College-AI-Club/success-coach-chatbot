import {
  DataArray,
  FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";

const globalExtractor = globalThis as unknown as {
  __extractor?: FeatureExtractionPipeline;
};

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!globalExtractor.__extractor) {
    globalExtractor.__extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        dtype: "int8",
      },
    );
  }
  return globalExtractor.__extractor;
}

export async function embedText(text: string): Promise<DataArray> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data;
}

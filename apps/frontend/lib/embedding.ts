import {
  DataArray,
  FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";

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

export async function embedText(text: string): Promise<DataArray> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data;
}

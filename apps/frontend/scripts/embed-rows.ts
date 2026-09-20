/** Offline delivery builder: uses exactly the same encoder as chat retrieval. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { embedText } from "../lib/embedding";
import contract from "../lib/embedding-contract.json";

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || resolve(input) === resolve(output)) {
    throw new Error("Provide separate input and output paths");
  }
  const rows = JSON.parse(await readFile(input, "utf8"));
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("Delivery is empty");
  // Reject malformed rows before loading the encoder or constructing a delivery.
  for (const row of rows) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      !row.metadata ||
      typeof row.metadata !== "object" ||
      Array.isArray(row.metadata)
    )
      throw new Error("Each row requires an object and metadata object");
    if (typeof row.chunk_text !== "string" || !row.chunk_text.trim())
      throw new Error("Empty chunk text");
  }
  for (const row of rows) {
    const hash = createHash("sha256").update(row.chunk_text).digest("hex");
    const meta = row.metadata;
    const vector = row.embedding;
    const valid =
      Array.isArray(vector) &&
      vector.length === contract.dimensions &&
      vector.every(
        (n: unknown) => typeof n === "number" && Number.isFinite(n),
      ) &&
      Math.abs(Math.hypot(...vector) - 1) <= 0.01 &&
      meta.embedding_model === contract.model &&
      meta.embedding_dimensions === contract.dimensions &&
      meta.embedding_dtype === contract.dtype &&
      meta.embedding_text_sha256 === hash;
    // An old or unproven vector is regenerated, never relabelled as the new model.
    if (!valid) row.embedding = await embedText(row.chunk_text);
    row.metadata = {
      ...meta,
      embedding_model: contract.model,
      embedding_dimensions: contract.dimensions,
      embedding_dtype: contract.dtype,
      embedding_text_sha256: hash,
    };
  }
  await writeFile(output, JSON.stringify(rows, null, 1) + "\n", { flag: "wx" });
  console.log(
    `Validated and embedded ${rows.length} rows using ${contract.model}`,
  );
}
main().catch(() => {
  console.error("Embedding failed; no completed delivery was written.");
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Inspect the generated deployment artifact, not the configuration text.
// Local node_modules hid a missing ONNX package in the first staged build.
const manifest = resolve(".next/server/app/api/chat/route.js.nft.json");
const trace = JSON.parse(readFileSync(manifest, "utf8")) as { files: string[] };
const files = new Set(
  trace.files.map((file) => resolve(dirname(manifest), file)),
);
let checked = 0;
function included(path: string) {
  assert.ok(files.has(resolve(path)), `Chat deployment is missing ${path}`);
  checked++;
}
for (const name of ["onnxruntime-node", "onnxruntime-common"]) {
  const root = join("node_modules", name);
  included(join(root, "package.json"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    main: string;
  };
  included(join(root, pkg.main));
  for (const file of readdirSync(join(root, "dist"), { recursive: true })) {
    if (typeof file === "string" && /\.(?:c?js|mjs)$/.test(file))
      included(join(root, "dist", file));
  }
}
for (const file of ["libonnxruntime.so.1", "onnxruntime_binding.node"]) {
  included(join("node_modules/onnxruntime-node/bin/napi-v6/linux/x64", file));
}
console.log(`embedding deployment trace: ${checked} runtime files included`);

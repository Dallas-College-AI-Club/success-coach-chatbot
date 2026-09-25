import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  allowedDevOrigins: ["100.101.190.113"],

  // Transformers 4.3 loads ONNX through createRequire, which tracing misses
  // entirely. Include its JS entry points and common dependency as well as
  // the computed native-library path. Only Linux x64 binaries belong in the
  // Vercel function; all platform binaries would exceed its size limit.
  outputFileTracingIncludes: {
    "/api/chat": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**",
      "./node_modules/onnxruntime-common/package.json",
      "./node_modules/onnxruntime-common/dist/**",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
  },
};

export default nextConfig;

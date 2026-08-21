import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,

    allowedDevOrigins: [
        "100.101.190.113",
    ],

    // onnxruntime-node (pulled in by @huggingface/transformers for the
    // search_knowledge embeddings) loads libonnxruntime.so.1 at runtime via a
    // computed path, so Vercel's file tracing misses it and the deployed
    // function dies with "cannot open shared object file" (measured live
    // 2026-08-21). Force just the linux-x64 binaries into the trace — the
    // full package is ~211MB across platforms, which would blow the 250MB
    // function limit.
    outputFileTracingIncludes: {
        "/api/chat": [
            "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
        ],
    },
};

export default nextConfig;
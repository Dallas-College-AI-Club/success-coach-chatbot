import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,

    allowedDevOrigins: [
        "100.101.190.113",
    ],
};

export default nextConfig;
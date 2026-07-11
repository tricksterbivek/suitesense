/** @type {import('next').NextConfig} */
const nextConfig = {
  // sql.js probes for node 'fs' at bundle time; in the BROWSER bundle it only
  // runs on wasm, so stub the node builtins there. The server keeps real fs
  // (the generate route's execution gate reads the wasm from disk).
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
  // Vercel: make sure the wasm ships inside the serverless function bundle.
  outputFileTracingIncludes: {
    '/api/generate': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
  },
};

export default nextConfig;

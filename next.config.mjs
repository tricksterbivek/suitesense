/** @type {import('next').NextConfig} */
const nextConfig = {
  // sql.js probes for node 'fs' at bundle time; it only runs in the browser here
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;

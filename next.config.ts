import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration (Next.js 16 default)
  // Dynamic imports with ssr: false should handle the canvas module issue
  turbopack: {},
  // Keep webpack config as fallback for --webpack flag
  webpack: (config, { isServer }) => {
    // Ignore canvas module on the server side (it's only needed for Node.js, not browser)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
      });
    }
    
    // Fallback for canvas module in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;

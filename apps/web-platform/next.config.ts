import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@sparktrack/ui', '@sparktrack/contracts', '@sparktrack/offline-sync'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

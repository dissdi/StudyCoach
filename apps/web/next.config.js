/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@study-coach/shared'],

  // msedge-tts / ws 의 native addon(bufferutil, utf-8-validate)을
  // Next.js 서버 번들에서 제외 → webpack이 번들링하지 않고 Node.js require() 그대로 사용
  // (번들링하면 native binary 함수가 깨져서 "bufferUtil.mask is not a function" 에러 발생)
  // Next.js 14에서는 experimental 안에 있어야 함 (15에서 stable로 승격)
  experimental: {
    serverComponentsExternalPackages: ['msedge-tts', 'ws', 'bufferutil', 'utf-8-validate'],
  },

  webpack: (config) => {
    config.resolve.alias['@study-coach/shared'] = path.resolve(
      __dirname,
      '../../packages/shared/src/index.ts',
    );
    return config;
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@posers/core',
    '@posers/motion-dsl',
    '@posers/vrm-runtime',
    '@posers/validator',
  ],
  webpack: (config) => {
    // Handle Three.js and related packages
    config.externals = config.externals || []
    return config
  },
}

module.exports = nextConfig

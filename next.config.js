/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable caching để tránh hiện bài tập cũ
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0
    }
  }
};

module.exports = nextConfig;

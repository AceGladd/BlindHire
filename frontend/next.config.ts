import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', 'pdf-parse'],
  async rewrites() {
    return [
      // FastAPI backend proxy — statik dosyalar (avatar, cache, video)
      {
        source: '/static/:path*',
        destination: 'http://localhost:8000/static/:path*',
      },
      // FastAPI backend proxy — health check ve diğer REST API'ler
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

export default nextConfig;

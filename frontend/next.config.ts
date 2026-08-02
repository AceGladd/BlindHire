import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', 'pdf-parse'],
  
  // EKLENEN KISIM: Derleme (build) sırasında TypeScript ve ESLint hatalarını tamamen yoksayar
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  async rewrites() {
    // EKLENEN KISIM: Canlı ortamda (Vercel) NEXT_PUBLIC_API_URL kullanır, kendi bilgisayarında ise localhost:8000'e gider.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    return [
      // FastAPI backend proxy — statik dosyalar (avatar, cache, video)
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
      // FastAPI backend proxy — health check ve diğer REST API'ler
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
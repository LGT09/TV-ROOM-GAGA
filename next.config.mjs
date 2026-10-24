/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@sl-code-lords/movie-api"],
  outputFileTracingIncludes: {
    "/api/library": ["./lib/providers/sinhala-worker.cjs", "./node_modules/@sl-code-lords/movie-api/**/*"],
    "/api/movie-download": ["./lib/providers/sinhala-worker.cjs", "./node_modules/@sl-code-lords/movie-api/**/*"],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

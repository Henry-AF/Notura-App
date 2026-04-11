// In development, disable TLS certificate verification to work around
// corporate proxies that intercept HTTPS with their own certificates.
// This only affects the local dev server — production (Vercel) is unaffected.
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;

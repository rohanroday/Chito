import type { NextConfig } from "next";

// One-container deploy (see the repo's Dockerfile): the dashboard is built as plain files and served by the API
// under /admin. Off by default, so the Vercel build is unchanged.
const staticExport = process.env.ADMIN_STATIC_EXPORT === "1";
const basePath = process.env.ADMIN_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(staticExport && { output: "export", trailingSlash: true }),
  ...(basePath && { basePath }),
  // For the few plain <img>/location links that Next doesn't prefix with basePath itself
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

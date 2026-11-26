import type { NextConfig } from "next";
import { BASE_PATH as basePath } from "./src/lib/base-path";

// GitHub Pages serves the site from /<repo>. Override with NEXT_PUBLIC_BASE_PATH
// (empty or "/" for a custom domain). Cleaned in src/lib/base-path.ts, like every file URL.

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next-dev",
  webpack(config, { dev }) {
    if (!dev) config.cache = false;
    return config;
  },
};
export default config;

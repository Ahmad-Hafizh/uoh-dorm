import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    turbopack: {},
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    webpack(config, { dev }) {
      if (!dev) config.cache = false;
      return config;
    },
  };
}

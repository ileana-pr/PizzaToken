import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // tell next.js that the frontend/ dir is its own root,
  // not a sub-project of the monorepo above it
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

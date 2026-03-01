import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow base64 images from Jupyter kernel in img src
  images: {
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;

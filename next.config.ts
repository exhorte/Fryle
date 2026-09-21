import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Images des produits importés depuis Stripe (hébergées sur files.stripe.com).
    remotePatterns: [new URL("https://files.stripe.com/**")],
  },
};

export default nextConfig;

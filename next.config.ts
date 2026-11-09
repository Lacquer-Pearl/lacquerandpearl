import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정적 HTML/JS로 내보내서 웹 호스팅과 Capacitor(안드로이드) 양쪽에서 같은 결과물(out/)을 사용합니다.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

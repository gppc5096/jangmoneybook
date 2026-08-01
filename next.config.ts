import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    // API 라우트는 오프라인 폴백 대상에서 제외 (인증 토큰 · OCR 응답 오염 방지)
    navigateFallbackDenylist: [/^\/api\//],
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
};

export default withPWA(nextConfig);

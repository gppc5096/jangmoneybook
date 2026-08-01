import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '간편 가계부',
    short_name: '가계부',
    description: '간편하게 기록하는 우리집 가계부',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2B5BE2',
    lang: 'ko',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

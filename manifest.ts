import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PrediGol Pro',
    short_name: 'PrediGol',
    description: 'Analiza partidos, cuotas y ticket desde una sola app instalable.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    lang: 'es-CO',
    categories: ['sports', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
       {
  src: '/icons/icon-512-maskable.png',
  sizes: '512x512',
  type: 'image/png',
  purpose: 'maskable',
},
{
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}

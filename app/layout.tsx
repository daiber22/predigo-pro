import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaControls } from '@/components/pwa-controls';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrediGol Pro',
  description: 'Base web para análisis estadístico, cuotas y ticket.',
  manifest: '/manifest.webmanifest',
  applicationName: 'PrediGol Pro',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PrediGol Pro',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaControls />
      </body>
    </html>
  );
}

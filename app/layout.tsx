import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: '400',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#faf8f0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://felitostudios.com'),
  title: {
    default: 'Felito Barber Studio',
    template: '%s · Felito',
  },
  description: 'Felito Barber Studio — Cordón y Punta Carretas, Montevideo. Reservá tu turno online.',
  keywords: ['barbería montevideo', 'corte pelo montevideo', 'felito barber', 'barbería cordón'],
  applicationName: 'Felito Barber Studio',
  openGraph: {
    title: 'Felito Barber Studio',
    description: 'Reservá tu turno online — Cordón y Punta Carretas.',
    type: 'website',
    locale: 'es_UY',
    siteName: 'Felito Barber Studio',
    images: [
      {
        url: '/felito-wordmark.png',
        width: 860,
        height: 420,
        alt: 'Felito Barber Studio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Felito Barber Studio',
    description: 'Reservá tu turno online — Cordón y Punta Carretas.',
    images: ['/felito-wordmark.png'],
  },
  icons: {
    icon:     [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.svg', '/icon-192.png'],
    apple:    [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable:         true,
    title:           'Felito Barber',
    statusBarStyle:  'default',
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}

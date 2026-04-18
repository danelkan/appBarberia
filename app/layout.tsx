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

const APP_NAME     = process.env.NEXT_PUBLIC_APP_NAME ?? 'Barbería'
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://mibarberia.com'
const APP_LOCATION = process.env.APP_LOCATION         ?? 'Montevideo, Uruguay'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} — ${APP_LOCATION}. Reservá tu turno online.`,
  keywords: ['barbería', 'corte pelo', 'reserva turno online', APP_LOCATION],
  applicationName: APP_NAME,
  openGraph: {
    title: APP_NAME,
    description: `Reservá tu turno online — ${APP_LOCATION}.`,
    type: 'website',
    locale: 'es_UY',
    siteName: APP_NAME,
    images: [
      {
        url: '/brand-wordmark.png',
        width: 860,
        height: 420,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: `Reservá tu turno online — ${APP_LOCATION}.`,
    images: ['/brand-wordmark.png'],
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
    title:           APP_NAME,
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

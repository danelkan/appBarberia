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
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Enables "Add to Home Screen" on Android Chrome (standard) and iOS Safari
  // mobile-web-app-capable covers both; apple-mobile-web-app-capable is the legacy iOS form
  viewportFit: 'cover',
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
  },
  icons: {
    icon:     [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple:    [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable:         true,
    title:           'Felito',
    statusBarStyle:  'default',
  },
  other: {
    // Standard W3C meta tag for PWA "add to home screen" — covers Chrome Android + others
    'mobile-web-app-capable': 'yes',
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

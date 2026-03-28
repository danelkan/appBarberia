import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  metadataBase: new URL('https://felito-barber-studio.vercel.app'),
  title: {
    default: 'Felito Barber Studio | Reservas online en Montevideo',
    template: '%s | Felito Barber Studio',
  },
  description:
    'Felito Barber Studio en Montevideo. Elegí sede y reservá online en Cordón o Punta Carretas.',
  keywords: [
    'barbería montevideo',
    'barbería cordón',
    'barbería punta carretas',
    'felito barber studio',
    'reservas barbería',
  ],
  openGraph: {
    title: 'Felito Barber Studio',
    description: 'Reservas online para Cordón y Punta Carretas.',
    type: 'website',
    locale: 'es_UY',
    siteName: 'Felito Barber Studio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Felito Barber Studio',
    description: 'Reservas online para Cordón y Punta Carretas.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="bg-black text-cream font-sans antialiased">{children}</body>
    </html>
  )
}

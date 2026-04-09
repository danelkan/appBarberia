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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://caballerosmvd.com'),
  title: {
    default: 'Caballeros MVD | Barberia y reservas online en Montevideo',
    template: '%s | Caballeros MVD',
  },
  description:
    'Caballeros MVD en Montevideo. Elegí sucursal, servicio y horario para reservar online con una experiencia simple y premium.',
  keywords: [
    'barbería montevideo',
    'barbería pocitos',
    'caballeros mvd',
    'charles oribe',
    'reservas barbería',
    'barberia hombre montevideo',
  ],
  openGraph: {
    title: 'Caballeros MVD',
    description: 'Barbería en Montevideo con reservas online, estilo clásico y atención personalizada.',
    type: 'website',
    locale: 'es_UY',
    siteName: 'Caballeros MVD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Caballeros MVD',
    description: 'Reservas online para barbería en Montevideo.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}

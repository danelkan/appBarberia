import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  /** Tamaño del contenedor en px (ancho = alto). Default 44. */
  size?: number
  className?: string
}

/**
 * Ícono de marca de Felito Barber Studio.
 * Muestra el favicon/logo oficial con fondo oscuro y bordes redondeados.
 * Usalo en lugar de <Scissors> en todos los encabezados y sidebars.
 */
export function BrandLogo({ size = 44, className }: BrandLogoProps) {
  return (
    <div
      className={cn('flex-shrink-0 overflow-hidden rounded-2xl bg-slate-950 shadow-sm', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/favicon.svg"
        alt="Felito Barber Studio"
        width={size}
        height={size}
        priority
        unoptimized
      />
    </div>
  )
}

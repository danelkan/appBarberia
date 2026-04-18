import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  /** Tamaño del contenedor en px (ancho = alto). Default 44. */
  size?: number
  className?: string
}

interface BrandWordmarkProps {
  width?: number
  height?: number
  className?: string
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Barbería'

export function BrandLogo({ size = 44, className }: BrandLogoProps) {
  return (
    <div
      className={cn('flex-shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand-mark.svg"
        alt={APP_NAME}
        width={size}
        height={size}
        priority
        unoptimized
      />
    </div>
  )
}

export function BrandWordmark({ width = 180, height = 70, className }: BrandWordmarkProps) {
  return (
    <Image
      src="/brand-wordmark.png"
      alt={APP_NAME}
      width={width}
      height={height}
      priority
      unoptimized
      className={cn('h-auto w-auto max-w-full', className)}
    />
  )
}

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type Element<Attrs> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Attrs

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'archive-3d': Element<{ mode: string; mat: string; hue: string; data: string }>
      'vault-3d': Element<{ seed: string; ring: string; hue: string; state: string; 'opened-at'?: string }>
    }
  }
}

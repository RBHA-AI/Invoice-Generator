import type { ReactNode } from 'react'
import { useInView } from '../hooks/useInView'

interface InvRevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function InvReveal({ children, className = '', delay = 0 }: InvRevealProps) {
  const { ref, isInView } = useInView()

  return (
    <div
      ref={ref}
      className={`inv-reveal ${isInView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

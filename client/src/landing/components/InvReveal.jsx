
import { useInView } from '../hooks/useInView'

export function InvReveal({ children, className = '', delay = 0 }) {
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

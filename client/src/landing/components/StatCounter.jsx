import { useCountUp } from '../hooks/useCountUp'

export function StatCounter({ target, suffix = '', label, highlight = false }) {
  const { ref, value } = useCountUp(target)

  return (
    <div ref={ref}>
      <dt className={`text-2xl font-bold ${highlight ? 'text-[#d4af37]' : 'text-[#111827]'}`}>
        {value}
        {suffix}
      </dt>
      <dd className="mt-0.5 text-xs text-[#6b7280]">{label}</dd>
    </div>
  )
}

interface Props {
  calories: number
  protein: number
  hit?: boolean
}

export function SvgRings({ calories, protein }: Props) {
  const ring = (r: number, p: number, cls: string) => {
    const c = 2 * Math.PI * r
    return (
      <>
        <circle cx="100" cy="100" r={r} className="svg-track" />
        <circle cx="100" cy="100" r={r} className={cls} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(p, 1))} transform="rotate(-90 100 100)" />
      </>
    )
  }
  return (
    <svg viewBox="0 0 200 200" className="svg-rings" aria-hidden>
      {ring(82, calories, 'svg-k')}
      {ring(58, protein, 'svg-p')}
    </svg>
  )
}


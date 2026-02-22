import { useRef, useEffect, useState, useMemo } from 'react'
import './ProgressBar.css'
import coffeeMachine from '/coffee_machine_with_jug.svg'
import mugFilled from '/mug-filled.svg'
import mugNearlyFilled from '/mug-nearly-filled.svg'
import mugPartlyFilled from '/mug-partly-filled.svg'
import mugEmpty from '/mug-empty.svg'
import {
  FREQUENCY,
  AMPLITUDE,
  STROKE,
  HEIGHT,
  CY,
  PAD,
  TRANSITION_DURATION,
} from '../../constants/progressBar'

let idCounter = 0

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

const ProgressBar = ({ progress }: { progress: number }) => {
  const clipId = useRef(`progress-bar-clip-${++idCounter}`).current
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [animatedPercent, setAnimatedPercent] = useState(0)
  const animatedPercentRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const percent = Math.max(0, Math.min(100, progress * 100))

  // Update width on resize
  useEffect(() => {
    const el = containerRef.current!
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Animate updates to progress
  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    const from = animatedPercentRef.current
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / TRANSITION_DURATION, 1)
      const value = from + (percent - from) * easeInOut(t)
      animatedPercentRef.current = value
      setAnimatedPercent(value)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [percent])

  // Wave runs from PAD to width-PAD so round caps stay within SVG bounds
  const trackWidth = width - 2 * PAD
  const wavePath = useMemo(() => {
    const steps = Math.max(200, Math.round(trackWidth * 1.5))
    return Array.from({ length: steps + 1 }, (_, i) => {
      const x = PAD + (i / steps) * trackWidth
      const y = CY - AMPLITUDE * Math.sin((i / steps) * FREQUENCY * 2 * Math.PI)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    }).join(' ')
  }, [trackWidth])

  // Calculate tip position
  const tipX = PAD + (animatedPercent / 100) * trackWidth
  const tipY =
    CY - AMPLITUDE * Math.sin((animatedPercent / 100) * FREQUENCY * 2 * Math.PI)

  // Round displayed percent for label
  const displayPercent = Math.round(animatedPercent)

  return (
    <div className="progress-bar-root">
      <img
        alt="Coffee machine"
        className="progress-bar-machine"
        src={coffeeMachine}
      />
      <div className="progress-bar-content" ref={containerRef}>
        <span className="progress-bar-label">Brew: {displayPercent}%</span>
        <svg
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="progress-bar-svg"
          height={HEIGHT}
          role="progressbar"
          style={{ height: `${HEIGHT}px` }}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
        >
          <defs>
            <clipPath id={clipId}>
              <rect height={HEIGHT} width={tipX} x={0} y={0} />
            </clipPath>
          </defs>

          {/* Track */}
          <path
            className="progress-bar-track"
            d={wavePath}
            fill="none"
            strokeLinecap="round"
            strokeWidth={STROKE}
          />

          {/* Fill */}
          <path
            className="progress-bar-fill"
            clipPath={`url(#${clipId})`}
            d={wavePath}
            fill="none"
            strokeLinecap="round"
            strokeWidth={STROKE}
          />

          {/* Tip dot */}
          {animatedPercent > 0 ? (
            <circle
              className="progress-bar-tip"
              cx={tipX}
              cy={tipY}
              r={STROKE * 0.9}
            />
          ) : null}
        </svg>
      </div>
      <img
        alt="Mug"
        className="progress-bar-mug-icon"
        src={
          displayPercent >= 100
            ? mugFilled
            : displayPercent > 66
              ? mugNearlyFilled
              : displayPercent > 33
                ? mugPartlyFilled
                : mugEmpty
        }
      />
    </div>
  )
}

export default ProgressBar

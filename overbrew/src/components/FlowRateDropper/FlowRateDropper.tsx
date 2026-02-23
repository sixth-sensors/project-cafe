import { useEffect, useRef } from 'react'
import { FaDroplet } from 'react-icons/fa6'
import pot from '/pot.svg'
import './FlowRateDropper.css'

interface FlowRateDropperProps {
  flowRate: number
}

const FALL_MOVE_DURATION = 0.3
const FALL_PAUSE_DURATION = 0.3
const BASE_DURATION = 2

const buildKeyframes = (totalDuration: number, growDuration: number) => {
  const growEndPct = ((growDuration / totalDuration) * 100).toFixed(2)
  const fallEndPct = (
    ((growDuration + FALL_MOVE_DURATION) / totalDuration) *
    100
  ).toFixed(2)
  return `
    @keyframes dropper-fall {
      0%           { top: 25%; font-size: 0rem; }
      ${growEndPct}%  { top: 25%; font-size: 1.4rem; }
      ${fallEndPct}%  { top: 100%; font-size: 2rem; }
      100%         { top: 100%; font-size: 2rem; }
    }
  `
}

const FlowRateDropper = ({ flowRate }: FlowRateDropperProps) => {
  const growDuration = flowRate > 0 ? Math.max(0.2, 2 / (flowRate * 2)) : 2
  const totalDuration = growDuration + FALL_MOVE_DURATION + FALL_PAUSE_DURATION

  const containerRef = useRef<HTMLDivElement | null>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const pendingRef = useRef({ totalDuration, growDuration })

  pendingRef.current = { totalDuration, growDuration }

  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style')
      document.head.appendChild(styleRef.current)
    }
    styleRef.current.textContent = buildKeyframes(totalDuration, growDuration)
    return () => {
      styleRef.current?.remove()
      styleRef.current = null
    }
  }, [])

  useEffect(() => {
    const icon =
      containerRef.current?.querySelector<HTMLElement>('.dropper-icon')
    if (!icon) return

    const anim = icon.getAnimations()[0]
    if (!anim) return

    anim.updatePlaybackRate(BASE_DURATION / pendingRef.current.totalDuration)

    const handleIteration = () => {
      const { totalDuration: td, growDuration: gd } = pendingRef.current
      if (styleRef.current) {
        styleRef.current.textContent = buildKeyframes(td, gd)
      }
      anim.updatePlaybackRate(BASE_DURATION / td)
    }

    icon.addEventListener('animationiteration', handleIteration)
    return () => icon.removeEventListener('animationiteration', handleIteration)
  }, [])

  return (
    <div className="flow-rate-dropper" ref={containerRef}>
      <FaDroplet className="dropper-icon" />
      <div className="dropper-top">Flow Rate</div>
      <div className="dropper-nozzle" />
      <div className="pot-container">
        <img src={pot} className="pot" />
        <div className="pot-flow-rate">
          {`${flowRate.toFixed(1)} `}
          <span className="pot-flow-rate-unit">g/s</span>
        </div>
      </div>
    </div>
  )
}

export default FlowRateDropper

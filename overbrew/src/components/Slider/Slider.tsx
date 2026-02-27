import { useState, useCallback, useId } from 'react'
import './Slider.css'

interface SliderProps {
  min?: number
  max?: number
  defaultValue?: number
  gradientMin?: string
  gradientMax?: string
  step?: number
  onChange?: (value: number) => void
  label?: string
}

const Slider = ({
  min = 0,
  max = 100,
  defaultValue,
  gradientMin = 'blue',
  gradientMax = 'red',
  step = 1,
  onChange,
  label = 'Slider',
}: SliderProps) => {
  const thumbSize = 20
  const [value, setValue] = useState(defaultValue ?? min)
  const id = useId()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value)
      setValue(v)
      onChange?.(v)
    },
    [onChange]
  )

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  const clampedPct = Math.min(100, Math.max(0, pct))

  const labelLeft = `calc(${clampedPct}% + ${thumbSize / 2}px - (${clampedPct} * ${thumbSize}px / 100))`

  return (
    <div className="slider-root">
      <h2 className="slider-label">{label}</h2>
      <div className="slider-track-wrapper">
        <div className="slider-thumb-label" style={{ left: labelLeft }}>
          {value}
        </div>
        <div
          className="slider-track"
          style={{
            background: `linear-gradient(to right, ${gradientMin}, ${gradientMax})`,
          }}
        />
        <input
          id={id}
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

export default Slider

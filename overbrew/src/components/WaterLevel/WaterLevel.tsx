import type React from 'react'
import './WaterLevel.css'

interface WaterLevelProps {
  percentage: number
}

const THRESHOLD = 25

export default function WaterLevel({ percentage }: WaterLevelProps) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const isLow = clamped < THRESHOLD

  const percentStyle: React.CSSProperties = isLow
    ? {
        bottom: `calc(${clamped}% + 2.5rem)`,
        color: '#0099ff',
        transform: 'translateY(0)',
      }
    : {
        bottom: `${clamped / 2}%`,
        color: '#ffffff',
        transform: 'translateY(50%)',
      }

  return (
    <div className="container">
      <p className="title">Water Level</p>
      <div className="water" style={{ height: `${clamped}%` }}>
        <div className="wave-wrapper">
          <svg
            className="wave"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 30"
            preserveAspectRatio="none"
          >
            <path
              d="M0,15 Q25,0 50,15 Q75,30 100,15 Q125,0 150,15 Q175,30 200,15
                 Q225,0 250,15 Q275,30 300,15 Q325,0 350,15 Q375,30 400,15
                 L400,30 L0,30 Z"
              fill="#0099FF"
            />
          </svg>
        </div>
      </div>
      <span className="percent" style={percentStyle}>
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

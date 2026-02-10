import {
  LineChart as LineChartRe,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { ChartData } from 'recharts/types/state/chartDataSlice'

const LineChart = ({ data, target }: { data: ChartData; target?: number }) => {
  const formatTemperature = (value: number) => `${value.toFixed(1)}°C`

  return (
    <LineChartRe
      style={{
        width: '100%',
        maxWidth: '700px',
        height: '100%',
        maxHeight: '70vh',
      }}
      responsive
      data={data}
      margin={{
        top: 20,
        right: 0,
        left: 5,
        bottom: 5,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#cccccc" opacity={0.5} />
      <XAxis
        dataKey="time"
        stroke="var(--dark-brown)"
        tick={{ fontSize: 12 }}
        angle={-45}
        textAnchor="end"
        height={60}
        interval="preserveStartEnd"
        minTickGap={30}
      />
      <YAxis
        width="auto"
        stroke="var(--dark-brown)"
        tick={{ fontSize: 12 }}
        label={{
          value: 'Temperature (°C)',
          angle: -90,
          position: 'insideLeft',
          style: { textAnchor: 'middle' },
          fill: 'var(--dark-brown)',
        }}
        domain={[0, target ? target + 10 : 'dataMax + 10']}
        tickFormatter={formatTemperature}
        tickCount={6}
      />
      <Tooltip
        formatter={(value: number | undefined) =>
          value !== undefined
            ? [formatTemperature(value), 'Temperature']
            : ['N/A', 'Temperature']
        }
      />
      <Legend />
      {target !== undefined && (
        <ReferenceLine
          label={{
            value: `Target: ${formatTemperature(target)}`,
            position: 'insideTopRight',
            fontSize: '0.75rem',
            fill: 'var(--dark-brown)',
            dy: 5,
          }}
          y={target}
          strokeWidth={2}
          stroke="var(--light-brown)"
          strokeDasharray="5 5"
        />
      )}
      <Line
        type="linear"
        dataKey="temperature"
        stroke="var(--dark-orange)"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 6 }}
        name="Temperature"
      />
    </LineChartRe>
  )
}

export default LineChart

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
      data={data}
      margin={{
        top: 10,
        right: 0,
        left: 5,
        bottom: -20,
      }}
      responsive
      style={{
        width: '100%',
        maxWidth: '700px',
        height: '100%',
        maxHeight: '70vh',
      }}
    >
      <Legend
        verticalAlign="top"
        wrapperStyle={{
          fontSize: '1.5rem',
          fontWeight: '600',
          fontFamily: 'Roboto, sans-serif',
          paddingBottom: '1rem',
        }}
      />
      <CartesianGrid opacity={0.5} stroke="#cccccc" strokeDasharray="3 3" />
      <XAxis
        angle={-45}
        dataKey="time"
        height={60}
        interval="preserveStartEnd"
        minTickGap={30}
        stroke="var(--dark-brown)"
        textAnchor="end"
        tick={{ fontSize: 12 }}
      />
      <YAxis
        domain={[0, target ? target + 10 : 'dataMax + 10']}
        label={{
          value: 'Temperature (°C)',
          angle: -90,
          position: 'insideLeft',
          style: { textAnchor: 'middle' },
          fill: 'var(--dark-brown)',
        }}
        stroke="var(--dark-brown)"
        tick={{ fontSize: 12 }}
        tickCount={6}
        tickFormatter={formatTemperature}
      />
      <Tooltip
        formatter={(value: number | undefined) =>
          value !== undefined
            ? [formatTemperature(value), 'Temperature']
            : ['N/A', 'Temperature']
        }
      />
      {target !== undefined ? (
        <ReferenceLine
          label={{
            value: `Target: ${formatTemperature(target)}`,
            position: 'insideTopRight',
            fontSize: '0.75rem',
            fill: 'var(--dark-brown)',
            dy: 5,
          }}
          stroke="var(--light-brown)"
          strokeDasharray="5 5"
          strokeWidth={2}
          y={target}
        />
      ) : null}
      <Line
        activeDot={{ r: 6 }}
        dataKey="temperature"
        dot={{ r: 3 }}
        name="Temperature"
        stroke="var(--dark-orange)"
        strokeWidth={2}
        type="linear"
      />
    </LineChartRe>
  )
}

export default LineChart

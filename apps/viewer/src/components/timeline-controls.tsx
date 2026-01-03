'use client'

interface TimelineControlsProps {
  isPlaying: boolean
  speed: number
  time: number
  onPlayPause: () => void
  onSpeedChange: (speed: number) => void
  onSeek: (time: number) => void
  onReset: () => void
}

export function TimelineControls({
  isPlaying,
  speed,
  time,
  onPlayPause,
  onSpeedChange,
  onSeek,
  onReset,
}: TimelineControlsProps) {
  const formatTime = (t: number) => {
    const minutes = Math.floor(t / 60)
    const seconds = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-4">
      {/* Play/Pause button */}
      <button className="btn" onClick={onPlayPause} style={{ minWidth: '80px' }}>
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Reset button */}
      <button className="btn" onClick={onReset}>
        ⏮ Reset
      </button>

      {/* Time display */}
      <div className="font-mono text-sm" style={{ minWidth: '80px' }}>
        {formatTime(time)}
      </div>

      {/* Time scrubber */}
      <div style={{ flex: 1, maxWidth: '400px' }}>
        <input
          type="range"
          min={0}
          max={30}
          step={0.01}
          value={time % 30}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: '#888' }}>Speed:</span>
        <select
          className="input"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>
    </div>
  )
}

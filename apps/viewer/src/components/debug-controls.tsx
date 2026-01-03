'use client'

interface DebugControlsProps {
  showSkeleton: boolean
  showAxes: boolean
  onToggleSkeleton: () => void
  onToggleAxes: () => void
}

export function DebugControls({
  showSkeleton,
  showAxes,
  onToggleSkeleton,
  onToggleAxes,
}: DebugControlsProps) {
  return (
    <div className="panel" style={{ display: 'inline-flex', gap: '0.5rem' }}>
      <button
        className="btn text-xs"
        style={{
          background: showSkeleton ? '#3b82f6' : undefined,
          borderColor: showSkeleton ? '#3b82f6' : undefined,
        }}
        onClick={onToggleSkeleton}
      >
        🦴 Skeleton
      </button>
      <button
        className="btn text-xs"
        style={{
          background: showAxes ? '#3b82f6' : undefined,
          borderColor: showAxes ? '#3b82f6' : undefined,
        }}
        onClick={onToggleAxes}
      >
        📐 Axes
      </button>
    </div>
  )
}

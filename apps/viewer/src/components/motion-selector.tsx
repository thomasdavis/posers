'use client'

import { getMotionIds, getMotionMeta, type MotionId } from '@posers/motion-dsl'

interface MotionSelectorProps {
  selectedId: MotionId | null
  onSelect: (id: MotionId) => void
}

export function MotionSelector({ selectedId, onSelect }: MotionSelectorProps) {
  const motionIds = getMotionIds()

  return (
    <div className="flex flex-col gap-2">
      {motionIds.map((id) => {
        const meta = getMotionMeta(id)
        const isSelected = id === selectedId

        return (
          <button
            key={id}
            className="btn text-sm"
            style={{
              textAlign: 'left',
              background: isSelected ? '#3b82f6' : undefined,
              borderColor: isSelected ? '#3b82f6' : undefined,
            }}
            onClick={() => onSelect(id)}
          >
            <div style={{ fontWeight: 500 }}>{meta.name}</div>
            {meta.description && (
              <div
                className="text-xs"
                style={{
                  color: isSelected ? 'rgba(255,255,255,0.7)' : '#888',
                  marginTop: '0.25rem',
                }}
              >
                {meta.description}
              </div>
            )}
            {meta.tags && meta.tags.length > 0 && (
              <div
                className="flex gap-2 text-xs"
                style={{ marginTop: '0.25rem' }}
              >
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '0.25rem',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        )
      })}

      {motionIds.length === 0 && (
        <div className="text-sm" style={{ color: '#888' }}>
          No motions available
        </div>
      )}
    </div>
  )
}

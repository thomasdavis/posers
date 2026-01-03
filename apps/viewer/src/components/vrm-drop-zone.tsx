'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { loadVRM } from '@posers/vrm-runtime'

interface VRMDropZoneProps {
  onLoad: (vrm: VRM, modelName?: string) => void
  hasModel: boolean
  currentModel?: string
}

export function VRMDropZone({ onLoad, hasModel, currentModel }: VRMDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch available models on mount
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => setAvailableModels(data.models || []))
      .catch(() => setAvailableModels([]))
  }, [])

  const loadModelFromUrl = useCallback(async (url: string, name: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { vrm } = await loadVRM(url)
      onLoad(vrm, name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VRM')
    } finally {
      setIsLoading(false)
    }
  }, [onLoad])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.vrm')) {
      setError('Please upload a .vrm file')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { vrm } = await loadVRM(file)
      onLoad(vrm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VRM')
    } finally {
      setIsLoading(false)
    }
  }, [onLoad])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  return (
    <div className="flex flex-col gap-2">
      {/* Available models list */}
      {availableModels.length > 0 && (
        <div>
          <div className="text-xs" style={{ color: '#888', marginBottom: '0.5rem' }}>
            Available Models
          </div>
          <div className="flex flex-col gap-1">
            {availableModels.map((model) => {
              const isSelected = currentModel === model
              return (
                <button
                  key={model}
                  className="btn text-xs"
                  style={{
                    textAlign: 'left',
                    background: isSelected ? '#3b82f6' : undefined,
                    borderColor: isSelected ? '#3b82f6' : undefined,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  disabled={isLoading}
                  onClick={() => loadModelFromUrl(`/models/${model}`, model)}
                >
                  {isSelected && '✓ '}{model.replace('.vrm', '')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {availableModels.length > 0 && (
        <div style={{
          borderTop: '1px solid #333',
          margin: '0.5rem 0',
          paddingTop: '0.5rem'
        }}>
          <div className="text-xs" style={{ color: '#888', marginBottom: '0.5rem' }}>
            Or upload your own
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`drop-zone ${isDragging ? 'active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        style={{ padding: '1rem' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".vrm"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        {isLoading ? (
          <div className="text-sm">Loading VRM...</div>
        ) : error ? (
          <div className="text-sm" style={{ color: '#f87171' }}>
            {error}
          </div>
        ) : (
          <div className="text-xs" style={{ color: '#888' }}>
            Drop VRM or click to browse
          </div>
        )}
      </div>
    </div>
  )
}

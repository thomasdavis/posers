'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  GridHelper,
  AxesHelper,
  Clock,
  SkeletonHelper,
  Color,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { VRM } from '@pixiv/three-vrm'
import type { MotionProgram } from '@posers/core'
import { VRMHumanoidRig } from '@posers/vrm-runtime'
import { MotionRunner, createMotionContext } from '@posers/motion-dsl'

interface VRMCanvasProps {
  vrm: VRM | null
  motion: MotionProgram | null
  isPlaying: boolean
  speed: number
  onTimeUpdate: (time: number) => void
  showSkeleton: boolean
  showAxes: boolean
}

export function VRMCanvas({
  vrm,
  motion,
  isPlaying,
  speed,
  onTimeUpdate,
  showSkeleton,
  showAxes,
}: VRMCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const clockRef = useRef<Clock>(new Clock())
  const rigRef = useRef<VRMHumanoidRig | null>(null)
  const runnerRef = useRef<MotionRunner | null>(null)
  const skeletonHelperRef = useRef<SkeletonHelper | null>(null)
  const axesHelperRef = useRef<AxesHelper | null>(null)
  const animationFrameRef = useRef<number>(0)

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const { width, height } = container.getBoundingClientRect()

    // Scene
    const scene = new Scene()
    scene.background = new Color(0x1a1a1a)
    sceneRef.current = scene

    // Camera
    const camera = new PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 1.2, 3)
    cameraRef.current = camera

    // Renderer
    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.update()
    controlsRef.current = controls

    // Lights
    const ambient = new AmbientLight(0xffffff, 0.5)
    scene.add(ambient)

    const directional = new DirectionalLight(0xffffff, 1)
    directional.position.set(5, 10, 5)
    scene.add(directional)

    // Grid
    const grid = new GridHelper(10, 10, 0x444444, 0x333333)
    scene.add(grid)

    // Handle resize
    const handleResize = () => {
      const { width, height } = container.getBoundingClientRect()
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameRef.current)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  // Handle VRM changes
  useEffect(() => {
    if (!sceneRef.current) return

    const scene = sceneRef.current

    // Remove old skeleton helper
    if (skeletonHelperRef.current) {
      scene.remove(skeletonHelperRef.current)
      skeletonHelperRef.current = null
    }

    // Remove old VRM
    if (rigRef.current) {
      scene.remove(rigRef.current.getVRM().scene)
      rigRef.current = null
    }

    if (!vrm) return

    // Add VRM to scene
    scene.add(vrm.scene)

    // Create rig and runner
    const rig = new VRMHumanoidRig(vrm)
    rigRef.current = rig

    const runner = new MotionRunner(rig)
    runnerRef.current = runner

    // Create skeleton helper
    const skeletonHelper = new SkeletonHelper(vrm.scene)
    skeletonHelper.visible = showSkeleton
    scene.add(skeletonHelper)
    skeletonHelperRef.current = skeletonHelper

    // Focus camera on model
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.2, 3)
      controlsRef.current.target.set(0, 1, 0)
      controlsRef.current.update()
    }

  }, [vrm, showSkeleton])

  // Handle motion changes
  useEffect(() => {
    if (!runnerRef.current || !motion) return
    runnerRef.current.setMotion(motion)
  }, [motion])

  // Handle skeleton visibility
  useEffect(() => {
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.visible = showSkeleton
    }
  }, [showSkeleton])

  // Handle axes visibility
  useEffect(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current

    if (axesHelperRef.current) {
      scene.remove(axesHelperRef.current)
      axesHelperRef.current = null
    }

    if (showAxes) {
      const axes = new AxesHelper(1)
      scene.add(axes)
      axesHelperRef.current = axes
    }
  }, [showAxes])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

      const delta = clockRef.current.getDelta()

      // Update motion
      if (runnerRef.current && isPlaying) {
        runnerRef.current.getClock().speed = speed
        runnerRef.current.update(delta)
        onTimeUpdate(runnerRef.current.getTime())
      }

      // Update VRM (for blend shapes, spring bones, etc.)
      if (rigRef.current) {
        rigRef.current.update(delta)
      }

      // Update controls
      controlsRef.current?.update()

      // Render
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, speed, onTimeUpdate])

  // Handle play/pause
  useEffect(() => {
    if (!runnerRef.current) return

    const clock = runnerRef.current.getClock()
    if (isPlaying) {
      clock.play()
    } else {
      clock.pause()
    }
  }, [isPlaying])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

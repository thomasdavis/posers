# Posers

A freeform procedural motion engine for VRM humanoids. Create expressive, human-like animations through code instead of keyframes.

## Overview

Posers generates real-time procedural animations for VRM (Virtual Reality Model) humanoid characters. Instead of traditional keyframe animation, motions are defined as programs that compute bone rotations each frame based on time, parameters, and physics simulations.

### Key Features

- **Procedural Motion Programs** - Define animations as TypeScript functions
- **Phase Envelope System** - Smooth, overlapping transitions (not state machines)
- **Spring Physics** - Natural acceleration/deceleration curves
- **Full Body Coordination** - All 69 VRM bones considered for each motion
- **Visual Validation** - GPT-4o vision-based quality assurance
- **Real-time Viewer** - Next.js app for previewing and debugging motions

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/thomasdavis/posers.git
cd posers

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Viewer

```bash
# Start the development server
pnpm dev

# Or start just the viewer
pnpm --filter @posers/viewer dev
```

Open http://localhost:4100 in your browser. The viewer will load with the default VRM model (Seed-san) and display all available motions.

### Running Visual Validation

The visual validator captures screenshots of running animations and analyzes them with GPT-4o to ensure quality.

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Make sure the viewer is running on port 4100
pnpm --filter @posers/viewer dev &

# Run visual validation
pnpm --filter @posers/blocks validate:visual
```

## Project Structure

```
posers/
├── apps/
│   └── viewer/              # Next.js 14 motion preview app
├── packages/
│   ├── core/                # Math utilities, types, oscillators
│   ├── vrm-runtime/         # VRM loading and rig API
│   ├── motion-dsl/          # Motion programs and DSL
│   ├── blocks/              # Visual validation with GPT-4o
│   ├── validator/           # Runtime validation (NaN checks, etc.)
│   └── ik/                  # IK solvers (stub)
├── blocks.yml               # Motion constraints and validation rules
└── docs/                    # Additional documentation
```

## Available Motions

| Motion | Description |
|--------|-------------|
| `idle-breathe` | Subtle breathing animation for idle stance |
| `basic-walk` | Simple procedural walk cycle |
| `confident-stance` | Power pose with commanding presence |
| `nervous-fidget` | Anxiety-driven fidgeting with self-soothing gestures |
| `smoking-cigarette` | Complete smoking animation with hand-to-mouth coordination |
| `seductive-walk` | Runway-style walk with exaggerated hip sway |
| `contemplative-lean` | Thoughtful asymmetric pose with thinking gestures |
| `jump` | Athletic vertical jump with full body coordination |
| `backflip` | Standing backflip with full rotation |

## Creating a New Motion

### 1. Create the Motion File

Create a new file in `packages/motion-dsl/src/motions/`:

```typescript
import { z } from 'zod'
import type { MotionProgram, MotionMeta, HumanoidRig, MotionContext } from '@posers/core'
import { quatFromAxisAngle, osc } from '@posers/core'

// Define parameters schema
export const myMotionParamsSchema = z.object({
  intensity: z.number().min(0).max(1).default(0.7),
})

export type MyMotionParams = z.infer<typeof myMotionParamsSchema>

// Motion metadata
export const myMotionMeta: MotionMeta = {
  id: 'my-motion',
  name: 'My Motion',
  description: 'Description of what this motion does',
  tags: ['category', 'tags'],
  author: 'your-name',
}

// Create the motion
export function createMyMotion(params = {}): MotionProgram<MyMotionParams> {
  const validatedParams = myMotionParamsSchema.parse(params)

  return {
    meta: myMotionMeta,
    paramsSchema: myMotionParamsSchema,

    update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void {
      const { intensity } = validatedParams

      // VRM arms start in T-pose (horizontal)
      // Bring arms down: LEFT arm uses -Z, RIGHT arm uses +Z
      const armDown = 1.2 * intensity  // ~70 degrees

      if (rig.hasBone('leftUpperArm')) {
        rig.setRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -armDown))
      }
      if (rig.hasBone('rightUpperArm')) {
        rig.setRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, armDown))
      }

      // Add breathing oscillation to chest
      const breathPhase = osc(t, 0.2, 0, 0.02 * intensity)
      if (rig.hasBone('chest')) {
        rig.setRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -breathPhase))
      }
    },
  }
}

// Default export
export const myMotion: MotionProgram<MyMotionParams> = createMyMotion({})
```

### 2. Export from Index

Add your motion to `packages/motion-dsl/src/motions/index.ts`:

```typescript
export * from './my-motion'
```

### 3. Add to blocks.yml (Optional)

For visual validation, add your motion to `blocks.yml`:

```yaml
blocks:
  my_motion:
    type: function
    description: |
      Description of your motion and how it should feel.
    path: "packages/motion-dsl/src/motions/my-motion.ts"
    outputs:
      - name: pose
        type: entity.motion_program
        constraints:
          - "Arms must not be in T-pose"
          - "Motion should feel natural"
```

### 4. Build and Test

```bash
# Rebuild motion-dsl package
pnpm --filter @posers/motion-dsl build

# Start viewer to preview
pnpm --filter @posers/viewer dev

# Run visual validation
OPENAI_API_KEY="sk-..." pnpm --filter @posers/blocks validate:visual
```

## Core Concepts

### VRM Bone Conventions

VRM normalized bones have **mirrored Z-axis conventions** for left/right arms:

```typescript
// LEFT arm: NEGATIVE Z rotation brings arm DOWN from T-pose
rig.setRotation('leftUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -1.2))

// RIGHT arm: POSITIVE Z rotation brings arm DOWN from T-pose
rig.setRotation('rightUpperArm', quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 1.2))
```

### Phase Envelopes

Use overlapping phase envelopes instead of state machines for smooth transitions:

```typescript
function phaseEnvelope(t: number, start: number, peak: number, end: number): number {
  if (t < start || t > end) return 0
  if (t < peak) return smoothstep(start, peak, t)
  return 1 - smoothstep(peak, end, t)
}

// Overlapping phases
const anticipation = phaseEnvelope(cycleT, 0.0, 0.15, 0.30)
const execution = phaseEnvelope(cycleT, 0.20, 0.50, 0.80)
const followThrough = phaseEnvelope(cycleT, 0.70, 0.90, 1.0)
```

### Spring Physics

Use springs for natural motion dynamics:

```typescript
import { createSpring, SpringPresets } from '@posers/core'

const armSpring = createSpring(SpringPresets.smooth)

// In update():
armSpring.setTarget(targetRotation)
armSpring.update(dt)
const smoothRotation = armSpring.value
```

### Rig API

```typescript
interface HumanoidRig {
  // Check if bone exists
  hasBone(bone: VRMHumanBoneName): boolean

  // Set absolute rotation (replaces current)
  setRotation(bone: VRMHumanBoneName, quat: Quaternion): void

  // Add rotation (multiplies with current)
  addRotation(bone: VRMHumanBoneName, quat: Quaternion): void

  // Move hips (root motion)
  setHipsPositionOffset(offset: Vector3): void

  // Get bone world position
  getWorldPosition(bone: VRMHumanBoneName): Vector3
}
```

## Available Bones

### Core (Always animate these)
- `hips`, `spine`, `chest`, `upperChest`, `neck`, `head`

### Arms
- `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand`
- `rightShoulder`, `rightUpperArm`, `rightLowerArm`, `rightHand`

### Legs
- `leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `leftToes`
- `rightUpperLeg`, `rightLowerLeg`, `rightFoot`, `rightToes`

### Fingers (30 bones)
- `[left|right][Thumb|Index|Middle|Ring|Little][Proximal|Intermediate|Distal]`

### Face
- `leftEye`, `rightEye`, `jaw`

## Scripts Reference

```bash
# Development
pnpm dev                    # Start all dev servers
pnpm build                  # Build all packages
pnpm typecheck              # Type check all packages
pnpm lint                   # Lint all packages
pnpm clean                  # Clean build artifacts

# Viewer
pnpm --filter @posers/viewer dev    # Start viewer on port 4100

# Validation
pnpm --filter @posers/blocks validate:visual   # Run GPT-4o visual validation

# Individual packages
pnpm --filter @posers/motion-dsl build   # Build just motion-dsl
pnpm --filter @posers/core typecheck     # Type check just core
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Required for visual validation with GPT-4o |
| `PORT` | Viewer port (default: 4100) |

## Philosophy

Posers follows these principles for human-like motion:

1. **Phase Envelopes Over State Machines** - Use overlapping phases, not discrete states
2. **Maximum Bone Engagement** - Every motion should consider all relevant bones
3. **Anticipation + Follow-through** - Telegraph movements before execution
4. **Spring Physics** - Use springs for natural acceleration curves
5. **Proximal-to-Distal Timing** - Shoulder leads elbow leads wrist leads fingers
6. **Breath Coupling** - Breathing affects chest, shoulders, and subtle head motion

## License

MIT

## Contributing

Contributions welcome! Please read the motion creation guidelines above and ensure your motions pass visual validation before submitting PRs.

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

## Using Blocks for Testing & Validation

Blocks is the validation system that ensures motion quality through automated visual analysis. It uses GPT-4o vision to analyze screenshots of your animations and verify they meet quality constraints.

### How Blocks Works

1. **Captures Screenshots** - Puppeteer loads your motion in a headless browser at specific time points (t=0.25s, t=1.0s, t=1.75s)
2. **Sends to GPT-4o Vision** - Screenshots are analyzed by GPT-4o with motion-specific prompts
3. **Scores Quality** - Returns a 0-100 score based on constraints defined in `blocks.yml`
4. **Reports Issues** - Lists specific problems found (e.g., "arms in T-pose", "motion not fluid")

### Running Visual Validation

```bash
# 1. Start the viewer (required - validator captures from this)
pnpm --filter @posers/viewer dev &

# 2. Run validation on all motions
OPENAI_API_KEY="sk-..." pnpm --filter @posers/blocks validate:visual

# Output example:
# ═══════════════════════════════════════════════════════════
#   BLOCKS VISUAL VALIDATOR (output.visual)
# ═══════════════════════════════════════════════════════════
#
# Found 7 motion blocks to validate
#
#   Validating: confident_stance
#     ✓ Score: 75/100 - Humanoid arms angled downward, animation working correctly
#
#   Validating: nervous_fidget
#     ✓ Score: 80/100 - Motion shows appropriate fidgeting behavior
#
# ═══════════════════════════════════════════════════════════
#   SUMMARY: 7 passed, 0 failed
# ═══════════════════════════════════════════════════════════
```

### Understanding blocks.yml

The `blocks.yml` file defines validation rules for each motion. Here's the structure:

```yaml
name: "Posers Motion Engine"
root: "packages/motion-dsl/src/motions"

# Global quality philosophy
philosophy:
  - "Human-like motion is the primary goal"
  - "Use overlapping phase envelopes, NOT discrete state machines"
  - "Every motion must consider ALL 69 VRM bones"
  - "Motions must be anatomically accurate"

# Visual validation settings
visual_validation:
  enabled: true
  model: "gpt-4o"
  viewer_url: "http://localhost:4100"
  default_frames: 3
  pass_threshold: 50  # Minimum score to pass (0-100)
  checks:
    - "Core bones (hips, spine, chest, neck, head) are visibly animated"
    - "No limbs stuck in T-pose or unnatural positions"
    - "Motion appears smooth and fluid"
    - "Pose is anatomically plausible"

# Individual motion definitions
blocks:
  confident_stance:
    type: function
    description: |
      Power pose with commanding presence.
      FEEL: Grounded, assured, ready. Like a CEO about to address the board.
    path: "packages/motion-dsl/src/motions/confident-stance.ts"
    outputs:
      - name: pose
        type: entity.motion_program
        constraints:
          - "CORE: Spine chain must show upright confident posture"
          - "BREATH: Deep, slow breathing (4-5 second cycle)"
          - "ARMS: Relaxed at sides, not in T-pose"
          - "HEAD: Chin slightly elevated, gaze forward"
```

### Adding a New Motion to Blocks

To enable visual validation for your motion, add it to `blocks.yml`:

```yaml
blocks:
  # Use snake_case for the block name (matches motion ID with underscores)
  my_awesome_motion:
    type: function
    description: |
      Describe what this motion does and how it should FEEL.

      FEEL: What emotion/attitude does this convey?

      TIMING: Describe phase relationships between body parts.
    path: "packages/motion-dsl/src/motions/my-awesome-motion.ts"
    inputs:
      - name: rig
        type: entity.rig
      - name: ctx
        type: entity.motion_context
    outputs:
      - name: pose
        type: entity.motion_program
        measures: [bone_count, documentation_quality, quaternion_validity]
        constraints:
          # Be specific about what GPT-4o should check
          - "ARMS: Must not be in T-pose (horizontal)"
          - "ARMS: Should be relaxed at sides or in motion-appropriate position"
          - "CORE: Spine should show [specific posture]"
          - "BREATH: Visible chest movement"
          - "TIMING: Motion should feel [smooth/snappy/fluid]"
          - "[MOTION-SPECIFIC]: Add constraints unique to your motion"
```

### Constraint Writing Tips

Write constraints that GPT-4o can visually verify:

**Good constraints:**
- "Arms angled downward at sides, not horizontal"
- "Visible hip sway during walk cycle"
- "Head tilted slightly to one side"
- "One leg bent, weight on opposite leg"

**Bad constraints (not visually verifiable):**
- "Quaternions are normalized" (can't see math)
- "Springs have correct damping" (internal state)
- "Motion feels confident" (too subjective)

### Debugging Failed Validations

When a motion fails validation:

1. **Check the screenshots** - Saved to `validation-output/screenshots/`
   ```bash
   ls validation-output/screenshots/
   # my-motion_t0.25.png
   # my-motion_t1.00.png
   # my-motion_t1.75.png
   ```

2. **View the screenshots** - Open them to see what GPT-4o analyzed

3. **Check the JSON results** - Detailed analysis in `validation-output/visual-validation.json`
   ```json
   {
     "passed": 6,
     "failed": 1,
     "results": [
       {
         "valid": false,
         "issues": [
           {
             "type": "error",
             "code": "VISUAL_ISSUE",
             "message": "[Frame 2] Humanoid arms are in T-pose"
           }
         ],
         "context": {
           "summary": "Score: 45/100 - Arms stuck in T-pose"
         }
       }
     ]
   }
   ```

4. **Common issues and fixes:**

   | Issue | Cause | Fix |
   |-------|-------|-----|
   | "Arms in T-pose" | Missing arm rotation | Add `armDown = 1.2` rotation on Z-axis |
   | "Motion not smooth" | No spring physics | Use `createSpring()` for dynamic values |
   | "Pose not natural" | Missing secondary motion | Add micro-movements, breath coupling |
   | "Limbs frozen" | Bone not being updated | Check `hasBone()` and `setRotation()` calls |

### Development Workflow with Blocks

**Recommended workflow for building new motions:**

```bash
# 1. Create your motion file
# packages/motion-dsl/src/motions/my-motion.ts

# 2. Export it from index
# packages/motion-dsl/src/motions/index.ts

# 3. Build the package
pnpm --filter @posers/motion-dsl build

# 4. Preview in viewer (keep this running)
pnpm --filter @posers/viewer dev

# 5. Add to blocks.yml with constraints

# 6. Run validation to check quality
OPENAI_API_KEY="sk-..." pnpm --filter @posers/blocks validate:visual

# 7. If it fails, check screenshots and fix issues
open validation-output/screenshots/

# 8. Rebuild and re-validate until it passes
pnpm --filter @posers/motion-dsl build
OPENAI_API_KEY="sk-..." pnpm --filter @posers/blocks validate:visual

# 9. Commit when all validations pass
git add -A && git commit -m "Add my-motion with blocks validation"
```

### Validation Endpoint

The viewer exposes a special endpoint for headless validation:

```
GET /validate/[motion-id]?t=0.5&skeleton=true
```

Parameters:
- `motion-id`: The motion ID in kebab-case (e.g., `confident-stance`)
- `t`: Time in seconds to capture (default: 0)
- `skeleton`: Show skeleton overlay (default: false)

You can test this manually:
```bash
# Open in browser while viewer is running
open "http://localhost:4100/validate/confident-stance?t=1.0&skeleton=true"
```

### Custom Validation Checks

You can add custom checks to `visual_validation.checks` in `blocks.yml`:

```yaml
visual_validation:
  checks:
    # Global checks applied to ALL motions
    - "Core bones (hips, spine, chest, neck, head) are visibly animated"
    - "No limbs stuck in T-pose or unnatural positions"
    - "Motion appears smooth and fluid"
    - "Pose is anatomically plausible"
    - "Weight distribution looks natural"

    # Add your own global checks
    - "Fingers are not rigidly straight"
    - "Eyes are not staring blankly ahead"
```

Per-motion constraints in the `blocks:` section are combined with these global checks.

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

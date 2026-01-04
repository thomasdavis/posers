# Motion Generation System Architecture

## Overview

This document describes how Claude (an LLM) generates humanoid character animations through code. The goal is to identify limitations and research directions for improvement.

---

## Current System Architecture

### 1. Target Platform: VRM Humanoid Rigs

We animate **VRM (Virtual Reality Model)** humanoid characters. These have a standardized skeleton with ~55 bones:
- Core: hips, spine, chest, neck, head
- Arms: shoulder, upperArm, lowerArm, hand (per side)
- Fingers: thumb, index, middle, ring, little × 3 segments each
- Legs: upperLeg, lowerLeg, foot, toes (per side)

**VRM Coordinate System:**
- VRM uses a T-pose as rest pose
- Rotations are quaternions relative to parent bone
- Z-axis rotation moves arms up/down from T-pose
- X-axis rotation moves limbs forward/back
- Y-axis rotation twists limbs

### 2. Motion Program Interface

```typescript
interface MotionProgram {
  meta: MotionMeta
  paramsSchema: z.ZodSchema

  update(
    rig: HumanoidRig,    // API to set bone rotations
    ctx: MotionContext,  // Parameters, state
    t: number,           // Current time in seconds
    dt: number           // Delta time since last frame
  ): void
}
```

The `update()` function is called every frame (~60fps) and must set bone rotations procedurally based on time.

### 3. How Claude Generates Motion Code

**Process:**
1. User describes desired motion (e.g., "create a waving animation")
2. Claude writes TypeScript code that procedurally animates bones
3. Code is compiled and run in the viewer
4. Screenshots are captured at various time points
5. Claude views screenshots and iterates on the code

**What Claude Has Access To:**
- Bone names and hierarchy
- Math utilities (quaternion operations, easing functions, oscillators)
- Spring physics for smooth motion
- Screenshots of the rendered result (delayed feedback)

**What Claude Does NOT Have:**
- Real-time visual feedback while coding
- Reference motion capture data
- Inverse kinematics (IK) for goal-based positioning
- Physics simulation
- Muscle/deformation models

---

## Current Approach: Procedural Animation

### Technique: Layered Oscillators + Phase Envelopes

```typescript
update(rig, ctx, t, dt) {
  // 1. Define phase timing
  const cycleTime = (t % cycleDuration) / cycleDuration
  const phase1Progress = phaseProgress(cycleTime, 0, 0.25)

  // 2. Calculate target values with easing
  const armRaise = easeOutBack(phase1Progress)

  // 3. Add oscillation for movement
  const waveAmount = Math.sin(t * waveSpeed * Math.PI * 2) * intensity

  // 4. Apply to bones
  rig.setRotation('rightUpperArm', quatFromAxisAngle({x:0,y:0,z:1}, armAngle))
}
```

### Strengths:
- Deterministic and reproducible
- Lightweight (no physics sim needed)
- Parameters can be exposed for runtime tuning
- Works with any VRM model

### Weaknesses:
- **No spatial awareness**: Claude guesses rotation values without knowing where the hand ends up in 3D space
- **Slow iteration**: Must compile, render, screenshot, view, adjust
- **No reference data**: Claude invents movements from imagination, not from studying real motion
- **Per-bone authoring**: Must manually coordinate every bone, easy to miss secondary motion
- **No constraints**: Joints can bend in impossible ways if values are wrong

---

## Limitations of LLM-Based Motion Generation

### 1. Blind Rotation Guessing

Claude sets bone rotations like `quatFromAxisAngle({x:0,y:0,z:1}, 1.2)` without knowing:
- Where this places the end effector (hand, foot) in world space
- Whether this creates self-intersection
- Whether this looks natural to a human viewer

**Example Problem:**
```typescript
// Claude tries to make hand reach mouth
rig.setRotation('rightUpperArm', quat1)
rig.setRotation('rightLowerArm', quat2)
rig.setRotation('rightHand', quat3)
// But has no way to verify the hand actually reaches the mouth
```

### 2. Delayed Visual Feedback Loop

Current workflow:
1. Write code (5 minutes)
2. Compile (10 seconds)
3. Capture screenshots (30 seconds)
4. View and analyze (1 minute)
5. Iterate

This makes it impractical to fine-tune motion through trial and error.

### 3. No Motion Vocabulary

Claude doesn't have:
- A library of motion capture clips to reference
- Learned representations of what "natural" motion looks like
- Examples of good timing, spacing, arcs

### 4. Secondary Motion is Hard

Realistic animation requires:
- Follow-through (hair, clothes continue after body stops)
- Overlapping action (different body parts move at different times)
- Anticipation (wind-up before action)
- Squash and stretch (not applicable to rigid bones)

Claude must manually program all of these, often forgetting or implementing incorrectly.

---

## Potential Improvements

### Approach 1: Inverse Kinematics (IK)

Instead of setting joint rotations directly, specify end-effector targets:

```typescript
// Instead of:
rig.setRotation('rightUpperArm', ???)
rig.setRotation('rightLowerArm', ???)

// Do this:
ik.solveArmTo('right', targetPosition: {x: 0.1, y: 1.5, z: 0.3})
```

**Benefits:**
- Claude can think in terms of "hand at mouth" instead of joint angles
- Solvers handle the math automatically
- More intuitive for goal-based motion

**Research Keywords:**
- FABRIK (Forward And Backward Reaching Inverse Kinematics)
- CCD (Cyclic Coordinate Descent)
- Jacobian-based IK

### Approach 2: Motion Matching / Motion Graphs

Use a database of motion capture clips and blend between them:

```typescript
// Instead of procedural:
const clip = motionDatabase.findBestMatch({
  tags: ['wave', 'greeting'],
  constraints: { rightHandAbove: 'shoulder' }
})
motionGraph.transitionTo(clip)
```

**Benefits:**
- Real human motion as reference
- Automatic secondary motion
- Natural timing and spacing

**Research Keywords:**
- Motion Matching (Ubisoft's technique)
- Motion Graphs
- Learned Motion Priors
- Motion VAE (Variational Autoencoder)

### Approach 3: Neural Motion Synthesis

Train a neural network to generate motion from text descriptions:

```typescript
// Text-to-motion model
const motion = await motionModel.generate("friendly wave with body movement")
```

**Research Keywords:**
- MDM (Motion Diffusion Model)
- T2M-GPT
- MotionGPT
- TEACH (Temporal Action Compositions for 3D Humans)
- TEMOS (Text-to-Motion Synthesis)
- HumanML3D dataset

### Approach 4: Real-Time Visual Feedback

Give Claude immediate visual feedback while coding:

```typescript
// Interactive REPL where Claude can see results instantly
> rig.setRotation('rightUpperArm', angle)
[Shows updated pose immediately]
> // Claude sees result and adjusts
> rig.setRotation('rightUpperArm', adjustedAngle)
```

**Implementation Ideas:**
- WebSocket connection between Claude and viewer
- Hot module reloading for instant code updates
- Split view with code and 3D preview

### Approach 5: Motion Primitives Library

Pre-build a library of motion building blocks:

```typescript
// High-level primitives
motion.raiseArm('right', height: 'shoulder', duration: 0.5)
motion.wave('right', speed: 'fast', intensity: 'high')
motion.lowerArm('right', duration: 0.5)

// Claude composes instead of invents
```

**Benefits:**
- Claude works at higher abstraction level
- Primitives are pre-tuned for quality
- Easier to compose complex sequences

### Approach 6: Reference Video Analysis

Allow Claude to analyze reference videos:

```typescript
// Claude watches reference video and extracts keyframes
const reference = await analyzeVideo('wave_reference.mp4')
// Returns key poses, timing, joint positions
```

**Research Keywords:**
- Video-to-Motion (pose estimation)
- MediaPipe / OpenPose
- Motion retargeting

---

## Research Questions for External AI

1. **How do game studios generate procedural animation?**
   - What techniques do AAA games use for NPC idle animations?
   - How does motion matching work in practice?

2. **What neural networks generate motion from text?**
   - State of the art in text-to-motion synthesis (2024-2025)
   - Pre-trained models available for VRM/humanoid skeletons
   - How to fine-tune on specific character styles

3. **How can LLMs be augmented for spatial reasoning?**
   - Giving LLMs understanding of 3D space
   - Embodied AI research relevant to animation

4. **What datasets exist for human motion?**
   - HumanML3D, AMASS, CMU Motion Capture
   - How to convert mocap to VRM format

5. **How do professional animators work?**
   - What software do they use?
   - What's the workflow for game animation?
   - How do they think about timing and spacing?

---

## Quick Wins vs Long-Term Solutions

### Quick Wins (Days)
- [ ] Add IK solver for arm positioning
- [ ] Create motion primitive library
- [ ] Real-time parameter tuning UI
- [ ] Multiple camera angles in viewer
- [ ] Skeleton overlay visualization

### Medium Term (Weeks)
- [ ] Motion capture data import
- [ ] Blend between motion clips
- [ ] Reference video side-by-side comparison

### Long Term (Months)
- [ ] Integrate text-to-motion neural network
- [ ] Train custom motion model on desired style
- [ ] Full motion matching system

---

## Example: What Good Motion Looks Like

**A professional animator creating a wave would consider:**

1. **Anticipation**: Slight crouch or weight shift before arm raises
2. **Arc**: Arm moves in curved path, not straight line
3. **Timing**: Fast start, slow at apex, fast down
4. **Secondary**: Fingers spread slightly after hand stops
5. **Follow-through**: Body continues moving briefly after arm stops
6. **Overlap**: Different body parts start/stop at different times
7. **Personality**: Speed and amplitude convey character attitude

**What Claude currently produces:**
- Sine wave oscillation on wrist
- Linear interpolation on arm raise
- All body parts synchronized
- No anticipation or follow-through
- Robotic rather than organic

---

## Conclusion

The current system generates "functional" motion but lacks the organic quality of professional animation. The key limitations are:

1. **Spatial blindness**: Claude can't see where joints end up in 3D
2. **No reference data**: Inventing motion rather than learning from examples
3. **Slow iteration**: Can't quickly experiment with values
4. **Low-level authoring**: Working with joint angles instead of intentions

The most promising improvements are:
- **Short term**: IK solvers + motion primitives
- **Medium term**: Motion capture integration
- **Long term**: Neural motion synthesis from text

Research into text-to-motion models (MDM, MotionGPT) seems most promising for enabling an LLM to generate high-quality motion from natural language descriptions.

# The Hard Problem of LLM-Generated Procedural Animation

## Executive Summary

This document details the challenges encountered when using Large Language Models (LLMs) to generate procedural humanoid animations. While basic motions (idle breathing, simple walks) can be successfully generated, **complex expressive animations consistently fail to achieve believable quality**. This represents a fundamental gap between code generation capabilities and the embodied understanding required for realistic human motion.

---

## Table of Contents

1. [Project Context](#project-context)
2. [What Works](#what-works)
3. [What Fails](#what-fails)
4. [Why This Is Hard for LLMs](#why-this-is-hard-for-llms)
5. [The Knowledge Gap](#the-knowledge-gap)
6. [Failed Approaches](#failed-approaches)
7. [Research Directions](#research-directions)
8. [Potential Strategies](#potential-strategies)
9. [Open Questions](#open-questions)
10. [Resources for Further Research](#resources-for-further-research)

---

## Project Context

### System Architecture

**Posers** is a procedural motion engine for VRM humanoid avatars featuring:

- **69 bones** in the VRM humanoid skeleton (17 required + 52 optional)
- **Quaternion-based rotations** for gimbal-lock-free animation
- **Spring physics** for natural acceleration/deceleration
- **Simplex noise** for organic micro-movements
- **Deterministic execution** via seeded random number generators
- **60fps real-time rendering** with <2ms update budget

### Motion Program Interface

```typescript
interface MotionProgram {
  meta: MotionMeta
  paramsSchema: z.ZodSchema
  init?(rig: HumanoidRig, ctx: MotionContext): void
  update(rig: HumanoidRig, ctx: MotionContext, t: number, dt: number): void
}
```

Each frame, the `update()` function receives:
- `rig` - Safe bone manipulation API with `setRotation()`, `addRotation()`, `hasBone()`
- `ctx` - Runtime context with parameters, state, and seed
- `t` - Total elapsed time in seconds
- `dt` - Delta time since last frame

### Motions Implemented

| Motion | Complexity | Status | Quality |
|--------|-----------|--------|---------|
| idle-breathe | Simple | ✅ Works | Good |
| basic-walk | Medium | ✅ Works | Acceptable |
| confident-stance | Medium | ⚠️ Partial | Stiff |
| nervous-fidget | Complex | ⚠️ Partial | Mechanical |
| smoking-cigarette | Complex | ❌ Fails | Uncanny |
| seductive-walk | Complex | ❌ Fails | Robotic |
| contemplative-lean | Complex | ⚠️ Partial | Static |

---

## What Works

### 1. Oscillation-Based Motions

Simple motions driven by sine waves work reliably:

```typescript
// Breathing - THIS WORKS
const breathPhase = Math.sin(t * breathRate * Math.PI * 2)
rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.02))
```

**Why it works:**
- Single degree of freedom
- Predictable, repeating pattern
- No coordination between body parts
- No state management required

### 2. Basic Gait Cycles

Walking with alternating leg phases can be achieved:

```typescript
// Basic walk phase
const gaitPhase = (t * speed) % 1
const rightSwing = Math.sin(gaitPhase * Math.PI * 2) * 0.3
const leftSwing = Math.sin((gaitPhase + 0.5) * Math.PI * 2) * 0.3
```

**Why it works:**
- Well-documented biomechanics literature
- Clear phase relationships (left/right opposition)
- Symmetrical motion
- Forgiving of small errors

### 3. Spring-Smoothed Transitions

Spring physics successfully smooth abrupt changes:

```typescript
const spring = createSpring({ stiffness: 200, damping: 20 })
spring.setTarget(targetValue)
spring.update(dt)
const smoothValue = spring.value
```

**Why it works:**
- Physics simulation, not creative decision
- Well-defined mathematical behavior
- No "artistic" judgment required

---

## What Fails

### 1. Complex State Machines

The smoking animation attempts a 7-phase state machine:
```
idle → bring_to_mouth → inhale → hold → exhale → lower → ash_tap → idle
```

**Failure modes:**
- **Timing feels wrong** - Transitions happen at mathematically correct times but feel robotic
- **Arm trajectory is unnatural** - Straight-line interpolation instead of curved natural paths
- **Missing anticipation** - Real humans telegraph movements before executing them
- **No follow-through** - Movements stop abruptly at target positions
- **Breathing doesn't integrate** - Inhale/exhale phases don't naturally blend with chest expansion

### 2. Expressive Gait (Seductive Walk)

Attempting a runway-style walk with exaggerated movement:

**What was attempted:**
- Hip sway with spine counter-rotation
- Crossover step pattern
- Fluid arm swing with secondary motion
- Head stability with slight tilt

**What actually happens:**
- Hip sway looks like a mechanical oscillator
- Crossover pattern creates geometric, not organic, curves
- Arms swing in perfect sine waves (too perfect)
- The "sexiness" is entirely absent - motion is clinical

### 3. Fidgeting and Nervous Behavior

Attempting anxiety-driven, irregular movement:

**The fundamental problem:**
- Real fidgeting is *actually* irregular and unpredictable
- LLM generates *mathematically* irregular patterns (noise functions)
- Mathematical irregularity ≠ human irregularity
- Noise-based fidgeting looks like tremors, not nervousness

### 4. Hand-to-Face Gestures

Any motion requiring precise hand positioning relative to the face:

**Failures:**
- Hand doesn't reach the correct position on chin/mouth
- Fingers don't form natural grips
- No inverse kinematics means blind positioning
- Wrist angles are anatomically wrong

---

## Why This Is Hard for LLMs

### 1. Embodiment Gap

LLMs have no physical body and have never:
- Felt the weight of their own limbs
- Experienced muscle tension and fatigue
- Balanced on two legs
- Reached for an object

**Impact:** Generated motion lacks the subtle weight shifts, anticipatory movements, and physical constraints that humans unconsciously incorporate.

### 2. Temporal Reasoning Limitations

LLMs process text sequentially but motion exists in continuous time:

```typescript
// LLM generates discrete keyframes mentally
// But motion requires continuous interpolation
// The "in-between" frames reveal lack of understanding
```

**Impact:** Transitions between poses feel wrong because LLMs think in terms of poses, not flows.

### 3. Multi-Joint Coordination

Human motion requires simultaneous, coordinated movement of many joints:

```
Reaching for coffee:
- Shoulder rotation begins
- Elbow starts extending 50ms later
- Wrist begins rotating 80ms later
- Fingers start opening 120ms before arrival
- Torso shifts weight opposite to reaching arm
- Head turns toward target
- Eyes track object
```

**Impact:** LLM-generated code tends to move joints in parallel with the same timing, creating robotic motion.

### 4. Training Data Mismatch

LLMs are trained on:
- Code describing motion (not motion itself)
- Text about animation (conceptual, not procedural)
- Documentation (abstract principles)

LLMs are NOT trained on:
- Raw motion capture data
- Video of human movement
- Physical simulation data
- Biomechanics research papers (in sufficient depth)

### 5. The Uncanny Valley Problem

Animation has a brutal quality threshold:
- 80% correct motion looks 0% believable
- Small errors are amplified by human perception
- We're evolutionarily tuned to detect "wrong" human motion

---

## The Knowledge Gap

### What LLMs Know

1. **Bone names and hierarchies** ✅
2. **Quaternion mathematics** ✅
3. **Basic physics equations** ✅
4. **Animation principles (written descriptions)** ✅
5. **Code patterns for animation loops** ✅

### What LLMs Don't Know

1. **How specific movements actually feel** ❌
2. **Precise timing of human movement phases** ❌
3. **Subtle coordination patterns between joints** ❌
4. **How weight transfer actually works** ❌
5. **Muscle activation sequences** ❌
6. **The difference between "correct" and "believable"** ❌

### The Documentation Gap

Surprisingly little exists in a form LLMs can learn from:

| Resource Type | Availability | LLM Usability |
|---------------|--------------|---------------|
| Animation principle books | Medium | Low (conceptual) |
| Biomechanics papers | High | Low (too technical) |
| Motion capture datasets | High | None (binary data) |
| Procedural animation code | Low | Medium |
| Tutorial videos | High | None (visual) |
| Reference footage | High | None (visual) |

---

## Failed Approaches

### 1. More Detailed Prompts

**Attempt:** Provide extremely detailed descriptions of desired motion.

```
"The arm should rise in an arc, with the elbow leading slightly,
the wrist trailing by approximately 0.1 seconds, the shoulder
externally rotating 15 degrees as the elbow passes 45 degrees..."
```

**Result:** LLM generates code that matches the description but still looks wrong because the description itself can't capture the full complexity.

### 2. Layer-by-Layer Decomposition

**Attempt:** Break motion into independent layers (posture, breathing, micro-movement, gesture).

**Result:** Layers don't integrate naturally. Each layer is correct in isolation but combining them creates interference patterns.

### 3. Reference to Animation Principles

**Attempt:** Instruct LLM to apply Disney's 12 principles of animation.

**Result:** LLM generates code comments about "anticipation" and "follow-through" but the actual implementation doesn't achieve these effects.

### 4. Physics-Based Approach

**Attempt:** Use spring dynamics, damping, and momentum for natural motion.

**Result:** Motion is smoother but still lacks intentionality. Physically correct ≠ believable.

### 5. Noise-Based Organic Feel

**Attempt:** Add Perlin/Simplex noise to all movements for organic variation.

**Result:** Motion looks jittery or drunk rather than natural. Noise adds chaos, not life.

### 6. Detailed State Machines

**Attempt:** Define explicit states with precise transitions.

**Result:** States are too discrete. Real motion has overlapping phases, not clean transitions.

---

## Research Directions

### 1. Neural Motion Priors

Train neural networks on motion capture data to learn motion manifolds:

- **Motion VAE** - Encode valid human motion into latent space
- **Motion Diffusion Models** - Generate motion through denoising
- **Style Transfer** - Apply movement style to base motion

**Relevance:** Could provide learned priors that procedural code samples from.

### 2. Physics-Based Character Animation

Full physics simulation with:
- Muscle-actuated skeletons
- Contact dynamics
- Balance control
- Trajectory optimization

**Key Research:**
- DeepMind's physically simulated humanoids
- Reinforcement learning for locomotion
- Trajectory optimization methods (STOMP, CHOMP)

### 3. Motion Matching

Runtime motion synthesis from database:
- Store fragments of motion capture
- At each frame, find best matching continuation
- Blend between fragments

**Used by:** Ubisoft, Naughty Dog, modern game engines

### 4. Learned Motion Controllers

Train policies to generate motion:
- Given high-level goals, output joint angles
- Reinforcement learning with motion quality rewards
- Can generalize to novel situations

### 5. Procedural + Data Hybrid

Combine procedural base with learned corrections:
- Procedural code provides structure
- Neural network adds naturalistic variations
- Best of both worlds

---

## Potential Strategies

### Strategy 1: Motion Primitive Library

**Concept:** Pre-capture small motion primitives (1-3 seconds) that can be combined procedurally.

```typescript
// Instead of generating "reach for face" procedurally
// Use captured primitive with procedural parameters
const reach = motionLibrary.get('reach_face')
reach.setTarget(facePosition)
reach.setSpeed(0.8)
reach.blend(currentPose, t)
```

**Pros:**
- Real human motion as base
- Procedural parameters for variation
- Avoids generating motion from scratch

**Cons:**
- Requires motion capture setup
- Limited by library size
- Combination logic still challenging

### Strategy 2: Motion Quality Reward Model

**Concept:** Train a discriminator to distinguish good/bad motion, use as feedback.

```typescript
// Generate candidate motion
const candidate = generateMotion(params)

// Score with quality model
const score = motionQualityModel.evaluate(candidate)

// Iterate until quality threshold met
if (score < threshold) {
  regenerateWithFeedback(candidate, score)
}
```

**Pros:**
- Automated quality assessment
- Can guide generation iteratively
- Learns human preferences

**Cons:**
- Requires training data
- May learn wrong correlates
- Slow iteration loop

### Strategy 3: Inverse Kinematics First

**Concept:** Define end-effector targets (hands, feet) and solve IK, then add style.

```typescript
// Define where hand should go
const handTarget = calculateCigaretteToMouthPosition()

// Solve IK for arm chain
const armPose = ikSolver.solve(['shoulder', 'elbow', 'wrist'], handTarget)

// Apply pose
applyPose(armPose)

// Add stylistic variation
addNoise(armPose, styleParams)
```

**Pros:**
- Hand positions are correct
- Natural joint angles from IK
- Style is separate concern

**Cons:**
- IK is computational
- Still need to specify targets correctly
- Doesn't solve timing issues

### Strategy 4: Motion Graphs

**Concept:** Define valid transitions as a graph, search for paths.

```typescript
const motionGraph = {
  'idle': ['startWalk', 'startSmoke', 'shift_weight'],
  'startWalk': ['walking', 'stopWalk'],
  'startSmoke': ['raiseArm'],
  'raiseArm': ['inhale'],
  // ...
}

// Plan motion as path through graph
const path = motionGraph.findPath(currentState, targetState)
```

**Pros:**
- Guarantees valid transitions
- Can optimize paths
- Explicit representation

**Cons:**
- Graph construction is manual
- Combinatorial explosion
- Doesn't generate the actual motion

### Strategy 5: LLM as Director, Not Animator

**Concept:** Use LLM for high-level choreography, specialized systems for motion.

```typescript
// LLM generates high-level description
const choreography = await llm.generate(`
  Character takes a drag from cigarette nervously,
  looking around, then exhales while checking phone
`)

// Parse into motion primitives
const primitives = parseChoreography(choreography)
// ['smoke_drag', 'look_around', 'exhale', 'check_phone']

// Execute with motion matching / physics system
for (const primitive of primitives) {
  await motionSystem.execute(primitive)
}
```

**Pros:**
- Plays to LLM strengths (language)
- Uses specialized tools for motion
- More maintainable architecture

**Cons:**
- Requires robust motion system
- Parsing choreography is hard
- Loss of creative control

### Strategy 6: Interactive Refinement

**Concept:** Human-in-the-loop iterative improvement.

```
1. LLM generates initial motion
2. Human views and critiques ("arm too stiff", "needs more weight")
3. LLM adjusts based on feedback
4. Repeat until acceptable
```

**Pros:**
- Human judgment catches errors
- Iterative improvement
- Teaches LLM over time

**Cons:**
- Slow
- Requires domain expertise
- Not scalable

### Strategy 7: Constrained Generation

**Concept:** Define hard constraints motion must satisfy, generate within constraints.

```typescript
const constraints = {
  footContact: 'left_foot grounded during t=0.0-0.4',
  jointLimits: 'elbow flex < 150 degrees',
  timing: 'hand reaches face at t=0.8 ± 0.1',
  smoothness: 'angular velocity < 3 rad/s',
}

const motion = generateMotionWithConstraints(goal, constraints)
```

**Pros:**
- Guarantees physical validity
- Can encode biomechanical knowledge
- Reduces search space

**Cons:**
- Constraint specification is tedious
- May over-constrain
- Doesn't guarantee aesthetic quality

---

## Open Questions

### Fundamental Questions

1. **Can procedural animation ever match mocap quality?**
   - Or is data-driven the only path to believability?

2. **What is the minimum viable motion representation?**
   - Can we define a compact "motion DNA" that captures human movement?

3. **Is there a tractable "motion grammar"?**
   - Analogous to language grammar for text generation?

4. **How do humans actually plan motion?**
   - Can we encode motor planning algorithms?

5. **What makes motion "feel" right?**
   - Can this be formalized beyond "I know it when I see it"?

### Technical Questions

1. **What training data would help LLMs generate better motion?**
   - Annotated mocap? Code + video pairs? Biomechanics textbooks?

2. **Can motion quality be measured automatically?**
   - Beyond physics validity, can we score "naturalness"?

3. **How should procedural and data-driven approaches combine?**
   - What's the right interface between them?

4. **What's the right level of abstraction for motion specification?**
   - Joint angles? End effectors? Intent descriptions?

5. **Can we bootstrap motion understanding from video?**
   - Use vision models to extract motion patterns?

### Practical Questions

1. **What's the fastest path to production-quality motion for VTubers?**
2. **Can motion be personalized to individual avatar styles?**
3. **How do we handle the long tail of rare movements?**
4. **What's the compute budget for real-time motion synthesis?**
5. **How do we validate motion without human review?**

---

## Resources for Further Research

### Academic Papers

1. **"A Deep Learning Framework for Character Motion Synthesis and Editing"** - Holden et al.
2. **"Phase-Functioned Neural Networks for Character Control"** - Holden et al.
3. **"Motion Matching and The Road to Next-Gen Animation"** - Clavet, GDC 2016
4. **"DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills"** - Peng et al.
5. **"Learning to Move"** - DeepMind blog posts
6. **"Neural State Machine for Character-Scene Interactions"** - Starke et al.
7. **"Local Motion Phases for Learning Multi-Contact Character Movements"** - Starke et al.

### Industry Resources

1. **GDC Talks:**
   - "Motion Matching and The Road to Next-Gen Animation" (Ubisoft)
   - "The Last of Us Part II Animation System" (Naughty Dog)
   - "Pushing Animation in Destiny 2" (Bungie)

2. **Unreal Engine / Unity:**
   - Motion Matching documentation
   - Animation Blueprints / State Machines
   - Procedural animation tutorials

3. **VTuber Technology:**
   - VSeeFace documentation
   - VMC Protocol
   - VRM specification

### Open Source Projects

1. **@pixiv/three-vrm** - VRM runtime for Three.js
2. **mediapipe** - Real-time pose estimation
3. **poselib** - Pose representation and manipulation
4. **fairmotion** - Motion processing tools
5. **MotionDiffuse** - Motion diffusion models

### Datasets

1. **CMU Motion Capture Database**
2. **AMASS** - Aggregate motion capture dataset
3. **BABEL** - Motion with language annotations
4. **HumanML3D** - Text-to-motion dataset
5. **100STYLE** - Stylized motion dataset

---

## Conclusion

Generating believable human motion procedurally remains an unsolved problem at the intersection of:
- **Computer graphics** (rendering, rigging)
- **Biomechanics** (how bodies actually move)
- **Machine learning** (learning motion patterns)
- **Cognitive science** (how motion is perceived)
- **AI** (how to encode motion knowledge)

Current LLMs can generate syntactically correct animation code but lack the embodied understanding to make it *feel* right. The path forward likely involves:

1. **Hybrid approaches** combining procedural control with learned motion priors
2. **Better training data** specifically designed for motion generation
3. **New interfaces** between high-level intent and low-level motion
4. **Perceptual quality metrics** to guide generation automatically

This is not just an engineering problem—it's a fundamental question about what knowledge is required to understand human movement and whether that knowledge can be formalized in a way machines can use.

---

## Appendix: Code Examples from This Project

### What Good LLM-Generated Motion Looks Like

```typescript
// Breathing - simple, oscillation-based, works well
const breathPhase = oscBreathing(t, breathRate, intensity)
rig.addRotation('chest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.02))
rig.addRotation('upperChest', quatFromAxisAngle({ x: 1, y: 0, z: 0 }, breathPhase * 0.03))
```

### What Problematic LLM-Generated Motion Looks Like

```typescript
// Smoking - complex state machine, looks robotic
case 'bring_to_mouth':
  const raiseEase = Easing.armRaise(phaseProgress)
  armTargetX = -0.5 * intensity * raiseEase  // Why -0.5? Feels arbitrary
  armTargetY = 0.4 * intensity * raiseEase   // These numbers are guesses
  armTargetZ = handSide * 0.2 * intensity * raiseEase
  elbowBend = 1.4 * intensity * raiseEase    // Doesn't match real motion
  // Missing: anticipation, wrist rotation lead, shoulder engagement
  break
```

### The Gap

The LLM can generate code that *describes* bringing a hand to mouth but cannot generate code that *achieves* believable hand-to-mouth motion. The gap is not in syntax or structure but in the actual numerical values, timing relationships, and subtle coordinations that make motion look human.

---

*Document generated from Posers Motion Engine development, January 2026*

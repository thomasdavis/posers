# VRM Model Requirements for Posers Motion Engine

## The Problem

When testing procedural motions, it's difficult to determine whether issues stem from:
1. **The motion code** (incorrect rotation values, wrong axes, timing issues)
2. **The VRM model** (non-standard rigging, incorrect bone orientations, missing bones)
3. **The runtime** (coordinate system mismatches, quaternion handling, normalized vs raw bones)

This document specifies requirements for a "perfect" test VRM model and explains common issues.

---

## Critical Correction: VRM Does NOT Standardize Bone Axes

### What VRM Actually Standardizes

VRM standardizes:
- A **humanoid bone map** (named bones with semantic meaning)
- An **initial pose baseline** (T-Pose) used for standardized motion operations
- **Normalized bone transforms** relative to that T-Pose baseline

### What VRM Does NOT Standardize

- **Local bone axis conventions** (X/Y/Z meaning varies by DCC, exporter, and rig author)
- **Bone roll** (which direction is "forward" for each bone)
- **Raw bone orientations** (these are model-specific)

### The Dangerous Assumption

~~"X-axis = pitch, Y-axis = yaw, Z-axis = roll"~~ **WRONG**

In practice:
- Local axes vary by DCC (Blender/Unity), exporter, and rig author
- "Bone roll" is real, but you **cannot rely on a single global axis meaning "elbow bend" across models**
- Different models will have completely different axis behaviors

### The Correct Approach

Apply transforms **relative to rest pose (T-pose)** using the humanoid's **normalized bones API** rather than assuming raw bone axes.

From three-vrm docs:
> Transforms are local relative to the rest pose (T-pose)

---

## The One-Arm-Stuck Symptom

A common cause of "one arm stuck / other moves weird" is mixing:

1. **"setRotation absolute in raw bone space"** - WRONG
2. **"apply delta from rest pose in normalized humanoid space"** - CORRECT

### Required Runtime Behavior

```typescript
// CORRECT: Use normalized bones and apply deltas from rest pose
const normalizedBone = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');

// WRONG: Assuming raw bone axes work the same across models
const rawBone = vrm.humanoid.getRawBoneNode('leftUpperArm');
```

### Critical: Sync Normalized to Raw

When using normalized bones, you MUST ensure proper sync:

```typescript
// After applying rotations to normalized bones:
vrm.update(deltaTime);  // OR
vrm.humanoid.update();  // Syncs normalized bones to raw bones
```

**Reference**: [three-vrm issue #1585](https://github.com/pixiv/three-vrm/issues/1585) - "Normalized bones don't sync all transforms to raw bones"

---

## Rest Pose Delta Rule

**All motion rotations must be expressed as:**
1. **Deltas from rest pose** (not absolute rotations)
2. **Applied to normalized bones** (not raw bones)
3. **Synced via `VRM.update()` / `VRMHumanoid.update()`** when required

This is the **only** way to ensure motions work across different VRM models with different internal rigging.

---

## VRM Bone Requirements

### Required Bones (17 Total)

These bones MUST exist for a valid VRM humanoid:

```
REQUIRED_BONES = [
  'hips',           # Root of skeleton, center of mass
  'spine',          # First spine bone above hips
  'chest',          # Upper torso
  'neck',           # Base of neck
  'head',           # Head bone

  'leftUpperArm',   # Shoulder to elbow
  'leftLowerArm',   # Elbow to wrist
  'leftHand',       # Wrist to fingers

  'rightUpperArm',
  'rightLowerArm',
  'rightHand',

  'leftUpperLeg',   # Hip to knee
  'leftLowerLeg',   # Knee to ankle
  'leftFoot',       # Ankle to toes

  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
]
```

Reference: [Cluster VRM Requirements](https://help.cluster.mu/hc/en-us/articles/360029465811-Limitations-to-custom-avatars)

### Optional Bones (52 Total)

Full list available via [three-vrm VRMHumanBoneName](https://pixiv.github.io/three-vrm/docs/variables/three-vrm.VRMHumanBoneName.html)

```
OPTIONAL_BONES = [
  'upperChest',
  'leftShoulder', 'rightShoulder',
  'leftToes', 'rightToes',
  'leftEye', 'rightEye',
  'jaw',
  // All 30 finger bones (15 per hand)
  'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  // ... etc
]
```

---

## Perfect Test Model: Seed-san

### The Canonical Reference

**Seed-san** is the official VRM sample model from the VRM Consortium:

- **Source**: [vrm-specification/samples/Seed-san](https://github.com/vrm-c/vrm-specification/blob/master/samples/Seed-san/vrm/Seed-san.vrm)
- **Format**: VRM 1.0
- **Status**: Official reference, well-tested across VRM ecosystem

### Why Seed-san

1. Created by VRM Consortium as reference implementation
2. Known-good bone structure and orientations
3. Used for testing three-vrm and other VRM libraries
4. If Seed-san fails → your code is wrong
5. If Seed-san passes but your model fails → model needs profiling

### Alternative: Alicia Solid (VRM 0.x)

- **Source**: [UniVRM/Tests/Models/Alicia](https://github.com/vrm-c/UniVRM/blob/master/Tests/Models/Alicia_vrm-0.51/AliciaSolid_vrm-0.51.vrm)
- **Note**: This is VRM 0.51, not VRM 1.0 - useful for legacy testing

---

## Rig Certification Suite

Instead of manual testing, Posers should output a **rig health report** that is comparable across models.

### Test A: Bone Map Completeness

```typescript
interface BoneMapReport {
  requiredPresent: string[];
  requiredMissing: string[];
  optionalPresent: string[];
  fingerCount: number;  // 0-30
  hasEyes: boolean;
  hasJaw: boolean;
  hasToes: boolean;
  hasShoulders: boolean;
}
```

### Test B: Rest Pose Sanity Metrics

Compute in rest pose (objective, comparable):

```typescript
interface RestPoseMetrics {
  // Symmetry
  leftArmDirection: Vector3;
  rightArmDirection: Vector3;
  armSymmetryAngle: number;  // Should be ~0 for symmetric model

  // Pose classification
  handHeightVsShoulderHeight: number;  // >0 = T-pose, <0 = A-pose
  headForwardVsHipsForward: number;    // Should be ~0 (facing same way)

  // Proportions
  armLengthRatio: number;    // upperArm / lowerArm
  legLengthRatio: number;    // upperLeg / lowerLeg
  armSpan: number;           // Total arm span
  height: number;            // Total height
}
```

### Test C: Axis Discovery Per Bone (THE KEY)

**Do not assume axes. Discover them.**

For each bone:
1. Apply a tiny delta rotation around local X, Y, Z (separately)
2. Measure child direction change in world space
3. Determine which axis most strongly produces the expected hinge behavior

```typescript
/**
 * Returns axis sensitivity report:
 * How much the child direction vector changes when rotating around x/y/z by epsilon.
 */
function probeBoneAxes(rig: HumanoidRig, bone: string, epsilon = 0.15): AxisReport[] {
  const baseDir = rig.childDirectionWorld(bone); // normalized vector bone->child in world

  const axes = [
    { name: "x", euler: [epsilon, 0, 0] as const },
    { name: "y", euler: [0, epsilon, 0] as const },
    { name: "z", euler: [0, 0, epsilon] as const },
  ];

  const results = axes.map(a => {
    rig.pushPose();
    rig.addRotationEuler(bone, ...a.euler);
    rig.sync(); // ensure normalized->raw propagation
    const dir = rig.childDirectionWorld(bone);
    rig.popPose();

    const angle = Math.acos(Math.max(-1, Math.min(1, baseDir.dot(dir))));
    return { axis: a.name, angleRad: angle };
  });

  // Higher angleRad => this axis produces more visible bending
  results.sort((a, b) => b.angleRad - a.angleRad);
  return results;
}
```

**Output example:**
```
leftLowerArm: strongest bend axis = x, twist axis = y (model-specific)
rightLowerArm: strongest bend axis = x, twist axis = y

// If these differ wildly between left and right → model/rig issue
```

### Test D: Known-Pose Regression (Golden)

Ship a "Posers Canonical Pose Pack":

```typescript
const CANONICAL_POSES = [
  { name: 'arms_forward_30deg', rotations: { leftUpperArm: {...}, rightUpperArm: {...} } },
  { name: 'elbows_bent_45deg', rotations: { leftLowerArm: {...}, rightLowerArm: {...} } },
  { name: 'squat_30deg', rotations: { leftUpperLeg: {...}, rightUpperLeg: {...}, leftLowerLeg: {...}, rightLowerLeg: {...} } },
  // etc
];

function runGoldenTest(rig: HumanoidRig, model: string): GoldenTestResult {
  const results = CANONICAL_POSES.map(pose => {
    applyPose(rig, pose.rotations);
    const hash = computeSkeletonHash(rig);
    return { pose: pose.name, hash, expected: GOLDEN_HASHES[model]?.[pose.name] };
  });

  return {
    passed: results.every(r => r.hash === r.expected),
    details: results
  };
}
```

---

## Rig Profile System

For models that don't match Seed-san behavior, generate a **Rig Profile**:

```typescript
interface RigProfile {
  modelName: string;
  vrmVersion: string;

  // Rest pose classification
  poseType: 'T-pose' | 'A-pose' | 'custom';
  restPoseOffsets: Record<string, Quaternion>;

  // Per-bone axis discovery
  hingeAxes: Record<string, {
    bendAxis: 'x' | 'y' | 'z';
    twistAxis: 'x' | 'y' | 'z';
    rollAxis: 'x' | 'y' | 'z';
  }>;

  // Proportions for IK
  limbLengths: {
    upperArm: number;
    lowerArm: number;
    upperLeg: number;
    lowerLeg: number;
  };

  // Joint limits (discovered or manual)
  jointLimits: Record<string, { min: Vector3, max: Vector3 }>;
}
```

Motion code becomes **model-agnostic** by querying the profile:

```typescript
// Instead of: rotate leftLowerArm around X by 0.5
// Do: rotate leftLowerArm around profile.hingeAxes.leftLowerArm.bendAxis by 0.5
```

---

## Diagnosing Model vs Code Issues (Definitive)

### If Seed-san Fails → Runtime/Code Bug

Check these common issues:

1. **Quaternion composition order** - Are you multiplying in the right order?
2. **Normalized vs raw bone usage** - Are you using `getNormalizedBoneNode`?
3. **Not applying deltas from rest pose** - Are rotations absolute or delta?
4. **Forgetting vrm.update() sync** - Did you call update after setting rotations?
5. **Wrong coordinate system** - Are you accounting for Three.js conventions?

### If Seed-san Passes But Your Model Fails → Model Needs Profile

1. Run Rig Certification Suite
2. Generate Rig Profile
3. Either:
   - Fix the model (re-export with correct settings)
   - Use the Rig Profile to adapt motion code

---

## Implementation Checklist for Posers

### Runtime Requirements

- [ ] All motions expressed as **local deltas from rest pose (T-pose baseline)**
- [ ] Apply to **normalized humanoid bones** consistently
- [ ] Call `vrm.update()` / `humanoid.update()` after setting rotations
- [ ] Never assume bone axis conventions - discover or profile them

### Certification Requirements

- [ ] Required bone map present (17 bones)
- [ ] Symmetry checks pass (left/right arm/leg directions match)
- [ ] Axis discovery consistent across mirrored limbs
- [ ] Canonical pose pack matches golden hashes on Seed-san

### Blocks CLI Gate (Proposed)

```yaml
rig_certification:
  required: true
  canonical_model: 'seed-san'
  rules:
    - motions may not run unless model passes certification
    - OR a rig-profile.json exists for the model
```

---

## Future: packages/rig-cert/

Proposed package structure:

```
packages/rig-cert/
├── src/
│   ├── bone-map-check.ts      # Test A: bone completeness
│   ├── rest-pose-metrics.ts   # Test B: pose sanity
│   ├── axis-discovery.ts      # Test C: per-bone axis probing
│   ├── golden-tests.ts        # Test D: canonical pose regression
│   ├── profile-generator.ts   # Generate rig-profile.json
│   └── index.ts
├── golden/
│   ├── seed-san.json          # Golden hashes for Seed-san
│   └── canonical-poses.json   # Pose definitions
└── package.json
```

Viewer integration:
- Panel showing discovered hinge axes per bone
- Symmetry delta visualization
- Canonical pose pack pass/fail status
- One-click profile generation

---

## Resources

- **VRM Features**: https://vrm.dev/en/vrm/vrm_features/
- **three-vrm VRMHumanoid**: https://pixiv.github.io/three-vrm/packages/three-vrm/docs/classes/VRMHumanoid.html
- **Seed-san (official sample)**: https://github.com/vrm-c/vrm-specification/blob/master/samples/Seed-san/vrm/Seed-san.vrm
- **three-vrm VRMHumanBoneName**: https://pixiv.github.io/three-vrm/docs/variables/three-vrm.VRMHumanBoneName.html
- **Normalized bone sync issue**: https://github.com/pixiv/three-vrm/issues/1585

---

## Summary

**The shortest route to never again wondering "is it my motion code or the VRM?":**

1. Download Seed-san as canonical reference
2. Run Rig Certification Suite
3. If Seed-san fails → fix your code
4. If Seed-san passes → generate Rig Profile for your model
5. Motion code queries Rig Profile for axis info instead of assuming

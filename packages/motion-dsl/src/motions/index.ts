export * from './idle-breathe'
export * from './basic-walk'
export * from './confident-stance'
export * from './nervous-fidget'
export * from './smoking-cigarette'
export * from './seductive-walk'
export * from './contemplative-lean'
export * from './jump'
export * from './backflip'
export * from './waving'

import { idleBreathe, createIdleBreathe, idleBreatheMeta, idleBreatheParamsSchema } from './idle-breathe'
import { basicWalk, createBasicWalk, basicWalkMeta, basicWalkParamsSchema } from './basic-walk'
import { confidentStance, createConfidentStance, confidentStanceMeta, confidentStanceParamsSchema } from './confident-stance'
import { nervousFidget, createNervousFidget, nervousFidgetMeta, nervousFidgetParamsSchema } from './nervous-fidget'
import { smokingCigarette, createSmokingCigarette, smokingCigaretteMeta, smokingCigaretteParamsSchema } from './smoking-cigarette'
import { seductiveWalk, createSeductiveWalk, seductiveWalkMeta, seductiveWalkParamsSchema } from './seductive-walk'
import { contemplativeLean, createContemplativeLean, contemplativeLeanMeta, contemplativeLeanParamsSchema } from './contemplative-lean'
import { jump, createJump, jumpMeta, jumpParamsSchema } from './jump'
import { backflip, createBackflip, backflipMeta, backflipParamsSchema } from './backflip'
import { waving, createWaving, wavingMeta, wavingParamsSchema } from './waving'
import type { MotionProgram } from '@posers/core'

/**
 * Registry of all available motions.
 */
export const motionRegistry = {
  'idle-breathe': {
    meta: idleBreatheMeta,
    paramsSchema: idleBreatheParamsSchema,
    create: createIdleBreathe,
    default: idleBreathe,
  },
  'basic-walk': {
    meta: basicWalkMeta,
    paramsSchema: basicWalkParamsSchema,
    create: createBasicWalk,
    default: basicWalk,
  },
  'confident-stance': {
    meta: confidentStanceMeta,
    paramsSchema: confidentStanceParamsSchema,
    create: createConfidentStance,
    default: confidentStance,
  },
  'nervous-fidget': {
    meta: nervousFidgetMeta,
    paramsSchema: nervousFidgetParamsSchema,
    create: createNervousFidget,
    default: nervousFidget,
  },
  'smoking-cigarette': {
    meta: smokingCigaretteMeta,
    paramsSchema: smokingCigaretteParamsSchema,
    create: createSmokingCigarette,
    default: smokingCigarette,
  },
  'seductive-walk': {
    meta: seductiveWalkMeta,
    paramsSchema: seductiveWalkParamsSchema,
    create: createSeductiveWalk,
    default: seductiveWalk,
  },
  'contemplative-lean': {
    meta: contemplativeLeanMeta,
    paramsSchema: contemplativeLeanParamsSchema,
    create: createContemplativeLean,
    default: contemplativeLean,
  },
  'jump': {
    meta: jumpMeta,
    paramsSchema: jumpParamsSchema,
    create: createJump,
    default: jump,
  },
  'backflip': {
    meta: backflipMeta,
    paramsSchema: backflipParamsSchema,
    create: createBackflip,
    default: backflip,
  },
  'waving': {
    meta: wavingMeta,
    paramsSchema: wavingParamsSchema,
    create: createWaving,
    default: waving,
  },
} as const

export type MotionId = keyof typeof motionRegistry

/**
 * Get a motion by ID with default parameters.
 */
export function getMotion(id: MotionId): MotionProgram {
  return motionRegistry[id].default
}

/**
 * Get all motion IDs.
 */
export function getMotionIds(): MotionId[] {
  return Object.keys(motionRegistry) as MotionId[]
}

/**
 * Get motion metadata by ID.
 */
export function getMotionMeta(id: MotionId) {
  return motionRegistry[id].meta
}

/**
 * IK (Inverse Kinematics) package for Posers.
 *
 * This package provides IK solvers for procedural motion.
 * Currently a stub - full implementation in Milestone 2.
 */

export { ccdSolver, type CCDOptions } from './solvers/ccd'
export { fabrikSolver, type FABRIKOptions } from './solvers/fabrik'
export { footPlantingHelper, type FootPlantingOptions } from './helpers/foot-planting'
export * from './solvers/armIK'

/**
 * Graph-specific type definitions
 */

export interface GraphNode {
  issueNumber: number;
  dependencies: number[]; // Issues this depends on
  dependents: number[]; // Issues that depend on this
  depth: number;
  visited: boolean;
  inStack: boolean; // For cycle detection
}

export interface CycleError extends Error {
  cycle: number[];
}

/**
 * Analyze dependency graph for cycles
 */

import { DependencyGraph } from '../api/types';
import { CycleError } from './types';

export class GraphAnalyzer {
  /**
   * Analyze the graph for cycles
   */
  analyze(graph: DependencyGraph): DependencyGraph {
    this.detectCycles(graph);
    return graph;
  }

  /**
   * Detect cycles in the dependency graph using DFS
   */
  private detectCycles(graph: DependencyGraph): void {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const path: number[] = [];

    const dfs = (nodeNumber: number): void => {
      visited.add(nodeNumber);
      recursionStack.add(nodeNumber);
      path.push(nodeNumber);

      const node = graph.nodes.get(nodeNumber);
      if (!node) return;

      // Get all dependencies (both blockedBy and subIssues parent)
      const dependencies = [...node.blockedBy];
      if (node.parentIssue) {
        dependencies.push(node.parentIssue);
      }

      for (const depNumber of dependencies) {
        if (!visited.has(depNumber)) {
          dfs(depNumber);
        } else if (recursionStack.has(depNumber)) {
          // Cycle detected
          const cycleStart = path.indexOf(depNumber);
          const cycle = path.slice(cycleStart);
          const error = new Error(
            `Circular dependency detected: ${cycle.join(' -> ')} -> ${depNumber}`
          ) as CycleError;
          error.cycle = cycle;
          throw error;
        }
      }

      recursionStack.delete(nodeNumber);
      path.pop();
    };

    for (const nodeNumber of graph.nodes.keys()) {
      if (!visited.has(nodeNumber)) {
        dfs(nodeNumber);
      }
    }
  }


  /**
   * Get all leaf nodes (nodes with no dependencies)
   */
  getLeafNodes(graph: DependencyGraph): number[] {
    const leafNodes: number[] = [];

    for (const [nodeNumber, node] of graph.nodes) {
      const hasDependencies = node.blockedBy.length > 0 || node.parentIssue !== undefined;
      if (!hasDependencies) {
        leafNodes.push(nodeNumber);
      }
    }

    return leafNodes;
  }

  /**
   * Get all root nodes (nodes that nothing depends on)
   */
  getRootNodes(graph: DependencyGraph): number[] {
    const rootNodes: number[] = [];

    for (const [nodeNumber, node] of graph.nodes) {
      const hasDependents = node.blocking.length > 0 || node.subIssues.length > 0;
      if (!hasDependents) {
        rootNodes.push(nodeNumber);
      }
    }

    return rootNodes;
  }
}

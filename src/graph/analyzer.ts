/**
 * Analyze dependency graph and calculate critical paths
 */

import { DependencyGraph, IssueNode } from '../api/types';
import { GraphNode, CycleError } from './types';

export class GraphAnalyzer {
  /**
   * Analyze the graph and calculate all metrics
   */
  analyze(graph: DependencyGraph): DependencyGraph {
    // Check for cycles
    this.detectCycles(graph);

    // Calculate depths (longest path to each node)
    this.calculateDepths(graph);

    // Calculate criticality scores
    this.calculateCriticalityScores(graph);

    // Find critical path
    const criticalPath = this.findCriticalPath(graph);
    graph.criticalPath = criticalPath;

    // Mark nodes on critical path
    for (const nodeNumber of criticalPath) {
      const node = graph.nodes.get(nodeNumber);
      if (node) {
        node.onCriticalPath = true;
      }
    }

    // Find bottlenecks
    graph.metrics.bottlenecks = this.findBottlenecks(graph);
    graph.metrics.criticalPathLength = criticalPath.length;

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
   * Calculate depth for each node (longest path from leaf nodes)
   */
  private calculateDepths(graph: DependencyGraph): void {
    const depths = new Map<number, number>();
    const visited = new Set<number>();

    const calculateDepth = (nodeNumber: number): number => {
      if (depths.has(nodeNumber)) {
        return depths.get(nodeNumber)!;
      }

      if (visited.has(nodeNumber)) {
        return 0; // Avoid infinite recursion
      }

      visited.add(nodeNumber);

      const node = graph.nodes.get(nodeNumber);
      if (!node) return 0;

      // Get all dependencies
      const dependencies = [...node.blockedBy];
      if (node.parentIssue) {
        dependencies.push(node.parentIssue);
      }

      if (dependencies.length === 0) {
        depths.set(nodeNumber, 0);
        node.depth = 0;
        return 0;
      }

      // Calculate max depth of dependencies + 1
      let maxDepth = 0;
      for (const depNumber of dependencies) {
        const depDepth = calculateDepth(depNumber);
        maxDepth = Math.max(maxDepth, depDepth);
      }

      const depth = maxDepth + 1;
      depths.set(nodeNumber, depth);
      node.depth = depth;

      visited.delete(nodeNumber);
      return depth;
    };

    for (const nodeNumber of graph.nodes.keys()) {
      calculateDepth(nodeNumber);
    }
  }

  /**
   * Calculate criticality score (number of issues that depend on this)
   */
  private calculateCriticalityScores(graph: DependencyGraph): void {
    const scores = new Map<number, number>();

    // Initialize all scores to 0
    for (const nodeNumber of graph.nodes.keys()) {
      scores.set(nodeNumber, 0);
    }

    // Count direct dependents
    for (const node of graph.nodes.values()) {
      const dependencies = [...node.blockedBy];
      if (node.parentIssue) {
        dependencies.push(node.parentIssue);
      }

      for (const depNumber of dependencies) {
        const currentScore = scores.get(depNumber) || 0;
        scores.set(depNumber, currentScore + 1);
      }
    }

    // Set scores on nodes
    for (const [nodeNumber, score] of scores) {
      const node = graph.nodes.get(nodeNumber);
      if (node) {
        node.criticalityScore = score;
      }
    }
  }

  /**
   * Find the critical path (longest path through the graph)
   */
  private findCriticalPath(graph: DependencyGraph): number[] {
    if (graph.nodes.size === 0) {
      return [];
    }

    // Find node with maximum depth
    let maxDepth = 0;
    let maxNode: number | null = null;

    for (const [nodeNumber, node] of graph.nodes) {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
        maxNode = nodeNumber;
      }
    }

    if (maxNode === null) {
      return [];
    }

    // Backtrack to find the path
    const path: number[] = [];
    let currentNode: number | null = maxNode;

    while (currentNode !== null) {
      path.unshift(currentNode);

      const node = graph.nodes.get(currentNode);
      if (!node) break;

      // Find dependency with max depth
      const dependencies = [...node.blockedBy];
      if (node.parentIssue) {
        dependencies.push(node.parentIssue);
      }

      if (dependencies.length === 0) {
        break;
      }

      let nextNode: number | null = null;
      let nextDepth = -1;

      for (const depNumber of dependencies) {
        const depNode = graph.nodes.get(depNumber);
        if (depNode && depNode.depth > nextDepth) {
          nextDepth = depNode.depth;
          nextNode = depNumber;
        }
      }

      currentNode = nextNode;
    }

    return path;
  }

  /**
   * Find bottleneck issues (those with highest criticality scores)
   */
  private findBottlenecks(graph: DependencyGraph, topN: number = 5): number[] {
    const nodes = Array.from(graph.nodes.values());

    // Sort by criticality score descending
    nodes.sort((a, b) => b.criticalityScore - a.criticalityScore);

    // Take top N
    return nodes.slice(0, topN).map((n) => n.number);
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

/**
 * Build dependency graph from issues and dependencies
 */

import { Issue, Dependency, IssueNode, DependencyGraph } from '../api/types';

export class GraphBuilder {
  /**
   * Build a complete dependency graph from issues and dependencies
   */
  buildGraph(issues: Issue[], dependencies: Dependency[]): DependencyGraph {
    // Create a map of issue nodes
    const nodes = new Map<number, IssueNode>();

    // Initialize nodes
    for (const issue of issues) {
      nodes.set(issue.number, {
        ...issue,
        subIssues: [],
        blockedBy: [],
        blocking: [],
        depth: 0,
        criticalityScore: 0,
        onCriticalPath: false,
      });
    }

    // Build edges
    for (const dep of dependencies) {
      const fromNode = nodes.get(dep.from);
      const toNode = nodes.get(dep.to);

      if (!fromNode || !toNode) {
        // Skip dependencies where one or both nodes don't exist
        continue;
      }

      if (dep.type === 'blocked-by') {
        // dep.from is blocked by dep.to
        if (!fromNode.blockedBy.includes(dep.to)) {
          fromNode.blockedBy.push(dep.to);
        }
        if (!toNode.blocking.includes(dep.from)) {
          toNode.blocking.push(dep.from);
        }
      } else if (dep.type === 'sub-issue') {
        // dep.from is a sub-issue of dep.to
        if (!fromNode.parentIssue) {
          fromNode.parentIssue = dep.to;
        }
        if (!toNode.subIssues.includes(dep.from)) {
          toNode.subIssues.push(dep.from);
        }
      }
    }

    // Create initial graph structure
    const graph: DependencyGraph = {
      nodes,
      edges: dependencies,
      criticalPath: [],
      metrics: {
        totalIssues: issues.length,
        totalDependencies: dependencies.length,
        criticalPathLength: 0,
        bottlenecks: [],
      },
    };

    return graph;
  }

  /**
   * Merge dependencies from multiple sources (API + parsed)
   */
  mergeDependencies(dependencies: Dependency[]): Dependency[] {
    const uniqueDeps = new Map<string, Dependency>();

    for (const dep of dependencies) {
      const key = `${dep.from}-${dep.to}-${dep.type}`;
      const existing = uniqueDeps.get(key);

      if (!existing || (existing.source === 'parsed' && dep.source === 'api')) {
        // Prefer API source over parsed
        uniqueDeps.set(key, dep);
      }
    }

    return Array.from(uniqueDeps.values());
  }

  /**
   * Filter graph by labels
   */
  filterByLabels(graph: DependencyGraph, labels: string[]): DependencyGraph {
    if (!labels || labels.length === 0) {
      return graph;
    }

    const filteredNodes = new Map<number, IssueNode>();

    for (const [number, node] of graph.nodes) {
      const nodeLabels = node.labels.map((l) => l.name);
      const hasLabel = labels.some((label) => nodeLabels.includes(label));

      if (hasLabel) {
        filteredNodes.set(number, node);
      }
    }

    // Filter edges to only include nodes that exist
    const filteredEdges = graph.edges.filter(
      (edge) => filteredNodes.has(edge.from) && filteredNodes.has(edge.to)
    );

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
      metrics: {
        ...graph.metrics,
        totalIssues: filteredNodes.size,
        totalDependencies: filteredEdges.length,
      },
    };
  }

  /**
   * Filter graph by assignees
   */
  filterByAssignees(graph: DependencyGraph, assignees: string[]): DependencyGraph {
    if (!assignees || assignees.length === 0) {
      return graph;
    }

    const filteredNodes = new Map<number, IssueNode>();

    for (const [number, node] of graph.nodes) {
      const nodeAssignees = node.assignees.map((a) => a.login);
      const hasAssignee = assignees.some((assignee) => nodeAssignees.includes(assignee));

      if (hasAssignee || nodeAssignees.length === 0) {
        filteredNodes.set(number, node);
      }
    }

    // Filter edges to only include nodes that exist
    const filteredEdges = graph.edges.filter(
      (edge) => filteredNodes.has(edge.from) && filteredNodes.has(edge.to)
    );

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
      metrics: {
        ...graph.metrics,
        totalIssues: filteredNodes.size,
        totalDependencies: filteredEdges.length,
      },
    };
  }
}

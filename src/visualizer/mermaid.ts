/**
 * Generate Mermaid diagram from dependency graph
 */

import { DependencyGraph, IssueNode } from '../api/types';
import { Formatter } from './formatter';

export class MermaidGenerator {
  /**
   * Generate Mermaid diagram
   */
  generate(graph: DependencyGraph, highlightCriticalPath: boolean = true): string {
    const lines: string[] = [];

    // Start diagram
    lines.push('```mermaid');
    lines.push('graph LR');
    lines.push('');

    // Add nodes and edges
    const processedEdges = new Set<string>();

    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;

      // Add edges for blocked-by relationships
      for (const blockedByNumber of node.blockedBy) {
        const blockedByNode = graph.nodes.get(blockedByNumber);
        if (!blockedByNode) continue;

        const edgeKey = `${blockedByNumber}-${nodeNumber}`;
        if (processedEdges.has(edgeKey)) continue;

        const fromId = `N${blockedByNumber}`;
        lines.push(`    ${fromId} --> ${nodeId}`);
        processedEdges.add(edgeKey);
      }

      // Add edges for sub-issue relationships
      for (const subIssueNumber of node.subIssues) {
        const subIssueNode = graph.nodes.get(subIssueNumber);
        if (!subIssueNode) continue;

        const edgeKey = `${subIssueNumber}-${nodeNumber}`;
        if (processedEdges.has(edgeKey)) continue;

        const fromId = `N${subIssueNumber}`;
        lines.push(`    ${fromId} -.-> ${nodeId}`);
        processedEdges.add(edgeKey);
      }
    }

    lines.push('');

    // Add node labels
    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;
      const label = this.formatNodeLabel(node);
      lines.push(`    ${nodeId}["${label}"]`);
    }

    lines.push('');

    // Add styling
    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;
      const color = Formatter.getNodeColor(node, highlightCriticalPath);
      lines.push(`    style ${nodeId} fill:${color}`);
    }

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate a simplified diagram showing only critical path
   */
  generateCriticalPathOnly(graph: DependencyGraph): string {
    const lines: string[] = [];
    const criticalPath = graph.criticalPath;

    if (criticalPath.length === 0) {
      return '```mermaid\ngraph LR\n    Empty[No critical path found]\n```';
    }

    lines.push('```mermaid');
    lines.push('graph LR');
    lines.push('');

    // Add edges for critical path
    for (let i = 0; i < criticalPath.length - 1; i++) {
      const fromNumber = criticalPath[i];
      const toNumber = criticalPath[i + 1];
      const fromId = `N${fromNumber}`;
      const toId = `N${toNumber}`;
      lines.push(`    ${fromId} ==> ${toId}`);
    }

    lines.push('');

    // Add node labels
    for (const nodeNumber of criticalPath) {
      const node = graph.nodes.get(nodeNumber);
      if (!node) continue;

      const nodeId = `N${nodeNumber}`;
      const label = this.formatNodeLabel(node);
      lines.push(`    ${nodeId}["${label}"]`);
    }

    lines.push('');

    // Add styling
    for (const nodeNumber of criticalPath) {
      const nodeId = `N${nodeNumber}`;
      lines.push(`    style ${nodeId} fill:#ff6b6b`);
    }

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Format node label for Mermaid
   */
  private formatNodeLabel(node: IssueNode): string {
    const title = Formatter.formatTitle(node.title, 40);
    const sanitized = Formatter.sanitizeText(title);

    let label = `#${node.number}: ${sanitized}`;

    if (node.assignees.length > 0) {
      label += `\\n@${node.assignees[0].login}`;
    }

    return label;
  }

  /**
   * Generate metrics summary as markdown
   */
  generateMetricsSummary(graph: DependencyGraph): string {
    const lines: string[] = [];

    lines.push('## Dependency Graph Metrics');
    lines.push('');
    lines.push(`- **Total Issues**: ${graph.metrics.totalIssues}`);
    lines.push(`- **Total Dependencies**: ${graph.metrics.totalDependencies}`);
    lines.push(`- **Critical Path Length**: ${graph.metrics.criticalPathLength}`);
    lines.push('');

    if (graph.criticalPath.length > 0) {
      lines.push('### Critical Path');
      lines.push('');
      for (const nodeNumber of graph.criticalPath) {
        const node = graph.nodes.get(nodeNumber);
        if (node) {
          lines.push(`- #${nodeNumber}: ${node.title}`);
        }
      }
      lines.push('');
    }

    if (graph.metrics.bottlenecks.length > 0) {
      lines.push('### Bottlenecks (High Criticality Issues)');
      lines.push('');
      for (const nodeNumber of graph.metrics.bottlenecks) {
        const node = graph.nodes.get(nodeNumber);
        if (node) {
          lines.push(
            `- #${nodeNumber}: ${node.title} (${node.criticalityScore} dependents)`
          );
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

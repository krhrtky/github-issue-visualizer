/**
 * Generate Mermaid diagram from dependency graph
 */

import { DependencyGraph, IssueNode } from '../api/types';
import { Formatter } from './formatter';

export class MermaidGenerator {
  /**
   * Generate Mermaid diagram
   */
  generate(graph: DependencyGraph): string {
    const lines: string[] = [];

    lines.push('```mermaid');
    lines.push('graph LR');
    lines.push('');

    const processedEdges = new Set<string>();

    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;

      for (const blockedByNumber of node.blockedBy) {
        const blockedByNode = graph.nodes.get(blockedByNumber);
        if (!blockedByNode) continue;

        const edgeKey = `${blockedByNumber}-${nodeNumber}`;
        if (processedEdges.has(edgeKey)) continue;

        const fromId = `N${blockedByNumber}`;
        lines.push(`    ${fromId} --> ${nodeId}`);
        processedEdges.add(edgeKey);
      }

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

    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;
      const label = this.formatNodeLabel(node);
      lines.push(`    ${nodeId}["${label}"]`);
    }

    lines.push('');

    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;
      const color = Formatter.getNodeColor(node);
      lines.push(`    style ${nodeId} fill:${color}`);
    }

    lines.push('');

    for (const [nodeNumber, node] of graph.nodes) {
      const nodeId = `N${nodeNumber}`;
      lines.push(`    click ${nodeId} "${node.url}" "View issue on GitHub"`);
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
    lines.push('');

    return lines.join('\n');
  }
}

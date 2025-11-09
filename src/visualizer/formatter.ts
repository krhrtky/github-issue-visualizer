/**
 * Formatting utilities for visualizations
 */

import { IssueNode } from '../api/types';

export class Formatter {
  /**
   * Format issue title for display (truncate if too long)
   */
  static formatTitle(title: string, maxLength: number = 50): string {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format node label for visualization
   */
  static formatNodeLabel(node: IssueNode, includeAssignee: boolean = true): string {
    let label = `#${node.number}: ${this.formatTitle(node.title)}`;

    if (includeAssignee && node.assignees.length > 0) {
      const assignee = node.assignees[0].login;
      label += `<br/>@${assignee}`;
    }

    return label;
  }

  /**
   * Get color for node
   */
  static getNodeColor(_node: IssueNode): string {
    return '#74c0fc';
  }

  /**
   * Sanitize text for use in diagrams
   */
  static sanitizeText(text: string): string {
    return text
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
  }
}

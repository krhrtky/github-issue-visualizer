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
   * Get color for node based on criticality
   */
  static getNodeColor(node: IssueNode, highlightCriticalPath: boolean = true): string {
    if (highlightCriticalPath && node.onCriticalPath) {
      return '#ff6b6b'; // Red for critical path
    }

    if (node.criticalityScore > 3) {
      return '#ffa94d'; // Orange for high criticality
    }

    if (node.criticalityScore > 0) {
      return '#ffd43b'; // Yellow for medium criticality
    }

    return '#74c0fc'; // Blue for low criticality
  }

  /**
   * Get color hex for criticality level
   */
  static getCriticalityColor(score: number): string {
    if (score > 5) return '#d63031'; // Dark red
    if (score > 3) return '#e17055'; // Red-orange
    if (score > 1) return '#fdcb6e'; // Yellow
    return '#74b9ff'; // Blue
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

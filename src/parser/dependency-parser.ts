/**
 * Parser for extracting dependencies from issue text
 */

import { Issue, Dependency } from '../api/types';
import {
  BLOCKED_BY_PATTERNS,
  SUB_ISSUE_PATTERNS,
  TASK_LIST_PATTERN,
  DependencyPattern,
} from './patterns';

export class DependencyParser {
  /**
   * Parse all dependencies from an issue's body text
   */
  parseDependencies(issue: Issue): Dependency[] {
    const dependencies: Dependency[] = [];
    const text = issue.body;

    if (!text) {
      return dependencies;
    }

    // Parse blocked-by dependencies
    const blockedBy = this.parsePatterns(text, BLOCKED_BY_PATTERNS, 'blocked-by');
    for (const issueNumber of blockedBy) {
      dependencies.push({
        type: 'blocked-by',
        from: issue.number,
        to: issueNumber,
        source: 'parsed',
      });
    }

    // Parse sub-issue dependencies
    const subIssues = this.parsePatterns(text, SUB_ISSUE_PATTERNS, 'sub-issue');
    for (const issueNumber of subIssues) {
      dependencies.push({
        type: 'sub-issue',
        from: issue.number,
        to: issueNumber,
        source: 'parsed',
      });
    }

    // Parse task list dependencies (treat as sub-issues)
    const taskListIssues = this.parseTaskList(text);
    for (const issueNumber of taskListIssues) {
      // Check if not already added
      const exists = dependencies.some(
        (d) => d.type === 'sub-issue' && d.to === issueNumber
      );
      if (!exists) {
        dependencies.push({
          type: 'sub-issue',
          from: issueNumber,
          to: issue.number,
          source: 'parsed',
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse issue numbers using a set of patterns
   */
  private parsePatterns(
    text: string,
    patterns: DependencyPattern[],
    type: 'sub-issue' | 'blocked-by'
  ): Set<number> {
    const issueNumbers = new Set<number>();

    for (const { pattern } of patterns) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const issueNumber = parseInt(match[1], 10);
        if (!isNaN(issueNumber)) {
          issueNumbers.add(issueNumber);
        }
      }
    }

    return issueNumbers;
  }

  /**
   * Parse issue references in task lists
   */
  private parseTaskList(text: string): Set<number> {
    const issueNumbers = new Set<number>();

    // Reset regex state
    TASK_LIST_PATTERN.lastIndex = 0;

    let match;
    while ((match = TASK_LIST_PATTERN.exec(text)) !== null) {
      const issueNumber = parseInt(match[1], 10);
      if (!isNaN(issueNumber)) {
        issueNumbers.add(issueNumber);
      }
    }

    return issueNumbers;
  }

  /**
   * Parse dependencies from multiple issues
   */
  parseAllDependencies(issues: Issue[]): Dependency[] {
    const allDependencies: Dependency[] = [];

    for (const issue of issues) {
      const deps = this.parseDependencies(issue);
      allDependencies.push(...deps);
    }

    return allDependencies;
  }

  /**
   * Validate that dependency targets exist in the issue list
   */
  validateDependencies(dependencies: Dependency[], issueNumbers: Set<number>): Dependency[] {
    return dependencies.filter((dep) => {
      const fromExists = issueNumbers.has(dep.from);
      const toExists = issueNumbers.has(dep.to);
      return fromExists && toExists;
    });
  }
}

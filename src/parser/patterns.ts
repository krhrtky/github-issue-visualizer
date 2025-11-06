/**
 * Regex patterns for parsing issue dependencies from text
 */

export interface DependencyPattern {
  pattern: RegExp;
  type: 'sub-issue' | 'blocked-by';
}

/**
 * Patterns for detecting "blocked-by" relationships
 * These indicate issues that must be completed before the current issue can start
 */
export const BLOCKED_BY_PATTERNS: DependencyPattern[] = [
  { pattern: /blocked\s+by\s+#(\d+)/gi, type: 'blocked-by' },
  { pattern: /blocks?:\s*#(\d+)/gi, type: 'blocked-by' },
  { pattern: /depends?\s+on\s+#(\d+)/gi, type: 'blocked-by' },
  { pattern: /dependency:\s*#(\d+)/gi, type: 'blocked-by' },
  { pattern: /requires?\s+#(\d+)/gi, type: 'blocked-by' },
  { pattern: /needs?\s+#(\d+)/gi, type: 'blocked-by' },
  { pattern: /waiting\s+(?:on|for)\s+#(\d+)/gi, type: 'blocked-by' },
  { pattern: /prerequisite:\s*#(\d+)/gi, type: 'blocked-by' },
];

/**
 * Patterns for detecting "sub-issue" relationships
 * These indicate issues that are part of completing a larger issue
 */
export const SUB_ISSUE_PATTERNS: DependencyPattern[] = [
  { pattern: /sub-?issue\s+of\s+#(\d+)/gi, type: 'sub-issue' },
  { pattern: /parent\s+issue:\s*#(\d+)/gi, type: 'sub-issue' },
  { pattern: /part\s+of\s+#(\d+)/gi, type: 'sub-issue' },
  { pattern: /child\s+of\s+#(\d+)/gi, type: 'sub-issue' },
  { pattern: /contributes?\s+to\s+#(\d+)/gi, type: 'sub-issue' },
];

/**
 * Pattern for detecting issue references in task lists
 * Example: "- [ ] Implement feature #123"
 */
export const TASK_LIST_PATTERN = /^[\s-]*\[[ x]\]\s+.*?#(\d+)/gim;

/**
 * Pattern for detecting simple issue references
 * This is more generic and should be used carefully
 */
export const ISSUE_REFERENCE_PATTERN = /#(\d+)/g;

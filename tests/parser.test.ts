/**
 * Tests for DependencyParser
 */

import { DependencyParser } from '../src/parser/dependency-parser';
import { Issue } from '../src/api/types';

describe('DependencyParser', () => {
  let parser: DependencyParser;

  beforeEach(() => {
    parser = new DependencyParser();
  });

  const createTestIssue = (number: number, body: string): Issue => ({
    id: `issue-${number}`,
    number,
    title: `Test Issue ${number}`,
    state: 'open',
    url: `https://github.com/test/repo/issues/${number}`,
    body,
    assignees: [],
    labels: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  describe('parseDependencies', () => {
    it('should parse blocked-by dependencies', () => {
      const issue = createTestIssue(1, 'This is blocked by #2');
      const deps = parser.parseDependencies(issue);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toEqual({
        type: 'blocked-by',
        from: 1,
        to: 2,
        source: 'parsed',
      });
    });

    it('should parse depends-on dependencies', () => {
      const issue = createTestIssue(1, 'This depends on #3');
      const deps = parser.parseDependencies(issue);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toEqual({
        type: 'blocked-by',
        from: 1,
        to: 3,
        source: 'parsed',
      });
    });

    it('should parse sub-issue dependencies', () => {
      const issue = createTestIssue(1, 'This is a sub-issue of #4');
      const deps = parser.parseDependencies(issue);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toEqual({
        type: 'sub-issue',
        from: 1,
        to: 4,
        source: 'parsed',
      });
    });

    it('should parse task list dependencies', () => {
      const issue = createTestIssue(1, '- [ ] Complete #5\n- [x] Done #6');
      const deps = parser.parseDependencies(issue);

      expect(deps).toHaveLength(2);
      expect(deps.some((d) => d.to === 1 && d.from === 5)).toBe(true);
      expect(deps.some((d) => d.to === 1 && d.from === 6)).toBe(true);
    });

    it('should handle multiple dependencies', () => {
      const issue = createTestIssue(
        1,
        'Blocked by #2 and #3. Depends on #4. Sub-issue of #5'
      );
      const deps = parser.parseDependencies(issue);

      expect(deps.length).toBeGreaterThan(2);
    });

    it('should handle empty body', () => {
      const issue = createTestIssue(1, '');
      const deps = parser.parseDependencies(issue);

      expect(deps).toHaveLength(0);
    });

    it('should not parse duplicate dependencies', () => {
      const issue = createTestIssue(1, 'Blocked by #2. Also blocked by #2');
      const deps = parser.parseDependencies(issue);

      const blocked2 = deps.filter((d) => d.to === 2);
      expect(blocked2).toHaveLength(1);
    });
  });

  describe('validateDependencies', () => {
    it('should filter out dependencies with non-existent issues', () => {
      const deps = [
        { type: 'blocked-by' as const, from: 1, to: 2, source: 'parsed' as const },
        { type: 'blocked-by' as const, from: 1, to: 999, source: 'parsed' as const },
      ];

      const issueNumbers = new Set([1, 2, 3]);
      const validDeps = parser.validateDependencies(deps, issueNumbers);

      expect(validDeps).toHaveLength(1);
      expect(validDeps[0].to).toBe(2);
    });
  });
});

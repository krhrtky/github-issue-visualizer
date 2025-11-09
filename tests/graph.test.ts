/**
 * Tests for Graph builder and analyzer
 */

import { GraphBuilder } from '../src/graph/builder';
import { GraphAnalyzer } from '../src/graph/analyzer';
import { Issue, Dependency } from '../src/api/types';

describe('Graph', () => {
  const createTestIssue = (number: number): Issue => ({
    id: `issue-${number}`,
    number,
    title: `Test Issue ${number}`,
    state: 'open',
    url: `https://github.com/test/repo/issues/${number}`,
    body: '',
    assignees: [],
    labels: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  describe('GraphBuilder', () => {
    let builder: GraphBuilder;

    beforeEach(() => {
      builder = new GraphBuilder();
    });

    it('should build graph with blocked-by dependencies', () => {
      const issues = [createTestIssue(1), createTestIssue(2)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 1, to: 2, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges).toHaveLength(1);

      const node1 = graph.nodes.get(1)!;
      expect(node1.blockedBy).toContain(2);

      const node2 = graph.nodes.get(2)!;
      expect(node2.blocking).toContain(1);
    });

    it('should build graph with sub-issue dependencies', () => {
      const issues = [createTestIssue(1), createTestIssue(2)];
      const deps: Dependency[] = [
        { type: 'sub-issue', from: 1, to: 2, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);

      const node1 = graph.nodes.get(1)!;
      expect(node1.parentIssue).toBe(2);

      const node2 = graph.nodes.get(2)!;
      expect(node2.subIssues).toContain(1);
    });

    it('should merge duplicate dependencies', () => {
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 1, to: 2, source: 'parsed' },
        { type: 'blocked-by', from: 1, to: 2, source: 'api' },
      ];

      const merged = builder.mergeDependencies(deps);

      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('api'); // API source preferred
    });

    it('should filter by labels', () => {
      const issues = [
        { ...createTestIssue(1), labels: [{ name: 'bug' }] },
        { ...createTestIssue(2), labels: [{ name: 'feature' }] },
      ];
      const deps: Dependency[] = [];

      const graph = builder.buildGraph(issues, deps);
      const filtered = builder.filterByLabels(graph, ['bug']);

      expect(filtered.nodes.size).toBe(1);
      expect(filtered.nodes.has(1)).toBe(true);
    });

    it('should extract dependencies from native API data (trackedIssues)', () => {
      const issues = [
        { ...createTestIssue(1), trackedIssues: [2, 3] },
        createTestIssue(2),
        createTestIssue(3),
      ];

      const deps = builder.extractNativeApiDependencies(issues);

      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual({
        type: 'sub-issue',
        from: 1,
        to: 2,
        source: 'api',
      });
      expect(deps).toContainEqual({
        type: 'sub-issue',
        from: 1,
        to: 3,
        source: 'api',
      });
    });

    it('should extract dependencies from native API data (trackedInIssues)', () => {
      const issues = [
        createTestIssue(1),
        { ...createTestIssue(2), trackedInIssues: [1, 3] },
        createTestIssue(3),
      ];

      const deps = builder.extractNativeApiDependencies(issues);

      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual({
        type: 'sub-issue',
        from: 1,
        to: 2,
        source: 'api',
      });
      expect(deps).toContainEqual({
        type: 'sub-issue',
        from: 3,
        to: 2,
        source: 'api',
      });
    });

    it('should handle empty native API data', () => {
      const issues = [
        createTestIssue(1),
        createTestIssue(2),
      ];

      const deps = builder.extractNativeApiDependencies(issues);

      expect(deps).toHaveLength(0);
    });

    it('should extract dependencies from native API data (blockedByIssues)', () => {
      const issues = [
        { ...createTestIssue(1), blockedByIssues: [2, 3] },
        createTestIssue(2),
        createTestIssue(3),
      ];

      const deps = builder.extractNativeApiDependencies(issues);

      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual({
        type: 'blocked-by',
        from: 1,
        to: 2,
        source: 'api',
      });
      expect(deps).toContainEqual({
        type: 'blocked-by',
        from: 1,
        to: 3,
        source: 'api',
      });
    });

    it('should extract dependencies from native API data (blockingIssues)', () => {
      const issues = [
        createTestIssue(1),
        { ...createTestIssue(2), blockingIssues: [1, 3] },
        createTestIssue(3),
      ];

      const deps = builder.extractNativeApiDependencies(issues);

      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual({
        type: 'blocked-by',
        from: 1,
        to: 2,
        source: 'api',
      });
      expect(deps).toContainEqual({
        type: 'blocked-by',
        from: 3,
        to: 2,
        source: 'api',
      });
    });
  });

  describe('GraphAnalyzer', () => {
    let builder: GraphBuilder;
    let analyzer: GraphAnalyzer;

    beforeEach(() => {
      builder = new GraphBuilder();
      analyzer = new GraphAnalyzer();
    });

    it('should calculate depths correctly', () => {
      const issues = [createTestIssue(1), createTestIssue(2), createTestIssue(3)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
        { type: 'blocked-by', from: 3, to: 2, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);
      analyzer.analyze(graph);

      expect(graph.nodes.get(1)!.depth).toBe(0);
      expect(graph.nodes.get(2)!.depth).toBe(1);
      expect(graph.nodes.get(3)!.depth).toBe(2);
    });

    it('should find critical path', () => {
      const issues = [
        createTestIssue(1),
        createTestIssue(2),
        createTestIssue(3),
        createTestIssue(4),
      ];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
        { type: 'blocked-by', from: 3, to: 2, source: 'parsed' },
        { type: 'blocked-by', from: 4, to: 1, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);
      analyzer.analyze(graph);

      expect(graph.criticalPath).toEqual([1, 2, 3]);
      expect(graph.metrics.criticalPathLength).toBe(3);
    });

    it('should calculate criticality scores', () => {
      const issues = [createTestIssue(1), createTestIssue(2), createTestIssue(3)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
        { type: 'blocked-by', from: 3, to: 1, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);
      analyzer.analyze(graph);

      // Issue 1 blocks 2 issues
      expect(graph.nodes.get(1)!.criticalityScore).toBe(2);
    });

    it('should detect cycles', () => {
      const issues = [createTestIssue(1), createTestIssue(2)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 1, to: 2, source: 'parsed' },
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);

      expect(() => analyzer.analyze(graph)).toThrow('Circular dependency');
    });

    it('should get leaf nodes', () => {
      const issues = [createTestIssue(1), createTestIssue(2), createTestIssue(3)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);
      const leafNodes = analyzer.getLeafNodes(graph);

      expect(leafNodes).toContain(1);
      expect(leafNodes).toContain(3);
      expect(leafNodes).not.toContain(2);
    });

    it('should get root nodes', () => {
      const issues = [createTestIssue(1), createTestIssue(2), createTestIssue(3)];
      const deps: Dependency[] = [
        { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
      ];

      const graph = builder.buildGraph(issues, deps);
      const rootNodes = analyzer.getRootNodes(graph);

      expect(rootNodes).toContain(2);
      expect(rootNodes).toContain(3);
      expect(rootNodes).not.toContain(1);
    });
  });
});

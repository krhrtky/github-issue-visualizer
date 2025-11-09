/**
 * Tests for visualizers
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { MermaidGenerator } from '../src/visualizer/mermaid';
import { InteractiveGenerator } from '../src/visualizer/interactive';
import { GraphBuilder } from '../src/graph/builder';
import { GraphAnalyzer } from '../src/graph/analyzer';
import { Issue, Dependency } from '../src/api/types';

describe('Visualizers', () => {
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

  const createTestGraph = () => {
    const builder = new GraphBuilder();
    const analyzer = new GraphAnalyzer();

    const issues = [createTestIssue(1), createTestIssue(2), createTestIssue(3)];
    const deps: Dependency[] = [
      { type: 'blocked-by', from: 2, to: 1, source: 'parsed' },
      { type: 'blocked-by', from: 3, to: 2, source: 'parsed' },
    ];

    const graph = builder.buildGraph(issues, deps);
    return analyzer.analyze(graph);
  };

  describe('MermaidGenerator', () => {
    let generator: MermaidGenerator;

    beforeEach(() => {
      generator = new MermaidGenerator();
    });

    it('should generate mermaid diagram', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('```mermaid');
      expect(output).toContain('graph LR');
      expect(output).toContain('```');
    });

    it('should include nodes and edges', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('N1');
      expect(output).toContain('N2');
      expect(output).toContain('N3');
      expect(output).toContain('-->');
    });

    it('should generate metrics summary', () => {
      const graph = createTestGraph();
      const output = generator.generateMetricsSummary(graph);

      expect(output).toContain('Dependency Graph Metrics');
      expect(output).toContain('Total Issues');
      expect(output).toContain('Total Dependencies');
    });

    it('should include clickable links to issues', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('click N1 "https://github.com/test/repo/issues/1"');
      expect(output).toContain('click N2 "https://github.com/test/repo/issues/2"');
      expect(output).toContain('click N3 "https://github.com/test/repo/issues/3"');
      expect(output).toContain('View issue on GitHub');
    });
  });

  describe('InteractiveGenerator', () => {
    let generator: InteractiveGenerator;

    beforeEach(() => {
      generator = new InteractiveGenerator();
    });

    it('should generate HTML visualization', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('cytoscape');
      expect(output).toContain('</html>');
    });

    it('should include graph data', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('Test Issue 1');
      expect(output).toContain('Test Issue 2');
      expect(output).toContain('Test Issue 3');
    });

    it('should include metrics', () => {
      const graph = createTestGraph();
      const output = generator.generate(graph);

      expect(output).toContain('Total Issues');
      expect(output).toContain('Dependencies');
    });
  });
});

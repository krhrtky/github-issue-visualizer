/**
 * Main library entry point
 */

import { GitHubClient, parseRepositoryString } from './api/github-client';
import { DependencyParser } from './parser/dependency-parser';
import { GraphBuilder } from './graph/builder';
import { GraphAnalyzer } from './graph/analyzer';
import { MermaidGenerator } from './visualizer/mermaid';
import { InteractiveGenerator } from './visualizer/interactive';
import { DependencyGraph, VisualizationOptions, RepositoryInfo } from './api/types';

export * from './api/types';
export { GitHubClient, parseRepositoryString } from './api/github-client';
export { DependencyParser } from './parser/dependency-parser';
export { GraphBuilder } from './graph/builder';
export { GraphAnalyzer } from './graph/analyzer';
export { MermaidGenerator } from './visualizer/mermaid';
export { InteractiveGenerator } from './visualizer/interactive';

/**
 * Main orchestrator for generating issue dependency visualizations
 */
export class IssueDependencyVisualizer {
  private client: GitHubClient;
  private parser: DependencyParser;
  private builder: GraphBuilder;
  private analyzer: GraphAnalyzer;
  private mermaidGenerator: MermaidGenerator;
  private interactiveGenerator: InteractiveGenerator;

  constructor(githubToken: string) {
    this.client = new GitHubClient(githubToken);
    this.parser = new DependencyParser();
    this.builder = new GraphBuilder();
    this.analyzer = new GraphAnalyzer();
    this.mermaidGenerator = new MermaidGenerator();
    this.interactiveGenerator = new InteractiveGenerator();
  }

  /**
   * Generate a dependency graph for a repository
   */
  async generateGraph(
    repository: string | RepositoryInfo,
    options?: Partial<VisualizationOptions>
  ): Promise<DependencyGraph> {
    // Parse repository info
    const repoInfo =
      typeof repository === 'string' ? parseRepositoryString(repository) : repository;

    // Validate repository access
    const hasAccess = await this.client.validateRepository(repoInfo);
    if (!hasAccess) {
      throw new Error(
        `Cannot access repository ${repoInfo.owner}/${repoInfo.repo}. Check your token permissions.`
      );
    }

    // Fetch issues
    console.log(`Fetching issues from ${repoInfo.owner}/${repoInfo.repo}...`);
    const issues = await this.client.fetchOpenIssues(repoInfo, options?.filters);

    // Log filtered results
    if (options?.filters) {
      const filterInfo: string[] = [];
      if (options.filters.state) filterInfo.push(`state: ${options.filters.state}`);
      if (options.filters.labels?.length) filterInfo.push(`labels: ${options.filters.labels.join(', ')}`);
      if (options.filters.assignees?.length) filterInfo.push(`assignees: ${options.filters.assignees.join(', ')}`);
      if (options.filters.searchText) filterInfo.push(`search: "${options.filters.searchText}"`);
      if (filterInfo.length > 0) {
        console.log(`Filters applied: ${filterInfo.join(', ')}`);
      }
    }
    console.log(`Found ${issues.length} issues`);

    // Parse dependencies
    console.log('Parsing dependencies...');
    const parsedDeps = this.parser.parseAllDependencies(issues);
    console.log(`Found ${parsedDeps.length} dependencies`);

    // Merge and deduplicate dependencies
    const allDeps = this.builder.mergeDependencies(parsedDeps);

    // Validate dependencies
    const issueNumbers = new Set(issues.map((i) => i.number));
    const validDeps = this.parser.validateDependencies(allDeps, issueNumbers);

    // Build graph
    console.log('Building dependency graph...');
    let graph = this.builder.buildGraph(issues, validDeps);

    // Apply filters
    if (options?.filterLabels && options.filterLabels.length > 0) {
      graph = this.builder.filterByLabels(graph, options.filterLabels);
    }

    if (options?.filterAssignees && options.filterAssignees.length > 0) {
      graph = this.builder.filterByAssignees(graph, options.filterAssignees);
    }

    // Analyze graph
    console.log('Analyzing graph...');
    try {
      graph = this.analyzer.analyze(graph);
      console.log(`Critical path length: ${graph.metrics.criticalPathLength}`);
    } catch (error: any) {
      if (error.cycle) {
        throw new Error(`Circular dependency detected: ${error.message}`);
      }
      throw error;
    }

    return graph;
  }

  /**
   * Generate visualization output
   */
  generateVisualization(
    graph: DependencyGraph,
    format: 'mermaid' | 'interactive' = 'mermaid',
    highlightCriticalPath: boolean = true
  ): string {
    if (format === 'mermaid') {
      return this.mermaidGenerator.generate(graph, highlightCriticalPath);
    } else {
      return this.interactiveGenerator.generate(graph, highlightCriticalPath);
    }
  }

  /**
   * Generate metrics summary
   */
  generateMetricsSummary(graph: DependencyGraph): string {
    return this.mermaidGenerator.generateMetricsSummary(graph);
  }

  /**
   * Generate critical path visualization
   */
  generateCriticalPathVisualization(graph: DependencyGraph): string {
    return this.mermaidGenerator.generateCriticalPathOnly(graph);
  }
}

/**
 * Quick helper function to visualize a repository
 */
export async function visualizeRepository(
  repository: string,
  githubToken: string,
  options?: Partial<VisualizationOptions>
): Promise<{ graph: DependencyGraph; visualization: string; metrics: string }> {
  const visualizer = new IssueDependencyVisualizer(githubToken);

  const graph = await visualizer.generateGraph(repository, options);
  const format = options?.format || 'mermaid';
  const visualization = visualizer.generateVisualization(
    graph,
    format,
    options?.highlightCriticalPath ?? true
  );
  const metrics = visualizer.generateMetricsSummary(graph);

  return { graph, visualization, metrics };
}

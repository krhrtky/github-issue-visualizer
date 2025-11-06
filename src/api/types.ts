/**
 * Core type definitions for GitHub issues and dependencies
 */

export interface Issue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  body: string;
  assignees: Array<{ login: string }>;
  labels: Array<{ name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  type: 'sub-issue' | 'blocked-by';
  from: number; // issue number
  to: number; // issue number
  source: 'api' | 'parsed';
}

export interface IssueNode extends Issue {
  subIssues: number[]; // Issues needed to complete this
  blockedBy: number[]; // Issues blocking this from starting
  blocking: number[]; // Issues this is blocking
  parentIssue?: number; // If this is a sub-issue

  // Metrics
  depth: number; // Distance from leaf node
  criticalityScore: number; // How many issues depend on this
  onCriticalPath: boolean;
}

export interface DependencyGraph {
  nodes: Map<number, IssueNode>;
  edges: Dependency[];
  criticalPath: number[];
  metrics: {
    totalIssues: number;
    totalDependencies: number;
    criticalPathLength: number;
    bottlenecks: number[]; // Issues with most dependents
  };
}

export interface IssueFilterOptions {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignees?: string[];
  searchText?: string;
  createdSince?: string; // ISO 8601 date string
  createdUntil?: string; // ISO 8601 date string
  updatedSince?: string; // ISO 8601 date string
  updatedUntil?: string; // ISO 8601 date string
}

export interface VisualizationOptions {
  format: 'mermaid' | 'interactive';
  highlightCriticalPath: boolean;
  filterLabels?: string[];
  filterAssignees?: string[];
  outputPath?: string;
  // New filter options
  filters?: IssueFilterOptions;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

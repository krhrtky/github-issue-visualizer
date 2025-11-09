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
  trackedIssues?: number[];
  trackedInIssues?: number[];
  blockedByIssues?: number[];
  blockingIssues?: number[];
}

export interface Dependency {
  type: 'sub-issue' | 'blocked-by';
  from: number; // issue number
  to: number; // issue number
  source: 'api' | 'parsed';
}

export interface IssueNode extends Issue {
  subIssues: number[];
  blockedBy: number[];
  blocking: number[];
  parentIssue?: number;
}

export interface DependencyGraph {
  nodes: Map<number, IssueNode>;
  edges: Dependency[];
  metrics: {
    totalIssues: number;
    totalDependencies: number;
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
  filterLabels?: string[];
  filterAssignees?: string[];
  outputPath?: string;
  filters?: IssueFilterOptions;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

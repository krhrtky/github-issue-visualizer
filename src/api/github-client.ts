/**
 * GitHub API client for fetching issues and dependencies
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { Issue, RepositoryInfo, IssueFilterOptions } from './types';

export class GitHubClient {
  private octokit: Octokit;
  private graphqlWithAuth: typeof graphql;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
  }

  /**
   * Fetch issues from a repository using GraphQL with optional filters
   */
  async fetchOpenIssues(
    repoInfo: RepositoryInfo,
    filters?: IssueFilterOptions
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    // Determine states to fetch based on filter
    const states = this.getStatesForQuery(filters?.state);

    // Build labels filter for GraphQL
    const labelsFilter = filters?.labels && filters.labels.length > 0
      ? filters.labels
      : undefined;

    while (hasNextPage) {
      const query = this.buildGraphQLQuery(labelsFilter);

      try {
        const variables: any = {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          cursor,
          states,
        };

        if (labelsFilter) {
          variables.labels = labelsFilter;
        }

        const response: any = await this.graphqlWithAuth(query, variables);

        const issueNodes = response.repository.issues.nodes;
        const pageInfo = response.repository.issues.pageInfo;

        for (const node of issueNodes) {
          const issue: Issue = {
            id: node.id,
            number: node.number,
            title: node.title,
            state: node.state.toLowerCase() as 'open' | 'closed',
            url: node.url,
            body: node.body || '',
            assignees: node.assignees.nodes || [],
            labels: node.labels.nodes || [],
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
          };

          // Apply post-fetch filters
          if (this.matchesFilters(issue, filters)) {
            issues.push(issue);
          }
        }

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      } catch (error) {
        // Fallback to REST API if GraphQL fails
        console.warn('GraphQL query failed, falling back to REST API:', error);
        return this.fetchOpenIssuesREST(repoInfo, filters);
      }
    }

    return issues;
  }

  /**
   * Build GraphQL query dynamically based on filters
   */
  private buildGraphQLQuery(labels?: string[]): string {
    const labelsParam = labels ? ', $labels: [String!]' : '';
    const labelsFilter = labels ? ', labels: $labels' : '';

    return `
      query GetIssues($owner: String!, $repo: String!, $cursor: String, $states: [IssueState!]${labelsParam}) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, states: $states${labelsFilter}, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              number
              title
              state
              url
              body
              createdAt
              updatedAt
              assignees(first: 10) {
                nodes {
                  login
                }
              }
              labels(first: 20) {
                nodes {
                  name
                }
              }
              trackedInIssues(first: 50) {
                nodes {
                  number
                }
              }
              trackedIssues(first: 50) {
                nodes {
                  number
                }
              }
            }
          }
        }
      }
    `;
  }

  /**
   * Get states array for GraphQL query
   */
  private getStatesForQuery(state?: 'open' | 'closed' | 'all'): string[] {
    if (!state || state === 'open') {
      return ['OPEN'];
    } else if (state === 'closed') {
      return ['CLOSED'];
    } else {
      return ['OPEN', 'CLOSED'];
    }
  }

  /**
   * Check if issue matches post-fetch filters
   */
  private matchesFilters(issue: Issue, filters?: IssueFilterOptions): boolean {
    if (!filters) {
      return true;
    }

    // Filter by assignees
    if (filters.assignees && filters.assignees.length > 0) {
      const issueAssignees = issue.assignees.map(a => a.login);
      const hasMatchingAssignee = filters.assignees.some(assignee =>
        issueAssignees.includes(assignee)
      );
      if (!hasMatchingAssignee) {
        return false;
      }
    }

    // Filter by search text (title or body)
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const titleMatch = issue.title.toLowerCase().includes(searchLower);
      const bodyMatch = issue.body.toLowerCase().includes(searchLower);
      if (!titleMatch && !bodyMatch) {
        return false;
      }
    }

    // Filter by title query (title only)
    if (filters.titleQuery) {
      const titleLower = filters.titleQuery.toLowerCase();
      if (!issue.title.toLowerCase().includes(titleLower)) {
        return false;
      }
    }

    // Filter by created date
    if (filters.createdSince) {
      const createdDate = new Date(issue.createdAt);
      const sinceDate = new Date(filters.createdSince);
      if (createdDate < sinceDate) {
        return false;
      }
    }

    if (filters.createdUntil) {
      const createdDate = new Date(issue.createdAt);
      const untilDate = new Date(filters.createdUntil);
      if (createdDate > untilDate) {
        return false;
      }
    }

    // Filter by updated date
    if (filters.updatedSince) {
      const updatedDate = new Date(issue.updatedAt);
      const sinceDate = new Date(filters.updatedSince);
      if (updatedDate < sinceDate) {
        return false;
      }
    }

    if (filters.updatedUntil) {
      const updatedDate = new Date(issue.updatedAt);
      const untilDate = new Date(filters.updatedUntil);
      if (updatedDate > untilDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Fallback method using REST API
   */
  private async fetchOpenIssuesREST(
    repoInfo: RepositoryInfo,
    filters?: IssueFilterOptions
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    let page = 1;
    const perPage = 100;

    // Determine state for REST API
    const state = filters?.state === 'all' ? 'all' : (filters?.state || 'open');

    while (true) {
      const response = await this.octokit.issues.listForRepo({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        state: state as 'open' | 'closed' | 'all',
        per_page: perPage,
        page,
        labels: filters?.labels?.join(','),
      });

      if (response.data.length === 0) {
        break;
      }

      for (const issue of response.data) {
        // Skip pull requests
        if (issue.pull_request) {
          continue;
        }

        const issueData: Issue = {
          id: issue.node_id,
          number: issue.number,
          title: issue.title,
          state: issue.state as 'open' | 'closed',
          url: issue.html_url,
          body: issue.body || '',
          assignees: issue.assignees?.map((a) => ({ login: a.login })) || [],
          labels: issue.labels.map((l) => ({ name: typeof l === 'string' ? l : l.name || '' })),
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        };

        // Apply post-fetch filters
        if (this.matchesFilters(issueData, filters)) {
          issues.push(issueData);
        }
      }

      if (response.data.length < perPage) {
        break;
      }

      page++;
    }

    return issues;
  }

  /**
   * Validate repository access
   */
  async validateRepository(repoInfo: RepositoryInfo): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Parse repository string into owner and repo
 */
export function parseRepositoryString(repoString: string): RepositoryInfo {
  const parts = repoString.split('/');
  if (parts.length !== 2) {
    throw new Error('Invalid repository format. Expected: owner/repo');
  }
  return {
    owner: parts[0],
    repo: parts[1],
  };
}

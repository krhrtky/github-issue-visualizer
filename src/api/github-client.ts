/**
 * GitHub API client for fetching issues and dependencies
 */

import { Octokit } from '@octokit/rest';
import { Issue, RepositoryInfo, IssueFilterOptions } from './types';
// GraphQL support planned for future implementation
// import { graphql } from '@octokit/graphql';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    // Note: GraphQL support planned for future implementation
    // private graphqlWithAuth: typeof graphql;
    // this.graphqlWithAuth = graphql.defaults({
    //   headers: {
    //     authorization: `token ${token}`,
    //     'GraphQL-Features': 'sub_issues',
    //   },
    // });
  }

  /**
   * Fetch issues from a repository using REST API with optional filters
   * Note: GraphQL support is planned for future implementation
   */
  async fetchOpenIssues(
    repoInfo: RepositoryInfo,
    filters?: IssueFilterOptions
  ): Promise<Issue[]> {
    return this.fetchOpenIssuesREST(repoInfo, filters);
  }

  // GraphQL methods removed - REST API is now the primary method
  // Future: Re-implement GraphQL support for better performance

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
   * Fetch sub-issues for a given issue using REST API
   */
  private async fetchSubIssues(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<number[]> {
    try {
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
        {
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
        }
      );
      return response.data.map((issue: any) => issue.number);
    } catch (error) {
      // Sub-issues not available or not enabled
      return [];
    }
  }

  /**
   * Fetch parent issue for a given sub-issue using REST API
   */
  private async fetchParentIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<number | undefined> {
    try {
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/parent',
        {
          owner,
          repo,
          issue_number: issueNumber,
        }
      );
      return response.data.number;
    } catch (error) {
      // No parent issue
      return undefined;
    }
  }

  /**
   * Fetch blocked-by dependencies for a given issue using REST API
   */
  private async fetchBlockedByIssues(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<number[]> {
    try {
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by',
        {
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
        }
      );
      return response.data.map((issue: any) => issue.number);
    } catch (error) {
      // Dependencies not available or not enabled
      return [];
    }
  }

  /**
   * Fetch blocking dependencies for a given issue using REST API
   */
  private async fetchBlockingIssues(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<number[]> {
    try {
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking',
        {
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
        }
      );
      return response.data.map((issue: any) => issue.number);
    } catch (error) {
      // Dependencies not available or not enabled
      return [];
    }
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

    // Fetch relationships for all issues
    console.log('Fetching sub-issues and dependencies from REST API...');
    await Promise.all(
      issues.map(async (issue) => {
        const [subIssues, parentIssue, blockedBy, blocking] = await Promise.all([
          this.fetchSubIssues(repoInfo.owner, repoInfo.repo, issue.number),
          this.fetchParentIssue(repoInfo.owner, repoInfo.repo, issue.number),
          this.fetchBlockedByIssues(repoInfo.owner, repoInfo.repo, issue.number),
          this.fetchBlockingIssues(repoInfo.owner, repoInfo.repo, issue.number),
        ]);

        issue.trackedInIssues = subIssues;
        if (parentIssue) {
          issue.trackedIssues = [parentIssue];
        }
        issue.blockedByIssues = blockedBy;
        issue.blockingIssues = blocking;
      })
    );

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

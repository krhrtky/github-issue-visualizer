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
    let issues: Issue[];

    if (filters?.query) {
      issues = await this.searchIssues(repoInfo, filters);
    } else {
      issues = await this.fetchOpenIssuesREST(repoInfo, filters);
    }

    // If recursive fetching is enabled, fetch all dependency issues
    if (filters?.recursive) {
      issues = await this.fetchIssuesRecursively(repoInfo, issues, filters);
    }

    return issues;
  }

  /**
   * Build GitHub Search query from filters
   */
  private buildSearchQuery(
    repoInfo: RepositoryInfo,
    filters: IssueFilterOptions
  ): string {
    const parts: string[] = [`repo:${repoInfo.owner}/${repoInfo.repo}`, 'is:issue'];

    if (filters.query) {
      parts.push(filters.query);
    }

    if (filters.state && filters.state !== 'all') {
      parts.push(`is:${filters.state}`);
    }

    if (filters.labels && filters.labels.length > 0) {
      filters.labels.forEach(label => parts.push(`label:"${label}"`));
    }

    if (filters.assignees && filters.assignees.length > 0) {
      filters.assignees.forEach(assignee => parts.push(`assignee:${assignee}`));
    }

    if (filters.searchText) {
      parts.push(`"${filters.searchText}"`);
    }

    if (filters.createdSince) {
      parts.push(`created:>=${filters.createdSince}`);
    }

    if (filters.createdUntil) {
      parts.push(`created:<=${filters.createdUntil}`);
    }

    if (filters.updatedSince) {
      parts.push(`updated:>=${filters.updatedSince}`);
    }

    if (filters.updatedUntil) {
      parts.push(`updated:<=${filters.updatedUntil}`);
    }

    return parts.join(' ');
  }

  /**
   * Search issues using GitHub Search API
   */
  private async searchIssues(
    repoInfo: RepositoryInfo,
    filters: IssueFilterOptions
  ): Promise<Issue[]> {
    const query = this.buildSearchQuery(repoInfo, filters);
    const issues: Issue[] = [];
    let page = 1;
    const perPage = 100;

    console.log(`Searching issues with query: ${query}`);

    let hasMoreResults = true;
    while (hasMoreResults) {
      const response = await this.octokit.search.issuesAndPullRequests({
        q: query,
        per_page: perPage,
        page,
      });

      if (response.data.items.length === 0) {
        hasMoreResults = false;
        break;
      }

      for (const item of response.data.items) {
        if (item.pull_request) {
          continue;
        }

        const issue: Issue = {
          id: item.node_id,
          number: item.number,
          title: item.title,
          state: item.state as 'open' | 'closed',
          url: item.html_url,
          body: item.body || '',
          assignees: item.assignees?.map((a) => ({ login: a.login })) || [],
          labels: item.labels.map((l) => ({ name: typeof l === 'string' ? l : l.name || '' })),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };

        issues.push(issue);
      }

      if (response.data.items.length < perPage) {
        hasMoreResults = false;
      }

      page++;
    }

    console.log(`Fetching sub-issues and dependencies from REST API...`);
    await this.fetchDependenciesForIssues(repoInfo, issues);

    return issues;
  }

  /**
   * Fetch dependencies for a list of issues
   */
  private async fetchDependenciesForIssues(
    repoInfo: RepositoryInfo,
    issues: Issue[]
  ): Promise<void> {
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

    let hasMoreResults = true;
    while (hasMoreResults) {
      const response = await this.octokit.issues.listForRepo({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        state: state as 'open' | 'closed' | 'all',
        per_page: perPage,
        page,
        labels: filters?.labels?.join(','),
      });

      if (response.data.length === 0) {
        hasMoreResults = false;
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
        hasMoreResults = false;
      }

      page++;
    }

    console.log('Fetching sub-issues and dependencies from REST API...');
    await this.fetchDependenciesForIssues(repoInfo, issues);

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

  /**
   * Fetch a single issue by its number
   */
  async fetchIssueByNumber(
    repoInfo: RepositoryInfo,
    issueNumber: number
  ): Promise<Issue | null> {
    try {
      const response = await this.octokit.issues.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: issueNumber,
      });

      const issue = response.data;

      // Skip pull requests
      if (issue.pull_request) {
        return null;
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

      // Fetch dependencies for this issue
      const [subIssues, parentIssue, blockedBy, blocking] = await Promise.all([
        this.fetchSubIssues(repoInfo.owner, repoInfo.repo, issueNumber),
        this.fetchParentIssue(repoInfo.owner, repoInfo.repo, issueNumber),
        this.fetchBlockedByIssues(repoInfo.owner, repoInfo.repo, issueNumber),
        this.fetchBlockingIssues(repoInfo.owner, repoInfo.repo, issueNumber),
      ]);

      issueData.trackedInIssues = subIssues;
      if (parentIssue) {
        issueData.trackedIssues = [parentIssue];
      }
      issueData.blockedByIssues = blockedBy;
      issueData.blockingIssues = blocking;

      return issueData;
    } catch (error) {
      console.warn(`Failed to fetch issue #${issueNumber}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Recursively fetch all issues referenced in dependencies
   * This method ensures that all dependent issues are fetched, even if they don't match the initial filters
   */
  async fetchIssuesRecursively(
    repoInfo: RepositoryInfo,
    initialIssues: Issue[],
    filters?: IssueFilterOptions
  ): Promise<Issue[]> {
    const allIssues = new Map<number, Issue>();
    const processedNumbers = new Set<number>();
    const queue: number[] = [];

    // Add initial issues to the map
    for (const issue of initialIssues) {
      allIssues.set(issue.number, issue);
      processedNumbers.add(issue.number);
    }

    // Collect all dependency issue numbers from initial issues
    const collectDependencies = (issue: Issue): number[] => {
      const deps: number[] = [];
      if (issue.trackedInIssues) deps.push(...issue.trackedInIssues);
      if (issue.trackedIssues) deps.push(...issue.trackedIssues);
      if (issue.blockedByIssues) deps.push(...issue.blockedByIssues);
      if (issue.blockingIssues) deps.push(...issue.blockingIssues);
      return deps;
    };

    // Add initial dependencies to queue
    for (const issue of initialIssues) {
      const deps = collectDependencies(issue);
      for (const depNumber of deps) {
        if (!processedNumbers.has(depNumber)) {
          queue.push(depNumber);
          processedNumbers.add(depNumber);
        }
      }
    }

    console.log(`Starting recursive fetch for ${queue.length} dependency issues...`);
    let fetchedCount = 0;

    // Process queue
    while (queue.length > 0) {
      const issueNumber = queue.shift()!;

      // Skip if already fetched
      if (allIssues.has(issueNumber)) {
        continue;
      }

      // Fetch the issue
      const issue = await this.fetchIssueByNumber(repoInfo, issueNumber);

      if (issue) {
        allIssues.set(issue.number, issue);
        fetchedCount++;

        // Add new dependencies to queue
        const deps = collectDependencies(issue);
        for (const depNumber of deps) {
          if (!processedNumbers.has(depNumber)) {
            queue.push(depNumber);
            processedNumbers.add(depNumber);
          }
        }
      }
    }

    console.log(`Recursively fetched ${fetchedCount} additional issues`);
    console.log(`Total issues: ${allIssues.size}`);

    return Array.from(allIssues.values());
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

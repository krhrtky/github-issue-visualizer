/**
 * GitHub API client for fetching issues and dependencies
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { Issue, RepositoryInfo } from './types';

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
   * Fetch all open issues from a repository using GraphQL
   */
  async fetchOpenIssues(repoInfo: RepositoryInfo): Promise<Issue[]> {
    const issues: Issue[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const query = `
        query GetIssues($owner: String!, $repo: String!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            issues(first: 100, states: OPEN, after: $cursor) {
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

      try {
        const response: any = await this.graphqlWithAuth(query, {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          cursor,
        });

        const issueNodes = response.repository.issues.nodes;
        const pageInfo = response.repository.issues.pageInfo;

        for (const node of issueNodes) {
          issues.push({
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
          });
        }

        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      } catch (error) {
        // Fallback to REST API if GraphQL fails
        console.warn('GraphQL query failed, falling back to REST API:', error);
        return this.fetchOpenIssuesREST(repoInfo);
      }
    }

    return issues;
  }

  /**
   * Fallback method using REST API
   */
  private async fetchOpenIssuesREST(repoInfo: RepositoryInfo): Promise<Issue[]> {
    const issues: Issue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.issues.listForRepo({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        state: 'open',
        per_page: perPage,
        page,
      });

      if (response.data.length === 0) {
        break;
      }

      for (const issue of response.data) {
        // Skip pull requests
        if (issue.pull_request) {
          continue;
        }

        issues.push({
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
        });
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

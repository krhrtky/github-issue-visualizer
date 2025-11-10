/**
 * Tests for GitHubClient API methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient } from '../src/api/github-client';
import { Issue } from '../src/api/types';

// Mock Octokit
vi.mock('@octokit/rest', () => {
  const mockOctokit = {
    repos: {
      get: vi.fn(),
    },
    issues: {
      get: vi.fn(),
      listForRepo: vi.fn(),
    },
    request: vi.fn(),
    search: {
      issuesAndPullRequests: vi.fn(),
    },
  };

  return {
    Octokit: vi.fn(() => mockOctokit),
  };
});

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient('test-token');
    // Get the mocked Octokit instance
    mockOctokit = (client as any).octokit;
  });

  const createTestIssue = (number: number, deps: {
    subIssues?: number[];
    parent?: number;
    blockedBy?: number[];
    blocking?: number[];
  } = {}): Issue => ({
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
    trackedInIssues: deps.subIssues,
    trackedIssues: deps.parent ? [deps.parent] : undefined,
    blockedByIssues: deps.blockedBy,
    blockingIssues: deps.blocking,
  });

  describe('fetchIssueByNumber', () => {
    it('should fetch a single issue with dependencies', async () => {
      const mockIssueData = {
        node_id: 'issue-1',
        number: 1,
        title: 'Test Issue 1',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/1',
        body: 'Test body',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.get.mockResolvedValue({ data: mockIssueData });
      mockOctokit.request.mockResolvedValue({ data: [] });

      const issue = await client.fetchIssueByNumber(
        { owner: 'test', repo: 'repo' },
        1
      );

      expect(issue).not.toBeNull();
      expect(issue?.number).toBe(1);
      expect(issue?.title).toBe('Test Issue 1');
      expect(mockOctokit.issues.get).toHaveBeenCalledWith({
        owner: 'test',
        repo: 'repo',
        issue_number: 1,
      });
    });

    it('should return null for pull requests', async () => {
      const mockPRData = {
        node_id: 'pr-1',
        number: 1,
        title: 'Test PR 1',
        state: 'open',
        html_url: 'https://github.com/test/repo/pull/1',
        body: 'Test body',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        pull_request: {},
      };

      mockOctokit.issues.get.mockResolvedValue({ data: mockPRData });

      const issue = await client.fetchIssueByNumber(
        { owner: 'test', repo: 'repo' },
        1
      );

      expect(issue).toBeNull();
    });

    it('should return null when issue fetch fails', async () => {
      mockOctokit.issues.get.mockRejectedValue(new Error('Not found'));

      const issue = await client.fetchIssueByNumber(
        { owner: 'test', repo: 'repo' },
        999
      );

      expect(issue).toBeNull();
    });
  });

  describe('fetchIssuesRecursively', () => {
    it('should fetch issues recursively with blocked-by dependencies', async () => {
      // Issue 1 is blocked by Issue 2
      // Issue 2 is blocked by Issue 3
      const issue1 = createTestIssue(1, { blockedBy: [2] });
      const issue2 = createTestIssue(2, { blockedBy: [3] });
      const issue3 = createTestIssue(3);

      // Mock fetchIssueByNumber calls
      const mockIssue2Data = {
        node_id: 'issue-2',
        number: 2,
        title: 'Test Issue 2',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/2',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const mockIssue3Data = {
        node_id: 'issue-3',
        number: 3,
        title: 'Test Issue 3',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/3',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.get
        .mockResolvedValueOnce({ data: mockIssue2Data })
        .mockResolvedValueOnce({ data: mockIssue3Data });

      // Mock dependency API calls
      mockOctokit.request.mockImplementation((path: string, params: any) => {
        if (path.includes('issue_number') && params.issue_number === 2) {
          if (path.includes('blocked_by')) {
            return Promise.resolve({ data: [{ number: 3 }] });
          }
        }
        return Promise.resolve({ data: [] });
      });

      const issues = await client.fetchIssuesRecursively(
        { owner: 'test', repo: 'repo' },
        [issue1],
        {}
      );

      expect(issues.length).toBeGreaterThanOrEqual(1);
      // Should contain issue 1 (initial) and issues 2 and 3 (recursive)
      const issueNumbers = issues.map(i => i.number).sort();
      expect(issueNumbers).toContain(1);
      expect(issueNumbers).toContain(2);
      expect(issueNumbers).toContain(3);
    });

    it('should avoid fetching duplicate issues', async () => {
      // Issue 1 and Issue 2 both depend on Issue 3
      const issue1 = createTestIssue(1, { blockedBy: [3] });
      const issue2 = createTestIssue(2, { blockedBy: [3] });

      const mockIssue3Data = {
        node_id: 'issue-3',
        number: 3,
        title: 'Test Issue 3',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/3',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.get.mockResolvedValue({ data: mockIssue3Data });
      mockOctokit.request.mockResolvedValue({ data: [] });

      const issues = await client.fetchIssuesRecursively(
        { owner: 'test', repo: 'repo' },
        [issue1, issue2],
        {}
      );

      // Issue 3 should only be fetched once
      expect(mockOctokit.issues.get).toHaveBeenCalledTimes(1);
      expect(mockOctokit.issues.get).toHaveBeenCalledWith({
        owner: 'test',
        repo: 'repo',
        issue_number: 3,
      });

      // Should contain 3 issues total: 1, 2 (initial), and 3 (recursive)
      expect(issues.length).toBe(3);
      const issueNumbers = issues.map(i => i.number).sort();
      expect(issueNumbers).toEqual([1, 2, 3]);
    });

    it('should handle circular dependencies gracefully', async () => {
      // Issue 1 is blocked by Issue 2
      // Issue 2 is blocked by Issue 1 (circular)
      const issue1 = createTestIssue(1, { blockedBy: [2] });

      const mockIssue2Data = {
        node_id: 'issue-2',
        number: 2,
        title: 'Test Issue 2',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/2',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.get.mockResolvedValue({ data: mockIssue2Data });

      mockOctokit.request.mockImplementation((path: string, params: any) => {
        if (path.includes('issue_number') && params.issue_number === 2) {
          if (path.includes('blocked_by')) {
            return Promise.resolve({ data: [{ number: 1 }] });
          }
        }
        return Promise.resolve({ data: [] });
      });

      const issues = await client.fetchIssuesRecursively(
        { owner: 'test', repo: 'repo' },
        [issue1],
        {}
      );

      // Should handle circular dependency without infinite loop
      expect(issues.length).toBe(2);
      const issueNumbers = issues.map(i => i.number).sort();
      expect(issueNumbers).toEqual([1, 2]);

      // Issue 2 should only be fetched once, even though there's a circular reference
      expect(mockOctokit.issues.get).toHaveBeenCalledTimes(1);
    });

    it('should return only initial issues when no dependencies exist', async () => {
      const issue1 = createTestIssue(1);
      const issue2 = createTestIssue(2);

      const issues = await client.fetchIssuesRecursively(
        { owner: 'test', repo: 'repo' },
        [issue1, issue2],
        {}
      );

      expect(issues.length).toBe(2);
      expect(mockOctokit.issues.get).not.toHaveBeenCalled();
    });

    it('should fetch sub-issues recursively', async () => {
      // Issue 1 has sub-issue 2
      // Issue 2 has sub-issue 3
      const issue1 = createTestIssue(1, { subIssues: [2] });

      const mockIssue2Data = {
        node_id: 'issue-2',
        number: 2,
        title: 'Test Issue 2',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/2',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const mockIssue3Data = {
        node_id: 'issue-3',
        number: 3,
        title: 'Test Issue 3',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/3',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.get
        .mockResolvedValueOnce({ data: mockIssue2Data })
        .mockResolvedValueOnce({ data: mockIssue3Data });

      mockOctokit.request.mockImplementation((path: string, params: any) => {
        if (path.includes('issue_number') && params.issue_number === 2) {
          if (path.includes('sub_issues')) {
            return Promise.resolve({ data: [{ number: 3 }] });
          }
        }
        return Promise.resolve({ data: [] });
      });

      const issues = await client.fetchIssuesRecursively(
        { owner: 'test', repo: 'repo' },
        [issue1],
        {}
      );

      expect(issues.length).toBe(3);
      const issueNumbers = issues.map(i => i.number).sort();
      expect(issueNumbers).toEqual([1, 2, 3]);
    });
  });

  describe('fetchOpenIssues with recursive option', () => {
    it('should fetch issues recursively when recursive option is true', async () => {
      const mockIssues = [
        {
          node_id: 'issue-1',
          number: 1,
          title: 'Test Issue 1',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          body: '',
          assignees: [],
          labels: [],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      const mockIssue2Data = {
        node_id: 'issue-2',
        number: 2,
        title: 'Test Issue 2',
        state: 'open',
        html_url: 'https://github.com/test/repo/issues/2',
        body: '',
        assignees: [],
        labels: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });
      mockOctokit.issues.get.mockResolvedValue({ data: mockIssue2Data });

      mockOctokit.request.mockImplementation((path: string, params: any) => {
        if (path.includes('issue_number') && params.issue_number === 1) {
          if (path.includes('blocked_by')) {
            return Promise.resolve({ data: [{ number: 2 }] });
          }
        }
        return Promise.resolve({ data: [] });
      });

      const issues = await client.fetchOpenIssues(
        { owner: 'test', repo: 'repo' },
        { recursive: true }
      );

      expect(issues.length).toBeGreaterThanOrEqual(2);
      const issueNumbers = issues.map(i => i.number).sort();
      expect(issueNumbers).toContain(1);
      expect(issueNumbers).toContain(2);
    });

    it('should not fetch recursively when recursive option is false', async () => {
      const mockIssues = [
        {
          node_id: 'issue-1',
          number: 1,
          title: 'Test Issue 1',
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/1',
          body: '',
          assignees: [],
          labels: [],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });
      mockOctokit.request.mockResolvedValue({ data: [{ number: 2 }] });

      const issues = await client.fetchOpenIssues(
        { owner: 'test', repo: 'repo' },
        { recursive: false }
      );

      expect(issues.length).toBe(1);
      expect(issues[0].number).toBe(1);
      // fetchIssueByNumber should not be called for issue 2
      expect(mockOctokit.issues.get).not.toHaveBeenCalled();
    });
  });
});

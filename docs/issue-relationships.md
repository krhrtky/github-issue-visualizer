# GitHub Issue Relationships - Complete Guide

## Overview

GitHub provides several ways to express relationships between issues. This document describes the supported relationship types, their visualization patterns, and implementation details in the GitHub Issue Dependency Visualizer.

## Relationship Types

### 1. Blocked-by / Blocking (Dependencies)

**Description**: Expresses that one issue cannot start until another issue is completed.

**Direction**: Unidirectional (A is blocked-by B means A depends on B)

**GitHub API Support**:
- ✅ REST API (primary): `/repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`, `/repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking`
- ✅ GraphQL API (future): mutations `addBlockedBy`, `removeBlockedBy`
- ✅ Search filters: `is:blocked`, `is:blocking`, `blocked-by:`, `blocking:`

**Text Patterns** (scoped out):
```
Note: Text parsing has been scoped out to ensure data consistency.
Users must use GitHub's native blocked-by feature via the web UI or API.
```

**Visualization**:
- **Mermaid**: Solid arrow `-->`
- **Cytoscape**: Solid line, color `#666`

**Example**:

```mermaid
graph LR
    N1[#1: Implement API] --> N2[#2: Design schema]
    style N1 fill:#74c0fc
    style N2 fill:#74c0fc
```

In this example:
- Issue #1 is **blocked-by** Issue #2
- Issue #2 must be completed before Issue #1 can start

### 2. Sub-issue / Parent (Hierarchical)

**Description**: Expresses parent-child relationship where sub-issues are parts of completing the parent.

**Direction**: Unidirectional (child → parent)

**GitHub API Support**:
- ✅ REST API (primary): `/repos/{owner}/{repo}/issues/{issue_number}/sub_issues`, `/repos/{owner}/{repo}/issues/{issue_number}/parent`
- ✅ GraphQL API (future): fields `trackedIssues` (parents), `trackedInIssues` (children), mutations `addSubIssue`, `removeSubIssue`
- ⚠️ Limitations: Max 100 sub-issues, 8 nesting levels

**Text Patterns** (scoped out):
```
Note: Text parsing has been scoped out to ensure data consistency.
Users must use GitHub's native sub-issues feature via the web UI or API.
```

**Visualization**:
- **Mermaid**: Dashed arrow `-.->`
- **Cytoscape**: Dashed line, color `#999`

**Example**:

```mermaid
graph LR
    N1[#1: Create login form] -.-> N2[#2: User Authentication Epic]
    N3[#3: Implement OAuth] -.-> N2
    N4[#4: Add password reset] -.-> N2
    style N1 fill:#74c0fc
    style N2 fill:#74c0fc
    style N3 fill:#74c0fc
    style N4 fill:#74c0fc
```

In this example:
- Issues #1, #3, #4 are **sub-issues** of Epic #2
- Epic #2 requires completion of all sub-issues

### 3. Task Lists (Checklist)

**Description**: Markdown checklists within issue body can reference other issues.

**GitHub API Support**:
- ❌ No dedicated API
- ✅ Detected via text parsing

**Format**:
```markdown
- [ ] #123 Complete design
- [x] #124 Setup infrastructure
```

**Implementation**: Treated as `sub-issue` relationships in this library.

## Visualization Patterns

### Pattern 1: Simple Blocked-by Chain

```mermaid
graph LR
    N1[#1: Deploy] --> N2[#2: Test]
    N2 --> N3[#3: Implement]
    N3 --> N4[#4: Design]
    style N1 fill:#74c0fc
    style N2 fill:#74c0fc
    style N3 fill:#74c0fc
    style N4 fill:#74c0fc
```

**Interpretation**:
- #4 (Design) must be done first
- Then #3 (Implement)
- Then #2 (Test)
- Finally #1 (Deploy)

**Depth calculation**:
- #4: depth 0 (leaf)
- #3: depth 1
- #2: depth 2
- #1: depth 3

### Pattern 2: Multiple Dependencies

```mermaid
graph LR
    N1[#1: Release v2.0] --> N2[#2: Frontend ready]
    N1 --> N3[#3: Backend ready]
    N1 --> N4[#4: Docs updated]
    style N1 fill:#ffa94d
    style N2 fill:#74c0fc
    style N3 fill:#74c0fc
    style N4 fill:#74c0fc
```

**Interpretation**:
- Issue #1 is blocked by #2, #3, and #4
- All must be completed before #1 can start
- #1 has **high criticality** (orange) because it has multiple dependencies

### Pattern 3: Hierarchical Epic Structure

```mermaid
graph LR
    N1[#1: Implement feature A] -.-> N2[#2: Q1 Roadmap]
    N3[#3: Implement feature B] -.-> N2
    N4[#4: Sub-task A1] -.-> N1
    N5[#5: Sub-task A2] -.-> N1
    style N1 fill:#74c0fc
    style N2 fill:#ffa94d
    style N3 fill:#74c0fc
    style N4 fill:#74c0fc
    style N5 fill:#74c0fc
```

**Interpretation**:
- Epic #2 contains features #1 and #3
- Feature #1 contains sub-tasks #4 and #5
- Maximum nesting: 2 levels

### Pattern 4: Mixed Relationships (Blocked-by + Sub-issue)

```mermaid
graph LR
    N1[#1: Sub-task 1] -.-> N2[#2: Epic]
    N3[#3: Sub-task 2] -.-> N2
    N1 --> N4[#4: External dependency]
    style N1 fill:#74c0fc
    style N2 fill:#ffa94d
    style N3 fill:#74c0fc
    style N4 fill:#74c0fc
```

**Interpretation**:
- #1 and #3 are sub-issues of Epic #2
- #1 is also blocked by external dependency #4
- #4 must be resolved before #1, which must be completed before Epic #2

**Depth calculation**:
```
depth(#4) = 0
depth(#1) = max(
  depth(#4) + 1,  // blocked-by #4
  0               // no parent depth
) = 1
depth(#3) = 0
depth(#2) = max(
  depth(#1) + 1,  // parent of #1
  depth(#3) + 1   // parent of #3
) = 2
```

### Pattern 5: Critical Path Visualization

```mermaid
graph LR
    N5[#5: Initialize] ==> N4[#4: Configure]
    N4 ==> N2[#2: Test]
    N2 ==> N1[#1: Deploy]
    style N5 fill:#ff6b6b
    style N4 fill:#ff6b6b
    style N2 fill:#ff6b6b
    style N1 fill:#ff6b6b
```

**Interpretation**:
- Red nodes are on the **critical path** (longest path in the graph)
- Critical path length: 4 issues
- Any delay in these issues delays the entire project

**How Critical Path is Calculated**:
1. Topological sort to detect cycles (throws error if found)
2. Depth calculation via DFS from leaf nodes
3. Find node with maximum depth (#1)
4. Backtrack from #1 to reconstruct path

### Pattern 6: Complex Dependency Graph

```mermaid
graph LR
    N1[#1: Release] --> N2[#2: Feature A]
    N1 --> N3[#3: Feature B]
    N2 --> N4[#4: Design]
    N3 --> N4
    N2 --> N5[#5: API ready]
    N3 --> N5

    N6[#6: Sub-task A1] -.-> N2
    N7[#7: Sub-task A2] -.-> N2

    style N1 fill:#ff6b6b
    style N2 fill:#ff6b6b
    style N3 fill:#ffa94d
    style N4 fill:#ff6b6b
    style N5 fill:#ff6b6b
    style N6 fill:#74c0fc
    style N7 fill:#74c0fc
```

**Interpretation**:
- **Critical Path** (red): #4 → #5 → #2 → #1
- **High Criticality** (orange): #3 (blocking 1 issue, but not on critical path)
- **Low Criticality** (blue): #6, #7 (no blocking dependencies)
- Sub-issues #6, #7 contribute to Feature A (#2)

## Implementation Details

### Data Sources

This library uses **GitHub's Native REST API** for relationship extraction:

#### Native GitHub REST API

**REST Endpoints**:
```typescript
// Sub-issues
GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
GET /repos/{owner}/{repo}/issues/{issue_number}/parent

// Dependencies
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking
```

**Advantages**:
- Authoritative source of truth
- No parsing ambiguity
- Automatically maintained by GitHub
- Full support for both sub-issues and dependencies

**Current Support**: ✅ Full support via REST API

#### Future Migration to GraphQL

GraphQL support is planned for future implementation to improve performance:

```graphql
issue {
  trackedIssues(first: 50) {     # Parent issues
    nodes { number }
  }
  trackedInIssues(first: 50) {   # Child issues
    nodes { number }
  }
}
```

**Note**: GraphQL fields for `blockedByIssues` and `blockingIssues` are not yet available in the public API.

#### Text Parsing (Scoped Out)

Text parsing has been **scoped out** to ensure data consistency and reliability:

**Rationale**:
- Eliminates parsing ambiguity
- Forces users to follow GitHub's standard features
- Ensures relationships are properly tracked in GitHub's system
- Simplifies maintenance and testing

**Future**: May be re-enabled as an optional fallback for legacy issues

### Edge Visualization

| Relationship Type | Mermaid | Cytoscape Line Style | Cytoscape Color |
|------------------|---------|---------------------|-----------------|
| Blocked-by | `-->` (solid) | `solid` | `#666` (dark gray) |
| Sub-issue | `-.->` (dashed) | `dashed` | `#999` (light gray) |

### Node Coloring (Criticality)

| Condition | Color | Hex | Meaning |
|-----------|-------|-----|---------|
| On Critical Path | Red | `#ff6b6b` | Part of longest path |
| High Criticality (5+ dependents) | Orange | `#ffa94d` | Bottleneck risk |
| Medium Criticality (2-4 dependents) | Yellow | `#ffd43b` | Some impact |
| Low Criticality (0-1 dependents) | Blue | `#74c0fc` | Minimal impact |

## Usage Examples

### CLI Usage

```bash
# Visualize all dependencies
github-issue-viz visualize owner/repo --token $GITHUB_TOKEN

# Filter by labels
github-issue-viz visualize owner/repo --label "sprint-1" --label "feature"

# Show critical path only
github-issue-viz analyze owner/repo --show-critical-path

# Generate interactive HTML
github-issue-viz visualize owner/repo -f interactive -o graph.html
```

### Programmatic Usage

```typescript
import { IssueDependencyVisualizer } from 'github-issue-dependency-visualizer';

const visualizer = new IssueDependencyVisualizer(process.env.GITHUB_TOKEN!);

const graph = await visualizer.generateGraph('owner/repo', {
  filters: {
    state: 'open',
    labels: ['feature'],
  },
  highlightCriticalPath: true,
});

// Generate Mermaid diagram
const mermaid = visualizer.generateVisualization(graph, 'mermaid');
console.log(mermaid);

// Get metrics
console.log(`Critical Path Length: ${graph.metrics.criticalPathLength}`);
console.log(`Bottlenecks: ${graph.metrics.bottlenecks.length}`);
```

## Filtering Options

### Pre-fetch Filters (API Level)

Applied during GitHub API query:

```typescript
{
  state: 'open' | 'closed' | 'all',  // Default: 'open'
  labels: ['bug', 'feature'],        // Issues with these labels
  assignees: ['username'],           // Assigned issues + unassigned
  searchText: 'keyword',             // Title or body contains
  createdSince: '2025-01-01',        // ISO 8601 date
  updatedUntil: '2025-12-31',        // ISO 8601 date
}
```

### Post-fetch Filters (Graph Level)

Applied after building graph:

```typescript
{
  filterLabels: ['sprint-1'],        // Only show these labels
  filterAssignees: ['alice'],        // Only show these assignees
}
```

## Limitations and Future Enhancements

### Current Limitations

❌ **Not Yet Supported**:
1. Related-to (weak bidirectional relationships)
2. Duplicates
3. Cross-repository dependencies
4. Multiple parent issues (only first parent tracked)
5. Dependency strength/weight

### Future Enhancements (Priority Order)

**High Priority**:
1. ✅ GitHub REST API integration for sub-issues (COMPLETED)
2. ✅ GitHub REST API integration for dependencies (blocked-by/blocking) (COMPLETED)
3. 🔄 GraphQL migration for improved performance
4. 🔄 Relationship type expansion (`related-to`, `duplicates`)

**Medium Priority**:
5. Optional text parsing fallback for legacy issues
6. Multiple parent issue support
7. Cross-repository dependency tracking
8. Dependency metadata (strength, confidence level)

**Low Priority**:
9. Bidirectional relationships (related-to)
10. Custom relationship types
11. Temporal dependency analysis

## Cycle Detection

**Behavior**: Cycles in dependencies are **not allowed** and will throw an error.

```typescript
try {
  const graph = await visualizer.generateGraph('owner/repo');
} catch (error) {
  if (error.cycle) {
    console.error('Circular dependency detected:');
    console.error(`Path: ${error.cycle.join(' → ')}`);
  }
}
```

**Example Cycle**:
```
Issue #1 → blocked-by #2
Issue #2 → blocked-by #3
Issue #3 → blocked-by #1  // ❌ Creates cycle
```

**Error Message**: `"Circular dependency detected: 1 -> 2 -> 3 -> 1"`

## API Coverage Summary

| Feature | REST API (Current) | GraphQL (Future) | Text Parse (Scoped Out) | Support |
|---------|-------------------|------------------|------------------------|---------|
| Blocked-by | ✅ | 🔄 Planned | ❌ | ✅ REST API |
| Blocking | ✅ | 🔄 Planned | ❌ | ✅ REST API |
| Sub-issues | ✅ | 🔄 Planned | ❌ | ✅ REST API |
| Parent issues | ✅ | 🔄 Planned | ❌ | ✅ REST API |
| Task lists | ❌ | ❌ | ❌ | ❌ Not supported |
| Related-to | ❌ | ❌ | ❌ | ❌ Not supported |
| Duplicates | ❌ | ❌ | ❌ | ❌ Not supported |

**Notes**:
- ✅ **REST API**: Primary method, fully implemented
- 🔄 **GraphQL**: Planned for future migration to improve performance
- ❌ **Text Parse**: Scoped out to ensure data consistency

## References

- [GitHub Issue Dependencies (General Availability)](https://github.blog/changelog/2025-08-21-issue-dependencies-general-availability/)
- [GitHub Sub-Issues (General Availability)](https://github.blog/changelog/2025-01-06-sub-issues-general-availability/)
- [GitHub GraphQL API Documentation](https://docs.github.com/en/graphql)
- [Mermaid Diagram Syntax](https://mermaid.js.org/syntax/flowchart.html)
- [Cytoscape.js Documentation](https://js.cytoscape.org/)

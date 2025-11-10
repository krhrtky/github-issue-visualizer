# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Issue Dependency Visualizer: TypeScript library and CLI tool that analyzes dependencies between GitHub issues to identify critical paths and support task prioritization.

## Core Architecture

### Data Flow Pipeline
1. **API Layer** (`src/api/`): Fetches issues via GitHub GraphQL/REST APIs
2. **Parser** (`src/parser/`): Extracts dependencies from issue text using regex patterns
3. **Graph Builder** (`src/graph/builder.ts`): Constructs dependency graph from parsed data
4. **Graph Analyzer** (`src/graph/analyzer.ts`): Performs critical path analysis using topological sort and depth calculation
5. **Visualizer** (`src/visualizer/`): Generates Mermaid diagrams or interactive HTML (Cytoscape.js)

### Dependency Model
- **Blocked-by**: Issue A cannot start until Issue B completes
- **Sub-issue**: Issue A is part of completing Issue B (parent-child relationship)
- **Sources**: Native GitHub API or text parsing (API source preferred when merging)

### Critical Path Algorithm
1. Topological sort to detect cycles (throws CycleError if found)
2. Depth calculation via recursive DFS from leaf nodes
3. Path reconstruction by backtracking from highest-depth node

## Common Commands

### Development
```bash
npm run build          # Compile TypeScript
npm run dev            # Watch mode compilation
npm test               # Run all tests
npm run test:watch     # Watch mode testing
npm run test:coverage  # Generate coverage report (80% threshold)
npm run lint           # ESLint check
npm run format         # Prettier formatting
```

### CLI Usage
```bash
# Test locally (after npm run build)
node dist/cli/index.js visualize owner/repo --token $GITHUB_TOKEN

# Interactive visualization
node dist/cli/index.js visualize owner/repo -f interactive -o graph.html

# Recursive dependency fetching (fetch all transitive dependencies)
node dist/cli/index.js visualize owner/repo --recursive --token $GITHUB_TOKEN

# Analysis only
node dist/cli/index.js analyze owner/repo --show-critical-path
```

### Testing Single Test
```bash
npm test -- parser.test.ts          # Run specific test file
npm test -- -t "pattern name"       # Run tests matching pattern
```

## Key Implementation Details

### Graph Node Structure (IssueNode)
```typescript
{
  ...Issue,                    // GitHub issue data
  subIssues: number[],         // Child issues
  blockedBy: number[],         // Dependencies blocking this issue
  blocking: number[],          // Issues blocked by this issue
  parentIssue?: number,        // Parent issue (for sub-issues)
  depth: number,               // Longest path from leaf nodes
  criticalityScore: number,    // Number of direct dependents
  onCriticalPath: boolean      // True if on critical path
}
```

### Filtering Behavior
- Label filter (`--label`): Includes only issues with matching labels
- Assignee filter (`--assignee`): Includes assigned issues + unassigned
- State filter (`--state`): open (default) | closed | all
- Text search (`--search`): Searches title and body
- Date filters: `--created-since`, `--updated-until`, etc. (ISO 8601 format)
- Recursive filter (`--recursive`): Fetch all transitive dependencies (even if they don't match filters)

### Recursive Dependency Fetching
- **Purpose**: Fetch all issues transitively related through dependencies, even if they don't match initial filters
- **Algorithm**:
  1. Fetch initial issues matching filters (labels, state, assignee, etc.)
  2. Extract all dependency references (blockedBy, blocking, subIssues, parent)
  3. Fetch dependency issues not yet retrieved
  4. Repeat steps 2-3 for newly fetched issues until all transitive dependencies are resolved
- **Deduplication**: Uses Set-based tracking to avoid fetching the same issue multiple times
- **Circular dependencies**: Handled gracefully without infinite loops
- **Performance**: Only fetches issues once, reducing API calls and respecting rate limits

### Error Handling Patterns
- `CycleError`: Thrown when circular dependencies detected (includes `cycle` property)
- API validation: Check repository access before fetching issues
- Dependency validation: Filter out references to non-existent issues
- Failed issue fetches: Logged as warnings, do not halt the recursive fetching process

## Environment Setup

### Required Environment Variables
```bash
GITHUB_TOKEN=ghp_your_token_here  # Required scopes: repo or public_repo
```

### TypeScript Configuration
- Target: ES2020, CommonJS modules
- Strict mode enabled with noUnusedLocals/Parameters
- Output: `dist/` directory

## Testing Guidelines

### Coverage Requirements
- Minimum 80% coverage for branches, functions, lines, statements
- CLI excluded from coverage (`src/cli/index.ts`)
- Use ts-jest preset

### Test File Organization
```
tests/
├── api.test.ts         # GitHubClient tests (including recursive fetching)
├── parser.test.ts      # DependencyParser tests
├── graph.test.ts       # GraphBuilder + GraphAnalyzer tests
└── visualizer.test.ts  # Mermaid + Interactive generator tests
```

## Code Style Notes

- Functional approach: Pure functions with immutability preferred
- Early returns: Use guard clauses to reduce nesting
- Map/Set usage: Efficient lookups for issue numbers and dependency deduplication
- Depth calculation: Uses memoization via Map to avoid redundant traversals

# GitHub Issue Dependency Visualizer

A powerful library to visualize dependencies between GitHub Issues, making it easy to identify critical paths and support task prioritization decisions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)

## Features

- 🔍 **Automatic Dependency Detection**: Parse both native GitHub dependencies and text-based patterns
- 📊 **Critical Path Analysis**: Identify the longest dependency chain and bottleneck issues
- 🎨 **Multiple Visualizations**: Generate Mermaid diagrams or interactive HTML visualizations
- 🎯 **Smart Filtering**: Filter by labels, assignees, or custom criteria
- 🚀 **Fast & Efficient**: Process hundreds of issues in seconds
- 💻 **CLI & Library**: Use as a command-line tool or integrate into your workflow

## Installation

```bash
npm install -g github-issue-dependency-visualizer
```

Or use directly with npx:

```bash
npx github-issue-dependency-visualizer visualize owner/repo
```

## Quick Start

### CLI Usage

```bash
# Basic usage
github-issue-deps visualize owner/repo --token YOUR_GITHUB_TOKEN

# Generate interactive HTML
github-issue-deps visualize owner/repo \
  --format interactive \
  --output ./graph.html

# Filter by labels
github-issue-deps visualize owner/repo \
  --label "priority:high" \
  --label "bug"

# Analyze only (no visualization)
github-issue-deps analyze owner/repo --show-critical-path
```

### Library Usage

```typescript
import { IssueDependencyVisualizer } from 'github-issue-dependency-visualizer';

const visualizer = new IssueDependencyVisualizer(process.env.GITHUB_TOKEN!);

// Generate dependency graph
const graph = await visualizer.generateGraph('owner/repo');

// Generate Mermaid diagram
const mermaid = visualizer.generateVisualization(graph, 'mermaid');
console.log(mermaid);

// Generate metrics
const metrics = visualizer.generateMetricsSummary(graph);
console.log(metrics);
```

## How It Works

### Dependency Types

The visualizer supports two types of dependencies:

1. **Blocked-by**: Issues that must be completed before the current issue can start
   - Patterns: `blocked by #123`, `depends on #456`, `requires #789`

2. **Sub-issues**: Issues that are part of completing a larger issue
   - Patterns: `sub-issue of #123`, `part of #456`
   - Task lists: `- [ ] Complete #789`

### Dependency Detection

Dependencies are detected through:

1. **GitHub's Native API**: Uses GraphQL to fetch tracked issues
2. **Text Parsing**: Scans issue bodies for dependency patterns
3. **Task Lists**: Identifies issues referenced in checklists

### Critical Path Algorithm

The critical path is calculated using:

1. **Topological Sort**: Ensures no circular dependencies
2. **Depth Calculation**: Find the longest path from leaf to each node
3. **Path Reconstruction**: Backtrack from highest depth to build the critical path

## CLI Reference

### `visualize` Command

Generate a visual dependency graph.

```bash
github-issue-deps visualize <repository> [options]
```

**Options:**

- `-t, --token <token>`: GitHub personal access token (or use `GITHUB_TOKEN` env var)
- `-f, --format <format>`: Output format: `mermaid` or `interactive` (default: mermaid)
- `-o, --output <path>`: Save to file instead of printing to console
- `-l, --label <labels...>`: Filter by labels (can specify multiple)
- `-a, --assignee <assignees...>`: Filter by assignees
- `--no-critical-path`: Don't highlight critical path

**Examples:**

```bash
# Save Mermaid diagram to file
github-issue-deps visualize facebook/react \
  --output ./react-deps.md

# Generate interactive visualization
github-issue-deps visualize vuejs/vue \
  --format interactive \
  --output ./vue-deps.html

# Filter by label and assignee
github-issue-deps visualize microsoft/vscode \
  --label "bug" \
  --assignee "@me"
```

### `analyze` Command

Analyze dependencies and show metrics only.

```bash
github-issue-deps analyze <repository> [options]
```

**Options:**

- `-t, --token <token>`: GitHub personal access token
- `-l, --label <labels...>`: Filter by labels
- `-a, --assignee <assignees...>`: Filter by assignees
- `--show-bottlenecks`: Show bottleneck issues
- `--show-critical-path`: Show critical path visualization

**Example:**

```bash
github-issue-deps analyze nodejs/node \
  --show-critical-path \
  --show-bottlenecks
```

## Library API

### `IssueDependencyVisualizer`

Main class for generating visualizations.

```typescript
class IssueDependencyVisualizer {
  constructor(githubToken: string);

  async generateGraph(
    repository: string | RepositoryInfo,
    options?: Partial<VisualizationOptions>
  ): Promise<DependencyGraph>;

  generateVisualization(
    graph: DependencyGraph,
    format: 'mermaid' | 'interactive',
    highlightCriticalPath?: boolean
  ): string;

  generateMetricsSummary(graph: DependencyGraph): string;

  generateCriticalPathVisualization(graph: DependencyGraph): string;
}
```

### Helper Function

```typescript
async function visualizeRepository(
  repository: string,
  githubToken: string,
  options?: Partial<VisualizationOptions>
): Promise<{
  graph: DependencyGraph;
  visualization: string;
  metrics: string;
}>;
```

**Example:**

```typescript
import { visualizeRepository } from 'github-issue-dependency-visualizer';

const result = await visualizeRepository(
  'facebook/react',
  process.env.GITHUB_TOKEN!,
  {
    format: 'mermaid',
    filterLabels: ['good first issue'],
  }
);

console.log(result.metrics);
console.log(result.visualization);
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
GITHUB_TOKEN=ghp_your_token_here
```

### GitHub Token Permissions

Your token needs the following scopes:

- `repo` (for private repositories)
- `public_repo` (for public repositories only)

Generate a token at: https://github.com/settings/tokens

## Output Examples

### Mermaid Diagram

```mermaid
graph TD
    N1[#1: Setup project structure] --> N2[#2: Implement API client]
    N1 --> N3[#3: Create parser]
    N2 --> N4[#4: Build graph analyzer]
    N3 --> N4
    N4 --> N5[#5: Generate visualizations]

    style N1 fill:#ff6b6b
    style N2 fill:#ff6b6b
    style N4 fill:#ff6b6b
    style N5 fill:#ff6b6b
```

### Metrics Summary

```
## Dependency Graph Metrics

- **Total Issues**: 15
- **Total Dependencies**: 23
- **Critical Path Length**: 5

### Critical Path

- #1: Setup project structure
- #2: Implement API client
- #4: Build graph analyzer
- #5: Generate visualizations
- #7: Create documentation

### Bottlenecks (High Criticality Issues)

- #2: Implement API client (8 dependents)
- #4: Build graph analyzer (5 dependents)
- #1: Setup project structure (4 dependents)
```

## Architecture

```
src/
├── api/
│   ├── github-client.ts    # GitHub API wrapper
│   └── types.ts            # Type definitions
├── parser/
│   ├── dependency-parser.ts # Parse text dependencies
│   └── patterns.ts          # Regex patterns
├── graph/
│   ├── builder.ts          # Build dependency graph
│   ├── analyzer.ts         # Critical path analysis
│   └── types.ts            # Graph types
├── visualizer/
│   ├── mermaid.ts          # Mermaid generator
│   ├── interactive.ts      # HTML/Cytoscape generator
│   └── formatter.ts        # Formatting utilities
├── cli/
│   └── index.ts            # CLI interface
└── index.ts                # Main library exports
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/github-issue-visualizer.git
cd github-issue-visualizer

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### "Cannot access repository" error

- Verify your GitHub token has the correct permissions
- Check if the repository exists and you have access
- Ensure token is set via `--token` flag or `GITHUB_TOKEN` env var

### "Circular dependency detected" error

This means your issues have a dependency loop. Review the reported cycle and update issue dependencies to break the loop.

### Rate limiting

GitHub API has rate limits (5000 requests/hour for authenticated users). The library uses GraphQL to minimize requests, but for very large repositories, you may hit limits.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Octokit](https://github.com/octokit/octokit.js) for GitHub API
- Visualizations powered by [Mermaid.js](https://mermaid.js.org/) and [Cytoscape.js](https://js.cytoscape.org/)
- CLI built with [Commander.js](https://github.com/tj/commander.js)

## Roadmap

- [ ] Cross-repository dependencies
- [ ] GitHub Action integration
- [ ] Real-time updates via webhooks
- [ ] Project board integration
- [ ] Time-based analysis (due dates)
- [ ] Export to PNG/SVG
- [ ] Assignee workload visualization

## Support

- 📫 [Open an issue](https://github.com/yourusername/github-issue-visualizer/issues)
- 💬 [Discussions](https://github.com/yourusername/github-issue-visualizer/discussions)

---

**Made with ❤️ for better project management**

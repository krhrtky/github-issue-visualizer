/**
 * Example usage of the GitHub Issue Dependency Visualizer
 */

import { IssueDependencyVisualizer, visualizeRepository } from '../src/index';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

async function example1() {
  console.log('Example 1: Basic visualization');
  console.log('================================\n');

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const visualizer = new IssueDependencyVisualizer(token);

  // Generate graph for a repository
  const graph = await visualizer.generateGraph('facebook/react', {
    filterLabels: ['good first issue'],
  });

  // Generate Mermaid diagram
  const mermaid = visualizer.generateVisualization(graph, 'mermaid');
  console.log(mermaid);

  // Generate metrics
  const metrics = visualizer.generateMetricsSummary(graph);
  console.log('\n' + metrics);
}

async function example2() {
  console.log('Example 2: Interactive visualization');
  console.log('====================================\n');

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const result = await visualizeRepository('vuejs/vue', token, {
    format: 'interactive',
    highlightCriticalPath: true,
  });

  // Save to file
  fs.writeFileSync('./dependency-graph.html', result.visualization);
  console.log('✓ Interactive visualization saved to dependency-graph.html');
  console.log('\n' + result.metrics);
}

async function example3() {
  console.log('Example 3: Critical path analysis');
  console.log('=================================\n');

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const visualizer = new IssueDependencyVisualizer(token);
  const graph = await visualizer.generateGraph('microsoft/vscode');

  // Show critical path only
  const criticalPath = visualizer.generateCriticalPathVisualization(graph);
  console.log(criticalPath);

  // Show bottlenecks
  console.log('\nBottleneck Issues:');
  for (const issueNumber of graph.metrics.bottlenecks) {
    const node = graph.nodes.get(issueNumber);
    if (node) {
      console.log(`- #${issueNumber}: ${node.title} (${node.criticalityScore} dependents)`);
    }
  }
}

// Run examples
async function main() {
  try {
    // Uncomment to run specific examples
    // await example1();
    // await example2();
    // await example3();

    console.log('Examples completed successfully!');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

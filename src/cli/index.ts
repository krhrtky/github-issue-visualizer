#!/usr/bin/env node

/**
 * CLI interface for github-issue-dependency-visualizer
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { IssueDependencyVisualizer } from '../index';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('github-issue-deps')
  .description('Visualize dependencies between GitHub issues')
  .version('1.0.0');

program
  .command('visualize <repository>')
  .description('Generate dependency visualization for a repository (format: owner/repo)')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-f, --format <format>', 'Output format (mermaid or interactive)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .option('-l, --label <labels...>', 'Filter by labels')
  .option('-a, --assignee <assignees...>', 'Filter by assignees')
  .option('-s, --state <state>', 'Filter by state (open, closed, all)', 'open')
  .option('--search <text>', 'Search text in title or body')
  .option('--title <text>', 'Search text in title only')
  .option('--created-since <date>', 'Filter issues created since date (ISO 8601 format)')
  .option('--created-until <date>', 'Filter issues created until date (ISO 8601 format)')
  .option('--updated-since <date>', 'Filter issues updated since date (ISO 8601 format)')
  .option('--updated-until <date>', 'Filter issues updated until date (ISO 8601 format)')
  .option('--no-critical-path', 'Do not highlight critical path')
  .action(async (repository: string, options: any) => {
    try {
      // Get GitHub token
      const token = options.token || process.env.GITHUB_TOKEN;
      if (!token) {
        console.error(
          'Error: GitHub token is required. Use --token or set GITHUB_TOKEN environment variable.'
        );
        process.exit(1);
      }

      // Validate format
      const format = options.format.toLowerCase();
      if (format !== 'mermaid' && format !== 'interactive') {
        console.error('Error: Format must be either "mermaid" or "interactive"');
        process.exit(1);
      }

      // Validate state
      const state = options.state?.toLowerCase();
      if (state && state !== 'open' && state !== 'closed' && state !== 'all') {
        console.error('Error: State must be either "open", "closed", or "all"');
        process.exit(1);
      }

      // Create visualizer
      const visualizer = new IssueDependencyVisualizer(token);

      // Generate graph
      const graph = await visualizer.generateGraph(repository, {
        format,
        filterLabels: options.label,
        filterAssignees: options.assignee,
        highlightCriticalPath: options.criticalPath !== false,
        filters: {
          state: state as 'open' | 'closed' | 'all',
          labels: options.label,
          assignees: options.assignee,
          searchText: options.search,
          titleQuery: options.title,
          createdSince: options.createdSince,
          createdUntil: options.createdUntil,
          updatedSince: options.updatedSince,
          updatedUntil: options.updatedUntil,
        },
      });

      // Generate visualization
      const visualization = visualizer.generateVisualization(
        graph,
        format,
        options.criticalPath !== false
      );

      // Generate metrics
      const metrics = visualizer.generateMetricsSummary(graph);

      // Output
      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write visualization
        fs.writeFileSync(outputPath, visualization);
        console.log(`✓ Visualization saved to ${outputPath}`);

        // Write metrics to a separate file
        const metricsPath = outputPath.replace(
          /\.[^.]+$/,
          '-metrics.md'
        );
        fs.writeFileSync(metricsPath, metrics);
        console.log(`✓ Metrics saved to ${metricsPath}`);
      } else {
        // Output to console
        console.log('\n' + metrics);
        console.log('\n' + visualization);
      }

      console.log('\n✓ Done!');
    } catch (error: any) {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('analyze <repository>')
  .description('Analyze dependency graph and show metrics only')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-l, --label <labels...>', 'Filter by labels')
  .option('-a, --assignee <assignees...>', 'Filter by assignees')
  .option('-s, --state <state>', 'Filter by state (open, closed, all)', 'open')
  .option('--search <text>', 'Search text in title or body')
  .option('--title <text>', 'Search text in title only')
  .option('--created-since <date>', 'Filter issues created since date (ISO 8601 format)')
  .option('--created-until <date>', 'Filter issues created until date (ISO 8601 format)')
  .option('--updated-since <date>', 'Filter issues updated since date (ISO 8601 format)')
  .option('--updated-until <date>', 'Filter issues updated until date (ISO 8601 format)')
  .option('--show-bottlenecks', 'Show bottleneck issues')
  .option('--show-critical-path', 'Show critical path')
  .action(async (repository: string, options: any) => {
    try {
      // Get GitHub token
      const token = options.token || process.env.GITHUB_TOKEN;
      if (!token) {
        console.error(
          'Error: GitHub token is required. Use --token or set GITHUB_TOKEN environment variable.'
        );
        process.exit(1);
      }

      // Validate state
      const state = options.state?.toLowerCase();
      if (state && state !== 'open' && state !== 'closed' && state !== 'all') {
        console.error('Error: State must be either "open", "closed", or "all"');
        process.exit(1);
      }

      // Create visualizer
      const visualizer = new IssueDependencyVisualizer(token);

      // Generate graph
      const graph = await visualizer.generateGraph(repository, {
        filterLabels: options.label,
        filterAssignees: options.assignee,
        filters: {
          state: state as 'open' | 'closed' | 'all',
          labels: options.label,
          assignees: options.assignee,
          searchText: options.search,
          titleQuery: options.title,
          createdSince: options.createdSince,
          createdUntil: options.createdUntil,
          updatedSince: options.updatedSince,
          updatedUntil: options.updatedUntil,
        },
      });

      // Show metrics
      const metrics = visualizer.generateMetricsSummary(graph);
      console.log('\n' + metrics);

      // Show critical path if requested
      if (options.showCriticalPath) {
        console.log('\n### Critical Path Visualization\n');
        const criticalPath = visualizer.generateCriticalPathVisualization(graph);
        console.log(criticalPath);
      }

      console.log('\n✓ Done!');
    } catch (error: any) {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

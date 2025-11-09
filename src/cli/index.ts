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
  .option('-q, --query <query>', 'GitHub Search query (uses Search API when specified)')
  .option('--search <text>', 'Search text in title or body')
  .option('--created-since <date>', 'Filter issues created since date (ISO 8601 format)')
  .option('--created-until <date>', 'Filter issues created until date (ISO 8601 format)')
  .option('--updated-since <date>', 'Filter issues updated since date (ISO 8601 format)')
  .option('--updated-until <date>', 'Filter issues updated until date (ISO 8601 format)')
  .action(async (repository: string, options: any) => {
    try {
      const token = options.token || process.env.GITHUB_TOKEN;
      if (!token) {
        console.error(
          'Error: GitHub token is required. Use --token or set GITHUB_TOKEN environment variable.'
        );
        process.exit(1);
      }

      const format = options.format.toLowerCase();
      if (format !== 'mermaid' && format !== 'interactive') {
        console.error('Error: Format must be either "mermaid" or "interactive"');
        process.exit(1);
      }

      const state = options.state?.toLowerCase();
      if (state && state !== 'open' && state !== 'closed' && state !== 'all') {
        console.error('Error: State must be either "open", "closed", or "all"');
        process.exit(1);
      }

      const visualizer = new IssueDependencyVisualizer(token);

      const graph = await visualizer.generateGraph(repository, {
        format,
        filterLabels: options.label,
        filterAssignees: options.assignee,
        filters: {
          state: state as 'open' | 'closed' | 'all',
          labels: options.label,
          assignees: options.assignee,
          searchText: options.search,
          createdSince: options.createdSince,
          createdUntil: options.createdUntil,
          updatedSince: options.updatedSince,
          updatedUntil: options.updatedUntil,
          query: options.query,
        },
      });

      const visualization = visualizer.generateVisualization(graph, format);
      const metrics = visualizer.generateMetricsSummary(graph);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, visualization);
        console.log(`✓ Visualization saved to ${outputPath}`);

        const metricsPath = outputPath.replace(/\.[^.]+$/, '-metrics.md');
        fs.writeFileSync(metricsPath, metrics);
        console.log(`✓ Metrics saved to ${metricsPath}`);
      } else {
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

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

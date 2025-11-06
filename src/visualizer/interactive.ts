/**
 * Generate interactive HTML visualization using Cytoscape.js
 */

import { DependencyGraph } from '../api/types';
import { Formatter } from './formatter';

export class InteractiveGenerator {
  /**
   * Generate interactive HTML visualization
   */
  generate(graph: DependencyGraph, highlightCriticalPath: boolean = true): string {
    const elements = this.buildCytoscapeElements(graph);
    const style = this.buildCytoscapeStyle(highlightCriticalPath);

    return this.buildHTML(elements, style, graph);
  }

  /**
   * Build Cytoscape elements (nodes and edges)
   */
  private buildCytoscapeElements(graph: DependencyGraph): any[] {
    const elements: any[] = [];

    // Add nodes
    for (const [nodeNumber, node] of graph.nodes) {
      elements.push({
        data: {
          id: `${nodeNumber}`,
          label: `#${nodeNumber}: ${Formatter.formatTitle(node.title, 50)}`,
          title: node.title,
          url: node.url,
          assignees: node.assignees.map((a) => a.login).join(', '),
          labels: node.labels.map((l) => l.name).join(', '),
          depth: node.depth,
          criticality: node.criticalityScore,
          onCriticalPath: node.onCriticalPath,
        },
      });
    }

    // Add edges
    for (const edge of graph.edges) {
      elements.push({
        data: {
          id: `${edge.from}-${edge.to}`,
          source: `${edge.from}`,
          target: `${edge.to}`,
          type: edge.type,
          source_type: edge.source,
        },
      });
    }

    return elements;
  }

  /**
   * Build Cytoscape style
   */
  private buildCytoscapeStyle(highlightCriticalPath: boolean): any[] {
    return [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'background-color': (ele: any) => {
            if (highlightCriticalPath && ele.data('onCriticalPath')) {
              return '#ff6b6b';
            }
            const criticality = ele.data('criticality');
            return Formatter.getCriticalityColor(criticality);
          },
          color: '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          width: 'label',
          height: 'label',
          padding: '10px',
          shape: 'roundrectangle',
          'border-width': 2,
          'border-color': '#333',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': (ele: any) => {
            return ele.data('type') === 'sub-issue' ? '#999' : '#666';
          },
          'line-style': (ele: any) => {
            return ele.data('type') === 'sub-issue' ? 'dashed' : 'solid';
          },
          'target-arrow-color': '#666',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#0066cc',
        },
      },
    ];
  }

  /**
   * Build complete HTML page
   */
  private buildHTML(elements: any[], style: any[], graph: DependencyGraph): string {
    const elementsJson = JSON.stringify(elements, null, 2);
    const styleJson = JSON.stringify(style, null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Issue Dependency Graph</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    #header {
      background: #24292e;
      color: white;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    #header h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }

    #metrics {
      display: flex;
      gap: 30px;
      font-size: 14px;
    }

    #metrics .metric {
      display: flex;
      flex-direction: column;
    }

    #metrics .metric .label {
      color: #8b949e;
      font-size: 12px;
      margin-bottom: 4px;
    }

    #metrics .metric .value {
      font-size: 20px;
      font-weight: bold;
    }

    #cy {
      flex: 1;
      background: white;
    }

    #controls {
      background: white;
      padding: 15px 20px;
      border-top: 1px solid #e1e4e8;
      display: flex;
      gap: 15px;
      align-items: center;
    }

    button {
      background: #0366d6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    button:hover {
      background: #0256c7;
    }

    #info {
      position: fixed;
      top: 120px;
      right: 20px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 400px;
      display: none;
    }

    #info.show {
      display: block;
    }

    #info h3 {
      margin-bottom: 10px;
      color: #24292e;
    }

    #info .info-item {
      margin: 8px 0;
      font-size: 14px;
    }

    #info .info-item .label {
      font-weight: 600;
      color: #586069;
    }

    #info .close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      color: #586069;
      padding: 4px 8px;
    }

    .legend {
      display: flex;
      gap: 20px;
      font-size: 13px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid #333;
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>GitHub Issue Dependency Graph</h1>
    <div id="metrics">
      <div class="metric">
        <span class="label">Total Issues</span>
        <span class="value">${graph.metrics.totalIssues}</span>
      </div>
      <div class="metric">
        <span class="label">Dependencies</span>
        <span class="value">${graph.metrics.totalDependencies}</span>
      </div>
      <div class="metric">
        <span class="label">Critical Path Length</span>
        <span class="value">${graph.metrics.criticalPathLength}</span>
      </div>
    </div>
  </div>

  <div id="cy"></div>

  <div id="controls">
    <button onclick="resetView()">Reset View</button>
    <button onclick="fitToScreen()">Fit to Screen</button>
    <button onclick="exportPNG()">Export as PNG</button>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color" style="background: #ff6b6b"></div>
        <span>Critical Path</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #ffa94d"></div>
        <span>High Criticality</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #74c0fc"></div>
        <span>Low Criticality</span>
      </div>
    </div>
  </div>

  <div id="info">
    <button class="close" onclick="closeInfo()">✕</button>
    <h3 id="info-title"></h3>
    <div id="info-content"></div>
  </div>

  <script>
    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: ${elementsJson},
      style: ${styleJson},
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 50,
        spacingFactor: 1.5
      },
      wheelSensitivity: 0.2
    });

    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const data = node.data();

      document.getElementById('info-title').textContent = data.title;
      document.getElementById('info-content').innerHTML = \`
        <div class="info-item"><span class="label">Issue:</span> #\${data.id}</div>
        <div class="info-item"><span class="label">Assignees:</span> \${data.assignees || 'None'}</div>
        <div class="info-item"><span class="label">Labels:</span> \${data.labels || 'None'}</div>
        <div class="info-item"><span class="label">Depth:</span> \${data.depth}</div>
        <div class="info-item"><span class="label">Criticality:</span> \${data.criticality} dependent(s)</div>
        <div class="info-item"><span class="label">Critical Path:</span> \${data.onCriticalPath ? 'Yes' : 'No'}</div>
        <div class="info-item"><a href="\${data.url}" target="_blank">View on GitHub →</a></div>
      \`;
      document.getElementById('info').classList.add('show');
    });

    function closeInfo() {
      document.getElementById('info').classList.remove('show');
    }

    function resetView() {
      cy.zoom(1);
      cy.center();
    }

    function fitToScreen() {
      cy.fit(null, 50);
    }

    function exportPNG() {
      const png = cy.png({ scale: 2 });
      const link = document.createElement('a');
      link.href = png;
      link.download = 'dependency-graph.png';
      link.click();
    }
  </script>
</body>
</html>`;
  }
}

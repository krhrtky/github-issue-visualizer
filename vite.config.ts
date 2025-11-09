import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'cli/index': resolve(__dirname, 'src/cli/index.ts'),
      },
      formats: ['cjs'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        '@octokit/core',
        '@octokit/graphql',
        '@octokit/rest',
        'commander',
        'cytoscape',
        'dotenv',
        'fs',
        'path',
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});

import nodeResolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import rimraf from 'rimraf';
import { terser } from 'rollup-plugin-terser';
import createHTMLPlugin from './lib/create-html';
import createServiceWorkerPlugin from './lib/create-service-worker';

require('dotenv').config({ path: '.dev.vars' });
require('dotenv').config();

const distDir = 'public';
// Remove ./dist
rimraf.sync(distDir);

function buildConfig({ watch } = {}) {
  const isDev = process.env.BUILD !== 'production';

  const clientId = process.env.CLIENT_ID;
  const apiKey = isDev ? process.env.API_KEY_DEV : process.env.API_KEY_PROD;

  return {
    input: {
      main: 'src/index.js',
    },
    output: {
      dir: distDir,
      format: 'iife',
      sourcemap: watch || 'hidden',
      entryFileNames: '[name]-[hash].js',
      chunkFileNames: '[name]-[hash].js',
    },
    watch: { clearScreen: false },
    plugins: [
      // allows import *.css
      postcss(),

      // resolves in-built node packages like https / fs etc..
      nodeResolve({
        preferBuiltins: true,
        mainFields: ['browser', 'module', 'main'],
      }),

      commonjs(), // allows import to work with commonjs modules that do a module.exports
      // globals(),
      // builtins(),
      !isDev && terser(), // uglify the code if not dev mode
      createHTMLPlugin({ isDev, clientId, apiKey }), // create the index.html
      copy({
        targets: [{ src: 'src/static/*', dest: distDir, dot: true }],
      }),
      createServiceWorkerPlugin(),
    ].filter((item) => item), // filter out unused plugins by filtering out false and null values
  };
}

export default function ({ watch }) {
  return [buildConfig({ watch })];
}

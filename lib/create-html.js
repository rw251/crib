// Custom rollup plugin for creating html pages
import { readFileSync } from 'fs';
import mustache from 'mustache';
import { findHashFromName } from './bundle-utils';
import { version } from '../package.json';

function generateShell(bundle, { templatePath, isDev, clientId, apiKey }) {
  const template = readFileSync(templatePath, 'utf8');
  return mustache.render(template, {
    isProduction: !isDev,
    isDev,
    scriptFile: findHashFromName(bundle, 'main'),
    title: 'Cribdown!',
    version,
    clientId,
    apiKey,
  });
}

export default function createHTMLPlugin({ isDev, clientId, apiKey }) {
  const templatePath = 'src/index.mustache';
  return {
    name: 'create-html-plugin',
    buildStart() {
      this.addWatchFile(templatePath);
    },
    async generateBundle(options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: await generateShell(bundle, { templatePath, isDev, clientId, apiKey }),
      });
      // 404.html is a 'magic' file for http-server so local dev
      // SPA works
      if (isDev) {
        this.emitFile({
          type: 'asset',
          fileName: '404.html',
          source: await generateShell(bundle, { templatePath, isDev, clientId, apiKey }),
        });
      }
    },
  };
}

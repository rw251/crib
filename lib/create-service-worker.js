// Custom rollup plugin for creating the service worker
import { readFileSync } from 'fs';
import mustache from 'mustache';
import { version } from '../package.json';

function generateShell(bundle, { templatePath, resourceList }) {
  const template = readFileSync(templatePath, 'utf8');
  return mustache.render(template, {
    resourceList,
    randomNumber: Math.random(),
    version,
  });
}

export default function createServiceWorkerPlugin() {
  const templatePath = 'src/service-worker.mustache.js';
  return {
    name: 'create-service-worker-plugin',
    buildStart() {
      this.addWatchFile(templatePath);
    },
    async generateBundle(options, bundle) {
      const resourceList = JSON.stringify(Object.keys(bundle));
      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: await generateShell(bundle, { templatePath, resourceList }),
      });
    },
  };
}

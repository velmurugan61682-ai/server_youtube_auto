import express from 'express';
import routes from '../routes/index.mjs';

const app = express();
app.use('/api', routes);

function printRoutes(stack, prefix = '') {
  const routeList = [];

  function walk(layer, pathPrefix) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      methods.forEach(method => {
        routeList.push({
          method,
          path: pathPrefix + layer.route.path,
          fullUrl: `https://server-youtube-auto.onrender.com${pathPrefix}${layer.route.path}`
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let extraPrefix = '';
      if (layer.regexp) {
        const match = layer.regexp.source
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/');
        if (match && match !== '^' && !match.includes('?i')) {
          extraPrefix = match;
        }
      }
      layer.handle.stack.forEach(childLayer => {
        walk(childLayer, pathPrefix + extraPrefix);
      });
    }
  }

  app._router.stack.forEach(layer => walk(layer, ''));
  return routeList;
}

const discovered = printRoutes(app._router.stack);
console.log(JSON.stringify(discovered, null, 2));
console.log(`Total Routes Discovered: ${discovered.length}`);

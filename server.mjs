import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicFiles = new Set(['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'data.json']);
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let name;
  try {
    name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    res.writeHead(400).end('Invalid URL');
    return;
  }
  if (!publicFiles.has(name)) {
    res.writeHead(404).end('Not found');
    return;
  }
  fs.readFile(path.join(root, name), (error, contents) => {
    if (error) {
      res.writeHead(500).end('Unable to read application file');
      return;
    }
    res.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(contents);
  });
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`Fibbage inspector listening on port ${server.address().port}`);
});

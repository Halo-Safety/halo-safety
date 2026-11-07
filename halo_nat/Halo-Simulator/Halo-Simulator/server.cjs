const http = require('node:http');
const { readFileSync } = require('node:fs');
const { networkInterfaces } = require('node:os');
const { join } = require('node:path');

const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/simulator.js': ['simulator.js', 'text/javascript; charset=utf-8'],
};
const port = Number(process.env.PORT || 8080);

http.createServer((request, response) => {
  const asset = assets[request.url];
  if (request.method !== 'GET' || !Object.hasOwn(assets, request.url)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
  response.end(readFileSync(join(__dirname, asset[0])));
}).listen(port, '0.0.0.0', () => {
  console.log('Halo Simulator: http://localhost:' + port);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log('Same Wi-Fi: http://' + address.address + ':' + port);
      }
    }
  }
});

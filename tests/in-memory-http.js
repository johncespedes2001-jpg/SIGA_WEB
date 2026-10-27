'use strict';
const http = require('node:http');
const { Duplex } = require('node:stream');

// Transporta las solicitudes de prueba directamente a Express sin abrir puertos.
module.exports = function createInMemoryFetch(app) {
  const server = http.createServer(app);
  return async function inMemoryFetch(input, options) {
    const request = new Request(input, options);
    const url = new URL(request.url);
    const body = Buffer.from(await request.arrayBuffer());
    class Socket extends Duplex {
      _read() {}
      _write(chunk, encoding, done) { this.peer.push(Buffer.from(chunk)); done(); }
      _final(done) { this.peer.push(null); done(); }
    }
    const client = new Socket();
    const peer = new Socket();
    client.peer = peer;
    peer.peer = client;
    client.remoteAddress = peer.remoteAddress = '127.0.0.1';
    const agent = new http.Agent({ keepAlive: false });
    agent.createConnection = () => client;
    server.emit('connection', peer);
    return new Promise((resolve, reject) => {
      const outgoing = http.request({ hostname: url.hostname, port: 80, path: url.pathname + url.search, method: request.method, headers: Object.fromEntries(request.headers), agent }, (incoming) => {
        const chunks = [];
        incoming.on('data', (chunk) => chunks.push(chunk));
        incoming.on('error', reject);
        incoming.on('end', () => {
          const headers = new Headers();
          for (let index = 0; index < incoming.rawHeaders.length; index += 2) headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
          const content = [204, 205, 304].includes(incoming.statusCode) ? null : Buffer.concat(chunks);
          resolve(new Response(content, { status: incoming.statusCode, headers }));
          agent.destroy();
        });
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  };
};

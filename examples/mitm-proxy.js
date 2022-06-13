'use strict';

var port = 8081;
var net = require('net');
var assert = require('assert');
var Proxy = require('../');
var proxy = Proxy();


// Proxy only

proxy.onConnect(function(req, socket, head, callback) {
  var host = req.url.split(":")[0];
  var port = req.url.split(":")[1];

  // Enable SSL Proxying on this host
  if (host === "httpbin.org") {
    console.log("++++++ HTTPS Intercepting mode: " + host);

    // Must call the callback to tell the proxy core to start intercepting HTTPS Traffic
    callback(null);
  } else {
    console.log("++++++ Proxy mode: " + host);
    console.log('Tunnel to', req.url);
    var conn = net.connect({
      port: port,
      host: host,
      allowHalfOpen: true
    }, function(){
      conn.on('finish', () => {
        socket.destroy();
      });
      socket.on('close', () => {
        conn.end();
      });
      socket.write('HTTP/1.1 200 OK\r\n\r\n', 'UTF-8', function(){
        conn.pipe(socket);
        socket.pipe(conn);
      })
    });

    conn.on('error', function(err) {
      filterSocketConnReset(err, 'PROXY_TO_SERVER_SOCKET');
    });
    socket.on('error', function(err) {
      filterSocketConnReset(err, 'CLIENT_TO_PROXY_SOCKET');
    });

    // Don't call the callback, it will start the proxy mode
  }
});

// Since node 0.9.9, ECONNRESET on sockets are no longer hidden
function filterSocketConnReset(err, socketDescription) {
  if (err.errno === 'ECONNRESET') {
    console.log('Got ECONNRESET on ' + socketDescription + ', ignoring.');
  } else {
    console.log('Got unexpected error on ' + socketDescription, err);
  }
}

// HTTPS

proxy.onRequest(function(ctx, callback) {
  console.log('REQUEST: http://' + ctx.clientToProxyRequest.headers.host + ctx.clientToProxyRequest.url);

  ctx.onRequestData(function(ctx, chunk, callback) {
    console.log('request data length: ' + chunk.length);
    return callback(null, chunk);
  });

  ctx.onResponse(function(ctx, callback) {
    console.log('RESPONSE: http://' + ctx.clientToProxyRequest.headers.host + ctx.clientToProxyRequest.url);
    return callback(null);
  });

  ctx.onResponseData(function(ctx, chunk, callback) {
    console.log('response data length: ' + chunk.length);
    return callback(null, chunk);
  });

  return callback();
});

proxy.listen({ port }, function() {
  console.log('Proxy server listening on ' + port);
});

// src/utils/requestId.js
// Request ID con AsyncLocalStorage para correlación de logs
// Cada request obtiene un UUID único (o reutiliza X-Request-Id del cliente/proxy)
// El contexto se propaga automáticamente por toda la cadena async sin pasarlo explícitamente

const { AsyncLocalStorage } = require('async_hooks');
const nodeCrypto = require('crypto');

const als = new AsyncLocalStorage();

function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || nodeCrypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  als.run({ requestId, method: req.method, path: req.path, ip: req.ip }, () => next());
}

function getStore() {
  return als.getStore();
}

module.exports = { requestIdMiddleware, getStore };

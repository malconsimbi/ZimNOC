/**
 * ZimNOC — Rural Network Operations Intelligence
 * Express.js Backend API
 *
 * REST API following resource-oriented design (api-design-principles skill)
 * Security-first implementation (backend-security-coder skill)
 * Robust error handling (error-handling-patterns skill)
 */

'use strict';

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');
const morgan   = require('morgan');

const app = express();

// ─── SECURITY HEADERS (backend-security-coder) ────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

app.use(express.json({ limit: '64kb' }));   // payload size guard
app.use(morgan('combined'));

// ─── RATE LIMITING ────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Rate limit exceeded, retry after 15 minutes.' },
});

const simLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'TooManyRequests', message: 'Simulation rate limit exceeded.' },
});

app.use('/api/', apiLimiter);

// ─── CUSTOM ERROR CLASSES (error-handling-patterns) ──────────────────
class AppError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name  = this.constructor.name;
    this.code  = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}
class ValidationError extends AppError {
  constructor(message, details) { super(message, 'VALIDATION_ERROR', 400, details); }
}
class NotFoundError extends AppError {
  constructor(resource, id) { super(`${resource} not found`, 'NOT_FOUND', 404, { resource, id }); }
}
class ConflictError extends AppError {
  constructor(message) { super(message, 'CONFLICT', 409); }
}

// ─── IN-MEMORY STORE (replace with DB in production) ─────────────────
let towers = [
  { id:'HRE-001', name:'Harare CBD',     city:'Harare',   status:'online',   load:87, bandwidth:94,  uptime:99.2, subscribers:4820, lat_ms:12, packet_loss:0.1, type:'macro' },
  { id:'HRE-002', name:'Harare North',   city:'Harare',   status:'online',   load:62, bandwidth:71,  uptime:98.8, subscribers:3210, lat_ms:14, packet_loss:0.2, type:'macro' },
  { id:'HRE-003', name:'Chitungwiza',    city:'Harare',   status:'degraded', load:91, bandwidth:45,  uptime:94.1, subscribers:5200, lat_ms:28, packet_loss:1.8, type:'macro' },
  { id:'BYO-001', name:'Bulawayo CBD',   city:'Bulawayo', status:'online',   load:55, bandwidth:82,  uptime:99.5, subscribers:2980, lat_ms:22, packet_loss:0.1, type:'macro' },
  { id:'BYO-002', name:'Bulawayo West',  city:'Bulawayo', status:'online',   load:41, bandwidth:68,  uptime:99.1, subscribers:1840, lat_ms:24, packet_loss:0.3, type:'macro' },
  { id:'GWE-001', name:'Gweru Central',  city:'Gweru',    status:'online',   load:48, bandwidth:61,  uptime:98.3, subscribers:1620, lat_ms:31, packet_loss:0.4, type:'macro' },
  { id:'MTR-001', name:'Mutare CBD',     city:'Mutare',   status:'online',   load:59, bandwidth:74,  uptime:97.9, subscribers:2140, lat_ms:35, packet_loss:0.5, type:'macro' },
  { id:'MSV-001', name:'Masvingo',       city:'Masvingo', status:'online',   load:44, bandwidth:57,  uptime:98.1, subscribers:1390, lat_ms:38, packet_loss:0.6, type:'macro' },
  { id:'KWE-001', name:'Kwekwe',         city:'Kwekwe',   status:'degraded', load:78, bandwidth:38,  uptime:91.2, subscribers:1180, lat_ms:52, packet_loss:3.1, type:'macro' },
  { id:'RUR-001', name:'Binga Rural',    city:'Rural',    status:'online',   load:28, bandwidth:22,  uptime:95.4, subscribers:380,  lat_ms:68, packet_loss:1.2, type:'rural' },
  { id:'RUR-002', name:'Buhera Rural',   city:'Rural',    status:'offline',  load:0,  bandwidth:0,   uptime:0,    subscribers:0,    lat_ms:0,  packet_loss:100, type:'rural' },
  { id:'RUR-003', name:'Gokwe Rural',    city:'Rural',    status:'online',   load:35, bandwidth:19,  uptime:93.7, subscribers:290,  lat_ms:82, packet_loss:2.1, type:'rural' },
  { id:'RUR-004', name:'Chipinge Rural', city:'Rural',    status:'degraded', load:65, bandwidth:14,  uptime:88.3, subscribers:420,  lat_ms:110,packet_loss:5.4, type:'rural' },
];

const simEvents = [];    // audit log for simulation events
const MAX_LOG = 200;

// ─── INPUT VALIDATORS (backend-security-coder) ───────────────────────
const VALID_STATUSES = ['online', 'degraded', 'offline'];
const VALID_TYPES    = ['macro', 'micro', 'rural'];
const ID_PATTERN     = /^[A-Z]{2,5}-\d{3}$/;

function validateTowerId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id))
    throw new ValidationError('Invalid tower ID format', { id, expected: 'e.g. HRE-001' });
}

function validateTowerPatch(body) {
  const allowed = ['status','load','bandwidth','lat_ms','packet_loss','subscribers'];
  const unknown = Object.keys(body).filter(k => !allowed.includes(k));
  if (unknown.length) throw new ValidationError('Unknown fields in patch', { unknown });
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status))
    throw new ValidationError('Invalid status value', { allowed: VALID_STATUSES });
  if (body.load !== undefined && (typeof body.load !== 'number' || body.load < 0 || body.load > 100))
    throw new ValidationError('load must be a number 0–100');
  if (body.bandwidth !== undefined && (typeof body.bandwidth !== 'number' || body.bandwidth < 0))
    throw new ValidationError('bandwidth must be a non-negative number');
}

// ─── DIJKSTRA (pure, no side effects) ────────────────────────────────
const LINKS = [
  { from:'HRE-001', to:'HRE-002', capacity:1000 },
  { from:'HRE-001', to:'HRE-003', capacity:1000 },
  { from:'HRE-001', to:'GWE-001', capacity:622  },
  { from:'GWE-001', to:'BYO-001', capacity:622  },
  { from:'GWE-001', to:'KWE-001', capacity:155  },
  { from:'GWE-001', to:'MSV-001', capacity:155  },
  { from:'HRE-001', to:'MTR-001', capacity:310  },
  { from:'BYO-001', to:'BYO-002', capacity:622  },
  { from:'BYO-001', to:'RUR-001', capacity:34   },
  { from:'MSV-001', to:'RUR-002', capacity:34   },
  { from:'GWE-001', to:'RUR-003', capacity:34   },
  { from:'MTR-001', to:'RUR-004', capacity:34   },
];

function dijkstra(src, dst, liveTowers) {
  const dist = {}, prev = {}, visited = new Set();
  liveTowers.forEach(t => { dist[t.id] = Infinity; prev[t.id] = null; });
  dist[src] = 0;
  const pq = liveTowers.map(t => t.id);
  while (pq.length) {
    pq.sort((a, b) => dist[a] - dist[b]);
    const u = pq.shift();
    if (u === dst) break;
    if (dist[u] === Infinity) break;
    visited.add(u);
    LINKS.filter(l => l.from === u || l.to === u).forEach(link => {
      const v = link.from === u ? link.to : link.from;
      if (visited.has(v)) return;
      const tv = liveTowers.find(t => t.id === v);
      if (!tv || tv.status === 'offline') return;
      const latencyPenalty = (tv.lat_ms || 20) + (1000 / link.capacity) * 5;
      const alt = dist[u] + latencyPenalty;
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    });
  }
  const path = []; let cur = dst;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  return { path, cost: dist[dst] === Infinity ? null : Math.round(dist[dst]) };
}

// ─── ROUTES — REST API (api-design-principles) ────────────────────────

// GET /api/v1/towers
app.get('/api/v1/towers', (req, res) => {
  const { status, city, type, page = 1, limit = 50 } = req.query;
  let result = [...towers];
  if (status) result = result.filter(t => t.status === status);
  if (city)   result = result.filter(t => t.city.toLowerCase() === city.toLowerCase());
  if (type)   result = result.filter(t => t.type === type);
  const total = result.length;
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const paginated = result.slice((p - 1) * l, p * l);
  res.json({
    data: paginated,
    meta: { total, page: p, limit: l, pages: Math.ceil(total / l) },
    _links: { self: `/api/v1/towers?page=${p}`, next: p * l < total ? `/api/v1/towers?page=${p + 1}` : null },
  });
});

// GET /api/v1/towers/:id
app.get('/api/v1/towers/:id', (req, res, next) => {
  try {
    validateTowerId(req.params.id);
    const tower = towers.find(t => t.id === req.params.id);
    if (!tower) throw new NotFoundError('Tower', req.params.id);
    res.json({ data: tower });
  } catch (e) { next(e); }
});

// PATCH /api/v1/towers/:id  — partial update
app.patch('/api/v1/towers/:id', (req, res, next) => {
  try {
    validateTowerId(req.params.id);
    validateTowerPatch(req.body);
    const idx = towers.findIndex(t => t.id === req.params.id);
    if (idx === -1) throw new NotFoundError('Tower', req.params.id);
    towers[idx] = { ...towers[idx], ...req.body };
    res.json({ data: towers[idx] });
  } catch (e) { next(e); }
});

// GET /api/v1/towers/summary — aggregate metrics
app.get('/api/v1/summary', (req, res) => {
  const active = towers.filter(t => t.status !== 'offline');
  res.json({
    data: {
      total: towers.length,
      online:   towers.filter(t => t.status === 'online').length,
      degraded: towers.filter(t => t.status === 'degraded').length,
      offline:  towers.filter(t => t.status === 'offline').length,
      totalSubscribers: towers.reduce((a, t) => a + t.subscribers, 0),
      avgLoad:  Math.round(active.reduce((a, t) => a + t.load, 0) / (active.length || 1)),
      avgLatencyMs: Math.round(active.filter(t=>t.lat_ms>0).reduce((a, t) => a + t.lat_ms, 0) / (active.filter(t=>t.lat_ms>0).length || 1)),
    }
  });
});

// GET /api/v1/route?from=HRE-001&to=BYO-001
app.get('/api/v1/route', (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) throw new ValidationError('Query params "from" and "to" are required');
    validateTowerId(from);
    validateTowerId(to);
    if (from === to) throw new ValidationError('Source and destination must differ');
    const liveTowers = towers.filter(t => t.status !== 'offline');
    const result = dijkstra(from, to, liveTowers);
    if (!result.cost) throw new AppError('No path available — destination unreachable', 'NO_ROUTE', 422, { from, to });
    const pathTowers = result.path.map(id => towers.find(t => t.id === id)).filter(Boolean);
    res.json({
      data: {
        ...result,
        hopCount: result.path.length,
        totalLatencyMs: pathTowers.reduce((a, t) => a + (t.lat_ms || 0), 0),
        pathDetail: pathTowers.map(t => ({ id: t.id, name: t.name, status: t.status, lat_ms: t.lat_ms })),
      }
    });
  } catch (e) { next(e); }
});

// POST /api/v1/simulate/failure  (rate-limited)
app.post('/api/v1/simulate/failure', simLimiter, (req, res, next) => {
  try {
    const { towerId } = req.body;
    if (!towerId || typeof towerId !== 'string') throw new ValidationError('towerId is required');
    validateTowerId(towerId);
    const idx = towers.findIndex(t => t.id === towerId);
    if (idx === -1) throw new NotFoundError('Tower', towerId);
    const prev = towers[idx].status;
    towers[idx] = { ...towers[idx], status:'offline', load:0, bandwidth:0, lat_ms:0, subscribers:0, packet_loss:100 };
    const event = { type:'failure', towerId, prevStatus:prev, ts:new Date().toISOString() };
    simEvents.unshift(event);
    if (simEvents.length > MAX_LOG) simEvents.length = MAX_LOG;
    res.status(201).json({ data: { tower: towers[idx], event } });
  } catch (e) { next(e); }
});

// POST /api/v1/simulate/congestion
app.post('/api/v1/simulate/congestion', simLimiter, (req, res, next) => {
  try {
    const { towerId } = req.body;
    if (!towerId || typeof towerId !== 'string') throw new ValidationError('towerId is required');
    validateTowerId(towerId);
    const idx = towers.findIndex(t => t.id === towerId);
    if (idx === -1) throw new NotFoundError('Tower', towerId);
    towers[idx] = {
      ...towers[idx],
      status: 'degraded',
      load: Math.min(99, towers[idx].load + 25),
      lat_ms: Math.round(towers[idx].lat_ms * 2.5),
      packet_loss: +(towers[idx].packet_loss + 4).toFixed(1),
    };
    const event = { type:'congestion', towerId, ts:new Date().toISOString() };
    simEvents.unshift(event);
    if (simEvents.length > MAX_LOG) simEvents.length = MAX_LOG;
    res.status(201).json({ data: { tower: towers[idx], event } });
  } catch (e) { next(e); }
});

// POST /api/v1/simulate/restore
app.post('/api/v1/simulate/restore', simLimiter, (req, res) => {
  towers = towers.map(t => ({ ...t, status:'online', packet_loss: t.type==='rural'?1.5:0.2 }));
  simEvents.unshift({ type:'restore_all', ts:new Date().toISOString() });
  res.json({ data: { message:'All towers restored', count: towers.length } });
});

// GET /api/v1/events  — simulation audit log
app.get('/api/v1/events', (req, res) => {
  res.json({ data: simEvents.slice(0, 50), meta: { total: simEvents.length } });
});

// GET /api/v1/coverage/gaps
app.get('/api/v1/coverage/gaps', (req, res) => {
  res.json({
    data: [
      { id:'g1', name:'Midlands Desert Zone',  severity:'high',   unservedPopulation:12400, distanceToNearestTowerKm:82 },
      { id:'g2', name:'Eastern Highlands Gap',  severity:'medium', unservedPopulation:7800,  distanceToNearestTowerKm:45 },
      { id:'g3', name:'Mberengwa Dead Zone',    severity:'high',   unservedPopulation:9200,  distanceToNearestTowerKm:68 },
      { id:'g4', name:'Save Valley Fringe',     severity:'low',    unservedPopulation:3400,  distanceToNearestTowerKm:32 },
    ]
  });
});

// GET /api/v1/cidr?notation=192.168.0.0/24
app.get('/api/v1/cidr', (req, res, next) => {
  try {
    const { notation } = req.query;
    if (!notation) throw new ValidationError('notation query param required');
    const [ip, prefix] = notation.split('/');
    const pfx = parseInt(prefix, 10);
    if (isNaN(pfx) || pfx < 0 || pfx > 32) throw new ValidationError('Prefix must be 0–32');
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255))
      throw new ValidationError('Invalid IPv4 address');
    const toIP = n => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
    const ipInt  = parts.reduce((a, b) => ((a << 8) | b) >>> 0);
    const mask   = pfx === 0 ? 0 : (0xFFFFFFFF << (32 - pfx)) >>> 0;
    const net    = (ipInt & mask) >>> 0;
    const bcast  = (net | (~mask >>> 0)) >>> 0;
    const hosts  = pfx >= 31 ? 0 : bcast - net - 1;
    res.json({ data: { network: toIP(net)+'/'+pfx, subnetMask: toIP(mask), broadcast: toIP(bcast), firstHost: toIP(net+1), lastHost: toIP(bcast-1), usableHosts: hosts } });
  } catch (e) { next(e); }
});

// Health check
app.get('/health', (_, res) => res.json({ status:'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).json({ error:'NotFound', message:`Route ${req.method} ${req.path} not found` });
});

// ─── GLOBAL ERROR HANDLER (error-handling-patterns) ──────────────────
app.use((err, req, res, _next) => {
  // Don't leak stack traces in production
  const isDev = process.env.NODE_ENV !== 'production';
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
      timestamp: err.timestamp,
      ...(isDev && { stack: err.stack }),
    });
  }
  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error:'CORS_FORBIDDEN', message: err.message });
  }
  // Unexpected errors — log but don't expose internals
  console.error('[UNHANDLED]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    ...(isDev && { detail: err.message }),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ZimNOC API running on http://localhost:${PORT}`);
  console.log(`  GET  /api/v1/towers          — list all towers`);
  console.log(`  GET  /api/v1/towers/:id       — tower detail`);
  console.log(`  GET  /api/v1/summary          — network KPIs`);
  console.log(`  GET  /api/v1/route?from=&to=  — compute SPF route`);
  console.log(`  POST /api/v1/simulate/failure — inject failure`);
  console.log(`  POST /api/v1/simulate/congestion`);
  console.log(`  POST /api/v1/simulate/restore`);
  console.log(`  GET  /api/v1/coverage/gaps    — gap analysis`);
  console.log(`  GET  /api/v1/cidr?notation=   — CIDR calculator`);
});

module.exports = app; // for testing

const http = require('http');
const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// 7-11 logistics demo credentials (use environment variables in production)
const logisticStoreId = process.env.LOGISTIC_STORE_ID || '3290635';
const logisticKey1 = process.env.LOGISTIC_KEY1 || 'KWWEptKS89EVX2xS';
const logisticKey2 = process.env.LOGISTIC_KEY2 || 'rQw5T7utTGUQXqRK';

// In-memory storage
const users = []; // {id, username, password, points}
const products = [
  {id: 1, name: 'Example Product', price: 100, cost: 80, stock: 10},
];
const sessions = {}; // sessionId -> userId
const carts = {}; // userId -> [{productId, qty}]
const orders = []; // {userId, items, total}
const settings = {name: 'My Shop', logo: '', banner: ''};

function isAdmin(userId) {
  return userId === 1; // first registered user is admin
}

function shipOrder(order) {
  // Placeholder for 7-11 logistics API integration
  console.log('Shipping with store ID', logisticStoreId);
  console.log('Using keys', logisticKey1, logisticKey2);
}

function send(res, status, data, type='application/json') {
  res.writeHead(status, {'Content-Type': type});
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  if (sid && sessions[sid]) {
    return sessions[sid];
  }
  return null;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const pairs = header.split(';').filter(Boolean);
  const out = {};
  for (const p of pairs) {
    const [k, v] = p.trim().split('=');
    out[k] = v;
  }
  return out;
}

function handleRegister(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const {username, password} = querystring.parse(body);
    if (!username || !password) return send(res, 400, {error: 'missing fields'});
    const id = users.length + 1;
    users.push({id, username, password, points: 0});
    send(res, 200, {message: 'registered'});
  });
}

function handleLogin(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const {username, password} = querystring.parse(body);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return send(res, 401, {error: 'invalid credentials'});
    const sid = crypto.randomBytes(16).toString('hex');
    sessions[sid] = user.id;
    res.writeHead(200, {'Set-Cookie': `sid=${sid}; HttpOnly`});
    res.end(JSON.stringify({message: 'logged in'}));
  });
}

function handleProducts(req, res) {
  const q = url.parse(req.url, true).query;
  const term = q.q || '';
  const result = products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));
  send(res, 200, result);
}

function handleAddToCart(req, res) {
  const userId = getSession(req);
  if (!userId) return send(res, 401, {error: 'not logged in'});
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const {productId, qty} = JSON.parse(body || '{}');
    const p = products.find(x => x.id == productId);
    if (!p || p.stock < qty) return send(res, 400, {error: 'invalid product or qty'});
    const cart = carts[userId] = carts[userId] || [];
    cart.push({productId, qty});
    send(res, 200, {message: 'added'});
  });
}

function handleViewCart(req, res) {
  const userId = getSession(req);
  if (!userId) return send(res, 401, {error: 'not logged in'});
  send(res, 200, carts[userId] || []);
}

function handleCheckout(req, res) {
  const userId = getSession(req);
  if (!userId) return send(res, 401, {error: 'not logged in'});
  const cart = carts[userId] || [];
  if (!cart.length) return send(res, 400, {error: 'cart empty'});
  let total = 0;
  for (const item of cart) {
    const p = products.find(x => x.id == item.productId);
    if (!p || p.stock < item.qty) return send(res, 400, {error: 'item unavailable'});
    p.stock -= item.qty;
    total += p.price * item.qty;
  }
  orders.push({userId, items: cart.slice(), total});
  shipOrder({userId, items: cart.slice(), total});
  carts[userId] = [];
  const user = users.find(u => u.id == userId);
  user.points += Math.floor(total / 10);
  send(res, 200, {message: 'checked out', total, points: user.points});
}

function handleAdminProducts(req, res) {
  const userId = getSession(req);
  if (!isAdmin(userId)) return send(res, 403, {error: 'admin only'});

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {name, price, cost, stock} = JSON.parse(body || '{}');
      const id = products.length + 1;
      products.push({id, name, price, cost, stock});
      send(res, 200, {message: 'added'});
    });
  } else if (req.method === 'PUT') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {id, price, cost, stock} = JSON.parse(body || '{}');
      const p = products.find(x => x.id == id);
      if (!p) return send(res, 404, {error: 'not found'});
      if (price !== undefined) p.price = price;
      if (cost !== undefined) p.cost = cost;
      if (stock !== undefined) p.stock = stock;
      send(res, 200, {message: 'updated'});
    });
  } else if (req.method === 'DELETE') {
    const q = url.parse(req.url, true).query;
    const id = q.id;
    const idx = products.findIndex(x => x.id == id);
    if (idx === -1) return send(res, 404, {error: 'not found'});
    products.splice(idx, 1);
    send(res, 200, {message: 'deleted'});
  } else {
    send(res, 200, products);
  }
}

function handleAdminSettings(req, res) {
  const userId = getSession(req);
  if (!isAdmin(userId)) return send(res, 403, {error: 'admin only'});
  if (req.method === 'PUT' || req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {name, logo, banner} = JSON.parse(body || '{}');
      if (name !== undefined) settings.name = name;
      if (logo !== undefined) settings.logo = logo;
      if (banner !== undefined) settings.banner = banner;
      send(res, 200, {message: 'updated'});
    });
  } else {
    send(res, 200, settings);
  }
}

function handleAdminReport(req, res) {
  const userId = getSession(req);
  if (!isAdmin(userId)) return send(res, 403, {error: 'admin only'});
  const totalSales = orders.reduce((acc, o) => acc + o.total, 0);
  send(res, 200, {orders, totalSales});
}

function route(req, res) {
  const parsed = url.parse(req.url);
  if (req.method === 'POST' && parsed.pathname === '/register') return handleRegister(req, res);
  if (req.method === 'POST' && parsed.pathname === '/login') return handleLogin(req, res);
  if (req.method === 'GET' && parsed.pathname === '/products') return handleProducts(req, res);
  if (req.method === 'POST' && parsed.pathname === '/cart') return handleAddToCart(req, res);
  if (req.method === 'GET' && parsed.pathname === '/cart') return handleViewCart(req, res);
  if (req.method === 'POST' && parsed.pathname === '/checkout') return handleCheckout(req, res);
  if (parsed.pathname.startsWith('/admin/products')) return handleAdminProducts(req, res);
  if (parsed.pathname.startsWith('/admin/settings')) return handleAdminSettings(req, res);
  if (parsed.pathname.startsWith('/admin/report')) return handleAdminReport(req, res);
  if (parsed.pathname === '/settings') return send(res, 200, settings);
  send(res, 404, {error: 'not found'});
}

const server = http.createServer(route);
server.listen(PORT, () => console.log(`Server running on ${PORT}`));


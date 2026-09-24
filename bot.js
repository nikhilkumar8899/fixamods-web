// ═══════════════════════════════════════════════════════════
//   FIXAMODS BOT — Complete Server
//   Supports: minutes / hours / days / months
// ═══════════════════════════════════════════════════════════

import axios from "axios";
import http from "http";

// ═══════════════════════════════════════════════════════════
//  ⚙️ YAHAN SIRF 2 CHEEZEIN CHANGE KARO
// ═══════════════════════════════════════════════════════════
const DB_URL  = "https://shalukachalu-5596d-default-rtdb.firebaseio.com";
const API_KEY = "fxa_pI91v07XIqOYNOG0YNuBWtZ7J8HRNuW6C61krizhuRvpygGS";
const PORT    = process.env.PORT || 3000;
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  RANDOM KEY
// ─────────────────────────────────────────────
function randomKey(prefix = "FIXA") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";
  for (let i = 0; i < 12; i++) raw += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
}

// ─────────────────────────────────────────────
//  DURATION PARSER — minutes / hours / days / months
// ─────────────────────────────────────────────
function parseDuration(params) {
  // 1. duration + unit directly
  if (params.duration) {
    const duration = parseInt(params.duration);
    const unit = (params.unit || "days").toLowerCase();
    if (["minutes", "hours", "days", "months"].includes(unit) && duration > 0) {
      return { duration, unit };
    }
  }
  // 2. Direct units
  if (params.months) {
    const m = parseInt(params.months);
    if (m > 0) return { duration: m, unit: "months" };
  }
  if (params.days) {
    const d = parseInt(params.days);
    if (d > 0) return { duration: d, unit: "days" };
  }
  if (params.hours) {
    const h = parseInt(params.hours);
    if (h > 0) return { duration: h, unit: "hours" };
  }
  if (params.minutes) {
    const m = parseInt(params.minutes);
    if (m > 0) return { duration: m, unit: "minutes" };
  }
  // 3. Plan string parse: "30_days", "24_hours", "3_months"
  if (params.plan) {
    const plan = String(params.plan).toLowerCase();
    const match = plan.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|day|days|month|months|mo)/);
    if (match) {
      const num = parseInt(match[1]);
      let unit = match[2];
      if (unit.startsWith("min")) unit = "minutes";
      else if (unit.startsWith("h")) unit = "hours";
      else if (unit.startsWith("mo")) unit = "months";
      else unit = "days";
      if (num > 0) return { duration: num, unit };
    }
  }
  // 4. Default
  return { duration: 30, unit: "days" };
}

// ─────────────────────────────────────────────
//  CREATE KEY
// ─────────────────────────────────────────────
async function createKey(username, duration = 30, unit = "days", deviceLimit = 1) {
  if (!username) return { success: false, error: "Username required" };
  if (!Number.isFinite(duration) || duration < 1) return { success: false, error: "Duration must be 1+" };
  if (!["minutes", "hours", "days", "months"].includes(unit)) return { success: false, error: "Invalid unit" };

  const key = randomKey();
  const now = Date.now();

  const payload = {
    status: "active",
    duration: duration,
    durationUnit: unit,
    deviceLimit: parseInt(deviceLimit) || 1,
    devices: {},
    createdAt: now,
    expiresAt: 0,
    startedAt: 0,
    note: `API: ${username}`,
    lastLogin: 0,
    lastDevice: ""
  };

  try {
    await axios.put(`${DB_URL}/licenses/${key}.json`, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY }
    });
    return {
      success: true,
      key,
      username,
      duration,
      unit,
      deviceLimit: payload.deviceLimit,
      note: payload.note
    };
  } catch (err) {
    let msg = err.message;
    if (err.response?.status === 401 || err.response?.status === 403) {
      msg = "Permission denied — Firebase Rules check karo!";
    } else if (err.response) {
      msg = `HTTP ${err.response.status}`;
    } else if (err.code === "ECONNABORTED") {
      msg = "Timeout — internet check karo";
    }
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────
//  GET KEY
// ─────────────────────────────────────────────
async function getKey(key) {
  try {
    const r = await axios.get(`${DB_URL}/licenses/${key}.json`, { timeout: 10000 });
    if (!r.data) return { success: false, error: "Key not found" };
    return { success: true, data: r.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
//  HTTP SERVER
// ═══════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-KEY");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const p = Object.fromEntries(urlObj.searchParams);

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}${urlObj.search || ""}`);

  // HEALTH
  if (pathname === "/" || pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      service: "FIXAMODS Bot API",
      uptime: Math.floor(process.uptime()) + "s",
      supportedUnits: ["minutes", "hours", "days", "months"]
    }));
    return;
  }

  // GENERATE KEY
  if (pathname === "/generate") {
    const sentKey = p.adminKey || req.headers["x-api-key"] || "";
    if (sentKey && sentKey !== API_KEY) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, error: "Invalid adminKey" }));
      return;
    }

    const username = p.username || p.email || p.uid || p.name || "user";
    const { duration, unit } = parseDuration(p);
    const deviceLimit = parseInt(p.maxDevices || p.devices || "1");

    console.log(`   → Creating: ${username} | ${duration} ${unit} | ${deviceLimit} devices`);

    const result = await createKey(username, duration, unit, deviceLimit);

    if (result.success) {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        key: result.key,
        username: result.username,
        duration: result.duration,
        unit: result.unit,
        deviceLimit: result.deviceLimit,
        message: `Key valid for ${result.duration} ${result.unit} (timer starts on user login)`
      }));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: result.error }));
    }
    return;
  }

  // CHECK KEY
  if (pathname.startsWith("/key/")) {
    const key = decodeURIComponent(pathname.slice(5));
    const r = await getKey(key);
    res.writeHead(r.success ? 200 : 404);
    res.end(JSON.stringify(r));
    return;
  }

  // PARSE DEBUG
  if (pathname === "/parse") {
    const parsed = parseDuration(p);
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      input: p,
      parsed,
      message: `Will create key for ${parsed.duration} ${parsed.unit}`
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║   🚀 FIXAMODS BOT — Server Started          ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`\n🌐 Port: ${PORT}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /generate?username=rahul&days=30`);
  console.log(`   GET  /generate?username=rahul&hours=24`);
  console.log(`   GET  /generate?username=rahul&minutes=30`);
  console.log(`   GET  /generate?username=rahul&months=3`);
  console.log(`   GET  /generate?username=rahul&duration=6&unit=hours`);
  console.log(`   GET  /generate?username=rahul&plan=30_days`);
  console.log(`   GET  /key/:key`);
  console.log(`   GET  /parse?days=30\n`);
  console.log(`✅ Ready!\n`);
});
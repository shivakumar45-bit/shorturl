const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomInt, randomUUID } = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "links.json");
const PUBLIC_DIR = __dirname;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);

let links = [];

start();

async function start() {
  await loadLinks();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      sendJson(response, 500, { error: "Something went wrong on the server." });
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`SwiftLink is running at http://localhost:${PORT}`);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, getBaseUrl(request));

  if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
    await serveStatic(response, STATIC_FILES.get(url.pathname));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/shorten") {
    await createShortLink(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/links") {
    sendJson(response, 200, { links: links.map((link) => toClientLink(link, request)) });
    return;
  }

  if (request.method === "GET") {
    await redirectShortCode(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function createShortLink(request, response) {
  const body = await readJsonBody(request);
  const longUrl = normalizeUrl(String(body.longUrl || "").trim());
  const customAlias = String(body.customAlias || "").trim();

  if (!isValidUrl(longUrl)) {
    sendJson(response, 400, { error: "Enter a valid URL, like https://example.com/page." });
    return;
  }

  const code = customAlias || createCode(longUrl.length <= 20 ? 4 : 5);

  if (!/^[a-zA-Z0-9-]{4,5}$/.test(code)) {
    sendJson(response, 400, { error: "Short code must be 4 to 5 letters, numbers, or hyphens." });
    return;
  }

  if (links.some((link) => link.code.toLowerCase() === code.toLowerCase())) {
    sendJson(response, 409, { error: "That short code is already taken. Try another one." });
    return;
  }

  const link = {
    id: randomUUID(),
    code,
    longUrl,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  links.unshift(link);
  await saveLinks();
  sendJson(response, 201, toClientLink(link, request));
}

async function redirectShortCode(pathname, response) {
  const code = decodeURIComponent(pathname.replace(/^\/+/, ""));

  if (!/^[a-zA-Z0-9-]{4,5}$/.test(code)) {
    await serveStatic(response, "index.html", 404);
    return;
  }

  const link = links.find((item) => item.code.toLowerCase() === code.toLowerCase());

  if (!link) {
    await serveStatic(response, "index.html", 404);
    return;
  }

  link.clicks += 1;
  await saveLinks();
  response.writeHead(302, {
    Location: link.longUrl,
    "Cache-Control": "no-store",
  });
  response.end();
}

async function serveStatic(response, fileName, statusCode = 200) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  const content = await fs.readFile(filePath);
  const extension = path.extname(fileName);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  };

  response.writeHead(statusCode, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  response.end(content);
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;

    if (body.length > 10000) {
      throw new Error("Request body is too large.");
    }
  }

  return body ? JSON.parse(body) : {};
}

function toClientLink(link, request) {
  return {
    id: link.id,
    alias: link.code,
    code: link.code,
    longUrl: link.longUrl,
    shortUrl: `${getBaseUrl(request)}/${encodeURIComponent(link.code)}`,
    clicks: link.clicks,
    createdAt: link.createdAt,
  };
}

function createCode(length) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  if (links.some((link) => link.code.toLowerCase() === code.toLowerCase())) {
    return createCode(length);
  }

  return code;
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

async function loadLinks() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(DB_PATH, "utf8");
    const saved = JSON.parse(content);
    links = Array.isArray(saved) ? saved : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Could not read saved links. Starting with an empty list.");
    }

    links = [];
  }
}

async function saveLinks() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(links, null, 2));
}

function getBaseUrl(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const protocol = forwardedProto ? forwardedProto.split(",")[0] : "http";
  const host = forwardedHost || request.headers.host || `localhost:${PORT}`;

  return `${protocol}://${host}`;
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

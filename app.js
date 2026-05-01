const STORAGE_KEY = "swiftlink.realLinks";

const form = document.querySelector("#shortenerForm");
const longUrlInput = document.querySelector("#longUrl");
const aliasInput = document.querySelector("#customAlias");
const formMessage = document.querySelector("#formMessage");
const pasteButton = document.querySelector("#pasteButton");
const domainPrefix = document.querySelector("#domainPrefix");
const clearButton = document.querySelector("#clearButton");
const emptyResult = document.querySelector("#emptyResult");
const resultCard = document.querySelector("#resultCard");
const shortUrl = document.querySelector("#shortUrl");
const aliasValue = document.querySelector("#aliasValue");
const createdValue = document.querySelector("#createdValue");
const copyButton = document.querySelector("#copyButton");
const openButton = document.querySelector("#openButton");
const historyList = document.querySelector("#historyList");
const historyTemplate = document.querySelector("#historyItemTemplate");
const totalLinks = document.querySelector("#totalLinks");
const totalClicks = document.querySelector("#totalClicks");

let links = loadLinks();
let activeLink = null;

domainPrefix.textContent = getDisplayPrefix();
renderHistory();
renderStats();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const longUrl = normalizeUrl(longUrlInput.value.trim());
  const alias = aliasInput.value.trim() || createAlias();

  if (!isValidUrl(longUrl)) {
    showMessage("Enter a complete URL, like https://example.com/page.", "error");
    longUrlInput.focus();
    return;
  }

  if (!/^[a-zA-Z0-9-]{4,5}$/.test(alias)) {
    showMessage("Aliases must be 4 to 5 letters, numbers, or hyphens.", "error");
    aliasInput.focus();
    return;
  }

  try {
    const response = await fetch("/api/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ longUrl, customAlias: aliasInput.value.trim() }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || "Could not create the short link.", "error");
      return;
    }

    const link = normalizeLink(data);
    links = [link, ...links.filter((item) => item.alias !== link.alias)];
    saveLinks();
    renderResult(link);
    renderHistory();
    renderStats();
    form.reset();
    longUrlInput.focus();
    showMessage("Short link created on the server and ready to share.", "success");
  } catch {
    showMessage("Start the website server first, then open http://localhost:3000.", "error");
  }
});

pasteButton.addEventListener("click", async () => {
  if (!navigator.clipboard?.readText) {
    showMessage("Clipboard paste is not available in this browser.", "error");
    return;
  }

  try {
    longUrlInput.value = await navigator.clipboard.readText();
    longUrlInput.focus();
    showMessage("Pasted from clipboard.", "success");
  } catch {
    showMessage("Allow clipboard access to paste automatically.", "error");
  }
});

copyButton.addEventListener("click", () => {
  if (activeLink) {
    copyToClipboard(getShortUrl(activeLink), copyButton);
  }
});

openButton.addEventListener("click", () => {
  if (activeLink) {
    window.open(activeLink.shortUrl, "_blank", "noopener,noreferrer");
  }
});

clearButton.addEventListener("click", () => {
  links = [];
  activeLink = null;
  saveLinks();
  renderHistory();
  renderStats();
  resultCard.hidden = true;
  emptyResult.hidden = false;
  showMessage("Saved links cleared.", "success");
});

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

function createAlias() {
  const characters = "abcdefghjkmnpqrstuvwxyz23456789";
  const length = longUrlInput.value.trim().length <= 20 ? 4 : 5;
  let alias = "";

  for (let index = 0; index < length; index += 1) {
    alias += characters[Math.floor(Math.random() * characters.length)];
  }

  if (links.some((link) => link.alias.toLowerCase() === alias.toLowerCase())) {
    return createAlias();
  }

  return alias;
}

function getDisplayPrefix() {
  if (window.location.protocol === "file:") {
    return "localhost:3000/";
  }

  return `${window.location.host}/`;
}

function renderResult(link) {
  activeLink = link;
  emptyResult.hidden = true;
  resultCard.hidden = false;
  const displayShortUrl = link.shortUrl;
  shortUrl.textContent = displayShortUrl;
  shortUrl.href = displayShortUrl;
  aliasValue.textContent = link.alias;
  createdValue.textContent = formatDate(link.createdAt);
}

function renderHistory() {
  historyList.textContent = "";
  clearButton.disabled = links.length === 0;

  if (links.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No links yet. Create your first short URL above.";
    historyList.append(empty);
    return;
  }

  links.forEach((link) => {
    const item = historyTemplate.content.firstElementChild.cloneNode(true);
    const historyShort = item.querySelector(".history-short");
    const historyLong = item.querySelector(".history-long");
    const clickCount = item.querySelector(".click-count");
    const copyHistory = item.querySelector(".copy-history");

    const displayShortUrl = link.shortUrl;
    historyShort.textContent = displayShortUrl;
    historyShort.href = displayShortUrl;
    historyLong.textContent = link.longUrl;
    historyLong.title = link.longUrl;
    clickCount.textContent = `${link.clicks} ${link.clicks === 1 ? "open" : "opens"}`;
    copyHistory.addEventListener("click", () => copyToClipboard(displayShortUrl, copyHistory));

    historyList.append(item);
  });
}

function renderStats() {
  totalLinks.textContent = links.length.toString();
  totalClicks.textContent = links.reduce((sum, link) => sum + link.clicks, 0).toString();
}

async function copyToClipboard(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const originalText = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  } catch {
    showMessage("Copy failed. Select the short URL and copy it manually.", "error");
  }
}

function loadLinks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function normalizeLink(link) {
  return {
    id: link.id,
    alias: link.alias || link.code,
    longUrl: link.longUrl,
    shortUrl: link.shortUrl,
    clicks: link.clicks || 0,
    createdAt: link.createdAt,
  };
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function showMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type === "error" ? "error" : ""}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

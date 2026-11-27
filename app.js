"use strict";

let { zitate, banner } = window.mood;
const quoteIntervalMs = 15 * 60_000;
const timeFormat = new Intl.DateTimeFormat("de", { hour: "2-digit", minute: "2-digit" });
const quote = document.querySelector("#quote");
const greeting = document.querySelector("#greeting");
const greetingBanner = greeting.closest(".greeting");
const icon = document.querySelector("#greeting-icon");
const favoriteButtons = document.querySelectorAll("[data-favorite]");
const favoriteStatus = document.querySelector("#favorite-status");

function favoriteRecord(text) {
  try {
    return JSON.parse(localStorage.getItem("mood-favorite:" + text)) ?? {};
  } catch {
    return {};
  }
}

function updateFavorites() {
  for (const button of favoriteButtons) {
    const text = document.getElementById(button.dataset.favorite).textContent;
    const selected = Boolean(favoriteRecord(text).selected);
    button.hidden = !selected && !zitate.includes(text);
    button.setAttribute("aria-pressed", selected);
    button.textContent = selected ? "★ Gefällt mir" : "☆ Gefällt mir";
  }
}

for (const button of favoriteButtons) {
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.favorite).textContent;
    const record = favoriteRecord(text);
    const selected = !record.selected;
    const key = "mood-favorite:" + text;
    button.disabled = true;
    favoriteStatus.textContent = "";
    try {
      const token = record.token ?? crypto.randomUUID();
      localStorage.setItem(key, JSON.stringify({ token, selected: Boolean(record.selected) }));
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: text, token, selected })
      });
      if (!response.ok) throw new Error();
      localStorage.setItem(key, JSON.stringify({ token, selected }));
    } catch {
      favoriteStatus.textContent = "Markierung konnte nicht gespeichert werden. Versuche es erneut.";
    } finally {
      updateFavorites();
      button.disabled = false;
    }
  });
}
window.addEventListener("storage", updateFavorites);
let timer;

const mascots = [
  { kind: "firetruck", image: "knit-firetruck.png", label: "Feuerwehrauto losfahren lassen" },
  { kind: "police", image: "knit-police.png", label: "Blaulicht am Polizeiauto einschalten" },
  { kind: "bee", image: "knit-bee.png", label: "Biene fliegen lassen" }
];
const mascotButton = document.querySelector("#mascot-button");
const mascotImage = document.querySelector("#mascot-image");
function chooseMascot() {
  let index = Math.floor(Math.random() * mascots.length);
  try {
    const previous = localStorage.getItem("mood-mascot");
    const previousIndex = mascots.findIndex(mascot => mascot.kind === previous);
    if (previousIndex >= 0) index = (previousIndex + 1) % mascots.length;
    localStorage.setItem("mood-mascot", mascots[index].kind);
  } catch {
    // A random figure still works when browser storage is unavailable.
  }
  return mascots[index];
}

const activeMascot = chooseMascot();
mascotImage.src = activeMascot.image;
mascotButton.setAttribute("aria-label", activeMascot.label);

mascotButton.addEventListener("click", () => {
  if (document.body.dataset.mascotEffect) return;
  document.body.dataset.mascotEffect = activeMascot.kind;
  setTimeout(() => {
    delete document.body.dataset.mascotEffect;
  }, activeMascot.kind === "bee" ? 1300 : 3000);
});

let afternoonBannerIndex;

function selectBanner(activeHour, day, count) {
  if (activeHour !== 14 || count < 2) return day;
  if (afternoonBannerIndex === undefined) {
    const key = "mood-afternoon-banner";
    afternoonBannerIndex = Math.floor(Math.random() * count);
    try {
      const previous = localStorage.getItem(key);
      const index = Number(previous);
      if (previous !== null && Number.isInteger(index) && index >= 0) {
        afternoonBannerIndex = (index + 1) % count;
      }
      localStorage.setItem(key, String(afternoonBannerIndex));
    } catch {
      // A random banner still works without browser storage.
    }
  }
  return afternoonBannerIndex;
}

function updatePage() {
  clearTimeout(timer);
  const now = new Date();
  const quoteIndex = Math.floor(now.getTime() / quoteIntervalMs);
  const hour = now.getHours();
  document.body.dataset.palette = hour >= 6 && hour < 12 ? "morning" : hour >= 18 || hour < 6 ? "evening" : "day";
  const nextQuote = new Date((quoteIndex + 1) * quoteIntervalMs);
  const message = greetingBanner.hidden ? null : window.moodBannerAt(banner, now, selectBanner);
  const scheduledQuote = zitate[quoteIndex % zitate.length];
  const text = scheduledQuote && scheduledQuote !== boostMessage.textContent
    ? scheduledQuote
    : zitate.find(text => text !== boostMessage.textContent && text !== quote.textContent)
      ?? zitate.find(text => text !== boostMessage.textContent)
      ?? window.mood.zitate.find(text => text !== boostMessage.textContent);

  if (text && quote.textContent !== text) quote.textContent = text;
  if (message && greeting.textContent !== message.text) {
    greeting.textContent = message.text;
    icon.textContent = message.icon;
  }
  document.querySelector("figcaption").textContent = `Nächstes Zitat um ${timeFormat.format(nextQuote)} Uhr`;
  updateFavorites();
  timer = setTimeout(updatePage, nextQuote - now + 50);
}

const boostCard = document.querySelector("#boost-card");
const boostExpandLabel = document.querySelector("#boost-expand-label");
const boostMessage = document.querySelector("#boost-message");
const boostButton = document.querySelector("#boost-button");
const boostLabel = boostButton.textContent;
const lastBoostKey = "mood-last-boost";
const boostCooldownKey = "mood-boost-requested-at";
const previousBoostDeadlineKey = "mood-boost-available-at";
const boostCooldownMs = 5 * 60_000;
let boostAvailableAt = 0;
let boostTimer;

function updateBoostTimer() {
  clearTimeout(boostTimer);
  const seconds = Math.max(0, Math.ceil((boostAvailableAt - Date.now()) / 1000));
  boostButton.disabled = seconds > 0;
  boostButton.hidden = seconds > 0 && boostMessage.hidden;
  if (seconds === 0) {
    boostButton.textContent = boostLabel;
    return;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  boostButton.textContent = `Nächster Boost in ${minutes}:${remainder}`;
  boostTimer = setTimeout(updateBoostTimer, 1000);
}

function syncBoostTimer() {
  try {
    const requestedAt = Number(localStorage.getItem(boostCooldownKey))
      || Number(localStorage.getItem(previousBoostDeadlineKey)) - 15 * 60_000;
    boostAvailableAt = Math.max(boostAvailableAt, requestedAt + boostCooldownMs);
  } catch {
    // Keep the in-memory deadline if browser storage is unavailable.
  }
  updateBoostTimer();
}

function setBoostExpanded(expanded) {
  boostCard.setAttribute("aria-expanded", expanded);
  boostMessage.hidden = !expanded;
  boostExpandLabel.hidden = expanded;
  updateBoostTimer();
}

boostCard.addEventListener("click", () => setBoostExpanded(boostMessage.hidden));

function showBoost(text) {
  boostMessage.textContent = text;
  boostCard.hidden = false;
  if (quote.textContent === text) updatePage();
}

function restoreBoost() {
  try {
    const text = localStorage.getItem(lastBoostKey);
    if (text && text !== boostMessage.textContent) showBoost(text);
  } catch {
    // The current boost stays visible when browser storage is unavailable.
  }
}

boostButton.addEventListener("click", () => {
  syncBoostTimer();
  if (boostButton.disabled) return;

  const available = [...new Set(zitate)].filter(text => text !== quote.textContent);
  const extras = available.length
    ? available
    : window.mood.zitate.filter(text => text !== quote.textContent);
  const fresh = extras.filter(text => text !== boostMessage.textContent);
  const options = fresh.length ? fresh : extras;
  const text = options[Math.floor(Math.random() * options.length)];

  const requestedAt = Date.now();
  boostAvailableAt = requestedAt + boostCooldownMs;
  try {
    localStorage.setItem(boostCooldownKey, String(requestedAt));
    localStorage.setItem(lastBoostKey, text);
  } catch {
    // The timer still runs while this page stays open.
  }
  setBoostExpanded(true);
  showBoost(text);
});

updatePage();
setTimeout(() => {
  greetingBanner.hidden = true;
}, 5000);
syncBoostTimer();
restoreBoost();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  updatePage();
  syncBoostTimer();
  restoreBoost();
});
window.addEventListener("pageshow", () => {
  updatePage();
  syncBoostTimer();
  restoreBoost();
});
window.addEventListener("storage", event => {
  if (event.key === boostCooldownKey || event.key === null) syncBoostTimer();
  if (event.key === lastBoostKey) restoreBoost();
});

if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) {
  document.documentElement.classList.add("standalone");
  const indicator = document.querySelector("#pull-refresh");
  const threshold = 80;
  let start;
  let distance = 0;

  function resetPull() {
    start = undefined;
    distance = 0;
    indicator.hidden = true;
  }

  document.addEventListener("touchstart", event => {
    resetPull();
    if (window.scrollY > 0 || event.touches.length !== 1 || document.querySelector("dialog[open]")) return;
    start = event.touches[0];
  }, { passive: true });

  document.addEventListener("touchmove", event => {
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const vertical = touch.clientY - start.clientY;
    const horizontal = Math.abs(touch.clientX - start.clientX);
    if (vertical < -8 || (horizontal > 8 && horizontal > vertical)) {
      resetPull();
      return;
    }
    distance = Math.max(0, vertical);
    if (distance > 4 && distance >= horizontal && event.cancelable) event.preventDefault();
    indicator.hidden = distance < 12;
    if (indicator.hidden) return;
    indicator.style.setProperty("--pull-offset", `${Math.min(distance / 3, 32)}px`);
    indicator.textContent = distance >= threshold ? "Loslassen zum Aktualisieren" : "Zum Aktualisieren ziehen";
  }, { passive: false });

  document.addEventListener("touchend", () => {
    const shouldReload = distance >= threshold;
    resetPull();
    if (shouldReload) location.reload();
  }, { passive: true });
  document.addEventListener("touchcancel", resetPull, { passive: true });
}

// The server exposes this endpoint. The existing GitHub Pages site uses its bundled texts.
if (location.pathname === "/" || location.pathname === "/index.html") {
  async function refreshContent() {
    try {
      const response = await fetch("/api/content");
      if (!response.ok) return;
      const content = await response.json();
      ({ zitate, banner } = content ?? window.mood);
      updatePage();
    } catch {
      // Keep displaying the last available texts across temporary outages.
    }
  }
  refreshContent();
  setInterval(refreshContent, 10000);
}

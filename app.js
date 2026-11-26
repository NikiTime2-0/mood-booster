"use strict";

const { zitate, banner } = window.mood;
const hourMs = 3_600_000;
const hourFormat = new Intl.DateTimeFormat("de", { hour: "2-digit", minute: "2-digit" });
const quote = document.querySelector("#quote");
const greeting = document.querySelector("#greeting");
const icon = document.querySelector("#greeting-icon");
let timer;

function updatePage() {
  clearTimeout(timer);
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const hour = now.getHours();
  const hourIndex = day * 24 + hour;
  const nextHour = new Date(now.getTime() + hourMs - (now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds()));
  const activeHour = Math.max(...banner.filter(item => item.ab <= hour).map(item => item.ab));
  const messages = banner.filter(item => item.ab === activeHour);
  const message = messages[day % messages.length];
  const text = zitate[hourIndex % zitate.length];

  if (text && quote.textContent !== text) quote.textContent = text;
  if (message && greeting.textContent !== message.text) {
    greeting.textContent = message.text;
    icon.textContent = message.icon;
  }
  document.querySelector("figcaption").textContent = `Nächstes Zitat um ${hourFormat.format(nextHour)} Uhr`;
  timer = setTimeout(updatePage, nextHour - now + 50);
}

updatePage();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updatePage();
});
window.addEventListener("pageshow", updatePage);

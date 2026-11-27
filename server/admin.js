"use strict";

const editor = document.querySelector("#editor");
const quotes = document.querySelector("#quotes");
const banners = document.querySelector("#banners");
const status = document.querySelector("#save-status");
const previewTime = document.querySelector("#preview-time");
const preview = document.querySelector("#banner-preview");
const undo = document.querySelector("#undo-publish");

async function refreshHistory() {
  const response = await fetch("/api/content/history");
  undo.hidden = !response.ok || !(await response.json()).available;
}

async function refreshFavoriteQuotes() {
  const status = document.querySelector("#favorites-status");
  try {
    const response = await fetch("/api/favorites/stats");
    if (!response.ok) throw new Error();
    const entries = await response.json();
    status.textContent = entries.length ? "" : "Noch keine Markierungen.";
    document.querySelector("#favorite-quotes").replaceChildren(...entries.map(({ quote, count }) => {
      const item = document.createElement("li");
      item.textContent = `${quote} · ${count}×`;
      return item;
    }));
  } catch {
    status.textContent = "Markierungen konnten nicht geladen werden.";
  } finally {
    setTimeout(refreshFavoriteQuotes, 10000);
  }
}


function readBanners() {
  return Array.from(banners.children, row => {
    const [hour, text] = row.querySelectorAll("input");
    return { ab: hour.valueAsNumber, icon: row.dataset.icon, text: text.value.trim() };
  });
}

function updatePreview() {
  if (!previewTime.value) {
    preview.textContent = "Wähle eine Uhrzeit.";
    return;
  }
  const date = new Date();
  const [hour, minute] = previewTime.value.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  const active = readBanners().filter(item => Number.isInteger(item.ab)
    && item.ab >= 0 && item.ab <= 23 && item.text);
  const message = window.moodBannerAt(active, date);
  preview.textContent = message ? `${message.icon} ${message.text}` : "Für diese Uhrzeit gibt es kein Banner.";
}


function addRow(parent, fields) {
  const row = document.createElement("div");
  row.className = "row";
  for (const field of fields) {
    const input = document.createElement("input");
    const { label, ...attributes } = field;
    Object.assign(input, attributes);
    input.setAttribute("aria-label", label);
    row.append(input);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Entfernen";
  remove.addEventListener("click", () => {
    row.remove();
    if (parent === banners) updatePreview();
  });
  row.append(remove);
  parent.append(row);
}

function addQuote(value = "") {
  addRow(quotes, [{ label: "Zitat", type: "text", value, required: true, maxLength: 500 }]);
}

function addBanner({ ab = 0, text = "", icon = "✦" } = {}) {
  addRow(banners, [
    { label: "Startstunde von 0 bis 23", type: "number", value: ab, min: 0, max: 23, required: true },
    { label: "Bannertext", type: "text", value: text, required: true, maxLength: 500 }
  ]);
  banners.lastElementChild.dataset.icon = icon;
}

async function loadEditor() {
  const response = await fetch("/api/content");
  if (!response.ok) throw new Error("Die Texte konnten nicht geladen werden.");
  const content = await response.json() ?? window.mood;
  quotes.replaceChildren();
  banners.replaceChildren();
  content.zitate.forEach(addQuote);
  content.banner.forEach(addBanner);
  const now = new Date();
  previewTime.value = [now.getHours(), now.getMinutes()].map(value => String(value).padStart(2, "0")).join(":");
  updatePreview();
  editor.hidden = false;
  await refreshHistory().catch(() => { undo.hidden = true; });
}

const visitStatus = document.querySelector("#visit-status");
const visits = document.querySelector("#visits");

async function refreshVisits() {
  try {
    const response = await fetch("/api/visits");
    if (!response.ok) throw new Error();
    const times = await response.json();
    visitStatus.textContent = times.length ? "Letzte 20 Aufrufe · aktualisiert alle zwei Sekunden" : "Noch keine Aufrufe";
    visits.replaceChildren(...times.slice(0, 20).map(visit => {
      const item = document.createElement("li");
      const { time, device, label } = typeof visit === "string" ? { time: visit } : visit;
      const timestamp = new Date(time).toLocaleString("de-DE");
      item.textContent = [timestamp, label, device].filter(Boolean).join(" · ");
      return item;
    }));
  } catch {
    visitStatus.textContent = "Aufrufe konnten nicht geladen werden. Erneuter Versuch läuft.";
  } finally {
    setTimeout(refreshVisits, 2000);
  }
}

document.querySelector("#add-quote").addEventListener("click", () => addQuote());
document.querySelector("#add-banner").addEventListener("click", () => {
  addBanner();
  updatePreview();
});
banners.addEventListener("input", updatePreview);
previewTime.addEventListener("input", updatePreview);

editor.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = editor.querySelector("button[type=submit]");
  submit.disabled = true;
  const data = {
    zitate: Array.from(quotes.querySelectorAll("input"), input => input.value.trim()),
    banner: readBanners()
  };
  try {
    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    status.textContent = response.ok ? "Veröffentlicht." : await response.text() || "Speichern fehlgeschlagen.";
    if (response.ok) await refreshHistory().catch(() => { undo.hidden = true; });
  } catch {
    status.textContent = "Keine Verbindung. Bitte erneut versuchen.";
  } finally {
    submit.disabled = false;
  }
});

undo.addEventListener("click", async () => {
  if (!window.confirm("Vorherige Veröffentlichung wiederherstellen? Ungespeicherte Eingaben gehen dabei verloren.")) return;
  const submit = editor.querySelector("button[type=submit]");
  undo.disabled = submit.disabled = true;
  try {
    const response = await fetch("/api/content/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error();
    await loadEditor();
    status.textContent = "Vorherige Version wiederhergestellt.";
  } catch {
    status.textContent = "Wiederherstellen fehlgeschlagen. Prüfe die Texte nach dem Neuladen.";
  } finally {
    undo.disabled = submit.disabled = false;
  }
});

loadEditor().catch(error => {
  editor.hidden = false;
  editor.querySelector("button[type=submit]").disabled = true;
  status.textContent = error.message;
});
refreshVisits();
refreshFavoriteQuotes();

async function refreshDollPoll() {
  const result = document.querySelector("#doll-poll-stats");
  try {
    const response = await fetch("/api/doll-poll/stats");
    if (!response.ok) throw new Error();
    const { yes, no } = await response.json();
    result.textContent = `Ja: ${yes} · Nein: ${no}`;
  } catch {
    result.textContent = "Ergebnis konnte nicht geladen werden.";
  }
}
refreshDollPoll();
setInterval(refreshDollPoll, 10000);

async function refreshCatNames() {
  const message = document.querySelector("#cat-names-status");
  const list = document.querySelector("#cat-names");
  try {
    const response = await fetch("/api/cat-name/suggestions");
    if (!response.ok) throw new Error();
    const names = await response.json();
    list.replaceChildren(...names.map(({ name }) => {
      const item = document.createElement("li");
      item.textContent = name;
      return item;
    }));
    message.textContent = names.length ? "" : "Noch keine Vorschläge.";
  } catch {
    message.textContent = "Namensvorschläge konnten nicht geladen werden.";
  }
}
refreshCatNames();
setInterval(refreshCatNames, 10000);

const shelfAdminStatus = document.querySelector("#shelf-admin-status");
const shelfRefill = document.querySelector("#shelf-refill");
const shelfAdminMessage = document.querySelector("#shelf-admin-message");
let shelfAdminBusy = false;

async function updateShelfAdmin(refill = false) {
  if (shelfAdminBusy) return;
  shelfAdminBusy = true;
  try {
    if (refill) {
      shelfRefill.disabled = true;
      const result = await fetch("/api/cat-shelf/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!result.ok) throw new Error();
      const { refilled } = await result.json();
      shelfAdminMessage.textContent = refilled ? "Drei neue Leckerlis pro leerem Regal bereitgestellt." : "Kein leeres Regal gefunden.";
    }
    const result = await fetch("/api/cat-shelf/admin");
    if (!result.ok) throw new Error();
    const { empty } = await result.json();
    shelfAdminStatus.textContent = empty === 1 ? "1 Regal ist leer." : `${empty} Regale sind leer.`;
    shelfRefill.disabled = empty === 0;
  } catch {
    shelfAdminStatus.textContent = "Leckerli-Regale konnten nicht abgerufen oder aufgefüllt werden.";
  } finally {
    shelfAdminBusy = false;
  }
}
shelfRefill.addEventListener("click", () => updateShelfAdmin(true));
updateShelfAdmin();
setInterval(updateShelfAdmin, 5000);

const deviceForm = document.querySelector("#named-device-form");
const deviceLabel = document.querySelector("#named-device-label");
const deviceStatus = document.querySelector("#named-device-status");
const deviceSave = deviceForm.querySelector("button");

async function loadDeviceLabel() {
  try {
    const response = await fetch("/api/named-device");
    if (!response.ok) throw new Error();
    const { label } = await response.json();
    if (label && !deviceLabel.value) deviceLabel.value = label;
  } catch {
    deviceStatus.textContent = "Gespeicherter Gerätename konnte nicht geladen werden.";
  }
}

deviceForm.addEventListener("submit", async event => {
  event.preventDefault();
  const label = deviceLabel.value.trim();
  if (!label) {
    deviceStatus.textContent = "Gib zuerst einen Gerätenamen ein.";
    return;
  }
  deviceSave.disabled = true;
  try {
    const response = await fetch("/api/named-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    });
    if (!response.ok) throw new Error();
    deviceLabel.value = (await response.json()).label;
    deviceStatus.textContent = "Gespeichert. Der Name erscheint ab dem nächsten Seitenaufruf.";
  } catch {
    deviceStatus.textContent = "Der Gerätename konnte nicht gespeichert werden.";
  } finally {
    deviceSave.disabled = false;
  }
});
loadDeviceLabel();

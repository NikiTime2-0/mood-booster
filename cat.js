const catLauncher = document.querySelector("#cat-launcher");
const catDialog = document.querySelector("#cat-dialog");
const cat = document.querySelector("#cat-pet");
const catStatus = document.querySelector("#cat-status");

catLauncher.addEventListener("click", () => catDialog.showModal());
catDialog.addEventListener("close", () => catLauncher.focus());

const petReactions = {
  head: "Die Katze schnurrt.",
  back: "Die Katze schnurrt ganz leise.",
  paws: "Die Katze zieht kitzlig die Pfoten an.",
  tail: "Vorsicht, hier nicht!"
};
let strokeSpot;

function petCat(spot, message = petReactions[spot.dataset.catSpot]) {
  catStatus.textContent = message;
  delete cat.dataset.reaction;
  spot.classList.remove("cat-touched");
  void spot.offsetWidth;
  spot.classList.add("cat-touched");
  cat.dataset.reaction = spot.dataset.catSpot;
}

for (const spot of cat.querySelectorAll("[data-cat-spot]")) {
  spot.addEventListener("click", event => {
    if (event.detail === 0 || spot !== strokeSpot) petCat(spot);
    strokeSpot = null;
  });
}

cat.addEventListener("pointerdown", () => { strokeSpot = null; });
cat.addEventListener("pointercancel", () => { strokeSpot = null; });

cat.addEventListener("pointermove", event => {
  if (event.pointerType === "mouse" && !(event.buttons & 1)) return;
  if (event.pointerType === "pen" && event.pressure === 0) return;
  const spot = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cat-spot]");
  if (spot === strokeSpot) return;
  strokeSpot = spot && cat.contains(spot) ? spot : null;
  if (strokeSpot) petCat(strokeSpot);
});

const poll = document.querySelector("#doll-poll");
const pollButtons = [...poll.querySelectorAll("button")];
const pollStatus = document.querySelector("#poll-status");
let voteToken;
let savedVote;
try {
  const saved = JSON.parse(localStorage.getItem("mood-doll-poll"));
  voteToken = saved?.token;
  savedVote = saved?.vote;
} catch {
  // Voting also works for this page when storage is unavailable.
}

function showVote() {
  for (const button of pollButtons) button.setAttribute("aria-pressed", button.value === savedVote);
}
showVote();

for (const button of pollButtons) {
  button.addEventListener("click", async () => {
    voteToken ??= crypto.randomUUID();
    for (const option of pollButtons) option.disabled = true;
    try {
      try {
        localStorage.setItem("mood-doll-poll", JSON.stringify({ token: voteToken, vote: savedVote }));
      } catch {
        // Keep the token in memory.
      }
      const response = await fetch("/api/doll-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: voteToken, vote: button.value })
      });
      if (!response.ok) throw new Error();
      savedVote = button.value;
      showVote();
      pollStatus.textContent = "Stimme gespeichert.";
      try {
        localStorage.setItem("mood-doll-poll", JSON.stringify({ token: voteToken, vote: savedVote }));
      } catch {
        // The vote was saved on the server.
      }
    } catch {
      pollStatus.textContent = "Speichern fehlgeschlagen. Versuch es erneut.";
    } finally {
      for (const option of pollButtons) option.disabled = false;
    }
  });
}

const treats = [...document.querySelectorAll(".cat-treat")];
const catHead = cat.querySelector('[data-cat-spot="head"]');
const shelfHint = document.querySelector("#cat-shelf-hint");
const shelfNote = document.querySelector("#cat-shelf-note");
const treatStorageKey = "mood-cat-treats-used";
let treatsUsed = 0;
let treatDrag;
let shelfBusy = false;
let shelfToken;
try {
  const stored = Number(localStorage.getItem(treatStorageKey));
  if (Number.isInteger(stored)) treatsUsed = Math.max(0, Math.min(treats.length, stored));
  shelfToken = localStorage.getItem("mood-cat-shelf");
} catch {
  // Keep the shelf token in memory when storage is unavailable.
}
if (!shelfToken) {
  shelfToken = crypto.randomUUID();
  try { localStorage.setItem("mood-cat-shelf", shelfToken); } catch {}
}

function updateShelf(consumed) {
  if (consumed) consumed.hidden = true;
  if (treats.filter(treat => !treat.hidden).length !== treats.length - treatsUsed) {
    treats.forEach((treat, index) => { treat.hidden = index >= treats.length - treatsUsed; });
  }
  shelfHint.hidden = treatsUsed === treats.length;
  shelfNote.hidden = treatsUsed < treats.length;
}
updateShelf();

async function syncShelf(treat, keepFocus = false) {
  if (shelfBusy || treatDrag || treat?.hidden) return;
  shelfBusy = true;
  try {
    const response = await fetch("/api/cat-shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: shelfToken, initialUsed: treatsUsed, feed: Boolean(treat) })
    });
    if (!response.ok) throw new Error();
    const { used, fed } = await response.json();
    treatsUsed = used;
    try { localStorage.setItem(treatStorageKey, String(used)); } catch {}
    if (fed) petCat(catHead, "Knusper! Die Katze futtert das Leckerli.");
    updateShelf(fed ? treat : undefined);
    if (keepFocus && fed) (treats.find(item => !item.hidden) ?? catHead).focus();
  } catch {
    if (treat) catStatus.textContent = "Das Leckerli konnte nicht gegeben werden. Versuch es noch einmal.";
  } finally {
    shelfBusy = false;
  }
}

let shelfTimer;
catLauncher.addEventListener("click", () => {
  syncShelf();
  shelfTimer = setInterval(() => syncShelf(), 5000);
});
catDialog.addEventListener("close", () => clearInterval(shelfTimer));

function nearMouth(event) {
  const bounds = cat.getBoundingClientRect();
  const mouthX = bounds.left + bounds.width * .19;
  const mouthY = bounds.top + bounds.height * .34;
  return Math.hypot(event.clientX - mouthX, event.clientY - mouthY) <= 32;
}

function finishTreatDrag() {
  const { treat } = treatDrag;
  treat.classList.remove("is-dragging");
  treat.style.removeProperty("transform");
  treatDrag = undefined;
  cat.classList.remove("cat-mouth-ready");
}

for (const treat of treats) {
  treat.addEventListener("pointerdown", event => {
    if (shelfBusy || treatDrag || event.button !== 0 || !event.isPrimary) return;
    treatDrag = { treat, id: event.pointerId, x: event.clientX, y: event.clientY };
    treat.setPointerCapture(event.pointerId);
    treat.classList.add("is-dragging");
  });
  treat.addEventListener("pointermove", event => {
    if (treatDrag?.id !== event.pointerId) return;
    treat.style.transform = `translate(${event.clientX - treatDrag.x}px, ${event.clientY - treatDrag.y}px)`;
    cat.classList.toggle("cat-mouth-ready", nearMouth(event));
  });
  treat.addEventListener("pointerup", event => {
    if (treatDrag?.id !== event.pointerId) return;
    const atMouth = nearMouth(event);
    finishTreatDrag();
    if (atMouth) syncShelf(treat);
  });
  treat.addEventListener("lostpointercapture", event => {
    if (treatDrag?.id === event.pointerId) finishTreatDrag();
  });
  treat.addEventListener("click", event => {
    if (event.detail === 0) syncShelf(treat, true);
  });
}

const nameForm = document.querySelector("#cat-name-form");
const nameField = document.querySelector("#cat-name");
const nameStatus = document.querySelector("#cat-name-status");
const nameSubmit = nameForm.querySelector('button[type="submit"]');
const nameStorageKey = "mood-cat-name";
let nameToken;
try {
  const saved = JSON.parse(localStorage.getItem(nameStorageKey));
  nameToken = saved?.token;
  nameField.value = saved?.name ?? "";
} catch {
  // Suggestions still work for this page without browser storage.
}

nameForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = nameField.value.trim();
  if (!name) {
    nameStatus.textContent = "Gib zuerst einen Namen ein.";
    return;
  }
  nameToken ??= crypto.randomUUID();
  nameSubmit.disabled = true;
  try {
    const response = await fetch("/api/cat-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: nameToken, name })
    });
    if (!response.ok) throw new Error();
    nameStatus.textContent = "Vorschlag gespeichert.";
    try {
      localStorage.setItem(nameStorageKey, JSON.stringify({ token: nameToken, name }));
    } catch {
      // The suggestion was saved on the server.
    }
  } catch {
    nameStatus.textContent = "Speichern fehlgeschlagen. Versuch es erneut.";
  } finally {
    nameSubmit.disabled = false;
  }
});

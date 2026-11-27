const dollTemplate = document.createElement('template');
dollTemplate.innerHTML = `
  <button class="doll-launcher" type="button" aria-label="Stoffpuppe öffnen" aria-haspopup="dialog">
    <span class="doll-icon" aria-hidden="true"></span>
  </button>
  <dialog class="doll-dialog" aria-labelledby="doll-title">
    <form method="dialog">
      <button class="doll-close" type="submit" aria-label="Schließen">×</button>
    </form>
    <h2 id="doll-title">No One in Particular</h2>
    <p>Einmal den Frust abtippen.</p>
    <button class="doll-toy" type="button" aria-label="Stoffpuppe antippen">
      <span class="doll-part doll-leg doll-leg-left"></span>
      <span class="doll-part doll-leg doll-leg-right"></span>
      <span class="doll-part doll-arm doll-arm-left"></span>
      <span class="doll-part doll-arm doll-arm-right"></span>
      <span class="doll-part doll-body"></span>
      <span class="doll-part doll-head">
        <span class="doll-hair"></span>
        <span class="doll-eyes"></span>
        <span class="doll-mouth"></span>
      </span>
    </button>
    <span class="doll-status" role="status"></span>
  </dialog>
`;

const doll = dollTemplate.content.cloneNode(true);
const launcher = doll.querySelector('.doll-launcher');
const dialog = doll.querySelector('.doll-dialog');
const toy = doll.querySelector('.doll-toy');
const body = doll.querySelector('.doll-body');
const status = doll.querySelector('.doll-status');
const marks = [];

launcher.addEventListener('click', () => dialog.showModal());
dialog.addEventListener('close', () => launcher.focus());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});

toy.addEventListener('click', (event) => {
  const hit = event.target.closest('.doll-part');
  const part = hit || body;
  const bounds = part.getBoundingClientRect();
  const mark = document.createElement('span');
  const isTear = Math.random() < 0.4;
  mark.className = isTear ? 'doll-mark doll-tear' : 'doll-mark doll-bruise';
  mark.setAttribute('aria-hidden', 'true');
  const x = hit ? (event.clientX - bounds.left) / bounds.width : 0.5;
  const y = hit ? (event.clientY - bounds.top) / bounds.height : 0.5;
  mark.style.left = `${Math.min(0.82, Math.max(0.18, x)) * 100}%`;
  mark.style.top = `${Math.min(0.85, Math.max(0.15, y)) * 100}%`;
  part.append(mark);
  marks.push(mark);
  if (marks.length > 16) marks.shift().remove();
  status.textContent = isTear ? 'Eine Naht ist aufgegangen.' : 'Ein blauer Fleck ist zu sehen.';
});

document.body.append(doll);

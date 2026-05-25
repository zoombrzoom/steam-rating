import { Field, IconsModule, Millennium, definePlugin } from '@steambrew/client';

const NS = 'sr';
const STORE_PREFIX = 'steam-rating:v2:';
const COMPLETED_PREFIX = 'steam-rating:completed:v1:';
const LEGACY_PREFIX = 'steam-rating:v1:';
const APP_ID_REGEX = /\/(?:steam\/apps|apps|assets)\/(\d+)(?:\/|$)|\/customimages\/(\d+)[^/]*(?:[?#]|$)/i;
const STAR_PATH = 'M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.3L12 17.8l-6.4 3.9 1.7-7.3-5.6-4.9 7.4-.6L12 2z';
const CHECK_PATH = 'M8 12.4l2.5 2.6L16.5 9';

const CSS = `
:root {
  --sr-star-fill: #ffffff;
  --sr-star-empty: rgba(255, 255, 255, 0.16);
  --sr-star-outline: rgba(255, 255, 255, 0.86);
  --sr-star-hover: #ffffff;
  --sr-focus: rgba(102, 192, 244, 0.75);
}
.sr-card-host {
  position: relative !important;
  overflow: hidden !important;
}
.sr-rating-row {
  box-sizing: border-box;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 24px;
  min-height: 24px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  pointer-events: auto;
  z-index: 2147483647;
  background: transparent;
}
.sr-rating-row *, .sr-rating-row *::before, .sr-rating-row *::after { box-sizing: border-box; }
.sr-rating-dock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 24px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(11, 15, 22, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
.sr-stars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  height: 18px;
}
.sr-stars:focus-visible, .sr-complete:focus-visible { outline: 2px solid var(--sr-focus); outline-offset: 2px; }
.sr-star, .sr-complete {
  appearance: none;
  -webkit-appearance: none;
  height: 18px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
}
.sr-star { width: 18px; }
.sr-star svg, .sr-complete svg {
  width: 18px;
  height: 18px;
  display: block;
  filter: none;
}
.sr-star:hover svg, .sr-complete:hover svg { transform: scale(1.05); }
.sr-star-empty {
  fill: var(--sr-star-empty);
  stroke: var(--sr-star-outline);
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.sr-star-fill {
  fill: var(--sr-star-fill);
  stroke: rgba(0, 0, 0, 0.22);
  stroke-width: 0.5;
  stroke-linejoin: round;
}
.sr-rating-row[data-preview="true"] .sr-star-fill { fill: var(--sr-star-hover); }
.sr-complete {
  width: auto;
  min-width: 18px;
  gap: 2px;
  margin-left: 2px;
  opacity: 0.58;
  color: #ffffff;
  font: 700 10px/1 Arial, sans-serif;
}
.sr-complete svg {
  flex: 0 0 18px;
}
.sr-complete-box {
  fill: rgba(255, 255, 255, 0.08);
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 1.4;
}
.sr-complete-check {
  fill: none;
  stroke: #ffffff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
  opacity: 0.38;
}
.sr-complete-count {
  display: none;
  min-width: 12px;
  text-align: left;
  color: #ffffff;
  opacity: 0.92;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}
.sr-complete[data-completed-count]:not([data-completed-count="0"]):not([data-completed-count="1"]) .sr-complete-count {
  display: inline-block;
}
.sr-complete[data-completed="true"] {
  opacity: 1;
}
.sr-complete[data-completed="true"] .sr-complete-box {
  fill: rgba(255, 255, 255, 0.18);
  stroke: #ffffff;
}
.sr-complete[data-completed="true"] .sr-complete-check {
  opacity: 1;
}
`;

type WindowWithRatingState = Window & {
  __STEAM_RATING_FRONTEND__?: {
    destroy: () => void;
  };
};

function clampRating(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, Math.round(number * 2) / 2));
}

function readRating(win: Window, appId: string) {
  try {
    const stored = win.localStorage.getItem(STORE_PREFIX + appId);
    if (stored !== null) return clampRating(JSON.parse(stored));

    const legacy = win.localStorage.getItem(LEGACY_PREFIX + appId);
    if (legacy !== null) {
      const parsed = JSON.parse(legacy);
      return clampRating(parsed?.rating);
    }
  } catch (error) {
    console.warn('[steam-rating] could not read rating', appId, error);
  }

  return 0;
}

function writeRating(win: Window, appId: string, rating: number) {
  try {
    const normalized = clampRating(rating);
    if (normalized > 0) {
      win.localStorage.setItem(STORE_PREFIX + appId, JSON.stringify(normalized));
    } else {
      win.localStorage.removeItem(STORE_PREFIX + appId);
    }
  } catch (error) {
    console.warn('[steam-rating] could not save rating', appId, error);
  }
}

function clampCompletedCount(value: unknown) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.min(9, count);
}

function readCompletedCount(win: Window, appId: string) {
  try {
    const stored = win.localStorage.getItem(COMPLETED_PREFIX + appId);
    if (stored === null) return 0;
    if (stored === 'true') return 1;
    if (stored === 'false') return 0;

    try {
      return clampCompletedCount(JSON.parse(stored));
    } catch {
      return clampCompletedCount(stored);
    }
  } catch (error) {
    console.warn('[steam-rating] could not read completed state', appId, error);
  }

  return 0;
}

function writeCompletedCount(win: Window, appId: string, count: number) {
  try {
    const normalized = clampCompletedCount(count);
    if (normalized > 0) {
      win.localStorage.setItem(COMPLETED_PREFIX + appId, String(normalized));
    } else {
      win.localStorage.removeItem(COMPLETED_PREFIX + appId);
    }
  } catch (error) {
    console.warn('[steam-rating] could not save completed state', appId, error);
  }
}

function nextCompletedCount(count: number) {
  return count >= 9 ? 0 : count + 1;
}

function appIdFromImage(img: HTMLImageElement) {
  const sources = [
    img.currentSrc,
    img.getAttribute('src'),
    img.getAttribute('srcset'),
    img.getAttribute('data-src')
  ];

  for (const source of sources) {
    if (!source) continue;
    const match = source.match(APP_ID_REGEX);
    const appId = match?.[1] || match?.[2];
    if (appId) return appId;
  }

  return null;
}

function isCoverImage(img: HTMLImageElement) {
  const rect = img.getBoundingClientRect();
  if (rect.width < 70 || rect.height < 90) return false;
  return rect.height / Math.max(rect.width, 1) >= 1.05;
}

function isHtmlElement(element: Element | null | undefined): element is HTMLElement {
  const view = element?.ownerDocument?.defaultView;
  return !!element && !!view && element instanceof view.HTMLElement;
}

function isSteamHoverPreview(win: Window, card: HTMLElement) {
  let element = card.parentElement;

  while (element && element !== win.document.body && element !== win.document.documentElement) {
    const rect = element.getBoundingClientRect();
    const oversizedLayer = rect.width > win.innerWidth * 1.5 && rect.height > win.innerHeight * 1.5;
    if (oversizedLayer) return true;
    element = element.parentElement;
  }

  return false;
}

function findCardForImage(img: HTMLImageElement) {
  const imageSource = img.currentSrc || img.src || img.getAttribute('src') || '';

  if (imageSource.includes('/assets/') || imageSource.includes('/customimages/') || imageSource.includes('/steam/apps/')) {
    const panel = img.closest('.Panel');
    if (isHtmlElement(panel)) return panel;

    const steamCard = img.parentElement?.parentElement?.parentElement?.parentElement;
    if (isHtmlElement(steamCard)) return steamCard;
  }

  const imageRect = img.getBoundingClientRect();
  let element = img.parentElement;

  for (let i = 0; element && element !== img.ownerDocument.body && i < 8; i += 1) {
    const rect = element.getBoundingClientRect();
    const widthFits = rect.width >= imageRect.width * 0.86 && rect.width <= imageRect.width * 1.65;
    const heightFits = rect.height >= imageRect.height * 0.9;

    if (widthFits && heightFits) return element;
    element = element.parentElement;
  }

  return img.parentElement;
}

function findInsertionPoint(card: HTMLElement, img: HTMLImageElement) {
  let node: HTMLElement = img;

  while (node.parentElement && node.parentElement !== card) {
    const parent = node.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    if (parentRect.width > cardRect.width * 1.08 || parentRect.height > cardRect.height * 0.98) break;
    node = parent;
  }

  return node;
}

function fillPercentForStar(index: number, value: number) {
  if (value >= index) return 100;
  if (value >= index - 0.5) return 50;
  return 0;
}

function starSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path class="${NS}-star-empty" d="${STAR_PATH}"></path>
      <path class="${NS}-star-fill" style="clip-path: inset(0 100% 0 0)" d="${STAR_PATH}"></path>
    </svg>
  `;
}

function completeSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle class="${NS}-complete-box" cx="12" cy="12" r="8"></circle>
      <path class="${NS}-complete-check" d="${CHECK_PATH}"></path>
    </svg>
    <span class="${NS}-complete-count" aria-hidden="true"></span>
  `;
}

function updateStars(row: HTMLElement, value: number, preview: boolean) {
  const rating = clampRating(value);
  const stars = row.querySelectorAll<HTMLElement>(`.${NS}-star`);
  const group = row.querySelector<HTMLElement>(`.${NS}-stars`);

  row.dataset.preview = preview ? 'true' : 'false';

  if (group) {
    group.setAttribute('aria-valuenow', String(rating));
    group.setAttribute('aria-label', rating > 0 ? `Nota ${rating} de 5` : 'Sem nota');
    group.title = rating > 0 ? `Nota ${rating} de 5` : 'Sem nota';
  }

  stars.forEach((star, position) => {
    const index = position + 1;
    const fillPath = star.querySelector<SVGPathElement>(`.${NS}-star-fill`);
    if (fillPath) fillPath.style.clipPath = `inset(0 ${100 - fillPercentForStar(index, rating)}% 0 0)`;
    star.setAttribute('aria-label', `Dar nota ${index - 0.5} ou ${index}`);
  });
}

function updateCompleted(row: HTMLElement, count: number) {
  const button = row.querySelector<HTMLButtonElement>(`.${NS}-complete`);
  const normalized = clampCompletedCount(count);
  const completed = normalized > 0;
  const label = normalized > 1 ? `Jogo zerado ${normalized}x` : completed ? 'Jogo zerado' : 'Marcar como zerado';

  row.dataset.completed = completed ? 'true' : 'false';
  row.dataset.completedCount = String(normalized);

  if (!button) return;

  button.dataset.completed = completed ? 'true' : 'false';
  button.dataset.completedCount = String(normalized);
  button.setAttribute('aria-pressed', completed ? 'true' : 'false');
  button.setAttribute('aria-label', label);
  button.title = label;

  const countLabel = button.querySelector<HTMLElement>(`.${NS}-complete-count`);
  if (countLabel) countLabel.textContent = normalized > 1 ? `${normalized}x` : '';
}

function valueFromPointer(star: HTMLElement, event: MouseEvent) {
  const rect = star.getBoundingClientRect();
  const index = Number(star.dataset.index);
  const isLeftHalf = event.clientX - rect.left <= rect.width / 2;
  return index - (isLeftHalf ? 0.5 : 0);
}

function blockCardEvent(event: Event) {
  event.stopPropagation();
  if (event.type === 'click' || event.type === 'dblclick') event.preventDefault();
}

function buildRatingRow(win: Window, appId: string) {
  const doc = win.document;
  const row = doc.createElement('div');
  row.className = `${NS}-rating-row`;
  row.dataset.appId = appId;

  const dock = doc.createElement('div');
  dock.className = `${NS}-rating-dock`;
  row.appendChild(dock);

  const stars = doc.createElement('div');
  stars.className = `${NS}-stars`;
  stars.tabIndex = 0;
  stars.setAttribute('role', 'slider');
  stars.setAttribute('aria-valuemin', '0');
  stars.setAttribute('aria-valuemax', '5');
  stars.setAttribute('aria-valuetext', 'Meia estrela em meia estrela');
  dock.appendChild(stars);

  for (let index = 1; index <= 5; index += 1) {
    const star = doc.createElement('button');
    star.className = `${NS}-star`;
    star.type = 'button';
    star.dataset.index = String(index);
    star.innerHTML = starSvg();
    stars.appendChild(star);

    star.addEventListener('mousemove', (event) => updateStars(row, valueFromPointer(star, event), true));
    star.addEventListener('click', (event) => {
      blockCardEvent(event);
      const nextRating = valueFromPointer(star, event);
      const currentRating = readRating(win, appId);
      const finalRating = currentRating === nextRating ? 0 : nextRating;
      writeRating(win, appId, finalRating);
      updateStars(row, finalRating, false);
    });
  }

  const complete = doc.createElement('button');
  complete.className = `${NS}-complete`;
  complete.type = 'button';
  complete.innerHTML = completeSvg();
  dock.appendChild(complete);

  complete.addEventListener('click', (event) => {
    blockCardEvent(event);
    const nextCount = nextCompletedCount(readCompletedCount(win, appId));
    writeCompletedCount(win, appId, nextCount);
    updateCompleted(row, nextCount);
  });

  stars.addEventListener('mouseleave', () => updateStars(row, readRating(win, appId), false));
  stars.addEventListener('keydown', (event) => {
    const current = readRating(win, appId);
    let next = current;

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 0.5);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, current - 0.5);
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') next = 0;
    else return;

    event.preventDefault();
    event.stopPropagation();
    writeRating(win, appId, next);
    updateStars(row, next, false);
  });

  ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((type) => {
    row.addEventListener(type, blockCardEvent);
  });

  updateStars(row, readRating(win, appId), false);
  updateCompleted(row, readCompletedCount(win, appId));
  return row;
}

function directRatingRow(card: HTMLElement) {
  return Array.from(card.children).find((child) => child.classList?.contains(`${NS}-rating-row`)) as HTMLElement | undefined;
}

function attachRating(win: Window, img: HTMLImageElement, appId: string) {
  const card = findCardForImage(img);
  if (!card) return;

  if (isSteamHoverPreview(win, card)) {
    directRatingRow(card)?.remove();
    card.classList.remove(`${NS}-card-host`);
    return;
  }

  const existing = directRatingRow(card);
  if (existing && existing.dataset.appId === appId) {
    updateStars(existing, readRating(win, appId), false);
    updateCompleted(existing, readCompletedCount(win, appId));
    return;
  }

  existing?.remove();
  card.classList.add(`${NS}-card-host`);

  const row = buildRatingRow(win, appId);
  card.appendChild(row);
}

function installIntoWindow(win: Window) {
  const stateWindow = win as WindowWithRatingState;
  stateWindow.__STEAM_RATING_FRONTEND__?.destroy();

  const doc = win.document;
  if (!doc?.body) return;

  if (!doc.getElementById('steam-rating-styles')) {
    const style = doc.createElement('style');
    style.id = 'steam-rating-styles';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  let scanHandle = 0;
  let intervalHandle = 0;

  const scanDocument = () => {
    const images = doc.querySelectorAll('img');

    for (const img of images) {
      if (!(img instanceof (win as any).HTMLImageElement)) continue;
      if (!isCoverImage(img)) continue;

      const appId = appIdFromImage(img);
      if (!appId) continue;

      attachRating(win, img, appId);
    }
  };

  const scheduleScan = () => {
    if (scanHandle) return;
    scanHandle = win.requestAnimationFrame(() => {
      scanHandle = 0;
      scanDocument();
    });
  };

  const observer = new (win as any).MutationObserver(scheduleScan);
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });

  scheduleScan();
  intervalHandle = win.setInterval(scheduleScan, 2500);

  stateWindow.__STEAM_RATING_FRONTEND__ = {
    destroy() {
      observer.disconnect();
      if (scanHandle) win.cancelAnimationFrame(scanHandle);
      if (intervalHandle) win.clearInterval(intervalHandle);
      doc.querySelectorAll(`.${NS}-rating-row`).forEach((row) => row.remove());
      doc.querySelectorAll(`.${NS}-card-host`).forEach((card) => card.classList.remove(`${NS}-card-host`));
    }
  };

  console.log('[steam-rating] frontend installed in', win.name || win.location.href);
}

function windowFromContext(context: any): Window | undefined {
  return context?.m_popup?.window || context?.m_popup || context?.window;
}

function installExistingWindows() {
  const popupManager = Reflect.get(globalThis, 'g_PopupManager');
  if (!popupManager?.GetExistingPopup) return;

  for (const name of ['SP Desktop_uid0', 'SP BPM_uid0']) {
    const popup = popupManager.GetExistingPopup(name);
    const win = windowFromContext(popup);
    if (win?.document) installIntoWindow(win);
  }
}

const SettingsContent = () => (
  <Field label="Steam Rating" description="Ativo na biblioteca da Steam." icon={<IconsModule.Settings />} bottomSeparator="standard" focusable />
);

export default definePlugin(() => {
  console.log('[steam-rating] frontend loading v1.0.14');
  installExistingWindows();

  Millennium.AddWindowCreateHook((context: any) => {
    const win = windowFromContext(context);
    if (win?.document) installIntoWindow(win);
  });

  return {
    title: 'Steam Rating',
    icon: <IconsModule.Settings />,
    content: <SettingsContent />
  };
});

// ============================================================
// МОБИЛЬНОЕ УПРАВЛЕНИЕ И ОРИЕНТАЦИЯ ЭКРАНА
// ------------------------------------------------------------
// 1. Плавающие джойстики: касание левой половины экрана
//    управляет Игроком 1, правой — Игроком 2. Джойстик
//    появляется в точке касания и исчезает при отрыве пальца:
//      • горизонтальное отклонение — движение влево/вправо;
//      • отклонение вверх — прыжок (один раз за отведение).
//
// 2. Ориентация: на тач-устройствах в портретном режиме
//    показывается оверлей «Поверните устройство», а игра
//    автоматически ставится на паузу (экран паузы с кнопкой
//    «Продолжить» показывается, когда устройство возвращают
//    в горизонтальное положение).
//
// Игра общается через интерфейс MobileGameApi — методы
// определены в game.ts.
// ============================================================

import { KEYS } from "./config";
import { joystickLayerEl, pauseBtn, rotateScreenEl } from "./dom";

// API игры, необходимый мобильному управлению.
export interface MobileGameApi {
  setVirtualKey(code: string, active: boolean): void; // зажать/отпустить «клавишу»
  queueJump(player: 1 | 2): void; // запросить прыжок
  togglePause(): void; // переключить паузу
  pauseForOrientation(): void; // включить паузу из-за поворота устройства
}

// --- Настройки джойстика ---
const BASE_DIAMETER = 130; // диаметр основания (px)
const KNOB_DIAMETER = 56; // диаметр ручки (px)
const TRAVEL_RADIUS = 42; // максимальное отклонение ручки от центра (px)
const DEADZONE = 0.3; // мёртвая зона: внутри неё игрок стоит на месте
const JUMP_UP_THRESHOLD = 0.45; // отклонение вверх, при котором срабатывает прыжок
const JUMP_RESET_THRESHOLD = 0.25; // палец опустился ниже — можно прыгать снова

// Активный джойстик на одного игрока.
interface Stick {
  player: 1 | 2;
  originX: number; // точка касания (центр основания)
  originY: number;
  base: HTMLDivElement; // основание
  knob: HTMLDivElement; // ручка
  jumpArmed: boolean; // можно ли снова засчитать прыжок (после возврата пальца вниз)
}

const activeSticks = new Map<number, Stick>(); // pointerId → джойстик
let api: MobileGameApi | null = null;

// Определяет, что запускаем на тач-устройстве (телефон/планшет).
// Ноутбук с тачскрином считаем обычным десктопом.
// Отладка на десктопе: откройте страницу с параметром ?touch=1 —
// мобильный интерфейс (джойстики, кнопка паузы) включится принудительно.
export function isTouchDevice(): boolean {
  if (new URLSearchParams(window.location.search).has("touch")) return true;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 820;
}

// Настраивает мобильное управление. Вызывается один раз из main.ts.
export function setupMobile(game: MobileGameApi): void {
  api = game;
  if (!isTouchDevice()) return; // десктоп: только клавиатура

  document.body.classList.add("touch-device");

  setupOrientationOverlay();
  setupJoystickInput();
  setupPauseButton();
  releaseSticksOnContextLoss();

  // iOS: запрещаем масштабирование двумя пальцами и долгое нажатие с контекстным меню
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  window.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ---------- Ориентация экрана ----------

function setupOrientationOverlay(): void {
  const update = (): void => {
    const portrait = window.innerHeight > window.innerWidth;
    rotateScreenEl.classList.toggle("hidden", !portrait);
    if (portrait) api?.pauseForOrientation(); // в портрете игра замирает
  };

  window.addEventListener("resize", update);
  window.matchMedia("(orientation: portrait)").addEventListener("change", update);
  update();
}

// ---------- Плавающие джойстики ----------

function setupJoystickInput(): void {
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return; // мышь и перо не создают джойстик
    if (!canStartStick(e)) return;

    // Левая половина экрана — Игрок 1, правая — Игрок 2.
    // Один джойстик на игрока: повторное касание его половины игнорируется.
    const player: 1 | 2 = e.clientX < window.innerWidth / 2 ? 1 : 2;
    if (hasStickFor(player)) return;

    spawnStick(e.pointerId, player, e.clientX, e.clientY);
  });

  window.addEventListener("pointermove", (e) => {
    const stick = activeSticks.get(e.pointerId);
    if (!stick) return;
    updateStick(stick, e.clientX, e.clientY);
  });

  const release = (e: PointerEvent) => removeStick(e.pointerId);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
}

// Касания кнопок, экранов-оверлеев и оверлея ориентации — не джойстик.
function canStartStick(e: PointerEvent): boolean {
  if (!rotateScreenEl.classList.contains("hidden")) return false;
  const target = e.target as HTMLElement | null;
  if (!target || typeof target.closest !== "function") return false;
  return !target.closest("button, .overlay, #rotate-screen");
}

function spawnStick(pointerId: number, player: 1 | 2, x: number, y: number): void {
  const base = document.createElement("div");
  base.className = "joystick-base";
  base.dataset.player = String(player);
  base.style.width = BASE_DIAMETER + "px";
  base.style.height = BASE_DIAMETER + "px";
  base.style.left = x + "px";
  base.style.top = y + "px";

  const knob = document.createElement("div");
  knob.className = "joystick-knob";
  knob.dataset.player = String(player);
  knob.style.width = KNOB_DIAMETER + "px";
  knob.style.height = KNOB_DIAMETER + "px";
  knob.style.left = x + "px";
  knob.style.top = y + "px";

  joystickLayerEl.append(base, knob);
  activeSticks.set(pointerId, { player, originX: x, originY: y, base, knob, jumpArmed: true });
}

function updateStick(stick: Stick, x: number, y: number): void {
  const dx = x - stick.originX;
  const dy = y - stick.originY;
  const distance = Math.hypot(dx, dy) || 1;
  const travel = Math.min(distance, TRAVEL_RADIUS);

  // Нормализованное отклонение ручки: -1..1 по каждой оси
  const nx = ((dx / distance) * travel) / TRAVEL_RADIUS;
  const ny = ((dy / distance) * travel) / TRAVEL_RADIUS;

  // Ручка следует за пальцем (но не дальше TRAVEL_RADIUS)
  const knobX = stick.originX + (dx / distance) * travel;
  const knobY = stick.originY + (dy / distance) * travel;
  stick.knob.style.left = knobX + "px";
  stick.knob.style.top = knobY + "px";

  // Движение влево/вправо — как зажатые клавиши
  const codes = stick.player === 1 ? KEYS.player1 : KEYS.player2;
  api?.setVirtualKey(codes.left, nx < -DEADZONE);
  api?.setVirtualKey(codes.right, nx > DEADZONE);

  // Отклонение вверх — прыжок: срабатывает один раз,
  // пока палец не вернётся из «зоны прыжка» вниз.
  if (ny < -JUMP_UP_THRESHOLD) {
    if (stick.jumpArmed) {
      stick.jumpArmed = false;
      api?.queueJump(stick.player);
    }
  } else if (ny > -JUMP_RESET_THRESHOLD) {
    stick.jumpArmed = true;
  }
}

function removeStick(pointerId: number): void {
  const stick = activeSticks.get(pointerId);
  if (!stick) return;
  activeSticks.delete(pointerId);
  stick.base.remove();
  stick.knob.remove();

  const codes = stick.player === 1 ? KEYS.player1 : KEYS.player2;
  api?.setVirtualKey(codes.left, false);
  api?.setVirtualKey(codes.right, false);
}

function hasStickFor(player: 1 | 2): boolean {
  for (const stick of activeSticks.values()) {
    if (stick.player === player) return true;
  }
  return false;
}

function releaseAllSticks(): void {
  for (const pointerId of [...activeSticks.keys()]) removeStick(pointerId);
}

// Если вкладка ушла в фон или окно потеряло фокус — снимаем все джойстики,
// иначе клавиши останутся «зажатыми» навсегда.
function releaseSticksOnContextLoss(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAllSticks();
  });
  window.addEventListener("blur", releaseAllSticks);
}

// ---------- Кнопка паузы ----------

function setupPauseButton(): void {
  pauseBtn.addEventListener("click", () => api?.togglePause());
}

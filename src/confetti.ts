// ============================================================
// КОНФЕТТИ / ХЛОПУШКИ (празднование гола)
// ------------------------------------------------------------
// Визуальный эффект: при голе из ворот, в которые забит мяч,
// веером вылетают разноцветные вращающиеся частицы с гравитацией.
//
// Реализация: DOM-частицы + Web Animations API (element.animate).
// Каждая частица удаляется из DOM по завершении своей анимации,
// поэтому утечек нет. Активные анимации собираются в Set, что
// позволяет ставить их на паузу (Esc) и принудительно очищать
// при сбросе раунда.
// ============================================================

import {
  CONFETTI_COUNT,
  CONFETTI_COLORS,
  CONFETTI_MIN_SPEED,
  CONFETTI_MAX_SPEED,
  CONFETTI_GRAVITY,
  CONFETTI_MIN_DURATION_MS,
  CONFETTI_MAX_DURATION_MS,
  GOAL_WIDTH,
  GROUND_HEIGHT,
} from "./config";
import { confettiLayerEl } from "./dom";

const activeAnimations = new Set<Animation>(); // все запущенные анимации частиц

export type GoalSide = "left" | "right"; // ворота, из которых вылетают конфетти

// Запускает хлопушки из указанных ворот (вызывается в момент гола).
export function burstConfetti(side: GoalSide): void {
  clearConfetti(); // на случай, если прошлый эффект ещё не закончился

  const width = window.innerWidth;
  const height = window.innerHeight;
  const originX = side === "left" ? GOAL_WIDTH / 2 : width - GOAL_WIDTH / 2;
  const originY = height - GROUND_HEIGHT - 40; // чуть выше земли, у устья ворот
  const dirX = side === "left" ? 1 : -1; // направление внутрь поля

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    spawnParticle(originX, originY, dirX);
  }
}

// Ставит/снимает паузу всех частиц (при Esc-паузе игры).
export function setConfettiPaused(paused: boolean): void {
  activeAnimations.forEach((anim) => {
    if (paused) anim.pause();
    else anim.play();
  });
}

// Принудительно убирает все частицы (при сбросе раунда/рестарте матча).
export function clearConfetti(): void {
  activeAnimations.forEach((anim) => anim.cancel());
  activeAnimations.clear();
  confettiLayerEl.replaceChildren(); // удаляем все оставшиеся DOM-узлы
}

// Создаёт одну частицу конфетти и запускает её полёт.
function spawnParticle(originX: number, originY: number, dirX: number): void {
  const el = document.createElement("div");
  el.className = "confetti";

  // Случайный размер и цвет; половина частиц — круглые
  const size = 6 + Math.random() * 6;
  el.style.width = size.toString() + "px";
  el.style.height = size.toString() + "px";
  el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  if (Math.random() < 0.5) el.style.borderRadius = "50%";
  confettiLayerEl.appendChild(el);

  // Веер: от почти вертикали вверх до ~70° в сторону поля
  const angleDeg = -90 + dirX * (10 + Math.random() * 70);
  const angle = (angleDeg * Math.PI) / 180;
  const speed = CONFETTI_MIN_SPEED + Math.random() * (CONFETTI_MAX_SPEED - CONFETTI_MIN_SPEED);
  const vx = Math.cos(angle) * speed; // inward уже учтён в угле
  const vy = Math.sin(angle) * speed; // отрицательный = вверх

  const duration = CONFETTI_MIN_DURATION_MS + Math.random() * (CONFETTI_MAX_DURATION_MS - CONFETTI_MIN_DURATION_MS);
  const flightSec = duration / 1000;
  const totalRotation = (Math.random() * 720 - 360) * (Math.random() < 0.5 ? -1 : 1);

  // Траектория с гравитацией: y(t) = y0 + vy*t + g*t²/2.
  // Аппроксимируем 6 ключевыми кадрами с линейной интерполяцией.
  const keyframes: Keyframe[] = [];
  const frames = 6;
  for (let k = 0; k <= frames; k++) {
    const p = k / frames;
    const t = p * flightSec;
    const x = originX + vx * t;
    const y = originY + vy * t + 0.5 * CONFETTI_GRAVITY * t * t;
    keyframes.push({
      transform: "translate(" + x + "px, " + y + "px) rotate(" + totalRotation * p + "deg)",
      offset: p,
    });
  }
  // Частица плавно растворяется в конце полёта
  if (keyframes.length > 2) keyframes[keyframes.length - 2].opacity = 1;
  keyframes[keyframes.length - 1].opacity = 0;

  const anim = el.animate(keyframes, { duration: duration, easing: "linear", fill: "both" });
  activeAnimations.add(anim);
  // По завершении — чистим узел и анимацию (без утечек).
  // cancel() отвергает промис finished, поэтому обрабатываем и это.
  const cleanup = () => {
    el.remove();
    activeAnimations.delete(anim);
  };
  anim.finished.then(cleanup, cleanup);
}

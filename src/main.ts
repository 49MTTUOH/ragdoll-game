// ============================================================
// ТОЧКА ВХОДА В ИГРУ «RAGDOLL DUEL»
// ------------------------------------------------------------
// Подключает стили, запускает игру после загрузки страницы
// и активирует мобильное управление (джойстики + ориентация).
// Вся игровая логика находится в ./game.ts, настройки — в
// ./config.ts, мобильный ввод — в ./mobile.ts.
// ============================================================

import "./style.css";
import { RagdollGame } from "./game";
import { isTouchDevice, setupMobile } from "./mobile";

document.addEventListener("DOMContentLoaded", () => {
  const touchDevice = isTouchDevice();
  const game = new RagdollGame(touchDevice);
  if (touchDevice) setupMobile(game);
});

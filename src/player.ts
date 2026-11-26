// ============================================================
// ИГРОКИ (RAGDOLL-ПЕРСОНАЖИ)
// ------------------------------------------------------------
// Создание составного тела игрока из двух частей: голова и
// тело (ноги убраны). Все размеры и физические свойства
// берутся из конфигурации (./config.ts).
//
// Сами прямоугольники не рисуются (render.visible = false):
// поверх них в src/sprites.ts рисуются спрайты персонажа.
// Метки частей (PLAYER_PART_LABELS) нужны отрисовке, чтобы
// понимать, где голова, а где туловище.
// ============================================================

import { Bodies, Body, World } from "matter-js";
import {
  MAX_JUMPS_PHASE_3,
  PLAYER_HEAD_SIZE,
  PLAYER_BODY_WIDTH,
  PLAYER_BODY_HEIGHT,
  PLAYER_HEAD_OFFSET_Y,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_HEAD_FRICTION,
  PLAYER_HEAD_RESTITUTION,
  PLAYER_HEAD_DENSITY,
  PLAYER_BODY_FRICTION,
  PLAYER_BODY_RESTITUTION,
  PLAYER_BODY_DENSITY,
  PLAYER_FRICTION,
  PLAYER_RESTITUTION,
  PLAYER_DENSITY,
} from "./config";
import { PLAYER_PART_LABELS, type PlayerArt } from "./sprites";

// Игрок: составное физическое тело + цвет/набор спрайтов для
// отрисовки + счётчик оставшихся прыжков (для двойного прыжка в фазе 3).
export interface Player {
  body: Body;
  color: string;
  art: PlayerArt; // какой набор спрайтов рисовать
  jumpsLeft: number; // сколько прыжков ещё доступно (сбрасывается при касании земли)
}

// Сбрасывает счётчик прыжков игрока — вызывается при касании земли.
export function resetJumps(player: Player): void {
  player.jumpsLeft = MAX_JUMPS_PHASE_3;
}

// Пытается израсходовать один прыжок игрока (для прыжка в воздухе).
// Возвращает true, если прыжки ещё остались, иначе false.
export function tryConsumeJump(player: Player): boolean {
  if (player.jumpsLeft <= 0) return false;
  player.jumpsLeft--;
  return true;
}

// Создаёт ragdoll-персонажа в точке (x, y) и добавляет его в мир.
// Возвращает объект Player.
export function createPlayer(
  world: World,
  x: number,
  y: number,
  color: string,
  art: PlayerArt,
  restitution = PLAYER_RESTITUTION
): Player {
  // Голова
  const head = Bodies.rectangle(x, y - PLAYER_HEAD_OFFSET_Y, PLAYER_HEAD_SIZE, PLAYER_HEAD_SIZE, {
    label: PLAYER_PART_LABELS.head,
    friction: PLAYER_HEAD_FRICTION,
    restitution: PLAYER_HEAD_RESTITUTION,
    density: PLAYER_HEAD_DENSITY,
    render: { visible: false },
  });

  // Тело
  const body = Bodies.rectangle(x, y - PLAYER_BODY_OFFSET_Y, PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, {
    label: PLAYER_PART_LABELS.body,
    friction: PLAYER_BODY_FRICTION,
    restitution: PLAYER_BODY_RESTITUTION,
    density: PLAYER_BODY_DENSITY,
    render: { visible: false },
  });

  // Объединяем части в одно составное тело
  const compound = Body.create({
    parts: [head, body],
    friction: PLAYER_FRICTION,
    restitution,
    density: PLAYER_DENSITY,
    render: { visible: false },
  });

  World.add(world, compound);
  return { body: compound, color, art, jumpsLeft: MAX_JUMPS_PHASE_3 };
}

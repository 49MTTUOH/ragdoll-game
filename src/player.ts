// ============================================================
// ИГРОКИ (RAGDOLL-ПЕРСОНАЖИ)
// ------------------------------------------------------------
// Создание составного тела игрока из трёх частей: голова,
// тело и ноги. Все размеры и физические свойства берутся
// из конфигурации (./config.ts).
// ============================================================

import { Bodies, Body, World } from "matter-js";
import {
  PLAYER_HEAD_SIZE,
  PLAYER_BODY_WIDTH,
  PLAYER_BODY_HEIGHT,
  PLAYER_LEGS_WIDTH,
  PLAYER_LEGS_HEIGHT,
  PLAYER_HEAD_OFFSET_Y,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_LEGS_OFFSET_Y,
  PLAYER_HEAD_FRICTION,
  PLAYER_HEAD_RESTITUTION,
  PLAYER_HEAD_DENSITY,
  PLAYER_BODY_FRICTION,
  PLAYER_BODY_RESTITUTION,
  PLAYER_BODY_DENSITY,
  PLAYER_LEGS_FRICTION,
  PLAYER_LEGS_RESTITUTION,
  PLAYER_LEGS_DENSITY,
  PLAYER_FRICTION,
  PLAYER_RESTITUTION,
  PLAYER_DENSITY,
} from "./config";

// Игрок: составное физическое тело + цвет для отрисовки.
export interface Player {
  body: Body;
  color: string;
}

// Создаёт ragdoll-персонажа в точке (x, y) и добавляет его в мир.
// Возвращает объект Player.
export function createPlayer(world: World, x: number, y: number, color: string): Player {
  // Голова (прямоугольная)
  const head = Bodies.rectangle(x, y - PLAYER_HEAD_OFFSET_Y, PLAYER_HEAD_SIZE, PLAYER_HEAD_SIZE, {
    friction: PLAYER_HEAD_FRICTION,
    restitution: PLAYER_HEAD_RESTITUTION,
    density: PLAYER_HEAD_DENSITY,
    render: { fillStyle: color },
  });

  // Тело
  const body = Bodies.rectangle(x, y - PLAYER_BODY_OFFSET_Y, PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, {
    friction: PLAYER_BODY_FRICTION,
    restitution: PLAYER_BODY_RESTITUTION,
    density: PLAYER_BODY_DENSITY,
    render: { fillStyle: color },
  });

  // Ноги (узкие, как у человека)
  const legs = Bodies.rectangle(x, y + PLAYER_LEGS_OFFSET_Y, PLAYER_LEGS_WIDTH, PLAYER_LEGS_HEIGHT, {
    friction: PLAYER_LEGS_FRICTION,
    restitution: PLAYER_LEGS_RESTITUTION,
    density: PLAYER_LEGS_DENSITY,
    render: { fillStyle: color },
  });

  // Объединяем части в одно составное тело
  const compound = Body.create({
    parts: [head, body, legs],
    friction: PLAYER_FRICTION,
    restitution: PLAYER_RESTITUTION,
    density: PLAYER_DENSITY,
    render: { fillStyle: color },
  });

  World.add(world, compound);
  return { body: compound, color };
}
// ============================================================
// АРЕНА: ЗЕМЛЯ, СТЕНЫ И ВОРОТА
// ------------------------------------------------------------
// Функции для создания статичных объектов арены и управления
// положением ворот. Это чистые функции — они не зависят от
// класса игры и получают все данные через параметры.
// ============================================================

import { Bodies, Body, World } from "matter-js";
import {
  GROUND_HEIGHT,
  GROUND_FRICTION,
  WALL_THICKNESS,
  ARENA_EXTRA_WIDTH,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  GOAL_POST_THICKNESS,
  GOAL_BAR_THICKNESS,
  GOAL_SENSOR_WIDTH,
  GOAL_SENSOR_OFFSET_Y,
  GOAL_SENSOR_HEIGHT_INSET,
  BACK_WALL_THICKNESS,
  BACK_WALL_EDGE_OFFSET,
  COLORS,
  LABELS,
} from "./config";

// Набор всех статичных тел арены.
export interface Arena {
  ground: Body; // земля (пол)
  leftWall: Body; // левая стена
  rightWall: Body; // правая стена
  topWall: Body; // верхняя стена
  goalLeftPost: Body; // стойка левых ворот
  goalRightPost: Body; // стойка правых ворот
  goalLeftTopBar: Body; // перекладина левых ворот
  goalRightTopBar: Body; // перекладина правых ворот
  goalLeftSensor: Body; // датчик гола левых ворот
  goalRightSensor: Body; // датчик гола правых ворот
  goalLeftBackWall: Body; // невидимая стена за левыми воротами
  goalRightBackWall: Body; // невидимая стена за правыми воротами
}

// Создаёт все статичные тела арены (землю, стены, ворота).
// Возвращает объект Arena — его нужно добавить в мир через World.add.
export function createArena(width: number, height: number): Arena {
  // Земля — широкая полоса внизу экрана
  const ground = Bodies.rectangle(
    width / 2,
    height - GROUND_HEIGHT / 2,
    width + ARENA_EXTRA_WIDTH,
    GROUND_HEIGHT,
    { isStatic: true, friction: GROUND_FRICTION, render: { fillStyle: COLORS.ground } }
  );

  // Боковые стены — занимают высоту от верха до ворот
  const wallHeight = height - GOAL_HEIGHT;
  const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, wallHeight / 2, WALL_THICKNESS, wallHeight, {
    isStatic: true,
    render: { fillStyle: COLORS.wall },
  });
  const rightWall = Bodies.rectangle(width + WALL_THICKNESS / 2, wallHeight / 2, WALL_THICKNESS, wallHeight, {
    isStatic: true,
    render: { fillStyle: COLORS.wall },
  });

  // Верхняя стена — не даёт мячу и игрокам улететь вверх
  const topWall = Bodies.rectangle(width / 2, -WALL_THICKNESS / 2, width + ARENA_EXTRA_WIDTH, WALL_THICKNESS, {
    isStatic: true,
    render: { fillStyle: COLORS.wall },
  });

  const goalY = getGoalYBottom(height);

  // ЛЕВЫЕ ВОРОТА
  const goalLeftPost = Bodies.rectangle(GOAL_WIDTH / 2, goalY, GOAL_POST_THICKNESS, GOAL_HEIGHT, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.goalPost,
  });
  const goalLeftTopBar = Bodies.rectangle(
    GOAL_WIDTH / 2,
    goalY - GOAL_HEIGHT / 2,
    GOAL_WIDTH + GOAL_POST_THICKNESS,
    GOAL_BAR_THICKNESS,
    { isStatic: true, render: { fillStyle: COLORS.goal }, label: LABELS.goalPost }
  );
  const goalLeftSensor = Bodies.rectangle(
    GOAL_WIDTH / 2,
    goalY + GOAL_SENSOR_OFFSET_Y,
    GOAL_SENSOR_WIDTH,
    GOAL_HEIGHT - GOAL_SENSOR_HEIGHT_INSET,
    { isStatic: true, isSensor: true, label: LABELS.goalLeftSensor, render: { fillStyle: COLORS.goalLeftSensor } }
  );

  // ПРАВЫЕ ВОРОТА (симметричные левым)
  const goalRightPost = Bodies.rectangle(width - GOAL_WIDTH / 2, goalY, GOAL_POST_THICKNESS, GOAL_HEIGHT, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.goalPost,
  });
  const goalRightTopBar = Bodies.rectangle(
    width - GOAL_WIDTH / 2,
    goalY - GOAL_HEIGHT / 2,
    GOAL_WIDTH + GOAL_POST_THICKNESS,
    GOAL_BAR_THICKNESS,
    { isStatic: true, render: { fillStyle: COLORS.goal }, label: LABELS.goalPost }
  );
  const goalRightSensor = Bodies.rectangle(
    width - GOAL_WIDTH / 2,
    goalY + GOAL_SENSOR_OFFSET_Y,
    GOAL_SENSOR_WIDTH,
    GOAL_HEIGHT - GOAL_SENSOR_HEIGHT_INSET,
    { isStatic: true, isSensor: true, label: LABELS.goalRightSensor, render: { fillStyle: COLORS.goalRightSensor } }
  );

  // Невидимые стены за воротами (закрывают проём, когда ворота подняты вверх)
  const goalLeftBackWall = Bodies.rectangle(-BACK_WALL_EDGE_OFFSET, height - GROUND_HEIGHT, BACK_WALL_THICKNESS, 1, {
    isStatic: true,
    render: { visible: false },
    label: LABELS.backWall,
  });
  const goalRightBackWall = Bodies.rectangle(width + BACK_WALL_EDGE_OFFSET, height - GROUND_HEIGHT, BACK_WALL_THICKNESS, 1, {
    isStatic: true,
    render: { visible: false },
    label: LABELS.backWall,
  });

  return {
    ground,
    leftWall,
    rightWall,
    topWall,
    goalLeftPost,
    goalRightPost,
    goalLeftTopBar,
    goalRightTopBar,
    goalLeftSensor,
    goalRightSensor,
    goalLeftBackWall,
    goalRightBackWall,
  };
}

// Y-координата центра ворот в нижнем положении (обычная фаза игры).
export function getGoalYBottom(height: number): number {
  return height - GROUND_HEIGHT - GOAL_HEIGHT / 2;
}

// Y-координата центра ворот в верхнем положении (фаза 2).
export function getGoalYTop(height: number): number {
  return height / 2;
}

// Перемещает ворота (стойки, перекладины, датчики) на заданную высоту.
// Также перестраивает невидимые стены за воротами.
export function setGoalPositions(arena: Arena, world: World, width: number, height: number, goalY: number): void {
  Body.setPosition(arena.goalLeftPost, { x: GOAL_WIDTH / 2, y: goalY });
  Body.setPosition(arena.goalLeftTopBar, { x: GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
  Body.setPosition(arena.goalLeftSensor, { x: GOAL_WIDTH / 2, y: goalY + GOAL_SENSOR_OFFSET_Y });
  Body.setPosition(arena.goalRightPost, { x: width - GOAL_WIDTH / 2, y: goalY });
  Body.setPosition(arena.goalRightTopBar, { x: width - GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
  Body.setPosition(arena.goalRightSensor, { x: width - GOAL_WIDTH / 2, y: goalY + GOAL_SENSOR_OFFSET_Y });
  updateBackWalls(arena, world, width, height, goalY);
}

// Перестраивает невидимые стены за воротами так, чтобы они
// заполняли проём между низом ворот и землёй.
export function updateBackWalls(arena: Arena, world: World, width: number, height: number, goalY: number): void {
  const goalBottom = goalY + GOAL_HEIGHT / 2; // низ ворот
  const groundTop = height - GROUND_HEIGHT; // верх земли
  const wallHeight = Math.max(groundTop - goalBottom, 1); // высота стены (минимум 1px)
  const wallCenterY = (goalBottom + groundTop) / 2; // центр стены

  // Удаляем старые стены из мира
  World.remove(world, arena.goalLeftBackWall);
  World.remove(world, arena.goalRightBackWall);

  // Создаём новые стены нужной высоты
  arena.goalLeftBackWall = Bodies.rectangle(-BACK_WALL_EDGE_OFFSET, wallCenterY, BACK_WALL_THICKNESS, wallHeight, {
    isStatic: true,
    render: { visible: false },
    label: LABELS.backWall,
  });
  arena.goalRightBackWall = Bodies.rectangle(width + BACK_WALL_EDGE_OFFSET, wallCenterY, BACK_WALL_THICKNESS, wallHeight, {
    isStatic: true,
    render: { visible: false },
    label: LABELS.backWall,
  });

  // Добавляем новые стены в мир
  World.add(world, [arena.goalLeftBackWall, arena.goalRightBackWall]);
}
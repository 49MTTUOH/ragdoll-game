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
  GOAL_SIDE_FILLER_HEIGHT,
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
  goalLeftSideFiller: Body; // заглушка в щели между краем экрана и стойкой ворот
  goalRightSideFiller: Body; // заглушка в щели между краем экрана и стойкой ворот
  goalLeftBackWall: Body; // невидимая стенка за левым краем экрана (продолжение боковой стены до земли)
  goalRightBackWall: Body; // невидимая стенка за правым краем экрана (продолжение боковой стены до земли)
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

  // Заглушка в узкой щели между краем экрана и внутренней гранью стойки:
  // без неё игрок протискивается в этот «карман» и застревает там.
  // Ширина ровно равна щели, высота задаётся в config.ts, по вертикали
  // заглушка прижата к низу ворот (когда ворота опущены — у земли).
  const goalGapWidth = GOAL_WIDTH / 2 - GOAL_POST_THICKNESS / 2;
  const goalBottom = goalY + GOAL_HEIGHT / 2;
  const goalFillerY = goalBottom - GOAL_SIDE_FILLER_HEIGHT / 2;
  const goalLeftSideFiller = Bodies.rectangle(goalGapWidth / 2, goalFillerY, goalGapWidth, GOAL_SIDE_FILLER_HEIGHT, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.backWall,
  });
  const goalRightSideFiller = Bodies.rectangle(width - goalGapWidth / 2, goalFillerY, goalGapWidth, GOAL_SIDE_FILLER_HEIGHT, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.backWall,
  });

  // Невидимые стенки за краем экрана (не дают выйти за пределы арены
  // в зоне ворот, где боковые стены не продолжаются до земли)
  const { goalLeftBackWall, goalRightBackWall } = buildBackWalls(width, height, goalY);

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
    goalLeftSideFiller,
    goalRightSideFiller,
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
// Также перестраивает невидимые стенки за краем экрана.
export function setGoalPositions(arena: Arena, world: World, width: number, height: number, goalY: number): void {
  Body.setPosition(arena.goalLeftPost, { x: GOAL_WIDTH / 2, y: goalY });
  Body.setPosition(arena.goalLeftTopBar, { x: GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
  Body.setPosition(arena.goalLeftSensor, { x: GOAL_WIDTH / 2, y: goalY + GOAL_SENSOR_OFFSET_Y });
  Body.setPosition(arena.goalRightPost, { x: width - GOAL_WIDTH / 2, y: goalY });
  Body.setPosition(arena.goalRightTopBar, { x: width - GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
  Body.setPosition(arena.goalRightSensor, { x: width - GOAL_WIDTH / 2, y: goalY + GOAL_SENSOR_OFFSET_Y });
  // Заглушки в щели у краёв экрана перемещаются вместе с воротами,
  // оставаясь прижатыми к их нижнему краю (размер постоянный)
  const goalGapWidth = GOAL_WIDTH / 2 - GOAL_POST_THICKNESS / 2;
  const goalFillerY = goalY + GOAL_HEIGHT / 2 - GOAL_SIDE_FILLER_HEIGHT / 2;
  Body.setPosition(arena.goalLeftSideFiller, { x: goalGapWidth / 2, y: goalFillerY });
  Body.setPosition(arena.goalRightSideFiller, { x: width - goalGapWidth / 2, y: goalFillerY });
  updateBackWalls(arena, world, width, height, goalY);
}

// Создаёт невидимые стенки за краем экрана в зоне ворот. Боковые стены
// арены заканчиваются на уровне верха опущенных ворот, поэтому ниже —
// вплоть до земли — край экрана «открыт». Эти стенки продолжают боковые
// стены до земли, но целиком спрятаны за пределами канваса: игрок,
// дойдя до кромки экрана, упирается в них и не может выйти за границы
// арены, при этом стенок на экране не видно.
function buildBackWalls(width: number, height: number, goalY: number): { goalLeftBackWall: Body; goalRightBackWall: Body } {
  const goalBottom = goalY + GOAL_HEIGHT / 2; // низ ворот
  const groundTop = height - GROUND_HEIGHT; // верх земли
  // Верх опущенных ворот: именно с этой линии боковые стены заканчиваются,
  // поэтому стенка не должна быть выше — выше уже стоит боковая стена.
  const bottomGoalTop = height - GROUND_HEIGHT - GOAL_HEIGHT;
  // Стенка тянется от верха земли до низа ворот (но не выше верха
  // опущенных ворот). Высота не может быть отрицательной — минимум 1px.
  const wallTop = Math.min(goalBottom, bottomGoalTop);
  const wallHeight = Math.max(groundTop - wallTop, 1);
  const wallCenterY = wallTop + wallHeight / 2; // центр стенки

  // Стенка начинается ровно на кромке экрана (x = 0 и x = width) и уходит
  // наружу, смыкаясь с боковой стеной без зазоров и наложений.
  const wallWidth = BACK_WALL_THICKNESS + BACK_WALL_EDGE_OFFSET;

  const goalLeftBackWall = Bodies.rectangle(-wallWidth / 2, wallCenterY, wallWidth, wallHeight, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.backWall,
  });
  const goalRightBackWall = Bodies.rectangle(width + wallWidth / 2, wallCenterY, wallWidth, wallHeight, {
    isStatic: true,
    render: { fillStyle: COLORS.goal },
    label: LABELS.backWall,
  });

  return { goalLeftBackWall, goalRightBackWall };
}

// Перестраивает невидимые стенки за краем экрана под текущее
// положение ворот.
// ВАЖНО: параметр height — это полная высота окна. Из неё внутри
// buildBackWalls вычисляется позиция земли (height - GROUND_HEIGHT),
// поэтому уменьшать его нельзя — иначе стенки схлопнутся до 1px
// и у кромки экрана появится дыра, через которую игрок уйдёт за экран.
export function updateBackWalls(arena: Arena, world: World, width: number, height: number, goalY: number): void {
  // Удаляем старые стенки из мира
  World.remove(world, arena.goalLeftBackWall);
  World.remove(world, arena.goalRightBackWall);

  // Создаём новые стенки нужной высоты и добавляем их в мир
  const walls = buildBackWalls(width, height, goalY);
  arena.goalLeftBackWall = walls.goalLeftBackWall;
  arena.goalRightBackWall = walls.goalRightBackWall;
  World.add(world, [arena.goalLeftBackWall, arena.goalRightBackWall]);
}
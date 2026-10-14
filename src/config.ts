// ============================================================
// КОНФИГУРАЦИЯ ИГРЫ «RAGDOLL DUEL»
// ------------------------------------------------------------
// В этом файле собраны ВСЕ настройки игры. Меняйте значения
// здесь — и игра подстроится под них автоматически, без
// необходимости трогать игровую логику.
//
// Каждый блок настроек подписан комментарием, чтобы было
// понятно, за что он отвечает.
// ============================================================

// ---------- РАЗМЕРЫ АРЕНЫ ----------
// Базовые размеры игрового поля и его элементов (в пикселях).
export const GROUND_HEIGHT = 60; // высота земли (пола)
export const WALL_THICKNESS = 40; // толщина боковых и верхней стен
export const ARENA_EXTRA_WIDTH = 400; // насколько стены шире экрана (чтобы не было щелей при движении)
export const GROUND_FRICTION = 0.8; // трение о землю

// ---------- ВОРОТА ----------
// Геометрия ворот и датчиков гола.
export const GOAL_WIDTH = 60; // ширина ворот
export const GOAL_HEIGHT = 120; // высота ворот
export const GOAL_POST_THICKNESS = 15; // толщина боковых стоек
export const GOAL_BAR_THICKNESS = 15; // толщина верхней перекладины
export const GOAL_SENSOR_WIDTH = 30; // ширина датчика гола (невидимой зоны)
export const GOAL_SENSOR_OFFSET_Y = 20; // смещение датчика вниз от центра ворот
export const GOAL_SENSOR_HEIGHT_INSET = 40; // насколько датчик короче ворот по высоте
export const BACK_WALL_THICKNESS = 30; // толщина невидимой стены за воротами
export const BACK_WALL_EDGE_OFFSET = 10; // насколько стена за воротами выходит за край экрана

// ---------- МЯЧ ----------
// Физические свойства и стартовая позиция мяча.
export const BALL_RADIUS = 20; // радиус мяча
export const BALL_START_Y_RATIO = 0.4; // стартовая высота мяча (доля высоты экрана)
export const BALL_FRICTION = 0.05; // трение мяча о поверхности
export const BALL_FRICTION_AIR = 0.002; // сопротивление воздуха
export const BALL_RESTITUTION = 1.0; // упругость (1.0 = отскакивает без потери энергии)
export const BALL_DENSITY = 0.0008; // плотность (влияет на массу)
export const BALL_STROKE_WIDTH = 3; // толщина обводки мяча

// ---------- ИГРОКИ ----------
// Параметры ragdoll-персонажей: цвета, стартовые позиции,
// размеры частей тела и их физические свойства.
export const PLAYER_1_COLOR = "#4cc9f0"; // цвет игрока 1
export const PLAYER_2_COLOR = "#ff4d6d"; // цвет игрока 2
export const PLAYER_1_X_RATIO = 0.3; // стартовая позиция игрока 1 (доля ширины экрана)
export const PLAYER_2_X_RATIO = 0.7; // стартовая позиция игрока 2 (доля ширины экрана)
export const PLAYER_SPAWN_OFFSET_Y = 35; // подъём точки спавна над землёй
export const PLAYER_BODY_OFFSET_Y = 10; // смещение тела вверх от точки спавна

// Размеры частей тела (в пикселях)
export const PLAYER_HEAD_SIZE = 20; // размер головы (квадрат)
export const PLAYER_BODY_WIDTH = 20; // ширина тела
export const PLAYER_BODY_HEIGHT = 35; // высота тела
export const PLAYER_LEGS_WIDTH = 20; // ширина ног
export const PLAYER_LEGS_HEIGHT = 25; // высота ног
export const PLAYER_HEAD_OFFSET_Y = 35; // смещение головы вверх от точки спавна
export const PLAYER_LEGS_OFFSET_Y = 20; // смещение ног вниз от точки спавна

// Физика отдельных частей тела
export const PLAYER_HEAD_FRICTION = 0.3; // трение головы
export const PLAYER_HEAD_RESTITUTION = 0.8; // упругость головы
export const PLAYER_HEAD_DENSITY = 0.001; // плотность головы
export const PLAYER_BODY_FRICTION = 0.4; // трение тела
export const PLAYER_BODY_RESTITUTION = 0.7; // упругость тела
export const PLAYER_BODY_DENSITY = 0.002; // плотность тела
export const PLAYER_LEGS_FRICTION = 0.6; // трение ног
export const PLAYER_LEGS_RESTITUTION = 0.75; // упругость ног
export const PLAYER_LEGS_DENSITY = 0.004; // плотность ног

// Физика составного тела (всего персонажа целиком)
export const PLAYER_FRICTION = 0.5; // трение персонажа
export const PLAYER_RESTITUTION = 0.75; // упругость персонажа
export const PLAYER_DENSITY = 0.0025; // плотность персонажа

// ---------- ФИЗИКА ----------
// Настройки физического движка Matter.js: гравитация,
// прыжки, движение и стабилизация персонажей.
export const GRAVITY = { x: 0, y: 1.2 }; // гравитация (y > 0 = притяжение вниз)
export const JUMP_VELOCITY = -18; // скорость прыжка (отрицательная = вверх)
export const JUMP_VELOCITY_GOALS_UP = -24; // скорость прыжка, когда ворота подняты (фаза 2)
export const MOVE_FORCE = 0.008; // сила, с которой игрок двигается влево/вправо
export const UPRIGHT_TORQUE = 0.0008; // сила, выпрямляющая упавшего игрока
export const UPRIGHT_TORQUE_MULTIPLIER = 100; // множитель выпрямляющего момента
export const UPRIGHT_ANGLE_THRESHOLD = 0.1; // порог угла наклона, при котором включается выпрямление
export const STABILIZE_ANGLE_THRESHOLD = 0.3; // порог угла для гашения вращения
export const STABILIZE_ANGULAR_VELOCITY = 0.05; // порог угловой скорости для гашения
export const STABILIZE_DAMPING = 0.7; // коэффициент гашения вращения (0.7 = гасим 30% за кадр)
export const MAX_PLAYER_SPEED = 8; // максимальная скорость игрока (ограничение)

// ---------- ИГРОВЫЕ ЗОНЫ И ФАЗЫ ----------
// Правила матча: зона прыжка, переход во вторую фазу, длительность.
export const GROUND_JUMP_ZONE = 60; // зона у земли, в которой можно прыгнуть
export const GOALS_TO_PHASE_2 = 4; // сколько голов нужно, чтобы ворота поднялись (фаза 2)
export const MATCH_DURATION = 120; // длительность матча в секундах

// ---------- ТАЙМИНГИ ----------
// Задержки и интервалы (в миллисекундах).
export const TIMER_INTERVAL_MS = 1000; // интервал обновления таймера матча
export const GOAL_RESET_DELAY_MS = 1500; // пауза после гола перед сбросом раунда
export const PHASE_CHANGE_DELAY_MS = 1500; // пауза перед поднятием ворот (фаза 2)
export const GOAL_TEXT_DURATION_MS = 1000; // сколько показывать надпись «ГОЛ!»

// ---------- ЦВЕТА ----------
// Палитра игры. Меняйте здесь — и игра перекрасится.
export const COLORS = {
  background: "#1f7c3f", // фон игрового поля
  ground: "#2f9c4c", // земля
  wall: "#1b5e2f", // стены
  goal: "#ffffff", // ворота
  ball: "#ffffff", // мяч
  ballStroke: "#000", // обводка мяча
  goalLeftSensor: "rgba(255,0,0,0.3)", // датчик левых ворот (красный)
  goalRightSensor: "rgba(0,255,0,0.3)", // датчик правых ворот (зелёный)
};

// ---------- МЕТКИ ТЕЛ (LABELS) ----------
// Метки используются движком для определения столкновений
// (например, «мяч попал в датчик ворот»). Не меняйте их,
// если не меняете логику в game.ts.
export const LABELS = {
  ball: "ball", // мяч
  goalPost: "goalPost", // стойки и перекладины ворот
  backWall: "backWall", // невидимая стена за воротами
  goalLeftSensor: "goalLeftSensor", // датчик левых ворот (гол Игрока 2)
  goalRightSensor: "goalRightSensor", // датчик правых ворот (гол Игрока 1)
};

// ---------- УПРАВЛЕНИЕ ----------
// Клавиши управления (коды клавиш DOM KeyboardEvent.code).
export const KEYS = {
  player1: { left: "KeyA", right: "KeyD", jump: "KeyW" }, // Игрок 1: A / D / W
  player2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp" }, // Игрок 2: ← / → / ↑
  start: "Space", // старт матча
  pause: "Escape", // пауза
};

// ---------- ТЕКСТЫ ИНТЕРФЕЙСА ----------
// Сообщения, которые показываются игрокам на экране.
export const UI_TEXT = {
  goalP1: "ГОЛ! Игрок 1", // гол в правые ворота
  goalP2: "ГОЛ! Игрок 2", // гол в левые ворота
  goalsUp: "ВОРОТА ПОДНЯЛИСЬ!", // переход во вторую фазу
  winP1: "🏆 Победа Игрока 1!", // победа игрока 1
  winP2: "🏆 Победа Игрока 2!", // победа игрока 2
  draw: "🤝 Ничья!", // ничья
};
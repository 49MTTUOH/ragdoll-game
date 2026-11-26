// ============================================================
// ОСНОВНОЙ КЛАСС ИГРЫ «RAGDOLL DUEL»
// ------------------------------------------------------------
// Управляет жизненным циклом матча: создаёт арену, игроков
// и мяч, обрабатывает ввод, голы, таймер и фазы игры.
//
// Все настройки вынесены в ./config.ts, работа с ареной —
// в ./arena.ts, создание игроков — в ./player.ts, ссылки
// на элементы интерфейса — в ./dom.ts.
// ============================================================

import { Engine, Render, World, Bodies, Body, Events, type Pair } from "matter-js";
import {
  GROUND_HEIGHT,
  GROUND_JUMP_ZONE,
  GOALS_TO_PHASE_2,
  GOALS_TO_PHASE_3,
  MATCH_DURATION,
  GRAVITY,
  JUMP_VELOCITY,
  JUMP_VELOCITY_GOALS_UP,
  MOVE_FORCE,
  TOUCH_ARENA_SCALE,
  TOUCH_JUMP_STRENGTH,
  TOUCH_PLAYER_JUMP_SCALE,
  TOUCH_PLAYER_HIGH_JUMP_SCALE,
  TOUCH_PLAYER_CEILING_CLEARANCE,
  TOUCH_PLAYER_MAX_FALL_SPEED,
  TOUCH_PLAYER_RESTITUTION,
  TOUCH_MOVEMENT_SCALE,
  TOUCH_PHYSICS_TIME_SCALE,
  UPRIGHT_TORQUE,
  UPRIGHT_TORQUE_MULTIPLIER,
  UPRIGHT_ANGLE_THRESHOLD,
  STABILIZE_ANGLE_THRESHOLD,
  STABILIZE_ANGULAR_VELOCITY,
  STABILIZE_DAMPING,
  MAX_PLAYER_SPEED,
  BALL_RADIUS,
  BALL_PHASE_4_RADIUS,
  BALL_START_Y_RATIO,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  TOUCH_BALL_RESTITUTION,
  BALL_DENSITY,
  BALL_STROKE_WIDTH,
  BALL_AUTO_BOUNCE_VELOCITY,
  TOUCH_BALL_BOUNCE_SCALE,
  BALL_AUTO_BOUNCE_GROUND_TOLERANCE,
  BALL_AUTO_BOUNCE_SPEED_THRESHOLD,
  PLAYER_1_COLOR,
  PLAYER_2_COLOR,
  PLAYER_1_X_RATIO,
  PLAYER_2_X_RATIO,
  PLAYER_SPAWN_OFFSET_Y,
  TIMER_INTERVAL_MS,
  PHASE_4_TIME_LEFT,
  PHASE_4_DURATION_S,
  GOAL_RESET_DELAY_MS,
  GOAL_SLOWMO_TIME_SCALE,
  GOAL_SLOWMO_RAMP_MS,
  PHASE_CHANGE_DELAY_MS,
  GOAL_TEXT_DURATION_MS,
  COLORS,
  LABELS,
  KEYS,
  UI_TEXT,
} from "./config";
import {
  canvas,
  p1ScoreEl,
  p2ScoreEl,
  timerEl,
  doubleJumpHintEl,
  goalTextEl,
  gameOverEl,
  startScreenEl,
  startBtn,
  restartBtn,
  pauseScreenEl,
  resumeBtn,
  winnerTextEl,
} from "./dom";
import { createArena, setGoalPositions, getGoalYBottom, getGoalYTop, type Arena } from "./arena";
import { createPlayer, resetJumps, tryConsumeJump, type Player } from "./player";
import { burstConfetti, clearConfetti, setConfettiPaused } from "./confetti";
import { reachGoal, GOALS } from "./metrics";

const PHYSICS_STEP_MS = 1000 / 60;
const MAX_PHYSICS_FRAME_MS = 100;
const PHYSICS_STEP_TOLERANCE_MS = 1e-6;

export class RagdollGame {
  // --- Движок и отрисовка ---
  private engine: Engine;
  private render: Render;
  private world: World;
  private readonly arenaScale: number;
  private readonly ballBounceVelocity: number;
  private readonly movementScale: number;
  private readonly normalTimeScale: number;
  private physicsFrameId: number | null = null;
  private lastPhysicsFrame: number | null = null;
  private physicsTimeRemaining = 0;

  // --- Объекты мира ---
  private arena!: Arena; // статичные тела (земля, стены, ворота)
  private player1!: Player; // игрок 1
  private player2!: Player; // игрок 2
  private ball!: Body; // мяч

  // --- Состояние матча ---
  private score = { p1: 0, p2: 0 }; // счёт игроков
  private timeLeft = MATCH_DURATION; // оставшееся время матча
  private timerId: number | null = null; // id интервала таймера
  private phaseChangeTimeout: number | null = null; // id таймаута поднятия ворот
  private running = false; // идёт ли матч
  private gameEnded = false; // завершён ли матч
  private paused = false; // стоит ли пауза
  private keys = new Set<string>(); // зажатые в данный момент клавиши
  private phase = 1; // текущая фаза матча (1 — обычная, 2 — ворота сверху, 3 — ворота сверху + двойной прыжок, 4 — большой мяч на минуту)
  private jumpVelocity = JUMP_VELOCITY; // текущая скорость прыжка (меняется в фазе 2)
  private phase4SecondsLeft = 0; // сколько секунд осталось до возврата мяча к обычному размеру (фаза 4)
  private phase4Started = false; // начиналась ли уже фаза 4 в этом матче (чтобы не запускалась повторно)
  private ballScale = 1; // текущий масштаб мяча относительно BALL_RADIUS (для корректного возврата размера)
  private jumpQueued = { p1: false, p2: false }; // запрошенные прыжки (срабатывают при касании земли)
  private jumpHeld = { p1: false, p2: false }; // джойстики, удерживаемые вверх
  private goalLocked = false; // заблокирован ли счёт голов (пока идёт сброс раунда после гола)
  private goalResetTimeout: number | null = null; // id таймаута сброса раунда после гола
  private goalTextTimeout: number | null = null; // id таймаута скрытия надписи «ГОЛ!»
  private slowmoRafId: number | null = null; // id анимации плавного входа в слоу-мо
  private arenaSize: { w: number; h: number }; // текущие размеры арены (для пересборки при ресайзе)
  private resizeTimeout: number | null = null; // id таймаута дебаунса ресайза

  constructor(private readonly touchDevice: boolean) {
    this.arenaScale = touchDevice ? TOUCH_ARENA_SCALE : 1;
    const bounceScale = touchDevice ? TOUCH_BALL_BOUNCE_SCALE * TOUCH_JUMP_STRENGTH : 1;
    this.ballBounceVelocity = BALL_AUTO_BOUNCE_VELOCITY * this.arenaScale * bounceScale;
    this.movementScale = this.arenaScale * (touchDevice ? TOUCH_MOVEMENT_SCALE : 1);
    this.normalTimeScale = touchDevice ? TOUCH_PHYSICS_TIME_SCALE : 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.arenaSize = { w: width * this.arenaScale, h: height * this.arenaScale };

    // На увеличенной арене одному пикселю соответствует больше единиц мира.
    this.engine = Engine.create({
      gravity: { x: GRAVITY.x * this.arenaScale, y: GRAVITY.y * this.arenaScale },
    });
    this.engine.timing.timeScale = this.normalTimeScale;
    this.world = this.engine.world;

    // Настраиваем отрисовку на canvas
    this.render = Render.create({
      canvas: canvas,
      engine: this.engine,
      bounds: { min: { x: 0, y: 0 }, max: { x: this.arenaSize.w, y: this.arenaSize.h } },
      options: {
        width,
        height,
        hasBounds: touchDevice,
        wireframes: false,
        background: COLORS.background,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });

    // Собираем мир и подключаем обработчики
    this.setupArena();
    this.setupBall();
    this.spawnPlayers();
    this.setupEvents();
    this.setupInputs();

    // Запускаем цикл отрисовки и физики
    Render.run(this.render);
    this.startPhysics();
  }

  // Физика отрабатывает одинаковое число шагов за секунду при разных FPS.
  private updatePhysics = (now: number): void => {
    if (this.lastPhysicsFrame !== null) {
      this.physicsTimeRemaining += Math.min(now - this.lastPhysicsFrame, MAX_PHYSICS_FRAME_MS);
      while (this.physicsTimeRemaining + PHYSICS_STEP_TOLERANCE_MS >= PHYSICS_STEP_MS) {
        Engine.update(this.engine, PHYSICS_STEP_MS);
        this.physicsTimeRemaining -= PHYSICS_STEP_MS;
      }
    }
    this.lastPhysicsFrame = now;
    this.physicsFrameId = requestAnimationFrame(this.updatePhysics);
  };

  private startPhysics(): void {
    this.physicsFrameId = requestAnimationFrame(this.updatePhysics);
  }

  private stopPhysics(): void {
    if (this.physicsFrameId !== null) cancelAnimationFrame(this.physicsFrameId);
    this.physicsFrameId = null;
    this.resetPhysicsClock();
  }

  private resetPhysicsClock(): void {
    this.lastPhysicsFrame = null;
    this.physicsTimeRemaining = 0;
  }

  // Создаёт статичные тела арены и добавляет их в мир.
  private setupArena(): void {
    this.arena = createArena(this.arenaSize.w, this.arenaSize.h);
    World.add(this.world, this.arenaBodies());
  }

  // Возвращает список всех статичных тел арены
  // (используется и при создании, и при пересборке).
  private arenaBodies(): Body[] {
    return [
      this.arena.ground,
      this.arena.leftWall,
      this.arena.rightWall,
      this.arena.topWall,
      this.arena.goalLeftPost,
      this.arena.goalLeftTopBar,
      this.arena.goalRightPost,
      this.arena.goalRightTopBar,
      this.arena.goalLeftSensor,
      this.arena.goalRightSensor,
      this.arena.goalLeftSideFiller,
      this.arena.goalRightSideFiller,
      this.arena.goalLeftBackWall,
      this.arena.goalRightBackWall,
    ];
  }

  // Обрабатывает изменение размера окна (в том числе поворот телефона):
  // обновляет канвас с учётом devicePixelRatio, а если размеры реально
  // изменились — пересобирает арену под них.
  private handleResize(): void {
    this.render.options.width = window.innerWidth;
    this.render.options.height = window.innerHeight;
    const width = window.innerWidth * this.arenaScale;
    const height = window.innerHeight * this.arenaScale;
    this.render.bounds.max.x = width;
    this.render.bounds.max.y = height;
    Render.setPixelRatio(this.render, window.devicePixelRatio || 1);

    if (width === this.arenaSize.w && height === this.arenaSize.h) return;
    this.rebuildArena(width, height);
  }

  // Пересобирает статичную арену под новые размеры и возвращает мяч
  // и игроков в корректные позиции. Счёт, время, фаза и размер мяча
  // при этом сохраняются.
  private rebuildArena(width: number, height: number): void {
    World.remove(this.world, this.arenaBodies());
    this.arenaSize = { w: width, h: height };
    this.setupArena();

    // Если ворота уже подняты (фаза 2+) — сразу ставим их верхнее положение
    if (this.phase >= 2) {
      setGoalPositions(this.arena, this.world, width, height, getGoalYTop(height));
    }

    this.jumpQueued = { p1: false, p2: false };
    this.resetBall();
    this.spawnPlayers();
  }

  // Поднимает ворота вверх (фаза 2) и усиливает прыжок.
  private setGoalsUp(): void {
    this.phase = 2;
    this.jumpVelocity = JUMP_VELOCITY_GOALS_UP;
    const { w, h } = this.arenaSize;
    setGoalPositions(this.arena, this.world, w, h, getGoalYTop(h));
    this.showGoal(UI_TEXT.goalsUp);
    this.reportPhase(2, true);
  }

  // Включает фазу 3: ворота остаются поднятыми (как в фазе 2),
  // позиционирование ворот не меняется, но игроки получают двойной прыжок.
  private setPhase3(): void {
    this.phase = 3;
    // Ворота остаются поднятыми (позиционирование из фазы 2 не меняется),
    // усиленный прыжок и скорость прыжка сохраняются.
    this.jumpVelocity = JUMP_VELOCITY_GOALS_UP;
    this.showGoal(UI_TEXT.phase3);
    // Постоянный индикатор: двойной прыжок теперь доступен (виден до конца матча)
    doubleJumpHintEl.textContent = UI_TEXT.doubleJumpHint;
    doubleJumpHintEl.classList.remove("hidden");
    this.reportPhase(3, true);
  }

  // Включает фазу 4: мяч становится больше на минуту.
  // Ворота остаются сверху (как в фазах 2 и 3), двойной прыжок сохраняется.
  private setPhase4(): void {
    // Запоминаем, были ли ворота уже подняты: фаза 4 включается по
    // времени и может наступить раньше фаз 2 и 3 (если голов мало).
    const goalsUp = this.phase >= 2;
    this.phase = 4;
    this.phase4SecondsLeft = PHASE_4_DURATION_S;
    this.enlargeBall();
    this.showGoal(UI_TEXT.phase4);
    this.reportPhase(4, goalsUp);
  }

  // Завершает фазу 4: возвращает мячу обычный размер, фаза откатывается к 3
  // (двойной прыжок и поднятые ворота сохраняются).
  private endPhase4(): void {
    if (this.ballScale !== 1) {
      Body.scale(this.ball, 1 / this.ballScale, 1 / this.ballScale);
      this.ballScale = 1;
    }
    this.phase = 3;
    this.showGoal(UI_TEXT.phase4End);
  }

  // Увеличивает мяч до BALL_PHASE_4_RADIUS, сохраняя его позицию и скорость.
  private enlargeBall(): void {
    if (this.ballScale !== 1) return;
    const k = BALL_PHASE_4_RADIUS / BALL_RADIUS;
    this.ballScale = k;
    Body.scale(this.ball, k, k);
  }

  // Опускает ворота вниз (обычная фаза) и возвращает обычный прыжок.
  private setGoalsDown(): void {
    this.phase = 1;
    this.jumpVelocity = JUMP_VELOCITY;
    const { w, h } = this.arenaSize;
    setGoalPositions(this.arena, this.world, w, h, getGoalYBottom(h));
    // Скрываем индикатор двойного прыжка (полный рестарт матча)
    doubleJumpHintEl.classList.add("hidden");
  }

  // Создаёт мяч в центре поля и добавляет его в мир.
  private setupBall(): void {
    const { w: width, h: height } = this.arenaSize;
    this.ball = Bodies.circle(width / 2, height * BALL_START_Y_RATIO, BALL_RADIUS, {
      label: LABELS.ball,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      restitution: this.touchDevice ? TOUCH_BALL_RESTITUTION : BALL_RESTITUTION,
      density: BALL_DENSITY,
      render: { fillStyle: COLORS.ball, strokeStyle: COLORS.ballStroke, lineWidth: BALL_STROKE_WIDTH },
    });
    World.add(this.world, this.ball);
  }

  // Создаёт обоих игроков на их стартовых позициях.
  private spawnPlayers(): void {
    const { w: width, h: height } = this.arenaSize;
    const groundY = height - GROUND_HEIGHT;

    // Удаляем старых игроков, если они есть (при перезапуске раунда)
    if (this.player1) World.remove(this.world, this.player1.body);
    if (this.player2) World.remove(this.world, this.player2.body);

    const restitution = this.touchDevice ? TOUCH_PLAYER_RESTITUTION : undefined;
    this.player1 = createPlayer(this.world, width * PLAYER_1_X_RATIO, groundY - PLAYER_SPAWN_OFFSET_Y, PLAYER_1_COLOR, restitution);
    this.player2 = createPlayer(this.world, width * PLAYER_2_X_RATIO, groundY - PLAYER_SPAWN_OFFSET_Y, PLAYER_2_COLOR, restitution);
  }

  private isPlayerOnGround(player: Player): boolean {
    if (!this.touchDevice) {
      return player.body.position.y > this.arenaSize.h - GROUND_HEIGHT - GROUND_JUMP_ZONE;
    }

    const ground = this.arena.ground;
    return (this.engine.pairs.list as Pair[]).some(({ isActive, collision: { parentA, parentB } }) =>
      isActive && ((parentA === ground && parentB === player.body) || (parentB === ground && parentA === player.body))
    );
  }

  private jumpPlayer(player: Player, allowAirJump: boolean): void {
    const onGround = this.isPlayerOnGround(player);
    if (!onGround && (!allowAirJump || this.phase < 3)) return;

    const body = player.body;
    let speed = this.jumpVelocity;
    if (this.touchDevice) {
      const scale = this.phase === 1 ? TOUCH_PLAYER_JUMP_SCALE : TOUCH_PLAYER_HIGH_JUMP_SCALE;
      // Учитываем всю фигуру, в том числе если она повернётся в полёте.
      const radius = Math.max(...body.vertices.map((vertex) =>
        Math.hypot(vertex.x - body.position.x, vertex.y - body.position.y)
      ));
      const clearance = body.position.y - radius - TOUCH_PLAYER_CEILING_CLEARANCE * this.arenaScale;
      if (clearance <= 0) return;
      const gravityPerStep = this.engine.gravity.y * this.engine.gravity.scale * PHYSICS_STEP_MS ** 2;
      speed = Math.max(speed * this.arenaScale * scale, -Math.sqrt(2 * gravityPerStep * clearance)) * TOUCH_JUMP_STRENGTH;
    }

    if (onGround) resetJumps(player);
    if (this.phase >= 3 && !tryConsumeJump(player)) return;
    Body.setVelocity(body, { x: body.velocity.x, y: speed });
  }

  private limitPlayerSpeed(body: Body): void {
    const maxHorizontal = MAX_PLAYER_SPEED * this.movementScale;
    const maxFall = this.touchDevice ? TOUCH_PLAYER_MAX_FALL_SPEED * this.arenaScale : Infinity;
    const maxRise = this.touchDevice
      ? -JUMP_VELOCITY_GOALS_UP * this.arenaScale * TOUCH_PLAYER_HIGH_JUMP_SCALE * TOUCH_JUMP_STRENGTH
      : Infinity;
    const { x, y } = body.velocity;
    const cappedX = Math.max(-maxHorizontal, Math.min(maxHorizontal, x));
    const cappedY = Math.max(-maxRise, Math.min(maxFall, y));
    if (x !== cappedX || y !== cappedY) Body.setVelocity(body, { x: cappedX, y: cappedY });
  }

  // Возвращает мяч в центр поля и обнуляет его скорость.
  private resetBall(): void {
    const { w: width, h: height } = this.arenaSize;
    Body.setPosition(this.ball, { x: width / 2, y: height * BALL_START_Y_RATIO });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
  }

  // Сбрасывает раунд: заново создаёт игроков и возвращает мяч в центр.
  private resetRound(): void {
    if (this.gameEnded) return;
    this.goalLocked = false; // разблокируем счёт голов — раунд начался заново
    this.resetTimeScale(); // возвращаем нормальную скорость времени после слоу-мо
    this.clearGoalCelebration(); // убираем надпись «ГОЛ!» и конфетти
    this.jumpQueued = { p1: false, p2: false }; // сбрасываем накопленные прыжки
    this.spawnPlayers();
    this.resetBall();
  }

  // Запускает slow-motion после гола: плавно снижает масштаб времени физики.
  // Замедление действует до сброса раунда (кулдаун перезапуска не меняется).
  private startGoalSlowmo(): void {
    if (this.touchDevice) return;
    this.stopGoalSlowmo();
    const startTime = performance.now();
    const fromScale = this.engine.timing.timeScale;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / GOAL_SLOWMO_RAMP_MS, 1);
      this.engine.timing.timeScale = fromScale + (GOAL_SLOWMO_TIME_SCALE - fromScale) * t;
      this.slowmoRafId = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.slowmoRafId = requestAnimationFrame(step);
  }

  // Возвращает обычный темп физики и отменяет анимацию замедления.
  private resetTimeScale(): void {
    this.stopGoalSlowmo();
    this.engine.timing.timeScale = this.normalTimeScale;
  }

  // Отменяет активную анимацию входа в слоу-мо (если идёт).
  private stopGoalSlowmo(): void {
    if (this.slowmoRafId !== null) {
      cancelAnimationFrame(this.slowmoRafId);
      this.slowmoRafId = null;
    }
  }

  // Скрывает надпись «ГОЛ!» и снимает анимационный класс празднования.
  private hideGoalText(): void {
    if (this.goalTextTimeout) {
      clearTimeout(this.goalTextTimeout);
      this.goalTextTimeout = null;
    }
    goalTextEl.classList.add("hidden");
    goalTextEl.classList.remove("goal-celebration");
  }

  // Полная очистка визуального празднования гола (надпись + конфетти).
  // Вызывается при сбросе раунда, окончании матча и полном рестарте.
  private clearGoalCelebration(): void {
    this.hideGoalText();
    clearConfetti();
  }

  // Показывает крупную надпись (например, «ГОЛ!») на короткое время.
  // Если передан accent — включается красочное празднование:
  // градиентный текст, pop-in, свечение и пульсация в цвете забившего игрока.
  private showGoal(text: string, accent?: string): void {
    this.hideGoalText();
    goalTextEl.textContent = text;
    if (accent) {
      goalTextEl.style.setProperty("--goal-accent", accent);
      // Перезапуск CSS-анимации: рефлоу заставляет браузер проиграть её заново
      void goalTextEl.offsetWidth;
      goalTextEl.classList.add("goal-celebration");
    }
    goalTextEl.classList.remove("hidden");
    this.goalTextTimeout = window.setTimeout(() => {
      this.goalTextTimeout = null;
      this.hideGoalText();
    }, GOAL_TEXT_DURATION_MS);
  }

  // Проверяет, не наступила ли новая фаза по счёту:
  // фаза 2 — ворота поднимаются (при 2 голах у любого игрока),
  // фаза 3 — включается двойной прыжок, ворота остаются сверху (при 4 голах).
  private checkPhaseChange(): void {
    const targetPhase =
      this.score.p1 >= GOALS_TO_PHASE_3 || this.score.p2 >= GOALS_TO_PHASE_3
        ? 3
        : this.score.p1 >= GOALS_TO_PHASE_2 || this.score.p2 >= GOALS_TO_PHASE_2
          ? 2
          : 1;
    if (targetPhase <= this.phase) return;
    if (this.phaseChangeTimeout) clearTimeout(this.phaseChangeTimeout);
    this.phaseChangeTimeout = window.setTimeout(() => {
      this.phaseChangeTimeout = null;
      if (this.gameEnded || this.phase >= targetPhase) return;
      if (targetPhase === 2) this.setGoalsUp();
      else if (targetPhase === 3) this.setPhase3();
    }, PHASE_CHANGE_DELAY_MS);
  }

  // Отправляет в Метрику цель «достигнута фаза».
  // goalsUp — были ли ворота подняты на момент перехода: фаза 4
  // включается по времени и может наступить без фаз 2 и 3.
  private reportPhase(phase: 2 | 3 | 4, goalsUp: boolean): void {
    reachGoal(GOALS.phaseReached, {
      phase,
      goalsUp: goalsUp ? 1 : 0,
      score: `${this.score.p1}-${this.score.p2}`,
      elapsed: MATCH_DURATION - this.timeLeft,
    });
  }

  // Запускает обратный отсчёт времени матча.
  private startTimer(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timeLeft = MATCH_DURATION;
    timerEl.textContent = this.timeLeft.toString();
    this.timerId = window.setInterval(() => {
      if (!this.running || this.gameEnded || this.paused) return;
      this.timeLeft--;
      timerEl.textContent = this.timeLeft.toString();

      // Фаза 4: через 5 минут матча (когда осталось PHASE_4_TIME_LEFT секунд)
      // мяч на минуту становится больше — один раз за матч.
      if (
        this.timeLeft > 0 &&
        this.timeLeft <= PHASE_4_TIME_LEFT &&
        !this.phase4Started
      ) {
        this.phase4Started = true;
        this.setPhase4();
      }

      // Отсчёт длительности фазы 4: по истечении минуты мяч возвращается
      // к обычному размеру (пауза и слоу-мо не съедают время — тик не срабатывает).
      if (this.phase4SecondsLeft > 0) {
        this.phase4SecondsLeft--;
        if (this.phase4SecondsLeft === 0) this.endPhase4();
      }

      if (this.timeLeft <= 0) this.endMatch();
    }, TIMER_INTERVAL_MS);
  }

  // Завершает матч: останавливает таймер и показывает победителя.
  private endMatch(): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.running = false;
    this.resetTimeScale(); // снимаем слоу-мо, если матч закончился во время гола
    if (this.timerId) clearInterval(this.timerId);
    if (this.phaseChangeTimeout) {
      clearTimeout(this.phaseChangeTimeout);
      this.phaseChangeTimeout = null;
    }
    if (this.goalResetTimeout) {
      clearTimeout(this.goalResetTimeout);
      this.goalResetTimeout = null;
    }

    if (this.score.p1 > this.score.p2) {
      winnerTextEl.textContent = UI_TEXT.winP1;
    } else if (this.score.p2 > this.score.p1) {
      winnerTextEl.textContent = UI_TEXT.winP2;
    } else {
      winnerTextEl.textContent = UI_TEXT.draw;
    }
    reachGoal(GOALS.matchFinished, {
      p1: this.score.p1,
      p2: this.score.p2,
    });
    this.clearGoalCelebration(); // убираем конфетти и надпись, если матч кончился в момент гола
    gameOverEl.classList.remove("hidden");
  }

  // Начинает матч (вызывается со стартового экрана или по пробелу).
  public startGame(): void {
    if (this.running) return;
    this.running = true;
    reachGoal(GOALS.matchStart);
    startScreenEl.classList.add("hidden");
    gameOverEl.classList.add("hidden");
    this.startTimer();
  }

  // Переключает паузу (останавливает/запускает физику).
  public togglePause(): void {
    if (!this.running || this.gameEnded) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.jumpQueued = { p1: false, p2: false };
      this.stopPhysics();
      setConfettiPaused(true); // замораживаем частицы конфетти
      document.body.classList.add("paused"); // замирает CSS-анимация надписи
      pauseScreenEl.classList.remove("hidden");
    } else {
      this.startPhysics();
      setConfettiPaused(false);
      document.body.classList.remove("paused");
      pauseScreenEl.classList.add("hidden");
    }
  }

  // --- Публичный API для мобильного управления (src/mobile.ts) ---

  // Зажимает/отпускает «виртуальную клавишу» — так джойстик на
  // тач-экране управляет движением точно так же, как клавиатура.
  public setVirtualKey(code: string, active: boolean): void {
    if (active) this.keys.add(code);
    else this.keys.delete(code);
  }

  // Удержание повторяет прыжок с земли. Новый жест может запустить прыжок в воздухе.
  public setJumpHeld(player: 1 | 2, held: boolean): void {
    const key = player === 1 ? "p1" : "p2";
    this.jumpHeld[key] = held;
    if (held && this.running && !this.gameEnded && !this.paused && !this.goalLocked) {
      this.jumpQueued[key] = true;
    }
  }

  // Ставит игру на паузу при перевороте устройства в портретный режим.
  public pauseForOrientation(): void {
    if (this.running && !this.paused && !this.gameEnded) this.togglePause();
  }

  // Подключает обработчики событий движка (голы, управление, ресайз).
  private setupEvents(): void {
    // Обработка голов: мяч коснулся датчика ворот.
    // После гола счёт блокируется до сброса раунда, чтобы мяч,
    // зажатый между игроком и воротами, не засчитал несколько голов подряд.
    Events.on(this.engine, "collisionStart", (evt) => {
      if (this.gameEnded || this.paused || this.goalLocked) return;
      for (let pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;

        // Мяч в правых воротах → гол Игрока 1
        if (
          (a.label === LABELS.ball && b.label === LABELS.goalRightSensor) ||
          (b.label === LABELS.ball && a.label === LABELS.goalRightSensor)
        ) {
          this.goalLocked = true;
          this.startGoalSlowmo(); // включаем слоу-мо на время до сброса раунда
          this.score.p1++;
          p1ScoreEl.textContent = this.score.p1.toString();
          this.showGoal(UI_TEXT.goalP1, PLAYER_1_COLOR); // красочное празднование в цвете Игрока 1
          // Хлопушки вылетают из правых ворот, куда забит мяч
          const { x, y } = this.arena.goalRightSensor.position;
          burstConfetti("right", x / this.arenaScale, y / this.arenaScale);
          reachGoal(GOALS.goalScored, {
            scorer: "p1",
            phase: this.phase,
            total: this.score.p1,
          });
          this.checkPhaseChange();
          if (this.goalResetTimeout) clearTimeout(this.goalResetTimeout);
          this.goalResetTimeout = window.setTimeout(() => {
            this.goalResetTimeout = null;
            this.resetRound();
          }, GOAL_RESET_DELAY_MS);
          return;
        }

        // Мяч в левых воротах → гол Игрока 2
        if (
          (a.label === LABELS.ball && b.label === LABELS.goalLeftSensor) ||
          (b.label === LABELS.ball && a.label === LABELS.goalLeftSensor)
        ) {
          this.goalLocked = true;
          this.startGoalSlowmo(); // включаем слоу-мо на время до сброса раунда
          this.score.p2++;
          p2ScoreEl.textContent = this.score.p2.toString();
          this.showGoal(UI_TEXT.goalP2, PLAYER_2_COLOR); // красочное празднование в цвете Игрока 2
          // Хлопушки вылетают из левых ворот, куда забит мяч
          const { x, y } = this.arena.goalLeftSensor.position;
          burstConfetti("left", x / this.arenaScale, y / this.arenaScale);
          reachGoal(GOALS.goalScored, {
            scorer: "p2",
            phase: this.phase,
            total: this.score.p2,
          });
          this.checkPhaseChange();
          if (this.goalResetTimeout) clearTimeout(this.goalResetTimeout);
          this.goalResetTimeout = window.setTimeout(() => {
            this.goalResetTimeout = null;
            this.resetRound();
          }, GOAL_RESET_DELAY_MS);
          return;
        }
      }
    });

    // Каждый кадр физики: движение игроков, прыжки, выпрямление
    Events.on(this.engine, "beforeUpdate", () => {
      if (!this.running || this.gameEnded || this.paused) return;

      const groundY = this.arenaSize.h - GROUND_HEIGHT;

      // Выпрямляем упавших игроков и гасим лишнее вращение
      [this.player1.body, this.player2.body].forEach((p) => {
        if (!p) return;
        const angle = p.angle;
        let normalizedAngle = angle % (2 * Math.PI);
        if (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
        if (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;

        if (Math.abs(normalizedAngle) > UPRIGHT_ANGLE_THRESHOLD) {
          Body.applyForce(p, p.position, { x: 0, y: 0 });
          p.torque = -normalizedAngle * UPRIGHT_TORQUE * UPRIGHT_TORQUE_MULTIPLIER;
        }

        if (Math.abs(normalizedAngle) < STABILIZE_ANGLE_THRESHOLD && Math.abs(p.angularVelocity) > STABILIZE_ANGULAR_VELOCITY) {
          Body.setAngularVelocity(p, p.angularVelocity * STABILIZE_DAMPING);
        }
      });

      // --- Управление игроками (полностью отключено в состоянии «гол») ---
      if (!this.goalLocked) {
        const moveForce = MOVE_FORCE * this.movementScale;
        // --- Управление Игроком 1 (A / D / W) ---
        if (this.keys.has(KEYS.player1.left)) {
          Body.applyForce(this.player1.body, this.player1.body.position, { x: -moveForce, y: 0 });
        }
        if (this.keys.has(KEYS.player1.right)) {
          Body.applyForce(this.player1.body, this.player1.body.position, { x: moveForce, y: 0 });
        }
        if (this.jumpQueued.p1 || this.jumpHeld.p1) this.jumpPlayer(this.player1, this.jumpQueued.p1);
        this.jumpQueued.p1 = false;

        // --- Управление Игроком 2 (← / → / ↑) ---
        if (this.keys.has(KEYS.player2.left)) {
          Body.applyForce(this.player2.body, this.player2.body.position, { x: -moveForce, y: 0 });
        }
        if (this.keys.has(KEYS.player2.right)) {
          Body.applyForce(this.player2.body, this.player2.body.position, { x: moveForce, y: 0 });
        }
        if (this.jumpQueued.p2 || this.jumpHeld.p2) this.jumpPlayer(this.player2, this.jumpQueued.p2);
        this.jumpQueued.p2 = false;
      }

      // Автоподскок мяча: если мяч лежит или медленно катится по земле,
      // сам придаём ему вертикальную скорость, чтобы он не переставал прыгать
      const ballBottom = this.ball.position.y + BALL_RADIUS * this.ballScale;
      const ballNearGround = ballBottom >= groundY - BALL_AUTO_BOUNCE_GROUND_TOLERANCE;
      const ballVerticalSpeedSlow = Math.abs(this.ball.velocity.y) < BALL_AUTO_BOUNCE_SPEED_THRESHOLD * this.arenaScale;
      if (ballNearGround && ballVerticalSpeedSlow) {
        Body.setVelocity(this.ball, { x: this.ball.velocity.x, y: this.ballBounceVelocity });
      }
    });

    // На тач-экранах ограничиваем и импульсы, полученные при столкновениях.
    Events.on(this.engine, this.touchDevice ? "afterUpdate" : "beforeUpdate", () => {
      if (!this.running || this.gameEnded || this.paused) return;
      this.limitPlayerSpeed(this.player1.body);
      this.limitPlayerSpeed(this.player2.body);
    });

    document.addEventListener("visibilitychange", () => this.resetPhysicsClock());

    // При изменении размера окна (в том числе повороте телефона):
    // дебаунсим, затем обновляем канвас и при необходимости пересобираем арену
    window.addEventListener("resize", () => {
      if (this.resizeTimeout !== null) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = window.setTimeout(() => {
        this.resizeTimeout = null;
        this.handleResize();
      }, 200);
    });
  }

  // Подключает обработчики клавиатуры и кнопок интерфейса.
  private setupInputs(): void {
    window.addEventListener("keydown", (e) => {
      // Пробел — старт матча
      if (e.code === KEYS.start) {
        e.preventDefault();
        if (!this.running && !this.gameEnded) this.startGame();
        return;
      }
      // Escape — пауза
      if (e.code === KEYS.pause) {
        e.preventDefault();
        this.togglePause();
        return;
      }
      // Запоминаем прыжок, если клавиша нажата впервые и сейчас не состояние «гол»
      // (в слоу-мо после гола ввод игроков игнорируется)
      if (!this.goalLocked && !this.keys.has(e.code)) {
        if (e.code === KEYS.player1.jump) this.jumpQueued.p1 = true;
        if (e.code === KEYS.player2.jump) this.jumpQueued.p2 = true;
      }
      this.keys.add(e.code);
    });

    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Кнопка «Начать»
    startBtn.addEventListener("click", () => {
      if (!this.running && !this.gameEnded) this.startGame();
    });

    // Кнопка «Продолжить» на экране паузы (без неё на тач-устройствах
    // нечем снять паузу — там нет клавиши ESC)
    resumeBtn.addEventListener("click", () => {
      this.togglePause();
    });

    // Кнопка «Играть снова» — полный сброс матча
    restartBtn.addEventListener("click", () => {
      reachGoal(GOALS.rematch);
      this.score = { p1: 0, p2: 0 };
      p1ScoreEl.textContent = "0";
      p2ScoreEl.textContent = "0";
      this.gameEnded = false;
      this.running = false;
      this.paused = false;
      this.goalLocked = false;
      this.keys.clear(); // сбрасываем зажатые клавиши (в т.ч. «виртуальные» от джойстиков)
      this.phase4SecondsLeft = 0; // сбрасываем таймер фазы 4
      this.phase4Started = false; // фаза 4 снова сможет наступить в новом матче
      if (this.ballScale !== 1) {
        // возвращаем мячу обычный размер, если матч оборвался во время фазы 4
        Body.scale(this.ball, 1 / this.ballScale, 1 / this.ballScale);
        this.ballScale = 1;
      }
      this.clearGoalCelebration(); // сбрасываем надпись «ГОЛ!» и конфетти
      setConfettiPaused(false);
      document.body.classList.remove("paused");
      pauseScreenEl.classList.add("hidden");
      gameOverEl.classList.add("hidden");
      startScreenEl.classList.remove("hidden");
      if (this.timerId) clearInterval(this.timerId);
      if (this.phaseChangeTimeout) {
        clearTimeout(this.phaseChangeTimeout);
        this.phaseChangeTimeout = null;
      }
      if (this.goalResetTimeout) {
        clearTimeout(this.goalResetTimeout);
        this.goalResetTimeout = null;
      }
      timerEl.textContent = MATCH_DURATION.toString();
      this.setGoalsDown();
      this.resetRound();
    });
  }
}

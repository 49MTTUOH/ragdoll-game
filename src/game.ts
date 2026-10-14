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

import { Engine, Render, World, Bodies, Body, Events, Runner } from "matter-js";
import {
  GROUND_HEIGHT,
  GROUND_JUMP_ZONE,
  GOALS_TO_PHASE_2,
  MATCH_DURATION,
  GRAVITY,
  JUMP_VELOCITY,
  JUMP_VELOCITY_GOALS_UP,
  MOVE_FORCE,
  UPRIGHT_TORQUE,
  UPRIGHT_TORQUE_MULTIPLIER,
  UPRIGHT_ANGLE_THRESHOLD,
  STABILIZE_ANGLE_THRESHOLD,
  STABILIZE_ANGULAR_VELOCITY,
  STABILIZE_DAMPING,
  MAX_PLAYER_SPEED,
  BALL_RADIUS,
  BALL_START_Y_RATIO,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  BALL_DENSITY,
  BALL_STROKE_WIDTH,
  PLAYER_1_COLOR,
  PLAYER_2_COLOR,
  PLAYER_1_X_RATIO,
  PLAYER_2_X_RATIO,
  PLAYER_SPAWN_OFFSET_Y,
  TIMER_INTERVAL_MS,
  GOAL_RESET_DELAY_MS,
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
  goalTextEl,
  gameOverEl,
  startScreenEl,
  startBtn,
  restartBtn,
  pauseScreenEl,
  winnerTextEl,
} from "./dom";
import { createArena, setGoalPositions, getGoalYBottom, getGoalYTop, type Arena } from "./arena";
import { createPlayer, type Player } from "./player";

export class RagdollGame {
  // --- Движок и отрисовка ---
  private engine: Engine;
  private render: Render;
  private world: World;
  private runner!: Runner;

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
  private goalsUp = false; // подняты ли ворота (фаза 2)
  private jumpVelocity = JUMP_VELOCITY; // текущая скорость прыжка (меняется в фазе 2)
  private jumpQueued = { p1: false, p2: false }; // запрошенные прыжки (срабатывают при касании земли)
  private goalLocked = false; // заблокирован ли счёт голов (пока идёт сброс раунда после гола)
  private goalResetTimeout: number | null = null; // id таймаута сброса раунда после гола

  constructor() {
    // Создаём физический движок с гравитацией из конфигурации
    this.engine = Engine.create({ gravity: GRAVITY });
    this.world = this.engine.world;

    // Настраиваем отрисовку на canvas
    this.render = Render.create({
      canvas: canvas,
      engine: this.engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
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
    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);
  }

  // Создаёт статичные тела арены и добавляет их в мир.
  private setupArena(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.arena = createArena(width, height);
    World.add(this.world, [
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
      this.arena.goalLeftBackWall,
      this.arena.goalRightBackWall,
    ]);
  }

  // Поднимает ворота вверх (фаза 2) и усиливает прыжок.
  private setGoalsUp(): void {
    this.goalsUp = true;
    this.jumpVelocity = JUMP_VELOCITY_GOALS_UP;
    setGoalPositions(this.arena, this.world, window.innerWidth, window.innerHeight, getGoalYTop(window.innerHeight));
    this.showGoal(UI_TEXT.goalsUp);
  }

  // Опускает ворота вниз (обычная фаза) и возвращает обычный прыжок.
  private setGoalsDown(): void {
    this.goalsUp = false;
    this.jumpVelocity = JUMP_VELOCITY;
    setGoalPositions(this.arena, this.world, window.innerWidth, window.innerHeight, getGoalYBottom(window.innerHeight));
  }

  // Создаёт мяч в центре поля и добавляет его в мир.
  private setupBall(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ball = Bodies.circle(width / 2, height * BALL_START_Y_RATIO, BALL_RADIUS, {
      label: LABELS.ball,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      restitution: BALL_RESTITUTION,
      density: BALL_DENSITY,
      render: { fillStyle: COLORS.ball, strokeStyle: COLORS.ballStroke, lineWidth: BALL_STROKE_WIDTH },
    });
    World.add(this.world, this.ball);
  }

  // Создаёт обоих игроков на их стартовых позициях.
  private spawnPlayers(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const groundY = height - GROUND_HEIGHT;

    // Удаляем старых игроков, если они есть (при перезапуске раунда)
    if (this.player1) World.remove(this.world, this.player1.body);
    if (this.player2) World.remove(this.world, this.player2.body);

    this.player1 = createPlayer(this.world, width * PLAYER_1_X_RATIO, groundY - PLAYER_SPAWN_OFFSET_Y, PLAYER_1_COLOR);
    this.player2 = createPlayer(this.world, width * PLAYER_2_X_RATIO, groundY - PLAYER_SPAWN_OFFSET_Y, PLAYER_2_COLOR);
  }

  // Возвращает мяч в центр поля и обнуляет его скорость.
  private resetBall(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    Body.setPosition(this.ball, { x: width / 2, y: height * BALL_START_Y_RATIO });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
  }

  // Сбрасывает раунд: заново создаёт игроков и возвращает мяч в центр.
  private resetRound(): void {
    if (this.gameEnded) return;
    this.goalLocked = false; // разблокируем счёт голов — раунд начался заново
    this.spawnPlayers();
    this.resetBall();
  }

  // Показывает крупную надпись (например, «ГОЛ!») на короткое время.
  private showGoal(text: string): void {
    goalTextEl.textContent = text;
    goalTextEl.classList.remove("hidden");
    setTimeout(() => goalTextEl.classList.add("hidden"), GOAL_TEXT_DURATION_MS);
  }

  // Проверяет, пора ли поднимать ворота (фаза 2).
  private checkPhaseChange(): void {
    if (this.goalsUp) return;
    if (this.score.p1 >= GOALS_TO_PHASE_2 || this.score.p2 >= GOALS_TO_PHASE_2) {
      if (this.phaseChangeTimeout) clearTimeout(this.phaseChangeTimeout);
      this.phaseChangeTimeout = window.setTimeout(() => {
        this.phaseChangeTimeout = null;
        if (!this.gameEnded && !this.goalsUp) this.setGoalsUp();
      }, PHASE_CHANGE_DELAY_MS);
    }
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
      if (this.timeLeft <= 0) this.endMatch();
    }, TIMER_INTERVAL_MS);
  }

  // Завершает матч: останавливает таймер и показывает победителя.
  private endMatch(): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.running = false;
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
    gameOverEl.classList.remove("hidden");
  }

  // Начинает матч (вызывается со стартового экрана или по пробелу).
  public startGame(): void {
    if (this.running) return;
    this.running = true;
    startScreenEl.classList.add("hidden");
    gameOverEl.classList.add("hidden");
    this.startTimer();
  }

  // Переключает паузу (останавливает/запускает физику).
  private togglePause(): void {
    if (!this.running || this.gameEnded) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.jumpQueued = { p1: false, p2: false };
      Runner.stop(this.runner);
      pauseScreenEl.classList.remove("hidden");
    } else {
      Runner.start(this.runner, this.engine);
      pauseScreenEl.classList.add("hidden");
    }
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
          this.score.p1++;
          p1ScoreEl.textContent = this.score.p1.toString();
          this.showGoal(UI_TEXT.goalP1);
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
          this.score.p2++;
          p2ScoreEl.textContent = this.score.p2.toString();
          this.showGoal(UI_TEXT.goalP2);
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

      const height = window.innerHeight;
      const groundY = height - GROUND_HEIGHT;

      // Игрок считается на земле, если он в зоне GROUND_JUMP_ZONE над землёй
      const isOnGround = (player: Player) => {
        return player.body.position.y > groundY - GROUND_JUMP_ZONE;
      };

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

      // --- Управление Игроком 1 (A / D / W) ---
      if (this.keys.has(KEYS.player1.left)) {
        Body.applyForce(this.player1.body, this.player1.body.position, { x: -MOVE_FORCE, y: 0 });
      }
      if (this.keys.has(KEYS.player1.right)) {
        Body.applyForce(this.player1.body, this.player1.body.position, { x: MOVE_FORCE, y: 0 });
      }
      if (this.jumpQueued.p1 && isOnGround(this.player1)) {
        Body.setVelocity(this.player1.body, { x: this.player1.body.velocity.x, y: this.jumpVelocity });
      }
      this.jumpQueued.p1 = false;

      // --- Управление Игроком 2 (← / → / ↑) ---
      if (this.keys.has(KEYS.player2.left)) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: -MOVE_FORCE, y: 0 });
      }
      if (this.keys.has(KEYS.player2.right)) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: MOVE_FORCE, y: 0 });
      }
      if (this.jumpQueued.p2 && isOnGround(this.player2)) {
        Body.setVelocity(this.player2.body, { x: this.player2.body.velocity.x, y: this.jumpVelocity });
      }
      this.jumpQueued.p2 = false;

      // Ограничиваем максимальную скорость игроков
      [this.player1.body, this.player2.body].forEach((p) => {
        if (p.velocity.x > MAX_PLAYER_SPEED) Body.setVelocity(p, { x: MAX_PLAYER_SPEED, y: p.velocity.y });
        if (p.velocity.x < -MAX_PLAYER_SPEED) Body.setVelocity(p, { x: -MAX_PLAYER_SPEED, y: p.velocity.y });
      });
    });

    // При изменении размера окна подстраиваем размер canvas
    window.addEventListener("resize", () => {
      this.render.canvas.width = window.innerWidth;
      this.render.canvas.height = window.innerHeight;
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
      // Запоминаем прыжок, если клавиша нажата впервые (чтобы не прыгать повторно при удержании)
      if (!this.keys.has(e.code)) {
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

    // Кнопка «Играть снова» — полный сброс матча
    restartBtn.addEventListener("click", () => {
      this.score = { p1: 0, p2: 0 };
      p1ScoreEl.textContent = "0";
      p2ScoreEl.textContent = "0";
      this.gameEnded = false;
      this.running = false;
      this.paused = false;
      this.goalLocked = false;
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
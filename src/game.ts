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
  GOALS_TO_PHASE_3,
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
  BALL_PHASE_4_RADIUS,
  BALL_START_Y_RATIO,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  BALL_DENSITY,
  BALL_STROKE_WIDTH,
  BALL_AUTO_BOUNCE_VELOCITY,
  BALL_AUTO_BOUNCE_ZONE,
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
  winnerTextEl,
} from "./dom";
import { createArena, setGoalPositions, getGoalYBottom, getGoalYTop, type Arena } from "./arena";
import { createPlayer, resetJumps, tryConsumeJump, type Player } from "./player";
import { burstConfetti, clearConfetti, setConfettiPaused } from "./confetti";

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
  private phase = 1; // текущая фаза матча (1 — обычная, 2 — ворота сверху, 3 — ворота сверху + двойной прыжок, 4 — большой мяч на минуту)
  private jumpVelocity = JUMP_VELOCITY; // текущая скорость прыжка (меняется в фазе 2)
  private phase4SecondsLeft = 0; // сколько секунд осталось до возврата мяча к обычному размеру (фаза 4)
  private phase4Started = false; // начиналась ли уже фаза 4 в этом матче (чтобы не запускалась повторно)
  private ballScale = 1; // текущий масштаб мяча относительно BALL_RADIUS (для корректного возврата размера)
  private jumpQueued = { p1: false, p2: false }; // запрошенные прыжки (срабатывают при касании земли)
  private goalLocked = false; // заблокирован ли счёт голов (пока идёт сброс раунда после гола)
  private goalResetTimeout: number | null = null; // id таймаута сброса раунда после гола
  private goalTextTimeout: number | null = null; // id таймаута скрытия надписи «ГОЛ!»
  private slowmoRafId: number | null = null; // id анимации плавного входа в слоу-мо

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
      this.arena.goalLeftSideFiller,
      this.arena.goalRightSideFiller,
      this.arena.goalLeftBackWall,
      this.arena.goalRightBackWall,
    ]);
  }

  // Поднимает ворота вверх (фаза 2) и усиливает прыжок.
  private setGoalsUp(): void {
    this.phase = 2;
    this.jumpVelocity = JUMP_VELOCITY_GOALS_UP;
    setGoalPositions(this.arena, this.world, window.innerWidth, window.innerHeight, getGoalYTop(window.innerHeight));
    this.showGoal(UI_TEXT.goalsUp);
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
  }

  // Включает фазу 4: мяч становится больше на минуту.
  // Ворота остаются сверху (как в фазах 2 и 3), двойной прыжок сохраняется.
  private setPhase4(): void {
    this.phase = 4;
    this.phase4SecondsLeft = PHASE_4_DURATION_S;
    this.enlargeBall();
    this.showGoal(UI_TEXT.phase4);
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
    setGoalPositions(this.arena, this.world, window.innerWidth, window.innerHeight, getGoalYBottom(window.innerHeight));
    // Скрываем индикатор двойного прыжка (полный рестарт матча)
    doubleJumpHintEl.classList.add("hidden");
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
    this.resetTimeScale(); // возвращаем нормальную скорость времени после слоу-мо
    this.clearGoalCelebration(); // убираем надпись «ГОЛ!» и конфетти
    this.jumpQueued = { p1: false, p2: false }; // сбрасываем накопленные прыжки
    this.spawnPlayers();
    this.resetBall();
  }

  // Запускает slow-motion после гола: плавно снижает масштаб времени физики.
  // Замедление действует до сброса раунда (кулдаун перезапуска не меняется).
  private startGoalSlowmo(): void {
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

  // Возвращает масштаб времени к нормальному (1) и отменяет анимацию замедления.
  private resetTimeScale(): void {
    this.stopGoalSlowmo();
    this.engine.timing.timeScale = 1;
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
    this.clearGoalCelebration(); // убираем конфетти и надпись, если матч кончился в момент гола
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
      setConfettiPaused(true); // замораживаем частицы конфетти
      document.body.classList.add("paused"); // замирает CSS-анимация надписи
      pauseScreenEl.classList.remove("hidden");
    } else {
      Runner.start(this.runner, this.engine);
      setConfettiPaused(false);
      document.body.classList.remove("paused");
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
          this.startGoalSlowmo(); // включаем слоу-мо на время до сброса раунда
          this.score.p1++;
          p1ScoreEl.textContent = this.score.p1.toString();
          this.showGoal(UI_TEXT.goalP1, PLAYER_1_COLOR); // красочное празднование в цвете Игрока 1
          burstConfetti("right"); // хлопушки из правых ворот, куда забит мяч
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
          burstConfetti("left"); // хлопушки из левых ворот, куда забит мяч
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

      // --- Управление игроками (полностью отключено в состоянии «гол») ---
      if (!this.goalLocked) {
        // --- Управление Игроком 1 (A / D / W) ---
        if (this.keys.has(KEYS.player1.left)) {
          Body.applyForce(this.player1.body, this.player1.body.position, { x: -MOVE_FORCE, y: 0 });
        }
        if (this.keys.has(KEYS.player1.right)) {
          Body.applyForce(this.player1.body, this.player1.body.position, { x: MOVE_FORCE, y: 0 });
        }
        if (this.jumpQueued.p1) {
          if (isOnGround(this.player1)) {
            // Обычный (земной) прыжок: счётчик прыжков сбрасывается при касании земли
            resetJumps(this.player1);
            if (this.phase >= 3) tryConsumeJump(this.player1); // в фазе 3 земной прыжок расходует один из двух
            Body.setVelocity(this.player1.body, { x: this.player1.body.velocity.x, y: this.jumpVelocity });
          } else if (this.phase >= 3 && tryConsumeJump(this.player1)) {
            // Двойной прыжок (только с фазы 3): второй прыжок в воздухе
            Body.setVelocity(this.player1.body, { x: this.player1.body.velocity.x, y: this.jumpVelocity });
          }
        }
        this.jumpQueued.p1 = false;

        // --- Управление Игроком 2 (← / → / ↑) ---
        if (this.keys.has(KEYS.player2.left)) {
          Body.applyForce(this.player2.body, this.player2.body.position, { x: -MOVE_FORCE, y: 0 });
        }
        if (this.keys.has(KEYS.player2.right)) {
          Body.applyForce(this.player2.body, this.player2.body.position, { x: MOVE_FORCE, y: 0 });
        }
        if (this.jumpQueued.p2) {
          if (isOnGround(this.player2)) {
            // Обычный (земной) прыжок: счётчик прыжков сбрасывается при касании земли
            resetJumps(this.player2);
            if (this.phase >= 3) tryConsumeJump(this.player2); // в фазе 3 земной прыжок расходует один из двух
            Body.setVelocity(this.player2.body, { x: this.player2.body.velocity.x, y: this.jumpVelocity });
          } else if (this.phase >= 3 && tryConsumeJump(this.player2)) {
            // Двойной прыжок (только с фазы 3): второй прыжок в воздухе
            Body.setVelocity(this.player2.body, { x: this.player2.body.velocity.x, y: this.jumpVelocity });
          }
        }
        this.jumpQueued.p2 = false;
      }

      // Ограничиваем максимальную скорость игроков
      [this.player1.body, this.player2.body].forEach((p) => {
        if (p.velocity.x > MAX_PLAYER_SPEED) Body.setVelocity(p, { x: MAX_PLAYER_SPEED, y: p.velocity.y });
        if (p.velocity.x < -MAX_PLAYER_SPEED) Body.setVelocity(p, { x: -MAX_PLAYER_SPEED, y: p.velocity.y });
      });

      // Автоподскок мяча: если мяч лежит или медленно катится по земле,
      // сам придаём ему вертикальную скорость, чтобы он не переставал прыгать
      const ballNearGround = this.ball.position.y > groundY - BALL_AUTO_BOUNCE_ZONE;
      const ballVerticalSpeedSlow = Math.abs(this.ball.velocity.y) < BALL_AUTO_BOUNCE_SPEED_THRESHOLD;
      if (ballNearGround && ballVerticalSpeedSlow) {
        Body.setVelocity(this.ball, { x: this.ball.velocity.x, y: BALL_AUTO_BOUNCE_VELOCITY });
      }
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

    // Кнопка «Играть снова» — полный сброс матча
    restartBtn.addEventListener("click", () => {
      this.score = { p1: 0, p2: 0 };
      p1ScoreEl.textContent = "0";
      p2ScoreEl.textContent = "0";
      this.gameEnded = false;
      this.running = false;
      this.paused = false;
      this.goalLocked = false;
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
// Ragdoll Duel - MVP (Matter.js)
// Простой локальный 1v1 для показа преподавателю

const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Constraint = Matter.Constraint;
const Events = Matter.Events;
const Composite = Matter.Composite;

const canvas = document.getElementById("canvas");

// UI
const p1ScoreEl = document.getElementById("p1-score");
const p2ScoreEl = document.getElementById("p2-score");
const timerEl = document.getElementById("timer");
const goalTextEl = document.getElementById("goal-text");
const gameOverEl = document.getElementById("game-over");
const winnerTextEl = document.getElementById("winner-text");
const restartBtn = document.getElementById("restart-btn");
const startTextEl = document.getElementById("start-text");

// Настройки
const GROUND_HEIGHT = 60;
const GOAL_WIDTH = 14;
const GOAL_HEIGHT = 160;
const BALL_RADIUS = 16;
const RAGDOLL_SCALE = 0.95;

let engine;
let render;
let world;

let ground;
let leftWall;
let rightWall;
let topWall;
let goalLeft;
let goalRight;
let goalLeftSensor;
let goalRightSensor;

let ragdoll1 = null; // { parts: {...}, constraints: [...] }
let ragdoll2 = null;

let ball;
let ballLastContact = null; // "p1" | "p2" | null

let score = { p1: 0, p2: 0 };
let timeLeft = 60;
let timerId = null;
let running = false;
let gameEnded = false;

// Управление
const keys = new Set();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  if (render) {
    render.canvas.width = width;
    render.canvas.height = height;
    render.bounds.max.x = width;
    render.bounds.max.y = height;
    Render.setPixelRatio(render, window.devicePixelRatio || 1);
  }
}

function showGoal(text) {
  goalTextEl.textContent = text;
  goalTextEl.classList.remove("hidden");
  setTimeout(() => {
    goalTextEl.classList.add("hidden");
  }, 1400);
}

function startTimer() {
  clearInterval(timerId);
  timeLeft = 60;
  timerEl.textContent = timeLeft.toString();
  timerId = setInterval(() => {
    if (!running || gameEnded) return;
    timeLeft -= 1;
    timerEl.textContent = timeLeft.toString();
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function startGame() {
  if (running) return;
  running = true;
  startTextEl.classList.add("hidden");
  gameOverEl.classList.add("hidden");
  startTimer();
}

function resetRound() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (ragdoll1) resetRagdoll(ragdoll1, width * 0.25, height - GROUND_HEIGHT - 110);
  if (ragdoll2) resetRagdoll(ragdoll2, width * 0.75, height - GROUND_HEIGHT - 110);
  if (ball) {
    Body.setPosition(ball, {
      x: width / 2,
      y: height * 0.38,
    });
    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);
  }
  ballLastContact = null;
}

function endGame() {
  if (gameEnded) return;
  gameEnded = true;
  running = false;
  clearInterval(timerId);
  let winner = "Ничья";
  if (score.p1 > score.p2) winner = "Победил Игрок 1 (W A D)";
  else if (score.p2 > score.p1) winner = "Победил Игрок 2 (← ↑ →)";
  else winner = "Ничья";
  winnerTextEl.textContent = winner;
  gameOverEl.classList.remove("hidden");
}

function createRagdoll(x, y, color) {
  const parts = {};
  const group = Body.nextGroup(true);
  const s = RAGDOLL_SCALE;

  // Размеры (человекоподобные)
  const headR = 11 * s;
  const torsoW = 20 * s;
  const torsoH = 34 * s;
  const pelvisW = 18 * s;
  const pelvisH = 16 * s;

  const upperArmW = 7 * s;
  const upperArmH = 22 * s;
  const lowerArmW = 6 * s;
  const lowerArmH = 20 * s;

  const thighW = 9 * s;
  const thighH = 30 * s;
  const legW = 8 * s;
  const legH = 28 * s;
  const footW = 16 * s;
  const footH = 6 * s;

  // Таз
  parts.pelvis = Bodies.rectangle(x, y + torsoH / 2 + pelvisH / 2 - 2, pelvisW, pelvisH, {
    label: "pelvis",
    collisionFilter: { group },
    friction: 0.9,
    frictionAir: 0.02,
    restitution: 0.05,
    render: { fillStyle: color },
  });

  // Грудная клетка
  parts.torso = Bodies.rectangle(x, y, torsoW, torsoH, {
    label: "torso",
    collisionFilter: { group },
    friction: 0.85,
    frictionAir: 0.02,
    restitution: 0.05,
    render: { fillStyle: color },
  });

  // Голова
  parts.head = Bodies.circle(x, y - torsoH / 2 - headR + 1, headR, {
    label: "head",
    collisionFilter: { group },
    friction: 0.6,
    restitution: 0.15,
    render: { fillStyle: color },
  });

  // Руки
  parts.upperArmL = Bodies.rectangle(x - torsoW / 2 - upperArmW / 2 - 1, y - torsoH / 2 + 6, upperArmW, upperArmH, {
    label: "upperArmL",
    collisionFilter: { group },
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: color },
  });
  parts.upperArmR = Bodies.rectangle(x + torsoW / 2 + upperArmW / 2 + 1, y - torsoH / 2 + 6, upperArmW, upperArmH, {
    label: "upperArmR",
    collisionFilter: { group },
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: color },
  });

  parts.lowerArmL = Bodies.rectangle(x - torsoW / 2 - upperArmW / 2 - 1, y - torsoH / 2 + 6 + upperArmH / 2 + lowerArmH / 2 - 2, lowerArmW, lowerArmH, {
    label: "lowerArmL",
    collisionFilter: { group },
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: color },
  });
  parts.lowerArmR = Bodies.rectangle(x + torsoW / 2 + upperArmW / 2 + 1, y - torsoH / 2 + 6 + upperArmH / 2 + lowerArmH / 2 - 2, lowerArmW, lowerArmH, {
    label: "lowerArmR",
    collisionFilter: { group },
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: color },
  });

  // Бёдра
  parts.thighL = Bodies.rectangle(x - 4, y + torsoH / 2 + pelvisH + thighH / 2 - 6, thighW, thighH, {
    label: "thighL",
    collisionFilter: { group },
    friction: 0.9,
    restitution: 0.05,
    render: { fillStyle: color },
  });
  parts.thighR = Bodies.rectangle(x + 4, y + torsoH / 2 + pelvisH + thighH / 2 - 6, thighW, thighH, {
    label: "thighR",
    collisionFilter: { group },
    friction: 0.9,
    restitution: 0.05,
    render: { fillStyle: color },
  });

  // Голени
  parts.legL = Bodies.rectangle(x - 4, y + torsoH / 2 + pelvisH + thighH + legH / 2 - 8, legW, legH, {
    label: "legL",
    collisionFilter: { group },
    friction: 0.95,
    restitution: 0.02,
    render: { fillStyle: color },
  });
  parts.legR = Bodies.rectangle(x + 4, y + torsoH / 2 + pelvisH + thighH + legH / 2 - 8, legW, legH, {
    label: "legR",
    collisionFilter: { group },
    friction: 0.95,
    restitution: 0.02,
    render: { fillStyle: color },
  });

  // Стопы
  parts.footL = Bodies.rectangle(x - 4 + 4, y + torsoH / 2 + pelvisH + thighH + legH + footH / 2 - 8, footW, footH, {
    label: "footL",
    collisionFilter: { group },
    friction: 1.0,
    restitution: 0.01,
    render: { fillStyle: color },
  });
  parts.footR = Bodies.rectangle(x + 4 + 4, y + torsoH / 2 + pelvisH + thighH + legH + footH / 2 - 8, footW, footH, {
    label: "footR",
    collisionFilter: { group },
    friction: 1.0,
    restitution: 0.01,
    render: { fillStyle: color },
  });

  const constraints = [];

  // Шея
  constraints.push(
    Constraint.create({
      bodyA: parts.torso,
      bodyB: parts.head,
      pointA: { x: 0, y: -torsoH / 2 },
      pointB: { x: 0, y: headR },
      stiffness: 0.6,
      damping: 0.12,
      length: 0.5,
    })
  );

  // Торс — таз
  constraints.push(
    Constraint.create({
      bodyA: parts.torso,
      bodyB: parts.pelvis,
      pointA: { x: 0, y: torsoH / 2 },
      pointB: { x: 0, y: -pelvisH / 2 },
      stiffness: 0.55,
      damping: 0.1,
      length: 1,
    })
  );

  // Плечи
  constraints.push(
    Constraint.create({
      bodyA: parts.torso,
      bodyB: parts.upperArmL,
      pointA: { x: -torsoW / 2, y: -torsoH / 2 + 8 },
      pointB: { x: 0, y: -upperArmH / 2 + 2 },
      stiffness: 0.45,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.25,
      angleB: Math.PI * 0.25,
    })
  );
  constraints.push(
    Constraint.create({
      bodyA: parts.torso,
      bodyB: parts.upperArmR,
      pointA: { x: torsoW / 2, y: -torsoH / 2 + 8 },
      pointB: { x: 0, y: -upperArmH / 2 + 2 },
      stiffness: 0.45,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.25,
      angleB: Math.PI * 0.25,
    })
  );

  // Локти
  constraints.push(
    Constraint.create({
      bodyA: parts.upperArmL,
      bodyB: parts.lowerArmL,
      pointA: { x: 0, y: upperArmH / 2 - 2 },
      pointB: { x: 0, y: -lowerArmH / 2 + 2 },
      stiffness: 0.5,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.15,
      angleB: Math.PI * 0.15,
    })
  );
  constraints.push(
    Constraint.create({
      bodyA: parts.upperArmR,
      bodyB: parts.lowerArmR,
      pointA: { x: 0, y: upperArmH / 2 - 2 },
      pointB: { x: 0, y: -lowerArmH / 2 + 2 },
      stiffness: 0.5,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.15,
      angleB: Math.PI * 0.15,
    })
  );

  // Тазобедренные
  constraints.push(
    Constraint.create({
      bodyA: parts.pelvis,
      bodyB: parts.thighL,
      pointA: { x: -2, y: pelvisH / 2 - 1 },
      pointB: { x: 0, y: -thighH / 2 + 4 },
      stiffness: 0.48,
      damping: 0.09,
      length: 0.5,
      angleA: -Math.PI * 0.2,
      angleB: Math.PI * 0.4,
    })
  );
  constraints.push(
    Constraint.create({
      bodyA: parts.pelvis,
      bodyB: parts.thighR,
      pointA: { x: 2, y: pelvisH / 2 - 1 },
      pointB: { x: 0, y: -thighH / 2 + 4 },
      stiffness: 0.48,
      damping: 0.09,
      length: 0.5,
      angleA: -Math.PI * 0.4,
      angleB: Math.PI * 0.2,
    })
  );

  // Колени
  constraints.push(
    Constraint.create({
      bodyA: parts.thighL,
      bodyB: parts.legL,
      pointA: { x: 0, y: thighH / 2 - 2 },
      pointB: { x: 0, y: -legH / 2 + 3 },
      stiffness: 0.52,
      damping: 0.09,
      length: 0.5,
      angleA: -Math.PI * 0.05,
      angleB: Math.PI * 0.45,
    })
  );
  constraints.push(
    Constraint.create({
      bodyA: parts.thighR,
      bodyB: parts.legR,
      pointA: { x: 0, y: thighH / 2 - 2 },
      pointB: { x: 0, y: -legH / 2 + 3 },
      stiffness: 0.52,
      damping: 0.09,
      length: 0.5,
      angleA: -Math.PI * 0.45,
      angleB: Math.PI * 0.05,
    })
  );

  // Голеностопы (стопы)
  constraints.push(
    Constraint.create({
      bodyA: parts.legL,
      bodyB: parts.footL,
      pointA: { x: 0, y: legH / 2 - 1 },
      pointB: { x: -2, y: -footH / 2 + 1 },
      stiffness: 0.48,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.15,
      angleB: Math.PI * 0.15,
    })
  );
  constraints.push(
    Constraint.create({
      bodyA: parts.legR,
      bodyB: parts.footR,
      pointA: { x: 0, y: legH / 2 - 1 },
      pointB: { x: -2, y: -footH / 2 + 1 },
      stiffness: 0.48,
      damping: 0.08,
      length: 0.5,
      angleA: -Math.PI * 0.15,
      angleB: Math.PI * 0.15,
    })
  );

  const allParts = Object.values(parts);
  const compound = Body.create({
    parts: allParts,
    collisionFilter: { group: -1 },
  });

  World.add(world, [...allParts, ...constraints]);

  return {
    parts,
    constraints,
    compound,
    color,
  };
}

function resetRagdoll(ragdoll, x, y) {
  const s = RAGDOLL_SCALE;

  const headR = 11 * s;
  const torsoH = 34 * s;
  const pelvisH = 16 * s;
  const upperArmH = 22 * s;
  const lowerArmH = 20 * s;
  const thighH = 30 * s;
  const legH = 28 * s;
  const footH = 6 * s;

  // pelvis
  Body.setPosition(ragdoll.parts.pelvis, { x, y: y + torsoH / 2 + pelvisH / 2 - 2 });
  Body.setVelocity(ragdoll.parts.pelvis, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.pelvis, 0);
  Body.setAngle(ragdoll.parts.pelvis, 0);

  // torso
  Body.setPosition(ragdoll.parts.torso, { x, y });
  Body.setVelocity(ragdoll.parts.torso, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.torso, 0);
  Body.setAngle(ragdoll.parts.torso, 0);

  // head
  Body.setPosition(ragdoll.parts.head, { x, y: y - torsoH / 2 - headR + 1 });
  Body.setVelocity(ragdoll.parts.head, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.head, 0);
  Body.setAngle(ragdoll.parts.head, 0);

  // arms
  Body.setPosition(ragdoll.parts.upperArmL, { x: x - 20 * s / 2 - 7 * s / 2 - 1, y: y - torsoH / 2 + 6 });
  Body.setVelocity(ragdoll.parts.upperArmL, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.upperArmL, 0);
  Body.setAngle(ragdoll.parts.upperArmL, -0.2);

  Body.setPosition(ragdoll.parts.upperArmR, { x: x + 20 * s / 2 + 7 * s / 2 + 1, y: y - torsoH / 2 + 6 });
  Body.setVelocity(ragdoll.parts.upperArmR, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.upperArmR, 0);
  Body.setAngle(ragdoll.parts.upperArmR, 0.2);

  Body.setPosition(ragdoll.parts.lowerArmL, { x: x - 20 * s / 2 - 7 * s / 2 - 1, y: y - torsoH / 2 + 6 + upperArmH / 2 + lowerArmH / 2 - 2 });
  Body.setVelocity(ragdoll.parts.lowerArmL, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.lowerArmL, 0);
  Body.setAngle(ragdoll.parts.lowerArmL, -0.25);

  Body.setPosition(ragdoll.parts.lowerArmR, { x: x + 20 * s / 2 + 7 * s / 2 + 1, y: y - torsoH / 2 + 6 + upperArmH / 2 + lowerArmH / 2 - 2 });
  Body.setVelocity(ragdoll.parts.lowerArmR, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.lowerArmR, 0);
  Body.setAngle(ragdoll.parts.lowerArmR, 0.25);

  // legs
  Body.setPosition(ragdoll.parts.thighL, { x: x - 4, y: y + torsoH / 2 + pelvisH + thighH / 2 - 6 });
  Body.setVelocity(ragdoll.parts.thighL, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.thighL, 0);
  Body.setAngle(ragdoll.parts.thighL, 0.1);

  Body.setPosition(ragdoll.parts.thighR, { x: x + 4, y: y + torsoH / 2 + pelvisH + thighH / 2 - 6 });
  Body.setVelocity(ragdoll.parts.thighR, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.thighR, 0);
  Body.setAngle(ragdoll.parts.thighR, -0.1);

  Body.setPosition(ragdoll.parts.legL, { x: x - 4, y: y + torsoH / 2 + pelvisH + thighH + legH / 2 - 8 });
  Body.setVelocity(ragdoll.parts.legL, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.legL, 0);
  Body.setAngle(ragdoll.parts.legL, -0.05);

  Body.setPosition(ragdoll.parts.legR, { x: x + 4, y: y + torsoH / 2 + pelvisH + thighH + legH / 2 - 8 });
  Body.setVelocity(ragdoll.parts.legR, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.legR, 0);
  Body.setAngle(ragdoll.parts.legR, 0.05);

  // feet
  Body.setPosition(ragdoll.parts.footL, { x: x - 4 + 4, y: y + torsoH / 2 + pelvisH + thighH + legH + footH / 2 - 8 });
  Body.setVelocity(ragdoll.parts.footL, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.footL, 0);
  Body.setAngle(ragdoll.parts.footL, 0);

  Body.setPosition(ragdoll.parts.footR, { x: x + 4 + 4, y: y + torsoH / 2 + pelvisH + thighH + legH + footH / 2 - 8 });
  Body.setVelocity(ragdoll.parts.footR, { x: 0, y: 0 });
  Body.setAngularVelocity(ragdoll.parts.footR, 0);
  Body.setAngle(ragdoll.parts.footR, 0);
}

function init() {
  engine = Engine.create({
    gravity: { x: 0, y: 1.25 },
    enableSleeping: false,
  });
  world = engine.world;

  const width = window.innerWidth;
  const height = window.innerHeight;

  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: width,
      height: height,
      wireframes: false,
      background: "#1f7c3f",
      pixelRatio: window.devicePixelRatio || 1,
    },
  });

  // Стены/арена
  ground = Bodies.rectangle(width / 2, height - GROUND_HEIGHT / 2, width + 400, GROUND_HEIGHT, {
    isStatic: true,
    render: { fillStyle: "#2f9c4c" },
    friction: 0.95,
  });
  leftWall = Bodies.rectangle(-20, height / 2, 40, height * 2, { isStatic: true, render: { fillStyle: "#1b5e2f" } });
  rightWall = Bodies.rectangle(width + 20, height / 2, 40, height * 2, { isStatic: true, render: { fillStyle: "#1b5e2f" } });
  topWall = Bodies.rectangle(width / 2, -20, width + 400, 40, { isStatic: true, render: { fillStyle: "#1b5e2f" } });

  // Ворота
  const goalY = height - GROUND_HEIGHT - GOAL_HEIGHT / 2;
  goalLeft = Bodies.rectangle(GOAL_WIDTH / 2, goalY, GOAL_WIDTH, GOAL_HEIGHT, {
    isStatic: true,
    render: { fillStyle: "#ffffffaa" },
    label: "goalPost",
  });
  goalRight = Bodies.rectangle(width - GOAL_WIDTH / 2, goalY, GOAL_WIDTH, GOAL_HEIGHT, {
    isStatic: true,
    render: { fillStyle: "#ffffffaa" },
    label: "goalPost",
  });

  // Сенсоры ворот
  goalLeftSensor = Bodies.rectangle(-2, goalY, 4, GOAL_HEIGHT - 20, {
    isStatic: true,
    isSensor: true,
    label: "goalLeftSensor",
    render: { visible: false },
  });
  goalRightSensor = Bodies.rectangle(width + 2, goalY, 4, GOAL_HEIGHT - 20, {
    isStatic: true,
    isSensor: true,
    label: "goalRightSensor",
    render: { visible: false },
  });

  World.add(world, [ground, leftWall, rightWall, topWall, goalLeft, goalRight, goalLeftSensor, goalRightSensor]);

  // Рагдоллы
  ragdoll1 = createRagdoll(width * 0.25, height - GROUND_HEIGHT - 110, "#4cc9f0");
  ragdoll2 = createRagdoll(width * 0.75, height - GROUND_HEIGHT - 110, "#ff4d6d");

  // Мяч
  ball = Bodies.circle(width / 2, height * 0.38, BALL_RADIUS, {
    label: "ball",
    friction: 0.4,
    frictionAir: 0.01,
    restitution: 0.82,
    density: 0.0019,
    render: { fillStyle: "#fff3cd" },
  });
  World.add(world, ball);

  // События
  Events.on(engine, "collisionStart", (evt) => {
    if (gameEnded) return;
    for (let pair of evt.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;

      let ballBody = null;
      let sensor = null;
      if (a.label === "ball" && (b.label === "goalLeftSensor" || b.label === "goalRightSensor")) {
        ballBody = a;
        sensor = b;
      } else if (b.label === "ball" && (a.label === "goalLeftSensor" || a.label === "goalRightSensor")) {
        ballBody = b;
        sensor = a;
      }
      if (ballBody && sensor) {
        if (sensor.label === "goalRightSensor") {
          score.p1 += 1;
          p1ScoreEl.textContent = score.p1.toString();
          showGoal("ГОЛ! Игрок 1 забил");
          resetRound();
        } else if (sensor.label === "goalLeftSensor") {
          score.p2 += 1;
          p2ScoreEl.textContent = score.p2.toString();
          showGoal("ГОЛ! Игрок 2 забил");
          resetRound();
        }
        return;
      }

      if (a.label === "ball") {
        if (b.label.includes("thigh") || b.label.includes("leg") || b.label.includes("foot") || b.label === "torso" || b.label === "pelvis" || b.label === "head" || b.label.includes("Arm")) {
          ballLastContact = b.position.x < width / 2 ? "p1" : "p2";
        }
      } else if (b.label === "ball") {
        if (a.label.includes("thigh") || a.label.includes("leg") || a.label.includes("foot") || a.label === "torso" || a.label === "pelvis" || a.label === "head" || a.label.includes("Arm")) {
          ballLastContact = a.position.x < width / 2 ? "p1" : "p2";
        }
      }
    }
  });

  // Управление
  Events.on(engine, "beforeUpdate", () => {
    if (!running || gameEnded) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const force = 0.00105;
    const jumpForce = 0.0046;

    const groundY = height - GROUND_HEIGHT;

    // P1
    if (keys.has("KeyA")) {
      Body.applyForce(ragdoll1.parts.torso, ragdoll1.parts.torso.position, { x: -force, y: 0 });
    }
    if (keys.has("KeyD")) {
      Body.applyForce(ragdoll1.parts.torso, ragdoll1.parts.torso.position, { x: force, y: 0 });
    }
    if (keys.has("KeyW")) {
      const f1 = ragdoll1.parts.footL.position.y;
      const f2 = ragdoll1.parts.footR.position.y;
      const l1 = ragdoll1.parts.legL.position.y;
      const l2 = ragdoll1.parts.legR.position.y;
      const feetNearGround = f1 > groundY - 40 || f2 > groundY - 40 || l1 > groundY - 48 || l2 > groundY - 48;
      if (feetNearGround) {
        Body.applyForce(ragdoll1.parts.torso, ragdoll1.parts.torso.position, { x: 0, y: -jumpForce });
      }
    }

    // P2
    if (keys.has("ArrowLeft")) {
      Body.applyForce(ragdoll2.parts.torso, ragdoll2.parts.torso.position, { x: -force, y: 0 });
    }
    if (keys.has("ArrowRight")) {
      Body.applyForce(ragdoll2.parts.torso, ragdoll2.parts.torso.position, { x: force, y: 0 });
    }
    if (keys.has("ArrowUp")) {
      const f1 = ragdoll2.parts.footL.position.y;
      const f2 = ragdoll2.parts.footR.position.y;
      const l1 = ragdoll2.parts.legL.position.y;
      const l2 = ragdoll2.parts.legR.position.y;
      const feetNearGround = f1 > groundY - 40 || f2 > groundY - 40 || l1 > groundY - 48 || l2 > groundY - 48;
      if (feetNearGround) {
        Body.applyForce(ragdoll2.parts.torso, ragdoll2.parts.torso.position, { x: 0, y: -jumpForce });
      }
    }

    const maxVx = 4.6;
    [ragdoll1.parts.torso, ragdoll1.parts.pelvis, ragdoll2.parts.torso, ragdoll2.parts.pelvis].forEach((t) => {
      if (!t) return;
      if (t.velocity.x > maxVx) Body.setVelocity(t, { x: maxVx, y: t.velocity.y });
      if (t.velocity.x < -maxVx) Body.setVelocity(t, { x: -maxVx, y: t.velocity.y });
    });
  });

  Render.run(render);
  Engine.run(engine);

  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!running && !gameEnded) startGame();
      return;
    }
    keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  restartBtn.addEventListener("click", () => {
    score = { p1: 0, p2: 0 };
    p1ScoreEl.textContent = "0";
    p2ScoreEl.textContent = "0";
    gameEnded = false;
    running = false;
    resetRound();
    startTextEl.classList.remove("hidden");
    gameOverEl.classList.add("hidden");
    clearInterval(timerId);
    timerEl.textContent = "60";
  });

  resetRound();
}

init();

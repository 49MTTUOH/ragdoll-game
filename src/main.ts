import './style.css';
import { Engine, Render, World, Bodies, Body, Events, Runner } from 'matter-js';

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const p1ScoreEl = document.getElementById("p1-score") as HTMLElement;
const p2ScoreEl = document.getElementById("p2-score") as HTMLElement;
const timerEl = document.getElementById("timer") as HTMLElement;
const goalTextEl = document.getElementById("goal-text") as HTMLElement;
const gameOverEl = document.getElementById("game-over") as HTMLElement;
const startScreenEl = document.getElementById("start-screen") as HTMLElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement;
const pauseScreenEl = document.getElementById("pause-screen") as HTMLElement;

const GROUND_HEIGHT = 60;
const GOAL_WIDTH = 60;
const GOAL_HEIGHT = 120;
const BALL_RADIUS = 20;
const GROUND_JUMP_ZONE = 60; // зона у земли, в которой можно прыгнуть
const PHASE_CHANGE_AT = 60; // сколько секунд осталось, когда ворота поднимаются вверх
const MATCH_DURATION = 120; // длительность матча в секундах

class RagdollGame {
  private engine: Engine;
  private render: Render;
  private world: World;
  private runner!: Runner;
  
  private ground!: Body;
  private leftWall!: Body;
  private rightWall!: Body;
  private topWall!: Body;
  private goalLeftPost!: Body;
  private goalRightPost!: Body;
  private goalLeftTopBar!: Body;
  private goalRightTopBar!: Body;
  private goalLeftSensor!: Body;
  private goalRightSensor!: Body;
  
  private player1!: { body: Body; color: string };
  private player2!: { body: Body; color: string };
  private ball!: Body;
  
  private score = { p1: 0, p2: 0 };
  private timeLeft = 120;
  private timerId: number | null = null;
  private running = false;
  private gameEnded = false;
  private paused = false;
  private keys = new Set<string>();
  private goalsUp = false;
  private jumpVelocity = -18; // скорость прыжка (отрицательная = вверх)
  private jumpQueued = { p1: false, p2: false };

  constructor() {
    this.engine = Engine.create({ gravity: { x: 0, y: 1.2 } });
    this.world = this.engine.world;
    
    this.render = Render.create({
      canvas: canvas,
      engine: this.engine,
      options: { 
        width: window.innerWidth, 
        height: window.innerHeight, 
        wireframes: false, 
        background: "#1f7c3f", 
        pixelRatio: window.devicePixelRatio || 1 
      }
    });

    this.setupArena();
    this.setupBall();
    this.spawnPlayers();
    this.setupEvents();
    this.setupInputs();
    
    Render.run(this.render);
    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);
  }

  private setupArena() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.ground = Bodies.rectangle(width / 2, height - GROUND_HEIGHT / 2, width + 400, GROUND_HEIGHT, { 
      isStatic: true, friction: 0.8, render: { fillStyle: "#2f9c4c" } 
    });
    
    const wallHeight = height - GOAL_HEIGHT;
    this.leftWall = Bodies.rectangle(-20, wallHeight / 2, 40, wallHeight, { 
      isStatic: true, render: { fillStyle: "#1b5e2f" } 
    });
    
    this.rightWall = Bodies.rectangle(width + 20, wallHeight / 2, 40, wallHeight, { 
      isStatic: true, render: { fillStyle: "#1b5e2f" } 
    });
    
    this.topWall = Bodies.rectangle(width / 2, -20, width + 400, 40, { 
      isStatic: true, render: { fillStyle: "#1b5e2f" } 
    });

    const goalY = this.getGoalYBottom();
    
    // ЛЕВЫЕ ВОРОТА
    this.goalLeftPost = Bodies.rectangle(GOAL_WIDTH / 2, goalY, 15, GOAL_HEIGHT, { 
      isStatic: true, render: { fillStyle: "#ffffff" }, label: "goalPost" 
    });
    
    this.goalLeftTopBar = Bodies.rectangle(GOAL_WIDTH / 2, goalY - GOAL_HEIGHT / 2, GOAL_WIDTH + 15, 15, { 
      isStatic: true, render: { fillStyle: "#ffffff" }, label: "goalPost" 
    });
    
    this.goalLeftSensor = Bodies.rectangle(GOAL_WIDTH / 2, goalY + 20, 30, GOAL_HEIGHT - 40, { 
      isStatic: true, isSensor: true, label: "goalLeftSensor", 
      render: { fillStyle: "rgba(255,0,0,0.3)" } 
    });
    
    // ПРАВЫЕ ВОРОТА (симметричные)
    this.goalRightPost = Bodies.rectangle(width - GOAL_WIDTH / 2, goalY, 15, GOAL_HEIGHT, { 
      isStatic: true, render: { fillStyle: "#ffffff" }, label: "goalPost" 
    });
    
    this.goalRightTopBar = Bodies.rectangle(width - GOAL_WIDTH / 2, goalY - GOAL_HEIGHT / 2, GOAL_WIDTH + 15, 15, { 
      isStatic: true, render: { fillStyle: "#ffffff" }, label: "goalPost" 
    });
    
    this.goalRightSensor = Bodies.rectangle(width - GOAL_WIDTH / 2, goalY + 20, 30, GOAL_HEIGHT - 40, { 
      isStatic: true, isSensor: true, label: "goalRightSensor", 
      render: { fillStyle: "rgba(0,255,0,0.3)" } 
    });

    World.add(this.world, [
      this.ground, this.leftWall, this.rightWall, this.topWall,
      this.goalLeftPost, this.goalLeftTopBar, this.goalRightPost, this.goalRightTopBar,
      this.goalLeftSensor, this.goalRightSensor
    ]);
  }

  private getGoalYBottom(): number {
    return window.innerHeight - GROUND_HEIGHT - GOAL_HEIGHT / 2;
  }

  private getGoalYTop(): number {
    return window.innerHeight / 2;
  }

  private setGoalPositions(goalY: number) {
    const width = window.innerWidth;
    Body.setPosition(this.goalLeftPost, { x: GOAL_WIDTH / 2, y: goalY });
    Body.setPosition(this.goalLeftTopBar, { x: GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
    Body.setPosition(this.goalLeftSensor, { x: GOAL_WIDTH / 2, y: goalY + 20 });
    Body.setPosition(this.goalRightPost, { x: width - GOAL_WIDTH / 2, y: goalY });
    Body.setPosition(this.goalRightTopBar, { x: width - GOAL_WIDTH / 2, y: goalY - GOAL_HEIGHT / 2 });
    Body.setPosition(this.goalRightSensor, { x: width - GOAL_WIDTH / 2, y: goalY + 20 });
  }

  private setGoalsUp() {
    this.goalsUp = true;
    this.jumpVelocity = -24;
    this.setGoalPositions(this.getGoalYTop());
    this.showGoal("ВОРОТА ПОДНЯЛИСЬ!");
  }

  private setGoalsDown() {
    this.goalsUp = false;
    this.jumpVelocity = -18;
    this.setGoalPositions(this.getGoalYBottom());
  }

  private setupBall() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ball = Bodies.circle(width / 2, height * 0.4, BALL_RADIUS, {
      label: "ball", 
      friction: 0.05, 
      frictionAir: 0.002, 
      restitution: 1.0,
      density: 0.0008,
      render: { fillStyle: "#ffffff", strokeStyle: "#000", lineWidth: 3 }
    });
    World.add(this.world, this.ball);
  }

    private createPlayer(x: number, y: number, color: string): { body: Body; color: string } {
    // Голова (прямоугольная)
    const head = Bodies.rectangle(x, y - 35, 20, 20, { 
        friction: 0.3, restitution: 0.8, density: 0.001, render: { fillStyle: color }
    });
    
    // Тело
    const body = Bodies.rectangle(x, y - 10, 20, 35, { 
        friction: 0.4, restitution: 0.7, density: 0.002, render: { fillStyle: color }
    });
    
    // Ноги (узкие, как у человека)
    const legs = Bodies.rectangle(x, y + 20, 20, 25, { 
        friction: 0.6, restitution: 0.75, density: 0.004, render: { fillStyle: color }
    });
    
    const compound = Body.create({
        parts: [head, body, legs],
        friction: 0.5, restitution: 0.75, density: 0.0025, render: { fillStyle: color }
    });
    
    World.add(this.world, compound);
    return { body: compound, color };
}

  private spawnPlayers() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const groundY = height - GROUND_HEIGHT;
    
    if (this.player1) World.remove(this.world, this.player1.body);
    if (this.player2) World.remove(this.world, this.player2.body);
    
    this.player1 = this.createPlayer(width * 0.3, groundY - 35, "#4cc9f0");
    this.player2 = this.createPlayer(width * 0.7, groundY - 35, "#ff4d6d");
  }

  private resetBall() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    Body.setPosition(this.ball, { x: width / 2, y: height * 0.4 });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
  }

  private resetRound() {
    this.spawnPlayers();
    this.resetBall();
  }

  private showGoal(text: string) {
    goalTextEl.textContent = text;
    goalTextEl.classList.remove("hidden");
    setTimeout(() => goalTextEl.classList.add("hidden"), 1000);
  }

  private startTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timeLeft = MATCH_DURATION;
    timerEl.textContent = this.timeLeft.toString();
    this.timerId = window.setInterval(() => {
      if (!this.running || this.gameEnded || this.paused) return;
      this.timeLeft--;
      timerEl.textContent = this.timeLeft.toString();
      if (this.timeLeft === PHASE_CHANGE_AT && !this.goalsUp) {
        this.setGoalsUp();
      }
      if (this.timeLeft <= 0) this.resetGame();
    }, 1000);
  }

  private resetGame() {
    if (this.timerId) clearInterval(this.timerId);
    this.score = { p1: 0, p2: 0 };
    p1ScoreEl.textContent = "0";
    p2ScoreEl.textContent = "0";
    this.setGoalsDown();
    this.resetRound();
    this.running = true;
    this.gameEnded = false;
    this.startTimer();
  }

  public startGame() {
    if (this.running) return;
    this.running = true;
    startScreenEl.classList.add("hidden");
    gameOverEl.classList.add("hidden");
    this.startTimer();
  }

  private togglePause() {
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

  private setupEvents() {
    Events.on(this.engine, "collisionStart", (evt) => {
      if (this.gameEnded || this.paused) return;
      for (let pair of evt.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        
        if ((a.label === "ball" && b.label === "goalRightSensor") || 
            (b.label === "ball" && a.label === "goalRightSensor")) {
          this.score.p1++; 
          p1ScoreEl.textContent = this.score.p1.toString(); 
          this.showGoal("ГОЛ! Игрок 1");
          setTimeout(() => this.resetRound(), 1500);
          return;
        }
        
        if ((a.label === "ball" && b.label === "goalLeftSensor") || 
            (b.label === "ball" && a.label === "goalLeftSensor")) {
          this.score.p2++; 
          p2ScoreEl.textContent = this.score.p2.toString(); 
          this.showGoal(" ГОЛ! Игрок 2");
          setTimeout(() => this.resetRound(), 1500);
          return;
        }
      }
    });

    Events.on(this.engine, "beforeUpdate", () => {
      if (!this.running || this.gameEnded || this.paused) return;
      
      const height = window.innerHeight;
      const groundY = height - GROUND_HEIGHT;
      
      const moveForce = 0.008;
      
      const isOnGround = (player: { body: Body }) => {
        return player.body.position.y > groundY - GROUND_JUMP_ZONE;
      };
      
      const uprightTorque = 0.0008;
      [this.player1.body, this.player2.body].forEach(p => {
        if (!p) return;
        const angle = p.angle;
        let normalizedAngle = angle % (2 * Math.PI);
        if (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
        if (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;
        
        if (Math.abs(normalizedAngle) > 0.1) {
          Body.applyForce(p, p.position, { x: 0, y: 0 });
          p.torque = -normalizedAngle * uprightTorque * 100;
        }
        
        if (Math.abs(normalizedAngle) < 0.3 && Math.abs(p.angularVelocity) > 0.05) {
          Body.setAngularVelocity(p, p.angularVelocity * 0.7);
        }
      });
      
      if (this.keys.has("KeyA")) {
        Body.applyForce(this.player1.body, this.player1.body.position, { x: -moveForce, y: 0 });
      }
      if (this.keys.has("KeyD")) {
        Body.applyForce(this.player1.body, this.player1.body.position, { x: moveForce, y: 0 });
      }
      if (this.jumpQueued.p1 && isOnGround(this.player1)) {
        Body.setVelocity(this.player1.body, { x: this.player1.body.velocity.x, y: this.jumpVelocity });
      }
      this.jumpQueued.p1 = false;
      
      if (this.keys.has("ArrowLeft")) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: -moveForce, y: 0 });
      }
      if (this.keys.has("ArrowRight")) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: moveForce, y: 0 });
      }
      if (this.jumpQueued.p2 && isOnGround(this.player2)) {
        Body.setVelocity(this.player2.body, { x: this.player2.body.velocity.x, y: this.jumpVelocity });
      }
      this.jumpQueued.p2 = false;
      
      [this.player1.body, this.player2.body].forEach(p => {
        if (p.velocity.x > 8) Body.setVelocity(p, { x: 8, y: p.velocity.y });
        if (p.velocity.x < -8) Body.setVelocity(p, { x: -8, y: p.velocity.y });
      });
    });

    window.addEventListener("resize", () => {
      this.render.canvas.width = window.innerWidth;
      this.render.canvas.height = window.innerHeight;
    });
  }

  private setupInputs() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!this.running && !this.gameEnded) this.startGame();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        this.togglePause();
        return;
      }
      if (!this.keys.has(e.code)) {
        if (e.code === "KeyW") this.jumpQueued.p1 = true;
        if (e.code === "ArrowUp") this.jumpQueued.p2 = true;
      }
      this.keys.add(e.code);
    });
    
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    
    startBtn.addEventListener("click", () => { 
      if (!this.running && !this.gameEnded) this.startGame(); 
    });
    
    restartBtn.addEventListener("click", () => {
      this.score = { p1: 0, p2: 0 };
      p1ScoreEl.textContent = "0";
      p2ScoreEl.textContent = "0";
      this.gameEnded = false;
      this.running = false;
      this.paused = false;
      pauseScreenEl.classList.add("hidden");
      gameOverEl.classList.add("hidden");
      startScreenEl.classList.remove("hidden");
      if (this.timerId) clearInterval(this.timerId);
      timerEl.textContent = MATCH_DURATION.toString();
      this.setGoalsDown();
      this.resetRound();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new RagdollGame();
});
import { Engine, Render, World, Bodies, Body, Events } from 'matter-js';

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const p1ScoreEl = document.getElementById("p1-score") as HTMLElement;
const p2ScoreEl = document.getElementById("p2-score") as HTMLElement;
const timerEl = document.getElementById("timer") as HTMLElement;
const goalTextEl = document.getElementById("goal-text") as HTMLElement;
const gameOverEl = document.getElementById("game-over") as HTMLElement;
const winnerTextEl = document.getElementById("winner-text") as HTMLElement;
const startScreenEl = document.getElementById("start-screen") as HTMLElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement;

const GROUND_HEIGHT = 60;
const GOAL_WIDTH = 60;
const GOAL_HEIGHT = 120;
const BALL_RADIUS = 20;

class RagdollGame {
  private engine: Engine;
  private render: Render;
  private world: World;
  
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
  private timeLeft = 60;
  private timerId: number | null = null;
  private running = false;
  private gameEnded = false;
  private keys = new Set<string>();

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
    Engine.run(this.engine);
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

    const goalY = height - GROUND_HEIGHT - GOAL_HEIGHT / 2;
    
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
    setTimeout(() => goalTextEl.classList.add("hidden"), 1500);
  }

  private startTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timeLeft = 60;
    timerEl.textContent = this.timeLeft.toString();
    this.timerId = window.setInterval(() => {
      if (!this.running || this.gameEnded) return;
      this.timeLeft--;
      timerEl.textContent = this.timeLeft.toString();
      if (this.timeLeft <= 0) this.endGame();
    }, 1000);
  }

  public startGame() {
    if (this.running) return;
    this.running = true;
    startScreenEl.classList.add("hidden");
    gameOverEl.classList.add("hidden");
    this.startTimer();
  }

  private endGame() {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.running = false;
    if (this.timerId) clearInterval(this.timerId);
    
    let winner = "Ничья!";
    if (this.score.p1 > this.score.p2) winner = "🏆 Победил Игрок 1!";
    else if (this.score.p2 > this.score.p1) winner = "🏆 Победил Игрок 2!";
    
    winnerTextEl.textContent = winner;
    gameOverEl.classList.remove("hidden");
  }

  private setupEvents() {
    Events.on(this.engine, "collisionStart", (evt) => {
      if (this.gameEnded) return;
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
      if (!this.running || this.gameEnded) return;
      
      const height = window.innerHeight;
      const groundY = height - GROUND_HEIGHT;
      
      const moveForce = 0.008;
      const jumpForce = 0.04;
      
      const isOnGround = (player: { body: Body }) => {
        return player.body.position.y > groundY - 60;
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
      if (this.keys.has("KeyW") && isOnGround(this.player1)) {
        Body.applyForce(this.player1.body, this.player1.body.position, { x: 0, y: -jumpForce });
      }
      
      if (this.keys.has("ArrowLeft")) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: -moveForce, y: 0 });
      }
      if (this.keys.has("ArrowRight")) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: moveForce, y: 0 });
      }
      if (this.keys.has("ArrowUp") && isOnGround(this.player2)) {
        Body.applyForce(this.player2.body, this.player2.body.position, { x: 0, y: -jumpForce });
      }
      
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
      gameOverEl.classList.add("hidden");
      startScreenEl.classList.remove("hidden");
      if (this.timerId) clearInterval(this.timerId);
      timerEl.textContent = "60";
      this.resetRound();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new RagdollGame();
});
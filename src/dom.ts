// ============================================================
// ССЫЛКИ НА ЭЛЕМЕНТЫ ИНТЕРФЕЙСА (DOM)
// ------------------------------------------------------------
// Все обращения к HTML-элементам собраны в одном месте, чтобы
// игровая логика не зависела напрямую от разметки в index.html.
// Если переименуете id элемента в разметке — обновите его здесь.
// ============================================================

export const canvas = document.getElementById("canvas") as HTMLCanvasElement; // игровой холст (canvas)
export const p1ScoreEl = document.getElementById("p1-score") as HTMLElement; // счёт игрока 1
export const p2ScoreEl = document.getElementById("p2-score") as HTMLElement; // счёт игрока 2
export const timerEl = document.getElementById("timer") as HTMLElement; // таймер матча
export const goalTextEl = document.getElementById("goal-text") as HTMLElement; // надпись «ГОЛ!»
export const gameOverEl = document.getElementById("game-over") as HTMLElement; // экран окончания матча
export const startScreenEl = document.getElementById("start-screen") as HTMLElement; // стартовый экран
export const startBtn = document.getElementById("start-btn") as HTMLButtonElement; // кнопка «Начать»
export const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement; // кнопка «Играть снова»
export const pauseScreenEl = document.getElementById("pause-screen") as HTMLElement; // экран паузы
export const winnerTextEl = document.getElementById("winner-text") as HTMLElement; // текст победителя
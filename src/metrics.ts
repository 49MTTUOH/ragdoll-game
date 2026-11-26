// ============================================================
// ЯНДЕКС МЕТРИКА: ЦЕЛИ
// ------------------------------------------------------------
// Единая точка отправки целей. Сам счётчик подключён в
// index.html, здесь — обёртка над глобальной функцией ym()
// и справочник идентификаторов.
//
// ВАЖНО: значения из GOALS должны ТОЧНО совпадать с полем
// «Идентификатор цели» в Метрике (Настройка → Цели →
// Целевое событие → Идентификатор цели, режим «Совпадает»).
// Менять эти строки после запуска нельзя: история целей
// начнётся заново.
// ============================================================

// Номер счётчика. Публичный (виден в исходниках страницы),
// поэтому хранится прямо в коде — сборка на GitHub Actions
// не имеет доступа к .env.
export const COUNTER_ID = 114691798;

// Идентификаторы целей (то, что вводится в интерфейсе Метрики).
export const GOALS = {
  matchStart: "match_start", // нажали «Начать» (реально начали матч)
  goalScored: "goal_scored", // забит гол (параметры: scorer, phase, total)
  matchFinished: "match_finished", // матч доигран до конца (p1, p2)
  rematch: "rematch", // нажали «Играть снова» после финала
  phaseReached: "phase_reached", // дошли до фазы (параметр phase: 2 | 3 | 4)
} as const;

export type GoalName = (typeof GOALS)[keyof typeof GOALS];

// Значения параметров цели: только строки и числа.
export type GoalParams = Record<string, string | number>;

// Глобальная функция из сниппета Метрики. Сниппет создаёт её
// синхронно (как очередь вызовов), поэтому обращаться к ней
// можно в любой момент, даже до загрузки tag.js.
type YmFunction = (counterId: number, action: string, ...args: unknown[]) => void;

function ymSafe(...args: Parameters<YmFunction>): void {
  const ym = (window as unknown as { ym?: YmFunction }).ym;
  if (typeof ym !== "function") return; // сниппет не подключён или заблокирован
  ym(...args);
}

// Аналитика включена, если счётчик инициализирован в index.html.
// Там такая же проверка: на localhost инициализация пропускается,
// а параметр ?ym=1 включает её принудительно (для отладки целей).
function isEnabled(): boolean {
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (!isLocal) return true;
  return new URLSearchParams(window.location.search).has("ym");
}

// Отправляет цель в Метрику. Если аналитика отключена или сниппет
// не загрузился — молча ничего не делает, чтобы аналитика ни при
// каких условиях не могла сломать игру.
export function reachGoal(goal: GoalName, params?: GoalParams): void {
  if (!isEnabled()) return;
  ymSafe(COUNTER_ID, "reachGoal", goal, params);
}

// ============================================================
// ФУТБОЛЬНЫЙ МЯЧ (ПРОЦЕДУРНАЯ ОТРИСОВКА)
// ------------------------------------------------------------
// Matter.js рисует мяч как обычный белый круг. Чтобы мяч
// выглядел футбольным, его физическое тело делается невидимым
// (render.visible = false), а поверх в обработчике afterRender
// рисуется белый круг с чёрными пятиугольниками.
//
// Рисунок поворачивается вместе с мячом (body.angle), поэтому
// видно, как мяч катится. Радиус берётся из физического тела,
// так что увеличение мяча в фазе 4 подхватывается автоматически.
// ============================================================

import type { Body } from "matter-js";
import { BALL_STROKE_WIDTH, COLORS } from "./config";

// ---------- ПРОПОРЦИИ РИСУНКА ----------
const CENTER_PATCH_RATIO = 0.38; // радиус центрального пятиугольника (доля радиуса мяча)
const OUTER_PATCH_RATIO = 0.3; // радиус пяти боковых пятиугольников
const OUTER_DISTANCE_RATIO = 0.7; // расстояние до центров боковых пятиугольников
const PATCH_COUNT = 5; // сколько пятиугольников вокруг центрального
const OUTLINE_RATIO = 0.05; // толщина обводки относительно радиуса

// Цвета классического футбольного мяча (из общей палитры игры).
const BALL_WHITE = COLORS.ball;
const BALL_BLACK = COLORS.ballStroke;

// Строит путь правильного пятиугольника с центром (cx, cy).
function pentagonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = rotation + (i * Math.PI * 2) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Рисует футбольный мяч поверх физического тела (в мировых координатах).
export function drawSoccerBall(ctx: CanvasRenderingContext2D, body: Body): void {
  const radius = body.circleRadius;
  if (!radius) return;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  // Белая основа мяча
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = BALL_WHITE;
  ctx.fill();

  // Чёрные пятиугольники, обрезанные по контуру мяча
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = BALL_BLACK;

  // Центральный пятиугольник
  pentagonPath(ctx, 0, 0, radius * CENTER_PATCH_RATIO, 0);
  ctx.fill();

  // Пятиугольники по кругу
  for (let i = 0; i < PATCH_COUNT; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / PATCH_COUNT;
    const cx = Math.cos(angle) * radius * OUTER_DISTANCE_RATIO;
    const cy = Math.sin(angle) * radius * OUTER_DISTANCE_RATIO;
    pentagonPath(ctx, cx, cy, radius * OUTER_PATCH_RATIO, angle + Math.PI / 5);
    ctx.fill();
  }
  ctx.restore();

  // Тёмная обводка
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(BALL_STROKE_WIDTH, radius * OUTLINE_RATIO);
  ctx.strokeStyle = BALL_BLACK;
  ctx.stroke();

  ctx.restore();
}

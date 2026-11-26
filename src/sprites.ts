// ============================================================
// ГРАФИКА ПЕРСОНАЖЕЙ (СПРАЙТЫ)
// ------------------------------------------------------------
// Физика персонажей остаётся прямоугольной (голова и тело),
// но сами прямоугольники не рисуются: поверх них в обработчике
// afterRender рисуются спрайты из набора «Shape Characters»
// (Kenney, лицензия CC0 — public/sprites/characters/License-Kenney.txt).
//
// Из чего собран персонаж:
//   голова  — круглый корпус + лицо (эмоция);
//   туловище — скруглённый квадрат;
//   руки — кисть (зеркалится для левой/правой стороны).
//
// Все пропорции заданы коэффициентами ниже — их можно подкручивать,
// не трогая физику.
// ============================================================

import type { Body } from "matter-js";

// Каким набором спрайтов рисуется игрок.
export type PlayerArt = "blue" | "red";

// Метки частей физического тела. По ним отрисовка понимает,
// где голова, а где туловище.
export const PLAYER_PART_LABELS = {
  head: "playerHead",
  body: "playerBody",
} as const;

// Папка со спрайтами. Файлы лежат в public/sprites/characters,
// поэтому путь строится от базового адреса сайта (vite.config.ts → base).
const SPRITES_DIR = `${import.meta.env.BASE_URL}sprites/characters/`;

interface CharacterArt {
  readonly bodyCircle: HTMLImageElement; // круглый корпус — голова
  readonly bodySquircle: HTMLImageElement; // скруглённый корпус — туловище
  readonly hand: HTMLImageElement; // кисть — руки
  readonly face: HTMLImageElement; // лицо поверх головы
}

// Наборы файлов для каждого персонажа.
const ART_FILES: Record<PlayerArt, Record<keyof CharacterArt, string>> = {
  blue: {
    bodyCircle: "blue_body_circle.png",
    bodySquircle: "blue_body_squircle.png",
    hand: "blue_hand_open.png",
    face: "face_a.png", // спокойная улыбка
  },
  red: {
    bodyCircle: "red_body_circle.png",
    bodySquircle: "red_body_squircle.png",
    hand: "red_hand_open.png",
    face: "face_h.png", // злые брови — соперник настроен серьёзно
  },
};

// ---------- ПРОПОРЦИИ ОТРИСОВКИ ----------
const HEAD_SCALE = 1.0; // масштаб круга-головы относительно физической головы
const FACE_WIDTH_RATIO = 0.74; // ширина лица относительно головы
const FACE_OFFSET_Y_RATIO = -0.1; // смещение лица вверх (доля высоты головы)

const TORSO_WIDTH_SCALE = 1.14; // туловище чуть шире физического тела
const TORSO_HEIGHT_SCALE = 1.04;

const ARM_X_RATIO = 0.62; // где крепятся руки (доля ширины туловища)
const ARM_Y_RATIO = -0.08; // по высоте туловища
const ARM_WIDTH_RATIO = 0.46; // размер кисти-руки относительно ширины туловища
const ARM_ANGLE = 0.55; // наклон рук в стороны

// ---------- ЗАГРУЗКА ----------
const loadedArt: Partial<Record<PlayerArt, CharacterArt>> = {};
let spritesAreReady = false;
let loadPromise: Promise<void> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить спрайт: ${src}`));
    image.src = src;
  });
}

// Загружает все спрайты персонажей. Повторные вызовы возвращают
// тот же промис, поэтому грузить можно смело из любого места.
export function preloadSprites(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const keys = Object.keys(ART_FILES) as PlayerArt[];
    const entries = await Promise.all(
      keys.map(async (key) => {
        const files = ART_FILES[key];
        const [bodyCircle, bodySquircle, hand, face] = await Promise.all([
          loadImage(SPRITES_DIR + files.bodyCircle),
          loadImage(SPRITES_DIR + files.bodySquircle),
          loadImage(SPRITES_DIR + files.hand),
          loadImage(SPRITES_DIR + files.face),
        ]);
        return [key, { bodyCircle, bodySquircle, hand, face }] as const;
      })
    );

    for (const [key, value] of entries) loadedArt[key] = value;
    spritesAreReady = true;
  })();

  return loadPromise;
}

// Готовы ли спрайты к отрисовке (иначе рисуем как раньше — ничего).
export function spritesReady(): boolean {
  return spritesAreReady;
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
// Ищет часть составного тела по метке.
function findPart(body: Body, label: string): Body | undefined {
  return body.parts.find((part) => part.label === label);
}

// Размер части в её собственных координатах (не зависит от поворота).
function localSize(part: Body): { w: number; h: number } {
  const cos = Math.cos(-part.angle);
  const sin = Math.sin(-part.angle);
  let halfWidth = 0;
  let halfHeight = 0;

  for (const vertex of part.vertices) {
    const dx = vertex.x - part.position.x;
    const dy = vertex.y - part.position.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    halfWidth = Math.max(halfWidth, Math.abs(localX));
    halfHeight = Math.max(halfHeight, Math.abs(localY));
  }

  return { w: halfWidth * 2, h: halfHeight * 2 };
}

// Рисует спрайт в локальных координатах части тела (lx, ly — от центра части).
function drawLocal(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  part: Body,
  lx: number,
  ly: number,
  width: number,
  height: number,
  extraAngle: number,
  flip: boolean
): void {
  const cos = Math.cos(part.angle);
  const sin = Math.sin(part.angle);

  ctx.save();
  ctx.translate(
    part.position.x + lx * cos - ly * sin,
    part.position.y + lx * sin + ly * cos
  );
  ctx.rotate(part.angle + extraAngle);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

// ---------- ОТРИСОВКА ПЕРСОНАЖА ----------
// Рисует персонажа поверх его физического тела.
export function drawPlayer(ctx: CanvasRenderingContext2D, artKey: PlayerArt, body: Body): void {
  const art = loadedArt[artKey];
  if (!art) return;

  const head = findPart(body, PLAYER_PART_LABELS.head);
  const torso = findPart(body, PLAYER_PART_LABELS.body);
  if (!head || !torso) return;

  const headSize = localSize(head);
  const torsoSize = localSize(torso);

  // Пропорции кисти (картинка вытянута по вертикали).
  const handAspect = art.hand.height / art.hand.width;

  // --- Туловище ---
  drawLocal(ctx, art.bodySquircle, torso, 0, 0, torsoSize.w * TORSO_WIDTH_SCALE, torsoSize.h * TORSO_HEIGHT_SCALE, 0, false);

  // --- Руки ---
  const armWidth = torsoSize.w * ARM_WIDTH_RATIO;
  const armHeight = armWidth * handAspect;
  drawLocal(ctx, art.hand, torso, -torsoSize.w * ARM_X_RATIO, torsoSize.h * ARM_Y_RATIO, armWidth, armHeight, -ARM_ANGLE, true);
  drawLocal(ctx, art.hand, torso, torsoSize.w * ARM_X_RATIO, torsoSize.h * ARM_Y_RATIO, armWidth, armHeight, ARM_ANGLE, false);

  // --- Голова и лицо ---
  drawLocal(ctx, art.bodyCircle, head, 0, 0, headSize.w * HEAD_SCALE, headSize.h * HEAD_SCALE, 0, false);

  const faceWidth = headSize.w * FACE_WIDTH_RATIO;
  const faceHeight = faceWidth * (art.face.height / art.face.width);
  drawLocal(ctx, art.face, head, 0, headSize.h * FACE_OFFSET_Y_RATIO, faceWidth, faceHeight, 0, false);
}

/** Board and fleet rules of classic battleship ("Dengiz jangi", «Морской бой»). */

export const BOARD_SIZE = 10;
export const CELLS = BOARD_SIZE * BOARD_SIZE;
/** One 4-deck, two 3-deck, three 2-deck and four 1-deck ships. */
export const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] as const;
export const SHIP_SIZES = [4, 3, 2, 1] as const;
export const COLUMN_LETTERS = "ABCDEFGHIJ";

/** A ship by its top-left cell. One-deck ships ignore `vertical`. */
export interface Ship {
  x: number;
  y: number;
  length: number;
  vertical: boolean;
}

/** Cell codes on a sea: nothing yet, a miss, a hit, or a miss marked around a sunk ship. */
export const SHOT_NONE = 0;
export const SHOT_MISS = 1;
export const SHOT_HIT = 2;
export const SHOT_AROUND = 3;
export type ShotCode = 0 | 1 | 2 | 3;

export const cellIndex = (x: number, y: number) => y * BOARD_SIZE + x;
export const cellName = (index: number) =>
  `${COLUMN_LETTERS[index % BOARD_SIZE]}${Math.floor(index / BOARD_SIZE) + 1}`;

const inBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;

/** Cell indexes a ship covers (no bounds check). */
export function shipCells(ship: Ship): number[] {
  const cells: number[] = [];
  for (let i = 0; i < ship.length; i++) {
    const x = ship.vertical ? ship.x : ship.x + i;
    const y = ship.vertical ? ship.y + i : ship.y;
    cells.push(cellIndex(x, y));
  }
  return cells;
}

/** The ship lies fully on the board. */
export function shipInBoard(ship: Ship): boolean {
  if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y)) return false;
  if (!Number.isInteger(ship.length) || ship.length < 1 || ship.length > 4) return false;
  const endX = ship.vertical ? ship.x : ship.x + ship.length - 1;
  const endY = ship.vertical ? ship.y + ship.length - 1 : ship.y;
  return inBoard(ship.x, ship.y) && inBoard(endX, endY);
}

/** Cells around a ship (its neighbours, diagonals included), on the board. */
export function shipHalo(ship: Ship): number[] {
  const own = new Set(shipCells(ship));
  const halo = new Set<number>();
  for (const cell of own) {
    const cx = cell % BOARD_SIZE;
    const cy = Math.floor(cell / BOARD_SIZE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!inBoard(x, y)) continue;
        const index = cellIndex(x, y);
        if (!own.has(index)) halo.add(index);
      }
    }
  }
  return [...halo];
}

/** The ship fits on the board without touching any of `others` (not even diagonally). */
export function canPlace(others: readonly Ship[], ship: Ship): boolean {
  if (!shipInBoard(ship)) return false;
  const blocked = new Set<number>();
  for (const other of others) {
    for (const cell of shipCells(other)) blocked.add(cell);
    for (const cell of shipHalo(other)) blocked.add(cell);
  }
  return shipCells(ship).every((cell) => !blocked.has(cell));
}

/** A complete, legal fleet: the classic ten ships, none touching another. */
export function isValidFleet(ships: readonly Ship[]): boolean {
  if (ships.length !== FLEET.length) return false;
  const sizes = ships.map((s) => s.length).sort((a, b) => b - a);
  if (sizes.some((size, i) => size !== FLEET[i])) return false;
  return ships.every((ship, i) => canPlace(ships.slice(0, i), ship));
}

/** One ship's cells as a plain copy (one-deck ships normalised to horizontal). */
export function normaliseShip(ship: Ship): Ship {
  return { x: ship.x, y: ship.y, length: ship.length, vertical: ship.length > 1 && ship.vertical };
}

/** A random legal fleet. Shared by the server (time-outs) and the "Tasodifiy" button. */
export function randomFleet(random: () => number): Ship[] {
  for (let round = 0; round < 100; round++) {
    const ships: Ship[] = [];
    let stuck = false;
    for (const length of FLEET) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const vertical = length > 1 && random() < 0.5;
        const span = BOARD_SIZE - length + 1;
        const ship: Ship = {
          x: Math.floor(random() * (vertical ? BOARD_SIZE : span)),
          y: Math.floor(random() * (vertical ? span : BOARD_SIZE)),
          length,
          vertical,
        };
        if (canPlace(ships, ship)) {
          ships.push(ship);
          placed = true;
        }
      }
      if (!placed) {
        stuck = true;
        break;
      }
    }
    if (!stuck) return ships;
  }
  // Only a broken random source gets here (tests with a constant): a fixed legal fleet.
  return FALLBACK_FLEET.map((ship) => ({ ...ship }));
}

const FALLBACK_FLEET: Ship[] = [
  { x: 0, y: 0, length: 4, vertical: false },
  { x: 5, y: 0, length: 3, vertical: false },
  { x: 0, y: 2, length: 3, vertical: false },
  { x: 4, y: 2, length: 2, vertical: false },
  { x: 7, y: 2, length: 2, vertical: false },
  { x: 0, y: 4, length: 2, vertical: false },
  { x: 3, y: 4, length: 1, vertical: false },
  { x: 5, y: 4, length: 1, vertical: false },
  { x: 7, y: 4, length: 1, vertical: false },
  { x: 9, y: 4, length: 1, vertical: false },
];

/** The ship is sunk when every cell of it was hit. */
export function isSunk(ship: Ship, shots: readonly number[]): boolean {
  return shipCells(ship).every((cell) => shots[cell] === SHOT_HIT);
}

/** Ships still afloat by size: { 4: 1, 3: 2, 2: 3, 1: 4 } for a fresh fleet. */
export function remainingBySize(ships: readonly Ship[], shots: readonly number[]) {
  const left: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const ship of ships)
    if (!isSunk(ship, shots)) left[ship.length] = (left[ship.length] ?? 0) + 1;
  return left;
}

/** A fleet that has not been touched yet. */
export function fullFleetCount(): Record<number, number> {
  const count: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const size of FLEET) count[size] = (count[size] ?? 0) + 1;
  return count;
}

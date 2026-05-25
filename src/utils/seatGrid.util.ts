/** Numeric grid: row and column are both 0–25 (FE grid indices). */

export const GRID_INDEX_MIN = 0;
export const GRID_INDEX_MAX = 25;

export interface SeatGridPlacement {
  seatNumber: number;
  row: number;
  column: number;
}

export interface SeatGridFields {
  seatNumber: number;
  gridRow: string;
  gridColumn: string;
  gridRowIndex: number;
  gridColumnIndex: number;
  cellLabel: string;
}

export const isValidGridIndex = (value: number): boolean =>
  Number.isInteger(value) && value >= GRID_INDEX_MIN && value <= GRID_INDEX_MAX;

export const buildCellLabel = (column: number, row: number): string => `${column}-${row}`;

export const placementToGridFields = (placement: SeatGridPlacement): SeatGridFields => {
  if (!isValidGridIndex(placement.row) || !isValidGridIndex(placement.column)) {
    throw new Error('INVALID_GRID_INDEX');
  }

  return {
    seatNumber: placement.seatNumber,
    gridRow: String(placement.row),
    gridColumn: String(placement.column),
    gridRowIndex: placement.row,
    gridColumnIndex: placement.column,
    cellLabel: buildCellLabel(placement.column, placement.row),
  };
};

/** Default layout: row-major, 0-based column then row (0,0), (1,0), … */
export const defaultPlacementForSeat = (
  seatNumber: number,
  seatMapColumns: number
): SeatGridFields => {
  const gridColumnIndex = (seatNumber - 1) % seatMapColumns;
  const gridRowIndex = Math.floor((seatNumber - 1) / seatMapColumns);

  return {
    seatNumber,
    gridRow: String(gridRowIndex),
    gridColumn: String(gridColumnIndex),
    gridRowIndex,
    gridColumnIndex,
    cellLabel: buildCellLabel(gridColumnIndex, gridRowIndex),
  };
};

export const computeSeatMapRows = (totalSeats: number, seatMapColumns: number): number =>
  Math.ceil(totalSeats / seatMapColumns);

/** Grid size for FE: indices 0..max → count = max + 1 */
export const deriveGridDimensionsFromPlacements = (
  placements: SeatGridPlacement[]
): { seatMapRows: number; seatMapColumns: number } => {
  let maxRow = GRID_INDEX_MIN;
  let maxColumn = GRID_INDEX_MIN;

  for (const placement of placements) {
    maxRow = Math.max(maxRow, placement.row);
    maxColumn = Math.max(maxColumn, placement.column);
  }

  return {
    seatMapRows: maxRow + 1,
    seatMapColumns: maxColumn + 1,
  };
};

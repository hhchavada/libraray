/** Excel-style grid: columns A, B, C… and rows 1, 2, 3… or A, B, C… */

export interface SeatGridPlacement {
  seatNumber: number;
  row: string;
  column: string;
}

export interface SeatGridFields {
  seatNumber: number;
  gridRow: string;
  gridColumn: string;
  gridRowIndex: number;
  gridColumnIndex: number;
  cellLabel: string;
}

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const columnIndexToLetter = (index: number): string => {
  let n = index;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = COLUMN_LETTERS[rem] + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

export const letterToColumnIndex = (label: string): number => {
  const upper = label.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) {
    throw new Error('INVALID_COLUMN');
  }
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index;
};

export const parseGridLabelToIndex = (label: string): number => {
  const trimmed = label.trim().toUpperCase();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return letterToColumnIndex(trimmed);
};

export const buildCellLabel = (column: string, row: string): string =>
  `${column.trim().toUpperCase()}-${row.trim().toUpperCase()}`;

export const placementToGridFields = (placement: SeatGridPlacement): SeatGridFields => {
  const gridColumn = placement.column.trim().toUpperCase();
  const gridRow = placement.row.trim().toUpperCase();

  return {
    seatNumber: placement.seatNumber,
    gridRow,
    gridColumn,
    gridRowIndex: parseGridLabelToIndex(gridRow),
    gridColumnIndex: parseGridLabelToIndex(gridColumn),
    cellLabel: buildCellLabel(gridColumn, gridRow),
  };
};

/** Default layout: fill row-major (A1, B1, … then next row). */
export const defaultPlacementForSeat = (
  seatNumber: number,
  seatMapColumns: number
): SeatGridFields => {
  const columnIndex = ((seatNumber - 1) % seatMapColumns) + 1;
  const rowIndex = Math.floor((seatNumber - 1) / seatMapColumns) + 1;
  const gridColumn = columnIndexToLetter(columnIndex);
  const gridRow = String(rowIndex);

  return {
    seatNumber,
    gridRow,
    gridColumn,
    gridRowIndex: rowIndex,
    gridColumnIndex: columnIndex,
    cellLabel: buildCellLabel(gridColumn, gridRow),
  };
};

export const computeSeatMapRows = (totalSeats: number, seatMapColumns: number): number =>
  Math.ceil(totalSeats / seatMapColumns);

/** Grid size = max row/column used in selected seats (FE renders empty cells around them). */
export const deriveGridDimensionsFromPlacements = (
  placements: SeatGridPlacement[]
): { seatMapRows: number; seatMapColumns: number } => {
  let seatMapRows = 0;
  let seatMapColumns = 0;

  for (const placement of placements) {
    seatMapRows = Math.max(seatMapRows, parseGridLabelToIndex(placement.row));
    seatMapColumns = Math.max(seatMapColumns, parseGridLabelToIndex(placement.column));
  }

  return { seatMapRows, seatMapColumns };
};

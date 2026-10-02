/**
 * The org chart, position by position, in the order it's revealed: row by
 * row, top down, and left to right along each row. `parent` draws the line
 * up to whoever it reports to (always listed before it).
 */
export const ORG = [
  { id: "gd", col: 2, row: 0, level: 0 },
  { id: "pgd", col: 2, row: 1, level: 1, parent: "gd" },
  { id: "ktt", col: 0, row: 2, level: 2, parent: "pgd" },
  { id: "it", col: 1, row: 2, level: 2, parent: "pgd" },
  { id: "kd", col: 2, row: 2, level: 2, parent: "pgd" },
  { id: "ns", col: 3, row: 2, level: 2, parent: "pgd" },
  { id: "bk", col: 4, row: 2, level: 2, parent: "pgd" },
  { id: "kt1", col: 0, row: 3, level: 3, parent: "ktt" },
  { id: "it1", col: 1, row: 3, level: 3, parent: "it" },
  { id: "kd1", col: 2, row: 3, level: 3, parent: "kd" },
  { id: "ns1", col: 3, row: 3, level: 3, parent: "ns" },
  { id: "bk1", col: 4, row: 3, level: 3, parent: "bk" },
  { id: "kt2", col: 0, row: 4, level: 3, parent: "ktt" },
  { id: "kd2", col: 2, row: 4, level: 4, parent: "kd1" },
  { id: "kt3", col: 0, row: 5, level: 3, parent: "ktt" },
  { id: "kd3", col: 2, row: 5, level: 4, parent: "kd1" },
  { id: "kt4", col: 0, row: 6, level: 3, parent: "ktt" },
] as const;
export type OrgId = (typeof ORG)[number]["id"];

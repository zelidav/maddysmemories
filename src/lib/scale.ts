// Ingredient quantity scaling.
// Handles "1 cup", "1/2 tsp", "1 1/2 cups", "0.5 lb", "½ cup", and gracefully
// passes through non-numeric ingredients ("a pinch of salt").

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3,
  '¼': 0.25, '¾': 0.75, '⅕': 0.2,
  '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

interface Parsed {
  qty: number;
  rest: string;
}

export function parseQuantity(line: string): Parsed | null {
  const s = line.trim();
  // mixed: "1 1/2 cups flour"
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\b\s*(.*)$/);
  if (m) return { qty: parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]), rest: m[4] };
  // mixed unicode: "1 ½ cups"
  m = s.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*(.*)$/);
  if (m) return { qty: parseInt(m[1]) + UNICODE_FRACTIONS[m[2]], rest: m[3] };
  // simple fraction: "1/2 cup ..."
  m = s.match(/^(\d+)\s*\/\s*(\d+)\b\s*(.*)$/);
  if (m) return { qty: parseInt(m[1]) / parseInt(m[2]), rest: m[3] };
  // unicode fraction: "½ cup ..."
  m = s.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*(.*)$/);
  if (m) return { qty: UNICODE_FRACTIONS[m[1]], rest: m[2] };
  // decimal or integer: "1.5 cups", "2 eggs"
  m = s.match(/^(\d+(?:\.\d+)?)\b\s*(.*)$/);
  if (m) return { qty: parseFloat(m[1]), rest: m[2] };
  return null;
}

const FRAC_TABLE: Array<[string, number]> = [
  ['1/8', 0.125], ['1/4', 0.25], ['1/3', 1 / 3], ['3/8', 0.375],
  ['1/2', 0.5], ['5/8', 0.625], ['2/3', 2 / 3], ['3/4', 0.75], ['7/8', 0.875],
];

export function formatQuantity(q: number): string {
  if (q <= 0) return '0';
  const tol = 0.025;
  const whole = Math.floor(q);
  const frac = q - whole;
  if (frac < tol) return String(whole);
  for (const [s, v] of FRAC_TABLE) {
    if (Math.abs(frac - v) < tol) return whole > 0 ? `${whole} ${s}` : s;
  }
  // close to next whole
  if (1 - frac < tol) return String(whole + 1);
  // fallback: 1-2 decimal places, trim trailing zeros
  return q < 10
    ? q.toFixed(2).replace(/\.?0+$/, '')
    : q.toFixed(1).replace(/\.?0+$/, '');
}

export function scaleLine(line: string, factor: number): string {
  if (factor === 1) return line;
  const p = parseQuantity(line);
  if (!p) return line; // can't scale (e.g. "pinch of salt")
  const scaled = p.qty * factor;
  return p.rest ? `${formatQuantity(scaled)} ${p.rest}` : formatQuantity(scaled);
}

export function scaleBlock(text: string, factor: number): string {
  if (factor === 1) return text;
  return text
    .split('\n')
    .map((line) => scaleLine(line, factor))
    .join('\n');
}

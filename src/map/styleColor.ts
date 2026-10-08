/** Converts hexadecimal map colors to CSS colors with an explicit alpha channel. */
export function withOpacity(color: string, opacity: number) {
  const normalized = color.replace('#', '');
  const hex = normalized.length === 3 ? normalized.split('').map((value) => value + value).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

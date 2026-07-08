const PALETTE = [
  "bg-primary/14 text-primary",
  "bg-accent/14 text-accent",
  "bg-asset-gold/15 text-asset-gold",
  "bg-gain/13 text-gain",
] as const;

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getSymbolColorClassName(symbol: string): string {
  return PALETTE[hashSymbol(symbol) % PALETTE.length] ?? PALETTE[0];
}

export { getSymbolColorClassName };

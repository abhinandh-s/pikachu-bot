export function formatTerm(code: string): string {
  if (!code || code.length < 3) return code;

  const yy = code.slice(0, 2);
  const m = code.slice(2).toLowerCase();

  const year = `20${yy}`;
  const month = m === 'd' ? 'Dec' : m === 'j' ? 'June' : m;

  return `${year} ${month}`;
}

export function renderLevel(id: string): string {
  // "p7"
  //   ^
  const n = code.slice(1); 

  const res = n > 12 ? 'CMA FINAL' : n > 4 ? 'CMA INTERMEDIATE' : 'CMA FOUNDATION';

  return `<blockqoute>${year}</blockqoute>`;
}

console.log(`p4 = `)

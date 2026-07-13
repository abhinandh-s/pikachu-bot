export function formatTerm(code: string): string {
  if (!code || code.length < 3) return code;

  const yy = code.slice(0, 2);
  const m = code.slice(2).toLowerCase();

  const year = `20${yy}`;
  const month = m === 'd' ? 'Dec' : m === 'j' ? 'June' : m;

  return `${year} ${month}`;
}

// p1 to p19, p20A, p20B, p20C - are all the ids
export function renderLevel(id: string): string {
  // Use `parseInt` to safely extract the integer, handling suffixes like "A", "B", "C"
  const n = parseInt(id.slice(1), 10); 

  const res = n > 12 ? 'CMA FINAL' : n > 4 ? 'CMA INTERMEDIATE' : 'CMA FOUNDATION';

  return `<blockquote>${res}</blockquote>`;
}

console.log(renderLevel("p4"));   // <blockquote>CMA FOUNDATION</blockquote>
console.log(renderLevel("p12"));  // <blockquote>CMA INTERMEDIATE</blockquote>
console.log(renderLevel("p13"));  // <blockquote>CMA FINAL</blockquote>
console.log(renderLevel("p20A")); // <blockquote>CMA FINAL</blockquote>

// Extracts name, id, and syllabus from a single file record object.
export function parseFileRecord(record: SingleFileRecord): RecordDetails {
  const { name, id, syllabus } = record;
  
  return {
    name,       // e.g., "q" or "sa"
    id,         // e.g., "BQACAgU..."
    syllabus    // e.g., "2022" or undefined
  };
}

// Extracts paper_id, term, and paper_type from a formatted key string.
// Example input: "p20A-24j-pyq"
export function parseKey(key: string): KeyDetails {
  const [paper_id, term, paper_type] = key.split("-");
  
  return {
    paper_id,   // e.g., "p5", "p20A"
    term,       // e.g., "24j"
    paper_type  // e.g., "pyq"
  };
}

export function formatTerm(code: string): string {
  if (!code || code.length < 3) return code;

  const yy = code.slice(0, 2);
  const m = code.slice(2).toLowerCase();

  const year = `20${yy}`;
  const month = m === "d" ? "Dec" : m === "j" ? "June" : m;

  return `${year} ${month}`;
}

export function paperIdToLevel(id: string): string {
  switch (id) {
    case "p1":
    case "p2":
    case "p3":
    case "p4":
      return "foundation";

    case "p5":
    case "p6":
    case "p7":
    case "p8":
    case "p9":
    case "p10":
    case "p11":
    case "p12":
      return "intermediate";

    case "p13":
    case "p14":
    case "p15":
    case "p16":
    case "p17":
    case "p18":
    case "p19":
    case "p20": // syllabus 2016
    case "p20A":
    case "p20B":
    case "p20C":
      return "final";

    default:
      return "unknown";
  }
}

import { DocType } from "./types.ts";
import { formatTerm, getPaperDetails, parseFileRecord } from "./utils.ts";
import { paperIdToLevel } from "paper-utils";

export function renderLevel(id: string): string {
  return `<blockquote>CMA ${paperIdToLevel(id).toUpperCase()}</blockquote>`;
}

export function renderSet(id: string): string {
  return id === "s1"
    ? "set: 1"
    : id === "s2"
    ? "set: 2"
    : id === "s1a"
    ? "set: 1 solution"
    : id === "s2a"
    ? "set: 2 solution"
    : id === "q"
    ? "type: Question Paper"
    : id === "a"
    ? "type: Answer Key"
    : id === "sa"
    ? "type: Suggested Answer"
    : id;
}

export function renderSyllabus(ctx: string): string {
  return ctx === "syl16" ? "<b>syllabus</b>: 2016" : ctx === "syl22" ? "<b>syllabus</b>: 2022" : ctx;
}

// | CMA INTERMEDIATE ”
// #PYQ
// paper: Financial Accounting
// paper no: 6
// term: 2025 June
// type: Question Paper
export function renderCaption(
  id: string,
  docType: DocType,
  name: string,
  term: string,
  syllabus?: string,
  kind?: string
): string {
  let caption = "";
  caption += `${renderLevel(id)}\n`;
  caption += `#${docType.toUpperCase()}\n`;
  caption += `📄 paper: ${name}\n`;
  caption += `🗂️ paper no: ${id.replace("p", "")}\n`;
  caption += `📆 term: ${formatTerm(term)}`;
  if (syllabus) {
    caption += `\n📚 syllabus: ${syllabus}`;
  }
  if (kind) {
    caption += `\n🗄️ ${renderSet(kind)}`;
  }
  return caption;
}

// key: p20C-26j-mqp
// FileRecord: -s2-syl22
export function renderCaptionFileRecord(
  id: string,
  docType: DocType,
  term: string,
  record: FileRecord
): string {
  const paper = getPaperDetails(id);
  const { kind, _, syllabus } = parseFileRecord(record);

  return renderCaption(
    id,
    docType,
    paper.name,
    term,
    syllabus,
    kind
  );
}

/*
// adds
console.log(add(1, 1));

// greets
const greeter = new Greeter("world");
console.log(greeter.greet());
*/

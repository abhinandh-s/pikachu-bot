import { paperIdToLevel, DocType } from "./db/mod.ts";

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
    ? "Question Paper"
    : id === "a"
    ? "Answer Key"
    : id === "sa"
    ? "Suggested Answer"
    : id;
}

export function renderSyllabus(ctx: string): string {
  return ctx === "syl16" ? "<b>syllabus</b>: 2016" : ctx === "syl22" ? "<b>syllabus</b>: 2022" : ctx;
}

export function renderCaption(
  _name: string, id: string, docType: DocType
): string {
  let caption = "";
  caption += `${renderLevel(paperId)}\n`;
  caption += `#${docType.toUpperCase()}\n`;
  // const commonCaption = `${header}\n📄 paper: ${paper.name}\n🗂️ paper no: ${id.replace("p", "")}\n📆 term: ${formatTerm(term)}`;

  // if (docType === "pyq") {

  //  caption: `${commonCaption}\n🗄️ ${formatSet(file.name)}`,

  return caption;
}

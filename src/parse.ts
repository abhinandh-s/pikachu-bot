import * as fs from "fs";

export interface FileData {
  ptp: Record<string, string>;
  mqp: Record<string, string>;
  pyq: Record<string, string>;
  unrecognized: unknown[];
}

// @returns The file_id string, or undefined if not found.
export function getFileId(data: FileData, key: string): string | undefined {
  // Array of dictionaries to check
  const searchAreas = [data.ptp, data.mqp, data.pyq];

  for (const area of searchAreas) {
    if (area && key in area) {
      return area[key];
    }
  }
  return undefined; // no key found :(
}

const rawData = fs.readFileSync("./db/syllabus/2016/23d.json", "utf-8");
export const data = JSON.parse(rawData);

// test

const id = getFileId(data, "p15-23d-pyq-syl16");
console.log(id);

import { readFileSync } from "node:fs";
import { resolve } from "@std/path";

export interface FileData {
  ptp: Record<string, string>;
  mqp: Record<string, string>;
  pyq: Record<string, string>;
  unrecognized: unknown[];
}

export function getFileId(data: FileData, key: string): string | undefined {
  const searchAreas = [data.ptp, data.mqp, data.pyq];
  for (const area of searchAreas) {
    if (area && key in area) {
      return area[key];
    }
  }
  return undefined;
}

const jsonPath = resolve(
  new URL("./db/syllabus/2016/23d.json", import.meta.url).pathname
);

const rawData = readFileSync(jsonPath, "utf-8");
export const JSON_DATA = JSON.parse(rawData) as FileData;

// test

const id = getFileId(data, "p15-23d-pyq-syl16");
console.log(id);

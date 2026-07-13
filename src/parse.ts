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

const jsonFiles = [
  "./db/syllabus/2016/23d.json",
  "./db/syllabus/2022/26j.json",
  "./db/syllabus/2022/1.json",
  "./db/syllabus/2022/2.json"
];

// Initialize an empty master object
export const JSON_DATA: FileData = {
  ptp: {},
  mqp: {},
  pyq: {},
  unrecognized: []
};

// Loop through the files, read, parse, and merge them into JSON_DATA
for (const filePath of jsonFiles) {
  const fullPath = resolve(new URL(filePath, import.meta.url).pathname);

  try {
    const rawData = readFileSync(fullPath, "utf-8");
    const parsedData = JSON.parse(rawData) as FileData;

    // Merge the dictionary keys
    Object.assign(JSON_DATA.ptp, parsedData.ptp || {});
    Object.assign(JSON_DATA.mqp, parsedData.mqp || {});
    Object.assign(JSON_DATA.pyq, parsedData.pyq || {});

    // Merge the arrays
    if (parsedData.unrecognized) {
      JSON_DATA.unrecognized.push(...parsedData.unrecognized);
    }
  } catch (err) {
    console.error(`Failed to load or parse JSON at ${filePath}:`, err);
  }
}

// test
const id = getFileId(JSON_DATA, "p15-23d-pyq-syl16");
console.log("Found ID:", id);

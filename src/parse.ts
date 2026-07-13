interface FileData {
  ptp: Record<string, string>;
  mqp: Record<string, string>;
  pyq: Record<string, string>;
  unrecognized: any[];
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
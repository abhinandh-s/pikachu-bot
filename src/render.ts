import { paperIdToLevel } from "./db/mod.ts"

export function renderLevel(id: string):string {
  return `<blockquote>CMA ${paperIdToLevel(id).toUpperCase()}</blockquote>`
}
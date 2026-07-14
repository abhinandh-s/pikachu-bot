import { TERM_26J } from "./syllabus/2022/mod.ts";
export { TERM_26J };

import * as PYQ from "./pyq.ts";
import {
  TERM_23D,
  TERM_23D_L3_MQPS,
  TERM_24D,
  TERM_24D_L3_MQPS,
  TERM_24J,
  TERM_24J_L3_MQPS,
  TERM_25D,
  TERM_25D_L3_MQPS,
  TERM_25J,
  TERM_25J_L3_MQPS,
  TERM_26J,
  TERM_26J_L3_MQPS,
  TERM_L1
} from "./mqp.ts";

export const PYQ_FILE_IDS: Record<string, string> = {
  ...PYQ.TERM_23D,
  ...PYQ.TERM_24D,
  ...PYQ.TERM_24J,
  ...PYQ.TERM_25D,
  ...PYQ.TERM_25J,
  ...TERM_26J.PYQS
};

export const PTP_FILE_IDS: Record<string, FileRecord> = {
  ...TERM_26J.PTPS
};

export const MQP_FILE_IDS: Record<string, FileRecord> = {
  ...TERM_L1,
  ...TERM_23D,
  ...TERM_24D,
  ...TERM_24J,
  ...TERM_25D,
  ...TERM_25J,
  ...TERM_26J,
  ...TERM_25D_L3_MQPS,
  ...TERM_26J_L3_MQPS,
  ...TERM_25J_L3_MQPS,
  ...TERM_24D_L3_MQPS,
  ...TERM_24J_L3_MQPS,
  ...TERM_23D_L3_MQPS
};

export type Level = "foundation" | "intermediate" | "final";
export type DocType = "pyq" | "mqp" | "ptp";

export type FileRecord = { name: string; id: string, syllabus?: string }[];

// Structured Academic Data - The Single Source of Truth
export const ACADEMIC_DATA: Record<
  Level,
  { id: string; code: string; name: string }[]
> = {
  foundation: [
    {
      id: "p1",
      code: "BLBS",
      name: "Business Laws and Business Communication"
    },
    { id: "p2", code: "FCA", name: "Financial and Cost Accounting" },
    { id: "p3", code: "BMS", name: "Business Mathematics and Statistics" },
    { id: "p4", code: "BEM", name: "Business Economics and Management" }
  ],
  intermediate: [
    { id: "p5", code: "BLE", name: "Business Laws and Ethics" },
    { id: "p6", code: "FA", name: "Financial Accounting" },
    { id: "p7", code: "TAX", name: "Direct and Indirect Taxation" },
    { id: "p8", code: "CA", name: "Cost Accounting" },
    {
      id: "p9",
      code: "OMSM",
      name: "Operations Management and Strategic Management"
    },
    { id: "p10", code: "CAA", name: "Corporate Accounting and Auditing" },
    {
      id: "p11",
      code: "FM",
      name: "Financial Management and Business Data Analytics"
    },
    { id: "p12", code: "MA", name: "Management Accounting" }
  ],
  final: [
    { id: "p13", code: "CEL", name: "Corporate and Economic Laws" },
    { id: "p14", code: "SFM", name: "Strategic Financial Management" },
    {
      id: "p15",
      code: "TAX",
      name: "Direct Tax Laws and International Taxation"
    },
    { id: "p16", code: "SCM", name: "Strategic Cost Management" },
    { id: "p17", code: "CMAD", name: "Cost and Management Audit" },
    { id: "p18", code: "CFR", name: "Corporate Financial Reporting" },
    { id: "p19", code: "ITLP", name: "Indirect Tax Laws and Practice" },
    {
      id: "p20A",
      code: "SPMA",
      name: "Strategic Performance Management and Business Valuation"
    },
    {
      id: "p20B",
      code: "RMBI",
      name: "Risk Management in Banking and Insurance"
    },
    {
      id: "p20C",
      code: "ES",
      name: "Entrepreneurship and Startup"
    }
  ]
};

// Returns a single string for PYQ, or an array of objects for MQP
export function getFiles(doc: DocType, key: string) {
  if (doc === "pyq") {
    return PYQ_FILE_IDS[key]; // returns string | undefined
  } else if (doc === "ptp") {
    return PTP_FILE_IDS[key]; // returns {name: string, id: string}[] | undefined
  } else {
    return MQP_FILE_IDS[key]; // returns {name: string, id: string}[] | undefined
  }
}

export function getAllFiles(doc: DocType, paperId: string) {
  let source;
  if (doc === "pyq") {
    source = PYQ_FILE_IDS;
  } else if (doc === "ptp") {
    source = PTP_FILE_IDS;
  } else {
    source = MQP_FILE_IDS;
  }
  const results = [];

  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith(`${paperId}-`)) {
      results.push({ key, value });
    }
  }
  return results;
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

export { TERM_26J } from "./26j/mod.ts";
export { TERM_25D } from "./25d/mod.ts";
export { TERM_25J } from "./25j/mod.ts";
export { TERM_24D } from "./24d/mod.ts";
export { TERM_24J } from "./24j/mod.ts";
export { TERM_23D } from "./23d/mod.ts";

import { Level } from "../../../types.ts";

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

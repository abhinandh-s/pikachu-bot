export { TERM_23D } from "./23d/mod.ts";

export const SYLLABUS_2016_DATA: Record<
  Level,
  { id: string; code: string; name: string }[]
> = {
  foundation: [
    { id: "1", code: "", name: "" },
    { id: "2", code: "", name: "" },
    { id: "3", code: "", name: "" },
    { id: "4", code: "", name: "" }
  ],
  intermediate: [
    // Group: I
    { id: "5", code: "FA", name: "Financial Accounting" },
    { id: "6", code: "LE", name: "Laws and Ethics " },
    { id: "7", code: "DT", name: "Direct Taxation" },
    { id: "8", code: "CA", name: "Cost Accounting" },
    // Group: II
    { id: "9", code: "OMSM", name: "Operations Management and Strategic Management" },
    { id: "10", code: "CMAFM", name: "Cost & Management Accounting and Financial Management" },
    { id: "11", code: "IT", name: "Indirect Taxation" },
    { id: "12", code: "CAA", name: "Company Accounts and Audit" }
  ],
  final: [
    // Group: III
    { id: "13", code: "CLC", name: "Corporate Laws and Compliance" },
    { id: "14", code: "SFM", name: "Strategic Financial Management" },
    { id: "15", code: "SCM", name: "Strategic Cost Management - Decision Making" },
    { id: "16", code: "DTLIT", name: "Direct Tax Laws and International Taxation" },
    // Group: IV
    { id: "17", code: "CFA", name: "Corporate Financial Reporting" },
    { id: "18", code: "", name: "Indirect Tax Laws & Practice" },
    { id: "19", code: "CMA", name: "Cost and Management Audit" },
    { id: "20", code: "SPMBV", name: "Strategic Performance Management and Business Valuation" }
  ]
};

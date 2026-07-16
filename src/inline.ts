import { MQP_FILE_IDS, PTP_FILE_IDS, PYQ_FILE_IDS } from "./db/mod.ts";
import { Composer } from "grammy";
import { DocType } from "./types.ts";
import { renderCaptionFileRecord } from "./render.ts";

export const inlineQueryHandler = new Composer();

// Listen for any inline query.
inlineQueryHandler.on("inline_query", async (ctx) => {
  const query = ctx.inlineQuery.query.trim().toLowerCase().replace(/\s+/g, "-");

  // If the query is empty, you can return a prompt or an empty array
  if (!query) {
    return ctx.answerInlineQuery([]);
  }

  const results: InlineQueryResult[] = [];

  // Example Search Logic: If a user types "p5", fetch all P5 related PYQs and MQPs
  // You can adjust this matching logic to be as broad or specific as you need.

  // Process PTPs (Mock Question Papers)
  const ptpMatches = Object.entries(PTP_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  ptpMatches.forEach(([key, files]) => {
    const { paper_id, term, paper_type } = parseKey(key);
    // Because PTP_FILE_IDS values are arrays of { name: string, id: string }
    files.forEach((file, index) => {
      results.push({
        type: "document",
        id: `ptp-${key}-${file.name}-${index}`,
        title: `PTP: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: "Practice Test Paper",
        caption: renderCaptionFileRecord(paper_id, paper_type as DocType, term, file)
      });
    });
  });

  // Process PYQs (Previous Year Questions)
  const pyqMatches = Object.entries(PYQ_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  pyqMatches.forEach(([key, files]) => {
    files.forEach((file, index) => {
      results.push({
        type: "document",
        id: `pyq-${key}-${file.name}-${index}`,
        title: `PYQ: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: "Previous Year Questions"
      });
    });
  });

  // Process MQPs (Model Question Papers)
  const mqpMatches = Object.entries(MQP_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  mqpMatches.forEach(([key, files]) => {
    // Because MQP_FILE_IDS values are arrays of { name: string, id: string }
    files.forEach((file, index) => {
      results.push({
        type: "document",
        id: `mqp-${key}-${file.name}-${index}`,
        title: `MQP: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: "Model Question Paper"
      });
    });
  });

  // Telegram limits inline results to 50 items per query
  const limitedResults = results.slice(0, 50);

  // Answer the inline query
  await ctx.answerInlineQuery(limitedResults, {
    cache_time: 300 // Cache results for 5 minutes to reduce server load
  });
});

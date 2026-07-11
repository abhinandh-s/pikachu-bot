import { MQP_FILE_IDS, PTP_FILE_IDS, PYQ_FILE_IDS } from './db/mod.ts';
import { Composer } from 'grammy';

export const inlineQueryHandler = new Composer();

// Listen for any inline query.
inlineQueryHandler.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.trim().toLowerCase();

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
    // Because PTP_FILE_IDS values are arrays of { name: string, id: string }
    files.forEach((file, index) => {
      results.push({
        type: 'document',
        id: `ptp-${key}-${file.name}-${index}`,
        title: `PTP: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: 'Practice Test Paper'
      });
    });
  });

  // Process PYQs (Previous Year Questions)
  const pyqMatches = Object.entries(PYQ_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  pyqMatches.forEach(([key, fileId]) => {
    results.push({
      type: 'document',
      id: `pyq-${key}`,
      title: `PYQ: ${key.toUpperCase()}`,
      document_file_id: fileId,
      description: 'Previous Year Question Paper'
    });
  });

  // Process MQPs (Mock Question Papers)
  const mqpMatches = Object.entries(MQP_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  mqpMatches.forEach(([key, files]) => {
    // Because MQP_FILE_IDS values are arrays of { name: string, id: string }
    files.forEach((file, index) => {
      results.push({
        type: 'document',
        id: `mqp-${key}-${file.name}-${index}`,
        title: `MQP: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: 'Mock Question Paper'
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

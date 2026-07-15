import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { ACADEMIC_DATA, DocType, FileRecord, getAllFiles, getFiles, Level, MQP_FILE_IDS, PYQ_FILE_IDS } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { renderCaption } from "./render.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

import { InputMediaDocument } from "grammy/types.ts";

// Helper function to split arrays into chunks of 10
function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// =================================
// =================================
// =================================
// =================================

bot.command("mqps_s2a", async (ctx: Context) => {
  // Extract the term from the message (e.g., "23d" from "/pyqs 23d")
  const requestedTerm = ctx.match.trim().toLowerCase();

  if (!requestedTerm) {
    return ctx.reply("❌ Please provide a term. Example: `/mqps 23d`", { parse_mode: "Markdown" });
  }

  await ctx.reply(`🚀 Gathering PYQ documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    // Filter files for ONLY the requested term
    for (const [key, fileRecords] of Object.entries(MQP_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-mqp`)) continue;

      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        if (file.name === "s2a") {
          if (file.id) {
            console.log(`Adding file: ${file.id} for ${key}`);
            filesToSend.push({
              type: "document",
              media: file.id
            });
          }
        }
      }
    }

    if (filesToSend.length === 0) {
      return ctx.reply(`❌ No files found for term: ${requestedTerm.toUpperCase()}`);
    }

    // Split into chunks of 10
    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    // Send batches sequentially
    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        // Short delay to avoid 429 Too Many Requests
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: unknown) {
        console.error(`Failed to send batch ${i + 1}:`, sendError);

        if (sendError.parameters?.retry_after) {
          const waitTime = sendError.parameters.retry_after * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          await ctx.replyWithMediaGroup(batches[i]);
        }
      }
    }

    await ctx.reply(`✅ All PYQs for **${requestedTerm.toUpperCase()}** sent successfully!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

// =================================
// =================================
// =================================
// =================================

bot.command("mqps_s2", async (ctx: Context) => {
  // Extract the term from the message (e.g., "23d" from "/pyqs 23d")
  const requestedTerm = ctx.match.trim().toLowerCase();

  if (!requestedTerm) {
    return ctx.reply("❌ Please provide a term. Example: `/mqps 23d`", { parse_mode: "Markdown" });
  }

  await ctx.reply(`🚀 Gathering PYQ documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    // Filter files for ONLY the requested term
    for (const [key, fileRecords] of Object.entries(MQP_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-mqp`)) continue;

      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        if (file.name === "s2") {
          if (file.id) {
            console.log(`Adding file: ${file.id} for ${key}`);
            filesToSend.push({
              type: "document",
              media: file.id
            });
          }
        }
      }
    }

    if (filesToSend.length === 0) {
      return ctx.reply(`❌ No files found for term: ${requestedTerm.toUpperCase()}`);
    }

    // Split into chunks of 10
    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    // Send batches sequentially
    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        // Short delay to avoid 429 Too Many Requests
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: unknown) {
        console.error(`Failed to send batch ${i + 1}:`, sendError);

        if (sendError.parameters?.retry_after) {
          const waitTime = sendError.parameters.retry_after * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          await ctx.replyWithMediaGroup(batches[i]);
        }
      }
    }

    await ctx.reply(`✅ All PYQs for **${requestedTerm.toUpperCase()}** sent successfully!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

// =================================
// =================================
// =================================
// =================================

bot.command("mqps_s2a", async (ctx: Context) => {
  const requestedTerm = ctx.match.trim().toLowerCase();

  if (!requestedTerm) {
    return ctx.reply("❌ Please provide a term. Example: `/mqps 23d`", { parse_mode: "Markdown" });
  }

  await ctx.reply(`🚀 Gathering documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    for (const [key, fileRecords] of Object.entries(MQP_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-mqp`)) continue;
      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        if (file.name === "s2a" && file.id) {
          // FIX 1: Clean any copy-paste whitespaces/newlines from your data source
          const cleanId = file.id.trim();

          // FIX 2: Check basic structural validity (Telegram file IDs must be alphanumeric/underscores)
          if (/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
            filesToSend.push({
              type: "document",
              media: cleanId
            });
          } else {
            console.warn(`⚠️ Skipped structurally invalid ID for key ${key}: "${file.id}"`);
          }
        }
      }
    }

    if (filesToSend.length === 0) {
      return ctx.reply(`❌ No valid files found for term: ${requestedTerm.toUpperCase()}`);
    }

    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: any) {
        console.error(`❌ Failed to send batch ${i + 1}:`, sendError.message);

        // Fallback: If a batch of 10 fails, try sending them individually so the remaining 9 still go through!
        await ctx.reply(`⚠️ Batch ${i + 1} had a broken file ID. Sending items individually...`);
        
        for (const item of batches[i]) {
          try {
            await ctx.replyWithDocument(item.media);
          } catch (individualError: any) {
             console.error(`🔥 This specific File ID is dead: "${item.media}"`);
             await ctx.reply(`❌ Failed to send a document due to an invalid Telegram File ID.`);
          }
        }
      }
    }

    await ctx.reply(`✅ Export task completed for **${requestedTerm.toUpperCase()}**!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

// =================================
// =================================
// =================================
// =================================

// Use a dynamic command: /mqps 23d
bot.command("mqps_s1", async (ctx: Context) => {
  // Extract the term from the message (e.g., "23d" from "/pyqs 23d")
  const requestedTerm = ctx.match.trim().toLowerCase();

  if (!requestedTerm) {
    return ctx.reply("❌ Please provide a term. Example: `/mqps 23d`", { parse_mode: "Markdown" });
  }

  await ctx.reply(`🚀 Gathering PYQ documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    // Filter files for ONLY the requested term
    for (const [key, fileRecords] of Object.entries(MQP_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-mqp`)) continue;

      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        if (file.name === "s1") {
          if (file.id) {
            console.log(`Adding file: ${file.id} for ${key}`);
            filesToSend.push({
              type: "document",
              media: file.id
            });
          }
        }
      }
    }

    if (filesToSend.length === 0) {
      return ctx.reply(`❌ No files found for term: ${requestedTerm.toUpperCase()}`);
    }

    // Split into chunks of 10
    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    // Send batches sequentially
    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        // Short delay to avoid 429 Too Many Requests
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: unknown) {
        console.error(`Failed to send batch ${i + 1}:`, sendError);

        if (sendError.parameters?.retry_after) {
          const waitTime = sendError.parameters.retry_after * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          await ctx.replyWithMediaGroup(batches[i]);
        }
      }
    }

    await ctx.reply(`✅ All PYQs for **${requestedTerm.toUpperCase()}** sent successfully!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

// Use a dynamic command: /pyqs 23d
bot.command("pyqs", async (ctx: Context) => {
  // Extract the term from the message (e.g., "23d" from "/pyqs 23d")
  const requestedTerm = ctx.match.trim().toLowerCase();

  if (!requestedTerm) {
    return ctx.reply("❌ Please provide a term. Example: `/pyqs 23d`", { parse_mode: "Markdown" });
  }

  await ctx.reply(`🚀 Gathering PYQ documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    // Filter files for ONLY the requested term
    for (const [key, fileRecords] of Object.entries(PYQ_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-`)) continue;

      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        if (file.id) {
          console.log(`Adding file: ${file.id} for ${key}`);
          filesToSend.push({
            type: "document",
            media: file.id,
            caption: `📄 Key: ${key}\n📚 Syllabus: ${file.syllabus ?? "Unknown"}`
          });
        }
      }
    }

    if (filesToSend.length === 0) {
      return ctx.reply(`❌ No files found for term: ${requestedTerm.toUpperCase()}`);
    }

    // Split into chunks of 10
    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    // Send batches sequentially
    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        // Short delay to avoid 429 Too Many Requests
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: unknown) {
        console.error(`Failed to send batch ${i + 1}:`, sendError);

        if (sendError.parameters?.retry_after) {
          const waitTime = sendError.parameters.retry_after * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          await ctx.replyWithMediaGroup(batches[i]);
        }
      }
    }

    await ctx.reply(`✅ All PYQs for **${requestedTerm.toUpperCase()}** sent successfully!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

bot.command("migrate", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return;
  }

  // Gather all papers from foundation, intermediate, and final
  const allPapers = [
    ...ACADEMIC_DATA.foundation,
    ...ACADEMIC_DATA.intermediate,
    ...ACADEMIC_DATA.final
  ];

  const keyboard = new InlineKeyboard();
  let count = 0;

  // Build a keyboard with all Paper IDs
  for (const paper of allPapers) {
    keyboard.text(paper.id.toUpperCase(), `migrate:${paper.id}`);
    count++;

    // Break into rows of 3 for a cleaner UI
    if (count % 3 === 0) {
      keyboard.row();
    }
  }

  await ctx.reply("Select a Paper ID to send all available files (PTP, MQP, PYQ):", {
    reply_markup: keyboard
  });
});

bot.callbackQuery(
  /^migrate:/,
  async (ctx) => {
    const [, paperId] = ctx.callbackQuery.data.split(":");

    // Acknowledge the button press so the loading spinner stops
    await ctx.answerCallbackQuery({ text: `Starting migration for ${paperId.toUpperCase()}...` });

    // Remove the keyboard so it isn't clicked twice
    await ctx.editMessageReplyMarkup();

    const paper = getPaperDetails(paperId);
    if (!paper) {
      await ctx.reply(`Could not find details for paper: ${paperId}`);
      return;
    }

    const docTypes: DocType[] = ["pyq", "mqp", "ptp"];
    let sentCount = 0;

    await ctx.reply(`Starting mass send for **${paperId.toUpperCase()}**...`, { parse_mode: "Markdown" });

    // Loop through PYQ, MQP, PTP
    for (const docType of docTypes) {
      const allTerms = getAllFiles(docType, paperId);

      // Loop through every available term for this docType
      for (const item of allTerms) {
        const term = item.key.split("-")[1];
        const key = `${paperId}-${term}-${docType}`;
        const files = getFiles(docType, key);

        if (!files) continue;

        const header = `#${docType.toUpperCase()}`;
        const commonCaption = `${header}\n📄 paper: ${paper.name}\n🗂️ paper no: ${paperId.replace("p", "")}\n📆 term: ${formatTerm(term)}`;

        try {
          if (docType === "pyq") {
            await ctx.replyWithDocument(files as string, { caption: commonCaption });
            sentCount++;
          } else {
            // PTP and MQP have multiple sets/solutions
            for (const file of files as FileRecord[]) {
              await ctx.replyWithDocument(file.id, {
                caption: `${commonCaption}\n🗄️ ${formatSet(file.name)}`
              });
              sentCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to send ${key}:`, error);
          await ctx.reply(`❌ Error sending ${key}. See logs.`);
        }
      }
    }

    await ctx.reply(`✅ Migration complete for **${paperId.toUpperCase()}**. Total files sent: ${sentCount}`, { parse_mode: "Markdown" });
  }
);

bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

async function startHandler(
  ctx: Context,
  docType: DocType
) {
  const keyboard = new InlineKeyboard()
    .text(
      "Foundation",
      `level:${docType}:foundation`
    )
    .row()
    .text(
      "Intermediate",
      `level:${docType}:intermediate`
    )
    .row()
    .text(
      "Final",
      `level:${docType}:final`
    );

  await ctx.reply(
    `Select level for <b>${docType.toUpperCase()}</b>:`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard
    }
  );
}

// ---------- LEVEL ----------
bot.callbackQuery(
  /^level:/,
  async (ctx) => {
    const [, docType, level] = ctx.callbackQuery.data.split(":");

    const keyboard = new InlineKeyboard();

    for (
      const sub of ACADEMIC_DATA[level as Level]
    ) {
      keyboard
        .text(
          sub.code,
          `subject:${docType}:${sub.id}`
        )
        .row();
    }

    await ctx.editMessageText(
      "Select subject:",
      {
        reply_markup: keyboard
      }
    );

    await ctx.answerCallbackQuery();
  }
);

// ---------- SUBJECT ----------
bot.callbackQuery(
  /^subject:/,
  async (ctx) => {
    const [, docType, paperId] = ctx.callbackQuery.data.split(":");

    const all = getAllFiles(
      docType as DocType,
      paperId
    );

    if (all.length === 0) {
      await ctx.answerCallbackQuery({
        text: "No files available",
        show_alert: true
      });
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const item of all) {
      const term = item.key.split("-")[1];

      keyboard
        .text(
          formatTerm(term),
          `file:${docType}:${paperId}:${term}`
        )
        .row();
    }

    await ctx.editMessageText(
      "Select term:",
      {
        reply_markup: keyboard
      }
    );

    await ctx.answerCallbackQuery();
  }
);

// ---------- FILE DELIVERY ----------
bot.callbackQuery(
  /^file:/,
  async (ctx) => {
    const [, docType, paperId, term] = ctx.callbackQuery.data.split(":");

    await ctx.editMessageReplyMarkup(); // closes the keyboard

    const key = `${paperId}-${term}-${docType}`;
    const files = getFiles(
      docType as DocType,
      key
    );
    const paper = getPaperDetails(paperId);

    if (!files) {
      await ctx.answerCallbackQuery({
        text: "File not available",
        show_alert: true
      });
      return;
    }

    await ctx.answerCallbackQuery();

    for (const file of files as FileRecord) {
      await ctx.replyWithDocument(file.id, {
        caption: renderCaption(paperId, docType, paper.name, term, file.syllabus | "", file.name),
        parse_mode: "HTML"
      });
    }

    await ctx.deleteMessage(); // delete "Select term:" msg
  }
);

function getPaperDetails(paperId: string) {
  const allPapers = [
    ...ACADEMIC_DATA.foundation,
    ...ACADEMIC_DATA.intermediate,
    ...ACADEMIC_DATA.final
  ];
  return allPapers.find((p) => p.id === paperId);
}

function formatSet(id: string): string {
  return id === "s1"
    ? "set: 1"
    : id === "s2"
    ? "set: 2"
    : id === "s1a"
    ? "set: 1 solution"
    : id === "s2a"
    ? "set: 2 solution"
    : id === "q"
    ? "Question Paper"
    : id === "a"
    ? "Answer Key"
    : id;
}

// ---------- COMMANDS ----------
bot.command("pyq", (ctx) => startHandler(ctx, "pyq"));
bot.command("mqp", (ctx) => startHandler(ctx, "mqp"));
bot.command("ptp", (ctx) => startHandler(ctx, "ptp"));

// ---------- WEBHOOK ----------
const handleUpdate = webhookCallback(
  bot,
  "std/http"
);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
  // The webhook will now return 200 OK to Telegram, stopping the retry loop.
});

Deno.serve(async (req) => {
  if (req.method === "POST") {
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error(err);

      return new Response(
        "Error processing update",
        {
          status: 500
        }
      );
    }
  }

  return new Response(
    "Telegram Bot is running!"
  );
});

import { Composer } from "grammy";
import { ACADEMIC_DATA, DocType, FileRecord, getAllFiles, getFiles, MQP_FILE_IDS, PYQ_FILE_IDS } from "./db/mod.ts";

export const adminCmds = new Composer();

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

adminCmds.command("mqps", async (ctx: Context) => {
  // Extract arguments from the message and split by spaces
  const args = ctx.match.trim().toLowerCase().split(/\s+/);

  // Check if both type and term are provided
  if (args.length < 2) {
    return ctx.reply("❌ Please provide both a type and a term. Example: `/mqps s1a 23d`", { parse_mode: "Markdown" });
  }

  const fileType = args[0]; // e.g., "s1a"
  const requestedTerm = args[1]; // e.g., "23d"

  // Validate the requested file type
  const validTypes = ["s1", "s1a", "s2", "s2a"];
  if (!validTypes.includes(fileType)) {
    return ctx.reply(`❌ Invalid type. Available types are: ${validTypes.join(", ")}`);
  }

  await ctx.reply(`🚀 Gathering **${fileType.toUpperCase()}** documents for **${requestedTerm.toUpperCase()}**...`, { parse_mode: "Markdown" });

  try {
    const filesToSend: InputMediaDocument[] = [];

    for (const [key, fileRecords] of Object.entries(MQP_FILE_IDS)) {
      if (!key.includes(`-${requestedTerm}-mqp`)) continue;
      if (!Array.isArray(fileRecords)) continue;

      for (const file of fileRecords) {
        // Match dynamically based on the fileType argument provided by the user
        if (file.name === fileType && file.id) {
          const cleanId = file.id.trim();

          // Check basic structural validity
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
      return ctx.reply(`❌ No valid files found for type **${fileType.toUpperCase()}** and term **${requestedTerm.toUpperCase()}**`, {
        parse_mode: "Markdown"
      });
    }

    const batches = chunkArray(filesToSend, 10);
    const totalBatches = batches.length;

    for (let i = 0; i < totalBatches; i++) {
      try {
        await ctx.replyWithMediaGroup(batches[i]);

        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (sendError: unknown) {
        console.error(`❌ Failed to send batch ${i + 1}:`, sendError.message);

        // Fallback: If a batch of 10 fails, try sending them individually
        await ctx.reply(`⚠️ Batch ${i + 1} had a broken file ID. Sending items individually...`);

        for (const item of batches[i]) {
          try {
            await ctx.replyWithDocument(item.media);
          } catch (individualError: unknown) {
            console.error(`🔥 This specific File ID is dead: "${item.media}"`, individualError);
            await ctx.reply(`❌ Failed to send a document due to an invalid Telegram File ID.`);
          }
        }
      }
    }

    await ctx.reply(`✅ Export task completed for **${fileType.toUpperCase()} - ${requestedTerm.toUpperCase()}**!`, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Critical Error:", error);
    await ctx.reply("❌ A critical error occurred during the file export.");
  }
});

// Use a dynamic command: /pyqs 23d
adminCmds.command("pyqs", async (ctx: Context) => {
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

adminCmds.command("migrate", async (ctx) => {
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
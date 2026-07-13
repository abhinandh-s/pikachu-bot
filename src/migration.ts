import { Composer, InputFile } from "grammy";

import oldData from "./db/old_pyqs.json" with { type: "json" };

export const migrationCmd = new Composer();
const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

migrationCmd.command("migrate", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return;
  }

  // 1. Initial setup
  const statusMsg = await ctx.reply("Starting migration... This will take a while due to rate limits.");

  // We will build this object in memory
  const newData = { pyq: {} as Record<string, string> };

  // Load your thumbnail into memory once to reuse it
  // (Adjust the path or fetch it if it's hosted elsewhere)
  const thumbnailData = await Deno.readFile("./assets/thumbnail_190x190.jpeg");

  const pyqEntries = Object.entries(oldData.pyq);
  let count = 0;

  // 2. Loop through all old files
  for (const [key, oldFileId] of pyqEntries) {
    try {
      count++;

      console.log(key);

      // A. Get the file path from Telegram
      const fileInfo = await ctx.api.getFile(oldFileId);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;

      // B. Download the file into memory
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Fetch failed for ${key}`);
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // C. Re-upload with the new thumbnail
      // We pass the Uint8Array directly to InputFile
      const sentMessage = await ctx.replyWithDocument(
        new InputFile(fileBuffer, `${key}.pdf`),
        {
          thumbnail: new InputFile(thumbnailData, "thumbnail.jpeg"),
          caption: `Re-uploaded: ${key}`
        }
      );

      // D. Save the NEW file_id to our in-memory object
      newData.pyq[key] = sentMessage.document.file_id;

      // Update progress every 5 files
      if (count % 5 === 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          `Progress: ${count}/${pyqEntries.length} files processed...`
        );
      }

      // E. CRITICAL: Wait 3 seconds before the next upload to prevent rate limiting
      await delay(3000);
    } catch (error) {
      console.error(`Failed to process ${key}:`, error);
      await ctx.reply(`Error processing ${key}. Check logs.`);
    }
  }

  // 3. Generate and send the new JSON file
  await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Migration complete! Generating JSON...");

  // Convert the in-memory object to a formatted JSON string
  const jsonString = JSON.stringify(newData, null, 2);

  // Encode the string to a Uint8Array so InputFile can read it
  const jsonBuffer = new TextEncoder().encode(jsonString);

  // Send the JSON file to the chat
  await ctx.replyWithDocument(
    new InputFile(jsonBuffer, "new_pyqs.json"),
    {
      caption: "✅ **Migration Successful!**\nHere is your new database file with the updated file_ids.",
      parse_mode: "Markdown"
    }
  );
});

// Helper function to pause execution and avoid Telegram's FloodWait errors
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

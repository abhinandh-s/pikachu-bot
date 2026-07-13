import { Composer, InputFile } from "grammy";
import { fromFileUrl } from "@std/path";
import oldData from "./db/old_pyqs.json" with { type: "json" };

export const migrationCmd = new Composer();

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

// Safely resolve the local path in Deno across all operating systems
const thumbnailPath = fromFileUrl(
  new URL("./assets/thumbnail_190x190.jpeg", import.meta.url)
);

// Helper function to pause execution and avoid Telegram's FloodWait errors
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

migrationCmd.command("migrate", async (ctx) => {
  // 1. Security Check
  if (ctx.from?.id !== ADMIN_ID) {
    return;
  }

  // 2. Initial setup and status message
  const statusMsg = await ctx.reply(
    "Starting migration in the background... You will be notified of the progress. Please do not trigger this command again while it runs."
  );

  // 3. Fire-and-forget the background task
  // We DO NOT await this function so the webhook can immediately return HTTP 200
  runMigrationInBackground(ctx, statusMsg.message_id).catch((err) => {
    console.error("Critical error in background migration:", err);
  });
});

/**
 * Background function handling the heavy lifting
 */
async function runMigrationInBackground(ctx: any, statusMsgId: number) {
  const newData = { pyq: {} as Record<string, string> };
  const pyqEntries = Object.entries(oldData.pyq);
  let count = 0;

  // Load thumbnail into memory ONCE to save disk reads
  let thumbnailBuffer: Uint8Array;
  try {
    thumbnailBuffer = await Deno.readFile(thumbnailPath);
  } catch (error) {
    console.error("Failed to load thumbnail:", error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsgId,
      "Migration aborted: Thumbnail file not found."
    );
    return;
  }

  // Loop through all old files
  for (const [key, oldFileId] of pyqEntries) {
    try {
      count++;
      console.log(`Processing: ${key}`);

      // A. Get the file path from Telegram
      const fileInfo = await ctx.api.getFile(oldFileId);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;

      // B. Download the file into memory
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Fetch failed for ${key}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // C. Re-upload with the new in-memory thumbnail
      const sentMessage = await ctx.replyWithDocument(
        new InputFile(fileBuffer, `${key}.pdf`),
        {
          thumbnail: new InputFile(thumbnailBuffer, "thumbnail.jpeg"),
          caption: `Re-uploaded: ${key}`,
        }
      );

      // D. Save the NEW file_id to our in-memory object
      newData.pyq[key] = sentMessage.document.file_id;

      // E. Update progress every 5 files to avoid spamming edit requests
      if (count % 5 === 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsgId,
          `Progress: ${count}/${pyqEntries.length} files processed...`
        );
      }

      // F. CRITICAL: Wait 3 seconds before the next upload
      await delay(3000);
    } catch (error) {
      console.error(`Failed to process ${key}:`, error);
      // We don't throw here so the loop continues even if one file fails
    }
  }

  // Finalization: Generate and send the new JSON file
  await ctx.api.editMessageText(
    ctx.chat.id,
    statusMsgId,
    "Migration complete! Generating JSON..."
  );

  const jsonString = JSON.stringify(newData, null, 2);
  const jsonBuffer = new TextEncoder().encode(jsonString);

  await ctx.replyWithDocument(
    new InputFile(jsonBuffer, "new_pyqs.json"),
    {
      caption: "✅ **Migration Successful!**\nHere is your new database file with the updated file_ids.",
      parse_mode: "Markdown",
    }
  );
}

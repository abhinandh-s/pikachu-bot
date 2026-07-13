import { Composer, InputFile } from "grammy";
import { fromFileUrl } from "@std/path";

export const batchCmd = new Composer();

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

const kv = await Deno.openKv();

// Cross-platform path resolution in Deno
const thumbnailPath = fromFileUrl(
  new URL("../assets/thumbnail_190x190.jpeg", import.meta.url)
);

// ---------------------------------------------------------
// BATCH COMMAND LOGIC
// ---------------------------------------------------------
batchCmd.command("batch", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;

  const action = ctx.match.trim().toLowerCase();

  if (action === "start") {
    await kv.set(["batch_mode", ADMIN_ID], true);
    await ctx.reply(
      "🟢 <b>Batch mode started.</b>\n\nUpload your documents now. They will be processed with thumbnails automatically. Send <code>/batch stop</code> when you are done.",
      { parse_mode: "HTML" }
    );
  } else if (action === "stop" || action === "done") {
    const batchMode = await kv.get(["batch_mode", ADMIN_ID]);
    if (!batchMode.value) {
      return ctx.reply("Batch mode is not active. Use /batch start first.");
    }

    const entries = kv.list<string>({ prefix: ["batch_files", ADMIN_ID] });
    let count = 0;

    // Simplified Base JSON structure (No intermediate term keys)
    const jsonData = {
      ptp: {} as Record<string, string>,
      mqp: {} as Record<string, string>,
      pyq: {} as Record<string, string>,
      unrecognized: [] as string[]
    };

    for await (const entry of entries) {
      const newFileId = entry.key[2] as string;
      const fileName = entry.value;
      count++;

      // Clean up KV
      await kv.delete(entry.key);

      // Using the exact standardized file name (minus .pdf) as the JSON key
      const baseName = fileName.replace(/\.pdf$/i, "");
      const parts = baseName.split("-");

      if (parts.length < 3) {
        jsonData.unrecognized.push(`Unrecognized format: ${fileName} -> ${newFileId}`);
        continue;
      }

      // The document type is perfectly aligned as the 3rd part of the standardized name
      const docType = parts[2].toLowerCase();

      // Assigning the precise filename as the key
      if (docType === "pyq") {
        jsonData.pyq[baseName] = newFileId;
      } else if (docType === "mqp") {
        jsonData.mqp[baseName] = newFileId;
      } else if (docType === "ptp") {
        jsonData.ptp[baseName] = newFileId;
      } else {
        jsonData.unrecognized.push(`Unknown docType in: ${fileName} -> ${newFileId}`);
      }
    }

    await kv.delete(["batch_mode", ADMIN_ID]);

    if (count === 0) {
      return ctx.reply("No files were logged during this batch.");
    }

    // Helper to sort the final objects alphabetically by their keys
    const sortObject = (obj: Record<string, string>) => {
      return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as Record<string, string>);
    };

    jsonData.mqp = sortObject(jsonData.mqp);
    jsonData.ptp = sortObject(jsonData.ptp);
    jsonData.pyq = sortObject(jsonData.pyq);

    // Convert to JSON String
    const jsonString = JSON.stringify(jsonData, null, 2);

    // Generate a .json file in-memory
    const uint8 = new TextEncoder().encode(jsonString);
    const inputFile = new InputFile(uint8, "generated_db.json");

    await ctx.replyWithDocument(inputFile, {
      caption: `🔴 <b>Batch mode stopped.</b>\nProcessed ${count} files.\nYour structured JSON database is ready!`,
      parse_mode: "HTML"
    });
  } else {
    await ctx.reply("<b>Usage:</b>\n<code>/batch start</code> OR <code>/batch stop</code>", { parse_mode: "HTML" });
  }
});

// ---------------------------------------------------------
// DOCUMENT LISTENER
// ---------------------------------------------------------
batchCmd.chatType("private").on("message:document", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return ctx.reply("File uploads are restricted to admins only.");
  }

  const document = ctx.message.document;
  const originalFileId = document.file_id;
  const originalFileName = document.file_name || "downloaded_document.pdf";

  const fileName = standardizeFileName(originalFileName);

  const batchMode = await kv.get(["batch_mode", ADMIN_ID]);

  if (!batchMode.value) {
    return ctx.reply(
      `<b>File Name</b>: ${fileName}\n<b>Original File ID</b>: <code>${originalFileId}</code>\n\n<i>Batch mode is off. This file was not processed.</i>`,
      { parse_mode: "HTML" }
    );
  }

  // --- BATCH MODE ACTIVE: Process the file ---
  const statusMsg = await ctx.reply(`Processing <code>${fileName}</code>...`, { parse_mode: "HTML" });

  try {
    const fileInfo = await ctx.api.getFile(originalFileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const thumbnailBuffer = await Deno.readFile(thumbnailPath);

    // Conditional Caption: Only add caption if "unknown" is present in standard name
    const hasUnknown = fileName.includes("unknown");
    const captionText = hasUnknown ? `Original File: ${originalFileName}` : undefined;

    // Re-upload with the thumbnail
    const sentMessage = await ctx.replyWithDocument(
      new InputFile(fileBuffer, fileName),
      {
        thumbnail: new InputFile(thumbnailBuffer, "thumbnail.jpeg"),
        caption: captionText // Injects original name if unrecognizable attributes exist
      }
    );

    // Extract the newly generated file ID
    const newFileId = sentMessage.document.file_id;

    // Save to Deno KV using the NEW fileId as the unique key
    await kv.set(["batch_files", ADMIN_ID, newFileId], fileName);

    // Clean up status message and react to acknowledge success silently
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    await ctx.react("👍");
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `❌ Failed to process <code>${fileName}</code>.`,
      { parse_mode: "HTML" }
    );
  }
});

function standardizeFileName(originalName: string): string {
  // 1. Remove extension and make lowercase for easy matching
  const baseName = originalName.toLowerCase().replace(/\.pdf$/, "");

  // 2. Extract Paper
  const paperMatch = baseName.match(/p(1[0-9]|[1-9]|20[a-c]?)\b/i);
  let paper = paperMatch ? paperMatch[0] : "unknown";
  if (paper.startsWith("p20")) paper = paper.replace("p", "p").toUpperCase().replace("P", "p");

  // 3. Extract Term
  const termMatch = baseName.match(/(2[3-9][dj]|[dj]2[3-9])/i);
  let term = "unknown";
  if (termMatch) {
    const t = termMatch[0];
    term = /^[dj]/i.test(t) ? t.slice(1) + t[0] : t;
  }

  // 4. Extract explicit Suffixes
  const mqpSetMatch = baseName.match(/\b(s[1-2]a?)\b/i); // s1, s1a, s2, s2a
  const qaMatch = baseName.match(/\b([qa])\b/i); // q or a

  // 5. Extract or Infer Document Type
  const typeMatch = baseName.match(/\b(pyq|mqp|ptp)\b/i);
  let docType = "pyq"; // Default fallback

  if (typeMatch) {
    docType = typeMatch[0];
  } else if (mqpSetMatch) {
    docType = "mqp";
  } else if (qaMatch) {
    docType = "pyq";
  }

  // 6. Assign the correct suffix based on the document type
  let suffix = "";
  if (docType === "mqp" && mqpSetMatch) {
    suffix = mqpSetMatch[0];
  } else if ((docType === "pyq" || docType === "ptp") && qaMatch) {
    suffix = qaMatch[0];
  }

  // 7. Dynamic Syllabus check (catches anything like syl16, syl20, or sets to syl22)
  const sylMatch = baseName.match(/\b(syl\d+)\b/i);
  const syl = sylMatch ? sylMatch[1].toLowerCase() : "syl22";

  // 8. Reconstruct the standard name
  let newName = `${paper}-${term}-${docType}`;
  if (suffix) newName += `-${suffix}`;
  newName += `-${syl}.pdf`;

  return newName;
}

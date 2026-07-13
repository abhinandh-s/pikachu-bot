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

    // Base JSON structure
    const jsonData = {
      ptp: {} as Record<string, Record<string, { name: string; id: string }[]>>,
      mqp: {} as Record<string, Record<string, { name: string; id: string }[]>>,
      pyq: {} as Record<string, Record<string, string>>,
      unrecognized: [] as string[]
    };

    for await (const entry of entries) {
      // In our new flow, entry.key[2] is the NEW fileId
      const newFileId = entry.key[2] as string;
      const fileName = entry.value;
      count++;

      // Clean up KV
      await kv.delete(entry.key);

      // Remove .pdf and -syl22 before splitting so parts align perfectly
      let baseName = fileName.replace(/\.pdf$/i, "");
      baseName = baseName.replace(/-syl22$/i, "");

      if (parts.length < 3) {
        jsonData.unrecognized.push(`Unrecognized format: ${fileName} -> ${newFileId}`);
        continue;
      }

      const paper = parts[0];
      const termRaw = parts[1];
      const docType = parts[2].toLowerCase();
      const termUpper = termRaw.toUpperCase();
      const key = `${paper}-${termRaw}-${docType}`;

      if (docType === "pyq") {
        if (!jsonData.pyq[termUpper]) jsonData.pyq[termUpper] = {};
        jsonData.pyq[termUpper][key] = newFileId;
      } else if (docType === "mqp") {
        const setName = parts[3] || "unknown";
        if (!jsonData.mqp[termUpper]) jsonData.mqp[termUpper] = {};
        if (!jsonData.mqp[termUpper][key]) jsonData.mqp[termUpper][key] = [];
        jsonData.mqp[termUpper][key].push({ name: setName, id: newFileId });
      } else if (docType === "ptp") {
        const setName = parts[3] || "q";
        if (!jsonData.ptp[termUpper]) jsonData.ptp[termUpper] = {};
        if (!jsonData.ptp[termUpper][key]) jsonData.ptp[termUpper][key] = [];
        jsonData.ptp[termUpper][key].push({ name: setName, id: newFileId });
      } else {
        jsonData.unrecognized.push(`Unknown docType in: ${fileName} -> ${newFileId}`);
      }
    }

    await kv.delete(["batch_mode", ADMIN_ID]);

    if (count === 0) {
      return ctx.reply("No files were logged during this batch.");
    }

    // Sort the arrays alphabetically by 'name' (s1 before s2)
    const sortArrays = (dataObj: Record<string, Record<string, { name: string; id: string }[]>>) => {
      for (const term in dataObj) {
        for (const key in dataObj[term]) {
          dataObj[term][key].sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    };
    sortArrays(jsonData.mqp);
    sortArrays(jsonData.ptp);

    // Convert to JSON String
    const jsonString = JSON.stringify(jsonData, null, 2);

    // Generate a .json file in-memory (Using Deno's TextEncoder)
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

  // Check if admin is currently in batch mode
  const batchMode = await kv.get(["batch_mode", ADMIN_ID]);

  if (!batchMode.value) {
    // Normal behavior if batch mode is OFF
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
    // Use standard Deno Uint8Array instead of Node's Buffer
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Read thumbnail directly into memory
    const thumbnailBuffer = await Deno.readFile(thumbnailPath);

    // Re-upload with the thumbnail
    const sentMessage = await ctx.replyWithDocument(
      new InputFile(fileBuffer, fileName),
      {
        thumbnail: new InputFile(thumbnailBuffer, "thumbnail.jpeg")
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

  // 2. Extract Paper (Matches p1 to p19, p20a, p20b, p20c)
  const paperMatch = baseName.match(/p(1[0-9]|[1-9]|20[a-c]?)\b/i);
  let paper = paperMatch ? paperMatch[0] : "unknown";
  // Format p20A, p20B, p20C correctly
  if (paper.startsWith("p20")) paper = paper.replace("p", "p").toUpperCase().replace("P", "p");

  // 3. Extract Term (Handles both 25d and d25 formats)
  const termMatch = baseName.match(/(2[3-9][dj]|[dj]2[3-9])/i);
  let term = "unknown";
  if (termMatch) {
    const t = termMatch[0];
    // If it starts with a letter (d25), flip it to (25d)
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
    docType = "mqp"; // Infer MQP from s1/s2
  } else if (qaMatch) {
    docType = "pyq"; // Infer PYQ from q/a
  }

  // 6. Assign the correct suffix based on the document type
  let suffix = "";
  if (docType === "mqp" && mqpSetMatch) {
    suffix = mqpSetMatch[0];
  } else if ((docType === "pyq" || docType === "ptp") && qaMatch) {
    suffix = qaMatch[0];
  }

  // 7. Reconstruct the standard name
  let newName = `${paper}-${term}-${docType}`;
  if (suffix) newName += `-${suffix}`;
  newName += `-syl22.pdf`;

  return newName;
}

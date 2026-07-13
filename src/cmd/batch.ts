import { Composer, InputFile } from "grammy";
import { fromFileUrl } from "@std/path";

export const batchCmd = new Composer();

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

// Open a connection to Deno's built-in Key-Value store
const kv = await Deno.openKv();

// Cross-platform safe path for Deno
const thumbnailPath = fromFileUrl(
  new URL("../assets/thumbnail_190x190.jpeg", import.meta.url)
);

// --- 1. BATCH COMMAND HANDLER ---
batchCmd.command("batch", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;

  const action = ctx.match.trim().toLowerCase();

  if (action === "start") {
    await kv.set(["batch_mode", ADMIN_ID], true);
    await ctx.reply(
      "🟢 <b>Batch mode started.</b>\n\nForward or upload your documents now. Send <code>/batch stop</code> when you are done.",
      { parse_mode: "HTML" }
    );
  } else if (action === "stop" || action === "done") {
    const batchMode = await kv.get(["batch_mode", ADMIN_ID]);
    if (!batchMode.value) {
      return ctx.reply("Batch mode is not active. Use /batch start first.");
    }

    const entries = kv.list<string>({ prefix: ["batch_files", ADMIN_ID] });
    let count = 0;

    const pyqData: Record<string, Record<string, string>> = {};
    const mqpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    const ptpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    let unrecognizedFiles = "";

    for await (const entry of entries) {
      const fileId = entry.key[2] as string;
      const fileName = entry.value;
      count++;

      await kv.delete(entry.key);

      const baseName = fileName.split(".")[0];
      const parts = baseName.split("-");

      if (parts.length < 3) {
        unrecognizedFiles += `// Unrecognized format: ${fileName} -> ${fileId}\n`;
        continue;
      }

      const paper = parts[0];
      const termRaw = parts[1];
      const docType = parts[2];
      const termUpper = termRaw.toUpperCase();
      const key = `${paper}-${termRaw}-${docType}`;

      if (docType === "pyq") {
        if (!pyqData[termUpper]) pyqData[termUpper] = {};
        pyqData[termUpper][key] = fileId;
      } else if (docType === "mqp") {
        const setName = parts[3] || "unknown";
        if (!mqpData[termUpper]) mqpData[termUpper] = {};
        if (!mqpData[termUpper][key]) mqpData[termUpper][key] = [];
        mqpData[termUpper][key].push({ name: setName, id: fileId });
      } else if (docType === "ptp") {
        const setName = parts[3] || "q";
        if (!ptpData[termUpper]) ptpData[termUpper] = {};
        if (!ptpData[termUpper][key]) ptpData[termUpper][key] = [];
        ptpData[termUpper][key].push({ name: setName, id: fileId });
      } else {
        unrecognizedFiles += `// Unknown docType in: ${fileName} -> ${fileId}\n`;
      }
    }

    await kv.delete(["batch_mode", ADMIN_ID]);

    if (count === 0) {
      return ctx.reply("No files were logged during this batch.");
    }

    let fileContent = "";

    for (const [term, records] of Object.entries(ptpData)) {
      fileContent += `export const TERM_${term}_PTPS: Record<string, FileRecord> = {\n`;
      for (const [key, files] of Object.entries(records)) {
        fileContent += `  '${key}': [\n`;
        files.sort((a, b) => a.name.localeCompare(b.name));
        for (const file of files) {
          fileContent += `    {\n      name: '${file.name}',\n      id: '${file.id}',\n    },\n`;
        }
        fileContent += `  ],\n`;
      }
      fileContent += `}\n\n`;
    }

    for (const [term, records] of Object.entries(mqpData)) {
      fileContent += `export const TERM_${term}: Record<string, FileRecord> = {\n`;
      for (const [key, files] of Object.entries(records)) {
        fileContent += `  '${key}': [\n`;
        files.sort((a, b) => a.name.localeCompare(b.name));
        for (const file of files) {
          fileContent += `    {\n      name: '${file.name}',\n      id: '${file.id}',\n    },\n`;
        }
        fileContent += `  ],\n`;
      }
      fileContent += `}\n\n`;
    }

    for (const [term, records] of Object.entries(pyqData)) {
      fileContent += `export const PYQ_TERM_${term}: Record<string, string> = {\n`;
      for (const [key, id] of Object.entries(records)) {
        fileContent += `  '${key}': '${id}',\n`;
      }
      fileContent += `}\n\n`;
    }

    if (unrecognizedFiles) {
      fileContent += `\n/* --- UNRECOGNIZED FILES ---\n${unrecognizedFiles}*/\n`;
    }

    const uint8 = new TextEncoder().encode(fileContent);
    const inputFile = new InputFile(uint8, "generated_db.ts");

    await ctx.replyWithDocument(inputFile, {
      caption: `🔴 <b>Batch mode stopped.</b>\nProcessed ${count} files.\nYour TypeScript code is ready!`,
      parse_mode: "HTML"
    });
  } else {
    await ctx.reply("<b>Usage:</b>\n<code>/batch start</code> OR <code>/batch stop</code>", { parse_mode: "HTML" });
  }
});


// --- 2. DOCUMENT HANDLER ---
batchCmd.chatType("private").on("message:document", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return; // Ignore files from non-admins
  }

  const document = ctx.message.document;
  const originalFileId = document.file_id;
  const fileName = document.file_name || "unknown_file.pdf";

  // Check if admin is currently in batch mode
  const batchMode = await kv.get(["batch_mode", ADMIN_ID]);

  if (!batchMode.value) {
    // Normal behavior if batch mode is OFF
    await ctx.reply(
      `<b>File Name</b>: ${fileName}\n<b>File ID</b>: <code>${originalFileId}</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // --- BATCH MODE IS ON: Process, upload, and save to KV ---

  // Check Telegram API size limits (Bots can't download files > 20MB)
  if (document.file_size && document.file_size > 20 * 1024 * 1024) {
    return ctx.reply(`❌ <b>${fileName}</b> is over 20MB and cannot be downloaded by the bot.`, { parse_mode: "HTML" });
  }

  const statusMsg = await ctx.reply(`Processing ${fileName}...`);

  try {
    // 1. Get file path
    const fileInfo = await ctx.api.getFile(originalFileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;

    // 2. Fetch the file into a Deno Uint8Array
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // 3. Load thumbnail into memory
    const thumbnailBuffer = await Deno.readFile(thumbnailPath);

    // 4. Re-upload with the thumbnail
    const sentMessage = await ctx.replyWithDocument(
      new InputFile(fileBuffer, fileName),
      {
        thumbnail: new InputFile(thumbnailBuffer, "thumbnail.jpeg"),
      }
    );

    // 5. Get the newly generated file_id
    const newFileId = sentMessage.document.file_id;

    // 6. Save the NEW file ID to the KV database
    await kv.set(["batch_files", ADMIN_ID, newFileId], fileName);

    // 7. Cleanup and confirm receipt
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    await ctx.react("👍");

  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
    await ctx.api.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      `❌ Failed to process ${fileName}.`
    );
  }
});

/*
import { Composer, InputFile } from "grammy";
import { resolve } from "@std/path";

export const batchCmd = new Composer();

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

// Open a connection to Deno's built-in Key-Value store
const kv = await Deno.openKv();

batchCmd.command("batch", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;

  const action = ctx.match.trim().toLowerCase();

  if (action === "start") {
    // Turn batch mode on for the admin
    await kv.set(["batch_mode", ADMIN_ID], true);
    await ctx.reply(
      "🟢 <b>Batch mode started.</b>\n\nForward or upload your documents now. Send <code>/batch stop</code> when you are done.",
      { parse_mode: "HTML" }
    );
  } else if (action === "stop" || action === "done") {
    const batchMode = await kv.get(["batch_mode", ADMIN_ID]);
    if (!batchMode.value) {
      return ctx.reply("Batch mode is not active. Use /batch start first.");
    }

    const entries = kv.list<string>({ prefix: ["batch_files", ADMIN_ID] });
    let count = 0;

    // Data structures to group the files dynamically
    const pyqData: Record<string, Record<string, string>> = {};
    const mqpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    const ptpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    let unrecognizedFiles = "";

    for await (const entry of entries) {
      const fileId = entry.key[2] as string;
      const fileName = entry.value;
      count++;

      // Clean up KV
      await kv.delete(entry.key);

      // Parse filename: e.g. "p5-23d-mqp-s1.pdf" -> ["p5", "23d", "mqp", "s1"]
      const baseName = fileName.split(".")[0];
      const parts = baseName.split("-");
      // const parts = baseName.toLowerCase().split('-')

      if (parts.length < 3) {
        unrecognizedFiles += `// Unrecognized format: ${fileName} -> ${fileId}\n`;
        continue;
      }

      const paper = parts[0]; // 'p5'
      const termRaw = parts[1]; // '23d' or '25j'
      const docType = parts[2]; // 'mqp' or 'pyq' or 'ptp'
      const termUpper = termRaw.toUpperCase(); // '23D'
      const key = `${paper}-${termRaw}-${docType}`;

      if (docType === "pyq") {
        if (!pyqData[termUpper]) pyqData[termUpper] = {};
        pyqData[termUpper][key] = fileId;
      } else if (docType === "mqp") {
        const setName = parts[3] || "unknown"; // 's1', 's1a', etc.
        if (!mqpData[termUpper]) mqpData[termUpper] = {};
        if (!mqpData[termUpper][key]) mqpData[termUpper][key] = [];

        mqpData[termUpper][key].push({ name: setName, id: fileId });
      } else if (docType === "ptp") {
        const setName = parts[3] || "q"; // '' or 'a'
        if (!ptpData[termUpper]) ptpData[termUpper] = {};
        if (!ptpData[termUpper][key]) ptpData[termUpper][key] = [];

        ptpData[termUpper][key].push({ name: setName, id: fileId });
      } else {
        unrecognizedFiles += `// Unknown docType in: ${fileName} -> ${fileId}\n`;
      }
    }

    await kv.delete(["batch_mode", ADMIN_ID]);

    if (count === 0) {
      return ctx.reply("No files were logged during this batch.");
    }

    // --- GENERATE TYPESCRIPT CODE ---
    let fileContent = "";

    // Generate PTP code
    for (const [term, records] of Object.entries(ptpData)) {
      fileContent += `export const TERM_${term}_PTPS: Record<string, FileRecord> = {\n`;
      for (const [key, files] of Object.entries(records)) {
        fileContent += `  '${key}': [\n`;

        // Sort alphabetically so s1 comes before s1a, s2, etc.
        files.sort((a, b) => a.name.localeCompare(b.name));

        for (const file of files) {
          fileContent += `    {\n      name: '${file.name}',\n      id: '${file.id}',\n    },\n`;
        }
        fileContent += `  ],\n`;
      }
      fileContent += `}\n\n`;
    }

    // Generate MQP code
    for (const [term, records] of Object.entries(mqpData)) {
      fileContent += `export const TERM_${term}: Record<string, FileRecord> = {\n`;
      for (const [key, files] of Object.entries(records)) {
        fileContent += `  '${key}': [\n`;

        // Sort alphabetically so s1 comes before s1a, s2, etc.
        files.sort((a, b) => a.name.localeCompare(b.name));

        for (const file of files) {
          fileContent += `    {\n      name: '${file.name}',\n      id: '${file.id}',\n    },\n`;
        }
        fileContent += `  ],\n`;
      }
      fileContent += `}\n\n`;
    }

    // Generate PYQ code
    for (const [term, records] of Object.entries(pyqData)) {
      fileContent += `export const PYQ_TERM_${term}: Record<string, string> = {\n`;
      for (const [key, id] of Object.entries(records)) {
        fileContent += `  '${key}': '${id}',\n`;
      }
      fileContent += `}\n\n`;
    }

    // Append unrecognized files at the bottom as comments (if any)
    if (unrecognizedFiles) {
      fileContent += `\n/* --- UNRECOGNIZED FILES ---\n${unrecognizedFiles}*/\n`;
    }

    // Generate a .ts file in-memory
    const uint8 = new TextEncoder().encode(fileContent);
    const inputFile = new InputFile(uint8, "generated_db.ts");

    await ctx.replyWithDocument(inputFile, {
      caption: `🔴 <b>Batch mode stopped.</b>\nProcessed ${count} files.\nYour TypeScript code is ready!`,
      parse_mode: "HTML"
    });
  } else {
    await ctx.reply("<b>Usage:</b>\n<code>/batch start</code> OR <code>/batch stop</code>", { parse_mode: "HTML" });
  }
});

const thumbnailPath = resolve(
  new URL("../assets/thumbnail_190x190.jpeg", import.meta.url).pathname
);

batchCmd.chatType("private").on("message:document", async (ctx) => {
  // Extract document details from the incoming message
  const document = ctx.message.document;
  const fileId = document.file_id;

  // Fallback to a default name if original file_name is missing
  const fileName = document.file_name || "downloaded_document.ext";

  try {
    // 1. Inform the user the process has started (optional but good for UX)
    const statusMsg = await ctx.reply("Downloading and processing your file...");

    // 2. Get the file path using the getFile API
    const fileInfo = await ctx.api.getFile(fileId);

    // 3. Construct the download URL using your bot token
    // In grammY, ctx.api.token securely holds your bot token
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;

    // 4. Download the actual file into a memory buffer
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 5. Prepare the downloaded file and local thumbnail as InputFiles
    const documentToUpload = new InputFile(fileBuffer, fileName);
    const thumbnailToUpload = new InputFile(thumbnailPath);

    // 6. Re-upload the document with the thumbnail
    await ctx.replyWithDocument(documentToUpload, {
      thumbnail: thumbnailToUpload,
      // caption: "<blockquote>CMA INTERMEDIATE</blockquote>\nHere is your re-uploaded document with the new thumbnail!",
      // parse_mode: "HTML"
    });

    // Clean up the status message
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
  } catch (error) {
    console.error("Error processing document:", error);
    await ctx.reply("Sorry, an error occurred while trying to process the file.");
  }
});
*/
/*
batchCmd.chatType('private').on('message:document', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.reply('File uploads are restricted to admins only.');
    return;
  }

  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name || 'unknown_file';

  // Check if admin is currently in batch mode
  const batchMode = await kv.get(['batch_mode', ADMIN_ID]);

  if (batchMode.value) {
    // Save to Deno KV: prefixing with batch_files and ADMIN_ID, using fileId as the unique key
    await kv.set(['batch_files', ADMIN_ID, fileId], fileName);

    // React to the message to confirm receipt without cluttering the chat
    await ctx.react('👍');
    return;
  }

  // Normal behavior (if batch mode is OFF)
  await ctx.reply(
    `<b>File Name</b>: ${fileName}\n<b>File ID</b>: <code>${fileId}</code>`,
    { parse_mode: 'HTML' }
  );
});

*/

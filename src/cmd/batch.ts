import { Composer, InputFile } from 'grammy';

export const batchCmd = new Composer();

const ADMIN_ID = Number(Deno.env.get('ADMIN_ID'));

// Open a connection to Deno's built-in Key-Value store
const kv = await Deno.openKv();

batchCmd.command('batch', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;

  const action = ctx.match.trim().toLowerCase();

  if (action === 'start') {
    // Turn batch mode on for the admin
    await kv.set(['batch_mode', ADMIN_ID], true);
    await ctx.reply(
      '🟢 <b>Batch mode started.</b>\n\nForward or upload your documents now. Send <code>/batch stop</code> when you are done.',
      { parse_mode: 'HTML' }
    );
  } else if (action === 'stop' || action === 'done') {
    const batchMode = await kv.get(['batch_mode', ADMIN_ID]);
    if (!batchMode.value) {
      return ctx.reply('Batch mode is not active. Use /batch start first.');
    }

    const entries = kv.list<string>({ prefix: ['batch_files', ADMIN_ID] });
    let count = 0;

    // Data structures to group the files dynamically
    const pyqData: Record<string, Record<string, string>> = {};
    const mqpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    const ptpData: Record<string, Record<string, { name: string; id: string }[]>> = {};
    let unrecognizedFiles = '';

    for await (const entry of entries) {
      const fileId = entry.key[2] as string;
      const fileName = entry.value;
      count++;

      // Clean up KV
      await kv.delete(entry.key);

      // Parse filename: e.g. "p5-23d-mqp-s1.pdf" -> ["p5", "23d", "mqp", "s1"]
      const baseName = fileName.split('.')[0];
      const parts = baseName.split('-');
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

      if (docType === 'pyq') {
        if (!pyqData[termUpper]) pyqData[termUpper] = {};
        pyqData[termUpper][key] = fileId;
      } else if (docType === 'mqp') {
        const setName = parts[3] || 'unknown'; // 's1', 's1a', etc.
        if (!mqpData[termUpper]) mqpData[termUpper] = {};
        if (!mqpData[termUpper][key]) mqpData[termUpper][key] = [];

        mqpData[termUpper][key].push({ name: setName, id: fileId });
      } else if (docType === 'ptp') {
        const setName = parts[3] || 'q'; // '' or 'a'
        if (!ptpData[termUpper]) ptpData[termUpper] = {};
        if (!ptpData[termUpper][key]) ptpData[termUpper][key] = [];

        ptpData[termUpper][key].push({ name: setName, id: fileId });
      } else {
        unrecognizedFiles += `// Unknown docType in: ${fileName} -> ${fileId}\n`;
      }
    }

    await kv.delete(['batch_mode', ADMIN_ID]);

    if (count === 0) {
      return ctx.reply('No files were logged during this batch.');
    }

    // --- GENERATE TYPESCRIPT CODE ---
    let fileContent = '';

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
    const inputFile = new InputFile(uint8, 'generated_db.ts');

    await ctx.replyWithDocument(inputFile, {
      caption: `🔴 <b>Batch mode stopped.</b>\nProcessed ${count} files.\nYour TypeScript code is ready!`,
      parse_mode: 'HTML'
    });
  } else {
    await ctx.reply('<b>Usage:</b>\n<code>/batch start</code> OR <code>/batch stop</code>', { parse_mode: 'HTML' });
  }
});

batchCmd.chatType('private').on('message:document', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.reply('File uploads are restricted to admins only.');
    return;
  }

  const doc = ctx.message.document;
  const fileName = doc.file_name || 'unknown_file';

  // 1. Check if batch mode is active (assuming this is how you trigger batch processing)
  const batchMode = await kv.get(['batch_mode', ADMIN_ID]);

  if (batchMode.value) {
    // AUTOMATIC PROCESSING: Re-upload with thumbnail to get a "permanent" file_id
    const statusMsg = await ctx.reply("Processing and registering thumbnail...");
    
    try {
      const file = await ctx.getFile(doc.file_id);
      const path = await file.download();

      // Send the file back to the chat with your custom thumbnail
      const sentMsg = await ctx.replyWithDocument(new InputFile(path), {
        caption: `Registered: ${fileName}`,
        thumbnail: new InputFile(thumbnailPath), // Ensure this path is correct
      });

      // Save this NEW fileId (the one with the thumbnail) to KV
      const newFileId = sentMsg.document.file_id;
      await kv.set(['batch_files', ADMIN_ID, newFileId], fileName);

      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `Registered: <code>${newFileId}</code>`, { parse_mode: 'HTML' });
      await ctx.react('✅');

    } catch (err) {
      console.error(err);
      await ctx.reply("Error: Thumbnail must be a JPEG < 200kB.");
    }
    return;
  }

  // Normal behavior (if batch mode is OFF)
  await ctx.reply(
    `<b>File Name</b>: ${fileName}\n<b>File ID</b>: <code>${doc.file_id}</code>`,
    { parse_mode: 'HTML' }
  );
});

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
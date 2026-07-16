import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { DocType, FileRecord, getAllFiles, getFiles, Level } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { adminCmds } from "./cmd/admin.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { renderCaption } from "./render.ts";

import { PTP_FILE_IDS } from "./db/mod.ts";
import { parseKey } from "./utils.ts";


const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

bot.use(adminCmds);
bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

bot.on("message:text", async (ctx) => {
  const query = ctx.message.text.trim().toLowerCase().replace(/\s+/g, "-");


  if (!query) {
    // make this msg disappear after a minute or so.
    return ctx.reply("Got your message!");
  }

  const keyboard = new InlineKeyboard();

  const ptpMatches = Object.entries(PTP_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  ptpMatches.forEach(([key, files]) => {
    const { paper_id, term, paper_type } = parseKey(key);
    files.forEach((file, _) => {
      // (Display , callback text)
      // 
    keyboard.text(`${paper_id} ${formatTerm(term)} | ${paper_type.toUpperCase()} ${file.name.toUpperCase()} | SYL ${file.syllabus}`, `dm::${paper_id}:${term}:${paper_type}:${file.name}`).row();
    });
  });

  await ctx.reply(
    `Select File:`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard
    }
  );
    
/*
  let count = 0;
  // Build a keyboard with all Paper IDs
  for (const paper of allPapers) {
    
    
  }

  await ctx.reply("Select a Paper ID to send all available files (PTP, MQP, PYQ):", {
    reply_markup: keyboard
  });
*/

/*
    

 

  

  // Process PYQs (Previous Year Questions)
  const pyqMatches = Object.entries(PYQ_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  pyqMatches.forEach(([key, files]) => {
    const { paper_id, term, paper_type } = parseKey(key);
    files.forEach((file, index) => {
      results.push({
        type: "document",
        id: `pyq-${key}-${file.name}-${index}`,
        title: `PYQ: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: "Previous Year Questions",
        caption: renderCaptionFileRecord(paper_id, paper_type as DocType, term, file),
        parse_mode: "HTML"
      });
    });
  });

  // Process MQPs (Model Question Papers)
  const mqpMatches = Object.entries(MQP_FILE_IDS).filter(([key]) => key.toLowerCase().includes(query));

  mqpMatches.forEach(([key, files]) => {
    const { paper_id, term, paper_type } = parseKey(key);
    // Because MQP_FILE_IDS values are arrays of { name: string, id: string }
    files.forEach((file, index) => {
      results.push({
        type: "document",
        id: `mqp-${key}-${file.name}-${index}`,
        title: `MQP: ${key.toUpperCase()} (${file.name.toUpperCase()})`,
        document_file_id: file.id,
        description: "Model Question Paper",
        caption: renderCaptionFileRecord(paper_id, paper_type as DocType, term, file),
        parse_mode: "HTML"
      });
    });
  });

  // Telegram limits inline results to 50 items per query
  const limitedResults = results.slice(0, 50);


*/


  
});

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

bot.callbackQuery(
  /^dm:/,
  async (ctx) => {
    const [, paperId, docType, term, name] = ctx.callbackQuery.data.split(":");

const key = `${paperId}-${term}-${docType}`;
    const files = getFiles(
      docType as DocType,
      key
    );

for (const file of files as FileRecord) {
      await ctx.replyWithDocument(file.id, {
        caption: renderCaption(paperId, docType, term, file.syllabus | "", file.name),
        parse_mode: "HTML"
      });
    }

await ctx.deleteMessage(); // delete "Select term:" msg
  
});

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
        caption: renderCaption(paperId, docType, term, file.syllabus | "", file.name),
        parse_mode: "HTML"
      });
    }

    await ctx.deleteMessage(); // delete "Select term:" msg
  }
);

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

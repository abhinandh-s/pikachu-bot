import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { DocType, FileRecord, getAllFiles, getFiles, Level } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { adminCmds } from "./cmd/admin.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { renderCaption, renderSyllabusShort } from "./render.ts";

import { FLATTENED_FILE_IDS } from "./db/mod.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

bot.use(adminCmds);
bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

const ITEMS_PER_PAGE = 10;

function buildSearchKeyboard(query: string, page: number) {
  const matches = Object.keys(FLATTENED_FILE_IDS).filter((key) => key.toLowerCase().includes(query));

  const keyboard = new InlineKeyboard();
  const totalPages = Math.ceil(matches.length / ITEMS_PER_PAGE);
  const startIndex = page * ITEMS_PER_PAGE;
  const pageItems = matches.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Add the file buttons
  pageItems.forEach((key) => {
    const [paperId, term, docType, fileName, syl] = key.split("-");
    const btnText = `${paperId.toUpperCase()} - ${formatTerm(term)} | ${docType.toUpperCase()} ${fileName.toUpperCase()} | SYLLABUS ${renderSyllabusShort(syl)}`;
    
    keyboard.text(btnText, `dl:${key}`).row();
  });

  // --- DYNAMIC PAGINATION LOGIC ---
  if (totalPages > 1) {
    
    // PREVIOUS VERSION: Use simple layout if there are 5 or fewer pages
    if (totalPages <= 5) {
      if (page > 0) {
        keyboard.text("‹ Prev", `nav:${page - 1}:${query}`);
      }
      keyboard.text(`[ ${page + 1} / ${totalPages} ]`, "ignore");
      
      if (page < totalPages - 1) {
        keyboard.text("Next ›", `nav:${page + 1}:${query}`);
      }
    } 
    
    // ADVANCED VERSION: Use 5-button layout for large datasets
    else {
      // 1. "First" Button
      if (page > 1) {
        keyboard.text("« 1", `nav:0:${query}`);
      }

      // 2. "Previous" Button
      if (page > 0) {
        keyboard.text(`‹ ${page}`, `nav:${page - 1}:${query}`);
      }

      // 3. "Current" Button
      keyboard.text(`· ${page + 1} ·`, "ignore");

      // 4. "Next" Button
      if (page < totalPages - 1) {
        keyboard.text(`${page + 2} ›`, `nav:${page + 1}:${query}`);
      }

      // 5. "Last" Button
      if (page < totalPages - 2) {
        keyboard.text(`${totalPages} »`, `nav:${totalPages - 1}:${query}`);
      }
    }
  }

  return { keyboard, totalMatches: matches.length };
}


bot.callbackQuery(/^nav:(\d+):(.+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1], 10);
  const query = ctx.match[2];

  const { keyboard, totalMatches } = buildSearchKeyboard(query, page);

  if (totalMatches === 0) {
    return ctx.answerCallbackQuery("No results found.");
  }

  await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("ignore", (ctx) => ctx.answerCallbackQuery());

bot.callbackQuery(/^dl:/, async (ctx) => {
  // Extract the flat key from the callback, e.g., "p20C-26j-mqp-s1a-syl22"
  const key = ctx.callbackQuery.data.replace("dl:", "");

  // Directly grab the file ID in O(1) time! No filtering needed.
  const fileId = FLATTENED_FILE_IDS[key];

  if (!fileId) {
    return ctx.answerCallbackQuery("File not found.");
  }

  // Extract variables for your renderCaption function
  const [paperId, term, docType, fileName, syl] = key.split("-");

  await ctx.replyWithDocument(fileId, {
    // Adjust renderCaption to accept "syl22" instead of "2022" if needed
    caption: renderCaption(paperId, docType, term, syl, fileName),
    parse_mode: "HTML"
  });

  // Delete the search results message after picking a file
  await ctx.deleteMessage().catch(() => {});
});

// Initial search handler
bot.on("message:text", async (ctx) => {
  const query = ctx.message.text.trim().toLowerCase().replace(/\s+/g, "-");

  if (!query) {
    const sentMsg = await ctx.reply("Got your message!");
    setTimeout(() => {
      ctx.api.deleteMessage(ctx.chat.id, sentMsg.message_id).catch(() => {});
    }, 60000);
    return;
  }

  const { keyboard, totalMatches } = buildSearchKeyboard(query, 0);

  if (totalMatches === 0) {
    return ctx.reply("No files found matching your query.");
  }

  await ctx.reply(`Select File (${totalMatches} found):`, {
    parse_mode: "HTML",
    reply_markup: keyboard
  });
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

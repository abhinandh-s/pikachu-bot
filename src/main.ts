import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { DocType, FileRecord, getAllFiles, getFiles, Level } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { adminCmds } from "./cmd/admin.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { renderCaption } from "./render.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

bot.use(adminCmds);
bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

bot.on("message:text", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.reply("You are not an admin!");
    return;
  }
  // const query = ctx.message.text.trim)
  await ctx.reply("Got your message!");
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

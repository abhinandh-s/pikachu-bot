import { Bot, Context, InlineKeyboard, InputFile, webhookCallback } from "grammy";
import { ACADEMIC_DATA, DocType, getAllFiles, Level } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { getFileId, JSON_DATA } from "./parse.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

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

bot.callbackQuery(
  /^file:/,
  async (ctx) => {
    const [, docType, paperId, term] = ctx.callbackQuery.data.split(":");

    await ctx.editMessageReplyMarkup(); // closes the keyboard

    // 1. Set the syllabus. 
    // If '26j' and newer are syl22, you might want to write a tiny helper function 
    // to determine this based on the 'term' variable later. 
    const syllabus = "syl22"; 

    // 2. Construct both potential keys based on your JSON structure
    const questionKey = `${paperId}-${term}-${docType}-${syllabus}`;
    const answerKey = `${paperId}-${term}-${docType}-a-${syllabus}`;

    // 3. Fetch both file IDs
    const questionFileId = getFileId(JSON_DATA, questionKey);
    const answerFileId = getFileId(JSON_DATA, answerKey);

    const paper = getPaperDetails(paperId);

    // 4. Handle missing files completely
    if (!questionFileId && !answerFileId) {
      await ctx.answerCallbackQuery({
        text: "Files not available for this selection.",
        show_alert: true
      });
      return;
    }

    await ctx.answerCallbackQuery();

    const header = `#${docType.toUpperCase()}`;
    const commonCaption = `${header}\n📄 paper: ${paper?.name}\n🗂️ paper no: ${paperId.replace("p", "")}\n📆 term: ${formatTerm(term)}`;

    // NOTE: Make sure `thumbnailPath` is defined in your file!
    // const thumbnailPath = resolve(new URL("./assets/thumbnail_190x190.jpeg", import.meta.url).pathname);

    // 5. Send Question Paper if it exists
    if (questionFileId) {
      await ctx.replyWithDocument(questionFileId, {
        caption: `${commonCaption}\n🗄️ Question Paper`,
        // thumbnail: new InputFile(thumbnailPath) // Uncomment if thumbnailPath is defined
      });
    }

    // 6. Send Answer Key if it exists
    if (answerFileId) {
      await ctx.replyWithDocument(answerFileId, {
        caption: `${commonCaption}\n🗄️ Answer Key`,
        // thumbnail: new InputFile(thumbnailPath) // Uncomment if thumbnailPath is defined
      });
    }

    try {
      await ctx.deleteMessage(); // delete "Select term:" msg
    } catch (e) {
      console.error("Could not delete message:", e);
    }
  }
);


function getPaperDetails(paperId: string) {
  const allPapers = [
    ...ACADEMIC_DATA.foundation,
    ...ACADEMIC_DATA.intermediate,
    ...ACADEMIC_DATA.final
  ];
  return allPapers.find((p) => p.id === paperId);
}

function _formatSet(id: string): string {
  return id === "s1"
    ? "set: 1"
    : id === "s2"
    ? "set: 2"
    : id === "s1a"
    ? "set: 1 solution"
    : id === "s2a"
    ? "set: 2 solution"
    : id === "q"
    ? "Question Paper"
    : id === "a"
    ? "Answer Key"
    : id;
}

bot.command("pyq", (ctx) => startHandler(ctx, "pyq"));
bot.command("mqp", (ctx) => startHandler(ctx, "mqp"));
bot.command("ptp", (ctx) => startHandler(ctx, "ptp"));

const handleUpdate = webhookCallback(
  bot,
  "std/http"
);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
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

import { Bot, Context, InlineKeyboard, webhookCallback } from "grammy";
import { ACADEMIC_DATA, DocType, FileRecord, getAllFiles, getFiles, Level } from "./db/mod.ts";
import { helpCmd } from "./cmd/help.ts";
import { batchCmd } from "./cmd/batch.ts";
import { inlineQueryHandler } from "./inline.ts";
import { formatTerm } from "./utils.ts";
import { renderLevel } from "./render.ts";

const bot = new Bot(Deno.env.get("TELEGRAM_TOKEN") || "");

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

bot.command("migrate", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return;
  }

  // Gather all papers from foundation, intermediate, and final
  const allPapers = [
    ...ACADEMIC_DATA.foundation,
    ...ACADEMIC_DATA.intermediate,
    ...ACADEMIC_DATA.final
  ];

  const keyboard = new InlineKeyboard();
  let count = 0;

  // Build a keyboard with all Paper IDs
  for (const paper of allPapers) {
    keyboard.text(paper.id.toUpperCase(), `migrate:${paper.id}`);
    count++;

    // Break into rows of 3 for a cleaner UI
    if (count % 3 === 0) {
      keyboard.row();
    }
  }

  await ctx.reply("Select a Paper ID to send all available files (PTP, MQP, PYQ):", {
    reply_markup: keyboard
  });
});

bot.callbackQuery(
  /^migrate:/,
  async (ctx) => {
    const [, paperId] = ctx.callbackQuery.data.split(":");

    // Acknowledge the button press so the loading spinner stops
    await ctx.answerCallbackQuery({ text: `Starting migration for ${paperId.toUpperCase()}...` });

    // Remove the keyboard so it isn't clicked twice
    await ctx.editMessageReplyMarkup();

    const paper = getPaperDetails(paperId);
    if (!paper) {
      await ctx.reply(`Could not find details for paper: ${paperId}`);
      return;
    }

    const docTypes: DocType[] = ["pyq", "mqp", "ptp"];
    let sentCount = 0;

    await ctx.reply(`Starting mass send for **${paperId.toUpperCase()}**...`, { parse_mode: "Markdown" });

    // Loop through PYQ, MQP, PTP
    for (const docType of docTypes) {
      const allTerms = getAllFiles(docType, paperId);

      // Loop through every available term for this docType
      for (const item of allTerms) {
        const term = item.key.split("-")[1];
        const key = `${paperId}-${term}-${docType}`;
        const files = getFiles(docType, key);

        if (!files) continue;

        const header = `#${docType.toUpperCase()}`;
        const commonCaption = `${header}\n📄 paper: ${paper.name}\n🗂️ paper no: ${paperId.replace("p", "")}\n📆 term: ${formatTerm(term)}`;

        try {
          if (docType === "pyq") {
            await ctx.replyWithDocument(files as string, { caption: commonCaption });
            sentCount++;
          } else {
            // PTP and MQP have multiple sets/solutions
            for (const file of files as FileRecord[]) {
              await ctx.replyWithDocument(file.id, {
                caption: `${commonCaption}\n🗄️ ${formatSet(file.name)}`
              });
              sentCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to send ${key}:`, error);
          await ctx.reply(`❌ Error sending ${key}. See logs.`);
        }
      }
    }

    await ctx.reply(`✅ Migration complete for **${paperId.toUpperCase()}**. Total files sent: ${sentCount}`, { parse_mode: "Markdown" });
  }
);

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
    const paper = getPaperDetails(paperId);

    if (!files) {
      await ctx.answerCallbackQuery({
        text: "File not available",
        show_alert: true
      });
      return;
    }

    await ctx.answerCallbackQuery();

     const header = `${renderLevel(paperId)}\n#${docType.toUpperCase()}`;
    const commonCaption = `${header}\n📄 paper: ${paper.name}\n🗂️ paper no: ${paperId.replace("p", "")}\n📆 term: ${formatTerm(term)}`;

    if (docType === "pyq") {
      await ctx.replyWithDocument(files as string, { caption: commonCaption, parse_mode: "HTML" });
    } else {
      for (const file of files as FileRecord) {
        await ctx.replyWithDocument(file.id, {
          caption: `${commonCaption}\n🗄️ ${formatSet(file.name)}`,
          parse_mode: "HTML"
        });
      }
    }

    await ctx.deleteMessage(); // delete "Select term:" msg
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

function formatSet(id: string): string {
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

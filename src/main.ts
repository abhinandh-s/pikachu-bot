import { Bot, Context, InlineKeyboard, InputFile, webhookCallback } from 'grammy';
import { ACADEMIC_DATA, DocType, FileRecord, getAllFiles, getFiles, Level } from './db/mod.ts';
import { helpCmd } from './cmd/help.ts';
import { batchCmd } from './cmd/batch.ts';
import { inlineQueryHandler } from './inline.ts';
import { formatTerm } from './utils.ts';
import { resolve } from '@std/path';

const bot = new Bot(Deno.env.get('TELEGRAM_TOKEN') || '');

bot.use(helpCmd);
bot.use(batchCmd);
bot.use(inlineQueryHandler);

bot.command('register', async (ctx) => {
  // Get the file from the message (assuming you replied to a file)
  const file = ctx.message?.reply_to_message?.document;
  if (!file) {
    await ctx.reply('Please reply to a document to register it.');
    return;
  }

  // Download the file
  const fileInfo = await ctx.getFile(file.file_id);
  const downloadedFile = await fileInfo.download();

  // Re-upload with your custom thumbnail
  const msg = await ctx.replyWithDocument(new InputFile(downloadedFile), {
    caption: 'New File Registered',
    thumbnail: new InputFile(thumbnailPath) // Your JPEG
  });

  // Extract the new file_id
  const newFileId = msg.document.file_id;
  await ctx.reply(`Registration successful! New File ID: <code>${newFileId}</code>`, { parse_mode: 'HTML' });
});

async function startHandler(
  ctx: Context,
  docType: DocType
) {
  const keyboard = new InlineKeyboard()
    .text(
      'Foundation',
      `level:${docType}:foundation`
    )
    .row()
    .text(
      'Intermediate',
      `level:${docType}:intermediate`
    )
    .row()
    .text(
      'Final',
      `level:${docType}:final`
    );

  await ctx.reply(
    `Select level for <b>${docType.toUpperCase()}</b>:`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

bot.callbackQuery(
  /^level:/,
  async (ctx) => {
    const [, docType, level] = ctx.callbackQuery.data.split(':');

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
      'Select subject:',
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
    const [, docType, paperId] = ctx.callbackQuery.data.split(':');

    const all = getAllFiles(
      docType as DocType,
      paperId
    );

    if (all.length === 0) {
      await ctx.answerCallbackQuery({
        text: 'No files available',
        show_alert: true
      });
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const item of all) {
      const term = item.key.split('-')[1];

      keyboard
        .text(
          formatTerm(term),
          `file:${docType}:${paperId}:${term}`
        )
        .row();
    }

    await ctx.editMessageText(
      'Select term:',
      {
        reply_markup: keyboard
      }
    );

    await ctx.answerCallbackQuery();
  }
);

const thumbnailPath = resolve(
  new URL('./assets/thumbnail_190x190.jpeg', import.meta.url).pathname
);

bot.callbackQuery(
  /^file:/,
  async (ctx) => {
    const [, docType, paperId, term] = ctx.callbackQuery.data.split(':');

    await ctx.editMessageReplyMarkup(); // closes the keyboard

    const key = `${paperId}-${term}-${docType}`;
    const files = getFiles(
      docType as DocType,
      key
    );
    const paper = getPaperDetails(paperId);

    if (!files) {
      await ctx.answerCallbackQuery({
        text: 'File not available',
        show_alert: true
      });
      return;
    }

    await ctx.answerCallbackQuery();

    const header = `#${docType.toUpperCase()}`;
    const commonCaption = `${header}\n📄 paper: ${paper.name}\n🗂️ paper no: ${paperId.replace('p', '')}\n📆 term: ${formatTerm(term)}`;

    if (docType === 'pyq') {
      await ctx.replyWithDocument(files as string, {
        caption: commonCaption,
        thumbnail: new InputFile(thumbnailPath)
      });
    } else {
      for (const file of files as FileRecord) {
        await ctx.replyWithDocument(file.id, {
          caption: `${commonCaption}\n🗄️ ${formatSet(file.name)}`,
          thumbnail: new InputFile(thumbnailPath)
        });
      }
    }

    try {
      await ctx.deleteMessage(); // delete "Select term:" msg
    } catch (e) {
      console.error('Could not delete message:', e);
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

function formatSet(id: string): string {
  return id === 's1'
    ? 'set: 1'
    : id === 's2'
    ? 'set: 2'
    : id === 's1a'
    ? 'set: 1 solution'
    : id === 's2a'
    ? 'set: 2 solution'
    : id === 'q'
    ? 'Question Paper'
    : id === 'a'
    ? 'Answer Key'
    : id;
}

bot.command('pyq', (ctx) => startHandler(ctx, 'pyq'));
bot.command('mqp', (ctx) => startHandler(ctx, 'mqp'));
bot.command('ptp', (ctx) => startHandler(ctx, 'ptp'));

const handleUpdate = webhookCallback(
  bot,
  'std/http'
);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
});

Deno.serve(async (req) => {
  if (req.method === 'POST') {
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error(err);

      return new Response(
        'Error processing update',
        {
          status: 500
        }
      );
    }
  }

  return new Response(
    'Telegram Bot is running!'
  );
});

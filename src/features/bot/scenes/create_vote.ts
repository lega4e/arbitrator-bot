import VoteManager from '@/features/vote/vote_manager';
import { ClassUuid } from '@/library/class_uuid';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { Scenes, Markup } from 'telegraf';
import { emj } from '../domain/emoji';
import { VoteType } from '@/domain/models/vote';
import { SceneWrapper } from '@/library/telegraf/scenes/scene_wrapper';
import { btn } from '../domain/buttons';
import { createTelegramMessageLink } from '@/library/telegraf/utils/url';

@ClassUuid()
class CreateVoteData {
  question: string = '';
  options: string[] = [];
}

const endButton = `${emj.ok2} Закончить`;

class CreateVoteScene extends SceneWrapper {
  private _scene: Scenes.WizardScene<BotContext>;

  constructor(
    private readonly createYesNoVoteScene: CreateYesNoVoteScene,
    private readonly createChoiceVoteScene: CreateChoiceVoteScene,
  ) {
    super('createVote');
    this._scene = new Scenes.WizardScene<BotContext>(
      'createVote',
      {
        handlers: [],
        enterHandlers: [
          async (ctx) => {
            await ctx.reply(
              `${emj.question} Выбери тип голосования`,
              Markup.inlineKeyboard([
                [Markup.button.callback('Да/Нет', 'createYesNoVote')],
                [
                  Markup.button.callback(
                    'С несколькими вариантами (single choice)',
                    'createSingleChoiceVote',
                  ),
                ],
                [
                  Markup.button.callback(
                    'С несколькими вариантами (multi choice)',
                    'createMultiChoiceVote',
                  ),
                ],
              ]),
            );
          },
        ],
        leaveHandlers: [],
      },
      async (ctx) => {},
    );

    this._scene.action('createYesNoVote', async (ctx) => {
      await this.createYesNoVoteScene.enter(ctx);
    });

    this._scene.action('createSingleChoiceVote', async (ctx) => {
      await ctx.helper.named.set('type', VoteType.SingleChoice);
      await this.createChoiceVoteScene.enter(ctx);
    });

    this._scene.action('createMultiChoiceVote', async (ctx) => {
      await ctx.helper.named.set('type', VoteType.MultiChoice);
      await this.createChoiceVoteScene.enter(ctx);
    });

    this._scene.hears(/.*/, (ctx) => {
      ctx.reply(`${emj.fail} Выбери тип голосования`);
    });
  }

  get scene(): Scenes.WizardScene<BotContext> {
    return this._scene;
  }
}

class CreateYesNoVoteScene extends SceneWrapper {
  private _scene: Scenes.WizardScene<BotContext>;

  constructor() {
    super('createYesNoVote');

    this._scene = new Scenes.WizardScene<BotContext>(
      'createYesNoVote',
      async (ctx) => {
        await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
        return ctx.wizard.next();
      },
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply(`${emj.fail} Отправь текстовое сообщение!`);
          return;
        }
        const question = ctx.message.text;
        const manager = ctx.helper.get<VoteManager>(VoteManager)!;
        const voteRaw = manager.makeVote(
          question,
          ['Да', 'Нет'],
          VoteType.YesNo,
        );
        ctx.helper.named.set('voteRaw', voteRaw);
        const text = manager.makePreviewText(voteRaw);
        await ctx.reply(text, { parse_mode: 'HTML' });
        await ctx.reply(
          `${emj.edit} Всё верно?`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'Да, запустить голосование!',
                'QBcreateYesNoVote',
              ),
            ],
            [Markup.button.callback('Пересоздать', 'QBrecreateYesNoVote')],
          ]),
        );
        return;
      },
    );

    this._scene.action('QBcreateYesNoVote', async (ctx) => {
      await ctx.answerCbQuery(`Запускаю...`);
      const manager = ctx.helper.get<VoteManager>(VoteManager)!;
      const vote = await manager.startVote(ctx.helper.named.get('voteRaw'));
      const messageLink = createTelegramMessageLink(
        vote.tg!.chatId,
        vote.tg!.messageId,
        vote.tg!.topicId,
      );
      await ctx.reply(
        `${emj.ok2} <a href="${messageLink}">` +
          `Голосование успешно запущено!` +
          `</a>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.keyboard([[btn.createVote]])
            .resize()
            .oneTime().reply_markup,
        },
      );
      return ctx.scene.leave();
    });

    this._scene.action('QBrecreateYesNoVote', async (ctx) => {
      await ctx.answerCbQuery(`Пересоздаю...`);
      await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
    });
  }

  get scene(): Scenes.WizardScene<BotContext> {
    return this._scene;
  }
}

class CreateChoiceVoteScene extends SceneWrapper {
  private _scene: Scenes.WizardScene<BotContext>;

  constructor() {
    super('createChoiceVote');
    this._scene = new Scenes.WizardScene<BotContext>(
      'createChoiceVote',
      async (ctx) => {
        ctx.helper.set(CreateVoteData, { question: '', options: [] });
        await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
        return ctx.wizard.next();
      },
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply(`${emj.fail} Отправь текстовое сообщение!`);
          return;
        }
        ctx.helper.get<CreateVoteData>(CreateVoteData)!.question =
          ctx.message.text;
        await ctx.reply(
          `${emj.edit} Введи первый вариант ответа`,
          Markup.keyboard([[endButton]])
            .resize()
            .oneTime(),
        );
        return ctx.wizard.next();
      },
      async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply(`${emj.fail} Отправь текстовое сообщение!`);
          return;
        }

        const option = ctx.message.text;
        ctx.helper.get<CreateVoteData>(CreateVoteData)!.options.push(option);
        await ctx.reply(
          `${emj.ok} Вариант добавлен! Введи следующий вариант или нажми "${endButton}"`,
          Markup.keyboard([[endButton]])
            .resize()
            .oneTime(),
        );
        return;
      },
    );

    this._scene.hears(endButton, async (ctx) => {
      const { question, options } =
        ctx.helper.get<CreateVoteData>(CreateVoteData)!;
      if (options.length < 2) {
        await ctx.reply(`${emj.fail} Требуется минимум 2 варианта ответа`);
        return;
      }
      const manager = ctx.helper.get<VoteManager>(VoteManager)!;
      const voteRaw = manager.makeVote(
        question,
        options,
        ctx.helper.named.get<VoteType>('type'),
      );
      ctx.helper.named.set('voteRaw', voteRaw);
      const text = manager.makePreviewText(voteRaw);
      await ctx.reply(text, { parse_mode: 'HTML' });
      await ctx.reply(
        `${emj.edit} Всё верно?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Да, запустить голосование!',
              'QBcreateChoiceVote',
            ),
          ],
          [Markup.button.callback('Пересоздать', 'QBrecreateChoiceVote')],
        ]),
      );
    });

    this._scene.action('QBcreateChoiceVote', async (ctx) => {
      await ctx.answerCbQuery(`Запускаю...`);
      const manager = ctx.helper.get<VoteManager>(VoteManager)!;
      const vote = await manager.startVote(ctx.helper.named.get('voteRaw'));
      const messageLink = createTelegramMessageLink(
        vote.tg!.chatId,
        vote.tg!.messageId,
        vote.tg!.topicId,
      );
      await ctx.reply(
        `${emj.ok2} <a href="${messageLink}">` +
          `Голосование успешно запущено!` +
          `</a>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.keyboard([[btn.createVote]])
            .resize()
            .oneTime().reply_markup,
        },
      );
      return ctx.scene.leave();
    });

    this._scene.action('QBrecreateChoiceVote', async (ctx) => {
      await ctx.answerCbQuery(`Пересоздаю...`);
      ctx.helper.set(CreateVoteData, { question: '', options: [] });
      await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
      return ctx.wizard.selectStep(1);
    });
  }

  get scene(): Scenes.WizardScene<BotContext> {
    return this._scene;
  }
}

const createYesNoVoteScene = new CreateYesNoVoteScene();
const createChoiceVoteScene = new CreateChoiceVoteScene();
const createVoteScene = new CreateVoteScene(
  createYesNoVoteScene,
  createChoiceVoteScene,
);

export { createVoteScene, createYesNoVoteScene, createChoiceVoteScene };

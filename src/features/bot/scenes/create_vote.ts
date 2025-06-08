import VoteManager from '@/features/vote/vote_manager';
import { ClassUuid } from '@/library/class_uuid';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { Scenes, Markup } from 'telegraf';
import { emj } from '../domain/emoji';
import { VoteType } from '@/domain/models/vote';
import { SceneWrapper } from '@/library/telegraf/scenes/scene_wrapper';
import { btn } from '../domain/buttons';
import { createTelegramMessageLink } from '@/library/telegraf/utils/url';
import { UserValidator } from './utils';
import { CommunardsManager } from '@/features/db/communards_manager';
import { IUser } from '@/domain/models/db';
import { TextValidator } from '@/library/telegraf/helpers/validators/validators';

@ClassUuid()
class CreateVoteData {
  question: string = '';
  options: string[] = [];
  type: VoteType | null = null;
  forUser: (IUser & { name: string }) | null = null;
}

const endButton = `${emj.ok2} Закончить`;

async function makePreviewAndAskForConfirmation(
  ctx: BotContext,
  data: CreateVoteData,
  qbCreate: string = 'QBcreateVote',
  qbRecreate: string = 'QBrecreateVote',
  qbCancel: string = 'QBcancelCreationVote',
) {
  const manager = ctx.helper.get<VoteManager>(VoteManager)!;
  const voteRaw = manager.makeVote(
    data.question,
    data.options,
    data.type!,
    ctx.from!.id,
    data.forUser,
  );
  ctx.helper.named.set('voteRaw', voteRaw);
  const text = manager.makePreviewText(voteRaw);
  await ctx.reply(text, { parse_mode: 'HTML' });
  await ctx.reply(
    `${emj.edit} Всё верно?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Да, запустить голосование!', qbCreate)],
      [Markup.button.callback('Пересоздать', qbRecreate)],
      [Markup.button.callback('Отменить создание', qbCancel)],
    ]),
  );
}

async function startVote(ctx: BotContext) {
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
}

class CreateVoteScene extends SceneWrapper {
  private _scene: Scenes.WizardScene<BotContext>;

  constructor(
    private readonly createYesNoVoteScene: CreateYesNoVoteScene,
    private readonly createChoiceVoteScene: CreateChoiceVoteScene,
    private readonly createVoteForVoiceScene: CreateVoteForVoice,
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
                [
                  Markup.button.callback(
                    'Голосование за право голоса',
                    'createVoteForVoice',
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

    this._scene.action('createVoteForVoice', async (ctx) => {
      await this.createVoteForVoiceScene.enter(ctx);
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
        } else {
          await makePreviewAndAskForConfirmation(ctx, {
            question: ctx.message.text,
            options: ['Да', 'Нет'],
            type: VoteType.YesNo,
            forUser: null,
          });
        }
      },
    );

    this._scene.action('QBcreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Запускаю...`);
      await startVote(ctx);
      return ctx.scene.leave();
    });

    this._scene.action('QBrecreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Пересоздаю...`);
      await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
    });

    this._scene.action('QBcancelCreationVote', async (ctx) => {
      await ctx.answerCbQuery(`Отмена...`);
      return ctx.scene.leave();
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
        ctx.helper.set(CreateVoteData, {
          question: '',
          options: [],
          type: ctx.helper.named.get<VoteType>('type'),
          forUser: null,
        });
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
      } else {
        await makePreviewAndAskForConfirmation(ctx, {
          question,
          options,
          type: ctx.helper.named.get<VoteType>('type'),
          forUser: null,
        });
      }
    });

    this._scene.action('QBcreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Запускаю...`);
      await startVote(ctx);
      return ctx.scene.leave();
    });

    this._scene.action('QBrecreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Пересоздаю...`);
      ctx.helper.set(CreateVoteData, {
        question: '',
        options: [],
        type: ctx.helper.named.get<VoteType>('type'),
        forUser: null,
      });
      await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
      return ctx.wizard.selectStep(1);
    });

    this._scene.action('QBcancelCreationVote', async (ctx) => {
      await ctx.answerCbQuery(`Отмена...`);
      return ctx.scene.leave();
    });
  }

  get scene(): Scenes.WizardScene<BotContext> {
    return this._scene;
  }
}

class CreateVoteForVoice extends SceneWrapper {
  private _scene: Scenes.WizardScene<BotContext>;

  constructor() {
    super('createVoteForVoice');

    this._scene = new Scenes.WizardScene<BotContext>(
      this.sceneName,
      async (ctx) => {
        await ctx.reply(
          `${emj.edit} Введи имя человека, который запрашивает право голоса`,
        );
        return ctx.wizard.next();
      },
      async (ctx) => {
        new TextValidator().validate(ctx).execute(ctx, async (ctx, value) => {
          ctx.helper.named.set('name', value);
          await ctx.reply(
            `${emj.edit} Введи айди/логин человека, который запрашивает право голоса`,
            Markup.inlineKeyboard([
              [Markup.button.callback('Запросить для себя', 'QBforMe')],
            ]),
          );
          return ctx.wizard.next();
        });
      },
      async (ctx) => {
        new UserValidator().validate(ctx).execute(ctx, async (ctx, value) => {
          let forUser: IUser | undefined;
          const manager = ctx.helper.get(CommunardsManager)!;
          forUser =
            typeof value === 'string'
              ? manager.getCommunardByUsername(value)
              : manager.getCommunardById(value);

          if (!forUser) {
            await ctx.reply(`${emj.fail} Коммунар не найден! Попробуй ещё раз`);
            return;
          }

          await makePreviewAndAskForConfirmation(ctx, {
            question: '',
            options: [],
            type: VoteType.VoteForVoice,
            forUser: { ...forUser, name: ctx.helper.named.get<string>('name') },
          });
        });
      },
    );

    this._scene.action('QBforMe', async (ctx) => {
      await ctx.answerCbQuery(`Окей`);
    });

    this._scene.action('QBcreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Запускаю...`);
      await startVote(ctx);
      return ctx.scene.leave();
    });

    this._scene.action('QBrecreateVote', async (ctx) => {
      await ctx.answerCbQuery(`Пересоздаю...`);
      await ctx.reply(`${emj.edit} Введи вопрос для голосования`);
    });

    this._scene.action('QBcancelCreationVote', async (ctx) => {
      await ctx.answerCbQuery(`Отмена...`);
      return ctx.scene.leave();
    });
  }

  get scene(): Scenes.WizardScene<BotContext> {
    return this._scene;
  }
}

const createYesNoVoteScene = new CreateYesNoVoteScene();
const createChoiceVoteScene = new CreateChoiceVoteScene();
const createVoteForVoiceScene = new CreateVoteForVoice();
// const createVoteForChatScene = new CreateVoteForChat();
const createVoteScene = new CreateVoteScene(
  createYesNoVoteScene,
  createChoiceVoteScene,
  createVoteForVoiceScene,
);

export {
  createVoteScene,
  createYesNoVoteScene,
  createChoiceVoteScene,
  createVoteForVoiceScene,
};

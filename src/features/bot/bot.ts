import { Markup, Scenes, session, Telegraf } from 'telegraf';
import {
  BotContext,
  BotContextHelper,
} from '@/library/telegraf/domain/bot_context';
import { Logger } from 'tslog';
import { CommunardsManager } from '@/features/db/communards_manager';
import {
  addCommunardWizard,
  delCommunardWizard,
  setCommunardsWizard,
} from './scenes/communards';
import { emj } from './domain/emoji';
import { IDB, IUser } from '@/domain/models/db';
import Db from '@/library/fsdb';
import VoteManager from '@/features/vote/vote_manager';
import { btn } from './domain/buttons';
import { SceneWrapper } from '@/library/telegraf/scenes/scene_wrapper';
import {
  createVoteScene,
  createYesNoVoteScene,
  createChoiceVoteScene,
} from './scenes/create_vote';
import { IConfig } from '@/domain/models/config';
import { createUserLink } from '@/library/telegraf/utils/url';

export class Bot {
  private scenes: Record<string, SceneWrapper> = {};

  constructor(
    private readonly bot: Telegraf<BotContext>,
    private readonly config: IConfig,
    private readonly logger: Logger<any>,
    private readonly communardsManager: CommunardsManager,
    private readonly voteManager: VoteManager,
    private readonly db: Db<IDB>,
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.catch((err) => {
      this.logger.error(err);
    });

    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить бота' },
      { command: 'add_communard', description: 'Добавить коммунара' },
      { command: 'del_communard', description: 'Удалить коммунара' },
      { command: 'list_communards', description: 'Список коммунаров' },
      {
        command: 'set_communards',
        description: 'Установить список коммунаров',
      },
      { command: 'cancel', description: 'Отменить текущее действие' },
      { command: 'create_vote', description: 'Создать голосование' },
    ]);

    // set username
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id ?? -1;
      if (this.communardsManager.isCommunard(userId)) {
        await this.communardsManager.setCommunardUsername(
          userId,
          ctx.from?.username ?? '',
        );
      }
      return next();
    });

    // check group and ban strangers
    this.bot.use(async (ctx, next) => {
      if (ctx.chat?.type !== 'group') {
        return next();
      }

      if (ctx.chat.id !== this.config.groupId || ctx.from?.is_bot) {
        return;
      }

      if (
        !this.db.data.admins.includes(ctx.from?.id ?? 0) &&
        !this.communardsManager.isCommunard(ctx.from?.id ?? -1)
      ) {
        this.logger.info('not admin and not communard');
        return;
      }

      return next();
    });

    // ignore no private messages
    this.bot.use(async (ctx, next) => {
      if (ctx.chat?.type !== 'private') {
        return;
      }
      return next();
    });

    // session
    this.bot.use(
      session({
        defaultSession: () => ({
          namedData: {},
          data: {},
          sceneStack: [],
        }),
      }),
    );

    // logging
    this.bot.use(async (ctx, next) => {
      if (ctx.message && 'text' in ctx.message) {
        this.logger.info(
          `[${ctx.from?.username ?? ctx.from?.id}] message: ${ctx.message.text}`,
        );
      } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        this.logger.info(
          `[${ctx.from?.username ?? ctx.from?.id}] cq: ${ctx.callbackQuery.data}`,
        );
      } else {
        this.logger.info(
          `[${ctx.from?.username ?? ctx.from?.id}] update: ${JSON.stringify(ctx)}`,
        );
      }
      return next();
    });

    // setup context
    this.bot.use(async (ctx, next) => {
      ctx.helper = new BotContextHelper(ctx);
      ctx.helper.set(CommunardsManager, this.communardsManager);
      ctx.helper.set(VoteManager, this.voteManager);
      await this.updateUserData(ctx);
      return next();
    });

    // cancel action
    this.bot.command('cancel', (ctx) => this.handleCommandCancel(ctx));

    // scenes
    this.bot.use(
      new Scenes.Stage<BotContext>(
        [
          addCommunardWizard,
          delCommunardWizard,
          setCommunardsWizard,
          createVoteScene.scene,
          createYesNoVoteScene.scene,
          createChoiceVoteScene.scene,
        ],
        {
          defaultSession: {
            data: [],
            namedData: {},
            callbacks: {},
          },
        },
      ).middleware(),
    );

    // commands
    this.bot.command('start', (ctx) => this.handleCommandStart(ctx));

    this.bot.command('add_communard', (ctx) =>
      this.checkAdmin(ctx, () => ctx.scene.enter('addCommunard')),
    );
    this.bot.command('del_communard', (ctx) =>
      this.checkAdmin(ctx, () => ctx.scene.enter('delCommunard')),
    );
    this.bot.command('list_communards', (ctx) =>
      this.checkAdmin(ctx, () => this.handleCommandListCommunards(ctx)),
    );
    this.bot.command('set_communards', (ctx) =>
      this.checkAdmin(ctx, () => ctx.scene.enter('setCommunards')),
    );

    this.bot.command('create_vote', (ctx) =>
      this.checkIsCommunard(ctx, () => createVoteScene.enter(ctx)),
    );

    // keyboard buttons
    this.bot.hears(btn.createVote, (ctx) =>
      this.checkIsCommunard(ctx, () => createVoteScene.enter(ctx)),
    );

    // fallbakcs
    this.bot.action(/.*/, (ctx) => {
      try {
        ctx.answerCbQuery(`${emj.fail} Кнопка не доступна`);
      } catch (e) {
        this.logger.error(e);
      }
    });

    this.bot.use((ctx) => {
      ctx.reply(`${emj.fail} Не понимаю, что ты хочешь :(`, {
        reply_markup: Markup.keyboard([[btn.createVote]])
          .resize()
          .oneTime().reply_markup,
      });
    });
  }

  async launch(): Promise<void> {
    this.logger.info('Bot launching...');
    await this.bot.launch();
  }

  // HANDLERS
  private async handleCommandStart(ctx: BotContext): Promise<void> {
    await ctx.reply(
      `${emj.hello} Привет! Я бот для управления коммунарами.`,
      Markup.keyboard([[btn.createVote]])
        .resize()
        .oneTime(),
    );
  }

  private async handleCommandListCommunards(ctx: BotContext): Promise<void> {
    const communards = await this.communardsManager.getCommunards();
    if (communards.length === 0) {
      await ctx.reply(`${emj.fail} Список коммунаров пуст`);
      return;
    }

    const com2str = (com: IUser) =>
      com.username
        ? `@${com.username} (<code>${com.telegramId}</code>)`
        : createUserLink(com.telegramId, com.telegramId);

    await ctx.reply(
      `${emj.info} Список коммунаров:\n\n${communards.map(com2str).join('\n')}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleCommandCancel(ctx: BotContext): Promise<void> {
    ctx.session = {
      namedData: {},
      sceneStack: [],
      data: {},
    };
    await ctx.reply(
      `${emj.cancel} Действие отменено`,
      Markup.keyboard([[btn.createVote]])
        .resize()
        .oneTime(),
    );
  }

  private async checkAdmin(ctx: BotContext, action: any): Promise<void> {
    if (!this.db.data.admins.includes(ctx.from?.id ?? 0)) {
      await ctx.reply(`${emj.fail} У вас нет доступа к этой команде`);
      return;
    }
    await action();
  }

  private async checkIsCommunard(ctx: BotContext, action: any): Promise<void> {
    if (!(await this.communardsManager.isCommunard(ctx.from?.id ?? -1))) {
      await ctx.reply(
        `${emj.angry} Ты кто такой? Нет, не отвечай, я не знаю тебя`,
      );
      return;
    }
    await action();
  }

  // UTILS
  private async updateUserData(ctx: BotContext): Promise<void> {}
}

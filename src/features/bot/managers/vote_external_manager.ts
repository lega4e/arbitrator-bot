import { Logger } from 'tslog';
import { IVote, VoteType } from '@/domain/models/vote';
import { IVoteExternalManager } from '@/features/vote/vote_manager';
import { Telegraf } from 'telegraf';
import { IConfig } from '@/domain/models/config';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { emj } from '../domain/emoji';
import { format } from 'date-fns';
import { ignoreMessageNotModified } from '@/library/telegraf/utils/telegram_api_errors';
import { IDB } from '@/domain/models/db';
import Db from '@/library/fsdb';
import VoteLogicManager from '@/features/vote/vote_logic_manager';

class VoteExternalManager implements IVoteExternalManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly bot: Telegraf<BotContext>,
    private readonly db: Db<IDB>,
    private readonly voteLogicManager: VoteLogicManager,
    private readonly config: IConfig,
  ) {}

  async updateVote(vote: IVote) {
    const text = this.makeText(vote);

    let makeParams = () => ({
      reply_markup: vote.closedAt
        ? undefined
        : {
            inline_keyboard: this.makeInlineKeyboard(vote),
          },
      parse_mode: 'HTML' as any,
      ...(this.config.topicId != null
        ? { message_thread_id: this.config.topicId }
        : {}),
    });

    if (vote.tg) {
      this.logger.info(`Updating vote: ${vote.id}`);
      await ignoreMessageNotModified(async () => {
        await this.bot.telegram.editMessageText(
          vote.tg!.chatId,
          vote.tg!.messageId,
          vote.tg!.topicId?.toString(),
          text,
          makeParams(),
        );
      });
    } else {
      this.logger.info(`Sending vote: ${vote.id}`);
      const message = await this.bot.telegram.sendMessage(
        this.config.groupId,
        text,
        makeParams(),
      );
      vote.tg = {
        chatId: message.chat.id,
        messageId: message.message_id,
        topicId: this.config.topicId,
      };
    }
  }

  registerMiddleware() {
    this.bot.action(/^vote_([\w\d-]+)_option_(\d+)$/, async (ctx) => {
      let username = ctx.from?.username;
      if (!username) {
        await ctx.answerCbQuery(
          `${emj.fail} Чтобы голосовать, у тебя должен быть установлен @login`,
          { show_alert: true },
        );
        return;
      }

      const voteId = ctx.match[1];
      const optionId = parseInt(ctx.match[2]);
      const vote =
        this.db.data.votes.find((vote) => vote.id === voteId) || null;

      if (vote && !this.voteLogicManager.haveVoice(vote, ctx.from.id)) {
        await ctx.answerCbQuery(`${emj.fail} Ты не имеешь права голоса`, {
          show_alert: true,
        });
        return;
      }

      if (vote && this.voteLogicManager.voiceForYouself(vote, ctx.from.id)) {
        await ctx.answerCbQuery(
          `${emj.fail} Ты не можешь голосовать за себя!`,
          { show_alert: true },
        );
        return;
      }

      await this.voteLogicManager.handleTap(
        voteId,
        optionId,
        ctx.from.id,
        username,
        (vote) => this.updateVote(vote),
      );
      await ctx.answerCbQuery(`${emj.ok} Твой голос учтён!`);
    });
  }

  makePreviewText(vote: IVote) {
    return this.makeText(vote);
  }

  // service
  private makeText(vote: IVote) {
    if ([VoteType.VoteForVoice, VoteType.VoteForChat].includes(vote.type)) {
      vote.options = [
        {
          id: 0,
          text: 'Да',
        },
        {
          id: 1,
          text: 'Нет',
        },
      ];
      vote.question =
        vote.type == VoteType.VoteForVoice
          ? `Будет ли человек по имени ${vote.forUser!.name} иметь право голоса?`
          : `Будет ли человек по имени ${vote.forUser!.name} иметь право находиться в чате?`;
    }

    const title = `<b><u>${vote.question}</u></b>`;

    const leaderOptions = this.voteLogicManager.calculateLeaderOptions(vote);
    const users = new Set(vote.voices.map((v) => v.userId));

    const options = vote.options
      .map((o) => {
        const voices = vote.voices.filter((v) => v.optionId === o.id);
        const emoji =
          leaderOptions.includes(o.id) &&
          (voices.length > 0 ||
            [
              VoteType.VoteForVoice,
              VoteType.VoteForChat,
              VoteType.YesNo,
            ].includes(vote.type))
            ? emj.best
            : emj.point;
        let percent =
          vote.voices.length == 0 ? 0 : (voices.length / users.size) * 100;

        return [
          `${emoji} ${o.text}`,
          ...(voices.length > 0 &&
          ![VoteType.VoteForVoice, VoteType.VoteForChat].includes(vote.type)
            ? [`<i>${voices.map((v) => `@${v.userLogin}`).join(', ')}</i>`]
            : []),
          `<i>Голосов: ${voices.length}, ${percent.toFixed(0)}%</i>`,
        ].join('\n');
      })
      .join('\n\n');

    let timestamp = '';
    let result = null;
    if (vote.closedAt) {
      timestamp = `<i>Голосование всё (${format(
        new Date(vote.closedAt),
        'dd.MM.yyyy HH:mm',
      )})</i>`;

      if (vote.type === VoteType.YesNo) {
        result =
          leaderOptions[0] == 0
            ? '<b>Решение принято!</b>'
            : '<b>Решение не принято!</b>';
      } else if (vote.type === VoteType.VoteForVoice) {
        result =
          leaderOptions[0] == 0
            ? `<b>Человек получает право голоса!</b>`
            : `<b>Человек не получает право голоса!</b>`;
      } else if (vote.type === VoteType.VoteForChat) {
        result =
          leaderOptions[0] == 0
            ? `<b>Человек получает право находиться в чате!</b>`
            : `<b>Человек не получает право находиться в чате!</b>`;
      } else {
        const leaders = vote.options.filter((o) =>
          leaderOptions.includes(o.id),
        );
        if (leaders.length > 1) {
          result = `<b>Результат: ${leaders.map((l) => '"' + l.text + '"').join(' или ')}</b>`;
        } else if (leaders.length == 1) {
          result = `<b>Результат:</b> ${leaders[0].text}</b>`;
        } else {
          result = '<b>Результат: ничего...?</b>';
        }
      }
    } else {
      timestamp = `<i>Голосование до ${format(
        new Date(vote.createdAt + this.config.voteLifeTimeSeconds * 1000),
        'dd.MM.yyyy HH:mm',
      )}</i>`;
    }

    result ? (result = '\n' + result) : null;
    const voted = `<i>Всего проголосовало: ${users.size}</i>`;
    const end = [timestamp, voted, result].filter(Boolean).join('\n');

    return [title, options, end].join('\n\n');
  }

  private makeInlineKeyboard(vote: IVote) {
    return vote.options.map((o) => [
      {
        text: o.text,
        callback_data: `vote_${vote.id}_option_${o.id}`,
      },
    ]);
  }
}

export default VoteExternalManager;

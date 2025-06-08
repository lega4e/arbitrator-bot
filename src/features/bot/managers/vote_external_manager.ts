import { Logger } from 'tslog';
import { IVote, IVoteOption, VoteType } from '@/domain/models/vote';
import { IVoteExternalManager } from '@/features/vote/vote_manager';
import { Telegraf } from 'telegraf';
import { IConfig } from '@/domain/models/config';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { emj } from '../domain/emoji';
import { CommunardsManager } from '@/features/db/communards_manager';
import { format } from 'date-fns';
import { ignoreMessageNotModified } from '@/library/telegraf/utils/telegram_api_errors';

class VoteExternalManager implements IVoteExternalManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly bot: Telegraf<BotContext>,
    private readonly communardsManager: CommunardsManager,
    private readonly config: IConfig,
    private readonly handleTapOption: (
      voteId: string,
      optionId: number,
      userId: number,
      userLogin: string,
    ) => Promise<void>,
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

      if (!(await this.communardsManager.isCommunard(ctx.from.id))) {
        await ctx.answerCbQuery(`${emj.fail} Ты не имеешь права голоса`, {
          show_alert: true,
        });
        return;
      }

      const voteId = ctx.match[1];
      const optionId = parseInt(ctx.match[2]);
      await this.handleTapOption(voteId, optionId, ctx.from.id, '@' + username);
      await ctx.answerCbQuery(`${emj.ok} Твой голос учтён!`);
    });
  }

  makePreviewText(vote: IVote) {
    return this.makeText(vote);
  }

  // service
  private makeText(vote: IVote) {
    if (vote.type === VoteType.VoteForVoice) {
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
      vote.question = `Будет ли человек по имени ${vote.forUser?.name} иметь право голоса?`;
    }

    const title = `<b><u>${vote.question}</u></b>`;

    const leaderOptions = this.calculateLeaderOptions(vote);
    const users = new Set(vote.voices.map((v) => v.userId));

    const options = vote.options
      .map((o) => {
        const voices = vote.voices.filter((v) => v.optionId === o.id);

        let percent = 0;
        if (vote.voices.length == 0) {
          percent = 0;
        } else {
          percent = (voices.length / users.size) * 100;
        }

        const emoji = leaderOptions.includes(o.id) ? emj.best : emj.point;

        return [
          `${emoji} ${o.text}`,
          ...(voices.length > 0 && vote.type != VoteType.VoteForVoice
            ? [`<i>${voices.map((v) => `${v.userLogin}`).join(', ')}</i>`]
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
          leaderOptions[0] == 0 ? 'Решение принято!' : 'Решение не принято!';
      } else if (vote.type === VoteType.VoteForVoice) {
        result =
          leaderOptions[0] == 0
            ? `Человек получает право голоса!`
            : `Человек не получает право голоса!`;
      } else {
        const leaders = vote.options.filter((o) =>
          leaderOptions.includes(o.id),
        );
        if (leaders.length > 1) {
          result = `Результат: ${leaders.map((l) => '"' + l.text + '"').join(' или ')}`;
        } else if (leaders.length == 1) {
          result = `Результат: ${leaders[0].text}`;
        } else {
          result = 'Результат: ничего...?';
        }
      }
    } else {
      timestamp = `<i>Голосование до ${format(
        new Date(vote.createdAt + this.config.voteLifeTimeSeconds * 1000),
        'dd.MM.yyyy HH:mm',
      )}</i>`;
    }
    const voted = `Всего проголосовало: ${users.size}`;
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

  private calculateLeaderOptions(vote: IVote): number[] {
    if (vote.type === VoteType.YesNo || vote.type === VoteType.VoteForVoice) {
      const yesVotes = vote.voices.filter((v) => v.optionId === 0).length;
      return (yesVotes * 100) / vote.voices.length >
        (vote.type === VoteType.YesNo
          ? this.config.percentForYesNoVote
          : this.config.percentForVoteForVoice)
        ? [0]
        : [1];
    } else {
      let leaderOptions: number[] = [];
      let maxVotes = 0;
      for (const o of vote.options) {
        const votes = vote.voices.filter((v) => v.optionId === o.id).length;
        if (votes > maxVotes) {
          maxVotes = votes;
          leaderOptions = [o.id];
        } else if (votes === maxVotes) {
          leaderOptions.push(o.id);
        }
      }
      return leaderOptions;
    }
  }
}

export default VoteExternalManager;

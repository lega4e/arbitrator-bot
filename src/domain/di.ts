import { Bot } from '@/features/bot/bot';
import { CommunardsManager } from '@/features/db/communards_manager';
import { Logger } from 'tslog';
import { config } from './models/config';
import { defaultData, IDB } from './models/db';
import Db from '@/library/fsdb';
import VoteManager from '@/features/vote/vote_manager';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { Telegraf } from 'telegraf';
import VoteExternalManager from '@/features/bot/managers/vote_external_manager';

export async function makeBot() {
  const db = new Db<IDB>(config.dbPath, defaultData, config.debug);
  await db.load();

  const logger = new Logger({
    name: 'MyLogger',
    minLevel: 0,
    type: 'pretty',
  });

  const bot = new Telegraf<BotContext>(config.botToken);
  const communardsManager = new CommunardsManager(logger, db);
  const voteExternalManager = new VoteExternalManager(
    logger,
    bot,
    communardsManager,
    config,
    async (voteId, optionId, userId, userLogin) => {
      await voteManager.handleTap(voteId, optionId, userId, userLogin);
    },
  );
  const voteManager = new VoteManager(logger, db, config, voteExternalManager);

  // init
  voteManager.startCloseVotePolling();
  voteExternalManager.registerMiddleware();

  return new Bot(bot, config, logger, communardsManager, voteManager, db);
}

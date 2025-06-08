import { Bot } from '@/features/bot/bot';
import CommunardsManager from '@/features/db/communards_manager';
import { Logger } from 'tslog';
import { config } from './models/config';
import { defaultData, IDB } from './models/db';
import Db from '@/library/fsdb';
import VoteManager from '@/features/vote/vote_manager';
import { BotContext } from '@/library/telegraf/domain/bot_context';
import { Telegraf } from 'telegraf';
import VoteExternalManager from '@/features/bot/managers/vote_external_manager';
import VoteLogicManager from '@/features/vote/vote_logic_manager';

export async function makeBot() {
  const db = new Db<IDB>(config.dbPath, defaultData, config.debug);
  await db.load();

  const logger = new Logger({
    type: 'pretty',
    minLevel: 0,
    prettyLogTimeZone: 'local',
    prettyLogTemplate:
      '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}} [{{logLevelName}}]: ',
  });

  const bot = new Telegraf<BotContext>(config.botToken);
  const communardsManager = new CommunardsManager(logger, db);

  const voteLogicManager = new VoteLogicManager(
    config,
    communardsManager,
    logger,
    db,
  );

  const voteExternalManager = new VoteExternalManager(
    logger,
    bot,
    db,
    voteLogicManager,
    config,
  );

  const voteManager = new VoteManager(
    logger,
    db,
    config,
    voteExternalManager,
    voteLogicManager,
  );

  // init
  voteManager.startCloseVotePolling();
  voteExternalManager.registerMiddleware();

  return new Bot(bot, config, logger, communardsManager, voteManager, db);
}

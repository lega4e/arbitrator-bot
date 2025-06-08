import { Logger } from 'tslog';
import Db from '@/library/fsdb';
import { IDB, IUser } from '@/domain/models/db';
import { IConfig } from '@/domain/models/config';
import { IVote, VoteType } from '@/domain/models/vote';
import { v4 as uuidv4 } from 'uuid';
import VoteLogicManager from './vote_logic_manager';

export interface IVoteExternalManager {
  updateVote(vote: IVote): Promise<void>;

  makePreviewText(vote: IVote): string;
}

export default class VoteManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly db: Db<IDB>,
    private readonly config: IConfig,
    private readonly externalManager: IVoteExternalManager,
    private readonly voteLogicManager: VoteLogicManager,
  ) {}

  makePreviewText(vote: IVote) {
    return this.externalManager.makePreviewText(vote);
  }

  async startVote(vote: IVote): Promise<IVote> {
    this.logger.info(`Starting vote: ${vote.question}`);
    vote.createdAt = new Date().getTime();
    await this.externalManager.updateVote(vote);
    await this.db.update((db) => db.votes.push(vote));
    return vote;
  }

  startCloseVotePolling() {
    setInterval(async () => {
      const now = new Date();

      for (const vote of [...this.db.data.votes]) {
        if (
          vote.createdAt + this.config.voteLifeTimeSeconds * 1000 <
          now.getTime()
        ) {
          await this.voteLogicManager.closeVote(vote);
          await this.externalManager.updateVote(vote);
        }
      }
    }, 1000);
  }

  makeVote(
    question: string,
    options: string[],
    type: VoteType,
    forUser: (IUser & { name: string }) | null,
    createdByUser: number,
  ): IVote {
    return {
      id: uuidv4(),
      tg: null,
      type,
      question,
      options: options.map((option, index) => ({
        id: index,
        text: option,
      })),
      voices: [],
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      closedAt: null,
      createdBy: createdByUser,
      forUser,
    };
  }
}

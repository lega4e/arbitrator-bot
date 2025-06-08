import { Logger } from 'tslog';
import Db from '@/library/fsdb';
import { IDB, IUser } from '@/domain/models/db';
import { IConfig } from '@/domain/models/config';
import { IVote, VoteType } from '@/domain/models/vote';
import { v4 as uuidv4 } from 'uuid';

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
  ) {}

  makePreviewText(vote: IVote) {
    return this.externalManager.makePreviewText(vote);
  }

  async startVote(vote: IVote): Promise<IVote> {
    this.logger.info(`Starting vote: ${vote.question}`);
    await this.externalManager.updateVote(vote);
    await this.db.update((db) => db.votes.push(vote));
    return vote;
  }

  async handleTap(
    voteId: string,
    optionId: number,
    userId: number,
    userLogin: string,
  ) {
    this.logger.info(`Handling tap for vote: ${voteId}, option: ${optionId}`);

    const vote = this._getVoteById(voteId);
    if (!vote) {
      this.logger.error(`Vote not found: ${voteId}`);
      throw new Error(`Vote not found: ${voteId}`);
    }

    const voicesLen = vote.voices.length;
    vote.voices = vote.voices.filter(
      (voice) => !(voice.userId === userId && voice.optionId === optionId),
    );

    if (vote.voices.length == voicesLen) {
      if (vote.type != VoteType.MultiChoice) {
        vote.voices = vote.voices.filter((voice) => voice.userId != userId);
      }
      vote.voices.push({ optionId, userId, userLogin });
    }

    await this.externalManager.updateVote(vote);
    await this.db.save();
  }

  startCloseVotePolling() {
    setInterval(async () => {
      const now = new Date();
      const votes = this.db.data.votes;
      const removeIds: string[] = [];

      for (const vote of votes) {
        if (
          vote.createdAt + this.config.voteLifeTimeSeconds * 1000 <
          now.getTime()
        ) {
          vote.closedAt = now.getTime();
          await this.externalManager.updateVote(vote);
          this.db.data.closedVotes.push(vote);
          removeIds.push(vote.id);
        }
      }

      await this.db.update(
        (db) => (db.votes = db.votes.filter((v) => !removeIds.includes(v.id))),
      );
    }, 1000);
  }

  makeVote(
    question: string,
    options: string[],
    type: VoteType,
    userId: number,
    forUser: (IUser & { name: string }) | null,
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
      createdBy: userId,
      forUser,
    };
  }

  private _getVoteById(id: string): IVote | null {
    return this.db.data.votes.find((vote) => vote.id === id) || null;
  }
}

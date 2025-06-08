import { IConfig } from '@/domain/models/config';
import { IVote, VoteType } from '@/domain/models/vote';
import CommunardsManager, { UserType } from '@/features/db/communards_manager';
import { Logger } from 'tslog';
import Db from '@/library/fsdb';
import { IDB } from '@/domain/models/db';

export default class VoteLogicManager {
  constructor(
    private readonly config: IConfig,
    private readonly communardsManager: CommunardsManager,
    private readonly logger: Logger<any>,
    private readonly db: Db<IDB>,
  ) {}

  async handleTap(
    voteId: string,
    optionId: number,
    userId: number,
    userLogin: string,
    updateVote: (vote: IVote) => Promise<void>,
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

    vote.updatedAt = new Date().getTime();
    await updateVote(vote);
    await this.db.save();
  }

  calculateLeaderOptions(vote: IVote): number[] {
    if (
      [VoteType.YesNo, VoteType.VoteForVoice, VoteType.VoteForChat].includes(
        vote.type,
      )
    ) {
      const yesVotes = vote.voices.filter((v) => v.optionId === 0).length;
      const neededPercent =
        vote.type === VoteType.YesNo
          ? this.config.percentForYesNoVote
          : vote.type === VoteType.VoteForVoice
            ? this.config.percentForVoteForVoice
            : this.config.percentForVoteForChat;
      return (yesVotes * 100) / vote.voices.length > neededPercent ? [0] : [1];
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

  async closeVote(vote: IVote) {
    vote.closedAt = new Date().getTime();
    vote.updatedAt = vote.closedAt;
    this.db.data.votes = this.db.data.votes.filter((v) => v.id !== vote.id);
    this.db.data.closedVotes.push(vote);

    if (
      vote.forUser &&
      [VoteType.VoteForVoice, VoteType.VoteForChat].includes(vote.type) &&
      this.decisionMade(vote)
    ) {
      if (vote.type == VoteType.VoteForVoice) {
        this.communardsManager.addUser(
          vote.forUser.telegramId,
          vote.forUser.username,
          UserType.Constituency,
        );
      } else {
        this.communardsManager.addUser(
          vote.forUser.telegramId,
          vote.forUser.username,
          UserType.Community,
        );
      }
    }

    await this.db.save();
  }

  decisionMade(vote: IVote): boolean {
    if (
      ![VoteType.YesNo, VoteType.VoteForVoice, VoteType.VoteForChat].includes(
        vote.type,
      )
    ) {
      throw new Error('Invalid vote type');
    }

    const leaderOptions = this.calculateLeaderOptions(vote);
    return leaderOptions[0] === 0;
  }

  haveVoice(vote: IVote, userId: number): boolean {
    return (
      this.communardsManager.isCommunard(userId) ||
      (vote.type != VoteType.VoteForVoice &&
        this.communardsManager.isConstituency(userId))
    );
  }

  voiceForYouself(vote: IVote, userId: number): boolean {
    return (
      [VoteType.VoteForVoice, VoteType.VoteForChat].includes(vote.type) &&
      vote.forUser?.telegramId === userId
    );
  }

  private _getVoteById(id: string): IVote | null {
    return this.db.data.votes.find((vote) => vote.id === id) || null;
  }
}

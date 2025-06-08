import dotenv from 'dotenv';

dotenv.config();

export interface IConfig {
  dbPath: string;
  botToken: string;
  groupId: number;
  topicId: number | null;
  voteLifeTimeSeconds: number;
  percentForYesNoVote: number;
  percentForVoteForVoice: number;
  debug: boolean;
}

export const config: IConfig = {
  dbPath: process.env.DB_PATH || 'db.json',
  botToken: process.env.BOT_TOKEN || '',
  groupId: process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : 0,
  topicId: process.env.TOPIC_ID ? parseInt(process.env.TOPIC_ID) : null,
  voteLifeTimeSeconds: process.env.VOTE_LIFE_TIME_SECONDS
    ? parseInt(process.env.VOTE_LIFE_TIME_SECONDS)
    : 60 * 60 * 24 * 3,
  percentForYesNoVote: process.env.PERCENT_FOR_YES_NO_VOTE
    ? parseInt(process.env.PERCENT_FOR_YES_NO_VOTE)
    : 70,
  percentForVoteForVoice: process.env.PERCENT_FOR_VOTE_FOR_VOICE
    ? parseInt(process.env.PERCENT_FOR_VOTE_FOR_VOICE)
    : 79.5,
  debug: process.env.DEBUG === 'true',
};

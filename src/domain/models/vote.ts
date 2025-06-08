import { IUser } from './db';

export interface IVoteOption {
  text: string;
  id: number;
}

export interface IVoteVoice {
  optionId: number;
  userId: number;
  userLogin: string;
}

export enum VoteType {
  YesNo = 'yes_no',
  SingleChoice = 'choice',
  MultiChoice = 'multi_choice',
  VoteForVoice = 'vote_for_voice',
}

export interface IVoteTg {
  messageId: number;
  topicId: number | null;
  chatId: number;
}

export interface IVote {
  id: string;
  tg: IVoteTg | null;

  type: VoteType;
  question: string;
  options: IVoteOption[];
  voices: IVoteVoice[];
  forUser: (IUser & { name: string }) | null;

  createdBy: number;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

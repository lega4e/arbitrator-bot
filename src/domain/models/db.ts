import { IVote } from './vote';

export interface IUser {
  telegramId: number;
  username: string | null;
}

export interface IDB {
  banMode: boolean;
  communards: IUser[];
  community: IUser[];
  constituency: IUser[];
  admins: number[];
  votes: IVote[];
  closedVotes: IVote[];
}

export const defaultData: IDB = {
  banMode: false,
  communards: [],
  community: [],
  constituency: [],
  admins: [],
  votes: [],
  closedVotes: [],
};

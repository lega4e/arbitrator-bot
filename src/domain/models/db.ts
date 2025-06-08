import { IVote } from './vote';

export interface IUser {
  telegramId: number;
  username: string | null;
}

export interface IDB {
  communards: IUser[];
  community: IUser[];
  admins: number[];
  votes: IVote[];
  closedVotes: IVote[];
}

export const defaultData: IDB = {
  communards: [],
  community: [],
  admins: [],
  votes: [],
  closedVotes: [],
};

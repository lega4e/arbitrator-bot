import { IVote } from './vote';

export interface IDB {
  communards: string[];
  admins: number[];
  votes: IVote[];
  closedVotes: IVote[];
}

export const defaultData: IDB = {
  communards: [],
  admins: [],
  votes: [],
  closedVotes: [],
};

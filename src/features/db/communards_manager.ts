import { Logger } from 'tslog';
import { IDB, IUser } from '@/domain/models/db';
import Db from '@/library/fsdb';
import { ClassUuid } from '@/library/class_uuid';

export enum UserType {
  Communard = 'communard',
  Constituency = 'constituency',
  Community = 'community',
}

@ClassUuid()
export default class CommunardsManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly db: Db<IDB>,
  ) {}

  async addCommunard(
    userId: number,
    username: string | null,
  ): Promise<boolean> {
    return this.addUser(userId, username, UserType.Communard);
  }

  async addUser(
    userId: number,
    username: string | null,
    userType: UserType,
  ): Promise<boolean> {
    let user = this.findUser({ userId, userTypes: [userType] });
    if (user) {
      this.logger.info(`User ${username} (${userId}) already exists`);
      if (user.username !== username) {
        user.username = username;
        await this.db.save();
      }
      return false;
    }

    user = this.findUser({ userId });
    await this.db.update((data) => {
      if (user) {
        const predicate = (c: IUser) => c.telegramId !== userId;
        data.communards = data.communards.filter(predicate);
        data.constituency = data.constituency.filter(predicate);
        data.community = data.community.filter(predicate);
      }

      if (userType === UserType.Constituency) {
        data.constituency.push({
          telegramId: userId,
          username: username ?? user?.username ?? null,
        });
      } else if (userType === UserType.Communard) {
        data.communards.push({
          telegramId: userId,
          username: username ?? user?.username ?? null,
        });
      } else if (userType === UserType.Community) {
        data.community.push({
          telegramId: userId,
          username: username ?? user?.username ?? null,
        });
      }
    });
    this.logger.info(`${userType} ${username} (${userId}) added`);
    return true;
  }

  async setUserUsername(userId: number, username: string): Promise<boolean> {
    const user = this.findUser({ userId });

    if (!user) {
      this.logger.info(`User (${userId}) not found`);
      return false;
    }

    if (user.username === username) {
      return true;
    }

    user.username = username;
    await this.db.save();
    return true;
  }

  async delCommunardByUserId(userId: number): Promise<boolean> {
    if (!this.isCommunard(userId)) {
      this.logger.info(`Communard (${userId}) not found`);
      return false;
    }
    await this.db.update((data) => {
      data.communards = data.communards.filter(
        (communard) => communard.telegramId !== userId,
      );
    });
    this.logger.info(`Communard ${userId} deleted`);
    return true;
  }

  async delCommunardByUsername(username: string): Promise<boolean> {
    const communard = this.db.data!.communards.find(
      (c) => c.username === username,
    );
    return this.delCommunardByUserId(communard?.telegramId ?? -1);
  }

  getCommunards(): IUser[] {
    return this.db.data!.communards;
  }

  findUser({
    userId,
    username,
    userTypes,
  }: {
    userId?: number;
    username?: string;
    userTypes?: UserType[];
  }): IUser | undefined {
    const predicate = (user: IUser) => {
      if (userId && username) {
        return user.telegramId === userId && user.username === username;
      } else if (userId) {
        return user.telegramId === userId;
      } else {
        return user.username === username;
      }
    };

    return [
      ...(!userTypes || userTypes.includes(UserType.Communard)
        ? this.db.data!.communards
        : []),
      ...(!userTypes || userTypes.includes(UserType.Constituency)
        ? this.db.data!.constituency
        : []),
      ...(!userTypes || userTypes.includes(UserType.Community)
        ? this.db.data!.community
        : []),
    ].find(predicate);
  }

  async setCommunards(userIds: number[]): Promise<void> {
    await this.db.update(
      (data) =>
        (data.communards = userIds.map((id) => ({
          telegramId: id,
          username: '',
        }))),
    );
    this.logger.info(`Communards set to ${userIds.join(', ')}`);
  }

  isCommunard(userId: number): boolean {
    return !!this.findUser({ userId, userTypes: [UserType.Communard] });
  }

  isConstituency(userId: number): boolean {
    return !!this.findUser({
      userId,
      userTypes: [UserType.Constituency, UserType.Communard],
    });
  }

  isCommunity(userId: number): boolean {
    return !!this.findUser({ userId });
  }
}

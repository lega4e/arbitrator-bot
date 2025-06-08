import { Logger } from 'tslog';
import { IDB, IUser } from '@/domain/models/db';
import Db from '@/library/fsdb';
import { ClassUuid } from '@/library/class_uuid';

@ClassUuid()
export class CommunardsManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly db: Db<IDB>,
  ) {}

  async addCommunard(userId: number, username: string): Promise<boolean> {
    if (this.isCommunard(userId)) {
      this.logger.info(`Communard ${username} (${userId}) already exists`);
      return false;
    }
    await this.db.update((data) =>
      data.communards.push({ telegramId: userId, username }),
    );
    this.logger.info(`Communard ${username} (${userId}) added`);
    return true;
  }

  async setCommunardUsername(
    userId: number,
    username: string,
  ): Promise<boolean> {
    const communard = this.db.data!.communards.find(
      (c) => c.telegramId === userId,
    );

    if (!communard) {
      this.logger.info(`Communard (${userId}) not found`);
      return false;
    }

    if (communard.username === username) {
      return true;
    }

    communard.username = username;
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

  getCommunardByUsername(username: string): IUser | undefined {
    return this.db.data!.communards.find((c) => c.username === username);
  }

  getCommunardById(id: number): IUser | undefined {
    return this.db.data!.communards.find((c) => c.telegramId === id);
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
    return this.db
      .data!.communards.map((communard) => communard.telegramId)
      .includes(userId);
  }
}

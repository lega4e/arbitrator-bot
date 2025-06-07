import fs from 'fs/promises';

export default class Db<T> {
  public data!: T;

  constructor(
    private readonly filename: string,
    private readonly defaultData: T,
    private readonly pretty: boolean = false,
  ) {
    this.data = defaultData;
  }

  async save() {
    await fs.writeFile(
      this.filename,
      this.pretty
        ? JSON.stringify(this.data, null, 2)
        : JSON.stringify(this.data),
    );
  }

  async update(updater: (data: T) => void) {
    updater(this.data);
    await this.save();
  }

  async load() {
    let data;
    try {
      data = await fs.readFile(this.filename, 'utf8');
    } catch (error) {
      this.data = this.defaultData;
      await this.save();
      return;
    }
    this.data = JSON.parse(data);
  }
}

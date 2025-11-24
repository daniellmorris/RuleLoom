declare module 'bree' {
  export interface BreeJob {
    name: string;
    path: string;
    interval?: string | number;
    cron?: string;
    timeout?: string | number | boolean;
    worker?: Record<string, unknown>;
  }

  export interface BreeOptions {
    root?: string | false;
    jobs: BreeJob[];
    workerMessageHandler?: (message: unknown) => void | Promise<void>;
  }

  export default class Bree {
    constructor(options: BreeOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
  }
}

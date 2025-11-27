/// <reference types="@cloudflare/workers-types" />

declare module '@cloudflare/ai' {
  export class Ai {
    constructor(binding: any);
    run(model: string, options: any): Promise<any>;
  }
}
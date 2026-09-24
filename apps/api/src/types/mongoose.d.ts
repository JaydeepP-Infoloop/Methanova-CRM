import "mongoose";

declare module "mongoose" {
  interface Document {
    softDelete(actorId?: string): Promise<this>;
  }
}

export {};

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Request, Response } from "express";
import { verifyToken } from "./db";

export type Context = {
  req: Request;
  res: Response;
  user: { userId: number; email: string } | null;
};

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const user = token ? await verifyToken(token) : null;
  return { req, res, user };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in (10001)" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

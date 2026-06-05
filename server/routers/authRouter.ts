import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb, hashPassword, comparePassword, generateToken } from "../_core/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      const passwordHash = await hashPassword(input.password);
      await db.insert(users).values({ email: input.email, passwordHash, name: input.name });
      const newUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      const token = await generateToken(newUser[0].id, input.email);
      return { token, user: { id: newUser[0].id, email: input.email, name: input.name, plan: "free" } };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!found.length) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      const valid = await comparePassword(input.password, found[0].passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      const token = await generateToken(found[0].id, input.email);
      return { token, user: { id: found[0].id, email: found[0].email, name: found[0].name, plan: found[0].plan } };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const found = await db.select().from(users).where(eq(users.id, ctx.user.userId)).limit(1);
    if (!found.length) throw new TRPCError({ code: "NOT_FOUND" });
    const u = found[0];
    const planActive = !u.planExpiresAt || new Date(u.planExpiresAt) > new Date();
    return { id: u.id, email: u.email, name: u.name, plan: planActive ? u.plan : "free" };
  }),
});

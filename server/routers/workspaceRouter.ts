import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../_core/db";
import { workspaces, workspaceMembers, users, invites } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

export const workspaceRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.insert(workspaces).values({ name: input.name, ownerId: ctx.user.userId });
      const ws = await db.select().from(workspaces)
        .where(eq(workspaces.ownerId, ctx.user.userId))
        .orderBy(workspaces.createdAt).limit(1);
      await db.insert(workspaceMembers).values({ workspaceId: ws[0].id, userId: ctx.user.userId, role: "owner" });
      return ws[0];
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const memberships = await db.select().from(workspaceMembers)
      .where(eq(workspaceMembers.userId, ctx.user.userId));
    if (!memberships.length) return [];
    const wsIds = memberships.map(m => m.workspaceId);
    const all = await db.select().from(workspaces);
    return all.filter(w => wsIds.includes(w.id)).map(w => ({
      ...w,
      role: memberships.find(m => m.workspaceId === w.id)?.role,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.id)).limit(1);
      if (!ws.length) throw new TRPCError({ code: "NOT_FOUND" });
      const membership = await db.select().from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.id), eq(workspaceMembers.userId, ctx.user.userId)))
        .limit(1);
      if (!membership.length) throw new TRPCError({ code: "FORBIDDEN" });
      const members = await db.select({
        id: workspaceMembers.id, role: workspaceMembers.role, joinedAt: workspaceMembers.joinedAt,
        userId: workspaceMembers.userId, name: users.name, email: users.email,
      }).from(workspaceMembers)
        .leftJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, input.id));
      return { ...ws[0], members, myRole: membership[0].role };
    }),

  invite: protectedProcedure
    .input(z.object({ workspaceId: z.number(), email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const membership = await db.select().from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, ctx.user.userId)))
        .limit(1);
      if (!membership.length || membership[0].role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN", message: "Only workspace owners can invite members" });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(invites).values({ workspaceId: input.workspaceId, email: input.email, token, expiresAt });
      console.log(`[Workspace] Invite token for ${input.email}: ${token}`);
      return { token, message: `Invite created for ${input.email}` };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const invite = await db.select().from(invites).where(eq(invites.token, input.token)).limit(1);
      if (!invite.length) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite token" });
      if (invite[0].usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
      if (new Date(invite[0].expiresAt) < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });
      const existing = await db.select().from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, invite[0].workspaceId), eq(workspaceMembers.userId, ctx.user.userId)))
        .limit(1);
      if (!existing.length) {
        await db.insert(workspaceMembers).values({ workspaceId: invite[0].workspaceId, userId: ctx.user.userId, role: "member" });
      }
      await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.token, input.token));
      return { workspaceId: invite[0].workspaceId };
    }),

  removeMember: protectedProcedure
    .input(z.object({ workspaceId: z.number(), userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const membership = await db.select().from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, ctx.user.userId)))
        .limit(1);
      if (!membership.length || membership[0].role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)));
      return { success: true };
    }),
});

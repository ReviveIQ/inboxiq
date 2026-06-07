import { router } from "../_core/trpc";
import { authRouter } from "./authRouter";
import { workspaceRouter } from "./workspaceRouter";
import { inboxRouter, opportunityRouter } from "./inboxRouter";

export const appRouter = router({
  auth: authRouter,
  workspace: workspaceRouter,
  inbox: inboxRouter,
  opportunity: opportunityRouter,
});

export type AppRouter = typeof appRouter;

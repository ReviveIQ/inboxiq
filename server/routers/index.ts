import { router } from "../_core/trpc";
import { authRouter } from "./authRouter";
import { workspaceRouter } from "./workspaceRouter";

export const appRouter = router({
  auth: authRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;

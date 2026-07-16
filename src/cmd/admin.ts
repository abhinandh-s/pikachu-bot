import { Composer } from "grammy";

export const adminCmds = new Composer();

const ADMIN_ID = Number(Deno.env.get("ADMIN_ID"));

adminCmds.command("admin", async (ctx) => {}
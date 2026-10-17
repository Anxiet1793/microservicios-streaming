import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "./session";
import { ServiceError } from "./http";
import { headers } from "next/headers";
import { safeReturn } from "../models";
export async function viewer() {
  try {
    return await currentUser();
  } catch (e) {
    if (e instanceof ServiceError && e.status === 401)
      redirect(
        `/login?next=${encodeURIComponent(safeReturn((await headers()).get("x-nevaro-path")))}`,
      );
    throw e;
  }
}

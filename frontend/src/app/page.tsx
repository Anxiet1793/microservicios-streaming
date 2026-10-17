import { redirect } from "next/navigation";
import { sessionId } from "../lib/server/session";
export default async function Page() {
  redirect((await sessionId()) ? "/home" : "/login");
}

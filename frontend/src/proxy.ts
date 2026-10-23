import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-nevaro-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: [
    "/home/:path*",
    "/explore/:path*",
    "/search/:path*",
    "/title/:path*",
    "/watch/:path*",
    "/my-list/:path*",
    "/history/:path*",
    "/continue-watching/:path*",
    "/profile/:path*",
    "/preferences/:path*",
    "/admin/:path*",
  ],
};

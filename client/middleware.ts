// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Decode JWT utility (without verifying signature)
function decodeJwt(token: string) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = parts[1];
        // JWT uses base64url encoding
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decodedPayload = Buffer.from(base64, "base64").toString("utf-8");
        return JSON.parse(decodedPayload);
    } catch (e) {
        return null;
    }
}

export function middleware(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    console.log("token", token)
    const pathname = req.nextUrl.pathname;
    console.log("pathname", pathname)
    let decoded: any = null;

    // Nếu có token, decode
    if (token) {
        decoded = decodeJwt(token);
    }

    // ❗ BỎ QUA static files & next internals
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/images") ||
        pathname.startsWith("/fonts")
    ) {
        return NextResponse.next();
    }

    // Nếu vào root ("/") thì chuyển sang "/home"
    if (pathname === "/") {
        return NextResponse.redirect(new URL("/home", req.url));
    }

    // Nếu có token và vào /auth thì redirect về /home
    if (pathname.startsWith("/auth")) {
        if (token) {
            return NextResponse.redirect(new URL("/home", req.url));
        } else {
            return NextResponse.next();
        }
    }

    // Chưa login → redirect
    if (!token) {
        return NextResponse.redirect(new URL("/auth", req.url));
    }

    // Nếu vào /management mà không có quyền Admin thì redirect về /home
    if (pathname.startsWith("/management")) {
        if (!decoded || decoded.role !== "Admin") {
            return NextResponse.redirect(new URL("/home", req.url));
        }
    }

    return NextResponse.next();
}

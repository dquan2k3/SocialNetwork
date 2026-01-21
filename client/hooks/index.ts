"use client";

import { useInitUser } from "./initUser";
import { useCheckLogin } from "./checkLogin";

export function InitHooks() {
  useInitUser();
  useCheckLogin();
  return
}

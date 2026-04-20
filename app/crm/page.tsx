"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CRMRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/crm/dashboard"); }, []);
  return null;
}
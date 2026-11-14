import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdmin } from "@/lib/admin/server";

/** Checked on the server for every /admin page: anyone but an admin sees the ordinary 404. */
export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  if ((await getAdmin()) === null) notFound();
  return children;
}

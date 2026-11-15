import { redirect } from "next/navigation";

/** The old "Play" page: rooms now start from each game's page, listed at home. */
export default function PlayPage() {
  redirect("/");
}

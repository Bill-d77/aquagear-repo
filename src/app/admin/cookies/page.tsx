import { redirect } from "next/navigation";

// The Cookies tab was replaced by the Analytics hub, which folds in the consent
// stats. Keep this route as a redirect so old links/bookmarks don't 404.
export default function CookiesRedirect() {
  redirect("/admin/analytics");
}

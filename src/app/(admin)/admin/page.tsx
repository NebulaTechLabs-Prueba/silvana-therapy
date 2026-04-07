import { redirect } from 'next/navigation';

/**
 * /admin → /admin/dashboard
 * Convenience redirect so users landing on /admin get sent to the dashboard.
 */
export default function AdminRootPage() {
  redirect('/admin/dashboard');
}

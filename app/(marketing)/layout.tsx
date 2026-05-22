// Marketing route group. Wraps the brand landing in a .brand-shell so the
// scoped brand.css cannot leak into /dashboard or /market routes.

import "./brand.css";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="brand-shell">{children}</div>;
}

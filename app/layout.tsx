// Minimal root layout. This deployment is an API surface, not a site — the
// marketing/legal pages will be a separate concern. Next requires a root
// layout to exist even when every route is a handler.

export const metadata = {
  title: 'Growit API',
  description: 'Crop rules, frost profiles and weather adjustments.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

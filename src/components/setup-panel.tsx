import Image from "next/image";

export function SetupPanel() {
  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-copy">
          <div className="brand-mark">
            <Image
              className="brand-logo"
              src="https://www.uplandwildlifemanagement.com/lovable-uploads/a22bec12-9028-4ae2-aedf-59a70c278b87.png"
              alt="Upland Wildlife Management logo"
              width={172}
              height={44}
            />
            <p className="eyebrow">Supabase Setup Required</p>
          </div>
          <h1>Configure Supabase before enabling production authentication.</h1>
          <p className="lede">
            The auth and row-level security foundation is wired into the app, but this environment
            does not include the required Supabase keys yet.
          </p>
          <div className="auth-feature-list">
            <article className="auth-feature">
              <strong>Required env vars</strong>
              <p>`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and a site URL for auth callbacks.</p>
            </article>
            <article className="auth-feature">
              <strong>Required database step</strong>
              <p>Run the included Supabase migration to create profiles, client accounts, memberships, and RLS policies.</p>
            </article>
            <article className="auth-feature">
              <strong>Admin provisioning</strong>
              <p>Promote internal staff to the `admin` profile role and attach client memberships in Supabase.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

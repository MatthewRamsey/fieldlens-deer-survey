"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Search, UserRound } from "lucide-react";
import {
  setManagedPassword, updateManagedAccount, type AdminUserActionState,
} from "@/app/actions/admin-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  isSuperAdmin: boolean;
};

const initialState: AdminUserActionState = {};
const passwordCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function makeTemporaryPassword() {
  const bytes = new Uint8Array(22);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => passwordCharacters[byte % passwordCharacters.length]).join("") + "Aa1!";
}

function UserEditor({ user }: { user: ManagedUser }) {
  const router = useRouter();
  const [accountState, accountAction, accountPending] = useActionState(updateManagedAccount, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(setManagedPassword, initialState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (accountState.success) router.refresh();
  }, [accountState.success, router]);

  function generate() {
    const value = makeTemporaryPassword();
    setPassword(value);
    setConfirmation(value);
    setCopied(false);
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8">
    <form action={accountAction} className="grid gap-4 border-b border-border py-6">
      <h3 className="font-heading text-lg">Account details</h3>
      <input type="hidden" name="user_id" value={user.id} />
      <label className="grid gap-2 text-sm font-medium">Full name
        <Input name="full_name" defaultValue={user.fullName} required minLength={2} maxLength={120} autoComplete="off" />
      </label>
      <label className="grid gap-2 text-sm font-medium">Email address
        <Input name="email" type="email" defaultValue={user.email} required autoComplete="off" />
      </label>
      <p className="text-xs text-muted-foreground">Changing the email updates this person’s sign-in address immediately.</p>
      {accountState.error && <p role="alert" className="text-sm text-destructive">{accountState.error}</p>}
      {accountState.success && <p role="status" className="text-sm text-primary">{accountState.success}</p>}
      <Button type="submit" disabled={accountPending} className="justify-self-start">
        {accountPending ? "Saving…" : "Save account details"}
      </Button>
    </form>

    <form action={passwordAction} className="grid gap-4 py-6">
      <div>
        <h3 className="font-heading text-lg">Set a temporary password</h3>
        <p className="mt-1 text-sm text-muted-foreground">This takes effect immediately. Share it with the user through a secure channel; no email is sent.</p>
      </div>
      <input type="hidden" name="user_id" value={user.id} />
      <label className="grid gap-2 text-sm font-medium">Temporary password
        <Input name="password" type={showPassword ? "text" : "password"} value={password} onChange={event => { setPassword(event.target.value); setCopied(false); }}
          minLength={16} maxLength={128} required autoComplete="new-password" spellCheck={false} />
      </label>
      <label className="grid gap-2 text-sm font-medium">Confirm password
        <Input name="confirm_password" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)}
          minLength={16} maxLength={128} required autoComplete="new-password" spellCheck={false} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" onClick={generate}><KeyRound aria-hidden="true" /> Generate password</Button>
        <Button variant="outline" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
          {showPassword ? "Hide password" : "Show password"}
        </Button>
        <Button variant="outline" type="button" disabled={!password} onClick={async () => {
          await navigator.clipboard.writeText(password);
          setCopied(true);
        }}><Copy aria-hidden="true" /> {copied ? "Copied" : "Copy password"}</Button>
      </div>
      {passwordState.error && <p role="alert" className="text-sm text-destructive">{passwordState.error}</p>}
      {passwordState.success && <p role="status" className="text-sm text-primary">{passwordState.success}</p>}
      <Button type="submit" disabled={passwordPending} className="justify-self-start">
        {passwordPending ? "Setting password…" : "Set temporary password"}
      </Button>
    </form>
  </div>;
}

export function AdminUserManagement({ users }: { users: ManagedUser[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const filtered = useMemo(() => users.filter(user =>
    `${user.fullName} ${user.email}`.toLowerCase().includes(search.toLowerCase().trim()),
  ), [search, users]);

  return <>
    <Card className="workspace-card gap-4 p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl">Portal accounts</h2>
          <p className="text-sm text-muted-foreground">Update sign-in details or set a temporary password for any user.</p>
        </div>
        <Badge variant="secondary">{users.length} users</Badge>
      </div>
      <label className="relative block max-w-md">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search users" placeholder="Search name or email" value={search}
          onChange={event => setSearch(event.target.value)} className="pl-9" />
      </label>
      <div className="grid gap-3">
        {filtered.map(user => <Card key={user.id} size="sm" className="gap-0 border border-border/80 py-0 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><UserRound className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-semibold">{user.fullName}</p>
                <p className="break-all text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{user.isSuperAdmin ? "Super admin" : user.role === "admin" ? "Admin" : "Client"}</Badge>
              <Button variant="outline" size="sm" type="button" onClick={() => setSelected(user)}>Manage</Button>
            </div>
          </CardContent>
        </Card>)}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No users match that search.</p>}
      </div>
    </Card>
    <Sheet open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <SheetContent className="w-full sm:max-w-lg" aria-label={selected ? `Manage ${selected.fullName}` : "Manage user"}>
        <SheetHeader className="border-b border-border px-5 py-6 pr-14">
          <SheetTitle>{selected?.fullName ?? "Manage user"}</SheetTitle>
          <SheetDescription>{selected?.email} · {selected?.isSuperAdmin ? "Super admin" : selected?.role}</SheetDescription>
        </SheetHeader>
        {selected && <UserEditor key={selected.id} user={selected} />}
      </SheetContent>
    </Sheet>
  </>;
}

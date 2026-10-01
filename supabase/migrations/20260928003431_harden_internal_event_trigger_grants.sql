-- This helper belongs to an event trigger. API roles never need to invoke it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

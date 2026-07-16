-- POC MCP : serveurs MCP distants connectés par org (en complément des API).
-- Les tools de ces serveurs sont exposés aux agents via le connecteur MCP
-- d'Anthropic. Appliquée manuellement dans le SQL Editor.

create table if not exists mcp_servers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  url text not null,
  auth_token text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table mcp_servers enable row level security;

-- RLS : un membre ne voit/gère que les serveurs MCP de son org.
drop policy if exists mcp_servers_org_select on mcp_servers;
create policy mcp_servers_org_select on mcp_servers
  for select using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

drop policy if exists mcp_servers_org_all on mcp_servers;
create policy mcp_servers_org_all on mcp_servers
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

comment on table mcp_servers is 'Serveurs MCP distants connectés par org (POC connecteur MCP agents).';
comment on column mcp_servers.url is 'URL du serveur MCP distant (https).';
comment on column mcp_servers.auth_token is 'Bearer token optionnel transmis au serveur MCP (authorization_token).';

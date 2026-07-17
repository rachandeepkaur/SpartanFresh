-- Marathon Kitchen Coordination Platform -- Supabase / Postgres schema
-- Mirrors agents/schemas.py. Run this against a fresh Supabase project,
-- then set SUPABASE_URL and SUPABASE_SERVICE_KEY in agents/.env to switch
-- persistence over from the local JSON file with no code changes.

create table if not exists partners (
    id text primary key,                 -- e.g. 'spartan_garden', 'spartan_pantry'
    label text not null,
    kind text not null check (kind in ('upstream', 'downstream', 'internal')),
    created_at timestamptz not null default now()
);

create table if not exists unified_inventory_events (
    id uuid primary key,
    item text not null,
    quantity numeric not null,
    unit text not null,
    category text not null check (
        category in ('produce', 'canned', 'dairy', 'frozen', 'bakery', 'dry_goods', 'other')
    ),
    source_partner text not null references partners (id),
    direction text not null check (direction in ('inbound', 'outbound')),
    timestamp timestamptz not null,
    expiry_date timestamptz,
    raw jsonb not null default '{}',
    translated_by text not null check (translated_by in ('deterministic', 'gemini', 'heuristic')),
    created_at timestamptz not null default now()
);

create index if not exists idx_events_source_partner on unified_inventory_events (source_partner);
create index if not exists idx_events_direction on unified_inventory_events (direction);
create index if not exists idx_events_expiry on unified_inventory_events (expiry_date);

create table if not exists briefs (
    partner_id text primary key references partners (id),
    partner_label text not null,
    generated_at timestamptz not null,
    headline text not null,
    items jsonb not null default '[]',   -- serialized PriorityEntry[]
    narrative text not null
);

create table if not exists outcomes (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references unified_inventory_events (id),
    partner_id text not null references partners (id),
    quantity_used numeric,
    quantity_leftover numeric,
    logged_at timestamptz not null default now()
);

-- Seed the partners this MVP demo uses.
insert into partners (id, label, kind) values
    ('spartan_garden', 'Spartan Garden', 'upstream'),
    ('community_donor', 'Community Donor Drives', 'upstream'),
    ('spartan_pantry_intake', 'Spartan Pantry Intake', 'upstream'),
    ('marathon_kitchen_internal', 'Marathon Kitchen -- Internal', 'internal'),
    ('spartan_pantry', 'Spartan Food Pantry', 'downstream')
on conflict (id) do nothing;

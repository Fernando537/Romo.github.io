-- Wally Romo - Complete System Tables (idempotent)

create table if not exists public.colaboradores (
  id bigint generated always as identity primary key,
  usuario text not null unique,
  contrasena text not null,
  rol text not null default 'Operador' check (rol in ('Administrador', 'Operador')),
  permisos text[] not null default '{inicio,canchas,billar,tienda,flujo}',
  created_at timestamptz not null default now()
);

create table if not exists public.canchas_reservas (
  id text primary key,
  cancha smallint not null check (cancha in (2, 3, 4)),
  inicio_str text not null,
  fin_str text not null,
  fecha date not null,
  telefono text default '',
  cliente text not null default 'Cliente General',
  juego text not null default 'Wally',
  total numeric(10,2) not null default 0,
  acuenta numeric(10,2) not null default 0,
  saldo numeric(10,2) not null default 0,
  historial jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billar_historial (
  id bigint generated always as identity primary key,
  mesa smallint not null check (mesa in (1, 2)),
  modo text not null,
  fecha date not null,
  inicio_str text not null,
  fin_str text not null,
  duracion text not null,
  importe numeric(10,2) not null default 0,
  estado text not null default 'Por pagar' check (estado in ('Pagado', 'Por pagar')),
  created_at timestamptz not null default now()
);

create table if not exists public.tienda_categorias (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tienda_productos (
  id bigint not null primary key,
  nombre text not null,
  categoria text not null references public.tienda_categorias(nombre),
  precio numeric(10,2) not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flujo_caja (
  id bigint not null primary key,
  timestamp timestamptz not null default now(),
  fecha date not null,
  tipo text not null check (tipo in ('Ingreso', 'Egreso')),
  categoria text not null,
  concepto text not null,
  monto numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ventas_pos (
  id bigint generated always as identity primary key,
  total numeric(10,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes (idempotent)
create index if not exists idx_canchas_fecha on public.canchas_reservas(fecha);
create index if not exists idx_canchas_cancha_fecha on public.canchas_reservas(cancha, fecha);
create index if not exists idx_billar_fecha on public.billar_historial(fecha);
create index if not exists idx_flujo_fecha on public.flujo_caja(fecha);
create index if not exists idx_flujo_tipo on public.flujo_caja(tipo);
create index if not exists idx_flujo_categoria on public.flujo_caja(categoria);
create index if not exists idx_productos_categoria on public.tienda_productos(categoria);

-- Enable RLS (safe to run multiple times)
do $$
begin
  alter table public.colaboradores enable row level security;
  alter table public.canchas_reservas enable row level security;
  alter table public.billar_historial enable row level security;
  alter table public.tienda_categorias enable row level security;
  alter table public.tienda_productos enable row level security;
  alter table public.flujo_caja enable row level security;
  alter table public.ventas_pos enable row level security;
exception when others then null;
end;
$$;

-- Grants (idempotent)
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- RLS Policies (idempotent - drop then create)
do $$
begin
  drop policy if exists "Allow all on colaboradores" on public.colaboradores;
  create policy "Allow all on colaboradores" on public.colaboradores for all using (true) with check (true);

  drop policy if exists "Allow all on canchas_reservas" on public.canchas_reservas;
  create policy "Allow all on canchas_reservas" on public.canchas_reservas for all using (true) with check (true);

  drop policy if exists "Allow all on billar_historial" on public.billar_historial;
  create policy "Allow all on billar_historial" on public.billar_historial for all using (true) with check (true);

  drop policy if exists "Allow all on tienda_categorias" on public.tienda_categorias;
  create policy "Allow all on tienda_categorias" on public.tienda_categorias for all using (true) with check (true);

  drop policy if exists "Allow all on tienda_productos" on public.tienda_productos;
  create policy "Allow all on tienda_productos" on public.tienda_productos for all using (true) with check (true);

  drop policy if exists "Allow all on flujo_caja" on public.flujo_caja;
  create policy "Allow all on flujo_caja" on public.flujo_caja for all using (true) with check (true);

  drop policy if exists "Allow all on ventas_pos" on public.ventas_pos;
  create policy "Allow all on ventas_pos" on public.ventas_pos for all using (true) with check (true);
end;
$$;

# Sistema IECPR

Sistema de gestão ministerial da **Igreja Evangélica Congregacional do Porto do Rosa
(IECPR)**: agenda, escalas, cadastro ministerial e comunicação de um campo (matriz +
congregações).

## Stack

- React 19 + TypeScript (strict) + Vite
- React Router (SPA — todo acesso a dados é feito pelo cliente Supabase no navegador, com RLS)
- Tailwind CSS v4 (tema em `src/styles.css`, sem `tailwind.config.ts`)
- shadcn/ui sobre Radix UI (`src/components/ui`)
- TanStack Query v5
- react-hook-form + zod
- Supabase (Postgres + Auth + RLS + Edge Functions)
- recharts, xlsx, sonner

## Como rodar

```bash
npm install
cp .env.example .env   # preencha com o seu projeto Supabase
npm run dev
```

### Banco de dados

As migrações completas (enums, tabelas, RLS, funções, seed) estão em
`supabase/migrations/`, numeradas na ordem em que devem ser aplicadas. Com a
[CLI do Supabase](https://supabase.com/docs/guides/local-development):

```bash
supabase link --project-ref SEU_PROJETO
supabase db push
```

Depois, gere os tipos (opcional, `src/integrations/supabase/types.ts` já tem um
placeholder aberto):

```bash
supabase gen types typescript --project-id SEU_PROJETO > src/integrations/supabase/types.ts
```

### Edge Function administrativa

Criar usuário e redefinir senha exigem a `service_role key`, que nunca pode ir ao
navegador. Isso vive em `supabase/functions/admin-users`:

```bash
supabase functions deploy admin-users
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

### Primeiro usuário administrador

O seed não cria nenhuma conta (login/senha nunca entram em migração). Para o primeiro
acesso:

1. Aplique as migrações.
2. Crie o primeiro usuário via `auth.admin.createUser` (painel do Supabase, ou chamando
   a Edge Function `admin-users` diretamente com uma service key, uma única vez).
3. Insira manualmente uma linha em `user_access_profiles` com `profile = 'pastor_admin'`
   para esse usuário — depois disso, a tela **Usuários e acessos** cuida do resto.

## Testes

```bash
npm run test
npm run typecheck
npm run build
```

## Estrutura

Ver o documento de reconstrução original para o desenho completo de modelo de dados,
regras de negócio, telas e decisões de produto. Resumo das pastas:

```text
src/
  app/            AppShell, navegação, print.css
  components/     Componentes genéricos e shadcn/ui
  features/       Camada de dados por domínio (core, events, schedules, agendas, ...)
  hooks/          useSession, use-mobile
  integrations/   Cliente Supabase
  lib/            date.ts, labels.ts, server functions
  routes/         Telas (React Router)
  types/          Tipos de domínio compartilhados
supabase/
  migrations/     Schema completo, versionado
  functions/      Edge Function admin-users
```

## Convenções

- Interface 100% em português; nomes técnicos em inglês; tradução centralizada em
  `src/lib/labels.ts`.
- Fuso horário `America/Sao_Paulo` em toda apresentação — ver `src/lib/date.ts`.
- Exclusão sempre lógica (`deleted_at`); tabelas de vínculo puro usam `DELETE` real.
- Perfil de acesso (`user_access_profiles`) é independente da qualificação ministerial
  (`person_qualifications`) — nunca lido de `profiles`.
- Cores só por token semântico (`bg-primary`, `text-muted-foreground`); nunca
  `text-white` / `bg-[#hex]` direto em componente.

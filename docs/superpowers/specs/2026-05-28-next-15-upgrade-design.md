# Next 15 Upgrade Design

**Goal:** atualizar o projeto de `next@14.2.35` para uma versao estavel da linha 15 que atenda ao requisito minimo do PostHog wizard (`15.3.0`) sem ampliar desnecessariamente o risco de compatibilidade.

## Context

O projeto usa Next App Router, React 18, Sentry, Supabase SSR, rotas API em `src/app/api/`, middleware em `src/middleware.ts` e npm lockfile.

Hoje as dependencias principais estao em:

- `next@14.2.35`
- `eslint-config-next@14.2.35`
- `react@^18`
- `react-dom@^18`
- `@sentry/nextjs@^10.48.0`
- `@supabase/ssr@^0.9.0`

O requisito do PostHog wizard aponta para Next `15.3.0` ou superior por causa do suporte moderno a `instrumentation-client.ts`. O projeto ja possui `src/instrumentation-client.ts` para Sentry, entao a integracao com PostHog deve ser feita depois do upgrade, compondo com a instrumentacao existente em vez de substitui-la.

## Decision

Atualizar para:

- `next@15.5.18`
- `eslint-config-next@15.5.18`

Manter React 18 no primeiro passo, porque `next@15.5.18` aceita `react` e `react-dom` `^18.2.0 || ^19.0.0`. Isso reduz o raio da migracao: primeiro estabilizamos Next 15, depois avaliamos React 19 em uma mudanca separada.

Nao ativar Turbopack para build no primeiro upgrade. O projeto usa Sentry com configuracao de webpack em `next.config.mjs`, entao manter `next build` no caminho padrao e validar a compatibilidade antes de qualquer alteracao de empacotador.

## Version Rationale

Nao usar `15.3.0` como alvo final, mesmo sendo o minimo do PostHog wizard, porque essa versao ficou para tras em patches de seguranca.

`15.5.18` e o melhor alvo da linha 15 porque:

- atende ao requisito minimo do PostHog wizard
- esta no ultimo minor da linha 15 publicado no npm
- inclui patches recentes de seguranca da linha 15
- mantem compatibilidade com Node `^18.18.0 || ^19.8.0 || >=20.0.0`
- evita o salto para Next 16, que muda mais superficie de build e tooling

## Expected Code Changes

A migracao deve ser pequena e concentrada nos pontos em que Next 15 mudou APIs assicronas.

Areas esperadas:

- `src/lib/supabase/server.ts`
  - ajustar o uso de `cookies()` de `next/headers`
  - tornar o helper compativel com a API assincrona do Next 15

- `src/lib/api/auth.ts`
  - propagar a assinatura assincrona de criacao do client Supabase server, se necessario

- rotas dinamicas em `src/app/api/**/[id]/route.ts`
  - ajustar acesso a `params` quando o build/typecheck do Next 15 exigir `await`
  - preservar os checks de `withAuth` e `requireOwnership`

- paginas dinamicas em `src/app/dashboard/meetings/[id]/page.tsx` e `src/app/dashboard/meetings/[id]/edit/page.tsx`
  - ajustar `params` conforme o contrato do Next 15

- `package.json`
  - atualizar `next` e `eslint-config-next`
  - manter scripts atuais inicialmente

## PostHog Follow-Up

A integracao do PostHog nao faz parte deste upgrade.

Depois que Next 15 estiver verificado, o wizard pode ser executado com menor risco. Ao fazer isso, ele deve respeitar:

- `src/instrumentation-client.ts` ja inicializa Sentry
- `src/instrumentation.ts` ja exporta `onRequestError` da Sentry
- qualquer inicializacao do PostHog deve compor com Sentry, nao remover configuracoes existentes

## Compatibility Boundaries

Manter fora do escopo desta etapa:

- upgrade para React 19
- upgrade para Next 16
- migracao de `middleware.ts` para `proxy.ts`
- ativacao de Turbopack em build
- mudancas de produto ou UI
- instalacao/configuracao do PostHog

## Testing

Antes de atualizar dependencias, registrar o baseline:

- `npm test`
- `npm run lint:strict`
- `npm run build`

Depois da atualizacao e dos ajustes:

- `npm test`
- `npm run lint:strict`
- `npm run build`

Se `npm run lint` falhar por mudanca de tooling do Next 15, priorizar `lint:strict`, porque ele usa ESLint diretamente e ja e o caminho mais explicito do projeto.

## Rollout

Executar em branch/worktree isolado.

Sequencia recomendada:

1. Rodar baseline.
2. Atualizar `next` e `eslint-config-next` para `15.5.18`.
3. Instalar dependencias para atualizar `package-lock.json`.
4. Rodar testes e build para expor quebras reais.
5. Corrigir apenas incompatibilidades do upgrade.
6. Rodar verificacao completa novamente.
7. So depois executar o PostHog wizard.

## Non-Goals

- escolher Next 16 agora
- resolver problemas nao relacionados ao upgrade
- trocar arquitetura de auth, Supabase, Sentry ou Inngest
- alterar regras de seguranca de rotas
- introduzir o PostHog antes de estabilizar Next 15

# Redesign de Login/Cadastro e funil de onboarding de aquisição

Este documento descreve três entregas relacionadas: o redesign das telas de Login e
Cadastro (web e mobile) e o novo funil de onboarding de aquisição (`/start`).

## 1. Favicon e título

- `src/app/icon.svg`: ícone do Notura (waveform) usado como favicon. O
  `src/app/favicon.ico` padrão do Next foi removido para não competir com ele.
- `src/app/layout.tsx` e `src/app/dashboard/prototipo/page.tsx`: o título da aba é
  apenas `Notura`.

## 2. Login e Cadastro — web

Padrão visual único: logo centralizada, título/subtítulo centralizados, campos só com
placeholder (52px, raio 8px), botão primário roxo, divisor "ou", botão Google, link de
alternância Login ⇄ Cadastro e links de Termos/Privacidade.

- `src/components/auth/AuthFormParts.tsx`: peças compartilhadas (`AuthInput`,
  `AuthPasswordInput`, `AuthPrimaryButton`, `AuthOrDivider`, `AuthGoogleButton`,
  `AuthSwitchLink`, `AuthLegalLinks`).
- `src/components/auth/AuthShell.tsx`: novo `variant="centered"` (usado por Login e
  Cadastro). O `default` segue igual para esqueci/redefinir senha. No desktop o card
  esquerdo exibe o `BannerCarousel` do dashboard.
- `src/app/(auth)/login/page.tsx` e `signup/page.tsx`: UI refeita; a lógica de
  autenticação (e-mail/senha e Google OAuth) não mudou. O botão principal fica
  desabilitado até o formulário ser válido.

Pendências: `/termos` e `/privacidade` ainda não existem no web (links apontam para
essas rotas). O banner do plano Pro não tem ação fora do dashboard.

## 3. Login e Cadastro — mobile (Expo)

- `mobile/app/login.tsx` e `signup.tsx` reescritos sobre os componentes de
  `mobile/src/components/auth/` (`AuthLayout`, `AuthLogo`, `AuthFields`, `AuthActions`,
  `AuthFooterLinks`) e `mobile/src/lib/auth/auth-links.ts`.
- O tema do app é dark fixo; estas telas usam `palette.light` (tokens existentes) para
  o fundo lavanda.
- Nenhuma dependência nova. Lógica `signIn`/`signUp` inalterada.

Pendências: o app mobile não tem login com Google (o botão mostra um aviso), nem rota de
recuperação de senha (o link abre `/forgot-password` do web). O "G" do Google é texto
azul por não haver `react-native-svg`.

## 4. Funil de onboarding de aquisição (`/start`)

Objetivo: levar quem chega de anúncio ao **Aha Moment** (uma reunião demo processada)
antes de pedir cadastro. É independente do `/onboarding` existente (telefone, plano,
trial), que continua pós-cadastro e não foi alterado.

### Fluxo

```
problema → perfil → frequência → objetivos → promessa → objeções → demo → Aha → /signup?from=start → dashboard
```

### Arquitetura

| Camada | Local |
| --- | --- |
| Tipos | `src/lib/onboarding-funnel/types.ts` |
| Conteúdo (todos os textos, promessa personalizada, campanhas) | `.../content.ts` |
| Estado/navegação (reducer puro) | `.../engine.ts` |
| Reunião demo (mock isolado) | `.../demo-meeting.ts` |
| Persistência (`localStorage`) | `.../storage.ts` |
| Analytics (PostHog existente) | `.../analytics.ts` |
| UI | `src/components/onboarding-funnel/` |
| Páginas | `src/app/(auth)/start/` (`page.tsx`, `demo/page.tsx`, `error.tsx`, `start-api.ts`) |

Adicionar uma variação = editar `content.ts`; as telas só renderizam o que ele devolve.

### Campanhas

`/start?campaign=<slug>` com `meeting-minutes`, `tasks`, `sales` ou `manager` muda a
faixa/subtítulo da primeira tela e a promessa quando a resposta é "Um pouco de tudo".
O slug é validado (`^[a-z0-9][a-z0-9_-]{0,39}$`), persistido e enviado em todos os
eventos. Slugs desconhecidos são mantidos só para atribuição.

### Integração com o app

- `signup/page.tsx`: se o funil foi concluído neste navegador, mostra "Vamos salvar sua
  experiência no Notura." e dispara `signup_completed` (identifica o usuário no PostHog
  com as respostas).
- `dashboard-client.tsx`: `FirstMeetingStart` exibe "Vamos começar sua primeira reunião"
  (gravar / enviar gravação / rever demo em `/start/demo`) enquanto o usuário não tem
  reuniões.

### Eventos (PostHog)

Todos levam `flow: "acquisition"`, `problem`, `profile`, `meetingFrequency`, `goals`,
`campaign`.

`onboarding_started`, `onboarding_problem_selected`, `onboarding_profile_selected`,
`onboarding_frequency_selected`, `onboarding_goal_selected`,
`onboarding_promise_viewed`, `onboarding_objection_viewed`, `demo_meeting_opened`,
`demo_meeting_result_viewed`, `aha_moment_reached`, `signup_started`,
`signup_completed`, `first_meeting_started`, `onboarding_completed`.

> `onboarding_completed` também é emitido pelo onboarding antigo (plano). Diferencie
> pela propriedade `flow`.

### Mockado / pendente

- A reunião demo é local e estática (`demo-meeting.ts`); trocar por dados reais não
  altera a UI.
- As respostas ficam só no navegador; não são gravadas no perfil do usuário (exigiria
  migration + rota `/api`).
- `first_meeting_uploaded` e `first_meeting_completed` existem no tipo, mas não estão
  ligados à gravação/processamento.
- `signup_completed` não dispara no cadastro com Google (o usuário sai da página);
  falta emitir no callback.
- A raiz `/` continua redirecionando para `/login`; anúncios devem apontar para `/start`.

### Testes

`src/lib/onboarding-funnel/*.test.ts` (engine, conteúdo, storage, analytics) e
`src/app/(auth)/start/start-api.test.ts`.

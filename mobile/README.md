# Notura Mobile

Aplicativo mobile do Notura, construído com [Expo](https://expo.dev) (managed workflow), TypeScript e [Expo Router](https://docs.expo.dev/router/introduction/).

## Requisitos

- Node.js 24.x (mesma versão usada no projeto web)
- npm
- Expo CLI (instalada localmente via `npx`)

## Instalação

```bash
cd Notura-App/mobile
npm install
```

Copie as variáveis de ambiente e preencha com os valores do projeto web:

```bash
cp .env.example .env.local
```

Variáveis necessárias:

- `EXPO_PUBLIC_SUPABASE_URL` — URL do projeto Supabase
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon key do Supabase
- `EXPO_PUBLIC_API_BASE_URL` — base URL da API web (`https://app.notura.com.br`)

## Como rodar

```bash
npx expo start --dev-client
```

Depois escaneie o QR code com o **development build** instalado no celular (não o Expo Go — o app já tem código nativo compilado que o Expo Go não suporta), ou pressione:

- `a` para abrir no emulador Android
- `i` para abrir no simulador iOS (macOS only)
- `w` para rodar na versão web

> **Precisa de um build novo sempre que uma dependência com código nativo for adicionada.**
> Rode `eas build --profile development` de novo depois de qualquer mudança em libs como
> `expo-dev-client`, `expo-font`, `expo-asset` ou `expo-linear-gradient` — reiniciar o
> Metro não é suficiente, o binário instalado no celular precisa conter o novo código
> nativo.
>
> O app **não usa `react-native-reanimated`/`react-native-worklets`** de propósito: o menu
> hambúrguer (`src/components/nav/AppMenu.tsx`) e as animações da tela de gravação
> (`src/components/recording/`) são feitas só com a `Animated` API que já vem no core do
> React Native. Não reintroduza Reanimated sem necessidade real — a dupla reanimated/worklets
> já causou 3 ciclos de EAS build por mismatch de versão nativa (`installTurboModule called
> with N arguments`).

## Estrutura

- `app/` — rotas do Expo Router
  - `index.tsx` — splash/loading com roteamento condicional
  - `login.tsx` — tela de login
  - `signup.tsx` — tela de criação de conta
  - `confirm.tsx` — confirmação de e-mail via deep link
  - `(app)/` — rotas protegidas (exigem login)
- `src/lib/supabase.ts` — cliente Supabase com `expo-secure-store`
- `src/lib/auth/AuthProvider.tsx` — contexto de autenticação
- `src/lib/api/client.ts` — cliente de API autenticado com Bearer token
- Path alias `@/` configurado para `./src/`

## Autenticação

O app usa o mesmo projeto Supabase da web. A sessão é persistida com `expo-secure-store` e o refresh automático de token está habilitado. Deep link para confirmação de e-mail: `notura://confirm`.

## Scripts úteis

| Comando            | Descrição                              |
| ------------------ | -------------------------------------- |
| `npm start`        | Inicia o bundler do Expo               |
| `npm run android`  | Inicia no emulador Android             |
| `npm run ios`      | Inicia no simulador iOS                |
| `npm run web`      | Inicia a versão web do Expo            |
| `npm run lint`     | Executa o ESLint                       |

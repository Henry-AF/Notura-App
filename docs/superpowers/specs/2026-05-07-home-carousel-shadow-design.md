# Home Carousel Shadow Design

**Goal:** alinhar o carrossel promocional da dashboard com a mesma elevação visual usada pelo `SectionCard`.

## Context

O componente `src/components/dashboard/BannerCarousel.tsx` renderiza o carrossel da tela inicial da dashboard. Hoje ele já possui borda arredondada e `overflow: hidden`, mas não aplica a mesma sombra discreta usada em superfícies do produto como `src/components/ui/app/section-card.tsx`.

## Decision

Aplicar a mesma sombra do `SectionCard` diretamente no wrapper visual do carrossel:

- `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`

Essa mudança preserva o comportamento atual do carrossel e evita refatorações maiores, já que o componente já mistura `style` inline com `className`.

## Testing

Adicionar um teste de regressão simples que leia o source do `BannerCarousel` e confirme a presença da classe de shadow esperada no componente.

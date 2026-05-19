# Home Carousel Shadow Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aplicar ao carrossel da dashboard a mesma sombra visual usada por `SectionCard`

**Architecture:** a mudança fica isolada em `BannerCarousel`, sem alterar a lógica do carrossel. Um teste de source garante que a classe de shadow compartilhada continue presente.

**Tech Stack:** Next.js 14, React 18, Tailwind classes, Vitest

---

### Task 1: Cobrir a sombra do carrossel com teste

**Files:**
- Create: `src/components/dashboard/BannerCarousel.test.ts`
- Modify: `src/components/dashboard/BannerCarousel.tsx`
- Test: `src/components/dashboard/BannerCarousel.test.ts`

- [ ] **Step 1: Write the failing test**

Verificar que `BannerCarousel.tsx` contém a classe `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/dashboard/BannerCarousel.test.ts`
Expected: FAIL because the class is not present yet.

- [ ] **Step 3: Write minimal implementation**

Adicionar a classe de shadow ao wrapper principal do carrossel.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/dashboard/BannerCarousel.test.ts`
Expected: PASS.

- [ ] **Step 5: Run broader verification**

Run: `npm test -- src/components/dashboard/BannerCarousel.test.ts`
Expected: PASS with exit code 0.

# 🌙 Notura — Design System (Apple Premium Edition)
**Versão:** 2.0
**Brand Primary:** `#5341CD` (Indigo Vibrant)
**Conceito:** Transparência, Profundidade e Tipografia Dinâmica.
**Última atualização:** Abril 2026

---

## 1. Color & Materials

Para alcançar o aspecto premium, substituímos fundos sólidos por **Materiais** (blurs) e cores com maior contraste dinâmico.

### Brand / Accent
| Token | Hex | Uso |
| :--- | :--- | :--- |
| **accent-primary** | `#5E4CEB` | Pontos de interação (um tom acima para brilho) |
| **accent-secondary** | `rgba(83, 65, 205, 0.12)` | Backgrounds de botões e seleções |

### Neutral / Grayscale
| Token | Hex | Uso |
| :--- | :--- | :--- |
| **gray-50** | `#FBFBFE` | Off-white para superfícies de fundo |
| **gray-100** | `#F2F2F7` | Background de inputs (padrão iOS) |
| **gray-200** | `#E5E5EA` | Divisores sutis |
| **gray-800** | `#1C1C1E` | Texto principal (quase preto, mas suave) |

### Materials (Blur)
* **mat-thick:** `saturate(180%) blur(20px) bg(rgba(255,255,255,0.7))` — Usado em Toolbars e Bottom Nav.
* **mat-thin:** `saturate(180%) blur(10px) bg(rgba(255,255,255,0.4))` — Usado em Overlays e Sidebars.

---

## 2. Typography

Inspirado no sistema SF Pro. A chave é o **tracking (letter-spacing)** negativo em títulos grandes para uma aparência mais executiva e "tight".

| Token | Tamanho | Peso | Letter Spacing | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| **type-display** | 44px | 700 | -0.04em | 1.1 |
| **type-title-1** | 34px | 700 | -0.03em | 1.2 |
| **type-title-2** | 28px | 600 | -0.02em | 1.2 |
| **type-headline** | 17px | 600 | -0.01em | 1.3 |
| **type-body** | 17px | 400 | -0.01em | 1.4 |
| **type-footnote** | 13px | 400 | 0.01em | 1.3 |
| **type-caption** | 11px | 500 | 0.03em | 1.2 |

---

## 3. The Squircle (Radius & Elevation)

A Apple não utiliza raios circulares simples, mas curvas contínuas conhecidas como "Squircles".

### Border Radius
* **radius-s (10px):** Pequenos elementos e widgets.
* **radius-m (14px):** Inputs e botões.
* **radius-l (22px):** Cards e containers principais.
* **radius-xl (38px):** Modais e Sheets de fundo.

### Shadows
* **shadow-soft:** `0 2px 8px rgba(0,0,0,0.04)` — Elevação de nível 1.
* **shadow-floating:** `0 20px 40px rgba(0,0,0,0.12)` — Modais e Popovers.

---

## 4. Inputs & Fields

Saem as bordas pesadas, entram os preenchimentos leves que se integram ao fundo da página de forma orgânica.

* **Background:** `gray-100` (`#F2F2F7`)
* **Border:** `0px` (ou `0.5px solid rgba(0,0,0,0.05)`)
* **Radius:** `radius-m` (14px)
* **Padding:** 14px 16px
* **Focus State:** Background vira `#FFFFFF` com a sombra `shadow-soft`.

---

## 5. Buttons

Botões mais altos com feedback visual de pressão (escala).

* **Primary:** Background `#5E4CEB`, Texto `#FFF`, sombra discreta na cor da marca.
* **Secondary:** Background `accent-secondary`, Texto `accent-primary`. Sem bordas.
* **Interação (Spring):** Ao clicar, o botão reduz para `scale(0.96)` com uma transição suave de `0.2s`.

---

## 6. Navigation (Glassmorphism)

A navegação deve se comportar como uma camada flutuante sobre o conteúdo.

* **Bottom Tab Bar:** Material `mat-thick` com borda superior de `0.5px` em `rgba(0,0,0,0.1)`.
* **Ícones:** Tamanho `24px` com traços finos (Light ou Regular).
* **Estado Ativo:** Cor `accent-primary` com um leve aumento de escala no ícone para `1.1x`.

---

## 7. Cards & Containers

Foco em **Agrupamento Visual** e separação por contraste, não por linhas.

* **App Card:** Fundo branco, `radius-l`, `shadow-soft`, padding de `20px`.
* **Section Group:** Quando em lista, os cards não possuem bordas externas; são divididos por uma linha horizontal de `0.5px` que não toca as bordas laterais (estilo menu de Ajustes do iOS).

---

## Notas de Experiência (UX Premium)

> **Micro-interações:** Use sempre a curva de velocidade `cubic-bezier(0.3, 0, 0.1, 1)` para transições. É a curva que define a fluidez natural do iOS.
>
> **Espaçamento:** O espaço em branco é um elemento ativo. Se um elemento é importante, ele deve ter o dobro do padding ao redor para "respirar".

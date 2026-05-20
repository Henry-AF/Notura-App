"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildSupportWhatsAppUrl } from "@/lib/support-contact";

interface StaticBanner {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  desktopHref: string;
  desktopExternal?: boolean;
  mobileHref?: string;
  mobileExternal?: boolean;
}

const BANNERS: StaticBanner[] = [
  {
    desktopSrc: "/banners/banner-plano-pro.png",
    mobileSrc: "/banners/banner-plano-pro-mobile.png",
    alt: "Teste o plano Pro",
    desktopHref: "/planos",
    mobileHref: "/dashboard/settings",
  },
  {
    desktopSrc: "/banners/banner-integracoes.png",
    mobileSrc: "/banners/banner-integracoes-mobile.png",
    alt: "Quero receber novidades sobre integrações",
    desktopHref: "/novidades",
    mobileHref: "https://notura-lp2.pages.dev",
    mobileExternal: true,
  },
  {
    desktopSrc: "/banners/banner-atendimento.png",
    mobileSrc: "/banners/banner-atendimento-mobile.png",
    alt: "Nossa equipe de desenvolvimento atende você diretamente",
    desktopHref: buildSupportWhatsAppUrl(),
    desktopExternal: true,
    mobileHref: buildSupportWhatsAppUrl(),
    mobileExternal: true,
  },
];

const INTERVAL_MS = 6000;

export function BannerCarousel() {
  const router = useRouter();
  const count = BANNERS.length;
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);

  const currentRef = useRef(0);
  const pausedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const idx = (next + count) % count;
      currentRef.current = idx;
      setCurrent(idx);
    },
    [count]
  );

  const restartInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!pausedRef.current) goTo(currentRef.current + 1);
    }, INTERVAL_MS);
  }, [goTo]);

  useEffect(() => {
    restartInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [restartInterval]);

  const handleMouseEnter = () => {
    pausedRef.current = true;
    setHovered(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleMouseLeave = () => {
    pausedRef.current = false;
    setHovered(false);
    restartInterval();
  };

  const handlePrev = () => { goTo(currentRef.current - 1); restartInterval(); };
  const handleNext = () => { goTo(currentRef.current + 1); restartInterval(); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 40) return;
    delta < 0 ? handleNext() : handlePrev();
  };

  const handleMobileBannerAction = useCallback(
    (banner: StaticBanner) => {
      if (banner.mobileHref) {
        if (banner.mobileExternal) {
          window.open(banner.mobileHref, "_blank", "noopener,noreferrer");
          return;
        }

        router.push(banner.mobileHref);
      }
    },
    [router]
  );

  const arrowBase: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    border: "none",
    cursor: "pointer",
    color: "#fff",
    padding: 0,
    transition: "opacity 0.2s ease",
    opacity: hovered ? 1 : 0,
    pointerEvents: hovered ? "auto" : "none",
  };

  return (
    <div>
      {/* Track */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          overflow: "hidden",
        }}
        className="banner-carousel-root shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      >
        {/* Sliding strip */}
        <div
          style={{
            display: "flex",
            transform: `translateX(-${current * 100}%)`,
            transition: "transform 0.5s ease",
          }}
        >
          {BANNERS.map((banner) => (
            <div
              key={banner.desktopSrc}
              style={{
                flex: "0 0 100%",
                lineHeight: 0,
              }}
            >
              <a
                href={banner.desktopHref}
                target={banner.desktopExternal ? "_blank" : undefined}
                rel={banner.desktopExternal ? "noopener noreferrer" : undefined}
                className="hidden md:block"
                style={{
                  textDecoration: "none",
                }}
                draggable={false}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.desktopSrc}
                  alt={banner.alt}
                  style={{
                    width: "100%",
                    display: "block",
                    pointerEvents: "none",
                  }}
                  draggable={false}
                />
              </a>

              <button
                type="button"
                aria-label={banner.alt}
                className="block w-full md:hidden"
                onClick={() => handleMobileBannerAction(banner)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.mobileSrc}
                  alt={banner.alt}
                  style={{
                    width: "100%",
                    display: "block",
                    pointerEvents: "none",
                  }}
                  draggable={false}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Prev arrow */}
        <button
          type="button"
          aria-label="Banner anterior"
          onClick={handlePrev}
          style={{ ...arrowBase, left: 10 }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Next arrow */}
        <button
          type="button"
          aria-label="Próximo banner"
          onClick={handleNext}
          style={{ ...arrowBase, right: 10 }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
        }}
      >
        {BANNERS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Banner ${i + 1}`}
            onClick={() => { goTo(i); restartInterval(); }}
            style={{
              height: 8,
              width: i === current ? 20 : 8,
              borderRadius: 99,
              background: i === current ? "#ffffff" : "rgba(255,255,255,0.45)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
              transition: "width 0.3s ease, background-color 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Mobile height override */}

    </div>
  );
}

import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SocialProof } from "@/components/landing/social-proof";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <HowItWorks />
      <SocialProof />
      <Pricing />
      <Footer />
    </main>
  );
}

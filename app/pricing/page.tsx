import type { Metadata } from "next";
import { Pricing } from "@/ui/site/Pricing";

export const metadata: Metadata = {
  title: "ARGOS Pricing — Choose Your Mesh",
  description:
    "Three tiers of H200 infrastructure. Professional, Enterprise, and Elite bare-metal orchestration for AI-native commerce brands.",
};

export default function PricingPage() {
  return <Pricing />;
}

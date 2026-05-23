import type { Metadata } from "next";
import { Contact } from "@/ui/site/Contact";

export const metadata: Metadata = {
  title: "ARGOS Elite Access — Tell Us Your Scale",
  description:
    "Six pilots per quarter. Submit your architecture requirements and our team will engineer a bare-metal H200 mesh around your exact stack.",
};

export default function ContactPage() {
  return <Contact />;
}

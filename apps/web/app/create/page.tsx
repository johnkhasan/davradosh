import type { Metadata } from "next";
import { CreateLoader } from "@/components/create/create-loader";

export const metadata: Metadata = {
  title: "Puzzle yaratish",
  description: "Rasm tanlang, bo'laklar sonini belgilang va do'stlaringizni taklif qiling.",
};

export default function CreatePage() {
  return <CreateLoader />;
}

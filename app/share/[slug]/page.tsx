import { ShareView } from "@/components/share-view";

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ShareView slug={slug} />;
}
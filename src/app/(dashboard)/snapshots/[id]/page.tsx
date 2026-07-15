import { SnapshotDetailScreen } from "@/features/snapshots/components/SnapshotDetailScreen";
import { getSnapshotDetail } from "@/features/snapshots/queries";

type SnapshotDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SnapshotDetailPage({
  params,
}: SnapshotDetailPageProps) {
  const { id } = await params;
  const detail = await getSnapshotDetail(id);

  return <SnapshotDetailScreen {...detail} />;
}

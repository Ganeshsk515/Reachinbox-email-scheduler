import { EmailJob } from "@/lib/apiClient";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { SkeletonTable } from "./ui/SkeletonRow";

interface EmailTableProps {
  jobs: EmailJob[];
  loading: boolean;
  emptyMessage: string;
}

export function EmailTable({ jobs, loading, emptyMessage }: EmailTableProps) {
  if (loading) return <SkeletonTable />;
  if (jobs.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white/65 shadow-[0_8px_24px_rgba(117,73,49,0.06)]">
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center gap-4 border-b border-border px-5 py-4 text-sm last:border-b-0">
          <div className="min-w-0 w-56 shrink-0 font-medium">To: {job.recipient_email}</div>
          <div className="min-w-0 flex flex-1 items-center gap-3">
            <Badge status={job.status} />
            <span className="truncate font-medium">{job.subject}</span>
          </div>
          <div className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-xs text-primary">
            {new Date(job.sent_at ?? job.scheduled_for).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

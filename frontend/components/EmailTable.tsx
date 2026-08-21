import { EmailJob } from "@/lib/apiClient";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { Spinner } from "./ui/Spinner";

interface EmailTableProps {
  jobs: EmailJob[];
  loading: boolean;
  emptyMessage: string;
}

export function EmailTable({ jobs, loading, emptyMessage }: EmailTableProps) {
  if (loading) return <Spinner />;
  if (jobs.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted border-b border-border">
          <th className="py-2 font-medium">Email</th>
          <th className="py-2 font-medium">Subject</th>
          <th className="py-2 font-medium">Time</th>
          <th className="py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} className="border-b border-border">
            <td className="py-3">{job.recipient_email}</td>
            <td className="py-3">{job.subject}</td>
            <td className="py-3 text-muted">
              {new Date(job.sent_at ?? job.scheduled_for).toLocaleString()}
            </td>
            <td className="py-3">
              <Badge status={job.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
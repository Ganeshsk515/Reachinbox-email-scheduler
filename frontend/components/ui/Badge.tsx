type Status = "scheduled" | "sent" | "failed";

const styles: Record<Status, string> = {
  scheduled: "bg-status-scheduled-bg text-status-scheduled",
  sent: "bg-status-sent-bg text-status-sent",
  failed: "bg-status-failed-bg text-status-failed",
};

export function Badge({ status }: { status: Status }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
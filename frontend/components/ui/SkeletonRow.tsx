export function SkeletonTable({ rows = 5 }: { rows?: number }) {
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
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-b border-border">
            <td className="py-3"><div className="h-4 bg-border rounded animate-pulse w-40" /></td>
            <td className="py-3"><div className="h-4 bg-border rounded animate-pulse w-32" /></td>
            <td className="py-3"><div className="h-4 bg-border rounded animate-pulse w-28" /></td>
            <td className="py-3"><div className="h-5 bg-border rounded-full animate-pulse w-16" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
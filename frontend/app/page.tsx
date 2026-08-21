import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function Home() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Design system check</h1>
      <div className="flex gap-2">
        <Button>Primary Button</Button>
        <Button variant="outline">Outline Button</Button>
      </div>
      <div className="flex gap-2">
        <Badge status="scheduled" />
        <Badge status="sent" />
        <Badge status="failed" />
      </div>
    </div>
  );
}
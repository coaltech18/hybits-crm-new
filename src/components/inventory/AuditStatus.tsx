import { Badge } from '@/components/ui/Badge';
import { StatusBadge, StatusStamp } from '@/components/ui/StatusStamp';

// ================================================================
// AUDIT STATUS — the kit's audit vocabulary covers draft, submitted,
// approved and rejected. The audit service also has the in-progress
// states `counting` and `review`, and calls "submitted" by its DB
// name `pending_approval`. Map them here so lists and headers agree.
// ================================================================

const IN_PROGRESS: Record<string, string> = { counting: 'Counting', review: 'In review' };

const kitStatus = (status: string) => (status === 'pending_approval' ? 'submitted' : status);

export function AuditStatusBadge({ status, className }: { status: string; className?: string }) {
  if (status in IN_PROGRESS) {
    return (
      <Badge variant="draft" className={className}>
        {IN_PROGRESS[status]}
      </Badge>
    );
  }
  return <StatusBadge kind="audit" status={kitStatus(status)} className={className} />;
}

export function AuditStatusStamp({ status, detail, animate }: { status: string; detail?: string; animate?: boolean }) {
  if (status in IN_PROGRESS) {
    return <StatusStamp kind="audit" status="draft" detail={detail ?? IN_PROGRESS[status]} animate={animate} />;
  }
  return <StatusStamp kind="audit" status={kitStatus(status)} detail={detail} animate={animate} />;
}

import { supabase } from '@/lib/supabase';
import { countErrorMessage } from '@/utils/query';

// ================================================================
// INVENTORY AUDIT SERVICE
// ================================================================
// Service layer for monthly inventory audit workflow
//
// AUDIT WORKFLOW:
// 1. Create audit → Snapshot of all active items
// 2. Enter physical counts
// 3. Review variances (add reason + notes)
// 4. Submit → Auto-approve if all positive, else route to admin
// 5. Admin approves → Adjustment movements created
// ================================================================

// ================================================================
// TYPES
// ================================================================

export type AuditStatus =
    | 'draft'
    | 'counting'
    | 'review'
    | 'pending_approval'
    | 'approved'
    | 'rejected';

export interface Audit {
    id: string;
    outlet_id: string;
    outlet_name?: string;
    outlet_code?: string;
    period: string;
    status: AuditStatus;
    items_total: number;
    items_counted: number;
    variance_positive: number;
    variance_negative: number;
    created_by: string;
    created_by_name?: string;
    approved_by?: string;
    approved_by_name?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at?: string;
    submitted_at?: string;
    approved_at?: string;
    progress_percentage?: number;
    status_label?: string;
}

export interface AuditLineItem {
    id: string;
    audit_id: string;
    inventory_item_id: string;
    item_name?: string;
    item_category?: string;
    item_unit?: string;
    system_quantity: number;
    physical_quantity: number | null;
    variance: number | null;
    reason_code: string | null;
    notes: string | null;
    status: 'pending' | 'counted' | 'reviewed';
    created_at: string;
    updated_at: string;
}

export interface CreateAuditInput {
    outlet_id: string;
    period: string; // YYYY-MM
}

export interface UpdateCountInput {
    line_item_id: string;
    physical_quantity: number | null; // null clears the count (line back to 'pending')
}

export interface UpdateReasonInput {
    line_item_id: string;
    reason_code: string;
    notes: string;
}

export interface ApproveAuditInput {
    approved: boolean;
    rejection_reason?: string;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

async function getUserRole(userId: string): Promise<string> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.role || '';
}

/** Admins and managers may work on audits (RLS/RPCs enforce outlet scope). */
async function assertAuditWriter(userId: string, action: string): Promise<void> {
    const role = await getUserRole(userId);
    if (role !== 'admin' && role !== 'manager') {
        throw new Error(`Only admins and managers can ${action}`);
    }
}

// Row of view inventory_audit_summary (026)
interface AuditSummaryRow extends Omit<Audit, 'id'> {
    audit_id: string;
}

function mapAudit(row: AuditSummaryRow): Audit {
    return {
        id: row.audit_id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlet_name,
        outlet_code: row.outlet_code,
        period: row.period,
        status: row.status,
        items_total: row.items_total,
        items_counted: row.items_counted,
        variance_positive: row.variance_positive,
        variance_negative: row.variance_negative,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        approved_by: row.approved_by,
        approved_by_name: row.approved_by_name,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        submitted_at: row.submitted_at,
        approved_at: row.approved_at,
        progress_percentage: row.progress_percentage,
        status_label: row.status_label,
    };
}

type LineItemRow = Omit<AuditLineItem, 'item_name' | 'item_category' | 'item_unit'> & {
    inventory_items?: { name?: string; category?: string; unit?: string } | null;
};

function mapLineItem(row: LineItemRow): AuditLineItem {
    return {
        id: row.id,
        audit_id: row.audit_id,
        inventory_item_id: row.inventory_item_id,
        item_name: row.inventory_items?.name,
        item_category: row.inventory_items?.category,
        item_unit: row.inventory_items?.unit,
        system_quantity: row.system_quantity,
        physical_quantity: row.physical_quantity,
        variance: row.variance,
        reason_code: row.reason_code,
        notes: row.notes,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

const LINE_ITEM_SELECT = `
      *,
      inventory_items:inventory_item_id (
        name,
        category,
        unit
      )
    `;

// ================================================================
// AUDIT CRUD
// ================================================================

/**
 * Get audits list with filters
 */
export async function getAudits(
    _userId: string,
    filters: {
        outlet_id?: string;
        status?: AuditStatus | AuditStatus[];
        period?: string;
    } = {}
): Promise<Audit[]> {
    let query = supabase
        .from('inventory_audit_summary')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.outlet_id) {
        query = query.eq('outlet_id', filters.outlet_id);
    }

    if (filters.status) {
        if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
        } else {
            query = query.eq('status', filters.status);
        }
    }

    if (filters.period) {
        query = query.eq('period', filters.period);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return ((data || []) as AuditSummaryRow[]).map(mapAudit);
}

/**
 * Get single audit by ID
 */
export async function getAuditById(
    _userId: string,
    auditId: string
): Promise<Audit> {
    const { data, error } = await supabase
        .from('inventory_audit_summary')
        .select('*')
        .eq('audit_id', auditId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Audit not found');

    return mapAudit(data as AuditSummaryRow);
}

/**
 * Get line items for an audit
 */
export async function getAuditLineItems(
    _userId: string,
    auditId: string
): Promise<AuditLineItem[]> {
    const { data, error } = await supabase
        .from('inventory_audit_line_items')
        .select(LINE_ITEM_SELECT)
        .eq('audit_id', auditId)
        .order('id'); // stable; every line shares one created_at

    if (error) throw new Error(error.message);

    // Sort by item name (then id) so the count sheet keeps its order across saves.
    return ((data || []) as LineItemRow[])
        .map(mapLineItem)
        .sort(
            (a, b) =>
                (a.item_name || '').localeCompare(b.item_name || '') || a.id.localeCompare(b.id)
        );
}

/**
 * Create new audit
 * Uses database function to create audit with line items
 */
export async function createAudit(
    userId: string,
    input: CreateAuditInput
): Promise<{ audit: Audit; lineItems: AuditLineItem[] }> {
    await assertAuditWriter(userId, 'create audits');

    // Call the database function
    const { data, error } = await supabase
        .rpc('create_inventory_audit', {
            p_outlet_id: input.outlet_id,
            p_period: input.period,
            p_created_by: userId,
        });

    if (error) throw new Error(error.message);

    const auditId = data as string;

    // Fetch the created audit and line items
    const audit = await getAuditById(userId, auditId);
    const lineItems = await getAuditLineItems(userId, auditId);

    return { audit, lineItems };
}

/**
 * Check if audit can be created for outlet/period
 */
export async function canCreateAudit(
    _userId: string,
    outletId: string,
    period: string
): Promise<{ canCreate: boolean; reason?: string }> {
    // Check if a live audit already exists. A REJECTED audit does not block
    // its period: it can be audited again (migration 042).
    const { data: existing, error: existingError } = await supabase
        .from('inventory_audits')
        .select('id, status')
        .eq('outlet_id', outletId)
        .eq('period', period)
        .neq('status', 'rejected')
        .limit(1)
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
        return {
            canCreate: false,
            reason: `Audit already exists for this period (status: ${existing.status})`,
        };
    }

    // Check if there's an active audit
    const { data: active, error: activeError } = await supabase
        .from('inventory_audits')
        .select('id, period')
        .eq('outlet_id', outletId)
        .in('status', ['counting', 'review', 'pending_approval'])
        .limit(1)
        .maybeSingle();

    if (activeError) throw new Error(activeError.message);

    if (active) {
        return {
            canCreate: false,
            reason: `Another audit is in progress (period: ${active.period})`,
        };
    }

    return { canCreate: true };
}

/**
 * Count open audits (counting / review / pending approval), optionally for one outlet.
 * RLS scopes managers to their assigned outlets.
 */
export async function countActiveAudits(outletId?: string): Promise<number> {
    let query = supabase
        .from('inventory_audits')
        .select('id', { count: 'exact', head: true })
        .in('status', ['counting', 'review', 'pending_approval']);
    if (outletId) query = query.eq('outlet_id', outletId);

    const { count, error, status } = await query;
    if (error) throw new Error(countErrorMessage(error, status, 'open audits'));
    return count ?? 0;
}

// ================================================================
// COUNT ENTRY
// ================================================================

/**
 * Update physical count for a line item
 */
export async function updateCount(
    userId: string,
    input: UpdateCountInput
): Promise<AuditLineItem> {
    await assertAuditWriter(userId, 'update counts');

    if (input.physical_quantity !== null && input.physical_quantity < 0) {
        throw new Error('Physical quantity cannot be negative');
    }

    const { data, error } = await supabase
        .from('inventory_audit_line_items')
        .update({
            physical_quantity: input.physical_quantity,
            status: input.physical_quantity === null ? 'pending' : 'counted',
        })
        .eq('id', input.line_item_id)
        .select(LINE_ITEM_SELECT)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Line item not found');

    return mapLineItem(data as LineItemRow);
}

/**
 * Update reason and notes for a variance
 */
export async function updateVarianceReason(
    userId: string,
    input: UpdateReasonInput
): Promise<AuditLineItem> {
    await assertAuditWriter(userId, 'update variance reasons');

    const { data, error } = await supabase
        .from('inventory_audit_line_items')
        .update({
            reason_code: input.reason_code || null,
            notes: input.notes || null,
            // 'reviewed' only once a reason is set; a notes-only edit leaves the status alone
            ...(input.reason_code ? { status: 'reviewed' } : {}),
        })
        .eq('id', input.line_item_id)
        .select(LINE_ITEM_SELECT)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Line item not found');

    return mapLineItem(data as LineItemRow);
}

// ================================================================
// SUBMIT & APPROVAL
// ================================================================

/**
 * Submit audit for approval
 */
export async function submitAudit(
    userId: string,
    auditId: string
): Promise<{
    audit: Audit;
    autoApproved: boolean;
    movementsCreated: number;
}> {
    await assertAuditWriter(userId, 'submit audits');

    const { data, error } = await supabase
        .rpc('submit_inventory_audit', {
            p_audit_id: auditId,
            p_submitted_by: userId,
        });

    if (error) throw new Error(error.message);

    type SubmitRow = { audit_id: string; auto_approved: boolean; movements_created: number };
    const row = (Array.isArray(data) ? data[0] : data) as SubmitRow | null;

    const audit = await getAuditById(userId, auditId);

    return {
        audit,
        autoApproved: row?.auto_approved ?? false,
        movementsCreated: row?.movements_created ?? 0,
    };
}

/**
 * Admin approve or reject audit
 */
export async function approveAudit(
    userId: string,
    auditId: string,
    input: ApproveAuditInput
): Promise<{
    audit: Audit;
    success: boolean;
    movementsCreated: number;
}> {
    const role = await getUserRole(userId);

    if (role !== 'admin') {
        throw new Error('Only admins can approve/reject audits');
    }

    const { data, error } = await supabase
        .rpc('approve_inventory_audit', {
            p_audit_id: auditId,
            p_approved_by: userId,
            p_approved: input.approved,
            p_rejection_reason: input.rejection_reason || null,
        });

    if (error) throw new Error(error.message);

    type ApproveRow = { audit_id: string; success: boolean; movements_created: number };
    const row = (Array.isArray(data) ? data[0] : data) as ApproveRow | null;

    const audit = await getAuditById(userId, auditId);

    return {
        audit,
        success: row?.success ?? true,
        movementsCreated: row?.movements_created ?? 0,
    };
}

/**
 * Cancel an audit (only for draft/counting status)
 */
export async function cancelAudit(
    userId: string,
    auditId: string
): Promise<void> {
    await assertAuditWriter(userId, 'cancel audits');

    // Check audit status
    const audit = await getAuditById(userId, auditId);

    if (!['draft', 'counting', 'review'].includes(audit.status)) {
        throw new Error(`Cannot cancel audit in ${audit.status} status`);
    }

    // Delete the audit (cascade deletes line items)
    const { error } = await supabase
        .from('inventory_audits')
        .delete()
        .eq('id', auditId);

    if (error) throw new Error(error.message);
}

// ================================================================
// AUDIT STATS
// ================================================================

/**
 * Get pending approvals count (for admin dashboard)
 */
export async function getPendingApprovalsCount(outletId?: string): Promise<number> {
    let query = supabase
        .from('inventory_audits')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval');
    if (outletId) query = query.eq('outlet_id', outletId);

    const { count, error, status } = await query;

    if (error) throw new Error(countErrorMessage(error, status, 'pending approvals'));
    return count || 0;
}

// ================================================================
// REASON CODES
// ================================================================

export const AUDIT_REASON_CODES = {
    positive: [
        { code: 'found_stock', label: 'Found Stock', description: 'Previously unaccounted stock found' },
        { code: 'audit_surplus', label: 'Audit Surplus', description: 'Physical count higher than system' },
        { code: 'count_correction', label: 'Count Correction', description: 'Previous count was incorrect' },
    ],
    negative: [
        { code: 'audit_shortage', label: 'Audit Shortage', description: 'Physical count lower than system' },
        { code: 'missing_stock', label: 'Missing Stock', description: 'Stock cannot be located' },
        { code: 'count_correction_negative', label: 'Count Correction', description: 'Previous count was incorrect' },
        { code: 'unrecorded_damage', label: 'Unrecorded Damage', description: 'Damage not previously recorded' },
        { code: 'unrecorded_loss', label: 'Unrecorded Loss', description: 'Loss not previously recorded' },
    ],
};

/**
 * Get reason codes based on variance direction
 */
export function getReasonCodesForVariance(variance: number) {
    if (variance > 0) {
        return AUDIT_REASON_CODES.positive;
    } else if (variance < 0) {
        return AUDIT_REASON_CODES.negative;
    }
    return [];
}

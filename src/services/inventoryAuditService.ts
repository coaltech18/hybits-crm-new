import { supabase } from '@/lib/supabase';

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
    physical_quantity: number;
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
    const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    return data?.role || '';
}

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

    return (data || []).map((row: any) => ({
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
    }));
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

    return {
        id: data.audit_id,
        outlet_id: data.outlet_id,
        outlet_name: data.outlet_name,
        outlet_code: data.outlet_code,
        period: data.period,
        status: data.status,
        items_total: data.items_total,
        items_counted: data.items_counted,
        variance_positive: data.variance_positive,
        variance_negative: data.variance_negative,
        created_by: data.created_by,
        created_by_name: data.created_by_name,
        approved_by: data.approved_by,
        approved_by_name: data.approved_by_name,
        rejection_reason: data.rejection_reason,
        created_at: data.created_at,
        submitted_at: data.submitted_at,
        approved_at: data.approved_at,
        progress_percentage: data.progress_percentage,
        status_label: data.status_label,
    };
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
        .select(`
      *,
      inventory_items:inventory_item_id (
        name,
        category,
        unit
      )
    `)
        .eq('audit_id', auditId)
        .order('created_at');

    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
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
    }));
}

/**
 * Create new audit
 * Uses database function to create audit with line items
 */
export async function createAudit(
    userId: string,
    input: CreateAuditInput
): Promise<{ audit: Audit; lineItems: AuditLineItem[] }> {
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot create audits');
    }

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
    // Check if audit already exists
    const { data: existing } = await supabase
        .from('inventory_audits')
        .select('id, status')
        .eq('outlet_id', outletId)
        .eq('period', period)
        .maybeSingle();

    if (existing) {
        return {
            canCreate: false,
            reason: `Audit already exists for this period (status: ${existing.status})`,
        };
    }

    // Check if there's an active audit
    const { data: active } = await supabase
        .from('inventory_audits')
        .select('id, period')
        .eq('outlet_id', outletId)
        .in('status', ['counting', 'review', 'pending_approval'])
        .maybeSingle();

    if (active) {
        return {
            canCreate: false,
            reason: `Another audit is in progress (period: ${active.period})`,
        };
    }

    return { canCreate: true };
}

/**
 * Check if there's an active audit for an outlet
 */
export async function hasActiveAudit(outletId: string): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('check_active_audit', { p_outlet_id: outletId });

    if (error) return false;
    return data as boolean;
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
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot update counts');
    }

    if (input.physical_quantity < 0) {
        throw new Error('Physical quantity cannot be negative');
    }

    const { data, error } = await supabase
        .from('inventory_audit_line_items')
        .update({
            physical_quantity: input.physical_quantity,
            status: 'counted',
        })
        .eq('id', input.line_item_id)
        .select(`
      *,
      inventory_items:inventory_item_id (
        name,
        category,
        unit
      )
    `)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Line item not found');

    return {
        id: data.id,
        audit_id: data.audit_id,
        inventory_item_id: data.inventory_item_id,
        item_name: data.inventory_items?.name,
        item_category: data.inventory_items?.category,
        item_unit: data.inventory_items?.unit,
        system_quantity: data.system_quantity,
        physical_quantity: data.physical_quantity,
        variance: data.variance,
        reason_code: data.reason_code,
        notes: data.notes,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };
}

/**
 * Update multiple counts at once
 */
export async function updateCounts(
    userId: string,
    inputs: UpdateCountInput[]
): Promise<void> {
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot update counts');
    }

    // Update each count
    for (const input of inputs) {
        if (input.physical_quantity < 0) {
            throw new Error('Physical quantity cannot be negative');
        }

        const { error } = await supabase
            .from('inventory_audit_line_items')
            .update({
                physical_quantity: input.physical_quantity,
                status: 'counted',
            })
            .eq('id', input.line_item_id);

        if (error) throw new Error(error.message);
    }
}

/**
 * Update reason and notes for a variance
 */
export async function updateVarianceReason(
    userId: string,
    input: UpdateReasonInput
): Promise<AuditLineItem> {
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot update variance reasons');
    }

    if (!input.reason_code) {
        throw new Error('Reason code is required');
    }

    const { data, error } = await supabase
        .from('inventory_audit_line_items')
        .update({
            reason_code: input.reason_code,
            notes: input.notes,
            status: 'reviewed',
        })
        .eq('id', input.line_item_id)
        .select(`
      *,
      inventory_items:inventory_item_id (
        name,
        category,
        unit
      )
    `)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Line item not found');

    return {
        id: data.id,
        audit_id: data.audit_id,
        inventory_item_id: data.inventory_item_id,
        item_name: data.inventory_items?.name,
        item_category: data.inventory_items?.category,
        item_unit: data.inventory_items?.unit,
        system_quantity: data.system_quantity,
        physical_quantity: data.physical_quantity,
        variance: data.variance,
        reason_code: data.reason_code,
        notes: data.notes,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };
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
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot submit audits');
    }

    const { data, error } = await supabase
        .rpc('submit_inventory_audit', {
            p_audit_id: auditId,
            p_submitted_by: userId,
        });

    if (error) throw new Error(error.message);

    const result = data as any[];
    const row = result?.[0] || data;

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

    const result = data as any[];
    const row = result?.[0] || data;

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
    const role = await getUserRole(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot cancel audits');
    }

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
export async function getPendingApprovalsCount(
    _userId: string
): Promise<number> {
    const { count, error } = await supabase
        .from('inventory_audits')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval');

    if (error) return 0;
    return count || 0;
}

/**
 * Get audits pending approval
 */
export async function getPendingApprovals(
    userId: string
): Promise<Audit[]> {
    return getAudits(userId, { status: 'pending_approval' });
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

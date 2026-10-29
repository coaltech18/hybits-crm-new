// ================================================================
// INVENTORY INTEGRATION HOOKS (REMOVED)
// ================================================================
// This module used to hold subscription/event lifecycle hooks that were
// never wired up. They double-counted allocations (movement trigger plus a
// direct allocation write), auto-returned stock as "good" under the record
// creator's id, and referenced tables that do not exist.
//
// Inventory now follows the ledger: every change is an inventory_movements
// row, and the DB trigger sync_allocation_on_movement keeps
// inventory_allocations in step. Cancelling an event with dishware still
// out is blocked (eventService.cancelEvent and the 042 lifecycle trigger).
//
// Nothing imports this file; it is safe to delete.
// ================================================================

export {};

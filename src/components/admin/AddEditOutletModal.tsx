import { useState, useEffect } from 'react';
import type { OutletDetails } from '@/services/adminOutletService';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

// ================================================================
// ADD / EDIT OUTLET MODAL
// ================================================================
// Modal for creating or editing outlets
// ================================================================

interface AddEditOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OutletFormData) => Promise<void>;
  /** Full outlet row (phone/email included) so editing never blanks them. */
  outlet?: OutletDetails | null;
  mode: 'create' | 'edit';
}

export interface OutletFormData {
  name: string;
  code: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function AddEditOutletModal({
  isOpen,
  onClose,
  onSubmit,
  outlet,
  mode,
}: AddEditOutletModalProps) {
  const [formData, setFormData] = useState<OutletFormData>({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && outlet && mode === 'edit') {
      setFormData({
        name: outlet.name,
        code: outlet.code,
        city: outlet.city || '',
        address: outlet.address || '',
        phone: outlet.phone || '',
        email: outlet.email || '',
      });
    } else if (isOpen && mode === 'create') {
      setFormData({
        name: '',
        code: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
    }
    setError(null);
  }, [isOpen, outlet, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.code || !formData.city) {
      setError('Name, code, and city are required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add outlet' : 'Edit outlet'}
      description={
        mode === 'create'
          ? 'A new branch. Clients, invoices and stock are kept per outlet.'
          : `Outlet ${outlet?.code ?? ''}`.trim()
      }
      maxWidth="2xl"
      dismissable={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="Outlet name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isSubmitting}
              required
            />
          </div>

          <Input
            label="Outlet code"
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            disabled={mode === 'edit' || isSubmitting}
            className="serial uppercase"
            placeholder="e.g. MUM01, DEL01"
            helperText={mode === 'edit' ? 'The code cannot be changed.' : 'Short and unique. Printed on records.'}
            required
          />

          <Input
            label="City"
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={isSubmitting}
            required
          />

          <div className="md:col-span-2">
            <Textarea
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={isSubmitting}
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-rule pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create outlet' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

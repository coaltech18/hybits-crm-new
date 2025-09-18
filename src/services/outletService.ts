// ============================================================================
// OUTLET SERVICE
// ============================================================================

import { Outlet, OutletFormData } from '@/types';

// Mock outlet data
const mockOutlets: Outlet[] = [
  {
    id: '1',
    code: 'HYB001',
    name: 'Hybits Central Mall',
    address: {
      street: '123 Central Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India'
    },
    contact_person: 'Priya Sharma',
    contact_phone: '+91 98765 43210',
    contact_email: 'manager@hybits.in',
    manager_id: '2',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    code: 'HYB002',
    name: 'Hybits Phoenix MarketCity',
    address: {
      street: '456 Phoenix Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400002',
      country: 'India'
    },
    contact_person: 'Amit Patel',
    contact_phone: '+91 87654 32109',
    contact_email: 'amit.patel@hybits.in',
    manager_id: '3',
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-14T09:15:00Z'
  },
  {
    id: '3',
    code: 'HYB003',
    name: 'Hybits Inorbit Mall',
    address: {
      street: '789 Inorbit Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400003',
      country: 'India'
    },
    contact_person: 'Sneha Reddy',
    contact_phone: '+91 76543 21098',
    contact_email: 'sneha.reddy@hybits.in',
    manager_id: '4',
    is_active: true,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-13T14:20:00Z'
  }
];

class OutletService {
  // Get all outlets (admin only)
  static async getAllOutlets(): Promise<Outlet[]> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...mockOutlets];
  }

  // Get outlet by ID
  static async getOutletById(id: string): Promise<Outlet | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockOutlets.find(outlet => outlet.id === id) || null;
  }

  // Get outlets accessible to user
  static async getUserOutlets(userRole: string, userOutletId?: string): Promise<Outlet[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (userRole === 'admin') {
      return [...mockOutlets];
    }
    
    if (userRole === 'manager' && userOutletId) {
      return mockOutlets.filter(outlet => outlet.id === userOutletId);
    }
    
    return [];
  }

  // Create new outlet (admin only)
  static async createOutlet(outletData: OutletFormData): Promise<Outlet> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newOutlet: Outlet = {
      id: Date.now().toString(),
      ...outletData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockOutlets.push(newOutlet);
    return newOutlet;
  }

  // Update outlet (admin only)
  static async updateOutlet(id: string, updates: Partial<OutletFormData>): Promise<Outlet> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const outletIndex = mockOutlets.findIndex(outlet => outlet.id === id);
    if (outletIndex === -1) {
      throw new Error('Outlet not found');
    }
    
    mockOutlets[outletIndex] = {
      ...mockOutlets[outletIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    return mockOutlets[outletIndex];
  }

  // Delete outlet (admin only)
  static async deleteOutlet(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const outletIndex = mockOutlets.findIndex(outlet => outlet.id === id);
    if (outletIndex === -1) {
      throw new Error('Outlet not found');
    }
    
    mockOutlets.splice(outletIndex, 1);
  }

  // Get outlet statistics
  static async getOutletStats(outletId: string): Promise<{
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    activeInventory: number;
  }> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Mock statistics
    return {
      totalCustomers: Math.floor(Math.random() * 500) + 100,
      totalOrders: Math.floor(Math.random() * 200) + 50,
      totalRevenue: Math.floor(Math.random() * 1000000) + 100000,
      activeInventory: Math.floor(Math.random() * 1000) + 200
    };
  }
}

export default OutletService;

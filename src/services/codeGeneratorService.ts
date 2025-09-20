// ============================================================================
// CODE GENERATOR SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export type EntityType = 
  | 'customer'
  | 'inventory_item'
  | 'order'
  | 'invoice'
  | 'location'
  | 'outlet'
  | 'user';

export interface CodeGenerationConfig {
  prefix: string;
  length: number;
  includeYear?: boolean;
  includeMonth?: boolean;
  separator?: string;
}

const CODE_CONFIGS: Record<EntityType, CodeGenerationConfig> = {
  customer: {
    prefix: 'CUST',
    length: 6,
    includeYear: true,
    separator: '-'
  },
  inventory_item: {
    prefix: 'ITEM',
    length: 6,
    includeYear: true,
    separator: '-'
  },
  order: {
    prefix: 'ORD',
    length: 6,
    includeYear: true,
    includeMonth: true,
    separator: '-'
  },
  invoice: {
    prefix: 'INV',
    length: 6,
    includeYear: true,
    includeMonth: true,
    separator: '-'
  },
  location: {
    prefix: 'LOC',
    length: 4,
    includeYear: false,
    separator: '-'
  },
  outlet: {
    prefix: 'OUT',
    length: 4,
    includeYear: false,
    separator: '-'
  },
  user: {
    prefix: 'USR',
    length: 4,
    includeYear: false,
    separator: '-'
  }
};

export class CodeGeneratorService {
  /**
   * Generate a unique code for any entity type
   */
  static async generateCode(entityType: EntityType): Promise<string> {
    try {
      const config = CODE_CONFIGS[entityType];
      const tableName = this.getTableName(entityType);
      const codeField = this.getCodeField(entityType);

      // Get the latest code from database
      const { data, error } = await supabase
        .from(tableName)
        .select(codeField)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Error fetching latest ${entityType} code:`, error);
        // Fallback to timestamp-based code
        return this.generateFallbackCode(config);
      }

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = (data[0] as any)?.[codeField];
        const extractedNumber = this.extractNumberFromCode(lastCode, config);
        if (extractedNumber !== null) {
          nextNumber = extractedNumber + 1;
        }
      }

      return this.formatCode(config, nextNumber);
    } catch (error) {
      console.error(`Error generating ${entityType} code:`, error);
      const config = CODE_CONFIGS[entityType];
      return this.generateFallbackCode(config);
    }
  }

  /**
   * Generate multiple codes at once
   */
  static async generateMultipleCodes(entityType: EntityType, count: number): Promise<string[]> {
    const codes: string[] = [];
    const config = CODE_CONFIGS[entityType];
    const tableName = this.getTableName(entityType);
    const codeField = this.getCodeField(entityType);

    try {
      // Get the latest code from database
      const { data, error } = await supabase
        .from(tableName)
        .select(codeField)
        .order('created_at', { ascending: false })
        .limit(1);

      let startNumber = 1;
      if (!error && data && data.length > 0) {
        const lastCode = (data[0] as any)?.[codeField];
        const extractedNumber = this.extractNumberFromCode(lastCode, config);
        if (extractedNumber !== null) {
          startNumber = extractedNumber + 1;
        }
      }

      // Generate sequential codes
      for (let i = 0; i < count; i++) {
        codes.push(this.formatCode(config, startNumber + i));
      }

      return codes;
    } catch (error) {
      console.error(`Error generating multiple ${entityType} codes:`, error);
      // Fallback to timestamp-based codes
      for (let i = 0; i < count; i++) {
        codes.push(this.generateFallbackCode(config));
      }
      return codes;
    }
  }

  /**
   * Validate if a code follows the correct format
   */
  static validateCode(code: string, entityType: EntityType): boolean {
    const config = CODE_CONFIGS[entityType];
    const pattern = this.buildValidationPattern(config);
    return pattern.test(code);
  }

  /**
   * Get the next code without saving to database (for preview)
   */
  static async getNextCode(entityType: EntityType): Promise<string> {
    return this.generateCode(entityType);
  }

  /**
   * Private helper methods
   */
  private static getTableName(entityType: EntityType): string {
    const tableMap: Record<EntityType, string> = {
      customer: 'customers',
      inventory_item: 'inventory_items',
      order: 'rental_orders',
      invoice: 'invoices',
      location: 'locations',
      outlet: 'outlets',
      user: 'user_profiles'
    };
    return tableMap[entityType];
  }

  private static getCodeField(entityType: EntityType): string {
    const fieldMap: Record<EntityType, string> = {
      customer: 'customer_code',
      inventory_item: 'item_code',
      order: 'order_number',
      invoice: 'invoice_number',
      location: 'location_code',
      outlet: 'outlet_code',
      user: 'user_code'
    };
    return fieldMap[entityType];
  }

  private static formatCode(config: CodeGenerationConfig, number: number): string {
    const parts: string[] = [config.prefix];

    // Add year if configured
    if (config.includeYear) {
      parts.push(new Date().getFullYear().toString());
    }

    // Add month if configured
    if (config.includeMonth) {
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      parts.push(month);
    }

    // Add sequential number
    const paddedNumber = number.toString().padStart(config.length, '0');
    parts.push(paddedNumber);

    return parts.join(config.separator || '-');
  }

  private static extractNumberFromCode(code: string, config: CodeGenerationConfig): number | null {
    try {
      // Build regex pattern to extract the number
      const parts = [config.prefix];
      
      if (config.includeYear) {
        parts.push('\\d{4}');
      }
      
      if (config.includeMonth) {
        parts.push('\\d{2}');
      }
      
      parts.push(`(\\d{${config.length}})`);
      
      const pattern = new RegExp(`^${parts.join(config.separator || '-')}$`);
      const match = code.match(pattern);
      
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting number from code:', error);
      return null;
    }
  }

  private static buildValidationPattern(config: CodeGenerationConfig): RegExp {
    const parts = [config.prefix];
    
    if (config.includeYear) {
      parts.push('\\d{4}');
    }
    
    if (config.includeMonth) {
      parts.push('\\d{2}');
    }
    
    parts.push(`\\d{${config.length}}`);
    
    return new RegExp(`^${parts.join(config.separator || '-')}$`);
  }

  private static generateFallbackCode(config: CodeGenerationConfig): string {
    const timestamp = Date.now().toString().slice(-config.length);
    return this.formatCode(config, parseInt(timestamp, 10));
  }
}

// ============================================================================
// CODE FORMAT EXAMPLES
// ============================================================================

/*
Customer Codes:     CUST-2024-000001, CUST-2024-000002, ...
Inventory Codes:    ITEM-2024-000001, ITEM-2024-000002, ...
Order Codes:        ORD-2024-01-000001, ORD-2024-01-000002, ...
Invoice Codes:      INV-2024-01-000001, INV-2024-01-000002, ...
Location Codes:     LOC-0001, LOC-0002, ...
Outlet Codes:       OUT-0001, OUT-0002, ...
User Codes:         USR-0001, USR-0002, ...
*/

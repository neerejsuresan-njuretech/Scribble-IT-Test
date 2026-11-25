import { Asset, CmdbRelation, InventoryItem, SoftwareLicense } from '../../types/itsm';
import { apiRequest, PaginatedDto } from './httpClient';

export interface AssetDto {
  id: string;
  organization_id: string;
  asset_tag: string;
  name: string;
  asset_type: Asset['type'];
  serial_number: string;
  mac_address: string | null;
  ip_address: string | null;
  sync_source: 'manual' | 'vcenter' | 'intune';
  model: string;
  manufacturer: string;
  status: Asset['status'];
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  department: string | null;
  location: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  purchase_cost: string | number;
  current_book_value: string | number;
  qr_code_data: string;
}

export interface CmdbRelationDto {
  id: string;
  organization_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relation_type: CmdbRelation['relationType'];
  criticality: CmdbRelation['criticality'];
}

export interface InventoryItemDto {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  category: InventoryItem['category'];
  quantity: number;
  min_threshold: number;
  unit_cost: string | number;
  location: string;
  last_restocked_at: string | null;
}

export interface SoftwareLicenseDto {
  id: string;
  organization_id: string;
  name: string;
  vendor: string;
  version: string;
  license_type: SoftwareLicense['licenseType'];
  total_seats: number;
  used_seats: number;
  annual_cost: string | number;
  renewal_date: string | null;
  source: SoftwareLicense['source'];
  compliance_status: SoftwareLicense['complianceStatus'];
}

export function mapAssetDto(dto: AssetDto): Asset {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    assetTag: dto.asset_tag,
    name: dto.name,
    type: dto.asset_type,
    serialNumber: dto.serial_number,
    macAddress: dto.mac_address || undefined,
    ipAddress: dto.ip_address || undefined,
    syncSource: dto.sync_source,
    model: dto.model,
    manufacturer: dto.manufacturer,
    status: dto.status,
    assignedTo: dto.assigned_to_name || undefined,
    department: dto.department || undefined,
    location: dto.location,
    purchaseDate: dto.purchase_date || '',
    warrantyExpiry: dto.warranty_expiry || '',
    purchaseCost: Number(dto.purchase_cost || 0),
    currentBookValue: Number(dto.current_book_value || 0),
    qrCodeData: dto.qr_code_data,
  };
}

export function mapCmdbRelationDto(dto: CmdbRelationDto): CmdbRelation {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    sourceId: dto.source_asset_id,
    targetId: dto.target_asset_id,
    relationType: dto.relation_type,
    criticality: dto.criticality,
  };
}

export function mapInventoryItemDto(dto: InventoryItemDto): InventoryItem {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    sku: dto.sku,
    name: dto.name,
    category: dto.category,
    quantity: dto.quantity,
    minThreshold: dto.min_threshold,
    unitCost: Number(dto.unit_cost || 0),
    location: dto.location,
    lastRestocked: dto.last_restocked_at || new Date().toISOString(),
  };
}

export function mapSoftwareLicenseDto(dto: SoftwareLicenseDto): SoftwareLicense {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    name: dto.name,
    vendor: dto.vendor,
    version: dto.version,
    licenseType: dto.license_type,
    totalSeats: dto.total_seats,
    usedSeats: dto.used_seats,
    annualCost: Number(dto.annual_cost || 0),
    renewalDate: dto.renewal_date || '',
    source: dto.source,
    complianceStatus: dto.compliance_status,
  };
}

export const cmdbApi = {
  async listAssets(params?: {
    status?: string;
    asset_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedDto<AssetDto>> {
    return apiRequest<PaginatedDto<AssetDto>>('/assets', { query: params });
  },

  async createAsset(payload: {
    asset_tag: string;
    name: string;
    asset_type?: string;
    serial_number: string;
    model?: string;
    manufacturer?: string;
    location?: string;
    status?: Asset['status'];
    assigned_to_name?: string;
    purchase_cost?: number;
    current_book_value?: number;
  }): Promise<AssetDto> {
    return apiRequest<AssetDto>('/assets', { method: 'POST', body: payload });
  },

  async assignAsset(
    id: string,
    payload: { assigned_to_user_id?: string; assigned_to_name?: string; department?: string; status?: Asset['status'] }
  ): Promise<AssetDto> {
    return apiRequest<AssetDto>(`/assets/${id}/assign`, { method: 'POST', body: payload });
  },

  async listCmdbRelations(): Promise<CmdbRelationDto[]> {
    return apiRequest<CmdbRelationDto[]>('/cmdb/relations');
  },

  async createCmdbRelation(payload: {
    source_asset_id: string;
    target_asset_id: string;
    relation_type: CmdbRelation['relationType'];
    criticality?: CmdbRelation['criticality'];
  }): Promise<CmdbRelationDto> {
    return apiRequest<CmdbRelationDto>('/cmdb/relations', { method: 'POST', body: payload });
  },

  async deleteCmdbRelation(id: string): Promise<void> {
    return apiRequest<void>(`/cmdb/relations/${id}`, { method: 'DELETE' });
  },

  async listInventory(lowStockOnly = false): Promise<InventoryItemDto[]> {
    return apiRequest<InventoryItemDto[]>('/inventory', { query: { low_stock_only: lowStockOnly } });
  },

  async createInventoryItem(payload: {
    sku: string;
    name: string;
    category?: string;
    quantity?: number;
    min_threshold?: number;
    unit_cost?: number;
    location?: string;
  }): Promise<InventoryItemDto> {
    return apiRequest<InventoryItemDto>('/inventory', { method: 'POST', body: payload });
  },

  async adjustInventory(id: string, delta: number, reason?: string): Promise<InventoryItemDto> {
    return apiRequest<InventoryItemDto>(`/inventory/${id}/adjust`, {
      method: 'POST',
      body: { delta, reason: reason || 'Stock adjustment' },
    });
  },

  async listSoftwareLicenses(): Promise<SoftwareLicenseDto[]> {
    return apiRequest<SoftwareLicenseDto[]>('/software-licenses');
  },

  async createSoftwareLicense(payload: {
    name: string;
    vendor: string;
    version?: string;
    license_type?: SoftwareLicense['licenseType'];
    total_seats: number;
    used_seats?: number;
    annual_cost?: number;
  }): Promise<SoftwareLicenseDto> {
    return apiRequest<SoftwareLicenseDto>('/software-licenses', { method: 'POST', body: payload });
  },

  async adjustSoftwareSeats(id: string, delta: number): Promise<SoftwareLicenseDto> {
    return apiRequest<SoftwareLicenseDto>(`/software-licenses/${id}/adjust-seats`, {
      method: 'POST',
      body: { delta },
    });
  },
};

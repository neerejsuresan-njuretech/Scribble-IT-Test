import type {
  Asset,
  AssetDto,
  CmdbRelation,
  CmdbRelationDto,
  InventoryItem,
  InventoryItemDto,
  PaginatedDto,
  SoftwareLicense,
  SoftwareLicenseDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type { AssetDto, CmdbRelationDto, InventoryItemDto, SoftwareLicenseDto };

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

export function createCmdbApi(http: ScribbleHttpClient) {
  return {
    async listAssets(params?: {
      status?: string;
      asset_type?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedDto<AssetDto>> {
      return http.request<PaginatedDto<AssetDto>>('/assets', { query: params });
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
      return http.request<AssetDto>('/assets', { method: 'POST', body: payload });
    },

    async assignAsset(
      id: string,
      payload: {
        assigned_to_user_id?: string;
        assigned_to_name?: string;
        department?: string;
        status?: Asset['status'];
      },
    ): Promise<AssetDto> {
      return http.request<AssetDto>(`/assets/${id}/assign`, { method: 'POST', body: payload });
    },

    async listCmdbRelations(): Promise<CmdbRelationDto[]> {
      return http.request<CmdbRelationDto[]>('/cmdb/relations');
    },

    async createCmdbRelation(payload: {
      source_asset_id: string;
      target_asset_id: string;
      relation_type: CmdbRelation['relationType'];
      criticality?: CmdbRelation['criticality'];
    }): Promise<CmdbRelationDto> {
      return http.request<CmdbRelationDto>('/cmdb/relations', { method: 'POST', body: payload });
    },

    async deleteCmdbRelation(id: string): Promise<void> {
      return http.request<void>(`/cmdb/relations/${id}`, { method: 'DELETE' });
    },

    async listInventory(lowStockOnly = false): Promise<InventoryItemDto[]> {
      return http.request<InventoryItemDto[]>('/inventory', {
        query: { low_stock_only: lowStockOnly },
      });
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
      return http.request<InventoryItemDto>('/inventory', { method: 'POST', body: payload });
    },

    async adjustInventory(
      id: string,
      delta: number,
      reason?: string,
    ): Promise<InventoryItemDto> {
      return http.request<InventoryItemDto>(`/inventory/${id}/adjust`, {
        method: 'POST',
        body: { delta, reason: reason || 'Stock adjustment' },
      });
    },

    async listSoftwareLicenses(): Promise<SoftwareLicenseDto[]> {
      return http.request<SoftwareLicenseDto[]>('/software-licenses');
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
      return http.request<SoftwareLicenseDto>('/software-licenses', {
        method: 'POST',
        body: payload,
      });
    },

    async adjustSoftwareSeats(id: string, delta: number): Promise<SoftwareLicenseDto> {
      return http.request<SoftwareLicenseDto>(`/software-licenses/${id}/adjust-seats`, {
        method: 'POST',
        body: { delta },
      });
    },
  };
}

export const cmdbApi = createCmdbApi(defaultHttpClient);

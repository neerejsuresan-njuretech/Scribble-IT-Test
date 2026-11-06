export type Role = 'admin' | 'technician' | 'customer';

export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type IncidentCategory = 'hardware' | 'software' | 'network' | 'security' | 'access' | 'telephony';

export type ActivityType = 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  author: string;
  type?: ActivityType;
  action: string;
  note: string;
  fieldChanges?: FieldChange[];
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  urgency: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  category: IncidentCategory;
  requesterName: string;
  requesterEmail: string;
  assignee: string;
  affectedCI?: string;
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
  resolutionNotes?: string;
  activityLog: ActivityEntry[];
}

export type RequestStatus = 'submitted' | 'manager_approved' | 'security_review' | 'fulfillment' | 'completed' | 'rejected';

export interface RequestApproval {
  role: string;
  approver: string;
  status: 'approved' | 'pending' | 'rejected';
  timestamp?: string;
  notes?: string;
}

export interface ServiceRequest {
  id: string;
  catalogItemId: string;
  catalogItemName: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  cost: number;
  status: RequestStatus;
  currentStage: number; // 1 to 4
  approvals: RequestApproval[];
  deliveryEstimateDays: number;
  deliveryDate?: string;
  createdAt: string;
}

export type ProblemStatus = 'investigating' | 'root_cause_identified' | 'workaround_published' | 'change_requested' | 'closed';

export interface Problem {
  id: string;
  title: string;
  description: string;
  status: ProblemStatus;
  severity: 'critical' | 'high' | 'moderate' | 'minor';
  rootCauseAnalysis: string;
  workaround: string;
  permanentSolution: string;
  linkedIncidentIds: string[];
  linkedChangeId?: string;
  owner: string;
  isKnownError: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChangeType = 'standard' | 'normal' | 'emergency';
export type ChangeStatus = 'draft' | 'cab_review' | 'scheduled' | 'implementation' | 'verification' | 'completed' | 'cancelled';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CabVote {
  member: string;
  role: string;
  vote: 'approved' | 'rejected' | 'pending';
  notes?: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  type: ChangeType;
  status: ChangeStatus;
  riskScore: RiskLevel;
  reason: string;
  implementationPlan: string;
  rollbackPlan: string;
  testPlan: string;
  scheduledStart: string;
  scheduledEnd: string;
  cabVotes: CabVote[];
  requestedBy: string;
  assignedEngineer: string;
  createdAt: string;
  updatedAt?: string;
  activityLog?: ActivityEntry[];
}

export type AssetType = 'laptop' | 'server' | 'networking' | 'workstation' | 'mobile' | 'security_key' | 'monitor';
export type AssetStatus = 'in_use' | 'in_stock' | 'maintenance' | 'retired';

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  type: AssetType;
  serialNumber: string;
  macAddress?: string;
  model: string;
  manufacturer: string;
  status: AssetStatus;
  assignedTo?: string;
  department?: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  purchaseCost: number;
  currentBookValue: number;
  qrCodeData: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'peripherals' | 'cabling' | 'components' | 'storage' | 'accessories';
  quantity: number;
  minThreshold: number;
  unitCost: number;
  location: string;
  lastRestocked: string;
}

export interface TelephonyCall {
  id: string;
  callerNumber: string;
  callerName: string;
  callerCompany: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'active' | 'held' | 'completed' | 'missed';
  startTime: string;
  durationSec: number;
  liveTranscript: string[];
  relatedTicketId?: string;
  disposition?: 'incident_logged' | 'inquiry_resolved' | 'escalated' | 'voicemail';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  customerName: string;
  customerEmail: string;
  organization: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'overdue';
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: 'credit_card' | 'wire_ach' | 'purchase_order' | 'stripe';
  lineItems: InvoiceItem[];
  notes?: string;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: 'hardware' | 'software' | 'access' | 'cloud' | 'telephony';
  price: number;
  estimatedHours: number;
  requiresApproval: boolean;
  tags: string[];
}

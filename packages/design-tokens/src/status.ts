import { BRAND_COLORS } from './colors';

export interface StatusColorPair {
  label: string;
  light: { bg: string; text: string; border: string; dot: string };
  dark: { bg: string; text: string; border: string; dot: string };
}

/** Incident Priority Colors (P1 Critical -> P4 Low) */
export const INCIDENT_PRIORITY_TOKENS: Record<'P1' | 'P2' | 'P3' | 'P4', StatusColorPair> = {
  P1: {
    label: 'P1 Critical',
    light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#E11D48' },
    dark: { bg: '#3B0A16', text: '#FDA4AF', border: '#881337', dot: '#FB7185' },
  },
  P2: {
    label: 'P2 High',
    light: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#EA580C' },
    dark: { bg: '#3B1A08', text: '#FDBA74', border: '#7C2D12', dot: '#FB923C' },
  },
  P3: {
    label: 'P3 Moderate',
    light: { bg: '#EEF6FF', text: '#0054B8', border: '#B5DCFF', dot: BRAND_COLORS.njureBlue },
    dark: { bg: '#092347', text: '#82C5FF', border: '#054491', dot: BRAND_COLORS.njureBlue },
  },
  P4: {
    label: 'P4 Low',
    light: { bg: '#F5F8FF', text: '#374E70', border: '#D4DFEE', dot: '#556E94' },
    dark: { bg: '#132744', text: '#B0C2DC', border: '#213554', dot: '#7D95B8' },
  },
};

export type SlaStatusKey = 'on_track' | 'at_risk' | 'paused' | 'breached' | 'met';

/** SLA Lifecycle Status Colors */
export const SLA_STATUS_TOKENS: Record<SlaStatusKey, StatusColorPair> = {
  on_track: {
    label: 'On Track',
    light: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981' },
    dark: { bg: '#052E1E', text: '#6EE7B7', border: '#065F46', dot: '#34D399' },
  },
  at_risk: {
    label: 'At Risk',
    light: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', dot: '#F59E0B' },
    dark: { bg: '#3B2305', text: '#FCD34D', border: '#78350F', dot: '#FBBF24' },
  },
  paused: {
    label: 'Paused',
    light: { bg: '#F5F8FF', text: '#374E70', border: '#D4DFEE', dot: '#64748B' },
    dark: { bg: '#132744', text: '#B0C2DC', border: '#213554', dot: '#94A3B8' },
  },
  breached: {
    label: 'SLA Breached',
    light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#EF4444' },
    dark: { bg: '#3B0A11', text: '#FCA5A5', border: '#7F1D1D', dot: '#F87171' },
  },
  met: {
    label: 'SLA Met',
    light: { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC', dot: '#06B6D4' },
    dark: { bg: '#083344', text: '#67E8F9', border: '#155E75', dot: BRAND_COLORS.accentCyan },
  },
};

export type EnterpriseStatusKey =
  | 'operational'
  | 'degraded'
  | 'outage'
  | 'open'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'resolved'
  | 'closed'
  | 'compliant'
  | 'non_compliant';

/** Enterprise Operational, Approval, CMDB & Compliance Status Colors */
export const ENTERPRISE_STATUS_TOKENS: Record<EnterpriseStatusKey, StatusColorPair> = {
  operational: {
    label: 'Operational',
    light: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981' },
    dark: { bg: '#052E1E', text: '#6EE7B7', border: '#065F46', dot: '#34D399' },
  },
  degraded: {
    label: 'Degraded',
    light: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', dot: '#F59E0B' },
    dark: { bg: '#3B2305', text: '#FCD34D', border: '#78350F', dot: '#FBBF24' },
  },
  outage: {
    label: 'Outage',
    light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#EF4444' },
    dark: { bg: '#3B0A11', text: '#FCA5A5', border: '#7F1D1D', dot: '#F87171' },
  },
  open: {
    label: 'Open',
    light: { bg: '#EEF6FF', text: '#0054B8', border: '#B5DCFF', dot: BRAND_COLORS.njureBlue },
    dark: { bg: '#092347', text: '#82C5FF', border: '#054491', dot: BRAND_COLORS.njureBlue },
  },
  in_progress: {
    label: 'In Progress',
    light: { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC', dot: '#06B6D4' },
    dark: { bg: '#083344', text: '#67E8F9', border: '#155E75', dot: BRAND_COLORS.accentCyan },
  },
  pending_approval: {
    label: 'Pending Approval',
    light: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', dot: '#F59E0B' },
    dark: { bg: '#3B2305', text: '#FCD34D', border: '#78350F', dot: '#FBBF24' },
  },
  approved: {
    label: 'Approved',
    light: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981' },
    dark: { bg: '#052E1E', text: '#6EE7B7', border: '#065F46', dot: '#34D399' },
  },
  rejected: {
    label: 'Rejected',
    light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#EF4444' },
    dark: { bg: '#3B0A11', text: '#FCA5A5', border: '#7F1D1D', dot: '#F87171' },
  },
  resolved: {
    label: 'Resolved',
    light: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981' },
    dark: { bg: '#052E1E', text: '#6EE7B7', border: '#065F46', dot: '#34D399' },
  },
  closed: {
    label: 'Closed',
    light: { bg: '#F5F8FF', text: '#374E70', border: '#D4DFEE', dot: '#556E94' },
    dark: { bg: '#132744', text: '#B0C2DC', border: '#213554', dot: '#7D95B8' },
  },
  compliant: {
    label: 'Compliant',
    light: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', dot: '#10B981' },
    dark: { bg: '#052E1E', text: '#6EE7B7', border: '#065F46', dot: '#34D399' },
  },
  non_compliant: {
    label: 'Non-Compliant',
    light: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#EF4444' },
    dark: { bg: '#3B0A11', text: '#FCA5A5', border: '#7F1D1D', dot: '#F87171' },
  },
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Incident, ServiceRequest, Problem, ChangeRequest, Asset,
  InventoryItem, TelephonyCall, Invoice, Role, IncidentStatus,
  IncidentPriority, ChangeStatus
} from '../types/itsm';
import {
  INITIAL_INCIDENTS, INITIAL_REQUESTS, INITIAL_PROBLEMS,
  INITIAL_CHANGES, INITIAL_ASSETS, INITIAL_INVENTORY,
  INITIAL_CALLS, INITIAL_INVOICES
} from '../data/seedData';
import { auth, db, googleSignIn, logout as firebaseLogout, initAuth, getAccessToken } from '../lib/firebase';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface ITSMContextType {
  role: Role;
  setRole: (role: Role) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: { name: string; email: string; department: string; phone: string };
  // Google Auth & Workspace
  googleUser: User | null;
  googleToken: string | null;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  isFirebaseConnected: boolean;
  // Core Records
  incidents: Incident[];
  requests: ServiceRequest[];
  problems: Problem[];
  changes: ChangeRequest[];
  assets: Asset[];
  inventory: InventoryItem[];
  calls: TelephonyCall[];
  invoices: Invoice[];
  activeCall: TelephonyCall | null;
  // CRUD & Operations
  createIncident: (incident: Partial<Incident>) => Incident;
  updateIncidentStatus: (id: string, status: IncidentStatus, note?: string, resolutionNotes?: string, isWorkNote?: boolean) => void;
  assignIncident: (id: string, assignee: string) => void;
  createServiceRequest: (req: Partial<ServiceRequest>) => ServiceRequest;
  approveRequestStage: (requestId: string, roleName: string, approver: string, status: 'approved' | 'rejected', notes?: string) => void;
  createProblem: (prob: Partial<Problem>) => Problem;
  updateProblem: (id: string, updates: Partial<Problem>) => void;
  createChangeRequest: (change: Partial<ChangeRequest>) => ChangeRequest;
  voteCab: (changeId: string, member: string, roleName: string, vote: 'approved' | 'rejected', notes?: string) => void;
  updateChangeStatus: (id: string, status: ChangeStatus) => void;
  addRecordActivity: (recordId: string, recordType: 'incident' | 'change', note: string, type: 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit', action?: string, fieldChanges?: { field: string; from: string; to: string }[]) => void;
  createAsset: (asset: Partial<Asset>) => Asset;
  updateAssetStatus: (id: string, status: Asset['status'], assignedTo?: string) => void;
  updateInventoryQuantity: (id: string, delta: number) => void;
  createInventoryItem: (item: Partial<InventoryItem>) => InventoryItem;
  // Telephony CTI
  startTelephonyCall: (number: string, name?: string) => void;
  simulateIncomingCall: () => void;
  answerIncomingCall: () => void;
  endTelephonyCall: () => void;
  toggleHoldCall: () => void;
  popTicketFromCall: (callId: string) => Incident;
  // Billing
  payInvoice: (invoiceId: string, method: Invoice['paymentMethod']) => void;
  createInvoice: (inv: Partial<Invoice>) => Invoice;
  // Data backup & reset
  resetDatabase: () => void;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (data: string) => boolean;
}

const STORAGE_KEY = 'SCRIBBLE_ITSM_DB_V2';

const ITSMContext = createContext<ITSMContextType | undefined>(undefined);

export const ITSMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role>('admin');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Google / Firebase Auth
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Monitor auth state on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token || null);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const logoutGoogle = async () => {
    await firebaseLogout();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  const currentUser = {
    name: googleUser?.displayName || (role === 'customer' ? 'Marcus Vance' : 'Elena Rostova (Admin)'),
    email: googleUser?.email || (role === 'customer' ? 'm.vance@njuretech.io' : 'e.rostova@njuretech.io'),
    department: role === 'customer' ? 'DevOps / Platform' : 'IT Operations & SecOps',
    phone: '+44 20 7946 0912'
  };

  // State persistence (Local + Firestore Sync)
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_INCIDENTS`);
      return saved ? JSON.parse(saved) : INITIAL_INCIDENTS;
    } catch {
      return INITIAL_INCIDENTS;
    }
  });

  const [requests, setRequests] = useState<ServiceRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_REQUESTS`);
      return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
    } catch {
      return INITIAL_REQUESTS;
    }
  });

  const [problems, setProblems] = useState<Problem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_PROBLEMS`);
      return saved ? JSON.parse(saved) : INITIAL_PROBLEMS;
    } catch {
      return INITIAL_PROBLEMS;
    }
  });

  const [changes, setChanges] = useState<ChangeRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_CHANGES`);
      return saved ? JSON.parse(saved) : INITIAL_CHANGES;
    } catch {
      return INITIAL_CHANGES;
    }
  });

  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_ASSETS`);
      return saved ? JSON.parse(saved) : INITIAL_ASSETS;
    } catch {
      return INITIAL_ASSETS;
    }
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_INVENTORY`);
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
    } catch {
      return INITIAL_INVENTORY;
    }
  });

  const [calls, setCalls] = useState<TelephonyCall[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_CALLS`);
      return saved ? JSON.parse(saved) : INITIAL_CALLS;
    } catch {
      return INITIAL_CALLS;
    }
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_INVOICES`);
      return saved ? JSON.parse(saved) : INITIAL_INVOICES;
    } catch {
      return INITIAL_INVOICES;
    }
  });

  const [activeCall, setActiveCall] = useState<TelephonyCall | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_INCIDENTS`, JSON.stringify(incidents));
      localStorage.setItem(`${STORAGE_KEY}_REQUESTS`, JSON.stringify(requests));
      localStorage.setItem(`${STORAGE_KEY}_PROBLEMS`, JSON.stringify(problems));
      localStorage.setItem(`${STORAGE_KEY}_CHANGES`, JSON.stringify(changes));
      localStorage.setItem(`${STORAGE_KEY}_ASSETS`, JSON.stringify(assets));
      localStorage.setItem(`${STORAGE_KEY}_INVENTORY`, JSON.stringify(inventory));
      localStorage.setItem(`${STORAGE_KEY}_CALLS`, JSON.stringify(calls));
      localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(invoices));
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }
  }, [incidents, requests, problems, changes, assets, inventory, calls, invoices]);

  // Telephony call duration ticker
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;
    const interval = setInterval(() => {
      setActiveCall(prev => {
        if (!prev || prev.status !== 'active') return prev;
        return { ...prev, durationSec: prev.durationSec + 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Incident Operations
  const createIncident = (data: Partial<Incident>): Incident => {
    const id = `INC-${Math.floor(2050 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const newInc: Incident = {
      id,
      title: data.title || 'Untitled Incident',
      description: data.description || '',
      status: data.status || 'new',
      priority: data.priority || 'P3',
      urgency: data.urgency || 'medium',
      impact: data.impact || 'medium',
      category: data.category || 'software',
      requesterName: data.requesterName || currentUser.name,
      requesterEmail: data.requesterEmail || currentUser.email,
      assignee: data.assignee || 'Service Desk Triage Pool',
      affectedCI: data.affectedCI,
      slaDeadline: data.slaDeadline || new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      slaBreached: false,
      createdAt: now,
      updatedAt: now,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          author: currentUser.name,
          action: 'Record Created',
          note: 'Incident registered in ServiceNow architecture engine.'
        }
      ]
    };
    setIncidents(prev => [newInc, ...prev]);

    // Async sync to Firestore
    try {
      setDoc(doc(db, 'incidents', id), newInc).catch(e => console.warn('Firestore sync note:', e));
    } catch (e) {
      // offline fallback
    }

    return newInc;
  };

  const updateIncidentStatus = (id: string, status: IncidentStatus, note?: string, resolutionNotes?: string, isWorkNote = false) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc;
      const now = new Date().toISOString();
      const updatedLog = [...inc.activityLog];
      if (note) {
        updatedLog.push({
          id: `act-${Date.now()}`,
          timestamp: now,
          author: currentUser.name,
          action: isWorkNote ? '[WORK NOTE - INTERNAL]' : `Status: ${status}`,
          note
        });
      }
      const updated = {
        ...inc,
        status,
        updatedAt: now,
        resolutionNotes: resolutionNotes || inc.resolutionNotes,
        activityLog: updatedLog
      };

      try {
        setDoc(doc(db, 'incidents', id), updated).catch(e => console.warn('Firestore sync note:', e));
      } catch (e) {
        // offline fallback
      }

      return updated;
    }));
  };

  const assignIncident = (id: string, assignee: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc;
      const now = new Date().toISOString();
      const updated = {
        ...inc,
        assignee,
        status: inc.status === 'new' ? 'assigned' : inc.status,
        updatedAt: now,
        activityLog: [
          ...inc.activityLog,
          {
            id: `act-${Date.now()}`,
            timestamp: now,
            author: currentUser.name,
            action: 'Assigned',
            note: `Assigned to ${assignee}`
          }
        ]
      };
      return updated;
    }));
  };

  // Service Request Operations
  const createServiceRequest = (req: Partial<ServiceRequest>): ServiceRequest => {
    const id = `REQ-${Math.floor(3030 + Math.random() * 800)}`;
    const now = new Date().toISOString();
    const newReq: ServiceRequest = {
      id,
      catalogItemId: req.catalogItemId || 'CAT-GEN-01',
      catalogItemName: req.catalogItemName || 'Custom Service Request',
      description: req.description || '',
      requesterName: req.requesterName || currentUser.name,
      requesterEmail: req.requesterEmail || currentUser.email,
      department: req.department || currentUser.department,
      cost: req.cost || 0,
      status: 'submitted',
      currentStage: 1,
      approvals: [
        { role: 'Direct Manager', approver: 'Claire Sterling', status: 'pending' },
        { role: 'Security Review', approver: 'Noah Bennett', status: 'pending' },
        { role: 'IT Fulfillment', approver: 'Service Desk Logistics', status: 'pending' }
      ],
      deliveryEstimateDays: req.deliveryEstimateDays || 3,
      createdAt: now
    };
    setRequests(prev => [newReq, ...prev]);
    return newReq;
  };

  const approveRequestStage = (requestId: string, roleName: string, approver: string, status: 'approved' | 'rejected', notes?: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id !== requestId) return req;
      const newApprovals = req.approvals.map(a => {
        if (a.role === roleName) {
          return { ...a, status, approver, notes, timestamp: new Date().toISOString() };
        }
        return a;
      });

      let nextStatus = req.status;
      let nextStage = req.currentStage;

      if (status === 'rejected') {
        nextStatus = 'rejected';
      } else {
        const approvedCount = newApprovals.filter(a => a.status === 'approved').length;
        if (approvedCount === 1) {
          nextStatus = 'manager_approved';
          nextStage = 2;
        } else if (approvedCount === 2) {
          nextStatus = 'fulfillment';
          nextStage = 3;
        } else if (approvedCount === 3) {
          nextStatus = 'completed';
          nextStage = 4;
        }
      }

      return {
        ...req,
        status: nextStatus,
        currentStage: nextStage,
        approvals: newApprovals
      };
    }));
  };

  // Problem Operations
  const createProblem = (prob: Partial<Problem>): Problem => {
    const id = `PRB-${Math.floor(100 + Math.random() * 899)}`;
    const now = new Date().toISOString();
    const newProb: Problem = {
      id,
      title: prob.title || 'Untitled Problem Investigation',
      description: prob.description || '',
      status: prob.status || 'investigating',
      severity: prob.severity || 'moderate',
      rootCauseAnalysis: prob.rootCauseAnalysis || '',
      workaround: prob.workaround || '',
      permanentSolution: prob.permanentSolution || '',
      linkedIncidentIds: prob.linkedIncidentIds || [],
      linkedChangeId: prob.linkedChangeId,
      owner: prob.owner || currentUser.name,
      isKnownError: prob.isKnownError || false,
      createdAt: now,
      updatedAt: now
    };
    setProblems(prev => [newProb, ...prev]);
    return newProb;
  };

  const updateProblem = (id: string, updates: Partial<Problem>) => {
    setProblems(prev => prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)));
  };

  // Change Management
  const createChangeRequest = (change: Partial<ChangeRequest>): ChangeRequest => {
    const id = `CHG-${Math.floor(600 + Math.random() * 300)}`;
    const now = new Date().toISOString();
    const newChg: ChangeRequest = {
      id,
      title: change.title || 'Standard System Maintenance',
      type: change.type || 'normal',
      status: change.status || 'cab_review',
      riskScore: change.riskScore || 'medium',
      reason: change.reason || '',
      implementationPlan: change.implementationPlan || '',
      rollbackPlan: change.rollbackPlan || '',
      testPlan: change.testPlan || '',
      scheduledStart: change.scheduledStart || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      scheduledEnd: change.scheduledEnd || new Date(Date.now() + 28 * 3600 * 1000).toISOString(),
      cabVotes: [
        { member: 'David Miller', role: 'CAB Chair', vote: 'pending' },
        { member: 'Noah Bennett', role: 'Security Architect', vote: 'pending' }
      ],
      requestedBy: change.requestedBy || currentUser.name,
      assignedEngineer: change.assignedEngineer || currentUser.name,
      createdAt: now
    };
    setChanges(prev => [newChg, ...prev]);
    return newChg;
  };

  const voteCab = (changeId: string, member: string, roleName: string, vote: 'approved' | 'rejected', notes?: string) => {
    setChanges(prev => prev.map(c => {
      if (c.id !== changeId) return c;
      const votes = c.cabVotes.map(v => v.member === member ? { ...v, vote, notes } : v);
      const allApproved = votes.every(v => v.vote === 'approved');
      const now = new Date().toISOString();
      const newStatus = allApproved ? 'scheduled' : c.status;
      const updatedLog = [
        ...(c.activityLog || []),
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          author: member,
          type: 'audit' as const,
          action: `CAB Vote: ${vote.toUpperCase()}`,
          note: `${member} (${roleName}) cast vote [${vote.toUpperCase()}]. ${notes ? `Notes: "${notes}"` : ''}${allApproved ? ' All CAB approvals collected; RFC transitioned to Scheduled.' : ''}`,
          fieldChanges: allApproved && c.status !== 'scheduled' ? [{ field: 'State', from: c.status, to: 'scheduled' }] : undefined
        }
      ];
      return {
        ...c,
        cabVotes: votes,
        status: newStatus,
        activityLog: updatedLog
      };
    }));
  };

  const updateChangeStatus = (id: string, status: ChangeStatus) => {
    setChanges(prev => prev.map(c => {
      if (c.id !== id) return c;
      const now = new Date().toISOString();
      const prior = c.status;
      const updatedLog = [
        ...(c.activityLog || []),
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          author: currentUser.name,
          type: 'field_change' as const,
          action: `Status Changed`,
          note: `Transitioned RFC status from "${prior}" to "${status}".`,
          fieldChanges: [{ field: 'State', from: prior, to: status }]
        }
      ];
      return { ...c, status, updatedAt: now, activityLog: updatedLog };
    }));
  };

  const addRecordActivity = (
    recordId: string,
    recordType: 'incident' | 'change',
    note: string,
    type: 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit',
    action?: string,
    fieldChanges?: { field: string; from: string; to: string }[]
  ) => {
    const now = new Date().toISOString();
    const entry = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now,
      author: currentUser.name,
      type,
      action: action || (type === 'work_note' ? 'Work Note' : type === 'comment' ? 'Customer Comment' : 'Update'),
      note,
      fieldChanges
    };

    if (recordType === 'incident') {
      setIncidents(prev => prev.map(inc => {
        if (inc.id !== recordId) return inc;
        return {
          ...inc,
          updatedAt: now,
          activityLog: [entry, ...inc.activityLog]
        };
      }));
    } else {
      setChanges(prev => prev.map(chg => {
        if (chg.id !== recordId) return chg;
        return {
          ...chg,
          updatedAt: now,
          activityLog: [entry, ...(chg.activityLog || [])]
        };
      }));
    }
  };

  // Asset Management
  const createAsset = (asset: Partial<Asset>): Asset => {
    const id = `AST-${Math.floor(6000 + Math.random() * 3000)}`;
    const newAsset: Asset = {
      id,
      assetTag: asset.assetTag || `NJURE-HW-${Math.floor(100 + Math.random() * 900)}`,
      name: asset.name || 'Hardware Asset',
      type: asset.type || 'laptop',
      serialNumber: asset.serialNumber || `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      macAddress: asset.macAddress,
      model: asset.model || 'Standard Enterprise Model',
      manufacturer: asset.manufacturer || 'Dell Technologies',
      status: asset.status || 'in_stock',
      assignedTo: asset.assignedTo,
      department: asset.department,
      location: asset.location || 'Headquarters IT Depot',
      purchaseDate: asset.purchaseDate || new Date().toISOString().split('T')[0],
      warrantyExpiry: asset.warrantyExpiry || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      purchaseCost: asset.purchaseCost || 1200,
      currentBookValue: asset.currentBookValue || 1200,
      qrCodeData: `https://scribble.njuretech.io/asset/${id}`
    };
    setAssets(prev => [newAsset, ...prev]);
    return newAsset;
  };

  const updateAssetStatus = (id: string, status: Asset['status'], assignedTo?: string) => {
    setAssets(prev => prev.map(a => (a.id === id ? { ...a, status, assignedTo: assignedTo !== undefined ? assignedTo : a.assignedTo } : a)));
  };

  // Inventory Management
  const updateInventoryQuantity = (id: string, delta: number) => {
    setInventory(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newQty = Math.max(0, item.quantity + delta);
      return { ...item, quantity: newQty };
    }));
  };

  const createInventoryItem = (item: Partial<InventoryItem>): InventoryItem => {
    const id = `INV-${Math.floor(500 + Math.random() * 400)}`;
    const newItem: InventoryItem = {
      id,
      sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: item.name || 'Stock Item',
      category: item.category || 'components',
      quantity: item.quantity || 10,
      minThreshold: item.minThreshold || 5,
      unitCost: item.unitCost || 25,
      location: item.location || 'Depot Shelf 1',
      lastRestocked: new Date().toISOString().split('T')[0]
    };
    setInventory(prev => [newItem, ...prev]);
    return newItem;
  };

  // Telephony CTI
  const startTelephonyCall = (number: string, name?: string) => {
    const newCall: TelephonyCall = {
      id: `CALL-${Math.floor(9100 + Math.random() * 800)}`,
      callerNumber: number,
      callerName: name || 'Remote Engineer / Client',
      callerCompany: 'Njure Tech Telecom Partner',
      direction: 'outbound',
      status: 'active',
      startTime: new Date().toISOString(),
      durationSec: 0,
      liveTranscript: [
        `System: Call established with ${number} via SIP Gateway 10.200.4.1`,
        'Agent: "Hello, this is Scribble IT Service Desk. How may I assist you?"'
      ]
    };
    setActiveCall(newCall);
    setCalls(prev => [newCall, ...prev]);
  };

  const simulateIncomingCall = () => {
    const callers = [
      { name: 'Dr. Alistair Finch', number: '+44 20 7183 9920', company: 'Genomics Research Lab' },
      { name: 'Sofia Rodriguez', number: '+1 (415) 555-0199', company: 'Njure Cloud Platform' },
      { name: 'Kenji Takahashi', number: '+81 3 5555 0143', company: 'Tokyo Datacenter NOC' }
    ];
    const picked = callers[Math.floor(Math.random() * callers.length)];
    const call: TelephonyCall = {
      id: `CALL-${Math.floor(9200 + Math.random() * 700)}`,
      callerNumber: picked.number,
      callerName: picked.name,
      callerCompany: picked.company,
      direction: 'inbound',
      status: 'ringing',
      startTime: new Date().toISOString(),
      durationSec: 0,
      liveTranscript: [
        `Incoming SIP INVITE received from ${picked.number} (${picked.company})`
      ]
    };
    setActiveCall(call);
  };

  const answerIncomingCall = () => {
    if (!activeCall) return;
    const answered = {
      ...activeCall,
      status: 'active' as const,
      liveTranscript: [
        ...activeCall.liveTranscript,
        'Agent: "Scribble IT Support, Elena speaking. I see your registered profile. How can I help?"',
        `Caller: "Hello, we have urgent telemetry anomalies on our server node."`
      ]
    };
    setActiveCall(answered);
    setCalls(prev => [answered, ...prev.filter(c => c.id !== answered.id)]);
  };

  const toggleHoldCall = () => {
    if (!activeCall) return;
    const nextStatus = activeCall.status === 'held' ? 'active' : 'held';
    const updated = {
      ...activeCall,
      status: nextStatus as 'active' | 'held',
      liveTranscript: [
        ...activeCall.liveTranscript,
        nextStatus === 'held' ? 'System: Call placed on hold with music queue.' : 'System: Call resumed.'
      ]
    };
    setActiveCall(updated);
  };

  const endTelephonyCall = () => {
    if (!activeCall) return;
    const finished: TelephonyCall = {
      ...activeCall,
      status: 'completed',
      disposition: 'inquiry_resolved'
    };
    setCalls(prev => [finished, ...prev.filter(c => c.id !== finished.id)]);
    setActiveCall(null);
  };

  const popTicketFromCall = (callId: string): Incident => {
    const targetCall = calls.find(c => c.id === callId) || activeCall;
    const title = targetCall
      ? `Telephony Support: Inbound incident reported by ${targetCall.callerName}`
      : 'Inbound Telephony Support Case';
    const newInc = createIncident({
      title,
      description: `Auto-generated from telephony session ${callId}.\nCaller: ${targetCall?.callerName} (${targetCall?.callerNumber})\nCompany: ${targetCall?.callerCompany}\n\nCall Transcript:\n${targetCall?.liveTranscript.join('\n') || 'No transcript recorded.'}`,
      category: 'telephony',
      priority: 'P2',
      requesterName: targetCall?.callerName || 'Phone Requester'
    });
    setCalls(prev => prev.map(c => c.id === callId ? { ...c, relatedTicketId: newInc.id, disposition: 'incident_logged' } : c));
    return newInc;
  };

  // Invoicing & Payment
  const payInvoice = (invoiceId: string, method: Invoice['paymentMethod']) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      return {
        ...inv,
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentMethod: method || 'credit_card'
      };
    }));
  };

  const createInvoice = (inv: Partial<Invoice>): Invoice => {
    const id = `INV-${Math.floor(9100 + Math.random() * 800)}`;
    const newInv: Invoice = {
      id,
      customerName: inv.customerName || currentUser.name,
      customerEmail: inv.customerEmail || currentUser.email,
      organization: inv.organization || 'Njure Enterprise Client',
      amount: inv.amount || 250,
      currency: inv.currency || 'USD',
      status: 'pending',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      lineItems: inv.lineItems || [{ description: 'Custom IT Service Fee', quantity: 1, unitPrice: inv.amount || 250 }],
      notes: inv.notes || 'Net 14 payment terms.'
    };
    setInvoices(prev => [newInv, ...prev]);
    return newInv;
  };

  // Data reset & export
  const resetDatabase = () => {
    setIncidents(INITIAL_INCIDENTS);
    setRequests(INITIAL_REQUESTS);
    setProblems(INITIAL_PROBLEMS);
    setChanges(INITIAL_CHANGES);
    setAssets(INITIAL_ASSETS);
    setInventory(INITIAL_INVENTORY);
    setCalls(INITIAL_CALLS);
    setInvoices(INITIAL_INVOICES);
    localStorage.clear();
  };

  const exportDatabaseJSON = (): string => {
    return JSON.stringify({
      version: '2.0-ServiceNow',
      exportedAt: new Date().toISOString(),
      projectId: 'gen-lang-client-0108198368',
      region: 'asia-south1',
      incidents,
      requests,
      problems,
      changes,
      assets,
      inventory,
      calls,
      invoices
    }, null, 2);
  };

  const importDatabaseJSON = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.incidents) setIncidents(data.incidents);
      if (data.requests) setRequests(data.requests);
      if (data.problems) setProblems(data.problems);
      if (data.changes) setChanges(data.changes);
      if (data.assets) setAssets(data.assets);
      if (data.inventory) setInventory(data.inventory);
      if (data.calls) setCalls(data.calls);
      if (data.invoices) setInvoices(data.invoices);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ITSMContext.Provider
      value={{
        role,
        setRole,
        activeTab,
        setActiveTab,
        currentUser,
        googleUser,
        googleToken,
        loginWithGoogle,
        logoutGoogle,
        isFirebaseConnected,
        incidents,
        requests,
        problems,
        changes,
        assets,
        inventory,
        calls,
        invoices,
        activeCall,
        createIncident,
        updateIncidentStatus,
        assignIncident,
        createServiceRequest,
        approveRequestStage,
        createProblem,
        updateProblem,
        createChangeRequest,
        voteCab,
        updateChangeStatus,
        addRecordActivity,
        createAsset,
        updateAssetStatus,
        updateInventoryQuantity,
        createInventoryItem,
        startTelephonyCall,
        simulateIncomingCall,
        answerIncomingCall,
        endTelephonyCall,
        toggleHoldCall,
        popTicketFromCall,
        payInvoice,
        createInvoice,
        resetDatabase,
        exportDatabaseJSON,
        importDatabaseJSON
      }}
    >
      {children}
    </ITSMContext.Provider>
  );
};

export const useITSM = () => {
  const context = useContext(ITSMContext);
  if (!context) throw new Error('useITSM must be used within an ITSMProvider');
  return context;
};

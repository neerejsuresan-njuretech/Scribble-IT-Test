import { Incident, ServiceRequest, Problem, ChangeRequest, Asset, InventoryItem, TelephonyCall, Invoice, CatalogItem } from '../types/itsm';

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'INC-2048',
    title: 'Core Distribution Switch Stack B flapping on 10GbE Uplink',
    description: 'BGP sessions to upstream transit carrier dropped 3 times in 15 minutes. Packet loss on VLAN 100 (DevOps staging) peaking at 28%. Automatic failover triggered.',
    status: 'in_progress',
    priority: 'P1',
    urgency: 'high',
    impact: 'high',
    category: 'network',
    requesterName: 'Marcus Vance',
    requesterEmail: 'm.vance@njuretech.io',
    assignee: 'Elena Rostova (L3 NetOps)',
    affectedCI: 'AST-4011',
    slaDeadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    slaBreached: false,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: 'act-1',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        author: 'System Monitor (Zabbix/SNMP)',
        action: 'Ticket Created',
        note: 'High latency alarm triggered on SFP+ interface Te1/0/2. Threshold exceeded (>150ms).'
      },
      {
        id: 'act-2',
        timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        author: 'Elena Rostova',
        action: 'Triage & Investigation',
        note: 'Transceiver optical receive power is -19.4 dBm (near lower limit). Re-seating SFP+ module scheduled with on-site datacenter hands.'
      }
    ]
  },
  {
    id: 'INC-2047',
    title: 'PostgreSQL Read-Replica lag exceeding replication window (620s)',
    description: 'Analytics queries causing heavy I/O lock contention on storage volume NVMe array, causing 10-minute replication drift for customer reporting dashboards.',
    status: 'assigned',
    priority: 'P2',
    urgency: 'high',
    impact: 'medium',
    category: 'software',
    requesterName: 'Sarah Lin',
    requesterEmail: 's.lin@njuretech.io',
    assignee: 'Devin Kross (DBA)',
    affectedCI: 'AST-1002',
    slaDeadline: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
    slaBreached: false,
    createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: 'act-3',
        timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        author: 'Sarah Lin',
        action: 'Created',
        note: 'Grafana alert fired: pg_stat_replication lag byte threshold breached.'
      }
    ]
  },
  {
    id: 'INC-2046',
    title: 'Okta SSO Certificate Expiry Warning on Jira/Confluence connector',
    description: 'SAML IdP signing certificate expires in 72 hours. Users may face authentication rejections if rollover metadata is not applied before Friday 00:00 UTC.',
    status: 'new',
    priority: 'P3',
    urgency: 'medium',
    impact: 'medium',
    category: 'security',
    requesterName: 'Liam Chen',
    requesterEmail: 'l.chen@njuretech.io',
    assignee: 'Identity Management Pool',
    slaDeadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    slaBreached: false,
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    activityLog: [
      {
        id: 'act-4',
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        author: 'Security Bot',
        action: 'Automated Ingestion',
        note: 'Cert SHA-256 fingerprint rollover notice from Okta Admin console.'
      }
    ]
  },
  {
    id: 'INC-2045',
    title: 'VoIP PBX SIP Trunk sporadic 408 Request Timeout on Extension 4402',
    description: 'Customer service desk incoming calls from UK toll-free number dropping intermittently after 2 rings. SIP signaling trace shows SIP ALG active on edge firewall.',
    status: 'resolved',
    priority: 'P2',
    urgency: 'high',
    impact: 'medium',
    category: 'telephony',
    requesterName: 'Rachel Green',
    requesterEmail: 'r.green@njuretech.io',
    assignee: 'Tariq Al-Mansoor',
    slaDeadline: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    slaBreached: false,
    createdAt: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    resolutionNotes: 'Disabled SIP ALG inspect rule on border FortiGate firewall and refreshed NAT session states. Call completions normalized to 99.8%.',
    activityLog: [
      {
        id: 'act-5',
        timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
        author: 'Rachel Green',
        action: 'Reported',
        note: 'Customer calls bouncing to voicemail unexpectedly.'
      },
      {
        id: 'act-6',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        author: 'Tariq Al-Mansoor',
        action: 'Resolved',
        note: 'Fixed firewall SIP inspection bug. Tested 5 consecutive calls.'
      }
    ]
  }
];

export const INITIAL_REQUESTS: ServiceRequest[] = [
  {
    id: 'REQ-3021',
    catalogItemId: 'CAT-HW-01',
    catalogItemName: 'Developer Workstation Upgrade (MacBook Pro M3 Max)',
    description: 'Upgrading from 2020 Intel MacBook for local LLM inference testing and Docker container compilation.',
    requesterName: 'Aiden Wong',
    requesterEmail: 'a.wong@njuretech.io',
    department: 'Engineering / Platform AI',
    cost: 3499,
    status: 'security_review',
    currentStage: 2,
    approvals: [
      { role: 'Direct Manager', approver: 'Claire Sterling', status: 'approved', timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), notes: 'Approved within Q4 hardware budget allocation.' },
      { role: 'InfoSec Device Compliance', approver: 'Noah Bennett', status: 'pending', notes: 'Verifying Jamf Pro MDM profile & BitLocker/FileVault escrow.' },
      { role: 'IT Logistics & Delivery', approver: 'Dispatch Team', status: 'pending' }
    ],
    deliveryEstimateDays: 3,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'REQ-3020',
    catalogItemId: 'CAT-ACC-03',
    catalogItemName: 'Production AWS VPC Peering & Bastion Access',
    description: 'Temporary production bastion SSH jump access for emergency DB migration patch deployment.',
    requesterName: 'Mira Patel',
    requesterEmail: 'm.patel@njuretech.io',
    department: 'Site Reliability Engineering',
    cost: 0,
    status: 'manager_approved',
    currentStage: 2,
    approvals: [
      { role: 'Head of Infrastructure', approver: 'Claire Sterling', status: 'approved', timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
      { role: 'Security Ops (SecOps)', approver: 'Noah Bennett', status: 'pending' }
    ],
    deliveryEstimateDays: 1,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString()
  },
  {
    id: 'REQ-3019',
    catalogItemId: 'CAT-HW-04',
    catalogItemName: 'Dual 27-inch 4K USB-C Hub Display Setup',
    description: 'External dual display dock setup for ergonomic engineering desk station.',
    requesterName: 'Chloe Bennett',
    requesterEmail: 'c.bennett@njuretech.io',
    department: 'Product Design',
    cost: 850,
    status: 'fulfillment',
    currentStage: 3,
    approvals: [
      { role: 'Design Lead', approver: 'Maya Lin', status: 'approved', timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString() },
      { role: 'Procurement', approver: 'Finance Desk', status: 'approved', timestamp: new Date(Date.now() - 18 * 3600 * 1000).toISOString() }
    ],
    deliveryEstimateDays: 2,
    deliveryDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_PROBLEMS: Problem[] = [
  {
    id: 'PRB-0089',
    title: 'Repeated SFP+ Transceiver Overheating in Rack A-04 Top-of-Rack Switch',
    description: 'Consecutive incident reports (INC-2048, INC-1982) regarding optical packet loss in chassis 2. Ambient hot-aisle exhaust temperature measured at 38°C.',
    status: 'root_cause_identified',
    severity: 'high',
    rootCauseAnalysis: 'Blanking panel missing on slots 24-28 causing hot-air recirculation back into switch intake fan. High internal thermal throttling on optics.',
    workaround: 'Temporary fan tray set to 100% duty cycle via CLI override (`environment fan-speed max`).',
    permanentSolution: 'Install 4U slotted blanking baffles and replace Te1/0/2 optic with industrial -40C/+85C rated SFP-10G-SR-X.',
    linkedIncidentIds: ['INC-2048', 'INC-1982'],
    linkedChangeId: 'CHG-0512',
    owner: 'Elena Rostova',
    isKnownError: true,
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  },
  {
    id: 'PRB-0088',
    title: 'Memory Leak in Node.js Microservice telemetry worker pool',
    description: 'Worker instances steadily consume 2GB heap over 48 hours without releasing buffer allocations during heavy Webhook event bursts.',
    status: 'workaround_published',
    severity: 'moderate',
    rootCauseAnalysis: 'Unbounded event emitter listeners accumulating in Redis pub/sub handler without cleanup during connection disconnects.',
    workaround: 'Automatic container rolling restart configured when pod RSS memory exceeds 80% (1.6GB).',
    permanentSolution: 'PR #421 merged into main branch containing WeakMap listener cache and explicit teardown on socket close.',
    linkedIncidentIds: ['INC-1970'],
    owner: 'Siddharth Patel',
    isKnownError: true,
    createdAt: new Date(Date.now() - 120 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_CHANGES: ChangeRequest[] = [
  {
    id: 'CHG-0512',
    title: 'Emergency Top-of-Rack Baffle Installation & Switch Firmware 17.09 Rollover',
    type: 'emergency',
    status: 'cab_review',
    riskScore: 'medium',
    reason: 'Mitigates recurring thermal overheating causing packet loss on Core Switch Stack B (addresses PRB-0089).',
    implementationPlan: '1. Reroute primary traffic via redundant Stack A via HSRP priority adjustment. 2. Power down PSU2. 3. Mount slotted airflow baffles. 4. Upgrade image via TFTP. 5. Reload and verify interface link states.',
    rollbackPlan: 'Boot secondary flash partition (ver 17.06.02) if BGP convergence exceeds 90s.',
    testPlan: 'Ping sweep test 10.100.0.0/16 subnet, verify 0% drop on synthetic iperf3 benchmark.',
    scheduledStart: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
    cabVotes: [
      { member: 'David Miller', role: 'CAB Chair / VP Infrastructure', vote: 'approved', notes: 'Window approved during off-peak maintenance window 02:00 UTC.' },
      { member: 'Noah Bennett', role: 'Security Architect', vote: 'approved', notes: 'Firmware hash checked against Cisco CCO advisory.' },
      { member: 'Elena Rostova', role: 'NetOps Lead', vote: 'approved', notes: 'Technician on standby at site.' }
    ],
    requestedBy: 'Elena Rostova',
    assignedEngineer: 'Elena Rostova',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    activityLog: [
      {
        id: 'act-c1',
        timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        author: 'Elena Rostova',
        type: 'audit',
        action: 'RFC Submitted',
        note: 'Emergency Change RFC created following repeated SFP transceiver overheat alarms.'
      },
      {
        id: 'act-c2',
        timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        author: 'David Miller (CAB Chair)',
        type: 'work_note',
        action: 'CAB Quorum Vote',
        note: 'Approved for execution window 02:00 UTC. Secondary Stack A failover verified.'
      },
      {
        id: 'act-c3',
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        author: 'Security Architect (Noah Bennett)',
        type: 'system_alert',
        action: 'Image Verification',
        note: 'Cisco IOS-XE SHA512 hash verified against Cisco PSIRT advisory.'
      }
    ]
  },
  {
    id: 'CHG-0511',
    title: 'Migrate Enterprise VPN Endpoint to WireGuard Multi-Gateway Mesh',
    type: 'normal',
    status: 'scheduled',
    riskScore: 'low',
    reason: 'Improves remote workforce network throughput by 3.5x and reduces latency for APAC developers.',
    implementationPlan: 'Deploy Ansible playbook across Singapore, Frankfurt and US-East gateways with auto-sync public keys via Vault.',
    rollbackPlan: 'Keep legacy OpenVPN daemon listening on port 1194 for 14-day transition grace period.',
    testPlan: 'Simulate 200 concurrent tunnels from load agent instances.',
    scheduledStart: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 40 * 3600 * 1000).toISOString(),
    cabVotes: [
      { member: 'David Miller', role: 'CAB Chair', vote: 'approved' }
    ],
    requestedBy: 'Tariq Al-Mansoor',
    assignedEngineer: 'Tariq Al-Mansoor',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    activityLog: [
      {
        id: 'act-c4',
        timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        author: 'Tariq Al-Mansoor',
        type: 'audit',
        action: 'Change Drafted',
        note: 'Submitted WireGuard multi-region mesh transition RFC.'
      }
    ]
  }
];

export const INITIAL_ASSETS: Asset[] = [
  {
    id: 'AST-4011',
    assetTag: 'NJURE-SW-CORE-02',
    name: 'Cisco Catalyst 9300 48-Port 10G Switch',
    type: 'networking',
    serialNumber: 'FCW2438L07Z',
    macAddress: '00:1E:13:B9:44:A2',
    model: 'C9300-48UXM-A',
    manufacturer: 'Cisco Systems',
    status: 'in_use',
    location: 'Datacenter 1 - Rack A-04 (U22)',
    purchaseDate: '2023-04-15',
    warrantyExpiry: '2028-04-15',
    purchaseCost: 9800,
    currentBookValue: 6860,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-4011'
  },
  {
    id: 'AST-1002',
    assetTag: 'NJURE-SRV-DB-REP',
    name: 'Dell PowerEdge R750 2U Rackmount Server',
    type: 'server',
    serialNumber: '7XG4B93',
    macAddress: 'D4:F5:27:18:99:C1',
    model: 'PowerEdge R750 (2x Xeon Gold 6330, 256GB RAM, 8x NVMe 3.84TB)',
    manufacturer: 'Dell Technologies',
    status: 'in_use',
    location: 'Datacenter 1 - Rack B-02 (U14-U15)',
    purchaseDate: '2023-08-20',
    warrantyExpiry: '2027-08-20',
    purchaseCost: 14200,
    currentBookValue: 10650,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-1002'
  },
  {
    id: 'AST-5023',
    assetTag: 'NJURE-MBP-882',
    name: 'MacBook Pro 16" Space Black M3 Max',
    type: 'laptop',
    serialNumber: 'H784P3Q9LX',
    macAddress: 'AC:DE:48:11:33:04',
    model: 'Apple M3 Max (16-core CPU, 40-core GPU, 64GB Unified RAM, 1TB SSD)',
    manufacturer: 'Apple Inc.',
    status: 'in_use',
    assignedTo: 'Marcus Vance',
    department: 'Engineering',
    location: 'Remote / London Hub',
    purchaseDate: '2024-01-10',
    warrantyExpiry: '2027-01-10',
    purchaseCost: 3999,
    currentBookValue: 3400,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-5023'
  },
  {
    id: 'AST-9014',
    assetTag: 'NJURE-SEC-KEY-09',
    name: 'Scribble Dot-Matrix Hardware FIDO2 Security Token',
    type: 'security_key',
    serialNumber: 'SCRIB-F2-99081',
    model: 'Scribble PassKey Transparent Polycarbonate Edition',
    manufacturer: 'Njure Tech Hardware Lab',
    status: 'in_use',
    assignedTo: 'Marcus Vance',
    department: 'DevOps / Admin',
    location: 'Personal Token Device',
    purchaseDate: '2024-05-01',
    warrantyExpiry: '2029-05-01',
    purchaseCost: 85,
    currentBookValue: 80,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-9014'
  },
  {
    id: 'AST-3301',
    assetTag: 'NJURE-DISP-4K-12',
    name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
    type: 'monitor',
    serialNumber: 'CN08W9920',
    model: 'U2723QE IPS Black',
    manufacturer: 'Dell Technologies',
    status: 'in_stock',
    location: 'IT Storage Room 2B, Shelf 4',
    purchaseDate: '2024-02-18',
    warrantyExpiry: '2027-02-18',
    purchaseCost: 590,
    currentBookValue: 520,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-3301'
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'INV-401',
    sku: 'CAB-CAT6A-BLU-3M',
    name: 'Cat6A Shielded RJ45 Patch Cable (3-meter, Low Smoke Zero Halogen)',
    category: 'cabling',
    quantity: 48,
    minThreshold: 20,
    unitCost: 8.50,
    location: 'Datacenter A Bin #12',
    lastRestocked: '2024-10-15'
  },
  {
    id: 'INV-402',
    sku: 'OPT-SFP-10G-SR',
    name: '10GBASE-SR SFP+ 850nm 300m Optical Transceiver',
    category: 'components',
    quantity: 6,
    minThreshold: 10, // low stock trigger!
    unitCost: 45.00,
    location: 'Cabinet 3, Lockbox B',
    lastRestocked: '2024-09-02'
  },
  {
    id: 'INV-403',
    sku: 'RAM-DDR5-ECC-32GB',
    name: 'Samsung 32GB DDR5-4800 Registered ECC Server DIMM',
    category: 'components',
    quantity: 14,
    minThreshold: 8,
    unitCost: 165.00,
    location: 'Static-Safe Locker #04',
    lastRestocked: '2024-10-28'
  },
  {
    id: 'INV-404',
    sku: 'ACC-USBC-DOCK-11',
    name: 'Thunderbolt 4 Multi-Port Dual Display Charging Dock',
    category: 'peripherals',
    quantity: 11,
    minThreshold: 5,
    unitCost: 210.00,
    location: 'IT Supply Shelf 2A',
    lastRestocked: '2024-10-01'
  },
  {
    id: 'INV-405',
    sku: 'SEC-YUBI-5C-NFC',
    name: 'FIDO2 / WebAuthn Hardware Authenticator Key',
    category: 'accessories',
    quantity: 25,
    minThreshold: 15,
    unitCost: 65.00,
    location: 'Vault Safe A',
    lastRestocked: '2024-10-20'
  }
];

export const INITIAL_CALLS: TelephonyCall[] = [
  {
    id: 'CALL-9021',
    callerNumber: '+1 (415) 890-2341',
    callerName: 'Marcus Vance',
    callerCompany: 'Njure Tech - London Core',
    direction: 'inbound',
    status: 'active',
    startTime: new Date(Date.now() - 145 * 1000).toISOString(),
    durationSec: 145,
    liveTranscript: [
      'Caller: "Hi Service Desk, Marcus here. The 10GbE uplink on Switch Stack B is flapping again."',
      'Agent: "Hello Marcus, I can see the Zabbix alert on our board right now. Ticket INC-2048 is already opened."',
      'Caller: "Good, packet loss is hitting our staging build cluster. Can we failover immediately?"',
      'Agent: "Yes, Elena from NetOps has been assigned and is verifying the optical levels as we speak."'
    ],
    relatedTicketId: 'INC-2048',
    disposition: 'incident_logged'
  },
  {
    id: 'CALL-9020',
    callerNumber: '+44 20 7946 0912',
    callerName: 'Sarah Lin',
    callerCompany: 'Njure Tech - Data Platform',
    direction: 'inbound',
    status: 'completed',
    startTime: new Date(Date.now() - 3600 * 1000).toISOString(),
    durationSec: 284,
    liveTranscript: [
      'Caller: "Calling to follow up on the PostgreSQL replica lag alert."',
      'Agent: "DBA team has verified NVMe I/O lock saturation. A maintenance change is scheduled."',
      'Caller: "Understood, thank you for the prompt update."'
    ],
    relatedTicketId: 'INC-2047',
    disposition: 'inquiry_resolved'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-9024',
    customerName: 'Marcus Vance',
    customerEmail: 'm.vance@njuretech.io',
    organization: 'FinTech Corp Infrastructure Tier 1',
    amount: 1450.00,
    currency: 'USD',
    status: 'pending',
    issueDate: '2024-11-01',
    dueDate: '2024-11-15',
    lineItems: [
      { description: 'Dedicated Senior SRE Support Hours (Tier 3)', quantity: 8, unitPrice: 150.00 },
      { description: 'Emergency Datacenter Hands Remote Dispatch', quantity: 1, unitPrice: 250.00 }
    ],
    notes: 'SLA priority guarantee included under Gold Managed Services agreement.'
  },
  {
    id: 'INV-9023',
    customerName: 'Aiden Wong',
    customerEmail: 'a.wong@njuretech.io',
    organization: 'Njure Platform Labs',
    amount: 3499.00,
    currency: 'USD',
    status: 'paid',
    issueDate: '2024-10-24',
    dueDate: '2024-11-07',
    paidAt: '2024-10-25',
    paymentMethod: 'purchase_order',
    lineItems: [
      { description: 'MacBook Pro 16" M3 Max Hardware Provisioning', quantity: 1, unitPrice: 3499.00 }
    ],
    notes: 'Internal PO-2024-8841 approved by Claire Sterling.'
  },
  {
    id: 'INV-9022',
    customerName: 'Global Cloud Systems UK',
    customerEmail: 'accounts@gcloud-uk.com',
    organization: 'Global Cloud Systems UK Ltd',
    amount: 6200.00,
    currency: 'USD',
    status: 'paid',
    issueDate: '2024-10-01',
    dueDate: '2024-10-15',
    paidAt: '2024-10-04',
    paymentMethod: 'wire_ach',
    lineItems: [
      { description: 'Monthly Enterprise ITSM Platform License (100 seats)', quantity: 1, unitPrice: 4200.00 },
      { description: '24/7 Telephony SIP Inbound Integration Addon', quantity: 1, unitPrice: 2000.00 }
    ],
    notes: 'Contract Ref: NJURE-ENT-2024-912'
  }
];

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'CAT-HW-01',
    title: 'Developer Workstation Upgrade',
    description: 'High-performance Apple Silicon or ThinkPad Linux machine configured with full MDM and local security containers.',
    category: 'hardware',
    price: 3499,
    estimatedHours: 24,
    requiresApproval: true,
    tags: ['Laptop', 'Hardware', 'Developer']
  },
  {
    id: 'CAT-HW-04',
    title: 'Dual 4K Monitor & Ergo Hub Bundle',
    description: 'Two 27-inch USB-C color-accurate IPS monitors, monitor arm mounts, and high-speed cable kit.',
    category: 'hardware',
    price: 850,
    estimatedHours: 48,
    requiresApproval: true,
    tags: ['Display', 'Accessories', 'Ergonomics']
  },
  {
    id: 'CAT-ACC-03',
    title: 'Production Bastion & Cloud IAM Elevation',
    description: 'Temporary elevated access to AWS/GCP production VPCs with hardware MFA token authorization.',
    category: 'cloud',
    price: 0,
    estimatedHours: 2,
    requiresApproval: true,
    tags: ['Security', 'Cloud', 'AWS']
  },
  {
    id: 'CAT-SEC-02',
    title: 'Scribble Dot-Matrix FIDO2 Hardware Key',
    description: 'Polycarbonate transparent biometric passkey token for zero-trust single sign-on authentication.',
    category: 'access',
    price: 85,
    estimatedHours: 4,
    requiresApproval: false,
    tags: ['YubiKey', 'Hardware', 'Passkey']
  },
  {
    id: 'CAT-TEL-01',
    title: 'Dedicated Direct Dial (DID) & Softphone Extension',
    description: 'Virtual SIP line with international dial-in, automated transcription, and CRM ticket popping.',
    category: 'telephony',
    price: 35,
    estimatedHours: 1,
    requiresApproval: false,
    tags: ['Telephony', 'VoIP', 'SIP']
  }
];

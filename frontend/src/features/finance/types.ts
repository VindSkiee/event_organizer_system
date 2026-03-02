// Finance & Fund Request type definitions

export interface WalletInfo {
  groupName: string;
  balance: number;
  lastUpdated: string | null;
}

export interface TransparencyBalance {
  rt: WalletInfo;
  rw: WalletInfo | null;
}

export interface WalletDetail {
  id: number;
  balance: number;
  communityGroup: {
    id: number;
    name: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayTxInfo {
  id: string;
  orderId: string;
  status: string;
  methodCategory: string;
  providerCode?: string;
  vaNumber?: string;
  amount: number;
  grossAmount?: number;
  monthCount?: number;
  midtransId?: string;
  redirectUrl?: string;
  paidAt?: string;
  createdAt?: string;
  user?: { id: string; fullName: string; email: string };
  contribution?: { month: number; year: number } | null;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  walletId: number;
  createdAt: string;
  createdBy?: {
    fullName: string;
  };
  paymentGatewayTx?: PaymentGatewayTxInfo | null;
}

export interface BillBreakdown {
  type: string;
  groupName: string;
  amount: number;
  destinationWalletId: number;
}

export interface MyBill {
  totalAmount: number;
  currency: string;
  breakdown: Array<{ type: string; groupName: string; amount: number; destinationWalletId: number }>;
  baseBreakdown: Array<{ type: string; groupName: string; amount: number; destinationWalletId: number }>;
  dueDateDescription: string;
  nextBillMonth: number;
  nextBillYear: number;
  unpaidMonthsCount: number;
  baseMonthlyAmount: number;
}

export interface Contribution {
  id: string;
  userId: string;
  amount: number;
  month: number;
  year: number;
  paidAt: string;
  paymentGatewayTxId?: string;
}

// Fund Request
export interface FundRequest {
  id: string;
  amount: number;
  description: string;
  status: string;
  reason?: string;
  notes?: string;
  approvedAmount?: number;
  eventId?: string;
  event?: {
    id?: string;
    title: string;
    status?: string;
  };
  // Backend field names (from getRequestsByGroup / getById include)
  requesterGroupId?: number;
  targetGroupId?: number;
  requesterGroup?: { id?: number; name: string; type?: string };
  targetGroup?: { id?: number; name: string; type?: string };
  createdBy?: { fullName: string };
  approvedBy?: { fullName: string };
  // Legacy/fallback aliases kept for backward compat
  communityGroupId?: number;
  communityGroup?: { name: string };
  requestedBy?: { fullName: string };
  createdAt: string;
  updatedAt: string;
}

// Dues Rule
export interface DuesRule {
  id: number;
  amount: number;
  dueDay: number;
  isActive: boolean;
  updatedAt: string;
}

export interface GroupDuesInfo {
  group: {
    id: number;
    name: string;
    type: string;
  };
  duesRule: DuesRule | null;
}

export interface DuesConfig {
  group: {
    id: number;
    name: string;
    type: string;
  };
  duesRule: DuesRule | null;
  children: GroupDuesInfo[];
}

// === Children Wallets (RW → RT) ===

export interface OfficerInfo {
  id: string;
  fullName: string;
  email: string;
}

export interface ChildWalletInfo {
  group: { id: number; name: string; type: string };
  balance: number;
  memberCount: number;
  admin: OfficerInfo | null;
  treasurer: OfficerInfo | null;
  duesRule: DuesRule | null;
  walletUpdatedAt: string | null;
}

export interface ChildrenWalletsData {
  rw: { id: number; name: string; balance: number };
  children: ChildWalletInfo[];
}

// === Group Finance Detail ===

export interface GroupFinanceDetail {
  group: { id: number; name: string; type: string; parentName?: string };
  admin: OfficerInfo | null;
  treasurer: OfficerInfo | null;
  wallet: { id: number; balance: number; updatedAt: string } | null;
  duesRule: DuesRule | null;
  transactions: Transaction[];
}

// === Transaction Detail ===

export interface TransactionDetail {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
  group: { id: number; name: string; type: string };
  createdBy: { id: string; fullName: string; email: string } | null;
  event: { id: string; title: string } | null;
  contribution: {
    id: string;
    month: number;
    year: number;
    amount?: number;
    user: { id: string; fullName: string; email: string };
  } | null;
  paymentGatewayTx?: PaymentGatewayTxInfo | null;
}

// === Hierarchy Data (for Organization) ===

export interface HierarchyOfficer {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

export interface HierarchyRtGroup {
  id: number;
  name: string;
  type: string;
  memberCount: number;
  admin: HierarchyOfficer | null;
  treasurer: HierarchyOfficer | null;
}

export interface HierarchyData {
  rw: {
    id: number;
    name: string;
    type: string;
    memberCount: number;
    leader: HierarchyOfficer | null;
    treasurer: HierarchyOfficer | null;
  };
  rtGroups: HierarchyRtGroup[];
}

// === Dues Progress (for TREASURER dues tracking) ===

export interface DuesProgressContribution {
  month: number;
  year: number;
  amount: number;
  paidAt: string;
}

export interface DuesProgressMember {
  id: string;
  fullName: string;
  phone: string | null;
  roleType: string;
  createdAt: string;
  lastPaidPeriod: string | null;
  contributions: DuesProgressContribution[];
}

export interface DuesProgressData {
  group: { id: number; name: string; type: string };
  year: number;
  duesRule: { amount: number; dueDay: number; isActive: boolean } | null;
  parentDuesRule: { amount: number; dueDay: number; isActive: boolean } | null;
  members: DuesProgressMember[];
}

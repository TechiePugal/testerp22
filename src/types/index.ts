export interface Company {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Unit {
  id: string;
  name: string;
  companyId: string;
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  unitId: string;
  companyId: string;
  createdAt: Date;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  applicableTo: 'staff' | 'labour' | 'both';
  isActive: boolean;
  createdAt: Date;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
  type: 'national' | 'religious' | 'company' | 'other';
  applicableTo: 'staff' | 'labour' | 'both';
  isRecurring: boolean;
  createdAt: Date;
}

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  dob: Date;
  address: string;
  phone: string;
  companyId: string;
  unitId: string;
  groupId: string;
  designation: string;
  dateOfJoining: Date;
  salaryPerDay: number;
  salaryPerMonth: number;
  esaPf: boolean;
  education: string;
  emergencyContact: string;
  aadharNo: string;
  panNo: string;
  maritalStatus: 'single' | 'married';
  salaryMode: 'cash' | 'account';
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  employeeType: 'staff' | 'labour';
  shiftId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: Date;
  shiftId: string;
  fnStatus: 'present' | 'absent';
  anStatus: 'present' | 'absent';
  otHours: number;
  permissionHours: number;
  actualStartTime?: string;
  actualEndTime?: string;
  createdAt: Date;
}

export interface Allowance {
  id: string;
  employeeId: string;
  date: Date;
  type: 'food' | 'advance';
  amount: number;
  createdAt: Date;
}

export interface SalaryReport {
  employee: Employee;
  totalWorkingDays: number;
  fnPresentDays: number;
  anPresentDays: number;
  totalPresentSessions: number;
  fnSalary: number;
  anSalary: number;
  basicSalary: number;
  otHours: number;
  otAmount: number;
  totalAllowances: number;
  permissionHours: number;
  excessPermissionDeduction: number;
  esaPfDeduction: number;
  netSalary: number;
}
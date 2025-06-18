import type { Employee, Attendance, Allowance, SalaryReport, Holiday } from '../types';

export const isHoliday = (date: Date, holidays: Holiday[]): boolean => {
  return holidays.some(holiday => {
    const holidayDate = new Date(holiday.date);
    return (
      holidayDate.getDate() === date.getDate() &&
      holidayDate.getMonth() === date.getMonth() &&
      (holidayDate.getFullYear() === date.getFullYear() || holiday.isRecurring)
    );
  });
};

export const isSunday = (date: Date): boolean => {
  return date.getDay() === 0;
};

export const isWorkingDay = (date: Date, holidays: Holiday[]): boolean => {
  return !isSunday(date) && !isHoliday(date, holidays);
};

export const getWorkingDaysInMonth = (year: number, month: number, holidays: Holiday[]): number => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (isWorkingDay(date, holidays)) {
      workingDays++;
    }
  }

  return workingDays;
};

export const parseTimeToMinutes = (timeString: string): number => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToHoursString = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const minutesToDecimalHours = (minutes: number): number => {
  return Math.round((minutes / 60) * 60) / 60;
};

// ✅ CORRECTED OT Calculation: OT only if working time >= 9 hours (540 minutes)
export const calculateAttendanceDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) {
    return {
      totalMinutes: 0,
      workingMinutes: 0,
      workingHours: 0,
      otMinutes: 0,
      otHours: 0,
      isOtEligible: false,
      workingDuration: '0h 0m',
      otDuration: '0h 0m'
    };
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  // Handle next day scenario
  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  // Deduct lunch break (45 minutes)
  const workingMinutes = Math.max(0, totalMinutes - 45);

  const standardWorkMinutes = 8 * 60; // 525 minutes
  const minimumOtThreshold = 8 * 60 + 30; // 540 minutes

  // Is eligible for OT if working time ≥ 9 hours
  const isOtEligible = workingMinutes >= minimumOtThreshold;

  // Calculate raw OT (working - standard)
  let rawOtMinutes = isOtEligible ? Math.max(0, workingMinutes - standardWorkMinutes) : 0;

  // ✅ OT counted only if > 20 mins
  const otMinutes = rawOtMinutes > 20 ? rawOtMinutes : 0;

  return {
    totalMinutes,
    workingMinutes,
    workingHours: minutesToDecimalHours(workingMinutes),
    otMinutes,
    otHours: minutesToDecimalHours(otMinutes),
    isOtEligible,
    workingDuration: minutesToHoursString(workingMinutes),
    otDuration: minutesToHoursString(otMinutes)
  };
};


export const calculateSalary = (
  employee: Employee,
  attendance: Attendance[],
  allowances: Allowance[],
  holidays: Holiday[],
  year: number,
  month: number
): SalaryReport => {
  const totalWorkingDays = getWorkingDaysInMonth(year, month, holidays);

  const monthAttendance = attendance.filter(att => {
    const attDate = new Date(att.date);
    return att.employeeId === employee.id && 
           attDate.getFullYear() === year && 
           attDate.getMonth() === month;
  });

  const monthAllowances = allowances.filter(all => {
    const allDate = new Date(all.date);
    return all.employeeId === employee.id &&
           allDate.getFullYear() === year && 
           allDate.getMonth() === month;
  });

  let fnPresentDays = 0;
  let anPresentDays = 0;
  let totalOtHours = 0;
  let totalPermissionHours = 0;
  let totalCalculatedOtHours = 0;

  monthAttendance.forEach(att => {
    if (att.fnStatus === 'present') fnPresentDays++;
    if (att.anStatus === 'present') anPresentDays++;

    if (att.otHours) {
      totalOtHours += att.otHours;
    } else if (att.actualStartTime && att.actualEndTime) {
      const duration = calculateAttendanceDuration(att.actualStartTime, att.actualEndTime);
      totalCalculatedOtHours += duration.otHours;
    }

    totalPermissionHours += att.permissionHours || 0;
  });

  if (totalOtHours === 0) {
    totalOtHours = totalCalculatedOtHours;
  }

  const totalPresentSessions = fnPresentDays + anPresentDays;

  let basicSalary = 0;
  let fnSalary = 0;
  let anSalary = 0;

  fnSalary = fnPresentDays * (employee.salaryPerDay / 2);
  anSalary = anPresentDays * (employee.salaryPerDay / 2);
  basicSalary = fnSalary + anSalary;

  const hourlyRate = employee.salaryPerDay / 8;
  const otAmount = totalOtHours * hourlyRate * 1.5;

  const totalAllowances = monthAllowances.reduce((sum, all) => sum + all.amount, 0);

  let excessPermissionDeduction = 0;
  if (employee.employeeType === 'staff' && totalPermissionHours > 2) {
    const excessHours = totalPermissionHours - 2;
    excessPermissionDeduction = excessHours * hourlyRate;
  }

  let esaPfDeduction = 0;
  if (employee.esaPf) {
    const grossSalary = basicSalary + otAmount;
    esaPfDeduction = grossSalary * 0.12;
  }

  const netSalary = basicSalary + otAmount - totalAllowances - excessPermissionDeduction - esaPfDeduction;

  return {
    employee,
    totalWorkingDays,
    fnPresentDays,
    anPresentDays,
    totalPresentSessions,
    fnSalary,
    anSalary,
    basicSalary,
    otHours: totalOtHours,
    otAmount,
    totalAllowances,
    permissionHours: totalPermissionHours,
    excessPermissionDeduction,
    esaPfDeduction,
    netSalary
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const formatTime = (time: string): string => {
  if (!time) return '';
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
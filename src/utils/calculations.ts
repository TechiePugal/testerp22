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

// Convert hours:minutes string to decimal hours for calculations
export const timeStringToDecimalHours = (timeString: string): number => {
  if (!timeString) return 0;
  
  // Handle formats like "1h 15m"
  if (timeString.includes('h')) {
    const match = timeString.match(/(\d+)h\s*(\d+)m/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      return hours + (minutes / 60);
    }
  }
  
  // Handle "1.25" decimal format
  if (timeString.includes('.')) {
    return parseFloat(timeString);
  }
  
  // Handle "1:15" format
  if (timeString.includes(':')) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
  }
  
  return parseFloat(timeString) || 0;
};

// Convert decimal hours to "Xh Ym" format
export const decimalHoursToTimeString = (decimalHours: number): string => {
  if (decimalHours === 0) return "0h 0m";
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  return `${hours}h ${minutes}m`;
};

// ✅ SIMPLIFIED OT CALCULATION: Only subtract 45min lunch, anything over 8hrs = OT
// Replace the calculateAttendanceDuration function with this:

export const calculateAttendanceDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) {
    return {
      totalMinutes: 0,
      workingMinutes: 0,
      workingHours: 0,
      otMinutes: 0,
      otHours: 0,
      otTimeString: '0h 0m',
      workingDuration: '0h 0m',
      otDuration: '0h 0m',
      isOtEligible: false
    };
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  // Handle next day scenario
  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // Add 24 hours for next day
  }

  // STEP 1: Subtract 45 minutes lunch break
  const workingMinutes = Math.max(0, totalMinutes - 45);
  const workingHours = workingMinutes / 60;

  // STEP 2: Calculate OT (anything over 8 hours)
  const standardHours = 8;
  const otHours = Math.max(0, workingHours - standardHours);
  const otMinutes = Math.round(otHours * 60);
  
  // ✅ DIRECT OT DURATION - Simple format
  let otDurationText = '0h 0m';
  if (otMinutes > 0) {
    const otHoursDisplay = Math.floor(otMinutes / 60);
    const otMinsDisplay = otMinutes % 60;
    otDurationText = `${otHoursDisplay}h ${otMinsDisplay}m`;
  }

  return {
    totalMinutes,
    workingMinutes,
    workingHours,
    otMinutes,
    otHours,
    otTimeString: otDurationText,
    workingDuration: minutesToHoursString(workingMinutes),
    otDuration: otDurationText, // ✅ This will show "3h 43m" directly
    isOtEligible: otMinutes > 0
  };
};

// Updated salary calculation with simplified OT logic
export const calculateSalary = (
  employee: Employee,
  attendance: Attendance[],
  allowances: Allowance[],
  holidays: Holiday[],
  year: number,
  month: number
): SalaryReport => {
  const totalWorkingDays = getWorkingDaysInMonth(year, month, holidays);

  // Filter attendance and allowances by actual date (not creation date)
  const monthAttendance = attendance.filter(att => {
    const attDate = new Date(att.date); // Use actual attendance date
    return att.employeeId === employee.id && 
           attDate.getFullYear() === year && 
           attDate.getMonth() === month;
  });

  const monthAllowances = allowances.filter(all => {
    const allDate = new Date(all.date); // Use actual allowance date
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

    // Handle both string ("1h 15m") and decimal (1.25) OT formats
    if (att.otHours) {
      if (typeof att.otHours === 'string') {
        totalOtHours += timeStringToDecimalHours(att.otHours);
      } else {
        totalOtHours += att.otHours;
      }
    } else if (att.actualStartTime && att.actualEndTime) {
      // ✅ Use simplified OT calculation
      const duration = calculateAttendanceDuration(att.actualStartTime, att.actualEndTime);
      totalCalculatedOtHours += duration.otHours;
    }

    totalPermissionHours += att.permissionHours || 0;
  });

  // Use calculated OT if no manual OT entered
  if (totalOtHours === 0) {
    totalOtHours = totalCalculatedOtHours;
  }

  const totalPresentSessions = fnPresentDays + anPresentDays;

  // Calculate per day salary based on employee type
  let perDaySalary = 0;
  if (employee.employeeType === 'staff') {
    // Staff: Monthly Salary ÷ Total Working Days
    perDaySalary = employee.monthlySalary / totalWorkingDays;
  } else {
    // Labour: Fixed Daily Wage
    perDaySalary = employee.dailySalary;
  }

  // Calculate basic salary using present days
  let basicSalary = 0;
  let fnSalary = 0;
  let anSalary = 0;

  // Total present days (full days + half days)
  const totalPresentDays = fnPresentDays + anPresentDays;
  
  // For session-based calculation
  fnSalary = fnPresentDays * (perDaySalary / 2);
  anSalary = anPresentDays * (perDaySalary / 2);
  basicSalary = fnSalary + anSalary;

  // Calculate OT amount using per hour salary
  const hourlyRate = perDaySalary / 8;
  const otAmount = totalOtHours * hourlyRate * 1.5;

  // Calculate allowances
  const totalAllowances = monthAllowances.reduce((sum, all) => sum + all.amount, 0);

  // Calculate excess permission deduction (for staff only)
  let excessPermissionDeduction = 0;
  if (employee.employeeType === 'staff' && totalPermissionHours > 2) {
    const excessHours = totalPermissionHours - 2;
    excessPermissionDeduction = excessHours * hourlyRate;
  }

  // Calculate ESA/PF deduction
  let esaPfDeduction = 0;
  if (employee.esaPf) {
    const grossSalary = basicSalary + otAmount;
    esaPfDeduction = grossSalary * 0.12;
  }

  // Calculate net salary
  const netSalary = basicSalary + otAmount + totalAllowances - excessPermissionDeduction - esaPfDeduction;

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
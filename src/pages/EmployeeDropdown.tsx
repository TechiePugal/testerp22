import React, { useState, useEffect, useRef } from "react";
import type { Employee } from "../types";

interface Props {
  employees: Employee[];
  attendanceForm: {
    employeeId: string;
    [key: string]: any;
  };
  setAttendanceForm: React.Dispatch<React.SetStateAction<any>>;
  editingAttendance: any;
}

const EmployeeSearchDropdown: React.FC<Props> = ({
  employees,
  attendanceForm,
  setAttendanceForm,
  editingAttendance
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredEmployees = employees.filter(
    emp =>
      emp.isActive &&
      (emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedEmployee = employees.find(emp => emp.id === attendanceForm.employeeId);

  useEffect(() => {
    if (selectedEmployee) {
      setSearchTerm(`${selectedEmployee.name} (${selectedEmployee.employeeId})`);
    } else {
      setSearchTerm("");
    }
  }, [attendanceForm.employeeId, employees]);

  const handleSelect = (employee: Employee) => {
    setAttendanceForm((prev: any) => ({ ...prev, employeeId: employee.id }));
    setIsDropdownOpen(false);
    setSearchTerm(`${employee.name} (${employee.employeeId})`);
  };

  // 🟡 Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsDropdownOpen(true);
        }}
        placeholder="Search by employee name or ID..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={!!editingAttendance}
        onFocus={() => setIsDropdownOpen(true)}
      />
      {isDropdownOpen && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((employee) => (
              <li
                key={employee.id}
                onClick={() => handleSelect(employee)}
                className="px-4 py-2 cursor-pointer hover:bg-blue-100"
              >
                {employee.name} ({employee.employeeId})
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-gray-500">No matching employees</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default EmployeeSearchDropdown;

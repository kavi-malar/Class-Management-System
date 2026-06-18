// ── Shared TypeScript Models — v3 ──────────────────────────────────────────

export interface User {
  _id: string; name: string; email: string;
  role: 'teacher' | 'student' | 'cr' | 'admin';
  phone: string; assignedSubject?: Subject;
  className?: string; isActive: boolean;
}
export interface Subject { _id: string; name: string; code: string; }
export interface ClassSection {
  _id: string; name: string; department: string;
  batch: string; semester: number; isActive: boolean;
}
export interface TimetableEntry {
  _id: string; dayOfWeek: string; periodNumber: number;
  startTime: string; endTime: string;
  subject: Subject; teacher: User; className: string;
  classroomNo: string; classroomUpdatedBy?: User; classroomUpdatedAt?: string;
  change?: TimetableChange; isChanged?: boolean; status?: string;
}
export interface TimetableChange {
  _id: string; changeDate: string;
  fixedTimetableEntry: string | TimetableEntry;
  teacher: User; subject: Subject;
  periodNumber: number; startTime: string; endTime: string;
  className: string; classroomNo?: string;
  changeType: string; status: 'cancelled' | 'available';
  reason: string; smsSent: boolean; createdAt: string;
}
export interface Notification {
  _id: string; recipient: string; recipientPhone: string;
  message: string; type: 'timetable_change' | 'daily_reminder' | 'general';
  timetableChange?: TimetableChange;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  twilioSid?: string; createdAt: string;
}
export interface RoomAllocation {
  _id: string; roomNumber: string;
  status: 'free' | 'occupied';
  occupiedByClass?: string; occupancyLabel?: string;
  projectorPresent: boolean;
  lastUpdatedBy?: User; lastUpdatedAt?: string;
}
export interface ProjectorInventory {
  _id: string; totalProjectors: number; availableProjectors: number;
}
export interface AuthResponse {
  success: boolean; message: string; token: string; user: User;
}

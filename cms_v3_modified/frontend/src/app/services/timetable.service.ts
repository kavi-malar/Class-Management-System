import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Fixed Timetable ──────────────────────────────────────────

  /** Fetch weekly timetable, optionally scoped to a specific class */
  getFixedTimetable(className?: string): Observable<any> {
    const qs = className ? `?className=${encodeURIComponent(className)}` : '';
    return this.http.get<any>(`${this.api}/timetable${qs}`);
  }

  /** Fetch timetable for a specific date, optionally scoped to a class */
  getTimetableForDate(date: string, className?: string): Observable<any> {
    const qs = className ? `?className=${encodeURIComponent(className)}` : '';
    return this.http.get<any>(`${this.api}/timetable/date/${date}${qs}`);
  }

  getTeacherTimetable(): Observable<any> {
    return this.http.get<any>(`${this.api}/timetable/teacher`);
  }

  /** Get distinct class names that this teacher teaches */
  getTeacherClasses(): Observable<any> {
    return this.http.get<any>(`${this.api}/timetable/teacher/classes`);
  }

  // ── NEW: Update classroom number (teacher = own period only, cr = any) ──
  updateClassroomNo(entryId: string, classroomNo: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/timetable/${entryId}/classroom`, { classroomNo });
  }

  // ── Timetable Changes (cancel / restore assigned periods) ────

  getChanges(params?: { date?: string; upcoming?: boolean; status?: string }): Observable<any> {
    const q = new URLSearchParams();
    if (params?.date)     q.set('date',     params.date);
    if (params?.upcoming) q.set('upcoming', 'true');
    if (params?.status)   q.set('status',   params.status as string);
    const qs = q.toString() ? `?${q}` : '';
    return this.http.get<any>(`${this.api}/changes${qs}`);
  }

  markUnavailable(fixedTimetableEntryId: string, changeDate: string, reason: string): Observable<any> {
    return this.http.post<any>(`${this.api}/changes`, { fixedTimetableEntryId, changeDate, reason });
  }

  restoreChange(changeId: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/changes/${changeId}/restore`, {});
  }

  cancelChange(changeId: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/changes/${changeId}`);
  }

  // ── Free Slots (offer extra classes on free periods) ─────────

  getMyPeriodsForDate(date: string): Observable<any> {
    return this.http.get<any>(`${this.api}/free-slots/my-periods?date=${date}`);
  }

  createFreeSlot(date: string, periodNumber: number, subjectId: string, note: string): Observable<any> {
    return this.http.post<any>(`${this.api}/free-slots`, { date, periodNumber, subjectId, note });
  }

  withdrawFreeSlot(slotId: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/free-slots/${slotId}/withdraw`, {});
  }

  getFreeSlots(params?: { date?: string; upcoming?: boolean; className?: string }): Observable<any> {
    const q = new URLSearchParams();
    if (params?.date)      q.set('date',      params.date);
    if (params?.upcoming)  q.set('upcoming',  'true');
    if (params?.className) q.set('className', params.className);
    const qs = q.toString() ? `?${q}` : '';
    return this.http.get<any>(`${this.api}/free-slots${qs}`);
  }
}

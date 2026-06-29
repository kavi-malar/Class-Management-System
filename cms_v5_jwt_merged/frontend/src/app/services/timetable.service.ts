import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private api = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getFixedTimetable(className?: string): Observable<any> {
    const qs = className ? `?className=${encodeURIComponent(className)}` : '';
    return this.http.get<any>(`${this.api}/timetable${qs}`);
  }

  getTimetableForDate(date: string, className?: string): Observable<any> {
    const qs = className ? `?className=${encodeURIComponent(className)}` : '';
    return this.http.get<any>(`${this.api}/timetable/date/${date}${qs}`);
  }

  getTeacherTimetable(): Observable<any> { return this.http.get<any>(`${this.api}/timetable/teacher`); }
  getTeacherClasses(): Observable<any>   { return this.http.get<any>(`${this.api}/timetable/teacher/classes`); }

  updateClassroomNo(entryId: string, classroomNo: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/timetable/${entryId}/classroom`, { classroomNo });
  }

  // Changes
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

  /** Feature 1: Get offerable cancelled slots (other teachers can offer extra class) */
  getOfferableSlots(): Observable<any> {
    return this.http.get<any>(`${this.api}/changes/offerable`);
  }

  // Free Slots
  getMyPeriodsForDate(date: string): Observable<any> {
    return this.http.get<any>(`${this.api}/free-slots/my-periods?date=${date}`);
  }

  /** Feature 1: cancelChangeId passed when claiming an offerable slot */
  createFreeSlot(date: string, periodNumber: number, subjectId: string, note: string, cancelChangeId?: string): Observable<any> {
    return this.http.post<any>(`${this.api}/free-slots`, { date, periodNumber, subjectId, note, cancelChangeId });
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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private api = `${environment.apiUrl}/admin`;
  constructor(private http: HttpClient) {}

  getDashboard(): Observable<any>  { return this.http.get<any>(`${this.api}/dashboard`); }
  getClasses(): Observable<any>    { return this.http.get<any>(`${this.api}/classes`); }
  createClass(data: any): Observable<any>  { return this.http.post<any>(`${this.api}/classes`, data); }
  updateClass(id: string, data: any): Observable<any> { return this.http.put<any>(`${this.api}/classes/${id}`, data); }
  deleteClass(id: string): Observable<any> { return this.http.delete<any>(`${this.api}/classes/${id}`); }

  getUsers(params?: any): Observable<any> {
    const q = new URLSearchParams(params || {});
    return this.http.get<any>(`${this.api}/users?${q}`);
  }
  createUser(data: any): Observable<any>  { return this.http.post<any>(`${this.api}/users`, data); }
  updateUser(id: string, data: any): Observable<any> { return this.http.put<any>(`${this.api}/users/${id}`, data); }
  deleteUser(id: string): Observable<any> { return this.http.delete<any>(`${this.api}/users/${id}`); }

  getTimetableOverview(className?: string): Observable<any> {
    const q = className ? `?className=${className}` : '';
    return this.http.get<any>(`${this.api}/timetable-overview${q}`);
  }
  updateProjectorCount(total: number): Observable<any> {
    return this.http.put<any>(`${this.api}/projectors`, { totalProjectors: total });
  }

  // ── Feature 3: Admin Timetable CRUD ─────────────────────────────────────────
  getTimetableClasses(): Observable<any> {
    return this.http.get<any>(`${this.api}/timetable-classes`);
  }
  getTimetableForClass(cls: string): Observable<any> {
    return this.http.get<any>(`${this.api}/timetable/${encodeURIComponent(cls)}`);
  }
  upsertTimetableEntry(data: any): Observable<any> {
    return this.http.put<any>(`${this.api}/timetable/entry`, data);
  }
  deleteTimetableEntry(data: any): Observable<any> {
    return this.http.delete<any>(`${this.api}/timetable/entry`, { body: data });
  }
  duplicateTimetable(data: any): Observable<any> {
    return this.http.post<any>(`${this.api}/timetable/duplicate`, data);
  }
  getSubjectsAndTeachers(): Observable<any> {
    return this.http.get<any>(`${this.api}/subjects-teachers`);
  }
}

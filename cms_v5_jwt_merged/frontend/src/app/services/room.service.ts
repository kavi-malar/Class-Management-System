import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private api = environment.apiUrl;
  constructor(private http: HttpClient) {}

  /** Legacy: raw DB rooms (manual state) */
  getRooms(): Observable<any>  { return this.http.get<any>(`${this.api}/rooms`); }

  /** NEW: Dynamic status computed from timetable + manual bookings */
  getRoomStatus(): Observable<any> { return this.http.get<any>(`${this.api}/rooms/status`); }

  /** NEW: Alias for getRoomStatus */
  getCurrentRooms(): Observable<any> { return this.http.get<any>(`${this.api}/rooms/current`); }

  /** NEW: Today's cancelled classes (Feature 3) */
  getTodayCancellations(): Observable<any> { return this.http.get<any>(`${this.api}/rooms/cancellations/today`); }

  getStats(): Observable<any>         { return this.http.get<any>(`${this.api}/rooms/stats`); }
  getAdminOverview(): Observable<any> { return this.http.get<any>(`${this.api}/rooms/admin/overview`); }

  occupyRoom(roomNumber: string, occupiedByClass: string, occupancyLabel: string, note?: string): Observable<any> {
    return this.http.post<any>(`${this.api}/rooms/${roomNumber}/occupy`, { occupiedByClass, occupancyLabel, note });
  }
  freeRoom(roomNumber: string): Observable<any> {
    return this.http.post<any>(`${this.api}/rooms/${roomNumber}/free`, {});
  }
  checkoutProjector(roomNumber: string): Observable<any> {
    return this.http.post<any>(`${this.api}/rooms/${roomNumber}/projector/checkout`, {});
  }
  returnProjector(roomNumber: string): Observable<any> {
    return this.http.post<any>(`${this.api}/rooms/${roomNumber}/projector/return`, {});
  }
}

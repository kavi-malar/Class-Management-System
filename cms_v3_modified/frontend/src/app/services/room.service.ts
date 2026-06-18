import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private api = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getRooms(): Observable<any>  { return this.http.get<any>(`${this.api}/rooms`); }
  getStats(): Observable<any>  { return this.http.get<any>(`${this.api}/rooms/stats`); }
  getAdminOverview(): Observable<any> { return this.http.get<any>(`${this.api}/rooms/admin/overview`); }

  occupyRoom(roomNumber: string, occupiedByClass: string, occupancyLabel: string): Observable<any> {
    return this.http.post<any>(`${this.api}/rooms/${roomNumber}/occupy`, { occupiedByClass, occupancyLabel });
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

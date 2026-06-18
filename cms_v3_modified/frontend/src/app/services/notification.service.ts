import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Get notifications for logged-in student */
  getNotifications(): Observable<any> {
    return this.http.get<any>(`${this.api}/notifications`);
  }

  /** Get ALL notifications across all students (debug) */
  getAllNotifications(): Observable<any> {
    return this.http.get<any>(`${this.api}/notifications/all`);
  }

  /** Manually trigger daily timetable reminder SMS */
  triggerDailyReminder(): Observable<any> {
    return this.http.post<any>(`${this.api}/notifications/daily-reminder`, {});
  }

  /** Send a test SMS to verify Twilio is working */
  sendTestSms(): Observable<any> {
    return this.http.post<any>(`${this.api}/notifications/test-sms`, {});
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, AuthResponse } from '../models';

/** Detect browser and OS from userAgent */
function getDeviceInfo(): { browser: string; system: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let system  = 'Unknown OS';

  if (ua.indexOf('Firefox') > -1)                              browser = 'Firefox';
  else if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1)                         browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1)                            browser = 'Edge';
  else if (ua.indexOf('Chrome') > -1)                          browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1)                          browser = 'Safari';

  if (ua.indexOf('Win') > -1)           system = 'Windows';
  else if (ua.indexOf('Mac') > -1)      system = 'MacOS';
  else if (ua.indexOf('X11') > -1)      system = 'UNIX';
  else if (ua.indexOf('Linux') > -1)    system = 'Linux';
  else if (/Android/.test(ua))          system = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) system = 'iOS';

  return { browser, system };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Login — sends email, password, browser, system to backend.
   * Backend embeds browser+system inside the JWT token.
   */
  login(email: string, password: string): Observable<AuthResponse> {
    const { browser, system } = getDeviceInfo();
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, {
      email, password, browser, system
    }).pipe(
      tap(res => {
        if (res.success) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  get currentUser(): User | null   { return this.currentUserSubject.value; }
  get isLoggedIn(): boolean         { return !!localStorage.getItem('token'); }
  get token(): string | null        { return localStorage.getItem('token'); }
  get isTeacher(): boolean          { return this.currentUser?.role === 'teacher'; }
  get isStudent(): boolean          { return this.currentUser?.role === 'student'; }
  get isCR(): boolean               { return this.currentUser?.role === 'cr'; }
  get isAdmin(): boolean            { return this.currentUser?.role === 'admin'; }

  private getStoredUser(): User | null {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  refreshUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/auth/me`).pipe(
      tap(res => {
        if (res.success) {
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }
}

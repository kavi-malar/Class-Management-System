import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, AuthResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
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

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Detect browser and OS from userAgent */
function getDeviceInfo(): { browser: string; system: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let system  = 'Unknown OS';

  if (ua.indexOf('Firefox') > -1)                           browser = 'Firefox';
  else if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1)                      browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1)                         browser = 'Edge';
  else if (ua.indexOf('Chrome') > -1)                       browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1)                       browser = 'Safari';

  if (ua.indexOf('Win') > -1)          system = 'Windows';
  else if (ua.indexOf('Mac') > -1)     system = 'MacOS';
  else if (ua.indexOf('X11') > -1)     system = 'UNIX';
  else if (ua.indexOf('Linux') > -1)   system = 'Linux';
  else if (/Android/.test(ua))         system = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) system = 'iOS';

  return { browser, system };
}

/**
 * AuthInterceptor
 * - Attaches Authorization: Bearer <token> to every request
 * - Attaches x-browser and x-system device fingerprint headers
 * - Redirects to /login on 401/403 responses
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.token;

    if (token) {
      const { browser, system } = getDeviceInfo();
      const cloned = req.clone({
        headers: req.headers
          .set('Authorization', `Bearer ${token}`)
          .set('x-browser', browser)
          .set('x-system', system)
      });
      return next.handle(cloned).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    }

    return next.handle(req);
  }
}

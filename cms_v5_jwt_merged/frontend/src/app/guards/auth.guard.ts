import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

function getDashboard(role: string): string {
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'cr')      return '/cr/dashboard';
  if (role === 'admin')   return '/admin/dashboard';
  return '/student/dashboard';
}

export const authGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn) {
    router.navigate(['/login'], {
      state: { alertMsg: 'Please log in to continue.' }
    });
    return false;
  }

  const requiredRole = route.data?.['role'];
  if (requiredRole && auth.currentUser?.role !== requiredRole) {
    router.navigate([getDashboard(auth.currentUser?.role || '')]);
    return false;
  }
  return true;
};

export const loginGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn) {
    router.navigate([getDashboard(auth.currentUser?.role || '')]);
    return false;
  }
  return true;
};

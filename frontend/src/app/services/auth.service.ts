import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'tenant' | 'landlord';
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:4000/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private readonly tokenStorageKey = 'token';
  private readonly userStorageKey = 'currentUser';

  constructor(private http: HttpClient) {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!this.isTokenUsable(token)) {
      this.clearAuthState();
      return;
    }

    const storedUser = localStorage.getItem(this.userStorageKey);
    if (storedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser) as User);
        return;
      } catch {
        this.clearAuthState();
        return;
      }
    }

    if (token) {
      try {
        const payload = this.decodeTokenPayload(token);
        if (payload?.role) {
          this.currentUserSubject.next({
            id: payload.userId,
            name: '',
            email: '',
            role: payload.role,
          });
        }
      } catch {
        this.clearAuthState();
      }
    }
  }

  register(userData: {
    name: string;
    email: string;
    password: string;
    role: 'tenant' | 'landlord';
    phone?: string;
  }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, userData);
  }

  login(credentials: {
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response) => {
          localStorage.setItem(this.tokenStorageKey, response.token);
          localStorage.setItem(this.userStorageKey, JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }),
      );
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(payload: {
    token: string;
    password: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, payload);
  }

  logout(): void {
    this.clearAuthState();
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!this.isTokenUsable(token)) {
      this.clearAuthState();
      return null;
    }

    return token;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private clearAuthState(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
    this.currentUserSubject.next(null);
  }

  private isTokenUsable(token: string | null): boolean {
    if (!token) {
      return false;
    }

    try {
      const payload = this.decodeTokenPayload(token);
      if (!payload?.userId || !payload?.role) {
        return false;
      }

      if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private decodeTokenPayload(token: string): any {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Malformed token');
    }

    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  }
}

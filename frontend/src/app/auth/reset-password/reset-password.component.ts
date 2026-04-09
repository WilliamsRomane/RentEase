import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  resetPasswordForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  get resetToken(): string {
    return this.route.snapshot.queryParamMap.get('token') || '';
  }

  onSubmit(): void {
    if (!this.resetToken) {
      this.snackBar.open('Reset link is missing or invalid.', 'Close', { duration: 4000 });
      return;
    }

    if (!this.resetPasswordForm.valid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.resetPasswordForm.value;
    if (password !== confirmPassword) {
      this.snackBar.open('Passwords do not match.', 'Close', { duration: 4000 });
      return;
    }

    this.loading = true;
    this.authService.resetPassword({ token: this.resetToken, password }).subscribe({
      next: (response) => {
        this.loading = false;
        this.snackBar.open(response.message, 'Close', { duration: 3000 });
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        const message = err?.error?.message || 'Could not reset password.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      },
    });
  }
}

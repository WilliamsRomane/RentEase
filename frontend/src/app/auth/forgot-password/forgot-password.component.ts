import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  loading = false;
  resetLink: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (!this.forgotPasswordForm.valid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.resetLink = null;

    this.authService.forgotPassword(this.forgotPasswordForm.value.email).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.resetToken) {
          this.resetLink = `/reset-password?token=${response.resetToken}`;
        }

        this.snackBar.open(response.message, 'Close', { duration: 4000 });
      },
      error: (err) => {
        this.loading = false;
        const message = err?.error?.message || 'Could not generate a reset link.';
        this.snackBar.open(message, 'Close', { duration: 4000 });
      },
    });
  }

  openResetLink(): void {
    if (!this.resetLink) {
      return;
    }

    this.router.navigateByUrl(this.resetLink);
  }
}

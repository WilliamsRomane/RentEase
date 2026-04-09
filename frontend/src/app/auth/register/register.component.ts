import { Component } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.registerForm = this.fb.group(
      {
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        role: ['tenant', Validators.required],
        phone: [''],
      },
      { validators: passwordMatchValidator },
    );

    const roleFromQuery = this.route.snapshot.queryParamMap.get('role');
    if (roleFromQuery === 'landlord' || roleFromQuery === 'tenant') {
      this.registerForm.patchValue({ role: roleFromQuery });
    }
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      const { confirmPassword, ...formData } = this.registerForm.value;
      if (!formData.phone) {
        delete formData.phone;
      }
      this.authService.register(formData).subscribe({
        next: (user) => {
          this.snackBar.open(
            'Registration successful! Please login.',
            'Close',
            { duration: 3000 },
          );
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.snackBar.open(
            'Registration failed: ' + err.error.message,
            'Close',
            { duration: 3000 },
          );
          this.loading = false;
        },
      });
      return;
    }

    this.registerForm.markAllAsTouched();
  }
}

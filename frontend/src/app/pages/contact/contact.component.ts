import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent {
  saving = false;

  feedbackForm = {
    name: '',
    email: '',
    subject: '',
    message: '',
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  submitFeedback(): void {
    if (
      !this.feedbackForm.name.trim() ||
      !this.feedbackForm.email.trim() ||
      !this.feedbackForm.subject.trim() ||
      this.feedbackForm.message.trim().length < 10
    ) {
      this.snackBar.open('Please complete the form before submitting.', 'Close', {
        duration: 3500,
      });
      return;
    }

    this.saving = true;
    this.http.post('http://localhost:4000/api/contact/feedback', this.feedbackForm).subscribe({
      next: () => {
        this.feedbackForm = {
          name: '',
          email: '',
          subject: '',
          message: '',
        };
        this.saving = false;
        this.snackBar.open('Feedback sent successfully.', 'Close', {
          duration: 3000,
        });
      },
      error: (err) => {
        this.saving = false;
        const validationMessage = err?.error?.errors?.[0]?.msg;
        const apiMessage = err?.error?.message;
        this.snackBar.open(
          validationMessage || apiMessage || 'Could not send feedback right now.',
          'Close',
          { duration: 4000 },
        );
      },
    });
  }
}

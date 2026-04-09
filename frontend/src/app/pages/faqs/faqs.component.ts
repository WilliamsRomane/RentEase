import { Component } from '@angular/core';

@Component({
  selector: 'app-faqs',
  templateUrl: './faqs.component.html',
  styleUrls: ['./faqs.component.scss'],
})
export class FaqsComponent {
  faqs = [
    {
      question: 'Can landlords manage more than one property?',
      answer:
        'Yes. The dashboard is structured to support multiple properties and their related tenant records.',
    },
    {
      question: 'Can tenants see their payment status?',
      answer:
        'Yes. Tenants can review payment details and stay aware of due dates from their dashboard.',
    },
    {
      question: 'Do I need separate accounts for tenants and landlords?',
      answer:
        'Each person should register with the role that matches how they use RentEase so the correct dashboard opens after login.',
    },
  ];
}

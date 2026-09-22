import {Injectable, inject} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

@Injectable({providedIn: 'root'})
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  information(message: string) {
    this.snackBar.open(message, 'Close', {duration: 1500});
  }
}

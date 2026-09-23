import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {PhotoSourceAuthService} from 'src/app/core/services/photo-source-auth.service';
import {ToastService} from 'src/app/core/services/toast.service';
import {
  PhotoSourceProcessingCommands,
  PhotoSourcesClient,
  UserPhotoSourceDto,
  UsersPhotoSourcesClient,
} from 'src/app/shared/models/photomap-backend.swagger';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {CardComponent} from 'src/app/shared/ui/card/card.component';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

// The generated enum names its members after their values; these are the backend's
// `PhotoSourceProcessingCommands.Start` and `.Stop`.
const START_PROCESSING = PhotoSourceProcessingCommands._1;
const STOP_PROCESSING = PhotoSourceProcessingCommands._2;

@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, CardComponent, DatePipe, IconComponent, SpinnerComponent],
})
export class PhotoSourceListComponent implements OnInit {
  readonly sources = signal<readonly UserPhotoSourceDto[]>([]);
  readonly isLoading = signal(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(PhotoSourceAuthService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly photoSourcesClient = inject(PhotoSourcesClient);

  private isProcessingRunning = false;

  // TODO: take user ID from cookies
  private userId = 1;

  ngOnInit(): void {
    this.refresh();
  }

  /**
   * Hands off to the source's own page, which runs the OAuth flow and handles the provider's
   * redirect back. `relativeAuthUrl` is the route the backend seeds as that source's redirect URI.
   */
  authorize(sourceId: number | undefined) {
    if (sourceId === undefined) {
      return;
    }

    this.photoSourcesClient
      .getSourceAuthSettings(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (authSettings) => {
          if (authSettings?.relativeAuthUrl) {
            this.authService.requestAutoStart();
            this.router.navigate([authSettings.relativeAuthUrl]);
          }
        },
        error: () => this.toastService.error('Could not load the authorization settings for this source.'),
      });
  }

  sendProcessingCommand(sourceId: number | undefined) {
    if (sourceId === undefined) {
      return;
    }

    this.usersPhotoSourcesClient
      .sourceProcessing(this.userId, sourceId, this.isProcessingRunning ? STOP_PROCESSING : START_PROCESSING)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.toastService.error('Could not send the processing command.'),
      });

    this.isProcessingRunning = !this.isProcessingRunning;
  }

  private refresh(): void {
    this.isLoading.set(true);

    this.usersPhotoSourcesClient
      .getUserPhotoSources(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sources) => {
          this.sources.set(sources);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toastService.error('Could not load photo sources.');
        },
      });
  }
}

import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {Observable} from 'rxjs';
import {OAuthConfiguration} from '../../core/models/oauth-configuration.model';
import {untilDestroyed} from '@ngneat/until-destroy';
import {UserPhotoSourcesService} from 'src/app/core/services/user-photo-sources.service';
import {UserPhotoSourceSettings} from 'src/app/core/models/user-photo-source-settings.model';

@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OAuthConfiguration],
})
export class PhotoSourceListComponent implements OnInit {
  userPhotoSourceSettings$: Observable<UserPhotoSourceSettings[]>;
  displayedColumns = ['id', 'name', 'isUserAuthorized'];

  constructor(private userPhotoSourcesService: UserPhotoSourcesService) {}

  ngOnInit(): void {
    this.userPhotoSourceSettings$ = this.userPhotoSourcesService.getUserPhotoSourceSettings(1).pipe(untilDestroyed(this));
  }
}

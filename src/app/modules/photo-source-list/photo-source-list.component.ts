import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {Observable} from 'rxjs';
import {OAuthConfiguration} from '../../core/models/oauth-configuration.model';
import {untilDestroyed} from '@ngneat/until-destroy';
import {UserPhotoSourceDto, UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';

@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OAuthConfiguration],
})
export class PhotoSourceListComponent implements OnInit {
  userPhotoSourceSettings$: Observable<UserPhotoSourceDto[]>;
  displayedColumns = ['id', 'name', 'isUserAuthorized'];

  constructor(private usersPhotoSourcesClient: UsersPhotoSourcesClient) {}

  ngOnInit(): void {
    this.userPhotoSourceSettings$ = this.usersPhotoSourcesClient.getUserPhotoSources(1).pipe(untilDestroyed(this));
  }
}

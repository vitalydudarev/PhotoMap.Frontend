import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { Observable } from "rxjs";
import { OAuthConfiguration } from "../../core/models/oauth-configuration.model";
import { PhotoSourcesService } from "src/app/core/services/photo-sources.service";
import { PhotoSource } from "src/app/core/models/photo-source.model";
import { untilDestroyed } from "@ngneat/until-destroy";

@Component({
  selector: "app-photo-source-list",
  templateUrl: "./photo-source-list.component.html",
  styleUrls: ["./photo-source-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OAuthConfiguration],
})
export class PhotoSourceListComponent implements OnInit {
  photoSources$: Observable<PhotoSource[]>;

  constructor(private photoSourcesService: PhotoSourcesService) {}

  ngOnInit(): void {
    this.photoSources$ = this.photoSourcesService
      .getSources()
      .pipe(untilDestroyed(this));
  }
}

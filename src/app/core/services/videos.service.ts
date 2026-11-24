import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {VideoFacets} from '../models/facets.model';
import {TagSuggestion, VideoTags} from '../models/photo-tag.model';
import {FailedFile} from '../models/failed-file.model';
import {PagedResponse} from '../models/paged-response.model';
import {VideoLocation} from '../models/photo-location.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {PhotoSourceProgress} from '../models/photo-source-progress.model';
import {Video, VideoDuplicateGroup} from '../models/video.model';

/** The backend's `PhotoSourceProcessingCommands` the videos of a source take. */
export enum VideoProcessingCommand {
  Start = 1,
  Stop = 2,
  /** Processes again only the videos that failed, without listing the disk. */
  RetryFailed = 3,
}

/**
 * The videos imported from the photo sources, and their processing, which runs apart from the one of the photos.
 * Only Yandex.Disk sources have their videos imported.
 */
@Injectable({providedIn: 'root'})
export class VideosService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  /**
   * @param folderPaths The folders to take the videos from, all of them when empty.
   * @param years The years, in UTC, the videos were taken in, all of them when empty.
   * @param locationIds The locations the videos were taken in, any of them; with neither these nor `unknownLocation`,
   * the videos taken anywhere, and those in no location.
   * @param unknownLocation Whether the videos in no location are taken too: those with no GPS, not geocoded yet, or
   * where the geocoding found nothing.
   * @param tagIds The tags the videos have, any of them, which are those of the photos too; with neither these nor
   * `untagged`, the videos with and without tags.
   * @param untagged Whether the videos with no tag are taken too; only they are when no tag is given.
   */
  getUserVideos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    folderPaths: readonly string[] = [],
    years: readonly number[] = [],
    locationIds: readonly number[] = [],
    unknownLocation = false,
    tagIds: readonly number[] = [],
    untagged = false,
  ): Observable<PagedResponse<Video>> {
    const params = videoFilterParams(
      new HttpParams().set('top', top).set('skip', skip).set('sort', sort),
      folderPaths,
      years,
      locationIds,
      unknownLocation,
      tagIds,
      untagged,
    );

    return this.httpClient.get<PagedResponse<Video>>(`${this.url}/${userId}/videos`, {params});
  }

  /**
   * The videos with a GPS location that the filter takes, every one of them, oldest first, for a map, which clusters
   * them, so it has no pages. The filter is that of `getUserVideos`.
   */
  getUserGeotaggedVideos(
    userId: number,
    folderPaths: readonly string[],
    years: readonly number[],
    locationIds: readonly number[],
    unknownLocation: boolean,
    tagIds: readonly number[] = [],
    untagged = false,
  ): Observable<Video[]> {
    const params = videoFilterParams(new HttpParams(), folderPaths, years, locationIds, unknownLocation, tagIds, untagged);

    return this.httpClient.get<Video[]>(`${this.url}/${userId}/videos/geotagged`, {params});
  }

  /**
   * What the videos the filter takes can still be narrowed down to, for each of its filters, see {@link VideoFacets}.
   * The filter is that of `getUserVideos`.
   * @param withGps Whether only the videos with a GPS location are counted, as a map shows them.
   */
  getUserVideoFacets(
    userId: number,
    folderPaths: readonly string[],
    years: readonly number[],
    locationIds: readonly number[],
    unknownLocation: boolean,
    withGps = false,
    tagIds: readonly number[] = [],
    untagged = false,
  ): Observable<VideoFacets> {
    let params = videoFilterParams(new HttpParams(), folderPaths, years, locationIds, unknownLocation, tagIds, untagged);

    if (withGps) {
      params = params.set('gps', true);
    }

    return this.httpClient.get<VideoFacets>(`${this.url}/${userId}/videos/facets`, {params});
  }

  /**
   * Replaces the tags of the video, which are those of the photos too. A name the user has a tag of, whatever its case,
   * takes that tag, as it is written; the other names make new tags.
   * @returns The names of the tags of the video, by name.
   */
  setVideoTags(userId: number, videoId: string, names: readonly string[]): Observable<string[]> {
    return this.httpClient.put<string[]>(`${this.url}/${userId}/videos/${videoId}/tags`, names);
  }

  /**
   * Adds the tags to the videos, keeping the tags they have; the tags are those of the photos too. A name the user has
   * a tag of, whatever its case, takes that tag; the other names make new tags. The videos are all given the tags, or
   * none of them is.
   * @returns The tags of each video once they were added.
   */
  addVideoTags(userId: number, videoIds: readonly string[], names: readonly string[]): Observable<VideoTags[]> {
    return this.httpClient.post<VideoTags[]>(`${this.url}/${userId}/videos/tags`, {videoIds, tags: names});
  }

  /** Tags for the video by when and where it was taken, by the photos and videos taken around it, the likeliest first. */
  getVideoTagSuggestions(userId: number, videoId: string): Observable<TagSuggestion[]> {
    return this.httpClient.get<TagSuggestion[]>(`${this.url}/${userId}/videos/${videoId}/tags/suggestions`);
  }

  /** The years, in UTC, the videos of the user were taken in, oldest first. */
  getUserVideoYears(userId: number): Observable<number[]> {
    return this.httpClient.get<number[]>(`${this.url}/${userId}/videos/years`);
  }

  /** The folders the videos of the user are in, without the file names, by name. */
  getUserVideoFolders(userId: number): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.url}/${userId}/videos/folders`);
  }

  /** The locations the videos of the user were taken in, by level, from the countries down, and by name. */
  getUserVideoLocations(userId: number): Observable<VideoLocation[]> {
    return this.httpClient.get<VideoLocation[]>(`${this.url}/${userId}/videos/locations`);
  }

  /**
   * The videos of the user that are copies of one another, by their groups, the largest videos first. The groups are
   * looked for in the background, so a video imported a moment ago may not be in one yet.
   */
  getUserVideoDuplicates(userId: number): Observable<VideoDuplicateGroup[]> {
    return this.httpClient.get<VideoDuplicateGroup[]>(`${this.url}/${userId}/videos/duplicates`);
  }

  runCommand(userId: number, sourceId: number, command: VideoProcessingCommand): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/videos`, command);
  }

  /** The status of the processing of the videos of the source, as last saved by a run. */
  getStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this.httpClient.get<PhotoSourceProgress>(`${this.url}/${userId}/photo-sources/${sourceId}/videos/status`);
  }

  /** The videos of the source whose previews failed and are not saved yet, in the order they first failed. */
  getFailedFiles(userId: number, sourceId: number): Observable<FailedFile[]> {
    return this.httpClient.get<FailedFile[]>(`${this.url}/${userId}/photo-sources/${sourceId}/videos/failed-files`);
  }

  /** Deletes the videos imported from the source, so that processing them again starts over. */
  deleteData(userId: number, sourceId: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.url}/${userId}/photo-sources/${sourceId}/videos`);
  }
}

/** The query that asks for the videos the filter takes, added to the one given. */
function videoFilterParams(
  params: HttpParams,
  folderPaths: readonly string[],
  years: readonly number[],
  locationIds: readonly number[],
  unknownLocation: boolean,
  tagIds: readonly number[] = [],
  untagged = false,
): HttpParams {
  for (const folderPath of folderPaths) {
    params = params.append('folder', folderPath);
  }

  for (const year of years) {
    params = params.append('year', year);
  }

  for (const locationId of locationIds) {
    params = params.append('location', locationId);
  }

  if (unknownLocation) {
    params = params.set('unknownLocation', true);
  }

  for (const tagId of tagIds) {
    params = params.append('tag', tagId);
  }

  if (untagged) {
    params = params.set('untagged', true);
  }

  return params;
}

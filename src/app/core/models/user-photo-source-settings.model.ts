import {AuthResult} from './auth-result.model';

export interface UserPhotoSourceSettings {
  userId: number;
  photoSourceId: number;
  photoSourceName: string;
  authResult?: AuthResult;
  isUserAuthorized: number;
}

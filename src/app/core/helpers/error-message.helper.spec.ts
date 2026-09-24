import {HttpErrorResponse} from '@angular/common/http';

import {ApiException} from '../../shared/models/photomap-backend.swagger';
import {errorMessage} from './error-message.helper';

describe('errorMessage', () => {
  it('adds the validation errors of a 400 response', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {title: 'One or more validation errors occurred.', status: 400, errors: {top: ["The value 'abc' is not valid."]}},
    });

    expect(errorMessage('Could not load the photos.', error)).toBe("Could not load the photos. The value 'abc' is not valid.");
  });

  it('falls back to the title, then the detail of a problem', () => {
    expect(errorMessage('Failed.', new HttpErrorResponse({status: 404, error: {title: 'Not Found'}}))).toBe('Failed. Not Found.');
    expect(errorMessage('Failed.', new HttpErrorResponse({status: 500, error: {detail: 'The database is down'}}))).toBe(
      'Failed. The database is down.',
    );
  });

  it('uses a plain text body, even one HttpClient failed to parse as JSON', () => {
    const unparsed = new HttpErrorResponse({status: 400, error: {error: new SyntaxError(), text: '2201W: LIMIT must not be negative'}});

    expect(errorMessage('Failed.', unparsed)).toBe('Failed. 2201W: LIMIT must not be negative.');
    expect(errorMessage('Failed.', new HttpErrorResponse({status: 400, error: 'Bad input'}))).toBe('Failed. Bad input.');
  });

  it('says when the server could not be reached', () => {
    expect(errorMessage('Failed.', new HttpErrorResponse({status: 0}))).toBe('Failed. The server could not be reached.');
    expect(errorMessage('Failed.', new ApiException('An unexpected server error occurred.', 0, '', {}, null))).toBe(
      'Failed. The server could not be reached.',
    );
  });

  it('names the status when the body says nothing useful', () => {
    expect(errorMessage('Failed.', new HttpErrorResponse({status: 502, statusText: 'Bad Gateway', error: '<html></html>'}))).toBe(
      'Failed. The server responded 502 Bad Gateway.',
    );
  });

  it('reads the response text of an ApiException from the generated clients', () => {
    const error = new ApiException('An unexpected server error occurred.', 400, '{"errors":{"id":["The id is required."]}}', {}, null);

    expect(errorMessage('Failed.', error)).toBe('Failed. The id is required.');
  });

  it('leaves the message alone for errors that are not responses', () => {
    expect(errorMessage('Failed.', new Error('boom'))).toBe('Failed.');
    expect(errorMessage('Failed.', undefined)).toBe('Failed.');
  });
});

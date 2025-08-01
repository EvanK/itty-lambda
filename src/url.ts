import { text } from 'node:stream/consumers';

import type {
  LambdaFunctionURLEvent,
  LambdaFunctionURLResult,
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

import type { EventOptions, ResponseOptions } from './util'; 

import { combineHeaders, combineQuery, splitHeaders } from './util';

/**
 * Accepts an event from an AWS Lambda function invocation by way of a
 * function url, and formats it into a request suitable for routing through
 * itty-router.
 * 
 * @param event 
 * @param options
 */
export async function eventToRequest(event: LambdaFunctionURLEvent, options: EventOptions | undefined): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  // no multi value headers to muck with here
  output.headers = combineHeaders(event?.headers, undefined);

  // assemble well-formed url with sane defaults
  const proto = event?.headers?.['x-forwarded-proto'] ?? 'http';
  const host = event?.headers?.host ?? event?.requestContext?.domainName ?? 'localhost.localdomain';
  const path = event?.rawPath ?? event?.requestContext?.http?.path ?? '';
  const queryString = event?.rawQueryString ?? combineQuery(event?.queryStringParameters, undefined);
  output.url = `${proto}://${host}${path}?${queryString}`;

  // and http method
  output.method = event?.requestContext?.http?.method ?? options?.defaultMethod ?? 'GET';

  // base64 decode body, if necessary
  if (event?.body) {
    output.body = event?.isBase64Encoded
      ? Buffer.from(event?.body ?? '', 'base64').toString('ascii')
      : event?.body
    ;
  }

  return output;
}

/**
 * Accepts a response from itty-router (or undefined if no route was matched),
 * and formats it into a result suitable to return to the Lambda service and
 * subsequently to the client invoking the function url.
 * 
 * If no response was provided, an error response is built with the given
 * fallback HTTP status, defaulting to 404.
 * 
 * @param response 
 * @param options 
 */
export async function responseToResult(response: Response | undefined, options: ResponseOptions | undefined): Promise<LambdaFunctionURLResult> {
  options = Object.assign({ base64Encode: false, fallbackStatus: 404, multiValueHeaders: false }, options);
  try {
    return await parseResponseOrError(response ?? error(options.fallbackStatus, 'Response not found'), options);
  } catch(err: any) {
    return await parseResponseOrError(error(err), options);
  }
}

async function parseResponseOrError(input: Response, options: ResponseOptions): Promise<LambdaFunctionURLResult> {
  const output: LambdaFunctionURLResult = { statusCode: 200, isBase64Encoded: !!options.base64Encode };

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // lambda function urls don't support multi headers
  const { headers: singleHeaders } = splitHeaders(headers, false);

  output.headers = {};
  for (const [key, value] of Object.entries(singleHeaders)) {
    if (undefined !== value) output.headers[key] = value;
  }

  // un-streamify body as necessary
  if (body) {
    output.body = await text(body);
    if (options.base64Encode) {
      output.body = Buffer.from(output.body, 'utf-8').toString('base64');
    }
  }

  return output;
}

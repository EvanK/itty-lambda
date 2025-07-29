import { text } from 'node:stream/consumers';

import type {
  LambdaFunctionURLEvent,
  LambdaFunctionURLResult,
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

import { combineQuery, splitHeaders } from './util';

/**
 * Accepts an event from an AWS Lambda function invocation by way of a
 * function url, and formats it into a request suitable for routing through
 * itty-router.
 * 
 * @param {LambdaFunctionURLEvent} event 
 * @returns {Promise<RequestLike>}
 */
export async function eventToRequest(event: LambdaFunctionURLEvent): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  // no multi value headers to muck with here
  output.headers = event?.headers ?? {};

  // assemble well-formed url with sane defaults
  const proto = event?.headers?.['x-forwarded-proto'] ?? 'http';
  const host = event?.headers?.host ?? event?.requestContext?.domainName ?? 'localhost.localdomain';
  const path = event?.rawPath ?? event?.requestContext?.http?.path ?? '';
  const queryString = event?.rawQueryString ?? combineQuery(event?.queryStringParameters ?? {}, {});
  output.url = `${proto}://${host}${path}?${queryString}`;

  // and http method
  output.method = event?.requestContext?.http?.method ?? '';

  // base64 decode body, if necessary
  if (event.isBase64Encoded) {
    output.body = Buffer.from(event.body ?? '', 'base64').toString('ascii');
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
 * @param {Response|undefined} response 
 * @param {number} [fallbackStatus=404] 
 * @returns {Promise<LambdaFunctionURLResult>}
 */
export async function responseToResult(response: Response | undefined): Promise<LambdaFunctionURLResult> {
  try {
    return parseResponseOrError(response ?? error(404, 'Route not found'));
  } catch(err: any) {
    return parseResponseOrError(error(err));
  }
}

async function parseResponseOrError(input: any): Promise<LambdaFunctionURLResult> {
  const output: LambdaFunctionURLResult = { statusCode: 200, isBase64Encoded: false };

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // handle single or multi headers
  const { headers: singleHeaders } = splitHeaders(headers);

  output.headers = {};
  for (const [key, value] of Object.entries(singleHeaders)) {
    if (undefined !== value) output.headers[key] = value;
  }

  // un-streamify body as necessary
  output.body = await text(body);

  return output;
}

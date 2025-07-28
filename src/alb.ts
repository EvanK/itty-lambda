import { text } from 'node:stream/consumers';

import type {
  /*LambdaFunctionURLEvent, APIGatewayProxyEvent,*/
  ALBEvent,
  ALBResult
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

import { error } from 'itty-router';

import { combineHeaders, combineQuery, splitHeaders } from './util';

export async function fromEvent(event: ALBEvent): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  // combine any single and/or multi value headers
  output.headers = combineHeaders(event?.headers ?? {}, event?.multiValueHeaders ?? {});

  // assemble well-formed url with sane defaults
  const proto = event?.headers?.['x-forwarded-proto'] ?? 'http';
  const host = event?.headers?.host ?? 'localhost.localdomain';
  const path = event?.path ?? '';
  const queryString = combineQuery(event?.queryStringParameters ?? {}, event?.multiValueQueryStringParameters ?? {});
  output.url = `${proto}://${host}${path}?${queryString}`;

  // and http method
  output.method = event?.httpMethod ?? '';

  // base64 decode body, if necessary
  if (event.isBase64Encoded) {
    output.body = Buffer.from(event.body ?? '', 'base64').toString('ascii');
  }

  return output;
}

export async function fromResponse(response: Response | undefined): Promise<ALBResult> {
  try {
    return parseResponseOrError(response ?? error(404, 'Route not found'));
  } catch(err: any) {
    return parseResponseOrError(error(err));
  }
}

async function parseResponseOrError(input: any): Promise<ALBResult> {
  const output: ALBResult = { statusCode: 200, isBase64Encoded: false };

  // destructure just what we need
  const { status, headers, body } = input;

  output.statusCode = status;

  // const removeUndefs = (obj: object) => Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);

  // handle single or multi headers
  const { headers: singleHeaders, multiValueHeaders } = splitHeaders(headers);

  output.headers = {};
  for (const [key, value] of Object.entries(singleHeaders)) {
    if (undefined !== value) output.headers[key] = value;
  }

  output.multiValueHeaders = {};
  for (const [key, value] of Object.entries(multiValueHeaders)) {
    if (undefined !== value) output.multiValueHeaders[key] = value;
  }

  // un-streamify body as necessary
  output.body = await text(body);

  return output;
}

import type {
  ALBEvent,
  APIGatewayProxyEvent,
  LambdaFunctionURLEvent,

  ALBEventHeaders,
  ALBEventMultiValueHeaders,

  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,

  ALBEventQueryStringParameters,
  ALBEventMultiValueQueryStringParameters,

  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventMultiValueQueryStringParameters,
} from 'aws-lambda';

import type { RequestLike } from 'itty-router';

export interface EventOptions {
  /**
   * @defaultValue `GET`
   */
  defaultMethod: string;
}

export interface ResponseOptions {
  /**
   * @defaultValue `false`
   */
  base64Encode: boolean;
  /**
   * @defaultValue `404`
   */
  fallbackStatus: number;
  /**
   * @defaultValue `false`
   */
  multiValueHeaders: boolean;
}

export async function eventToRequest(
  event: APIGatewayProxyEvent | ALBEvent | LambdaFunctionURLEvent,
  options : EventOptions | undefined
): Promise<RequestLike> {
  const output: RequestLike = { method: '', url: '' };

  output.headers = objectsToHeaders(
    event?.headers,
    // account for lambda function urls not supporting multi values
    ('multiValueHeaders' in event) ? event.multiValueHeaders : undefined
  );

  // infer protocol from headers when available
  const proto = output.headers.get('x-forwarded-proto')
    ?? output.headers.get('forwarded')?.match(/proto=(\w+)/)?.[1]
    ?? 'http'
  ;

  // infer host when available
  const host = (
      // ag ur url may have domain name
      ('requestContext' in event && 'domainName' in event.requestContext) ? event.requestContext.domainName : undefined
    )
    ?? output.headers.get('host')
    ?? output.headers.get('x-forwarded-host')
    ?? output.headers.get('forwarded')?.match(/host=([^;]+)/)?.[1]
    ?? 'localhost.localdomain'
  ;

  // infer path when available
  const path = (
      // ag or alb may have path
      ('path' in event) ? event.path : undefined
    )
    ?? (
      // url may have rawPath
      ('rawPath' in event) ? event.rawPath : undefined
    )
    ?? (
      // alb may have requestContext.path
      ('requestContext' in event && 'path' in event.requestContext) ? event.requestContext.path : undefined
    )
    ?? (
      // url may have requestContext.http.path
      ('requestContext' in event && 'http' in event.requestContext && 'path' in event.requestContext.http) ? event.requestContext.http.path : undefined
    )
    ?? ''
  ;

  // infer querystring and convert to string as necessary
  const queryString = (
      // url may have rawQueryString
      ('rawQueryString' in event) ? event.rawQueryString : undefined
    )
    ?? objectsToQueryString(
      event?.queryStringParameters,
      (
        // ag or alb may have multiValueQueryStringParameters
        ('multiValueQueryStringParameters' in event) ? event.multiValueQueryStringParameters : undefined
      )
    )
  ;

  // assemble well-formed url from inferred values above
  output.url = `${proto}://${host}${path}?${queryString}`;

  // infer or default http method
  output.method =
    (
      // ag or alb may have httpMethod
      ('httpMethod' in event) ? event.httpMethod : undefined
    )
    ?? (
      // ag may have requestContext.httpMethod
      ('requestContext' in event && 'httpMethod' in event.requestContext) ? event.requestContext.httpMethod : undefined
    )
    ?? (
      // url may have requestContext.http.method
      ('requestContext' in event && 'http' in event.requestContext && 'method' in event.requestContext.http) ? event.requestContext.http.method : undefined
    )
    ?? options?.defaultMethod
    ?? 'GET'
  ;

  // get and decode as necessary any request body
  if (event?.body) {
    output.body = event?.isBase64Encoded
      ? Buffer.from(`${event?.body}`, 'base64').toString('ascii')
      : event?.body
    ;
  }

  return output;
}

/**
 * Combine single and multi value header objects and convert to standardized
 * Headers instance.
 */
export function objectsToHeaders(
  single: ALBEventHeaders | APIGatewayProxyEventHeaders | undefined,
  multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders | undefined
): Headers {
  const input: { [name: string]: string[] } = {};

  // add each single value header, wrapped in array
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (value) input[key] = [ value ];
    }
  }

  // and each multi value header
  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      if (values) {
        // merge with any existing arrays of values
        if (undefined === input?.[key]) {
          input[key] = values;
        } else {
          for (const value of values) {
            if (!input[key].includes(value)) input[key].push(value);
          }
        }
      }
    }
  }

  // append each normalized array to new Headers instance
  const output = new Headers();
  for (const [key, values] of Object.entries(input)) {
    for (const value of values) {
      output.append(key, value);
    }
  }

  return output;
}

/**
 * Split Headers instance into single and (when explicitly enabled) multi value
 * header objects.
 */
export function headersToObjects(headers: Headers, splitIntoMultiValues = false): { // headersToObjects
  headers: ALBEventHeaders | APIGatewayProxyEventHeaders,
  multiValueHeaders: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders
} {
  const single: ALBEventHeaders | APIGatewayProxyEventHeaders = {};
  const multi: ALBEventMultiValueHeaders | APIGatewayProxyEventMultiValueHeaders = {};

  for (const [key, value] of headers.entries() ) {
    if (splitIntoMultiValues && value.includes(',')) {
      multi[key] = value.split(/\s*,\s*/);
    } else {
      single[key] = value;
    }
  }

  return { headers: single, multiValueHeaders: multi };
}

/**
 * Combine single and multi value query string parameters into a well formed
 * query string, as produced by the URLSearchParams global.
 */
export function objectsToQueryString(
  single: ALBEventQueryStringParameters | APIGatewayProxyEventQueryStringParameters | undefined | null,
  multi: ALBEventMultiValueQueryStringParameters | APIGatewayProxyEventMultiValueQueryStringParameters | undefined | null
): string {
  const output = new URLSearchParams();

  // include all single value query params by default
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (undefined !== value) output.append(key, value);
    }
  }

  // and all multi value query params that don't already contain same value
  if (multi) {
    for (const [key, value] of Object.entries(multi)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (!output.has(key, v)) output.append(key, v);
        }
      }
    }
  }

  return output.toString();
}

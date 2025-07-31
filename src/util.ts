import type {
  ALBEventHeaders,
  ALBEventMultiValueHeaders,

  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,

  ALBEventQueryStringParameters,
  ALBEventMultiValueQueryStringParameters,

  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventMultiValueQueryStringParameters,
} from 'aws-lambda';

/**
 * Combine single and multi value headers into standardized Headers instance.
 */
export function combineHeaders(
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
 * Split headers into single and multi value headers (when explicitly enabled).
 */
export function splitHeaders(headers: Headers, splitIntoMultiValues = false): {
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
 * 
 * ```
 * combineQuery(
 *   { alpha: 'abc', bravo: 'def', charlie: 'ghi' },
 *   { alpha: ['xyz'], charlie: ['uvw', 'wvu'], delta, ['jlk'] }
 * ) : 'alpha=abc&alpha=xyz&bravo=def&charlie=ghi&charlie=uvw&charlie=wvu&delta=jlk'
 * ```
 */
export function combineQuery(
  single: ALBEventQueryStringParameters | APIGatewayProxyEventQueryStringParameters | undefined,
  multi: ALBEventMultiValueQueryStringParameters | APIGatewayProxyEventMultiValueQueryStringParameters | undefined
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

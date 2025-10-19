# `itty-lambda` - AWS Lambda support for [itty-router]

[
  ![ci status](https://github.com/EvanK/itty-lambda/actions/workflows/ci.yaml/badge.svg)
](https://github.com/EvanK/itty-lambda/actions/workflows/ci.yaml)
[
  ![node.js support as of v20](https://img.shields.io/badge/Node.js-v20-yellow)
](https://nodejs.org/docs/latest-v20.x/api/)

[
  ![npm](https://nodei.co/npm/itty-lambda.png)
](https://www.npmjs.com/package/itty-lambda)

AWS Lambda functions can respond to HTTP requests via one of the following invocation types:
- [Function urls][lambda-function-urls]
- [API gateways][api-gateways]
- [Application load balancers][albs].

This library aims to maintain support for running [itty-router] in any such environment.


## Example

```js
// supports CJS -or- ESM
// const { url, ag, alb } = require('itty-lambda');
// import { url, ag, alb } from 'itty-lambda';

// for just API Gateway support, use 'itty-lambda/ag'
// for just Application Load Balancer support, use 'itty-lambda/alb'
// for just Lambda function url support, use 'itty-lambda/url'

import { AutoRouter } from 'itty-router';

// using an app load balancer...
import { eventToRequest, responseToResult } from 'itty-lambda/alb';

export async function handler (event) {
    const router = AutoRouter();
    router.get('/foo', () => ({ success: true }));

    const request = await eventToRequest(event);
    // { path: string, httpMethod: string, headers: object, ... }
    // ->
    // { url: string, method: string, headers: Headers, ... }

    const response = await router.fetch(request);

    const result = await responseToResult(response);
    // { status: number, headers: Headers, body: ReadableStream, ... }
    // ->
    // { statusCode: number, body: string, headers: object, ... }

    return result;
}
```

Each implementation provides these two named exports, for you to plug in before and after routing...

For more information, see [the documentation](https://EvanK.github.io/itty-lambda/).

## eventToRequest

Accepts an AWS Lambda event for the invocation type, and resolves to a well formed `RequestLike`.

```ts
eventToRequest(
    event: APIGatewayProxyEvent | ALBEvent | LambdaFunctionURLEvent,
    options: EventOptions | undefined
) : Promise<RequestLike>
```

### EventOptions

| Name | Type(s) | Default Value | Description |
| -- | -- | -- | -- |
| **defaultMethod** | `string` | `GET` | HTTP method if none provided from event |


## responseToResult

Accepts a router `Response`, and resolves to a result for the invocation type.

```ts
responseToResult(
    response: Response | undefined,
    options : ResponseOptions | undefined
) : Promise<APIGatewayProxyResult | ALBResult | LambdaFunctionURLResult>
```

### ResponseOptions

| Name | Type(s) | Default Value | Description |
| -- | -- | -- | -- |
| **base64Encode** | `boolean` | `false` | Encode response body |
| **fallbackStatus** | `number` | `404` | Status if no response provided from router |
| **multiValueHeaders** | `boolean` | `false` | Split response headers with multiple values |


<!-- footnotes and urls -->
[itty-router]: https://itty.dev/itty-router/
[lambda-function-urls]: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
[api-gateways]: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-integrations.html
[albs]: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html

# `itty-lambda` - AWS Lambda support for [itty-router]

AWS Lambda functions can respond to HTTP requests by direct [invokable function urls][lambda-function-urls] or through [API gateways][api-gateways] or [Application load balancers][albs].

This library aims to maintain support for running [itty-router] in any such environment.

```js
const {url, ag, alb } = require('itty-lambda');
// CJS -or- ESM
import { url, ag, alb } from 'itty-lambda';
// for just API Gateway support, import from 'itty-lambda/ag'
// for just Application Load Balancer support, import from 'itty-lambda/alb'
// for just Lambda function url support, import from 'itty-lambda/url'

import { AutoRouter } from 'itty-router';

export async function handler (event) {
    router.get('/foo', () => ({ success: true }));

    // { path, httpMethod, ... } => { url, method, ... }
    const request = ag.eventToRequest(event);
    const response = router.fetch(request, ...args);

    // { status, headers, body } => { statusCode, body: string, ... }
    return await ag.responseToResult(response);
}
```

<!-- footnotes and urls -->
[itty-router]: https://itty.dev/itty-router/
[lambda-function-urls]: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
[api-gateways]: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-integrations.html
[albs]: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html

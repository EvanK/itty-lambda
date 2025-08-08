import { AutoRouter } from 'itty-router';
import { eventToRequest, responseToResult } from 'itty-lambda/alb';

export async function handler (event, context) {
    console.log('Executing lambda...')
    const router = AutoRouter();
    console.log('Created and configuring router...');
    router.all('*', (request) => {
      console.log('Executing request handler...');
      console.dir({request, headers: Array.from(request.headers.entries())}, {depth:999});
      return {
        time: new Date().toISOString(),
        functionName: context.functionName,
        functionVerson: context.functionVerson,
        requestId: context.awsRequestId,
      };
    });

    console.log('Converting event to request...');
    console.dir({event}, {depth:999});
    const request = await eventToRequest(event);

    console.log('Routing request...');
    console.dir({request, headers: Array.from(request.headers.entries())}, {depth:999});
    const response = await router.fetch(request);

    console.log('Converting response to result...');
    console.dir({response}, {depth:999});
    const result = await responseToResult(response);

    console.log('Returning result to Lambda service...');
    console.dir({result}, {depth:999});
    return result;
}
